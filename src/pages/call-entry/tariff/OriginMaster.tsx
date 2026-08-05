import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Center,
  Group,
  Menu,
  Modal,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
  Grid,
  MantineProvider,
} from "@mantine/core";
import {
  carrierDisplayFormat,
  carrierNameValueDisplayFormat,
  carrierTransportParamsFromService,
  formatCarrierDisplayValue,
  parseCarrierNameFromLabel,
} from "../../../utils/carrierSelect";
import {
  IconDotsVertical,
  IconEdit,
  IconEyeSpark,
  IconFilter,
  IconListDetails,
  IconListNumbers,
  IconMapPin,
  IconPlus,
  IconSearch,
  IconX,
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
  ERP_LIST_FILTER_FIELD_COL_SPAN_QUARTER,
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

type Origin = {
  id: number;
  origin_name: string;
  valid_from: string;
  valid_to: string;
  status?: string;
  tariff_charges?: any[];
  service?: string;
  tariff_code?: string;
};

type FilterState = {
  carrier_name: string | null;
  service: string | null;
  tariff_code: string | null;
  valid_from: Date | null;
  valid_to: Date | null;
};

const LIST_KEY = "ORIGIN_MASTER";

export default function OriginMaster() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const dateFormat = useDateFormat();

  // Initialize states from localStorage to persist across navigation
  const [showOriginModal, setShowOriginModal] = useState(() => {
    const hasSearchedBefore = localStorage.getItem("origin-has-searched");
    const currentName = localStorage.getItem("origin-current-name");
    // Only show modal if user hasn't searched before AND there's no current name
    return !hasSearchedBefore || !currentName;
  });

  const [originName, setOriginName] = useState("");
  const [selectedOriginData, setSelectedOriginData] = useState<{
    code: string;
    name: string;
  } | null>(null);
  const [currentOriginName, setCurrentOriginName] = useState(() => {
    return localStorage.getItem("origin-current-name") || "";
  });
  const [currentOriginCode, setCurrentOriginCode] = useState(() => {
    const storedCode = localStorage.getItem("origin-current-code") || "";
    const storedName = localStorage.getItem("origin-current-name") || "";

    // If code equals name, it's likely bad data - clear it
    if (storedCode && storedName && storedCode === storedName) {
      localStorage.removeItem("origin-current-code");
      return "";
    }

    return storedCode;
  });

  const [isModalLoading, setIsModalLoading] = useState(false);

  const [hasSearched, setHasSearched] = useState(() => {
    return !!localStorage.getItem("origin-has-searched");
  });

  const [searchError, setSearchError] = useState("");
  const [isChangeOriginMode, setIsChangeOriginMode] = useState(false); // Track if opened via "Change Origin"
  const [modalDisplayValue, setModalDisplayValue] = useState(""); // For SearchableSelect display in modal

  // Remove old state - now using memoized originData from useQuery

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
  const [carrierDisplayValue, setCarrierDisplayValue] = useState<string | null>(null);

  // Filter form to minimize state variables
  const filterForm = useForm<FilterState>({
    initialValues: {
      carrier_name: null,
      service: null,
      tariff_code: null,
      valid_from: null,
      valid_to: null,
    },
  });

  // State to store the actual applied filter values
  const [appliedFilters, setAppliedFilters] = useState<FilterState>({
    carrier_name: null,
    service: null,
    tariff_code: null,
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
   * `queryKey` includes every input that should trigger a refetch: the modal-
   * selected `currentOriginCode`, pagination, the applied filters object
   * (stringified for a stable structural key), and the debounced global
   * search. React Query natively re-runs the `queryFn` whenever any of these
   * change, so pagination, filter Apply, column-header filter changes and
   * global search all flow through a single fetch + a single `isFetching`
   * flag — no `useMemo` switching between two queries, and the loader always
   * reflects an in-flight refetch.
   */
  const appliedFiltersKey = useMemo(
    () =>
      JSON.stringify({
        carrier_name: appliedFilters.carrier_name,
        service: appliedFilters.service,
        tariff_code: appliedFilters.tariff_code,
        valid_from: appliedFilters.valid_from
          ? dayjs(appliedFilters.valid_from).format("YYYY-MM-DD")
          : null,
        valid_to: appliedFilters.valid_to
          ? dayjs(appliedFilters.valid_to).format("YYYY-MM-DD")
          : null,
      }),
    [appliedFilters],
  );

  const { data: originResult, isFetching: originFetching } = useQuery({
    queryKey: [
      "origin",
      currentOriginCode,
      currentPage,
      pageSize,
      appliedFiltersKey,
      debouncedSearch,
    ],
    queryFn: async () => {
      try {
        const payload: Record<string, unknown> = {};
        if (currentOriginCode) payload.origin_code = currentOriginCode;
        if (appliedFilters.carrier_name)
          payload.carrier_name = appliedFilters.carrier_name;
        if (appliedFilters.service) payload.service = appliedFilters.service;
        if (appliedFilters.tariff_code)
          payload.tariff_code = appliedFilters.tariff_code;
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
          `${URL.filter_origin}?index=${(currentPage - 1) * pageSize}&limit=${pageSize}`,
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
        console.error("Error fetching origin data:", error);
        return { data: [] as Origin[], total: 0 };
      }
    },
    // Modal-driven gating: only run when the user has selected an origin and
    // confirmed via the "Search" action. All other refetch triggers (filter
    // Apply, pagination, search) flow through the queryKey changes above.
    enabled: hasSearched && Boolean(currentOriginCode),
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  useEffect(() => {
    if (originResult && typeof originResult.total === "number") {
      setTotalRecords(originResult.total);
    }
  }, [originResult]);

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
      if (typeof restored.search === "string")
        setLocalSearchTerm(restored.search);
      // Rehydrate friendly carrier label.
      const restoredCarrierLabel = restored.displayValues?.carrier_name;
      if (
        typeof restoredCarrierLabel === "string" &&
        restoredCarrierLabel.trim() !== ""
      ) {
        setCarrierDisplayValue(restoredCarrierLabel);
      }
      // Restoring `appliedFilters`/`debouncedSearch` flips the unified query's
      // key, so the table will refetch with the restored values automatically.
      setCurrentPage(1);
      useListFilterStore.getState().setShouldRestore(LIST_KEY, false);
      hasRestoredFromStore.current = true;
    }
  }, [filterForm]);

  useEffect(() => {
    setStoreSearch(LIST_KEY, localSearchTerm);
    setCurrentPage(1);
  }, [debouncedSearch]);

  const displayData = (originResult?.data ?? []) as Origin[];
  // Single source of truth for the table loader: any in-flight refetch shows
  // the loader. Pagination, Apply, column-header filters and search all go
  // through React Query so this flag covers every refresh.
  const isLoading = originFetching;

  // Stable reference so the header-filter `renderInput` memo doesn't churn.
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
  // existing React Query refetches via its `queryKey`). No new API.
  const handleHeaderFilterChange = useCallback(
    (key: string, rawValue: string, displayLabel?: string | null) => {
      const next = rawValue || null;
      const newApplied: FilterState = { ...appliedFilters };
      let nextCarrierLabel = carrierDisplayValue;

      switch (key) {
        case "carrier_name":
          filterForm.setFieldValue("carrier_name", next);
          newApplied.carrier_name = next;
          nextCarrierLabel = next ? (displayLabel ?? null) : null;
          setCarrierDisplayValue(nextCarrierLabel);
          break;
        case "service":
          filterForm.setFieldValue("service", next);
          newApplied.service = next;
          break;
        case "tariff_code":
          filterForm.setFieldValue("tariff_code", next);
          newApplied.tariff_code = next;
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

      const filtersForStore: FilterState = {
        carrier_name:
          key === "carrier_name" ? next : filterForm.values.carrier_name,
        service: key === "service" ? next : filterForm.values.service,
        tariff_code:
          key === "tariff_code" ? next : filterForm.values.tariff_code,
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
        carrier_name: filtersForStore.carrier_name ? nextCarrierLabel : null,
      });
    },
    [
      appliedFilters,
      filterForm,
      localSearchTerm,
      carrierDisplayValue,
      setStoreFilters,
      setStoreSearch,
    ],
  );

  const originHeaderFilterValues: TariffHeaderFilterValues = useMemo(
    () => ({
      carrier_name: filterForm.values.carrier_name ?? "",
      service: filterForm.values.service ?? "",
      tariff_code: filterForm.values.tariff_code ?? "",
      valid_from: filterForm.values.valid_from
        ? dayjs(filterForm.values.valid_from).format("YYYY-MM-DD")
        : "",
      valid_to: filterForm.values.valid_to
        ? dayjs(filterForm.values.valid_to).format("YYYY-MM-DD")
        : "",
    }),
    [
      filterForm.values.carrier_name,
      filterForm.values.service,
      filterForm.values.tariff_code,
      filterForm.values.valid_from,
      filterForm.values.valid_to,
    ],
  );

  const originHeaderRenderInput = useMemo<
    Record<string, TariffHeaderRenderInput>
  >(
    () => ({
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
          onChange={(value, selected) => {
            const label = selected?.label
              ? parseCarrierNameFromLabel(selected.label)
              : null;
            handleHeaderFilterChange("carrier_name", value ?? "", label);
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
      filterForm.values.carrier_name,
      filterForm.values.service,
      filterForm.values.valid_from,
      filterForm.values.valid_to,
      carrierDisplayValue,
      serviceOptions,
      handleHeaderFilterChange,
      erpTheme,
    ],
  );

  const originHeaderDisplayFormatter = useMemo<
    Record<string, (value: string) => string>
  >(
    () => ({
      carrier_name: (raw) => (raw ? carrierDisplayValue ?? raw : ""),
      valid_from: (raw) => (raw ? dayjs(raw).format(dateFormat) : ""),
      valid_to: (raw) => (raw ? dayjs(raw).format(dateFormat) : ""),
    }),
    [carrierDisplayValue, dateFormat],
  );

  const originHeaderFiltersProp: TariffHeaderFiltersProp = useMemo(
    () => ({
      values: originHeaderFilterValues,
      onChange: (key, value) => handleHeaderFilterChange(key, value),
      renderInput: originHeaderRenderInput,
      displayFormatter: originHeaderDisplayFormatter,
    }),
    [
      originHeaderFilterValues,
      originHeaderRenderInput,
      originHeaderDisplayFormatter,
      handleHeaderFilterChange,
    ],
  );

  const renderOriginActions = useCallback(
    (row: Origin) => (
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
                navigate("/tariff/origin/create", {
                  state: { ...row, actionType: "view" },
                });
              }}
            >
              <Group gap="sm">
                <IconEyeSpark size={16} style={{ color: primary }} />
                <Text size="sm">View Origin</Text>
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
                    navigate("/tariff/origin/create", {
                      state: { ...row, actionType: "edit" },
                    });
                  }}
                >
                  <Group gap="sm">
                    <IconEdit size={16} style={{ color: primary }} />
                    <Text size="sm">Edit Origin</Text>
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

  const originListColumns = useMemo<TariffListColumn<Origin>[]>(
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
            ...new Set(charges.map((c: { carrier_name?: string }) => c.carrier_name)),
          ];
          const raw = uniqueCarriers.join(", ");
          return (
            <Tooltip
              label={raw}
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
                {raw}
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
    [dateFormat, fg, fontSans, muted]
  );

  const handleOriginSubmit = async () => {
    if (!originName.trim() || !selectedOriginData) {
      ToastNotification({
        type: "error",
        message: "Please select an origin from the dropdown",
      });
      return;
    }

    setIsModalLoading(true);
    setSearchError(""); // Clear previous errors

    try {
      // Use the port name from selected data (no additional API call needed)
      const originDisplayName = selectedOriginData.name;

      // Update current origin first
      setCurrentOriginName(originDisplayName);
      setCurrentOriginCode(selectedOriginData.code);
      setHasSearched(true);

      // Save to localStorage to persist across navigation - store both name and code
      localStorage.setItem("origin-has-searched", "true");
      localStorage.setItem("origin-current-name", originDisplayName);
      localStorage.setItem("origin-current-code", selectedOriginData.code);

      setShowOriginModal(false); // Close the modal
      setIsChangeOriginMode(false); // Reset change mode
      setHasSearched(true); // Mark that user has searched
      setCurrentPage(1);
      ToastNotification({
        type: "success",
        message: `Loading origins for: ${originDisplayName}`,
      });
    } catch (error) {
      setSearchError(
        `Error loading origins for "${originName}". Please try again.`
      );
      ToastNotification({
        type: "error",
        message: "Error loading origins",
      });
    } finally {
      setIsModalLoading(false);
    }
  };

  const handleChangeOrigin = () => {
    // Set the SearchableSelect value to the port CODE, not name
    setOriginName(currentOriginCode || currentOriginName);
    setSearchError("");

    // Use stored data to show formatted display (no API call needed)
    if (
      currentOriginName &&
      currentOriginCode &&
      currentOriginCode !== currentOriginName
    ) {
      // We have both name and a valid code (different from name)
      setModalDisplayValue(`${currentOriginName} (${currentOriginCode})`);
      setSelectedOriginData({
        code: currentOriginCode,
        name: currentOriginName,
      });
    } else if (currentOriginName) {
      // Fallback: if code is missing or same as name, just show name
      // This forces user to select again to get proper code
      setModalDisplayValue(currentOriginName);
      setSelectedOriginData({
        code: currentOriginName,
        name: currentOriginName,
      });
    }

    setShowOriginModal(true);
    setIsChangeOriginMode(true);
  };

  // Only show modal initially, not on every render
  const shouldShowModal = showOriginModal;

  const applyFilters = async () => {
    try {
      console.log("Applying filters...");
      console.log("Current filters:", filterForm.values);

      // Check if there are any actual filter values (excluding date range which is handled separately)
      const hasFilterValues =
        filterForm.values.carrier_name ||
        filterForm.values.service ||
        filterForm.values.tariff_code ||
        filterForm.values.valid_from ||
        filterForm.values.valid_to;

      if (!hasFilterValues) {
        // If no filter values, show unfiltered data — clearing
        // `appliedFilters` flips `appliedFiltersKey` and the unified query
        // refetches automatically with empty filters.
        setAppliedFilters({
          carrier_name: null,
          service: null,
          tariff_code: null,
          valid_from: null,
          valid_to: null,
        });
        clearStoreFilters(LIST_KEY);
        ToastNotification({
          type: "info",
          message: "No filters selected, showing all data",
        });
        return;
      }

      // Store the current filter form values as applied filters. The unified
      // query's `queryKey` includes `appliedFiltersKey` and `currentPage`, so
      // the state updates here are sufficient to trigger a refetch.
      setAppliedFilters({
        carrier_name: filterForm.values.carrier_name,
        service: filterForm.values.service,
        tariff_code: filterForm.values.tariff_code,
        valid_from: filterForm.values.valid_from,
        valid_to: filterForm.values.valid_to,
      });
      setStoreFilters(LIST_KEY, { ...filterForm.values });
      setStoreSearch(LIST_KEY, localSearchTerm);
      useListFilterStore.getState().setDisplayValues(LIST_KEY, {
        carrier_name: filterForm.values.carrier_name
          ? carrierDisplayValue
          : null,
      });
      setCurrentPage(1);
      setShowFilters(false);
    } catch (error) {
      console.error("Error applying filters:", error);
    }
  };

  const clearAllFilters = async () => {
    setShowFilters(false);
    filterForm.reset(); // Reset form to initial values

    // Reset applied filters — flips `appliedFiltersKey` so the unified query
    // automatically refetches unfiltered data with the loader visible.
    setAppliedFilters({
      carrier_name: null,
      service: null,
      tariff_code: null,
      valid_from: null,
      valid_to: null,
    });

    // Clear display values
    setCarrierDisplayValue(null);
    clearStoreFilters(LIST_KEY);
    useListFilterStore.getState().setDisplayValues(LIST_KEY, {
      carrier_name: null,
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
      {/* Origin Name Modal */}
      <Modal
        opened={shouldShowModal}
        onClose={() => {
          if (isChangeOriginMode) {
            setShowOriginModal(false);
            setIsChangeOriginMode(false);
          }
        }}
        title={hasSearched ? "Change Origin Name" : "Enter Origin Name"}
        centered={false}
        yOffset={100}
        closeOnClickOutside={isChangeOriginMode} // Enable outside click to close only in change mode
        closeOnEscape={isChangeOriginMode} // Enable escape to close only in change mode
        withCloseButton={isChangeOriginMode} // Show close button only in change mode
        size="md"
      >
        <Box p="sm">
          <Text size="sm" mb="md" c="dimmed">
            {hasSearched
              ? "Enter a different origin name to change the current filter."
              : "Please enter the origin name to view the list of origins."}
          </Text>

          <Box mb="lg">
            <SearchableSelect
              dropdownZIndex={1000}
              label="Origin Name"
              placeholder="Type origin port name"
              apiEndpoint={URL.portMaster}
              searchFields={["port_name", "port_code"]}
              displayFormat={(item: any) => ({
                value: String(item.port_code),
                label: `${item.port_name} (${item.port_code})`,
              })}
              value={originName}
              displayValue={modalDisplayValue}
              onChange={(value, selectedData) => {
                setOriginName(value || "");
                setModalDisplayValue(selectedData?.label || "");
                if (selectedData) {
                  setSelectedOriginData({
                    code: selectedData.value,
                    name: selectedData.label.split(" (")[0],
                  });
                } else {
                  setSelectedOriginData(null);
                }
              }}
              minSearchLength={2}
              required
              disabled={isModalLoading}
            />
          </Box>

          {searchError && (
            <Text color="red" size="sm" mb="lg">
              {searchError}
            </Text>
          )}

          <Group justify="flex-end">
            {!isChangeOriginMode && (
              <Button
                variant="outline"
                onClick={() => navigate(-1)}
                disabled={isModalLoading}
              >
                Cancel
              </Button>
            )}

            <Group>
              {isChangeOriginMode && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowOriginModal(false);
                    setIsChangeOriginMode(false);
                    setOriginName(""); // Clear the input
                    setSearchError(""); // Clear any errors
                  }}
                  disabled={isModalLoading}
                >
                  Cancel
                </Button>
              )}
              <Button
                onClick={() => handleOriginSubmit()}
                loading={isModalLoading}
                disabled={!originName.trim() || isModalLoading}
                color="#105476"
              >
                {isChangeOriginMode ? "Change" : "Submit"}
              </Button>
            </Group>
          </Group>
        </Box>
      </Modal>

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
                <Group gap="xs" wrap="nowrap" align="center">
                  <Text fw={600} size="sm" c={fg} style={{ fontFamily: fontSans }}>
                    List of Origin
                  </Text>
                  {currentOriginName ? (
                    <>
                      <Text fw={600} size="sm" c={fg} style={{ fontFamily: fontSans }}>
                        for:
                      </Text>
                      <Badge variant="light" color="#105476" size="md">
                        {currentOriginName}
                      </Badge>
                    </>
                  ) : null}
                </Group>
              ),
              actions: (
                <>
                  <TextInput
                    placeholder="Search carriers and fields"
                    leftSection={<IconSearch size={16} />}
                    rightSection={
                      localSearchTerm ? (
                        <ActionIcon
                          variant="transparent"
                          size="sm"
                          aria-label="Clear search"
                          onClick={() => {
                            // Clearing search updates `debouncedSearch` (after
                            // 1000ms) which is part of the unified query's
                            // key — the table refetches automatically.
                            setLocalSearchTerm("");
                            clearStoreSearch(LIST_KEY);
                            setCurrentPage(1);
                          }}
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
                    disabled={!hasSearched || isLoading}
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
                  {hasSearched ? (
                    <Button
                      variant="default"
                      size="xs"
                      styles={erpToolbarOutlineButtonStyles(erpTheme)}
                      leftSection={<IconFilter size={14} />}
                      onClick={() => setShowFilters((s) => !s)}
                    >
                      {showFilters ? "Hide filters" : "Filters"}
                    </Button>
                  ) : null}
                  {hasSearched ? (
                    <Button
                      variant="default"
                      size="xs"
                      styles={erpToolbarOutlineButtonStyles(erpTheme)}
                      onClick={handleChangeOrigin}
                    >
                      Change Origin
                    </Button>
                  ) : null}
                  {user?.is_staff ? (
                    <Button
                      size="xs"
                      leftSection={<IconPlus size={14} />}
                      styles={erpToolbarPrimaryButtonStyles(erpTheme)}
                      onClick={() => {
                        preserveListState();
                        navigate("/tariff/origin/create");
                      }}
                    >
                      Create New
                    </Button>
                  ) : null}
                </>
              ),
            }}
            filters={
              hasSearched
                ? {
                    opened: showFilters,
                    title: "Filters",
                    subtitle: "Carrier, service, or validity dates",
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
                        <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_QUARTER}>
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
                            onChange={(value, selectedData) => {
                              filterForm.setFieldValue("carrier_name", value || null);
                              setCarrierDisplayValue(parseCarrierNameFromLabel(selectedData?.label || "") || null);
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
                        <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_QUARTER}>
                          <Box style={erpListFilterFieldCellStyle}>
                          <Select
                            key={`service-${filterForm.values.service}`}
                            label="Service"
                            placeholder="Select Service"
                            searchable
                            clearable
                            size="xs"
                            data={serviceOptions}
                            {...filterForm.getInputProps("service")}
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
                        <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_QUARTER}>
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
                        <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_QUARTER}>
                          <Box style={erpListFilterFieldCellStyle}>
                          <SingleDateInput
                            key={`valid-from-${filterForm.values.valid_from}`}
                            label="Valid From"
                            placeholder="YYYY-MM-DD"
                            size="xs"
                            value={filterForm.values.valid_from}
                            onChange={(v) =>
                              filterForm.setFieldValue("valid_from", v)
                            }
                            classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                            styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                          />
                          </Box>
                        </Grid.Col>
                        <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_QUARTER}>
                          <Box style={erpListFilterFieldCellStyle}>
                          <SingleDateInput
                            key={`valid-to-${filterForm.values.valid_to}`}
                            label="Valid To"
                            placeholder="YYYY-MM-DD"
                            size="xs"
                            value={filterForm.values.valid_to}
                            onChange={(v) =>
                              filterForm.setFieldValue("valid_to", v)
                            }
                            classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                            styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                          />
                          </Box>
                        </Grid.Col>
                      </Grid>
                    ),
                  }
                : null
            }
            table={{
              footer: hasSearched ? (
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
              ) : undefined,
              children: !hasSearched ? (
                <Center py={60} style={{ backgroundColor: erpTheme.cardBg }}>
                  <Text size="sm" c="dimmed" style={{ fontFamily: fontSans }} ta="center" maw={360}>
                    Select an origin port in the dialog to load tariff lines for that location.
                  </Text>
                </Center>
              ) : !isLoading &&
                (displayData as Origin[]).length === 0 &&
                !(
                  appliedFilters.carrier_name ||
                  appliedFilters.service ||
                  appliedFilters.tariff_code ||
                  appliedFilters.valid_from ||
                  appliedFilters.valid_to
                ) &&
                debouncedSearch.trim() === "" ? (
                // Pristine "no rows for this origin" state — show the
                // "Try Different Origin" button to allow re-picking. When the
                // user is mid-typing in column header filters we keep the
                // table (and header filters) mounted instead.
                <Center py="xl" style={{ backgroundColor: erpTheme.cardBg, flex: 1 }}>
                  <Stack align="center" gap="md">
                    <Text c="dimmed" ta="center">
                      No origins found
                      {currentOriginName ? ` for ${currentOriginName}` : ""}
                    </Text>
                    <Button variant="default" size="sm" onClick={handleChangeOrigin}>
                      Try Different Origin
                    </Button>
                  </Stack>
                </Center>
              ) : (
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
                    rows={displayData as Origin[]}
                    getRowKey={(row) => String(row.id)}
                    getSno={(_row, index) => (currentPage - 1) * pageSize + index + 1}
                    columns={originListColumns}
                    isEmpty={(displayData as Origin[]).length === 0}
                    emptyIcon={<IconMapPin size={24} color={erpTheme.muted} />}
                    emptyTitle="No origin lines match your search"
                    renderActions={renderOriginActions}
                    headerFilters={originHeaderFiltersProp}
                    loading={isLoading}
                    loadingMessage="Loading origin data…"
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
