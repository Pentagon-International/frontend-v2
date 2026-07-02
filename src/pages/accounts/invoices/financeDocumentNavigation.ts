import type { NavigateFunction } from "react-router-dom";
import { apiCallProtected } from "../../../api/axios";
import { ToastNotification } from "../../../components";

export type FinanceDocumentListRow = {
  sno?: number;
  record_type: string;
  id: number;
  document_no?: string;
  document_date?: string;
  status?: string;
  customer_name?: string;
  daybook_type?: string;
  branch_code?: string;
  company_code?: string;
  created_by?: string;
  api_endpoint?: string;
  filter_id_key?: string;
  billing_amt?: number | null;
  billing_currency?: string | null;
  local_amt?: number | null;
  local_currency?: string | null;
  job_id?: string[] | null;
  shipment_id?: string[] | null;
  house_no?: string[] | null;
};

export async function postFinanceFilterOne(
  apiEndpoint: string,
  filterIdKey: string,
  id: number | string,
): Promise<Record<string, unknown> | null> {
  const key = filterIdKey.trim() || "id";
  const recordId = String(id).trim();
  if (!apiEndpoint.trim() || !recordId) return null;

  const normalizedFilterValue =
    /^-?\d+$/.test(recordId) && Number.isSafeInteger(Number(recordId))
      ? Number(recordId)
      : recordId;

  const ep = apiEndpoint.trim().replace(/^\//, "");
  const res = await apiCallProtected.post(ep, {
    filters: { [key]: normalizedFilterValue },
  });
  const raw = (res as { data?: unknown })?.data ?? res;
  const parsed =
    raw && typeof raw === "object" && "data" in (raw as Record<string, unknown>)
      ? (raw as { data?: unknown }).data
      : raw;
  const record = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!record || typeof record !== "object") return null;
  return record as Record<string, unknown>;
}

type OpenMode = "edit" | "view";

export type FinanceReturnNavigation = {
  returnTo?: string;
  returnToState?: unknown;
};

export type OpenFinanceDocumentOptions = {
  /** e.g. `/unposted-documents` — target screen Back button will navigate here */
  returnTo?: string;
  returnToState?: unknown;
};

export function readFinanceReturnNavigation(
  locationState: unknown,
): FinanceReturnNavigation {
  const state = (locationState ?? {}) as FinanceReturnNavigation;
  return {
    returnTo: state.returnTo?.trim() ?? "",
    returnToState: state.returnToState,
  };
}

export function navigateFinanceReturn(
  navigate: NavigateFunction,
  locationState: unknown,
  fallbackPath?: string,
): void {
  const { returnTo, returnToState } = readFinanceReturnNavigation(locationState);
  if (returnTo) {
    navigate(
      returnTo,
      returnToState != null ? { state: returnToState } : undefined,
    );
    return;
  }
  if (fallbackPath) {
    navigate(fallbackPath);
    return;
  }
  navigate(-1);
}

/**
 * POST `row.api_endpoint` with `{ filters: { [filter_id_key]: id } }` (same pattern as global search),
 * then navigate to the screen that list / search uses for that `record_type`.
 */
export async function openFinanceDocument(
  navigate: NavigateFunction,
  row: FinanceDocumentListRow,
  mode: OpenMode,
  options?: OpenFinanceDocumentOptions,
): Promise<void> {
  const apiPath = (row.api_endpoint ?? "").trim();
  const fk = (row.filter_id_key ?? "id").trim() || "id";
  const recordType = (row.record_type ?? "").trim();
  const id = row.id;

  if (!apiPath || id == null || Number.isNaN(Number(id))) {
    ToastNotification({
      type: "error",
      message: "Missing document API metadata for this row.",
    });
    return;
  }

  let record: Record<string, unknown> | null;
  try {
    record = await postFinanceFilterOne(apiPath, fk, id);
  } catch {
    ToastNotification({
      type: "error",
      message: "Failed to load document details.",
    });
    return;
  }

  if (!record) {
    ToastNotification({
      type: "warning",
      message: "No data returned for this document.",
    });
    return;
  }

  const seg = mode === "view" ? "view" : "edit";
  const returnTo = options?.returnTo?.trim();
  const baseExtras = {
    actionType: mode,
    ...(returnTo ? { returnTo } : {}),
    ...(options?.returnToState != null
      ? { returnToState: options.returnToState }
      : {}),
  };

  const withRowState = (path: string) =>
    navigate(path, { state: { ...record, ...baseExtras } });

  switch (recordType) {
    case "invoice":
      navigate(`/invoice/${seg}/${id}`, {
        state: { ...record, ...baseExtras, invoiceData: record },
      });
      return;
    case "reverse_invoice": {
      const rec = record as Record<string, unknown>;
      navigate("/invoice-reverse", {
        state: {
          financeReverseRecord: record,
          document_no: String(rec.document_no ?? ""),
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
          ...baseExtras,
        },
      });
      return;
    }
    case "journal_voucher":
      navigate(`/journal-voucher/${seg}/${id}`, { state: { ...baseExtras } });
      return;
    case "reverse_voucher":
      navigate(`/journal-voucher-reversal/${seg}/${id}`, { state: { ...baseExtras } });
      return;
    case "supplier_invoice":
      navigate(`/supplier-invoice/${seg}/${id}`, { state: { ...baseExtras } });
      return;
    case "payment":
      withRowState(`/payment/${seg}`);
      return;
    case "reverse_payment":
      withRowState(`/payment/reversal/${seg}`);
      return;
    case "receipt":
      withRowState(`/receipt/${seg}`);
      return;
    case "reverse_receipt":
      withRowState(`/receipt/reversal/${seg}`);
      return;
    case "reverse_supplier_invoice":
      withRowState(`/supplier-invoice/reversal/${seg}`);
      return;
    default:
      ToastNotification({
        type: "warning",
        message: `Navigation is not configured for document type "${recordType}".`,
      });
  }
}
