-- 0004 — new document classification: filed GST returns (GSTR-1/3B/9 portal
-- downloads). Born from the first real document ingested: a GSTR-3B the
-- invoice provider misclassified at 0.9 confidence. Returns are neither
-- invoices nor notices; they get their own type + parser provider.
alter type public.document_classification add value if not exists 'gst_return' before 'other';
