import type { TextItem } from "pdfjs-dist/types/src/display/api";
import type { PageViewport } from "pdfjs-dist";
import { getTextItemRect, mergeRects, type PdfTextRect } from "./pdfCoordinates";

export type PdfTextItemWithRect = {
  item: TextItem;
  rect: PdfTextRect;
  pageNumber: number;
};

export type MatchedFieldPosition = {
  fieldId: string;
  pageNumber: number;
  rect: PdfTextRect;
  displayValue: string;
};

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function stripListPrefix(value: string): string {
  return value.replace(/^\d+\.\s*/, "").replace(/^[-*]\s*/, "").trim();
}

function isTextItem(item: TextItem | { str?: string }): item is TextItem {
  return "str" in item && typeof item.str === "string";
}

export function extractTextItemsWithRects(
  items: Array<TextItem | { str?: string }>,
  viewport: PageViewport,
  pageNumber: number,
): PdfTextItemWithRect[] {
  return items.filter(isTextItem).map((item) => ({
    item,
    pageNumber,
    rect: getTextItemRect(item.transform, item.width, viewport),
  }));
}

type ChargeMatchPreference =
  | "leftmost"
  | "rightmost"
  | "exact_short"
  | "exact_decimal_leftmost"
  | "exact_decimal_row"
  | null;

function getChargeMatchPreference(fieldId: string): ChargeMatchPreference {
  if (!fieldId.includes(".charges[")) return null;
  if (fieldId.endsWith("_charge_name")) return "leftmost";
  if (fieldId.endsWith("_currency")) return "exact_short";
  if (fieldId.endsWith("_min_sell")) return "exact_decimal_leftmost";
  if (fieldId.endsWith("_total_sell")) return "exact_decimal_row";
  return null;
}

/** Bottom charges table summary row ("Total Amount:") — not a per-row editable cell. */
function isChargeTableSummaryRow(
  entry: PdfTextItemWithRect,
  pageItems: PdfTextItemWithRect[],
): boolean {
  const rowTop = entry.rect.top;
  return pageItems.some((other) => {
    if (Math.abs(other.rect.top - rowTop) > 6) return false;
    const text = other.item.str.trim().toLowerCase();
    if (text.includes(" in ")) return false;
    return text === "total amount:" || text.startsWith("total amount:");
  });
}

function pickPreferredMatch(
  candidates: PdfTextItemWithRect[],
  preference: ChargeMatchPreference,
): PdfTextItemWithRect[] {
  if (candidates.length === 0) return [];
  if (candidates.length === 1) return candidates;

  if (preference === "leftmost") {
    return [
      candidates.reduce((best, entry) =>
        entry.rect.left < best.rect.left ? entry : best,
      ),
    ];
  }

  if (preference === "rightmost") {
    return [
      candidates.reduce((best, entry) =>
        entry.rect.left > best.rect.left ? entry : best,
      ),
    ];
  }

  if (preference === "exact_short") {
    return [
      candidates.sort(
        (a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left,
      )[0],
    ];
  }

  return [candidates[0]];
}

function scoreMatch(candidate: string, target: string): number {
  const c = normalizeText(candidate);
  const t = normalizeText(target);
  if (!c || !t) return 0;
  if (c === t) return 100;

  const cStripped = normalizeText(stripListPrefix(candidate));
  const tStripped = normalizeText(stripListPrefix(target));
  if (cStripped && tStripped && cStripped === tStripped) return 95;

  if (c.includes(t) || t.includes(c)) {
    const ratio = Math.min(c.length, t.length) / Math.max(c.length, t.length);
    return 50 + ratio * 40;
  }

  if (cStripped && tStripped && (cStripped.includes(tStripped) || tStripped.includes(cStripped))) {
    const ratio =
      Math.min(cStripped.length, tStripped.length) /
      Math.max(cStripped.length, tStripped.length);
    return 45 + ratio * 40;
  }

  // First-line / wrapped paragraph match (terms & conditions)
  const tPrefix = t.slice(0, Math.min(28, t.length));
  const cPrefix = c.slice(0, Math.min(28, c.length));
  if (tPrefix.length >= 12 && cPrefix.length >= 12 && tPrefix === cPrefix) {
    return 70;
  }

  return 0;
}

function collectSellPerUnitCandidates(
  target: string,
  pageItems: PdfTextItemWithRect[],
  usedItemKeys: Set<string>,
  itemKey: (entry: PdfTextItemWithRect) => string,
): { score: number; items: PdfTextItemWithRect[] } {
  const amountMatch = target.match(/^(.+?)\s+Per\s+(.+)$/i);
  // Amount-only targets (e.g. "150,000") use the general matcher.
  if (!amountMatch) return { score: 0, items: [] };

  const amountPart = amountMatch[1].trim();
  let bestScore = 0;
  let bestItems: PdfTextItemWithRect[] = [];

  const sorted = [...pageItems].sort(
    (a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left,
  );

  for (let i = 0; i < sorted.length; i++) {
    if (usedItemKeys.has(itemKey(sorted[i]))) continue;

    let combined = sorted[i].item.str;
    const group = [sorted[i]];

    for (let j = i + 1; j < sorted.length && j < i + 8; j++) {
      if (Math.abs(sorted[j].rect.top - sorted[i].rect.top) > 6) break;
      if (usedItemKeys.has(itemKey(sorted[j]))) break;
      combined = `${combined} ${sorted[j].item.str}`.trim();
      group.push(sorted[j]);

      const score = scoreMatch(combined, target);
      if (score > bestScore) {
        bestScore = score;
        bestItems = group;
      }

      if (
        normalizeText(combined).startsWith(normalizeText(`${amountPart} per`))
      ) {
        const partialScore = 85;
        if (partialScore > bestScore) {
          bestScore = partialScore;
          bestItems = group;
        }
      }
    }
  }

  return { score: bestScore, items: bestItems };
}

/** Find the best-matching text item(s) for a display value on a page. */
export function matchFieldToTextItems(
  fieldId: string,
  displayValue: string,
  pageItems: PdfTextItemWithRect[],
  usedItemKeys: Set<string>,
): MatchedFieldPosition | null {
  const target = String(displayValue ?? "").trim();
  if (!target || target === "N/A") return null;
  // Allow numeric zero for cargo/charge table cells
  if (target === "0" && !fieldId.includes("cargo_details") && !fieldId.includes("charges")) {
    return null;
  }

  const chargePreference = getChargeMatchPreference(fieldId);
  const minScore =
    chargePreference === "exact_short" ||
    chargePreference === "exact_decimal_leftmost" ||
    chargePreference === "exact_decimal_row"
      ? 30
      : 40;

  let bestScore = 0;
  let bestItems: PdfTextItemWithRect[] = [];

  const itemKey = (entry: PdfTextItemWithRect) =>
    `${entry.pageNumber}:${entry.item.str}:${entry.rect.left.toFixed(1)}:${entry.rect.top.toFixed(1)}`;

  const considerCandidate = (
    items: PdfTextItemWithRect[],
    score: number,
  ) => {
    if (score < minScore || items.length === 0) return;
    const keys = items.map(itemKey);
    if (keys.some((k) => usedItemKeys.has(k))) return;

    if (chargePreference === "exact_short") {
      const exact = items.filter(
        (entry) => normalizeText(entry.item.str) === normalizeText(target),
      );
      if (exact.length === 0) return;
      const picked = pickPreferredMatch(exact, chargePreference);
      if (score >= bestScore) {
        bestScore = Math.max(score, 100);
        bestItems = picked;
      }
      return;
    }

    if (
      chargePreference === "exact_decimal_leftmost" ||
      chargePreference === "exact_decimal_row"
    ) {
      const exact = items.filter((entry) => {
        if (entry.item.str.trim() !== target) return false;
        if (
          chargePreference === "exact_decimal_row" &&
          isChargeTableSummaryRow(entry, pageItems)
        ) {
          return false;
        }
        return true;
      });
      if (exact.length === 0) return;
      const picked = pickPreferredMatch(
        exact,
        chargePreference === "exact_decimal_leftmost" ? "leftmost" : "exact_short",
      );
      if (score >= bestScore) {
        bestScore = Math.max(score, 100);
        bestItems = picked;
      }
      return;
    }

    if (score > bestScore) {
      bestScore = score;
      bestItems = items;
    } else if (score === bestScore && score > 0 && chargePreference) {
      bestItems = pickPreferredMatch([...bestItems, ...items], chargePreference);
    }
  };

  for (const entry of pageItems) {
    if (usedItemKeys.has(itemKey(entry))) continue;
    considerCandidate([entry], scoreMatch(entry.item.str, target));
  }

  const sorted = [...pageItems].sort(
    (a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left,
  );

  for (let i = 0; i < sorted.length; i++) {
    let combined = sorted[i].item.str;
    const group = [sorted[i]];

    for (let j = i + 1; j < sorted.length && j < i + 12; j++) {
      if (Math.abs(sorted[j].rect.top - sorted[i].rect.top) > 6) break;
      combined = `${combined} ${sorted[j].item.str}`.trim();
      group.push(sorted[j]);
      considerCandidate(group, scoreMatch(combined, target));
    }
  }

  if (fieldId.endsWith("_sell_per_unit")) {
    const sellMatch = collectSellPerUnitCandidates(
      target,
      pageItems,
      usedItemKeys,
      itemKey,
    );
    considerCandidate(sellMatch.items, sellMatch.score);
  }

  if (bestScore < minScore || bestItems.length === 0) return null;

  if (chargePreference === "leftmost" && bestItems.length > 1) {
    bestItems = pickPreferredMatch(bestItems, chargePreference);
  }

  bestItems.forEach((entry) => usedItemKeys.add(itemKey(entry)));

  return {
    fieldId,
    pageNumber: bestItems[0].pageNumber,
    rect: mergeRects(bestItems.map((b) => b.rect)),
    displayValue: target,
  };
}
