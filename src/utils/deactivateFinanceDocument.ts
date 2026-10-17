import { apiCallProtected } from "../api/axios";
import { URL } from "../api/serverUrls";

/** Document kinds that support soft-delete (PATCH status → INACTIVE) when UNPOSTED. */
export type DeactivatableFinanceKind =
  | "invoice"
  | "credit_note"
  | "reverse_invoice"
  | "receipt"
  | "reverse_receipt"
  | "payment"
  | "reverse_payment"
  | "journal_voucher"
  | "reverse_voucher"
  | "supplier_invoice"
  | "reverse_supplier_invoice";

const ENDPOINT_BY_KIND: Record<DeactivatableFinanceKind, string> = {
  invoice: URL.invoice,
  credit_note: URL.invoice,
  reverse_invoice: URL.reverseInvoice,
  receipt: URL.receipt,
  reverse_receipt: URL.reverseReceipt,
  payment: URL.payment,
  reverse_payment: URL.reversePayment,
  journal_voucher: URL.journalVoucher,
  reverse_voucher: URL.journalVoucherReversal,
  /** Same API for RCM and non-RCM (RCM uses `is_rcm` on the record). */
  supplier_invoice: URL.supplierInvoice,
  reverse_supplier_invoice: URL.reverseSupplierInvoice,
};

const LABEL_BY_KIND: Record<DeactivatableFinanceKind, string> = {
  invoice: "invoice",
  credit_note: "credit note",
  reverse_invoice: "reverse invoice",
  receipt: "receipt",
  reverse_receipt: "reverse receipt",
  payment: "payment",
  reverse_payment: "reverse payment",
  journal_voucher: "journal voucher",
  reverse_voucher: "journal voucher reversal",
  supplier_invoice: "supplier invoice",
  reverse_supplier_invoice: "supplier invoice reverse",
};

/** Map finance-documents / job-finance `record_type` / `document_type` to a delete kind. */
export function resolveDeactivatableFinanceKind(
  recordType: string | null | undefined,
): DeactivatableFinanceKind | null {
  const t = String(recordType ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  switch (t) {
    case "invoice":
    case "inv":
      return "invoice";
    case "credit_note":
    case "crn":
    case "cn":
    case "cdn":
      return "credit_note";
    case "reverse_invoice":
    case "invoice_reverse":
    case "invrev":
    case "inv_rev":
      return "reverse_invoice";
    case "receipt":
    case "rpt":
    case "overseas_receipt":
      return "receipt";
    case "reverse_receipt":
    case "receipt_reverse":
    case "rptrev":
    case "rpt_rev":
      return "reverse_receipt";
    case "payment":
    case "pmt":
    case "overseas_payment":
      return "payment";
    case "reverse_payment":
    case "payment_reverse":
    case "pmtrev":
    case "pmt_rev":
      return "reverse_payment";
    case "journal_voucher":
    case "jv":
    case "glj":
      return "journal_voucher";
    case "reverse_voucher":
    case "journal_voucher_reversal":
    case "jvrev":
    case "jv_rev":
    case "gljrev":
      return "reverse_voucher";
    case "supplier_invoice":
    case "crj":
    case "cinv":
    case "supplier_invoice_rcm":
      return "supplier_invoice";
    case "reverse_supplier_invoice":
    case "supplier_invoice_reverse":
    case "crjrev":
    case "cinvrev":
    case "reverse_supplier_invoice_rcm":
      return "reverse_supplier_invoice";
    default:
      return null;
  }
}

export function getFinanceDocumentDeleteLabels(kind: DeactivatableFinanceKind): {
  title: string;
  message: string;
  success: string;
  failure: string;
} {
  const label = LABEL_BY_KIND[kind];
  return {
    title: `Delete ${label}`,
    message: `Are you sure you want to delete this ${label}? This action cannot be undone.`,
    success: `${label.charAt(0).toUpperCase()}${label.slice(1)} deleted successfully`,
    failure: `Failed to delete ${label}. Please try again.`,
  };
}

/** Soft-delete an unposted finance document by PATCHing status to INACTIVE. */
export async function deactivateFinanceDocument(
  kind: DeactivatableFinanceKind,
  documentId: number,
  config?: Record<string, unknown>,
): Promise<void> {
  const endpoint = ENDPOINT_BY_KIND[kind];
  await apiCallProtected.patch(
    `${endpoint}${documentId}/`,
    { id: documentId, status: "INACTIVE" },
    config,
  );
}
