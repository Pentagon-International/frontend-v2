import type { ProfitabilityJobSegment } from "../profitabilityTrillOne/types";

export type JobPlLine = {
  head: string;
  party: string;
  qty: string;
  rate: string;
  amountInr: number;
};

export type JobLinkedDocument = {
  label: string;
  id: string;
  date?: string;
  status?: string;
  invoiceId?: string;
  actionLabel?: string;
};

export type JobMarginBridgeItem = {
  label: string;
  deltaPp: number;
};

export type JobProfitabilityDetail = {
  jobId: string;
  customer: string;
  lane: string;
  segment: string;
  segmentKey?: ProfitabilityJobSegment;
  status: "pending" | "invoiced" | "transit" | "delivered" | string;
  statusLabel: string;
  branch: { code: string; label: string };
  salesperson: string;
  delivered: string;
  volume: string;
  revenueL: number;
  costL: number;
  grossProfitL: number;
  marginPct: number;
  perUnitLabel: string;
  revenueLines: JobPlLine[];
  costLines: JobPlLine[];
  linkedDocuments: JobLinkedDocument[];
  marginBridge: JobMarginBridgeItem[];
  marginCommentary: string;
};

export type JobProfitabilityApiPayload = {
  company: string;
  job_id: string;
  date_from?: string;
  date_to?: string;
};
