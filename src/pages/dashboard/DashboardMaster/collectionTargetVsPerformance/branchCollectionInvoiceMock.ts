import dayjs from "dayjs";
import type { BranchCollectionRow } from "./collectionTargetVsPerformanceTypes";

export type BranchCollectionInvoiceRow = {
  sno: number;
  invoiceNo: string;
  customer: string;
  invoiceDate: string;
  dueDate: string;
  amountCr: number;
  collectedCr: number;
  outstandingCr: number;
  ageDays: number;
  status: "Collected" | "Partial" | "Overdue" | "Open";
};

export type BranchCollectionInvoiceMockResult = {
  rows: BranchCollectionInvoiceRow[];
  summary: {
    targetCr: number;
    collectedCr: number;
    gapCr: number;
    invoiceCount: number;
    currency: string;
  };
};

const CUSTOMERS = [
  "Reliance Industries Ltd",
  "Tata Motors Pvt Ltd",
  "Infosys Technologies",
  "Adani Ports & SEZ",
  "Mahindra Logistics",
  "Asian Paints Ltd",
  "Sun Pharma Industries",
  "Hindustan Unilever",
  "Godrej Consumer Products",
  "Larsen & Toubro ECC",
];

function branchTitle(row: BranchCollectionRow): string {
  const chip = row.branchChipLabel ?? row.branchCode;
  if (chip && row.branchName) return `${chip} · ${row.branchName}`;
  return row.branchName || row.branchCode || "Branch";
}

/** Demo invoice-level drill-down until collection branch invoices API is live. */
export function getBranchCollectionInvoiceMock(
  branch: BranchCollectionRow,
): BranchCollectionInvoiceMockResult {
  const collectedCr = branch.collected;
  const targetCr = branch.target;
  const gapCr = branch.gap;
  const invoiceCount = Math.max(8, Math.round(collectedCr * 18));
  const rows: BranchCollectionInvoiceRow[] = [];

  let remainingCollected = collectedCr;
  const today = dayjs();

  for (let i = 0; i < invoiceCount; i++) {
    const share =
      i === invoiceCount - 1
        ? remainingCollected
        : Math.round((collectedCr / invoiceCount) * (0.85 + (i % 4) * 0.05) * 100) / 100;
    remainingCollected = Math.max(0, remainingCollected - share);

    const amountCr = Math.round(share * (1.02 + (i % 3) * 0.04) * 100) / 100;
    const collectedLine = Math.min(amountCr, Math.max(0, share));
    const outstandingCr = Math.max(0, Math.round((amountCr - collectedLine) * 100) / 100);
    const invoiceDate = today.subtract(12 + (i % 45), "day");
    const dueDate = invoiceDate.add(30 + (i % 15), "day");
    const ageDays = Math.max(0, today.diff(dueDate, "day"));

    let status: BranchCollectionInvoiceRow["status"] = "Collected";
    if (outstandingCr > 0 && ageDays > 0) status = "Overdue";
    else if (outstandingCr > 0) status = outstandingCr < amountCr * 0.5 ? "Partial" : "Open";

    rows.push({
      sno: i + 1,
      invoiceNo: `INV-${branch.branchCode ?? "BR"}-${String(2400 + i).padStart(4, "0")}`,
      customer: CUSTOMERS[i % CUSTOMERS.length],
      invoiceDate: invoiceDate.format("YYYY-MM-DD"),
      dueDate: dueDate.format("YYYY-MM-DD"),
      amountCr,
      collectedCr: collectedLine,
      outstandingCr,
      ageDays,
      status,
    });
  }

  return {
    rows,
    summary: {
      targetCr,
      collectedCr,
      gapCr,
      invoiceCount: rows.length,
      currency: "INR",
    },
  };
}

export { branchTitle };
