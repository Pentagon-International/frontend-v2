import { useCallback, useMemo, useState } from "react";
import {
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconClipboard,
  IconPlus,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader } from "@mantine/core";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { URL } from "../../../api/serverUrls";
import { apiCallProtected } from "../../../api/axios";
import { ToastNotification, SearchableSelect } from "../../../components";
import { getAPICall } from "../../../service/getApiCall";
import { API_HEADER } from "../../../store/storeKeys";
import useAuthStore from "../../../store/authStore";
import { useLayoutStore } from "../../../store/useLayoutStore";
import "./createContract.css";

type ServiceOption = {
  service_code: string;
  service_name: string;
};

type ContainerOption = {
  container_code?: string;
  container_name?: string;
};

type ChargeMasterRow = {
  id?: number;
  charge_code?: string;
  charge_name?: string;
};

type RateSheetRow = {
  key: string;
  origin_code: string;
  origin_label: string;
  destination_code: string;
  destination_label: string;
  equipment: string;
  buy_rate: string;
  charge_code: string;
  service_transit: string;
  notes: string;
};

type SurchargeRow = {
  key: string;
  charge_code: string;
  charge_name: string;
  basis: string;
  rate: string;
  frequency: string;
  applied: boolean;
};

type CreateContractPayload = {
  contract_basics: {
    carrier_code: string;
    vendor_reference: string;
    service: string;
    coverage_description: string;
    currency_code: string;
    valid_from: string;
    valid_to: string;
    status: string;
    country_code: string;
    auto_renew: boolean;
    auto_renew_days: number | null;
    approved_by: string;
  };
  rate_sheet: Array<{
    line_no: number;
    origin_code: string;
    destination_code: string;
    equipment: string;
    buy_rate: string;
    charge_code: string;
    service_transit: string;
    notes: string;
  }>;
  surcharges: Array<{
    applied: boolean;
    charge_code: string;
    basis: string;
    rate: string;
    frequency: string;
  }>;
  internal_notes: string;
};

type CreateContractResponse = {
  status: boolean;
  message?: string;
  vendor_reference?: string;
};

const SERVICE_MODE_LABELS: Record<string, string> = {
  FCL: "Ocean FCL",
  LCL: "Ocean LCL",
  AIR: "Air Freight",
};

const EMPTY_RATE_ROW = (): RateSheetRow => ({
  key: crypto.randomUUID(),
  origin_code: "",
  origin_label: "",
  destination_code: "",
  destination_label: "",
  equipment: "",
  buy_rate: "",
  charge_code: "FRT",
  service_transit: "",
  notes: "",
});

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function formatContractDraftId(): string {
  const year = new Date().getFullYear();
  const suffix = String(Date.now()).slice(-3);
  return `PCT-${year}-NEW-${suffix.padStart(3, "0")}`;
}

function toApiDate(value: string): string {
  if (!value) return "";
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("YYYY-MM-DD") : value;
}

function parseRate(value: string): number | null {
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

function getCurrencyPrefix(currencyCode: string): string {
  if (currencyCode === "EUR") return "€";
  if (currencyCode === "INR") return "₹";
  if (currencyCode === "VND") return "₫";
  if (currencyCode === "GBP") return "£";
  if (currencyCode === "AED") return "AED ";
  return "$";
}

function formatMoney(amount: number, currencyCode: string): string {
  return `${getCurrencyPrefix(currencyCode)}${amount.toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })}`;
}

function isPercentRate(value: string): boolean {
  return value.trim().endsWith("%");
}

function formatRateValue(value: string): string {
  if (isPercentRate(value)) return value.trim();
  const parsed = parseRate(value);
  return parsed !== null ? parsed.toFixed(2) : value.trim();
}

async function fetchServiceMaster(): Promise<ServiceOption[]> {
  const response = await getAPICall(URL.serviceMaster, API_HEADER);
  if (Array.isArray(response)) return response as ServiceOption[];
  return Array.isArray((response as { data?: ServiceOption[] })?.data)
    ? ((response as { data: ServiceOption[] }).data ?? [])
    : [];
}

async function fetchContainerTypes(): Promise<ContainerOption[]> {
  const response = await getAPICall(URL.containerType, API_HEADER);
  if (Array.isArray(response)) return response as ContainerOption[];
  return Array.isArray((response as { data?: ContainerOption[] })?.data)
    ? ((response as { data: ContainerOption[] }).data ?? [])
    : [];
}

async function fetchChargeMasterRows(): Promise<ChargeMasterRow[]> {
  const response = (await apiCallProtected.post(URL.chargeMasterFilter, {
    filters: {},
  })) as { data?: ChargeMasterRow[] };
  return Array.isArray(response?.data) ? response.data : [];
}

async function createContract(payload: CreateContractPayload): Promise<CreateContractResponse> {
  return (await apiCallProtected.post(URL.create_contract, payload)) as CreateContractResponse;
}

export default function CreateContract() {
  const navigate = useNavigate();
  const isSidebarCollapsed = useLayoutStore((state) => state.isSidebarCollapsed);
  const sidebarOffset = isSidebarCollapsed ? 64 : 260;
  const user = useAuthStore((state) => state.user);
  const userInitials = useMemo(() => {
    const name = user?.full_name || user?.username || user?.email || "U";
    return getInitials(String(name));
  }, [user]);
  const contractOwner = user?.full_name || user?.username || "";

  const [contractId] = useState(formatContractDraftId);
  const [carrierCode, setCarrierCode] = useState("");
  const [carrierLabel, setCarrierLabel] = useState("");
  const [vendorReference, setVendorReference] = useState("");
  const [service, setService] = useState("");
  const [coverageDescription, setCoverageDescription] = useState("");
  const [currencyCode, setCurrencyCode] = useState("");
  const [currencyLabel, setCurrencyLabel] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [countryLabel, setCountryLabel] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");
  const [commitment, setCommitment] = useState("");
  const [approverId, setApproverId] = useState("");
  const [approverLabel, setApproverLabel] = useState("");
  const [autoRenew, setAutoRenew] = useState(false);
  const [autoRenewDays, setAutoRenewDays] = useState<number | null>(null);
  const [internalNotes, setInternalNotes] = useState("");
  const [rateSheetMode, setRateSheetMode] = useState<"manual" | "upload" | "clone">("manual");
  const [rateRows, setRateRows] = useState<RateSheetRow[]>([EMPTY_RATE_ROW()]);
  const [surchargeRows, setSurchargeRows] = useState<SurchargeRow[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const { data: serviceOptions = [], isLoading: servicesLoading } = useQuery({
    queryKey: ["contract-create-services"],
    queryFn: fetchServiceMaster,
    staleTime: 60_000,
  });

  const { data: containerOptions = [], isLoading: containersLoading } = useQuery({
    queryKey: ["contract-create-containers"],
    queryFn: fetchContainerTypes,
    staleTime: 60_000,
  });

  const {
    refetch: loadSurchargeDefaults,
    isFetching: surchargesLoading,
  } = useQuery({
    queryKey: ["contract-create-charges"],
    queryFn: fetchChargeMasterRows,
    enabled: false,
    staleTime: 60_000,
  });

  const createMutation = useMutation({
    mutationFn: createContract,
    onSuccess: (response) => {
      setLastSavedAt(new Date());
      ToastNotification({
        type: "success",
        message: response?.message || "Contract created successfully.",
      });
      navigate("/tariff/contracts");
    },
    onError: (error: { message?: string }) => {
      ToastNotification({
        type: "error",
        message: error?.message || "Unable to create contract.",
      });
    },
  });

  const equipmentOptions = useMemo(
    () =>
      containerOptions
        .map((item) => {
          const value = String(item.container_name || item.container_code || "").trim();
          if (!value) return null;
          return { value, label: value };
        })
        .filter(Boolean) as Array<{ value: string; label: string }>,
    [containerOptions],
  );

  const selectedServiceLabel = useMemo(() => {
    const match = serviceOptions.find((item) => item.service_code === service);
    return match?.service_name || service;
  }, [service, serviceOptions]);

  const rateStats = useMemo(() => {
    const values = rateRows
      .map((row) => parseRate(row.buy_rate))
      .filter((value): value is number => value !== null);
    if (values.length === 0) {
      return { count: rateRows.length, min: null, max: null, avg: null };
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
    return { count: rateRows.length, min, max, avg };
  }, [rateRows]);

  const appliedSurchargeCount = useMemo(
    () => surchargeRows.filter((row) => row.applied).length,
    [surchargeRows],
  );

  const completedRateLines = useMemo(
    () =>
      rateRows.filter(
        (row) =>
          row.origin_code.trim() &&
          row.destination_code.trim() &&
          row.equipment.trim() &&
          parseRate(row.buy_rate) !== null,
      ).length,
    [rateRows],
  );

  const basicsComplete = Boolean(
    carrierCode &&
      vendorReference.trim() &&
      service &&
      coverageDescription.trim() &&
      currencyCode &&
      countryCode &&
      validFrom &&
      validTo,
  );

  const handleApplySurchargeDefaults = useCallback(async () => {
    const result = await loadSurchargeDefaults();
    const rows = result.data ?? [];
    if (rows.length === 0) {
      ToastNotification({
        type: "error",
        message: "No surcharge charges available from charge master.",
      });
      return;
    }
    setSurchargeRows(
      rows.map((row) => ({
        key: crypto.randomUUID(),
        charge_code: String(row.charge_code || "").trim(),
        charge_name: String(row.charge_name || "").trim(),
        basis: "",
        rate: "",
        frequency: "",
        applied: false,
      })),
    );
  }, [loadSurchargeDefaults]);

  const updateRateRow = (key: string, patch: Partial<RateSheetRow>) => {
    setRateRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  };

  const updateSurchargeRow = (key: string, patch: Partial<SurchargeRow>) => {
    setSurchargeRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  };

  const handlePasteRateLines = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      if (lines.length === 0) {
        ToastNotification({
          type: "error",
          message: "Clipboard is empty.",
        });
        return;
      }

      const parsedRows = lines.map((line) => {
        const cells = line.includes("\t")
          ? line.split("\t")
          : line.split(",").map((cell) => cell.trim());
        const [
          originCode = "",
          destinationCode = "",
          equipment = "",
          buyRate = "",
          serviceTransit = "",
          notes = "",
        ] = cells;

        return {
          ...EMPTY_RATE_ROW(),
          origin_code: originCode.trim(),
          origin_label: originCode.trim(),
          destination_code: destinationCode.trim(),
          destination_label: destinationCode.trim(),
          equipment: equipment.trim(),
          buy_rate: buyRate.trim(),
          service_transit: serviceTransit.trim(),
          notes: notes.trim(),
        };
      });

      setRateRows(parsedRows);
      ToastNotification({
        type: "success",
        message: `${parsedRows.length} lane${parsedRows.length === 1 ? "" : "s"} pasted from clipboard.`,
      });
    } catch {
      ToastNotification({
        type: "error",
        message: "Unable to read clipboard. Paste lane rows manually instead.",
      });
    }
  }, []);

  const validateForm = (status: "DRAFT" | "ACTIVE") => {
    const errors: Record<string, string> = {};

    if (!carrierCode) errors.carrier_code = "Vendor is required.";
    if (!vendorReference.trim()) errors.vendor_reference = "Vendor reference is required.";
    if (!service) errors.service = "Mode is required.";
    if (!coverageDescription.trim()) {
      errors.coverage_description = "Coverage description is required.";
    }
    if (!currencyCode) errors.currency_code = "Currency is required.";
    if (!countryCode) {
      errors.country_code =
        "Country is required. Select a vendor with a country or choose another carrier.";
    }
    if (!validFrom) errors.valid_from = "Start date is required.";
    if (!validTo) errors.valid_to = "End date is required.";
    if (validFrom && validTo && dayjs(validTo).isBefore(dayjs(validFrom), "day")) {
      errors.valid_to = "End date must be after start date.";
    }
    if (autoRenew && !autoRenewDays) {
      errors.auto_renew_days = "Select auto-renew notice days.";
    }

    if (status === "ACTIVE") {
      if (completedRateLines === 0) {
        errors.rate_sheet = "Add at least one complete rate line.";
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const buildPayload = (status: "DRAFT" | "ACTIVE"): CreateContractPayload => ({
    contract_basics: {
      carrier_code: carrierCode,
      vendor_reference: vendorReference.trim(),
      service,
      coverage_description: coverageDescription.trim(),
      currency_code: currencyCode,
      valid_from: toApiDate(validFrom),
      valid_to: toApiDate(validTo),
      status,
      country_code: countryCode,
      auto_renew: autoRenew,
      auto_renew_days: autoRenew ? autoRenewDays : null,
      approved_by: approverLabel.trim(),
    },
    rate_sheet: rateRows
      .filter(
        (row) =>
          row.origin_code.trim() ||
          row.destination_code.trim() ||
          row.equipment.trim() ||
          row.buy_rate.trim(),
      )
      .map((row, index) => ({
        line_no: index + 1,
        origin_code: row.origin_code.trim(),
        destination_code: row.destination_code.trim(),
        equipment: row.equipment.trim(),
        buy_rate: formatRateValue(row.buy_rate),
        charge_code: row.charge_code.trim() || "FRT",
        service_transit: row.service_transit.trim(),
        notes: row.notes.trim(),
      })),
    surcharges: surchargeRows
      .filter((row) => row.applied && row.charge_code.trim())
      .map((row) => ({
        applied: true,
        charge_code: row.charge_code.trim(),
        basis: row.basis.trim(),
        rate: formatRateValue(row.rate),
        frequency: row.frequency.trim(),
      })),
    internal_notes: internalNotes.trim(),
  });

  const handleSubmit = (status: "DRAFT" | "ACTIVE") => {
    if (!validateForm(status)) {
      ToastNotification({
        type: "error",
        message: "Please complete the required fields before saving.",
      });
      return;
    }
    createMutation.mutate(buildPayload(status));
  };

  const currencyDisplay = currencyCode
    ? `${currencyLabel || currencyCode}`
    : "—";

  return (
    <div className="create-contract-page">
      <div className="create-contract-topbar">
        <div className="create-contract-crumbs">
          Pentagon Freight
          <span className="sep">›</span>
          Tariff &amp; Contract
          <span className="sep">›</span>
          <span className="here">New Contract</span>
        </div>
        <div className="create-contract-spacer" />
        <label className="create-contract-search">
          <IconSearch size={14} stroke={1.8} />
          <input
            type="search"
            placeholder="Search contracts, vendors, lanes, rules…"
            aria-label="Search contracts"
            readOnly
          />
        </label>
        <div className="create-contract-avatar" aria-hidden>
          {userInitials}
        </div>
      </div>

      <div className="create-contract-main">
        <button
          type="button"
          className="create-contract-back"
          onClick={() => navigate("/tariff/contracts")}
        >
          <IconArrowLeft size={14} />
          Contracts
        </button>

        <div className="create-contract-page-head">
          <div>
            <h1>New Contract</h1>
            <div className="sub">
              Enter contract basics, rate lines &amp; surcharges · review before activation ·{" "}
              <span className="mono">{contractId}</span>
            </div>
          </div>
          <div className="create-contract-toolbar">
            <button
              type="button"
              className="create-contract-btn secondary"
              disabled={createMutation.isPending}
              onClick={() => handleSubmit("DRAFT")}
            >
              Save as draft
            </button>
            <button
              type="button"
              className="create-contract-btn"
              disabled={createMutation.isPending}
              onClick={() => handleSubmit("ACTIVE")}
            >
              Review &amp; confirm
              <IconArrowRight size={14} />
            </button>
          </div>
        </div>

        <div className="create-contract-stepper">
          <div
            className={`create-contract-step${basicsComplete ? " done" : " active"}`}
          >
            <div className="create-contract-step-icon">
              {basicsComplete ? <IconCheck size={14} /> : "1"}
            </div>
            <div>
              <div className="create-contract-step-label">Contract basics</div>
              <div className="create-contract-step-sub">Vendor, term, scope</div>
            </div>
          </div>
          <div
            className={`create-contract-step${
              completedRateLines > 0
                ? " done"
                : basicsComplete
                  ? " active"
                  : ""
            }${basicsComplete ? " connector-done" : ""}`}
          >
            <div className="create-contract-step-icon">
              {completedRateLines > 0 ? <IconCheck size={14} /> : "2"}
            </div>
            <div>
              <div className="create-contract-step-label">Rate sheet</div>
              <div className="create-contract-step-sub">
                {completedRateLines > 0
                  ? `${completedRateLines} lane${completedRateLines === 1 ? "" : "s"} entered`
                  : "Add lane rates"}
              </div>
            </div>
          </div>
          <div
            className={`create-contract-step${
              appliedSurchargeCount > 0
                ? " done"
                : completedRateLines > 0
                  ? " active"
                  : ""
            }${completedRateLines > 0 ? " connector-done" : ""}`}
          >
            <div className="create-contract-step-icon">
              {appliedSurchargeCount > 0 ? <IconCheck size={14} /> : "3"}
            </div>
            <div>
              <div className="create-contract-step-label">Surcharges</div>
              <div className="create-contract-step-sub">
                {appliedSurchargeCount > 0
                  ? `${appliedSurchargeCount} applied`
                  : surchargeRows.length > 0
                    ? `${surchargeRows.length} available`
                    : "Optional charges"}
              </div>
            </div>
          </div>
          <div className="create-contract-step">
            <div className="create-contract-step-icon">4</div>
            <div>
              <div className="create-contract-step-label">Review &amp; confirm</div>
              <div className="create-contract-step-sub">Validate &amp; activate</div>
            </div>
          </div>
        </div>

        <section className="create-contract-card">
          <div className="create-contract-section-head">
            <div>
              <h2>
                1 · Contract basics
                <span className="create-contract-tag">Required</span>
              </h2>
            </div>
          </div>

          <div className="create-contract-form-grid">
            <div className="create-contract-field create-contract-searchable">
              <SearchableSelect
                apiEndpoint={URL.carrier}
                label="Vendor"
                placeholder="Search carrier"
                value={carrierCode || null}
                displayValue={carrierLabel || null}
                returnOriginalData
                dropdownZIndex={40}
                onChange={(value, selectedData, originalData) => {
                  setCarrierCode(value || "");
                  setCarrierLabel(selectedData?.label || "");
                  const nextCountry = String(
                    (originalData as { country_code?: string })?.country_code || "",
                  ).trim();
                  if (nextCountry) {
                    setCountryCode(nextCountry);
                    setCountryLabel(nextCountry);
                  }
                }}
                searchFields={["carrier_code", "carrier_name"]}
                displayFormat={(item) => ({
                  value: String(item.carrier_code),
                  label: `${item.carrier_name} · ${
                    SERVICE_MODE_LABELS[String(item.service || service || "FCL")] ||
                    "Shipping Line"
                  }`,
                })}
                required
                error={formErrors.carrier_code}
              />
            </div>

            <div className="create-contract-field">
              <label htmlFor="vendor-reference">Vendor reference</label>
              <input
                id="vendor-reference"
                value={vendorReference}
                onChange={(event) => setVendorReference(event.target.value)}
                placeholder="HL-USEC-26Q3"
              />
              {formErrors.vendor_reference ? (
                <div className="field-error">{formErrors.vendor_reference}</div>
              ) : null}
            </div>

            <div className="create-contract-field">
              <label htmlFor="contract-id">Contract ID (auto)</label>
              <input id="contract-id" value={contractId} disabled />
            </div>

            <div className="create-contract-field">
              <label htmlFor="service">Mode</label>
              <select
                id="service"
                value={service}
                onChange={(event) => setService(event.target.value)}
                disabled={servicesLoading}
              >
                <option value="">
                  {servicesLoading ? "Loading services…" : "Select mode"}
                </option>
                {serviceOptions.map((item) => (
                  <option key={item.service_code} value={item.service_code}>
                    {SERVICE_MODE_LABELS[item.service_code] || item.service_name}
                  </option>
                ))}
              </select>
              {formErrors.service ? (
                <div className="field-error">{formErrors.service}</div>
              ) : null}
            </div>

            <div className="create-contract-field">
              <label htmlFor="coverage-description">Coverage description</label>
              <input
                id="coverage-description"
                value={coverageDescription}
                onChange={(event) => setCoverageDescription(event.target.value)}
                placeholder="India → US East Coast"
              />
              {formErrors.coverage_description ? (
                <div className="field-error">{formErrors.coverage_description}</div>
              ) : null}
            </div>

            <div className="create-contract-field create-contract-searchable">
              <SearchableSelect
                apiEndpoint={URL.currencyMaster}
                label="Currency"
                placeholder="Search currency"
                value={currencyCode || null}
                displayValue={currencyLabel || null}
                dropdownZIndex={40}
                onChange={(value, selectedData) => {
                  setCurrencyCode(value || "");
                  setCurrencyLabel(selectedData?.label || "");
                }}
                searchFields={["currency_code", "currency_name"]}
                displayFormat={(item) => ({
                  value: String(item.currency_code),
                  label: String(item.currency_code),
                })}
                required
                error={formErrors.currency_code}
              />
            </div>

            <div className="create-contract-field">
              <label htmlFor="valid-from">Start date</label>
              <input
                id="valid-from"
                type="date"
                value={validFrom}
                onChange={(event) => setValidFrom(event.target.value)}
              />
              {formErrors.valid_from ? (
                <div className="field-error">{formErrors.valid_from}</div>
              ) : null}
            </div>

            <div className="create-contract-field">
              <label htmlFor="valid-to">End date</label>
              <input
                id="valid-to"
                type="date"
                value={validTo}
                onChange={(event) => setValidTo(event.target.value)}
              />
              {formErrors.valid_to ? (
                <div className="field-error">{formErrors.valid_to}</div>
              ) : null}
            </div>

            <div className="create-contract-field">
              <label htmlFor="commitment">Commitment</label>
              <input
                id="commitment"
                value={commitment}
                onChange={(event) => setCommitment(event.target.value)}
                placeholder="600 TEU/qtr"
              />
            </div>

            <div className="create-contract-field">
              <label htmlFor="contract-owner">Contract owner</label>
              <input id="contract-owner" value={contractOwner} disabled />
            </div>

            <div className="create-contract-field create-contract-searchable">
              <SearchableSelect
                apiEndpoint={URL.user}
                label="Approver"
                placeholder="Search approver"
                value={approverId || null}
                displayValue={approverLabel || null}
                dropdownZIndex={40}
                onChange={(value, selectedData) => {
                  setApproverId(value || "");
                  setApproverLabel(selectedData?.label || "");
                }}
                searchFields={["full_name", "username", "email"]}
                displayFormat={(item) => ({
                  value: String(item.user_id ?? item.id ?? item.username),
                  label: String(item.full_name || item.username || item.email),
                })}
              />
            </div>

            <div className="create-contract-field">
              <label>Auto-renew</label>
              <div className="create-contract-toggle-row">
                <label className="create-contract-switch">
                  <input
                    type="checkbox"
                    checked={autoRenew}
                    onChange={(event) => {
                      setAutoRenew(event.target.checked);
                      if (!event.target.checked) setAutoRenewDays(null);
                    }}
                  />
                  <span className="create-contract-switch-slider" />
                </label>
                <span style={{ fontSize: 12, color: "var(--ink-3)" }}>
                  {autoRenew ? "On" : "Off"}
                </span>
                <button
                  type="button"
                  className={`create-contract-toggle-pill${
                    autoRenewDays === 90 ? " active" : ""
                  }`}
                  disabled={!autoRenew}
                  onClick={() => setAutoRenewDays(90)}
                >
                  90 days
                </button>
                <button
                  type="button"
                  className={`create-contract-toggle-pill${
                    autoRenewDays === 180 ? " active" : ""
                  }`}
                  disabled={!autoRenew}
                  onClick={() => setAutoRenewDays(180)}
                >
                  180 days
                </button>
              </div>
              {formErrors.auto_renew_days ? (
                <div className="field-error">{formErrors.auto_renew_days}</div>
              ) : null}
            </div>

            {formErrors.country_code ? (
              <div className="create-contract-field">
                <div className="field-error">{formErrors.country_code}</div>
              </div>
            ) : null}

            {!countryCode && carrierCode ? (
              <div className="create-contract-field create-contract-searchable">
                <SearchableSelect
                  apiEndpoint={URL.country}
                  label="Country"
                  placeholder="Search country"
                  value={countryCode || null}
                  displayValue={countryLabel || null}
                  dropdownZIndex={40}
                  onChange={(value, selectedData) => {
                    setCountryCode(value || "");
                    setCountryLabel(selectedData?.label || "");
                  }}
                  searchFields={["country_code", "country_name"]}
                  displayFormat={(item) => ({
                    value: String(item.country_code),
                    label: `${item.country_name} (${item.country_code})`,
                  })}
                  required
                  error={formErrors.country_code}
                />
              </div>
            ) : null}
          </div>
        </section>

        <section className="create-contract-card">
          <div className="create-contract-section-head">
            <div>
              <h2>
                2 · Rate sheet
                <span className="meta">{rateRows.length} lines</span>
              </h2>
            </div>
            <div className="create-contract-mini-tabs">
              <button
                type="button"
                className={`create-contract-link${rateSheetMode === "manual" ? " active" : ""}`}
                onClick={() => setRateSheetMode("manual")}
              >
                Type manually
              </button>
              <button
                type="button"
                className="create-contract-link"
                onClick={() =>
                  ToastNotification({
                    type: "error",
                    message: "Upload is not available yet.",
                  })
                }
              >
                Upload XLSX/PDF
              </button>
              <button
                type="button"
                className="create-contract-link"
                onClick={() =>
                  ToastNotification({
                    type: "error",
                    message: "Clone existing is not available yet.",
                  })
                }
              >
                Clone existing
              </button>
            </div>
          </div>

          <div className="create-contract-hint">
            Enter buy rates for each lane / equipment combination. Currency:{" "}
            <strong>{currencyDisplay}</strong>.
          </div>

          <div className="create-contract-section-head" style={{ marginBottom: 10 }}>
            <span />
            <div className="create-contract-toolbar">
              <button
                type="button"
                className="create-contract-btn secondary"
                onClick={() => setRateRows((current) => [...current, EMPTY_RATE_ROW()])}
              >
                <IconPlus size={14} />
                Add lane
              </button>
              <button
                type="button"
                className="create-contract-btn secondary"
                onClick={() => void handlePasteRateLines()}
              >
                <IconClipboard size={14} />
                Paste from clipboard
              </button>
            </div>
          </div>

          {formErrors.rate_sheet ? (
            <div className="field-error" style={{ marginBottom: 10 }}>
              {formErrors.rate_sheet}
            </div>
          ) : null}

          <div className="create-contract-table-wrap">
            <table className="create-contract-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Lane (origin → destination)</th>
                  <th>Equipment / unit</th>
                  <th>Buy rate ({currencyCode || "—"})</th>
                  <th>Service &amp; transit</th>
                  <th>Notes</th>
                  <th aria-label="Remove row" />
                </tr>
              </thead>
              <tbody>
                {rateRows.map((row, index) => (
                  <tr key={row.key}>
                    <td className="row-index">{index + 1}</td>
                    <td className="lane-cell">
                      <div style={{ display: "grid", gap: 6 }}>
                        <SearchableSelect
                          apiEndpoint={URL.portMaster}
                          placeholder="Origin port"
                          value={row.origin_code || null}
                          displayValue={row.origin_label || null}
                          onChange={(value, selectedData) =>
                            updateRateRow(row.key, {
                              origin_code: value || "",
                              origin_label: selectedData?.label || "",
                            })
                          }
                          searchFields={["port_code", "port_name"]}
                          displayFormat={(item) => ({
                            value: String(item.port_code),
                            label: `${item.port_name} (${item.port_code})`,
                          })}
                          dropdownZIndex={40}
                        />
                        <SearchableSelect
                          apiEndpoint={URL.portMaster}
                          placeholder="Destination port"
                          value={row.destination_code || null}
                          displayValue={row.destination_label || null}
                          onChange={(value, selectedData) =>
                            updateRateRow(row.key, {
                              destination_code: value || "",
                              destination_label: selectedData?.label || "",
                            })
                          }
                          searchFields={["port_code", "port_name"]}
                          displayFormat={(item) => ({
                            value: String(item.port_code),
                            label: `${item.port_name} (${item.port_code})`,
                          })}
                          dropdownZIndex={40}
                        />
                      </div>
                      {row.origin_label && row.destination_label ? (
                        <div className="lane-display">
                          {row.origin_label} → {row.destination_label}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <select
                        value={row.equipment}
                        onChange={(event) =>
                          updateRateRow(row.key, { equipment: event.target.value })
                        }
                        disabled={containersLoading}
                      >
                        <option value="">
                          {containersLoading ? "Loading…" : "Select unit"}
                        </option>
                        {equipmentOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        value={row.buy_rate}
                        onChange={(event) =>
                          updateRateRow(row.key, { buy_rate: event.target.value })
                        }
                        placeholder="2,840"
                        inputMode="decimal"
                      />
                    </td>
                    <td>
                      <input
                        value={row.service_transit}
                        onChange={(event) =>
                          updateRateRow(row.key, {
                            service_transit: event.target.value,
                          })
                        }
                        placeholder="Direct · 24 days · weekly Sun"
                      />
                    </td>
                    <td>
                      <input
                        value={row.notes}
                        onChange={(event) =>
                          updateRateRow(row.key, { notes: event.target.value })
                        }
                        placeholder="preferred routing"
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="create-contract-delete-btn"
                        aria-label="Remove lane"
                        disabled={rateRows.length === 1}
                        onClick={() =>
                          setRateRows((current) =>
                            current.length === 1
                              ? current
                              : current.filter((item) => item.key !== row.key),
                          )
                        }
                      >
                        <IconX size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="create-contract-rate-summary">
            <div className="stats">
              <span>
                <strong>{rateStats.count}</strong> lanes
              </span>
              <span>
                Min rate:{" "}
                <strong>
                  {rateStats.min !== null
                    ? formatMoney(rateStats.min, currencyCode || "USD")
                    : "—"}
                </strong>
              </span>
              <span>
                Max rate:{" "}
                <strong>
                  {rateStats.max !== null
                    ? formatMoney(rateStats.max, currencyCode || "USD")
                    : "—"}
                </strong>
              </span>
              <span>
                Avg rate:{" "}
                <strong>
                  {rateStats.avg !== null
                    ? formatMoney(Math.round(rateStats.avg), currencyCode || "USD")
                    : "—"}
                </strong>
              </span>
            </div>
            <div className="hint">Tab to navigate · Esc to cancel edit</div>
          </div>
        </section>

        <section className="create-contract-card">
          <div className="create-contract-section-head">
            <div>
              <h2>
                3 · Surcharges
                <span className="meta">
                  {appliedSurchargeCount} applied
                  {surchargeRows.length > 0 ? ` · ${surchargeRows.length} available` : ""}
                </span>
              </h2>
            </div>
            <button
              type="button"
              className="create-contract-link"
              disabled={surchargesLoading || !service}
              onClick={() => void handleApplySurchargeDefaults()}
            >
              {surchargesLoading
                ? "Loading charges…"
                : `Apply defaults for ${selectedServiceLabel || "selected mode"}`}
            </button>
          </div>

          {surchargeRows.length === 0 ? (
            <div className="create-contract-state">
              Load surcharge defaults from charge master to configure optional charges.
            </div>
          ) : (
            <div className="create-contract-table-wrap">
              <table className="create-contract-table">
                <thead>
                  <tr>
                    <th aria-label="Apply surcharge" />
                    <th>Code</th>
                    <th>Name</th>
                    <th>Basis</th>
                    <th>Value ({currencyCode || "—"})</th>
                    <th>Update frequency</th>
                  </tr>
                </thead>
                <tbody>
                  {surchargeRows.map((row) => (
                    <tr key={row.key} className={row.applied ? "" : "disabled"}>
                      <td>
                        <input
                          type="checkbox"
                          checked={row.applied}
                          onChange={(event) =>
                            updateSurchargeRow(row.key, {
                              applied: event.target.checked,
                            })
                          }
                        />
                      </td>
                      <td>
                        <span className="create-contract-surcharge-code">
                          {row.charge_code}
                        </span>
                      </td>
                      <td>{row.charge_name || "—"}</td>
                      <td>
                        <input
                          value={row.basis}
                          disabled={!row.applied}
                          onChange={(event) =>
                            updateSurchargeRow(row.key, { basis: event.target.value })
                          }
                          placeholder="per 40HC · monthly"
                        />
                      </td>
                      <td>
                        {row.applied ? (
                          <div className="create-contract-value-input">
                            {!isPercentRate(row.rate) ? (
                              <span>{getCurrencyPrefix(currencyCode || "USD")}</span>
                            ) : null}
                            <input
                              value={row.rate}
                              onChange={(event) =>
                                updateSurchargeRow(row.key, { rate: event.target.value })
                              }
                              placeholder={isPercentRate(row.rate) ? "3.8%" : "320.00"}
                            />
                          </div>
                        ) : (
                          <span className="create-contract-empty-value">—</span>
                        )}
                      </td>
                      <td>
                        <input
                          value={row.frequency}
                          disabled={!row.applied}
                          onChange={(event) =>
                            updateSurchargeRow(row.key, {
                              frequency: event.target.value,
                            })
                          }
                          placeholder="monthly"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="create-contract-card">
          <div className="create-contract-section-head">
            <div>
              <h2>
                4 · Internal notes
                <span className="create-contract-tag optional">Optional</span>
              </h2>
            </div>
          </div>

          <div className="create-contract-field create-contract-notes-area">
            <label htmlFor="internal-notes">Notes (visible to internal team only)</label>
            <textarea
              id="internal-notes"
              value={internalNotes}
              onChange={(event) => setInternalNotes(event.target.value)}
              placeholder="Add internal context for pricing, approvals, or renewal terms…"
            />
          </div>

          <div className="create-contract-notes-meta">
            <div>
              Created by: {contractOwner || "—"}
              {validFrom ? ` · ${dayjs(validFrom).format("DD MMM YYYY")}` : ""}
              <br />
              Last saved:{" "}
              {lastSavedAt ? dayjs(lastSavedAt).format("HH:mm:ss") : "not saved yet"}
            </div>
            <div>
              Status:{" "}
              <span className="create-contract-status-pill">
                <span className="dot" />
                Draft
              </span>
            </div>
          </div>
        </section>
      </div>

      <div
        className="create-contract-footer"
        style={{ left: sidebarOffset, width: `calc(100% - ${sidebarOffset}px)` }}
      >
        <div className="create-contract-footer-checks">
          <span className={completedRateLines > 0 ? "ok" : ""}>
            {completedRateLines > 0 ? "✓" : "○"} {completedRateLines} rate lines
          </span>
          <span className={appliedSurchargeCount > 0 ? "ok" : ""}>
            {appliedSurchargeCount > 0 ? "✓" : "○"} {appliedSurchargeCount} surcharges
          </span>
          <span className={basicsComplete ? "ok" : "warn"}>
            {basicsComplete ? "✓" : "⚠"} Contract basics{" "}
            {basicsComplete ? "complete" : "incomplete"}
          </span>
        </div>
        <div className="create-contract-footer-actions">
          <button
            type="button"
            className="create-contract-btn secondary"
            onClick={() => navigate("/tariff/contracts")}
          >
            Cancel
          </button>
          <button
            type="button"
            className="create-contract-btn secondary"
            disabled={createMutation.isPending}
            onClick={() => handleSubmit("DRAFT")}
          >
            Save as draft
          </button>
          <button
            type="button"
            className="create-contract-btn"
            disabled={createMutation.isPending}
            onClick={() => handleSubmit("ACTIVE")}
          >
            {createMutation.isPending ? (
              <>
                <Loader size={14} color="#fff" />
                Saving…
              </>
            ) : (
              <>
                Review &amp; confirm
                <IconArrowRight size={14} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
