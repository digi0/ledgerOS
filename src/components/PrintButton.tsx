"use client";

import { Printer } from "lucide-react";

/** Print / Save-as-PDF the invoice sheet. Print CSS (globals.css) hides the app
 *  chrome so only #invoice-print reaches the page. */
export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="btn-glass inline-flex items-center gap-2 rounded-[10px] bg-[var(--color-brand)] px-4 py-2 text-[13px] font-medium text-white hover:bg-[var(--color-brand-strong)]"
    >
      <Printer className="h-4 w-4" /> Print / Save PDF
    </button>
  );
}
