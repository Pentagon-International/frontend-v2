import { useEffect, useMemo, useState } from "react";
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconPlus,
  IconSearch,
  IconUpload,
} from "@tabler/icons-react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@mantine/hooks";
import { Loader } from "@mantine/core";
import { useNavigate } from "react-router-dom";
import { URL } from "../../../api/serverUrls";
import { apiCallProtected } from "../../../api/axios";
import useAuthStore from "../../../store/authStore";
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
  if (row.avg_buy_rate && row.rate_unit) {
    const amount = Number(row.avg_buy_rate);
    const formattedAmount = Number.isFinite(amount)
      ? amount.toLocaleString("en-US", { maximumFractionDigits: 2 })
      : row.avg_buy_rate;
    const unit = row.rate_unit.replace(/\s+/g, "");
    return `$${formattedAmount}/${unit}`;
  }

  if (row.avg_buy_rate_display) {
    return row.avg_buy_rate_display
      .replace(/\s*(USD|EUR|INR|GBP|AED)\s*$/i, "")
      .trim();
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
      ordering: "-updated_at",
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
  const user = useAuthStore((state) => state.user);
  const userInitials = useMemo(() => {
    const name = user?.full_name || user?.username || user?.email || "U";
    return getInitials(String(name));
  }, [user]);

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
          fetchContracts({ index: 0, limit: 1, filters: baseFilters }),
        select: (response: ContractFilterResponse) => response.total,
        staleTime: 30_000,
      },
      {
        queryKey: ["tariff-contracts-count", "active", baseFilters],
        queryFn: () =>
          fetchContracts({
            index: 0,
            limit: 1,
            filters: { ...baseFilters, status: "ACTIVE" },
          }),
        select: (response: ContractFilterResponse) => response.total,
        staleTime: 30_000,
      },
      {
        queryKey: ["tariff-contracts-count", "expiring", baseFilters],
        queryFn: () =>
          fetchContracts({
            index: 0,
            limit: 1,
            filters: { ...baseFilters, status: "EXPIRING" },
          }),
        select: (response: ContractFilterResponse) => response.total,
        staleTime: 30_000,
      },
      {
        queryKey: ["tariff-contracts-count", "expired", baseFilters],
        queryFn: () =>
          fetchContracts({
            index: 0,
            limit: 1,
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
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

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

  const rangeStart = totalRecords === 0 ? 0 : pageIndex * pageSize + 1;
  const rangeEnd =
    totalRecords === 0 ? 0 : Math.min(totalRecords, pageIndex * pageSize + rows.length);

  const subtitle = isLoading
    ? "Loading contracts…"
    : totalRecords <= pageSize
      ? `${totalRecords} of ${totalRecords} contracts · all vendor types · click any row for detail`
      : `${rangeStart}–${rangeEnd} of ${totalRecords} contracts · all vendor types · click any row for detail`;

  const pageButtons = useMemo(() => {
    const maxButtons = 5;
    const count = Math.min(maxButtons, totalPages);
    return Array.from({ length: count }, (_, i) => {
      if (totalPages <= maxButtons) return i;
      if (pageIndex < 3) return i;
      if (pageIndex > totalPages - 4) return totalPages - maxButtons + i;
      return pageIndex - 2 + i;
    });
  }, [pageIndex, totalPages]);

  const handleCategoryTab = (key: CategoryTab) => {
    setCategoryTab((current) => (current === key ? "all" : key));
  };

  return (
    <div className="tariff-contracts-page">
      <div className="tariff-contracts-topbar">
        <div className="tariff-contracts-crumbs">
          Pentagon Freight
          <span className="sep">›</span>
          Tariff &amp; Contract
          <span className="sep">›</span>
          <span className="here">Contracts</span>
        </div>
        <div className="tariff-contracts-spacer" />
        <label className="tariff-contracts-search">
          <IconSearch size={14} stroke={1.8} />
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search contracts, vendors, lanes, rules…"
            aria-label="Search contracts"
          />
        </label>
        <div
          className="tariff-contracts-vendor-avatar"
          style={{ borderRadius: "50%", width: 30, height: 30 }}
          aria-hidden
        >
          {userInitials}
        </div>
      </div>

      <div className="tariff-contracts-main">
        <div className="tariff-contracts-page-head">
          <div>
            <h1>Contracts</h1>
            <div className="sub">{subtitle}</div>
          </div>
          <div className="tariff-contracts-toolbar">
            <button type="button" className="tariff-contracts-filter primary">
              FY 26
              <IconChevronDown size={14} />
            </button>
            <select
              className="tariff-contracts-filter"
              value={selectedCurrency}
              onChange={(event) => setSelectedCurrency(event.target.value)}
              aria-label="Filter by currency"
            >
              <option value="">All currencies</option>
              {currencyOptions.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
            <select
              className="tariff-contracts-filter"
              value={selectedOwner}
              onChange={(event) => setSelectedOwner(event.target.value)}
              aria-label="Filter by owner"
            >
              <option value="">All owners</option>
              {ownerOptions.map((owner) => (
                <option key={owner} value={owner}>
                  {owner}
                </option>
              ))}
            </select>
            <button type="button" className="tariff-contracts-btn secondary">
              <IconUpload size={14} />
              Import
            </button>
            <button
              type="button"
              className="tariff-contracts-btn"
              onClick={() => navigate("/tariff/contracts/create")}
            >
              <IconPlus size={14} />
              New contract
            </button>
          </div>
        </div>

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

        <div className="tariff-contracts-table-card">
          <div className="tariff-contracts-table-wrap">
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
                      <tr key={`${row.vendor_reference}-${row.sno}`} className="contract-row">
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
          </div>

          {!isLoading && !isError && totalRecords > 0 ? (
            <div className="tariff-contracts-footer">
              <div className="tariff-contracts-footer-meta">
                Showing {rangeStart}–{rangeEnd} of {totalRecords}
                {isFetching ? " · Refreshing…" : ""}
              </div>
              <div className="tariff-contracts-footer-controls">
                <select
                  className="tariff-contracts-filter"
                  value={String(pageSize)}
                  onChange={(event) => setPageSize(Number(event.target.value))}
                  aria-label="Rows per page"
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size} / page
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="tariff-contracts-page-btn"
                  disabled={pageIndex <= 0}
                  onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
                  aria-label="Previous page"
                >
                  <IconChevronLeft size={14} />
                </button>
                {pageButtons.map((buttonIndex) => (
                  <button
                    key={buttonIndex}
                    type="button"
                    className={`tariff-contracts-page-btn${
                      buttonIndex === pageIndex ? " active" : ""
                    }`}
                    onClick={() => setPageIndex(buttonIndex)}
                  >
                    {buttonIndex + 1}
                  </button>
                ))}
                <button
                  type="button"
                  className="tariff-contracts-page-btn"
                  disabled={pageIndex >= totalPages - 1}
                  onClick={() =>
                    setPageIndex((current) =>
                      Math.min(totalPages - 1, current + 1),
                    )
                  }
                  aria-label="Next page"
                >
                  <IconChevronRight size={14} />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
