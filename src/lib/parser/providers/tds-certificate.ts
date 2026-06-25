import type { Provider } from "../types";
import {
  capture,
  findAmountNear,
  findPans,
  findTdsSection,
  TDS_SECTIONS,
} from "../extractors/india";
import { clamp, firstLine, prune } from "./util";

const is26AS = (text: string) =>
  /annual tax statement/i.test(text) || /form\s*26as/i.test(text);

/** Form 16 / 16A / 26AS — TDS certificate and annual tax statement. */
export const tdsCertificateProvider: Provider = {
  id: "tds-certificate",
  docType: "tds_certificate",

  match(text) {
    const t = text.toLowerCase();
    let s = 0;
    if (is26AS(text)) return clamp(0.7); // Form 26AS — good match, not perfect
    if (/\bform\s*no\.?\s*16a?\b/.test(t)) s += 0.5;
    if (/certificate under section 203/.test(t)) s += 0.3;
    if (/\b(deductor|deductee)\b/.test(t)) s += 0.2;
    if (/\btds\b|tax deducted at source/.test(t)) s += 0.15;
    if (/\btax invoice\b/.test(t)) s -= 0.4;
    return clamp(s);
  },

  parse(text) {
    if (is26AS(text)) {
      const pans = findPans(text);
      const fields = {
        form: "26AS",
        legal_name: capture(text, /name of assessee\s+(.+?)(?:\s+Address of Assessee|\s+Above data|$)/i),
        pan: pans[0] ?? null,
        fy: capture(text, /financial year\s+([\d\-]+)/i),
        ay: capture(text, /assessment year\s+([\d\-]+)/i),
      };
      return { fields: prune(fields), confidence: 0.92 };
    }

    const section = findTdsSection(text);
    const pans = findPans(text);
    const form = /form\s*no\.?\s*16a/i.test(text) ? "16A" : /form\s*no\.?\s*16\b/i.test(text) ? "16" : null;
    const fields = {
      form,
      deductee: firstLine(text, /form|certificate|tds/i),
      pan: pans[0] ?? null,
      section,
      section_label: section ? TDS_SECTIONS[section] : null,
      quarter: capture(text, /\b(Q[1-4])\b/i) ?? capture(text, /quarter\s*:?\s*([A-Za-z0-9 \-]+)/i),
      amount_paid: findAmountNear(text, /amount paid\/credited|amount paid|amount credited/i),
      tds_amount: findAmountNear(text, /amount of tax deposited|tax deducted|tds deducted|total \(rs/i),
    };
    return { fields: prune(fields), confidence: form ? 0.96 : 0.8 };
  },
};
