import { Button } from "@mantine/core";
import { IconPaperclip } from "@tabler/icons-react";
import JobDocumentsModal from "./JobDocumentsModal";
import type { useJobDocuments } from "../hooks/useJobDocuments";

type HouseDocumentsApi = ReturnType<typeof useJobDocuments>;

type HousePageDocumentsAttachProps = {
  documents: HouseDocumentsApi;
  readOnly?: boolean;
};

export function HousePageDocumentsModal({
  documents,
  readOnly = false,
}: HousePageDocumentsAttachProps) {
  return (
    <JobDocumentsModal
      opened={documents.documentsModalOpen}
      onClose={() => documents.setDocumentsModalOpen(false)}
      rows={documents.document_modal_rows}
      readOnly={readOnly}
      uploading={documents.documentUploading}
      docTypeOptions={documents.docTypeOptions}
      docCodeErrors={documents.docCodeErrors}
      onAddRow={documents.addDocumentRow}
      onUpdateRow={documents.updateDocumentRow}
      onRemoveRow={documents.removeDocumentRow}
      onSubmit={documents.handleSubmitDocumentsModal}
    />
  );
}

export function HousePageDocumentsButton({
  documents,
  readOnly = false,
}: HousePageDocumentsAttachProps) {
  return (
    <Button
      variant="outline"
      color="#105476"
      leftSection={<IconPaperclip size={16} />}
      onClick={documents.openDocumentsModal}
    >
      {readOnly ? "View Documents" : "Attach Documents"}
    </Button>
  );
}
