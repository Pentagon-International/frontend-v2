import * as XLSX from "xlsx";

export type SelectableModalDocument = {
  document_no?: string | null;
  inv_crn_no?: string | null;
  amount?: number | string | null;
  document_amount?: number | string | null;
  [key: string]: unknown;
};

export type SelectDocumentSearchOptions = {
  /** Payment pages: also match Inv/Crn No. Receipt pages: false. */
  includeInvCrn?: boolean;
};

const normalizeText = (value: unknown): string =>
  String(value ?? "")
    .trim()
    .toLowerCase();

/** Normalize amounts for loose matching (commas, spaces, trailing zeros). */
const normalizeAmountToken = (value: unknown): string => {
  const raw = String(value ?? "")
    .trim()
    .replace(/,/g, "")
    .replace(/\s+/g, "");
  if (!raw) return "";
  const num = Number(raw);
  if (!Number.isFinite(num)) return raw.toLowerCase();
  return String(num);
};

const amountFieldTokens = (doc: SelectableModalDocument): string[] => {
  const tokens: string[] = [];
  for (const field of [doc.amount, doc.document_amount]) {
    const t = normalizeAmountToken(field);
    if (t) tokens.push(t);
    const display = normalizeText(field).replace(/,/g, "");
    if (display) tokens.push(display);
  }
  return tokens;
};

export function documentMatchesModalSearch(
  doc: SelectableModalDocument,
  query: string,
  options: SelectDocumentSearchOptions = {},
): boolean {
  const q = normalizeText(query);
  if (!q) return true;

  const docNo = normalizeText(doc.document_no);
  if (docNo && docNo.includes(q)) return true;

  if (options.includeInvCrn) {
    const invCrn = normalizeText(doc.inv_crn_no);
    if (invCrn && invCrn.includes(q)) return true;
  }

  const amountQuery = normalizeAmountToken(query);
  if (amountQuery) {
    for (const token of amountFieldTokens(doc)) {
      if (token === amountQuery || token.includes(amountQuery)) return true;
    }
  }

  return false;
}

export function findModalDocumentIndicesBySearch<T extends SelectableModalDocument>(
  list: T[],
  query: string,
  options: SelectDocumentSearchOptions = {},
): number[] {
  const q = normalizeText(query);
  if (!q) return [];
  const indices: number[] = [];
  list.forEach((doc, idx) => {
    if (documentMatchesModalSearch(doc, query, options)) indices.push(idx);
  });
  return indices;
}

const tokenizeCell = (value: unknown): string[] => {
  const raw = String(value ?? "").trim();
  if (!raw) return [];
  // Split multi-value cells / CSV-ish fragments while keeping normal doc numbers intact.
  return raw
    .split(/[\n\r;|]+/)
    .map((part) => part.trim())
    .filter(Boolean);
};

export async function extractTokensFromDocumentSelectionFile(
  file: File,
): Promise<string[]> {
  const name = (file.name || "").toLowerCase();
  const isSpreadsheet =
    name.endsWith(".xlsx") ||
    name.endsWith(".xls") ||
    name.endsWith(".csv") ||
    file.type.includes("sheet") ||
    file.type.includes("excel") ||
    file.type.includes("csv");

  if (isSpreadsheet) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const tokens = new Set<string>();
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      const rows = XLSX.utils.sheet_to_json<(string | number | null | undefined)[]>(
        sheet,
        { header: 1, raw: false, defval: "" },
      );
      for (const row of rows) {
        if (!Array.isArray(row)) continue;
        for (const cell of row) {
          for (const token of tokenizeCell(cell)) {
            tokens.add(token);
          }
        }
      }
    }
    return Array.from(tokens);
  }

  const text = await file.text();
  const tokens = new Set<string>();
  for (const line of text.split(/[\n\r]+/)) {
    for (const part of line.split(/[,;\t|]+/)) {
      const token = part.trim();
      if (token) tokens.add(token);
    }
  }
  return Array.from(tokens);
}

export function findModalDocumentIndicesByTokens<T extends SelectableModalDocument>(
  list: T[],
  tokens: string[],
  options: SelectDocumentSearchOptions = {},
): number[] {
  const normalizedTokens = tokens
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => ({
      text: normalizeText(t),
      amount: normalizeAmountToken(t),
    }))
    .filter((t) => t.text);

  if (normalizedTokens.length === 0) return [];

  const indices: number[] = [];
  list.forEach((doc, idx) => {
    const docNo = normalizeText(doc.document_no);
    const invCrn = options.includeInvCrn ? normalizeText(doc.inv_crn_no) : "";
    const amounts = amountFieldTokens(doc);

    const matched = normalizedTokens.some((token) => {
      if (docNo && (docNo === token.text || docNo.includes(token.text))) {
        return true;
      }
      if (invCrn && (invCrn === token.text || invCrn.includes(token.text))) {
        return true;
      }
      if (token.amount && amounts.some((a) => a === token.amount)) {
        return true;
      }
      return false;
    });

    if (matched) indices.push(idx);
  });

  return indices;
}

export function mergeSelectedIndices(
  current: Set<number>,
  toAdd: number[],
): Set<number> {
  const next = new Set(current);
  toAdd.forEach((idx) => next.add(idx));
  return next;
}
