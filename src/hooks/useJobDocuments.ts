import { useCallback, useState } from "react";
import { URL } from "../api/serverUrls";
import { ToastNotification } from "../components";
import { postAPICall } from "../service/postApiCall";
import { API_HEADER } from "../store/storeKeys";
import {
  buildDocumentModalRowsFromDisplayList,
  EMPTY_JOB_DOCUMENT_MODAL_ROW,
  extractUploadDocumentsFromApiBody,
  isDocumentUploadSuccessful,
  mapUploadDocumentsToDisplayList,
  parseJobDocumentsFromApi,
  unwrapPostApiResponseBody,
  type JobDocumentDisplayItem,
  type JobDocumentModalRow,
  type JobDocumentsNavigationState,
} from "../utils/jobDocuments";

type UseJobDocumentsOptions = {
  uploadEndpoint?: string;
  onDocumentsUpdated?: (state: JobDocumentsNavigationState) => void;
};

export function useJobDocuments(options: UseJobDocumentsOptions = {}) {
  const { uploadEndpoint = URL.jobCreateUploadDocument, onDocumentsUpdated } =
    options;
  const [document_ids, setDocumentIds] = useState<number[]>([]);
  const [document_display_list, setDocumentDisplayList] = useState<
    JobDocumentDisplayItem[]
  >([]);
  const [document_modal_rows, setDocumentModalRows] = useState<
    JobDocumentModalRow[]
  >([{ ...EMPTY_JOB_DOCUMENT_MODAL_ROW }]);
  const [documentsModalOpen, setDocumentsModalOpen] = useState(false);
  const [documentUploading, setDocumentUploading] = useState(false);

  const initFromJobData = useCallback(
    (data: Record<string, unknown> | null | undefined) => {
      const parsed = parseJobDocumentsFromApi(data);
      setDocumentIds(parsed.document_ids);
      setDocumentDisplayList(parsed.document_display_list);
      setDocumentModalRows(parsed.document_modal_rows);
    },
    [],
  );

  const restoreFromNavigationState = useCallback(
    (state: Partial<JobDocumentsNavigationState> | null | undefined) => {
      if (!state) return;
      if (Array.isArray(state.document_ids)) {
        setDocumentIds(state.document_ids);
      }
      if (Array.isArray(state.document_display_list)) {
        setDocumentDisplayList(state.document_display_list);
      }
      if (
        Array.isArray(state.document_modal_rows) &&
        state.document_modal_rows.length > 0
      ) {
        setDocumentModalRows(state.document_modal_rows);
      }
    },
    [],
  );

  const getNavigationState = useCallback(
    (): JobDocumentsNavigationState => ({
      document_ids,
      document_display_list,
      document_modal_rows,
    }),
    [document_ids, document_display_list, document_modal_rows],
  );

  const openDocumentsModal = useCallback(() => {
    setDocumentModalRows(
      buildDocumentModalRowsFromDisplayList(document_display_list),
    );
    setDocumentsModalOpen(true);
  }, [document_display_list]);

  const addDocumentRow = useCallback(() => {
    setDocumentModalRows((rows) => [
      ...rows,
      { ...EMPTY_JOB_DOCUMENT_MODAL_ROW },
    ]);
  }, []);

  const updateDocumentRow = useCallback(
    (
      index: number,
      field: "documentName" | "file" | "document_url",
      value: string | File | null | undefined,
    ) => {
      setDocumentModalRows((rows) =>
        rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
      );
    },
    [],
  );

  const removeDocumentRow = useCallback((index: number) => {
    setDocumentModalRows((rows) =>
      rows.length > 1 ? rows.filter((_, i) => i !== index) : rows,
    );
  }, []);

  const handleSubmitDocumentsModal = useCallback(async () => {
    const rows = document_modal_rows;
    const items = rows
      .map((row, index) => ({ row, index }))
      .filter(
        (item) =>
          item.row.documentName.trim() &&
          (item.row.id != null || item.row.file != null),
      );
    const invalid = rows.some(
      (r) =>
        (r.documentName.trim() && !r.file && r.id == null) ||
        (!r.documentName.trim() && (r.file || r.id != null)),
    );
    if (invalid) {
      ToastNotification({
        type: "warning",
        message:
          "Each row must have document name and either an existing document or a new file",
      });
      return;
    }
    if (items.length === 0) {
      ToastNotification({
        type: "warning",
        message:
          "Please add at least one document (name + file) or leave all rows empty",
      });
      return;
    }

    setDocumentUploading(true);
    try {
      const formData = new FormData();
      items.forEach(({ row }, i) => {
        formData.append(`document_names[${i}]`, row.documentName.trim());
        if (row.file != null) {
          formData.append(`documents[${i}]`, row.file);
        }
        if (row.id != null) {
          formData.append(`document_id[${i}]`, String(row.id));
        }
      });

      const headers = {
        "Content-Type": "multipart/form-data",
        ...API_HEADER.headers,
      };

      const rawResponse = await postAPICall(uploadEndpoint, formData, {
        headers,
      });
      const body = unwrapPostApiResponseBody(rawResponse);

      if (isDocumentUploadSuccessful(body)) {
        const uploadedItems = extractUploadDocumentsFromApiBody(body);
        let fromApi = mapUploadDocumentsToDisplayList(uploadedItems);
        if (fromApi.length > 0) {
          fromApi = fromApi.map((doc, i) => {
            const row = items[i]?.row;
            const userFileName =
              doc.userFileName ||
              row?.userFileName ||
              row?.file?.name ||
              "";
            return userFileName ? { ...doc, userFileName } : doc;
          });
        }
        let updatedDisplayList: JobDocumentDisplayItem[];
        if (fromApi.length > 0) {
          const merged = new Map<number, JobDocumentDisplayItem>();
          document_display_list.forEach((d) => merged.set(d.id, d));
          fromApi.forEach((d) => merged.set(d.id, d));
          updatedDisplayList = Array.from(merged.values());
        } else {
          updatedDisplayList = items
            .filter((item) => item.row.id != null)
            .map((item) => ({
              id: Number(item.row.id),
              documentName: item.row.documentName.trim(),
              userFileName: item.row.userFileName ?? "",
              document_url: item.row.document_url,
            }));
        }
        const newIds = updatedDisplayList.map((d) => d.id);
        const nextModalRows =
          buildDocumentModalRowsFromDisplayList(updatedDisplayList);

        setDocumentIds(newIds);
        setDocumentDisplayList(updatedDisplayList);
        setDocumentModalRows(nextModalRows);
        onDocumentsUpdated?.({
          document_ids: newIds,
          document_display_list: updatedDisplayList,
          document_modal_rows: nextModalRows,
        });
        ToastNotification({
          type: "success",
          message:
            String(body.message ?? "").trim() ||
            "Document(s) saved successfully",
        });
        setDocumentsModalOpen(false);
      } else {
        ToastNotification({
          type: "error",
          message:
            String(body.message ?? "").trim() ||
            "Upload failed for one or more documents",
        });
      }
    } catch (err) {
      console.error("Document upload error:", err);
      ToastNotification({
        type: "error",
        message: "Failed to upload document(s)",
      });
    } finally {
      setDocumentUploading(false);
    }
  }, [
    document_display_list,
    document_modal_rows,
    onDocumentsUpdated,
    uploadEndpoint,
  ]);

  return {
    document_ids,
    document_display_list,
    document_modal_rows,
    documentsModalOpen,
    setDocumentsModalOpen,
    documentUploading,
    initFromJobData,
    restoreFromNavigationState,
    getNavigationState,
    openDocumentsModal,
    addDocumentRow,
    updateDocumentRow,
    removeDocumentRow,
    handleSubmitDocumentsModal,
  };
}
