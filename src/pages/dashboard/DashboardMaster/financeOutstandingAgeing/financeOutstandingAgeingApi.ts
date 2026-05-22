import { apiCallProtected } from "../../../../api/axios";
import { URL } from "../../../../api/serverUrls";

export type OutstandingAgeingRequest = {
  company: string;
  branch: boolean;
  index?: number;
  limit?: number;
  risk?: string | null;
  location?: string | null;
};

export async function fetchOutstandingAgeing(
  params: OutstandingAgeingRequest,
): Promise<unknown> {
  const index = params.index ?? 0;
  const limit = params.limit ?? 15;
  const query = new URLSearchParams({
    index: String(index),
    limit: String(limit),
  });

  const payload: Record<string, unknown> = {
    company: params.company,
    branch: params.branch,
  };

  if (params.risk?.trim()) payload.risk = params.risk.trim();
  if (params.location?.trim()) payload.location = params.location.trim();

  const url = `${URL.dashboard.customerOutstandingVsOverdue}?${query.toString()}`;
  return apiCallProtected.post(url, payload);
}
