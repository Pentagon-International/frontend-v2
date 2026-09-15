import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Box,
  Button,
  Group,
  Loader,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  ThemeIcon,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconReceipt, IconTrash, IconUpload } from "@tabler/icons-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Dropdown, SearchableSelect, SingleDateInput, ToastNotification } from "./index";
import { URL } from "../api/serverUrls";
import { commonSearchAPI } from "../service/searchApi";
import { getAPICall } from "../service/getApiCall";
import { postAPICall } from "../service/postApiCall";
import { API_HEADER } from "../store/storeKeys";
import useAuthStore from "../store/authStore";
import {
  getBranchGstNo,
  getDefaultUserBranch,
  isIndianOutstandingBranch,
  isIndianUserCountry,
} from "../utils/userNumberFormat";
import {
  collectPartyGstOptions,
  extractPartyTdsSectionsFromRecord,
  findPartyAddressByGst,
  findPrimaryPartyAddress,
  getPartyGstFromPrimaryAddress,
  resolvePartyTdsSectionCode,
  resolveStateCodeFromPartyAddress,
  type PartyAddressLike,
} from "../utils/paymentRequestChargePrefill";
import {
  PAID_TO_TYPE_OPTIONS,
  PAYMENT_TYPE_OPTIONS,
  VOUCHER_TYPE_OPTIONS,
  buildPaymentRequestOverrideDraft,
  buildPaymentRequestStartPayload,
  extractPaymentRequestId,
  isPaymentRequestAbortError,
  isPaymentRequestCreated,
  isPaymentRequestCreationSettled,
  isPaymentRequestExtracted,
  isPaymentRequestExtractionSettled,
  getPaymentRequestOverrideFieldErrors,
  hasPaymentRequestOverrideFieldErrors,
  isPaymentRequestTaxChargeDraft,
  pollPaymentRequestRecord,
  readableError,
  recalculateAutomationChargeAmounts,
  startPaymentRequestCreation,
  uploadPaymentRequestPdf,
  limitToMaxWords,
  type PaymentRequestAutomationRecord,
  type PaymentRequestExtractedData,
  type PaymentRequestFieldErrors,
  type PaymentRequestOverrideDraft,
} from "../utils/paymentRequestAutomation";

const NOTE_MAX_WORDS = 20;

type ModalStep = "upload" | "extracting" | "review" | "creating";

type PaymentRequestAutomationModalProps = {
  opened: boolean;
  onClose: () => void;
  shipmentNo?: string;
  voucherType?: string;
};

type DualPartyOption = {
  value: string;
  label: string;
  paid_to_type: "supplier" | "agent";
  original: Record<string, unknown>;
};

const fieldStyles = {
  label: {
    fontSize: 12,
    fontWeight: 500,
    color: "#495057",
    marginBottom: 4,
    fontFamily: "Inter",
  },
  input: {
    fontSize: 13,
    fontFamily: "Inter",
    height: 36,
    background: "#fff",
  },
} as const;

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

function extractRows(response: unknown): Record<string, unknown>[] {
  if (Array.isArray(response)) return response as Record<string, unknown>[];
  if (response && typeof response === "object") {
    const obj = response as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as Record<string, unknown>[];
    if (Array.isArray(obj.results)) return obj.results as Record<string, unknown>[];
  }
  return [];
}

function partyOptionValue(kind: "supplier" | "agent", id: string): string {
  return `${kind}:${id}`;
}

function parsePartyOptionValue(value: string | null): {
  paid_to_type: "supplier" | "agent";
  account_id: string;
} | null {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(supplier|agent):(\d+)$/i);
  if (!match) return null;
  return {
    paid_to_type: match[1].toLowerCase() as "supplier" | "agent",
    account_id: match[2],
  };
}

function resolveUnitServiceType(voucherType: string): string {
  const raw = String(voucherType ?? "").trim().toUpperCase();
  if (raw.includes("AIR")) return "AIR";
  // Match common PRQ / job usage: non-air vouchers still use the filtered unit list.
  if (raw.includes("SEA") || raw.includes("COASTAL") || raw.includes("CFS")) return "SEA";
  if (raw.includes("TRANSPORT")) return "AIR";
  return "AIR";
}

async function fetchUnitMasterOptions(
  serviceType: string,
): Promise<Array<{ value: string; label: string }>> {
  try {
    const response = await postAPICall(
      URL.unitMasterFilter,
      { filters: { service_type: serviceType } },
      API_HEADER,
    );
    const rows = (response as { data?: unknown } | null)?.data;
    if (!Array.isArray(rows)) return [];
    return rows
      .map((item) => {
        const row = item as { id?: unknown; unit_code?: unknown; unit_name?: unknown };
        return {
          value: String(row.id ?? "").trim(),
          label: String(row.unit_code ?? row.unit_name ?? row.id ?? "").trim(),
        };
      })
      .filter((option) => option.value !== "");
  } catch {
    return [];
  }
}

async function fetchStateMasterOptions(): Promise<Array<{ value: string; label: string }>> {
  try {
    const response = await getAPICall(URL.state, API_HEADER);
    const rows =
      (response as { data?: unknown } | null)?.data ?? response;
    if (!Array.isArray(rows)) return [];
    return rows
      .map((item) => {
        const row = item as { id?: unknown; state_name?: unknown; name?: unknown };
        return {
          value: String(row.id ?? "").trim(),
          label: String(row.state_name ?? row.name ?? "").trim(),
        };
      })
      .filter((option) => option.value !== "");
  } catch {
    return [];
  }
}

/** Resolve state id + display name from a party address (GST selection sync). */
function resolveAutomationStateFromAddress(
  address: PartyAddressLike | undefined,
  stateOptions: Array<{ value: string; label: string }>,
): { state_id: string; state_name: string } {
  if (!address) return { state_id: "", state_name: "" };

  let candidateId = "";
  let candidateName = "";
  const nested = address.state;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const obj = nested as Record<string, unknown>;
    candidateId = String(obj.id ?? obj.state_id ?? "").trim();
    candidateName = String(obj.state_name ?? obj.name ?? "").trim();
  } else if (nested != null && String(nested).trim() !== "") {
    const raw = String(nested).trim();
    if (/^\d+$/.test(raw)) candidateId = raw;
    else candidateName = raw;
  }
  if (address.state_id != null && String(address.state_id).trim() !== "") {
    candidateId = String(address.state_id).trim();
  }

  const byId = candidateId
    ? stateOptions.find((option) => option.value === candidateId)
    : undefined;
  const byName = candidateName
    ? stateOptions.find(
        (option) => option.label.trim().toLowerCase() === candidateName.toLowerCase(),
      )
    : undefined;
  const matched = byId ?? byName;
  if (matched) {
    return { state_id: matched.value, state_name: matched.label };
  }

  const fallbackId = resolveStateCodeFromPartyAddress(address, stateOptions);
  if (!fallbackId) return { state_id: "", state_name: "" };
  const fallbackLabel =
    stateOptions.find((option) => option.value === fallbackId)?.label || candidateName;
  return { state_id: fallbackId, state_name: fallbackLabel };
}

function DualPartySearchSelect({
  value,
  displayValue,
  paidToType,
  onSelect,
  styles,
  error,
}: {
  value: string | null;
  displayValue?: string;
  paidToType: string;
  onSelect: (payload: {
    account_id: string;
    paid_to: string;
    account_code: string;
    paid_to_type: "supplier" | "agent";
    original: Record<string, unknown> | null;
  }) => void;
  styles?: Record<string, unknown>;
  error?: ReactNode;
}) {
  const [search, setSearch] = useState(displayValue ?? "");
  const [debounced] = useDebouncedValue(search, 350);
  const [options, setOptions] = useState<DualPartyOption[]>([]);
  const [loading, setLoading] = useState(false);
  const originalsRef = useRef<Map<string, DualPartyOption>>(new Map());
  const selectedOptionRef = useRef<DualPartyOption | null>(null);
  const displayValueRef = useRef(displayValue);
  const valueRef = useRef(value);
  /** Skip API search after selection / parent display sync (avoids loading loop). */
  const skipNextSearchRef = useRef(Boolean(value || displayValue));

  displayValueRef.current = displayValue;
  valueRef.current = value;

  const selectValue =
    value && paidToType
      ? partyOptionValue(
          (paidToType.toLowerCase() === "agent" ? "agent" : "supplier") as "supplier" | "agent",
          value,
        )
      : null;

  useEffect(() => {
    // Parent updated the selected party label/id — sync the input only; do not re-search.
    skipNextSearchRef.current = true;
    setSearch(displayValue ?? "");
    setLoading(false);
  }, [displayValue, value]);

  useEffect(() => {
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      setLoading(false);
      return;
    }
    const query = debounced.trim();
    if (query.length < 1) {
      setOptions(selectedOptionRef.current ? [selectedOptionRef.current] : []);
      setLoading(false);
      return;
    }
    // Already selected and search text matches display — keep selection, no fetch.
    const selectedDisplay = String(displayValueRef.current ?? "").trim();
    if (
      valueRef.current &&
      selectedDisplay &&
      query.toLowerCase() === selectedDisplay.toLowerCase()
    ) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [supplierRes, agentRes] = await Promise.all([
          postAPICall(URL.customerFilter, supplierAccountNameSearchBody(query), API_HEADER).catch(
            () => null,
          ),
          commonSearchAPI({ endpoint: URL.agent, query }).catch(() => []),
        ]);
        if (cancelled) return;
        const next: DualPartyOption[] = [];
        const map = new Map<string, DualPartyOption>();
        for (const row of extractRows(supplierRes)) {
          const id = String(row.id ?? "").trim();
          if (!id) continue;
          const label = String(row.customer_name ?? row.name ?? row.customer_code ?? id);
          const option: DualPartyOption = {
            value: partyOptionValue("supplier", id),
            label: `${label} (Supplier)`,
            paid_to_type: "supplier",
            original: { ...row, __paid_to_type: "supplier" },
          };
          next.push(option);
          map.set(option.value, option);
        }
        for (const row of extractRows(agentRes)) {
          const id = String(row.id ?? "").trim();
          if (!id) continue;
          const label = String(row.customer_name ?? row.name ?? row.customer_code ?? id);
          const option: DualPartyOption = {
            value: partyOptionValue("agent", id),
            label: `${label} (Agent)`,
            paid_to_type: "agent",
            original: { ...row, __paid_to_type: "agent" },
          };
          next.push(option);
          map.set(option.value, option);
        }
        originalsRef.current = map;
        setOptions(next);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const selectData = useMemo(() => {
    const list = options.map((option) => ({ value: option.value, label: option.label }));
    if (
      selectValue &&
      displayValue &&
      !list.some((option) => option.value === selectValue)
    ) {
      const selected = selectedOptionRef.current;
      list.unshift({
        value: selectValue,
        label: selected?.value === selectValue ? selected.label : displayValue,
      });
    }
    return list;
  }, [options, selectValue, displayValue]);

  return (
    <Select
      label="Party Name"
      placeholder="Search supplier or agent"
      withAsterisk
      searchable
      clearable
      data={selectData}
      value={selectValue}
      searchValue={search}
      onSearchChange={(text) => {
        if (text !== search) {
          skipNextSearchRef.current = false;
        }
        setSearch(text);
      }}
      nothingFoundMessage={loading ? "Searching..." : "No parties found"}
      rightSection={loading ? <Loader size={14} /> : undefined}
      styles={styles}
      error={error}
      comboboxProps={{ zIndex: 400 }}
      onChange={(next) => {
        if (!next) {
          selectedOptionRef.current = null;
          skipNextSearchRef.current = true;
          setSearch("");
          setOptions([]);
          setLoading(false);
          onSelect({
            account_id: "",
            paid_to: "",
            account_code: "",
            paid_to_type: "supplier",
            original: null,
          });
          return;
        }
        const parsed = parsePartyOptionValue(next);
        const option = originalsRef.current.get(next) ?? selectedOptionRef.current;
        const original = option?.original ?? null;
        const label = String(
          original?.customer_name ??
            original?.name ??
            option?.label?.replace(/\s*\((Supplier|Agent)\)$/, "") ??
            "",
        );
        if (option) {
          selectedOptionRef.current = option;
          originalsRef.current.set(option.value, option);
          setOptions([option]);
        }
        // Freeze search on the display label so selection does not re-trigger API loading.
        skipNextSearchRef.current = true;
        setLoading(false);
        setSearch(label);
        onSelect({
          account_id: parsed?.account_id ?? "",
          paid_to: label,
          account_code: String(original?.customer_code ?? original?.account_code ?? ""),
          paid_to_type: parsed?.paid_to_type ?? option?.paid_to_type ?? "supplier",
          original,
        });
      }}
    />
  );
}

function isoDateToDate(value: string): Date | null {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateToIso(value: Date | null): string {
  if (!value) return "";
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${value.getFullYear()}-${month}-${day}`;
}

function PreviewSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <Box
      p="md"
      style={{
        background: "#fff",
        border: "1px solid #e9ecef",
        borderRadius: 10,
      }}
    >
      <Text size="sm" fw={600} c="#105476" mb={hint ? 2 : 10}>
        {title}
      </Text>
      {hint ? (
        <Text size="xs" c="dimmed" mb={10}>
          {hint}
        </Text>
      ) : null}
      {children}
    </Box>
  );
}

function AmountTile({
  label,
  value,
  currency,
}: {
  label: string;
  value?: string | number | null;
  currency?: string;
}) {
  const raw = value == null ? "" : String(value).trim();
  const text =
    raw === ""
      ? "—"
      : currency
        ? `${currency} ${raw}`
        : raw;
  return (
    <Box
      p="sm"
      style={{
        background: "#f8fafc",
        border: "1px solid #e9ecef",
        borderRadius: 8,
      }}
    >
      <Text size="xs" c="dimmed" mb={2}>
        {label}
      </Text>
      <Text size="sm" fw={600}>
        {text}
      </Text>
    </Box>
  );
}

function sumChargeMoney(
  rows: Array<{ amount?: string; local_amount?: string }>,
  field: "amount" | "local_amount",
): string {
  let total = 0;
  let hasValue = false;
  for (const row of rows) {
    const raw = String(row[field] ?? "").replace(/,/g, "").trim();
    if (!raw) continue;
    const num = Number(raw);
    if (!Number.isFinite(num)) continue;
    total += num;
    hasValue = true;
  }
  return hasValue ? total.toFixed(2) : "";
}

function toDisplayMoney(value: unknown): string {
  const raw = String(value ?? "").replace(/,/g, "").trim();
  if (!raw) return "";
  const num = Number(raw);
  if (!Number.isFinite(num) || num <= 0) return "";
  return num.toFixed(2);
}

export function PaymentRequestAutomationModal({
  opened,
  onClose,
  shipmentNo = "",
  voucherType = "",
}: PaymentRequestAutomationModalProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputId = useId();
  const pollAbortRef = useRef<AbortController | null>(null);
  const user = useAuthStore((state) => state.user);
  const defaultBranch = getDefaultUserBranch(user?.branches);
  const branchLocationGstNo = getBranchGstNo(defaultBranch);
  const isIndiaUser = useMemo(() => {
    const branchCountryCode = defaultBranch?.country?.country_code;
    const branchCurrencyCode = defaultBranch?.currency?.currency_code;
    if (branchCountryCode || branchCurrencyCode) {
      return isIndianOutstandingBranch(branchCountryCode, branchCurrencyCode);
    }
    return (
      isIndianUserCountry(user?.country?.country_code) ||
      String(user?.country?.country_name ?? "").toLowerCase().includes("india")
    );
  }, [defaultBranch, user?.country?.country_code, user?.country?.country_name]);

  const [step, setStep] = useState<ModalStep>("upload");
  const [files, setFiles] = useState<File[]>([]);
  const [record, setRecord] = useState<PaymentRequestAutomationRecord | null>(null);
  const [override, setOverride] = useState<PaymentRequestOverrideDraft | null>(null);
  const [partyAddresses, setPartyAddresses] = useState<PartyAddressLike[]>([]);
  const [unitOptions, setUnitOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [stateOptions, setStateOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const [startingJob, setStartingJob] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [activeShipmentNo, setActiveShipmentNo] = useState(shipmentNo);
  const [fieldErrors, setFieldErrors] = useState<PaymentRequestFieldErrors>({
    header: {},
    charges: [],
  });

  const clearHeaderError = (key: string) => {
    setFieldErrors((prev) => {
      if (!prev.header[key]) return prev;
      const header = { ...prev.header };
      delete header[key];
      return { ...prev, header };
    });
  };

  const clearChargeError = (index: number, key: string) => {
    setFieldErrors((prev) => {
      const row = prev.charges[index];
      if (!row?.[key]) return prev;
      const charges = prev.charges.map((item, i) => {
        if (i !== index) return item;
        const next = { ...item };
        delete next[key];
        return next;
      });
      return { ...prev, charges };
    });
  };

  const partyGstOptions = useMemo(
    () => collectPartyGstOptions(partyAddresses),
    [partyAddresses],
  );

  const chargesAmountTotal = useMemo(
    () => (override ? sumChargeMoney(override.charges_data, "amount") : ""),
    [override],
  );
  const chargesLocalTotal = useMemo(
    () => (override ? sumChargeMoney(override.charges_data, "local_amount") : ""),
    [override],
  );
  const taxChargeRows = useMemo(
    () => (override ? override.charges_data.filter((row) => isPaymentRequestTaxChargeDraft(row)) : []),
    [override],
  );
  const serviceChargeCount = useMemo(
    () =>
      override
        ? override.charges_data.filter((row) => !isPaymentRequestTaxChargeDraft(row)).length
        : 0,
    [override],
  );
  const taxBreakupTotals = useMemo(() => {
    if (!override) return { cgst: "", sgst: "", igst: "", total: "" };
    let cgst = toDisplayMoney(override.cgst_amount);
    let sgst = toDisplayMoney(override.sgst_amount);
    let igst = toDisplayMoney(override.igst_amount);
    for (const row of override.charges_data) {
      if (!isPaymentRequestTaxChargeDraft(row)) continue;
      const name = `${row.charge_name || ""} ${row.narration || ""}`.toUpperCase();
      const amt = toDisplayMoney(row.amount);
      if (!amt) continue;
      if (!cgst && name.includes("CGST")) cgst = amt;
      else if (!sgst && name.includes("SGST")) sgst = amt;
      else if (!igst && name.includes("IGST")) igst = amt;
    }
    const nums = [cgst, sgst, igst]
      .map((v) => Number(String(v).replace(/,/g, "")))
      .filter((n) => Number.isFinite(n) && n > 0);
    const total =
      nums.length > 0 ? nums.reduce((a, b) => a + b, 0).toFixed(2) : "";
    return { cgst, sgst, igst, total };
  }, [override]);

  const showTaxBreakup =
    taxChargeRows.length > 0 ||
    !!toDisplayMoney(override?.cgst_amount) ||
    !!toDisplayMoney(override?.sgst_amount) ||
    !!toDisplayMoney(override?.igst_amount);

  useEffect(() => {
    if (!opened) return;
    let cancelled = false;
    (async () => {
      const [units, states] = await Promise.all([
        fetchUnitMasterOptions(resolveUnitServiceType(voucherType)),
        fetchStateMasterOptions(),
      ]);
      if (cancelled) return;
      setUnitOptions(units);
      setStateOptions(states);
    })();
    return () => {
      cancelled = true;
    };
  }, [opened, voucherType]);

  const beginPoll = () => {
    pollAbortRef.current?.abort();
    const controller = new AbortController();
    pollAbortRef.current = controller;
    return controller.signal;
  };

  const stopPoll = () => {
    pollAbortRef.current?.abort();
    pollAbortRef.current = null;
  };

  const resetModal = useCallback(() => {
    setStep("upload");
    setFiles([]);
    setRecord(null);
    setOverride(null);
    setPartyAddresses([]);
    setUploading(false);
    setStartingJob(false);
    setActiveShipmentNo(shipmentNo);
    setFieldErrors({ header: {}, charges: [] });
  }, [shipmentNo]);

  useEffect(() => {
    if (!opened && !isRedirecting) {
      stopPoll();
      resetModal();
    }
  }, [opened, isRedirecting, resetModal]);

  useEffect(() => stopPoll, []);

  useEffect(() => {
    if (!opened) return;
    setActiveShipmentNo(shipmentNo);
  }, [opened, shipmentNo]);

  const handleClose = () => {
    if (uploading || startingJob || isRedirecting) return;
    onClose();
  };

  const addFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const allowed = /\.(pdf|jpg|jpeg|png|gif|bmp|webp|tiff?|svg)$/i;
    const next = Array.from(fileList).filter((file) => allowed.test(file.name));
    setFiles((prev) => {
      const names = new Set(prev.map((file) => file.name));
      return [...prev, ...next.filter((file) => !names.has(file.name))];
    });
  };

  const handleUploadAndExtract = async () => {
    const resolvedShipment = (activeShipmentNo || shipmentNo).trim();
    if (!files.length || !resolvedShipment) {
      ToastNotification({
        type: "error",
        message: "Shipment number not found for payment request automation.",
      });
      return;
    }
    setUploading(true);
    setStep("extracting");
    try {
      const { recordId } = await uploadPaymentRequestPdf(files, resolvedShipment, voucherType);
      const extractedRecord = await pollPaymentRequestRecord(
        recordId,
        isPaymentRequestExtractionSettled,
        { signal: beginPoll() },
      );
      if (!isPaymentRequestExtracted(extractedRecord)) {
        throw new Error(extractedRecord.failer_message || "No extracted payment request data found.");
      }
      const draft = buildPaymentRequestOverrideDraft(
        extractedRecord.extracted_data,
        resolvedShipment,
        voucherType,
      );
      if (!draft.location_gst_no && branchLocationGstNo) {
        draft.location_gst_no = branchLocationGstNo;
      }
      setRecord(extractedRecord);
      setPartyAddresses([]);
      setOverride(draft);
      setStep("review");
    } catch (error) {
      if (isPaymentRequestAbortError(error)) return;
      ToastNotification({
        type: "error",
        message: readableError(error, "Failed to upload and extract the payment request."),
      });
      setStep("upload");
    } finally {
      setUploading(false);
    }
  };

  const handleCreate = async () => {
    if (!record?.id || !override) return;
    const errors = getPaymentRequestOverrideFieldErrors(activeShipmentNo, override, {
      requireGst: isIndiaUser,
    });
    if (hasPaymentRequestOverrideFieldErrors(errors)) {
      setFieldErrors(errors);
      ToastNotification({
        type: "error",
        message: "Fill the required payment request fields before creating.",
      });
      return;
    }
    setFieldErrors({ header: {}, charges: [] });
    let startPayload;
    try {
      startPayload = buildPaymentRequestStartPayload(record.id, activeShipmentNo, override, {
        requireGst: isIndiaUser,
      });
    } catch (error) {
      ToastNotification({
        type: "error",
        message: readableError(error, "Fill the required payment request fields before creating."),
      });
      return;
    }
    setStartingJob(true);
    setStep("creating");
    try {
      const startResponse = await startPaymentRequestCreation(startPayload);
      let paymentRequestId = extractPaymentRequestId(startResponse, record);
      if (!paymentRequestId) {
        const createdRecord = await pollPaymentRequestRecord(
          record.id,
          isPaymentRequestCreationSettled,
          { signal: beginPoll() },
        );
        isPaymentRequestCreated(createdRecord);
        paymentRequestId = extractPaymentRequestId(null, createdRecord);
      }
      if (!paymentRequestId) {
        throw new Error("Payment request was created but the request id was not returned.");
      }
      setIsRedirecting(true);
      ToastNotification({
        type: "success",
        message: "Payment request created successfully. Opening the payment request...",
      });
      const returnNav = {
        returnTo: `${location.pathname}${location.search}`,
        ...(location.state != null ? { returnToState: location.state } : {}),
      };
      navigate(`/payment-request/edit/${paymentRequestId}`, { state: returnNav });
      onClose();
    } catch (error) {
      if (isPaymentRequestAbortError(error)) return;
      setIsRedirecting(false);
      ToastNotification({
        type: "error",
        message: readableError(error, "Failed to create the payment request."),
      });
      setStep("review");
    } finally {
      setStartingJob(false);
    }
  };

  const extracted: PaymentRequestExtractedData = record?.extracted_data ?? {};
  const patchOverride = (patch: Partial<PaymentRequestOverrideDraft>) => {
    if (!override) return;
    setOverride({ ...override, ...patch });
  };
  const patchCharge = (
    index: number,
    patch: Partial<PaymentRequestOverrideDraft["charges_data"][number]>,
    options?: { recalc?: boolean },
  ) => {
    if (!override) return;
    setOverride({
      ...override,
      charges_data: override.charges_data.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row, ...patch };
        if (options?.recalc) {
          // Qty / rate / ROE edits: recompute amount from qty×rate when those fields drive the change.
          const forceFromQtyRate =
            "no_of_unit" in patch || "amount_per_unit" in patch || "roe" in patch;
          return {
            ...next,
            ...recalculateAutomationChargeAmounts(next, { forceFromQtyRate }),
          };
        }
        return next;
      }),
    });
  };

  const removeCharge = (index: number) => {
    if (!override) return;
    const rows = override.charges_data;
    const target = rows[index];
    if (!target) return;
    const isTax = isPaymentRequestTaxChargeDraft(target);
    const serviceCount = rows.filter((row) => !isPaymentRequestTaxChargeDraft(row)).length;
    // Keep at least one service charge line (tax rows may be removed freely).
    if (!isTax && serviceCount <= 1) return;
    if (rows.length <= 1) return;
    setOverride({
      ...override,
      charges_data: rows.filter((_, i) => i !== index),
    });
  };

  const applyPartySelection = (payload: {
    account_id: string;
    paid_to: string;
    account_code: string;
    paid_to_type: "supplier" | "agent";
    original: Record<string, unknown> | null;
  }) => {
    if (!override) return;
    if (!payload.account_id) {
      setPartyAddresses([]);
      patchOverride({
        account_id: "",
        account_code: "",
        paid_to: "",
        paid_to_type: payload.paid_to_type || override.paid_to_type || "supplier",
        customer_gst_no: "",
        tds_section_code: "",
        state_id: "",
        state_name: "",
      });
      return;
    }
    const addresses = (payload.original?.addresses_data ??
      payload.original?.addresses) as PartyAddressLike[] | undefined;
    const nextAddresses = Array.isArray(addresses) ? addresses : [];
    setPartyAddresses(nextAddresses);
    const primary = findPrimaryPartyAddress(nextAddresses);
    const stateFromAddress = resolveAutomationStateFromAddress(primary, stateOptions);
    patchOverride({
      account_id: payload.account_id,
      account_code: payload.account_code,
      paid_to: payload.paid_to,
      paid_to_type: payload.paid_to_type,
      customer_gst_no: getPartyGstFromPrimaryAddress(nextAddresses),
      location_gst_no: override.location_gst_no || branchLocationGstNo || "",
      tds_section_code: resolvePartyTdsSectionCode(
        extractPartyTdsSectionsFromRecord(payload.original),
      ),
      state_id: stateFromAddress.state_id || override.state_id,
      state_name: stateFromAddress.state_name || override.state_name,
    });
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Group gap="sm">
          <ThemeIcon size={32} radius="md" color="#105476" variant="light">
            <IconReceipt size={18} />
          </ThemeIcon>
          <Box>
            <Text fw={600} size="sm">
              Automate Payment Request
            </Text>
            <Text size="xs" c="dimmed">
              Shipment: {activeShipmentNo || "—"}
            </Text>
          </Box>
        </Group>
      }
      size="90%"
      centered
      closeOnClickOutside={!uploading && !startingJob && !isRedirecting}
      closeOnEscape={!uploading && !startingJob && !isRedirecting}
      styles={{
        content: {
          overflow: "hidden",
          maxHeight: "calc(100dvh - 2rem)",
          ...(step === "review" ? { height: "calc(100dvh - 2rem)" } : {}),
          display: "flex",
          flexDirection: "column",
        },
        body: {
          overflow: "hidden",
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      <Stack gap="md" style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        {step === "upload" && (
          <>
            <Box
              onClick={() => (document.getElementById(fileInputId) as HTMLInputElement)?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                addFiles(event.dataTransfer.files);
              }}
              style={{
                border: "1.5px dashed #7dd3fc",
                borderRadius: 12,
                padding: 28,
                textAlign: "center",
                cursor: "pointer",
                background: "#f0f9ff",
              }}
            >
              <IconUpload size={28} color="#105476" />
              <Text size="sm" mt="xs">
                Drop payment request PDF or click to browse
              </Text>
              <Text size="xs" c="dimmed">
                PDF or image formats supported
              </Text>
            </Box>
            <input
              id={fileInputId}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.gif,.bmp,.webp,.tiff,.tif,.svg,image/*"
              multiple
              onChange={(event) => addFiles(event.target.files)}
              style={{ display: "none" }}
            />
            {files.map((file, index) => (
              <Group
                key={`${file.name}-${index}`}
                justify="space-between"
                p="xs"
                style={{ border: "1px solid #e9ecef", borderRadius: 8 }}
              >
                <Text size="sm" fw={500}>
                  {file.name}
                </Text>
                <Button
                  variant="subtle"
                  color="red"
                  size="xs"
                  onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                >
                  Remove
                </Button>
              </Group>
            ))}
            <Group justify="flex-end">
              <Button variant="default" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                color="#105476"
                leftSection={<IconUpload size={16} />}
                disabled={!files.length || uploading}
                onClick={handleUploadAndExtract}
              >
                Upload & Extract
              </Button>
            </Group>
          </>
        )}

        {(step === "extracting" || step === "creating") && (
          <Stack align="center" py="xl" gap="sm">
            <Loader color="#105476" />
            <Text size="sm" fw={500}>
              {step === "extracting"
                ? "Extracting payment request data..."
                : isRedirecting
                  ? "Opening payment request..."
                  : "Creating payment request..."}
            </Text>
          </Stack>
        )}

        {step === "review" && override && (
          <Stack gap="sm" style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
            <Box style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
              <Stack gap="sm" pr="xs">
                {extracted.enrichment_error ? (
                  <Text size="xs" c="orange.8">
                    {extracted.enrichment_error}
                  </Text>
                ) : null}
                <PreviewSection
                  title="Payment request to create"
                  hint="These fields are sent when you create the payment request. Party search includes both suppliers and agents."
                >
                  <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
                    <TextInput
                      label="Shipment No."
                      withAsterisk
                      value={override.job_reference}
                      error={fieldErrors.header.job_reference}
                      onChange={(event) => {
                        const next = event.currentTarget.value;
                        clearHeaderError("job_reference");
                        setActiveShipmentNo(next);
                        patchOverride({
                          job_reference: next,
                          charges_data: override.charges_data.map((row) => ({ ...row, job_id: next })),
                        });
                      }}
                      styles={fieldStyles}
                    />
                    <SingleDateInput
                      label="Date"
                      placeholder="Select date"
                      withAsterisk
                      size="sm"
                      value={isoDateToDate(override.date)}
                      error={fieldErrors.header.date}
                      onChange={(date) => {
                        clearHeaderError("date");
                        patchOverride({ date: dateToIso(date) });
                      }}
                      styles={fieldStyles}
                    />
                    <Dropdown
                      label="Payment Type"
                      placeholder="Select payment type"
                      data={PAYMENT_TYPE_OPTIONS}
                      value={override.payment_type || null}
                      error={fieldErrors.header.payment_type}
                      onChange={(value) => {
                        clearHeaderError("payment_type");
                        patchOverride({ payment_type: value ?? "" });
                      }}
                      searchable
                      withAsterisk
                      dropdownZIndex={400}
                    />
                    <Dropdown
                      label="Voucher Type"
                      placeholder="Select voucher type"
                      data={VOUCHER_TYPE_OPTIONS}
                      value={override.vouchar_type || null}
                      error={fieldErrors.header.vouchar_type}
                      onChange={(value) => {
                        clearHeaderError("vouchar_type");
                        patchOverride({ vouchar_type: value ?? "" });
                      }}
                      searchable
                      withAsterisk
                      dropdownZIndex={400}
                    />
                    <Dropdown
                      label="Paid To Type"
                      placeholder="Auto from party"
                      data={PAID_TO_TYPE_OPTIONS}
                      value={override.paid_to_type || null}
                      onChange={(value) => patchOverride({ paid_to_type: value ?? "" })}
                      dropdownZIndex={400}
                    />
                    <DualPartySearchSelect
                      value={override.account_id || null}
                      displayValue={override.paid_to || undefined}
                      paidToType={override.paid_to_type}
                      styles={fieldStyles}
                      error={fieldErrors.header.account_id}
                      onSelect={(payload) => {
                        clearHeaderError("account_id");
                        clearHeaderError("paid_to");
                        applyPartySelection(payload);
                      }}
                    />
                    <TextInput
                      label="Paid To"
                      withAsterisk
                      value={override.paid_to}
                      error={fieldErrors.header.paid_to}
                      onChange={(event) => {
                        clearHeaderError("paid_to");
                        patchOverride({ paid_to: event.currentTarget.value });
                      }}
                      styles={fieldStyles}
                    />
                    <SearchableSelect
                      label="Currency"
                      placeholder="Search currency"
                      withAsterisk
                      apiEndpoint={URL.currencyMaster}
                      value={override.currency_id || null}
                      displayValue={
                        [override.currency_code, override.currency_name].filter(Boolean).join(" · ") ||
                        undefined
                      }
                      dropdownZIndex={400}
                      minSearchLength={1}
                      searchFields={["currency_code", "currency_name", "code", "name", "id"]}
                      returnOriginalData
                      styles={fieldStyles}
                      error={fieldErrors.header.currency_id}
                      displayFormat={(item) => ({
                        value: String(item.id ?? ""),
                        label: String(item.currency_code ?? item.code ?? ""),
                      })}
                      onChange={(value, _selected, original) => {
                        clearHeaderError("currency_id");
                        const code = String(
                          (original as { currency_code?: string; code?: string } | undefined)?.currency_code ??
                            (original as { code?: string } | undefined)?.code ??
                            "",
                        );
                        const name = String(
                          (original as { currency_name?: string; name?: string } | undefined)?.currency_name ??
                            (original as { name?: string } | undefined)?.name ??
                            "",
                        );
                        patchOverride({
                          currency_id: value ?? "",
                          currency_code: code,
                          currency_name: name,
                          charges_data: override.charges_data.map((row) =>
                            row.currency_id
                              ? row
                              : { ...row, currency_id: value ?? "", currency_code: code, currency_name: name },
                          ),
                        });
                      }}
                    />
                    <TextInput
                      label="Amount"
                      withAsterisk
                      value={override.amount}
                      error={fieldErrors.header.amount}
                      onChange={(event) => {
                        clearHeaderError("amount");
                        patchOverride({ amount: event.currentTarget.value });
                      }}
                      styles={fieldStyles}
                    />
                    <Dropdown
                      label="State"
                      placeholder="Select state"
                      data={
                        override.state_id &&
                        !stateOptions.some((option) => option.value === override.state_id)
                          ? [
                              ...stateOptions,
                              {
                                value: override.state_id,
                                label: override.state_name || override.state_id,
                              },
                            ]
                          : stateOptions
                      }
                      value={override.state_id || null}
                      onChange={(value) => {
                        const next = value ?? "";
                        const opt = stateOptions.find((option) => option.value === next);
                        patchOverride({
                          state_id: next,
                          state_name: opt ? String(opt.label || opt.value) : next,
                        });
                      }}
                      searchable
                      dropdownZIndex={400}
                    />
                    <TextInput
                      label="Actual Invoice No."
                      value={override.actual_inv_no}
                      onChange={(event) => patchOverride({ actual_inv_no: event.currentTarget.value })}
                      styles={fieldStyles}
                    />
                    <SingleDateInput
                      label="Actual Invoice Date"
                      placeholder="Select date"
                      size="sm"
                      value={isoDateToDate(override.actual_inv_date)}
                      onChange={(date) => patchOverride({ actual_inv_date: dateToIso(date) })}
                      styles={fieldStyles}
                    />
                    <TextInput
                      label="Proforma Invoice No."
                      value={override.proforma_inv_no}
                      onChange={(event) => patchOverride({ proforma_inv_no: event.currentTarget.value })}
                      styles={fieldStyles}
                    />
                    <SingleDateInput
                      label="Proforma Invoice Date"
                      placeholder="Select date"
                      size="sm"
                      value={isoDateToDate(override.proforma_inv_date)}
                      onChange={(date) => patchOverride({ proforma_inv_date: dateToIso(date) })}
                      styles={fieldStyles}
                    />
                    {isIndiaUser ? (
                      partyGstOptions.length > 1 ? (
                        <Dropdown
                          label="Vendor GSTN"
                          placeholder="Select GSTN"
                          withAsterisk
                          data={partyGstOptions.map((option) => ({
                            value: option.value,
                            label: option.value,
                          }))}
                          value={override.customer_gst_no || null}
                          onChange={(gst) => {
                            if (!gst) return;
                            clearHeaderError("customer_gst_no");
                            const address = findPartyAddressByGst(partyAddresses, gst);
                            const stateFromAddress = resolveAutomationStateFromAddress(
                              address,
                              stateOptions,
                            );
                            patchOverride({
                              customer_gst_no: gst,
                              ...(stateFromAddress.state_id
                                ? {
                                    state_id: stateFromAddress.state_id,
                                    state_name: stateFromAddress.state_name,
                                  }
                                : {}),
                            });
                          }}
                          searchable
                          dropdownZIndex={400}
                          error={fieldErrors.header.customer_gst_no}
                        />
                      ) : (
                        <TextInput
                          label="Vendor GSTN"
                          withAsterisk
                          value={override.customer_gst_no}
                          error={fieldErrors.header.customer_gst_no}
                          onChange={(event) => {
                            clearHeaderError("customer_gst_no");
                            patchOverride({ customer_gst_no: event.currentTarget.value });
                          }}
                          styles={fieldStyles}
                        />
                      )
                    ) : null}
                    {isIndiaUser ? (
                      <TextInput
                        label="Location GSTN"
                        withAsterisk
                        value={override.location_gst_no}
                        error={fieldErrors.header.location_gst_no}
                        onChange={(event) => {
                          clearHeaderError("location_gst_no");
                          patchOverride({ location_gst_no: event.currentTarget.value });
                        }}
                        styles={fieldStyles}
                      />
                    ) : null}
                    {isIndiaUser ? (
                      <TextInput
                        label="TDS Section Code"
                        value={override.tds_section_code}
                        onChange={(event) =>
                          patchOverride({ tds_section_code: event.currentTarget.value })
                        }
                        styles={fieldStyles}
                      />
                    ) : null}
                    <TextInput
                      label="Note"
                      description={`Max ${NOTE_MAX_WORDS} words`}
                      value={override.note}
                      onChange={(event) =>
                        patchOverride({
                          note: limitToMaxWords(event.currentTarget.value, NOTE_MAX_WORDS),
                        })
                      }
                      styles={fieldStyles}
                    />
                    <TextInput
                      label="Account Note"
                      description={`Max ${NOTE_MAX_WORDS} words`}
                      value={override.account_note}
                      onChange={(event) =>
                        patchOverride({
                          account_note: limitToMaxWords(event.currentTarget.value, NOTE_MAX_WORDS),
                        })
                      }
                      styles={fieldStyles}
                    />
                  </SimpleGrid>
                </PreviewSection>

                <PreviewSection title="Amounts">
                  <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs">
                    <AmountTile
                      label="Amount"
                      value={override.amount}
                      currency={override.currency_code || undefined}
                    />
                    <AmountTile
                      label="Taxable"
                      value={override.taxable_amount}
                      currency={override.currency_code || undefined}
                    />
                    <AmountTile label="CGST" value={override.cgst_amount} />
                    <AmountTile label="SGST" value={override.sgst_amount} />
                    <AmountTile label="IGST" value={override.igst_amount} />
                    <AmountTile
                      label="Charges Total"
                      value={chargesAmountTotal}
                      currency={override.currency_code || undefined}
                    />
                    <AmountTile
                      label="Charges Local Total"
                      value={chargesLocalTotal}
                    />
                    <AmountTile
                      label="Charge Lines"
                      value={String(override.charges_data.length)}
                    />
                  </SimpleGrid>
                </PreviewSection>

                <PreviewSection
                  title="Charges"
                  hint="Aligned with Payment Request charge lines: service rows plus GST tax rows (same as Calculate GST)."
                >
                  <Tabs defaultValue="form">
                    <Tabs.List>
                      <Tabs.Tab value="form">Form View</Tabs.Tab>
                    </Tabs.List>
                    <Tabs.Panel value="form" pt="sm">
                      <Box style={{ overflowX: "auto" }}>
                        <Table
                          striped
                          highlightOnHover
                          withTableBorder
                          withColumnBorders
                          fz="xs"
                          style={{ minWidth: 1680 }}
                        >
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th>#</Table.Th>
                              <Table.Th>Charge</Table.Th>
                              <Table.Th>Account Name</Table.Th>
                              <Table.Th>Subledger</Table.Th>
                              <Table.Th>Narration</Table.Th>
                              <Table.Th>Job Id</Table.Th>
                              <Table.Th>Currency</Table.Th>
                              <Table.Th>ROE</Table.Th>
                              <Table.Th>Unit</Table.Th>
                              <Table.Th>No of Unit</Table.Th>
                              <Table.Th>Amt/Unit</Table.Th>
                              <Table.Th>Amount</Table.Th>
                              <Table.Th>Local Amt</Table.Th>
                              <Table.Th>SAC Code</Table.Th>
                              <Table.Th>Actions</Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {override.charges_data.map((row, index) => {
                              const isTax = isPaymentRequestTaxChargeDraft(row);
                              const canDelete = isTax
                                ? override.charges_data.length > 1
                                : serviceChargeCount > 1;
                              const chargeErr = fieldErrors.charges[index] || {};
                              return (
                              <Table.Tr
                                key={index}
                                style={
                                  isTax
                                    ? { background: "rgba(16, 84, 118, 0.06)" }
                                    : undefined
                                }
                              >
                                <Table.Td>
                                  {index + 1}
                                  {isTax ? (
                                    <Text size="xs" c="#105476" fw={600}>
                                      GST
                                    </Text>
                                  ) : null}
                                </Table.Td>
                                <Table.Td style={{ minWidth: 180 }}>
                                  <SearchableSelect
                                    placeholder="Search charge"
                                    apiEndpoint={URL.chargeMaster}
                                    value={row.charge_id || null}
                                    displayValue={row.charge_name || undefined}
                                    dropdownZIndex={400}
                                    minSearchLength={2}
                                    searchFields={["charge_code", "charge_name", "id"]}
                                    returnOriginalData
                                    styles={fieldStyles}
                                    error={chargeErr.charge_id}
                                    displayFormat={(item) => ({
                                      value: String(item.id ?? ""),
                                      label: String(item.charge_name ?? ""),
                                    })}
                                    onChange={(value, selected, original) => {
                                      clearChargeError(index, "charge_id");
                                      patchCharge(index, {
                                        charge_id: value ?? "",
                                        charge_name: selected?.label ?? "",
                                        charge_code: String(
                                          (original as { charge_code?: string } | undefined)?.charge_code ??
                                            "",
                                        ),
                                      });
                                    }}
                                  />
                                </Table.Td>
                                <Table.Td style={{ minWidth: 180 }}>
                                  <SearchableSelect
                                    placeholder="Search account"
                                    apiEndpoint={URL.chartOfAccounts}
                                    value={row.account_id || null}
                                    displayValue={
                                      row.account_name
                                        ? `${row.account_name}${
                                            row.account_code ? ` - ${row.account_code}` : ""
                                          }`
                                        : row.account_code || undefined
                                    }
                                    dropdownZIndex={400}
                                    minSearchLength={1}
                                    searchFields={["gl_name", "gl_account_code", "account_name", "id"]}
                                    returnOriginalData
                                    styles={fieldStyles}
                                    displayFormat={(item) => {
                                      const name = String(item.account_name ?? "").trim();
                                      const gl = String(item.gl_account_code ?? "").trim();
                                      const glName = String(item.gl_name ?? "").trim();
                                      return {
                                        value: String(item.id ?? ""),
                                        label: [name, gl, glName].filter(Boolean).join(" - "),
                                      };
                                    }}
                                    onChange={(value, _selected, original) =>
                                      patchCharge(index, {
                                        account_id: value ?? "",
                                        account_code: String(
                                          (original as { gl_account_code?: string } | undefined)
                                            ?.gl_account_code ?? "",
                                        ),
                                        account_name: String(
                                          (original as { account_name?: string; gl_name?: string } | undefined)
                                            ?.account_name ??
                                            (original as { gl_name?: string } | undefined)?.gl_name ??
                                            "",
                                        ),
                                        subledger_code: String(
                                          (original as { subledger_code?: string } | undefined)
                                            ?.subledger_code ??
                                            row.subledger_code ??
                                            "",
                                        ),
                                      })
                                    }
                                  />
                                </Table.Td>
                                <Table.Td style={{ minWidth: 110 }}>
                                  <TextInput
                                    placeholder="Subledger"
                                    value={row.subledger_code}
                                    onChange={(event) =>
                                      patchCharge(index, { subledger_code: event.currentTarget.value })
                                    }
                                    styles={fieldStyles}
                                  />
                                </Table.Td>
                                <Table.Td style={{ minWidth: 150 }}>
                                  <TextInput
                                    placeholder="Narration"
                                    value={row.narration}
                                    onChange={(event) =>
                                      patchCharge(index, { narration: event.currentTarget.value })
                                    }
                                    styles={fieldStyles}
                                  />
                                </Table.Td>
                                <Table.Td style={{ minWidth: 140 }}>
                                  <TextInput
                                    value={row.job_id}
                                    error={chargeErr.job_id}
                                    onChange={(event) => {
                                      clearChargeError(index, "job_id");
                                      patchCharge(index, { job_id: event.currentTarget.value });
                                    }}
                                    styles={fieldStyles}
                                  />
                                </Table.Td>
                                <Table.Td style={{ minWidth: 120 }}>
                                  <SearchableSelect
                                    placeholder="Currency"
                                    apiEndpoint={URL.currencyMaster}
                                    value={row.currency_id || null}
                                    displayValue={row.currency_code || undefined}
                                    dropdownZIndex={400}
                                    minSearchLength={1}
                                    searchFields={["currency_code", "code", "id"]}
                                    returnOriginalData
                                    styles={fieldStyles}
                                    error={chargeErr.currency_id}
                                    displayFormat={(item) => ({
                                      value: String(item.id ?? ""),
                                      label: String(item.currency_code ?? item.code ?? ""),
                                    })}
                                    onChange={(value, _selected, original) => {
                                      clearChargeError(index, "currency_id");
                                      patchCharge(index, {
                                        currency_id: value ?? "",
                                        currency_code: String(
                                          (original as { currency_code?: string; code?: string } | undefined)
                                            ?.currency_code ??
                                            (original as { code?: string } | undefined)?.code ??
                                            "",
                                        ),
                                      });
                                    }}
                                  />
                                </Table.Td>
                                <Table.Td style={{ minWidth: 80 }}>
                                  <TextInput
                                    value={row.roe}
                                    onChange={(event) =>
                                      patchCharge(
                                        index,
                                        { roe: event.currentTarget.value },
                                        { recalc: true },
                                      )
                                    }
                                    styles={fieldStyles}
                                  />
                                </Table.Td>
                                <Table.Td style={{ minWidth: 110 }}>
                                  <Dropdown
                                    placeholder="Unit"
                                    searchable
                                    data={
                                      row.unit_id &&
                                      !unitOptions.some((option) => option.value === row.unit_id)
                                        ? [
                                            ...unitOptions,
                                            {
                                              value: row.unit_id,
                                              label: row.unit_code || row.unit_id,
                                            },
                                          ]
                                        : unitOptions
                                    }
                                    value={row.unit_id || row.unit_code || null}
                                    onChange={(value) => {
                                      const next = value ?? "";
                                      const opt = unitOptions.find((option) => option.value === next);
                                      patchCharge(index, {
                                        unit_id: next,
                                        unit_code: opt ? String(opt.label || opt.value) : next,
                                      });
                                    }}
                                    dropdownZIndex={400}
                                  />
                                </Table.Td>
                                <Table.Td style={{ minWidth: 90 }}>
                                  <TextInput
                                    value={row.no_of_unit}
                                    onChange={(event) =>
                                      patchCharge(
                                        index,
                                        { no_of_unit: event.currentTarget.value },
                                        { recalc: true },
                                      )
                                    }
                                    styles={fieldStyles}
                                  />
                                </Table.Td>
                                <Table.Td style={{ minWidth: 90 }}>
                                  <TextInput
                                    value={row.amount_per_unit}
                                    onChange={(event) =>
                                      patchCharge(
                                        index,
                                        { amount_per_unit: event.currentTarget.value },
                                        { recalc: true },
                                      )
                                    }
                                    styles={fieldStyles}
                                  />
                                </Table.Td>
                                <Table.Td style={{ minWidth: 100 }}>
                                  <TextInput
                                    value={row.amount}
                                    error={chargeErr.amount}
                                    onChange={(event) => {
                                      clearChargeError(index, "amount");
                                      const amount = event.currentTarget.value;
                                      const local = recalculateAutomationChargeAmounts({
                                        ...row,
                                        amount,
                                      }).local_amount;
                                      if (local) clearChargeError(index, "local_amount");
                                      patchCharge(index, { amount, local_amount: local });
                                    }}
                                    styles={fieldStyles}
                                  />
                                </Table.Td>
                                <Table.Td style={{ minWidth: 100 }}>
                                  <TextInput
                                    value={row.local_amount}
                                    error={chargeErr.local_amount}
                                    onChange={(event) => {
                                      clearChargeError(index, "local_amount");
                                      patchCharge(index, { local_amount: event.currentTarget.value });
                                    }}
                                    styles={fieldStyles}
                                  />
                                </Table.Td>
                                <Table.Td style={{ minWidth: 100 }}>
                                  <TextInput
                                    placeholder="SAC"
                                    value={row.sac_code}
                                    onChange={(event) =>
                                      patchCharge(index, { sac_code: event.currentTarget.value })
                                    }
                                    styles={fieldStyles}
                                  />
                                </Table.Td>
                                <Table.Td>
                                  {canDelete ? (
                                    <Button
                                      radius="sm"
                                      px={8}
                                      size="sm"
                                      variant="light"
                                      color="red"
                                      onClick={() => removeCharge(index)}
                                    >
                                      <IconTrash size={14} />
                                    </Button>
                                  ) : null}
                                </Table.Td>
                              </Table.Tr>
                              );
                            })}
                          </Table.Tbody>
                        </Table>
                      </Box>
                    </Tabs.Panel>
                  </Tabs>
                </PreviewSection>

                {showTaxBreakup ? (
                  <PreviewSection
                    title="Tax Breakup"
                    hint="Mirrors Payment Request Tax Breakup after Calculate GST (from extracted CGST/SGST/IGST)."
                  >
                    <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs" mb="sm">
                      <AmountTile label="IGST Total" value={taxBreakupTotals.igst} />
                      <AmountTile label="CGST Total" value={taxBreakupTotals.cgst} />
                      <AmountTile label="SGST Total" value={taxBreakupTotals.sgst} />
                      <AmountTile label="GST Total" value={taxBreakupTotals.total} />
                    </SimpleGrid>
                    {taxChargeRows.length > 0 ? (
                      <Box style={{ overflowX: "auto" }}>
                        <Table
                          withTableBorder
                          withColumnBorders
                          striped
                          highlightOnHover
                          fz="xs"
                          style={{ minWidth: 420 }}
                        >
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th>SAC</Table.Th>
                              <Table.Th>Charge Name</Table.Th>
                              <Table.Th>Dr/Cr</Table.Th>
                              <Table.Th>Amount</Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {taxChargeRows.map((row, idx) => (
                              <Table.Tr key={`tax-${idx}`}>
                                <Table.Td>{row.sac_code || "—"}</Table.Td>
                                <Table.Td>
                                  {row.charge_name
                                    ? row.charge_code
                                      ? `${row.charge_name} (${row.charge_code})`
                                      : row.charge_name
                                    : "—"}
                                </Table.Td>
                                <Table.Td>{row.Dr_Cr || row.cn_r || "Dr"}</Table.Td>
                                <Table.Td>{row.amount || "—"}</Table.Td>
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
                          {taxBreakupTotals.total ? (
                            <Table.Tfoot>
                              <Table.Tr>
                                <Table.Td />
                                <Table.Td />
                                <Table.Td>
                                  <Text size="xs" fw={600} c="#105476">
                                    Total:
                                  </Text>
                                </Table.Td>
                                <Table.Td>
                                  <Text size="xs" fw={600} c="#105476">
                                    {taxBreakupTotals.total}
                                  </Text>
                                </Table.Td>
                              </Table.Tr>
                            </Table.Tfoot>
                          ) : null}
                        </Table>
                      </Box>
                    ) : null}
                  </PreviewSection>
                ) : null}
              </Stack>
            </Box>
            <Group justify="flex-end">
              <Button variant="default" onClick={handleClose}>
                Cancel
              </Button>
              <Button color="#105476" disabled={startingJob} loading={startingJob} onClick={handleCreate}>
                Create PRQ
              </Button>
            </Group>
          </Stack>
        )}
      </Stack>
    </Modal>
  );
}
