import dayjs from "dayjs";
import { apiCallProtected } from "../../../../api/axios";
import { URL } from "../../../../api/serverUrls";
import { noteMissingDashboardExchangeRate } from "../../../../service/dashboard.service";
import { getDashboardDisplayCurrencyFields } from "../../../../utils/dashboardDisplayCurrency";
import type { ProfitabilityJob } from "../profitabilityTrillOne/types";
import { normalizeJobProfitabilityDetail } from "./normalize";
import type { JobProfitabilityApiPayload, JobProfitabilityDetail } from "./types";

export function buildJobProfitabilityPayload(payload: JobProfitabilityApiPayload) {
  const request: Record<string, unknown> = {
    company: payload.company,
    date_from:
      payload.date_from ?? dayjs().startOf("month").format("YYYY-MM-DD"),
    date_to: payload.date_to ?? dayjs().format("YYYY-MM-DD"),
    compare_previous_period: true,
    job_id: payload.job_id,
    ...getDashboardDisplayCurrencyFields(),
  };
  const headerBranchCode = payload.header_branch_code?.trim();
  if (headerBranchCode) request.header_branch_code = headerBranchCode;
  return request;
}

export async function fetchJobProfitabilityDetail(
  payload: JobProfitabilityApiPayload,
  fallbackJob?: ProfitabilityJob | null,
): Promise<JobProfitabilityDetail> {
  const requestPayload = buildJobProfitabilityPayload(payload);
  const body = await apiCallProtected.post(
    URL.dashboard.accountsProfitability,
    requestPayload,
  );
  noteMissingDashboardExchangeRate(
    requestPayload.display_currency as string | undefined,
    body,
  );
  return normalizeJobProfitabilityDetail(body, fallbackJob);
}
