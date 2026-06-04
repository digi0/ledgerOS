import type { Provider } from "../types";
import { findAmounts, findDate, findGstins, findPans } from "../extractors/india";
import { firstLine, prune } from "./util";

/** Fallback — always matches at a low floor so nothing is ever unhandled. */
export const genericProvider: Provider = {
  id: "generic",
  docType: "unknown",

  match() {
    return 0.1;
  },

  parse(text) {
    const fields = {
      title: firstLine(text),
      gstins: findGstins(text),
      pans: findPans(text),
      date: findDate(text),
      top_amount: findAmounts(text)[0] ?? null,
    };
    return { fields: prune(fields), confidence: 0.2 };
  },
};
