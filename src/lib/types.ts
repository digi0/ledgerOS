/**
 * Domain types — the TypeScript mirror of the Supabase schema
 * (supabase/migrations/0001_init.sql). These are the contract the inbox UI,
 * the parser, and the copilot all read against.
 */

export type FirmRole = "owner" | "admin" | "member";

/** Pipeline stage — where a document is in ingestion. */
export type DocumentStatus =
  | "received" // fetched from source
  | "extracted" // OCR / text extraction done
  | "classified" // parser assigned a type + fields
  | "matched" // linked to a client
  | "ready" // finalized, available in the inbox
  | "failed";

/** What kind of document the parser decided this is. */
export type DocumentClassification =
  | "unknown"
  | "invoice"
  | "bank_statement"
  | "notice"
  | "gst_return"
  | "receipt"
  | "tds_certificate"
  | "other";

/** The staff workflow state shown in the inbox (New / In Progress / Handled). */
export type HandlingStatus = "new" | "in_progress" | "handled";

export interface Firm {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  user_id: string;
  firm_id: string | null;
  full_name: string;
  email: string | null;
  role: FirmRole;
  created_at: string;
  updated_at: string;
}

export const CLIENT_SERVICES = {
  gst:         "GST Filing",
  tds:         "TDS Returns",
  itr:         "Income Tax",
  bookkeeping: "Bookkeeping",
  audit:       "Audit",
  roc:         "ROC / Company",
  payroll:     "Payroll",
} as const;

export type ClientService = keyof typeof CLIENT_SERVICES;

export interface Client {
  id: string;
  firm_id: string;
  name: string;
  gstin: string | null;
  pan: string | null;
  primary_email: string | null;
  primary_domain: string | null;
  services: ClientService[];
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  firm_id: string;
  client_id: string | null;
  source_email_id: string | null;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  storage_path: string;
  ocr_text: string | null;
  classification: DocumentClassification;
  classification_confidence: number | null;
  extracted_fields: Record<string, unknown>;
  status: DocumentStatus;
  handling: HandlingStatus;
  error: string | null;
  created_at: string;
  updated_at: string;
}

/** A document row joined with its client name — what the inbox list renders. */
export interface DocumentRow extends Document {
  client: Pick<Client, "id" | "name"> | null;
}

// ---- Display helpers (label maps used across the UI) --------------------

export const CLASSIFICATION_LABELS: Record<DocumentClassification, string> = {
  unknown: "Unclassified",
  invoice: "Invoice",
  bank_statement: "Bank Statement",
  notice: "Notice",
  gst_return: "GST Return",
  receipt: "Receipt",
  tds_certificate: "TDS Certificate",
  other: "Other",
};

export const HANDLING_LABELS: Record<HandlingStatus, string> = {
  new: "New",
  in_progress: "In Progress",
  handled: "Handled",
};
