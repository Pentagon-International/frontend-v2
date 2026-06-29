import { URL } from "../api/serverUrls";
import { postAPICall } from "../service/postApiCall";
import { API_HEADER } from "../store/storeKeys";

export type JobDocumentDisplayItem = {
  id: number;
  documentName: string;
  doc_code?: string;
  userFileName?: string;
  document_url?: string;
};

export type JobDocumentModalRow = {
  id?: number;
  documentName: string;
  doc_code?: string;
  file: File | null;
  userFileName?: string;
  document_url?: string;
};

export type JobDocumentsNavigationState = {
  document_ids: number[];
  document_display_list: JobDocumentDisplayItem[];
  document_modal_rows: JobDocumentModalRow[];
};

export const EMPTY_JOB_DOCUMENT_MODAL_ROW: JobDocumentModalRow = {
  id: undefined,
  documentName: "",
  doc_code: "",
  file: null,
  userFileName: "",
};

export type DocumentTypeMasterOption = {
  value: string;
  label: string;
};

export async function fetchDocumentTypeMasterOptions(): Promise<
  DocumentTypeMasterOption[]
> {
  try {
    const response = await postAPICall(
      URL.documentTypeMasterFilter,
      { filters: {} },
      API_HEADER,
    );
    const data = (response as { data?: Array<{ code?: string }> })?.data ?? [];
    return data
      .filter((item) => item.code)
      .map((item) => ({
        value: String(item.code),
        label: String(item.code),
      }));
  } catch (err) {
    console.error("Error fetching document type master:", err);
    return [];
  }
}

function rowHasDocumentContent(row: JobDocumentModalRow): boolean {
  return Boolean(
    row.documentName.trim() ||
      row.file ||
      row.id != null ||
      String(row.doc_code ?? "").trim(),
  );
}

function rowIsCompleteUpload(row: JobDocumentModalRow): boolean {
  return Boolean(
    row.documentName.trim() &&
      String(row.doc_code ?? "").trim() &&
      (row.id != null || row.file != null),
  );
}

export type DocumentModalValidationResult = {
  valid: boolean;
  docCodeErrors?: Record<number, string>;
  message?: string;
  items: Array<{ row: JobDocumentModalRow; index: number }>;
  allowEmptyClose?: boolean;
};

function rowNeedsDocCode(row: JobDocumentModalRow): boolean {
  return Boolean(
    row.documentName.trim() && (row.id != null || row.file != null),
  );
}

export function validateDocumentModalRows(
  rows: JobDocumentModalRow[],
): DocumentModalValidationResult {
  const docCodeErrors: Record<number, string> = {};
  rows.forEach((row, index) => {
    if (rowNeedsDocCode(row) && !String(row.doc_code ?? "").trim()) {
      docCodeErrors[index] = "Doc type is required";
    }
  });
  if (Object.keys(docCodeErrors).length > 0) {
    return { valid: false, docCodeErrors, items: [] };
  }

  const hasPartialRow = rows.some(
    (row) => rowHasDocumentContent(row) && !rowIsCompleteUpload(row),
  );
  if (hasPartialRow) {
    return {
      valid: false,
      message:
        "Each row must have document name and either an existing document or a new file",
      items: [],
    };
  }

  const items = rows
    .map((row, index) => ({ row, index }))
    .filter((item) => rowIsCompleteUpload(item.row));

  if (items.length === 0) {
    const hasAnyContent = rows.some((row) => rowHasDocumentContent(row));
    if (hasAnyContent) {
      return {
        valid: false,
        message:
          "Each row must have document name and either an existing document or a new file",
        items: [],
      };
    }
    return { valid: true, items: [], allowEmptyClose: true };
  }

  return { valid: true, items };
}

export function appendDocumentsToFormData(
  formData: FormData,
  items: Array<{ row: JobDocumentModalRow }>,
): void {
  items.forEach(({ row }, i) => {
    formData.append(`document_names[${i}]`, row.documentName.trim());
    formData.append(`doc_code[${i}]`, String(row.doc_code ?? "").trim());
    if (row.file != null) {
      formData.append(`documents[${i}]`, row.file);
    }
    if (row.id != null) {
      formData.append(`document_id[${i}]`, String(row.id));
    }
  });
}

type UploadDocumentApiItem = {
  id?: number;
  document_name?: string;
  doc_code?: string;
  document_url?: string;
  user_file_name?: string;
};

export function resolveJobDocumentUrl(
  url: string | null | undefined,
): string | undefined {
  const trimmed = String(url ?? "").trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const base = String(URL.base ?? "").replace(/\/$/, "");
  return `${base}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
}

export function unwrapPostApiResponseBody(raw: unknown): Record<string, unknown> {
  let current: unknown = raw;
  for (let depth = 0; depth < 4; depth += 1) {
    if (current == null || typeof current !== "object") {
      return {};
    }
    const obj = current as Record<string, unknown>;
    if (
      obj.success !== undefined ||
      obj.status !== undefined ||
      Array.isArray(obj.documents) ||
      typeof obj.message === "string"
    ) {
      return obj;
    }
    if (obj.data != null && typeof obj.data === "object") {
      current = obj.data;
      continue;
    }
    return obj;
  }
  return {};
}

export function extractUploadDocumentsFromApiBody(
  body: Record<string, unknown>,
): UploadDocumentApiItem[] {
  if (Array.isArray(body.documents)) {
    return body.documents as UploadDocumentApiItem[];
  }
  const nested = body.data;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const nestedObj = nested as UploadDocumentApiItem & {
      documents?: UploadDocumentApiItem[];
    };
    if (Array.isArray(nestedObj.documents)) return nestedObj.documents;
    if (nestedObj.id != null) return [nestedObj];
  }
  if (Array.isArray(nested)) {
    return nested as UploadDocumentApiItem[];
  }
  if (body.id != null) {
    return [body as UploadDocumentApiItem];
  }
  return [];
}

export function isDocumentUploadSuccessful(
  body: Record<string, unknown>,
): boolean {
  if (body.success === true || body.status === true) return true;
  if (body.success === false || body.status === false) return false;
  const message = String(body.message ?? "").toLowerCase();
  if (
    message.includes("uploaded successfully") ||
    message.includes("saved successfully") ||
    message.includes("success")
  ) {
    return true;
  }
  return extractUploadDocumentsFromApiBody(body).length > 0;
}

export function mapUploadDocumentsToDisplayList(
  items: UploadDocumentApiItem[],
): JobDocumentDisplayItem[] {
  return items
    .filter((d) => d.id != null)
    .map((d) => ({
      id: Number(d.id),
      documentName: String(d.document_name ?? ""),
      doc_code: d.doc_code != null ? String(d.doc_code) : undefined,
      userFileName: String(d.user_file_name ?? ""),
      document_url: resolveJobDocumentUrl(
        d.document_url != null ? String(d.document_url) : undefined,
      ),
    }));
}

export function extractMasterDocumentsNavState(
  state: Record<string, unknown> | null | undefined,
): Partial<JobDocumentsNavigationState> {
  if (!state) return {};
  const out: Partial<JobDocumentsNavigationState> = {};
  if (Array.isArray(state.document_ids)) {
    out.document_ids = (state.document_ids as number[]).map((id) => Number(id));
  }
  if (Array.isArray(state.document_display_list)) {
    out.document_display_list =
      state.document_display_list as JobDocumentDisplayItem[];
  }
  if (
    Array.isArray(state.document_modal_rows) &&
    state.document_modal_rows.length > 0
  ) {
    out.document_modal_rows = state.document_modal_rows as JobDocumentModalRow[];
  }
  return out;
}

export function spreadMasterDocumentsNavState(
  state: Record<string, unknown> | null | undefined,
): Partial<JobDocumentsNavigationState> {
  return extractMasterDocumentsNavState(state);
}

export function parseJobDocumentsFromApi(
  data: Record<string, unknown> | null | undefined,
): JobDocumentsNavigationState {
  const documents = Array.isArray(
    (data as { documents?: Array<Record<string, unknown>> } | undefined)
      ?.documents,
  )
    ? ((data as { documents?: Array<Record<string, unknown>> }).documents ??
      [])
    : [];

  const document_ids = Array.isArray(data?.document_ids)
    ? (data.document_ids as number[]).map((id) => Number(id))
    : documents
        .map((doc) => (doc.id != null ? Number(doc.id) : null))
        .filter((id): id is number => id !== null);

  const document_display_list: JobDocumentDisplayItem[] = documents.map(
    (doc) => ({
      id: Number(doc.id),
      documentName: String(doc.document_name ?? ""),
      doc_code: doc.doc_code != null ? String(doc.doc_code) : undefined,
      userFileName: String(doc.user_file_name ?? ""),
      document_url: resolveJobDocumentUrl(
        doc.document_url != null ? String(doc.document_url) : undefined,
      ),
    }),
  );

  const document_modal_rows: JobDocumentModalRow[] =
    documents.length > 0
      ? documents.map((doc) => ({
          id: doc.id != null ? Number(doc.id) : undefined,
          documentName: String(doc.document_name ?? ""),
          doc_code: doc.doc_code != null ? String(doc.doc_code) : "",
          file: null,
          userFileName: String(doc.user_file_name ?? ""),
          document_url: resolveJobDocumentUrl(
            doc.document_url != null ? String(doc.document_url) : undefined,
          ),
        }))
      : [{ ...EMPTY_JOB_DOCUMENT_MODAL_ROW }];

  return {
    document_ids,
    document_display_list,
    document_modal_rows,
  };
}

export type HouseDocumentFields = {
  document_ids?: number[];
  document_display_list?: JobDocumentDisplayItem[];
};

export function extractHouseDocumentFields(
  house: Record<string, unknown>,
): HouseDocumentFields {
  const parsed = parseJobDocumentsFromApi(house);
  return {
    document_ids: parsed.document_ids,
    document_display_list: parsed.document_display_list,
  };
}

export function buildDocumentIdsPayloadField(
  document_ids: number[] | undefined | null,
): { document_ids: number[] } | Record<string, never> {
  if (!Array.isArray(document_ids) || document_ids.length === 0) {
    return {};
  }
  return { document_ids };
}

export function pickHouseDocumentFields(
  state: Pick<
    JobDocumentsNavigationState,
    "document_ids" | "document_display_list"
  >,
): HouseDocumentFields {
  return {
    document_ids: state.document_ids,
    document_display_list: state.document_display_list,
  };
}

export function buildDocumentModalRowsFromDisplayList(
  displayList: JobDocumentDisplayItem[],
): JobDocumentModalRow[] {
  const modalRows = displayList.map((d) => ({
    id: d.id,
    documentName: d.documentName,
    doc_code: d.doc_code ?? "",
    file: null as File | null,
    userFileName: d.userFileName ?? "",
    document_url: d.document_url,
  }));

  return [
    ...modalRows,
    {
      id: undefined,
      documentName: "",
      doc_code: "",
      file: null,
      userFileName: "",
    },
  ];
}
