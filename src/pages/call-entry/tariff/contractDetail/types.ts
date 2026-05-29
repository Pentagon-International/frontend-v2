export type ContractBasics = {
  carrier_code: string;
  carrier_name: string;
  vendor_reference: string;
  service: string;
  coverage_description: string;
  currency_code: string;
  valid_from: string;
  valid_to: string;
  status: string;
  country_code: string;
  auto_renew: boolean;
  auto_renew_days: number | null;
  created_by: string;
  approved_by: string | null;
  tariff_codes?: string[];
};

export type ContractRateLine = {
  id: number;
  charge_row_id?: number;
  currency_code: string;
  carrier_code: string;
  carrier_name?: string;
  charge_id?: number;
  charge_code: string;
  charge_name?: string;
  unit: string;
  rate?: string;
  equipment?: string;
  buy_rate: string;
  origin_code: string;
  origin_name: string;
  destination_code: string;
  destination_name: string;
  service_transit: string | null;
  notes?: string | null;
  frequency?: string | null;
  line_no?: number;
  applied?: boolean;
  tariff_code?: string;
};

export type ContractSurcharge = {
  id: number;
  charge_row_id?: number;
  currency_code: string;
  carrier_code: string;
  charge_code: string;
  charge_name: string;
  unit: string;
  rate: string;
  basis?: string;
  frequency?: string | null;
  applied?: boolean;
  surcharge?: boolean;
};

export type RateSheetSummary = {
  lane_count: number;
  min_rate: string;
  max_rate: string;
  avg_rate: string;
};

export type SurchargesSummary = {
  applied_count: number;
  total_rows: number;
};

export type ContractDetailResponse = {
  status: boolean;
  message?: string;
  vendor_reference: string;
  is_legacy?: boolean;
  is_editable?: boolean;
  contract_basics: ContractBasics;
  rate_sheet: ContractRateLine[];
  rate_sheet_summary: RateSheetSummary;
  surcharges: ContractSurcharge[];
  surcharges_summary: SurchargesSummary;
  internal_notes?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type AuditHistoryItem = {
  key: string;
  timestamp: string;
  label: string;
  actor: string;
  isRecent?: boolean;
};

export type ScorecardRow = {
  label: string;
  value: string;
  highlight?: boolean;
};
