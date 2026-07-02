import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  applyFieldEdit,
  buildQuotationFieldRegistry,
  getFieldDisplayValue,
  type EditableFieldDef,
  type PdfEditorContext,
} from "./quotationFieldRegistry";
import {
  extractTextItemsWithRects,
  matchFieldToTextItems,
  type MatchedFieldPosition,
} from "./utils/matchTextItems";
import { constrainMatchedFieldRect, PDF_DEFAULT_LINE_HEIGHT_MM } from "./utils/fieldRectConstraints";
import {
  findApprovalLinkPositions,
  getApprovalUrl,
  type ApprovalLinkPosition,
} from "./utils/matchApprovalLinks";

export type ViewportState = {
  zoomFactor: number;
  scrollTop: number;
  scrollLeft: number;
  currentPage: number;
};

export type ActiveEditState = {
  field: EditableFieldDef;
  position: MatchedFieldPosition;
  value: string;
};

type UsePdfEditorArgs = {
  pdfBlobUrl: string | null;
  pdfDoc: PDFDocumentProxy | null;
  numPages: number;
  initialRowData: Record<string, unknown> | null;
  generatePdf: (rowData: Record<string, unknown>) => Promise<string>;
  onQuotationChange?: (rowData: Record<string, unknown>) => void;
  onPdfRegenerated?: (newBlobUrl: string) => void;
  editorContext?: PdfEditorContext;
  editable?: boolean;
  /** Always-mounted wrapper used to measure available preview width. */
  viewerAreaRef: React.RefObject<HTMLDivElement | null>;
};

const DEFAULT_VIEWER_WIDTH_PX = 900;

function extractChargeIndex(fieldId: string): number {
  const match = fieldId.match(/\.charges\[(\d+)\]/);
  return match ? Number(match[1]) : 0;
}

async function measureFitScale(
  pdfDoc: PDFDocumentProxy,
  container: HTMLElement | null,
): Promise<number> {
  const page = await pdfDoc.getPage(1);
  const baseViewport = page.getViewport({ scale: 1 });
  const availableWidth =
    container && container.clientWidth > 0
      ? container.clientWidth
      : DEFAULT_VIEWER_WIDTH_PX;

  if (baseViewport.width <= 0) return 1;
  return availableWidth / baseViewport.width;
}

export function usePdfEditor({
  pdfBlobUrl,
  pdfDoc,
  numPages,
  initialRowData,
  generatePdf,
  onQuotationChange,
  onPdfRegenerated,
  editorContext = {},
  editable = true,
  viewerAreaRef,
}: UsePdfEditorArgs) {
  const [rowData, setRowData] = useState<Record<string, unknown> | null>(
    initialRowData,
  );
  const [baselineRowData, setBaselineRowData] = useState<Record<string, unknown> | null>(
    initialRowData,
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [fitScale, setFitScale] = useState(1);
  const [zoomFactor, setZoomFactor] = useState(0.8);
  const scale = fitScale * zoomFactor;
  const [matchedFields, setMatchedFields] = useState<MatchedFieldPosition[]>([]);
  const [approvalLinks, setApprovalLinks] = useState<ApprovalLinkPosition[]>([]);
  const [activeEdit, setActiveEdit] = useState<ActiveEditState | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLayoutReady, setIsLayoutReady] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<ViewportState>({
    zoomFactor: 1,
    scrollTop: 0,
    scrollLeft: 0,
    currentPage: 1,
  });
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const fieldRegistry = useMemo(() => {
    if (!rowData) return [];
    return buildQuotationFieldRegistry(rowData);
  }, [rowData]);

  const baselineFieldRegistry = useMemo(() => {
    if (!baselineRowData) return [];
    return buildQuotationFieldRegistry(baselineRowData);
  }, [baselineRowData]);

  const fieldById = useMemo(() => {
    const map = new Map<string, EditableFieldDef>();
    fieldRegistry.forEach((f) => map.set(f.id, f));
    return map;
  }, [fieldRegistry]);

  useEffect(() => {
    setRowData(initialRowData);
    setBaselineRowData(initialRowData);
    setHasUnsavedChanges(false);
  }, [initialRowData]);

  useEffect(() => {
    if (!pdfDoc) {
      setIsLayoutReady(false);
      return;
    }

    let cancelled = false;

    const updateFitScale = async () => {
      try {
        for (let attempt = 0; attempt < 15; attempt++) {
          const el = viewerAreaRef.current;
          if (el && el.clientWidth > 0) break;
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve()),
          );
        }

        const nextScale = await measureFitScale(
          pdfDoc,
          viewerAreaRef.current,
        );
        if (!cancelled) {
          setFitScale(nextScale);
          setIsLayoutReady(true);
        }
      } catch {
        if (!cancelled) {
          setFitScale(1);
          setIsLayoutReady(true);
        }
      }
    };

    updateFitScale();

    const observer = new ResizeObserver(() => {
      updateFitScale();
    });

    const area = viewerAreaRef.current;
    if (area) observer.observe(area);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [pdfDoc, pdfBlobUrl, viewerAreaRef]);

  const captureViewport = useCallback(() => {
    const container = scrollContainerRef.current;
    viewportRef.current = {
      zoomFactor,
      scrollTop: container?.scrollTop ?? 0,
      scrollLeft: container?.scrollLeft ?? 0,
      currentPage,
    };
  }, [zoomFactor, currentPage]);

  const restoreViewport = useCallback(() => {
    const saved = viewportRef.current;
    setZoomFactor(saved.zoomFactor);
    setCurrentPage(saved.currentPage);
    requestAnimationFrame(() => {
      const container = scrollContainerRef.current;
      if (container) {
        container.scrollTop = saved.scrollTop;
        container.scrollLeft = saved.scrollLeft;
      }
    });
  }, []);

  const matchFields = useCallback(async () => {
    if (
      !pdfDoc ||
      !baselineRowData ||
      !editable ||
      numPages === 0 ||
      !isLayoutReady
    ) {
      if (!pdfDoc || !baselineRowData || !editable || numPages === 0) {
        setMatchedFields([]);
      }
      return;
    }

    const usedItemKeys = new Set<string>();
    const matches: MatchedFieldPosition[] = [];

    const sortedFields = [...baselineFieldRegistry].sort((a, b) => {
      const aIsTerms =
        a.id.includes("_notes_") || a.id.includes("_conditions_");
      const bIsTerms =
        b.id.includes("_notes_") || b.id.includes("_conditions_");
      if (aIsTerms !== bIsTerms) return aIsTerms ? 1 : -1;

      const aIsCharge = a.id.includes(".charges[");
      const bIsCharge = b.id.includes(".charges[");
      if (aIsCharge !== bIsCharge) return aIsCharge ? 1 : -1;

      const aLen = getFieldDisplayValue(a, baselineRowData, editorContext).length;
      const bLen = getFieldDisplayValue(b, baselineRowData, editorContext).length;

      if (aIsCharge && bIsCharge) {
        const aIsMin = a.id.endsWith("_min_sell");
        const bIsMin = b.id.endsWith("_min_sell");
        const aIsTotal = a.id.endsWith("_total_sell");
        const bIsTotal = b.id.endsWith("_total_sell");
        if (aIsTotal && bIsTotal) {
          const aIdx = extractChargeIndex(a.id);
          const bIdx = extractChargeIndex(b.id);
          if (aIdx !== bIdx) return aIdx - bIdx;
        }
        if (aIsTotal && bIsMin) return -1;
        if (aIsMin && bIsTotal) return 1;
        return bLen - aLen;
      }

      return aLen - bLen;
    });

    try {
      for (let pageNumber = 1; pageNumber <= numPages; pageNumber++) {
        const page = await pdfDoc.getPage(pageNumber);
        const viewport = page.getViewport({ scale });
        const textContent = await page.getTextContent();
        const pageItems = extractTextItemsWithRects(
          textContent.items,
          viewport,
          pageNumber,
        );

        for (const field of sortedFields) {
          if (matches.some((m) => m.fieldId === field.id)) continue;

          const displayValue = getFieldDisplayValue(
            field,
            baselineRowData,
            editorContext,
          );
          const match = matchFieldToTextItems(
            field.id,
            displayValue,
            pageItems,
            usedItemKeys,
          );
          if (match) {
            matches.push({
              ...match,
              rect: constrainMatchedFieldRect(
                match.rect,
                displayValue,
                field.layoutZone ?? "content",
                viewport.width,
                Boolean(field.multiline || field.type === "textarea"),
                field.fontWeight ?? 400,
                field.pdfLineHeightMm ?? PDF_DEFAULT_LINE_HEIGHT_MM,
              ),
            });
          }
        }
      }

      setMatchedFields(matches);
    } catch {
      // PDF document may be reloading after regeneration
    }
  }, [
    pdfDoc,
    baselineRowData,
    editable,
    numPages,
    baselineFieldRegistry,
    editorContext,
    scale,
    isLayoutReady,
  ]);

  const matchApprovalLinks = useCallback(async () => {
    if (!pdfDoc || numPages === 0 || !isLayoutReady) {
      setApprovalLinks([]);
      return;
    }

    const approvalUrl = getApprovalUrl(baselineRowData ?? initialRowData);
    if (!approvalUrl) {
      setApprovalLinks([]);
      return;
    }

    try {
      const links = await findApprovalLinkPositions(
        pdfDoc,
        numPages,
        scale,
        approvalUrl,
      );
      setApprovalLinks(links);
    } catch {
      setApprovalLinks([]);
    }
  }, [
    pdfDoc,
    numPages,
    isLayoutReady,
    scale,
    baselineRowData,
    initialRowData,
  ]);

  useEffect(() => {
    matchFields();
    matchApprovalLinks();
  }, [matchFields, matchApprovalLinks, pdfBlobUrl]);

  const handlePagesRendered = useCallback(() => {
    matchFields();
    matchApprovalLinks();
  }, [matchFields, matchApprovalLinks]);

  const finishFieldEdit = useCallback(
    (field: EditableFieldDef, rawInput: string) => {
      if (!rowData) return;

      const updatedRowData = applyFieldEdit(rowData, field, rawInput, editorContext);
      const nextDisplayValue = getFieldDisplayValue(
        field,
        updatedRowData,
        editorContext,
      );

      setRowData(updatedRowData);
      setHasUnsavedChanges(true);
      setActiveEdit(null);
      setMatchedFields((prev) =>
        prev.map((match) =>
          match.fieldId === field.id
            ? { ...match, displayValue: nextDisplayValue }
            : match,
        ),
      );
    },
    [rowData, editorContext],
  );

  const saveChanges = useCallback(async () => {
    let dataToSave = rowData;
    if (!dataToSave) return;

    if (activeEdit) {
      dataToSave = applyFieldEdit(
        dataToSave,
        activeEdit.field,
        activeEdit.value,
        editorContext,
      ) as Record<string, unknown>;
      setRowData(dataToSave);
      setActiveEdit(null);
    }

    const isDirty =
      hasUnsavedChanges ||
      JSON.stringify(dataToSave) !== JSON.stringify(baselineRowData);
    if (!isDirty) return;

    captureViewport();
    setIsRegenerating(true);

    try {
      const newBlobUrl = await generatePdf(dataToSave);
      onQuotationChange?.(dataToSave);
      onPdfRegenerated?.(newBlobUrl);
      setBaselineRowData(dataToSave);
      setHasUnsavedChanges(false);
    } finally {
      setIsRegenerating(false);
      restoreViewport();
    }
  }, [
    rowData,
    activeEdit,
    hasUnsavedChanges,
    baselineRowData,
    captureViewport,
    generatePdf,
    onQuotationChange,
    onPdfRegenerated,
    restoreViewport,
    editorContext,
  ]);

  const openFieldEdit = useCallback(
    (fieldId: string) => {
      const field = fieldById.get(fieldId);
      const position = matchedFields.find((m) => m.fieldId === fieldId);
      if (!field || !position || !rowData) return;

      setActiveEdit((prev) => {
        let workingRowData = rowData;

        if (prev && prev.field.id !== fieldId) {
          workingRowData = applyFieldEdit(
            workingRowData,
            prev.field,
            prev.value,
            editorContext,
          ) as Record<string, unknown>;
          const nextDisplayValue = getFieldDisplayValue(
            prev.field,
            workingRowData,
            editorContext,
          );
          setRowData(workingRowData);
          setHasUnsavedChanges(true);
          setMatchedFields((matches) =>
            matches.map((match) =>
              match.fieldId === prev.field.id
                ? { ...match, displayValue: nextDisplayValue }
                : match,
            ),
          );
        }

        return {
          field,
          position,
          value: getFieldDisplayValue(field, workingRowData, editorContext),
        };
      });
    },
    [fieldById, matchedFields, rowData, editorContext],
  );

  const cancelEdit = useCallback(() => {
    setActiveEdit(null);
  }, []);

  const updateActiveEditValue = useCallback((value: string) => {
    setActiveEdit((prev) => (prev ? { ...prev, value } : prev));
  }, []);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let closestPage = 1;
    let closestDistance = Number.POSITIVE_INFINITY;

    pageRefs.current.forEach((el, pageNumber) => {
      const distance = Math.abs(el.offsetTop - container.scrollTop);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestPage = pageNumber;
      }
    });

    setCurrentPage(closestPage);
  }, []);

  const zoomIn = useCallback(() => {
    captureViewport();
    setZoomFactor((z) => Math.min(z + 0.1, 2.5));
  }, [captureViewport]);

  const zoomOut = useCallback(() => {
    captureViewport();
    setZoomFactor((z) => Math.max(z - 0.1, 0.5));
  }, [captureViewport]);

  const goToPage = useCallback((page: number) => {
    const el = pageRefs.current.get(page);
    const container = scrollContainerRef.current;
    if (el && container) {
      container.scrollTop = el.offsetTop;
      setCurrentPage(page);
    }
  }, []);

  const registerPageRef = useCallback((page: number, el: HTMLDivElement | null) => {
    if (el) pageRefs.current.set(page, el);
    else pageRefs.current.delete(page);
  }, []);

  return {
    rowData,
    scale,
    fitScale,
    zoomFactor,
    isLayoutReady,
    matchedFields,
    approvalLinks,
    activeEdit,
    isRegenerating,
    hasUnsavedChanges,
    currentPage,
    numPages,
    scrollContainerRef,
    fieldById,
    openFieldEdit,
    cancelEdit,
    finishFieldEdit,
    saveChanges,
    updateActiveEditValue,
    handleScroll,
    zoomIn,
    zoomOut,
    goToPage,
    registerPageRef,
    handlePagesRendered,
    editable,
  };
}
