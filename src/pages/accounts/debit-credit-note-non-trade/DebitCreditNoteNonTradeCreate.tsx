import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Center,
  FileButton,
  Grid,
  Group,
  Loader,
  Menu,
  Modal,
  Stack,
  Text,
} from "@mantine/core";
import {
  IconArrowLeft,
  IconDotsVertical,
  IconDownload,
  IconEye,
  IconPlus,
  IconTrash,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import { useForm } from "@mantine/form";
import { useQuery } from "@tanstack/react-query";
import {
  SingleDateInput,
  Dropdown,
  SearchableSelect,
} from "../../../components";
import { apiCallProtected } from "../../../api/axios";
import { URL } from "../../../api/serverUrls";
import dayjs from "dayjs";
import { getAPICall } from "../../../service/getApiCall";
import { postAPICall } from "../../../service/postApiCall";
import { putAPICall } from "../../../service/putApiCall";
import { API_HEADER } from "../../../store/storeKeys";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import EditPageHeadingRow from "../../../components/EditPageHeadingRow";
import FormTextInput from "../../../components/FormTextInput";
import ToastNotification from "../../../components/ToastNotification";
import { commonSearchAPI } from "../../../service/searchApi";
import {
  findJobCreateDropdownRow,
  jobCreateDropdownDisplayFormat,
} from "../../../utils/jobCreateDropdown";
import { useAccountsDocumentCurrencyRoe } from "../../../hooks/useAccountsDocumentCurrencyRoe";
import { useCanPostDocuments } from "../../../hooks/useCanPostDocuments";
import {
  formatRoeAsString,
  parseRoeForPayload,
  sanitizeRoeInput,
} from "../../../utils/exchangeRateRoe";
import {
  bindMoneyWholeNumberMode,
  clampCurrencyMoneyAmountBound,
  clampMoneyAmountBound,
  formatCurrencyAmountForUi,
  formatMoneyAmountForUi,
  isVietnamBranchFromUser,
  roundLocalMoneyToDecimals,
} from "../../../utils/nonDecimalMoneyAmount";
import useAuthStore from "../../../store/authStore";
import {
  extractPartyAddressesFromRecord,
  findPrimaryPartyAddress,
  getPartyGstFromPrimaryAddress,
  resolveStateCodeFromPartyAddress,
} from "../../../utils/paymentRequestChargePrefill";
import {
  isIndianOutstandingBranch,
  isIndianUserCountry,
} from "../../../utils/userNumberFormat";

const fetchCurrencyMaster = async () => {
  try {
    const response = await getAPICall(`${URL.currencyMaster}`, API_HEADER);
    const maybeWrapped = response as { data?: unknown };
    const payload = maybeWrapped?.data ?? response;
    if (Array.isArray(payload)) return payload;
    if (
      payload &&
      typeof payload === "object" &&
      Array.isArray((payload as { data?: unknown }).data)
    ) {
      return (payload as { data: unknown[] }).data;
    }
    return [];
  } catch (error) {
    console.error("Error fetching currency master:", error);
    return [];
  }
};

const fetchStateMaster = async () => {
  try {
    const response = await getAPICall(`${URL.state}`, API_HEADER);
    return (response as { data?: unknown[] })?.data ?? response ?? [];
  } catch (error) {
    console.error("Error fetching state master:", error);
    return [];
  }
};

// Fetch effective SAC for charge + service: POST { items: [{ charge_id, service_id }] }
const fetchGetEffectiveSac = async (
  items: { charge_id: number; service_id: number }[],
): Promise<
  Array<{ charge_id: number; service_id: number; sac_code?: string | null }>
> => {
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
  } catch (e) {
    console.error("Failed to fetch effective SAC", e);
    return [];
  }
};

// daybook is loaded via SearchableSelect (no preload)

// customers are loaded via SearchableSelect (no preload)

const CRN_OPTIONS = ["Cost", "Revenue", "Neutral"];

type LineItem = {
  id: string;
  // Trade-only fields (kept optional to allow Non-Trade to reuse same structure)
  shipment_no?: string;
  service_id?: number | null;
  charge_id?: number | null;
  charge_name?: string;
  crn?: string;
  account_id: string; // chart of accounts id (dropdown background value)
  account_code: string;
  account_name: string;
  subledger: string;
  cost_center_code: string;
  cost_center_key: string;
  currency: string;
  roe: number | "";
  amount: number | "";
  amount_in_inr: number | "";
  local_amount: number | "";
  dr_cr: "Dr" | "Cr" | "";
  sac_code: string;
  narration: string;
  note: string;
};

function formatChartOfAccountsLabel(
  glName: string | null | undefined,
  glAccountCode: string | null | undefined,
  accountName: string | null | undefined,
): string {
  const a = String(glName ?? "").trim();
  const b = String(glAccountCode ?? "").trim();
  const c = String(accountName ?? "").trim();
  return [c, b, a].filter(Boolean).join(" - ");
}

function normalizeDrCr(value: unknown): "Dr" | "Cr" {
  const raw = String(value ?? "")
    .trim()
    .toUpperCase();
  if (raw === "CR" || raw === "CREDIT") return "Cr";
  if (raw === "DR" || raw === "DEBIT") return "Dr";
  return "Dr";
}

function lineHasAccountSelection(line: LineItem): boolean {
  return (
    String(line.account_id ?? "").trim() !== "" ||
    String(line.account_code ?? "").trim() !== "" ||
    String(line.account_name ?? "").trim() !== ""
  );
}

/** Charge or shipment is the charge-entry path; it locks account and subledger. */
function lineLocksAccountFields(line: LineItem, showTradeFields: boolean): boolean {
  if (line.charge_id != null) return true;
  return showTradeFields && String(line.shipment_no ?? "").trim() !== "";
}

function mapAccountFromChargeOriginal(
  originalData?: Record<string, unknown> | null,
): Pick<LineItem, "account_id" | "account_code" | "account_name" | "subledger"> {
  if (!originalData) {
    return {
      account_id: "",
      account_code: "",
      account_name: "",
      subledger: "",
    };
  }
  const idRaw = originalData.account_id;
  const account_id =
    idRaw != null &&
    String(idRaw).trim() !== "" &&
    Number.isFinite(Number(idRaw))
      ? String(idRaw)
      : "";
  const account_code = String(
    originalData.account_code ?? originalData.gl_account_code ?? "",
  ).trim();
  const name = String(originalData.account_name ?? "").trim();
  const glName = String(originalData.gl_name ?? "").trim();
  const subledger = String(
    originalData.subledger_code ?? originalData.sl_code ?? "",
  ).trim();
  return {
    account_id,
    account_code,
    account_name: formatChartOfAccountsLabel(glName, account_code, name),
    subledger,
  };
}

const CLEARED_ACCOUNT_FIELDS: Pick<
  LineItem,
  "account_id" | "account_code" | "account_name" | "subledger"
> = {
  account_id: "",
  account_code: "",
  account_name: "",
  subledger: "",
};

/** Same input metrics as Supplier Invoice charge rows. */
const chargeFieldStyles = {
  input: {
    fontSize: "13px",
    fontFamily: "Inter",
    height: "36px",
  },
};

const chargeHeaderTextStyle = {
  fontSize: "13px",
  fontFamily: "Inter",
  fontWeight: 600,
  color: "#105476",
} as const;

function unwrapGstPayload(raw: unknown): Record<string, unknown> {
  const asRecord = (value: unknown): Record<string, unknown> | null =>
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  const root = asRecord(raw) ?? {};
  const data = asRecord(root.data);
  const nested = data ? asRecord(data.data) : null;
  const hasBreakup = (record: Record<string, unknown> | null) =>
    record != null &&
    (record.sac_wise_totals != null ||
      record.charges != null ||
      record.cgst_total != null);
  if (hasBreakup(nested)) return nested as Record<string, unknown>;
  if (hasBreakup(data)) return data as Record<string, unknown>;
  return root;
}

const newLineItem = (n: number, currency = ""): LineItem => ({
  id: `line-${Date.now()}-${n}`,
  shipment_no: "",
  service_id: null,
  charge_id: null,
  charge_name: "",
  crn: "",
  account_id: "",
  account_code: "",
  account_name: "",
  subledger: "",
  cost_center_code: "",
  cost_center_key: "",
  currency,
  roe: "",
  amount: "",
  amount_in_inr: "",
  local_amount: "",
  dr_cr: "",
  sac_code: "",
  narration: "",
  note: "",
});

type CurrencyOption = { value: string; label: string };

type CurrencyMasterRow = {
  id?: number;
  currency_id?: number;
  currency_code?: string;
  code?: string;
};

function buildCurrencyOptions(data: unknown): CurrencyOption[] {
  if (!Array.isArray(data)) return [];
  return (data as CurrencyMasterRow[])
    .map((c) => {
      const rawId = c.id ?? c.currency_id;
      const code = String(c.currency_code ?? c.code ?? "")
        .trim()
        .toUpperCase();
      return {
        value: String(rawId ?? ""),
        label: code || String(rawId ?? ""),
      };
    })
    .filter((o) => o.value && o.label);
}

function buildCurrencyIdByCode(options: CurrencyOption[]): Map<string, string> {
  const map = new Map<string, string>();
  options.forEach((o) => map.set(o.label, o.value));
  return map;
}

function resolveCurrencyCodeFromId(
  currencyId: string | null | undefined,
  options: CurrencyOption[],
  fallbackCode = "",
): string {
  const fromId = options.find(
    (o) => o.value === String(currencyId ?? ""),
  )?.label;
  if (fromId) return fromId;
  return String(fallbackCode ?? "").trim().toUpperCase();
}

function resolveHeaderCurrencySelection(
  rawId: string | null,
  item: { value?: string; label?: string } | null | undefined,
  options: CurrencyOption[],
): { currencyId: string | null; code: string } {
  const selectedKey = rawId != null ? String(rawId).trim() : "";
  const itemLabel = item?.label?.trim().toUpperCase() ?? "";

  const byValue = options.find((o) => o.value === selectedKey);
  if (byValue) {
    return { currencyId: byValue.value, code: byValue.label };
  }

  const byLabel = options.find((o) => o.label === selectedKey.toUpperCase());
  if (byLabel) {
    return { currencyId: byLabel.value, code: byLabel.label };
  }

  if (itemLabel) {
    const fromItem = options.find((o) => o.label === itemLabel);
    return {
      currencyId: fromItem?.value ?? (selectedKey || null),
      code: itemLabel,
    };
  }

  return { currencyId: selectedKey || null, code: "" };
}

function resolveLineCurrencyContext(
  lineCurrency: string,
  idByCode: Map<string, string>,
): { code: string; currencyId: string | null } {
  const code = String(lineCurrency ?? "").trim().toUpperCase();
  const currencyId = code ? (idByCode.get(code) ?? null) : null;
  return { code, currencyId };
}

export function DebitCreditNoteCreateBase({
  payloadType,
  showTradeFields,
}: {
  payloadType: "non_trade" | "trade";
  showTradeFields: boolean;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const canPostDocuments = useCanPostDocuments();
  const user = useAuthStore((s) => s.user);
  const isVietnamBranch = useMemo(() => isVietnamBranchFromUser(user), [user]);
  bindMoneyWholeNumberMode(isVietnamBranch);
  useParams(); // keep route `:id` segment for identification
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [calcLoading, setCalcLoading] = useState(false);
  const [loadingText, setLoadingText] = useState<string>("");
  const isPrefillingRef = useRef(false);

  type SupportingDocument = {
    name: string;
    file: File | null;
  };
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<string | null>(null);
  const [saveResponse, setSaveResponse] = useState<Record<
    string,
    unknown
  > | null>(null);
  const chargeOriginalByIdRef = useRef<
    Record<string, Record<string, unknown> | null>
  >({});

  const isIndiaUser = useMemo(() => {
    const activeBranch =
      user?.branches?.find((b) => b.is_default) ?? user?.branches?.[0];
    const branchCountryCode = String(
      (activeBranch as { country?: { country_code?: string } } | undefined)
        ?.country?.country_code ?? "",
    )
      .trim()
      .toUpperCase();
    const branchCurrencyCode = String(
      (
        activeBranch as
          | { currency?: { currency_code?: string } }
          | undefined
      )?.currency?.currency_code ?? "",
    )
      .trim()
      .toUpperCase();
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

  /** Spans total 12 so the charge grid fills the row. Trade gives Charge more width. */
  const lineColSpans = useMemo(
    () =>
      showTradeFields
        ? {
            shipment: 0.95,
            charge: 1.2,
            crn: 0.6,
            account: 1.15,
            subledger: 0.7,
            code: 0.5,
            key: 0.5,
            currency: 0.65,
            roe: 0.5,
            amount: 0.7,
            localAmount: 0.75,
            headerAmount: 0.8,
            drCr: 0.5,
            sac: 0.6,
            narration: 0.7,
            note: 0.6,
            actions: 0.6,
          }
        : {
            shipment: 0,
            charge: 0,
            crn: 0,
            account: 1.9,
            subledger: 0.85,
            code: 0.65,
            key: 0.65,
            currency: 0.75,
            roe: 0.55,
            amount: 0.8,
            localAmount: 0.9,
            headerAmount: 0.95,
            drCr: 0.55,
            sac: 0.75,
            narration: 1.1,
            note: 0.9,
            actions: 0.7,
          },
    [showTradeFields],
  );

  type CustomerRow = {
    id?: number | string;
    customer_code?: string;
    customer_name?: string;
    name?: string;
    address?: string;
  };

  const {
    localCurrency,
    getBranchCurrencyDefaults,
    isLocalCurrency,
    syncRoeForCurrencyChange,
    onRoeValueChange,
    validateRoeField,
    validateRoeToast,
  } = useAccountsDocumentCurrencyRoe();
  const branchCurrencyDefaults = getBranchCurrencyDefaults();

  const form = useForm({
    initialValues: {
      daybookId: null as string | null,
      documentType: "",
      partyAccount: "",
      partyName: "",
      address: "",
      stateId: null as string | null,
      currencyId: branchCurrencyDefaults.currency_id || null,
      currencyCode: (branchCurrencyDefaults.currency_code || "").toUpperCase(),
      roe: (branchCurrencyDefaults.roe ?? "") as number | "",
      costCenter: "",
      documentDate: dayjs().toDate() as Date | null,
      documentNo: "",
      gstId: "",
      narration: "",
      note: "",
      lines: [newLineItem(0, branchCurrencyDefaults.currency_code || "")] as LineItem[],
      supporting_documents: [] as SupportingDocument[],
    },
  });

  // Cache resolved service_id for a shipment_no so we don't re-fetch repeatedly.
  const shipmentServiceIdCacheRef = useRef<Record<string, number | null>>({});

  const getServiceIdByShipmentNoAsync = async (
    shipmentNoRaw: string | null | undefined,
  ): Promise<number | null> => {
    const shipmentNo = String(shipmentNoRaw ?? "").trim();
    if (!shipmentNo) return null;
    if (shipmentNo in shipmentServiceIdCacheRef.current) {
      return shipmentServiceIdCacheRef.current[shipmentNo];
    }
    try {
      const results = await commonSearchAPI({
        endpoint: URL.filterJobCreate,
        query: shipmentNo,
      });
      const rows = Array.isArray(results)
        ? (results as Array<Record<string, unknown>>)
        : [];
      const match = findJobCreateDropdownRow(rows, shipmentNo);
      const serviceIdRaw =
        (
          match as
            | {
                service_id?: unknown;
                serviceId?: unknown;
                job?: { service_id?: unknown };
              }
            | undefined
        )?.service_id ??
        (match as { serviceId?: unknown } | undefined)?.serviceId ??
        (match as { job?: { service_id?: unknown } } | undefined)?.job
          ?.service_id ??
        null;
      const serviceId = serviceIdRaw != null ? Number(serviceIdRaw) : null;
      shipmentServiceIdCacheRef.current[shipmentNo] =
        serviceId != null && Number.isFinite(serviceId) ? serviceId : null;
      return shipmentServiceIdCacheRef.current[shipmentNo];
    } catch {
      shipmentServiceIdCacheRef.current[shipmentNo] = null;
      return null;
    }
  };

  const fetchSacForLine = async (
    lineIndex: number,
    chargeId: number | null,
    shipmentNo: string,
    serviceIdOverride?: number | null,
  ) => {
    if (!showTradeFields) return;
    if (chargeId == null || !shipmentNo) return;
    const serviceId =
      serviceIdOverride != null
        ? serviceIdOverride
        : await getServiceIdByShipmentNoAsync(shipmentNo);
    if (serviceId == null) return;
    const data = await fetchGetEffectiveSac([
      { charge_id: chargeId, service_id: serviceId },
    ]);
    const item = data.find(
      (x) => x.charge_id === chargeId && x.service_id === serviceId,
    );
    const sac = String(item?.sac_code ?? "").trim();
    if (!sac) return;
    form.setFieldValue(`lines.${lineIndex}.sac_code`, sac);
  };

  // (Trade-only SAC auto fetch effect is placed after isReadOnly is defined)

  const setLineById = (id: string, patch: Partial<LineItem>) => {
    const lines = form.getValues().lines;
    const idx = lines.findIndex((row) => row.id === id);
    if (idx < 0) return;
    form.setFieldValue(`lines.${idx}`, { ...lines[idx], ...patch });
  };

  const addLine = () => {
    const latest = form.getValues();
    const currency = String(latest.currencyCode || localCurrency)
      .trim()
      .toUpperCase();
    const row = newLineItem(latest.lines.length, currency);
    const { currencyId } = resolveLineCurrencyContext(currency, currencyIdByCode);
    if (isLocalCurrency(currency, currencyId ?? latest.currencyId)) {
      row.roe = 1;
    } else if (latest.roe !== "") {
      row.roe = latest.roe;
    }
    form.insertListItem("lines", row);
  };

  /** Account-entry rows use the document currency ROE when the line has none yet. */
  const ensureLineRoeAndLocalAmount = (lineId: string) => {
    const latest = form.getValues();
    const line = latest.lines.find((row) => row.id === lineId);
    if (!line) return;

    const currency = String(line.currency || latest.currencyCode || localCurrency)
      .trim()
      .toUpperCase();
    const { currencyId } = resolveLineCurrencyContext(currency, currencyIdByCode);
    const headerRoe = latest.roe === "" ? "" : latest.roe;

    const write = (roe: number | "") => {
      const current = form.getValues().lines.find((row) => row.id === lineId);
      if (!current) return;
      const amount = current.amount;
      const headerNow = form.getValues().roe;
      setLineById(lineId, {
        currency: String(current.currency || currency).trim().toUpperCase(),
        roe,
        local_amount: computeLocalAmount(amount, roe),
        amount_in_inr: computeAmountInHeaderCurrency(
          amount,
          headerNow === "" ? roe : headerNow,
        ),
      });
    };

    if (line.roe !== "" && line.roe != null) {
      if (line.amount !== "" && line.local_amount === "") {
        write(line.roe);
      }
      return;
    }

    if (isLocalCurrency(currency, currencyId ?? latest.currencyId)) {
      write(1);
      return;
    }

    const headerCode = String(latest.currencyCode ?? "")
      .trim()
      .toUpperCase();
    if (headerRoe !== "" && (!headerCode || currency === headerCode)) {
      write(headerRoe);
      return;
    }

    syncRoeForCurrencyChange(
      currency,
      (roe) => write(roe == null ? "" : roe),
      currencyId ?? latest.currencyId,
    );
  };
  const removeLine = (id: string) => {
    if (form.values.lines.length <= 1) return;
    const idx = form.values.lines.findIndex((l) => l.id === id);
    if (idx >= 0) form.removeListItem("lines", idx);
  };

  const computeLocalAmount = (
    amount: number | "",
    roe: number | "",
  ): number | "" => {
    if (amount === "" || roe === "") return "";
    if (!Number.isFinite(Number(amount)) || !Number.isFinite(Number(roe)))
      return "";
    return clampMoneyAmountBound(Number(amount) * Number(roe)) ?? "";
  };

  const computeAmountInHeaderCurrency = (
    amount: number | "",
    headerRoe: number | "",
  ): number | "" => {
    if (amount === "" || headerRoe === "") return "";
    if (!Number.isFinite(Number(amount)) || !Number.isFinite(Number(headerRoe)))
      return "";
    return (
      clampCurrencyMoneyAmountBound(Number(amount) * Number(headerRoe)) ?? ""
    );
  };

  const saveForGst = async (): Promise<string | null> => {
    if (isReadOnly) return null;
    // Ensure we have an id before calling GST breakup, and persist current lines.
    if (saveResponse?.id != null) {
      const updated = await onUpdate();
      if (!updated) return null;
      return String(saveResponse.id);
    }

    if (!validateRoeBeforeSave()) return null;
    const fd = buildDebitCreditNoteFormData();
    try {
      const res = await apiCallProtected.post(
        URL.debitCreditNote,
        fd,
        FORM_DATA_HEADERS,
      );
      // applyCreateResponseToForm will set saveResponse via header.id
      applyCreateResponseToForm(res);
      const createdRoot = res as { data?: unknown };
      const createdData =
        (createdRoot?.data as { data?: unknown } | undefined)?.data ??
        createdRoot?.data ??
        res;
      const createdHeader = createdData as Record<string, unknown>;
      return createdHeader?.id != null ? String(createdHeader.id) : null;
    } catch (err) {
      console.error("Failed to save debit/credit note for GST", err);
      ToastNotification({
        type: "error",
        message: "Failed to save debit/credit note before calculating GST",
      });
      return null;
    }
  };

  const calculateGst = async () => {
    if (isReadOnly) return;
    if (saveResponse?.id == null) {
      const hasAmount = form.values.lines.some(
        (line) => line.amount !== "" && Number(line.amount) !== 0,
      );
      if (!hasAmount) {
        ToastNotification({
          type: "error",
          message: "Please enter at least one amount before calculating GST.",
        });
        return;
      }
    }

    setCalcLoading(true);
    setLoadingText("Saving debit/credit note...");
    const id = await saveForGst();
    if (!id) {
      setCalcLoading(false);
      setLoadingText("");
      return;
    }

    type SacWiseTotal = {
      sac_code?: string;
      total_amount?: number | string;
      narration?: string;
      account_code?: string | null;
      account_name?: string | null;
      subledger_code?: string | null;
      roe?: number | string | null;
      currency_code?: string | null;
      charge_id?: number | string | null;
      charge_name?: string | null;
      shipment_no?: string | null;
      Dr_Cr?: unknown;
      Dr_cr?: unknown;
      dr_cr?: unknown;
    };

    setCalcLoading(true);
    setLoadingText("Calculating GST...");
    try {
      const res = await postAPICall(
        URL.invoiceCalculateGstBreakup,
        { debit_credit_note_id: Number(id) },
        API_HEADER,
      );
      const payload = unwrapGstPayload(res);
      const sacWiseTotals = (payload.sac_wise_totals ?? []) as SacWiseTotal[];

      if (!Array.isArray(sacWiseTotals) || sacWiseTotals.length === 0) {
        ToastNotification({
          type: "error",
          message: "No GST rows returned from calculation.",
        });
        return;
      }

      const currentLines = form.getValues().lines;
      const headerRoe = form.getValues().roe;
      const generatedLines: LineItem[] = sacWiseTotals
        .map((t, i): LineItem | null => {
          const chargeId = Number(t.charge_id);
          if (!Number.isFinite(chargeId)) return null;
          const amount =
            t.total_amount != null && t.total_amount !== ""
              ? Number(t.total_amount)
              : "";
          const lineRoe = t.roe != null && t.roe !== "" ? Number(t.roe) : 1;
          const localAmount = computeLocalAmount(amount, lineRoe);
          const amountInHeader = computeAmountInHeaderCurrency(
            amount,
            headerRoe,
          );
          return {
            ...newLineItem(currentLines.length + i),
            shipment_no: String(t.shipment_no ?? ""),
            charge_id: chargeId,
            charge_name: String(t.charge_name ?? ""),
            crn: "Neutral",
            account_id: "",
            account_code: String(t.account_code ?? ""),
            account_name: String(t.account_name ?? ""),
            subledger: String(t.subledger_code ?? ""),
            currency: String(
              t.currency_code ?? form.getValues().currencyCode ?? localCurrency,
            )
              .trim()
              .toUpperCase(),
            roe: lineRoe,
            amount: amount === "" || !Number.isFinite(amount) ? "" : amount,
            local_amount: localAmount,
            amount_in_inr: amountInHeader,
            dr_cr: normalizeDrCr(t.Dr_Cr ?? t.Dr_cr ?? t.dr_cr),
            // SAC stays empty on tax rows so they are not taxed again.
            sac_code: "",
            narration: String(t.narration ?? ""),
            note: "",
          };
        })
        .filter((row): row is LineItem => row !== null);

      if (!generatedLines.length) {
        ToastNotification({
          type: "error",
          message:
            "GST breakup did not include a charge. CGST, SGST, and IGST must exist in Charge Master.",
        });
        return;
      }

      const deduped = generatedLines.filter((nr) => {
        return !currentLines.some(
          (er) =>
            Number(er.charge_id) === Number(nr.charge_id) &&
            String(er.account_code ?? "") === String(nr.account_code ?? "") &&
            String(er.subledger ?? "") === String(nr.subledger ?? "") &&
            Number(er.amount === "" ? 0 : er.amount) ===
              Number(nr.amount === "" ? 0 : nr.amount) &&
            er.dr_cr === nr.dr_cr,
        );
      });

      if (deduped.length) {
        form.setFieldValue("lines", [...currentLines, ...deduped]);
      }
      ToastNotification({
        type: "success",
        message: "GST calculated successfully",
      });
    } catch (e) {
      console.error("Failed to calculate GST breakup", e);
      ToastNotification({ type: "error", message: "Failed to calculate GST" });
    } finally {
      setCalcLoading(false);
      setLoadingText("");
    }
  };

  // Edit/View flow: prefill from list page row data
  useEffect(() => {
    const state = (location.state ?? null) as { data?: unknown } | null;
    const candidate = state?.data ?? null;
    if (!candidate) return;

    // For edit/view routes we rely on the row payload passed in location.state.
    // The `:id` in the URL is used for identification only.
    isPrefillingRef.current = true;
    applyCreateResponseToForm(candidate);
    // Release lock after form state flushes, so other effects don't overwrite
    // the mapped lines with initial defaults.
    setTimeout(() => {
      isPrefillingRef.current = false;
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  const { data: currencyData = [] } = useQuery({
    queryKey: ["currencyMaster"],
    queryFn: fetchCurrencyMaster,
    staleTime: Infinity,
  });

  const { data: stateData = [] } = useQuery({
    queryKey: ["stateMaster"],
    queryFn: fetchStateMaster,
    staleTime: Infinity,
  });

  const { data: daybookData = [] } = useQuery({
    queryKey: ["daybookMaster"],
    queryFn: async () => {
      try {
        const res = await getAPICall(`${URL.daybookGet}`, API_HEADER);
        return (res as { data?: unknown[] })?.data ?? res ?? [];
      } catch (e) {
        console.error("Error fetching daybook:", e);
        return [];
      }
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const daybookOptions = useMemo(() => {
    const data = daybookData as Array<{
      id?: number;
      name?: string;
      document_type?: string;
    }>;
    if (!Array.isArray(data)) return [];
    return data
      .map((d) => ({
        value: String(d.id ?? ""),
        label: String(d.name ?? "").trim() || String(d.id ?? ""),
      }))
      .filter((o) => o.value);
  }, [daybookData]);

  const daybookDocumentTypeById = useMemo(() => {
    const data = daybookData as Array<{ id?: number; document_type?: string }>;
    const map = new Map<string, string>();
    if (Array.isArray(data)) {
      data.forEach((d) => {
        const id = d.id != null ? String(d.id) : "";
        if (!id) return;
        map.set(id, String(d.document_type ?? "").trim());
      });
    }
    return map;
  }, [daybookData]);

  // daybook master list not needed (Daybook is SearchableSelect)

  const currencyOptions = useMemo(
    () => buildCurrencyOptions(currencyData),
    [currencyData],
  );

  const currencyIdByCode = useMemo(
    () => buildCurrencyIdByCode(currencyOptions),
    [currencyOptions],
  );

  const headerCurrencyCode = useMemo(
    () =>
      resolveCurrencyCodeFromId(
        form.values.currencyId,
        currencyOptions,
        form.values.currencyCode,
      ),
    [currencyOptions, form.values.currencyId, form.values.currencyCode],
  );

  const stateOptions = useMemo(() => {
    const data = stateData as {
      id?: number;
      state_name?: string;
      name?: string;
    }[];
    if (!Array.isArray(data)) return [];
    return data
      .map((s) => ({
        value: String(s.id ?? ""),
        label: String(s.state_name ?? s.name ?? s.id ?? "").trim(),
      }))
      .filter((o) => o.value && o.label);
  }, [stateData]);

  const { data: sacCodes = [] } = useQuery({
    queryKey: ["gstSacMasterFilter"],
    queryFn: async () => {
      try {
        const res = await postAPICall(URL.gstSacMasterFilter, {}, API_HEADER);
        const maybeAxios = res as { data?: unknown };
        const payloadUnknown: unknown = maybeAxios?.data ?? res;
        const isObj = (v: unknown): v is Record<string, unknown> =>
          typeof v === "object" && v !== null && !Array.isArray(v);

        // Supported shapes:
        // 1) { data: [...] }
        // 2) { data: { data: [...] } }
        // 3) [...] (already array)
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
        return [];
      }
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const sacCodeOptions = useMemo(() => {
    const uniq = new Set<string>();
    (Array.isArray(sacCodes) ? sacCodes : []).forEach((c) => {
      const v = String(c ?? "").trim();
      if (v) uniq.add(v);
    });
    return Array.from(uniq);
  }, [sacCodes]);

  // Ensure SAC dropdown can display prefilled values even before/if master list includes them.
  const sacCodeOptionsForForm = useMemo(() => {
    const uniq = new Set<string>(sacCodeOptions);
    form.values.lines.forEach((l) => {
      const v = String(l.sac_code ?? "").trim();
      if (v) uniq.add(v);
    });
    return Array.from(uniq);
  }, [sacCodeOptions, form.values.lines]);

  // daybookOptions removed (Daybook now uses SearchableSelect)

  const FORM_DATA_HEADERS = {
    ...API_HEADER,
    headers: {
      ...(API_HEADER as { headers?: Record<string, string> }).headers,
      "Content-Type": "multipart/form-data",
    },
  };

  const buildDebitCreditNoteFormData = (
    statusOverride?: "UNPOSTED" | "POSTED",
  ): FormData => {
    const currentStatus = String(
      (saveResponse as { status?: unknown } | null)?.status ?? "UNPOSTED",
    ).toUpperCase();
    const status: "UNPOSTED" | "POSTED" =
      statusOverride ?? (currentStatus === "POSTED" ? "POSTED" : "UNPOSTED");

    const debitCreditNote = {
      type: payloadType,
      daybook_id: form.values.daybookId ? Number(form.values.daybookId) : null,
      document_type: form.values.documentType,
      party_code: form.values.partyAccount,
      address: form.values.address,
      state_id: form.values.stateId ? Number(form.values.stateId) : null,
      currency_id: form.values.currencyId
        ? Number(form.values.currencyId)
        : null,
      roe: form.values.roe === "" ? "" : formatRoeAsString(form.values.roe),
      document_date: form.values.documentDate
        ? dayjs(form.values.documentDate).format("YYYY-MM-DD")
        : "",
      status,
      cost_center: form.values.costCenter,
      narration: form.values.narration,
      note: form.values.note,
      gst_id: form.values.gstId,
      dr_cr: (form.values.lines[0]?.dr_cr as "Dr" | "Cr" | undefined) ?? "Dr",
      debit_credit_note_tem: form.values.lines.map((l) => {
        const includeChargeFields =
          showTradeFields ||
          l.charge_id != null ||
          String(l.shipment_no ?? "").trim() !== "" ||
          String(l.crn ?? "").trim() !== "";
        const { currencyId: lineCurrencyId } = resolveLineCurrencyContext(
          l.currency,
          currencyIdByCode,
        );
        return {
        ...(includeChargeFields
          ? {
              shipment_no: String(l.shipment_no ?? ""),
              charge_id: l.charge_id ?? null,
              crn: String(l.crn ?? ""),
            }
          : {}),
        account_code: l.account_code,
        subledger: l.subledger,
        code: l.cost_center_code,
        key: l.cost_center_key,
        currency_id: lineCurrencyId
          ? Number(lineCurrencyId)
          : form.values.currencyId
            ? Number(form.values.currencyId)
            : null,
        roe: l.roe === "" ? "" : formatRoeAsString(l.roe),
        amount: l.amount === "" ? "" : String(l.amount),
        local_amount:
          l.local_amount === ""
            ? ""
            : String(roundLocalMoneyToDecimals(Number(l.local_amount)) ?? l.local_amount),
        amount_in_inr: l.amount_in_inr === "" ? "" : String(l.amount_in_inr),
        dr_cr: l.dr_cr || "Dr",
        sac_code: l.sac_code,
        narration: l.narration,
        note: l.note,
        };
      }),
    };

    const fd = new FormData();
    fd.append("debit_credit_note", JSON.stringify(debitCreditNote));

    let fileIndex = 0;
    form.values.supporting_documents.forEach((doc) => {
      if (!doc.file) return;
      fd.append(`document_names[${fileIndex}]`, (doc.name ?? "").toString());
      fd.append(`document[${fileIndex}]`, doc.file);
      fileIndex++;
    });

    return fd;
  };

  const applyCreateResponseToForm = (raw: unknown) => {
    // Supports axios responses that wrap the note under `data`.
    const unwrap = (x: unknown): unknown => {
      if (!x || typeof x !== "object") return x;
      const obj = x as Record<string, unknown>;
      if ("data" in obj) {
        const d = obj.data;
        if (d && typeof d === "object") {
          const inner = d as Record<string, unknown>;
          if ("data" in inner) return inner.data;
        }
        return d;
      }
      return x;
    };

    const header = unwrap(raw) as Record<string, unknown>;
    const linesFromTem = (header as { debit_credit_note_tem?: unknown })
      .debit_credit_note_tem;
    const details = (Array.isArray(linesFromTem) ? linesFromTem : []) as Array<
      Record<string, unknown>
    >;

    if (header?.id != null) setSaveResponse(header);

    // Header fields
    if (header?.daybook_id != null)
      form.setFieldValue("daybookId", String(header.daybook_id));
    if (header?.document_type != null)
      form.setFieldValue("documentType", String(header.document_type));
    if (header?.party_code != null)
      form.setFieldValue("partyAccount", String(header.party_code));
    if (header?.party_name != null)
      form.setFieldValue("partyName", String(header.party_name));
    const partyAddress =
      (header as { party_address?: unknown }).party_address ??
      (header as { address?: unknown }).address ??
      null;
    if (partyAddress != null)
      form.setFieldValue("address", String(partyAddress ?? ""));
    if (header?.state_id != null)
      form.setFieldValue("stateId", String(header.state_id));
    // currency in edit/view flows
    if ((header as { currency_id?: unknown }).currency_id != null) {
      form.setFieldValue(
        "currencyId",
        String((header as { currency_id?: unknown }).currency_id),
      );
    }
    const headerCurrencyCodeRaw =
      (header as { currency_code?: unknown }).currency_code ??
      (header as { currency?: unknown }).currency ??
      null;
    const headerCurrencyCode =
      headerCurrencyCodeRaw != null ? String(headerCurrencyCodeRaw).trim() : "";
    if (headerCurrencyCode) {
      form.setFieldValue("currencyCode", headerCurrencyCode.toUpperCase());
    }
    if (header?.roe != null) form.setFieldValue("roe", parseRoeForPayload(header.roe) ?? "");
    if (header?.document_date != null)
      form.setFieldValue(
        "documentDate",
        dayjs(String(header.document_date)).toDate(),
      );
    if (header?.document_no != null)
      form.setFieldValue("documentNo", String(header.document_no));
    if (header?.cost_center != null)
      form.setFieldValue("costCenter", String(header.cost_center));
    if (header?.narration != null)
      form.setFieldValue("narration", String(header.narration));
    if (header?.note != null) form.setFieldValue("note", String(header.note));
    if (header?.gst_id != null)
      form.setFieldValue("gstId", String(header.gst_id));

    // debit_credit_note_tem -> lines
    if (Array.isArray(details) && details.length) {
      const fallbackCurrencyCode =
        headerCurrencyCode || String(form.values.currencyCode ?? localCurrency);
      const mapped: LineItem[] = details.map((d, i) => ({
        id: `line-${Date.now()}-${i}`,
        shipment_no: String(d.shipment_no ?? ""),
        service_id:
          (d as { service_id?: unknown }).service_id != null &&
          Number.isFinite(Number((d as { service_id?: unknown }).service_id))
            ? Number((d as { service_id?: unknown }).service_id)
            : null,
        charge_id:
          d.charge_id != null && Number.isFinite(Number(d.charge_id))
            ? Number(d.charge_id)
            : null,
        charge_name: String(
          (d as { charge_name?: unknown }).charge_name ??
            (d as { chargeName?: unknown }).chargeName ??
            "",
        ),
        crn: String(
          (d as { crn?: unknown; CRN?: unknown }).crn ??
            (d as { CRN?: unknown }).CRN ??
            "",
        ),
        account_id: "",
        account_code: String(d.account_code ?? ""),
        account_name: String(d.account_name ?? ""),
        subledger: String(d.subledger ?? ""),
        cost_center_code: String(d.code ?? ""),
        cost_center_key: String(d.key ?? ""),
        currency: String(d.currency_code ?? fallbackCurrencyCode ?? localCurrency),
        roe: d.roe != null ? parseRoeForPayload(d.roe) ?? "" : "",
        amount: d.amount != null ? Number(d.amount) : "",
        amount_in_inr: d.amount_in_inr != null ? Number(d.amount_in_inr) : "",
        local_amount:
          d.local_amount != null && d.local_amount !== ""
            ? (roundLocalMoneyToDecimals(Number(d.local_amount)) ?? "")
            : "",
        dr_cr: d.dr_cr === "Dr" || d.dr_cr === "Cr" ? d.dr_cr : "",
        sac_code: String(d.sac_code ?? "").trim(),
        narration: String(d.narration ?? ""),
        note: String(d.note ?? ""),
      }));
      form.setFieldValue("lines", mapped);
    }
  };

  const isHeaderLocalCurrency = isLocalCurrency(
    headerCurrencyCode,
    form.values.currencyId,
  );

  const isLineLocalCurrency = (lineCurrency: string) => {
    const { code, currencyId } = resolveLineCurrencyContext(
      lineCurrency,
      currencyIdByCode,
    );
    if (!code) return isHeaderLocalCurrency;
    return isLocalCurrency(code, currencyId);
  };

  const validateRoeBeforeSave = (): boolean => {
    const headerRoe =
      form.values.roe === "" ? null : Number(form.values.roe);
    const headerError = validateRoeToast(
      headerCurrencyCode,
      headerRoe,
      form.values.currencyId,
    );
    if (headerError) {
      form.setFieldError(
        "roe",
        validateRoeField(
          headerCurrencyCode,
          headerRoe,
          form.values.currencyId,
        ) ?? headerError,
      );
      ToastNotification({ type: "error", message: headerError });
      return false;
    }
    for (let i = 0; i < form.values.lines.length; i++) {
      const line = form.values.lines[i];
      const lineRoe = line.roe === "" ? null : Number(line.roe);
      const { code: lineCode, currencyId: lineCurrencyId } =
        resolveLineCurrencyContext(line.currency, currencyIdByCode);
      const lineError = validateRoeToast(
        lineCode || headerCurrencyCode,
        lineRoe,
        lineCurrencyId ?? form.values.currencyId,
      );
      if (lineError) {
        ToastNotification({ type: "error", message: lineError });
        return false;
      }
    }
    return true;
  };

  const onCreate = async () => {
    if (!validateRoeBeforeSave()) return;
    const fd = buildDebitCreditNoteFormData();
    setIsSubmitting(true);
    setLoadingText("Creating credit/debit note...");
    try {
      const res = await apiCallProtected.post(
        URL.debitCreditNote,
        fd,
        FORM_DATA_HEADERS,
      );
      applyCreateResponseToForm(res);
      ToastNotification({ type: "success", message: "Created successfully" });
    } catch (err) {
      console.error("Failed to create debit/credit note", err);
      ToastNotification({ type: "error", message: "Failed to create" });
    } finally {
      setIsSubmitting(false);
      setLoadingText("");
    }
  };

  const onUpdate = async (): Promise<boolean> => {
    if (saveResponse?.id == null) return false;
    if (!validateRoeBeforeSave()) return false;
    const fd = buildDebitCreditNoteFormData();
    // putAPICall expects `formValue.id` to build `${url}${id}/`.
    (fd as unknown as { id: unknown }).id = saveResponse.id;
    setIsSubmitting(true);
    setLoadingText("Updating credit/debit note...");
    try {
      const raw = await putAPICall(
        URL.debitCreditNote,
        fd as unknown as FormData,
        FORM_DATA_HEADERS,
      );
      applyCreateResponseToForm(raw);
      ToastNotification({ type: "success", message: "Updated successfully" });
      return true;
    } catch (err) {
      console.error("Failed to update debit/credit note", err);
      ToastNotification({ type: "error", message: "Failed to update" });
      return false;
    } finally {
      setIsSubmitting(false);
      setLoadingText("");
    }
  };

  const isEditMode = saveResponse != null;
  const statusUpper = String(
    (saveResponse as { status?: unknown } | null)?.status ?? "",
  ).toUpperCase();
  const isViewMode = location.pathname.includes("/view/");
  const isPosted = isEditMode && statusUpper === "POSTED";
  const isReadOnly = isViewMode || isPosted;
  const pageLabel = showTradeFields ? "Trade" : "Non Trade";

  const handlePdfPreview = async () => {
    const pdfId = saveResponse?.id;
    if (pdfId == null) return;
    setPreviewOpen(true);
    setPdfBlob(null);
    try {
      const token = useAuthStore.getState().accessToken;
      const response = await fetch(
        `${URL.base}${URL.debitCreditNote}${pdfId}/pdf/`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const blob = await response.blob();
      setPdfBlob(window.URL.createObjectURL(blob));
    } catch (error) {
      console.error("Error fetching debit/credit note PDF:", error);
      ToastNotification({
        type: "error",
        message: "Failed to load PDF preview",
      });
      setPreviewOpen(false);
    }
  };

  const handleClosePreview = () => {
    setPreviewOpen(false);
    if (pdfBlob) {
      window.URL.revokeObjectURL(pdfBlob);
    }
    setPdfBlob(null);
  };

  const handleDownloadPDF = () => {
    if (!pdfBlob) return;
    const docNo =
      form.values.documentNo ||
      (saveResponse?.document_no != null
        ? String(saveResponse.document_no)
        : "") ||
      String(saveResponse?.id ?? "draft");
    const link = document.createElement("a");
    link.href = pdfBlob;
    link.download = `Debit-Credit-Note-${docNo}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const applyHeaderRoeToLines = (roe: number | null, currencyCode?: string) => {
    const code = currencyCode?.trim().toUpperCase();
    const lineRoe = roe ?? ("" as const);
    form.setFieldValue(
      "lines",
      form.getValues().lines.map((l) => ({
        ...l,
        ...(code ? { currency: code } : {}),
        roe: lineRoe,
        local_amount:
          roe != null ? computeLocalAmount(l.amount, roe) : ("" as const),
      })),
    );
  };

  const syncRoeAndApply = (
    code: string,
    currencyId: string | null,
    onRoe: (roe: number | null) => void,
  ) => {
    if (!code) return;
    syncRoeForCurrencyChange(code, onRoe, currencyId);
  };

  const handleLineCurrencyChange = (
    lineId: string,
    rawCode: string | null,
  ) => {
    const code = rawCode?.trim().toUpperCase() ?? "";
    const line = form.values.lines.find((l) => l.id === lineId);
    if (!line) return;

    if (!code) {
      setLineById(lineId, { currency: "", roe: "", local_amount: "" });
      return;
    }

    const { currencyId } = resolveLineCurrencyContext(code, currencyIdByCode);
    syncRoeAndApply(code, currencyId, (roe) => {
      setLineById(lineId, {
        currency: code,
        roe,
        local_amount: computeLocalAmount(line.amount, roe),
      });
    });
  };

  const handleHeaderCurrencyChange = (
    rawId: string | null,
    item?: { value?: string; label?: string } | null,
  ) => {
    const { currencyId, code } = resolveHeaderCurrencySelection(
      rawId,
      item,
      currencyOptions,
    );
    form.setFieldValue("currencyId", currencyId);
    form.setFieldValue("currencyCode", code);
    form.clearFieldError("roe");
    if (!code) return;

    syncRoeAndApply(code, currencyId, (roe) => {
      form.setFieldValue("roe", roe);
      applyHeaderRoeToLines(roe, code);
    });
  };

  // Branch currency: ROE = 1; foreign currency: fetch from exchange rate master (create only).
  useEffect(() => {
    if (isReadOnly || isPrefillingRef.current || isEditMode || !headerCurrencyCode)
      return;

    const isLocal = isLocalCurrency(
      headerCurrencyCode,
      form.values.currencyId,
    );

    if (isLocal) {
      if (form.values.roe !== 1) form.setFieldValue("roe", 1);
      if (form.values.lines.some((l) => l.roe !== 1)) {
        applyHeaderRoeToLines(1, headerCurrencyCode);
      }
      return;
    }

    syncRoeAndApply(
      headerCurrencyCode,
      form.values.currencyId,
      (roe) => {
        form.setFieldValue("roe", roe);
        applyHeaderRoeToLines(roe, headerCurrencyCode);
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    headerCurrencyCode,
    form.values.currencyId,
    isReadOnly,
    isEditMode,
    isLocalCurrency,
    syncRoeForCurrencyChange,
  ]);

  // Trade only: auto-fetch SAC once shipment_no + charge_id are selected.
  const tradeSacKey = showTradeFields
    ? form.values.lines
        .map(
          (l) =>
            `${String(l.shipment_no ?? "").trim()}|${l.charge_id ?? ""}|${String(l.sac_code ?? "").trim()}`,
        )
        .join(",")
    : "";
  useEffect(() => {
    if (!showTradeFields) return;
    if (isReadOnly) return;
    form.values.lines.forEach((l, idx) => {
      const shipmentNo = String(l.shipment_no ?? "").trim();
      const chargeId = l.charge_id != null ? Number(l.charge_id) : null;
      const hasSac = String(l.sac_code ?? "").trim() !== "";
      if (!shipmentNo || chargeId == null || hasSac) return;
      void fetchSacForLine(idx, chargeId, shipmentNo);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tradeSacKey, showTradeFields, isReadOnly]);

  // Keep currency code in sync when master loads after form init (e.g. branch id preset).
  useEffect(() => {
    if (isReadOnly) return;
    if (!form.values.currencyId) return;
    const match = currencyOptions.find(
      (o) => o.value === String(form.values.currencyId),
    );
    if (!match?.label) return;
    if (form.values.currencyCode !== match.label) {
      form.setFieldValue("currencyCode", match.label);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currencyOptions, form.values.currencyId, isReadOnly]);

  // If header currency code defaults (e.g. INR) but id isn't selected,
  // auto-select the matching currency id so payload doesn't send null.
  useEffect(() => {
    if (isReadOnly) return;
    if (form.values.currencyId) return;
    const code = String(form.values.currencyCode ?? "").trim().toUpperCase();
    if (!code) return;
    const match = currencyOptions.find((o) => o.label === code);
    if (!match) return;
    form.setFieldValue("currencyId", match.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currencyOptions,
    form.values.currencyCode,
    form.values.currencyId,
    isReadOnly,
  ]);

  const handlePost = async () => {
    if (saveResponse?.id == null) return;
    if (!validateRoeBeforeSave()) return;
    setIsSubmitting(true);
    setLoadingText("Posting credit/debit note...");
    try {
      const fd = buildDebitCreditNoteFormData("POSTED");
      const raw = await apiCallProtected.put(
        `${URL.debitCreditNote}${saveResponse.id}/`,
        fd,
        FORM_DATA_HEADERS,
      );
      applyCreateResponseToForm(raw);
      setSaveResponse((prev) => (prev ? { ...prev, status: "POSTED" } : prev));
      ToastNotification({ type: "success", message: "Posted successfully" });
    } catch (e) {
      console.error("Failed to post debit/credit note", e);
      ToastNotification({ type: "error", message: "Failed to post" });
    } finally {
      setIsSubmitting(false);
      setLoadingText("");
    }
  };

  return (
    <Box
      p="sm"
      w="100%"
      style={{
        position: "relative",
      }}
    >
      {(isSubmitting || calcLoading) && (
        <Box
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(255, 255, 255, 0.65)",
            zIndex: 2000,
          }}
        >
          <Center h="100%">
            <Stack gap="xs" align="center">
              <Loader color="#105476" />
              {loadingText ? (
                <Text size="sm" fw={600} c="#105476">
                  {loadingText}
                </Text>
              ) : null}
            </Stack>
          </Center>
        </Box>
      )}
      <Modal
        opened={documentsOpen}
        onClose={() => setDocumentsOpen(false)}
        title="Attach Supporting Documents"
        centered
        size="xl"
        style={{ fontFamily: "Inter" }}
        styles={{ title: { fontWeight: 600, color: "#105476" } }}
      >
        <Stack gap="sm">
          {form.values.supporting_documents.map((doc, idx) => (
            <Grid key={`${idx}`} columns={12} gutter="sm" align="flex-end">
              <Grid.Col span={5.5}>
                <FormTextInput
                  label="Document Name"
                  placeholder="Enter document name"
                  value={doc.name}
                  onChange={(e) => {
                    const next = [...form.values.supporting_documents];
                    next[idx] = { ...next[idx], name: e.currentTarget.value };
                    form.setFieldValue("supporting_documents", next);
                  }}
                />
              </Grid.Col>
              <Grid.Col span={5.5}>
                <Box>
                  <Text size="sm" fw={500} mb={4}>
                    File
                  </Text>
                  <FileButton
                    onChange={(file) => {
                      const next = [...form.values.supporting_documents];
                      next[idx] = { ...next[idx], file: file ?? null };
                      form.setFieldValue("supporting_documents", next);
                    }}
                    accept="*/*"
                  >
                    {(props) => (
                      <Button
                        {...props}
                        variant="outline"
                        leftSection={<IconUpload size={16} />}
                        w="100%"
                        styles={{
                          root: { justifyContent: "flex-start" },
                        }}
                      >
                        {doc.file ? doc.file.name : "Click to select file"}
                      </Button>
                    )}
                  </FileButton>
                </Box>
              </Grid.Col>
              <Grid.Col span={1}>
                <Button
                  type="button"
                  variant="light"
                  color="red"
                  size="sm"
                  px={12}
                  onClick={() =>
                    form.setFieldValue(
                      "supporting_documents",
                      form.values.supporting_documents.filter(
                        (_, i) => i !== idx,
                      ),
                    )
                  }
                >
                  <IconTrash size={16} />
                </Button>
              </Grid.Col>
            </Grid>
          ))}

          <Group justify="space-between" mt="sm">
            <Button
              type="button"
              variant="light"
              color="#105476"
              leftSection={<IconPlus size={16} />}
              onClick={() =>
                form.setFieldValue("supporting_documents", [
                  ...form.values.supporting_documents,
                  { name: "", file: null },
                ])
              }
              disabled={isReadOnly}
            >
              Add Document
            </Button>
            <Button onClick={() => setDocumentsOpen(false)}>Done</Button>
          </Group>
        </Stack>
      </Modal>

      {/* <Box style={{ flex: 1, minHeight: 0, overflow: "auto" }}> */}
      <Stack gap="md">
        <Group justify="space-between" wrap="nowrap" align="end">
          <Group gap="sm" wrap="nowrap">
            <EditPageHeadingRow
              visible={Boolean(saveResponse) && (isEditMode || isViewMode)}
              auditSource={saveResponse}
              animateKey={(saveResponse as { id?: number })?.id}
            >
              <Text size="xl" fw={600} c="#105476">
                {isEditMode
                  ? `Edit Debit / Credit Note (${pageLabel})`
                  : `Create Debit / Credit Note (${pageLabel})`}
              </Text>
            </EditPageHeadingRow>
          </Group>
          {isEditMode && (
            <Group gap="sm" wrap="nowrap" justify="flex-end">
              {form.values.documentNo ? (
                <>
                  <Text size="sm" fw={600} c="#105476">
                    Document No:
                  </Text>
                  <Text size="sm" fw={600} c="#105476">
                    {form.values.documentNo}
                  </Text>
                </>
              ) : null}
              <Text size="sm" fw={600} c="#105476">
                Status:
              </Text>
              <Badge
                size="sm"
                variant="light"
                color={isPosted ? "green" : "gray"}
                >
                {isPosted ? "POSTED" : "UNPOSTED"}
              </Badge>
                {saveResponse?.id != null && (
                  <Menu shadow="md" width={240}>
                    <Menu.Target>
                      <ActionIcon variant="light" color="#105476" size="lg">
                        <IconDotsVertical size={18} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item
                        leftSection={<IconEye size={14} />}
                        onClick={() => void handlePdfPreview()}
                      >
                        {isPosted
                          ? "Debit / Credit Note PDF"
                          : "Draft Debit / Credit Note PDF"}
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                )}
            </Group>
          )}
        </Group>

        {/* Header section (Grid 1) */}
        <Grid gutter="sm" mt="sm">
          <Grid.Col span={2}>
            <Dropdown
              label="Daybook"
              placeholder="Select daybook"
              searchable
              data={daybookOptions}
              value={form.values.daybookId}
              onChange={(val) => {
                form.setFieldValue("daybookId", val);
                const docType = val
                  ? daybookDocumentTypeById.get(String(val))
                  : "";
                if (docType) form.setFieldValue("documentType", docType);
              }}
              size="sm"
              styles={chargeFieldStyles}
              disabled={isReadOnly}
            />
          </Grid.Col>

          <Grid.Col span={1.2}>
            <FormTextInput
              label="Document Type"
              placeholder="Enter document type"
              value={form.values.documentType}
              onChange={(e) =>
                form.setFieldValue("documentType", e.currentTarget.value)
              }
              readOnly
              disabled={isReadOnly}
            />
          </Grid.Col>

          <Grid.Col span={1.5}>
            <SearchableSelect
              apiEndpoint={URL.customer}
              label="Party Name"
              placeholder="Type party"
              value={form.values.partyAccount}
              displayValue={form.values.partyName}
              dropdownZIndex={1000}
              minSearchLength={1}
              searchFields={["customer_code", "customer_name", "name"]}
              returnOriginalData
              onChange={(val, selected, original) => {
                form.setFieldValue("partyAccount", val || "");
                form.setFieldValue("partyName", selected?.label ?? "");
                const row = (original as CustomerRow | null) ?? null;
                const addresses = extractPartyAddressesFromRecord(original);
                const primary = findPrimaryPartyAddress(addresses);
                const resolvedAddress = String(
                  primary?.address ?? row?.address ?? "",
                ).trim();
                if (resolvedAddress) {
                  form.setFieldValue("address", resolvedAddress);
                }
                if (!isIndiaUser || !primary) return;
                const stateId = resolveStateCodeFromPartyAddress(
                  primary,
                  stateOptions,
                );
                if (stateId) form.setFieldValue("stateId", stateId);
                const gstId = getPartyGstFromPrimaryAddress(addresses);
                if (gstId) form.setFieldValue("gstId", gstId);
              }}
              displayFormat={(item) => ({
                value: String(item.customer_code ?? item.id ?? ""),
                label: String(item.customer_name ?? item.name ?? "").trim(),
              })}
              size="sm"
              styles={chargeFieldStyles}
              disabled={isReadOnly}
            />
          </Grid.Col>

          <Grid.Col span={2}>
            <FormTextInput
              label="Address"
              placeholder="Enter address"
              value={form.values.address}
              onChange={(e) =>
                form.setFieldValue("address", e.currentTarget.value)
              }
              disabled={isReadOnly}
            />
          </Grid.Col>

          <Grid.Col span={1.2}>
            <Dropdown
              label="State"
              placeholder="Select state"
              data={stateOptions.map((o) => o.label)}
              searchable
              value={
                stateOptions.find(
                  (o) => o.value === String(form.values.stateId ?? ""),
                )?.label ?? null
              }
              onChange={(label) => {
                const found = stateOptions.find((o) => o.label === label);
                form.setFieldValue("stateId", found?.value ?? null);
              }}
              size="sm"
              styles={chargeFieldStyles}
              disabled={isReadOnly}
            />
          </Grid.Col>

          <Grid.Col span={1}>
            <Dropdown
              label="Currency"
              placeholder="Select currency"
              searchable
              data={currencyOptions}
              value={
                form.values.currencyId != null
                  ? String(form.values.currencyId)
                  : null
              }
              onChange={(id, item) => handleHeaderCurrencyChange(id, item)}
              size="sm"
              styles={chargeFieldStyles}
              disabled={isReadOnly}
            />
          </Grid.Col>
          <Grid.Col span={0.7}>
            <FormTextInput
              label="ROE"
              placeholder="ROE"
              type="number"
              value={form.values.roe === "" ? "" : String(form.values.roe)}
              onChange={(e) => {
                const v = sanitizeRoeInput(e.currentTarget.value);
                const nextRoe = v === "" ? null : parseRoeForPayload(v);
                onRoeValueChange(
                  headerCurrencyCode,
                  nextRoe,
                  (roe) =>
                    form.setFieldValue("roe", roe === null ? "" : roe),
                  form.setFieldError,
                  form.clearFieldError,
                  "roe",
                  form.values.currencyId,
                );
              }}
              error={form.errors.roe}
              disabled={isReadOnly || isHeaderLocalCurrency}
            />
          </Grid.Col>
          <Grid.Col span={1}>
            <FormTextInput
              label="Cost Center"
              placeholder="Cost center"
              value={form.values.costCenter}
              onChange={(e) =>
                form.setFieldValue("costCenter", e.currentTarget.value)
              }
              disabled={isReadOnly}
            />
          </Grid.Col>
          <Grid.Col span={1.4}>
            <SingleDateInput
              label="Document Date"
              placeholder="YYYY-MM-DD"
              value={form.values.documentDate}
              onChange={(v) => form.setFieldValue("documentDate", v)}
              size="sm"
              styles={chargeFieldStyles}
              disabled={isReadOnly}
            />
          </Grid.Col>
        </Grid>

        {/* Header section (Grid 2) */}
        <Grid gutter="sm" mt="xs">
          <Grid.Col span={3}>
            <FormTextInput
              format="capital"
              label="GST ID"
              placeholder="GST ID"
              value={form.values.gstId}
              onChange={(e) =>
                form.setFieldValue("gstId", e.currentTarget.value)
              }
              disabled={isReadOnly}
            />
          </Grid.Col>
          <Grid.Col span={4.5}>
            <FormTextInput
              label="Narration"
              placeholder="Narration"
              value={form.values.narration}
              onChange={(e) =>
                form.setFieldValue("narration", e.currentTarget.value)
              }
              disabled={isReadOnly}
            />
          </Grid.Col>
          <Grid.Col span={4.5}>
            <FormTextInput
              label="Note"
              placeholder="Note"
              value={form.values.note}
              onChange={(e) =>
                form.setFieldValue("note", e.currentTarget.value)
              }
              disabled={isReadOnly}
            />
          </Grid.Col>
        </Grid>

        {/* Calculate GST button moved to Cost Center header */}

        {/* </Card> */}

        {/* Cost Center section (similar role to SupplierInvoiceCreate Charges section) */}
        {/* <Card shadow="sm" padding="lg" radius="md" withBorder> */}
        <Group justify="space-between" align="center" mb="sm">
          <Text size="sm" fw={600} c="#105476">
            Cost Center
          </Text>
          {isIndiaUser && (
            <Button
              type="button"
              size="sm"
              variant="light"
              color="#105476"
              onClick={() => void calculateGst()}
              disabled={isReadOnly || calcLoading}
            >
              Calculate GST
            </Button>
          )}
          {/* <Button variant="outline" leftSection={<IconPlus size={16} />} onClick={addLine}>
              Add Row
            </Button> */}
        </Group>
        {/* <Divider mb="sm" /> */}

        <Grid
          w="100%"
          gutter="xs"
          py="sm"
          style={{
            position: "sticky",
            top: 45,
            backgroundColor: "white",
            fontWeight: 600,
            color: "#105476",
          }}
        >
          {/* <Grid.Col span={0.3}>
              <Text size="xs" fw={600} c="#105476">
                SNo
              </Text>
            </Grid.Col> */}
          {showTradeFields && (
            <Grid.Col span={lineColSpans.shipment} style={chargeHeaderTextStyle}>
              Shipment No
            </Grid.Col>
          )}
          {showTradeFields && (
            <Grid.Col span={lineColSpans.charge} style={chargeHeaderTextStyle}>
              Charge
            </Grid.Col>
          )}
          {showTradeFields && (
            <Grid.Col span={lineColSpans.crn} style={chargeHeaderTextStyle}>
              CRN
            </Grid.Col>
          )}
          <Grid.Col span={lineColSpans.account} style={chargeHeaderTextStyle}>
            Account
          </Grid.Col>
          <Grid.Col span={lineColSpans.subledger} style={chargeHeaderTextStyle}>
            Subledger
          </Grid.Col>
          <Grid.Col span={lineColSpans.code} style={chargeHeaderTextStyle}>
            Code
          </Grid.Col>
          <Grid.Col span={lineColSpans.key} style={chargeHeaderTextStyle}>
            Key
          </Grid.Col>
          <Grid.Col span={lineColSpans.currency} style={chargeHeaderTextStyle}>
            Currency
          </Grid.Col>
          <Grid.Col span={lineColSpans.roe} style={chargeHeaderTextStyle}>
            ROE
          </Grid.Col>
          <Grid.Col span={lineColSpans.amount} style={chargeHeaderTextStyle}>
            Amount
          </Grid.Col>
          <Grid.Col span={lineColSpans.localAmount} style={chargeHeaderTextStyle}>
            Local Amount
          </Grid.Col>
          <Grid.Col span={lineColSpans.headerAmount} style={chargeHeaderTextStyle}>
            Amount in {headerCurrencyCode || localCurrency}
          </Grid.Col>
          <Grid.Col span={lineColSpans.drCr} style={chargeHeaderTextStyle}>
            Dr/Cr
          </Grid.Col>
          <Grid.Col span={lineColSpans.sac} style={chargeHeaderTextStyle}>
            SAC Code
          </Grid.Col>
          <Grid.Col span={lineColSpans.narration} style={chargeHeaderTextStyle}>
            Narration
          </Grid.Col>
          <Grid.Col span={lineColSpans.note} style={chargeHeaderTextStyle}>
            Note
          </Grid.Col>
          <Grid.Col span={lineColSpans.actions} style={chargeHeaderTextStyle}>
            Action
          </Grid.Col>

        </Grid>

          {form.values.lines.map((l, idx) => {
            const accountSelected = lineHasAccountSelection(l);
            const accountLocked = lineLocksAccountFields(l, showTradeFields);
            return (
              <Grid key={l.id} w="100%" gutter="xs" align="end" mt="xs">
                {/* <Grid.Col span={1}>
                    <Text size="sm">{idx + 1}</Text>
                  </Grid.Col> */}
                {showTradeFields && (
                  <Grid.Col span={lineColSpans.shipment}>
                    <SearchableSelect
                      apiEndpoint={URL.filterJobCreate}
                      placeholder="Shipment no"
                      value={String(l.shipment_no ?? "").trim() || null}
                      displayValue={String(l.shipment_no ?? "").trim() || null}
                      dropdownZIndex={1000}
                      minSearchLength={1}
                      searchFields={["shipment_id", "job_id", "type"]}
                      displayFormat={jobCreateDropdownDisplayFormat}
                      returnOriginalData
                      error={
                        form.errors[`lines.${idx}.shipment_no`]
                          ? String(form.errors[`lines.${idx}.shipment_no`])
                          : undefined
                      }
                      onChange={(val, _selected, original) => {
                        const shipmentNo = String(val ?? "").trim();
                        const serviceIdRaw =
                          (
                            original as {
                              service_id?: unknown;
                              serviceId?: unknown;
                            } | null
                          )?.service_id ??
                          (original as { serviceId?: unknown } | null)
                            ?.serviceId ??
                          null;
                        const serviceId =
                          serviceIdRaw != null &&
                          Number.isFinite(Number(serviceIdRaw))
                            ? Number(serviceIdRaw)
                            : null;
                        const chargeId =
                          l.charge_id != null ? Number(l.charge_id) : null;
                        if (shipmentNo) {
                          form.clearFieldError(`lines.${idx}.shipment_no`);
                          setLineById(l.id, {
                            shipment_no: shipmentNo,
                            service_id: serviceId,
                            ...(chargeId != null
                              ? mapAccountFromChargeOriginal(
                                  chargeOriginalByIdRef.current[l.id],
                                )
                              : {}),
                          });
                          if (chargeId != null) {
                            void fetchSacForLine(
                              idx,
                              chargeId,
                              shipmentNo,
                              serviceId,
                            );
                          }
                          return;
                        }
                        if (chargeId != null) {
                          form.setFieldError(
                            `lines.${idx}.shipment_no`,
                            "Shipment No is required",
                          );
                          setLineById(l.id, {
                            shipment_no: "",
                            service_id: null,
                            ...CLEARED_ACCOUNT_FIELDS,
                          });
                          return;
                        }
                        setLineById(l.id, {
                          shipment_no: "",
                          service_id: null,
                        });
                      }}
                      styles={chargeFieldStyles}
                      disabled={isReadOnly || accountSelected}
                    />
                  </Grid.Col>
                )}
                {showTradeFields && (
                  <Grid.Col span={lineColSpans.charge}>
                    <SearchableSelect
                      apiEndpoint={URL.chargeMaster}
                      placeholder="Charge"
                      value={
                        l.charge_id != null ? String(Number(l.charge_id)) : null
                      }
                      displayValue={String(l.charge_name ?? "").trim() || null}
                      dropdownZIndex={1000}
                      minSearchLength={1}
                      searchFields={["charge_code", "charge_name", "id"]}
                      displayFormat={(item: Record<string, unknown>) => {
                        const id = String(item.id ?? "").trim();
                        const name = String(item.charge_name ?? "").trim();
                        return { value: id, label: name };
                      }}
                      returnOriginalData
                      onChange={(val, selected, originalData) => {
                        const chargeId =
                          val && Number.isFinite(Number(val))
                            ? Number(val)
                            : null;
                        const nextName =
                          selected?.label ??
                          (originalData?.charge_name != null
                            ? String(originalData.charge_name)
                            : "");
                        const shipmentNo = String(l.shipment_no ?? "").trim();
                        if (chargeId == null) {
                          chargeOriginalByIdRef.current[l.id] = null;
                          form.clearFieldError(`lines.${idx}.shipment_no`);
                          setLineById(l.id, {
                            charge_id: null,
                            charge_name: "",
                            ...CLEARED_ACCOUNT_FIELDS,
                          });
                          return;
                        }
                        chargeOriginalByIdRef.current[l.id] =
                          (originalData as Record<string, unknown> | null) ??
                          null;
                        if (!shipmentNo) {
                          form.setFieldError(
                            `lines.${idx}.shipment_no`,
                            "Shipment No is required",
                          );
                          setLineById(l.id, {
                            charge_id: chargeId,
                            charge_name: nextName,
                            ...CLEARED_ACCOUNT_FIELDS,
                          });
                          return;
                        }
                        form.clearFieldError(`lines.${idx}.shipment_no`);
                        setLineById(l.id, {
                          charge_id: chargeId,
                          charge_name: nextName,
                          ...mapAccountFromChargeOriginal(
                            originalData as Record<string, unknown> | null,
                          ),
                        });
                        const serviceId =
                          l.service_id != null &&
                          Number.isFinite(Number(l.service_id))
                            ? Number(l.service_id)
                            : null;
                        void fetchSacForLine(
                          idx,
                          chargeId,
                          shipmentNo,
                          serviceId,
                        );
                      }}
                      styles={chargeFieldStyles}
                      disabled={isReadOnly || accountSelected}
                    />
                  </Grid.Col>
                )}
                {showTradeFields && (
                  <Grid.Col span={lineColSpans.crn}>
                    <Dropdown
                      data={CRN_OPTIONS}
                      value={String(l.crn ?? "") || null}
                      onChange={(v) => setLineById(l.id, { crn: v ?? "" })}
                      styles={chargeFieldStyles}
                      clearable
                      disabled={isReadOnly}
                    />
                  </Grid.Col>
                )}
                <Grid.Col span={lineColSpans.account}>
                  <SearchableSelect
                    apiEndpoint={URL.chartOfAccounts}
                    placeholder="Account"
                    value={l.account_id || null}
                    displayValue={l.account_name || null}
                    dropdownZIndex={1000}
                    minSearchLength={1}
                    searchFields={[
                      "gl_account_code",
                      "account_name",
                      "sl_code",
                      "id",
                    ]}
                    returnOriginalData
                    onChange={(val, selected, original) => {
                      if (!val || !original) {
                        setLineById(l.id, { ...CLEARED_ACCOUNT_FIELDS });
                        return;
                      }
                      const orig =
                        (original as {
                          id?: number | string;
                          gl_account_code?: string;
                          account_code?: string;
                          account_name?: string;
                          sl_code?: string;
                        } | null) ?? null;
                      const accountId =
                        orig?.id != null ? String(orig.id) : (val ?? "");
                      const code = String(
                        orig?.gl_account_code ?? orig?.account_code ?? "",
                      );
                      const name = String(
                        orig?.account_name ?? selected?.label ?? "",
                      );
                      const glName = String(
                        (orig as { gl_name?: string })?.gl_name ?? "",
                      );
                      const subledgerCode = String(orig?.sl_code ?? "");
                      setLineById(l.id, {
                        account_id: accountId,
                        account_code: code,
                        account_name: formatChartOfAccountsLabel(
                          glName,
                          code,
                          name,
                        ),
                        subledger: subledgerCode || l.subledger,
                      });
                      ensureLineRoeAndLocalAmount(l.id);
                    }}
                    displayFormat={(item) => ({
                      value: String(item.id ?? ""),
                      label: formatChartOfAccountsLabel(
                        String(
                          (item as { gl_name?: string })?.gl_name ?? "",
                        ).trim(),
                        String(
                          item.gl_account_code ?? item.account_code ?? "",
                        ).trim(),
                        String(
                          item.account_name ?? item.name ?? item.id ?? "",
                        ).trim(),
                      ),
                    })}
                    styles={chargeFieldStyles}
                    disabled={isReadOnly || accountLocked}
                  />
                </Grid.Col>
                <Grid.Col span={lineColSpans.subledger}>
                  <FormTextInput
                    value={l.subledger}
                    onChange={(e) =>
                      setLineById(l.id, { subledger: e.currentTarget.value })
                    }
                    styles={chargeFieldStyles}
                    readOnly
                    disabled={isReadOnly || accountLocked}
                  />
                </Grid.Col>
                <Grid.Col span={lineColSpans.code}>
                  <FormTextInput
                    value={l.cost_center_code}
                    onChange={(e) =>
                      setLineById(l.id, {
                        cost_center_code: e.currentTarget.value,
                      })
                    }
                    styles={chargeFieldStyles}
                    disabled={isReadOnly}
                  />
                </Grid.Col>
                <Grid.Col span={lineColSpans.key}>
                  <FormTextInput
                    value={l.cost_center_key}
                    onChange={(e) =>
                      setLineById(l.id, {
                        cost_center_key: e.currentTarget.value,
                      })
                    }
                    styles={chargeFieldStyles}
                    disabled={isReadOnly}
                  />
                </Grid.Col>
                <Grid.Col span={lineColSpans.currency}>
                  <Dropdown
                    searchable
                    data={currencyOptions.map((o) => o.label)}
                    value={
                      l.currency
                        ? String(l.currency).trim().toUpperCase()
                        : null
                    }
                    onChange={(code) => handleLineCurrencyChange(l.id, code)}
                    styles={chargeFieldStyles}
                    clearable
                    placeholder="Currency"
                    disabled={isReadOnly}
                  />
                </Grid.Col>
                <Grid.Col span={lineColSpans.roe}>
                  <FormTextInput
                    type="number"
                    value={l.roe === "" ? "" : String(l.roe)}
                    onChange={(e) => {
                      const v = sanitizeRoeInput(e.currentTarget.value);
                      const nextRoe = v === "" ? "" : v;
                      const { code: lineCode, currencyId: lineCurrencyId } =
                        resolveLineCurrencyContext(
                          l.currency,
                          currencyIdByCode,
                        );
                      if (isLineLocalCurrency(l.currency)) {
                        setLineById(l.id, {
                          roe: 1,
                          local_amount: computeLocalAmount(l.amount, 1),
                        });
                        return;
                      }
                      const roeNum = nextRoe === "" ? null : parseRoeForPayload(nextRoe);
                      const roeError = validateRoeField(
                        lineCode || headerCurrencyCode,
                        roeNum,
                        lineCurrencyId ?? form.values.currencyId,
                      );
                      if (roeError) {
                        ToastNotification({ type: "error", message: roeError });
                      }
                      const localAmount = computeLocalAmount(l.amount, nextRoe);
                      setLineById(l.id, {
                        roe: nextRoe,
                        local_amount: localAmount,
                      });
                    }}
                    styles={chargeFieldStyles}
                    disabled={isReadOnly || isLineLocalCurrency(l.currency)}
                  />
                </Grid.Col>
                <Grid.Col span={lineColSpans.amount}>
                  <FormTextInput
                    type="number"
                    value={l.amount === "" ? "" : String(l.amount)}
                    onChange={(e) => {
                      const v = e.currentTarget.value;
                      const nextAmount = v === "" ? "" : Number(v);
                      const latestLine = form
                        .getValues()
                        .lines.find((row) => row.id === l.id);
                      const roeForCalc =
                        latestLine?.roe !== "" && latestLine?.roe != null
                          ? latestLine.roe
                          : l.roe;
                      const localAmount = computeLocalAmount(
                        nextAmount,
                        roeForCalc,
                      );
                      const amountInHeader = computeAmountInHeaderCurrency(
                        nextAmount,
                        form.getValues().roe,
                      );
                      setLineById(l.id, {
                        amount: nextAmount,
                        local_amount: localAmount,
                        amount_in_inr: amountInHeader,
                      });
                    }}
                    styles={chargeFieldStyles}
                    disabled={isReadOnly}
                  />
                </Grid.Col>
                <Grid.Col span={lineColSpans.localAmount}>
                  <FormTextInput
                    value={
                      l.local_amount === ""
                        ? ""
                        : formatMoneyAmountForUi(Number(l.local_amount))
                    }
                    onChange={(e) => {
                      const v = e.currentTarget.value;
                      setLineById(l.id, {
                        local_amount: v === "" ? "" : Number(v),
                      });
                    }}
                    styles={chargeFieldStyles}
                    readOnly
                    disabled={isReadOnly}
                  />
                </Grid.Col>
                <Grid.Col span={lineColSpans.headerAmount}>
                  <FormTextInput
                    value={
                      l.amount_in_inr === ""
                        ? ""
                        : formatCurrencyAmountForUi(Number(l.amount_in_inr))
                    }
                    onChange={(e) => {
                      const v = e.currentTarget.value;
                      setLineById(l.id, {
                        amount_in_inr: v === "" ? "" : Number(v),
                      });
                    }}
                    styles={chargeFieldStyles}
                    readOnly
                    disabled={isReadOnly}
                  />
                </Grid.Col>
                <Grid.Col span={lineColSpans.drCr}>
                  <Dropdown
                    data={["Dr", "Cr"]}
                    value={l.dr_cr || null}
                    onChange={(v) =>
                      setLineById(l.id, {
                        dr_cr: (v as "Dr" | "Cr" | null) ?? "",
                      })
                    }
                    styles={chargeFieldStyles}
                    clearable
                    disabled={isReadOnly}
                  />
                </Grid.Col>
                <Grid.Col span={lineColSpans.sac}>
                  <Dropdown
                    searchable
                    data={sacCodeOptionsForForm}
                    value={String(l.sac_code ?? "").trim() || null}
                    onChange={(val) => {
                      setLineById(l.id, { sac_code: String(val ?? "").trim() });
                    }}
                    styles={chargeFieldStyles}
                    clearable
                    placeholder="SAC"
                    disabled={isReadOnly}
                  />
                </Grid.Col>
                <Grid.Col span={lineColSpans.narration}>
                  <FormTextInput
                    value={l.narration}
                    onChange={(e) =>
                      setLineById(l.id, { narration: e.currentTarget.value })
                    }
                    styles={chargeFieldStyles}
                    disabled={isReadOnly}
                  />
                </Grid.Col>
                <Grid.Col span={lineColSpans.note}>
                  <FormTextInput
                    value={l.note}
                    onChange={(e) =>
                      setLineById(l.id, { note: e.currentTarget.value })
                    }
                    styles={chargeFieldStyles}
                    disabled={isReadOnly}
                  />
                </Grid.Col>
                <Grid.Col span={lineColSpans.actions}>
                  <Group gap={6} justify="flex-start" wrap="nowrap">
                    {!isReadOnly && idx === form.values.lines.length - 1 && (
                      <Button
                        type="button"
                        radius="sm"
                        size="xs"
                        variant="light"
                        color="#105476"
                        onClick={addLine}
                        styles={{
                          root: {
                            width: 34,
                            paddingInline: 0,
                            paddingBlock: 6,
                          },
                        }}
                      >
                        <IconPlus size={16} />
                      </Button>
                    )}
                    {!isReadOnly && form.values.lines.length > 1 && (
                      <Button
                        type="button"
                        variant="light"
                        color="red"
                        size="xs"
                        onClick={() => removeLine(l.id)}
                        styles={{
                          root: {
                            width: 34,
                            paddingInline: 0,
                            paddingBlock: 6,
                          },
                        }}
                      >
                        <IconTrash size={16} />
                      </Button>
                    )}
                  </Group>
                </Grid.Col>
              </Grid>
            );
          })}

        {/* removed: DR/CR/Net INR totals */}
        {/* </Card> */}
      </Stack>
      {/* </Box> */}

      <Group justify="space-between" mt="lg">
        <Button
          variant="outline"
          color="#105476"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() =>
            navigate(
              showTradeFields
                ? "/debit-credit-note-trade"
                : "/debit-credit-note-non-trade",
            )
          }
        >
          Back
        </Button>

        <Group gap="sm">
          <Button
            variant="outline"
            color="#105476"
            leftSection={<IconUpload size={16} />}
            onClick={() => {
              if (form.values.supporting_documents.length === 0) {
                form.setFieldValue("supporting_documents", [
                  { name: "", file: null },
                ]);
              }
              setDocumentsOpen(true);
            }}
            disabled={isReadOnly}
          >
            Attach Documents
          </Button>
          <Button
            color="#105476"
            onClick={isEditMode ? onUpdate : onCreate}
            disabled={isReadOnly}
          >
            {isEditMode ? "Update" : "Create"}
          </Button>
          {isEditMode && !isPosted && canPostDocuments && (
            <Button
              variant="outline"
              color="#105476"
              onClick={handlePost}
              disabled={isReadOnly}
            >
              Post
            </Button>
          )}
        </Group>
      </Group>

      <Modal
        opened={previewOpen}
        onClose={handleClosePreview}
        title="PDF Preview"
        centered
        size="95%"
        overlayProps={{
          backgroundOpacity: 0.55,
          blur: 3,
        }}
        styles={{
          content: {
            minHeight: "90vh",
            maxWidth: "1200px",
          },
          body: {
            padding: 0,
            height: "100%",
          },
        }}
      >
        <Stack h="82vh">
          {pdfBlob ? (
            <>
              <iframe
                src={pdfBlob}
                style={{
                  width: "100%",
                  height: "100%",
                  border: "none",
                  borderRadius: "8px",
                }}
                title="PDF Preview"
              />
              <Group
                justify="flex-end"
                p="md"
                style={{ borderTop: "1px solid #e9ecef" }}
              >
                <Button
                  variant="outline"
                  onClick={handleClosePreview}
                  leftSection={<IconX size={16} />}
                >
                  Close
                </Button>
                <Button
                  onClick={handleDownloadPDF}
                  leftSection={<IconDownload size={16} />}
                  color="#105476"
                >
                  Download PDF
                </Button>
              </Group>
            </>
          ) : (
            <Center h="100%">
              <Stack align="center">
                <Loader size="lg" color="#105476" />
                <Text c="dimmed">Generating PDF preview...</Text>
              </Stack>
            </Center>
          )}
        </Stack>
      </Modal>
    </Box>
  );
}

export default function DebitCreditNoteNonTradeCreate() {
  return (
    <DebitCreditNoteCreateBase
      payloadType="non_trade"
      showTradeFields={false}
    />
  );
}
