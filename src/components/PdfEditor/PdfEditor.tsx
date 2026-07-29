import { useEffect, useRef } from "react";
import { ActionIcon, Box, Button, Center, Group, Loader, Overlay, Text, Tooltip } from "@mantine/core";
import {
  IconMinus,
  IconPlus,
  IconChevronLeft,
  IconChevronRight,
  IconDeviceFloppy,
} from "@tabler/icons-react";
import { PdfViewer } from "./PdfViewer";
import { usePdfDocument } from "./usePdfDocument";
import { usePdfEditor, type BuildFieldRegistryFn } from "./usePdfEditor";
import type { PdfEditorContext } from "./quotationFieldRegistry";

export type PdfEditorProps = {
  pdfBlobUrl: string | null;
  rowData: Record<string, unknown> | null;
  generatePdf: (rowData: Record<string, unknown>) => Promise<string>;
  onQuotationChange?: (rowData: Record<string, unknown>) => void;
  onPdfRegenerated?: (newBlobUrl: string) => void;
  onUnsavedChangesChange?: (hasUnsavedChanges: boolean) => void;
  editorContext?: PdfEditorContext;
  editable?: boolean;
  /** Defaults to quotation registry — pass BOL registry for Bill of Lading. */
  buildFieldRegistry?: BuildFieldRegistryFn;
};

export function PdfEditor({
  pdfBlobUrl,
  rowData,
  generatePdf,
  onQuotationChange,
  onPdfRegenerated,
  onUnsavedChangesChange,
  editorContext,
  editable = true,
  buildFieldRegistry,
}: PdfEditorProps) {
  const viewerAreaRef = useRef<HTMLDivElement | null>(null);
  const { pdfDoc, numPages, isLoading, error } = usePdfDocument(pdfBlobUrl);

  const editor = usePdfEditor({
    pdfBlobUrl,
    pdfDoc,
    numPages,
    initialRowData: rowData,
    generatePdf,
    onQuotationChange,
    onPdfRegenerated,
    editorContext,
    editable,
    buildFieldRegistry,
    viewerAreaRef,
  });

  useEffect(() => {
    onUnsavedChangesChange?.(
      editor.hasUnsavedChanges || Boolean(editor.activeEdit),
    );
  }, [editor.hasUnsavedChanges, editor.activeEdit, onUnsavedChangesChange]);

  const handleFinishFieldEdit = () => {
    if (!editor.activeEdit) return;
    editor.finishFieldEdit(editor.activeEdit.field, editor.activeEdit.value);
  };

  const controlsLocked = editor.hasUnsavedChanges || editor.isRegenerating;
  const canSave = editor.hasUnsavedChanges || Boolean(editor.activeEdit);

  return (
    <Box
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        minHeight: 0,
      }}
    >
      <Group
        justify="space-between"
        px="sm"
        py={6}
        gap="sm"
        wrap="nowrap"
        style={{
          borderBottom: "1px solid #3d4043",
          backgroundColor: "#323639",
          flexShrink: 0,
        }}
      >
        <Text size="xs" c="#e8eaed" style={{ whiteSpace: "nowrap" }}>
          {editor.hasUnsavedChanges
            ? "Unsaved changes — click Save to update preview"
            : "Click a field to edit"}
        </Text>
        <Group gap={16} wrap="nowrap">
          <Button
            size="compact-xs"
            color="#105476"
            leftSection={<IconDeviceFloppy size={14} />}
            disabled={!canSave || editor.isRegenerating}
            loading={editor.isRegenerating}
            onClick={editor.saveChanges}
          >
            Save
          </Button>
          <Group gap={4} align="center" wrap="nowrap">
            <Tooltip label="Zoom out">
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={editor.zoomOut}
                size="sm"
                disabled={controlsLocked}
                styles={{ root: { color: "#000", backgroundColor: "#f0f0f0" } }}
              >
                <IconMinus size={14} />
              </ActionIcon>
            </Tooltip>
            <Text size="xs" c="#e8eaed" w={44} ta="center">
              {Math.round(editor.zoomFactor * 100)}%
            </Text>
            <Tooltip label="Zoom in">
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={editor.zoomIn}
                size="sm"
                disabled={controlsLocked}
                styles={{ root: { color: "#000", backgroundColor: "#f0f0f0" } }}
              >
                <IconPlus size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
          <Group gap={4} align="center" wrap="nowrap">
            <Tooltip label="Previous page">
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                disabled={controlsLocked || editor.currentPage <= 1}
                onClick={() => editor.goToPage(editor.currentPage - 1)}
                styles={{ root: { color: "#000", backgroundColor: "#f0f0f0" } }}
              >
                <IconChevronLeft size={14} />
              </ActionIcon>
            </Tooltip>
            <Text size="xs" c="#e8eaed" w={64} ta="center">
              {editor.currentPage} / {editor.numPages || numPages || 1}
            </Text>
            <Tooltip label="Next page">
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                disabled={
                  controlsLocked ||
                  editor.currentPage >= (editor.numPages || numPages)
                }
                onClick={() => editor.goToPage(editor.currentPage + 1)}
                styles={{ root: { color: "#000", backgroundColor: "#f0f0f0", transition: "background-color 0.3s ease" } }}
              >
                <IconChevronRight size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </Group>

      <Box
        ref={viewerAreaRef}
        style={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          width: "100%",
          position: "relative",
        }}
      >
        {error ? (
          <Box p="md" style={{ backgroundColor: "#525659", flex: 1 }}>
            <Text c="red.3" size="sm">
              {error}
            </Text>
          </Box>
        ) : isLoading || !pdfDoc || !editor.isLayoutReady ? (
          <Center style={{ flex: 1, backgroundColor: "#525659" }}>
            <Group gap="sm">
              <Loader size="sm" color="#e8eaed" />
              <Text size="sm" c="#e8eaed">
                Loading PDF preview...
              </Text>
            </Group>
          </Center>
        ) : (
          <PdfViewer
            pdfDoc={pdfDoc}
            numPages={numPages}
            scale={editor.scale}
            matchedFields={editor.matchedFields}
            approvalLinks={editor.approvalLinks}
            activeEdit={editor.activeEdit}
            isRegenerating={editor.isRegenerating}
            scrollContainerRef={editor.scrollContainerRef}
            onFieldClick={editor.openFieldEdit}
            onScroll={editor.handleScroll}
            onActiveEditChange={editor.updateActiveEditValue}
            onActiveEditCommit={handleFinishFieldEdit}
            onActiveEditCancel={editor.cancelEdit}
            registerPageRef={editor.registerPageRef}
            onPagesRendered={editor.handlePagesRendered}
            editable={editable}
          />
        )}
        {editor.isRegenerating && pdfDoc && !isLoading && editor.isLayoutReady && (
          <Overlay
            color="#323639"
            backgroundOpacity={0.35}
            zIndex={50}
            center
            style={{
              position: "absolute",
              inset: 0,
            }}
          >
            <Group gap="sm">
              <Loader size="sm" color="#e8eaed" />
              <Text size="sm" c="#e8eaed" fw={500}>
                Updating preview...
              </Text>
            </Group>
          </Overlay>
        )}
      </Box>
    </Box>
  );
}
