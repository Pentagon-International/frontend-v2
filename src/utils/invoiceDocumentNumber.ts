export type InvoiceDocumentNoSource = {
  reverse_document_no?: string | null;
  reverse_document_number?: string | null;
  document_no?: string | null;
};

export function getInvoiceDocumentNo(
  source?: InvoiceDocumentNoSource | null,
  fallback?: string | null,
): string {
  const value =
    source?.reverse_document_no ??
    source?.reverse_document_number ??
    source?.document_no ??
    fallback;
  return value != null ? String(value).trim() : "";
}

export function formatInvoiceDocumentNo(
  source?: InvoiceDocumentNoSource | null,
  fallback?: string | null,
): string {
  return getInvoiceDocumentNo(source, fallback) || "-";
}
