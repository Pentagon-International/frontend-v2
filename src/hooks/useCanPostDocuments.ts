import useAuthStore from "../store/authStore";

type MakerCheckerPermissions = {
  maker_checker?: boolean;
  checker?: boolean;
  special_post?: boolean;
  document_type?: string[];
};

/** Document codes from login `screen_permissions.document_type`, grouped by page. */
export const MAKER_CHECKER_DOCUMENT = {
  invoice: "INV",
  /** Invoice reversal and credit note share INVREV and CRN. */
  invoiceReversalAndCreditNote: ["INVREV", "CRN"] as const,
  supplierInvoice: "CRJ",
  supplierInvoiceReversal: "CRJREV",
  receipt: "RPT",
  receiptReversal: "RPTREV",
  payment: "PMT",
  paymentReversal: "PMTREV",
  debitNonTrade: "DNT",
  creditNonTrade: "CNT",
  debitCreditNonTrade: ["DNT", "CNT"] as const,
  journalVoucher: "GLJ",
} as const;

export type PostDocumentType = string | readonly string[];

function normalizeDocumentTypes(
  value?: PostDocumentType | null,
): string[] {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return list
    .map((code) => String(code ?? "").trim().toUpperCase())
    .filter(Boolean);
}

/**
 * Post-button visibility for accounts documents.
 *
 * - maker_checker absent/false: anyone can post
 * - checker or special_post: can post (checker and admin)
 * - maker: cannot post when this page's document type is in their document_type list
 * - maker on a page that does not pass a document type: cannot post
 */
export function canPostDocuments(
  screenPermissions?: MakerCheckerPermissions | null,
  documentType?: PostDocumentType | null,
): boolean {
  if (!screenPermissions?.maker_checker) {
    return true;
  }
  if (screenPermissions.checker || screenPermissions.special_post) {
    return true;
  }

  const pageTypes = normalizeDocumentTypes(documentType);
  if (pageTypes.length === 0) {
    return false;
  }

  const restricted = new Set(
    normalizeDocumentTypes(screenPermissions.document_type),
  );
  return !pageTypes.some((code) => restricted.has(code));
}

/** Checker nav/page is visible only when checker=true. */
export function canAccessCheckerPage(
  screenPermissions?: MakerCheckerPermissions | null,
): boolean {
  return Boolean(screenPermissions?.checker);
}

export function useCanPostDocuments(
  documentType?: PostDocumentType | null,
): boolean {
  const screenPermissions = useAuthStore(
    (state) => state.user?.screen_permissions,
  );
  return canPostDocuments(screenPermissions, documentType);
}

export function useCanAccessCheckerPage(): boolean {
  const screenPermissions = useAuthStore(
    (state) => state.user?.screen_permissions,
  );
  return canAccessCheckerPage(screenPermissions);
}
