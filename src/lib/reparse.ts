/**
 * Re-run the parser over a document that is already stored.
 *
 * Needed because parsing only ever happened at upload time, so every row
 * ingested before the buyer/seller and invoice-number/date fixes carries
 * whatever the old positional guesses produced. The original PDFs are in
 * Storage, so the fix is replayable.
 *
 * What it deliberately does NOT touch:
 *   - `client_id` / `handling` — a human may have reassigned or triaged.
 *   - any field listed in `_edited` — a human corrected it by hand.
 * Both are human judgement the parser has no business overwriting.
 */

import type { ParsedDocument } from "./parser";

/** Keys that carry parser/bookkeeping metadata rather than document content.
 *  Hidden from the field editor and never treated as extracted values. */
export const META_PREFIX = "_";

export function isMetaKey(key: string): boolean {
  return key.startsWith(META_PREFIX);
}

/**
 * Merge freshly parsed fields over the stored ones, preserving manual edits.
 *
 * A key in `_edited` wins in both directions: if the human set a value it is
 * kept, and if the human deleted the field it stays deleted rather than being
 * resurrected by the parser.
 */
export function mergeReparsed(
  previous: Record<string, unknown>,
  parsed: Record<string, unknown>,
): Record<string, unknown> {
  const edited = Array.isArray(previous._edited) ? (previous._edited as string[]) : [];
  const merged: Record<string, unknown> = { ...parsed };

  for (const key of edited) {
    if (Object.prototype.hasOwnProperty.call(previous, key)) merged[key] = previous[key];
    else delete merged[key]; // deliberately deleted by a human — keep it gone
  }

  if (edited.length) merged._edited = edited;
  return merged;
}

export interface ReparseOutcome {
  id: string;
  ok: boolean;
  /** Fields whose value the re-parse actually changed (excludes metadata). */
  changed: string[];
  /** Fields left alone because a human had edited them. */
  preserved: string[];
  error?: string;
}

/** Which content fields differ between the stored and merged bags. */
export function diffFields(
  previous: Record<string, unknown>,
  merged: Record<string, unknown>,
): string[] {
  const keys = new Set([...Object.keys(previous), ...Object.keys(merged)]);
  const changed: string[] = [];
  for (const k of keys) {
    if (isMetaKey(k)) continue;
    if (JSON.stringify(previous[k]) !== JSON.stringify(merged[k])) changed.push(k);
  }
  return changed.sort();
}

/**
 * The row update a re-parse produces. Kept separate from any Supabase client
 * so the same logic serves the server action and the bulk backfill script.
 */
export function reparsePatch(
  previous: Record<string, unknown>,
  parsed: ParsedDocument,
): { extracted_fields: Record<string, unknown>; classification_confidence: number; changed: string[]; preserved: string[] } {
  const merged = mergeReparsed(previous, parsed.fields);
  const preserved = (Array.isArray(previous._edited) ? (previous._edited as string[]) : []).filter(
    (k) => !isMetaKey(k),
  );
  return {
    extracted_fields: merged,
    classification_confidence: parsed.confidence,
    changed: diffFields(previous, merged),
    preserved,
  };
}
