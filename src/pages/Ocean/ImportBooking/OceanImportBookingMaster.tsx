import { useMemo, useState, useCallback, useEffect } from "react";
import {
  MantineReactTable,
  MRT_ColumnDef,
  useMantineReactTable,
} from "mantine-react-table";
import {
  ActionIcon,
  Box,
  Group,
  Button,
  Text,
  Card,
  Center,
  Loader,
  Stack,
  Grid,
  Menu,
  Modal,
  Badge,
  Tooltip,
  Select,
} from "@mantine/core";
import {
  IconFilter,
  IconPlus,
  IconDotsVertical,
  IconEdit,
  IconX,
  IconSearch,
} from "@tabler/icons-react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { URL } from "./../../../api/serverUrls";
import {
  Dropdown,
  SearchableSelect,
  SingleDateInput,
  ToastNotification,
} from "./../../../components";
import FormTextInput from "../../../components/FormTextInput";
import { useForm } from "@mantine/form";
import { apiCallProtected } from "./../../../api/axios";
import { putAPICall } from "../../../service/putApiCall";
import { API_HEADER } from "../../../store/storeKeys";
import dayjs from "dayjs";
import PaginationBar from "../../../components/PaginationBar/PaginationBar";
import useDateFormat from "../../../hooks/useDateFormat";
import { useDebouncedValue } from "@mantine/hooks";
import { useListFilterStore } from "../../../store/listFilterStore";

const LIST_KEY = "OCEAN_IMPORT_BOOKING_MASTER";

// Type definitions
type ImportShipmentData = {
  id: number;
  shipment_code: string;
  enquiry_id?: string | null;
  service_type: string;
  import_to_export: boolean;
  reference: string | null;
  date: string;
  service: string;
  customer_name: string;
  customer_code_read: string;
  origin_name: string;
  origin_code_read: string;
  destination_name: string;
  destination_code_read: string;
  customer_service_name: string;
  status?: string;
  freight?: string;
  routed?: string;
  routed_by?: string;
  shipment_terms_name?: string;
  shipment_terms_code_read?: string;
  carrier_name?: string;
  eta?: string;
  etd?: string;
  vessel_name?: string;
  voyage_no?: string;
  shipper_name?: string;
  consignee_name?: string;
  forwarder_name?: string;
  destination_agent_name?: string;
  billing_customer_name?: string;
  notify_customer_name?: string;
  cha_name?: string;
  is_hazardous?: boolean;
  commodity_description?: string | null;
  marks_no?: string | null;
  pickup_location?: string;
  pickup_from_name?: string;
  planned_pickup_date?: string;
  transporter_name?: string;
  delivery_location?: string;
  delivery_from_name?: string;
  planned_delivery_date?: string;
  created_by_name?: string;
  is_direct?: boolean;
  is_coload?: boolean;
  cargo_details?: Array<{
    id: number;
    container_type_name: string;
    no_of_containers: number;
    gross_weight: string;
  }>;
  routing_details?: Array<{
    move_type: string;
    etd: string;
    eta: string;
    flight_no: string;
    status: string;
    from_location_name: string;
    to_location_name: string;
    carrier_name: string;
  }>;
  rate_details?: Array<{
    id: number;
    quotation_no: string;
    charge_name: string;
    pp_cc: string;
    no_of_unit: number;
    sell_amount_total: number | null;
  }>;
};

type FilterState = {
  booking_id: string | null;
  enquiry_id: string | null;
  customer: string | null;
  service: string | null;
  origin: string | null;
  destination: string | null;
  date: Date | null;
};

type PersistedListFilters = {
  booking_id: string | null;
  enquiry_id: string | null;
  customer: string | null;
  service: string | null;
  origin: string | null;
  destination: string | null;
  date: string | null;
  filtersApplied: boolean;
  showFilters: boolean;
  pageIndex: number;
};

function OceanImportBookingMaster() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const getState = useListFilterStore((s) => s.getState);
  const setStoreFilters = useListFilterStore((s) => s.setFilters);
  const setStoreSearch = useListFilterStore((s) => s.setSearch);
  const setStoreDisplayValues = useListFilterStore((s) => s.setDisplayValues);
  const clearAllExcept = useListFilterStore((s) => s.clearAllExcept);
  const setShouldRestore = useListFilterStore((s) => s.setShouldRestore);

  const dateFormat = useDateFormat();
  const seaTransportParams = useMemo(() => ({ transport_mode: "SEA" }), []);

  const [isRestoring, setIsRestoring] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [filtersApplied, setFiltersApplied] = useState(false);

  // Pagination states
  const [pageIndex, setPageIndex] = useState(0); // 0-based index for API
  const [pageSize, setPageSize] = useState(25); // Default page size
  const [totalRecords, setTotalRecords] = useState(0); // Total records from API

  // Display name states for filter fields
  const [customerDisplayName, setCustomerDisplayName] = useState<string | null>(
    null
  );
  const [originDisplayName, setOriginDisplayName] = useState<string | null>(
    null
  );
  const [destinationDisplayName, setDestinationDisplayName] = useState<
    string | null
  >(null);

  // Map booking status to badge label and color
  const getStatusBadge = (statusRaw: string | undefined | null) => {
    const statusUpper = (statusRaw || "").toUpperCase();
    const label = statusUpper || "GENERATED";
    let color: string = "#105476";
    if (label === "BOOKED") color = "green";
    else if (label === "GENERATED") color = "#105476";
    else if (label === "RECEIVED") color = "blue";
    else if (label === "CANCEL") color = "red";
    else color = "gray";
    return { label, color } as const;
  };

  const [cancelConfirmRow, setCancelConfirmRow] = useState<ImportShipmentData | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const filterForm = useForm<FilterState>({
    initialValues: {
      booking_id: null,
      enquiry_id: null,
      customer: null,
      service: null,
      origin: null,
      destination: null,
      date: null,
    },
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch] = useDebouncedValue(searchQuery, 500);

  // Check if we're on the create or edit route
  const isCreateRoute = location.pathname.endsWith("/create");
  const isEditRoute = location.pathname.endsWith("/edit");
  const showMasterTable = !isCreateRoute && !isEditRoute;

  // Check for refetch parameter in URL
  const searchParams = new URLSearchParams(location.search);
  const shouldRefetch = searchParams.get("refetch") === "true";

  // Effect to handle refetch when coming from successful form submission
  useEffect(() => {
    if (shouldRefetch) {
      queryClient.invalidateQueries({
        queryKey: ["ocean-import-booking/filter/"],
      });

      const newSearchParams = new URLSearchParams(location.search);
      newSearchParams.delete("refetch");
      const newSearch = newSearchParams.toString();
      const newPath = newSearch
        ? `${location.pathname}?${newSearch}`
        : location.pathname;

      navigate(newPath, { replace: true });
    }
  }, [
    shouldRefetch,
    queryClient,
    location.search,
    location.pathname,
    navigate,
  ]);

  const buildFilterPayload = () => {
    const values = filterForm.values;
    const payload: Record<string, string> = {};
    if (values.booking_id?.trim())
      payload.shipment_code = values.booking_id.trim();
    if (values.enquiry_id?.trim())
      payload.enquiry_id = values.enquiry_id.trim();
    if (values.customer) payload.customer_code = values.customer;
    if (values.service) payload.service = values.service;
    if (values.origin) payload.origin_code = values.origin;
    if (values.destination) payload.destination_code = values.destination;
    if (values.date) payload.date = dayjs(values.date).format("YYYY-MM-DD");
    return payload;
  };

  const buildBookingRequestFilters = (
    searchValue: string
  ): Record<string, string> => {
    const extra: Record<string, string> = {};
    if (filtersApplied) Object.assign(extra, buildFilterPayload());
    const trimmed = searchValue.trim();
    if (trimmed) extra.search = trimmed;
    return extra;
  };

  const {
    data: importShipmentsResponse,
    isLoading,
    isFetching,
    isError,
    refetch: refetchImportShipments,
  } = useQuery({
    queryKey: [
      "ocean-import-booking/filter/",
      pageIndex,
      pageSize,
      filtersApplied,
      filtersApplied ? JSON.stringify(filterForm.values) : "-",
      debouncedSearch,
    ],
    enabled: !isRestoring && searchQuery === debouncedSearch,
    queryFn: async () => {
      try {
        const offset = pageIndex * pageSize;
        const url = `${URL.customerServiceShipmentFilter}?index=${offset}&limit=${pageSize}`;
        const filtersPayload = buildBookingRequestFilters(debouncedSearch);
        const response = (await apiCallProtected.post(url, {
          filters: {
            service_type: "IMPORT",
            service: ["FCL", "LCL"],
            ...filtersPayload,
          },
        })) as Record<string, unknown>;

        if (response && typeof response === "object") {
          if (typeof response.total === "number") {
            setTotalRecords(response.total);
          }
          let data: ImportShipmentData[] = [];
          if (Array.isArray(response.data)) {
            data = response.data as ImportShipmentData[];
          } else if (Array.isArray(response.results)) {
            data = response.results as ImportShipmentData[];
          } else if (Array.isArray(response.result)) {
            data = response.result as ImportShipmentData[];
          }
          return {
            data,
            total: (response.total as number) || 0,
            count: (response.count as number) || data.length,
            index: (response.index as number) ?? pageIndex,
            limit: (response.limit as number) ?? pageSize,
            total_pagination: (response.total_pagination as number) || 0,
          };
        }
        return {
          data: [],
          total: 0,
          count: 0,
          index: pageIndex,
          limit: pageSize,
          total_pagination: 0,
        };
      } catch (error) {
        console.error("❌ Error fetching ocean import booking:", error);
        return {
          data: [],
          total: 0,
          count: 0,
          index: pageIndex,
          limit: pageSize,
          total_pagination: 0,
        };
      }
    },
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  const displayData = importShipmentsResponse?.data ?? [];

  const [isApplyingFilters, setIsApplyingFilters] = useState(false);

  useEffect(() => {
    const stored = getState(LIST_KEY);
    const shouldRestore = stored?.shouldRestore === true;
    if (!shouldRestore) {
      setIsRestoring(false);
      return;
    }
    const f = stored.filters as PersistedListFilters | undefined;
    if (f && typeof f === "object") {
      filterForm.setValues({
        booking_id: f.booking_id ?? null,
        enquiry_id: f.enquiry_id ?? null,
        customer: f.customer ?? null,
        service: f.service ?? null,
        origin: f.origin ?? null,
        destination: f.destination ?? null,
        date: f.date ? dayjs(f.date, "YYYY-MM-DD").toDate() : null,
      });
      setFiltersApplied(Boolean(f.filtersApplied));
      setShowFilters(Boolean(f.showFilters));
      setPageIndex(typeof f.pageIndex === "number" ? f.pageIndex : 0);
    }
    const dv = stored.displayValues;
    if (dv) {
      setCustomerDisplayName(dv.customer ?? null);
      setOriginDisplayName(dv.origin ?? null);
      setDestinationDisplayName(dv.destination ?? null);
    }
    if (typeof stored.search === "string") {
      setSearchQuery(stored.search);
    }
    clearAllExcept(LIST_KEY);
    setShouldRestore(LIST_KEY, false);
    setIsRestoring(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restore runs on navigation key
  }, [location.key]);

  const persistListAndNavigate = useCallback(() => {
    const persisted: PersistedListFilters = {
      booking_id: filterForm.values.booking_id,
      enquiry_id: filterForm.values.enquiry_id,
      customer: filterForm.values.customer,
      service: filterForm.values.service,
      origin: filterForm.values.origin,
      destination: filterForm.values.destination,
      date: filterForm.values.date
        ? dayjs(filterForm.values.date).format("YYYY-MM-DD")
        : null,
      filtersApplied,
      showFilters,
      pageIndex,
    };
    setStoreFilters(LIST_KEY, persisted);
    setStoreDisplayValues(LIST_KEY, {
      customer: customerDisplayName,
      origin: originDisplayName,
      destination: destinationDisplayName,
    });
    setStoreSearch(LIST_KEY, searchQuery);
    setShouldRestore(LIST_KEY, true);
    navigate("./create");
  }, [
    filterForm.values,
    filtersApplied,
    showFilters,
    pageIndex,
    customerDisplayName,
    originDisplayName,
    destinationDisplayName,
    searchQuery,
    navigate,
    setStoreFilters,
    setStoreDisplayValues,
    setStoreSearch,
    setShouldRestore,
  ]);

  const isDataLoading = isRestoring || isLoading;

  useEffect(() => {
    if (!isApplyingFilters) return;
    if (isFetching) return;

    setIsApplyingFilters(false);

    if (isError) {
      ToastNotification({
        type: "error",
        message: "Error applying filters",
      });
      return;
    }

    ToastNotification({
      type: "success",
      message: "Filters applied successfully",
    });
  }, [isApplyingFilters, isFetching, isError]);

  // Effect to handle refreshData state from navigation
  useEffect(() => {
    if (location.state?.refreshData) {
      const refreshData = async () => {
        try {
          queryClient.removeQueries({
            queryKey: ["ocean-import-booking/filter/"],
          });
          await new Promise((resolve) => setTimeout(resolve, 50));
          await refetchImportShipments();
          setTimeout(async () => {
            await queryClient.refetchQueries({
              queryKey: ["ocean-import-booking/filter/"],
              type: "active",
            });
          }, 200);
        } catch (error) {
          console.error("Error refreshing ocean import booking data:", error);
        }
      };
      refreshData();
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, refetchImportShipments, navigate, location.pathname, queryClient]);

  // Additional effect to ensure data refresh on component mount
  useEffect(() => {
    const refreshOnMount = async () => {
      try {
        await queryClient.refetchQueries({
          queryKey: ["ocean-import-booking/filter/"],
          type: "active",
        });
      } catch (error) {
        console.error("Error refreshing data on mount:", error);
      }
    };
    const timeoutId = setTimeout(refreshOnMount, 100);
    return () => clearTimeout(timeoutId);
  }, [queryClient]);

  const applyFilters = async () => {
    try {
      const formValues = filterForm.values;
      const hasFilterValues =
        (formValues.booking_id && formValues.booking_id.trim() !== "") ||
        (formValues.enquiry_id && formValues.enquiry_id.trim() !== "") ||
        formValues.customer ||
        formValues.service ||
        formValues.origin ||
        formValues.destination ||
        formValues.date;

      if (!hasFilterValues) {
        setFiltersApplied(false);
        setPageIndex(0);
        ToastNotification({
          type: "info",
          message: "No filters selected, showing all data",
        });
        return;
      }

      setPageIndex(0);
      setFiltersApplied(true);
      setIsApplyingFilters(true);
    } catch (error) {
      ToastNotification({
        type: "error",
        message: "Error applying filters",
      });
      console.error("Error applying filters:", error);
    } finally {
      setShowFilters(false);
    }
  };

  const clearAllFilters = async () => {
    try {
      setShowFilters(false);

      const formValues = filterForm.values;
      const hasFilterValues =
        (formValues.booking_id && formValues.booking_id.trim() !== "") ||
        (formValues.enquiry_id && formValues.enquiry_id.trim() !== "") ||
        formValues.customer ||
        formValues.service ||
        formValues.origin ||
        formValues.destination ||
        formValues.date;

      if (!hasFilterValues) {
        setFiltersApplied(false);
        setPageIndex(0);
        ToastNotification({
          type: "info",
          message: "No filters selected, showing all data",
        });
        return;
      }
      filterForm.reset();
      setFiltersApplied(false);
      setSearchQuery("");
      setPageIndex(0);
      setCustomerDisplayName(null);
      setOriginDisplayName(null);
      setDestinationDisplayName(null);
      await queryClient.invalidateQueries({
        queryKey: ["ocean-import-booking/filter/"],
      });
      ToastNotification({
        type: "success",
        message: "All filters cleared successfully",
      });
    } catch (error) {
      console.error("Error clearing filters:", error);
      setShowFilters(false);
    }
  };

  // Pagination handlers
  const handlePageChange = (page: number) => {
    // PaginationBar uses 1-based page numbers, convert to 0-based index
    const newIndex = page - 1;
    setPageIndex(newIndex);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPageIndex(0); // Reset to first page when page size changes
  };

  const handleConfirmCancel = async () => {
    if (!cancelConfirmRow) return;
    setIsCancelling(true);
    try {
      const payload = { ...cancelConfirmRow, status: "CANCEL" };
      await putAPICall(URL.customerServiceShipment, payload, API_HEADER);
      ToastNotification({ type: "success", message: "Booking cancelled successfully" });
      setCancelConfirmRow(null);
      queryClient.invalidateQueries({ queryKey: ["ocean-import-booking/filter/"] });
      void refetchImportShipments();
    } catch (err: unknown) {
      ToastNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to cancel booking",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const columns = useMemo<MRT_ColumnDef<ImportShipmentData>[]>(
    () => [
      {
        accessorKey: "shipment_code",
        header: "Booking ID",
        size: 120,
      },
      {
        accessorKey: "enquiry_id",
        header: "Enquiry ID",
        size: 150,
        Cell: ({ cell }) => {
          const v = cell.getValue<string | null | undefined>();
          return v != null && String(v) !== "" ? String(v) : "-";
        },
      },
      {
        accessorKey: "date",
        header: "Date",
        size: 120,
        Cell:({ row }) => (
          <Text size="sm">
            {row.original.date
              ? dayjs(row.original.date).format(dateFormat)
              : "-"}
          </Text>
        ),
      },
      {
        accessorKey: "service",
        header: "Service",
        size: 100,
      },
      {
        accessorKey: "customer_name",
        header: "Customer Name",
        size: 150,
      },
      {
        accessorKey: "origin_name",
        header: "Origin",
        size: 150,
      },
      {
        accessorKey: "destination_name",
        header: "Destination",
        size: 150,
      },
      {
        accessorKey: "customer_service_name",
        header: "Customer Service",
        size: 150,
      },
      {
        id: "status",
        accessorKey: "status",
        header: "Status",
        size: 140,
        Cell: ({ cell }) => {
          const value = cell.getValue<string | null>();
          const { label, color } = getStatusBadge(value ?? undefined);
          return (
            <Badge
              size="sm"
              variant="light"
              color={color}
              styles={{
                root: {
                  textTransform: "none",
                  minWidth: "fit-content",
                  whiteSpace: "nowrap",
                },
              }}
            >
              {label}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        size: 80,
        Cell: ({ row }) => {
          const statusUpper = (row.original.status ?? "").toUpperCase();
          const isCancel = statusUpper === "CANCEL";
          const canCancel = statusUpper !== "GENERATED" && !isCancel;
          const isBooked = statusUpper === "BOOKED";
          return (
            <Menu shadow="md" width={140}>
              <Menu.Target>
                <ActionIcon variant="subtle" color="gray">
                  <IconDotsVertical size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Tooltip
                  label="Edit disabled because booking is cancelled"
                  disabled={!isCancel}
                >
                  <Menu.Item
                    leftSection={<IconEdit size={14} />}
                    disabled={isCancel}
                    onClick={() => {
                      if (!isCancel) {
                        navigate(`./edit`, {
                          state: { job: row.original },
                        });
                      }
                    }}
                  >
                    Edit
                  </Menu.Item>
                </Tooltip>
                {isBooked && (
                  <Menu.Item
                    leftSection={<IconPlus size={14} />}
                    onClick={() => {
                      // const { id: _ignoredId, ...jobWithoutId } =
                      //   row.original as unknown as Record<string, unknown>;
                      // navigate("/SeaExport/import-job/create", {
                      //   state: { job: jobWithoutId },
                      // });
                    }}
                  >
                    Create Job
                  </Menu.Item>
                )}
                {canCancel && (
                  <Tooltip
                    label="This booking already has a job. If required, you can cancel the job."
                    disabled={statusUpper !== "GENERATED"}
                  >
                    <Menu.Item
                      leftSection={<IconX size={14} />}
                      color="red"
                      disabled={!canCancel}
                      onClick={() => {
                        if (canCancel) setCancelConfirmRow(row.original);
                      }}
                    >
                      Cancel
                    </Menu.Item>
                  </Tooltip>
                )}
              </Menu.Dropdown>
            </Menu>
          );
        },
      },
    ],
    [navigate, dateFormat]
  );

  const table = useMantineReactTable({
    columns,
    data: displayData,
    enableColumnFilters: false,
    enablePagination: false, // Disable built-in pagination - using server-side pagination
    enableTopToolbar: false,
    enableColumnActions: false,
    enableSorting: false,
    enableBottomToolbar: false,
    enableColumnPinning: true,
    enableStickyHeader: true,
    initialState: {
      columnPinning: { right: ["actions"] },
    },
    layoutMode: "grid",
    mantineTableProps: {
      striped: false,
      highlightOnHover: true,
      withTableBorder: false,
      withColumnBorders: false,
      style: { width: "100%" },
    },
    mantinePaperProps: {
      shadow: "sm",
      p: "md",
      radius: "md",
      style: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        maxHeight: "1536px",
        overflow: "auto",
      },
    },
    mantineTableBodyCellProps: ({ column }) => {
      let extraStyles = {};
      if (column.id === "actions") {
        extraStyles = {
          position: "sticky",
          right: 0,
          minWidth: "30px",
          zIndex: 2,
          borderLeft: "1px solid #F3F3F3",
          boxShadow: "1px -2px 4px 0px #00000040",
        };
      }
      return {
        style: {
          width: "fit-content",
          padding: "8px 16px",
          fontSize: "14px",
          fontstyle: "regular",
          fontFamily: "Inter",
          color: "#334155",
          backgroundColor: "#ffffff",
          ...extraStyles,
        },
      };
    },
    mantineTableHeadCellProps: ({ column }) => {
      let extraStyles = {};
      if (column.id === "actions") {
        extraStyles = {
          position: "sticky",
          right: 0,
          minWidth: "80px",
          zIndex: 2,
          backgroundColor: "#F8FAFC",
          boxShadow: "0px -2px 4px 0px #00000040",
        };
      }
      return {
        style: {
          width: "fit-content",
          padding: "8px 16px",
          fontSize: "14px",
          fontFamily: "Inter",
          fontstyle: "bold",
          color: "#1E293B",
          backgroundColor: "#F8FAFC",
          top: 0,
          zIndex: 3,
          borderBottom: "1px solid #F3F3F3",
          ...extraStyles,
        },
      };
    },
    mantineTableContainerProps: {
      style: {
        height: "100%",
        flexGrow: 1,
        minHeight: 0,
        position: "relative",
        overflow: "auto",
      },
    },
    renderEmptyRowsFallback: () => (
      <tr>
        <td colSpan={columns.length}>
          <Center py="xl">
            <Stack align="center" gap="md">
              <Text c="dimmed" size="lg">
                No data to display
              </Text>
            </Stack>
          </Center>
        </td>
      </tr>
    ),
  });

  return (
    <>
      {showMasterTable && (
        <Card
          shadow="sm"
          pt="md"
          pb="sm"
          px="lg"
          radius="md"
          withBorder
          style={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            overflow: "hidden",
            flex: 1,
          }}
        >
          <Box mb="md">
            <Group justify="space-between" align="center">
              <Text
                size="md"
                fw={600}
                c={"#1E293B"}
                style={{ fontFamily: "Inter", fontSize: "16px" }}
              >
                Ocean Import Booking Lists
              </Text>

              <Group gap="xs" wrap="nowrap">
                <FormTextInput
                  placeholder="Search..."
                  leftSection={<IconSearch size={16} />}
                  rightSection={
                    searchQuery ? (
                      <ActionIcon
                        variant="transparent"
                        size="sm"
                        onClick={() => setSearchQuery("")}
                        style={{ cursor: "pointer" }}
                      >
                        <IconX size={16} />
                      </ActionIcon>
                    ) : null
                  }
                  w={248}
                  size="sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.currentTarget.value)}
                  styles={{
                    input: {
                      borderRadius: "4px",
                      fontSize: "14px",
                      fontFamily: "Inter",
                      color: "#334155",
                      minWidth: "24px",
                      minHeight: "24px",
                      width: "248px",
                      height: "36px",
                      border: "1px solid #D0D1D4",
                      "&:focus": {
                        border: "1px solid #105476",
                      },
                    },
                  }}
                />

                <ActionIcon
                  variant={showFilters ? "filled" : "outline"}
                  size={36}
                  color={showFilters ? "#E0F5FF" : "gray"}
                  onClick={() => setShowFilters(!showFilters)}
                  styles={{
                    root: {
                      borderRadius: "4px",
                      backgroundColor: showFilters ? "#E0F5FF" : "#FFFFFF",
                      border: showFilters
                        ? "1px solid #105476"
                        : "1px solid #737780",
                      color: showFilters ? "#105476" : "#737780",
                    },
                  }}
                >
                  <IconFilter size={18} />
                </ActionIcon>

                <Button
                  leftSection={<IconPlus size={16} />}
                  size="sm"
                  styles={{
                    root: {
                      backgroundColor: "#105476",
                      borderRadius: "4px",
                      color: "#FFFFFF",
                      fontSize: "14px",
                      fontFamily: "Inter",
                      fontstyle: "semibold",
                      "&:hover": {
                        backgroundColor: "#105476",
                      },
                    },
                  }}
                  onClick={persistListAndNavigate}
                >
                  Create New
                </Button>
              </Group>
            </Group>
          </Box>

          {/* Filter Section */}
          {showFilters && (
            <Box
              mb="xs"
              style={{
                borderRadius: "8px",
                border: "1px solid #E0E0E0",
                flexShrink: 0,
                height: "fit-content",
              }}
            >
              <Group
                justify="space-between"
                align="center"
                mb="lg"
                style={{
                  backgroundColor: "#F8FAFC",
                  padding: "8px 8px",
                  borderRadius: "8px",
                }}
              >
                <Text
                  size="sm"
                  fw={600}
                  c="#1E293B"
                  style={{ fontFamily: "Inter", fontSize: "14px" }}
                >
                  Filters
                </Text>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  onClick={() => setShowFilters(false)}
                  aria-label="Close filters"
                  size="sm"
                >
                  <IconX size={18} />
                </ActionIcon>
              </Group>

              <Grid gutter="md" px="md">
                <Grid.Col span={2.4}>
                  <FormTextInput
                    size="xs"
                    label="Booking ID"
                    placeholder="Enter Booking ID"
                    value={filterForm.values.booking_id ?? ""}
                    onChange={(e) =>
                      filterForm.setFieldValue(
                        "booking_id",
                        e.currentTarget.value || null
                      )
                    }
                  />
                </Grid.Col>
                <Grid.Col span={2.4}>
                  <FormTextInput
                    size="xs"
                    label="Enquiry ID"
                    placeholder="Enter Enquiry ID"
                    value={filterForm.values.enquiry_id ?? ""}
                    onChange={(e) =>
                      filterForm.setFieldValue(
                        "enquiry_id",
                        e.currentTarget.value || null
                      )
                    }
                  />
                </Grid.Col>
                <Grid.Col span={2.4}>
                  <SearchableSelect
                    size="xs"
                    label="Customer"
                    placeholder="Type customer name"
                    apiEndpoint={URL.allCustomers}
                    searchFields={["customer_name", "customer_code"]}
                    displayFormat={(item: Record<string, unknown>) => ({
                      value: String(item.customer_code),
                      label: String(item.customer_name),
                    })}
                    value={filterForm.values.customer}
                    displayValue={customerDisplayName}
                    onChange={(value, selectedData) => {
                      filterForm.setFieldValue("customer", value || "");
                      setCustomerDisplayName(selectedData?.label || null);
                    }}
                    minSearchLength={2}
                    dropdownZIndex={1000}
                  />
                </Grid.Col>
                <Grid.Col span={2.4}>
                  <Dropdown
                    size="xs"
                    label="Service"
                    placeholder="All"
                    clearable
                    data={[
                      { value: "FCL", label: "FCL" },
                      { value: "LCL", label: "LCL" },
                    ]}
                    value={filterForm.values.service ?? null}
                    onChange={(v) =>
                      filterForm.setFieldValue("service", v ?? null)
                    }
                  />
                </Grid.Col>
                <Grid.Col span={2.4}>
                  <SingleDateInput
                    key={`date-${filterForm.values.date}`}
                    label="Date"
                    placeholder="YYYY-MM-DD"
                    size="xs"
                    value={filterForm.values.date}
                    onChange={(d) => filterForm.setFieldValue("date", d)}
                  />
                </Grid.Col>
                <Grid.Col span={2.4}>
                  <SearchableSelect
                    size="xs"
                    label="Origin"
                    placeholder="Type origin code or name"
                    apiEndpoint={URL.portMaster}
                    searchFields={["port_code", "port_name"]}
                    displayFormat={(item: Record<string, unknown>) => ({
                      value: String(item.port_code),
                      label: `${item.port_name} (${item.port_code})`,
                    })}
                    value={filterForm.values.origin}
                    displayValue={originDisplayName}
                    onChange={(value, selectedData) => {
                      filterForm.setFieldValue("origin", value || "");
                      setOriginDisplayName(selectedData?.label || null);
                    }}
                    minSearchLength={3}
                    className="filter-searchable-select"
                    additionalParams={seaTransportParams}
                    dropdownZIndex={1000}
                  />
                </Grid.Col>
                <Grid.Col span={2.4}>
                  <SearchableSelect
                    size="xs"
                    label="Destination"
                    placeholder="Type destination code or name"
                    apiEndpoint={URL.portMaster}
                    searchFields={["port_code", "port_name"]}
                    displayFormat={(item: Record<string, unknown>) => ({
                      value: String(item.port_code),
                      label: `${item.port_name} (${item.port_code})`,
                    })}
                    value={filterForm.values.destination}
                    displayValue={destinationDisplayName}
                    onChange={(value, selectedData) => {
                      filterForm.setFieldValue("destination", value || "");
                      setDestinationDisplayName(selectedData?.label || null);
                    }}
                    minSearchLength={3}
                    className="filter-searchable-select"
                    additionalParams={seaTransportParams}
                    dropdownZIndex={1000}
                  />
                </Grid.Col>
              </Grid>

              <Group justify="end" mt="md" p="md" pb="md">
                <Button
                  size="xs"
                  variant="outline"
                  styles={{
                    root: {
                      borderRadius: "4px",
                      fontSize: "14px",
                      fontFamily: "Inter",
                      fontstyle: "semibold",
                      color: "#105476",
                      borderColor: "#105476",
                      "&:hover": {
                        backgroundColor: "#f8f9fa",
                      },
                    },
                  }}
                  leftSection={<IconX size={14} />}
                  onClick={clearAllFilters}
                >
                  Clear Filters
                </Button>
                <Button
                  size="xs"
                  variant="filled"
                  styles={{
                    root: {
                      backgroundColor: "#105476",
                      borderRadius: "4px",
                      fontSize: "14px",
                      fontFamily: "Inter",
                      fontstyle: "semibold",
                      "&:hover": {
                        backgroundColor: "#105476",
                      },
                    },
                  }}
                  leftSection={
                    isDataLoading ? (
                      <Loader size={14} />
                    ) : (
                      <IconFilter size={14} />
                    )
                  }
                  onClick={applyFilters}
                  loading={isDataLoading}
                  disabled={isDataLoading}
                >
                  Apply Filters
                </Button>
              </Group>
            </Box>
          )}

          {isDataLoading ? (
            <Center py="xl">
              <Stack align="center" gap="md">
                <Loader size="lg" color="#105476" />
                <Text c="dimmed" style={{ fontFamily: "Inter, sans-serif" }}>
                  Loading ocean import booking...
                </Text>
              </Stack>
            </Center>
          ) : (
            <>
              <MantineReactTable
                key={`table-${filtersApplied ? "filtered" : "unfiltered"}-${displayData.length}`}
                table={table}
              />

              {/* Pagination Bar */}
              <PaginationBar
                pageSize={pageSize}
                currentPage={pageIndex + 1} // Convert 0-based to 1-based for PaginationBar
                totalRecords={totalRecords}
                onPageSizeChange={handlePageSizeChange}
                onPageChange={handlePageChange}
                pageSizeOptions={["10", "25", "50"]}
              />
            </>
          )}
        </Card>
      )}
      <Modal
        opened={!!cancelConfirmRow}
        onClose={() => !isCancelling && setCancelConfirmRow(null)}
        title="Cancel booking"
        centered
      >
        <Text size="sm" c="dimmed" mb="md">
          Are you sure you want to cancel this booking? This action cannot be undone.
        </Text>
        <Group justify="flex-end" gap="xs">
          <Button variant="subtle" onClick={() => setCancelConfirmRow(null)} disabled={isCancelling}>
            No
          </Button>
          <Button color="red" onClick={handleConfirmCancel} loading={isCancelling}>
            Yes, cancel
          </Button>
        </Group>
      </Modal>
      <Outlet />
    </>
  );
}

export default OceanImportBookingMaster;
