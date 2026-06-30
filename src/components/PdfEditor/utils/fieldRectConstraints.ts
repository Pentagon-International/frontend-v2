import type { PdfTextRect } from "./pdfCoordinates";

export type FieldLayoutZone =
  | "left"
  | "right"
  | "full"
  | "content"
  | "service"
  | "charge_description"
  | "charge_min"
  | "charge_total"
  | "customer_details";

/** Fixed highlight width for quotation service-detail value cells (px at current viewport scale). */
export const SERVICE_FIELD_HIGHLIGHT_WIDTH_RATIO = 0.25;

/** Charge description column width as a fraction of rendered page width. */
export const CHARGE_DESCRIPTION_WIDTH_RATIO = 0.3;

const PDF_PAGE_WIDTH_MM = 210;

/** Charge min-amount column width (25mm on A4) as a fraction of page width. */
export const CHARGE_MIN_WIDTH_RATIO = 25 / PDF_PAGE_WIDTH_MM;

/** Charge total-amount column width (30mm on A4) as a fraction of page width. */
export const CHARGE_TOTAL_WIDTH_RATIO = 30 / PDF_PAGE_WIDTH_MM;

/** Customer details section width as a fraction of rendered page width. */
export const CUSTOMER_DETAILS_WIDTH_RATIO = 0.42;

/** Default PDF line spacing used in QuotationPDFTemplate (mm). */
export const PDF_DEFAULT_LINE_HEIGHT_MM = 4;

/** PDF line spacing for terms & conditions section (mm). */
export const PDF_CONDITIONS_LINE_HEIGHT_MM = 3.5;

const PDF_PAGE_MARGIN_RATIO = 10 / PDF_PAGE_WIDTH_MM;

let measureCanvas: HTMLCanvasElement | null = null;

function getMeasureContext(fontSize: number, fontWeight = 400) {
  if (!measureCanvas) {
    measureCanvas = document.createElement("canvas");
  }
  const ctx = measureCanvas.getContext("2d");
  if (!ctx) return null;
  ctx.font = `${fontWeight} normal ${fontSize}px Helvetica, Arial, sans-serif`;
  return ctx;
}

function measureTextWidthPx(
  text: string,
  fontSize: number,
  fontWeight = 400,
): number {
  if (!text || typeof document === "undefined") return 0;
  const ctx = getMeasureContext(fontSize, fontWeight);
  if (!ctx) return 0;
  return ctx.measureText(text).width;
}

export function pdfMmToViewportPx(mm: number, pageWidth: number): number {
  return (mm / PDF_PAGE_WIDTH_MM) * pageWidth;
}

/** Count wrapped lines mirroring jsPDF splitTextToSize behaviour. */
export function countWrappedLines(
  text: string,
  maxWidth: number,
  fontSize: number,
  fontWeight = 400,
): number {
  if (!text) return 1;
  if (maxWidth <= 0) return 1;

  const paragraphs = text.split(/\r?\n/);
  let totalLines = 0;

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      totalLines += 1;
      continue;
    }

    const words = paragraph.split(/\s+/).filter(Boolean);
    let lines = 1;
    let lineWidth = 0;
    const spaceWidth = measureTextWidthPx(" ", fontSize, fontWeight);

    for (const word of words) {
      const wordWidth = measureTextWidthPx(word, fontSize, fontWeight);
      const nextWidth = lineWidth === 0 ? wordWidth : lineWidth + spaceWidth + wordWidth;

      if (nextWidth > maxWidth && lineWidth > 0) {
        lines += 1;
        lineWidth = wordWidth;
      } else {
        lineWidth = nextWidth;
      }
    }

    totalLines += lines;
  }

  return Math.max(totalLines, 1);
}

function zoneMaxWidth(
  zone: FieldLayoutZone,
  rect: PdfTextRect,
  pageWidth: number,
): number {
  const marginPx = pageWidth * PDF_PAGE_MARGIN_RATIO;
  const midLine = pageWidth / 2;
  const innerPad = 6;

  switch (zone) {
    case "customer_details":
      return Math.max(pageWidth * CUSTOMER_DETAILS_WIDTH_RATIO, 24);
    case "left":
      return Math.max(midLine - rect.left - innerPad, 24);
    case "right":
      return Math.max(pageWidth - marginPx - rect.left - innerPad, 24);
    case "service":
      return Math.max(
        Math.min(
          pageWidth * SERVICE_FIELD_HIGHLIGHT_WIDTH_RATIO,
          pageWidth - rect.left - innerPad,
        ),
        24,
      );
    case "charge_description":
      return Math.max(pageWidth * CHARGE_DESCRIPTION_WIDTH_RATIO, 24);
    case "charge_min":
      return Math.max(pageWidth * CHARGE_MIN_WIDTH_RATIO, 24);
    case "charge_total":
      return Math.max(pageWidth * CHARGE_TOTAL_WIDTH_RATIO, 24);
    case "full":
      return Math.max(
        pageWidth - marginPx * 2 - Math.max(rect.left - marginPx, 0),
        40,
      );
    case "content":
    default:
      return Math.max(pageWidth - rect.left - marginPx, 24);
  }
}

function resolveColumnWidth(
  layoutZone: FieldLayoutZone,
  rect: PdfTextRect,
  pageWidth: number,
): number {
  switch (layoutZone) {
    case "customer_details":
      return pageWidth * CUSTOMER_DETAILS_WIDTH_RATIO;
    case "charge_description":
      return pageWidth * CHARGE_DESCRIPTION_WIDTH_RATIO;
    case "charge_min":
      return pageWidth * CHARGE_MIN_WIDTH_RATIO;
    case "charge_total":
      return pageWidth * CHARGE_TOTAL_WIDTH_RATIO;
    case "service":
      return Math.min(
        pageWidth * SERVICE_FIELD_HIGHLIGHT_WIDTH_RATIO,
        zoneMaxWidth("service", rect, pageWidth),
      );
    case "full":
      return zoneMaxWidth("full", rect, pageWidth);
    default:
      return zoneMaxWidth(layoutZone, rect, pageWidth);
  }
}

function usesFixedColumnLayout(
  layoutZone: FieldLayoutZone,
  multiline: boolean,
): boolean {
  return (
    layoutZone === "customer_details" ||
    layoutZone === "charge_description" ||
    layoutZone === "charge_min" ||
    layoutZone === "charge_total" ||
    layoutZone === "service" ||
    (multiline && layoutZone === "full")
  );
}

function applyFixedColumnLayout(
  rect: PdfTextRect,
  displayValue: string,
  layoutZone: FieldLayoutZone,
  pageWidth: number,
  multiline: boolean,
  fontWeight: number,
  pdfLineHeightMm: number,
): PdfTextRect {
  const columnWidth = resolveColumnWidth(layoutZone, rect, pageWidth);
  const lineHeightPx = pdfMmToViewportPx(pdfLineHeightMm, pageWidth);
  const innerPad = 4;
  const lineCount = multiline
    ? countWrappedLines(
        displayValue,
        Math.max(columnWidth - innerPad, 16),
        rect.fontSize,
        fontWeight,
      )
    : 1;
  const height = Math.max(rect.height, lineCount * lineHeightPx);

  return {
    ...rect,
    width: columnWidth,
    height,
    lineHeightPx,
  };
}

/** Tighten overlay width to rendered text / PDF column bounds. */
export function constrainMatchedFieldRect(
  rect: PdfTextRect,
  displayValue: string,
  layoutZone: FieldLayoutZone = "content",
  pageWidth: number,
  multiline = false,
  fontWeight = 400,
  pdfLineHeightMm = PDF_DEFAULT_LINE_HEIGHT_MM,
): PdfTextRect {
  if (usesFixedColumnLayout(layoutZone, multiline)) {
    return applyFixedColumnLayout(
      rect,
      displayValue,
      layoutZone,
      pageWidth,
      multiline,
      fontWeight,
      pdfLineHeightMm,
    );
  }

  const zoneMax = zoneMaxWidth(layoutZone, rect, pageWidth);
  const measured = measureTextWidthPx(displayValue, rect.fontSize, fontWeight) + 3;
  const lineHeightPx = pdfMmToViewportPx(pdfLineHeightMm, pageWidth);

  if (multiline) {
    const columnWidth = Math.min(Math.max(rect.width, measured), zoneMax);
    const lineCount = countWrappedLines(
      displayValue,
      Math.max(columnWidth - 4, 16),
      rect.fontSize,
      fontWeight,
    );
    return {
      ...rect,
      width: columnWidth,
      height: Math.max(rect.height, lineCount * lineHeightPx),
      lineHeightPx,
    };
  }

  const contentWidth = Math.max(measured, 16);
  const width =
    layoutZone === "content"
      ? Math.min(contentWidth, zoneMax)
      : Math.min(
          Math.max(contentWidth, Math.min(rect.width, measured + 2)),
          zoneMax,
        );

  return {
    ...rect,
    width,
    lineHeightPx,
  };
}
