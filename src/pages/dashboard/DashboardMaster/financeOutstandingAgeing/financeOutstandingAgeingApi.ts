import { apiCallProtected } from "../../../../api/axios";
import { URL } from "../../../../api/serverUrls";
import { noteMissingDashboardExchangeRate } from "../../../../service/dashboard.service";
import { getDashboardDisplayCurrencyFields } from "../../../../utils/dashboardDisplayCurrency";

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
  const limit = params.limit ?? 30;
  const query = new URLSearchParams({
    index: String(index),
    limit: String(limit),
  });

  const payload: Record<string, unknown> = {
    company: params.company,
    branch: params.branch,
    ...getDashboardDisplayCurrencyFields(),
  };

  if (params.risk?.trim()) payload.risk = params.risk.trim();
  if (params.location?.trim()) payload.location = params.location.trim();
  if (params.customer_name?.trim()) payload.customer_name = params.customer_name.trim();
  if (params.search?.trim()) payload.search = params.search.trim();

  const url = `${URL.dashboard.customerOutstandingVsOverdue}?${query.toString()}`;
  const response = await apiCallProtected.post(url, payload);
  noteMissingDashboardExchangeRate(
    payload.display_currency as string | undefined,
    response,
  );
  return response;
}
