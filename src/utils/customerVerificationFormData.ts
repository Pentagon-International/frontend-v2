import { API_HEADER } from "../store/storeKeys";

export const MAX_SUPPORTING_DOCUMENT_SIZE = 5 * 1024 * 1024;

export type SupportingDocument = {
  name: string;
  file: File | null;
  document_url?: string;
  document_id?: number;
  original_document_name?: string;
};

export const EMPTY_SUPPORTING_DOCUMENT: SupportingDocument = {
  name: "",
  file: null,
};

export function appendSupportingDocumentsToFormData(
  formData: FormData,
  documents: SupportingDocument[],
): void {
  let fileIndex = 0;
  documents.forEach((doc) => {
    if (!doc.file) return;
    formData.append(`documents[${fileIndex}]`, doc.file);
    formData.append(`document_names[${fileIndex}]`, doc.name || "");
    fileIndex += 1;
  });
}

export function buildCustomerVerificationFormData(
  customerData: Record<string, unknown>,
  documents: SupportingDocument[] = [],
): FormData {
  const formData = new FormData();
  formData.append("customer_data", JSON.stringify(customerData));
  appendSupportingDocumentsToFormData(formData, documents);
  return formData;
}

export const MULTIPART_FORM_HEADERS = {
  headers: {
    "Content-Type": "multipart/form-data",
    ...API_HEADER.headers,
  },
};

export function hasValidSupportingDocuments(
  documents: SupportingDocument[],
): boolean {
  return documents.some(
    (doc) => doc.file != null && String(doc.name ?? "").trim().length > 0,
  );
}

export function validateSupportingDocumentSizes(
  documents: SupportingDocument[],
): string | null {
  for (const doc of documents) {
    if (!doc.file) continue;
    if (doc.file.size > MAX_SUPPORTING_DOCUMENT_SIZE) {
      return `File "${doc.file.name}" exceeds 5MB limit`;
    }
  }
  return null;
}
