import type { PageViewport } from "pdfjs-dist";
import { Util } from "pdfjs-dist";

export type PdfTextRect = {
  left: number;
  top: number;
  width: number;
  height: number;
  fontSize: number;
  /** PDF-matched line height in viewport pixels (for multiline editing). */
  lineHeightPx?: number;
};

/** Convert a pdf.js text item transform into viewport pixel coordinates. */
export function getTextItemRect(
  transform: number[],
  itemWidth: number,
  viewport: PageViewport,
): PdfTextRect {
  const tx = Util.transform(viewport.transform, transform);
  const fontHeight = Math.hypot(tx[2], tx[3]);
  const left = tx[4];
  const top = tx[5] - fontHeight;
  const width = Math.abs(itemWidth * tx[0]);

  return {
    left,
    top,
    width: Math.max(width, 1),
    height: Math.max(fontHeight, 6),
    fontSize: fontHeight,
  };
}

export function mergeRects(rects: PdfTextRect[]): PdfTextRect {
  if (rects.length === 0) {
    return { left: 0, top: 0, width: 0, height: 0, fontSize: 10 };
  }

  const left = Math.min(...rects.map((r) => r.left));
  const top = Math.min(...rects.map((r) => r.top));
  const right = Math.max(...rects.map((r) => r.left + r.width));
  const bottom = Math.max(...rects.map((r) => r.top + r.height));

  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
    fontSize: rects[0].fontSize,
  };
}
