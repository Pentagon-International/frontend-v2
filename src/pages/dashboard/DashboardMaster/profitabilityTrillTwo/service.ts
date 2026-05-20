import { apiCallProtected } from "../../../../api/axios";
import { URL } from "../../../../api/serverUrls";
import type { ProfitabilityJob } from "../profitabilityTrillOne/types";
import { buildJobDetailFromRow, normalizeJobProfitabilityDetail } from "./normalize";
import type { JobProfitabilityApiPayload, JobProfitabilityDetail } from "./types";

export async function fetchJobProfitabilityDetail(
  payload: JobProfitabilityApiPayload,
  fallbackJob?: ProfitabilityJob | null,
): Promise<JobProfitabilityDetail> {
  try {
    const body = await apiCallProtected.post(URL.dashboard.accountsProfitabilityJob, payload);
    return normalizeJobProfitabilityDetail(body, fallbackJob);
  } catch {
    if (fallbackJob) return buildJobDetailFromRow(fallbackJob);
    throw new Error("Unable to load job profitability detail.");
  }
}
