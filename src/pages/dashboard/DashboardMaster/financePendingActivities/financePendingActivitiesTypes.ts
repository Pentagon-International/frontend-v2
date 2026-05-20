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

export type ActivityListPanel = {
  id: PendingActivityCategory;
  title: string;
  subtitle: string;
  totalCount: number;
  filterTabs?: { value: string; label: string }[];
  items: ActivityListItem[];
  moreCount?: number;
  moreLabel?: string;
};

export type FinancePendingActivitiesData = {
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
