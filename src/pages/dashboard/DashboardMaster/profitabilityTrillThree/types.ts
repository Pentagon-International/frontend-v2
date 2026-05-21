export type InvoiceChargeLine = {
  head: string;
  qty: string;
  rate: string;
  amountInr: number;
};

export type PaymentTimelineEvent = {
  state: "done" | "alert" | "pending";
  when: string;
  what: string;
  amountLabel?: string;
};

export type FollowUpAction = {
  label: string;
  owner: string;
  urgent?: boolean;
};

export type InvoiceProfitabilityDetail = {
  invoiceId: string;
  customer: string;
  jobRef: string;
  branch: { code: string; label: string };
  terms: string;
  currency: string;
  isPayable: boolean;
  receivableLabel: string;
  balanceL: number;
  grossAmountL: number;
  paidL: number;
  invoiceDate: string;
  dueDate: string;
  statusText: string;
  statusTone: "ok" | "bad" | "warn";
  chargeLines: InvoiceChargeLine[];
  subtotalInr: number;
  gstInr: number;
  totalInr: number;
  gstPct: number;
  timeline: PaymentTimelineEvent[];
  followUpActions: FollowUpAction[];
};

export type InvoiceProfitabilityApiPayload = {
  company: string;
  invoice_id: string;
  job_id?: string;
  date_from?: string;
  date_to?: string;
};

export type InvoiceOpenContext = {
  invoiceId: string;
  jobId: string;
  customer: string;
  documentLabel?: string;
};
