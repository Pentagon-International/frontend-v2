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

export type OutstandingTableRow = {
  id?: string;
  primaryLabel: string;
  branchVariant?: string;
  showBranchChip?: boolean;
  subtitle: string;
  outstanding: number;
  current: number;
  days1_30: number;
  days31_60: number;
  days60Plus: number;
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
  customer: OutstandingPartySlice;
  agent: OutstandingPartySlice;
  filterOptions?: {
    branches?: { value: string; label: string }[];
    risks?: { value: string; label: string }[];
  };
};
