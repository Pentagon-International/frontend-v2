export type OutstandingPartyType = "customer" | "agent";
export type OutstandingViewMode = "branch" | "party";
export type OutstandingRiskLevel = "low" | "medium" | "high";

export type AgeingBucket = {
  id: string;
  label: string;
  amountDisplay?: string;
  amountCr: number;
  pct: number;
  invoiceCount: number;
  footnote?: string;
  footnoteTone?: "bad" | "neutral";
};

export type OutstandingAmountCells = {
  outstanding: string;
  overdue: string;
  days1_30: string;
  days31_60: string;
  days60Plus: string;
};

export type OutstandingTableRow = {
  id?: string;
  primaryLabel: string;
  /** Branch label from API `location` (falls back in normalizer when absent). */
  branchName?: string;
  branchVariant?: string;
  showBranchChip?: boolean;
  subtitle: string;
  amounts: OutstandingAmountCells;
  risk: OutstandingRiskLevel;
  watchLabel?: string;
  watchTone?: "warn" | "bad";
  highlight60Plus?: boolean;
  isMoreFooter?: boolean;
  moreCount?: number;
};

export type OutstandingTableSection = {
  rows: OutstandingTableRow[];
  total: OutstandingTableRow;
  moreFooter?: OutstandingTableRow;
};

export type OutstandingPartySlice = {
  tabLabel: string;
  amountCr: number;
  ageingBuckets: AgeingBucket[];
  byBranch: OutstandingTableSection;
  byParty: OutstandingTableSection;
};

export type FinanceOutstandingAgeingData = {
  meta: {
    title: string;
    subtitle: string;
    asOfLabel: string;
  };
  /** From API `summary.currency` (e.g. INR). */
  currency: string;
  customer: OutstandingPartySlice;
  agent: OutstandingPartySlice;
  filterOptions?: {
    branches?: { value: string; label: string }[];
    risks?: { value: string; label: string }[];
  };
  pagination?: {
    index: number;
    limit: number;
    total: number;
    hasNext: boolean;
  };
};
