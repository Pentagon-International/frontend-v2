export type CollectionBranchDrillSummaryCard = {
  label: string;
  value: string;
  detail: string;
  valueColor?: string;
};

export type CollectionOutstandingInvoiceRow = {
  invoiceId: number;
  documentNo: string;
  invoiceMeta: string;
  customerName: string;
  customerMeta: string;
  branchVariant?: string;
  amount: string;
  paid: string;
  paidTone: "muted" | "good";
  balance: string;
  ageDisplay: string;
  ageTone: "neutral" | "overdue" | "notDue";
  status: string;
  statusTone: "open" | "partial" | "other";
};

export type CollectionBranchDrillData = {
  breadcrumb: string;
  title: string;
  subtitle: string;
  summaryCards: CollectionBranchDrillSummaryCard[];
  invoices: CollectionOutstandingInvoiceRow[];
  invoiceCount: number;
  pagination?: {
    index: number;
    limit: number;
    totalCount: number;
    hasNext: boolean;
  };
};
