import type { SupportingDocument } from "./customerVerificationFormData";

export type CustomerDocumentListItem = {
  id: number;
  document?: string;
  document_name?: string;
  document_url?: string;
  file_name?: string;
  file_size?: number;
  uploaded_at?: string;
};

export function getCustomerDocumentUrl(
  doc: Pick<CustomerDocumentListItem, "document" | "document_url">,
): string {
  return String(doc.document_url ?? doc.document ?? "").trim();
}

export function getCustomerDocumentLabel(
  doc: Pick<CustomerDocumentListItem, "document_name" | "file_name" | "id">,
): string {
  const name = String(doc.document_name ?? "").trim();
  if (name) return name;
  const fileName = String(doc.file_name ?? "").trim();
  if (fileName) return fileName;
  return doc.id != null ? `Document ${doc.id}` : "Document";
}

export function getCustomerDocumentFileLabel(
  doc: Pick<CustomerDocumentListItem, "file_name" | "document_name" | "id">,
): string {
  const fileName = String(doc.file_name ?? "").trim();
  if (fileName) return fileName;
  return getCustomerDocumentLabel(doc);
}

export function openCustomerDocumentInNewTab(
  doc: Pick<
    CustomerDocumentListItem,
    "document" | "document_url" | "document_name" | "file_name" | "id"
  >,
): void {
  const url = getCustomerDocumentUrl(doc);
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
}

export function mapDocumentsListToSupportingDocuments(
  documentsList: CustomerDocumentListItem[],
): SupportingDocument[] {
  if (!Array.isArray(documentsList) || documentsList.length === 0) {
    return [];
  }
  return documentsList.map((doc) => ({
    name: String(doc.document_name ?? "").trim(),
    file: null,
    document_url: getCustomerDocumentUrl(doc) || undefined,
    document_id: doc.id,
    original_document_name: String(doc.file_name ?? "").trim(),
  }));
}

export function extractDocumentsListFromResponse(
  response: unknown,
): CustomerDocumentListItem[] {
  let current: unknown = response;
  for (let depth = 0; depth < 3; depth += 1) {
    if (!current || typeof current !== "object") break;
    const obj = current as Record<string, unknown>;
    if (Array.isArray(obj.documents_list)) {
      return obj.documents_list as CustomerDocumentListItem[];
    }
    if (obj.data && typeof obj.data === "object") {
      current = obj.data;
      continue;
    }
    break;
  }
  return [];
}

export function supportingDocumentsToPendingDisplayList(
  documents: SupportingDocument[],
): CustomerDocumentListItem[] {
  return documents
    .filter(
      (doc) =>
        doc.file != null &&
        (String(doc.name ?? "").trim().length > 0 || doc.file.name),
    )
    .map((doc, index) => ({
      id: doc.document_id ?? -(index + 1),
      document_name: String(doc.name ?? "").trim() || doc.file?.name || "Document",
      file_name: doc.file?.name ?? "",
    }));
}

export function resolveDisplayDocumentsList(
  apiDocuments: CustomerDocumentListItem[],
  supportingDocuments: SupportingDocument[],
): CustomerDocumentListItem[] {
  if (apiDocuments.length > 0) return apiDocuments;
  return supportingDocumentsToPendingDisplayList(supportingDocuments);
}

export function mergeSupportingDocumentsWithApiList(
  existing: SupportingDocument[],
  documentsList: CustomerDocumentListItem[],
): SupportingDocument[] {
  const fromApi = mapDocumentsListToSupportingDocuments(documentsList);
  const pendingNewUploads = existing.filter((doc) => doc.file != null);
  if (pendingNewUploads.length === 0) return fromApi;
  return [...fromApi, ...pendingNewUploads];
}
