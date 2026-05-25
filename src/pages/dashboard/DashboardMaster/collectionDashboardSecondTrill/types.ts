export type CollectionChargeLine = {
  chargeHead: string;
  qty: string;
  unit: string;
  rate: string;
  amount: string;
};

export type CollectionPaymentTimelineEvent = {
  date: string;
  title: string;
  amount: string;
  kind: "invoice" | "due" | "payment" | "other";
  state: "done" | "alert" | "pending";
};

export type CollectionInvoiceDrillData = {
  breadcrumb: string;
  invoiceId: string;
  customerName: string;
  branchLabel: string;
  branchVariant?: string;
  jobRef: string;
  terms: string;
  currency: string;
  balance: string;
  status: string;
  statusTone: "open" | "partial" | "overdue" | "neutral";
  receivableLabel: string;
  invoiceDate: string;
  dueDate: string;
  grossAmount: string;
  received: string;
  chargeLines: CollectionChargeLine[];
  subtotal: string;
  taxTotal: string;
  invoiceTotal: string;
  timeline: CollectionPaymentTimelineEvent[];
};
