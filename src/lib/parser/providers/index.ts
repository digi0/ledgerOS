import type { Provider } from "../types";
import { invoiceProvider } from "./invoice";
import { bankStatementProvider } from "./bank-statement";
import { tdsCertificateProvider } from "./tds-certificate";
import { noticeProvider } from "./notice";
import { gstReturnProvider } from "./gst-return";
import { receiptProvider } from "./receipt";
import { genericProvider } from "./generic";

/** Specialised providers, tried in order; generic is the floor. */
export const providers: Provider[] = [
  invoiceProvider,
  bankStatementProvider,
  tdsCertificateProvider,
  noticeProvider,
  gstReturnProvider,
  receiptProvider,
];

export { genericProvider };
