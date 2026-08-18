import {
  Badge,
  Box,
  Button,
  Grid,
  Group,
  Text,
  Stack,
  Loader,
  ScrollArea,
  Tabs,
  Table,
} from "@mantine/core";
import { useForm, type UseFormReturnType } from "@mantine/form";
import {
  IconArrowLeft,
  IconChevronRight,
  IconTrash,
} from "@tabler/icons-react";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { URL } from "../../../api/serverUrls";
import { navigateFinanceReturn } from "../../accounts/invoices/financeDocumentNavigation";
import {
  ToastNotification,
  SingleDateInput,
  Dropdown,
  SearchableSelect,
} from "../../../components";
import { API_HEADER } from "../../../store/storeKeys";
import { postAPICall } from "../../../service/postApiCall";
import { putAPICall } from "../../../service/putApiCall";
import useAuthStore from "../../../store/authStore";
import EditPageHeadingRow from "../../../components/EditPageHeadingRow";
import { mergeEditPageAuditSources } from "../../../utils/editPageAuditInfo";
import { useCanPostDocuments } from "../../../hooks/useCanPostDocuments";
import { getAPICall } from "../../../service/getApiCall";
import FormTextInput from "../../../components/FormTextInput";
import FormNumberInput from "../../../components/FormNumberInput";
import FormTextArea from "../../../components/FormTextArea";
import { parseNoOfUnitForPayload } from "../../../utils/houseCargoChargeableWeight";
import { fetchReverseInvoiceById } from "../../../utils/fetchReverseInvoiceById";
import {
  parseInvoiceMutationResponse,
  readIrnNoFromInvoiceData,
} from "../../../utils/parseInvoiceMutationResponse";
import {
  isIndianOutstandingBranch,
  isIndianUserCountry,
} from "../../../utils/userNumberFormat";
import {
  bindMoneyWholeNumberMode,
  clampMoneyAmount,
  clampMoneyAmountBound,
  formatMoneyAmountForUi,
  getAmountDecimalScale,
  isVietnamBranchFromUser,
} from "../../../utils/nonDecimalMoneyAmount";

const fetchCurrencyMaster = async () => {
  try {
    const response = await getAPICall(`${URL.currencyMaster}`, API_HEADER);
    return response;
  } catch (error) {
    console.error("Error fetching currency master:", error);
    return [];
  }
};

const fetchStateMaster = async () => {
  try {
    const response = await getAPICall(`${URL.state}`, API_HEADER);
    return (response as { data?: unknown[] })?.data || response || [];
  } catch (error) {
    console.error("Error fetching state master:", error);
    return [];
  }
};

// Daybook for reverse invoice: CRN document_type (invoice page uses INV)
const fetchDaybookCRN = async () => {
  try {
    const payload = { filters: { document_type: "CRN" } };
    const response = await postAPICall(URL.daybook, payload, API_HEADER);
    return (response as { data?: unknown[] })?.data ?? [];
  } catch (error) {
    console.error("Error fetching daybook (CRN):", error);
    return [];
  }
};

const fetchUnitMaster = async () => {
  try {
    const payload = { filters: {} };
    const response = await postAPICall(
      URL.unitMasterFilter,
      payload,
      API_HEADER,
    );
    return (response as { data?: unknown[] })?.data ?? [];
  } catch (error) {
    console.error("Error fetching unit master:", error);
    return [];
  }
};

type GstRatesBySacResponse = {
  igst_percent?: number | string | null;
  cgst_percent?: number | string | null;
  sgst_percent?: number | string | null;
  same_state?: boolean;
};

type GstRates = {
  igst: number | null;
  cgst: number | null;
  sgst: number | null;
  same_state: boolean;
};

const fetchGstRatesByStateSac = async (payload: {
  state_id: number;
  sac_code: string;
}) => {
  return postAPICall("invoice/gst-rates-by-state-sac/", payload, API_HEADER);
};

const fetchGetEffectiveSac = async (
  items: { charge_id: number; service_id: number }[],
) => {
  try {
    const response = await postAPICall(
      URL.gstChargeMappingGetEffectiveSac,
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
          }>;
        }
      )?.data ?? []
    );
  } catch (error) {
    console.error("Error fetching get-effective-sac:", error);
    return [];
  }
};

/** India customer invoice: check if Bill To + address is SEZ as of document date. */
const fetchCheckSezStatus = async (payload: {
  customer_code: string;
  address: string;
  document_date: string;
}): Promise<boolean> => {
  try {
    const response = await postAPICall(URL.checkSezStatus, payload, API_HEADER);
    const root = response as {
      sez?: unknown;
      data?: { sez?: unknown };
    };
    return Boolean(root?.sez ?? root?.data?.sez);
  } catch (error) {
    console.error("Error checking SEZ status:", error);
    return false;
  }
};

/** YYYY-MM-DD for check-sez-status. */
function formatDateYYYYMMDD(date: Date | null | undefined): string {
  if (date == null) return "";
  const d = date instanceof Date ? date : normalizeDate(date);
  if (!d) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${year}-${month}-${day}`;
}

// Same endpoint as InvoiceCreate (invoice/calculate-gst-breakup/), payload: { customer_id, reverse_invoice_id }
const fetchReverseInvoiceCalculateGstBreakup = async (payload: {
  reverse_invoice_id: number;
  vat?: boolean;
}) => {
  try {
    const response = await postAPICall(
      URL.invoiceCalculateGstBreakup,
      payload,
      API_HEADER,
    );
    const raw = response as {
      data?: InvoiceTaxBreakup;
      [k: string]: unknown;
    };
    return (raw?.data ?? response) as InvoiceTaxBreakup;
  } catch (error) {
    console.error(
      "Error fetching calculate-gst-breakup for reverse invoice:",
      error,
    );
    throw error;
  }
};

function clampAmount(value: number | null | undefined): number | null {
  return clampMoneyAmountBound(value);
}

type DrCrChargeLike = {
  dr_cr?: string | null;
  Dr_Cr?: string | null;
  amount?: number | null;
  header_amount?: number | null;
  amount_in_header?: number | null;
  amount_in_local?: number | null;
  is_tax_row?: boolean;
  charge_code?: string | null;
  charge_name?: string | null;
};

function resolveChargeDrCr(
  charge: Pick<DrCrChargeLike, "dr_cr" | "Dr_Cr">,
): "Cr" | "Dr" {
  const raw = charge.dr_cr ?? charge.Dr_Cr ?? "Cr";
  return String(raw).trim().toLowerCase() === "dr" ? "Dr" : "Cr";
}

function resolveChargeHeaderAmount(charge: DrCrChargeLike): number {
  const val = charge.header_amount ?? charge.amount_in_header ?? 0;
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

function resolveChargeCurrencyAmount(charge: DrCrChargeLike): number {
  const n = Number(charge.amount ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function resolveChargeLocalAmount(charge: DrCrChargeLike): number {
  const n = Number(charge.amount_in_local ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Tax charge rows (IGST/CGST/SGST/VAT) — no GST rate calc on reverse, same as invoice create. */
function isReverseTaxChargeRow(charge: {
  is_tax_row?: boolean;
  charge_code?: string | null;
  charge_name?: string | null;
}): boolean {
  if (charge.is_tax_row === true) return true;
  const code = String(charge.charge_code ?? "")
    .trim()
    .toUpperCase();
  const name = String(charge.charge_name ?? "")
    .trim()
    .toUpperCase();
  return (
    code === "IGST" ||
    code === "CGST" ||
    code === "SGST" ||
    code === "VAT" ||
    name === "IGST" ||
    name === "CGST" ||
    name === "SGST" ||
    name === "VAT"
  );
}

/** Net totals for reverse: sum(Dr) − sum(Cr) for currency/header/local amounts. */
function calcChargeTotalsByDrCr(
  charges: DrCrChargeLike[],
  options?: { includeTaxRows?: boolean },
): {
  crAmountTotal: number;
  drAmountTotal: number;
  crHeaderTotal: number;
  drHeaderTotal: number;
  crLocalTotal: number;
  drLocalTotal: number;
  amount_total: number;
  header_total: number;
  local_total: number;
  total: number;
} {
  const includeTaxRows = options?.includeTaxRows ?? false;
  let crAmount = 0;
  let drAmount = 0;
  let crHeader = 0;
  let drHeader = 0;
  let crLocal = 0;
  let drLocal = 0;

  for (const charge of charges) {
    if (!includeTaxRows && isReverseTaxChargeRow(charge)) continue;

    const amountAmt = resolveChargeCurrencyAmount(charge);
    const headerAmt = resolveChargeHeaderAmount(charge);
    const localAmt = resolveChargeLocalAmount(charge);
    if (resolveChargeDrCr(charge) === "Dr") {
      drAmount += amountAmt;
      drHeader += headerAmt;
      drLocal += localAmt;
    } else {
      crAmount += amountAmt;
      crHeader += headerAmt;
      crLocal += localAmt;
    }
  }

  const crAmountTotal = clampAmount(crAmount) ?? 0;
  const drAmountTotal = clampAmount(drAmount) ?? 0;
  const crHeaderTotal = clampAmount(crHeader) ?? 0;
  const drHeaderTotal = clampAmount(drHeader) ?? 0;
  const crLocalTotal = clampAmount(crLocal) ?? 0;
  const drLocalTotal = clampAmount(drLocal) ?? 0;
  const amount_total = clampAmount(drAmount - crAmount) ?? 0;
  const header_total = clampAmount(drHeader - crHeader) ?? 0;
  const local_total = clampAmount(drLocal - crLocal) ?? 0;

  return {
    crAmountTotal,
    drAmountTotal,
    crHeaderTotal,
    drHeaderTotal,
    crLocalTotal,
    drLocalTotal,
    amount_total,
    header_total,
    local_total,
    total: amount_total,
  };
}

/** Net GST totals for reverse: sum(Dr GST) − sum(Cr GST) from local amount × rate. */
function calcGstTotalsByDrCr(
  charges: Array<{
    dr_cr?: string | null;
    Dr_Cr?: string | null;
    amount_in_local?: number | null;
    is_tax_row?: boolean;
    charge_code?: string | null;
    charge_name?: string | null;
  }>,
  gstRatesByChargeIndex: Record<
    number,
    { igst: number | null; cgst: number | null; sgst: number | null } | null
  >,
): { igst_total: number; cgst_total: number; sgst_total: number } {
  let crIgst = 0;
  let drIgst = 0;
  let crCgst = 0;
  let drCgst = 0;
  let crSgst = 0;
  let drSgst = 0;

  charges.forEach((charge, idx) => {
    if (isReverseTaxChargeRow(charge)) return;
    const localAmount = charge.amount_in_local;
    if (localAmount == null) return;
    const rates = gstRatesByChargeIndex[idx];
    if (!rates) return;

    const isDr = resolveChargeDrCr(charge) === "Dr";
    const applyTax = (
      rate: number | null | undefined,
      addCr: (n: number) => void,
      addDr: (n: number) => void,
    ) => {
      if (rate == null) return;
      const amount = clampAmount((localAmount * rate) / 100) ?? 0;
      if (isDr) addDr(amount);
      else addCr(amount);
    };

    applyTax(
      rates.igst,
      (n) => {
        crIgst += n;
      },
      (n) => {
        drIgst += n;
      },
    );
    applyTax(
      rates.cgst,
      (n) => {
        crCgst += n;
      },
      (n) => {
        drCgst += n;
      },
    );
    applyTax(
      rates.sgst,
      (n) => {
        crSgst += n;
      },
      (n) => {
        drSgst += n;
      },
    );
  });

  return {
    igst_total: clampAmount(drIgst - crIgst) ?? 0,
    cgst_total: clampAmount(drCgst - crCgst) ?? 0,
    sgst_total: clampAmount(drSgst - crSgst) ?? 0,
  };
}

function calcTaxAmountFromRate(
  base: number | null | undefined,
  rate: number | null | undefined,
): number {
  if (base == null || rate == null || rate <= 0) return 0;
  return clampAmount(base * (rate / 100)) ?? 0;
}

const parseGstRatesPayload = (res: unknown): GstRates | null => {
  const resObj = res as {
    data?: { data?: GstRatesBySacResponse; [k: string]: unknown };
    [k: string]: unknown;
  };
  const payload = resObj?.data?.data ?? resObj?.data ?? res;
  const data = payload as GstRatesBySacResponse | null | undefined;
  const igstRaw = data?.igst_percent;
  const cgstRaw = data?.cgst_percent;
  const sgstRaw = data?.sgst_percent;
  const sameState = data?.same_state ?? false;
  return {
    igst: igstRaw == null || igstRaw === "" ? null : Number(igstRaw),
    cgst: cgstRaw == null || cgstRaw === "" ? null : Number(cgstRaw),
    sgst: sgstRaw == null || sgstRaw === "" ? null : Number(sgstRaw),
    same_state: sameState,
  };
};

type InvoiceTaxBreakup = {
  sac_wise_totals?: Array<{
    sac_code?: string;
    charge_name?: string;
    total_amount?: number;
    rate?: number;
    rate_type?: string;
    charge_id?: number;
    Dr_Cr?: string;
  }>;
  percentage_wise_totals?: Array<{
    charge_id?: number;
    charge_name?: string;
    vat_charge_id?: number;
    rate_name?: string;
    rate?: number;
    tax_rate?: number;
    rate_type?: string;
    taxable_total?: number;
    total_amount?: number;
    Dr_Cr?: string;
  }>;
  charges?: Array<{
    charge_id?: number;
    tax_rate?: number;
    rate?: number;
    Dr_Cr?: string;
  }>;
  vat_total?: string;
  total?: string;
  Dr_Cr?: string;
};

const resolveVatTaxRate = (
  _breakup: InvoiceTaxBreakup | null,
  _chargeId: number | null | undefined,
  chargeTaxRate: number | string | null | undefined,
): number => {
  // Per-row only: empty/null or 0 means no VAT for that charge.
  // Never inherit another row's rate via shared charge_id.
  if (chargeTaxRate == null || chargeTaxRate === "") return 0;
  const parsed = Number(chargeTaxRate);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Live VAT total from charges only (no tax-tab / breakup). Prefer rate ×
 * amount on each row, else stored tax_amount, else VAT tax-row amounts.
 * Reverse nets Dr − Cr. */
const calcVatTotalFromCharges = (
  charges: Array<{
    dr_cr?: string | null;
    Dr_Cr?: string | null;
    amount_in_local?: number | null;
    header_amount?: number | null;
    tax_rate?: number | string | null;
    tax_amount?: number | string | null;
    is_tax_row?: boolean;
    charge_id?: number | null;
    charge_code?: string | null;
    charge_name?: string | null;
  }>,
): number => {
  let cr = 0;
  let dr = 0;
  let usedLineTax = false;

  for (const charge of charges) {
    if (isReverseTaxChargeRow(charge)) continue;
    const rate = resolveVatTaxRate(null, charge.charge_id, charge.tax_rate);
    let amount = 0;
    if (rate > 0) {
      amount = calcTaxAmountFromRate(
        charge.amount_in_local ?? charge.header_amount,
        rate,
      );
    } else if (charge.tax_amount != null && charge.tax_amount !== "") {
      const parsed = Number(charge.tax_amount);
      if (!Number.isFinite(parsed) || parsed === 0) continue;
      amount = parsed;
    } else {
      continue;
    }
    usedLineTax = true;
    if (resolveChargeDrCr(charge) === "Dr") dr += amount;
    else cr += amount;
  }
  if (usedLineTax) return clampAmount(dr - cr) ?? 0;

  for (const charge of charges) {
    if (!isReverseTaxChargeRow(charge)) continue;
    const code = String(charge.charge_code ?? "")
      .trim()
      .toUpperCase();
    const name = String(charge.charge_name ?? "")
      .trim()
      .toUpperCase();
    if (
      code === "IGST" ||
      code === "CGST" ||
      code === "SGST" ||
      name === "IGST" ||
      name === "CGST" ||
      name === "SGST"
    ) {
      continue;
    }
    const amount = resolveChargeLocalAmount(charge);
    if (resolveChargeDrCr(charge) === "Dr") dr += amount;
    else cr += amount;
  }
  return clampAmount(dr - cr) ?? 0;
};

/** GST totals from IGST/CGST/SGST charge rows already on the invoice (Dr − Cr). */
function calcGstTotalsFromTaxChargeRows(
  charges: Array<{
    dr_cr?: string | null;
    Dr_Cr?: string | null;
    amount_in_local?: number | null;
    amount?: number | null;
    amount_in_header?: number | null;
    header_amount?: number | null;
    is_tax_row?: boolean;
    charge_code?: string | null;
    charge_name?: string | null;
  }>,
): { igst_total: number; cgst_total: number; sgst_total: number } {
  let igst = 0;
  let cgst = 0;
  let sgst = 0;
  for (const charge of charges) {
    const code = String(charge.charge_code ?? "")
      .trim()
      .toUpperCase();
    const name = String(charge.charge_name ?? "")
      .trim()
      .toUpperCase();
    const key = code || name;
    if (key !== "IGST" && key !== "CGST" && key !== "SGST") continue;
    const amount = resolveChargeLocalAmount(charge);
    const signed = resolveChargeDrCr(charge) === "Dr" ? amount : -amount;
    if (key === "IGST") igst += signed;
    else if (key === "CGST") cgst += signed;
    else sgst += signed;
  }
  return {
    igst_total: clampAmount(igst) ?? 0,
    cgst_total: clampAmount(cgst) ?? 0,
    sgst_total: clampAmount(sgst) ?? 0,
  };
}

function parseNullableNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

function isUnitedStatesCountry(
  countryCode?: string | null,
  countryName?: string | null,
): boolean {
  const code = (countryCode ?? "").trim().toUpperCase();
  const name = (countryName ?? "").trim().toUpperCase();
  return (
    code === "US" || name.includes("UNITED STATES") || name.includes("USA")
  );
}

function isUnitedStatesBranchUser(
  user?: {
    country?: { country_code?: string; country_name?: string };
    branches?: Array<{
      is_default?: boolean;
      country?: { country_code?: string; country_name?: string };
    }>;
  } | null,
): boolean {
  if (!user) return false;
  if (
    isUnitedStatesCountry(
      user.country?.country_code,
      user.country?.country_name,
    )
  ) {
    return true;
  }
  const defaultBranch = user.branches?.find((b) => b.is_default === true);
  return isUnitedStatesCountry(
    defaultBranch?.country?.country_code,
    defaultBranch?.country?.country_name,
  );
}

type ChargeItem = {
  id?: number | null;
  charge_id: number | null;
  charge_name: string;
  charge_code?: string;
  shipment_id?: string;
  unit_code: string;
  no_of_unit: number | null;
  currency: string;
  roe: number | null;
  amount_per_unit: number | null;
  amount: number | null;
  header_amount: number | null;
  amount_in_local: number | null;
  tax_code: string;
  tax_rate?: number | null;
  tax_amount?: number | null;
  dr_cr: "Cr" | "Dr";
  is_tax_row?: boolean;
};

type InvoiceFormData = {
  bill_to: string;
  address: string;
  state: string;
  gstn: string;
  shipment_no: string;
  daybook_id: string;
  document_date: Date | null;
  due_date: Date | null;
  currency: string;
  roe: number | null;
  narration: string;
  irn_no: string;
  fapiao_no: string;
  charges: ChargeItem[];
};

/** Parse document/due date from API or form (DD-MM-YYYY or YYYY-MM-DD) to local Date.
 * Must match InvoiceCreate.parseInvoiceDate — never use `new Date("DD-MM-YYYY")`
 * (JS treats that as MM-DD-YYYY and swaps day/month for China YYYY-MM-DD display).
 */
function normalizeDate(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;

  const trimmed = String(value).trim();
  if (!trimmed) return null;

  const p = trimmed.split("-");
  if (p.length === 3) {
    const a = String(p[0] ?? "").trim();
    const b = String(p[1] ?? "").trim();
    const c = String(p[2] ?? "").trim();
    if (c.includes("T") || c.includes(":")) {
      const d = new Date(trimmed);
      return isNaN(d.getTime()) ? null : d;
    }
    let y: number;
    let m: number;
    let d: number;
    if (a.length === 4) {
      // YYYY-MM-DD (invoice create/update payload format)
      y = parseInt(a, 10);
      m = parseInt(b, 10) - 1;
      d = parseInt(c, 10);
    } else {
      // DD-MM-YYYY
      d = parseInt(a, 10);
      m = parseInt(b, 10) - 1;
      y = parseInt(c, 10);
    }
    if (Number.isFinite(d) && Number.isFinite(m) && Number.isFinite(y)) {
      const date = new Date(y, m, d);
      if (!isNaN(date.getTime())) return date;
    }
  }

  const slash = trimmed.match(
    /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (slash) {
    const day = Number(slash[1]);
    const month = Number(slash[2]);
    const year = Number(slash[3]);
    const date = new Date(year, month - 1, day);
    return isNaN(date.getTime()) ? null : date;
  }

  const native = new Date(trimmed);
  return isNaN(native.getTime()) ? null : native;
}

type ReversableDataResponse = {
  id?: number;
  customer_id?: number;
  state_id?: number;
  state_name?: string;
  currency_id?: number;
  currency_code?: string;
  bill_to?: string;
  bill_to_name?: string;
  address?: string;
  gstn?: string;
  shipment_no?: string;
  day_book_id?: number;
  day_book_name?: string;
  document_no?: string;
  reverse_document_no?: string;
  document_date?: string;
  due_date?: string;
  roe?: string | number;
  narration?: string;
  irn_no?: string;
  fapiao_no?: string;
  status?: string;
  total?: string | number;
  header_total?: string | number;
  Dr_Cr?: string;
  is_agent?: boolean;
  has_sez?: boolean;
  charges?: Array<{
    id?: number;
    charge_id?: number;
    charge_name?: string;
    charge_code?: string;
    shipment_id?: string;
    shipment_no?: string;
    unit_code?: string;
    currency_code?: string;
    no_of_unit?: string | number;
    roe?: string | number;
    amount_per_unit?: string | number;
    amount?: string | number;
    amount_in_local?: string | number;
    amount_in_header?: string | number;
    tax_code?: string;
    tax_rate?: string | number | null;
    tax_amount?: string | number | null;
    Dr_Cr?: string;
    is_tax_row?: boolean;
  }>;
};

function applyReversableDataToReverseForm(
  data: ReversableDataResponse,
  form: UseFormReturnType<InvoiceFormData>,
  opts: {
    setIsAgentInvoice: (v: boolean) => void;
    setBillToDisplayName: (v: string | null) => void;
    emptyDaybook: boolean;
    preserveChargeIds?: boolean;
  },
) {
  opts.setIsAgentInvoice(data.is_agent === true);
  const roeNum =
    data.roe != null
      ? typeof data.roe === "string"
        ? parseFloat(data.roe)
        : data.roe
      : null;
  opts.setBillToDisplayName(data.bill_to_name ?? null);
  form.setValues({
    bill_to: data.bill_to ?? "",
    address: data.address ?? "",
    state: data.state_id != null ? String(data.state_id) : "",
    gstn: data.gstn ?? "",
    shipment_no: data.shipment_no ?? "",
    daybook_id: opts.emptyDaybook
      ? ""
      : data.day_book_id != null
        ? String(data.day_book_id)
        : "",
    document_date: normalizeDate(data.document_date ?? null),
    due_date: normalizeDate(data.due_date ?? null),
    currency: data.currency_code ?? "",
    roe: Number.isFinite(roeNum) ? roeNum : null,
    narration: data.narration ?? "",
    irn_no: data.irn_no ?? "",
    fapiao_no: data.fapiao_no ?? "",
    charges:
      data.charges && data.charges.length > 0
        ? data.charges.map((c) => {
            const noOfUnit =
              c.no_of_unit != null
                ? typeof c.no_of_unit === "string"
                  ? parseFloat(c.no_of_unit)
                  : c.no_of_unit
                : null;
            const roe =
              c.roe != null
                ? typeof c.roe === "string"
                  ? parseFloat(c.roe)
                  : c.roe
                : null;
            const amountPerUnit =
              c.amount_per_unit != null
                ? typeof c.amount_per_unit === "string"
                  ? parseFloat(c.amount_per_unit)
                  : c.amount_per_unit
                : null;
            const amount =
              c.amount != null
                ? typeof c.amount === "string"
                  ? parseFloat(c.amount)
                  : c.amount
                : null;
            const amountInLocal =
              c.amount_in_local != null
                ? typeof c.amount_in_local === "string"
                  ? parseFloat(c.amount_in_local)
                  : c.amount_in_local
                : null;
            const headerAmount =
              c.amount_in_header != null
                ? typeof c.amount_in_header === "string"
                  ? parseFloat(c.amount_in_header)
                  : c.amount_in_header
                : null;
            const isTaxRow = isReverseTaxChargeRow({
              is_tax_row: c.is_tax_row === true,
              charge_code: c.charge_code,
              charge_name: c.charge_name,
            });
            return {
              ...(opts.preserveChargeIds && c.id != null && c.id > 0
                ? { id: c.id }
                : {}),
              charge_id: c.charge_id ?? null,
              charge_name: c.charge_name ?? "",
              charge_code: c.charge_code ?? "",
              shipment_id: c.shipment_id ?? c.shipment_no ?? "",
              unit_code: c.unit_code ?? "",
              no_of_unit: Number.isFinite(noOfUnit) ? noOfUnit : null,
              currency: c.currency_code ?? "",
              roe: Number.isFinite(roe) ? roe : null,
              amount_per_unit: Number.isFinite(amountPerUnit)
                ? amountPerUnit
                : null,
              amount: Number.isFinite(amount) ? amount : null,
              header_amount: Number.isFinite(headerAmount)
                ? headerAmount
                : null,
              amount_in_local: Number.isFinite(amountInLocal)
                ? amountInLocal
                : null,
              tax_code: c.tax_code ?? "",
              dr_cr: c.Dr_Cr === "Dr" ? "Dr" : "Cr",
              is_tax_row: isTaxRow,
              tax_rate: isTaxRow ? null : parseNullableNumber(c.tax_rate),
              tax_amount: isTaxRow ? null : parseNullableNumber(c.tax_amount),
            };
          })
        : [],
  });
}

function pickReverseDocumentNo(source: unknown): string {
  if (!source || typeof source !== "object") return "";
  const rec = source as Record<string, unknown>;
  const value = rec.reverse_document_no ?? rec.reverse_document_number;
  return value != null ? String(value).trim() : "";
}

function reverseChargeIdPayload(
  charge: ChargeItem,
  includeChargeIds: boolean,
): { id?: number } {
  if (!includeChargeIds) return {};
  if (charge.id == null || charge.id <= 0) return {};
  return { id: charge.id };
}

/** Map a reverse-form charge to API payload as-is (user + tax charge rows).
 * Reverse has no tax-tab regeneration — send stored amounts/rates only. */
function buildReverseChargePayload(
  charge: ChargeItem,
  opts: {
    includeChargeIds: boolean;
    currencyData: Array<{
      id?: number;
      code?: string;
      currency_code?: string;
    }>;
    unitData: Array<{ id?: number; unit_code?: string; code?: string }>;
    isVat: boolean;
    isGst: boolean;
  },
): Record<string, unknown> {
  const chargeCurrencyItem = opts.currencyData.find(
    (c) => (c.code || c.currency_code || "").toString() === charge.currency,
  );
  const chargeCurrencyId =
    chargeCurrencyItem?.id != null ? Number(chargeCurrencyItem.id) : null;
  const unitItem = opts.unitData.find(
    (u) => String(u.unit_code || u.code || u.id) === charge.unit_code,
  );
  const unitId = unitItem?.id != null ? Number(unitItem.id) : null;
  const headerAmount = clampAmount(charge.header_amount ?? 0) ?? 0;
  const isTaxRow = isReverseTaxChargeRow(charge);

  const base: Record<string, unknown> = {
    ...reverseChargeIdPayload(charge, opts.includeChargeIds),
    shipment_no:
      charge.shipment_id != null && String(charge.shipment_id).trim() !== ""
        ? String(charge.shipment_id)
        : null,
    charge_id: charge.charge_id ?? null,
    unit_id: unitId,
    no_of_unit: charge.no_of_unit ?? 0,
    currency_id: chargeCurrencyId,
    roe: charge.roe ?? 0,
    amount_per_unit: clampAmount(charge.amount_per_unit ?? 0) ?? 0,
    amount: clampAmount(charge.amount ?? 0) ?? 0,
    amount_in_local: clampAmount(charge.amount_in_local ?? 0) ?? 0,
    amount_in_header: headerAmount,
    Dr_Cr: charge.dr_cr ?? "Dr",
    ...(opts.isGst ? { tax_code: charge.tax_code ?? "" } : {}),
    ...(isTaxRow ? { is_tax_row: true } : {}),
  };

  if (opts.isVat && !isTaxRow) {
    const taxRate = resolveVatTaxRate(null, charge.charge_id, charge.tax_rate);
    const taxAmount =
      charge.tax_amount != null && Number.isFinite(Number(charge.tax_amount))
        ? Number(charge.tax_amount)
        : calcTaxAmountFromRate(
            charge.amount_in_local ?? headerAmount,
            taxRate,
          );
    return {
      ...base,
      tax_rate: taxRate,
      tax_amount: taxAmount,
    };
  }

  return base;
}

function InvoiceReverse() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const defaultBranch = user?.branches?.find(
    (b: { is_default?: boolean }) => b.is_default === true,
  ) as
    | {
        branch_code?: string;
        branch_name?: string;
        currency?: { currency_id?: number; currency_code?: string };
        country?: { country_code?: string; country_name?: string };
      }
    | undefined;
  const defaultBranchCurrency = defaultBranch?.currency?.currency_code ?? "";
  const activeBranchCountryCode = defaultBranch?.country?.country_code ?? "";
  const canPostDocuments = useCanPostDocuments();

  const navigateBack = useCallback(() => {
    navigateFinanceReturn(navigate, location.state);
  }, [location.state, navigate]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [documentNo, setDocumentNo] = useState<string | null>(null);
  const [saveResponse, setSaveResponse] = useState<{
    id?: number;
    customer_id?: number;
    reverse_document_no?: string;
    status?: string;
  } | null>(null);
  const [reversalRecordData, setReversalRecordData] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [invoiceIsPosted, setInvoiceIsPosted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [chargesTabActive, setChargesTabActive] = useState<string>("charges");
  const [gstBreakup, setGstBreakup] = useState<InvoiceTaxBreakup | null>(null);
  const [gstBreakupLoading, setGstBreakupLoading] = useState(false);
  const [chargeErrors, setChargeErrors] = useState<
    Record<number, Record<string, string>>
  >({});
  const [billToDisplayName, setBillToDisplayName] = useState<string | null>(
    null,
  );
  const [addressOptions, setAddressOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [hasSez, setHasSez] = useState(false);
  const billToAddressesRef = useRef<
    Array<{
      id: number;
      address: string;
      state_id?: number;
      address_type?: string | null;
      gst_id?: string | null;
    }>
  >([]);
  const [isAgentInvoice, setIsAgentInvoice] = useState(false);

  const isAgentInvoiceRef = useRef(false);
  const isGstInvoiceRef = useRef(false);
  const isVatInvoiceRef = useRef(false);
  const isUsInvoiceRef = useRef(false);

  const isIndiaUser = useMemo(() => {
    const branchCountryCode = (activeBranchCountryCode ?? "").toUpperCase();
    const branchCurrencyCode = (defaultBranchCurrency ?? "").toUpperCase();
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
    activeBranchCountryCode,
    defaultBranchCurrency,
    user?.country?.country_code,
    user?.country?.country_name,
  ]);

  const isChinaUser = useMemo(() => {
    const branchCountry = (activeBranchCountryCode ?? "").toUpperCase();
    if (branchCountry === "CN") return true;
    const branchCode = (defaultBranch?.branch_code ?? "").toUpperCase();
    const branchName = (defaultBranch?.branch_name ?? "").toUpperCase();
    if (branchCode === "CHN" || branchName.includes("CHINA")) return true;
    const countryCode = (user?.country?.country_code ?? "").toUpperCase();
    const countryName = (user?.country?.country_name ?? "").toUpperCase();
    return countryCode === "CN" || countryName === "CHINA";
  }, [
    activeBranchCountryCode,
    defaultBranch?.branch_code,
    defaultBranch?.branch_name,
    user?.country?.country_code,
    user?.country?.country_name,
  ]);

  const isVietnamBranch = useMemo(() => isVietnamBranchFromUser(user), [user]);
  bindMoneyWholeNumberMode(isVietnamBranch);
  const amountDecimalScale = getAmountDecimalScale(isVietnamBranch);

  const isKenyaUser = useMemo(() => {
    const branchCountry = (activeBranchCountryCode ?? "").toUpperCase();
    if (branchCountry === "KE") return true;
    const countryCode = (user?.country?.country_code ?? "").toUpperCase();
    const countryName = (user?.country?.country_name ?? "").toUpperCase();
    return countryCode === "KE" || countryName.includes("KENYA");
  }, [
    activeBranchCountryCode,
    user?.country?.country_code,
    user?.country?.country_name,
  ]);

  const isUsInvoiceUser = useMemo(() => isUnitedStatesBranchUser(user), [user]);

  // Foreign branches (non-India, non-US): VAT integration (no State/GSTN/SAC; tax_rate + tax_amount per charge).
  // Agent invoice: VAT applies for these branches too; only US agent invoices skip VAT.
  const isVatInvoiceUser = useMemo(
    () => !isIndiaUser && !isUsInvoiceUser,
    [isIndiaUser, isUsInvoiceUser],
  );

  // India GST: State/GSTN/SAC, IGST/CGST/SGST. Foreign branches use VAT (isVatInvoiceUser).
  const isGstInvoiceUser = useMemo(
    () =>
      isIndiaUser && !isAgentInvoice && !isVatInvoiceUser && !isUsInvoiceUser,
    [isIndiaUser, isAgentInvoice, isVatInvoiceUser, isUsInvoiceUser],
  );

  // SEZ customers: SAC still applies; GST columns/totals/tax tab are hidden
  const applyGst = isGstInvoiceUser && !hasSez;

  // Reverse has no tax-tab concept — invoice tax charge rows are part of charges.
  const showTaxTab = false;

  useEffect(() => {
    isAgentInvoiceRef.current = isAgentInvoice;
  }, [isAgentInvoice]);

  useEffect(() => {
    isGstInvoiceRef.current = isGstInvoiceUser;
  }, [isGstInvoiceUser]);

  useEffect(() => {
    isVatInvoiceRef.current = isVatInvoiceUser;
  }, [isVatInvoiceUser]);

  useEffect(() => {
    isUsInvoiceRef.current = isUsInvoiceUser;
  }, [isUsInvoiceUser]);

  const [gstRatesByChargeIndex, setGstRatesByChargeIndex] = useState<
    Record<number, GstRates | null>
  >({});
  const [gstRatesLoadingByIndex, setGstRatesLoadingByIndex] = useState<
    Record<number, boolean>
  >({});
  const gstRatesCacheRef = useRef<Map<string, GstRates>>(new Map());
  const lastGstRatesFetchKeyRef = useRef<string>("");

  const jobServiceId =
    (location.state as { job?: { service_id?: number } })?.job?.service_id ??
    null;
  const job = (
    location.state as { job?: { job_id?: number; id?: number } } | null
  )?.job;
  const jobId =
    job && (job.job_id != null || job.id != null)
      ? (job.job_id ?? job.id)
      : undefined;

  const isReadOnly = invoiceIsPosted;
  const reversalPageTitle = saveResponse?.id
    ? "Edit Invoice Reversal"
    : "Create Invoice Reversal";

  const reversalAuditSource = useMemo(
    () =>
      mergeEditPageAuditSources(
        reversalRecordData,
        (location.state as { financeReverseRecord?: Record<string, unknown> })
          ?.financeReverseRecord,
        saveResponse as Record<string, unknown> | null,
      ),
    [reversalRecordData, location.state, saveResponse],
  );

  const showReversalAuditInfo = Boolean(saveResponse?.id);

  const form = useForm<InvoiceFormData>({
    initialValues: {
      bill_to: "",
      address: "",
      state: "",
      gstn: "",
      shipment_no: "",
      daybook_id: "",
      document_date: null,
      due_date: null,
      currency: defaultBranchCurrency,
      roe: null,
      narration: "",
      irn_no: "",
      fapiao_no: "",
      charges: [],
    },
    validate: {
      bill_to: (value) => (!value ? "Bill To is required" : null),
      address: (value) => (!value ? "Address is required" : null),
      state: (value) =>
        !isGstInvoiceRef.current ? null : !value ? "State is required" : null,
      shipment_no: (value) => (!value ? "Shipment No is required" : null),
      daybook_id: (value) => (!value ? "Daybook is required" : null),
      document_date: (value) => (!value ? "Document Date is required" : null),
      due_date: (value) => (!value ? "Due Date is required" : null),
      currency: (value) => (!value ? "Currency is required" : null),
      roe: (value) => (value === null ? "ROE is required" : null),
    },
  });

  // India customer invoice only: when Bill To + address + document date are set, check SEZ status
  useEffect(() => {
    if (!isIndiaUser || isAgentInvoice) {
      setHasSez(false);
      return;
    }

    const customerCode = String(form.values.bill_to ?? "").trim();
    const addressRaw = String(form.values.address ?? "").trim();
    const addressLabel =
      addressOptions.find((opt) => opt.value === addressRaw)?.label?.trim() ||
      addressRaw;
    const documentDate = formatDateYYYYMMDD(form.values.document_date);

    if (!customerCode || !addressLabel || !documentDate) {
      setHasSez(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      const sez = await fetchCheckSezStatus({
        customer_code: customerCode,
        address: addressLabel,
        document_date: documentDate,
      });
      if (!cancelled) setHasSez(sez);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isIndiaUser,
    isAgentInvoice,
    form.values.bill_to,
    form.values.address,
    form.values.document_date,
    addressOptions,
  ]);

  // Clear GST rates when Bill To becomes SEZ (SAC codes remain)
  useEffect(() => {
    if (!hasSez) return;
    setGstRatesByChargeIndex({});
    setGstRatesLoadingByIndex({});
    lastGstRatesFetchKeyRef.current = "";
  }, [hasSez]);

  const { data: currencyData = [] } = useQuery({
    queryKey: ["currencyMaster"],
    queryFn: fetchCurrencyMaster,
    staleTime: Infinity,
  });
  const { data: stateData = [], isLoading: isStateLoading } = useQuery({
    queryKey: ["stateMaster"],
    queryFn: fetchStateMaster,
    staleTime: Infinity,
  });
  const { data: daybookData = [] } = useQuery({
    queryKey: ["daybook", "CRN"],
    queryFn: fetchDaybookCRN,
    staleTime: Infinity,
  });
  const { data: unitData = [] } = useQuery({
    queryKey: ["unitMaster", "invoice-reverse"],
    queryFn: fetchUnitMaster,
    staleTime: Infinity,
  });

  const currencyOptions = useMemo(() => {
    const data = currencyData as { code?: string; currency_code?: string }[];
    if (!Array.isArray(data)) return [];
    return data.map((item) => ({
      value: String(item.code || item.currency_code || ""),
      label: `${item.code || item.currency_code || ""}`,
    }));
  }, [currencyData]);

  const stateOptions = useMemo(() => {
    const data = stateData as {
      id?: number;
      state_name?: string;
      name?: string;
    }[];
    if (!Array.isArray(data)) return [];
    return data.map((item) => ({
      value: String(item.id ?? ""),
      label: item.state_name || item.name || "",
    }));
  }, [stateData]);

  const daybookOptions = useMemo(() => {
    const data = daybookData as { id?: number; name?: string }[];
    if (!Array.isArray(data)) return [];
    return data.map((item) => ({
      value: String(item.id ?? ""),
      label: item.name ?? "",
    }));
  }, [daybookData]);

  const unitOptions = useMemo(() => {
    const data = unitData as {
      unit_code?: string;
      code?: string;
      id?: number;
      unit_name?: string;
      name?: string;
    }[];
    if (!Array.isArray(data)) return [];
    return data.map((item) => ({
      value: String(item.unit_code || item.code || item.id || ""),
      label: item.unit_name || item.name || "",
    }));
  }, [unitData]);

  // Helper: ROE based on currency and user's country (same as InvoiceCreate)
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

  // Auto-set ROE when charge currency changes (charge has currency but no ROE)
  const chargeCurrencies = form.values.charges.map((c) => c.currency).join(",");
  useEffect(() => {
    const updatedCharges = form.values.charges.map((charge) => {
      let roe = charge.roe;
      if (charge.currency && (roe === null || roe === undefined)) {
        roe = getRoeValue(charge.currency);
      }
      if (roe !== charge.roe) {
        return { ...charge, roe: roe ?? null };
      }
      return charge;
    });
    const hasChanges = updatedCharges.some(
      (charge, index) => charge.roe !== form.values.charges[index]?.roe,
    );
    if (hasChanges) form.setFieldValue("charges", updatedCharges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chargeCurrencies, getRoeValue]);

  // Auto-calculate currency amount (amount) as: amount_per_unit * no_of_unit (InvoiceCreate parity — charge ROE is not multiplied here)
  const chargeAmountPerUnits = form.values.charges
    .map((c) => c.amount_per_unit)
    .join(",");
  const chargeNoOfUnits = form.values.charges
    .map((c) => c.no_of_unit)
    .join(",");

  useEffect(() => {
    const updatedCharges = form.values.charges.map((charge) => {
      if (
        charge.amount_per_unit != null &&
        charge.amount_per_unit > 0 &&
        charge.no_of_unit != null &&
        charge.no_of_unit > 0
      ) {
        const calculatedAmount = charge.no_of_unit * charge.amount_per_unit;
        const clamped = clampAmount(calculatedAmount);
        if (clamped != null && clamped !== charge.amount) {
          return {
            ...charge,
            amount: clamped,
          };
        }
      }

      return charge;
    });

    const hasChanges = updatedCharges.some(
      (charge, index) => charge.amount !== form.values.charges[index]?.amount,
    );

    if (hasChanges) {
      form.setFieldValue("charges", updatedCharges);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chargeAmountPerUnits, chargeNoOfUnits]);

  // Auto-calculate amount_in_local as: amount (currency_amount) * charge.roe — and keep header_amount in sync (InvoiceCreate parity)
  const chargeAmounts = form.values.charges.map((c) => c.amount).join(",");
  const chargeRoesForLocal = form.values.charges.map((c) => c.roe).join(",");

  useEffect(() => {
    const billingCurrency = (form.values.currency ?? "").trim().toUpperCase();
    const topRoe =
      form.values.roe != null && form.values.roe > 0
        ? Number(form.values.roe)
        : null;

    const updatedCharges = form.values.charges.map((charge) => {
      if (
        charge.amount !== null &&
        charge.amount !== undefined &&
        charge.amount > 0 &&
        charge.roe !== null &&
        charge.roe !== undefined &&
        charge.roe > 0
      ) {
        const calculatedLocalAmount = charge.amount * charge.roe;
        const clamped = clampAmount(calculatedLocalAmount);
        if (
          clamped != null &&
          clamped > 0 &&
          clamped !== charge.amount_in_local
        ) {
          const chargeCurr = (charge.currency ?? "").trim().toUpperCase();
          const newHeaderAmount =
            billingCurrency && chargeCurr && billingCurrency === chargeCurr
              ? clamped
              : topRoe != null
                ? clampAmount(clamped / topRoe)
                : clamped;
          return {
            ...charge,
            amount_in_local: clamped,
            header_amount:
              newHeaderAmount != null ? newHeaderAmount : charge.header_amount,
          };
        }
      }

      return charge;
    });

    const hasChanges = updatedCharges.some(
      (charge, index) =>
        charge.amount_in_local !==
          form.values.charges[index]?.amount_in_local ||
        charge.header_amount !== form.values.charges[index]?.header_amount,
    );

    if (hasChanges) {
      form.setFieldValue("charges", updatedCharges);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chargeAmounts, chargeRoesForLocal]);

  // Fetch GST rates by State + SAC for each charge (India GST only, not SEZ)
  useEffect(() => {
    if (!applyGst) {
      setGstRatesLoadingByIndex({});
      return;
    }

    const stateId = form.values.state ? Number(form.values.state) : null;
    if (!stateId || Number.isNaN(stateId)) {
      setGstRatesLoadingByIndex({});
      return;
    }

    const sacs = (form.values.charges || [])
      .map((c, idx) => ({
        idx,
        sac: String(c.tax_code || "").trim(),
        localAmount: c.amount_in_local,
        isTaxRow: isReverseTaxChargeRow(c),
      }))
      .filter((x) => x.sac !== "" && !x.isTaxRow);

    if (sacs.length === 0) {
      setGstRatesLoadingByIndex({});
      return;
    }

    const fetchKey = JSON.stringify({
      stateId,
      sacs: sacs.map((s) => ({ sac: s.sac, localAmount: s.localAmount })),
    });
    if (fetchKey === lastGstRatesFetchKeyRef.current) return;
    lastGstRatesFetchKeyRef.current = fetchKey;

    let cancelled = false;

    const indicesToFetch: number[] = [];
    sacs.forEach(({ idx, sac }) => {
      const cacheKey = `${stateId}:${sac}`;
      const hasCache = gstRatesCacheRef.current.has(cacheKey);
      const hasRates = gstRatesByChargeIndex[idx] != null;
      if (!hasCache && !hasRates) {
        indicesToFetch.push(idx);
      }
    });

    if (indicesToFetch.length > 0) {
      setGstRatesLoadingByIndex((prev) => {
        const next = { ...prev };
        indicesToFetch.forEach((idx) => {
          next[idx] = true;
        });
        return next;
      });
    }

    Promise.all(
      sacs.map(async ({ idx, sac }) => {
        const cacheKey = `${stateId}:${sac}`;
        const cached = gstRatesCacheRef.current.get(cacheKey);
        if (cached) return { idx, rates: cached, fromCache: true };

        try {
          const res = await fetchGstRatesByStateSac({
            state_id: stateId,
            sac_code: sac,
          });
          const rates = parseGstRatesPayload(res);
          if (rates) gstRatesCacheRef.current.set(cacheKey, rates);
          return { idx, rates, fromCache: false };
        } catch {
          return { idx, rates: null, fromCache: false };
        }
      }),
    ).then((results) => {
      if (cancelled) return;
      setGstRatesByChargeIndex((prev) => {
        const next = { ...prev };
        results.forEach(({ idx, rates }) => {
          next[idx] = rates;
        });
        return next;
      });
      const indicesToClear = results
        .filter((r) => !r.fromCache)
        .map((r) => r.idx);
      if (indicesToClear.length > 0) {
        setGstRatesLoadingByIndex((prev) => {
          const next = { ...prev };
          indicesToClear.forEach((idx) => {
            next[idx] = false;
          });
          return next;
        });
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.values.state, form.values.charges, applyGst]);

  // Reverse keeps source invoice tax_code as-is (including empty). Do not auto-fill SAC.
  // When charges lack SAC, InvoiceCreate may fetch get-effective-sac; reverse must not.

  // Auto-calculate header_amount: same currency → header_amount = amount_in_local; different → amount_in_local / header ROE
  const headerBillingCurrency = form.values.currency;
  const headerRoe = form.values.roe;
  const chargeLocalAmounts = form.values.charges
    .map((c) => c.amount_in_local)
    .join(",");
  const chargeCurrenciesForHeader = form.values.charges
    .map((c) => c.currency)
    .join(",");
  useEffect(() => {
    const updatedCharges = form.values.charges.map((charge) => {
      if (
        charge.amount_in_local != null &&
        charge.amount_in_local > 0 &&
        headerBillingCurrency &&
        charge.currency
      ) {
        let newHeaderAmount: number | null = null;
        if (
          headerBillingCurrency.toUpperCase() ===
          String(charge.currency).toUpperCase()
        ) {
          newHeaderAmount = charge.amount_in_local;
        } else if (headerRoe != null && headerRoe > 0) {
          newHeaderAmount = charge.amount_in_local / headerRoe;
        }
        const clampedHeader = clampAmount(newHeaderAmount);
        if (
          clampedHeader != null &&
          clampedHeader > 0 &&
          clampedHeader !== charge.header_amount
        ) {
          return { ...charge, header_amount: clampedHeader };
        }
      }
      return charge;
    });
    const hasChanges = updatedCharges.some(
      (charge, index) =>
        charge.header_amount !== form.values.charges[index]?.header_amount,
    );
    if (hasChanges) form.setFieldValue("charges", updatedCharges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    headerBillingCurrency,
    headerRoe,
    chargeLocalAmounts,
    chargeCurrenciesForHeader,
  ]);

  useEffect(() => {
    type NavState = {
      reverse_invoice_id?: number;
      document_no?: string;
      financeReverseRecord?: ReversableDataResponse;
      reverse_document_no?: string;
      invoice_document_no?: string;
    } | null;
    const st = location.state as NavState;
    if (st?.financeReverseRecord) {
      setReversalRecordData(st.financeReverseRecord as Record<string, unknown>);
    }
    const reverseInvoiceId =
      st?.reverse_invoice_id != null && Number(st.reverse_invoice_id) > 0
        ? Number(st.reverse_invoice_id)
        : st?.financeReverseRecord?.id != null &&
            Number(st.financeReverseRecord.id) > 0
          ? Number(st.financeReverseRecord.id)
          : null;

    if (reverseInvoiceId) {
      let cancelled = false;
      setLoading(true);
      setLoadError(null);
      fetchReverseInvoiceById(reverseInvoiceId)
        .then((data) => {
          if (cancelled) return;
          if (!data) {
            setLoadError("No reverse invoice data returned.");
            ToastNotification({
              message: "No reverse invoice data returned.",
              type: "error",
            });
            return;
          }
          applyReversableDataToReverseForm(
            data as ReversableDataResponse,
            form,
            {
              setIsAgentInvoice,
              setBillToDisplayName,
              emptyDaybook: false,
              preserveChargeIds: true,
            },
          );
          setHasSez(Boolean((data as ReversableDataResponse).has_sez));
          setReversalRecordData(data as Record<string, unknown>);
          setDocumentNo(
            String(
              data.document_no ??
                st?.invoice_document_no ??
                st?.document_no ??
                "",
            ),
          );
          setSaveResponse({
            id: Number(data.id ?? reverseInvoiceId),
            customer_id:
              data.customer_id != null ? Number(data.customer_id) : undefined,
            reverse_document_no:
              pickReverseDocumentNo(st) || pickReverseDocumentNo(data),
            status: String(data.status ?? "UNPOSTED"),
          });
          setInvoiceIsPosted(
            String(data.status ?? "").toUpperCase() === "POSTED",
          );
        })
        .catch((err) => {
          if (!cancelled) {
            const message =
              err?.message || "Failed to load reverse invoice data.";
            setLoadError(message);
            ToastNotification({ message, type: "error" });
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }

    const docNo = st?.document_no?.trim() ?? "";
    if (!docNo) {
      setLoadError(
        "Document number is required. Open this screen from a job invoice, or from Unposted Documents with a valid document.",
      );
      setLoading(false);
      return;
    }
    setDocumentNo(docNo);
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    postAPICall(URL.invoiceReversableData, { document_no: docNo }, API_HEADER)
      .then((res) => {
        if (cancelled) return;
        const data = ((res as { data?: ReversableDataResponse })?.data ??
          res) as ReversableDataResponse;
        applyReversableDataToReverseForm(data, form, {
          setIsAgentInvoice,
          setBillToDisplayName,
          emptyDaybook: true,
          preserveChargeIds: false,
        });
        setHasSez(Boolean(data.has_sez));
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(
            err?.message || "Failed to load reversable invoice data.",
          );
          ToastNotification({
            message: err?.message || "Failed to load reversable invoice data.",
            type: "error",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // form from useForm is stable; load is driven by location.state (same pattern as before extract).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  useEffect(() => {
    // if (
    //   chargesTabActive !== "tax" ||
    //   !saveResponse?.id ||
    //   saveResponse?.customer_id == null
    // ) {
    if (chargesTabActive !== "tax" || !saveResponse?.id || !showTaxTab) {
      return;
    }
    let cancelled = false;
    setGstBreakupLoading(true);
    setGstBreakup(null);
    fetchReverseInvoiceCalculateGstBreakup({
      reverse_invoice_id: saveResponse.id,
      ...(isVatInvoiceUser ? { vat: true } : {}),
    })
      .then((data) => {
        if (!cancelled) setGstBreakup(data);
      })
      .catch(() => {
        if (!cancelled) setGstBreakup(null);
      })
      .finally(() => {
        if (!cancelled) setGstBreakupLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [chargesTabActive, saveResponse?.id, showTaxTab, isVatInvoiceUser]);

  const handlePostInvoiceReverse = async () => {
    if (!saveResponse?.id) {
      ToastNotification({
        message:
          "Save the reverse invoice first and ensure customer_id is available.",
        type: "error",
      });
      return;
    }
    setIsPosting(true);
    try {
      const values = form.values;
      const stateId = values.state ? Number(values.state) : null;
      const currencyItem = (
        currencyData as { id?: number; code?: string; currency_code?: string }[]
      )?.find(
        (c) => (c.code || c.currency_code || "").toString() === values.currency,
      );
      const currencyId =
        currencyItem?.id != null ? Number(currencyItem.id) : null;
      const isVatPost = isVatInvoiceUser;
      const isUsPost = isUsInvoiceUser;
      const stateValid = stateId != null && stateId > 0;
      const needsStateForPost = isGstInvoiceUser;
      if (
        (needsStateForPost && !stateValid) ||
        currencyId == null ||
        currencyId <= 0
      ) {
        ToastNotification({
          message: needsStateForPost
            ? "Please ensure State and Currency are valid."
            : "Please ensure Currency is valid.",
          type: "error",
        });
        setIsPosting(false);
        return;
      }
      /** Payload dates: same YYYY-MM-DD as invoice create (via formatDateYYYYMMDD).
       * Reverse has no tax tab — send user charges + tax charge rows as-is. */
      const includeChargeIds = Boolean(saveResponse?.id);
      const currencyDataArr = (currencyData ?? []) as Array<{
        id?: number;
        code?: string;
        currency_code?: string;
      }>;
      const unitDataArr = (unitData ?? []) as Array<{
        id?: number;
        unit_code?: string;
        code?: string;
      }>;
      const chargesPayload = values.charges.map((charge) =>
        buildReverseChargePayload(charge, {
          includeChargeIds,
          currencyData: currencyDataArr,
          unitData: unitDataArr,
          isVat: isVatPost,
          isGst: isGstInvoiceUser,
        }),
      );
      const { total, header_total, local_total } = calcChargeTotalsByDrCr(
        chargesPayload as DrCrChargeLike[],
        { includeTaxRows: true },
      );
      const addressLabelForPayload =
        addressOptions.find((opt) => opt.value === values.address)?.label ??
        values.address;
      const payload = {
        id: saveResponse.id,
        ...(jobId != null ? { job_id: jobId } : {}),
        bill_to: values.bill_to,
        is_agent: isAgentInvoice,
        address: addressLabelForPayload,
        state_id:
          isAgentInvoice || isUsPost
            ? stateId != null && stateId > 0
              ? stateId
              : null
            : isVatPost
              ? null
              : stateId,
        gstn: isChinaUser ? null : values.gstn || null,
        shipment_no: values.shipment_no,
        daybook_id: values.daybook_id ? Number(values.daybook_id) : null,
        document_no: documentNo,
        document_date: formatDateYYYYMMDD(values.document_date) || null,
        due_date: formatDateYYYYMMDD(values.due_date) || null,
        currency_id: currencyId,
        roe: values.roe,
        narration: values.narration || null,
        irn_no: isKenyaUser ? null : values.irn_no || null,
        fapiao_no: values.fapiao_no || null,
        status: "POSTED",
        total,
        header_total,
        local_total,
        Dr_Cr: "Cr",
        has_sez: isIndiaUser && !isAgentInvoice ? hasSez : false,
        charges: chargesPayload,
        taxes: [],
      };
      const rawResponse = await putAPICall(
        URL.reverseInvoice,
        payload,
        API_HEADER,
      );
      const parsed = parseInvoiceMutationResponse(
        rawResponse,
        "Failed to post reverse invoice",
        "Reverse invoice posted successfully",
      );
      if (!parsed.success) {
        ToastNotification({
          message: parsed.message,
          type: "error",
        });
        return;
      }
      const response = parsed.data;
      if (response.is_agent === true) setIsAgentInvoice(true);
      setReversalRecordData((prev) =>
        mergeEditPageAuditSources(prev, response as Record<string, unknown>),
      );
      setSaveResponse((prev) => ({
        ...prev,
        id: response.id,
        customer_id: response.customer_id ?? prev?.customer_id,
        reverse_document_no:
          pickReverseDocumentNo(response) || prev?.reverse_document_no || "",
        status: response.status ?? "POSTED",
      }));
      setInvoiceIsPosted(true);
      const postedIrnNo = readIrnNoFromInvoiceData(response);
      if (postedIrnNo != null) {
        form.setFieldValue("irn_no", postedIrnNo);
      }
      if (response.fapiao_no != null) {
        form.setFieldValue("fapiao_no", String(response.fapiao_no));
      }
      if (response.charges && Array.isArray(response.charges)) {
        const mappedCharges: ChargeItem[] = response.charges.map((c) => {
          const noOfUnit =
            c.no_of_unit != null
              ? typeof c.no_of_unit === "string"
                ? parseFloat(c.no_of_unit)
                : c.no_of_unit
              : null;
          const roe =
            c.roe != null
              ? typeof c.roe === "string"
                ? parseFloat(c.roe)
                : c.roe
              : null;
          const amountPerUnit =
            c.amount_per_unit != null
              ? typeof c.amount_per_unit === "string"
                ? parseFloat(c.amount_per_unit)
                : c.amount_per_unit
              : null;
          const amount =
            c.amount != null
              ? typeof c.amount === "string"
                ? parseFloat(c.amount)
                : c.amount
              : null;
          const amountInLocal =
            c.amount_in_local != null
              ? typeof c.amount_in_local === "string"
                ? parseFloat(c.amount_in_local)
                : c.amount_in_local
              : null;
          const headerAmount =
            c.amount_in_header != null
              ? typeof c.amount_in_header === "string"
                ? parseFloat(c.amount_in_header)
                : c.amount_in_header
              : null;
          const isTaxRow = isReverseTaxChargeRow({
            is_tax_row: c.is_tax_row === true,
            charge_code: c.charge_code,
            charge_name: c.charge_name,
          });
          return {
            charge_id: c.charge_id ?? null,
            charge_name: c.charge_name ?? "",
            charge_code: c.charge_code ?? "",
            shipment_id: c.shipment_id ?? c.shipment_no ?? "",
            unit_code: c.unit_code ?? "",
            no_of_unit: Number.isFinite(noOfUnit) ? noOfUnit : null,
            currency: c.currency_code ?? "",
            roe: Number.isFinite(roe) ? roe : null,
            amount_per_unit: Number.isFinite(amountPerUnit)
              ? amountPerUnit
              : null,
            amount: Number.isFinite(amount) ? amount : null,
            header_amount: Number.isFinite(headerAmount) ? headerAmount : null,
            amount_in_local: Number.isFinite(amountInLocal)
              ? amountInLocal
              : null,
            tax_code: c.tax_code ?? "",
            dr_cr: c.Dr_Cr === "Dr" ? "Dr" : "Cr",
            is_tax_row: isTaxRow,
            tax_rate: isTaxRow
              ? null
              : parseNullableNumber(
                  (c as { tax_rate?: string | number | null }).tax_rate,
                ),
            tax_amount: isTaxRow
              ? null
              : parseNullableNumber(
                  (c as { tax_amount?: string | number | null }).tax_amount,
                ),
          };
        });
        form.setFieldValue("charges", mappedCharges);
      }
      ToastNotification({
        message: parsed.message,
        type: "success",
      });
    } catch (error: unknown) {
      console.error("Error posting reverse invoice:", error);
      ToastNotification({
        message:
          (error as { message?: string })?.message ??
          "Failed to post reverse invoice",
        type: "error",
      });
    } finally {
      setIsPosting(false);
    }
  };

  const handleBillToChange = (
    value: string | null,
    selectedData?: { value: string; label: string } | null,
    originalData?: Record<string, unknown> | null,
  ) => {
    form.setFieldValue("bill_to", value ?? "");
    setBillToDisplayName(selectedData?.label ?? null);

    const isCleared =
      value == null || (typeof value === "string" && value.trim() === "");
    if (isCleared) {
      setAddressOptions([]);
      billToAddressesRef.current = [];
      form.setFieldValue("address", "");
      setHasSez(false);
      if (isGstInvoiceUser || isKenyaUser) {
        if (isGstInvoiceUser) form.setFieldValue("state", "");
        form.setFieldValue("gstn", "");
      }
      return;
    }

    if (
      originalData &&
      (originalData as Record<string, unknown>).addresses_data
    ) {
      const addressesData = (originalData as Record<string, unknown>)
        .addresses_data as Array<{
        id: number;
        address: string;
        state_id?: number;
        address_type?: string | null;
        gst_id?: string | null;
      }>;
      billToAddressesRef.current = addressesData || [];
      const newAddressOptions = (addressesData || []).map(
        (addr: { id: number; address: string }) => ({
          value: String(addr.id),
          label: addr.address,
        }),
      );

      setAddressOptions(newAddressOptions);
      form.setFieldValue("address", "");

      if (isGstInvoiceUser || isKenyaUser) {
        if (isGstInvoiceUser) {
          const primaryAddress = (addressesData || []).find(
            (a) => String(a.address_type || "").toUpperCase() === "PRIMARY",
          );
          const addrForState =
            primaryAddress ||
            (addressesData || []).find((a) => a.state_id != null);
          if (addrForState?.state_id != null) {
            form.setFieldValue("state", String(addrForState.state_id));
          }
        }

        const primaryAddress = (addressesData || []).find(
          (a) => String(a.address_type || "").toUpperCase() === "PRIMARY",
        );
        const addrForGst =
          primaryAddress || (addressesData || []).find((a) => a.gst_id != null);
        if (addrForGst?.gst_id) {
          form.setFieldValue("gstn", String(addrForGst.gst_id));
        }
      }
    } else {
      setAddressOptions([]);
      billToAddressesRef.current = [];
      form.setFieldValue("address", "");
    }
  };

  const handleSubmit = async (values: InvoiceFormData) => {
    if (!documentNo?.trim()) {
      ToastNotification({
        message: "Document number is missing.",
        type: "error",
      });
      return;
    }
    // Validate charges: charge, currency, roe, amount, amount_in_local
    // SAC is optional — reverse keeps source invoice tax_code as-is (may be empty).
    const chargeErrs: Record<number, Record<string, string>> = {};
    const invalidCharges = values.charges.some((charge, index) => {
      const err: Record<string, string> = {};
      if (!charge.charge_name && charge.charge_id == null)
        err.charge_name = "Charge is required";
      if (!charge.currency) err.currency = "Currency is required";
      if (charge.roe === null || charge.roe === undefined)
        err.roe = "ROE is required";
      if (charge.amount === null || charge.amount === undefined)
        err.amount = "Currency Amount is required";
      if (
        charge.amount_in_local === null ||
        charge.amount_in_local === undefined
      )
        err.amount_in_local = "Local Amount is required";
      if (Object.keys(err).length > 0) {
        chargeErrs[index] = err;
        return true;
      }
      return false;
    });
    if (invalidCharges) {
      setChargeErrors(chargeErrs);
      ToastNotification({
        message:
          "Please fill all required fields in charges section (Charge, Currency, ROE, Currency Amount, Local Amount).",
        type: "error",
      });
      return;
    }
    setChargeErrors({});
    setIsSubmitting(true);
    try {
      const stateId = values.state ? Number(values.state) : null;
      const currencyItem = (
        currencyData as { id?: number; code?: string; currency_code?: string }[]
      )?.find(
        (c) => (c.code || c.currency_code || "").toString() === values.currency,
      );
      const currencyId =
        currencyItem?.id != null ? Number(currencyItem.id) : null;
      const isVatSave = isVatInvoiceUser;
      const isUsSave = isUsInvoiceUser;
      if (isGstInvoiceUser && (!stateId || stateId <= 0)) {
        ToastNotification({
          message: "Please select a valid State",
          type: "error",
        });
        setIsSubmitting(false);
        return;
      }
      if (currencyId == null || currencyId <= 0) {
        ToastNotification({
          message: "Please select a valid Billing Currency",
          type: "error",
        });
        setIsSubmitting(false);
        return;
      }
      const { total, header_total, local_total } = calcChargeTotalsByDrCr(
        values.charges,
        { includeTaxRows: true },
      );
      /** Payload dates: same YYYY-MM-DD as invoice create.
       * Reverse has no tax tab — send user + tax charge rows as-is. */
      const isUpdate = saveResponse?.id != null && saveResponse.id > 0;
      const currencyDataArr = (currencyData ?? []) as Array<{
        id?: number;
        code?: string;
        currency_code?: string;
      }>;
      const unitDataArr = (unitData ?? []) as Array<{
        id?: number;
        unit_code?: string;
        code?: string;
      }>;
      const chargesPayload = values.charges.map((charge) =>
        buildReverseChargePayload(charge, {
          includeChargeIds: isUpdate,
          currencyData: currencyDataArr,
          unitData: unitDataArr,
          isVat: isVatSave,
          isGst: isGstInvoiceUser,
        }),
      );
      const payload = {
        ...(isUpdate ? { id: saveResponse.id } : {}),
        ...(jobId != null ? { job_id: jobId } : {}),
        bill_to: values.bill_to,
        is_agent: isAgentInvoice,
        address:
          addressOptions.find((opt) => opt.value === values.address)?.label ??
          values.address,
        state_id:
          isAgentInvoice || isUsSave
            ? stateId != null && stateId > 0
              ? stateId
              : null
            : isVatSave
              ? null
              : stateId,
        gstn: isChinaUser ? null : values.gstn || null,
        shipment_no: values.shipment_no,
        daybook_id: values.daybook_id ? Number(values.daybook_id) : null,
        document_no: documentNo,
        document_date: formatDateYYYYMMDD(values.document_date) || null,
        due_date: formatDateYYYYMMDD(values.due_date) || null,
        currency_id: currencyId,
        roe: values.roe,
        narration: values.narration || null,
        irn_no: isKenyaUser ? null : values.irn_no || null,
        fapiao_no: values.fapiao_no || null,
        status: "UNPOSTED",
        total,
        header_total,
        local_total,
        Dr_Cr: "Cr",
        has_sez: isIndiaUser && !isAgentInvoice ? hasSez : false,
        charges: chargesPayload,
      };
      if (isUpdate) {
        const rawResponse = await putAPICall(
          URL.reverseInvoice,
          payload,
          API_HEADER,
        );
        const parsed = parseInvoiceMutationResponse(
          rawResponse,
          "Failed to update reverse invoice",
          "Reverse invoice updated successfully",
        );
        if (!parsed.success) {
          ToastNotification({
            message: parsed.message,
            type: "error",
          });
          return;
        }
        const res = parsed.data;
        if (res.is_agent === true) setIsAgentInvoice(true);
        setReversalRecordData((prev) =>
          mergeEditPageAuditSources(prev, res as Record<string, unknown>),
        );
        setSaveResponse((prev) => ({
          ...prev,
          id: res.id ?? prev?.id,
          customer_id: res.customer_id ?? prev?.customer_id,
          reverse_document_no:
            pickReverseDocumentNo(res) || prev?.reverse_document_no || "",
          status: res.status ?? prev?.status ?? "UNPOSTED",
        }));
        if (res.charges && Array.isArray(res.charges)) {
          const updatedCharges = form.values.charges.map((c, i) => ({
            ...c,
            id: res.charges?.[i]?.id ?? null,
          }));
          form.setFieldValue("charges", updatedCharges);
        }
        const updatedIrnNo = readIrnNoFromInvoiceData(res);
        if (updatedIrnNo != null) {
          form.setFieldValue("irn_no", updatedIrnNo);
        }
        if (res.fapiao_no != null) {
          form.setFieldValue("fapiao_no", String(res.fapiao_no));
        }
        ToastNotification({
          message: parsed.message,
          type: "success",
        });
      } else {
        const rawResponse = await postAPICall(
          URL.reverseInvoice,
          payload,
          API_HEADER,
        );
        const parsed = parseInvoiceMutationResponse(
          rawResponse,
          "Failed to save reverse invoice",
          "Reverse invoice saved successfully",
        );
        if (!parsed.success) {
          ToastNotification({
            message: parsed.message,
            type: "error",
          });
          return;
        }
        const res = parsed.data;
        if (res.is_agent === true) setIsAgentInvoice(true);
        setReversalRecordData((prev) =>
          mergeEditPageAuditSources(prev, res as Record<string, unknown>),
        );
        setSaveResponse({
          id: res.id,
          customer_id: res.customer_id,
          reverse_document_no: pickReverseDocumentNo(res),
          status: res.status ?? "UNPOSTED",
        });
        if (res.charges && Array.isArray(res.charges)) {
          const updatedCharges = form.values.charges.map((c, i) => ({
            ...c,
            id: res.charges?.[i]?.id ?? null,
          }));
          form.setFieldValue("charges", updatedCharges);
        }
        const createdIrnNo = readIrnNoFromInvoiceData(res);
        if (createdIrnNo != null) {
          form.setFieldValue("irn_no", createdIrnNo);
        }
        if (res.fapiao_no != null) {
          form.setFieldValue("fapiao_no", String(res.fapiao_no));
        }
        const statusUpper = (res.status ?? "").toUpperCase();
        setInvoiceIsPosted(statusUpper === "POSTED");
        ToastNotification({
          message: parsed.message,
          type: "success",
        });
      }
    } catch (error: unknown) {
      console.error("Error saving reverse invoice:", error);
      ToastNotification({
        message:
          (error as { message?: string })?.message ??
          "Failed to save reverse invoice",
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const headerSameState = Object.values(gstRatesByChargeIndex).find(
    (rates) => rates?.same_state !== undefined,
  )?.same_state;

  const chargeSectionTotals = useMemo(
    () =>
      calcChargeTotalsByDrCr(
        form.values.charges.filter((c) => !isReverseTaxChargeRow(c)),
      ),
    [form.values.charges],
  );

  const vatSectionTotal = useMemo(
    () => calcVatTotalFromCharges(form.values.charges),
    [form.values.charges],
  );

  const gstSectionTotals = useMemo(() => {
    const fromRows = calcGstTotalsFromTaxChargeRows(form.values.charges);
    const hasTaxRows = form.values.charges.some((c) => {
      const code = String(c.charge_code ?? "")
        .trim()
        .toUpperCase();
      const name = String(c.charge_name ?? "")
        .trim()
        .toUpperCase();
      const key = code || name;
      return key === "IGST" || key === "CGST" || key === "SGST";
    });
    if (hasTaxRows) return fromRows;
    return calcGstTotalsByDrCr(form.values.charges, gstRatesByChargeIndex);
  }, [form.values.charges, gstRatesByChargeIndex]);

  if (loading) {
    return (
      <Box
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#ffffff",
        }}
      >
        <Stack align="center" justify="center" gap="md">
          <Loader size="lg" color="#105476" />
          <Text size="sm" c="#105476" fw={500}>
            Loading invoice data...
          </Text>
        </Stack>
      </Box>
    );
  }

  if (loadError) {
    return (
      <Box p="md">
        <Stack gap="md">
          <Group justify="space-between">
            <Text size="xl" fw={600} c="#105476">
              {reversalPageTitle}
            </Text>
            <Button
              variant="outline"
              color="#105476"
              leftSection={<IconArrowLeft size={16} />}
              onClick={navigateBack}
            >
              Back
            </Button>
          </Group>
          <Text size="sm" c="red">
            {loadError}
          </Text>
        </Stack>
      </Box>
    );
  }

  return (
    <Box p="md" style={{ position: "relative" }}>
      {(isSubmitting || isPosting) && (
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
              {isPosting
                ? "Posting..."
                : saveResponse?.id
                  ? "Updating..."
                  : "Saving..."}
            </Text>
          </Stack>
        </Box>
      )}
      <Stack gap="md">
        <Group justify="space-between" mb="xs" wrap="nowrap">
          <EditPageHeadingRow
            visible={showReversalAuditInfo && Boolean(reversalAuditSource)}
            auditSource={reversalAuditSource}
            animateKey={(reversalAuditSource as { id?: number })?.id}
          >
            <Text size="xl" fw={600} c="#105476">
              {reversalPageTitle}
            </Text>
          </EditPageHeadingRow>
          <Group gap="md" wrap="wrap" justify="flex-end">
            {saveResponse?.reverse_document_no?.trim() && (
              <Group gap="xs" wrap="nowrap">
                <Text size="sm" fw={500} c="dimmed">
                  Reverse Invoice document no
                </Text>
                <Badge
                  size="sm"
                  variant="light"
                  color="#105476"
                  styles={{ root: { textTransform: "none" } }}
                >
                  {saveResponse.reverse_document_no}
                </Badge>
              </Group>
            )}
            {saveResponse && (
              <Group gap="xs" wrap="nowrap">
                <Text size="sm" fw={500} c="dimmed">
                  Status
                </Text>
                <Badge
                  size="sm"
                  variant="light"
                  color={
                    saveResponse.status?.toUpperCase() === "UNPOSTED"
                      ? "gray"
                      : saveResponse.status?.toUpperCase() === "POSTED"
                        ? "green"
                        : "#105476"
                  }
                  styles={{ root: { textTransform: "none" } }}
                >
                  {saveResponse.status?.toUpperCase() || "—"}
                </Badge>
              </Group>
            )}
            <Button
              variant="outline"
              color="#105476"
              leftSection={<IconArrowLeft size={16} />}
              onClick={navigateBack}
            >
              Back
            </Button>
          </Group>
        </Group>

        <Box
          component="form"
          onSubmit={
            isReadOnly ? (e) => e.preventDefault() : form.onSubmit(handleSubmit)
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
          <Grid>
            <Grid.Col span={4}>
              <SearchableSelect
                key={`invoice-reverse-bill-to-${form.values.bill_to}:${billToDisplayName ?? "_"}`}
                label="Bill To"
                placeholder="Type customer name"
                apiEndpoint={URL.allCustomers}
                searchFields={["customer_name", "customer_code"]}
                displayFormat={(item: Record<string, unknown>) => ({
                  value: String(item.customer_code),
                  label: String(item.customer_name),
                })}
                value={form.values.bill_to}
                displayValue={billToDisplayName || undefined}
                onChange={handleBillToChange}
                returnOriginalData={true}
                withAsterisk
                dropdownZIndex={1000}
                readOnly={isReadOnly}
                error={
                  form.errors.bill_to ? String(form.errors.bill_to) : undefined
                }
              />
            </Grid.Col>
            {isGstInvoiceUser && (
              <>
                <Grid.Col span={2}>
                  <Dropdown
                    label="State"
                    placeholder={
                      isStateLoading ? "Loading states" : "Select state"
                    }
                    data={stateOptions}
                    value={form.values.state || null}
                    onChange={(value) =>
                      form.setFieldValue("state", value ?? "")
                    }
                    searchable
                    withAsterisk
                    readOnly={isStateLoading || isReadOnly}
                    error={form.errors.state}
                  />
                </Grid.Col>
                <Grid.Col span={2}>
                  <FormTextInput
                    format="capital"
                    label="GSTN"
                    placeholder="GSTN"
                    value={form.values.gstn}
                    onChange={(e) => form.setFieldValue("gstn", e.target.value)}
                    readOnly={isReadOnly}
                    error={form.errors.gstn}
                  />
                </Grid.Col>
              </>
            )}
            {isKenyaUser && (
              <Grid.Col span={2}>
                <FormTextInput
                  format="capital"
                  label="PIN number"
                  placeholder="PIN number"
                  value={form.values.gstn}
                  onChange={(e) => form.setFieldValue("gstn", e.target.value)}
                  readOnly={isReadOnly}
                  error={form.errors.gstn}
                />
              </Grid.Col>
            )}
            <Grid.Col span={2}>
              <FormTextInput
                format="capital"
                label={isAgentInvoice ? "Job id" : "Shipment No"}
                placeholder={isAgentInvoice ? "Job id" : "Shipment No"}
                value={form.values.shipment_no}
                onChange={(e) =>
                  form.setFieldValue("shipment_no", e.target.value)
                }
                // disabled={isReadOnly}
                readOnly={isReadOnly}
                withAsterisk
                error={form.errors.shipment_no}
              />
            </Grid.Col>
            <Grid.Col span={2}>
              <Dropdown
                label="Daybook"
                placeholder="Select daybook"
                data={daybookOptions}
                value={form.values.daybook_id || null}
                onChange={(value) =>
                  form.setFieldValue("daybook_id", value ?? "")
                }
                searchable
                withAsterisk
                // disabled={isReadOnly}
                readOnly={isReadOnly}
                error={form.errors.daybook_id}
              />
            </Grid.Col>
            <Grid.Col span={2}>
              <SingleDateInput
                label="Document Date"
                placeholder="Document Date"
                value={normalizeDate(form.values.document_date)}
                onChange={(date) => form.setFieldValue("document_date", date)}
                withAsterisk
                // disabled={isReadOnly}
                readOnly={isReadOnly}
                error={
                  form.errors.document_date
                    ? typeof form.errors.document_date === "string"
                      ? form.errors.document_date
                      : String(form.errors.document_date)
                    : undefined
                }
              />
            </Grid.Col>
            <Grid.Col span={2}>
              <SingleDateInput
                label="Due Date"
                placeholder="Due Date"
                value={normalizeDate(form.values.due_date)}
                onChange={(date) => form.setFieldValue("due_date", date)}
                withAsterisk
                // disabled={isReadOnly}
                readOnly={isReadOnly}
                error={
                  form.errors.due_date
                    ? typeof form.errors.due_date === "string"
                      ? form.errors.due_date
                      : String(form.errors.due_date)
                    : undefined
                }
              />
            </Grid.Col>
            <Grid.Col span={2}>
              <Dropdown
                label="Billing Currency"
                placeholder="Select currency"
                data={currencyOptions}
                value={form.values.currency || null}
                onChange={(value) =>
                  form.setFieldValue("currency", value ?? "")
                }
                searchable
                withAsterisk
                // disabled={isReadOnly}
                readOnly={isReadOnly}
                error={form.errors.currency}
              />
            </Grid.Col>
            <Grid.Col span={2}>
              <FormNumberInput
                label="ROE"
                placeholder="ROE"
                value={form.values.roe ?? undefined}
                onChange={(value) =>
                  form.setFieldValue(
                    "roe",
                    typeof value === "number"
                      ? value
                      : value === ""
                        ? null
                        : parseFloat(String(value)) || null,
                  )
                }
                // disabled={isReadOnly}
                readOnly={isReadOnly}
                withAsterisk
                min={0}
                decimalScale={4}
                hideControls
                error={form.errors.roe}
              />
            </Grid.Col>
            {!isKenyaUser && (
              <Grid.Col span={2}>
                <FormTextInput
                  format="capital"
                  label="IRN No"
                  placeholder="IRN No"
                  value={form.values.irn_no}
                  onChange={(e) => form.setFieldValue("irn_no", e.target.value)}
                  readOnly={isReadOnly}
                  error={form.errors.irn_no}
                />
              </Grid.Col>
            )}
            {isChinaUser && (
              <Grid.Col span={2}>
                <FormTextInput
                  format="capital"
                  label="Fapiao No"
                  placeholder="Fapiao No"
                  value={form.values.fapiao_no}
                  readOnly
                />
              </Grid.Col>
            )}
            <Grid.Col span={6}>
              {addressOptions.length > 0 ? (
                <Dropdown
                  label="Address"
                  placeholder="Select address"
                  data={addressOptions}
                  value={form.values.address}
                  dropdownZIndex={1000}
                  onChange={(value) =>
                    form.setFieldValue("address", value || "")
                  }
                  searchable
                  withAsterisk
                  readOnly={isReadOnly}
                  error={
                    form.errors.address
                      ? String(form.errors.address)
                      : undefined
                  }
                />
              ) : (
                <FormTextInput
                  label="Address"
                  placeholder="Address"
                  value={form.values.address}
                  onChange={(e) =>
                    form.setFieldValue("address", e.target.value)
                  }
                  readOnly={isReadOnly}
                  withAsterisk
                  error={form.errors.address}
                />
              )}
            </Grid.Col>
            <Grid.Col span={6}>
              <FormTextArea
                label="Narration"
                placeholder="Narration"
                value={form.values.narration}
                onChange={(e) =>
                  form.setFieldValue("narration", e.target.value)
                }
                // disabled={isReadOnly}
                readOnly={isReadOnly}
                rows={2}
                error={form.errors.narration}
              />
            </Grid.Col>
          </Grid>

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
                <Box mb="sm" mt="md">
                  <Grid
                    w="100%"
                    gutter="sm"
                    py="sm"
                    style={{
                      position: "sticky",
                      top: 45,
                      zIndex: 100,
                      backgroundColor: "white",
                      fontWeight: 600,
                      color: "#105476",
                    }}
                  >
                    {isAgentInvoice && (
                      <Grid.Col span={1} style={{ fontSize: "13px" }}>
                        Shipment id
                      </Grid.Col>
                    )}
                    <Grid.Col
                      span={isAgentInvoice ? 1.3 : 1.5}
                      style={{ fontSize: "13px" }}
                    >
                      Charge
                    </Grid.Col>
                    <Grid.Col span={1} style={{ fontSize: "13px" }}>
                      Unit
                    </Grid.Col>
                    <Grid.Col span={1} style={{ fontSize: "13px" }}>
                      Currency
                    </Grid.Col>
                    <Grid.Col span={0.45} style={{ fontSize: "13px" }}>
                      ROE
                    </Grid.Col>
                    <Grid.Col span={0.65} style={{ fontSize: "13px" }}>
                      No of Unit
                    </Grid.Col>
                    <Grid.Col span={1} style={{ fontSize: "13px" }}>
                      Amount per Unit
                    </Grid.Col>
                    <Grid.Col span={1} style={{ fontSize: "13px" }}>
                      Currency Amount
                    </Grid.Col>
                    <Grid.Col span={1} style={{ fontSize: "13px" }}>
                      Amount in{" "}
                      {form.values.currency
                        ? form.values.currency.toUpperCase()
                        : "()"}
                    </Grid.Col>
                    <Grid.Col span={0.8} style={{ fontSize: "13px" }}>
                      Local Amount
                    </Grid.Col>
                    {isGstInvoiceUser && (
                      <Grid.Col span={0.8} style={{ fontSize: "13px" }}>
                        SAC Code
                      </Grid.Col>
                    )}
                    <Grid.Col span={0.55} style={{ fontSize: "13px" }}>
                      Dr/Cr
                    </Grid.Col>
                    {isVatInvoiceUser && (
                      <Grid.Col span={0.8} style={{ fontSize: "13px" }}>
                        VAT Rate %
                      </Grid.Col>
                    )}
                    {isVatInvoiceUser && (
                      <Grid.Col span={0.8} style={{ fontSize: "13px" }}>
                        VAT Amount
                      </Grid.Col>
                    )}
                    {applyGst && headerSameState === true && (
                      <Grid.Col span={0.55} style={{ fontSize: "13px" }}>
                        CGST
                      </Grid.Col>
                    )}
                    {applyGst && headerSameState === true && (
                      <Grid.Col span={0.55} style={{ fontSize: "13px" }}>
                        SGST
                      </Grid.Col>
                    )}
                    {applyGst && headerSameState === false && (
                      <Grid.Col span={0.55} style={{ fontSize: "13px" }}>
                        IGST
                      </Grid.Col>
                    )}
                    {!isReadOnly && (
                      <Grid.Col span={0.5} style={{ fontSize: "13px" }}>
                        Actions
                      </Grid.Col>
                    )}
                  </Grid>
                  {form.values.charges.map((charge, index) => (
                    <Grid
                      key={index}
                      w="100%"
                      gutter="sm"
                      mt={index !== 0 ? "sm" : 0}
                    >
                      {isAgentInvoice && (
                        <Grid.Col span={1}>
                          <FormTextInput
                            value={
                              charge.shipment_id ??
                              form.values.shipment_no ??
                              ""
                            }
                            readOnly
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
                      )}
                      <Grid.Col span={isAgentInvoice ? 1.3 : 1.5}>
                        <SearchableSelect
                          placeholder="Type charge name"
                          apiEndpoint={URL.chargeMaster}
                          searchFields={["charge_name", "charge_code"]}
                          displayFormat={(item: Record<string, unknown>) => ({
                            value: String(item.id ?? ""),
                            label: String(item.charge_name ?? ""),
                          })}
                          value={
                            charge.charge_id != null
                              ? String(charge.charge_id)
                              : null
                          }
                          displayValue={charge.charge_name || undefined}
                          onChange={(value, selectedData) => {
                            const chargeId = value ? Number(value) : null;
                            const chargeName = selectedData?.label ?? "";
                            form.setFieldValue(
                              `charges.${index}.charge_id`,
                              chargeId,
                            );
                            form.setFieldValue(
                              `charges.${index}.charge_name`,
                              chargeName,
                            );
                            form.setFieldValue(`charges.${index}.tax_code`, "");
                            if (chargeErrors[index]?.charge_name) {
                              const newErrors = { ...chargeErrors };
                              if (newErrors[index]) {
                                delete newErrors[index].charge_name;
                                if (Object.keys(newErrors[index]).length === 0)
                                  delete newErrors[index];
                              }
                              setChargeErrors(newErrors);
                            }
                            if (
                              chargeId != null &&
                              jobServiceId != null &&
                              isGstInvoiceUser
                            ) {
                              fetchGetEffectiveSac([
                                {
                                  charge_id: chargeId,
                                  service_id: jobServiceId,
                                },
                              ]).then((data) => {
                                const item = data.find(
                                  (x) => x.charge_id === chargeId,
                                );
                                if (
                                  item?.sac_code != null &&
                                  item.sac_code !== ""
                                ) {
                                  form.setFieldValue(
                                    `charges.${index}.tax_code`,
                                    item.sac_code,
                                  );
                                  if (chargeErrors[index]?.tax_code) {
                                    const newErrors = { ...chargeErrors };
                                    if (newErrors[index]) {
                                      delete newErrors[index].tax_code;
                                      if (
                                        Object.keys(newErrors[index]).length ===
                                        0
                                      )
                                        delete newErrors[index];
                                    }
                                    setChargeErrors(newErrors);
                                  }
                                }
                              });
                            }
                          }}
                          withAsterisk
                          //disabled={isReadOnly}
                          readOnly={isReadOnly}
                          error={chargeErrors[index]?.charge_name}
                          minSearchLength={2}
                          dropdownZIndex={1000}
                        />
                      </Grid.Col>
                      <Grid.Col span={1}>
                        <Dropdown
                          placeholder="Unit"
                          data={unitOptions}
                          value={charge.unit_code || null}
                          onChange={(value) =>
                            form.setFieldValue(
                              `charges.${index}.unit_code`,
                              value ?? "",
                            )
                          }
                          searchable
                          //disabled={isReadOnly}
                          readOnly={isReadOnly}
                        />
                      </Grid.Col>
                      <Grid.Col span={1}>
                        <Dropdown
                          placeholder="Currency"
                          data={currencyOptions}
                          value={charge.currency || null}
                          onChange={(value) => {
                            form.setFieldValue(
                              `charges.${index}.currency`,
                              value ?? "",
                            );
                            if (chargeErrors[index]?.currency) {
                              const newErrors = { ...chargeErrors };
                              if (newErrors[index]) {
                                delete newErrors[index].currency;
                                if (Object.keys(newErrors[index]).length === 0)
                                  delete newErrors[index];
                              }
                              setChargeErrors(newErrors);
                            }
                          }}
                          searchable
                          withAsterisk
                          //disabled={isReadOnly}
                          readOnly={isReadOnly}
                          error={chargeErrors[index]?.currency}
                        />
                      </Grid.Col>
                      <Grid.Col span={0.45}>
                        <FormNumberInput
                          placeholder="ROE"
                          value={charge.roe ?? undefined}
                          onChange={(v) => {
                            form.setFieldValue(
                              `charges.${index}.roe`,
                              typeof v === "number"
                                ? v
                                : v === ""
                                  ? null
                                  : parseFloat(String(v)) || null,
                            );
                            if (chargeErrors[index]?.roe) {
                              const newErrors = { ...chargeErrors };
                              if (newErrors[index]) {
                                delete newErrors[index].roe;
                                if (Object.keys(newErrors[index]).length === 0)
                                  delete newErrors[index];
                              }
                              setChargeErrors(newErrors);
                            }
                          }}
                          hideControls
                          withAsterisk
                          //disabled={isReadOnly}
                          readOnly={isReadOnly}
                          error={chargeErrors[index]?.roe}
                        />
                      </Grid.Col>
                      <Grid.Col span={0.65}>
                        <FormNumberInput
                          value={charge.no_of_unit ?? undefined}
                          onChange={(v) =>
                            form.setFieldValue(
                              `charges.${index}.no_of_unit`,
                              typeof v === "number"
                                ? parseNoOfUnitForPayload(v)
                                : v === ""
                                  ? null
                                  : parseNoOfUnitForPayload(String(v)),
                            )
                          }
                          min={0}
                          decimalScale={3}
                          hideControls
                          //disabled={isReadOnly}
                          readOnly={isReadOnly}
                        />
                      </Grid.Col>
                      <Grid.Col span={1}>
                        <FormNumberInput
                          value={charge.amount_per_unit ?? undefined}
                          onChange={(v) =>
                            form.setFieldValue(
                              `charges.${index}.amount_per_unit`,
                              clampAmount(
                                typeof v === "number"
                                  ? v
                                  : v === ""
                                    ? null
                                    : parseFloat(String(v)) || null,
                              ),
                            )
                          }
                          min={0}
                          decimalScale={amountDecimalScale}
                          hideControls
                          //disabled={isReadOnly}
                          readOnly={isReadOnly}
                        />
                      </Grid.Col>
                      <Grid.Col span={1}>
                        <FormNumberInput
                          placeholder="Currency Amount"
                          value={charge.amount ?? undefined}
                          onChange={(v) => {
                            form.setFieldValue(
                              `charges.${index}.amount`,
                              clampAmount(
                                typeof v === "number"
                                  ? v
                                  : v === ""
                                    ? null
                                    : parseFloat(String(v)) || null,
                              ),
                            );
                            if (chargeErrors[index]?.amount) {
                              const newErrors = { ...chargeErrors };
                              if (newErrors[index]) {
                                delete newErrors[index].amount;
                                if (Object.keys(newErrors[index]).length === 0)
                                  delete newErrors[index];
                              }
                              setChargeErrors(newErrors);
                            }
                          }}
                          min={0}
                          decimalScale={amountDecimalScale}
                          hideControls
                          withAsterisk
                          //disabled={isReadOnly}
                          readOnly={isReadOnly}
                          error={chargeErrors[index]?.amount}
                        />
                      </Grid.Col>
                      <Grid.Col span={1}>
                        <FormNumberInput
                          value={charge.header_amount ?? undefined}
                          onChange={(v) =>
                            form.setFieldValue(
                              `charges.${index}.header_amount`,
                              clampAmount(
                                typeof v === "number"
                                  ? v
                                  : v === ""
                                    ? null
                                    : parseFloat(String(v)) || null,
                              ),
                            )
                          }
                          min={0}
                          decimalScale={amountDecimalScale}
                          hideControls
                          groupThousands
                          //disabled={isReadOnly}
                          readOnly={isReadOnly}
                        />
                      </Grid.Col>
                      <Grid.Col span={0.8}>
                        <FormNumberInput
                          placeholder="Local Amount"
                          groupThousands
                          value={charge.amount_in_local ?? undefined}
                          onChange={(v) => {
                            form.setFieldValue(
                              `charges.${index}.amount_in_local`,
                              clampAmount(
                                typeof v === "number"
                                  ? v
                                  : v === ""
                                    ? null
                                    : parseFloat(String(v)) || null,
                              ),
                            );
                            if (chargeErrors[index]?.amount_in_local) {
                              const newErrors = { ...chargeErrors };
                              if (newErrors[index]) {
                                delete newErrors[index].amount_in_local;
                                if (Object.keys(newErrors[index]).length === 0)
                                  delete newErrors[index];
                              }
                              setChargeErrors(newErrors);
                            }
                          }}
                          min={0}
                          decimalScale={amountDecimalScale}
                          hideControls
                          withAsterisk
                          //disabled={isReadOnly}
                          readOnly={isReadOnly}
                          error={chargeErrors[index]?.amount_in_local}
                        />
                      </Grid.Col>
                      {isGstInvoiceUser && (
                        <Grid.Col span={0.8}>
                          <FormTextInput
                            format="normal"
                            placeholder="SAC Code"
                            value={charge.tax_code}
                            readOnly={isReadOnly}
                            error={chargeErrors[index]?.tax_code}
                            rightSection={
                              applyGst &&
                              gstRatesLoadingByIndex[index] &&
                              (!charge.tax_code ||
                                charge.tax_code.trim() === "") ? (
                                <Loader size="xs" color="#105476" />
                              ) : null
                            }
                          />
                        </Grid.Col>
                      )}
                      <Grid.Col span={0.55}>
                        <Dropdown
                          placeholder="Dr/Cr"
                          data={[
                            { value: "Cr", label: "Cr" },
                            { value: "Dr", label: "Dr" },
                          ]}
                          value={charge.dr_cr ?? "Cr"}
                          onChange={(value) =>
                            form.setFieldValue(
                              `charges.${index}.dr_cr`,
                              (value === "Dr" ? "Dr" : "Cr") as "Cr" | "Dr",
                            )
                          }
                          readOnly={isReadOnly}
                        />
                      </Grid.Col>
                      {isVatInvoiceUser && (
                        <Grid.Col span={0.8}>
                          <FormNumberInput
                            placeholder="VAT %"
                            min={0}
                            max={100}
                            hideControls
                            readOnly={isReadOnly}
                            value={(() => {
                              // Empty stays empty; only this row's rate (incl. 0).
                              if (charge.tax_rate == null) return undefined;
                              const rate = Number(charge.tax_rate);
                              return Number.isFinite(rate) ? rate : undefined;
                            })()}
                            onChange={(value) => {
                              if (
                                value === "" ||
                                value === null ||
                                value === undefined
                              ) {
                                form.setFieldValue(
                                  `charges.${index}.tax_rate`,
                                  null,
                                );
                                form.setFieldValue(
                                  `charges.${index}.tax_amount`,
                                  null,
                                );
                                return;
                              }
                              const parsed = clampMoneyAmount(
                                value as number | null,
                                false,
                              );
                              form.setFieldValue(
                                `charges.${index}.tax_rate`,
                                parsed,
                              );
                              const taxBase =
                                charge.amount_in_local ?? charge.header_amount;
                              form.setFieldValue(
                                `charges.${index}.tax_amount`,
                                calcTaxAmountFromRate(taxBase, parsed),
                              );
                            }}
                          />
                        </Grid.Col>
                      )}
                      {isVatInvoiceUser && (
                        <Grid.Col span={0.8}>
                          <FormNumberInput
                            placeholder="VAT Amount"
                            min={0}
                            hideControls
                            decimalScale={amountDecimalScale}
                            readOnly
                            value={(() => {
                              if (isReverseTaxChargeRow(charge))
                                return undefined;
                              const rate = resolveVatTaxRate(
                                null,
                                charge.charge_id,
                                charge.tax_rate,
                              );
                              const taxBase =
                                charge.amount_in_local ?? charge.header_amount;
                              if (rate > 0 && taxBase != null) {
                                const amount = calcTaxAmountFromRate(
                                  taxBase,
                                  rate,
                                );
                                return amount > 0 ? amount : undefined;
                              }
                              if (
                                charge.tax_amount != null &&
                                Number(charge.tax_amount) > 0
                              ) {
                                return Number(charge.tax_amount);
                              }
                              return undefined;
                            })()}
                          />
                        </Grid.Col>
                      )}
                      {applyGst && headerSameState === true && (
                        <Grid.Col span={0.55}>
                          <FormTextInput
                            placeholder="CGST"
                            value={(() => {
                              if (isReverseTaxChargeRow(charge)) return "";
                              const rate = gstRatesByChargeIndex[index]?.cgst;
                              const localAmount = charge.amount_in_local;
                              if (rate == null || localAmount == null)
                                return "";
                              const amount = clampAmount(
                                (localAmount * rate) / 100,
                              );
                              return amount != null ? String(amount) : "";
                            })()}
                            readOnly
                            rightSection={(() => {
                              if (isReverseTaxChargeRow(charge)) return null;
                              const rate = gstRatesByChargeIndex[index]?.cgst;
                              const localAmount = charge.amount_in_local;
                              const amount =
                                rate == null || localAmount == null
                                  ? null
                                  : clampAmount((localAmount * rate) / 100);
                              const display =
                                amount != null ? String(amount) : "";
                              return gstRatesLoadingByIndex[index] &&
                                display === "" ? (
                                <Loader size="xs" color="#105476" />
                              ) : null;
                            })()}
                            styles={{
                              root: { flex: "0 0 88px" },
                              input: {
                                fontSize: "11px",
                                fontFamily: "Inter",
                                height: "28px",
                              },
                            }}
                          />
                        </Grid.Col>
                      )}
                      {applyGst && headerSameState === true && (
                        <Grid.Col span={0.55}>
                          <FormTextInput
                            placeholder="SGST"
                            value={(() => {
                              if (isReverseTaxChargeRow(charge)) return "";
                              const rate = gstRatesByChargeIndex[index]?.sgst;
                              const localAmount = charge.amount_in_local;
                              if (rate == null || localAmount == null)
                                return "";
                              const amount = clampAmount(
                                (localAmount * rate) / 100,
                              );
                              return amount != null ? String(amount) : "";
                            })()}
                            readOnly
                            rightSection={(() => {
                              if (isReverseTaxChargeRow(charge)) return null;
                              const rate = gstRatesByChargeIndex[index]?.sgst;
                              const localAmount = charge.amount_in_local;
                              const amount =
                                rate == null || localAmount == null
                                  ? null
                                  : clampAmount((localAmount * rate) / 100);
                              const display =
                                amount != null ? String(amount) : "";
                              return gstRatesLoadingByIndex[index] &&
                                display === "" ? (
                                <Loader size="xs" color="#105476" />
                              ) : null;
                            })()}
                            styles={{
                              root: { flex: "0 0 88px" },
                              input: {
                                fontSize: "11px",
                                fontFamily: "Inter",
                                height: "28px",
                              },
                            }}
                          />
                        </Grid.Col>
                      )}
                      {applyGst && headerSameState === false && (
                        <Grid.Col span={0.55}>
                          <FormTextInput
                            placeholder="IGST"
                            value={(() => {
                              if (isReverseTaxChargeRow(charge)) return "";
                              const rate = gstRatesByChargeIndex[index]?.igst;
                              const localAmount = charge.amount_in_local;
                              if (rate == null || localAmount == null)
                                return "";
                              const amount = clampAmount(
                                (localAmount * rate) / 100,
                              );
                              return amount != null ? String(amount) : "";
                            })()}
                            readOnly
                            rightSection={(() => {
                              if (isReverseTaxChargeRow(charge)) return null;
                              const rate = gstRatesByChargeIndex[index]?.igst;
                              const localAmount = charge.amount_in_local;
                              const amount =
                                rate == null || localAmount == null
                                  ? null
                                  : clampAmount((localAmount * rate) / 100);
                              const display =
                                amount != null ? String(amount) : "";
                              return gstRatesLoadingByIndex[index] &&
                                display === "" ? (
                                <Loader size="xs" color="#105476" />
                              ) : null;
                            })()}
                            styles={{
                              root: { flex: "0 0 88px" },
                              input: {
                                fontSize: "11px",
                                fontFamily: "Inter",
                                height: "28px",
                              },
                            }}
                          />
                        </Grid.Col>
                      )}
                      <Grid.Col span={0.5}>
                        {!isReadOnly && (
                          <Group gap="xs">
                            {form.values.charges.length > 1 && (
                              <Button
                                variant="light"
                                color="red"
                                size="sm"
                                px={12}
                                onClick={() => {
                                  setGstRatesByChargeIndex((prev) => {
                                    const next: Record<
                                      number,
                                      GstRates | null
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
                                  setGstRatesLoadingByIndex((prev) => {
                                    const next: Record<number, boolean> = {};
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
                                <IconTrash size={16} />
                              </Button>
                            )}
                            {/* Add charge disabled on invoice reverse – charges can only be deleted */}
                            {/* {form.values.charges.length - 1 === index && (
                              <Button
                                radius="sm"
                                px={12}
                                size="sm"
                                variant="light"
                                color="#105476"
                                onClick={() => {
                                  const newCurrency = form.values.currency || "";
                                  form.insertListItem("charges", {
                                    charge_id: null,
                                    charge_name: "",
                                    unit_code: "",
                                    no_of_unit: null,
                                    currency: newCurrency,
                                    roe: null,
                                    amount_per_unit: null,
                                    amount: null,
                                    header_amount: null,
                                    amount_in_local: null,
                                    tax_code: "",
                                    dr_cr: "Cr",
                                  });
                                }}
                              >
                                <IconPlus size={16} />
                              </Button>
                            )} */}
                          </Group>
                        )}
                      </Grid.Col>
                    </Grid>
                  ))}
                </Box>
                {/* Totals — net local total; GST/VAT tax totals when applicable */}
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
                      <Grid.Col span={isVatInvoiceUser ? 6 : applyGst ? 3 : 6}>
                        <Box>
                          <Text size="sm" fw={500} c="dimmed" mb={4}>
                            Local Amount Total
                          </Text>
                          <Text size="lg" fw={600} c="#105476">
                            {formatMoneyAmountForUi(
                              chargeSectionTotals.local_total,
                            )}
                          </Text>
                        </Box>
                      </Grid.Col>
                      {isVatInvoiceUser && (
                        <Grid.Col span={6}>
                          <Box>
                            <Text size="sm" fw={500} c="dimmed" mb={4}>
                              VAT Total
                            </Text>
                            <Text size="lg" fw={600} c="#105476">
                              {formatMoneyAmountForUi(vatSectionTotal)}
                            </Text>
                          </Box>
                        </Grid.Col>
                      )}
                      {applyGst && (
                        <>
                          <Grid.Col span={3}>
                            <Box>
                              <Text size="sm" fw={500} c="dimmed" mb={4}>
                                IGST Total
                              </Text>
                              <Text size="lg" fw={600} c="#105476">
                                {formatMoneyAmountForUi(
                                  gstSectionTotals.igst_total,
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
                                  gstSectionTotals.cgst_total,
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
                                  gstSectionTotals.sgst_total,
                                )}
                              </Text>
                            </Box>
                          </Grid.Col>
                        </>
                      )}
                    </Grid>
                  </Box>
                )}
              </Tabs.Panel>

              {saveResponse && showTaxTab && (
                <Tabs.Panel value="tax">
                  {gstBreakupLoading && (
                    <Stack align="center" py="xl">
                      <Loader size="md" color="#105476" />
                      <Text size="sm" c="dimmed">
                        {isVatInvoiceUser
                          ? "Loading VAT breakup..."
                          : "Loading GST breakup..."}
                      </Text>
                    </Stack>
                  )}
                  {!gstBreakupLoading &&
                    !gstBreakup &&
                    chargesTabActive === "tax" &&
                    saveResponse?.id && (
                      <Text size="sm" c="dimmed" py="md">
                        {isVatInvoiceUser
                          ? "No VAT breakup data."
                          : "No GST breakup data."}
                      </Text>
                    )}
                  {!gstBreakupLoading && gstBreakup && isVatInvoiceUser && (
                    <>
                      <ScrollArea mt="md">
                        <Table
                          withTableBorder
                          withColumnBorders
                          striped
                          highlightOnHover
                          style={{ minWidth: 520 }}
                        >
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th
                                style={{ fontSize: "12px", fontWeight: 600 }}
                              >
                                Tax Name
                              </Table.Th>
                              <Table.Th
                                style={{ fontSize: "12px", fontWeight: 600 }}
                              >
                                Rate
                              </Table.Th>
                              <Table.Th
                                style={{ fontSize: "12px", fontWeight: 600 }}
                              >
                                Tax Amount
                              </Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {(gstBreakup.percentage_wise_totals ?? []).map(
                              (row, idx) => (
                                <Table.Tr key={idx}>
                                  <Table.Td style={{ fontSize: "13px" }}>
                                    {row.rate_name ?? "—"}
                                  </Table.Td>
                                  <Table.Td style={{ fontSize: "13px" }}>
                                    {(() => {
                                      const rateVal = row.rate ?? row.tax_rate;
                                      const rateType = row.rate_type ?? "";
                                      if (
                                        rateVal == null ||
                                        String(rateVal).trim() === ""
                                      )
                                        return "—";
                                      const typeStr = String(rateType).trim();
                                      if (typeStr === "%" || typeStr === "％")
                                        return `${rateVal}%`;
                                      if (typeStr !== "")
                                        return `${rateVal}${typeStr}`;
                                      return String(rateVal);
                                    })()}
                                  </Table.Td>
                                  <Table.Td style={{ fontSize: "13px" }}>
                                    {row.taxable_total != null
                                      ? formatMoneyAmountForUi(
                                          Number(row.taxable_total),
                                        )
                                      : "—"}
                                  </Table.Td>
                                </Table.Tr>
                              ),
                            )}
                          </Table.Tbody>
                          <Table.Tfoot>
                            <Table.Tr>
                              <Table.Td colSpan={2} />
                              <Table.Td
                                style={{
                                  fontSize: "13px",
                                  fontWeight: 600,
                                  color: "#105476",
                                }}
                              >
                                Total: {gstBreakup.total ?? "0.00"}
                              </Table.Td>
                            </Table.Tr>
                          </Table.Tfoot>
                        </Table>
                      </ScrollArea>
                    </>
                  )}
                  {!gstBreakupLoading && gstBreakup && applyGst && (
                    <>
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
                                    {row.charge_name ?? "—"}
                                  </Table.Td>
                                  <Table.Td style={{ fontSize: "13px" }}>
                                    {row.rate != null && row.rate_type != null
                                      ? `${row.rate}${row.rate_type}`
                                      : "—"}
                                  </Table.Td>
                                  <Table.Td style={{ fontSize: "13px" }}>
                                    {row.total_amount != null
                                      ? Number(row.total_amount)
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
                                {gstBreakup.total ?? "0.00"}
                              </Table.Td>
                            </Table.Tr>
                          </Table.Tfoot>
                        </Table>
                      </ScrollArea>
                    </>
                  )}
                  {/* {chargesTabActive === "tax" &&
                    saveResponse &&
                    (!saveResponse.id || saveResponse.customer_id == null) && (
                      <Text size="sm" c="dimmed" py="md">
                        Save the reverse invoice to load GST breakup (customer_id from response is required).
                      </Text>
                    )} */}
                  {chargesTabActive === "tax" &&
                    saveResponse &&
                    !saveResponse.id && (
                      <Text size="sm" c="dimmed" py="md">
                        Save the reverse invoice to load GST breakup.
                      </Text>
                    )}
                </Tabs.Panel>
              )}
            </Tabs>
          </Box>

          <Group justify="flex-end" mt="xl">
            <Button variant="outline" color="#105476" onClick={navigateBack}>
              Cancel
            </Button>
            {!isReadOnly && (
              <>
                <Button
                  type="submit"
                  color="#105476"
                  rightSection={<IconChevronRight size={16} />}
                  loading={isSubmitting}
                >
                  {saveResponse?.id
                    ? "Update Invoice Reverse"
                    : "Save Invoice Reverse"}
                </Button>
                {saveResponse &&
                  canPostDocuments &&
                  saveResponse.status?.toUpperCase() === "UNPOSTED" &&
                  !invoiceIsPosted && (
                    <Button
                      type="button"
                      color="black"
                      variant="filled"
                      loading={isPosting}
                      onClick={handlePostInvoiceReverse}
                    >
                      Post Invoice Reverse
                    </Button>
                  )}
              </>
            )}
          </Group>
        </Box>
      </Stack>
    </Box>
  );
}

export default InvoiceReverse;
