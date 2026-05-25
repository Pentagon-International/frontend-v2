import type { NavigateFunction } from "react-router-dom";
import { apiCallProtected } from "../../api/axios";
import { URL } from "../../api/serverUrls";
import { API_HEADER } from "../../store/storeKeys";
import { ToastNotification } from "../../components";

export type ChatReferences = {
  enquiry_id?: string;
  quotation_id?: string;
};

export type ReferenceLinkTarget = "enquiry" | "quotation";

export const normalizeChatReferences = (raw: unknown): ChatReferences | undefined => {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const enquiry_id =
    typeof r.enquiry_id === "string" && r.enquiry_id.trim()
      ? r.enquiry_id.trim()
      : undefined;
  const quotation_id =
    typeof r.quotation_id === "string" && r.quotation_id.trim()
      ? r.quotation_id.trim()
      : undefined;
  if (!enquiry_id && !quotation_id) return undefined;
  return { enquiry_id, quotation_id };
};

const firstFilterRow = (res: unknown): Record<string, unknown> | null => {
  const body = (res as { data?: unknown })?.data ?? res;
  const list = Array.isArray(body)
    ? body
    : Array.isArray((body as { data?: unknown[] })?.data)
      ? (body as { data: unknown[] }).data
      : Array.isArray((body as { results?: unknown[] })?.results)
        ? (body as { results: unknown[] }).results
        : [];
  const first = list[0];
  return first && typeof first === "object" ? (first as Record<string, unknown>) : null;
};

const quotationEditPath = (row: Record<string, unknown>): string => {
  const pk = row.id ?? row.quotation_id;
  const idStr = pk != null ? String(pk) : "";
  if (/^\d+$/.test(idStr)) return `/quotation-create/${idStr}`;
  return "/quotation-create";
};

const fetchEnquiryRow = async (enquiryId: string) => {
  const res = await apiCallProtected.post(
    URL.enquiryFilter,
    { filters: { enquiry_id: enquiryId } },
    API_HEADER,
  );
  return firstFilterRow(res);
};

const fetchQuotationRow = async (refs: ChatReferences) => {
  const filters: Record<string, string> = {};
  if (refs.quotation_id) filters.quotation_id = refs.quotation_id;
  if (refs.enquiry_id) filters.enquiry_id = refs.enquiry_id;
  const res = await apiCallProtected.post(
    URL.quotationFilter,
    { filters },
    API_HEADER,
  );
  return firstFilterRow(res);
};

export const navigateFromChatReferences = async (
  target: ReferenceLinkTarget,
  refs: ChatReferences,
  navigate: NavigateFunction,
): Promise<void> => {
  try {
    if (target === "quotation") {
      const row = await fetchQuotationRow(refs);
      if (!row) {
        ToastNotification({
          type: "warning",
          message: "Quotation not found for this reference.",
        });
        return;
      }
      navigate(quotationEditPath(row), {
        state: { ...row, actionType: "edit" },
      });
      return;
    }

    const enquiryId = refs.enquiry_id?.trim();
    if (!enquiryId) {
      ToastNotification({ type: "warning", message: "Enquiry reference is missing." });
      return;
    }
    const row = await fetchEnquiryRow(enquiryId);
    if (!row) {
      ToastNotification({
        type: "warning",
        message: "Enquiry not found for this reference.",
      });
      return;
    }
    navigate("/enquiry-create", {
      state: { ...row, actionType: "edit", enquiry_id: row.enquiry_id ?? enquiryId },
    });
  } catch {
    ToastNotification({
      type: "error",
      message: "Could not open the linked record.",
    });
  }
};
