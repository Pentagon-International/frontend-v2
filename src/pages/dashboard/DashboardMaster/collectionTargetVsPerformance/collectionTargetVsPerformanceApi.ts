import { apiCallProtected } from "../../../../api/axios";
import { URL } from "../../../../api/serverUrls";
import {
  periodToDateRange,
  type PendingActivitiesDateRange,
} from "../financePendingActivities/financePendingActivitiesApi";
import type { PeriodGranularity } from "./components/PeriodPillGroup";

export type CollectionPerformanceRequest = {
  company: string;
  date_from: string;
  date_to: string;
  branch_code?: string;
  invoice_id?: number;
};

let lastCollectionPerformanceRequest: CollectionPerformanceRequest | null = null;

export function getLastCollectionPerformanceRequest(): CollectionPerformanceRequest | null {
  return lastCollectionPerformanceRequest;
}

export function buildCollectionPerformanceRequest(
  company: string,
  dateRange: PendingActivitiesDateRange,
  options?: { branchCode?: string | null; invoiceId?: number | null },
): CollectionPerformanceRequest {
  const payload: CollectionPerformanceRequest = {
    company,
    date_from: dateRange.date_from,
    date_to: dateRange.date_to,
  };
  const code = options?.branchCode?.trim();
  if (code) payload.branch_code = code;
  const invoiceId = options?.invoiceId;
  if (invoiceId != null && Number.isFinite(invoiceId)) payload.invoice_id = invoiceId;
  return payload;
}

export function periodGranularityToDateRange(
  period: PeriodGranularity,
): PendingActivitiesDateRange {
  return periodToDateRange(period);
}

export async function fetchCollectionPerformance(
  payload: CollectionPerformanceRequest,
): Promise<unknown> {
  lastCollectionPerformanceRequest = { ...payload };
  // Response interceptor already unwraps axios `response.data` — do not read `.data` again.
  return apiCallProtected.post(URL.dashboard.collectionTargetVsPerformance, payload);
}
