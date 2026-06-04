/** Document kinds the parser recognises. Maps to LedgerOS classifications. */
export type DocType =
  | "invoice"
  | "bank_statement"
  | "tds_certificate"
  | "notice" // GST or Income-Tax notice
  | "receipt"
  | "unknown";

export interface ParsedDocument {
  /** Winning document type. */
  docType: DocType;
  /** 0..1 — how confident the winning provider is. */
  confidence: number;
  /** Provider id that produced the result. */
  provider: string;
  /** Flat field bag the downstream modules consume. */
  fields: Record<string, unknown>;
  /** Every tax entity found anywhere in the doc — used by the client matcher. */
  parties: { gstins: string[]; pans: string[] };
  /** Extracted plain text (for full-text search + audit). */
  rawText: string;
  pages: number;
}

export interface ProviderResult {
  fields: Record<string, unknown>;
  /** Optional confidence boost/override once the provider has actually parsed. */
  confidence?: number;
}

export interface Provider {
  id: string;
  docType: DocType;
  /** Recognition score 0..1 from the raw text (cheap signal). */
  match(text: string): number;
  /** Produce structured fields. Only called for the highest-matching provider. */
  parse(text: string): ProviderResult;
}
