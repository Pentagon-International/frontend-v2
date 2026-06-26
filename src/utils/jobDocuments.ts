export type JobDocumentDisplayItem = {
  id: number;
  documentName: string;
  userFileName?: string;
  document_url?: string;
};

export type JobDocumentModalRow = {
  id?: number;
  documentName: string;
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
  file: null,
  userFileName: "",
};

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
      userFileName: String(doc.user_file_name ?? ""),
      document_url:
        doc.document_url != null ? String(doc.document_url) : undefined,
    }),
  );

  const document_modal_rows: JobDocumentModalRow[] =
    documents.length > 0
      ? documents.map((doc) => ({
          id: doc.id != null ? Number(doc.id) : undefined,
          documentName: String(doc.document_name ?? ""),
          file: null,
          userFileName: String(doc.user_file_name ?? ""),
          document_url:
            doc.document_url != null ? String(doc.document_url) : undefined,
        }))
      : [{ ...EMPTY_JOB_DOCUMENT_MODAL_ROW }];

  return {
    document_ids,
    document_display_list,
    document_modal_rows,
  };
}

export function buildDocumentModalRowsFromDisplayList(
  displayList: JobDocumentDisplayItem[],
): JobDocumentModalRow[] {
  const modalRows = displayList.map((d) => ({
    id: d.id,
    documentName: d.documentName,
    file: null as File | null,
    userFileName: d.userFileName ?? "",
    document_url: d.document_url,
  }));

  return [
    ...modalRows,
    {
      id: undefined,
      documentName: "",
      file: null,
      userFileName: "",
    },
  ];
}
