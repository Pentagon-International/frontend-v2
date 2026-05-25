import dayjs from "dayjs";
import { apiCallProtected } from "../../../../api/axios";
import { URL } from "../../../../api/serverUrls";
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
  };
  const branchCode = payload.branch_code?.trim();
  if (branchCode) request.branch_code = branchCode;
  return request;
}

export async function fetchJobProfitabilityDetail(
  payload: JobProfitabilityApiPayload,
  fallbackJob?: ProfitabilityJob | null,
): Promise<JobProfitabilityDetail> {
  const body = await apiCallProtected.post(
    URL.dashboard.accountsProfitability,
    buildJobProfitabilityPayload(payload),
  );
  return normalizeJobProfitabilityDetail(body, fallbackJob);
}
