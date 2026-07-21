/**
 * Backfill: re-parse every stored document with the current parser.
 *
 * Needed once, because parsing only ran at upload, so rows ingested before the
 * buyer/seller and invoice-number/date fixes still carry the old positional
 * guesses. Originals live in Storage, so this replays them.
 *
 * Preserved, never overwritten: `client_id`, `handling`, and any field a human
 * corrected by hand (tracked in `_edited`).
 *
 *   npx tsx scripts/reparse.ts              # dry run — reports, writes nothing
 *   npx tsx scripts/reparse.ts --apply      # actually writes
 *   npx tsx scripts/reparse.ts --apply --id <uuid>
 */

import { createClient } from "@supabase/supabase-js";
import { parsePdf } from "../src/lib/parser";
import { reparsePatch } from "../src/lib/reparse";
import { loadEnv } from "./lib.mjs";

const env = loadEnv();
const apply = process.argv.includes("--apply");
const onlyId = process.argv[process.argv.indexOf("--id") + 1];

if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be in .env.local");
  process.exit(1);
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let q = sb
  .from("document")
  .select("id, filename, storage_path, extracted_fields")
  .not("storage_path", "is", null)
  .order("created_at", { ascending: true });
if (onlyId && process.argv.includes("--id")) q = q.eq("id", onlyId);

const { data: docs, error } = await q;
if (error) {
  console.error("query failed:", error.message);
  process.exit(1);
}

console.log(
  `${apply ? "APPLYING" : "DRY RUN"} — ${docs.length} document(s)${apply ? "" : "; nothing will be written"}\n`,
);

let changed = 0,
  unchanged = 0,
  failed = 0,
  preservedTotal = 0;

for (const doc of docs) {
  const label = `${doc.filename} (${doc.id.slice(0, 8)})`;
  const file = await sb.storage.from("documents").download(doc.storage_path);
  if (file.error || !file.data) {
    // Seed rows point at files that were never uploaded — expected, not a fault.
    console.log(`  · ${label} — no stored file, skipped`);
    failed++;
    continue;
  }

  let parsed;
  try {
    parsed = await parsePdf(new Uint8Array(await file.data.arrayBuffer()));
  } catch {
    console.log(`  ✗ ${label} — unreadable PDF, left unchanged`);
    failed++;
    continue;
  }

  const previous = (doc.extracted_fields ?? {}) as Record<string, unknown>;
  const patch = reparsePatch(previous, parsed);
  preservedTotal += patch.preserved.length;

  if (patch.changed.length === 0) {
    unchanged++;
    continue;
  }

  changed++;
  const detail = patch.changed
    .map((k) => `${k}: ${fmt(previous[k])} → ${fmt(patch.extracted_fields[k])}`)
    .join("\n      ");
  console.log(`  ${apply ? "✓" : "→"} ${label}\n      ${detail}`);
  if (patch.preserved.length) {
    console.log(`      (kept your edits: ${patch.preserved.join(", ")})`);
  }

  if (apply) {
    const { error: upErr } = await sb
      .from("document")
      .update({
        extracted_fields: patch.extracted_fields,
        classification_confidence: patch.classification_confidence,
        ocr_text: parsed.rawText.slice(0, 50000),
      })
      .eq("id", doc.id);
    if (upErr) {
      console.log(`      ! write failed: ${upErr.message}`);
      failed++;
      changed--;
    }
  }
}

console.log(
  `\n${changed} changed · ${unchanged} already correct · ${failed} skipped` +
    (preservedTotal ? ` · ${preservedTotal} manual edit(s) preserved` : ""),
);
if (!apply && changed > 0) console.log("\nRe-run with --apply to write these.");

function fmt(v: unknown): string {
  if (v === undefined) return "—";
  return typeof v === "string" ? `"${v}"` : JSON.stringify(v);
}
