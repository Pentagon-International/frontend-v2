export type OutstandingPartyType = "customer" | "agent";
export type OutstandingViewMode = "branch" | "party";
export type OutstandingRiskLevel = "low" | "medium" | "high";

export type AgeingBucket = {
  id: string;
  label: string;
  /** Raw API value (amount string or DSO day count). */
  raw: unknown;
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
  dso_days: string;
  days1_30: string;
  days31_60: string;
  days61_90: string;
  days90_180: string;
  days180_plus: string;
  open_line_count: string;
  /** Legacy combined 60+ column (fallback display). */
  days60Plus: string;
};

export type OutstandingTableRow = {
  id?: string;
  primaryLabel: string;
  /** API `customer_name` for filter dropdown values. */
  customerName?: string;
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
    customers?: { value: string; label: string }[];
    locations?: { value: string; label: string }[];
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
