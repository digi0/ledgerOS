-- ============================================================
-- LedgerOS — demo seed (dev only). Idempotent: safe to re-run.
-- Run with the service-role connection (bypasses RLS). Populates one
-- firm so the inbox + COA render before auth and the parser exist.
-- ============================================================
-- Fixed UUID for the demo firm so references stay stable across re-runs.
--   firm: 11111111-1111-1111-1111-111111111111
-- ============================================================

begin;

-- Wipe prior demo rows (children first) so re-running is clean.
delete from public.document          where firm_id = '11111111-1111-1111-1111-111111111111';
delete from public.chart_of_accounts where firm_id = '11111111-1111-1111-1111-111111111111';
delete from public.ingested_email    where firm_id = '11111111-1111-1111-1111-111111111111';
delete from public.email_account     where firm_id = '11111111-1111-1111-1111-111111111111';
delete from public.client            where firm_id = '11111111-1111-1111-1111-111111111111';
delete from public.firm              where id      = '11111111-1111-1111-1111-111111111111';

-- ---------- firm ----------
insert into public.firm (id, name, slug) values
  ('11111111-1111-1111-1111-111111111111', 'Sharma & Associates', 'sharma-associates');

-- ---------- clients (format-valid synthetic GSTIN/PAN) ----------
insert into public.client (id, firm_id, name, gstin, pan, primary_email, primary_domain) values
  ('c1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
     'Patel Textiles Pvt Ltd', '24ABCDE1234F1Z5', 'ABCDE1234F', 'accounts@pateltextiles.com', 'pateltextiles.com'),
  ('c1000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
     'Mehta Foods Ltd',        '27MNOPQ5678R1Z3', 'MNOPQ5678R', 'finance@mehtafoods.in',     'mehtafoods.in'),
  ('c1000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
     'Krishna Motors',         '29KLMNO9012P1Z8', 'KLMNO9012P', 'billing@krishnamotors.co.in','krishnamotors.co.in'),
  ('c1000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111',
     'Verma Tech Solutions',   '07VWXYZ3456T1Z1', 'VWXYZ3456T', 'ar@vermatech.io',           'vermatech.io');

-- ---------- chart of accounts (standard Indian small-business COA) ----------
-- Groups first, then postable ledgers (parent linked by code subselect).
insert into public.chart_of_accounts (firm_id, code, name, type, is_group) values
  ('11111111-1111-1111-1111-111111111111', '1000', 'Assets',            'asset',     true),
  ('11111111-1111-1111-1111-111111111111', '2000', 'Liabilities',       'liability', true),
  ('11111111-1111-1111-1111-111111111111', '3000', 'Equity',            'equity',    true),
  ('11111111-1111-1111-1111-111111111111', '4000', 'Income',            'income',    true),
  ('11111111-1111-1111-1111-111111111111', '5000', 'Expenses',          'expense',   true);

-- helper: insert a ledger under a parent identified by code
-- (separate statements so the parent subselect resolves)
insert into public.chart_of_accounts (firm_id, code, name, type, is_group, parent_id)
select '11111111-1111-1111-1111-111111111111', v.code, v.name, v.type::public.account_type, v.is_group,
       (select id from public.chart_of_accounts
          where firm_id = '11111111-1111-1111-1111-111111111111' and code = v.parent)
from (values
  -- Assets
  ('1100','Bank - Current A/c',  'asset',     false, '1000'),
  ('1110','Cash in Hand',        'asset',     false, '1000'),
  ('1200','Sundry Debtors',      'asset',     false, '1000'),
  ('1301','CGST Input Credit',   'asset',     false, '1000'),
  ('1302','SGST Input Credit',   'asset',     false, '1000'),
  ('1303','IGST Input Credit',   'asset',     false, '1000'),
  ('1400','TDS Receivable',      'asset',     false, '1000'),
  -- Liabilities
  ('2100','Sundry Creditors',    'liability', false, '2000'),
  ('2201','CGST Output Payable', 'liability', false, '2000'),
  ('2202','SGST Output Payable', 'liability', false, '2000'),
  ('2203','IGST Output Payable', 'liability', false, '2000'),
  ('2300','TDS Payable',         'liability', false, '2000'),
  -- Equity
  ('3100','Capital Account',     'equity',    false, '3000'),
  ('3200','Reserves & Surplus',  'equity',    false, '3000'),
  -- Income
  ('4100','Sales',               'income',    false, '4000'),
  ('4200','Other Income',        'income',    false, '4000'),
  -- Expenses
  ('5100','Purchases',           'expense',   false, '5000'),
  ('5310','Rent',                'expense',   false, '5000'),
  ('5320','Salaries',            'expense',   false, '5000'),
  ('5330','Bank Charges',        'expense',   false, '5000')
) as v(code, name, type, is_group, parent);

-- ---------- sample documents (so the inbox renders pre-parser) ----------
-- storage_path points at demo/* — actual PDFs land when the parser/ingestion
-- pipeline runs; preview will gracefully 404 until then.
insert into public.document
  (firm_id, client_id, filename, mime_type, size_bytes, storage_path, ocr_text,
   classification, classification_confidence, extracted_fields, status, handling)
values
  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000001',
   'patel-textiles-invoice-4471.pdf', 'application/pdf', 184320, 'demo/patel-textiles-invoice-4471.pdf',
   'Tax Invoice Patel Textiles Pvt Ltd GSTIN 24ABCDE1234F1Z5 Invoice 4471 cotton fabric',
   'invoice', 0.97,
   '{"vendor_name":"Patel Textiles Pvt Ltd","gstin":"24ABCDE1234F1Z5","invoice_number":"INV-4471","date":"2026-05-28","taxable_value":125000,"cgst":11250,"sgst":11250,"total":147500}'::jsonb,
   'ready', 'new'),

  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000002',
   'mehta-foods-hdfc-statement-apr2026.pdf', 'application/pdf', 562176, 'demo/mehta-foods-hdfc-statement-apr2026.pdf',
   'HDFC Bank Statement Mehta Foods Ltd April 2026 closing balance 842310',
   'bank_statement', 0.93,
   '{"bank":"HDFC Bank","account_holder":"Mehta Foods Ltd","period":"2026-04-01 to 2026-04-30","closing_balance":842310,"transactions":118}'::jsonb,
   'ready', 'in_progress'),

  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000003',
   'krishna-motors-gst-asmt-10.pdf', 'application/pdf', 96256, 'demo/krishna-motors-gst-asmt-10.pdf',
   'Form GST ASMT-10 scrutiny notice Krishna Motors GSTIN 29KLMNO9012P1Z8 discrepancy ITC',
   'notice', 0.95,
   '{"notice_type":"GST ASMT-10","authority":"State GST, Karnataka","gstin":"29KLMNO9012P1Z8","due_date":"2026-06-18","amount_disputed":63400,"subject":"ITC mismatch FY 2024-25"}'::jsonb,
   'ready', 'new'),

  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000004',
   'verma-tech-form16a-q4.pdf', 'application/pdf', 78848, 'demo/verma-tech-form16a-q4.pdf',
   'Form 16A TDS certificate Verma Tech Solutions PAN VWXYZ3456T section 194J Q4',
   'tds_certificate', 0.96,
   '{"form":"16A","deductee":"Verma Tech Solutions","pan":"VWXYZ3456T","section":"194J","quarter":"Q4 FY2025-26","tds_amount":18750,"amount_paid":187500}'::jsonb,
   'ready', 'handled'),

  ('11111111-1111-1111-1111-111111111111', null,
   'unknown-vendor-invoice-scan.pdf', 'application/pdf', 210944, 'demo/unknown-vendor-invoice-scan.pdf',
   'Tax Invoice GSTIN 33AAFCS1234M1Z9 office supplies stationery total 9440',
   'invoice', 0.82,
   '{"vendor_name":"(unrecognised)","gstin":"33AAFCS1234M1Z9","invoice_number":"S-2291","date":"2026-05-30","taxable_value":8000,"total":9440}'::jsonb,
   'classified', 'new'),

  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000001',
   'patel-textiles-courier-receipt.pdf', 'application/pdf', 45056, 'demo/patel-textiles-courier-receipt.pdf',
   'Courier receipt Patel Textiles Blue Dart 540',
   'receipt', 0.88,
   '{"vendor_name":"Blue Dart","date":"2026-05-29","total":540,"category":"courier"}'::jsonb,
   'ready', 'handled'),

  ('11111111-1111-1111-1111-111111111111', null,
   'income-tax-intimation-143-1.pdf', 'application/pdf', 132096, 'demo/income-tax-intimation-143-1.pdf',
   'Income Tax Intimation under section 143(1) refund determined',
   'notice', 0.9,
   '{"notice_type":"Intimation u/s 143(1)","authority":"CPC, Income Tax","ay":"2025-26","refund_determined":12480}'::jsonb,
   'classified', 'new'),

  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000002',
   'mehta-foods-invoice-8820.pdf', 'application/pdf', 167936, 'demo/mehta-foods-invoice-8820.pdf',
   'Tax Invoice Mehta Foods Ltd GSTIN 27MNOPQ5678R1Z3 invoice 8820 packaged goods',
   'invoice', 0.98,
   '{"vendor_name":"Mehta Foods Ltd","gstin":"27MNOPQ5678R1Z3","invoice_number":"INV-8820","date":"2026-06-01","taxable_value":54000,"cgst":4860,"sgst":4860,"total":63720}'::jsonb,
   'ready', 'new');

commit;
