import { useEffect, useMemo, useState } from "react";
import {
  IconPlus,
  IconSearch,
  IconUpload,
} from "@tabler/icons-react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@mantine/hooks";
import {
  Box,
  Button,
  Group,
  Loader,
  MantineProvider,
  Paper,
  Select,
  Text,
  TextInput,
} from "@mantine/core";
import { useNavigate } from "react-router-dom";
import { URL } from "../../../api/serverUrls";
import { apiCallProtected } from "../../../api/axios";
import {
  DEFAULT_ERP_LIST_THEME,
  ERP_LIST_GEIST_ROOT_CLASS,
  ERP_LIST_INNER_PAD_X,
  ERPListPaginationFooter,
  ERPListToolbar,
  erpListGeistMantineTheme,
  erpListGeistRootTypography,
  erpListGeistSelectClassNames,
  erpToolbarOutlineButtonStyles,
  erpToolbarPrimaryButtonStyles,
  erpToolbarSelectStyles,
} from "../../../components";
import "./tariffContractsList.css";

export type TariffContractRow = {
  sno: number;
  vendor_reference: string;
  carrier_code: string;
  carrier_name: string;
  service: string;
  mode: string;
  coverage_description: string;
  lane_count: number;
  lanes_label: string;
  commitment: string | null;
  avg_buy_rate: string;
  min_buy_rate?: string;
  max_buy_rate?: string;
  avg_buy_rate_display: string;
  currency_code: string;
  rate_unit?: string;
  valid_from: string;
  valid_to: string;
  days_left: number;
  validity_percent: number;
  validity_display: string;
  created_by: string;
  approved_by: string | null;
  status: string;
  auto_renew?: boolean;
  auto_renew_days?: number | null;
  tariff_codes?: string[];
  updated_at: string;
};

type ContractFilterPayload = {
  carrier_code?: string;
  carrier_name?: string;
  vendor_reference?: string;
  service?: string;
  status?: string;
  created_by?: string;
  approved_by?: string;
  coverage_description?: string;
  origin_code?: string;
  destination_code?: string;
  search?: string;
  currency_code?: string;
};

type ContractFilterResponse = {
  status: boolean;
  message: string;
  total: number;
  limit: number;
  index: number;
  data: TariffContractRow[];
};

type StatusTab = "all" | "active" | "expiring_expired";
type CategoryTab =
  | "all"
  | "shipping"
  | "airlines"
  | "brokers"
  | "transporters"
  | "warehouses";

const PAGE_SIZE_OPTIONS = [10, 20, 25, 50];

function formatContractId(sno: number, validFrom?: string): string {
  const year = validFrom
    ? new Date(validFrom).getFullYear()
    : new Date().getFullYear();
  const safeYear = Number.isFinite(year) ? year : new Date().getFullYear();
  return `PCT-${safeYear}-${String(sno).padStart(4, "0")}`;
}

function formatRateDisplay(row: TariffContractRow): string {
  const prefix = row.currency_code ? `${row.currency_code} ` : "";

  if (row.avg_buy_rate && row.rate_unit) {
    const amount = Number(row.avg_buy_rate);
    const formattedAmount = Number.isFinite(amount)
      ? amount.toLocaleString("en-US", { maximumFractionDigits: 2 })
      : row.avg_buy_rate;
    const unit = row.rate_unit.replace(/\s+/g, "");
    return `${prefix}${formattedAmount}/${unit}`;
  }

  if (row.avg_buy_rate_display) {
    const amount = row.avg_buy_rate_display
      .replace(/\s*(USD|EUR|INR|GBP|AED|[A-Z]{3})\s*$/i, "")
      .trim();
    return `${prefix}${amount}`;
  }

  return "—";
}

function formatValidityDays(daysLeft: number, status: string): string {
  const normalized = status.trim().toUpperCase();
  if (normalized === "EXPIRED" || daysLeft <= 0) {
    const elapsed = Math.abs(daysLeft);
    return elapsed > 0 ? `expired ${elapsed}d ago` : "Expired";
  }
  return `${daysLeft}d left`;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function getVendorCategory(service: string, mode: string): {
  label: string;
  className: string;
} {
  const normalized = `${service} ${mode}`.toUpperCase();
  if (normalized.includes("AIR")) {
    return { label: "AIRLINE", className: "airline" };
  }
  if (normalized.includes("BROKER") || normalized.includes("CUSTOMS")) {
    return { label: "BROKER", className: "broker" };
  }
  if (normalized.includes("TRANSPORT") || normalized.includes("ROAD")) {
    return { label: "TRANSPORT", className: "transport" };
  }
  if (normalized.includes("WAREHOUSE") || normalized.includes("WH")) {
    return { label: "WAREHOUSE", className: "warehouse" };
  }
  if (
    normalized.includes("FCL") ||
    normalized.includes("LCL") ||
    normalized.includes("OCEAN") ||
    normalized.includes("SEA")
  ) {
    return { label: "SHIPPING", className: "shipping" };
  }
  return { label: service || "VENDOR", className: "default" };
}

function getStatusPresentation(status: string): {
  label: string;
  className: "active" | "expiring" | "expired" | "default";
} {
  const value = status.trim().toUpperCase();
  if (value === "ACTIVE") return { label: "Active", className: "active" };
  if (value === "EXPIRING") return { label: "Expiring", className: "expiring" };
  if (value === "EXPIRED") return { label: "Expired", className: "expired" };
  return {
    label: status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    className: "default",
  };
}

function getValidityFillClass(daysLeft: number, status: string): string {
  const normalized = status.trim().toUpperCase();
  if (normalized === "EXPIRED" || daysLeft <= 0) return "bad";
  if (normalized === "EXPIRING" || daysLeft <= 45) return "warn";
  return "";
}

async function fetchContracts(params: {
  index: number;
  limit: number;
  filters: ContractFilterPayload;
}): Promise<ContractFilterResponse> {
  const response = (await apiCallProtected.post(
    `${URL.filter_contract}?index=${params.index}&limit=${params.limit}`,
    {
      filters: params.filters,
      // ordering: "-updated_at",
    },
  )) as ContractFilterResponse;

  return {
    status: Boolean(response?.status),
    message: response?.message ?? "",
    total: Number(response?.total ?? 0),
    limit: Number(response?.limit ?? params.limit),
    index: Number(response?.index ?? params.index),
    data: Array.isArray(response?.data) ? response.data : [],
  };
}

export default function TariffContractsList() {
  const navigate = useNavigate();
  const erpTheme = DEFAULT_ERP_LIST_THEME;

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch] = useDebouncedValue(searchInput, 500);
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [categoryTab, setCategoryTab] = useState<CategoryTab>("all");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [selectedOwner, setSelectedOwner] = useState("");
  const [selectedCurrency, setSelectedCurrency] = useState("");

  useEffect(() => {
    setPageIndex(0);
  }, [debouncedSearch, statusTab, categoryTab, selectedOwner, selectedCurrency, pageSize]);

  const baseFilters = useMemo(() => {
    const filters: ContractFilterPayload = {};

    if (debouncedSearch.trim()) {
      filters.search = debouncedSearch.trim();
    }

    if (categoryTab === "shipping") {
      filters.service = "FCL";
    } else if (categoryTab === "airlines") {
      filters.service = "AIR";
    } else if (categoryTab === "brokers") {
      filters.coverage_description = "Customs";
    } else if (categoryTab === "transporters") {
      filters.service = "ROAD";
    } else if (categoryTab === "warehouses") {
      filters.coverage_description = "Warehouse";
    }

    if (selectedOwner) {
      filters.created_by = selectedOwner;
    }

    if (selectedCurrency) {
      filters.currency_code = selectedCurrency;
    }

    return filters;
  }, [debouncedSearch, categoryTab, selectedOwner, selectedCurrency]);

  const apiFilters = useMemo(() => {
    const filters: ContractFilterPayload = { ...baseFilters };

    if (statusTab === "active") {
      filters.status = "ACTIVE";
    } else if (statusTab === "expiring_expired") {
      filters.status = "EXPIRING";
    }

    return filters;
  }, [baseFilters, statusTab]);

  const countQueries = useQueries({
    queries: [
      {
        queryKey: ["tariff-contracts-count", "all", baseFilters],
        queryFn: () =>
          fetchContracts({ index: pageIndex, limit: pageSize, filters: baseFilters }),
        select: (response: ContractFilterResponse) => response.total,
        staleTime: 30_000,
      },
      {
        queryKey: ["tariff-contracts-count", "active", baseFilters],
        queryFn: () =>
          fetchContracts({
            index: pageIndex,
            limit: pageSize,
            filters: { ...baseFilters, status: "ACTIVE" },
          }),
        select: (response: ContractFilterResponse) => response.total,
        staleTime: 30_000,
      },
      {
        queryKey: ["tariff-contracts-count", "expiring", baseFilters],
        queryFn: () =>
          fetchContracts({
            index: pageIndex,
            limit: pageSize,
            filters: { ...baseFilters, status: "EXPIRING" },
          }),
        select: (response: ContractFilterResponse) => response.total,
        staleTime: 30_000,
      },
      {
        queryKey: ["tariff-contracts-count", "expired", baseFilters],
        queryFn: () =>
          fetchContracts({
            index: pageIndex,
            limit: pageSize,
            filters: { ...baseFilters, status: "EXPIRED" },
          }),
        select: (response: ContractFilterResponse) => response.total,
        staleTime: 30_000,
      },
    ],
  });

  const [allCount, activeCount, expiringCount, expiredCount] = countQueries.map(
    (query) => query.data ?? 0,
  );
  const expiringExpiredCount = expiringCount + expiredCount;

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
  } = useQuery({
    queryKey: ["tariff-contracts", pageIndex, pageSize, apiFilters],
    queryFn: () =>
      fetchContracts({
        index: pageIndex,
        limit: pageSize,
        filters: apiFilters,
      }),
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });

  const rows = data?.data ?? [];
  const totalRecords = data?.total ?? 0;

  const ownerOptions = useMemo(() => {
    const owners = new Set<string>();
    rows.forEach((row) => {
      if (row.created_by?.trim()) owners.add(row.created_by.trim());
    });
    return Array.from(owners).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const currencyOptions = useMemo(() => {
    const currencies = new Set<string>();
    rows.forEach((row) => {
      if (row.currency_code?.trim()) currencies.add(row.currency_code.trim());
    });
    return Array.from(currencies).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const subtitle = isLoading
    ? "Loading contracts…"
    : `${totalRecords} contracts${isFetching ? " · Refreshing…" : ""}`;

  const handleCategoryTab = (key: CategoryTab) => {
    setCategoryTab((current) => (current === key ? "all" : key));
  };

  return (
    <MantineProvider theme={erpListGeistMantineTheme}>
      {/* tariff-contracts-page scopes CSS custom-property variables to descendants */}
      <Box
        className={`${ERP_LIST_GEIST_ROOT_CLASS} tariff-contracts-page`}
        style={{
          ...erpListGeistRootTypography,
          flex: 1,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          backgroundColor: erpTheme.pageBg,
        }}
      >
        {/* ── Component toolbar: replaces the old custom topbar + page-head ── */}
        <ERPListToolbar
          theme={erpTheme}
          leading={
            <Group gap={12} align="baseline" wrap="nowrap">
              <Text
                fw={700}
                size="md"
                c={erpTheme.fg}
                style={{ fontFamily: erpTheme.fontSans }}
              >
                Contracts
              </Text>
              <Text
                size="xs"
                c={erpTheme.muted}
                style={{ fontFamily: erpTheme.fontSans }}
              >
                {subtitle}
              </Text>
            </Group>
          }
          actions={
            <>
              <TextInput
                placeholder="Search contracts, vendors, lanes…"
                leftSection={<IconSearch size={14} />}
                w={260}
                size="xs"
                value={searchInput}
                onChange={(e) => setSearchInput(e.currentTarget.value)}
                classNames={{ input: ERP_LIST_GEIST_ROOT_CLASS }}
                styles={{
                  input: {
                    fontFamily: erpTheme.fontSans,
                    fontSize: 12,
                    height: 32,
                    borderColor: erpTheme.border,
                  },
                }}
              />
              {/* <Select
                size="xs"
                placeholder="All currencies"
                value={selectedCurrency || null}
                onChange={(v) => setSelectedCurrency(v ?? "")}
                data={currencyOptions.map((c) => ({ value: c, label: c }))}
                clearable
                w={130}
                classNames={erpListGeistSelectClassNames}
                styles={erpToolbarSelectStyles(erpTheme)}
              /> */}
              {/* <Select
                size="xs"
                placeholder="All owners"
                value={selectedOwner || null}
                onChange={(v) => setSelectedOwner(v ?? "")}
                data={ownerOptions.map((o) => ({ value: o, label: o }))}
                clearable
                w={140}
                classNames={erpListGeistSelectClassNames}
                styles={erpToolbarSelectStyles(erpTheme)}
              /> */}
              {/* <Button
                variant="default"
                size="xs"
                leftSection={<IconUpload size={14} />}
                styles={erpToolbarOutlineButtonStyles(erpTheme)}
              >
                Import
              </Button> */}
              <Button
                size="xs"
                leftSection={<IconPlus size={14} />}
                styles={erpToolbarPrimaryButtonStyles(erpTheme)}
                onClick={() => navigate("/tariff/contracts/create")}
              >
                New contract
              </Button>
            </>
          }
        />

        {/* ── Main content ── */}
        <Box component="main" px={ERP_LIST_INNER_PAD_X} py="md">

          {/* Status + Category filter tabs */}
          <div className="tariff-contracts-pill-row combined">
            <div className="tariff-contracts-pill-group">
              <button
                type="button"
                className={`tariff-contracts-pill${statusTab === "all" ? " active" : ""}`}
                onClick={() => setStatusTab("all")}
              >
                All{allCount > 0 ? ` ${allCount}` : ""}
              </button>
              <button
                type="button"
                className={`tariff-contracts-pill${statusTab === "active" ? " active" : ""}`}
                onClick={() => setStatusTab("active")}
              >
                Active{activeCount > 0 ? ` ${activeCount}` : ""}
              </button>
              <button
                type="button"
                className={`tariff-contracts-pill${statusTab === "expiring_expired" ? " active" : ""}`}
                onClick={() => setStatusTab("expiring_expired")}
              >
                Expiring / Expired
                {expiringExpiredCount > 0 ? ` ${expiringExpiredCount}` : ""}
              </button>
            </div>
            <span className="tariff-contracts-pill-divider" aria-hidden />
            <div className="tariff-contracts-pill-group">
              {(
                [
                  ["shipping", "Shipping lines"],
                  ["airlines", "Airlines"],
                  ["brokers", "Customs brokers"],
                  ["transporters", "Transporters"],
                  ["warehouses", "Warehouses"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={`tariff-contracts-pill${categoryTab === key ? " active" : ""}`}
                  onClick={() => handleCategoryTab(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Table card */}
          <Paper
            withBorder
            radius="xl"
            shadow="sm"
            p={0}
            style={{
              overflow: "hidden",
              borderColor: erpTheme.border,
              backgroundColor: erpTheme.cardBg,
            }}
          >
            <Box style={{ overflowX: "auto" }}>
              {isLoading ? (
                <div className="tariff-contracts-state">
                  <Loader size="sm" color="#0b1f3a" />
                </div>
              ) : isError ? (
                <div className="tariff-contracts-state error">
                  {(error as Error)?.message || "Unable to load contracts."}
                </div>
              ) : rows.length === 0 ? (
                <div className="tariff-contracts-state">
                  No contracts found for the selected filters.
                </div>
              ) : (
                <table className="tariff-contracts-table">
                  <thead>
                    <tr>
                      <th>Contract</th>
                      <th>Vendor</th>
                      <th>Mode &amp; Lanes</th>
                      <th>Commitment</th>
                      <th>Avg Buy Rate</th>
                      <th>Validity</th>
                      <th>Owner</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const vendorCategory = getVendorCategory(row.service, row.mode);
                      const statusPresentation = getStatusPresentation(row.status);
                      const validityFill = getValidityFillClass(
                        row.days_left,
                        row.status,
                      );

                      return (
                        <tr
                          key={`${row.vendor_reference}-${row.sno}`}
                          className="contract-row"
                        >
                          <td>
                            <div className="tariff-contracts-contract-id">
                              {formatContractId(row.sno, row.valid_from)}
                            </div>
                            <div className="tariff-contracts-contract-sub">
                              {row.vendor_reference}
                            </div>
                          </td>
                          <td>
                            <div className="tariff-contracts-vendor-cell">
                              <div className="tariff-contracts-vendor-avatar">
                                {getInitials(row.carrier_name)}
                              </div>
                              <div>
                                <div className="tariff-contracts-vendor-name">
                                  {row.carrier_name}
                                </div>
                                <span
                                  className={`tariff-contracts-mode-chip ${vendorCategory.className}`}
                                >
                                  {vendorCategory.label}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="tariff-contracts-mode-title">{row.mode}</div>
                            <div className="tariff-contracts-mode-sub">
                              {row.coverage_description}
                              {row.lanes_label ? ` · ${row.lanes_label}` : ""}
                            </div>
                          </td>
                          <td>
                            <div className="tariff-contracts-commitment">
                              {row.commitment ?? "—"}
                            </div>
                          </td>
                          <td>
                            <div className="tariff-contracts-rate">
                              {formatRateDisplay(row)}
                            </div>
                            {row.currency_code ? (
                              <span className="tariff-contracts-fx">
                                {row.currency_code}
                              </span>
                            ) : null}
                          </td>
                          <td>
                            <div className="tariff-contracts-validity-days">
                              {formatValidityDays(row.days_left, row.status)}
                            </div>
                            <div className="tariff-contracts-validity-bar">
                              <div
                                className={`fill ${validityFill}`}
                                style={{
                                  width: `${Math.max(0, Math.min(100, row.validity_percent ?? 0))}%`,
                                }}
                              />
                            </div>
                            <div className="tariff-contracts-validity-range">
                              {row.validity_display}
                            </div>
                          </td>
                          <td>
                            <div className="tariff-contracts-owner">
                              {row.created_by}
                            </div>
                          </td>
                          <td>
                            <span
                              className={`tariff-contracts-cstat ${statusPresentation.className}`}
                            >
                              <span className="dot" />
                              {statusPresentation.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </Box>

            {!isLoading && !isError && totalRecords > 0 ? (
              <ERPListPaginationFooter
                theme={erpTheme}
                totalRecords={totalRecords}
                pageIndex={pageIndex}
                pageSize={pageSize}
                onPageIndexChange={setPageIndex}
                onPageSizeChange={setPageSize}
                pageSizeOptions={PAGE_SIZE_OPTIONS.map(String)}
              />
            ) : null}
          </Paper>
        </Box>
      </Box>
    </MantineProvider>
  );
}
