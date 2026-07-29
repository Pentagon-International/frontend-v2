import { Box, Center, Group, Loader, Overlay, Text } from "@mantine/core";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { OutputScale, type PDFDocumentProxy } from "pdfjs-dist";
import { EditableField } from "./EditableField";
import { EditableOverlay } from "./EditableOverlay";
import { PdfApprovalLinkOverlay } from "./PdfApprovalLinkOverlay";
import type { ApprovalLinkPosition } from "./utils/matchApprovalLinks";
import type { MatchedFieldPosition } from "./utils/matchTextItems";
import type { ActiveEditState } from "./usePdfEditor";

type PageSize = { width: number; height: number };

type PdfViewerProps = {
  pdfDoc: PDFDocumentProxy | null;
  numPages: number;
  scale: number;
  matchedFields: MatchedFieldPosition[];
  approvalLinks: ApprovalLinkPosition[];
  activeEdit: ActiveEditState | null;
  isRegenerating: boolean;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  onFieldClick: (fieldId: string) => void;
  onScroll: () => void;
  onActiveEditChange: (value: string) => void;
  onActiveEditCommit: () => void;
  onActiveEditCancel: () => void;
  registerPageRef: (page: number, el: HTMLDivElement | null) => void;
  onPagesRendered?: () => void;
  editable?: boolean;
};

export function PdfViewer({
  pdfDoc,
  numPages,
  scale,
  matchedFields,
  approvalLinks,
  activeEdit,
  isRegenerating,
  scrollContainerRef,
  onFieldClick,
  onScroll,
  onActiveEditChange,
  onActiveEditCommit,
  onActiveEditCancel,
  registerPageRef,
  onPagesRendered,
  editable = true,
}: PdfViewerProps) {
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const [pageSizes, setPageSizes] = useState<Map<number, PageSize>>(new Map());
  const [isRendering, setIsRendering] = useState(false);
  const renderTokenRef = useRef(0);
  const onPagesRenderedRef = useRef(onPagesRendered);
  onPagesRenderedRef.current = onPagesRendered;

  // Round scale so sub-pixel fit-scale noise does not restart page renders.
  const renderScale = Math.round(scale * 1000) / 1000;

  const renderPageCanvases = useCallback(async () => {
    if (!pdfDoc || numPages === 0 || renderScale <= 0) return;

    const token = ++renderTokenRef.current;
    setIsRendering(true);
    const nextSizes = new Map<number, PageSize>();

    try {
      for (let pageNumber = 1; pageNumber <= numPages; pageNumber++) {
        if (token !== renderTokenRef.current) return;

        const page = await pdfDoc.getPage(pageNumber);
        const viewport = page.getViewport({ scale: renderScale });

        let canvas = canvasRefs.current.get(pageNumber);
        if (!canvas) {
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve()),
          );
          canvas = canvasRefs.current.get(pageNumber);
        }
        if (!canvas || token !== renderTokenRef.current) continue;

        const context = canvas.getContext("2d");
        if (!context) continue;

        const outputScale = new OutputScale();
        // Cap DPR on multi-page docs (e.g. 6-copy BOL) so first open finishes quickly.
        if (numPages > 2) {
          const cap = 1.25;
          outputScale.sx = Math.min(outputScale.sx, cap);
          outputScale.sy = Math.min(outputScale.sy, cap);
        }

        const cssWidth = Math.floor(viewport.width);
        const cssHeight = Math.floor(viewport.height);

        canvas.width = Math.floor(cssWidth * outputScale.sx);
        canvas.height = Math.floor(cssHeight * outputScale.sy);
        canvas.style.width = `${cssWidth}px`;
        canvas.style.height = `${cssHeight}px`;
        canvas.style.display = "block";

        context.clearRect(0, 0, canvas.width, canvas.height);

        await page.render({
          canvasContext: context,
          viewport,
          transform: outputScale.scaled
            ? [outputScale.sx, 0, 0, outputScale.sy, 0, 0]
            : undefined,
        }).promise;

        if (token !== renderTokenRef.current) return;

        nextSizes.set(pageNumber, {
          width: cssWidth,
          height: cssHeight,
        });
      }

      if (token === renderTokenRef.current) {
        setPageSizes(nextSizes);
        requestAnimationFrame(() => {
          onPagesRenderedRef.current?.();
        });
      }
    } finally {
      if (token === renderTokenRef.current) {
        setIsRendering(false);
      }
    }
  }, [pdfDoc, numPages, renderScale]);

  useLayoutEffect(() => {
    void renderPageCanvases();
  }, [renderPageCanvases]);

  const fieldsByPage = matchedFields.reduce<Map<number, MatchedFieldPosition[]>>(
    (acc, field) => {
      const list = acc.get(field.pageNumber) ?? [];
      list.push(field);
      acc.set(field.pageNumber, list);
      return acc;
    },
    new Map(),
  );

  return (
    <Box
      ref={scrollContainerRef}
      onScroll={onScroll}
      style={{
        flex: 1,
        width: "100%",
        minHeight: 0,
        minWidth: 0,
        overflow: "auto",
        overflowX: "auto",
        backgroundColor: "#525659",
        position: "relative",
      }}
    >
      <Box
        style={{
          width: "100%",
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          padding: "8px 0 16px",
          boxSizing: "border-box",
        }}
      >
        {Array.from({ length: numPages }, (_, index) => {
          const pageNumber = index + 1;
          const pageFields = fieldsByPage.get(pageNumber) ?? [];
          const pageSize = pageSizes.get(pageNumber);

          return (
            <Box
              key={pageNumber}
              ref={(el) => registerPageRef(pageNumber, el)}
              style={{ flexShrink: 0, display: "flex", justifyContent: "center" }}
            >
              <Box
                style={{
                  position: "relative",
                  width: pageSize?.width,
                  height: pageSize?.height,
                  flexShrink: 0,
                  overflow: "hidden",
                  backgroundColor: "#fff",
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.45)",
                  lineHeight: 0,
                }}
              >
                <canvas
                  ref={(el) => {
                    if (el) canvasRefs.current.set(pageNumber, el);
                    else canvasRefs.current.delete(pageNumber);
                  }}
                />
                {editable && pageSize && (
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: pageSize.width,
                      height: pageSize.height,
                      zIndex: 2,
                      pointerEvents: "none",
                    }}
                  >
                    <EditableOverlay
                      fields={pageFields}
                      activeFieldId={activeEdit?.field.id ?? null}
                      onFieldClick={onFieldClick}
                      disabled={isRegenerating}
                    />
                    {activeEdit && activeEdit.position.pageNumber === pageNumber && (
                      <EditableField
                        activeEdit={activeEdit}
                        onChange={onActiveEditChange}
                        onCommit={onActiveEditCommit}
                        onCancel={onActiveEditCancel}
                      />
                    )}
                  </div>
                )}
                {pageSize && (
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: pageSize.width,
                      height: pageSize.height,
                      zIndex: 20,
                      pointerEvents: "none",
                    }}
                  >
                    <PdfApprovalLinkOverlay
                      links={approvalLinks}
                      pageNumber={pageNumber}
                      pageWidth={pageSize.width}
                    />
                  </div>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>

      {isRendering && (
        <Overlay color="#323639" backgroundOpacity={0.35} zIndex={30} center>
          <Group gap="sm">
            <Loader size="sm" color="#e8eaed" />
            <Text size="sm" c="#e8eaed" fw={500}>
              Rendering...
            </Text>
          </Group>
        </Overlay>
      )}
    </Box>
  );
}
