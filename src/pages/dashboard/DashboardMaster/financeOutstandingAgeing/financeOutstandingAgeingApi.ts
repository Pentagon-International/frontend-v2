import { apiCallProtected } from "../../../../api/axios";
import { URL } from "../../../../api/serverUrls";

export type OutstandingAgeingRequest = {
  company: string;
  branch: boolean;
  index?: number;
  limit?: number;
  risk?: string | null;
  location?: string | null;
  customer_name?: string | null;
  search?: string | null;
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
  if (params.customer_name?.trim()) payload.customer_name = params.customer_name.trim();
  if (params.search?.trim()) payload.search = params.search.trim();

  const url = `${URL.dashboard.customerOutstandingVsOverdue}?${query.toString()}`;
  return apiCallProtected.post(url, payload);
}
