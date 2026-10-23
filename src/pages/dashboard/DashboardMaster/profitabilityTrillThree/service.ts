import { apiCallProtected } from "../../../../api/axios";
import { URL } from "../../../../api/serverUrls";
import { noteMissingDashboardExchangeRate } from "../../../../service/dashboard.service";
import { getDashboardDisplayCurrencyFields } from "../../../../utils/dashboardDisplayCurrency";
import type { JobLinkedDocument } from "../profitabilityTrillTwo/types";
import type { JobProfitabilityDetail } from "../profitabilityTrillTwo/types";
import {
  buildInvoiceDetailFromContext,
  normalizeInvoiceProfitabilityDetail,
} from "./normalize";
import type {
  InvoiceOpenContext,
  InvoiceProfitabilityApiPayload,
  InvoiceProfitabilityDetail,
} from "./types";

export async function fetchInvoiceProfitabilityDetail(
  payload: InvoiceProfitabilityApiPayload,
  context: InvoiceOpenContext,
  jobDetail?: JobProfitabilityDetail | null,
  document?: JobLinkedDocument | null,
): Promise<InvoiceProfitabilityDetail> {
  try {
    const requestPayload = {
      ...(payload as Record<string, unknown>),
      ...getDashboardDisplayCurrencyFields(),
    };
    const body = await apiCallProtected.post(
      URL.dashboard.accountsProfitabilityInvoice,
      requestPayload,
    );
    noteMissingDashboardExchangeRate(
      requestPayload.display_currency as string | undefined,
      body,
    );
    return normalizeInvoiceProfitabilityDetail(body, context, jobDetail, document);
  } catch {
    return buildInvoiceDetailFromContext(context, jobDetail, document);
  }
}
