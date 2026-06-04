import type { Provider } from "../types";
import { capture, findAmountNear, findDate } from "../extractors/india";
import { clamp, prune } from "./util";

const BANKS = [
  "HDFC Bank", "ICICI Bank", "State Bank of India", "SBI", "Axis Bank",
  "Kotak Mahindra Bank", "Kotak", "Yes Bank", "Punjab National Bank", "PNB",
  "Bank of Baroda", "IDFC FIRST Bank", "IndusInd Bank", "Union Bank",
  "Canara Bank", "IDBI Bank", "Federal Bank", "RBL Bank",
];

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
    const bank = BANKS.find((b) => new RegExp(`\\b${b}\\b`, "i").test(text)) ?? null;
    const fields = {
      bank,
      account_holder: text.split("\n").map((l) => l.trim()).find((l) => l.length > 3) ?? null,
      account_number: capture(text, /a\/?c\s*(?:no|number)?\.?\s*:?\s*([0-9Xx*]{4,18})/i),
      ifsc: capture(text, /ifsc\s*:?\s*([A-Z]{4}0[A-Z0-9]{6})/i),
      period: capture(text, /(?:statement period|period)\s*:?\s*([0-9A-Za-z/.\- ]+to[0-9A-Za-z/.\- ]+)/i),
      closing_balance: findAmountNear(text, /closing balance/i),
      opening_balance: findAmountNear(text, /opening balance/i),
      statement_date: findDate(text, /statement date|date/i),
    };
    return { fields: prune(fields), confidence: fields.bank ? 0.94 : 0.85 };
  },
};
