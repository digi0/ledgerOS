/**
 * Re-parse merge rules. The hazard this guards: a backfill that silently
 * overwrites values a CA corrected by hand, or resurrects a field they
 * deliberately deleted.
 *
 * Run: npx tsx scripts/test-reparse.ts
 */

import { diffFields, mergeReparsed, reparsePatch } from "../src/lib/reparse";
import type { ParsedDocument } from "../src/lib/parser";

let passed = 0,
  failed = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
}

console.log("plain re-parse (no manual edits)");
{
  const previous = { vendor_name: "Neminath Sarees", total: 5000 }; // buyer, wrongly stored as vendor
  const parsed = { vendor_name: "Ganesh Textiles Pvt Ltd", total: 5000 };
  const merged = mergeReparsed(previous, parsed);

  check("wrong vendor is corrected", merged.vendor_name === "Ganesh Textiles Pvt Ltd");
  check("untouched field survives", merged.total === 5000);
  check("no _edited introduced", merged._edited === undefined);
  check("diff names the changed field", JSON.stringify(diffFields(previous, merged)) === '["vendor_name"]');
}

console.log("\nmanual edit is preserved");
{
  const previous = {
    vendor_name: "Ganesh Textiles Pvt Ltd", // CA fixed this by hand
    total: 5000,
    _edited: ["vendor_name"],
  };
  const parsed = { vendor_name: "Something The Parser Guessed", total: 5200 };
  const merged = mergeReparsed(previous, parsed);

  check("hand-corrected value is NOT overwritten", merged.vendor_name === "Ganesh Textiles Pvt Ltd", `got ${merged.vendor_name}`);
  check("un-edited field still updates", merged.total === 5200);
  check("_edited ledger carried forward", JSON.stringify(merged._edited) === '["vendor_name"]');
}

console.log("\ndeliberate deletion stays deleted");
{
  // CA deleted a bogus field; the parser still produces it.
  const previous = { total: 5000, _edited: ["hsn_codes"] };
  const parsed = { total: 5000, hsn_codes: ["997212"] };
  const merged = mergeReparsed(previous, parsed);

  check("deleted field is not resurrected", !("hsn_codes" in merged), `got ${JSON.stringify(merged.hsn_codes)}`);
}

console.log("\nmetadata is excluded from the diff");
{
  const previous = { total: 5000, _date_confident: false };
  const merged = mergeReparsed(previous, { total: 5000, _date_confident: true });
  check("confidence flip alone is not a content change", diffFields(previous, merged).length === 0);
}

console.log("\nreparsePatch reports what it did");
{
  const previous = { vendor_name: "Neminath Sarees", invoice_number: "G/31Date", _edited: ["total"], total: 9999 };
  const parsed = {
    fields: { vendor_name: "Ganesh Textiles Pvt Ltd", invoice_number: "G/31", total: 5000 },
    confidence: 0.97,
  } as unknown as ParsedDocument;

  const patch = reparsePatch(previous, parsed);
  check("changed lists both corrected fields",
    JSON.stringify(patch.changed) === '["invoice_number","vendor_name"]', `got ${JSON.stringify(patch.changed)}`);
  check("preserved lists the hand-edited field", JSON.stringify(patch.preserved) === '["total"]');
  check("hand-edited total kept", patch.extracted_fields.total === 9999);
  check("confidence carried from the parse", patch.classification_confidence === 0.97);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
