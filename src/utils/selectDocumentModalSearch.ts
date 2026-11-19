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

/** Normalize header labels for case/spacing/punctuation-insensitive matching. */
const normalizeHeaderKey = (value: unknown): string =>
  normalizeText(value).replace(/[^a-z0-9]/g, "");

/** Columns we accept from uploaded spreadsheets (after normalizeHeaderKey). */
const DOC_NO_HEADERS = new Set([
  "docno",
  "documentno",
  "documentnumber",
]);
const INV_CRN_HEADERS = new Set([
  "invcrnno",
  "invcrn",
  "invcrnnumber",
]);

const isRecognizedSelectionHeader = (header: unknown): boolean => {
  const key = normalizeHeaderKey(header);
  return DOC_NO_HEADERS.has(key) || INV_CRN_HEADERS.has(key);
};

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

const addCellTokens = (tokens: Set<string>, cell: unknown) => {
  for (const token of tokenizeCell(cell)) {
    tokens.add(token);
  }
};

/**
 * Prefer recognized columns (Doc No / Document Number / Inv-Crn No).
 * If none are present, fall back to every cell (simple one-column lists).
 */
function extractTokensFromSpreadsheetRows(
  rows: (string | number | null | undefined)[][],
): string[] {
  const tokens = new Set<string>();
  if (rows.length === 0) return [];

  let headerRowIndex = -1;
  let selectedIndexes: number[] | null = null;

  for (let r = 0; r < Math.min(rows.length, 20); r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;
    const indexes: number[] = [];
    row.forEach((cell, colIdx) => {
      if (isRecognizedSelectionHeader(cell)) indexes.push(colIdx);
    });
    if (indexes.length > 0) {
      headerRowIndex = r;
      selectedIndexes = indexes;
      break;
    }
  }

  if (selectedIndexes != null && headerRowIndex >= 0) {
    for (let r = headerRowIndex + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!Array.isArray(row)) continue;
      for (const colIdx of selectedIndexes) {
        addCellTokens(tokens, row[colIdx]);
      }
    }
    return Array.from(tokens);
  }

  // No recognized headers — treat whole sheet as a flat token list.
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    for (const cell of row) {
      addCellTokens(tokens, cell);
    }
  }
  return Array.from(tokens);
}

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
      for (const token of extractTokensFromSpreadsheetRows(rows)) {
        tokens.add(token);
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
    .map((t) => normalizeText(t))
    .filter(Boolean);

  if (normalizedTokens.length === 0) return [];

  const indices: number[] = [];
  list.forEach((doc, idx) => {
    const docNo = normalizeText(doc.document_no);
    const invCrn = options.includeInvCrn ? normalizeText(doc.inv_crn_no) : "";

    // Exact match on document / inv-crn only (no amount matching from file).
    const matched = normalizedTokens.some((token) => {
      if (docNo && docNo === token) return true;
      if (invCrn && invCrn === token) return true;
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

/** Sample spreadsheet users can download to see the expected upload format. */
export function downloadSelectDocumentSampleXlsx(): void {
  const rows = [
    ["Doc No", "Inv/Crn No"],
    ["INV-1001", "CRN-55"],
    ["INV-1002", ""],
    ["DN-7788", "INV-9001"],
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet["!cols"] = [{ wch: 16 }, { wch: 14 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Documents");
  const excelBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  });
  const blob = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "select-documents-sample.xlsx";
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
