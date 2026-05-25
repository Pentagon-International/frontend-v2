export type PendingActivityCategory = "invoices" | "costs" | "vouchers" | "credit_notes";

export type PendingActivityKpi = {
  id: PendingActivityCategory;
  label: string;
  subtitle: string;
  amountCr: number;
  amountDisplay?: string;
  count: number;
  avgAgeDays: number;
  highlightLabel?: string;
  highlightValue?: number;
  highlightTone?: "bad" | "warn" | "neutral";
};

export type DistributionSegment = {
  category: PendingActivityCategory;
  flex: number;
};

export type BranchOpenItemRow = {
  id?: string;
  branchName: string;
  branchVariant?: string;
  subtitle?: string;
  watchLabel?: string;
  watchTone?: "warn" | "bad";
  invoiceCount: number;
  invoiceAmountCr: number;
  invoiceDisplay?: string;
  costCount: number;
  costAmountCr: number;
  costDisplay?: string;
  distribution: DistributionSegment[];
  totalExposureCr: number;
  totalExposureDisplay?: string;
  owner: string;
};

export type BranchOpenItemsSection = {
  rows: BranchOpenItemRow[];
  total: BranchOpenItemRow;
};

export type ActivityListItem = {
  id?: string;
  iconTone?: PendingActivityCategory;
  title: string;
  subtitle: string;
  reference: string;
  amountCr: number;
  amountDisplay?: string;
  ageDays: number;
  branchCode?: string;
  branchVariant?: string;
  typeTag?: string;
  statusNote?: string;
};

export type ActivityListPagination = {
  index: number;
  limit: number;
  total: number;
};

export type ActivityListPanel = {
  id: PendingActivityCategory;
  title: string;
  subtitle: string;
  totalCount: number;
  filterTabs?: { value: string; label: string }[];
  items: ActivityListItem[];
  moreCount?: number;
  moreLabel?: string;
  pagination?: ActivityListPagination;
};

export type FinancePendingActivitiesData = {
  currencyCode: string;
  meta: {
    title: string;
    subtitle: string;
    asOfLabel: string;
  };
  kpis: PendingActivityKpi[];
  byBranch: BranchOpenItemsSection;
  invoicesPanel: ActivityListPanel;
  costsPanel: ActivityListPanel;
  vouchersPanel: ActivityListPanel;
  creditNotesPanel?: ActivityListPanel;
  filterOptions?: {
    branches?: { value: string; label: string }[];
    owners?: { value: string; label: string }[];
  };
};

export const EMPTY_BRANCH_TOTAL: BranchOpenItemRow = {
  branchName: "All Branches",
  invoiceCount: 0,
  invoiceAmountCr: 0,
  costCount: 0,
  costAmountCr: 0,
  distribution: [],
  totalExposureCr: 0,
  owner: "",
};

export const EMPTY_FINANCE_PENDING_ACTIVITIES: FinancePendingActivitiesData = {
  currencyCode: "INR",
  meta: {
    title: "Pending Activities",
    subtitle: "",
    asOfLabel: "Open as of today",
  },
  kpis: [],
  byBranch: { rows: [], total: EMPTY_BRANCH_TOTAL },
  invoicesPanel: {
    id: "invoices",
    title: "Invoices to Raise",
    subtitle: "",
    totalCount: 0,
    items: [],
  },
  costsPanel: {
    id: "costs",
    title: "Costs to Book",
    subtitle: "",
    totalCount: 0,
    items: [],
  },
  vouchersPanel: {
    id: "vouchers",
    title: "Vouchers Awaiting Approval",
    subtitle: "",
    totalCount: 0,
    items: [],
  },
};
