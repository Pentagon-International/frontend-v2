import { API_HEADER } from "../store/storeKeys";

export const MAX_SUPPORTING_DOCUMENT_SIZE = 10 * 1024 * 1024;

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

/**
 * Job-page style FormData for upload-document:
 * documents[i], document_names[i], document_id[i]
 */
export function appendExchangeRateUploadDocumentsToFormData(
  formData: FormData,
  documents: SupportingDocument[],
): number {
  let index = 0;
  documents.forEach((doc) => {
    const name = String(doc.name || doc.original_document_name || "").trim();
    const existingId =
      doc.document_id != null && Number.isFinite(Number(doc.document_id))
        ? Number(doc.document_id)
        : null;
    const hasExisting = existingId != null;
    const hasNewFile = doc.file instanceof File;
    if (!hasExisting && !hasNewFile) return;
    if (!name && !hasNewFile) return;

    formData.append(
      `document_names[${index}]`,
      name || (doc.file instanceof File ? doc.file.name : "") || "",
    );
    if (hasExisting && existingId != null) {
      formData.append(`document_id[${index}]`, String(existingId));
    }
    if (hasNewFile && doc.file instanceof File) {
      formData.append(`documents[${index}]`, doc.file, doc.file.name);
    }
    index += 1;
  });
  return index;
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
      return `File "${doc.file.name}" exceeds 10MB limit`;
    }
  }
  return null;
}
