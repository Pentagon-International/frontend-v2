import type { NavigateFunction } from "react-router-dom";
import { apiCallProtected } from "../api/axios";
import { API_HEADER } from "../store/storeKeys";
import { URL } from "../api/serverUrls";
import { ToastNotification } from "../components";

export type GlobalSearchItem = {
  id: string;
  display_id?: string | null;
  primary_code?: string | null;
  module: string;
  sub_module?: string | null;
  api_endpoint?: string | null;
  filter_id_key?: string | null;
  matched_field?: string | null;
};

export type GlobalSearchResponse = {
  query?: string;
  total_results?: number;
  type?: "single" | "multiple";
  data?: GlobalSearchItem | GlobalSearchItem[];
};

export type GlobalSearchNavigateOptions = {
  returnTo?: string;
  returnToState?: unknown;
};

const parseJsonIfString = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

export const normalizeGlobalSearchResponse = (
  input: unknown,
): GlobalSearchResponse | null => {
  const parsed = parseJsonIfString(input);
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  const t =
    typeof obj.type === "string" ? obj.type.trim().toLowerCase() : null;
  if ((t === "single" || t === "multiple") && "data" in obj) {
    return { ...(obj as object), type: t } as GlobalSearchResponse;
  }
  const candidates = [obj.data, obj.results, obj.response, obj.payload];
  for (const c of candidates) {
    const n = normalizeGlobalSearchResponse(c);
    if (n) return n;
  }
  return null;
};

export const fetchGlobalSearchModuleRecord = async (
  item: GlobalSearchItem,
): Promise<Record<string, unknown> | null> => {
  const module = String(item.module ?? "").trim();
  const recordId = String(item.id ?? "").trim();
  const apiEndpoint = String(item.api_endpoint ?? "").trim();
  const filterIdKey = String(item.filter_id_key ?? "").trim();

  if (!module || !recordId || !apiEndpoint || !filterIdKey) {
    return null;
  }

  const normalizedFilterValue =
    /^-?\d+$/.test(recordId) && Number.isSafeInteger(Number(recordId))
      ? Number(recordId)
      : recordId;

  const payload = {
    filters: {
      [filterIdKey]: normalizedFilterValue,
    },
  };

  const res = await apiCallProtected.post(apiEndpoint, payload, API_HEADER);
  const raw = (res as { data?: unknown })?.data ?? res;

  const parsed =
    raw && typeof raw === "object" && "data" in (raw as Record<string, unknown>)
      ? (raw as { data?: unknown }).data
      : raw;

  const record = Array.isArray(parsed) ? (parsed[0] as unknown) : parsed;

  if (!record || typeof record !== "object") {
    return null;
  }

  return record as Record<string, unknown>;
};

export const globalSearchModuleToRoute = (
  module: string,
  sub: string | null,
  id: string,
): { path: string; needsState: boolean } | null => {
  switch (module) {
    case "enquiry":
      return { path: "/enquiry-create", needsState: true };
    case "quotation":
      return { path: "/quotation-create", needsState: true };
    case "booking":
      if (sub === "air_export")
        return { path: "/air/export-booking/edit", needsState: true };
      if (sub === "air_import")
        return { path: "/air/import-booking/edit", needsState: true };
      if (sub === "ocean_export")
        return { path: "/SeaExport/export-booking/edit", needsState: true };
      if (sub === "ocean_import")
        return { path: "/SeaExport/import-booking/edit", needsState: true };
      return null;
    case "job":
      if (sub === "air_export")
        return { path: "/air/export-job/edit", needsState: true };
      if (sub === "ocean_export")
        return { path: "/SeaExport/export-job/edit", needsState: true };
      if (sub === "air_import")
        return { path: "/air/import-job/edit", needsState: true };
      if (sub === "ocean_import")
        return { path: "/SeaExport/import-job/edit", needsState: true };
      if (sub === "inland_export")
        return { path: "/inland/export-job/edit", needsState: true };
      if (sub === "inland_import")
        return { path: "/inland/import-job/edit", needsState: true };
      if (sub === "service_job")
        return { path: `/service-job/edit/${id}`, needsState: true };
      return null;
    case "invoice":
      if (sub === "air_export")
        return { path: `/air/export-job/invoice/edit/${id}`, needsState: false };
      if (sub === "air_import")
        return { path: `/air/import-job/invoice/edit/${id}`, needsState: false };
      if (sub === "ocean_export")
        return { path: `/SeaExport/export-job/invoice/edit/${id}`, needsState: false };
      if (sub === "ocean_import")
        return { path: `/SeaExport/import-job/invoice/edit/${id}`, needsState: false };
      if (sub === "inland_export")
        return { path: `/inland/export-job/invoice/edit/${id}`, needsState: false };
      if (sub === "inland_import")
        return { path: `/inland/import-job/invoice/edit/${id}`, needsState: false };
      if (sub === "service_job")
        return { path: `/service-job/invoice/edit/${id}`, needsState: false };
      return { path: `/invoice/edit/${id}`, needsState: false };
    case "reverse_invoice":
      return { path: "/invoice-reverse", needsState: true };
    case "journal_voucher":
      return { path: `/journal-voucher/edit/${id}`, needsState: false };
    case "receipt":
      return { path: "/receipt/edit", needsState: true };
    case "reverse_receipt":
      return { path: "/receipt/reversal/edit", needsState: true };
    case "overseas_receipt":
      return { path: "/overseas-receipt/edit", needsState: true };
    case "supplier_invoice":
      return { path: "/supplier-invoice/edit", needsState: true };
    case "reverse_supplier_invoice":
      return { path: "/supplier-invoice/reversal/edit", needsState: true };
    case "payment":
      return { path: "/payment/edit", needsState: true };
    case "overseas_payment":
      return { path: "/overseas-payment/edit", needsState: true };
    case "reverse_payment":
      return { path: "/payment/reversal/edit", needsState: true };
    default:
      return null;
  }
};

const buildReturnStateExtras = (
  options?: GlobalSearchNavigateOptions,
): Record<string, unknown> => {
  const extras: Record<string, unknown> = {};
  const returnTo = options?.returnTo?.trim();
  if (returnTo) extras.returnTo = returnTo;
  if (options?.returnToState != null) extras.returnToState = options.returnToState;
  return extras;
};

export const openGlobalSearchItem = async (
  navigate: NavigateFunction,
  item: GlobalSearchItem,
  options?: GlobalSearchNavigateOptions,
): Promise<boolean> => {
  const module = String(item.module ?? "").trim().toLowerCase();
  const subRaw = item.sub_module ?? null;
  const sub =
    subRaw == null ? null : String(subRaw).trim().toLowerCase() || null;
  const id = String(item.id ?? "").trim();
  if (!module || !id) return false;

  const target = globalSearchModuleToRoute(module, sub, id);
  if (!target) {
    return false;
  }

  const returnExtras = buildReturnStateExtras(options);

  if (!target.needsState) {
    navigate(target.path, {
      state: {
        actionType: "edit",
        fromGlobalSearch: true,
        ...returnExtras,
      },
    });
    return true;
  }

  const record = await fetchGlobalSearchModuleRecord(item);
  if (!record) {
    ToastNotification({
      type: "warning",
      message: `No ${module} record found for this search result.`,
    });
    return false;
  }

  const baseState = {
    actionType: "edit",
    fromGlobalSearch: true,
    ...returnExtras,
  };

  if (module === "job") {
    const jobId =
      (record as Record<string, unknown>)?.id ??
      (record as Record<string, unknown>)?.job_id ??
      id;
    // Closed jobs stay on /edit so Attach Documents can persist.
    // Job pages already lock all other fields when status is CLOSED.
    navigate(target.path, {
      state: {
        ...baseState,
        job: record,
        jobId,
      },
    });
    return true;
  }

  if (module === "booking") {
    const bookingId =
      (record as Record<string, unknown>)?.id ??
      (record as Record<string, unknown>)?.booking_id ??
      id;
    navigate(target.path, {
      state: {
        ...baseState,
        job: record,
        bookingId,
      },
    });
    return true;
  }

  if (module === "reverse_invoice") {
    const rec = record as Record<string, unknown>;
    navigate(target.path, {
      state: {
        ...baseState,
        financeReverseRecord: record,
        document_no: String(rec.document_no ?? item.display_id ?? ""),
        reverse_document_no: String(
          rec.reverse_document_no ?? rec.document_no ?? "",
        ).trim(),
        invoice_document_no: String(
          rec.invoice_document_no ??
            rec.invoice_no ??
            rec.original_invoice_no ??
            rec.reference_document_no ??
            "",
        ).trim(),
      },
    });
    return true;
  }

  navigate(target.path, {
    state: {
      ...(record as Record<string, unknown>),
      ...baseState,
    },
  });
  return true;
};

export const runGlobalSearchQuery = async (
  query: string,
): Promise<GlobalSearchResponse | null> => {
  const trimmed = String(query ?? "").trim();
  if (!trimmed) return null;

  const res = await apiCallProtected.get(
    `${URL.globalSearch}?q=${encodeURIComponent(trimmed)}`,
    API_HEADER,
  );

  const ax = res as {
    data?: unknown;
    request?: { response?: unknown; responseText?: unknown };
  };

  return (
    normalizeGlobalSearchResponse(ax.data) ??
    normalizeGlobalSearchResponse(ax.request?.response) ??
    normalizeGlobalSearchResponse(ax.request?.responseText) ??
    normalizeGlobalSearchResponse(res)
  );
};

export const globalSearchItemsFromResponse = (
  normalized: GlobalSearchResponse | null,
): GlobalSearchItem[] => {
  if (!normalized?.data) return [];
  if (normalized.type === "single" && !Array.isArray(normalized.data)) {
    return [normalized.data];
  }
  return Array.isArray(normalized.data) ? normalized.data : [];
};

export const navigateFromGlobalSearchDocumentNo = async (
  navigate: NavigateFunction,
  documentNo: string,
  options?: GlobalSearchNavigateOptions,
): Promise<"navigated" | "multiple" | "not_found" | "error"> => {
  try {
    const normalized = await runGlobalSearchQuery(documentNo);
    const items = globalSearchItemsFromResponse(normalized);

    if (items.length === 0) {
      return "not_found";
    }

    if (items.length === 1) {
      const ok = await openGlobalSearchItem(navigate, items[0], options);
      return ok ? "navigated" : "not_found";
    }

    return "multiple";
  } catch {
    return "error";
  }
};
