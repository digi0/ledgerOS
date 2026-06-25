import type { Provider } from "../types";
import { capture, findAmountNear, findDate } from "../extractors/india";
import { clamp, prune } from "./util";

const BANKS = [
  "HDFC Bank", "ICICI Bank", "State Bank of India", "SBI", "Axis Bank",
  "Kotak Mahindra Bank", "Kotak", "Yes Bank", "Punjab National Bank", "PNB",
  "Bank of Baroda", "IDFC FIRST Bank", "IndusInd Bank", "Union Bank",
  "Canara Bank", "IDBI Bank", "Federal Bank", "RBL Bank",
  "Kalupur Commercial", "Kalupur Co-op", "Co-operative Bank", "Saraswat Bank",
  "Abhyudaya Bank", "Cosmos Bank", "Janata Sahakari", "Mehsana Urban",
];

/** Try progressively looser patterns; never return a > 60-char string (that's a header dump). */
function accountHolder(text: string): string | null {
  const candidates = [
    // Explicit label
    capture(text, /(?:account holder|account name|a\/c holder|name of account holder)\s*:?\s*([A-Za-z][A-Za-z .&'-]{2,58})/i),
    // Name appears right before "Tran Date" (common in co-op/regional bank PDFs);
    // skip an IFSC code if it immediately follows "IFSC :", but don't eat first name word
    capture(text, /IFSC\s*:?\s*(?:[A-Z]{4}0[A-Z0-9]{6}\s+)?([A-Z][A-Z .&'-]{3,50})\s+Tran Date/i),
    // Name appears after "SURAT -" or "MUMBAI -" etc. before "BRANCH"
    capture(text, /(?:SURAT|MUMBAI|DELHI|AHMEDABAD|PUNE|CHENNAI|HYDERABAD|BANGALORE|KOLKATA)\s+-\s+([A-Z][A-Z &.-]{3,50}?)\s+(?:RING ROAD|BRANCH|MAIN)/i),
  ];
  return candidates.find((v): v is string => typeof v === "string" && v.trim().length >= 3) ?? null;
}

export const bankStatementProvider: Provider = {
  id: "bank-statement",
  docType: "bank_statement",

  match(text) {
    const t = text.toLowerCase();
    let s = 0;
    if (/\b(bank statement|account statement|statement of account)\b/.test(t)) s += 0.5;
    if (/\bclosing balance\b/.test(t)) s += 0.2;
    if (/\bifsc\b/.test(t)) s += 0.15;
    if (/\b(withdrawal|deposit|debit|credit)\b/.test(t) && /\bbalance\b/.test(t)) s += 0.15;
    if (/\btax invoice\b/.test(t)) s -= 0.4;
    return clamp(s);
  },

  parse(text) {
    const bank = BANKS.find((b) => new RegExp(b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(text)) ?? null;
    const fields = {
      bank,
      account_holder: accountHolder(text),
      account_number: capture(text, /a\/?c\s*(?:no|number)?\.?\s*:?\s*([0-9Xx*]{4,18})/i),
      ifsc: capture(text, /ifsc\s*:?\s*([A-Z]{4}0[A-Z0-9]{6})/i),
      period:
        capture(text, /(?:statement period|period)\s*:?\s*([0-9A-Za-z/.\- ]+to[0-9A-Za-z/.\- ]+)/i) ??
        capture(text, /(?:statement period|period)\s*:?\s*(\d{2}[-/]\d{2}[-/]\d{4}\s+\d{2}[-/]\d{2}[-/]\d{4})/i),
      closing_balance: findAmountNear(text, /closing balance/i),
      opening_balance: findAmountNear(text, /opening balance/i),
      statement_date: findDate(text, /statement date|date/i),
    };
    return { fields: prune(fields), confidence: fields.bank ? 0.94 : 0.85 };
  },
};
