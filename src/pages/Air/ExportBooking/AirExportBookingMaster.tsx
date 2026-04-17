import { useMemo, useState, useCallback, useEffect } from "react";
import {
  MantineReactTable,
  MRT_ColumnDef,
  useMantineReactTable,
} from "mantine-react-table";
import {
  Group,
  Button,
  Text,
  Card,
  Center,
  Loader,
  Stack,
  Grid,
  Menu,
  ActionIcon,
  Box,
  Badge,
  Modal,
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
import { URL } from "../../../api/serverUrls";
import { SearchableSelect, SingleDateInput, ToastNotification } from "../../../components";
import PaginationBar from "../../../components/PaginationBar/PaginationBar";
import { useForm } from "@mantine/form";
import { apiCallProtected } from "../../../api/axios";
import { putAPICall } from "../../../service/putApiCall";
import { API_HEADER } from "../../../store/storeKeys";
import dayjs from "dayjs";
import { useDebouncedValue } from "@mantine/hooks";
import useDateFormat from "../../../hooks/useDateFormat";
import { useListFilterStore } from "../../../store/listFilterStore";
import FormTextInput from "../../../components/FormTextInput";

const LIST_KEY = "AIR_EXPORT_BOOKING_MASTER";

// Type definitions
type ExportShipmentData = {
  id: number;
  shipment_code: string;
  enquiry_id?: string | null;
  date: string;
  service: string;
  customer_name: string;
  origin_name: string;
  destination_name: string;
  customer_service_name: string;
  status?: string;
  destination_agent_code?: string;
  destination_agent_address?: string;
  destination_agent_email?: string;
  destination_agent_name?: string;
  destination_agent_phone?: string;
  notify1_customer_name?: string;
  notify1_customer_address?: string;
  notify1_customer_email?: string;
  cha?: string;
  cha_id?: number | null;
  cha_address?: string;
  shipment_terms_code?: string;
  origin_code?: string;
  destination_code?: string;
  is_hazardous?: boolean;
  // Additional fields returned by the filter API
  customer_code_read?: string;
  origin_code_read?: string;
  destination_code_read?: string;
  etd?: string;
  eta?: string;
  atd?: string;
  ata?: string;
  carrier_code_read?: string;
  voyage_no?: string;
  mawb_no?: string;
  mawb_date?: string;
  carrier_booking_no?: string;
  igm_no?: string;
  igm_date?: string;
  houseno?: string;
  routed?: string;
  routed_by?: string;
  // Agent fields
  agent_name?: string;
  agent_address?: string;
  agent_email?: string;
  // Shipper fields
  shipper_name?: string;
  shipper_address?: string;
  shipper_email?: string;
  // Consignee fields
  consignee_name?: string;
  consignee_address?: string;
  consignee_email?: string;
  // Notify party fields
  notify_customer_name?: string;
  notify_customer_address?: string;
  notify_customer_email?: string;
  // Shipment terms / cargo details
  shipment_terms_code_read?: string;
  marks_no?: string | null;
  commodity_description?: string | null;
  service_type?: string;
  events?: Array<Record<string, unknown>>;
  routing_details?: Array<Record<string, unknown>>;
  cargo_details?: Array<Record<string, unknown>>;
  rate_details?: Array<Record<string, unknown>>;
  housing_details?: Array<Record<string, unknown>>;
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

function AirExportBookingMaster() {
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
  const airTransportParams = useMemo(() => ({ transport_mode: "AIR" }), []);

  //States
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

  // Cancel confirmation modal
  const [cancelConfirmRow, setCancelConfirmRow] = useState<ExportShipmentData | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Create Job modal state
  const [createJobLoading, setCreateJobLoading] = useState(false);
  const [createJobModalOpen, setCreateJobModalOpen] = useState(false);
  const [createJobResponse, setCreateJobResponse] = useState<Record<string, unknown> | null>(null);
  const [createJobError, setCreateJobError] = useState<string | null>(null);

  // State to store the actual applied filter values
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

  // Search states (debounced value is sent as filters.search — same pattern as Air Export Job list)
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch] = useDebouncedValue(searchQuery, 500);

  // Check if we're on the create or edit route
  const isCreateRoute = location.pathname.endsWith("/create");
  const isEditRoute = location.pathname.endsWith("/edit");
  const showMasterTable = !isCreateRoute && !isEditRoute;

  // Check for refetch parameter in URL
  const searchParams = new URLSearchParams(location.search);
  const shouldRefetch = searchParams.get("refetch") === "true";

  // Build filter payload function
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

  /** Extra keys on top of service_type + service: applied panel filters + search (Air Export Job pattern). */
  const buildBookingRequestFilters = (searchValue: string): Record<string, string> => {
    const extra: Record<string, string> = {};
    if (filtersApplied) Object.assign(extra, buildFilterPayload());
    const trimmed = searchValue.trim();
    if (trimmed) extra.search = trimmed;
    return extra;
  };

  const {
    data: exportShipmentsResponse,
    isLoading,
    refetch: refetchExportShipments,
  } = useQuery({
    queryKey: [
      "air-export-booking/filter/",
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
            service_type: "EXPORT",
            service: "AIR",
            ...filtersPayload,
          },
        })) as Record<string, unknown>;

        if (response && typeof response === "object") {
          if (typeof response.total === "number") {
            setTotalRecords(response.total);
          }

          let data: ExportShipmentData[] = [];
          if (Array.isArray(response.data)) {
            data = response.data as ExportShipmentData[];
          } else if (Array.isArray(response.results)) {
            data = response.results as ExportShipmentData[];
          } else if (Array.isArray(response.result)) {
            data = response.result as ExportShipmentData[];
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
        console.error("❌ Error fetching air export booking:", error);
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

  const displayData = exportShipmentsResponse?.data ?? [];

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

  // Loading state
  const isDataLoading = isRestoring || isLoading;

  // Effect to handle refetch when coming from successful form submission
  useEffect(() => {
    if (shouldRefetch) {
      // Refetch the export shipments data
      queryClient.invalidateQueries({
        queryKey: ["air-export-booking/filter/"],
      });

      // Remove the refetch parameter from URL to prevent unnecessary refetches on subsequent visits
      const newSearchParams = new URLSearchParams(location.search);
      newSearchParams.delete("refetch");
      const newSearch = newSearchParams.toString();
      const newPath = newSearch
        ? `${location.pathname}?${newSearch}`
        : location.pathname;

      // Replace the current URL to remove the refetch parameter
      navigate(newPath, { replace: true });
    }
  }, [
    shouldRefetch,
    queryClient,
    location.search,
    location.pathname,
    navigate,
  ]);

  // Effect to handle refreshData state from navigation
  useEffect(() => {
    console.log("refresh data----", location.state?.refreshData);

    if (location.state?.refreshData) {
      console.log("🔄 Refreshing data after create/edit operation");

      // Refresh export shipments data
      const refreshData = async () => {
        try {
          console.log(
            "🔄 Starting aggressive data refresh for air export booking..."
          );

          // Remove all cached data first
          queryClient.removeQueries({
            queryKey: ["air-export-booking/filter/"],
          });

          // Wait a moment for cleanup
          await new Promise((resolve) => setTimeout(resolve, 50));

          await refetchExportShipments();

          // Additional refetch to ensure UI updates
          setTimeout(async () => {
            await queryClient.refetchQueries({
              queryKey: ["air-export-booking/filter/"],
              type: "active",
            });
            console.log(
              "✅ Air export booking data refresh completed with additional refetch"
            );
          }, 200);

          console.log("✅ Air export booking data refresh completed");
        } catch (error) {
          console.error("Error refreshing air export booking data:", error);
        }
      };

      refreshData();

      // Clear the refresh flag after starting the refresh process
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, refetchExportShipments, navigate, location.pathname, queryClient]);

  // Additional effect to ensure data refresh on component mount
  useEffect(() => {
    const refreshOnMount = async () => {
      try {
        // Always refetch data when component mounts to ensure fresh data
        await queryClient.refetchQueries({
          queryKey: ["air-export-booking/filter/"],
          type: "active",
        });
        console.log("🔄 Air export booking data refreshed on component mount");
      } catch (error) {
        console.error(
          "Error refreshing air export booking data on mount:",
          error
        );
      }
    };

    // Small delay to ensure component is fully mounted
    const timeoutId = setTimeout(refreshOnMount, 100);

    return () => clearTimeout(timeoutId);
  }, [queryClient]);

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

  const applyFilters = async () => {
    try {
      console.log("Applying filters...");
      const formValues = filterForm.values;
      console.log("Current filters:", formValues);

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
        setPageIndex(0); // Reset pagination

        ToastNotification({
          type: "info",
          message: "No filters selected, showing all data",
        });
        return;
      }

      setPageIndex(0);
      setFiltersApplied(true);

      ToastNotification({
        type: "success",
        message: "Filters applied successfully",
      });
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
        setPageIndex(0); // Reset pagination

        ToastNotification({
          type: "info",
          message: "No filters selected, showing all data",
        });
        return;
      }
      filterForm.reset(); // Reset form to initial values
      setFiltersApplied(false); // Reset filters applied state
      setSearchQuery("");
      setPageIndex(0); // Reset pagination

      // Clear display names
      setCustomerDisplayName(null);
      setOriginDisplayName(null);
      setDestinationDisplayName(null);

      // Invalidate queries and refetch unfiltered data
      await queryClient.invalidateQueries({
        queryKey: ["air-export-booking/filter/"],
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

  const handleConfirmCancel = async () => {
    if (!cancelConfirmRow) return;
    setIsCancelling(true);
    try {
      const payload = { ...cancelConfirmRow, status: "CANCEL" };
      await putAPICall(URL.customerServiceShipment, payload, API_HEADER);
      ToastNotification({ type: "success", message: "Booking cancelled successfully" });
      setCancelConfirmRow(null);
      queryClient.invalidateQueries({ queryKey: ["air-export-booking/filter/"] });
      void refetchExportShipments();
    } catch (err: unknown) {
      ToastNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to cancel booking",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const handleCreateJob = async (booking: ExportShipmentData) => {
    const routingDetails = Array.isArray(booking.routing_details) ? booking.routing_details : [];
    const rateDetails = Array.isArray(booking.rate_details) ? booking.rate_details : [];
    const housingDetails = Array.isArray(booking.housing_details) ? booking.housing_details : [];
    const cargoDetails = Array.isArray(booking.cargo_details) ? booking.cargo_details : [];

    const payload: Record<string, unknown> = {
      service: booking.service || "AIR",
      service_type: booking.service_type || "Export",
       agent: booking.destination_agent_code || "",
     origin_code: booking.origin_code || "",
     destination_code: booking.destination_code || "",
     etd: null,
     eta: null,
     atd: null,
     ata: null,
     carrier_code:  "",
     flightno:  "",
     is_direct: false,
     mawb_no: booking.mawb_no || "",
     mbl_date: null,
     carrier_booking_no: booking.carrier_booking_no || "",
     voyage_number: booking.voyage_no || "",
     estimates:[],
      ocean_routings: routingDetails.map((r) => ({
        transport_type: "Air",
        from_port_code:
          r.from_port_code|| "",
        to_port_code:
          r.to_port_code || "",
        carrier_code: r.carrier_code || "",
        flight: r.flight || "",
        rail_no: r.rail_no || "",
        truck_no: r.truck_no || "",
        voyage_number: r.voyage_number || "",
        vessel: r.vessel || "",
        etd: r.etd ? dayjs(r.etd as string).isValid() ? dayjs(r.etd as string).format("YYYY-MM-DD") : null : null,
        eta: r.eta ? dayjs(r.eta as string).isValid() ? dayjs(r.eta as string).format("YYYY-MM-DD") : null : null,
        atd: r.atd ? dayjs(r.atd as string).isValid() ? dayjs(r.atd as string).format("YYYY-MM-DD") : null : null,
        ata: r.ata ? dayjs(r.ata as string).isValid() ? dayjs(r.ata as string).format("YYYY-MM-DD") : null : null,
      })),
      // estimates: rateDetails.map((r) => ({
      //   ...(r.supplier_code ? { supplier_code: String(r.supplier_code) } : {}),
      //   ...(r.charge_id != null ? { charge_id: Number(r.charge_id) } : {}),
      //   pp_cc: r.pp_cc || "Prepaid",
      //   ...(r.unit_id != null ? { unit_id: Number(r.unit_id) } : {}),
      //   no_of_unit: Number(r.no_of_unit ?? r.no_of_units ?? 0),
      //   ...(r.currency_id != null ? { currency_id: Number(r.currency_id) } : {}),
      //   roe: Number(r.roe ?? 1),
      //   cost_per_unit: Number(r.cost_per_unit ?? 0),
      //   total_cost: Number(r.total_cost ?? 0),
      // })),
      housing_details:[{
              hawb_no: booking.houseno|| "",
              origin_code: booking.origin_code || "",
              destination_code: booking.destination_code || "",
              trade: "Re Export",
              routed: booking.routed || "",
              routed_by: booking.routed_by || "",
              customer_service: booking.customer_service_name || "",
              agent_name: booking.destination_agent_name || "",
              agent_address: booking.destination_agent_address || "",
              agent_email: booking.destination_agent_email || "",
              shipper_name: booking.shipper_name || "",
              shipper_address: booking.shipper_address || "",
              shipper_email: booking.shipper_email || "",
              // consignee
              consignee_name: booking.consignee_name || "",
              consignee_address: booking.consignee_address || "",
              consignee_email: booking.consignee_email || "",
              // notify party
              notify1_customer_name: booking.notify1_customer_name || "",
              notify1_customer_address: booking.notify1_customer_address || "",
              notify1_customer_email: booking.notify1_customer_email || "",
              cha_name: booking.cha || "",
              cha_address: booking.cha_address || "",
              // commodity / marks / shipment terms
              commodity_description: booking.commodity_description || "",
              marks_no: booking.marks_no || "",
              shipment_terms_code: booking.shipment_terms_code || "",
              cargo_details: Array.isArray(booking.cargo_details) ? 
              booking.cargo_details.map((cargo: Record<string, unknown>) => ({
                no_of_packages: cargo.no_of_packages || "",
                gross_weight: cargo.gross_weight || "",
                volume: cargo.volume || "",
                chargeable_weight: cargo.chargeable_weight || "",
                haz: booking.is_hazardous || ""
              })) : [],
              mawb_charges: Array.isArray(booking.rate_details) ? booking.rate_details.map((charge: Record<string, unknown>) => ({
                charge_id: charge.charge_id || "",
                supplier_code:  "",
                pp_cc: charge.pp_cc || "",
                unit_id: charge.unit_id || "",
                no_of_unit: charge.no_of_units || "",
                amount: charge.min_sell || "",
                amount_per_unit: charge.sell_per_unit || "",
                cost_local_amount: "",
                currency_id: charge.currency_id || "",
                roe: charge.roe || "",
                sell_local_amount: "",
                total_cost: charge.total_cost || "",
                unit_cost: charge.cost_per_unit || "",
              })) : [],
              events: Array.isArray(booking.events) ? booking.events.map((event: Record<string, unknown>) => ({
                event_id: event.event_id || "",
                event_name: event.event_name || "",
                event_date: event.event_date || "",
                event_status: event.event_status || "",
                event_description: event.event_description || "",
                event_type: event.event_type || "",
                event_priority: event.event_priority || "",
                event_location: event.event_location || "",
              })) : [],
            }],
    };

    setCreateJobModalOpen(true);
    setCreateJobLoading(true);
    setCreateJobResponse(null);
    setCreateJobError(null);

    try {
      const response = (await apiCallProtected.post(
        URL.jobCreate,
        payload,
      )) as Record<string, unknown>;
      setCreateJobResponse(response);
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { message?: string; detail?: string; error?: string } };
        message?: string;
      };
      const errMsg =
        axiosErr?.response?.data?.message ||
        axiosErr?.response?.data?.detail ||
        axiosErr?.response?.data?.error ||
        (err instanceof Error ? err.message : "Failed to create job");
      setCreateJobError(String(errMsg));
    } finally {
      setCreateJobLoading(false);
    }
  };

  const columns = useMemo<MRT_ColumnDef<ExportShipmentData>[]>(
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
                    onClick={() => handleCreateJob(row.original)}
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
          color: "#333740",
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
          backgroundColor: "#FBFBFB",
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
          color: "#444955",
          backgroundColor: "#FBFBFB",
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
                c={"#444955"}
                style={{ fontFamily: "Inter", fontSize: "16px" }}
              >
                Air Export Booking Lists
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
                      color: "#333740",
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
                  backgroundColor: "#FAFAFA",
                  padding: "8px 8px",
                  borderRadius: "8px",
                }}
              >
                <Text
                  size="sm"
                  fw={600}
                  c="#000000"
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
                    additionalParams={airTransportParams}
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
                    additionalParams={airTransportParams}
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
                  Loading air export booking...
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
      {/* Create Job Modal */}
      <Modal
        opened={createJobModalOpen}
        onClose={() => {
          if (!createJobLoading) {
            setCreateJobModalOpen(false);
            setCreateJobResponse(null);
            setCreateJobError(null);
          }
        }}
        title={
          <Text fw={600} size="md" c="#444955" style={{ fontFamily: "Inter" }}>
            Create Job
          </Text>
        }
        centered
        size="md"
        closeOnClickOutside={!createJobLoading}
        closeOnEscape={!createJobLoading}
        withCloseButton={!createJobLoading}
      >
        {createJobLoading ? (
          <Center py="xl">
            <Stack align="center" gap="md">
              <Loader size="md" color="#105476" />
              <Text c="dimmed" size="sm" style={{ fontFamily: "Inter" }}>
                Creating job, please wait...
              </Text>
            </Stack>
          </Center>
        ) : createJobError ? (
          <Stack gap="md">
            <Box
              style={{
                border: "1px solid #FFCDD2",
                borderRadius: "6px",
                padding: "12px 16px",
                backgroundColor: "#FFF5F5",
              }}
            >
              <Text size="sm" c="red" style={{ fontFamily: "Inter" }}>
                {createJobError}
              </Text>
            </Box>
            <Group justify="flex-end" gap="xs">
              <Button
                size="sm"
                variant="outline"
                styles={{
                  root: {
                    borderColor: "#105476",
                    color: "#105476",
                    borderRadius: "4px",
                    fontFamily: "Inter",
                  },
                }}
                onClick={() => {
                  setCreateJobModalOpen(false);
                  setCreateJobError(null);
                }}
              >
                Close
              </Button>
            </Group>
          </Stack>
        ) : createJobResponse ? (
          (() => {
            const respData = createJobResponse as {
              success?: boolean;
              message?: string;
              data?: {
                job_details_id?: number;
                id?: number;
                job_id?: string;
                job_no?: string;
              };
              job_details_id?: number;
              id?: number;
              job_id?: string;
            };
            const isSuccess =
              respData?.success === true || respData?.success === undefined;
            const message =
              respData?.message ||
              (isSuccess ? "Job created successfully!" : "Job creation failed.");
            const jobDetailsId =
              respData?.data?.job_details_id ??
              respData?.data?.id ??
              respData?.job_details_id ??
              respData?.id;
            const jobNo = respData?.data?.job_id || respData?.data?.job_no || respData?.job_id;

            return (
              <Stack gap="md">
                <Box
                  style={{
                    border: `1px solid ${isSuccess ? "#C8E6C9" : "#FFCDD2"}`,
                    borderRadius: "6px",
                    padding: "12px 16px",
                    backgroundColor: isSuccess ? "#F1F8E9" : "#FFF5F5",
                  }}
                >
                  <Text
                    size="sm"
                    fw={600}
                    c={isSuccess ? "green" : "red"}
                    style={{ fontFamily: "Inter" }}
                  >
                    {message}
                  </Text>
                </Box>

                {(jobDetailsId != null || jobNo) && (
                  <Box
                    style={{
                      border: "1px solid #E0E0E0",
                      borderRadius: "6px",
                      padding: "12px 16px",
                      backgroundColor: "#FAFAFA",
                    }}
                  >
                    <Stack gap="xs">
                      {jobDetailsId != null && (
                        <Group gap="xs">
                          <Text
                            size="sm"
                            fw={600}
                            c="#444955"
                            style={{ fontFamily: "Inter" }}
                          >
                            Job ID:
                          </Text>
                          <Text
                            size="sm"
                            c="#333740"
                            style={{ fontFamily: "Inter" }}
                          >
                            {String(jobDetailsId)}
                          </Text>
                        </Group>
                      )}
                      {jobNo && (
                        <Group gap="xs">
                          <Text
                            size="sm"
                            fw={600}
                            c="#444955"
                            style={{ fontFamily: "Inter" }}
                          >
                            Job No:
                          </Text>
                          <Text
                            size="sm"
                            c="#333740"
                            style={{ fontFamily: "Inter" }}
                          >
                            {String(jobNo)}
                          </Text>
                        </Group>
                      )}
                    </Stack>
                  </Box>
                )}

                <Group justify="flex-end" gap="xs">
                  {isSuccess && jobDetailsId != null && (
                    <Button
                      size="sm"
                      variant="outline"
                      styles={{
                        root: {
                          borderColor: "#105476",
                          color: "#105476",
                          borderRadius: "4px",
                          fontFamily: "Inter",
                        },
                      }}
                      onClick={() => {
                        setCreateJobModalOpen(false);
                        setCreateJobResponse(null);
                        navigate("/air/export-job/edit", {
                          state: { jobId: Number(jobDetailsId) },
                        });
                      }}
                    >
                      Open Job
                    </Button>
                  )}
                  <Button
                    size="sm"
                    styles={{
                      root: {
                        backgroundColor: "#105476",
                        borderRadius: "4px",
                        fontFamily: "Inter",
                        color: "#FFFFFF",
                      },
                    }}
                    onClick={() => {
                      setCreateJobModalOpen(false);
                      setCreateJobResponse(null);
                    }}
                  >
                    Close
                  </Button>
                </Group>
              </Stack>
            );
          })()
        ) : null}
      </Modal>

      <Outlet />
    </>
  );
}

export default AirExportBookingMaster;
