/**
 * accounting-parser — deterministic parser for Indian accounting documents.
 *
 *   import { parsePdf, parseText } from "accounting-parser";
 *   const doc = await parsePdf(bytes);   // PDF → ParsedDocument
 *
 * No LLM, no network. Each document format has a provider that scores its
 * recognition confidence; the highest-scoring provider extracts fields, with
 * a generic fallback so nothing is ever unhandled. See ./extractors/india.ts
 * for the GSTIN/PAN/INR/date/section knowledge base every provider builds on.
 */

import { extractText, getDocumentProxy } from "unpdf";
import type { ParsedDocument } from "./types";
import { findGstins, findPans } from "./extractors/india";
import { genericProvider, providers } from "./providers/index";

export type { ParsedDocument, DocType, Provider } from "./types";
export { providers, genericProvider } from "./providers/index";
export * as india from "./extractors/india";

/** Classify + extract from already-extracted plain text. */
export function parseText(text: string, pages = 1): ParsedDocument {
  const clean = text.replace(/\r/g, "").replace(/[ \t]+/g, " ");

  let best = genericProvider;
  let bestScore = genericProvider.match(clean);
  for (const p of providers) {
    const score = p.match(clean);
    if (score > bestScore) {
      best = p;
      bestScore = score;
    }
  }

  const result = best.parse(clean);
  return {
    docType: best.docType,
    provider: best.id,
    confidence: result.confidence ?? bestScore,
    fields: result.fields,
    parties: { gstins: findGstins(clean), pans: findPans(clean) },
    rawText: clean.trim(),
    pages,
  };
}

/** Extract text from a PDF (via unpdf's serverless-safe pdf.js) then parse. */
export async function parsePdf(data: Uint8Array | ArrayBuffer | Buffer): Promise<ParsedDocument> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data as ArrayBuffer);
  const pdf = await getDocumentProxy(bytes);
  // mergePages: true → `text` is a single string.
  const { text, totalPages } = await extractText(pdf, { mergePages: true });
  return parseText(Array.isArray(text) ? text.join("\n") : text, totalPages);
}
