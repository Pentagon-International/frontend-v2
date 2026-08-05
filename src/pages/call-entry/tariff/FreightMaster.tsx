import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  carrierDisplayFormat,
  carrierNameValueDisplayFormat,
  carrierTransportParamsFromService,
  formatCarrierDisplayValue,
  parseCarrierNameFromLabel,
} from "../../../utils/carrierSelect";
import {
  ActionIcon,
  Box,
  Button,
  Group,
  Menu,
  Text,
  Tooltip,
  UnstyledButton,
  Grid,
  Select,
  TextInput,
  MantineProvider,
} from "@mantine/core";
import {
  IconDotsVertical,
  IconEdit,
  IconPlus,
  IconFilter,
  IconListDetails,
  IconListNumbers,
  IconSearch,
  IconTruck,
  IconX,
  IconEye,
} from "@tabler/icons-react";
import { Outlet, useNavigate } from "react-router-dom";
import {
  ToastNotification,
  SearchableSelect,
  SingleDateInput,
  DEFAULT_ERP_LIST_THEME,
  ERP_LIST_GEIST_ROOT_CLASS,
  erpListGeistMantineTheme,
  erpListGeistRootTypography,
  erpListGeistSelectClassNames,
  erpListFilterUnifiedMantineStyles,
  erpListFilterFieldCellStyle,
  ERP_LIST_FILTER_FIELD_COL_SPAN_FIFTHS,
  ERPListFilterActionsFooter,
  ERPListPaginationFooter,
  ERPListScreen,
  ERPListStatPill,
  erpToolbarOutlineButtonStyles,
  erpToolbarPrimaryButtonStyles,
} from "../../../components";
import type { ErpListTheme } from "../../../components";
import { URL } from "../../../api/serverUrls";
import { useQuery } from "@tanstack/react-query";
import useAuthStore from "../../../store/authStore";
import { useForm } from "@mantine/form";
import dayjs from "dayjs";
import { apiCallProtected } from "../../../api/axios";
import { useDebouncedValue } from "@mantine/hooks";
import useDateFormat from "../../../hooks/useDateFormat";
import { useListFilterStore } from "../../../store/listFilterStore";
import {
  TariffMasterListNativeTable,
  type TariffListColumn,
  type TariffHeaderFilterValues,
  type TariffHeaderFiltersProp,
  type TariffHeaderRenderInput,
} from "./TariffMasterListNativeTable";
import { getTariffFilterListTotal } from "./tariffFilterListTotal";

type Freight = {
  id: number;
  origin_name: string;
  destination_name: string;
  origin_code?: string;
  destination_code?: string;
  valid_from: string;
  valid_to: string;
  status?: string;
  tariff_charges?: any[];
  service?: string;
  tariff_code?: string;
};

type FilterState = {
  origin: string | null;
  destination: string | null;
  service: string | null;
  tariff_code: string | null;
  carrier_name: string | null;
  carrier_code: string | null;
  valid_from: Date | null;
  valid_to: Date | null;
};

const LIST_KEY = "FREIGHT_MASTER";

export default function Freight() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const dateFormat = useDateFormat();

  // Add local search state — 1000ms keeps it consistent with header column filters.
  const [localSearchTerm, setLocalSearchTerm] = useState("");
  const [debouncedSearch] = useDebouncedValue(localSearchTerm, 1000);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalRecords, setTotalRecords] = useState(0);

  // Filter states - similar to CallEntryMaster
  const [showFilters, setShowFilters] = useState(false);
  // NOTE: `filtersApplied` used to gate a separate filtered-data query, but
  // the unified query now reacts to `appliedFiltersKey` directly so the flag
  // is no longer needed.

  // Store display values (labels) for SearchableSelect fields
  const [originDisplayValue, setOriginDisplayValue] = useState<string | null>(
    null
  );
  const [destinationDisplayValue, setDestinationDisplayValue] = useState<
    string | null
  >(null);
  const [carrierDisplayValue, setCarrierDisplayValue] = useState<string | null>(
    null
  );

  // Filter form to minimize state variables
  const filterForm = useForm<FilterState>({
    initialValues: {
      origin: null,
      destination: null,
      service: null,
      tariff_code: null,
      carrier_name: null,
      carrier_code: null,
      valid_from: null,
      valid_to: null,
    },
  });

  // State to store the actual applied filter values
  const [appliedFilters, setAppliedFilters] = useState<FilterState>({
    origin: null,
    destination: null,
    service: null,
    tariff_code: null,
    carrier_name: null,
    carrier_code: null,
    valid_from: null,
    valid_to: null,
  });
  const hasRestoredFromStore = useRef(false);
  const setStoreFilters = useListFilterStore((s) => s.setFilters);
  const setStoreSearch = useListFilterStore((s) => s.setSearch);
  const clearStoreFilters = useListFilterStore((s) => s.clearFilters);
  const clearStoreSearch = useListFilterStore((s) => s.clearSearch);
  const clearStoreAllExcept = useListFilterStore((s) => s.clearAllExcept);

  // Service options - simple list like EnquiryMaster
  const serviceOptions = useMemo(
    () => [
      { value: "FCL", label: "FCL" },
      { value: "LCL", label: "LCL" },
      { value: "AIR", label: "AIR" },
    ],
    []
  );

  /**
   * Single unified data query — same refetch principle as EnquiryMaster.
   *
   * `queryKey` includes every input that should trigger a refetch: pagination,
   * the applied filters object (stringified for a stable structural key), and
   * the debounced global search. React Query then natively re-runs the
   * `queryFn` whenever any of these change, so pagination, filter Apply,
   * column-header filter changes and global search all flow through a single
   * fetch + a single `isFetching` flag — no `useMemo` switching between two
   * queries, and the loader always reflects an in-flight refetch.
   */
  const appliedFiltersKey = useMemo(
    () =>
      JSON.stringify({
        origin: appliedFilters.origin,
        destination: appliedFilters.destination,
        service: appliedFilters.service,
        tariff_code: appliedFilters.tariff_code,
        carrier_name: appliedFilters.carrier_name,
        valid_from: appliedFilters.valid_from
          ? dayjs(appliedFilters.valid_from).format("YYYY-MM-DD")
          : null,
        valid_to: appliedFilters.valid_to
          ? dayjs(appliedFilters.valid_to).format("YYYY-MM-DD")
          : null,
      }),
    [appliedFilters],
  );

  const { data: freightResult, isFetching: freightFetching } = useQuery({
    queryKey: [
      "freight",
      currentPage,
      pageSize,
      appliedFiltersKey,
      debouncedSearch,
    ],
    queryFn: async () => {
      try {
        const payload: Record<string, unknown> = {};

        if (appliedFilters.origin) payload.origin_code = appliedFilters.origin;
        if (appliedFilters.destination)
          payload.destination_code = appliedFilters.destination;
        if (appliedFilters.service) payload.service = appliedFilters.service;
        if (appliedFilters.tariff_code)
          payload.tariff_code = appliedFilters.tariff_code;
        if (appliedFilters.carrier_name)
          payload.carrier_name = appliedFilters.carrier_name;
        if (appliedFilters.valid_from)
          payload.valid_from = dayjs(appliedFilters.valid_from).format(
            "YYYY-MM-DD",
          );
        if (appliedFilters.valid_to)
          payload.valid_to = dayjs(appliedFilters.valid_to).format(
            "YYYY-MM-DD",
          );
        if (debouncedSearch.trim())
          payload.search = debouncedSearch.trim();

        const response = await apiCallProtected.post(
          `${URL.filter_freight}?index=${(currentPage - 1) * pageSize}&limit=${pageSize}`,
          { filters: payload },
        );
        const data = response as any;
        const rows = Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data?.results)
          ? data.results
          : Array.isArray(data?.result)
          ? data.result
          : [];
        const total = getTariffFilterListTotal(data, rows);
        return { data: rows, total };
      } catch (error) {
        console.error("Error fetching freight data:", error);
        return { data: [] as Freight[], total: 0 };
      }
    },
    enabled: true,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Keep the `totalRecords` state in sync with whatever the latest fetch
  // returned. Using an effect (rather than `setState` inside `queryFn`) keeps
  // React's render cycle clean and avoids spurious re-renders during fetch.
  useEffect(() => {
    if (freightResult && typeof freightResult.total === "number") {
      setTotalRecords(freightResult.total);
    }
  }, [freightResult]);

  const displayData = (freightResult?.data ?? []) as Freight[];
  // Single source of truth for the table loader: any in-flight refetch shows
  // the loader. Pagination, Apply, column-header filters and search all go
  // through React Query so this flag covers every refresh.
  const isLoading = freightFetching;

  useEffect(() => {
    clearStoreAllExcept(LIST_KEY);
  }, []);

  useEffect(() => {
    if (hasRestoredFromStore.current) return;
    const restored = useListFilterStore.getState().getState(LIST_KEY);
    if (restored?.shouldRestore) {
      const restoredFilters = (restored.filters as FilterState) || null;
      if (restoredFilters) {
        filterForm.setValues(restoredFilters);
        setAppliedFilters(restoredFilters);
      }
      if (typeof restored.search === "string") {
        setLocalSearchTerm(restored.search);
      }
      // Rehydrate friendly port labels so the advanced filter SearchableSelects
      // + the collapsed column-header chip show readable names immediately.
      const restoredOriginLabel = restored.displayValues?.origin_name;
      if (
        typeof restoredOriginLabel === "string" &&
        restoredOriginLabel.trim() !== ""
      ) {
        setOriginDisplayValue(restoredOriginLabel);
      }
      const restoredDestinationLabel = restored.displayValues?.destination_name;
      if (
        typeof restoredDestinationLabel === "string" &&
        restoredDestinationLabel.trim() !== ""
      ) {
        setDestinationDisplayValue(restoredDestinationLabel);
      }
      // Carrier label is stored alongside `carrier_code` so we can rehydrate
      // both the SearchableSelect's display label and its underlying code on
      // restore from sub-pages, in the same format as it was saved.
      const restoredCarrierLabel = restored.displayValues?.carrier_name;
      if (
        typeof restoredCarrierLabel === "string" &&
        restoredCarrierLabel.trim() !== ""
      ) {
        setCarrierDisplayValue(restoredCarrierLabel);
      }
      const restoredCarrierCode = restored.displayValues?.carrier_code;
      if (
        typeof restoredCarrierCode === "string" &&
        restoredCarrierCode.trim() !== ""
      ) {
        filterForm.setFieldValue("carrier_code", restoredCarrierCode);
      }
      useListFilterStore.getState().setShouldRestore(LIST_KEY, false);
      hasRestoredFromStore.current = true;
    }
  }, [filterForm]);

  useEffect(() => {
    setStoreSearch(LIST_KEY, localSearchTerm);
    setCurrentPage(1);
  }, [debouncedSearch]);

  // Stable reference so the header-filter `renderInput` memo doesn't churn
  // every render and cascade into the native table.
  const erpTheme: ErpListTheme = useMemo(
    () => ({
      border: DEFAULT_ERP_LIST_THEME.border,
      muted: DEFAULT_ERP_LIST_THEME.muted,
      fg: DEFAULT_ERP_LIST_THEME.fg,
      primary: DEFAULT_ERP_LIST_THEME.primary,
      headerBg: DEFAULT_ERP_LIST_THEME.headerBg,
      pageBg: DEFAULT_ERP_LIST_THEME.pageBg,
      cardBg: DEFAULT_ERP_LIST_THEME.cardBg,
      fontSans: DEFAULT_ERP_LIST_THEME.fontSans,
    }),
    [],
  );
  const { border, fg, fontSans, primary, muted } = erpTheme;
  const preserveListState = useCallback(() => {
    setStoreFilters(LIST_KEY, appliedFilters);
    setStoreSearch(LIST_KEY, localSearchTerm);
    useListFilterStore.getState().setShouldRestore(LIST_KEY, true);
  }, [appliedFilters, localSearchTerm, setStoreFilters, setStoreSearch]);

  // ── Column header filters ────────────────────────────────────────────────
  // Strictly non-invasive: header filter changes update BOTH `filterForm`
  // (so the advanced filter UI stays in sync) AND `appliedFilters` (so the
  // existing React Query refetches via its `queryKey`). No new API, no new
  // payload shape — purely additive over the existing flow.
  const handleHeaderFilterChange = useCallback(
    (
      key: string,
      rawValue: string,
      displayLabel?: string | null,
      extras?: { carrier_code?: string | null },
    ) => {
      const next = rawValue || null;
      const newApplied: FilterState = { ...appliedFilters };
      let nextOriginLabel = originDisplayValue;
      let nextDestinationLabel = destinationDisplayValue;
      let nextCarrierLabel = carrierDisplayValue;
      let nextCarrierCode: string | null = filterForm.values.carrier_code;

      switch (key) {
        case "origin":
          filterForm.setFieldValue("origin", next);
          newApplied.origin = next;
          nextOriginLabel = next ? (displayLabel ?? null) : null;
          setOriginDisplayValue(nextOriginLabel);
          break;
        case "destination":
          filterForm.setFieldValue("destination", next);
          newApplied.destination = next;
          nextDestinationLabel = next ? (displayLabel ?? null) : null;
          setDestinationDisplayValue(nextDestinationLabel);
          break;
        case "service":
          filterForm.setFieldValue("service", next);
          newApplied.service = next;
          break;
        case "tariff_code":
          filterForm.setFieldValue("tariff_code", next);
          newApplied.tariff_code = next;
          break;
        case "carrier_name":
          filterForm.setFieldValue("carrier_name", next);
          newApplied.carrier_name = next;
          nextCarrierLabel = next ? (displayLabel ?? next) : null;
          setCarrierDisplayValue(nextCarrierLabel);
          // Track carrier_code alongside name so we can persist both.
          nextCarrierCode = next ? (extras?.carrier_code ?? null) : null;
          filterForm.setFieldValue("carrier_code", nextCarrierCode);
          newApplied.carrier_code = nextCarrierCode;
          break;
        case "valid_from": {
          const d = next ? dayjs(next).toDate() : null;
          filterForm.setFieldValue("valid_from", d);
          newApplied.valid_from = d;
          break;
        }
        case "valid_to": {
          const d = next ? dayjs(next).toDate() : null;
          filterForm.setFieldValue("valid_to", d);
          newApplied.valid_to = d;
          break;
        }
      }

      setAppliedFilters(newApplied);
      setCurrentPage(1);

      // Persist current filterForm + display labels into the store so the
      // friendly labels rehydrate on restore from sub-pages.
      const filtersForStore: FilterState = {
        origin: key === "origin" ? next : filterForm.values.origin,
        destination:
          key === "destination" ? next : filterForm.values.destination,
        service: key === "service" ? next : filterForm.values.service,
        tariff_code:
          key === "tariff_code" ? next : filterForm.values.tariff_code,
        carrier_name:
          key === "carrier_name" ? next : filterForm.values.carrier_name,
        carrier_code:
          key === "carrier_name" ? nextCarrierCode : filterForm.values.carrier_code,
        valid_from:
          key === "valid_from"
            ? next
              ? dayjs(next).toDate()
              : null
            : filterForm.values.valid_from,
        valid_to:
          key === "valid_to"
            ? next
              ? dayjs(next).toDate()
              : null
            : filterForm.values.valid_to,
      };
      setStoreFilters(LIST_KEY, filtersForStore);
      setStoreSearch(LIST_KEY, localSearchTerm);
      useListFilterStore.getState().setDisplayValues(LIST_KEY, {
        origin_name: filtersForStore.origin ? nextOriginLabel : null,
        destination_name: filtersForStore.destination
          ? nextDestinationLabel
          : null,
        carrier_name: filtersForStore.carrier_name ? nextCarrierLabel : null,
        carrier_code: filtersForStore.carrier_name ? nextCarrierCode : null,
      });
    },
    [
      appliedFilters,
      filterForm,
      localSearchTerm,
      originDisplayValue,
      destinationDisplayValue,
      carrierDisplayValue,
      setStoreFilters,
      setStoreSearch,
    ],
  );

  const freightHeaderFilterValues: TariffHeaderFilterValues = useMemo(
    () => ({
      origin: filterForm.values.origin ?? "",
      destination: filterForm.values.destination ?? "",
      service: filterForm.values.service ?? "",
      tariff_code: filterForm.values.tariff_code ?? "",
      carrier_name: filterForm.values.carrier_name ?? "",
      valid_from: filterForm.values.valid_from
        ? dayjs(filterForm.values.valid_from).format("YYYY-MM-DD")
        : "",
      valid_to: filterForm.values.valid_to
        ? dayjs(filterForm.values.valid_to).format("YYYY-MM-DD")
        : "",
    }),
    [
      filterForm.values.origin,
      filterForm.values.destination,
      filterForm.values.service,
      filterForm.values.tariff_code,
      filterForm.values.carrier_name,
      filterForm.values.valid_from,
      filterForm.values.valid_to,
    ],
  );

  const freightHeaderRenderInput = useMemo<
    Record<string, TariffHeaderRenderInput>
  >(
    () => ({
      origin: ({ autoFocus, onClose }) => (
        <SearchableSelect
          autoFocus={autoFocus}
          size="xs"
          placeholder="Type Origin Code"
          apiEndpoint={URL.portMaster}
          searchFields={["port_name", "port_code"]}
          displayFormat={(item: Record<string, unknown>) => ({
            value: String(item.port_code),
            label: `${item.port_name} (${item.port_code})`,
          })}
          value={filterForm.values.origin}
          displayValue={originDisplayValue}
          dropdownZIndex={1000}
          onChange={(value, selected) => {
            const label = selected?.label
              ? parseCarrierNameFromLabel(selected.label)
              : null;
            handleHeaderFilterChange("origin", value ?? "", label);
            if (value) onClose();
          }}
          minSearchLength={2}
          classNames={erpListGeistSelectClassNames}
          styles={erpListFilterUnifiedMantineStyles(erpTheme)}
        />
      ),
      destination: ({ autoFocus, onClose }) => (
        <SearchableSelect
          autoFocus={autoFocus}
          size="xs"
          placeholder="Type Destination Code"
          apiEndpoint={URL.portMaster}
          searchFields={["port_name", "port_code"]}
          displayFormat={(item: Record<string, unknown>) => ({
            value: String(item.port_code),
            label: `${item.port_name} (${item.port_code})`,
          })}
          value={filterForm.values.destination}
          displayValue={destinationDisplayValue}
          dropdownZIndex={1000}
          onChange={(value, selected) => {
            const label = selected?.label
              ? parseCarrierNameFromLabel(selected.label)
              : null;
            handleHeaderFilterChange("destination", value ?? "", label);
            if (value) onClose();
          }}
          minSearchLength={2}
          classNames={erpListGeistSelectClassNames}
          styles={erpListFilterUnifiedMantineStyles(erpTheme)}
        />
      ),
      service: ({ autoFocus, onClose }) => (
        <Select
          autoFocus={autoFocus}
          size="xs"
          placeholder="Select Service"
          data={serviceOptions}
          value={filterForm.values.service}
          onChange={(value) => {
            handleHeaderFilterChange("service", value ?? "");
            if (value) onClose();
          }}
          searchable
          clearable
          comboboxProps={{ zIndex: 1000 }}
          classNames={erpListGeistSelectClassNames}
          styles={erpListFilterUnifiedMantineStyles(erpTheme)}
        />
      ),
      carrier_name: ({ autoFocus, onClose }) => (
        <SearchableSelect
          autoFocus={autoFocus}
          size="xs"
          placeholder="Type carrier name"
          apiEndpoint={URL.carrier}
          searchFields={["carrier_name", "carrier_code"]}
          displayFormat={carrierNameValueDisplayFormat}
          value={filterForm.values.carrier_name}
          displayValue={carrierDisplayValue}
          dropdownZIndex={1000}
          additionalParams={carrierTransportParamsFromService(
            filterForm.values.service,
          )}
          onChange={(value, selected, original) => {
            const label = selected?.label
              ? parseCarrierNameFromLabel(selected.label)
              : null;
            const code =
              typeof original?.carrier_code === "string"
                ? (original.carrier_code as string)
                : null;
            handleHeaderFilterChange(
              "carrier_name",
              value ?? "",
              label,
              { carrier_code: code },
            );
            if (value) onClose();
          }}
          minSearchLength={2}
          classNames={erpListGeistSelectClassNames}
          styles={erpListFilterUnifiedMantineStyles(erpTheme)}
        />
      ),
      valid_from: ({ onClose }) => (
        <SingleDateInput
          size="xs"
          placeholder="YYYY-MM-DD"
          value={filterForm.values.valid_from}
          onChange={(v) => {
            const str = v ? dayjs(v).format("YYYY-MM-DD") : "";
            handleHeaderFilterChange("valid_from", str);
            if (v) onClose();
          }}
          classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
          styles={erpListFilterUnifiedMantineStyles(erpTheme)}
        />
      ),
      valid_to: ({ onClose }) => (
        <SingleDateInput
          size="xs"
          placeholder="YYYY-MM-DD"
          value={filterForm.values.valid_to}
          onChange={(v) => {
            const str = v ? dayjs(v).format("YYYY-MM-DD") : "";
            handleHeaderFilterChange("valid_to", str);
            if (v) onClose();
          }}
          classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
          styles={erpListFilterUnifiedMantineStyles(erpTheme)}
        />
      ),
    }),
    [
      filterForm.values.origin,
      filterForm.values.destination,
      filterForm.values.service,
      filterForm.values.carrier_name,
      filterForm.values.valid_from,
      filterForm.values.valid_to,
      originDisplayValue,
      destinationDisplayValue,
      carrierDisplayValue,
      serviceOptions,
      handleHeaderFilterChange,
      erpTheme,
    ],
  );

  /** Collapsed header chips: SearchableSelects show friendly names; dates use user's `dateFormat`. */
  const freightHeaderDisplayFormatter = useMemo<
    Record<string, (value: string) => string>
  >(
    () => ({
      origin: (raw) => (raw ? originDisplayValue ?? raw : ""),
      destination: (raw) => (raw ? destinationDisplayValue ?? raw : ""),
      carrier_name: (raw) => (raw ? carrierDisplayValue ?? raw : ""),
      valid_from: (raw) => (raw ? dayjs(raw).format(dateFormat) : ""),
      valid_to: (raw) => (raw ? dayjs(raw).format(dateFormat) : ""),
    }),
    [originDisplayValue, destinationDisplayValue, carrierDisplayValue, dateFormat],
  );

  const freightHeaderFiltersProp: TariffHeaderFiltersProp = useMemo(
    () => ({
      values: freightHeaderFilterValues,
      onChange: (key, value) => handleHeaderFilterChange(key, value),
      renderInput: freightHeaderRenderInput,
      displayFormatter: freightHeaderDisplayFormatter,
    }),
    [
      freightHeaderFilterValues,
      freightHeaderRenderInput,
      freightHeaderDisplayFormatter,
      handleHeaderFilterChange,
    ],
  );

  const renderFreightActions = useCallback(
    (row: Freight) => (
      <Menu withinPortal position="bottom-end" shadow="sm" radius="md">
        <Menu.Target>
          <ActionIcon variant="subtle" color="gray" aria-label="Row actions">
            <IconDotsVertical size={16} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Box px={10} py={5}>
            <UnstyledButton
              onClick={() => {
                preserveListState();
                navigate("/tariff/freight/create", {
                  state: { ...row, actionType: "view" },
                });
              }}
            >
              <Group gap="sm">
                <IconEye size={16} style={{ color: primary }} />
                <Text size="sm">View</Text>
              </Group>
            </UnstyledButton>
          </Box>
          {user?.is_staff ? (
            <>
              <Menu.Divider />
              <Box px={10} py={5}>
                <UnstyledButton
                  onClick={() => {
                    preserveListState();
                    navigate("/tariff/freight/create", {
                      state: { ...row, actionType: "edit" },
                    });
                  }}
                >
                  <Group gap="sm">
                    <IconEdit size={16} style={{ color: primary }} />
                    <Text size="sm">Edit</Text>
                  </Group>
                </UnstyledButton>
              </Box>
            </>
          ) : null}
        </Menu.Dropdown>
      </Menu>
    ),
    [navigate, user?.is_staff, primary, preserveListState]
  );

  const freightListColumns = useMemo<TariffListColumn<Freight>[]>(
    () => [
      {
        id: "tariff_code",
        header: "Tariff Code",
        cellMaxWidth: 180,
        filterKey: "tariff_code",
        filterPlaceholder: "Tariff Code",
        filterMinWidth: 140,
        cell: (r) => {
          const v = r.tariff_code ?? "—";
          return (
            <Text
              size="sm"
              c={fg}
              lineClamp={1}
              style={{ fontFamily: fontSans, cursor: "default" }}
              title={v}
              >
              {v}
            </Text>
          );
        },
      },
      {
        id: "origin",
        header: "Origin",
        cellMaxWidth: 200,
        filterKey: "origin",
        filterPlaceholder: "Origin",
        filterMinWidth: 180,
        cell: (r) => {
          const name = r.origin_name ?? "";
          const code = r.origin_code ?? "";
          const v = name
            ? code
              ? `${name} (${code})`
              : name
            : code || "—";
          return (
            <Tooltip
              label={v}
              withArrow
              styles={{ tooltip: { fontFamily: fontSans, fontSize: 12 } }}
            >
              <Text
                component="span"
                fw={600}
                size="sm"
                c={primary}
                lineClamp={1}
                style={{ fontFamily: fontSans, cursor: "default" }}
              >
                {v}
              </Text>
            </Tooltip>
          );
        },
      },
      {
        id: "destination",
        header: "Destination",
        cellMaxWidth: 200,
        filterKey: "destination",
        filterPlaceholder: "Destination",
        filterMinWidth: 180,
        cell: (r) => {
          const name = r.destination_name ?? "";
          const code = r.destination_code ?? "";
          const v = name
            ? code
              ? `${name} (${code})`
              : name
            : code || "—";
          return (
            <Tooltip
              label={v}
              withArrow
              styles={{ tooltip: { fontFamily: fontSans, fontSize: 12 } }}
            >
              <Text
                component="span"
                fw={500}
                size="sm"
                c={fg}
                lineClamp={1}
                style={{ fontFamily: fontSans, cursor: "default" }}
              >
                {v}
              </Text>
            </Tooltip>
          );
        },
      },
      {
        id: "carrier",
        header: "Carrier Name",
        cellMaxWidth: 240,
        filterKey: "carrier_name",
        filterPlaceholder: "Carrier",
        filterMinWidth: 200,
        cell: (r) => {
          const charges = r.tariff_charges || [];
          if (charges.length === 0) {
            return (
              <Text size="sm" c={fg} style={{ fontFamily: fontSans }}>
                —
              </Text>
            );
          }
          const uniqueCarriers = [
            ...new Set(
              charges.map(
                (c: { carrier_name?: string }) => c.carrier_name,
              ),
            ),
          ].filter(Boolean);
          const raw = uniqueCarriers.join(", ");
          return (
            <Tooltip
              label={raw || "—"}
              withArrow
              multiline
              w={320}
              position="top"
              styles={{ tooltip: { fontFamily: fontSans, fontSize: 12 } }}
            >
              <Text
                size="sm"
                c={fg}
                lineClamp={2}
                style={{ fontFamily: fontSans, cursor: "default" }}
              >
                {raw || "—"}
              </Text>
            </Tooltip>
          );
        },
      },
      {
        id: "service",
        header: "Service",
        filterKey: "service",
        filterPlaceholder: "Service",
        filterMinWidth: 110,
        cell: (r) => (
          <Text size="sm" c={fg} style={{ fontFamily: fontSans }}>
            {r.service ?? "—"}
          </Text>
        ),
      },
      {
        id: "valid_from",
        header: "Valid From",
        cellTone: "muted",
        filterKey: "valid_from",
        filterPlaceholder: "Valid From",
        filterMinWidth: 140,
        cell: (r) => (
          <Text size="sm" c={muted} style={{ fontFamily: fontSans }}>
            {r.valid_from ? dayjs(r.valid_from).format(dateFormat) : "—"}
          </Text>
        ),
      },
      {
        id: "valid_to",
        header: "Valid To",
        cellTone: "muted",
        filterKey: "valid_to",
        filterPlaceholder: "Valid To",
        filterMinWidth: 140,
        cell: (r) => (
          <Text size="sm" c={muted} style={{ fontFamily: fontSans }}>
            {r.valid_to ? dayjs(r.valid_to).format(dateFormat) : "—"}
          </Text>
        ),
      },
    ],
    [dateFormat, fg, fontSans, muted, primary]
  );

  const applyFilters = async () => {
    try {
      console.log("Applying filters...");
      console.log("Current filters:", filterForm.values);

      // Check if there are any actual filter values (excluding date range which is handled separately)
      const hasFilterValues =
        filterForm.values.origin ||
        filterForm.values.destination ||
        filterForm.values.service ||
        filterForm.values.tariff_code ||
        filterForm.values.carrier_name ||
        filterForm.values.valid_from ||
        filterForm.values.valid_to;

      if (!hasFilterValues) {
        // If no filter values, show unfiltered data
        setAppliedFilters({
          origin: null,
          destination: null,
          service: null,
          tariff_code: null,
          carrier_name: null,
          carrier_code: null,
          valid_from: null,
          valid_to: null,
        });

        // Reset to first page — clearing filters changes `appliedFiltersKey`
        // which automatically triggers the unified query to refetch with the
        // new (empty) payload. No manual invalidation/refetch is needed.
        setCurrentPage(1);
        clearStoreFilters(LIST_KEY);

        ToastNotification({
          type: "info",
          message: "No filters selected, showing all data",
        });
        return;
      }

      // Store the current filter form values as applied filters
      setAppliedFilters({
        origin: filterForm.values.origin,
        destination: filterForm.values.destination,
        service: filterForm.values.service,
        tariff_code: filterForm.values.tariff_code,
        carrier_name: filterForm.values.carrier_name,
        carrier_code: filterForm.values.carrier_code,
        valid_from: filterForm.values.valid_from,
        valid_to: filterForm.values.valid_to,
      });
      setStoreFilters(LIST_KEY, {
        ...filterForm.values,
      });
      setStoreSearch(LIST_KEY, localSearchTerm);
      useListFilterStore.getState().setDisplayValues(LIST_KEY, {
        origin_name: filterForm.values.origin ? originDisplayValue : null,
        destination_name: filterForm.values.destination
          ? destinationDisplayValue
          : null,
        carrier_name: filterForm.values.carrier_name
          ? carrierDisplayValue
          : null,
        carrier_code: filterForm.values.carrier_name
          ? filterForm.values.carrier_code
          : null,
      });

      // Reset to first page when applying filters. The unified query's
      // `queryKey` includes `appliedFiltersKey` and `currentPage`, so the
      // state updates above are sufficient to trigger a refetch.
      setCurrentPage(1);
      setShowFilters(false);
    } catch (error) {
      console.error("Error applying filters:", error);
    }
  };

  const clearAllFilters = async () => {
    setShowFilters(false);
    filterForm.reset(); // Reset form to initial values

    // Reset applied filters state
    setAppliedFilters({
      origin: null,
      destination: null,
      service: null,
      tariff_code: null,
      carrier_name: null,
      carrier_code: null,
      valid_from: null,
      valid_to: null,
    });

    // Clear display values
    setOriginDisplayValue(null);
    setDestinationDisplayValue(null);
    setCarrierDisplayValue(null);

    // Reset to first page. Clearing `appliedFilters` invalidates the unified
    // query's key automatically, so the table refetches with empty filters
    // and the loader shows for the duration of the request.
    setCurrentPage(1);
    clearStoreFilters(LIST_KEY);
    useListFilterStore.getState().setDisplayValues(LIST_KEY, {
      origin_name: null,
      destination_name: null,
      carrier_name: null,
      carrier_code: null,
    });

    ToastNotification({
      type: "success",
      message: "All filters cleared successfully",
    });
  };

  // Handle page size change
  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // Reset to first page when changing page size
  };

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalRecords, pageSize, currentPage]);

  return (
    <>
      <MantineProvider theme={erpListGeistMantineTheme}>
        <Box
          className={ERP_LIST_GEIST_ROOT_CLASS}
          style={{
            ...erpListGeistRootTypography,
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <ERPListScreen
            theme={erpTheme}
            className={ERP_LIST_GEIST_ROOT_CLASS}
            toolbar={{
              leading: (
                <>
                  <ERPListStatPill
                    theme={erpTheme}
                    icon={<IconListDetails size={14} color={primary} />}
                    value={totalRecords}
                    label="Total"
                  />

                </>
              ),
              secondary: (
                <Text fw={600} size="sm" c={fg} style={{ fontFamily: fontSans }}>
                  List of Freights
                </Text>
              ),
              actions: (
                <>
                  <TextInput
                    placeholder="Search freights"
                    leftSection={<IconSearch size={16} />}
                    rightSection={
                      localSearchTerm ? (
                        <ActionIcon
                          variant="transparent"
                          size="sm"
                          aria-label="Clear search"
                          onClick={() => setLocalSearchTerm("")}
                          style={{ cursor: "pointer" }}
                        >
                          <IconX size={16} />
                        </ActionIcon>
                      ) : null
                    }
                    w={260}
                    size="xs"
                    value={localSearchTerm}
                    onChange={(e) => setLocalSearchTerm(e.currentTarget.value)}
                    disabled={isLoading}
                    classNames={{ input: ERP_LIST_GEIST_ROOT_CLASS }}
                    styles={{
                      input: {
                        fontFamily: fontSans,
                        fontSize: 12,
                        height: 32,
                        borderColor: border,
                      },
                    }}
                  />
                  <Button
                    variant="default"
                    size="xs"
                    styles={erpToolbarOutlineButtonStyles(erpTheme)}
                    leftSection={<IconFilter size={14} />}
                    onClick={() => setShowFilters((s) => !s)}
                  >
                    {showFilters ? "Hide filters" : "Filters"}
                  </Button>
                  {user?.is_staff ? (
                    <Button
                      size="xs"
                      leftSection={<IconPlus size={14} />}
                      styles={erpToolbarPrimaryButtonStyles(erpTheme)}
                      onClick={() => {
                        preserveListState();
                        navigate("/tariff/freight/create");
                      }}
                    >
                      Create New
                    </Button>
                  ) : null}
                </>
              ),
            }}
            filters={{
              opened: showFilters,
              title: "Filters",
              subtitle: "Refine by origin, destination, service, or validity dates",
              onClose: () => setShowFilters(false),
              footer: (
                <ERPListFilterActionsFooter
                  theme={erpTheme}
                  onClear={() => {
                    void clearAllFilters();
                  }}
                  onApply={() => {
                    void applyFilters();
                  }}
                  applyLoading={isLoading}
                  applyDisabled={isLoading}
                />
              ),
              children: (
                <Grid gutter={{ base: "md", md: "lg" }} align="stretch">
                  <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_FIFTHS}>
                    <Box style={erpListFilterFieldCellStyle}>
                    <SearchableSelect
                      dropdownZIndex={1000}
                      size="xs"
                      label="Origin"
                      placeholder="Type Origin Code"
                      apiEndpoint={URL.portMaster}
                      searchFields={["port_name", "port_code"]}
                      displayFormat={(item: Record<string, unknown>) => ({
                        value: String(item.port_code),
                        label: `${item.port_name} (${item.port_code})`,
                      })}
                      value={filterForm.values.origin}
                      displayValue={originDisplayValue}
                      onChange={(value, selectedData) => {
                        filterForm.setFieldValue("origin", value || null);
                        setOriginDisplayValue(selectedData?.label || null);
                      }}
                      minSearchLength={3}
                      classNames={erpListGeistSelectClassNames}
                      styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                      className="filter-searchable-select"
                    />
                    </Box>
                  </Grid.Col>
                  <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_FIFTHS}>
                    <Box style={erpListFilterFieldCellStyle}>
                    <SearchableSelect
                      dropdownZIndex={1000}
                      size="xs"
                      label="Destination"
                      placeholder="Type Destination Code"
                      apiEndpoint={URL.portMaster}
                      searchFields={["port_name", "port_code"]}
                      displayFormat={(item: Record<string, unknown>) => ({
                        value: String(item.port_code),
                        label: `${item.port_name} (${item.port_code})`,
                      })}
                      value={filterForm.values.destination}
                      displayValue={destinationDisplayValue}
                      onChange={(value, selectedData) => {
                        filterForm.setFieldValue("destination", value || null);
                        setDestinationDisplayValue(selectedData?.label || null);
                      }}
                      minSearchLength={3}
                      classNames={erpListGeistSelectClassNames}
                      styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                      className="filter-searchable-select"
                    />
                    </Box>
                  </Grid.Col>
                  <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_FIFTHS}>
                    <Box style={erpListFilterFieldCellStyle}>
                    <SearchableSelect
                      dropdownZIndex={1000}
                      size="xs"
                      label="Carrier Name"
                      placeholder="Type carrier name"
                      apiEndpoint={URL.carrier}
                      searchFields={["carrier_name", "carrier_code"]}
                      displayFormat={carrierNameValueDisplayFormat}
                      value={filterForm.values.carrier_name}
                      displayValue={carrierDisplayValue}
                      onChange={(value, selectedData, originalData) => {
                        filterForm.setFieldValue("carrier_name", value || null);
                        setCarrierDisplayValue(parseCarrierNameFromLabel(selectedData?.label || "") || null);
                        const code =
                          typeof originalData?.carrier_code === "string"
                            ? (originalData.carrier_code as string)
                            : null;
                        filterForm.setFieldValue(
                          "carrier_code",
                          value ? code : null,
                        );
                      }}
                      minSearchLength={2}
                      additionalParams={carrierTransportParamsFromService(
                        filterForm.values.service,
                      )}
                      classNames={erpListGeistSelectClassNames}
                      styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                      className="filter-searchable-select"
                    />
                    </Box>
                  </Grid.Col>
                  <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_FIFTHS}>
                    <Box style={erpListFilterFieldCellStyle}>
                    <Select
                      key={`service-${filterForm.values.service}`}
                      label="Service"
                      placeholder="Select Service"
                      searchable
                      clearable
                      size="xs"
                      data={serviceOptions}
                      value={filterForm.values.service}
                      onChange={(value) =>
                        filterForm.setFieldValue("service", value || null)
                      }
                      onFocus={(event) => {
                        const input = event.target as HTMLInputElement;
                        if (input && input.value) {
                          input.select();
                        }
                      }}
                      classNames={erpListGeistSelectClassNames}
                      styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                    />
                    </Box>
                  </Grid.Col>
                  <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_FIFTHS}>
                    <Box style={erpListFilterFieldCellStyle}>
                      <TextInput
                        label="Tariff Code"
                        placeholder="Type tariff code"
                        size="xs"
                        value={filterForm.values.tariff_code ?? ""}
                        onChange={(e) =>
                          filterForm.setFieldValue(
                            "tariff_code",
                            e.currentTarget.value || null,
                          )
                        }
                        classNames={{ input: ERP_LIST_GEIST_ROOT_CLASS }}
                        styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                      />
                    </Box>
                  </Grid.Col>
                  <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_FIFTHS}>
                    <Box style={erpListFilterFieldCellStyle}>
                    <SingleDateInput
                      key={`valid-from-${filterForm.values.valid_from}`}
                      label="Valid From"
                      placeholder="YYYY-MM-DD"
                      size="xs"
                      value={filterForm.values.valid_from}
                      onChange={(v) => filterForm.setFieldValue("valid_from", v)}
                      classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                      styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                    />
                    </Box>
                  </Grid.Col>
                  <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_FIFTHS}>
                    <Box style={erpListFilterFieldCellStyle}>
                    <SingleDateInput
                      key={`valid-to-${filterForm.values.valid_to}`}
                      label="Valid To"
                      placeholder="YYYY-MM-DD"
                      size="xs"
                      value={filterForm.values.valid_to}
                      onChange={(v) => filterForm.setFieldValue("valid_to", v)}
                      classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                      styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                    />
                    </Box>
                  </Grid.Col>
                </Grid>
              ),
            }}
            table={{
              footer: (
                <ERPListPaginationFooter
                  theme={erpTheme}
                  totalRecords={totalRecords}
                  pageIndex={currentPage - 1}
                  pageSize={pageSize}
                  onPageIndexChange={(idx) => setCurrentPage(idx + 1)}
                  onPageSizeChange={handlePageSizeChange}
                  pageSizeOptions={["10", "25", "50"]}
                  selectClassNames={erpListGeistSelectClassNames}
                />
              ),
              children: (
                <Box
                  style={{
                    flex: 1,
                    minHeight: 0,
                    overflow: "auto",
                    WebkitOverflowScrolling: "touch",
                  }}
                >
                  <TariffMasterListNativeTable
                    theme={erpTheme}
                    rows={displayData as Freight[]}
                    getRowKey={(row) => String(row.id)}
                    getSno={(_row, index) =>
                      (currentPage - 1) * pageSize + index + 1
                    }
                    columns={freightListColumns}
                    isEmpty={(displayData as Freight[]).length === 0}
                    emptyIcon={<IconTruck size={24} color={erpTheme.muted} />}
                    emptyTitle="No freight records"
                    renderActions={renderFreightActions}
                    headerFilters={freightHeaderFiltersProp}
                    loading={isLoading}
                    loadingMessage="Loading freight data…"
                  />
                </Box>
              ),
            }}
          />
          <Outlet />
        </Box>
      </MantineProvider>
    </>
  );
}
