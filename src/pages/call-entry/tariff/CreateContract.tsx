import { useCallback, useMemo, useState } from "react";
import {
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconClipboard,
  IconPlus,
  IconX,
} from "@tabler/icons-react";
import {
  carrierDisplayFormat,
  carrierTransportParamsFromService,
  formatCarrierDisplayValue,
  parseCarrierNameFromLabel,
} from "../../../utils/carrierSelect";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader, Select } from "@mantine/core";
import { useNavigate, useLocation } from "react-router-dom";
import dayjs from "dayjs";
import { URL } from "../../../api/serverUrls";
import { apiCallProtected } from "../../../api/axios";
import { ToastNotification, SearchableSelect } from "../../../components";
import EditPageAuditInfoIcon from "../../../components/EditPageAuditInfoIcon";
import {
  mergeEditPageAuditSources,
  normalizeEditPageAuditInfo,
} from "../../../utils/editPageAuditInfo";
import { getAPICall } from "../../../service/getApiCall";
import { API_HEADER } from "../../../store/storeKeys";
import useAuthStore from "../../../store/authStore";
import { useLayoutStore } from "../../../store/useLayoutStore";
import { useContractEditHydration } from "./contractDetail/useContractEditHydration";
import {
  CONTRACT_EDIT_STATE_KEY,
  peekContractEditPayload,
} from "./contractDetail/contractEditSession";
import type { ContractDetailResponse } from "./contractDetail/types";
import {
  bindMoneyWholeNumberMode,
  formatMoneyAmountBound,
  formatMoneyAmountForUi,
  isVietnamBranchFromUser,
} from "../../../utils/nonDecimalMoneyAmount";
import "./createContract.css";


type ContainerOption = {
  container_code?: string;
  container_name?: string;
};

type ChargeMasterRow = {
  id?: number;
  charge_code?: string;
  charge_name?: string;
};

type CurrencyMasterRow = {
  code: string;
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

const EMPTY_SURCHARGE_ROW = (): SurchargeRow => ({
  key: crypto.randomUUID(),
  charge_code: "",
  charge_name: "",
  basis: "",
  rate: "",
  frequency: "",
  applied: true,
});


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
  return currencyCode ? `${currencyCode} ` : "";
}

function formatMoney(amount: number, currencyCode: string): string {
  return `${getCurrencyPrefix(currencyCode)}${formatMoneyAmountForUi(amount)}`;
}

function isPercentRate(value: string): boolean {
  return value.trim().endsWith("%");
}

function formatRateValue(value: string): string {
  if (isPercentRate(value)) return value.trim();
  const parsed = parseRate(value);
  return parsed !== null ? formatMoneyAmountBound(parsed) : value.trim();
}

function portMasterDisplayFormat(item: Record<string, unknown>) {
  return {
    value: String(item.port_code ?? ""),
    label: `${String(item.port_name ?? "")} (${String(item.port_code ?? "")})`,
  };
}

function chargeMasterDisplayFormat(item: Record<string, unknown>) {
  return {
    value: String(item.charge_code ?? ""),
    label: `${String(item.charge_name ?? "")} (${String(item.charge_code ?? "")})`,
  };
}

async function fetchContainerTypes(): Promise<ContainerOption[]> {
  const response = await getAPICall(URL.containerType, API_HEADER);
  if (Array.isArray(response)) return response as ContainerOption[];
  return Array.isArray((response as { data?: ContainerOption[] })?.data)
    ? ((response as { data: ContainerOption[] }).data ?? [])
    : [];
}

async function fetchCurrencyMaster(): Promise<CurrencyMasterRow[]> {
  const response = await getAPICall(URL.currencyMaster, API_HEADER);
  if (Array.isArray(response)) return response as CurrencyMasterRow[];
  return Array.isArray((response as { data?: CurrencyMasterRow[] })?.data)
    ? ((response as { data: CurrencyMasterRow[] }).data ?? [])
    : [];
}

async function createContract(payload: CreateContractPayload): Promise<CreateContractResponse> {
  return (await apiCallProtected.post(URL.create_contract, payload)) as CreateContractResponse;
}

export default function CreateContract() {
  const navigate = useNavigate();
  const location = useLocation();
  const isSidebarCollapsed = useLayoutStore((state) => state.isSidebarCollapsed);
  const sidebarOffset = isSidebarCollapsed ? 64 : 260;
  const user = useAuthStore((state) => state.user);
  const isVietnamBranch = useMemo(
    () => isVietnamBranchFromUser(user),
    [user],
  );
  bindMoneyWholeNumberMode(isVietnamBranch);
  const contractOwner = user?.full_name || user?.username || "";

  const editDetail = useMemo((): ContractDetailResponse | null => {
    const stateDetail = (location.state as Record<string, unknown> | null)?.[
      CONTRACT_EDIT_STATE_KEY
    ];
    if (
      stateDetail &&
      typeof stateDetail === "object" &&
      (stateDetail as ContractDetailResponse).contract_basics
    ) {
      return stateDetail as ContractDetailResponse;
    }
    return peekContractEditPayload();
  }, [location.state, location.key]);

  const isContractEditMode = Boolean(editDetail?.contract_basics);
  const contractAuditInfo = useMemo(() => {
    if (!editDetail?.contract_basics) return null;
    const overrides: Record<string, unknown> = {};
    if (editDetail.created_at) overrides.created_at = editDetail.created_at;
    if (editDetail.updated_at) overrides.updated_at = editDetail.updated_at;
    const updatedBy =
      editDetail.updated_by ||
      editDetail.updated_by_name ||
      editDetail.contract_basics.updated_by ||
      editDetail.contract_basics.updated_by_name;
    if (updatedBy) overrides.updated_by = updatedBy;

    return normalizeEditPageAuditInfo(
      mergeEditPageAuditSources(
        editDetail.contract_basics as unknown as Record<string, unknown>,
        overrides,
      ),
    );
  }, [editDetail]);

  const [contractId, setContractId] = useState(formatContractDraftId);
  const [carrierCode, setCarrierCode] = useState("");
  const [carrierLabel, setCarrierLabel] = useState("");
  const [vendorReference, setVendorReference] = useState("");
  const [service, setService] = useState("");
  const [coverageDescription, setCoverageDescription] = useState("");
  const [currencyCode, setCurrencyCode] = useState("");
  const [currencyLabel, setCurrencyLabel] = useState("");
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
  const [surchargeRows, setSurchargeRows] = useState<SurchargeRow[]>([EMPTY_SURCHARGE_ROW()]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  useContractEditHydration({
    setContractId,
    setCarrierCode,
    setCarrierLabel,
    setVendorReference,
    setService,
    setCoverageDescription,
    setCurrencyCode,
    setCurrencyLabel,
    setValidFrom,
    setValidTo,
    setApproverLabel,
    setAutoRenew,
    setAutoRenewDays,
    setInternalNotes,
    setRateRows,
    setSurchargeRows,
  });

  const serviceOptions = [
    { label: "FCL", value: "FCL" },
    { label: "LCL", value: "LCL" },
    { label: "AIR", value: "AIR" },
  ];

  const { data: containerOptions = [], isLoading: containersLoading } = useQuery({
    queryKey: ["contract-create-containers"],
    queryFn: fetchContainerTypes,
    staleTime: 60_000,
  });

  const { data: currencyOptions = [], isLoading: currenciesLoading } = useQuery({
    queryKey: ["contract-create-currencies"],
    queryFn: fetchCurrencyMaster,
    staleTime: 60_000,
  });

  const currencySelectData = useMemo(() => {
    const options = currencyOptions.map((item) => ({
      value: item.code,
      label: item.code,
    }));
    if (currencyCode && !options.some((item) => item.value === currencyCode)) {
      return [
        { value: currencyCode, label: currencyLabel || currencyCode },
        ...options,
      ];
    }
    return options;
  }, [currencyOptions, currencyCode, currencyLabel]);

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
    () => surchargeRows.filter((row) => row.applied && row.charge_code.trim()).length,
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
      validFrom &&
      validTo,
  );

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

      {/* Full-bleed header bar — aligns with app-shell and other list screens */}
      <div className="create-contract-topbar">
        <button
          type="button"
          className="create-contract-back"
          onClick={() => navigate("/tariff/contracts")}
        >
          <IconArrowLeft size={14} />
          Contracts
        </button>
        <div className="create-contract-topbar-title">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h1>{isContractEditMode ? "Edit Contract" : "New Contract"}</h1>
            <EditPageAuditInfoIcon
              visible={isContractEditMode}
              auditInfo={contractAuditInfo}
              animateKey={editDetail?.vendor_reference || contractId}
              ariaLabel="Contract audit info"
            />
          </div>
          <div className="sub">
            Enter contract basics, rate lines &amp; surcharges · review before activation ·{" "}
            <span className="mono">{contractId}</span>
          </div>
        </div>
        <div className="create-contract-toolbar">
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

      <div className="create-contract-main">
        <div className="create-contract-stepper-wrap">
          <div className="create-contract-stepper">
            <div
              className={`create-contract-step${basicsComplete ? " done" : " active"}`}
            >
              <div className="create-contract-step-icon">
                {basicsComplete ? <IconCheck size={14} /> : "1"}
              </div>
              <div className="create-contract-step-content">
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
              }`}
            >
              <div className="create-contract-step-icon">
                {completedRateLines > 0 ? <IconCheck size={14} /> : "2"}
              </div>
              <div className="create-contract-step-content">
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
              }`}
            >
              <div className="create-contract-step-icon">
                {appliedSurchargeCount > 0 ? <IconCheck size={14} /> : "3"}
              </div>
              <div className="create-contract-step-content">
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
              <div className="create-contract-step-content">
                <div className="create-contract-step-label">Review &amp; confirm</div>
                <div className="create-contract-step-sub">Validate &amp; activate</div>
              </div>
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
                label="Vendor"
                required
                placeholder="Type carrier name"
                apiEndpoint={URL.carrier}
                searchFields={["carrier_code", "carrier_name"]}
                displayFormat={carrierDisplayFormat}
                value={carrierCode || null}
                displayValue={formatCarrierDisplayValue(carrierLabel, carrierCode)}
                dropdownZIndex={40}
                onChange={(value, selectedData) => {
                  setCarrierCode(value || "");
                  setCarrierLabel(parseCarrierNameFromLabel(selectedData?.label || ""));
                }}
                minSearchLength={2}
                additionalParams={carrierTransportParamsFromService(service)}
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

            {/* <div className="create-contract-field">
              <label htmlFor="contract-id">Contract ID (auto)</label>
              <input id="contract-id" value={contractId} disabled />
            </div> */}

            <div className="create-contract-field">
              <label htmlFor="service">Mode</label>
              <select
                id="service"
                value={service}
                onChange={(event) => setService(event.target.value)}
              >
                <option value="">Select mode</option>
                {serviceOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
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
              <Select
                label="Currency"
                placeholder={currenciesLoading ? "Loading currencies…" : "Select currency"}
                searchable
                clearable
                data={currencySelectData}
                value={currencyCode || null}
                comboboxProps={{ zIndex: 40 }}
                disabled={currenciesLoading}
                onChange={(value) => {
                  setCurrencyCode(value || "");
                  setCurrencyLabel(value || "");
                }}
                required
                withAsterisk
                error={formErrors.currency_code}
                styles={{
                  input: {
                    fontSize: "13px",
                    height: "36px",
                    fontFamily: "Inter",
                  },
                  label: {
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#424242",
                    marginBottom: "4px",
                    fontFamily: "Inter",
                  },
                }}
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
              <label htmlFor="contract-owner">Contract owner</label>
              <input id="contract-owner" value={contractOwner} disabled />
            </div>

            <div className="create-contract-field create-contract-searchable">
              <SearchableSelect
                apiEndpoint={URL.accountsSalespersons}
                label="Approver"
                placeholder="Search approver"
                value={approverId || null}
                displayValue={approverLabel || null}
                dropdownZIndex={40}
                onChange={(value, selectedData) => {
                  setApproverId(value || "");
                  setApproverLabel(
                    String((selectedData as { sales_person?: string } | null)?.sales_person || selectedData?.label || ""),
                  );
                }}
                searchFields={["sales_person"]}
                displayFormat={(item) => ({
                  value: String(item.sales_person ?? ""),
                  label: String(item.sales_person ?? ""),
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
            <button
                type="button"
                className="create-contract-btn secondary"
                onClick={() => setRateRows((current) => [...current, EMPTY_RATE_ROW()])}
              >
                <IconPlus size={14} />
                Add lane
              </button>
            {/* <div className="create-contract-mini-tabs">
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
            </div> */}
          </div>

          <div className="create-contract-hint">
            Enter buy rates for each lane / equipment combination. Currency:{" "}
            <strong>{currencyDisplay}</strong>.
          </div>

          <div className="create-contract-section-head" style={{ marginBottom: 10 }}>
            <span />
            <div className="create-contract-toolbar">
              {/* <button
                type="button"
                className="create-contract-btn secondary"
                onClick={() => setRateRows((current) => [...current, EMPTY_RATE_ROW()])}
              >
                <IconPlus size={14} />
                Add lane
              </button> */}
              {/* <button
                type="button"
                className="create-contract-btn secondary"
                onClick={() => void handlePasteRateLines()}
              >
                <IconClipboard size={14} />
                Paste from clipboard
              </button> */}
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
                          minSearchLength={2}
                          onChange={(value, selectedData) =>
                            updateRateRow(row.key, {
                              origin_code: value || "",
                              origin_label: selectedData?.label || "",
                            })
                          }
                          searchFields={["port_code", "port_name"]}
                          displayFormat={portMasterDisplayFormat}
                          dropdownZIndex={40}
                        />
                        <SearchableSelect
                          apiEndpoint={URL.portMaster}
                          placeholder="Destination port"
                          value={row.destination_code || null}
                          displayValue={row.destination_label || null}
                          minSearchLength={2}
                          onChange={(value, selectedData) =>
                            updateRateRow(row.key, {
                              destination_code: value || "",
                              destination_label: selectedData?.label || "",
                            })
                          }
                          searchFields={["port_code", "port_name"]}
                          displayFormat={portMasterDisplayFormat}
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
                        onBlur={() => {
                          const formatted = formatRateValue(row.buy_rate);
                          if (formatted !== row.buy_rate) {
                            updateRateRow(row.key, { buy_rate: formatted });
                          }
                        }}
                        placeholder="Enter buy rate"
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
                        placeholder="Enter service transit"
                      />
                    </td>
                    <td>
                      <input
                        value={row.notes}
                        onChange={(event) =>
                          updateRateRow(row.key, { notes: event.target.value })
                        }
                        placeholder="Enter notes"
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
                    ? formatMoney(rateStats.min, currencyCode || "")
                    : "—"}
                </strong>
              </span>
              <span>
                Max rate:{" "}
                <strong>
                  {rateStats.max !== null
                    ? formatMoney(rateStats.max, currencyCode || "")
                    : "—"}
                </strong>
              </span>
              <span>
                Avg rate:{" "}
                <strong>
                  {rateStats.avg !== null
                    ? formatMoney(Math.round(rateStats.avg), currencyCode || "")
                    : "—"}
                </strong>
              </span>
            </div>
          </div>
        </section>

        <section className="create-contract-card">
          <div className="create-contract-section-head">
            <div>
              <h2>
                3 · Surcharges
                <span className="meta">{surchargeRows.length} lines</span>
              </h2>
            </div>
            <div className="create-contract-toolbar">
              <button
                type="button"
                className="create-contract-btn secondary"
                onClick={() =>
                  setSurchargeRows((current) => [...current, EMPTY_SURCHARGE_ROW()])
                }
              >
                <IconPlus size={14} />
                Add surcharge
              </button>
            </div>
          </div>

          {/* <div className="create-contract-section-head" style={{ marginBottom: 10 }}>
            <span />
            <div className="create-contract-toolbar">
              <button
                type="button"
                className="create-contract-btn secondary"
                onClick={() =>
                  setSurchargeRows((current) => [...current, EMPTY_SURCHARGE_ROW()])
                }
              >
                <IconPlus size={14} />
                Add surcharge
              </button>
            </div>
          </div> */}

          <div className="create-contract-table-wrap">
            <table className="create-contract-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th aria-label="Apply surcharge" />
                  <th>Code</th>
                  <th>Charge Name</th>
                  <th>Basis</th>
                  <th>Value ({currencyCode || "—"})</th>
                  <th>Update frequency</th>
                  <th aria-label="Remove row" />
                </tr>
              </thead>
              <tbody>
                {surchargeRows.map((row, index) => (
                  <tr key={row.key} className={row.applied ? "" : "disabled"}>
                    <td className="row-index">{index + 1}</td>
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
                          {row.charge_code || "—"}
                        </span>
                      </td>
                      <td>
                        <SearchableSelect
                          apiEndpoint={URL.chargeMaster}
                          placeholder="Search charge"
                          value={row.charge_code || null}
                          displayValue={
                            row.charge_name && row.charge_code
                              ? `${row.charge_name} (${row.charge_code})`
                              : row.charge_name || null
                          }
                          returnOriginalData
                          minSearchLength={2}
                          onChange={(value, _selectedData, originalData) =>
                            updateSurchargeRow(row.key, {
                              charge_code: value || "",
                              charge_name: value
                                ? String(
                                    (originalData as ChargeMasterRow)?.charge_name || "",
                                  ).trim()
                                : "",
                            })
                          }
                          searchFields={["charge_code", "charge_name"]}
                          displayFormat={chargeMasterDisplayFormat}
                          dropdownZIndex={40}
                        />
                      </td>
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
                              <span>{getCurrencyPrefix(currencyCode || "")}</span>
                            ) : null}
                            <input
                              value={row.rate}
                              onChange={(event) =>
                                updateSurchargeRow(row.key, { rate: event.target.value })
                              }
                              onBlur={() => {
                                if (isPercentRate(row.rate)) return;
                                const formatted = formatRateValue(row.rate);
                                if (formatted !== row.rate) {
                                  updateSurchargeRow(row.key, { rate: formatted });
                                }
                              }}
                              placeholder={isPercentRate(row.rate) ? "Enter value" : "Enter value"}
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
                      <td>
                        <button
                          type="button"
                          className="create-contract-delete-btn"
                          aria-label="Remove surcharge"
                          disabled={surchargeRows.length === 1}
                          onClick={() =>
                            setSurchargeRows((current) =>
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
          {/* <button
            type="button"
            className="create-contract-btn secondary"
            disabled={createMutation.isPending}
            onClick={() => handleSubmit("DRAFT")}
          >
            Save as draft
          </button> */}
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
