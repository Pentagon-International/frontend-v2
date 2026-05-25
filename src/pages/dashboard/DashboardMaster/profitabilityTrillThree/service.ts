import { apiCallProtected } from "../../../../api/axios";
import { URL } from "../../../../api/serverUrls";
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
    const body = await apiCallProtected.post(URL.dashboard.accountsProfitabilityInvoice, payload);
    return normalizeInvoiceProfitabilityDetail(body, context, jobDetail, document);
  } catch {
    return buildInvoiceDetailFromContext(context, jobDetail, document);
  }
}
