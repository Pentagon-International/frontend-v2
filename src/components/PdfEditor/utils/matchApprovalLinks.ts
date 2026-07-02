import type { PDFDocumentProxy } from "pdfjs-dist";
import type { PdfTextRect } from "./pdfCoordinates";
import {
  extractTextItemsWithRects,
  type PdfTextItemWithRect,
} from "./matchTextItems";
import { mergeRects } from "./pdfCoordinates";

export type ApprovalLinkPosition = {
  pageNumber: number;
  rect: PdfTextRect;
  label: string;
  url: string;
};

const APPROVAL_PHRASES = [
  "click here to approve or reject this quotation",
  "click here to approve",
] as const;

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

export function getApprovalUrl(
  rowData: Record<string, unknown> | null | undefined,
): string | null {
  if (!rowData) return null;
  const quotationId =
    rowData.id ?? rowData.quotation_id ?? rowData.enquiry_id;
  if (!quotationId) return null;
  return `${window.location.origin}/quotation/approvalrequest/${String(quotationId)}`;
}

function findPhraseOnPage(
  phrase: string,
  pageItems: PdfTextItemWithRect[],
): PdfTextRect | null {
  const target = normalizeText(phrase);
  if (!target) return null;

  const sorted = [...pageItems].sort(
    (a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left,
  );

  for (let i = 0; i < sorted.length; i++) {
    let combined = "";
    const group: PdfTextItemWithRect[] = [];

    for (let j = i; j < sorted.length && j < i + 20; j++) {
      if (j > i && Math.abs(sorted[j].rect.top - sorted[i].rect.top) > 10) {
        break;
      }

      combined =
        j === i ? sorted[j].item.str : `${combined} ${sorted[j].item.str}`;
      group.push(sorted[j]);

      const normalized = normalizeText(combined);
      if (normalized === target) {
        return mergeRects(group.map((entry) => entry.rect));
      }
    }
  }

  return null;
}

function clampRectToPage(
  rect: PdfTextRect,
  pageWidth: number,
  pageHeight: number,
): PdfTextRect | null {
  if (pageWidth <= 0 || pageHeight <= 0) return null;

  const left = Math.max(0, Math.min(rect.left, pageWidth - 1));
  const top = Math.max(0, Math.min(rect.top, pageHeight - 1));
  const width = Math.min(Math.max(rect.width, 1), pageWidth - left);
  const height = Math.min(Math.max(rect.height, 1), pageHeight - top);

  if (width < 4 || height < 4) return null;

  return { ...rect, left, top, width, height };
}

function annotationRectToPdfTextRect(
  rect: number[],
  viewport: import("pdfjs-dist").PageViewport,
): PdfTextRect {
  const [x1, y1, x2, y2] = viewport.convertToViewportRectangle(rect);
  const left = Math.min(x1, x2);
  const top = Math.min(y1, y2);
  const width = Math.abs(x2 - x1);
  const height = Math.abs(y2 - y1);

  return {
    left,
    top,
    width: Math.max(width, 1),
    height: Math.max(height, 1),
    fontSize: height,
  };
}

async function findApprovalLinksFromAnnotations(
  pdfDoc: PDFDocumentProxy,
  numPages: number,
  scale: number,
  approvalUrl: string,
): Promise<ApprovalLinkPosition[]> {
  const links: ApprovalLinkPosition[] = [];

  for (let pageNumber = 1; pageNumber <= numPages; pageNumber++) {
    const page = await pdfDoc.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const annotations = await page.getAnnotations({ intent: "display" });

    for (const annotation of annotations) {
      const url = typeof annotation.url === "string" ? annotation.url : "";
      const isApprovalLink =
        url.includes("/quotation/approvalrequest/") || url === approvalUrl;
      if (!isApprovalLink || !Array.isArray(annotation.rect)) continue;

      const rect = clampRectToPage(
        annotationRectToPdfTextRect(annotation.rect, viewport),
        viewport.width,
        viewport.height,
      );
      if (!rect) continue;

      links.push({
        pageNumber,
        rect,
        label: "approval-link",
        url: url || approvalUrl,
      });
    }
  }

  return links;
}

function mergeApprovalLinks(
  textLinks: ApprovalLinkPosition[],
  annotationLinks: ApprovalLinkPosition[],
): ApprovalLinkPosition[] {
  const merged = [...textLinks];

  for (const candidate of annotationLinks) {
    const overlaps = merged.some(
      (existing) =>
        existing.pageNumber === candidate.pageNumber &&
        Math.abs(existing.rect.top - candidate.rect.top) < 8 &&
        Math.abs(existing.rect.left - candidate.rect.left) < 8,
    );
    if (!overlaps) merged.push(candidate);
  }

  return merged;
}

export async function findApprovalLinkPositions(
  pdfDoc: PDFDocumentProxy,
  numPages: number,
  scale: number,
  approvalUrl: string,
): Promise<ApprovalLinkPosition[]> {
  const textLinks: ApprovalLinkPosition[] = [];

  for (let pageNumber = 1; pageNumber <= numPages; pageNumber++) {
    const page = await pdfDoc.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const textContent = await page.getTextContent();
    const pageItems = extractTextItemsWithRects(
      textContent.items,
      viewport,
      pageNumber,
    );

    for (const phrase of APPROVAL_PHRASES) {
      const rect = findPhraseOnPage(phrase, pageItems);
      if (!rect) continue;

      const clamped = clampRectToPage(rect, viewport.width, viewport.height);
      if (!clamped) continue;

      const overlapsExisting = textLinks.some(
        (existing) =>
          existing.pageNumber === pageNumber &&
          Math.abs(existing.rect.top - clamped.top) < 4 &&
          Math.abs(existing.rect.left - clamped.left) < 4,
      );
      if (overlapsExisting) continue;

      textLinks.push({
        pageNumber,
        rect: clamped,
        label: phrase,
        url: approvalUrl,
      });
    }
  }

  const annotationLinks = await findApprovalLinksFromAnnotations(
    pdfDoc,
    numPages,
    scale,
    approvalUrl,
  );

  return mergeApprovalLinks(textLinks, annotationLinks);
}
