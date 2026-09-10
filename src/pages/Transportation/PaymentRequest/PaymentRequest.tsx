import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  Grid,
  Group,
  Loader,
  Menu,
  Modal,
  NumberInput,
  ScrollArea,
  Stack,
  Table,
  Tabs,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useDisclosure } from "@mantine/hooks";
import { Dropzone } from "@mantine/dropzone";
import {
  IconArrowLeft,
  IconCheck,
  IconChevronRight,
  IconDotsVertical,
  IconDownload,
  IconFileInvoice,
  IconListDetails,
  IconPlus,
  IconTrash,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import type { FC } from "react";
import { useMemo, useCallback, useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { URL } from "../../../api/serverUrls";
import { apiCallProtected } from "../../../api/axios";
import {
  SearchableSelect,
  Dropdown,
  ToastNotification,
  SingleDateInput,
} from "../../../components";
import { getAPICall } from "../../../service/getApiCall";
import { API_HEADER } from "../../../store/storeKeys";
import { postAPICall } from "../../../service/postApiCall";
import { commonSearchAPI } from "../../../service/searchApi";
import {
  jobCreateDropdownDisplayFormat,
  mapJobCreateDropdownOptions,
} from "../../../utils/jobCreateDropdown";
import useAuthStore from "../../../store/authStore";
import {
  getBranchGstNo,
  getDefaultBranchCountryCode,
  getDefaultBranchCurrencyCode,
  getDefaultUserBranch,
  isIndianOutstandingBranch,
  isIndianUserCountry,
} from "../../../utils/userNumberFormat";
import dayjs from "dayjs";
import {
  bindMoneyWholeNumberMode,
  clampMoneyAmountBound,
  formatMoneyAmountForUi,
  getAmountDecimalScale,
  isVietnamBranchFromUser,
} from "../../../utils/nonDecimalMoneyAmount";
import { getAmountNumberInputFormatProps } from "../../../utils/amountDisplayFormat";
import {
  getApiFailureMessage,
  getServerErrorMessage,
  unwrapApiStatusBody,
} from "../../../utils/apiErrorMessage";
import EditPageHeadingRow from "../../../components/EditPageHeadingRow";
import { navigateFinanceReturn } from "../../accounts/invoices/financeDocumentNavigation";
import { useViewAllocationDocs } from "../../../hooks/useViewAllocationDocs";
import {
  appendEditPageAuditPatch,
  mergeEditPageAuditSources,
} from "../../../utils/editPageAuditInfo";
import {
  collectPartyGstOptions,
  extractPartyTdsSectionsFromRecord,
  findPartyAddressByGst,
  findPrimaryPartyAddress,
  getPartyGstFromPrimaryAddress,
  type PartyAddressLike,
  recalculatePrqChargeAmounts,
  resolvePartyTdsSectionCode,
  resolveStateCodeFromPartyAddress,
} from "../../../utils/paymentRequestChargePrefill";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatReferenceDisplayValue(value: unknown): string {
  const text = String(value ?? "").trim();
  return text !== "" ? text : "-";
}

function resolvePaymentRequestGstPayloadValues(
  values: { customer_gst_no?: string; location_gst_no?: string },
  branchLocationGstNo: string,
) {
  return {
    customer_gst_no: String(values.customer_gst_no ?? "").trim(),
    location_gst_no:
      String(values.location_gst_no ?? "").trim() || branchLocationGstNo,
  };
}

function clampAmount(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value))
    return value === undefined ? null : value;
  const rounded = clampMoneyAmountBound(value);
  if (rounded == null) return null;
  const maxVal = 99999999.99;
  if (Math.abs(rounded) > maxVal) return rounded > 0 ? maxVal : -maxVal;
  return rounded;
}

function formatPaymentRequestPayloadAmount(
  value: number | null | undefined,
): number | undefined {
  if (value == null) return undefined;
  const rounded = clampAmount(value);
  return rounded == null ? undefined : rounded;
}

type PaymentRequestTaxBreakup = {
  sac_wise_totals?: Array<{
    sac_code?: string;
    charge_name?: string;
    charge_code?: string;
    total_amount?: number | string;
    charge_names?: string[];
    charge_count?: number;
    charge_id?: number;
    rate?: number | string;
    rate_type?: string;
    Dr_Cr?: string;
    roe?: number | string;
    currency_code?: string;
    currency_id?: number | string;
    job_id?: string;
  }>;
  cgst_total?: string | number;
  sgst_total?: string | number;
  igst_total?: string | number;
  total?: string | number;
};

function parsePaymentRequestGstBreakupResponse(
  response: unknown,
): PaymentRequestTaxBreakup {
  const axiosBody = (response as { data?: unknown })?.data ?? response;
  const statusBody = unwrapApiStatusBody(axiosBody) as Record<string, unknown>;
  const nested =
    statusBody.data &&
    typeof statusBody.data === "object" &&
    !Array.isArray(statusBody.data)
      ? (statusBody.data as Record<string, unknown>)
      : null;

  if (
    nested &&
    (Array.isArray(nested.sac_wise_totals) ||
      nested.total != null ||
      nested.cgst_total != null ||
      nested.sgst_total != null ||
      nested.igst_total != null)
  ) {
    return nested as PaymentRequestTaxBreakup;
  }

  return statusBody as PaymentRequestTaxBreakup;
}

function formatGstBreakupRate(
  rate: number | string | null | undefined,
  rateType: string | null | undefined,
): string {
  if (rate == null || String(rate).trim() === "") return "—";
  const typeStr = String(rateType ?? "").trim();
  if (typeStr === "%" || typeStr === "％") return `${rate}%`;
  if (typeStr !== "") return `${rate}${typeStr}`;
  return String(rate);
}

function parseGstBreakupAmount(value: unknown): number {
  if (value == null || String(value).trim() === "") return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function isChargeTdsRow(charge: {
  is_tds_row?: boolean;
  is_tds_calcualted_record?: unknown;
  is_tds_calculated_record?: unknown;
}): boolean {
  if (charge.is_tds_row === true) return true;
  const raw =
    charge.is_tds_calcualted_record ?? charge.is_tds_calculated_record;
  if (raw === true || raw === 1) return true;
  if (raw === false || raw === 0) return false;
  const normalized = String(raw ?? "")
    .trim()
    .toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function normalizeChargeDrCr(value: unknown): "Dr" | "Cr" {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  if (raw === "cr" || raw === "credit") return "Cr";
  return "Dr";
}

function calcPaymentRequestLocalTotal(charges: ChargeItem[]): number {
  return charges.reduce((sum, charge) => {
    if (isChargeTdsRow(charge)) return sum;
    const local = charge.amount_in_local;
    if (local == null || !Number.isFinite(local)) return sum;
    return sum + local;
  }, 0);
}

function normalizeDate(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  const raw = String(value).trim();
  if (!raw) return null;
  const native = new Date(raw);
  if (!isNaN(native.getTime())) return native;
  const m = raw.match(
    /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (m) {
    const d = new Date(
      Number(m[3]),
      Number(m[2]) - 1,
      Number(m[1]),
      m[4] ? Number(m[4]) : 0,
      m[5] ? Number(m[5]) : 0,
      m[6] ? Number(m[6]) : 0,
    );
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

// ─── API fetchers ────────────────────────────────────────────────────────────

const fetchCurrencyMaster = async () => {
  try {
    return await getAPICall(`${URL.currencyMaster}`, API_HEADER);
  } catch {
    return [];
  }
};

const fetchUnitMaster = async (serviceType: string) => {
  try {
    const response = await postAPICall(
      URL.unitMasterFilter,
      { filters: { service_type: serviceType } },
      API_HEADER,
    );
    return (response as any)?.data || [];
  } catch {
    return [];
  }
};

const fetchStateMaster = async () => {
  try {
    const response = await getAPICall(`${URL.state}`, API_HEADER);
    return (response as { data?: unknown[] })?.data ?? response ?? [];
  } catch {
    return [];
  }
};

const fetchTdsSectionMaster = async () => {
  try {
    const response = await getAPICall(`${URL.tdsSectionMaster}`, API_HEADER);
    return (response as { data?: unknown[] })?.data ?? response ?? [];
  } catch {
    return [];
  }
};

// Fetch effective SAC (tax code) for charge + service
const fetchGetEffectiveSac = async (
  items: { charge_id: number; service_id: number }[],
): Promise<
  Array<{
    charge_id: number;
    service_id: number;
    sac_code?: string | null;
    error?: string;
  }>
> => {
  try {
    const response = await postAPICall(
      (URL as any).gstChargeMappingGetEffectiveSac,
      { items },
      API_HEADER,
    );
    return (
      (
        response as {
          data?: Array<{
            charge_id: number;
            service_id: number;
            sac_code?: string | null;
            error?: string;
          }>;
        }
      )?.data ?? []
    );
  } catch {
    return [];
  }
};

// ─── Types ───────────────────────────────────────────────────────────────────

type ChargeItem = {
  id?: number | null;
  charge_id: number | null;
  charge_code?: string;
  charge_name: string;
  account_id?: number | null;
  account_code?: string;
  account_name?: string;
  subledger_code?: string;
  narration?: string;
  segment: string;
  job_no: string;
  job_id?: string;
  sub_job: string;
  cn_r: string;
  currency: string;
  currency_id?: string;
  roe: number | null;
  unit_code: string;
  unit_id?: string;
  no_of_unit: number | null;
  amount_per_unit: number | null;
  amount: number | null;
  amount_in_local: number | null;
  tax_code: string;
  tax: string;
  Dr_Cr: "Dr" | "Cr";
  is_tds_row?: boolean;
  is_tax_row?: boolean;
  is_tds_calcualted_record?: boolean;
  is_tds_calculated_record?: boolean;
};

type PaymentRequestFormData = {
  request_no: string;
  job_reference_1: string;
  job_reference_2: string;
  payment_crj_did: string;
  date: Date | null;
  rejected_request_no: string;
  proforma_invoice_no_1: string;
  proforma_invoice_no_2: string;
  proforma_invoice_date: Date | null;
  payment_type: string;
  voucher_type: string;
  cinv: boolean;
  actual_invoice_no: string;
  actual_invoice_date: Date | null;
  account_id: string;
  account_code: string;
  currency: string;
  amount: number | null;
  crj_date: Date | null;
  paid_to_type: string;
  not_over: string;
  paid_to: string;
  approved: string;
  state_code_1: string;
  state_code_2: string;
  approved_by_1: string;
  approved_by_2: string;
  tds_section_code: string;
  approved_date: Date | null;
  accountant_note: string;
  prepared_by_1: string;
  prepared_by_2: string;
  note: string;
  customer_gst_no: string;
  rejected_note: string;
  on_hold_note: string;
  location_gst_no: string;
  charges: ChargeItem[];
};

type SaveResponse = {
  id?: number;
  request_no?: string;
  status?: string;
};

type PaymentRequestFromApi = {
  id?: number;
  request_no?: string;
  created_by?: string;
  created_by_name?: string;
  created_at?: string | null;
  updated_by?: string;
  updated_by_name?: string;
  updated_at?: string | null;
  job_reference?: string;
  crj_number?: string;
  approved_by?: string;
  approved_date?: string | null;
  customer_gst_no?: string;
  location_gst_no?: string;
  date?: string | null;
  payment_type?: string;
  vouchar_type?: string;
  CINV?: boolean;
  proforma_inv_no?: string;
  proforma_inv_date?: string | null;
  actual_inv_no?: string;
  actual_inv_date?: string | null;
  account_id?: number;
  account_code?: string;
  subledger_code?: string;
  amount?: number | string | null;
  crj_date?: string | null;
  paid_to_type?: string;
  paid_to?: string;
  paid_to_name?: string;
  not_over?: string;
  tds_section_code?: string;
  account_note?: string;
  note?: string;
  rejected_note?: string | null;
  on_hold_note?: string | null;
  status?: string;
  currency_code?: string;
  currency_id?: number;
  state_id?: number;
  reporting_name?: string;
  reporting_address?: string;
  // API returns charges as "charges" (both POST and GET responses)
  charges?: Array<{
    id?: number;
    charge_id?: number;
    charge_code?: string;
    charge_name?: string;
    account_id?: number;
    account_code?: string;
    account_name?: string;
    subledger_code?: string;
    narration?: string;
    segment?: string;
    job_no?: string;
    job_id?: string;
    sub_job?: string;
    cn_r?: string;
    currency_code?: string;
    currency_id?: number;
    roe?: number | string;
    unit_code?: string;
    unit_id?: number;
    no_of_unit?: number | string;
    amount_per_unit?: number | string;
    amount?: number | string;
    local_amount?: number | string;
    sac_code?: string;
    tax?: boolean | string;
    Dr_Cr?: string;
    is_tds_calcualted_record?: boolean;
    is_tds_calculated_record?: boolean;
  }>;
  documents?: Array<{
    id?: number;
    document_id?: number;
    name?: string;
    document_name?: string;
    original_document_name?: string;
    file_name?: string;
    document_url?: string;
    document_download_url?: string;
  }>;
  supporting_documents?: Array<{
    id?: number;
    document_id?: number;
    name?: string;
    document_name?: string;
    original_document_name?: string;
    file_name?: string;
    document_url?: string;
    document_download_url?: string;
  }>;
};

type SupportingDocumentItem = {
  name: string;
  file: File | null;
  document_url?: string;
  document_id?: number;
  original_document_name?: string;
};

const FORM_DATA_HEADERS = { "Content-Type": "multipart/form-data" } as const;

const mapApiDocumentsToSupportingDocuments = (
  docs: unknown,
): SupportingDocumentItem[] => {
  if (!Array.isArray(docs)) return [];
  return docs.map((d: any) => ({
    name: (d?.document_name ?? d?.name ?? "").toString(),
    file: null,
    document_id:
      d?.document_id != null
        ? Number(d.document_id)
        : d?.id != null
          ? Number(d.id)
          : undefined,
    document_url: (d?.document_url ?? "").toString().trim() || undefined,
    original_document_name:
      (d?.original_document_name ?? d?.document_name ?? d?.name ?? "")
        .toString()
        .trim() || undefined,
  }));
};

const buildPaymentRequestFormData = (
  payload: Record<string, unknown>,
  supportingDocuments: SupportingDocumentItem[],
) => {
  const formData = new FormData();
  formData.append("payment_request", JSON.stringify(payload));

  let docIndex = 0;
  supportingDocuments.forEach((doc) => {
    if (doc.file) {
      formData.append(
        `document_names[${docIndex}]`,
        (doc.name ?? "").toString(),
      );
      formData.append(`document[${docIndex}]`, doc.file);
      if (doc.document_id != null) {
        formData.append(`document_id[${docIndex}]`, String(doc.document_id));
      }
      docIndex += 1;
      return;
    }
    if (doc.document_id != null) {
      formData.append(`document_id[${docIndex}]`, String(doc.document_id));
      docIndex += 1;
    }
  });

  return formData;
};

const PAYMENT_TYPE_OPTIONS = [
  { value: "Bank", label: "Bank" },
  { value: "CASH", label: "Cash" },
  { value: "PDC", label: "Pdc" },
  { value: "ONLINE TRANSFER", label: "Online Transfer" },
  { value: "DD/PO", label: "Dd/Po" },
  { value: "TT", label: "Tt" },
];

function normalizePaymentTypeValue(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const match = PAYMENT_TYPE_OPTIONS.find(
    (option) =>
      option.value.toLowerCase() === raw.toLowerCase() ||
      option.label.toLowerCase() === raw.toLowerCase(),
  );
  return match?.value ?? raw;
}

const VOUCHER_TYPE_OPTIONS = [
  { value: "SEA EXPORTS", label: "Sea Exports" },
  { value: "SEA IMPORTS", label: "Sea Imports" },
  { value: "CFS", label: "CFS" },
  { value: "BROKERAGE", label: "Brokerage" },
  { value: "AIR EXPORTS", label: "Air Exports" },
  { value: "AIR IMPORTS", label: "Air Imports" },
  { value: "TRANSPORTATION", label: "Transportation" },
  { value: "COASTAL", label: "Coastal" },
];

const PAID_TO_TYPE_OPTIONS = [
  { value: "supplier", label: "Supplier" },
  { value: "agent", label: "Agent" },
];

const SUPPLIER_ACCOUNT_NAME_ACCOUNT_CODES = ["1203010002", "1203010007"];

function supplierAccountNameSearchBody(query: string) {
  return {
    filters: {
      search: query.trim(),
      customer_type: "Supplier",
      term_code: "CASH",
      account_code: SUPPLIER_ACCOUNT_NAME_ACCOUNT_CODES,
    },
  };
}

const APPROVED_OPTIONS = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "pending", label: "Pending" },
];

const CN_R_OPTIONS = [
  { value: "C", label: "C" },
  { value: "N", label: "N" },
  { value: "R", label: "R" },
];

function resolveAccountNameEndpointByPaidToType(paidToType: string): string {
  const type = (paidToType ?? "").trim().toLowerCase();
  // Supplier account-name search uses the customer-master filter, not the
  // by-type supplier endpoint.
  if (type === "supplier") return URL.customerFilter;
  if (type === "agent") return URL.agent;
  return "";
}

function resolveVoucherTypeFromServiceType(serviceType: unknown): string {
  // Air Export Job flow
  if (typeof serviceType === "string") {
    const normalized = serviceType.trim().toUpperCase();
    if (normalized === "AIR") return "AIR EXPORTS";
  }

  // Export Job (sea) flow typically passes ["FCL", "LCL"]
  if (Array.isArray(serviceType)) {
    const normalizedList = serviceType.map((item) =>
      String(item ?? "")
        .trim()
        .toUpperCase(),
    );
    if (
      normalizedList.includes("FCL") ||
      normalizedList.includes("LCL") ||
      normalizedList.includes("SEA")
    ) {
      return "SEA EXPORTS";
    }
  }

  return "";
}

function resolveVoucherTypeFromSourceState(state: unknown): string {
  const explicitVoucherType =
    state && typeof state === "object" && "voucherType" in state
      ? String((state as { voucherType?: unknown }).voucherType ?? "").trim()
      : "";

  if (explicitVoucherType) {
    return explicitVoucherType.toUpperCase();
  }

  const serviceType =
    state && typeof state === "object" && "serviceType" in state
      ? (state as { serviceType?: unknown }).serviceType
      : undefined;

  return resolveVoucherTypeFromServiceType(serviceType);
}

function formatChargeNameWithCode(
  name?: string | null,
  code?: string | null,
): string {
  const chargeName = String(name ?? "").trim();
  const chargeCode = String(code ?? "").trim();
  if (!chargeName) return chargeCode;
  if (!chargeCode || chargeName.includes(`(${chargeCode})`)) return chargeName;
  return `${chargeName} (${chargeCode})`;
}

const emptyCharge = (): ChargeItem => ({
  charge_id: null,
  charge_code: "",
  charge_name: "",
  account_id: null,
  account_code: "",
  account_name: "",
  subledger_code: "",
  narration: "",
  segment: "",
  job_no: "",
  sub_job: "",
  cn_r: "",
  currency: "",
  currency_id: "",
  roe: null,
  unit_code: "",
  unit_id: "",
  no_of_unit: null,
  amount_per_unit: null,
  amount: null,
  amount_in_local: null,
  tax_code: "",
  tax: "",
  Dr_Cr: "Dr",
});

function formatPaymentRequestDate(d: Date | null): string | null {
  if (!d) return null;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${year}-${month}-${day}`;
}

function mapPaymentRequestChargeToPayload(
  c: ChargeItem,
): Record<string, unknown> {
  return {
    ...(c.id != null ? { id: c.id } : {}),
    charge_id: c.charge_id != null ? Number(c.charge_id) : undefined,
    charge_name: c.charge_name ?? "",
    ...(c.account_id != null ? { account_id: Number(c.account_id) } : {}),
    account_code: c.account_code || undefined,
    account_name: c.account_name || c.charge_name || undefined,
    subledger_code: c.subledger_code || undefined,
    narration: c.narration || undefined,
    cn_r: c.cn_r || undefined,
    Dr_Cr:
      isChargeTdsRow(c) || c.is_tax_row === true
        ? normalizeChargeDrCr(c.Dr_Cr)
        : "Dr",
    job_id: (c.job_no ?? "") || (c.job_id ?? ""),
    currency_id: c.currency_id ? Number(c.currency_id) : undefined,
    unit_id: c.unit_id ? Number(c.unit_id) : undefined,
    roe: c.roe != null ? Number(c.roe) : undefined,
    no_of_unit: c.no_of_unit != null ? Number(c.no_of_unit) : undefined,
    amount_per_unit: formatPaymentRequestPayloadAmount(c.amount_per_unit),
    amount: formatPaymentRequestPayloadAmount(c.amount),
    local_amount: formatPaymentRequestPayloadAmount(c.amount_in_local),
    sac_code: c.tax_code ?? "",
  };
}

function mapApiChargeToChargeItem(
  c: NonNullable<PaymentRequestFromApi["charges"]>[number],
): ChargeItem {
  return {
    id: c.id != null ? Number(c.id) : null,
    charge_id: c.charge_id != null ? Number(c.charge_id) : null,
    charge_code: c.charge_code ?? "",
    charge_name: c.charge_name ?? c.account_name ?? "",
    account_id: c.account_id != null ? Number(c.account_id) : null,
    account_code: c.account_code ?? "",
    account_name: c.account_name ?? c.charge_name ?? "",
    subledger_code: c.subledger_code ?? "",
    narration: c.narration ?? "",
    segment: c.segment ?? "",
    job_no: (c.job_no ?? "") || (c.job_id ?? ""),
    sub_job: c.sub_job ?? "",
    cn_r: c.cn_r ?? "",
    currency: c.currency_code ?? "",
    currency_id: c.currency_id != null ? String(c.currency_id) : "",
    roe: c.roe != null ? Number(c.roe) : null,
    unit_code: c.unit_code ?? "",
    unit_id: c.unit_id != null ? String(c.unit_id) : "",
    no_of_unit: c.no_of_unit != null ? Number(c.no_of_unit) : null,
    amount_per_unit:
      c.amount_per_unit != null ? clampAmount(Number(c.amount_per_unit)) : null,
    amount: c.amount != null ? clampAmount(Number(c.amount)) : null,
    amount_in_local:
      c.local_amount != null ? clampAmount(Number(c.local_amount)) : null,
    tax_code: c.sac_code ?? "",
    tax: c.tax === true || c.tax === "true" ? "true" : "false",
    Dr_Cr: normalizeChargeDrCr(
      c.Dr_Cr ?? (isChargeTdsRow(c) ? c.cn_r : undefined),
    ),
    is_tds_row: isChargeTdsRow(c),
    is_tds_calcualted_record: c.is_tds_calcualted_record,
    is_tds_calculated_record: c.is_tds_calculated_record,
  };
}

function mapChargesFromState(
  state: unknown,
): { charges: ChargeItem[]; job_reference_1: string } | null {
  const s = state as {
    chargesFromEstimates?: Array<Record<string, unknown>>;
    job_reference_1?: string;
  } | null;
  if (!s?.chargesFromEstimates?.length) return null;
  const charges: ChargeItem[] = s.chargesFromEstimates.map(
    (c: Record<string, unknown>) => ({
      ...emptyCharge(),
      charge_id: c.charge_id != null ? Number(c.charge_id) : null,
      charge_code: String(c.charge_code ?? ""),
      charge_name: String(c.charge_name ?? ""),
      segment: String(c.segment ?? ""),
      job_no: String(c.job_no ?? "") || String(c.job_id ?? ""),
      sub_job: String(c.sub_job ?? ""),
      cn_r: String(c.cn_r ?? ""),
      currency: String(c.currency ?? ""),
      currency_id: c.currency_id != null ? String(c.currency_id) : "",
      roe: c.roe != null && c.roe !== "" ? Number(c.roe) : null,
      unit_code: String(c.unit_code ?? ""),
      unit_id: c.unit_id != null ? String(c.unit_id) : "",
      no_of_unit:
        c.no_of_unit != null && c.no_of_unit !== ""
          ? Number(c.no_of_unit)
          : c.no_of_units != null && c.no_of_units !== ""
            ? Number(c.no_of_units)
            : null,
      amount_per_unit:
        c.amount_per_unit != null && c.amount_per_unit !== ""
          ? Number(c.amount_per_unit)
          : c.unit_cost != null && c.unit_cost !== ""
            ? Number(c.unit_cost)
            : c.cost_per_unit != null && c.cost_per_unit !== ""
              ? Number(c.cost_per_unit)
              : null,
      amount:
        c.amount != null && c.amount !== ""
          ? Number(c.amount)
          : c.total_cost != null && c.total_cost !== ""
            ? Number(c.total_cost)
            : null,
      amount_in_local:
        c.amount_in_local != null && c.amount_in_local !== ""
          ? Number(c.amount_in_local)
          : null,
      tax_code: String(c.tax_code ?? ""),
      tax: String(c.tax ?? ""),
    }),
  );
  return {
    charges,
    job_reference_1: s.job_reference_1 ?? "",
  };
}

const inputStyles = {
  input: { fontSize: "13px", fontFamily: "Inter", height: "36px" },
  label: { fontSize: "13px", fontFamily: "Inter", marginBottom: "4px" },
};

const textareaStyles = {
  input: { fontSize: "13px", fontFamily: "Inter" },
  label: { fontSize: "13px", fontFamily: "Inter", marginBottom: "4px" },
};

// ─── Component ───────────────────────────────────────────────────────────────

function PaymentRequest() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: requestId } = useParams<{ id: string }>();
  const handlePaymentRequestBack = useCallback(() => {
    navigateFinanceReturn(navigate, location.state);
  }, [navigate, location.state]);
  const user = useAuthStore((state) => state.user);
  const { openViewAllocationDocs, viewAllocationDocsUi } =
    useViewAllocationDocs();
  const isVietnamBranch = useMemo(() => isVietnamBranchFromUser(user), [user]);
  bindMoneyWholeNumberMode(isVietnamBranch);
  const amountDecimalScale = getAmountDecimalScale(isVietnamBranch);

  const isIndiaUser = useMemo(() => {
    const branchCountryCode = getDefaultBranchCountryCode(user?.branches);
    const branchCurrencyCode = getDefaultBranchCurrencyCode(user?.branches);
    if (branchCountryCode || branchCurrencyCode) {
      return isIndianOutstandingBranch(branchCountryCode, branchCurrencyCode);
    }
    return (
      isIndianUserCountry(user?.country?.country_code) ||
      String(user?.country?.country_name ?? "")
        .toLowerCase()
        .includes("india")
    );
  }, [
    user?.branches,
    user?.country?.country_code,
    user?.country?.country_name,
  ]);

  const isViewMode = location.pathname.includes("/view/");
  const isEditMode = location.pathname.includes("/edit/");
  const isEditOrViewMode = Boolean(requestId && (isViewMode || isEditMode));
  const isReadOnly = isViewMode;

  // Approve/Reject only for the Payment Request Approval list flow — not when
  // opened from a job Accounts documents table (fromJobAccounts).
  const showApprovalActions =
    (location.state as { fromPaymentRequestApproval?: boolean } | null)
      ?.fromPaymentRequestApproval === true &&
    (location.state as { fromJobAccounts?: boolean } | null)
      ?.fromJobAccounts !== true;

  // service_id for get-effective-sac API (available when navigating from a job page)
  const jobServiceId =
    (location.state as { job?: { service_id?: number } } | null)?.job
      ?.service_id ?? 0;

  const shouldApproveRef = useRef(false);
  const shouldRejectRef = useRef(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sacCodeLoadingByIndex, setSacCodeLoadingByIndex] = useState<
    Record<number, boolean>
  >({});
  const [saveResponse, setSaveResponse] = useState<SaveResponse | null>(null);
  const [auditPatch, setAuditPatch] = useState<Record<string, unknown> | null>(
    null,
  );
  const [chargesTabActive, setChargesTabActive] = useState("charges");
  const [gstBreakup, setGstBreakup] = useState<PaymentRequestTaxBreakup | null>(
    null,
  );
  const [gstBreakupLoading, setGstBreakupLoading] = useState(false);
  /**
   * Once Actual Invoice No + Date exist on an approved PRQ (from load or after
   * one-time update), they cannot be changed again (supplier-invoice fapiao style).
   */
  const [actualInvAlreadySet, setActualInvAlreadySet] = useState(false);
  const showTaxTab = isIndiaUser;

  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const [fileErrors, setFileErrors] = useState<{ [key: number]: string }>({});
  const [
    documentsModalOpened,
    { open: openDocumentsModal, close: closeDocumentsModal },
  ] = useDisclosure(false);
  const [
    rejectModalOpened,
    { open: openRejectModal, close: closeRejectModal },
  ] = useDisclosure(false);
  const [supportingDocuments, setSupportingDocuments] = useState<
    SupportingDocumentItem[]
  >([]);

  const downloadFile = (url: string, fileName: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  const [paymentRequestDataFromApi, setPaymentRequestDataFromApi] =
    useState<PaymentRequestFromApi | null>(null);
  const [chargeErrors, setChargeErrors] = useState<
    Record<number, Record<string, string>>
  >({});
  const [accountNameDisplay, setAccountNameDisplay] = useState<string | null>(
    null,
  );
  const [partyAddresses, setPartyAddresses] = useState<PartyAddressLike[]>([]);

  // isUpdate: driven by saveResponse.id OR requestId in URL
  const isUpdate =
    (saveResponse?.id != null && saveResponse.id > 0) || Boolean(requestId);

  const defaultBranch = getDefaultUserBranch(user?.branches);
  const defaultBranchCurrency = defaultBranch?.currency?.currency_code ?? "";
  const defaultBranchCurrencyId =
    defaultBranch?.currency?.currency_id != null
      ? String(defaultBranch.currency.currency_id)
      : "";
  const branchLocationGstNo = getBranchGstNo(defaultBranch);

  const getRoeValue = useCallback(
    (currency: string): number => {
      const userCountryCode = user?.country?.country_code;
      const currencyUpper = currency?.toUpperCase();
      if (userCountryCode === "IN") {
        if (currencyUpper === "INR") return 1;
        if (currencyUpper === "USD") return 88.75;
      } else if (userCountryCode === "AE") {
        if (currencyUpper === "AED") return 1;
        if (currencyUpper === "USD") return 3.67;
      }
      return 1;
    },
    [user?.country?.country_code],
  );

  // ─── Queries ───────────────────────────────────────────────────────────────

  const { data: currencyData = [], isLoading: isCurrencyLoading } = useQuery({
    queryKey: ["currencyMaster"],
    queryFn: fetchCurrencyMaster,
    staleTime: Infinity,
  });

  const { data: unitData = [] } = useQuery({
    queryKey: ["unitMaster", "AIR"],
    queryFn: () => fetchUnitMaster(location.state?.serviceType),
    staleTime: Infinity,
  });

  const { data: stateData = [], isLoading: isStateLoading } = useQuery({
    queryKey: ["stateMaster"],
    queryFn: fetchStateMaster,
    staleTime: Infinity,
  });

  const { data: tdsSectionData = [], isLoading: isTdsSectionLoading } =
    useQuery({
      queryKey: ["tdsSectionMaster"],
      queryFn: fetchTdsSectionMaster,
      staleTime: Infinity,
    });

  const { data: sacCodes = [] } = useQuery({
    queryKey: ["gstSacMasterFilter", "payment-request"],
    queryFn: async () => {
      try {
        const res = await postAPICall(URL.gstSacMasterFilter, {}, API_HEADER);
        const maybeAxios = res as { data?: unknown };
        const payloadUnknown: unknown = maybeAxios?.data ?? res;
        const isObj = (v: unknown): v is Record<string, unknown> =>
          typeof v === "object" && v !== null && !Array.isArray(v);

        let rows: unknown[] = [];
        if (Array.isArray(payloadUnknown)) {
          rows = payloadUnknown;
        } else if (
          isObj(payloadUnknown) &&
          Array.isArray(payloadUnknown.data)
        ) {
          rows = payloadUnknown.data as unknown[];
        } else if (
          isObj(payloadUnknown) &&
          isObj(payloadUnknown.data) &&
          Array.isArray((payloadUnknown.data as Record<string, unknown>).data)
        ) {
          rows = (payloadUnknown.data as Record<string, unknown>)
            .data as unknown[];
        }

        const list = rows as Array<{ sac_code?: unknown }>;
        return list
          .map((r) => String(r?.sac_code ?? "").trim())
          .filter(Boolean);
      } catch (e) {
        console.error("Error fetching SAC master:", e);
        return [] as string[];
      }
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const stateOptions = useMemo(() => {
    const data = stateData as {
      id?: number;
      state_name?: string;
      name?: string;
    }[];
    if (!Array.isArray(data)) return [];
    return data.map((item) => ({
      value: String(item.id ?? ""),
      label: item.state_name ?? item.name ?? "",
    }));
  }, [stateData]);

  const tdsSectionOptions = useMemo(() => {
    const data = tdsSectionData as {
      tds_section_code?: string | number;
      tds_section_name?: string;
    }[];
    if (!Array.isArray(data)) return [];
    return data
      .map((item) => {
        const code = String(item.tds_section_code ?? "").trim();
        const name = String(item.tds_section_name ?? "").trim();
        const label = name && code ? `${name} - ${code}` : name || code;
        return { value: code, label };
      })
      .filter((o) => o.value);
  }, [tdsSectionData]);

  const sacCodeOptions = useMemo(() => {
    const uniq = new Set<string>();
    (Array.isArray(sacCodes) ? sacCodes : []).forEach((c) => {
      const v = String(c ?? "").trim();
      if (v) uniq.add(v);
    });
    return Array.from(uniq);
  }, [sacCodes]);

  // Fetch payment request data when opening edit/view URL (/edit/:id or /view/:id)
  const { data: requestFetchRes, isFetching: requestFetchLoading } = useQuery({
    queryKey: ["payment-request-view", requestId, location.key],
    enabled: Boolean(isEditOrViewMode && requestId),
    queryFn: async () =>
      getAPICall(`${(URL as any).paymentRequest}${requestId}/`, API_HEADER),
    staleTime: 5 * 60 * 1000,
    refetchOnMount: true,
    refetchOnReconnect: true,
  });

  // Extract API data from response and store in state
  useEffect(() => {
    if (!isEditOrViewMode || !requestId) return;
    const payload = requestFetchRes as any;
    const data = payload?.data?.data ?? payload?.data ?? payload;
    if (data && typeof data === "object" && !Array.isArray(data)) {
      setPaymentRequestDataFromApi(data as PaymentRequestFromApi);
    } else {
      setPaymentRequestDataFromApi(null);
    }
  }, [requestId, isEditOrViewMode, requestFetchRes]);

  // ─── Options ──────────────────────────────────────────────────────────────

  const currencyOptions = useMemo(() => {
    const data = currencyData as any[];
    if (!Array.isArray(data)) return [];
    return data.map((item: any) => {
      const code = item.currency_code ?? item.code ?? "";
      const id = item.id != null ? String(item.id) : "";
      return { value: id || code, label: `${code || id}` };
    });
  }, [currencyData]);

  const billingCurrencyOptions = useMemo(() => {
    const data = currencyData as any[];
    if (!Array.isArray(data)) return [];
    return data
      .map((item: any) => {
        const code = (item.currency_code ?? item.code ?? "").toString().trim();
        return { value: code, label: code ? code.toUpperCase() : "" };
      })
      .filter((o) => o.value !== "");
  }, [currencyData]);

  const unitOptions = useMemo(() => {
    const data = unitData as any[];
    if (!Array.isArray(data)) return [];
    return data.map((item: any) => ({
      value: String(item.id ?? ""),
      label: item.unit_code ?? item.unit_name ?? String(item.id ?? ""),
    }));
  }, [unitData]);

  // ─── Prefill from Air Export Job (Create PR) ───────────────────────────────
  // Use initialValues from location.state so charges are set on first render (no useEffect timing)
  const prefillFromState = useMemo(() => {
    if (requestId) return null;
    return mapChargesFromState(location.state);
  }, [location.state, requestId]);

  const defaultVoucherTypeFromSource = useMemo(
    () => resolveVoucherTypeFromSourceState(location.state),
    [location.state],
  );

  // ─── Form ─────────────────────────────────────────────────────────────────

  const form = useForm<PaymentRequestFormData>({
    initialValues: {
      request_no: "",
      job_reference_1: prefillFromState?.job_reference_1 ?? "",
      job_reference_2: "",
      payment_crj_did: "",
      date: new Date(),
      rejected_request_no: "",
      proforma_invoice_no_1: "",
      proforma_invoice_no_2: "",
      proforma_invoice_date: null,
      payment_type: "",
      voucher_type: defaultVoucherTypeFromSource,
      cinv: false,
      actual_invoice_no: "",
      actual_invoice_date: null,
      account_id: "",
      account_code: "",
      currency: defaultBranchCurrency,
      amount: null,
      crj_date: null,
      paid_to_type: "",
      not_over: "",
      paid_to: "",
      approved: "",
      state_code_1: "",
      state_code_2: "",
      approved_by_1: "",
      approved_by_2: "",
      tds_section_code: "",
      approved_date: null,
      accountant_note: "",
      prepared_by_1: "",
      prepared_by_2: "",
      note: "",
      customer_gst_no: "",
      rejected_note: "",
      on_hold_note: "",
      location_gst_no: branchLocationGstNo,
      charges: prefillFromState?.charges ?? [emptyCharge()],
    },
    validate: {
      date: (v) => (!v ? "Date is required" : null),
      payment_type: (v) => (!v ? "Payment Type is required" : null),
      paid_to: (v) => (!v?.trim() ? "Paid To is required" : null),
      customer_gst_no: (v, values) => {
        if (!isIndiaUser) return null;
        const hasAccount =
          Boolean(values.account_id?.trim()) || Boolean(values.paid_to?.trim());
        if (!hasAccount) return null;
        return !String(v ?? "").trim() ? "Vendor GSTN is required" : null;
      },
      location_gst_no: (v) => {
        if (!isIndiaUser) return null;
        const gst = String(v ?? "").trim() || branchLocationGstNo;
        return !gst ? "Location GSTN is required" : null;
      },
    },
  });

  const partyGstOptions = useMemo(
    () => collectPartyGstOptions(partyAddresses),
    [partyAddresses],
  );

  const resolvedLocationGstNo =
    form.values.location_gst_no?.trim() || branchLocationGstNo;

  useEffect(() => {
    if (!branchLocationGstNo) return;
    if (!form.values.location_gst_no?.trim()) {
      form.setFieldValue("location_gst_no", branchLocationGstNo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchLocationGstNo]);

  const applyPartyAddressState = useCallback(
    (address: PartyAddressLike | undefined) => {
      const stateCode = resolveStateCodeFromPartyAddress(address, stateOptions);
      if (stateCode) {
        form.setFieldValue("state_code_1", stateCode);
      }
    },
    [form, stateOptions],
  );

  const sacCodeOptionsForForm = useMemo(() => {
    const uniq = new Set<string>(sacCodeOptions);
    (form.values.charges ?? []).forEach((c) => {
      const v = String(c.tax_code ?? "").trim();
      if (v) uniq.add(v);
    });
    return Array.from(uniq);
  }, [sacCodeOptions, form.values.charges]);

  const prefillJobId = useMemo(() => {
    const fromForm = String(form.values.job_reference_1 ?? "").trim();
    if (fromForm) return fromForm;
    const stateJob = (
      location.state as { job?: { job_id?: unknown; id?: unknown } } | null
    )?.job;
    return String(stateJob?.job_id ?? stateJob?.id ?? "").trim();
  }, [form.values.job_reference_1, location.state]);

  const isJobChargesPrefillFlow =
    !isEditOrViewMode && prefillFromState != null && prefillJobId !== "";

  const [prefillJobOptions, setPrefillJobOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);

  useEffect(() => {
    if (!isJobChargesPrefillFlow || !prefillJobId) {
      setPrefillJobOptions([]);
      return;
    }

    commonSearchAPI({ endpoint: URL.filterJobCreate, query: prefillJobId })
      .then((rows) => {
        const arr = Array.isArray(rows)
          ? (rows as Array<Record<string, unknown>>)
          : [];
        const opts = mapJobCreateDropdownOptions(arr);
        if (prefillJobId && !opts.some((o) => o.value === prefillJobId)) {
          opts.unshift({ value: prefillJobId, label: prefillJobId });
        }
        setPrefillJobOptions(opts);
      })
      .catch(() =>
        setPrefillJobOptions(
          prefillJobId ? [{ value: prefillJobId, label: prefillJobId }] : [],
        ),
      );
  }, [isJobChargesPrefillFlow, prefillJobId]);

  const isApprovedStatus =
    (saveResponse?.status ?? form.values.approved ?? "")
      .toString()
      .trim()
      .toUpperCase() === "APPROVED";
  /** Approved edit: all fields locked except one-shot actual inv (when allowed). */
  const formFieldsReadOnly = isReadOnly || isApprovedStatus;
  const docsReadOnly = formFieldsReadOnly;
  const hasProformaSet =
    Boolean(String(form.values.proforma_invoice_no_1 ?? "").trim()) &&
    form.values.proforma_invoice_date != null;
  /**
   * Approved + proforma set + actual inv not yet saved: allow one-time insert
   * of Actual Invoice No + Date (same pattern as supplier-invoice Inv/Crn after post).
   */
  const canEditActualInvAfterApproved =
    !isViewMode &&
    isApprovedStatus &&
    hasProformaSet &&
    !actualInvAlreadySet &&
    saveResponse?.id != null &&
    saveResponse.id > 0;
  const actualInvFieldReadOnly =
    isViewMode || (isApprovedStatus && !canEditActualInvAfterApproved);

  const isPaidToSelected =
    !!String(form.values.paid_to ?? "").trim() ||
    !!String(form.values.account_id ?? "").trim() ||
    !!String(accountNameDisplay ?? "").trim();

  const chargesDropdownZIndex = 200;

  const chargesLocalTotal = useMemo(
    () => clampAmount(calcPaymentRequestLocalTotal(form.values.charges)) ?? 0,
    [form.values.charges],
  );

  const gstBreakupTotals = useMemo(
    () => ({
      igst_total: parseGstBreakupAmount(gstBreakup?.igst_total),
      cgst_total: parseGstBreakupAmount(gstBreakup?.cgst_total),
      sgst_total: parseGstBreakupAmount(gstBreakup?.sgst_total),
      total: parseGstBreakupAmount(gstBreakup?.total),
    }),
    [gstBreakup],
  );

  useEffect(() => {
    // In create flow, if voucher type is empty, auto-fill from source screen.
    if (isEditOrViewMode) return;
    if (!defaultVoucherTypeFromSource) return;
    if ((form.values.voucher_type ?? "").trim() !== "") return;
    form.setFieldValue("voucher_type", defaultVoucherTypeFromSource);
  }, [
    isEditOrViewMode,
    defaultVoucherTypeFromSource,
    form.values.voucher_type,
    form,
  ]);

  // ─── Prefill Paid To from Air Export Job Supplier ──────────────────────
  useEffect(() => {
    if (isEditOrViewMode) return;
    // Avoid repeated overriding during re-renders.
    if (form.values.paid_to_type?.trim()) return;

    const stateAny = location.state as any;

    // When opened from Air Export Job (serviceType AIR), do not auto-map
    // Paid To Type / Account Name / Paid To / State.
    const sourceServiceType = stateAny?.serviceType;
    const isAirSource =
      (typeof sourceServiceType === "string" &&
        sourceServiceType.trim().toUpperCase() === "AIR") ||
      (Array.isArray(sourceServiceType) &&
        sourceServiceType.some(
          (x) =>
            String(x ?? "")
              .trim()
              .toUpperCase() === "AIR",
        ));
    const isExportJobSource =
      Array.isArray(sourceServiceType) &&
      sourceServiceType.some((x) => {
        const v = String(x ?? "")
          .trim()
          .toUpperCase();
        return v === "FCL" || v === "LCL";
      });
    if (isAirSource || isExportJobSource) return;

    const supplierDetails =
      stateAny?.supplier ??
      stateAny?.Supplier ??
      stateAny?.supplier_details ??
      stateAny?.supplierData ??
      stateAny?.job?.supplier ??
      stateAny?.job?.supplier_details ??
      stateAny?.job?.supplierData ??
      null;

    if (!supplierDetails) return;

    const supplierName = (supplierDetails.supplier_name ??
      supplierDetails.supplierName ??
      supplierDetails.name ??
      supplierDetails.customer_name ??
      supplierDetails.account_name ??
      "") as string;

    const supplierId =
      supplierDetails.supplier_id ??
      supplierDetails.id ??
      supplierDetails.account_id ??
      null;

    const supplierCode =
      supplierDetails.supplier_code ??
      supplierDetails.customer_code ??
      supplierDetails.code ??
      null;

    const nextAccountId =
      supplierId != null && !Number.isNaN(Number(supplierId))
        ? String(supplierId)
        : supplierCode != null
          ? String(supplierCode)
          : "";

    if (!supplierName?.trim() || !nextAccountId.trim()) return;

    form.setFieldValue("paid_to_type", "supplier");
    form.setFieldValue("account_id", nextAccountId);
    form.setFieldValue(
      "account_code",
      supplierCode != null ? String(supplierCode) : "",
    );
    setAccountNameDisplay(supplierName);
    // Keep the "Paid To" text input in sync with the selected supplier.
    form.setFieldValue("paid_to", supplierName);

    const applyStateFromAddresses = (
      addresses: PartyAddressLike[] | null | undefined,
    ) => {
      if (!Array.isArray(addresses) || addresses.length === 0) {
        setPartyAddresses([]);
        return;
      }

      setPartyAddresses(addresses);

      const primaryAddress = findPrimaryPartyAddress(addresses);
      form.setFieldValue(
        "customer_gst_no",
        getPartyGstFromPrimaryAddress(addresses),
      );
      form.clearFieldError("customer_gst_no");
      form.setFieldValue("location_gst_no", branchLocationGstNo);
      applyPartyAddressState(primaryAddress);
    };

    const applyTdsFromPartyRecord = (record: unknown) => {
      const nextTdsCode = resolvePartyTdsSectionCode(
        extractPartyTdsSectionsFromRecord(record),
        tdsSectionOptions,
      );
      form.setFieldValue("tds_section_code", nextTdsCode);
    };

    // Auto-fill state from PRIMARY address if already provided in supplier object.
    const addresses = (supplierDetails.addresses_data ??
      supplierDetails.addresses ??
      []) as Array<any>;
    applyTdsFromPartyRecord(supplierDetails);

    if (Array.isArray(addresses) && addresses.length > 0) {
      applyStateFromAddresses(addresses);
      return;
    }

    // Otherwise, fetch supplier details by supplier code/id, then apply PRIMARY address state.
    if (form.values.state_code_1?.trim()) return;

    const supplierEndpoint = URL.supplierByType;

    if (!supplierEndpoint) return;

    (async () => {
      try {
        const query =
          supplierCode != null ? String(supplierCode) : nextAccountId;
        const response = await getAPICall(
          `${supplierEndpoint}?search=${encodeURIComponent(String(query))}`,
          API_HEADER,
        );

        const first = Array.isArray(response)
          ? response[0]
          : Array.isArray((response as any)?.data)
            ? (response as any).data[0]
            : null;

        const fetchedAddresses =
          (first as any)?.addresses_data ?? (first as any)?.addresses;

        applyStateFromAddresses(fetchedAddresses);
        applyTdsFromPartyRecord(first);

        const fetchedId =
          (first as any)?.id ??
          (first as any)?.supplier_id ??
          (first as any)?.account_id ??
          null;
        const fetchedCode =
          (first as any)?.customer_code ??
          (first as any)?.supplier_code ??
          (first as any)?.account_code ??
          (first as any)?.code ??
          null;
        const fetchedDisplayName =
          (first as any)?.customer_name ??
          (first as any)?.supplier_name ??
          (first as any)?.account_name ??
          (first as any)?.name ??
          supplierName;

        if (fetchedId != null && !Number.isNaN(Number(fetchedId))) {
          form.setFieldValue("account_id", String(fetchedId));
        }
        if (fetchedCode != null) {
          form.setFieldValue("account_code", String(fetchedCode));
        }
        if (fetchedDisplayName != null && String(fetchedDisplayName).trim()) {
          setAccountNameDisplay(String(fetchedDisplayName));
          form.setFieldValue("paid_to", String(fetchedDisplayName));
        }
      } catch {
        // Ignore; state_code_1 can be set manually if fetch fails.
      }
    })();
  }, [
    isEditOrViewMode,
    location.state,
    stateOptions,
    tdsSectionOptions,
    branchLocationGstNo,
    form,
    applyPartyAddressState,
  ]);

  // ─── Derive PRQ amount/local amount from prefilled qty × cost/unit × ROE ──
  useEffect(() => {
    if (isEditOrViewMode || !prefillFromState?.charges?.length) return;

    let changed = false;
    const nextCharges = form.values.charges.map((charge) => {
      const { amount: calcAmount, amount_in_local: calcLocal } =
        recalculatePrqChargeAmounts(charge);
      const amount = charge.amount ?? calcAmount;
      const amount_in_local =
        charge.amount_in_local ??
        (amount != null && charge.roe != null && charge.roe > 0
          ? clampAmount(amount * charge.roe)
          : calcLocal);

      if (
        amount === charge.amount &&
        amount_in_local === charge.amount_in_local
      ) {
        return charge;
      }

      changed = true;
      return { ...charge, amount, amount_in_local };
    });

    if (changed) {
      form.setFieldValue("charges", nextCharges);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Batch-fetch SAC codes for charges prefilled from location.state ─────
  useEffect(() => {
    if (!prefillFromState?.charges?.length) return;
    const chargesWithIds = prefillFromState.charges
      .map((c, idx) => ({ charge: c, originalIdx: idx }))
      .filter(({ charge }) => charge.charge_id != null);
    if (chargesWithIds.length === 0) return;

    const items = chargesWithIds.map(({ charge }) => ({
      charge_id: charge.charge_id!,
      service_id: jobServiceId as number,
    }));

    fetchGetEffectiveSac(items).then((data) => {
      data.forEach((item, responseIdx) => {
        const originalIdx = chargesWithIds[responseIdx]?.originalIdx;
        if (
          originalIdx !== undefined &&
          item?.sac_code != null &&
          item.sac_code !== ""
        ) {
          form.setFieldValue(`charges.${originalIdx}.tax_code`, item.sac_code);
        }
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Submit ───────────────────────────────────────────────────────────────

  const handleApprove = async () => {
    const validation = form.validate();
    if (validation.hasErrors) return;
    shouldApproveRef.current = true;
    await handleSubmit(form.values);
  };

  const handleReject = async () => {
    const validation = form.validate();
    if (validation.hasErrors) return;
    openRejectModal();
  };

  const confirmReject = async () => {
    closeRejectModal();
    shouldRejectRef.current = true;
    await handleSubmit(form.values);
  };

  /**
   * Approved PRQ one-shot: insert Actual Invoice No + Date once (fapiao-style),
   * then lock those fields.
   */
  const handleUpdateActualInvAfterApproved = async () => {
    if (!canEditActualInvAfterApproved || !saveResponse?.id) {
      ToastNotification({
        message: "Actual invoice details cannot be updated.",
        type: "error",
      });
      return;
    }

    const actualInvNo = String(form.values.actual_invoice_no ?? "").trim();
    const actualInvDate = form.values.actual_invoice_date;
    if (!actualInvNo || actualInvDate == null) {
      ToastNotification({
        message:
          "Both Actual Invoice No and Actual Invoice Date are required.",
        type: "error",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const values = form.values;
      const formatDate = (d: Date | null) => {
        if (!d) return null;
        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = d.getFullYear();
        return `${year}-${month}-${day}`;
      };

      const currencyList = currencyData as Array<{
        id?: number;
        currency_code?: string;
        code?: string;
      }>;
      const mainCurrencyId = currencyList?.find(
        (item) =>
          (item.currency_code ?? item.code ?? "")
            .toString()
            .trim()
            .toUpperCase() ===
          (values.currency ?? "").toString().trim().toUpperCase(),
      )?.id;

      const stateIdNum = values.state_code_1
        ? Number(values.state_code_1)
        : undefined;

      const payload: Record<string, unknown> = {
        id: saveResponse.id,
        job_reference: "",
        crj_number: values.payment_crj_did ?? "",
        approved_by: values.approved_by_1 ?? "",
        approved_date: formatDate(values.approved_date),
        ...resolvePaymentRequestGstPayloadValues(values, branchLocationGstNo),
        date: formatDate(values.date),
        payment_type: values.payment_type ?? "",
        vouchar_type: values.voucher_type ?? "",
        CINV: values.cinv ?? false,
        proforma_inv_no: values.proforma_invoice_no_1 ?? "",
        proforma_inv_date: formatDate(values.proforma_invoice_date),
        actual_inv_no: actualInvNo,
        actual_inv_date: formatDate(actualInvDate),
        account_id:
          values.account_id && Number.isFinite(Number(values.account_id))
            ? Number(values.account_id)
            : undefined,
        ...(values.account_code ? { account_code: values.account_code } : {}),
        amount: formatPaymentRequestPayloadAmount(values.amount) ?? null,
        crj_date: formatDate(values.crj_date),
        paid_to_type: values.paid_to_type ?? "",
        paid_to: values.paid_to ?? "",
        not_over: values.not_over ?? "",
        tds_section_code: values.tds_section_code ?? "",
        account_note: values.accountant_note ?? "",
        note: values.note ?? "",
        rejected_note: values.rejected_note || null,
        on_hold_note: values.on_hold_note || null,
        status: "Approved",
        charges_data: values.charges.map(mapPaymentRequestChargeToPayload),
      };
      if (mainCurrencyId != null && !Number.isNaN(mainCurrencyId)) {
        payload.currency_id = mainCurrencyId;
      }
      if (stateIdNum != null && !Number.isNaN(stateIdNum)) {
        payload.state_id = stateIdNum;
      }

      const rawPut = (await apiCallProtected.put(
        `${(URL as any).paymentRequest}${saveResponse.id}/`,
        buildPaymentRequestFormData(
          payload as Record<string, unknown>,
          supportingDocuments,
        ),
        {
          headers: {
            ...FORM_DATA_HEADERS,
            ...API_HEADER.headers,
          },
        },
      )) as any;

      const d: PaymentRequestFromApi =
        rawPut?.data?.data ?? rawPut?.data ?? rawPut;

      if (d?.actual_inv_no != null) {
        form.setFieldValue("actual_invoice_no", String(d.actual_inv_no));
      }
      if (d?.actual_inv_date != null) {
        form.setFieldValue(
          "actual_invoice_date",
          normalizeDate(d.actual_inv_date),
        );
      }
      setActualInvAlreadySet(true);
      setAuditPatch((prev) => appendEditPageAuditPatch(prev, d));
      setSaveResponse((prev) =>
        prev
          ? {
              ...prev,
              status: d.status ?? prev.status ?? "Approved",
            }
          : prev,
      );

      ToastNotification({
        message: "Actual invoice details updated successfully",
        type: "success",
      });
    } catch (error: unknown) {
      ToastNotification({
        message:
          (error as { message?: string })?.message ??
          "Failed to update actual invoice details",
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCalculateGst = async () => {
    const validation = form.validate();
    if (validation.hasErrors) return;
    setIsSubmitting(true);
    try {
      const values = form.values;
      const formatDate = (d: Date | null) => {
        if (!d) return null;
        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = d.getFullYear();
        return `${year}-${month}-${day}`;
      };

      const currencyList = currencyData as Array<{
        id?: number;
        currency_code?: string;
        code?: string;
      }>;
      const mainCurrencyId = currencyList?.find(
        (item) =>
          (item.currency_code ?? item.code ?? "")
            .toString()
            .trim()
            .toUpperCase() ===
          (values.currency ?? "").toString().trim().toUpperCase(),
      )?.id;

      const stateIdNum = values.state_code_1
        ? Number(values.state_code_1)
        : undefined;

      const payload: Record<string, unknown> = {
        ...(isUpdate ? { id: saveResponse?.id ?? Number(requestId) } : {}),
        job_reference: "",
        crj_number: values.payment_crj_did ?? "",
        approved_by: values.approved_by_1 ?? "",
        approved_date: formatDate(values.approved_date),
        ...resolvePaymentRequestGstPayloadValues(values, branchLocationGstNo),
        date: formatDate(values.date),
        payment_type: values.payment_type ?? "",
        vouchar_type: values.voucher_type ?? "",
        CINV: values.cinv ?? false,
        proforma_inv_no: values.proforma_invoice_no_1 ?? "",
        proforma_inv_date: formatDate(values.proforma_invoice_date),
        actual_inv_no: values.actual_invoice_no ?? "",
        actual_inv_date: formatDate(values.actual_invoice_date),
        account_id:
          values.account_id && Number.isFinite(Number(values.account_id))
            ? Number(values.account_id)
            : undefined,
        ...(values.account_code ? { account_code: values.account_code } : {}),
        amount: formatPaymentRequestPayloadAmount(values.amount) ?? null,
        crj_date: formatDate(values.crj_date),
        paid_to_type: values.paid_to_type ?? "",
        paid_to: values.paid_to ?? "",
        not_over: values.not_over ?? "",
        tds_section_code: values.tds_section_code ?? "",
        account_note: values.accountant_note ?? "",
        note: values.note ?? "",
        rejected_note: values.rejected_note || null,
        on_hold_note: values.on_hold_note || null,
        ...(values.approved ? { status: values.approved } : {}),
        charges_data: values.charges.map(mapPaymentRequestChargeToPayload),
      };
      if (mainCurrencyId != null && !Number.isNaN(mainCurrencyId)) {
        payload.currency_id = mainCurrencyId;
      }
      if (stateIdNum != null && !Number.isNaN(stateIdNum)) {
        payload.state_id = stateIdNum;
      }

      let rawResponse: any = null;
      if (isUpdate) {
        const updateId = saveResponse?.id ?? Number(requestId);
        rawResponse = await apiCallProtected.put(
          `${(URL as any).paymentRequest}${updateId}/`,
          buildPaymentRequestFormData(
            payload as Record<string, unknown>,
            supportingDocuments,
          ),
          {
            headers: {
              ...FORM_DATA_HEADERS,
              ...API_HEADER.headers,
            },
          },
        );
      } else {
        rawResponse = await apiCallProtected.post(
          (URL as any).paymentRequest,
          buildPaymentRequestFormData(
            payload as Record<string, unknown>,
            supportingDocuments,
          ),
          {
            headers: {
              ...FORM_DATA_HEADERS,
              ...API_HEADER.headers,
            },
          },
        );
      }

      const saveData: PaymentRequestFromApi =
        rawResponse?.data?.data ?? rawResponse?.data ?? rawResponse;
      const paymentRequestId =
        saveData?.id != null ? Number(saveData.id) : undefined;
      if (!paymentRequestId || Number.isNaN(paymentRequestId)) {
        throw new Error("Payment request id not found in response.");
      }

      setSaveResponse({
        id: paymentRequestId,
        request_no: saveData.request_no ?? saveResponse?.request_no ?? "",
        status: saveData.status ?? saveResponse?.status,
      });
      if (saveData.request_no) {
        form.setFieldValue("request_no", saveData.request_no);
      }

      const gstBreakupResponse = parsePaymentRequestGstBreakupResponse(
        await postAPICall(
          URL.invoiceCalculateGstBreakup,
          { payment_request_id: paymentRequestId },
          API_HEADER,
        ),
      );

      const sacWiseTotals = Array.isArray(gstBreakupResponse?.sac_wise_totals)
        ? gstBreakupResponse.sac_wise_totals
        : [];
      if (sacWiseTotals.length > 0) {
        const gstCharges: ChargeItem[] = sacWiseTotals.map((item) => {
          const totalAmountRaw = item.total_amount;
          const totalAmount =
            totalAmountRaw !== undefined &&
            totalAmountRaw !== null &&
            String(totalAmountRaw).trim() !== ""
              ? Number(totalAmountRaw)
              : null;
          const roeRaw = item.roe;
          const roeValue =
            roeRaw !== undefined &&
            roeRaw !== null &&
            String(roeRaw).trim() !== ""
              ? Number(roeRaw)
              : 1;
          const currencyCode = String(item.currency_code ?? "").trim();
          const currencyId =
            item.currency_id !== undefined && item.currency_id !== null
              ? String(item.currency_id)
              : "";
          return {
            ...emptyCharge(),
            charge_id:
              item.charge_id !== undefined && item.charge_id !== null
                ? Number(item.charge_id)
                : null,
            charge_code: String(item.charge_code ?? ""),
            charge_name: String(item.charge_name ?? ""),
            job_no: String(item.job_id ?? ""),
            cn_r: String(item.Dr_Cr ?? ""),
            Dr_Cr: normalizeChargeDrCr(item.Dr_Cr),
            currency: currencyCode,
            currency_id: currencyId,
            roe: roeValue,
            amount: totalAmount,
            amount_in_local:
              totalAmount != null ? totalAmount * roeValue : null,
            is_tax_row: true,
          };
        });
        const chargesWithoutTax = form.values.charges.filter(
          (c) => c.is_tax_row !== true,
        );
        form.setFieldValue("charges", [...chargesWithoutTax, ...gstCharges]);
      }

      setGstBreakup(gstBreakupResponse);

      ToastNotification({
        message: "GST calculated successfully",
        type: "success",
      });
    } catch (error: unknown) {
      ToastNotification({
        message:
          (error as { message?: string })?.message ?? "Failed to calculate GST",
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCalculateTds = async () => {
    const validation = form.validate();
    if (validation.hasErrors) return;
    setIsSubmitting(true);
    try {
      const values = form.values;
      const formatDate = (d: Date | null) => {
        if (!d) return null;
        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = d.getFullYear();
        return `${year}-${month}-${day}`;
      };

      const currencyList = currencyData as Array<{
        id?: number;
        currency_code?: string;
        code?: string;
      }>;
      const mainCurrencyId = currencyList?.find(
        (item) =>
          (item.currency_code ?? item.code ?? "")
            .toString()
            .trim()
            .toUpperCase() ===
          (values.currency ?? "").toString().trim().toUpperCase(),
      )?.id;

      const stateIdNum = values.state_code_1
        ? Number(values.state_code_1)
        : undefined;

      const payload: Record<string, unknown> = {
        ...(isUpdate ? { id: saveResponse?.id ?? Number(requestId) } : {}),
        job_reference: "",
        crj_number: values.payment_crj_did ?? "",
        approved_by: values.approved_by_1 ?? "",
        approved_date: formatDate(values.approved_date),
        ...resolvePaymentRequestGstPayloadValues(values, branchLocationGstNo),
        date: formatDate(values.date),
        payment_type: values.payment_type ?? "",
        vouchar_type: values.voucher_type ?? "",
        CINV: values.cinv ?? false,
        proforma_inv_no: values.proforma_invoice_no_1 ?? "",
        proforma_inv_date: formatDate(values.proforma_invoice_date),
        actual_inv_no: values.actual_invoice_no ?? "",
        actual_inv_date: formatDate(values.actual_invoice_date),
        account_id:
          values.account_id && Number.isFinite(Number(values.account_id))
            ? Number(values.account_id)
            : undefined,
        ...(values.account_code ? { account_code: values.account_code } : {}),
        amount: formatPaymentRequestPayloadAmount(values.amount) ?? null,
        crj_date: formatDate(values.crj_date),
        paid_to_type: values.paid_to_type ?? "",
        paid_to: values.paid_to ?? "",
        not_over: values.not_over ?? "",
        tds_section_code: values.tds_section_code ?? "",
        account_note: values.accountant_note ?? "",
        note: values.note ?? "",
        rejected_note: values.rejected_note || null,
        on_hold_note: values.on_hold_note || null,
        ...(values.approved ? { status: values.approved } : {}),
        charges_data: values.charges.map(mapPaymentRequestChargeToPayload),
      };
      if (mainCurrencyId != null && !Number.isNaN(mainCurrencyId)) {
        payload.currency_id = mainCurrencyId;
      }
      if (stateIdNum != null && !Number.isNaN(stateIdNum)) {
        payload.state_id = stateIdNum;
      }

      let rawResponse: unknown = null;
      if (isUpdate) {
        const updateId = saveResponse?.id ?? Number(requestId);
        rawResponse = await apiCallProtected.put(
          `${(URL as any).paymentRequest}${updateId}/`,
          buildPaymentRequestFormData(
            payload as Record<string, unknown>,
            supportingDocuments,
          ),
          {
            headers: {
              ...FORM_DATA_HEADERS,
              ...API_HEADER.headers,
            },
          },
        );
      } else {
        rawResponse = await apiCallProtected.post(
          (URL as any).paymentRequest,
          buildPaymentRequestFormData(
            payload as Record<string, unknown>,
            supportingDocuments,
          ),
          {
            headers: {
              ...FORM_DATA_HEADERS,
              ...API_HEADER.headers,
            },
          },
        );
      }

      const saveData: PaymentRequestFromApi =
        (rawResponse as { data?: { data?: PaymentRequestFromApi } })?.data
          ?.data ??
        (rawResponse as { data?: PaymentRequestFromApi })?.data ??
        (rawResponse as PaymentRequestFromApi);
      const paymentRequestId =
        saveData?.id != null ? Number(saveData.id) : undefined;
      if (!paymentRequestId || Number.isNaN(paymentRequestId)) {
        throw new Error("Payment request id not found in response.");
      }

      setSaveResponse({
        id: paymentRequestId,
        request_no: saveData.request_no ?? saveResponse?.request_no ?? "",
        status: saveData.status ?? saveResponse?.status,
      });

      const res = await postAPICall(
        URL.tdsCalculation,
        { payment_request_id: paymentRequestId },
        API_HEADER,
      );

      const data = unwrapApiStatusBody(res) as Record<string, unknown>;
      const failureMessage = getApiFailureMessage(
        res,
        "TDS calculation failed.",
      );
      if (failureMessage) {
        ToastNotification({
          type: "error",
          message: failureMessage,
        });
        return;
      }

      const rows =
        (data.data as Array<Record<string, unknown>> | undefined) ?? [];

      if (!Array.isArray(rows) || rows.length === 0) {
        ToastNotification({
          type: "error",
          message: "No TDS rows returned from calculation.",
        });
        return;
      }

      const existing = form.values.charges;
      const tdsCharges: ChargeItem[] = rows
        .map((item): ChargeItem | null => {
          const amountRaw = item.amount;
          if (
            amountRaw === undefined ||
            amountRaw === null ||
            String(amountRaw).trim() === ""
          ) {
            return null;
          }
          const amount = Number(amountRaw);
          if (!Number.isFinite(amount)) return null;
          const roeRaw = item.roe;
          const roeValue =
            roeRaw !== undefined &&
            roeRaw !== null &&
            String(roeRaw).trim() !== ""
              ? Number(roeRaw)
              : 1;
          const currencyId =
            item.currency_id !== undefined && item.currency_id !== null
              ? String(item.currency_id)
              : "";
          const currencyCode =
            String(item.currency_code ?? "").trim() ||
            (currencyList?.find((c) => String(c.id ?? "") === currencyId)
              ?.currency_code ??
              currencyList?.find((c) => String(c.id ?? "") === currencyId)
                ?.code ??
              "");
          const drCr = String(
            (item.Dr_cr as unknown) ??
              (item.Dr_Cr as unknown) ??
              (item.dr_cr as unknown) ??
              (item.cr_dr as unknown) ??
              "",
          );
          const roe = Number.isFinite(roeValue) ? roeValue : 1;
          return {
            ...emptyCharge(),
            charge_id:
              item.charge_id !== undefined && item.charge_id !== null
                ? Number(item.charge_id)
                : null,
            charge_name: String(item.charge_name ?? item.account_name ?? ""),
            account_id:
              item.account_id !== undefined && item.account_id !== null
                ? Number(item.account_id)
                : null,
            account_code: String(item.account_code ?? ""),
            account_name: String(item.account_name ?? item.charge_name ?? ""),
            subledger_code: String(item.subledger_code ?? ""),
            narration: String(item.narration ?? ""),
            job_no: String(item.job_id ?? item.job_no ?? ""),
            cn_r: drCr,
            Dr_Cr: normalizeChargeDrCr(drCr),
            currency: String(currencyCode),
            currency_id: currencyId,
            roe,
            amount: clampAmount(amount),
            amount_in_local: clampAmount(amount * roe),
            is_tds_row: true,
          };
        })
        .filter((x): x is ChargeItem => x !== null);

      const deduped = tdsCharges.filter((nr) => {
        return !existing.some(
          (er) =>
            String(er.account_code ?? "") === String(nr.account_code ?? "") &&
            String(er.subledger_code ?? "") ===
              String(nr.subledger_code ?? "") &&
            String(er.charge_name ?? er.account_name ?? "") ===
              String(nr.charge_name ?? nr.account_name ?? "") &&
            Number(er.amount ?? 0) === Number(nr.amount ?? 0) &&
            String(er.cn_r ?? "") === String(nr.cn_r ?? "") &&
            String(er.currency_id ?? "") === String(nr.currency_id ?? ""),
        );
      });

      if (deduped.length > 0) {
        form.setFieldValue("charges", [...existing, ...deduped]);
      }

      ToastNotification({
        message: "TDS calculated successfully",
        type: "success",
      });
    } catch (error: unknown) {
      ToastNotification({
        type: "error",
        message: getServerErrorMessage(error, "TDS calculation failed."),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (values: PaymentRequestFormData) => {
    const isApproveAction = shouldApproveRef.current;
    const isRejectAction = shouldRejectRef.current;
    shouldApproveRef.current = false;
    shouldRejectRef.current = false;
    setIsSubmitting(true);
    try {
      const formatDate = (d: Date | null) => {
        if (!d) return null;
        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = d.getFullYear();
        return `${year}-${month}-${day}`;
      };

      // Resolve billing currency code → numeric id
      const currencyList = currencyData as Array<{
        id?: number;
        currency_code?: string;
        code?: string;
      }>;
      const mainCurrencyId = currencyList?.find(
        (item) =>
          (item.currency_code ?? item.code ?? "")
            .toString()
            .trim()
            .toUpperCase() ===
          (values.currency ?? "").toString().trim().toUpperCase(),
      )?.id;

      const stateIdNum = values.state_code_1
        ? Number(values.state_code_1)
        : undefined;

      const payload: Record<string, unknown> = {
        ...(isUpdate ? { id: saveResponse?.id ?? Number(requestId) } : {}),
        job_reference: "",
        crj_number: values.payment_crj_did ?? "",
        approved_by: values.approved_by_1 ?? "",
        approved_date: formatDate(values.approved_date),
        ...resolvePaymentRequestGstPayloadValues(values, branchLocationGstNo),
        date: formatDate(values.date),
        payment_type: values.payment_type ?? "",
        vouchar_type: values.voucher_type ?? "",
        CINV: values.cinv ?? false,
        proforma_inv_no: values.proforma_invoice_no_1 ?? "",
        proforma_inv_date: formatDate(values.proforma_invoice_date),
        actual_inv_no: values.actual_invoice_no ?? "",
        actual_inv_date: formatDate(values.actual_invoice_date),
        account_id:
          values.account_id && Number.isFinite(Number(values.account_id))
            ? Number(values.account_id)
            : undefined,
        ...(values.account_code ? { account_code: values.account_code } : {}),
        amount: formatPaymentRequestPayloadAmount(values.amount) ?? null,
        crj_date: formatDate(values.crj_date),
        paid_to_type: values.paid_to_type ?? "",
        paid_to: values.paid_to ?? "",
        not_over: values.not_over ?? "",
        tds_section_code: values.tds_section_code ?? "",
        account_note: values.accountant_note ?? "",
        note: values.note ?? "",
        rejected_note: values.rejected_note || null,
        on_hold_note: values.on_hold_note || null,
        // status: isApproveAction ? "Approved" : (values.approved || ""),
        charges_data: values.charges.map(mapPaymentRequestChargeToPayload),
      };

      if (isApproveAction) {
        payload.status = "Approved";
      } else if (isRejectAction) {
        payload.status = "Rejected";
      } else if (values.approved) {
        payload.status = values.approved;
      }
      if (mainCurrencyId != null && !Number.isNaN(mainCurrencyId)) {
        payload.currency_id = mainCurrencyId;
      }
      if (stateIdNum != null && !Number.isNaN(stateIdNum)) {
        payload.state_id = stateIdNum;
      }

      if (isUpdate) {
        // PUT — update existing record (stays on same page)
        const updateId = saveResponse?.id ?? Number(requestId);
        const rawPut = (await apiCallProtected.put(
          `${(URL as any).paymentRequest}${updateId}/`,
          buildPaymentRequestFormData(
            payload as Record<string, unknown>,
            supportingDocuments,
          ),
          {
            headers: {
              ...FORM_DATA_HEADERS,
              ...API_HEADER.headers,
            },
          },
        )) as any;
        if (rawPut) {
          // Handle wrapped response: { status, message, data: {...} } or unwrapped
          const d: PaymentRequestFromApi =
            rawPut?.data?.data ?? rawPut?.data ?? rawPut;

          setSaveResponse((prev) => ({
            ...prev,
            id: d.id ?? prev?.id,
            request_no: d.request_no ?? prev?.request_no ?? "",
            status: d.status ?? prev?.status,
          }));
          setAuditPatch((prev) => appendEditPageAuditPatch(prev, d));

          if (d.request_no) {
            form.setFieldValue("request_no", d.request_no);
          }
          setSupportingDocuments(
            mapApiDocumentsToSupportingDocuments(
              (d as any).documents ?? (d as any).supporting_documents,
            ),
          );

          // Merge returned charge ids back into form
          const resCharges = d.charges;
          if (resCharges && Array.isArray(resCharges)) {
            form.setFieldValue(
              "charges",
              values.charges.map((c, i) => ({
                ...c,
                id: resCharges[i]?.id != null ? Number(resCharges[i].id) : c.id,
              })),
            );
          }
          setActualInvAlreadySet(
            Boolean(
              String(d.actual_inv_no ?? values.actual_invoice_no ?? "").trim() &&
                (normalizeDate(d.actual_inv_date) ??
                  values.actual_invoice_date),
            ),
          );
          ToastNotification({
            message: "Payment request updated successfully",
            type: "success",
          });
          if (isApproveAction || isRejectAction) {
            handlePaymentRequestBack();
          }
        }
      } else {
        // POST — create new record, then switch to edit mode in-place
        const rawResponse = (await apiCallProtected.post(
          (URL as any).paymentRequest,
          buildPaymentRequestFormData(
            payload as Record<string, unknown>,
            supportingDocuments,
          ),
          {
            headers: {
              ...FORM_DATA_HEADERS,
              ...API_HEADER.headers,
            },
          },
        )) as any;
        if (rawResponse) {
          // Handle wrapped response: { status, message, data: {...} } or unwrapped
          const d: PaymentRequestFromApi =
            rawResponse?.data?.data ?? rawResponse?.data ?? rawResponse;

          if (d && d.id) {
            setSaveResponse({
              id: d.id,
              request_no: d.request_no ?? "",
              status: d.status,
            });
            setAuditPatch((prev) => appendEditPageAuditPatch(prev, d));
            setPaymentRequestDataFromApi(d);
            setAccountNameDisplay(
              ((d as any).account_name ?? d.account_code ?? "").toString() ||
                null,
            );
            setSupportingDocuments(
              mapApiDocumentsToSupportingDocuments(
                (d as any).documents ?? (d as any).supporting_documents,
              ),
            );

            // Populate the form with all saved values so the screen is in edit mode
            form.setValues({
              request_no: d.request_no ?? "",
              job_reference_1: d.job_reference ?? "",
              job_reference_2: form.values.job_reference_2,
              payment_crj_did: d.crj_number ?? "",
              date: normalizeDate(d.date) ?? values.date,
              rejected_request_no: form.values.rejected_request_no,
              proforma_invoice_no_1: d.proforma_inv_no ?? "",
              proforma_invoice_no_2: form.values.proforma_invoice_no_2,
              proforma_invoice_date: normalizeDate(d.proforma_inv_date),
              payment_type: normalizePaymentTypeValue(d.payment_type),
              voucher_type: d.vouchar_type ?? "",
              cinv: d.CINV ?? false,
              actual_invoice_no: d.actual_inv_no ?? "",
              actual_invoice_date: normalizeDate(d.actual_inv_date),
              account_id: d.account_id != null ? String(d.account_id) : "",
              account_code: d.account_code ?? "",
              currency: d.currency_code ?? values.currency,
              amount: d.amount != null ? clampAmount(Number(d.amount)) : null,
              crj_date: normalizeDate(d.crj_date),
              paid_to_type: d.paid_to_type ?? "",
              not_over: d.not_over ?? "",
              paid_to: d.paid_to ?? "",
              approved: d.status ?? "",
              state_code_1:
                d.state_id != null ? String(d.state_id) : values.state_code_1,
              state_code_2: form.values.state_code_2,
              approved_by_1: d.approved_by ?? "",
              approved_by_2: form.values.approved_by_2,
              tds_section_code: d.tds_section_code ?? "",
              approved_date: normalizeDate(d.approved_date),
              accountant_note: d.account_note ?? "",
              prepared_by_1: form.values.prepared_by_1,
              prepared_by_2: form.values.prepared_by_2,
              note: d.note ?? "",
              customer_gst_no: d.customer_gst_no ?? "",
              rejected_note: d.rejected_note ?? "",
              on_hold_note: d.on_hold_note ?? "",
              location_gst_no: d.location_gst_no?.trim() || branchLocationGstNo,
              charges:
                d.charges && d.charges.length > 0
                  ? d.charges.map(mapApiChargeToChargeItem)
                  : values.charges,
            });
            setActualInvAlreadySet(
              Boolean(
                String(d.actual_inv_no ?? "").trim() &&
                  normalizeDate(d.actual_inv_date),
              ),
            );
          }

          ToastNotification({
            message: "Payment request saved successfully",
            type: "success",
          });
        }
      }
    } catch (error: unknown) {
      console.error("Error saving payment request:", error);
      ToastNotification({
        message:
          (error as { message?: string })?.message ??
          "Failed to save payment request",
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Populate form when opening edit/view URL ─────────────────────────────
  useEffect(() => {
    if (!isEditOrViewMode || !requestId || !paymentRequestDataFromApi) return;
    const d = paymentRequestDataFromApi;

    setSaveResponse({
      id: d.id,
      request_no: d.request_no ?? "",
      status: d.status,
    });
    setGstBreakup(null);
    setGstBreakupLoading(false);
    const loadedActualNo = String(d.actual_inv_no ?? "").trim();
    const loadedActualDate = normalizeDate(d.actual_inv_date);
    setActualInvAlreadySet(Boolean(loadedActualNo && loadedActualDate));

    setAccountNameDisplay(
      ((d as any).account_name ?? d.account_code ?? "").toString() || null,
    );
    setSupportingDocuments(
      mapApiDocumentsToSupportingDocuments(
        (d as any).documents ?? (d as any).supporting_documents,
      ),
    );

    form.setValues({
      request_no: d.request_no ?? "",
      job_reference_1: d.job_reference ?? "",
      job_reference_2: "",
      payment_crj_did: d.crj_number ?? "",
      date: normalizeDate(d.date) ?? new Date(),
      rejected_request_no: "",
      proforma_invoice_no_1: d.proforma_inv_no ?? "",
      proforma_invoice_no_2: "",
      proforma_invoice_date: normalizeDate(d.proforma_inv_date),
      payment_type: normalizePaymentTypeValue(d.payment_type),
      voucher_type: d.vouchar_type ?? "",
      cinv: d.CINV ?? false,
      actual_invoice_no: d.actual_inv_no ?? "",
      actual_invoice_date: normalizeDate(d.actual_inv_date),
      account_id: d.account_id != null ? String(d.account_id) : "",
      account_code: d.account_code ?? "",
      currency: d.currency_code ?? defaultBranchCurrency,
      amount: d.amount != null ? clampAmount(Number(d.amount)) : null,
      crj_date: normalizeDate(d.crj_date),
      paid_to_type: d.paid_to_type ?? "",
      not_over: d.not_over ?? "",
      paid_to: d.paid_to ?? "",
      approved: d.status ?? "",
      state_code_1: d.state_id != null ? String(d.state_id) : "",
      state_code_2: "",
      approved_by_1: d.approved_by ?? "",
      approved_by_2: "",
      tds_section_code: d.tds_section_code ?? "",
      approved_date: normalizeDate(d.approved_date),
      accountant_note: d.account_note ?? "",
      prepared_by_1: "",
      prepared_by_2: "",
      note: d.note ?? "",
      customer_gst_no: d.customer_gst_no ?? "",
      rejected_note: d.rejected_note ?? "",
      on_hold_note: d.on_hold_note ?? "",
      location_gst_no: d.location_gst_no?.trim() || branchLocationGstNo,
      charges:
        d.charges && d.charges.length > 0
          ? d.charges.map(mapApiChargeToChargeItem)
          : [emptyCharge()],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId, isEditOrViewMode, paymentRequestDataFromApi]);

  const showAuditInfo =
    isEditOrViewMode || Boolean(saveResponse?.id) || Boolean(auditPatch);
  const paymentRequestAuditSource = useMemo(
    () =>
      mergeEditPageAuditSources(
        paymentRequestDataFromApi as Record<string, unknown> | null,
        saveResponse as Record<string, unknown> | null,
        auditPatch,
      ),
    [paymentRequestDataFromApi, saveResponse, auditPatch],
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <Box p="md" style={{ position: "relative" }}>
      {viewAllocationDocsUi}
      {/* Full-page loader overlay when saving or loading edit data */}
      {(isSubmitting || requestFetchLoading) && (
        <Box
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(255,255,255,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <Stack align="center" gap="md">
            <Loader size="lg" color="#105476" />
            <Text size="sm" c="#105476" fw={500}>
              {requestFetchLoading
                ? "Loading payment request..."
                : "Saving payment request..."}
            </Text>
          </Stack>
        </Box>
      )}

      <Stack gap="md">
        {/* ── Page header ── */}
        <Group justify="space-between" mb="xs" wrap="nowrap">
          <EditPageHeadingRow
            visible={showAuditInfo && Boolean(paymentRequestAuditSource)}
            auditSource={paymentRequestAuditSource}
            animateKey={
              (paymentRequestAuditSource as { id?: number })?.id ?? requestId
            }
            ariaLabel="Payment request audit info"
          >
            <Text size="xl" fw={600} c="#105476">
              Payment Request
            </Text>
          </EditPageHeadingRow>
          <Group gap="md" wrap="nowrap">
            {saveResponse && (
              <Group gap="sm" wrap="nowrap">
                {saveResponse.request_no && (
                  <Group gap="xs" wrap="nowrap" align="center">
                    <Text size="sm" fw={500} c="dimmed">
                      Request No
                    </Text>
                    <Badge
                      size="sm"
                      variant="light"
                      color="#105476"
                      styles={{ root: { textTransform: "none" } }}
                    >
                      {saveResponse.request_no}
                    </Badge>
                  </Group>
                )}
                {saveResponse.status && (
                  <Group gap="xs" wrap="nowrap">
                    <Text size="sm" fw={500} c="dimmed">
                      Status:
                    </Text>
                    <Badge
                      size="sm"
                      variant="light"
                      color={
                        saveResponse.status?.toUpperCase() === "APPROVED"
                          ? "green"
                          : saveResponse.status?.toUpperCase() === "REJECTED"
                            ? "red"
                            : "gray"
                      }
                      styles={{ root: { textTransform: "none" } }}
                    >
                      {saveResponse.status?.toUpperCase()}
                    </Badge>
                  </Group>
                )}
              </Group>
            )}
            <Button
              variant="outline"
              color="#105476"
              leftSection={<IconArrowLeft size={16} />}
              onClick={handlePaymentRequestBack}
            >
              Back
            </Button>
            <Menu shadow="md" width={220} position="bottom-end">
              <Menu.Target>
                <ActionIcon
                  variant="subtle"
                  color="#105476"
                  size="lg"
                  styles={{
                    root: {
                      fontFamily: "Inter",
                      fontSize: "13px",
                      border: "1px solid #E9ECEF",
                      borderRadius: "8px",
                      "&:hover": {
                        backgroundColor: "#F8F9FA",
                      },
                    },
                  }}
                >
                  <IconDotsVertical size={18} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown
                styles={{
                  dropdown: {
                    border: "1px solid #E9ECEF",
                    borderRadius: "8px",
                    padding: "8px",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
                  },
                }}
              >
                <Menu.Item
                  disabled={formFieldsReadOnly}
                  leftSection={
                    <Box
                      style={{
                        backgroundColor: "#E7F5FF",
                        borderRadius: "6px",
                        padding: "6px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <IconFileInvoice size={16} color="#105476" />
                    </Box>
                  }
                  styles={{
                    item: {
                      fontFamily: "Inter",
                      fontSize: "13px",
                      fontWeight: 500,
                      borderRadius: "6px",
                      padding: "10px 12px",
                      marginBottom: "4px",
                      "&:hover": {
                        backgroundColor: "#F8F9FA",
                      },
                    },
                    itemLabel: {
                      fontFamily: "Inter",
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#424242",
                    },
                  }}
                >
                  Get OBL Charges
                </Menu.Item>
                <Menu.Item
                  disabled={formFieldsReadOnly}
                  leftSection={
                    <Box
                      style={{
                        backgroundColor: "#E7F5FF",
                        borderRadius: "6px",
                        padding: "6px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <IconFileInvoice size={16} color="#105476" />
                    </Box>
                  }
                  styles={{
                    item: {
                      fontFamily: "Inter",
                      fontSize: "13px",
                      fontWeight: 500,
                      borderRadius: "6px",
                      padding: "10px 12px",
                      marginBottom: "4px",
                      "&:hover": {
                        backgroundColor: "#F8F9FA",
                      },
                    },
                    itemLabel: {
                      fontFamily: "Inter",
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#424242",
                    },
                  }}
                >
                  Get Carrier Rate
                </Menu.Item>
                <Menu.Item
                  disabled={formFieldsReadOnly}
                  leftSection={
                    <Box
                      style={{
                        backgroundColor: "#E7F5FF",
                        borderRadius: "6px",
                        padding: "6px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <IconFileInvoice size={16} color="#105476" />
                    </Box>
                  }
                  styles={{
                    item: {
                      fontFamily: "Inter",
                      fontSize: "13px",
                      fontWeight: 500,
                      borderRadius: "6px",
                      padding: "10px 12px",
                      marginBottom: "4px",
                      "&:hover": {
                        backgroundColor: "#F8F9FA",
                      },
                    },
                    itemLabel: {
                      fontFamily: "Inter",
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#424242",
                    },
                  }}
                >
                  Get Default Cost
                </Menu.Item>
                <Menu.Item
                  disabled={formFieldsReadOnly}
                  leftSection={
                    <Box
                      style={{
                        backgroundColor: "#E7F5FF",
                        borderRadius: "6px",
                        padding: "6px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <IconFileInvoice size={16} color="#105476" />
                    </Box>
                  }
                  styles={{
                    item: {
                      fontFamily: "Inter",
                      fontSize: "13px",
                      fontWeight: 500,
                      borderRadius: "6px",
                      padding: "10px 12px",
                      marginBottom: "4px",
                      "&:hover": {
                        backgroundColor: "#F8F9FA",
                      },
                    },
                    itemLabel: {
                      fontFamily: "Inter",
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#424242",
                    },
                  }}
                >
                  Get Cost From Tariff
                </Menu.Item>
                <Menu.Item
                  disabled={formFieldsReadOnly}
                  leftSection={
                    <Box
                      style={{
                        backgroundColor: "#E7F5FF",
                        borderRadius: "6px",
                        padding: "6px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <IconFileInvoice size={16} color="#105476" />
                    </Box>
                  }
                  styles={{
                    item: {
                      fontFamily: "Inter",
                      fontSize: "13px",
                      fontWeight: 500,
                      borderRadius: "6px",
                      padding: "10px 12px",
                      "&:hover": {
                        backgroundColor: "#F8F9FA",
                      },
                    },
                    itemLabel: {
                      fontFamily: "Inter",
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#424242",
                    },
                  }}
                >
                  Get Provisional Cost
                </Menu.Item>
                <Menu.Item
                  leftSection={
                    <Box
                      style={{
                        backgroundColor: "#E7F5FF",
                        borderRadius: "6px",
                        padding: "6px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <IconListDetails size={16} color="#105476" />
                    </Box>
                  }
                  disabled={!String(saveResponse?.request_no ?? "").trim()}
                  onClick={() =>
                    void openViewAllocationDocs(
                      String(saveResponse?.request_no ?? ""),
                    )
                  }
                  styles={{
                    item: {
                      fontFamily: "Inter",
                      fontSize: "13px",
                      fontWeight: 500,
                      borderRadius: "6px",
                      padding: "10px 12px",
                      "&:hover": {
                        backgroundColor: "#F8F9FA",
                      },
                    },
                    itemLabel: {
                      fontFamily: "Inter",
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#424242",
                    },
                  }}
                >
                  View allocation docs
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>

        {/* ── Form ── */}
        <Box
          component="form"
          onSubmit={
            formFieldsReadOnly
              ? (e) => e.preventDefault()
              : form.onSubmit(handleSubmit)
          }
          style={
            isReadOnly
              ? {
                  opacity: 0.92,
                  backgroundColor: "#f5f5f5",
                  borderRadius: 8,
                  padding: 16,
                }
              : undefined
          }
        >
          <Grid columns={12} gutter="md">
            {/* ── Row 1 (3+3+3+3): Date | Payment Type | Voucher Type | CINV ── */}
            <Grid.Col span={2}>
              <SingleDateInput
                label="Date"
                placeholder="Select date"
                value={normalizeDate(form.values.date)}
                onChange={(date) => form.setFieldValue("date", date)}
                withAsterisk
                readOnly={formFieldsReadOnly}
                error={
                  form.errors.date
                    ? typeof form.errors.date === "string"
                      ? form.errors.date
                      : String(form.errors.date)
                    : undefined
                }
              />
            </Grid.Col>

            <Grid.Col span={2}>
              <Dropdown
                label="Payment Type"
                placeholder="Select payment type"
                data={PAYMENT_TYPE_OPTIONS}
                value={form.values.payment_type || null}
                onChange={(value) =>
                  form.setFieldValue("payment_type", value ?? "")
                }
                withAsterisk
                readOnly={formFieldsReadOnly}
                error={form.errors.payment_type}
                styles={inputStyles}
              />
            </Grid.Col>

            <Grid.Col span={2}>
              <Dropdown
                label="Voucher Type"
                placeholder="Select voucher type"
                data={VOUCHER_TYPE_OPTIONS}
                value={form.values.voucher_type || null}
                onChange={(value) =>
                  form.setFieldValue("voucher_type", value ?? "")
                }
                readOnly={formFieldsReadOnly}
                styles={inputStyles}
              />
            </Grid.Col>

            <Grid.Col span={2}>
              <TextInput
                label="Proforma Invoice No."
                placeholder="Enter proforma invoice no"
                value={form.values.proforma_invoice_no_1}
                onChange={(e) =>
                  form.setFieldValue("proforma_invoice_no_1", e.target.value)
                }
                readOnly={formFieldsReadOnly}
                styles={inputStyles}
              />
            </Grid.Col>

            <Grid.Col span={2}>
              <SingleDateInput
                label="Proforma Invoice Date"
                placeholder="Select date"
                value={normalizeDate(form.values.proforma_invoice_date)}
                onChange={(date) =>
                  form.setFieldValue("proforma_invoice_date", date)
                }
                readOnly={formFieldsReadOnly}
              />
            </Grid.Col>

            <Grid.Col span={2}>
              <TextInput
                label="Actual Invoice No."
                placeholder="Enter actual invoice no"
                value={form.values.actual_invoice_no}
                onChange={(e) =>
                  form.setFieldValue("actual_invoice_no", e.target.value)
                }
                readOnly={actualInvFieldReadOnly}
                styles={
                  canEditActualInvAfterApproved ? inputStyles : undefined
                }
              />
            </Grid.Col>

            <Grid.Col span={2}>
              <SingleDateInput
                label="Actual Invoice Date"
                placeholder="Select date"
                value={normalizeDate(form.values.actual_invoice_date)}
                onChange={(date) =>
                  form.setFieldValue("actual_invoice_date", date)
                }
                readOnly={actualInvFieldReadOnly}
                styles={
                  canEditActualInvAfterApproved ? inputStyles : undefined
                }
              />
            </Grid.Col>
            {/* ── Row 2 (6+6): Proforma Invoice No | Actual Invoice No ── */}
            {/* <Grid.Col span={6}>
              <TextInput
                label="Proforma Invoice No"
                placeholder="Enter proforma invoice no"
                value={form.values.proforma_invoice_no_1}
                onChange={(e) =>
                  form.setFieldValue("proforma_invoice_no_1", e.target.value)
                }
                readOnly={formFieldsReadOnly}
                styles={inputStyles}
              />
            </Grid.Col> */}

            {/* ── Row 3 (2+2+2+2+4): Account Code | Subledger Code | Currency | Amount | CRJ Date ── */}
            <Grid.Col span={2}>
              <Dropdown
                label="Paid To Type"
                placeholder="Select paid to type"
                data={PAID_TO_TYPE_OPTIONS}
                value={form.values.paid_to_type || null}
                onChange={(value) => {
                  form.setFieldValue("paid_to_type", value ?? "");
                  // Reset account selection when type changes to avoid mismatch.
                  form.setFieldValue("account_id", "");
                  form.setFieldValue("account_code", "");
                  form.setFieldValue("customer_gst_no", "");
                  if (branchLocationGstNo) {
                    form.setFieldValue("location_gst_no", branchLocationGstNo);
                  }
                  form.setFieldValue("paid_to", "");
                  setAccountNameDisplay(null);
                  setPartyAddresses([]);
                }}
                readOnly={formFieldsReadOnly}
                styles={inputStyles}
              />
            </Grid.Col>

            <Grid.Col span={2}>
              <SearchableSelect
                label="Party Name"
                placeholder={
                  form.values.paid_to_type
                    ? "Type to search party name"
                    : "Select paid to type first"
                }
                apiEndpoint={
                  resolveAccountNameEndpointByPaidToType(
                    form.values.paid_to_type,
                  ) || undefined
                }
                postBody={
                  form.values.paid_to_type?.trim().toLowerCase() === "supplier"
                    ? supplierAccountNameSearchBody
                    : undefined
                }
                searchFields={["customer_name", "customer_code", "id"]}
                displayFormat={(item: Record<string, unknown>) => ({
                  value: String(item.id ?? item.customer_code ?? ""),
                  label: String(
                    item.customer_name ??
                      item.name ??
                      item.account_name ??
                      item.customer_code ??
                      "",
                  ),
                })}
                value={form.values.account_id || null}
                displayValue={
                  String(form.values.paid_to ?? "").trim() || undefined
                }
                returnOriginalData
                onChange={(value, selectedData, originalData) => {
                  form.setFieldValue("account_id", value ?? "");
                  const selectedAccountName = selectedData?.label ?? "";
                  setAccountNameDisplay(selectedAccountName || null);
                  const nextAccountCode = String(
                    (originalData as any)?.customer_code ??
                      (originalData as any)?.account_code ??
                      (originalData as any)?.code ??
                      "",
                  ).trim();
                  form.setFieldValue(
                    "account_code",
                    value && nextAccountCode ? nextAccountCode : "",
                  );
                  // Auto-fill Paid To from selected account name; user can edit later.
                  form.setFieldValue("paid_to", selectedAccountName);

                  const addresses = (originalData as any)?.addresses_data as
                    PartyAddressLike[] | undefined;

                  if (!value) {
                    form.setFieldValue("customer_gst_no", "");
                    form.setFieldValue("state_code_1", "");
                    form.setFieldValue("tds_section_code", "");
                    setPartyAddresses([]);
                    return;
                  }

                  setPartyAddresses(Array.isArray(addresses) ? addresses : []);

                  form.setFieldValue(
                    "customer_gst_no",
                    getPartyGstFromPrimaryAddress(addresses),
                  );
                  form.clearFieldError("customer_gst_no");
                  form.setFieldValue("location_gst_no", branchLocationGstNo);
                  form.setFieldValue(
                    "tds_section_code",
                    resolvePartyTdsSectionCode(
                      extractPartyTdsSectionsFromRecord(originalData),
                      tdsSectionOptions,
                    ),
                  );

                  applyPartyAddressState(findPrimaryPartyAddress(addresses));
                }}
                minSearchLength={3}
                dropdownZIndex={chargesDropdownZIndex}
                disabled={!form.values.paid_to_type || formFieldsReadOnly}
                readOnly={formFieldsReadOnly}
                styles={inputStyles}
              />
            </Grid.Col>

            <Grid.Col span={2}>
              <Dropdown
                label="State"
                placeholder={isStateLoading ? "Loading..." : "Select state"}
                data={stateOptions}
                value={form.values.state_code_1 || null}
                onChange={(v) => form.setFieldValue("state_code_1", v ?? "")}
                searchable
                disabled={isStateLoading || formFieldsReadOnly}
                styles={inputStyles}
              />
            </Grid.Col>

            {isIndiaUser ? (
              <Grid.Col span={2}>
                <Dropdown
                  label="TDS Section Code"
                  placeholder={
                    isTdsSectionLoading ? "Loading..." : "Select TDS section"
                  }
                  data={tdsSectionOptions}
                  value={form.values.tds_section_code || null}
                  onChange={(v) =>
                    form.setFieldValue("tds_section_code", v ?? "")
                  }
                  searchable
                  clearable
                  disabled={
                    isTdsSectionLoading || formFieldsReadOnly || !isPaidToSelected
                  }
                  styles={inputStyles}
                />
              </Grid.Col>
            ) : null}

            <Grid.Col span={1}>
              <Dropdown
                key={`currency-${form.values.currency}`}
                label="Currency"
                placeholder="Select currency"
                data={billingCurrencyOptions}
                value={form.values.currency || null}
                onChange={(value) =>
                  form.setFieldValue("currency", value ?? "")
                }
                searchable
                readOnly={isCurrencyLoading || formFieldsReadOnly}
                styles={inputStyles}
              />
            </Grid.Col>

            {/* <Grid.Col span={2}>
              <NumberInput
                label="Amount"
                placeholder="Enter amount"
                value={form.values.amount ?? undefined}
                onChange={(value) =>
                  form.setFieldValue("amount", (value as number) ?? null)
                }
                min={0}
                decimalScale={2}
                hideControls
                readOnly={formFieldsReadOnly}
                styles={inputStyles}
              />
            </Grid.Col> */}

            <Grid.Col span={2}>
              <SingleDateInput
                label="CRJ Date"
                placeholder="Select CRJ date"
                value={normalizeDate(form.values.crj_date)}
                onChange={(date) => form.setFieldValue("crj_date", date)}
                readOnly={formFieldsReadOnly}
              />
            </Grid.Col>
            <Grid.Col span={2}>
              <TextInput
                label="Paid To"
                placeholder="Enter paid to"
                withAsterisk
                value={form.values.paid_to}
                onChange={(e) => {
                  form.setFieldValue("paid_to", e.target.value);
                  if (form.errors.paid_to) form.clearFieldError("paid_to");
                }}
                readOnly={formFieldsReadOnly}
                error={
                  form.errors.paid_to ? String(form.errors.paid_to) : undefined
                }
                styles={inputStyles}
              />
            </Grid.Col>

            {/* ── Row 4 (2+4+2+2+2): Paid To Type | Paid To | Not Over | Approved | (spacer) ── */}

            <Grid.Col span={2}>
              <Dropdown
                label="Not Over"
                placeholder="Select"
                data={[
                  { value: "30", label: "30 Days" },
                  { value: "60", label: "60 Days" },
                  { value: "90", label: "90 Days" },
                  { value: "120", label: "120 Days" },
                ]}
                value={form.values.not_over || null}
                onChange={(value) =>
                  form.setFieldValue("not_over", value ?? "")
                }
                readOnly={formFieldsReadOnly}
                styles={inputStyles}
              />
            </Grid.Col>

            {/* <Grid.Col span={2}>
              <Dropdown
                label="Approved"
                placeholder="Select approved"
                data={APPROVED_OPTIONS}
                value={form.values.approved || null}
                onChange={(value) =>
                  form.setFieldValue("approved", value ?? "")
                }
                readOnly={formFieldsReadOnly}
                styles={inputStyles}
              />
            </Grid.Col> */}

            {/* ── Notes ── */}
            <Grid.Col span={2}>
              <Textarea
                label="Accountant Note"
                placeholder="Enter accountant note"
                value={form.values.accountant_note}
                onChange={(e) =>
                  form.setFieldValue("accountant_note", e.target.value)
                }
                readOnly={formFieldsReadOnly}
                rows={3}
                styles={textareaStyles}
              />
            </Grid.Col>

            <Grid.Col span={2}>
              <Textarea
                label="Note"
                placeholder="Enter note"
                value={form.values.note}
                onChange={(e) => form.setFieldValue("note", e.target.value)}
                readOnly={formFieldsReadOnly}
                rows={3}
                styles={textareaStyles}
              />
            </Grid.Col>

            {/* Rejected Note is now collected via the rejection modal.
               On Hold Note is not needed for now.
            {saveResponse?.id ? (
              <>
                <Grid.Col span={3}>
                  <Textarea
                    label="Rejected Note"
                    placeholder="Enter rejected note"
                    value={form.values.rejected_note}
                    onChange={(e) =>
                      form.setFieldValue("rejected_note", e.target.value)
                    }
                    readOnly={formFieldsReadOnly}
                    rows={3}
                    styles={textareaStyles}
                  />
                </Grid.Col>

                <Grid.Col span={3}>
                  <Textarea
                    label="On Hold Note"
                    placeholder="Enter on hold note"
                    value={form.values.on_hold_note}
                    onChange={(e) =>
                      form.setFieldValue("on_hold_note", e.target.value)
                    }
                    readOnly={formFieldsReadOnly}
                    rows={3}
                    styles={textareaStyles}
                  />
                </Grid.Col>
              </>
            ) : null} */}
          </Grid>

          <Group
            justify="space-between"
            align="flex-start"
            mt="md"
            mb="sm"
            wrap="nowrap"
          >
            <Group gap="lg" align="center" wrap="nowrap" style={{ flexShrink: 0 }}>
              <Group gap={6} align="center" wrap="nowrap">
                <Text size="sm" fw={600} c="#105476" style={{ fontFamily: "Inter", whiteSpace: "nowrap" }}>
                  Vendor GSTN
                  {isIndiaUser ? (
                    <Text component="span" c="red">{" "}*</Text>
                  ) : null}
                  :
                </Text>
                {partyGstOptions.length > 1 ? (
                  <Dropdown
                    placeholder="Select GSTN"
                    data={partyGstOptions.map((option) => ({
                      value: option.value,
                      label: option.value,
                    }))}
                    value={form.values.customer_gst_no || null}
                    onChange={(gst) => {
                      if (!gst) return;
                      form.setFieldValue("customer_gst_no", gst);
                      form.clearFieldError("customer_gst_no");
                      applyPartyAddressState(
                        findPartyAddressByGst(partyAddresses, gst),
                      );
                    }}
                    disabled={formFieldsReadOnly}
                    searchable
                    dropdownZIndex={chargesDropdownZIndex}
                    styles={{
                      ...inputStyles,
                      root: { minWidth: 200 },
                    }}
                    error={form.errors.customer_gst_no}
                  />
                ) : (
                  <Text size="sm" style={{ fontFamily: "Inter" }}>
                    {formatReferenceDisplayValue(form.values.customer_gst_no)}
                  </Text>
                )}
                {partyGstOptions.length <= 1 && form.errors.customer_gst_no ? (
                  <Text size="xs" c="red" style={{ whiteSpace: "nowrap" }}>
                    {form.errors.customer_gst_no}
                  </Text>
                ) : null}
              </Group>
              <Group gap={6} align="center" wrap="nowrap">
                <Text size="sm" fw={600} c="#105476" style={{ fontFamily: "Inter", whiteSpace: "nowrap" }}>
                  Location GSTN
                  {isIndiaUser ? (
                    <Text component="span" c="red">{" "}*</Text>
                  ) : null}
                  :
                </Text>
                <Text size="sm" style={{ fontFamily: "Inter" }}>
                  {formatReferenceDisplayValue(resolvedLocationGstNo)}
                </Text>
                {form.errors.location_gst_no ? (
                  <Text size="xs" c="red" style={{ whiteSpace: "nowrap" }}>
                    {form.errors.location_gst_no}
                  </Text>
                ) : null}
              </Group>
            </Group>
            <Group justify="flex-end" style={{ flexShrink: 0 }}>
              <Button
                type="button"
                variant="light"
                color="#105476"
                size="sm"
                onClick={handleCalculateGst}
                loading={isSubmitting}
                disabled={formFieldsReadOnly}
              >
                Calculate GST
              </Button>
              {isIndiaUser &&
              String(form.values.tds_section_code ?? "").trim() !== "" ? (
                <Button
                  type="button"
                  variant="light"
                  color="#105476"
                  size="sm"
                  onClick={handleCalculateTds}
                  loading={isSubmitting}
                  disabled={formFieldsReadOnly || !isPaidToSelected}
                >
                  Calculate TDS
                </Button>
              ) : null}
            </Group>
          </Group>

          {/* ── Charges Section ── */}
          <Box mt="md">
            <Tabs
              variant="default"
              color="#105476"
              value={chargesTabActive}
              onChange={(v) => setChargesTabActive(v ?? "charges")}
              defaultValue="charges"
            >
              {saveResponse && showTaxTab && (
                <Tabs.List>
                  <Tabs.Tab value="charges">Charges</Tabs.Tab>
                  <Tabs.Tab value="tax">Tax</Tabs.Tab>
                </Tabs.List>
              )}

              <Tabs.Panel value="charges">
                <Box>
                  {/* Charges header row (sticky) */}
                  <Grid
                    w="100%"
                    py="sm"
                    mb="sm"
                    gutter="xs"
                    style={{
                      flexWrap: "nowrap",
                      position: "sticky",
                      top: 45,
                      zIndex: 2,
                      backgroundColor: "white",
                      fontWeight: 600,
                      color: "#105476",
                    }}
                  >
                    <Grid.Col span={0.4} style={{ fontSize: "13px" }}>
                      SNo
                    </Grid.Col>
                    {/* <Grid.Col span={0.5} style={{ fontSize: "13px" }}>
                Seg
              </Grid.Col> */}
                    <Grid.Col span={formFieldsReadOnly ? 1.76 : 1.48} style={{ fontSize: "13px" }}>
                      Job Id
                    </Grid.Col>
                    {/* <Grid.Col span={0.6} style={{ fontSize: "13px" }}>
                Subjob
              </Grid.Col>
              <Grid.Col span={0.6} style={{ fontSize: "13px" }}>
                C/N/R
              </Grid.Col> */}
                    <Grid.Col span={1.2} style={{ fontSize: "13px" }}>
                      Charge
                    </Grid.Col>
                    <Grid.Col span={1.1} style={{ fontSize: "13px" }}>
                      Account Name
                    </Grid.Col>
                    <Grid.Col span={0.75} style={{ fontSize: "13px" }}>
                      Subledger
                    </Grid.Col>
                    <Grid.Col span={0.7} style={{ fontSize: "13px" }}>
                      Currency
                    </Grid.Col>
                    <Grid.Col span={0.6} style={{ fontSize: "13px" }}>
                      ROE
                    </Grid.Col>
                    <Grid.Col span={0.7} style={{ fontSize: "13px" }}>
                      Unit
                    </Grid.Col>
                    <Grid.Col span={0.8} style={{ fontSize: "13px" }}>
                      No of Unit
                    </Grid.Col>
                    <Grid.Col span={0.8} style={{ fontSize: "13px" }}>
                      Amt/Unit
                    </Grid.Col>
                    <Grid.Col span={0.85} style={{ fontSize: "13px" }}>
                      Amount
                    </Grid.Col>
                    <Grid.Col span={0.85} style={{ fontSize: "13px" }}>
                      Local Amt
                    </Grid.Col>
                    <Grid.Col span={1} style={{ fontSize: "13px" }}>
                      SAC Code
                    </Grid.Col>
                    {/* <Grid.Col span={0.5} style={{ fontSize: "13px" }}>
                Tax
              </Grid.Col> */}
                    {!formFieldsReadOnly && (
                      <Grid.Col
                        span={0.77}
                        style={{
                          fontSize: "13px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "flex-start",
                          paddingLeft: 2,
                        }}
                      >
                        Actions
                      </Grid.Col>
                    )}
                  </Grid>

                  {/* Charge rows */}
                  {form.values.charges.map((charge, index) => (
                    <Grid
                      key={index}
                      w="100%"
                      gutter="xs"
                      mt={index !== 0 ? "sm" : "xs"}
                      style={{ flexWrap: "nowrap" }}
                    >
                      {/* SNo */}
                      <Grid.Col span={0.4}>
                        <TextInput
                          value={String(index + 1)}
                          readOnly
                          styles={{
                            input: {
                              fontSize: "13px",
                              fontFamily: "Inter",
                              height: "36px",
                              backgroundColor: "var(--mantine-color-gray-0)",
                              textAlign: "center",
                            },
                          }}
                        />
                      </Grid.Col>

                      {/* Seg */}
                      {/* <Grid.Col span={0.5}>
                  <TextInput
                    placeholder="Seg"
                    value={charge.segment}
                    onChange={(e) =>
                      form.setFieldValue(
                        `charges.${index}.segment`,
                        e.target.value,
                      )
                    }
                    readOnly={formFieldsReadOnly}
                    styles={{
                      input: {
                        fontSize: "13px",
                        fontFamily: "Inter",
                        height: "36px",
                      },
                    }}
                  />
                </Grid.Col> */}

                      {/* Job No */}
                      <Grid.Col span={formFieldsReadOnly ? 1.76 : 1.48}>
                        {isJobChargesPrefillFlow ? (
                          <Dropdown
                            placeholder="Select job id"
                            data={prefillJobOptions}
                            value={charge.job_no || null}
                            onChange={(value) =>
                              form.setFieldValue(
                                `charges.${index}.job_no`,
                                value ?? "",
                              )
                            }
                            searchable
                            readOnly={formFieldsReadOnly}
                            styles={{
                              input: {
                                fontSize: "13px",
                                fontFamily: "Inter",
                                height: "36px",
                              },
                            }}
                          />
                        ) : (
                          <SearchableSelect
                            placeholder="Search by job id"
                            apiEndpoint={URL.filterJobCreate}
                            value={charge.job_no || null}
                            displayValue={charge.job_no || undefined}
                            minSearchLength={1}
                            searchFields={["shipment_id", "job_id", "type"]}
                            displayFormat={jobCreateDropdownDisplayFormat}
                            readOnly={formFieldsReadOnly}
                            dropdownZIndex={chargesDropdownZIndex}
                            onChange={(value) =>
                              form.setFieldValue(
                                `charges.${index}.job_no`,
                                String(value ?? "").trim(),
                              )
                            }
                            styles={{
                              input: {
                                fontSize: "13px",
                                fontFamily: "Inter",
                                height: "36px",
                              },
                            }}
                          />
                        )}
                      </Grid.Col>

                      {/* Subjob */}
                      {/* <Grid.Col span={0.6}>
                  <TextInput
                    placeholder="Subjob"
                    value={charge.sub_job}
                    onChange={(e) =>
                      form.setFieldValue(
                        `charges.${index}.sub_job`,
                        e.target.value,
                      )
                    }
                    readOnly={formFieldsReadOnly}
                    styles={{
                      input: {
                        fontSize: "13px",
                        fontFamily: "Inter",
                        height: "36px",
                      },
                    }}
                  />
                </Grid.Col> */}

                      {/* C/N/R */}
                      {/* <Grid.Col span={0.6}>
                  <Dropdown
                    placeholder="C/N/R"
                    data={CN_R_OPTIONS}
                    value={charge.cn_r || null}
                    readOnly={formFieldsReadOnly}
                    onChange={(value) =>
                      form.setFieldValue(
                        `charges.${index}.cn_r`,
                        value ?? "",
                      )
                    }
                    styles={{
                      input: {
                        fontSize: "13px",
                        fontFamily: "Inter",
                        height: "36px",
                      },
                    }}
                  />
                </Grid.Col> */}

                      {/* Charge */}
                      <Grid.Col span={1.2}>
                        <SearchableSelect
                          placeholder="Search charge"
                          apiEndpoint={(URL as any).chargeMaster}
                          searchFields={["charge_name", "charge_code"]}
                          displayFormat={(item: Record<string, unknown>) => {
                            const name = String(item.charge_name ?? "");
                            const code = String(item.charge_code ?? "").trim();
                            return {
                              value: String(item.id ?? ""),
                              label: formatChargeNameWithCode(name, code) || name,
                            };
                          }}
                          value={
                            charge.charge_id != null
                              ? String(charge.charge_id)
                              : null
                          }
                          displayValue={
                            formatChargeNameWithCode(
                              charge.charge_name,
                              charge.charge_code,
                            ) || undefined
                          }
                          returnOriginalData
                          onChange={(value, _selectedData, originalData) => {
                            const chargeId = value ? Number(value) : null;
                            const chargeCode = String(
                              originalData?.charge_code ?? "",
                            ).trim();
                            const chargeName = String(
                              originalData?.charge_name ?? "",
                            ).trim();
                            form.setFieldValue(
                              `charges.${index}.charge_id`,
                              chargeId,
                            );
                            form.setFieldValue(
                              `charges.${index}.charge_name`,
                              chargeName,
                            );
                            form.setFieldValue(
                              `charges.${index}.charge_code`,
                              chargeId != null ? chargeCode : "",
                            );
                            form.setFieldValue(`charges.${index}.tax_code`, "");
                            if (chargeErrors[index]?.charge_name) {
                              const newErrors = { ...chargeErrors };
                              if (newErrors[index]) {
                                delete newErrors[index].charge_name;
                                if (
                                  Object.keys(newErrors[index]).length === 0
                                ) {
                                  delete newErrors[index];
                                }
                              }
                              setChargeErrors(newErrors);
                            }
                            // Auto-fetch SAC code whenever a charge is selected/changed
                            if (chargeId != null) {
                              setSacCodeLoadingByIndex((prev) => ({
                                ...prev,
                                [index]: true,
                              }));
                              fetchGetEffectiveSac([
                                {
                                  charge_id: chargeId,
                                  service_id: jobServiceId ?? 0,
                                },
                              ])
                                .then((data) => {
                                  const item = data[0];
                                  if (
                                    item?.sac_code != null &&
                                    item.sac_code !== ""
                                  ) {
                                    form.setFieldValue(
                                      `charges.${index}.tax_code`,
                                      item.sac_code,
                                    );
                                  }
                                })
                                .finally(() => {
                                  setSacCodeLoadingByIndex((prev) => ({
                                    ...prev,
                                    [index]: false,
                                  }));
                                });
                            }
                          }}
                          withAsterisk
                          readOnly={formFieldsReadOnly}
                          error={chargeErrors[index]?.charge_name}
                          minSearchLength={2}
                          dropdownZIndex={chargesDropdownZIndex}
                          styles={{
                            input: {
                              fontSize: "13px",
                              fontFamily: "Inter",
                              height: "36px",
                            },
                          }}
                        />
                      </Grid.Col>

                      {/* Account Name */}
                      <Grid.Col span={1.1}>
                        <SearchableSelect
                          placeholder="Search by account name"
                          apiEndpoint={URL.chartOfAccounts}
                          value={
                            charge.account_id != null
                              ? String(charge.account_id)
                              : null
                          }
                          dropdownZIndex={chargesDropdownZIndex}
                          minSearchLength={1}
                          searchFields={[
                            "gl_name",
                            "gl_account_code",
                            "account_name",
                            "id",
                          ]}
                          displayFormat={(item: Record<string, unknown>) => {
                            const id = String(item.id ?? "").trim();
                            const glName = String(item.gl_name ?? "").trim();
                            const gl = String(
                              item.gl_account_code ?? "",
                            ).trim();
                            const name = String(item.account_name ?? "").trim();
                            return {
                              value: id,
                              label: [name, gl, glName]
                                .filter(Boolean)
                                .join(" - "),
                            };
                          }}
                          displayValue={
                            charge.account_name
                              ? `${charge.account_name}${
                                  charge.account_code
                                    ? ` - ${charge.account_code}`
                                    : ""
                                }`
                              : charge.account_code || undefined
                          }
                          returnOriginalData
                          onChange={(value, _selectedData, originalData) => {
                            if (!value || !originalData) {
                              form.setFieldValue(
                                `charges.${index}.account_id`,
                                null,
                              );
                              form.setFieldValue(
                                `charges.${index}.account_code`,
                                "",
                              );
                              form.setFieldValue(
                                `charges.${index}.subledger_code`,
                                "",
                              );
                              form.setFieldValue(
                                `charges.${index}.account_name`,
                                "",
                              );
                              return;
                            }
                            form.setFieldValue(
                              `charges.${index}.account_id`,
                              Number.isFinite(Number(value))
                                ? Number(value)
                                : null,
                            );
                            form.setFieldValue(
                              `charges.${index}.account_code`,
                              originalData.gl_account_code !== undefined &&
                                originalData.gl_account_code !== null
                                ? String(originalData.gl_account_code)
                                : "",
                            );
                            form.setFieldValue(
                              `charges.${index}.subledger_code`,
                              originalData.sl_code !== undefined &&
                                originalData.sl_code !== null
                                ? String(originalData.sl_code)
                                : "",
                            );
                            form.setFieldValue(
                              `charges.${index}.account_name`,
                              [
                                String(
                                  (originalData as Record<string, unknown>)
                                    .gl_account_code ?? "",
                                ).trim(),
                                String(
                                  (originalData as Record<string, unknown>)
                                    .account_name ?? "",
                                ).trim(),
                                String(
                                  (originalData as Record<string, unknown>)
                                    .gl_name ?? "",
                                ).trim(),
                              ]
                                .filter(Boolean)
                                .join(" - "),
                            );
                          }}
                          disabled={
                            formFieldsReadOnly ||
                            (String(charge.job_no ?? "").trim() !== "" &&
                              charge.charge_id != null)
                          }
                          styles={{
                            input: {
                              fontSize: "13px",
                              fontFamily: "Inter",
                              height: "36px",
                            },
                          }}
                        />
                      </Grid.Col>

                      {/* Subledger */}
                      <Grid.Col span={0.75}>
                        <TextInput
                          placeholder="Subledger"
                          value={charge.subledger_code ?? ""}
                          readOnly
                          disabled={
                            formFieldsReadOnly ||
                            (String(charge.job_no ?? "").trim() !== "" &&
                              charge.charge_id != null)
                          }
                          styles={{
                            input: {
                              fontSize: "13px",
                              fontFamily: "Inter",
                              height: "36px",
                            },
                          }}
                        />
                      </Grid.Col>

                      {/* Currency */}
                      <Grid.Col span={0.7}>
                        <Dropdown
                          placeholder="Curr."
                          searchable
                          data={currencyOptions}
                          dropdownZIndex={chargesDropdownZIndex}
                          value={charge.currency_id || charge.currency || null}
                          readOnly={formFieldsReadOnly}
                          onChange={(value) => {
                            const v = value ?? "";
                            form.setFieldValue(
                              `charges.${index}.currency_id`,
                              v,
                            );
                            const opt = currencyOptions.find(
                              (o) => o.value === v,
                            );
                            const code = opt ? (opt.label ?? opt.value) : v;
                            form.setFieldValue(
                              `charges.${index}.currency`,
                              code,
                            );
                            const newRoe = code ? getRoeValue(code) : null;
                            if (newRoe !== null) {
                              form.setFieldValue(
                                `charges.${index}.roe`,
                                newRoe,
                              );
                            }
                            const currentCharge = form.values.charges[index];
                            const amt = currentCharge.amount;
                            if (
                              amt != null &&
                              amt > 0 &&
                              newRoe != null &&
                              newRoe > 0
                            ) {
                              const local = clampAmount(amt * newRoe);
                              if (local != null)
                                form.setFieldValue(
                                  `charges.${index}.amount_in_local`,
                                  local,
                                );
                            }
                          }}
                          styles={{
                            input: {
                              fontSize: "13px",
                              fontFamily: "Inter",
                              height: "36px",
                            },
                          }}
                        />
                      </Grid.Col>

                      {/* ROE */}
                      <Grid.Col span={0.6}>
                        <NumberInput
                          placeholder="ROE"
                          min={0}
                          hideControls
                          readOnly={formFieldsReadOnly}
                          value={charge.roe || undefined}
                          onChange={(value) => {
                            const roe = value as number | null;
                            form.setFieldValue(`charges.${index}.roe`, roe);
                            const currentCharge = form.values.charges[index];
                            const amt = currentCharge.amount;
                            if (
                              amt != null &&
                              amt > 0 &&
                              roe != null &&
                              roe > 0
                            ) {
                              const local = clampAmount(amt * roe);
                              form.setFieldValue(
                                `charges.${index}.amount_in_local`,
                                local,
                              );
                            }
                          }}
                          styles={{
                            input: {
                              fontSize: "13px",
                              fontFamily: "Inter",
                              height: "36px",
                            },
                          }}
                        />
                      </Grid.Col>

                      {/* Unit */}
                      <Grid.Col span={0.7}>
                        <Dropdown
                          placeholder="Unit"
                          searchable
                          data={unitOptions}
                          dropdownZIndex={chargesDropdownZIndex}
                          value={charge.unit_id || charge.unit_code || null}
                          readOnly={formFieldsReadOnly}
                          onChange={(value) => {
                            const v = value ?? "";
                            form.setFieldValue(`charges.${index}.unit_id`, v);
                            const opt = unitOptions.find((o) => o.value === v);
                            form.setFieldValue(
                              `charges.${index}.unit_code`,
                              opt ? String(opt.label || opt.value) : v,
                            );
                          }}
                          styles={{
                            input: {
                              fontSize: "13px",
                              fontFamily: "Inter",
                              height: "36px",
                            },
                          }}
                        />
                      </Grid.Col>

                      {/* No of Unit */}
                      <Grid.Col span={0.8}>
                        <NumberInput
                          placeholder="Units"
                          min={0}
                          hideControls
                          readOnly={formFieldsReadOnly}
                          value={charge.no_of_unit ?? undefined}
                          onChange={(value) => {
                            const noOfUnit = value as number | null;
                            form.setFieldValue(
                              `charges.${index}.no_of_unit`,
                              noOfUnit,
                            );
                            const currentCharge = form.values.charges[index];
                            if (
                              noOfUnit != null &&
                              noOfUnit > 0 &&
                              currentCharge.amount_per_unit != null &&
                              currentCharge.amount_per_unit > 0
                            ) {
                              const amt = clampAmount(
                                noOfUnit * currentCharge.amount_per_unit,
                              );
                              form.setFieldValue(
                                `charges.${index}.amount`,
                                amt,
                              );
                              const roe = currentCharge.roe;
                              if (amt != null && roe != null && roe > 0) {
                                form.setFieldValue(
                                  `charges.${index}.amount_in_local`,
                                  clampAmount(amt * roe),
                                );
                              }
                            }
                          }}
                          styles={{
                            input: {
                              fontSize: "13px",
                              fontFamily: "Inter",
                              height: "36px",
                            },
                          }}
                        />
                      </Grid.Col>

                      {/* Amount per Unit */}
                      <Grid.Col span={0.8}>
                        <NumberInput
                          placeholder="Amt/Unit"
                          min={0}
                          hideControls
                          decimalScale={amountDecimalScale}
                          readOnly={formFieldsReadOnly}
                          value={charge.amount_per_unit ?? undefined}
                          onChange={(value) => {
                            const amtPerUnit = value as number | null;
                            form.setFieldValue(
                              `charges.${index}.amount_per_unit`,
                              amtPerUnit,
                            );
                            const currentCharge = form.values.charges[index];
                            if (
                              amtPerUnit != null &&
                              amtPerUnit > 0 &&
                              currentCharge.no_of_unit != null &&
                              currentCharge.no_of_unit > 0
                            ) {
                              const amt = clampAmount(
                                currentCharge.no_of_unit * amtPerUnit,
                              );
                              form.setFieldValue(
                                `charges.${index}.amount`,
                                amt,
                              );
                              const roe = currentCharge.roe;
                              if (amt != null && roe != null && roe > 0) {
                                form.setFieldValue(
                                  `charges.${index}.amount_in_local`,
                                  clampAmount(amt * roe),
                                );
                              }
                            }
                          }}
                          styles={{
                            input: {
                              fontSize: "13px",
                              fontFamily: "Inter",
                              height: "36px",
                            },
                          }}
                        />
                      </Grid.Col>

                      {/* Amount */}
                      <Grid.Col span={0.85}>
                        <NumberInput
                          placeholder="Amount"
                          min={0}
                          hideControls
                          decimalScale={amountDecimalScale}
                          readOnly={formFieldsReadOnly}
                          value={charge.amount ?? undefined}
                          onChange={(value) => {
                            const amt = value as number | null;
                            form.setFieldValue(`charges.${index}.amount`, amt);
                            const roe = form.values.charges[index].roe;
                            if (amt != null && roe != null && roe > 0) {
                              form.setFieldValue(
                                `charges.${index}.amount_in_local`,
                                clampAmount(amt * roe),
                              );
                            }
                          }}
                          styles={{
                            input: {
                              fontSize: "13px",
                              fontFamily: "Inter",
                              height: "36px",
                            },
                          }}
                        />
                      </Grid.Col>

                      {/* Local Amount */}
                      <Grid.Col span={0.85}>
                        <NumberInput
                          placeholder="Local Amt"
                          hideControls
                          decimalScale={amountDecimalScale}
                          {...getAmountNumberInputFormatProps()}
                          readOnly
                          value={charge.amount_in_local ?? undefined}
                          styles={{
                            input: {
                              fontSize: "13px",
                              fontFamily: "Inter",
                              height: "36px",
                              backgroundColor: "var(--mantine-color-gray-0)",
                            },
                          }}
                        />
                      </Grid.Col>

                      {/* SAC Code */}
                      <Grid.Col span={1}>
                        <Dropdown
                          searchable
                          clearable
                          placeholder="SAC Code"
                          data={sacCodeOptionsForForm}
                          value={String(charge.tax_code ?? "").trim() || null}
                          onChange={(val) =>
                            form.setFieldValue(
                              `charges.${index}.tax_code`,
                              String(val ?? "").trim(),
                            )
                          }
                          disabled={formFieldsReadOnly}
                          dropdownZIndex={chargesDropdownZIndex}
                          styles={{
                            input: {
                              fontSize: "13px",
                              fontFamily: "Inter",
                              height: "36px",
                            },
                          }}
                        />
                      </Grid.Col>

                      {/* Tax */}
                      {/* <Grid.Col span={0.5} style={{ justifyContent: "center", marginLeft: "10px", }}>
                  <Box
                    style={{
                      display: "flex",
                      alignItems: "center",
                      height: "36px",
                    }}
                  >
                    <Checkbox
                      checked={
                        charge.tax === "true" || charge.tax === true as any
                      }
                      onChange={(e) =>
                        form.setFieldValue(
                          `charges.${index}.tax`,
                          e.currentTarget.checked ? "true" : "false",
                        )
                      }
                      disabled={formFieldsReadOnly}
                      color="#105476"
                      styles={{
                        label: { fontSize: "13px", fontFamily: "Inter" },
                      }}
                    />
                  </Box>
                </Grid.Col> */}

                      {/* Actions */}
                      {!formFieldsReadOnly && (
                        <Grid.Col
                          span={0.77}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "flex-start",
                          }}
                        >
                          <Group gap={4} wrap="nowrap">
                            {form.values.charges.length > 1 && (
                              <Button
                                radius="sm"
                                px={8}
                                size="sm"
                                variant="light"
                                color="red"
                                onClick={() => {
                                  setChargeErrors((prev) => {
                                    const next: Record<
                                      number,
                                      Record<string, string>
                                    > = {};
                                    Object.entries(prev).forEach(
                                      ([key, value]) => {
                                        const idx = Number(key);
                                        if (Number.isNaN(idx) || idx === index)
                                          return;
                                        next[idx > index ? idx - 1 : idx] =
                                          value;
                                      },
                                    );
                                    return next;
                                  });
                                  form.removeListItem("charges", index);
                                }}
                              >
                                <IconTrash size={14} />
                              </Button>
                            )}
                            {form.values.charges.length - 1 === index && (
                              <Button
                                radius="sm"
                                px={8}
                                size="sm"
                                variant="light"
                                color="#105476"
                                onClick={() => {
                                  const newChargeCurrency =
                                    defaultBranchCurrency || "";
                                  const roe = newChargeCurrency
                                    ? getRoeValue(newChargeCurrency)
                                    : null;
                                  const newChargeCurrencyId =
                                    defaultBranchCurrencyId ||
                                    (currencyOptions.find(
                                      (o) =>
                                        (o.label || "").toUpperCase() ===
                                        (newChargeCurrency || "").toUpperCase(),
                                    )?.value ??
                                      "");
                                  const defaultJobNo =
                                    String(charge.job_no ?? "").trim() ||
                                    String(
                                      form.values.charges.find((row) =>
                                        String(row.job_no ?? "").trim(),
                                      )?.job_no ?? "",
                                    ).trim() ||
                                    prefillJobId;
                                  form.insertListItem("charges", {
                                    ...emptyCharge(),
                                    job_no: defaultJobNo,
                                    currency: newChargeCurrency,
                                    currency_id: newChargeCurrencyId,
                                    roe,
                                  });
                                }}
                              >
                                <IconPlus size={14} />
                              </Button>
                            )}
                          </Group>
                        </Grid.Col>
                      )}
                    </Grid>
                  ))}

                  {form.values.charges.length > 0 && (
                    <Box
                      mt="xl"
                      p="md"
                      style={{
                        backgroundColor: "#f8f9fa",
                        borderRadius: 8,
                        border: "1px solid #dee2e6",
                      }}
                    >
                      <Grid gutter="md">
                        <Grid.Col span={showTaxTab && gstBreakup ? 3 : 6}>
                          <Box>
                            <Text size="sm" fw={500} c="dimmed" mb={4}>
                              Local Amount Total
                            </Text>
                            <Text size="lg" fw={600} c="#105476">
                              {formatMoneyAmountForUi(chargesLocalTotal)}
                            </Text>
                          </Box>
                        </Grid.Col>
                        {showTaxTab && gstBreakup && (
                          <>
                            <Grid.Col span={3}>
                              <Box>
                                <Text size="sm" fw={500} c="dimmed" mb={4}>
                                  IGST Total
                                </Text>
                                <Text size="lg" fw={600} c="#105476">
                                  {formatMoneyAmountForUi(
                                    gstBreakupTotals.igst_total,
                                  )}
                                </Text>
                              </Box>
                            </Grid.Col>
                            <Grid.Col span={3}>
                              <Box>
                                <Text size="sm" fw={500} c="dimmed" mb={4}>
                                  CGST Total
                                </Text>
                                <Text size="lg" fw={600} c="#105476">
                                  {formatMoneyAmountForUi(
                                    gstBreakupTotals.cgst_total,
                                  )}
                                </Text>
                              </Box>
                            </Grid.Col>
                            <Grid.Col span={3}>
                              <Box>
                                <Text size="sm" fw={500} c="dimmed" mb={4}>
                                  SGST Total
                                </Text>
                                <Text size="lg" fw={600} c="#105476">
                                  {formatMoneyAmountForUi(
                                    gstBreakupTotals.sgst_total,
                                  )}
                                </Text>
                              </Box>
                            </Grid.Col>
                          </>
                        )}
                      </Grid>
                    </Box>
                  )}
                </Box>
              </Tabs.Panel>

              {saveResponse && showTaxTab && (
                <Tabs.Panel value="tax">
                  {gstBreakupLoading && (
                    <Stack align="center" py="xl">
                      <Loader size="md" color="#105476" />
                      <Text size="sm" c="dimmed">
                        Loading GST breakup...
                      </Text>
                    </Stack>
                  )}
                  {!gstBreakupLoading &&
                    !gstBreakup &&
                    chargesTabActive === "tax" &&
                    saveResponse?.id && (
                      <Text size="sm" c="dimmed" py="md">
                        Click Calculate GST to load tax breakup.
                      </Text>
                    )}
                  {!gstBreakupLoading && gstBreakup && (
                    <>
                      <Grid gutter="md" mt="md">
                        <Grid.Col span={3}>
                          <Box>
                            <Text size="sm" fw={500} c="dimmed" mb={4}>
                              IGST Total
                            </Text>
                            <Text size="lg" fw={600} c="#105476">
                              {formatMoneyAmountForUi(
                                gstBreakupTotals.igst_total,
                              )}
                            </Text>
                          </Box>
                        </Grid.Col>
                        <Grid.Col span={3}>
                          <Box>
                            <Text size="sm" fw={500} c="dimmed" mb={4}>
                              CGST Total
                            </Text>
                            <Text size="lg" fw={600} c="#105476">
                              {formatMoneyAmountForUi(
                                gstBreakupTotals.cgst_total,
                              )}
                            </Text>
                          </Box>
                        </Grid.Col>
                        <Grid.Col span={3}>
                          <Box>
                            <Text size="sm" fw={500} c="dimmed" mb={4}>
                              SGST Total
                            </Text>
                            <Text size="lg" fw={600} c="#105476">
                              {formatMoneyAmountForUi(
                                gstBreakupTotals.sgst_total,
                              )}
                            </Text>
                          </Box>
                        </Grid.Col>
                        <Grid.Col span={3}>
                          <Box>
                            <Text size="sm" fw={500} c="dimmed" mb={4}>
                              GST Total
                            </Text>
                            <Text size="lg" fw={600} c="#105476">
                              {formatMoneyAmountForUi(gstBreakupTotals.total)}
                            </Text>
                          </Box>
                        </Grid.Col>
                      </Grid>
                      <ScrollArea mt="md">
                        <Table
                          withTableBorder
                          withColumnBorders
                          striped
                          highlightOnHover
                          style={{ minWidth: 400 }}
                        >
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th
                                style={{ fontSize: "12px", fontWeight: 600 }}
                              >
                                SAC
                              </Table.Th>
                              <Table.Th
                                style={{ fontSize: "12px", fontWeight: 600 }}
                              >
                                Charge Name
                              </Table.Th>
                              <Table.Th
                                style={{ fontSize: "12px", fontWeight: 600 }}
                              >
                                Rate
                              </Table.Th>
                              <Table.Th
                                style={{ fontSize: "12px", fontWeight: 600 }}
                              >
                                Amount
                              </Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {(gstBreakup.sac_wise_totals ?? []).map(
                              (row, idx) => (
                                <Table.Tr key={idx}>
                                  <Table.Td style={{ fontSize: "13px" }}>
                                    {row.sac_code ?? "—"}
                                  </Table.Td>
                                  <Table.Td style={{ fontSize: "13px" }}>
                                    {formatChargeNameWithCode(
                                      row.charge_name,
                                      row.charge_code,
                                    ) || "—"}
                                  </Table.Td>
                                  <Table.Td style={{ fontSize: "13px" }}>
                                    {formatGstBreakupRate(
                                      row.rate,
                                      row.rate_type,
                                    )}
                                  </Table.Td>
                                  <Table.Td style={{ fontSize: "13px" }}>
                                    {row.total_amount != null
                                      ? formatMoneyAmountForUi(
                                          Number(row.total_amount),
                                        )
                                      : "—"}
                                  </Table.Td>
                                </Table.Tr>
                              ),
                            )}
                          </Table.Tbody>
                          <Table.Tfoot>
                            <Table.Tr>
                              <Table.Td style={{ fontSize: "13px" }} />
                              <Table.Td style={{ fontSize: "13px" }} />
                              <Table.Td
                                style={{
                                  fontSize: "13px",
                                  fontWeight: 600,
                                  color: "#105476",
                                }}
                              >
                                Total:
                              </Table.Td>
                              <Table.Td
                                style={{
                                  fontSize: "13px",
                                  fontWeight: 600,
                                  color: "#105476",
                                }}
                              >
                                {formatMoneyAmountForUi(gstBreakupTotals.total)}
                              </Table.Td>
                            </Table.Tr>
                          </Table.Tfoot>
                        </Table>
                      </ScrollArea>
                    </>
                  )}
                  {chargesTabActive === "tax" &&
                    saveResponse &&
                    !saveResponse.id && (
                      <Text size="sm" c="dimmed" py="md">
                        Click Calculate GST to save and load tax breakup.
                      </Text>
                    )}
                </Tabs.Panel>
              )}
            </Tabs>
          </Box>

          {/* ── Form action buttons ── */}
          <Group justify="space-between" mt="xl">
            <Button
              variant="outline"
              color="#105476"
              onClick={handlePaymentRequestBack}
            >
              Cancel
            </Button>
            <Group gap="sm">
              <Button
                variant="outline"
                color="#105476"
                onClick={() => {
                  const canAttach = !formFieldsReadOnly;
                  if (canAttach && supportingDocuments.length === 0) {
                    setSupportingDocuments([{ name: "", file: null }]);
                  }
                  const newErrors: { [key: number]: string } = {};
                  supportingDocuments.forEach((doc, idx) => {
                    if (doc.file && doc.file.size > MAX_FILE_SIZE) {
                      newErrors[idx] =
                        `File size exceeds 10MB limit. Current size: ${(doc.file.size / (1024 * 1024)).toFixed(2)}MB`;
                    }
                  });
                  setFileErrors(newErrors);
                  openDocumentsModal();
                }}
                disabled={isSubmitting}
              >
                {!formFieldsReadOnly
                  ? "Attach supporting document"
                  : "View supporting document(s)"}
              </Button>
              {!formFieldsReadOnly && (
                <>
                  {showApprovalActions && isEditMode && saveResponse?.id && (
                    <>
                      <Button
                        color="red"
                        leftSection={<IconX size={16} />}
                        loading={isSubmitting}
                        onClick={handleReject}
                      >
                        Reject
                      </Button>
                      <Button
                        color="green"
                        leftSection={<IconCheck size={16} />}
                        loading={isSubmitting}
                        onClick={handleApprove}
                      >
                        Approve
                      </Button>
                    </>
                  )}
                  {/* Keep this as a route-based fallback for existing edit flows. */}
                  {showApprovalActions &&
                    !saveResponse?.id &&
                    isEditMode && (
                    <Button
                      color="green"
                      leftSection={<IconCheck size={16} />}
                      loading={isSubmitting}
                      onClick={handleApprove}
                    >
                      Approve
                    </Button>
                  )}
                  <Button
                    type="submit"
                    color="#105476"
                    rightSection={<IconChevronRight size={16} />}
                    loading={isSubmitting}
                  >
                    {saveResponse?.id ? "Update" : "Save"}
                  </Button>
                </>
              )}
              {canEditActualInvAfterApproved && (
                <Button
                  type="button"
                  color="#105476"
                  rightSection={<IconChevronRight size={16} />}
                  loading={isSubmitting}
                  onClick={handleUpdateActualInvAfterApproved}
                >
                  Update Actual Invoice
                </Button>
              )}
            </Group>
          </Group>
        </Box>
      </Stack>

      {/* ── Reject Confirmation Modal ── */}
      <Modal
        opened={rejectModalOpened}
        onClose={closeRejectModal}
        title="Reject Payment Request"
        size="md"
        centered
        style={{ fontFamily: "Inter" }}
      >
        <Stack gap="md">
          <Textarea
            label="Rejected Note"
            placeholder="Enter reason for rejection"
            value={form.values.rejected_note}
            onChange={(e) =>
              form.setFieldValue("rejected_note", e.target.value)
            }
            rows={4}
            styles={textareaStyles}
            withAsterisk
          />
          <Group justify="flex-end" gap="sm">
            <Button variant="outline" color="gray" onClick={closeRejectModal}>
              Cancel
            </Button>
            <Button
              color="red"
              leftSection={<IconX size={16} />}
              onClick={confirmReject}
              loading={isSubmitting}
              disabled={!form.values.rejected_note?.trim()}
            >
              Confirm Reject
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ── Supporting Documents Modal ── */}
      <Modal
        opened={documentsModalOpened}
        onClose={closeDocumentsModal}
        title={
          docsReadOnly ? "Supporting Documents" : "Attach Supporting Documents"
        }
        size="xl"
        centered
        style={{ fontFamily: "Inter" }}
      >
        <Stack gap="xs">
          {supportingDocuments.map((doc, index) => (
            <Grid key={index} columns={12} gutter="sm" align="flex-end">
              <Grid.Col span={5.5}>
                <TextInput
                  label="Document Name"
                  placeholder="Enter document name"
                  value={doc.name}
                  disabled={docsReadOnly}
                  onChange={(e) => {
                    const updated = [...supportingDocuments];
                    updated[index] = {
                      ...updated[index],
                      name: e.target.value,
                    };
                    setSupportingDocuments(updated);
                  }}
                />
              </Grid.Col>
              <Grid.Col span={5.5}>
                <Box>
                  <Text size="sm" fw={500} mb={4}>
                    File
                  </Text>
                  <Dropzone
                    onDrop={(files: File[]) => {
                      if (docsReadOnly) return;
                      if (files.length === 0) return;
                      const file = files[0];
                      if (fileErrors[index]) {
                        const newErrors = { ...fileErrors };
                        delete newErrors[index];
                        setFileErrors(newErrors);
                      }
                      if (file.size > MAX_FILE_SIZE) {
                        const newErrors = { ...fileErrors };
                        newErrors[index] =
                          `File size exceeds 10MB limit. Current size: ${(file.size / (1024 * 1024)).toFixed(2)}MB`;
                        setFileErrors(newErrors);
                        ToastNotification({
                          type: "error",
                          message: `File "${file.name}" exceeds 10MB limit`,
                        });
                        return;
                      }
                      const updated = [...supportingDocuments];
                      updated[index] = {
                        ...updated[index],
                        file,
                        document_url: undefined,
                      };
                      setSupportingDocuments(updated);
                    }}
                    onReject={(files: any[]) => {
                      if (docsReadOnly) return;
                      const rejection = files[0];
                      if (
                        rejection?.errors?.some(
                          (e: any) => e.code === "file-too-large",
                        )
                      ) {
                        const newErrors = { ...fileErrors };
                        newErrors[index] = "File size exceeds 10MB limit";
                        setFileErrors(newErrors);
                      }
                    }}
                    maxSize={MAX_FILE_SIZE}
                    accept={undefined}
                    multiple={false}
                    disabled={docsReadOnly}
                    styles={{
                      root: {
                        border: "1px solid var(--mantine-color-gray-4)",
                        borderRadius: "var(--mantine-radius-sm)",
                        backgroundColor: "var(--mantine-color-white)",
                        minHeight: "36px",
                        padding: "0",
                      },
                      inner: {
                        padding: "0",
                        minHeight: "36px",
                      },
                    }}
                  >
                    <Group
                      justify="space-between"
                      gap="xs"
                      px="sm"
                      style={{
                        minHeight: "36px",
                        pointerEvents: "none",
                        cursor: "pointer",
                      }}
                    >
                      <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
                        {doc.file ? (
                          <>
                            <IconUpload
                              size={16}
                              color="var(--mantine-color-dimmed)"
                            />
                            <Text
                              size="sm"
                              truncate
                              style={{
                                flex: 1,
                                color: "var(--mantine-color-dark)",
                              }}
                            >
                              {doc.file.name}
                            </Text>
                          </>
                        ) : doc.document_url ? (
                          <>
                            <IconDownload
                              size={16}
                              color="var(--mantine-color-blue-6)"
                            />
                            <Text
                              size="sm"
                              truncate
                              style={{
                                flex: 1,
                                color: "var(--mantine-color-blue-6)",
                                cursor: "pointer",
                                textDecoration: "underline",
                                pointerEvents: "auto",
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (
                                  doc.document_url &&
                                  doc.original_document_name
                                ) {
                                  downloadFile(
                                    doc.document_url,
                                    doc.original_document_name,
                                  );
                                }
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.opacity = "0.8";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.opacity = "1";
                              }}
                            >
                              {doc.original_document_name || "Download file"}
                            </Text>
                          </>
                        ) : (
                          <>
                            <IconUpload
                              size={16}
                              color="var(--mantine-color-dimmed)"
                            />
                            <Text
                              size="sm"
                              c="dimmed"
                              truncate
                              style={{ flex: 1 }}
                            >
                              Drag and drop or click to select file
                            </Text>
                          </>
                        )}
                      </Group>
                      {!docsReadOnly && (doc.file || doc.document_url) && (
                        <Button
                          variant="subtle"
                          color="red"
                          size="xs"
                          p={4}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (fileErrors[index]) {
                              const newErrors = { ...fileErrors };
                              delete newErrors[index];
                              setFileErrors(newErrors);
                            }
                            const updated = [...supportingDocuments];
                            updated[index] = {
                              ...updated[index],
                              file: null,
                              document_url: undefined,
                              document_id: undefined,
                            };
                            setSupportingDocuments(updated);
                          }}
                          style={{ pointerEvents: "auto" }}
                        >
                          <IconX size={14} />
                        </Button>
                      )}
                    </Group>
                  </Dropzone>
                  {fileErrors[index] && (
                    <Text size="xs" c="red" mt={4}>
                      {fileErrors[index]}
                    </Text>
                  )}
                </Box>
              </Grid.Col>
              <Grid.Col span={1}>
                <Button
                  variant="light"
                  color="red"
                  disabled={docsReadOnly}
                  onClick={() => {
                    if (docsReadOnly) return;
                    if (fileErrors[index]) {
                      const newErrors = { ...fileErrors };
                      delete newErrors[index];
                      setFileErrors(newErrors);
                    }
                    if (supportingDocuments.length === 1) {
                      setSupportingDocuments([{ name: "", file: null }]);
                    } else {
                      const updated = supportingDocuments.filter(
                        (_, i) => i !== index,
                      );
                      setSupportingDocuments(updated);
                      const newErrors: { [key: number]: string } = {};
                      Object.keys(fileErrors).forEach((key) => {
                        const keyNum = parseInt(key);
                        if (keyNum < index)
                          newErrors[keyNum] = fileErrors[keyNum];
                        else if (keyNum > index)
                          newErrors[keyNum - 1] = fileErrors[keyNum];
                      });
                      setFileErrors(newErrors);
                    }
                  }}
                >
                  <IconTrash size={16} />
                </Button>
              </Grid.Col>
              <Grid.Col span={1} offset={11}>
                {!docsReadOnly && index === supportingDocuments.length - 1 && (
                  <Button
                    variant="light"
                    color="#105476"
                    onClick={() => {
                      setSupportingDocuments([
                        ...supportingDocuments,
                        { name: "", file: null },
                      ]);
                    }}
                  >
                    <IconPlus size={16} />
                  </Button>
                )}
              </Grid.Col>
            </Grid>
          ))}

          {supportingDocuments.length === 0 && (
            <Button
              variant="light"
              color="#105476"
              leftSection={<IconPlus size={16} />}
              disabled={docsReadOnly}
              onClick={() => {
                if (docsReadOnly) return;
                setSupportingDocuments([{ name: "", file: null }]);
              }}
              fullWidth
            >
              Add Document
            </Button>
          )}

          <Group justify="flex-end" mt="md">
            <Button variant="outline" onClick={closeDocumentsModal}>
              Close
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}

export default PaymentRequest as unknown as FC;
