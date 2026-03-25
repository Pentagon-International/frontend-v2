import {
  Box,
  Button,
  Grid,
  Group,
  Tabs,
  Table,
  Text,
  Badge,
  ActionIcon,
  Menu,
  Modal,
  Loader,
  Center,
  Stack,
  ScrollArea,
  Select,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import {
  IconArrowLeft,
  IconChevronLeft,
  IconChevronRight,
  IconFileInvoice,
  IconPlus,
  IconTrash,
  IconDotsVertical,
  IconEye,
  IconEdit,
  IconDownload,
  IconX,
  IconRefresh,
  IconChevronDown,
  IconChevronUp,
  IconCalendar,
} from "@tabler/icons-react";
import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  Fragment,
} from "react";
import { useDebouncedCallback } from "@mantine/hooks";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { URL } from "../../../api/serverUrls";
import {
  SearchableSelect,
  Dropdown,
  ToastNotification,
  SingleDateInput,
} from "../../../components";
import { toTitleCase } from "../../../utils/textFormatter";
import { roundToDecimals } from "../../../utils/numberInputUtils";
import { generateCargoArrivalNoticePDF } from "../../jobs/pdf/CargoArrivalNoticePDFTemplate";
import { postAPICall } from "../../../service/postApiCall";
import { getAPICall } from "../../../service/getApiCall";
import { API_HEADER } from "../../../store/storeKeys";
import useAuthStore from "../../../store/authStore";
import FormTextInput from "../../../components/FormTextInput";
import RequiredLabel from "../../../components/RequiredLabel";
import FormTextArea from "../../../components/FormTextArea";
import FormNumberInput from "../../../components/FormNumberInput";
import { commonSearchAPI } from "../../../service/searchApi";

// Type definitions
type HAWBDetailsForm = {
  hawb_number: string;
  routed: string;
  routed_by: string;
  origin_code: string;
  origin_name: string;
  destination_code: string;
  destination_name: string;
  customer_service: string;
  trade: string;
  agent_name: string;
  agent_address: string;
  agent_email: string;
  /** internal select value; not sent in payload */
  cha_code: string;
  cha_name: string;
  cha_address: string;
  shipper_code: string;
  shipper_name: string;
  shipper_address: string;
  shipper_email: string;
  shipper_state_id: string;
  consignee_code: string;
  consignee_name: string;
  consignee_address: string;
  consignee_email: string;
  notify1_customer_name: string;
  notify1_customer_address: string;
  notify1_customer_email: string;
  notify2_customer_name: string;
  notify2_customer_address: string;
  notify2_customer_email: string;
  commodity_description: string;
  marks_no: string;
  item_no: string;
  sub_item_no: string;
  events: Array<{ id?: number; type: string; date: string }>;
  event_modal_rows: Array<{
    id?: number;
    eventType: string | null;
    eventDate: Date | null;
  }>;
};

// Type definitions for cargo details
type CargoDetail = {
  // container_number removed for Air HAWB
  no_of_packages: number | null;
  gross_weight: number | null;
  volume: number | null;
  chargeable_weight: number | null;
  haz: string;
};

// Type definitions for charges (charge_id, unit_id, currency_id sent in payload; id for update)
type ChargeDetail = {
  id?: number | null;
  charge_id: number | null;
  charge_name: string;
  pp_cc: string;
  unit_id: string;
  no_of_unit: number | null;
  currency_id: string;
  roe: number | null;
  amount_per_unit: number | null;
  amount: number | null;
  // Sell group UI fields
  local_amount?: number | null;
  // Cost group UI fields
  cost_per_unit?: number | null;
  total_cost?: number | null;
  cost_local_amount?: number | null;
  supplier_code?: string;
  supplier_name?: string;
};

// Reverse invoice item (from API reverse_invoices)
type ReverseInvoiceItem = {
  id?: number;
  reverse_invoice_id?: number;
  document_no?: string;
  document_date?: string;
  total?: string | number;
  status?: string;
  day_book_name?: string;
  [key: string]: unknown;
};

// Invoice list item from /api/filter/invoice/ response
type InvoiceListItem = {
  id: number;
  sno?: number;
  day_book_name?: string;
  day_book_code?: string;
  document_no?: string;
  document_date?: string;
  due_date?: string;
  status?: string;
  bill_to?: string;
  currency_code?: string;
  total?: string | number;
  charges?: Array<{
    amount?: string | number;
    amount_in_local?: string | number;
  }>;
  reverse_invoice_id?: number;
  reverse_invoices?: ReverseInvoiceItem[];
};

// Type definitions for salespersons
type SalespersonData = {
  id: number;
  sales_person: string;
  sales_coordinator: string;
  customer_service: string;
};

type SalespersonsResponse = {
  success: boolean;
  message: string;
  data: SalespersonData[];
};

const fetchSalespersons = async (customerId: string = "") => {
  const payload = {
    customer_code: customerId,
  };
  const response = await postAPICall(URL.salespersons, payload, API_HEADER);
  return response;
};

const fetchCurrencyMaster = async () => {
  try {
    const response = await getAPICall(`${URL.currencyMaster}`, API_HEADER);
    return response;
  } catch (error) {
    console.error("Error fetching currency master:", error);
    return [];
  }
};

const fetchUnitMaster = async (serviceType: string = "AIR") => {
  try {
    const payload = {
      filters: {
        service_type: serviceType,
      },
    };
    const response = (await postAPICall(
      URL.unitMasterFilter,
      payload,
      API_HEADER,
    )) as { data?: unknown[] };
    return response?.data || [];
  } catch (error) {
    console.error("Error fetching unit master:", error);
    return [];
  }
};

const fetchEventMaster = async () => {
  try {
    const payload = { filters: {} };
    const response = (await postAPICall(
      URL.eventMasterFilter,
      payload,
      API_HEADER,
    )) as { data?: unknown[] };
    return response?.data ?? [];
  } catch (error) {
    console.error("Error fetching event master:", error);
    return [];
  }
};

// Validation handled in validateStep1 and validateStep2 functions

const normalizePpCc = (value: unknown): string => {
  const raw = String(value ?? "")
    .trim()
    .toUpperCase();
  if (raw === "PP" || raw === "PREPAID") return "Prepaid";
  if (raw === "CC" || raw === "COLLECT") return "Collect";
  return "";
};

function HouseCreate() {
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);

  // Helper function to calculate ROE based on currency and user's country
  const getRoeValue = useCallback(
    (currency: string): number => {
      const userCountryCode = user?.country?.country_code;
      const currencyUpper = currency?.toUpperCase();

      if (userCountryCode === "IN") {
        if (currencyUpper === "INR") return 1;
        if (currencyUpper === "USD") return 88.75;
      } else if (userCountryCode === "AE") {
        if (currencyUpper === "AED") return 1;
        if (currencyUpper === "USD") return 3.67;
      }

      return 1;
    },
    [user?.country?.country_code],
  );

  // Calculate chargeable weight for AIR service (max of gross weight and volume weight)
  const calculateChargeableWeight = useCallback(
    (grossWeight: number | null, volumeWeight: number | null): number => {
      if (!grossWeight && !volumeWeight) return 0;
      const gross = grossWeight || 0;
      const volume = volumeWeight || 0;
      return Math.max(gross, volume);
    },
    [],
  );

  // State for address options (populated from addresses_data when shipper/consignee is selected)
  const [shipperAddressOptions, setShipperAddressOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [consigneeAddressOptions, setConsigneeAddressOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [notifyCustomerAddressOptions, setNotifyCustomerAddressOptions] =
    useState<Array<{ value: string; label: string }>>([]);
  const [notify2CustomerAddressOptions, setNotify2CustomerAddressOptions] =
    useState<Array<{ value: string; label: string }>>([]);
  const [agentAddressOptions, setAgentAddressOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);

  // Consignee (shipment-party) search state
  const [consigneeSearch, setConsigneeSearch] = useState("");
  const [consigneeOptions, setConsigneeOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  // Manual mode flag so we don't rapidly flip between Select/TextInput (prevents focus loss)
  const [consigneeManualMode, setConsigneeManualMode] = useState(false);
  const [consigneeHasResults, setConsigneeHasResults] = useState<
    boolean | null
  >(null);
  const consigneeDataRef = useRef<Record<string, Record<string, unknown>>>({});

  // Notify Customer (shipment-party) - same pattern as Consignee
  const [notifyCustomerSearch, setNotifyCustomerSearch] = useState("");
  const [notifyCustomerOptions, setNotifyCustomerOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [notifyCustomerHasResults, setNotifyCustomerHasResults] = useState<
    boolean | null
  >(null);
  const [notifyCustomerSelectedId, setNotifyCustomerSelectedId] = useState("");
  const notifyCustomerDataRef = useRef<Record<string, Record<string, unknown>>>(
    {},
  );

  // Notify Customer 2 (shipment-party) - same pattern as Consignee / Notify 1
  const [notify2CustomerSearch, setNotify2CustomerSearch] = useState("");
  const [notify2CustomerOptions, setNotify2CustomerOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [notify2CustomerHasResults, setNotify2CustomerHasResults] = useState<
    boolean | null
  >(null);
  const [notify2CustomerSelectedId, setNotify2CustomerSelectedId] =
    useState("");
  const notify2CustomerDataRef = useRef<
    Record<string, Record<string, unknown>>
  >({});

  // State for cargo details
  const [cargoDetails, setCargoDetails] = useState<CargoDetail[]>([
    {
      no_of_packages: null,
      gross_weight: null,
      volume: null,
      chargeable_weight: null,
      haz: "",
    },
  ]);

  // State for cargo details validation errors
  const [cargoErrors, setCargoErrors] = useState<
    Record<number, Record<string, string>>
  >({});

  // State for charges validation errors
  const [chargeErrors, setChargeErrors] = useState<
    Record<number, Record<string, string>>
  >({});

  // PDF Preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<string | null>(null);

  // Accounts tab: invoice list from filter/invoice API
  const [invoiceList, setInvoiceList] = useState<InvoiceListItem[]>([]);
  const [invoiceListLoading, setInvoiceListLoading] = useState(false);
  const [expandedInvoiceRowId, setExpandedInvoiceRowId] = useState<
    string | null
  >(null);

  // Charges Form - Using useForm similar to routings in ExportJobCreate
  const chargesForm = useForm<{ charges: ChargeDetail[] }>({
    initialValues: {
      charges: [
        {
          charge_id: null,
          charge_name: "",
          pp_cc: "",
          unit_id: "",
          no_of_unit: null,
          currency_id: "",
          roe: null,
          amount_per_unit: null,
          amount: null,
          local_amount: null,
          cost_per_unit: null,
          total_cost: null,
          cost_local_amount: null,
          supplier_code: "",
          supplier_name: "",
        },
      ],
    },
  });

  // Get existing housing details from location state if available
  // Check both hawbDetails and housingDetails for backward compatibility
  const existingHousingDetails =
    location.state?.hawbDetails || location.state?.housingDetails || [];
  const editIndex = location.state?.editIndex;
  const editData = location.state?.editData;
  const isEditMode = editIndex !== undefined && editData !== undefined;

  useEffect(() => {
    if (!isEditMode && active === 4) setActive(0);
  }, [active, isEditMode]);

  // Helper function to normalize routed value (handle backwards compatibility)
  const normalizeRoutedValue = (value: unknown): string => {
    if (typeof value === "boolean") {
      return value ? "self" : "";
    }
    if (typeof value === "string") {
      const lowerValue = value.toLowerCase();
      if (lowerValue === "self" || lowerValue === "agent") {
        return lowerValue;
      }
      // Handle old values like "Self", "Agent", etc.
      if (value === "Self") return "self";
      if (value === "Agent") return "agent";
    }
    return "";
  };

  // Form with all fields - pre-fill if in edit mode, auto-set from MAWB in create mode
  const form = useForm<HAWBDetailsForm>({
    initialValues: {
      hawb_number: editData?.hawb_number || editData?.hbl_number || "",
      routed: normalizeRoutedValue(editData?.routed),
      routed_by: editData?.routed_by || "",
      origin_code:
        editData?.origin_code ||
        (editIndex === undefined
          ? location.state?.mawbDetails?.origin_code ||
            location.state?.mawbDetails?.origin_code ||
            ""
          : ""),
      origin_name:
        editData?.origin_name ||
        (editIndex === undefined
          ? location.state?.mawbDetails?.origin_name ||
            location.state?.mawbDetails?.origin_name ||
            ""
          : ""),
      destination_code:
        editData?.destination_code ||
        (editIndex === undefined
          ? location.state?.mawbDetails?.destination_code ||
            location.state?.mawbDetails?.destination_code ||
            ""
          : ""),
      destination_name:
        editData?.destination_name ||
        (editIndex === undefined
          ? location.state?.mawbDetails?.destination_name ||
            location.state?.mawbDetails?.destination_name ||
            ""
          : ""),
      customer_service: editData?.customer_service || "",
      trade: editData?.trade || "Re Export",
      agent_name:
        (editData as { agent_name?: string } | undefined)?.agent_name || "",
      agent_address:
        (editData as { agent_address?: string } | undefined)?.agent_address ||
        "",
      agent_email:
        (editData as { agent_email?: string } | undefined)?.agent_email || "",
      cha_code: (editData as { cha_code?: string })?.cha_code ?? "",
      cha_name: (editData as { cha_name?: string })?.cha_name ?? "",
      cha_address: (editData as { cha_address?: string })?.cha_address ?? "",
      shipper_code: editData?.shipper_code || "", // Will be set when user selects from SearchableSelect
      shipper_name: editData?.shipper_name || "",
      shipper_address: editData?.shipper_address || "",
      shipper_email: editData?.shipper_email || "",
      shipper_state_id:
        editData?.shipper_state_id != null
          ? String(editData.shipper_state_id)
          : "",
      consignee_code: editData?.consignee_code || "", // Will be set when user selects from SearchableSelect
      consignee_name: editData?.consignee_name || "",
      consignee_address: editData?.consignee_address || "",
      consignee_email: editData?.consignee_email || "",
      notify1_customer_name:
        (editData as { notify1_customer_name?: string })
          ?.notify1_customer_name ??
        editData?.notify_customer1_name ??
        "",
      notify1_customer_address:
        (editData as { notify1_customer_address?: string })
          ?.notify1_customer_address ??
        editData?.notify_customer1_address ??
        "",
      notify1_customer_email:
        (editData as { notify1_customer_email?: string })
          ?.notify1_customer_email ??
        editData?.notify_customer1_email ??
        "",
      notify2_customer_name:
        (editData as { notify2_customer_name?: string })
          ?.notify2_customer_name ?? "",
      notify2_customer_address:
        (editData as { notify2_customer_address?: string })
          ?.notify2_customer_address ?? "",
      notify2_customer_email:
        (editData as { notify2_customer_email?: string })
          ?.notify2_customer_email ?? "",
      commodity_description: editData?.commodity_description || "",
      marks_no: editData?.marks_no || "",
      item_no: (editData as { item_no?: string } | undefined)?.item_no || "",
      sub_item_no:
        (editData as { sub_item_no?: string } | undefined)?.sub_item_no || "",
      events: Array.isArray(
        (editData as { events?: unknown } | undefined)?.events,
      )
        ? (
            (
              editData as
                | {
                    events?: Array<{
                      id?: number;
                      type?: string;
                      date?: string;
                    }>;
                  }
                | undefined
            )?.events ?? []
          ).map((e) => ({
            id: e.id != null ? Number(e.id) : undefined,
            type: String(e.type ?? ""),
            date: String(e.date ?? ""),
          }))
        : (() => {
            const jobEvents =
              (
                location.state?.job as {
                  housing_details?: Array<{
                    events?: Array<{
                      id?: number;
                      type?: string;
                      date?: string;
                    }>;
                  }>;
                }
              )?.housing_details?.[editIndex ?? 0]?.events ?? [];
            if (!Array.isArray(jobEvents)) return [];
            return jobEvents.map((e) => ({
              id: e.id != null ? Number(e.id) : undefined,
              type: String(e.type ?? ""),
              date: String(e.date ?? ""),
            }));
          })(),
      event_modal_rows: [
        ...(() => {
          const sourceEvents =
            (
              editData as
                | {
                    events?: Array<{
                      id?: number;
                      type?: string;
                      date?: string;
                    }>;
                  }
                | undefined
            )?.events ??
            (
              location.state?.job as {
                housing_details?: Array<{
                  events?: Array<{ id?: number; type?: string; date?: string }>;
                }>;
              }
            )?.housing_details?.[editIndex ?? 0]?.events ??
            [];
          if (!Array.isArray(sourceEvents) || sourceEvents.length === 0) {
            return [];
          }
          return sourceEvents.map((e) => ({
            id: e.id != null ? Number(e.id) : undefined,
            eventType: String(e.type ?? ""),
            eventDate: e.date ? new Date(String(e.date)) : null,
          }));
        })(),
        { id: undefined, eventType: null, eventDate: null },
      ],
    },
    validate: () => {
      // Validation handled in validateStep functions
      return {};
    },
  });

  const { data: eventMasterData = [] } = useQuery({
    queryKey: ["eventMaster"],
    queryFn: fetchEventMaster,
    staleTime: 5 * 60 * 1000,
  });

  const eventTypeOptions = useMemo(() => {
    const list = eventMasterData as Array<{ name?: string }>;
    if (!list?.length) return [];
    return list.map((item) => {
      const name = String(item.name ?? "");
      return { value: name, label: name };
    });
  }, [eventMasterData]);

  const [eventsModalOpen, setEventsModalOpen] = useState(false);

  const addEventRow = () => {
    form.insertListItem("event_modal_rows", {
      id: undefined,
      eventType: null,
      eventDate: null,
    });
  };

  const updateEventRow = (
    index: number,
    field: "eventType" | "eventDate",
    value: string | Date | null,
  ) => {
    form.setFieldValue(`event_modal_rows.${index}.${field}`, value);
  };

  const removeEventRow = (index: number) => {
    if (form.values.event_modal_rows.length > 1) {
      form.removeListItem("event_modal_rows", index);
    }
  };

  const handleSubmitEventsModal = () => {
    const rows = form.values.event_modal_rows;
    const toAdd: Array<{ id?: number; type: string; date: string }> = [];

    for (const row of rows) {
      if (row.eventType && row.eventDate) {
        const item: { id?: number; type: string; date: string } = {
          type: row.eventType,
          date:
            row.eventDate instanceof Date
              ? row.eventDate.toISOString().split("T")[0]
              : String(row.eventDate),
        };
        if (row.id != null) {
          item.id = typeof row.id === "number" ? row.id : Number(row.id);
        }
        toAdd.push(item);
      }
    }

    form.setFieldValue("events", toAdd);
    form.setFieldValue("event_modal_rows", [
      { id: undefined, eventType: null, eventDate: null },
    ]);
    setEventsModalOpen(false);
  };

  // Memoize additionalParams to prevent SearchableSelect from recreating fetchData on every render
  const seaTransportParams = useMemo(() => ({ transport_mode: "SEA" }), []);

  // Auto-calculate chargeable weight when gross weight or volume weight changes
  const cargoGrossWeights = cargoDetails.map((c) => c.gross_weight).join(",");
  const cargoVolumeWeights = cargoDetails.map((c) => c.volume).join(",");

  useEffect(() => {
    const updatedCargoDetails = cargoDetails.map((cargo) => {
      const chargeableWeight = calculateChargeableWeight(
        cargo.gross_weight,
        cargo.volume,
      );
      // Only update if chargeable_weight changed
      if (cargo.chargeable_weight === chargeableWeight) {
        return cargo;
      }
      return {
        ...cargo,
        chargeable_weight: chargeableWeight > 0 ? chargeableWeight : null,
      };
    });

    // Only update if there are actual changes
    const hasChanges = updatedCargoDetails.some(
      (cargo, index) =>
        cargo.chargeable_weight !== cargoDetails[index]?.chargeable_weight,
    );

    if (hasChanges) {
      setCargoDetails(updatedCargoDetails);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargoGrossWeights, cargoVolumeWeights, calculateChargeableWeight]);

  // Fetch invoice list when Accounts tab is active
  useEffect(() => {
    if (active !== 4) return;
    setInvoiceListLoading(true);
    postAPICall(
      URL.invoiceCombined,
      { filters: { shipment_no: editData?.shipment_id, is_agent: false } },
      API_HEADER,
    )
      .then((res: unknown) => {
        const data = (res as { data?: InvoiceListItem[] })?.data;
        setInvoiceList(Array.isArray(data) ? data : []);
      })
      .catch(() => setInvoiceList([]))
      .finally(() => setInvoiceListLoading(false));
  }, [active]);

  // Track if form has been initialized from editData to prevent overwriting user changes (reset when editData id/index changes) - same as AirImportJob
  const formInitializedFromEditDataRef = useRef(false);
  const lastEditKeyRef = useRef<string>("");

  // Initialize form values from editData when in edit mode (re-run when editData/editIndex changes so different house loads) - same as AirImportJob
  useEffect(() => {
    if (!isEditMode || !editData) {
      return;
    }

    const editKey = `${editIndex}-${(editData as { id?: number })?.id ?? "new"}`;
    if (lastEditKeyRef.current !== editKey) {
      formInitializedFromEditDataRef.current = false;
      lastEditKeyRef.current = editKey;
    }

    if (!formInitializedFromEditDataRef.current) {
      // Set all form values from editData (main form fields - only once per house)
      form.setValues({
        hawb_number:
          editData.hawb_number || editData.hbl_number || editData.hawb_no || "",
        routed: normalizeRoutedValue(editData.routed),
        routed_by: editData.routed_by || "",
        origin_code: editData.origin_code || "",
        origin_name: editData.origin_name || "",
        destination_code: editData.destination_code || "",
        destination_name: editData.destination_name || "",
        customer_service: editData.customer_service || "",
        trade: editData.trade || "Re Export",
        agent_name: (editData as { agent_name?: string }).agent_name || "",
        agent_address:
          (editData as { agent_address?: string }).agent_address || "",
        agent_email: (editData as { agent_email?: string }).agent_email || "",
        shipper_code: "", // Will be set when user selects from SearchableSelect
        shipper_name: editData.shipper_name || "",
        shipper_address: editData.shipper_address || "",
        shipper_email: editData.shipper_email || "",
        shipper_state_id:
          editData.shipper_state_id != null
            ? String(editData.shipper_state_id)
            : "",
        // For Air Export house, API payload only needs name/address/email.
        // Use consignee_name as the internal Select key so it shows in-field on edit.
        consignee_code: editData.consignee_name
          ? toTitleCase(String(editData.consignee_name))
          : "",
        consignee_name: editData.consignee_name || "",
        consignee_address: editData.consignee_address || "",
        consignee_email: editData.consignee_email || "",
        notify1_customer_name:
          (editData as { notify1_customer_name?: string })
            .notify1_customer_name ??
          editData.notify_customer1_name ??
          "",
        notify1_customer_address:
          (editData as { notify1_customer_address?: string })
            .notify1_customer_address ??
          editData.notify_customer1_address ??
          "",
        notify1_customer_email:
          (editData as { notify1_customer_email?: string })
            .notify1_customer_email ??
          editData.notify_customer1_email ??
          "",
        notify2_customer_name:
          (editData as { notify2_customer_name?: string })
            .notify2_customer_name ?? "",
        notify2_customer_address:
          (editData as { notify2_customer_address?: string })
            .notify2_customer_address ?? "",
        notify2_customer_email:
          (editData as { notify2_customer_email?: string })
            .notify2_customer_email ?? "",
        commodity_description: editData.commodity_description || "",
        marks_no: editData.marks_no || "",
      });

      // Prefill consignee search and options so the Consignee field shows on edit
      if (editData.consignee_name) {
        const name = toTitleCase(String(editData.consignee_name));
        setConsigneeSearch(name);
        setConsigneeOptions([{ value: name, label: name }]);
        consigneeDataRef.current[name] = {
          customer_name: name,
        } as Record<string, unknown>;
      }

      // Prefill notify customer 1 search and options so the Notify Customer 1 field shows on edit
      const notify1Name =
        (editData as { notify1_customer_name?: string })
          .notify1_customer_name ?? editData.notify_customer1_name;
      if (notify1Name) {
        const name = toTitleCase(String(notify1Name));
        setNotifyCustomerSearch(name);
        setNotifyCustomerOptions([{ value: name, label: name }]);
        setNotifyCustomerSelectedId(name);
        notifyCustomerDataRef.current[name] = {
          customer_name: name,
        } as Record<string, unknown>;
      }
      // Prefill notify customer 2 search and options
      const notify2Name = (editData as { notify2_customer_name?: string })
        .notify2_customer_name;
      if (notify2Name) {
        const name = toTitleCase(String(notify2Name));
        setNotify2CustomerSearch(name);
        setNotify2CustomerOptions([{ value: name, label: name }]);
        setNotify2CustomerSelectedId(name);
        notify2CustomerDataRef.current[name] = {
          customer_name: name,
        } as Record<string, unknown>;
        if (
          (editData as { notify2_customer_address?: string })
            .notify2_customer_address
        ) {
          setNotify2CustomerAddressOptions([
            {
              value: String(
                (editData as { notify2_customer_address?: string })
                  .notify2_customer_address,
              ),
              label: String(
                (editData as { notify2_customer_address?: string })
                  .notify2_customer_address,
              ),
            },
          ]);
        }
      }
    }

    // Always load cargo_details and charges when editData has them (run every time so data is set even if init ref was already true) - same as AirImportJob
    if (editData.cargo_details && Array.isArray(editData.cargo_details)) {
      const loadedCargoDetails = editData.cargo_details.map(
        (cargo: Record<string, unknown>) => ({
          no_of_packages: cargo.no_of_packages as number | null,
          gross_weight: cargo.gross_weight as number | null,
          volume: (cargo.volume || cargo.volume) as number | null,
          chargeable_weight: cargo.chargeable_weight as number | null,
          haz: cargo.haz ? String(cargo.haz) : "",
        }),
      );
      if (loadedCargoDetails.length > 0) {
        setCargoDetails(loadedCargoDetails);
      }
    }

    // Load charges when editData has them - same as AirImportJob
    const chargesToLoad =
      (editData.charges && Array.isArray(editData.charges)
        ? editData.charges
        : null) ||
      (editData as { mawb_charges?: unknown[] }).mawb_charges ||
      [];
    console.log("_____chargesToLoad", chargesToLoad);
    const chargesArray = Array.isArray(chargesToLoad) ? chargesToLoad : [];
    if (chargesArray.length > 0) {
      const unitDataArr: { id?: number; unit_code?: string }[] = [];
      const currencyDataArr: {
        id?: number;
        code?: string;
        currency_code?: string;
      }[] = [];
      const loadedCharges = chargesArray.map(
        (charge: Record<string, unknown>) => {
          console.log("_____charge LOADED", charge);
          const unitDetails = charge.unit_details as
            | { unit_id?: number; unit_code?: string }
            | undefined;
          const currencyDetails = charge.currency_details as
            | { currency_id?: number; currency_code?: string }
            | undefined;
          const unitCode = String(
            charge.unit_code ??
              charge.unit_input ??
              unitDetails?.unit_code ??
              "",
          ).trim();
          const currencyCode = String(
            currencyDetails?.currency_code ?? charge.currency_code ?? "",
          ).trim();
          const pp_cc = normalizePpCc(charge.pp_cc);
          const toNum = (v: unknown): number | null => {
            if (v == null) return null;
            if (typeof v === "number" && !Number.isNaN(v)) return v;
            const n = parseFloat(String(v));
            return Number.isNaN(n) ? null : n;
          };
          const chargeId =
            charge.charge_id != null
              ? Number(charge.charge_id)
              : charge.id != null
                ? Number(charge.id)
                : null;
          const unitIdFromApi =
            charge.unit_id != null
              ? String(charge.unit_id)
              : charge.unit != null
                ? String(charge.unit)
                : unitDetails?.unit_id != null
                  ? String(unitDetails.unit_id)
                  : null;
          const currencyIdFromApi =
            charge.currency_id != null
              ? String(charge.currency_id)
              : charge.currency != null
                ? String(charge.currency)
                : currencyDetails?.currency_id != null
                  ? String(currencyDetails.currency_id)
                  : null;
          const unitByCode = unitCode
            ? unitDataArr.find((u) => (u.unit_code ?? "") === unitCode)
            : null;
          const currByCode = currencyCode
            ? currencyDataArr.find(
                (c) => (c.currency_code ?? c.code ?? "") === currencyCode,
              )
            : null;
          const unit_id =
            unitIdFromApi ??
            (unitByCode?.id != null ? String(unitByCode.id) : "");
          const currency_id =
            currencyIdFromApi ??
            (currByCode?.id != null ? String(currByCode.id) : "");
          return {
            id: charge.id != null ? Number(charge.id) : undefined,
            charge_id: chargeId,
            charge_name: charge.charge_name ? String(charge.charge_name) : "",
            supplier_code: charge.supplier_code ? String(charge.supplier_code) : "",
            supplier_name: charge.supplier_name ? String(charge.supplier_name) : "",
            pp_cc,
            unit_id,
            no_of_unit: toNum(charge.no_of_unit),
            currency_id,
            roe: toNum(charge.roe),
            amount_per_unit: toNum(charge.amount_per_unit),
            amount: toNum(charge.amount),
            local_amount: toNum(charge.sell_local_amount ?? charge.local_amount),
            cost_per_unit: toNum(charge.unit_cost ?? charge.cost_per_unit),
            total_cost: toNum(charge.total_cost),
            cost_local_amount: toNum(charge.cost_local_amount),
          };
        },
      );
      if (loadedCharges.length > 0) {
        chargesForm.setValues({ charges: loadedCharges });
      }
    }

    formInitializedFromEditDataRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, editData, editIndex]);

  // Auto-calculate amount, local_amount, cost_local_amount when dependencies change
  // amount = no_of_unit * amount_per_unit
  // local_amount = amount * roe
  // cost_local_amount = total_cost * roe
  const chargeAmountPerUnits = chargesForm.values.charges
    .map((c) => c.amount_per_unit)
    .join(",");
  const chargeNoOfUnits = chargesForm.values.charges
    .map((c) => c.no_of_unit)
    .join(",");
  const chargeRoes = chargesForm.values.charges.map((c) => c.roe).join(",");
  const chargeAmounts = chargesForm.values.charges.map((c) => c.amount).join(",");
  const chargeTotalCosts = chargesForm.values.charges
    .map((c) => c.total_cost)
    .join(",");

  useEffect(() => {
    const updatedCharges = chargesForm.values.charges.map((charge) => {
      const next = { ...charge };

      // Recalculate amount from no_of_unit and amount_per_unit
      if (
        charge.amount_per_unit !== null &&
        charge.amount_per_unit !== undefined &&
        charge.amount_per_unit > 0
      ) {
        const noOfUnit = charge.no_of_unit || 0;
        const amountPerUnit = charge.amount_per_unit || 0;
        const calculatedAmount = parseFloat((noOfUnit * amountPerUnit).toFixed(2));
        if (calculatedAmount > 0 && calculatedAmount !== next.amount) {
          next.amount = calculatedAmount;
        }
      }

      // Recalculate local_amount (sell) from amount and roe
      if (
        next.amount !== null &&
        next.amount !== undefined &&
        next.amount > 0 &&
        next.roe !== null &&
        next.roe !== undefined &&
        next.roe > 0
      ) {
        const calculatedLocal = next.amount * next.roe;
        if (calculatedLocal !== next.local_amount) {
          next.local_amount = calculatedLocal;
        }
      } else {
        if (next.local_amount !== null && next.local_amount !== undefined) {
          next.local_amount = null;
        }
      }

      // Recalculate cost_local_amount from total_cost and roe
      if (
        next.total_cost !== null &&
        next.total_cost !== undefined &&
        next.total_cost > 0 &&
        next.roe !== null &&
        next.roe !== undefined &&
        next.roe > 0
      ) {
        const calculatedCostLocal = next.total_cost * next.roe;
        if (calculatedCostLocal !== next.cost_local_amount) {
          next.cost_local_amount = calculatedCostLocal;
        }
      } else {
        if (next.cost_local_amount !== null && next.cost_local_amount !== undefined) {
          next.cost_local_amount = null;
        }
      }

      return next;
    });

    // Only update if there are actual changes
    const hasChanges = updatedCharges.some((charge, index) => {
      const original = chargesForm.values.charges[index];
      return (
        charge.amount !== original?.amount ||
        charge.local_amount !== original?.local_amount ||
        charge.cost_local_amount !== original?.cost_local_amount
      );
    });

    if (hasChanges) {
      chargesForm.setValues({ charges: updatedCharges });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chargeAmountPerUnits, chargeNoOfUnits, chargeRoes, chargeAmounts, chargeTotalCosts]);

  // Salespersons data query
  const { data: rawSalespersonsData = [] } = useQuery({
    queryKey: ["salespersons", ""],
    queryFn: () => fetchSalespersons(""),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    enabled: true,
  });

  // Format salespersons data
  const salespersonsData = useMemo(() => {
    const response = rawSalespersonsData as SalespersonsResponse;
    if (
      !response?.data ||
      !Array.isArray(response.data) ||
      !response.data.length
    )
      return [];

    return response.data.map((item) => ({
      value: item.sales_person ? String(item.sales_person) : "",
      label: item.sales_person,
      sales_coordinator: item.sales_coordinator || "",
      customer_service: item.customer_service || "",
    }));
  }, [rawSalespersonsData]);

  // Currency master query
  const { data: currencyData = [] } = useQuery({
    queryKey: ["currencyMaster"],
    queryFn: fetchCurrencyMaster,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  // Unit master query - use AIR for Air Export House
  const { data: unitDataRaw = [] } = useQuery({
    queryKey: ["unitMaster", "AIR"],
    queryFn: () => fetchUnitMaster("AIR"),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  // Format currency data: value = id, label = currency_code (for payload we send currency_id)
  const currencyOptions = useMemo(() => {
    if (!Array.isArray(currencyData)) return [];
    const data = currencyData as {
      id?: number;
      code?: string;
      currency_code?: string;
    }[];
    return data.map((item) => {
      const code = item.currency_code ?? item.code ?? "";
      const id = item.id != null ? String(item.id) : "";
      return { value: id || code, label: code || id || "" };
    });
  }, [currencyData]);

  // Format unit data: value = id, label = unit_name or unit_code (for payload we send unit_id)
  const unitOptions = useMemo(() => {
    if (!Array.isArray(unitDataRaw)) return [];
    const data = unitDataRaw as {
      id?: number;
      unit_code?: string;
      unit_name?: string;
      name?: string;
    }[];
    return data.map((item) => {
      const label = item.unit_name ?? item.name ?? item.unit_code ?? "";
      const id = item.id != null ? String(item.id) : "";
      return {
        value: id || String(item.unit_code ?? ""),
        label: label || String(item.unit_code ?? ""),
      };
    });
  }, [unitDataRaw]);

  // Debounced shipment-party search for Consignee (export flow)
  const debouncedConsigneeSearch = useDebouncedCallback(
    async (term: string) => {
      const query = term.trim();
      if (!query || query.length < 2) {
        setConsigneeOptions([]);
        setConsigneeHasResults(null);
        setConsigneeManualMode(false);
        consigneeDataRef.current = {};
        return;
      }

      try {
        const results = await commonSearchAPI({
          endpoint: URL.shipmentParty,
          query,
        });

        const arr = Array.isArray(results)
          ? (results as Record<string, unknown>[])
          : [];

        if (!arr.length) {
          setConsigneeOptions([]);
          setConsigneeHasResults(false);
          setConsigneeManualMode(true);
          consigneeDataRef.current = {};
          // When shipment-party has no matches, keep user's typed text as manual entry
          form.setFieldValue("consignee_code", "");
          form.setFieldValue("consignee_name", query);
          return;
        }

        const map: Record<string, Record<string, unknown>> = {};
        const opts = arr.map((item) => {
          const id = String(item.id ?? "");
          map[id] = item;
          return {
            value: id,
            label: String(item.customer_name || ""),
          };
        });

        consigneeDataRef.current = map;
        setConsigneeOptions(opts);
        setConsigneeHasResults(true);
        setConsigneeManualMode(false);
      } catch (error) {
        console.error("Consignee shipment-party search failed:", error);
        setConsigneeOptions([]);
        setConsigneeHasResults(null);
        setConsigneeManualMode(false);
        consigneeDataRef.current = {};
      }
    },
    500,
  );

  // Debounced shipment-party search for Notify Customer 1 - same API & pattern as Consignee
  const debouncedNotifyCustomerSearch = useDebouncedCallback(
    async (term: string) => {
      const query = term.trim();
      if (!query || query.length < 2) {
        setNotifyCustomerOptions([]);
        setNotifyCustomerHasResults(null);
        setNotifyCustomerSelectedId("");
        notifyCustomerDataRef.current = {};
        setNotifyCustomerAddressOptions([]);
        form.setFieldValue("notify1_customer_address", "");
        form.setFieldValue("notify1_customer_email", "");
        return;
      }

      try {
        const results = await commonSearchAPI({
          endpoint: URL.shipmentParty,
          query,
        });

        const arr = Array.isArray(results)
          ? (results as Record<string, unknown>[])
          : [];

        if (!arr.length) {
          setNotifyCustomerOptions([]);
          setNotifyCustomerHasResults(false);
          notifyCustomerDataRef.current = {};
          setNotifyCustomerAddressOptions([]);
          form.setFieldValue("notify1_customer_name", query);
          form.setFieldValue("notify1_customer_address", "");
          form.setFieldValue("notify1_customer_email", "");
          return;
        }

        const map: Record<string, Record<string, unknown>> = {};
        const opts = arr.map((item) => {
          const id = String(item.id ?? "");
          map[id] = item;
          return {
            value: id,
            label: String(item.customer_name || ""),
          };
        });

        notifyCustomerDataRef.current = map;
        setNotifyCustomerOptions(opts);
        setNotifyCustomerHasResults(true);
      } catch (error) {
        console.error("Notify customer 1 shipment-party search failed:", error);
        setNotifyCustomerOptions([]);
        setNotifyCustomerHasResults(null);
        notifyCustomerDataRef.current = {};
        setNotifyCustomerAddressOptions([]);
        form.setFieldValue("notify1_customer_address", "");
        form.setFieldValue("notify1_customer_email", "");
      }
    },
    500,
  );

  // Debounced shipment-party search for Notify Customer 2 - same API as Consignee / Notify 1
  const debouncedNotify2CustomerSearch = useDebouncedCallback(
    async (term: string) => {
      const query = term.trim();
      if (!query || query.length < 2) {
        setNotify2CustomerOptions([]);
        setNotify2CustomerHasResults(null);
        setNotify2CustomerSelectedId("");
        notify2CustomerDataRef.current = {};
        setNotify2CustomerAddressOptions([]);
        form.setFieldValue("notify2_customer_address", "");
        form.setFieldValue("notify2_customer_email", "");
        return;
      }

      try {
        const results = await commonSearchAPI({
          endpoint: URL.shipmentParty,
          query,
        });

        const arr = Array.isArray(results)
          ? (results as Record<string, unknown>[])
          : [];

        if (!arr.length) {
          setNotify2CustomerOptions([]);
          setNotify2CustomerHasResults(false);
          notify2CustomerDataRef.current = {};
          setNotify2CustomerAddressOptions([]);
          form.setFieldValue("notify2_customer_name", query);
          form.setFieldValue("notify2_customer_address", "");
          form.setFieldValue("notify2_customer_email", "");
          return;
        }

        const map: Record<string, Record<string, unknown>> = {};
        const opts = arr.map((item) => {
          const id = String(item.id ?? "");
          map[id] = item;
          return {
            value: id,
            label: String(item.customer_name || ""),
          };
        });

        notify2CustomerDataRef.current = map;
        setNotify2CustomerOptions(opts);
        setNotify2CustomerHasResults(true);
      } catch (error) {
        console.error("Notify customer 2 shipment-party search failed:", error);
        setNotify2CustomerOptions([]);
        setNotify2CustomerHasResults(null);
        notify2CustomerDataRef.current = {};
        setNotify2CustomerAddressOptions([]);
        form.setFieldValue("notify2_customer_address", "");
        form.setFieldValue("notify2_customer_email", "");
      }
    },
    500,
  );

  const getPartyEmail = (original: Record<string, unknown>): string => {
    const email =
      (original.customer_email as string | undefined) ??
      (original.email as string | undefined) ??
      (original.customerEmail as string | undefined) ??
      "";
    return String(email || "");
  };

  const getPartyAddresses = (
    original: Record<string, unknown>,
  ): Array<{ address?: string }> => {
    const raw =
      (original.addresses_data as unknown) ??
      (original.addresses as unknown) ??
      (original.address_data as unknown);
    if (!Array.isArray(raw)) return [];
    return (raw as Array<Record<string, unknown>>).map((a) => ({
      address:
        (a.address as string | undefined) ?? (a.address1 as string | undefined),
    }));
  };

  // Auto-set ROE when currency_id changes (resolve code from currencyData, then getRoeValue)
  const chargeCurrencyIds = chargesForm.values.charges
    .map((c) => c.currency_id)
    .join(",");
  useEffect(() => {
    const currencyArr = (currencyData ?? []) as {
      id?: number;
      code?: string;
      currency_code?: string;
    }[];
    const updatedCharges = chargesForm.values.charges.map((charge) => {
      let roe = charge.roe;
      if (charge.currency_id && !roe) {
        const curr = currencyArr.find(
          (c) => String(c.id) === charge.currency_id,
        );
        const code = curr?.currency_code ?? curr?.code ?? "";
        if (code) roe = getRoeValue(code);
      }
      if (roe !== charge.roe) {
        return { ...charge, roe: roe || null };
      }
      return charge;
    });
    const hasChanges = updatedCharges.some(
      (charge, index) => charge.roe !== chargesForm.values.charges[index]?.roe,
    );
    if (hasChanges) chargesForm.setValues({ charges: updatedCharges });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chargeCurrencyIds, getRoeValue, currencyData]);

  // When in edit mode and unit/currency masters load, resolve charge unit_id/currency_id from unit_code/currency
  const chargesIdsResolvedRef = useRef(false);
  useEffect(() => {
    const unitArr = Array.isArray(unitDataRaw) ? unitDataRaw : [];
    const currArr = Array.isArray(currencyData) ? currencyData : [];
    if (
      !isEditMode ||
      !editData ||
      unitArr.length === 0 ||
      currArr.length === 0 ||
      chargesIdsResolvedRef.current
    ) {
      return;
    }
    // const chargesToLoad = editData.charges || editData.mawb_charges;
    // if (!chargesToLoad || !Array.isArray(chargesToLoad)) return;
    const chargesToLoad =
      (editData.charges && Array.isArray(editData.charges)
        ? editData.charges
        : null) ||
      (editData as { mawb_charges?: unknown[] }).mawb_charges ||
      [];
    const chargesArray = Array.isArray(chargesToLoad) ? chargesToLoad : [];
    const unitDataArr = unitArr as { id?: number; unit_code?: string }[];
    const currencyDataArr = currArr as {
      id?: number;
      code?: string;
      currency_code?: string;
    }[];
    const loadedCharges = chargesToLoad.map(
      (charge: Record<string, unknown>) => {
        const unitDetails = charge.unit_details as
          | { unit_id?: number; unit_code?: string }
          | undefined;
        const currencyDetails = charge.currency_details as
          | { currency_id?: number; currency_code?: string }
          | undefined;
        const unitCode = String(
          charge.unit_code ?? charge.unit_input ?? unitDetails?.unit_code ?? "",
        ).trim();
        const currencyCode = String(
          currencyDetails?.currency_code ?? charge.currency_code ?? "",
        ).trim();
        const pp_cc = normalizePpCc(charge.pp_cc);
        const toNum = (v: unknown): number | null => {
          if (v == null) return null;
          if (typeof v === "number" && !Number.isNaN(v)) return v;
          const n = parseFloat(String(v));
          return Number.isNaN(n) ? null : n;
        };
        const chargeId =
          charge.charge_id != null
            ? Number(charge.charge_id)
            : charge.id != null
              ? Number(charge.id)
              : null;
        const unitIdFromApi =
          charge.unit_id != null
            ? String(charge.unit_id)
            : charge.unit != null
              ? String(charge.unit)
              : unitDetails?.unit_id != null
                ? String(unitDetails.unit_id)
                : null;
        const currencyIdFromApi =
          charge.currency_id != null
            ? String(charge.currency_id)
            : charge.currency != null
              ? String(charge.currency)
              : currencyDetails?.currency_id != null
                ? String(currencyDetails.currency_id)
                : null;
        const unitByCode = unitCode
          ? unitDataArr.find((u) => (u.unit_code ?? "") === unitCode)
          : null;
        const currByCode = currencyCode
          ? currencyDataArr.find(
              (c) => (c.currency_code ?? c.code ?? "") === currencyCode,
            )
          : null;
        const unit_id =
          unitIdFromApi ??
          (unitByCode?.id != null ? String(unitByCode.id) : "");
        const currency_id =
          currencyIdFromApi ??
          (currByCode?.id != null ? String(currByCode.id) : "");
        return {
          id: charge.id != null ? Number(charge.id) : undefined,
          charge_id: chargeId,
          charge_name: charge.charge_name ? String(charge.charge_name) : "",
          pp_cc,
          unit_id,
          no_of_unit: toNum(charge.no_of_unit),
          currency_id,
          roe: toNum(charge.roe),
          amount_per_unit: toNum(charge.amount_per_unit),
          amount: toNum(charge.amount),
          local_amount: toNum(charge.sell_local_amount ?? charge.local_amount),
          cost_per_unit: toNum(charge.unit_cost ?? charge.cost_per_unit),
          total_cost: toNum(charge.total_cost),
          cost_local_amount: toNum(charge.cost_local_amount),
        };
      },
    );
    if (loadedCharges.length > 0) {
      chargesForm.setValues({ charges: loadedCharges });
      chargesIdsResolvedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, editData, unitDataRaw, currencyData]);

  // Note: Container numbers removed for Air HAWB - no containerNumberOptions needed

  // Auto-set routed_by when routed is "self" and user data is available
  useEffect(() => {
    if (
      form.values.routed === "self" &&
      user?.full_name &&
      !form.values.routed_by
    ) {
      form.setFieldValue("routed_by", user.full_name);
    }
  }, [form.values.routed, user?.full_name, form]);

  // Clear routed_by when routed changes to something other than "agent" or "self"
  useEffect(() => {
    if (
      form.values.routed &&
      form.values.routed !== "agent" &&
      form.values.routed !== "self"
    ) {
      form.setFieldValue("routed_by", "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.values.routed]);

  // Trade dropdown options (not used for export pages - trade is always "Export")
  const tradeOptions = [
    { value: "Import", label: "Import" },
    { value: "Transshipment", label: "Transshipment" },
    { value: "Re Export", label: "Re Export" },
  ];

  // Ensure trade is always "Re Export" for export pages
  useEffect(() => {
    if (form.values.trade !== "Re Export") {
      form.setFieldValue("trade", "Re Export");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.values.trade]);

  // Function to update Trade field based on destination comparison
  const updateTradeField = (hawbDestinationCode: string) => {
    console.log("🔄 updateTradeField called with:", hawbDestinationCode);
    const mawbDestinationCode =
      location.state?.mawbDetails?.destination_code ||
      location.state?.mawbDetails?.destination_code ||
      "";

    console.log("🔍 updateTradeField comparison:", {
      hawbDestinationCode,
      mawbDestinationCode,
      currentTradeValue: form.values.trade,
    });

    // Only update if both destinations exist
    if (hawbDestinationCode && mawbDestinationCode) {
      // Compare HAWB destination with MAWB destination
      const newTradeValue =
        hawbDestinationCode === mawbDestinationCode
          ? "Import"
          : "Transshipment";

      console.log("💡 updateTradeField calculated value:", newTradeValue);

      // Always update to ensure dropdown re-renders
      console.log("✏️ updateTradeField updating Trade to:", newTradeValue);
      form.setFieldValue("trade", newTradeValue);
      // Force form state update by setting values directly
      form.setValues({
        ...form.values,
        trade: newTradeValue,
      });
      console.log(
        "📊 updateTradeField after update, form.values.trade:",
        form.values.trade,
      );
    } else if (!hawbDestinationCode && form.values.trade) {
      // Clear trade if HAWB destination is cleared
      console.log("🧹 updateTradeField clearing Trade");
      form.setFieldValue("trade", "");
    }
  };

  // Auto-update Trade field whenever HAWB destination or MAWB destination changes
  useEffect(() => {
    const mawbDestinationCode =
      location.state?.mawbDetails?.destination_code || "";
    console.log("🔄 useEffect triggered for Trade update:", {
      destinationCode: form.values.destination_code,
      mawbDestinationCode,
      currentTradeValue: form.values.trade,
    });
    updateTradeField(form.values.destination_code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    form.values.destination_code,
    location.state?.mawbDetails?.destination_code,
  ]);

  // Auto-set HAWB origin and destination from MAWB in create mode
  useEffect(() => {
    const mawbDetails = location.state?.mawbDetails;
    if (!isEditMode && mawbDetails) {
      const mawbOriginCode = mawbDetails.origin_code || "";
      const mawbOriginName = mawbDetails.origin_name || "";
      const mawbDestinationCode = mawbDetails.destination_code || "";
      const mawbDestinationName = mawbDetails.destination_name || "";

      // Set origin if not already set
      if (mawbOriginCode && !form.values.origin_code) {
        form.setFieldValue("origin_code", mawbOriginCode);
        if (mawbOriginName) {
          form.setFieldValue("origin_name", mawbOriginName);
        }
      }

      // Set destination if not already set
      if (mawbDestinationCode && !form.values.destination_code) {
        form.setFieldValue("destination_code", mawbDestinationCode);
        if (mawbDestinationName) {
          form.setFieldValue("destination_name", mawbDestinationName);
        }
        // Also trigger Trade update when destination is auto-set
        updateTradeField(mawbDestinationCode);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, location.state?.mawbDetails]);

  // Auto-update HAWB origin agent name and address from MAWB origin agent
  useEffect(() => {
    const mawbDetails =
      location.state?.mawbDetails || location.state?.mawbDetails;
    if (!mawbDetails) return;

    const mawbOriginAgent =
      (mawbDetails as { agent_name?: string })?.agent_name || "";
    const mawbOriginAgentData = (mawbDetails as { agent_data?: unknown })
      ?.agent_data as Record<string, unknown> | null | undefined;

    console.log("🔍 MAWB Origin Agent Auto-fill:", {
      mawbOriginAgent,
      hasMawbOriginAgentData: !!mawbOriginAgentData,
      mawbOriginAgentData,
      addressesData: mawbOriginAgentData?.addresses_data,
      fullMawbDetails: mawbDetails,
    });

    if (mawbOriginAgent && mawbOriginAgent.trim() !== "") {
      // Auto-set HAWB origin agent name from MAWB origin agent
      form.setFieldValue("agent_name", mawbOriginAgent);

      // Auto-set HAWB origin agent address from MAWB origin agent addresses_data
      if (mawbOriginAgentData && mawbOriginAgentData.addresses_data) {
        // Check if addresses_data exists and is an array
        const addressesData = Array.isArray(mawbOriginAgentData.addresses_data)
          ? (mawbOriginAgentData.addresses_data as Array<{
              id: number;
              address: string;
            }>)
          : null;

        console.log("📍 Processed Addresses Data:", addressesData);

        // Auto-select the first address if available
        if (
          addressesData &&
          addressesData.length > 0 &&
          addressesData[0].address
        ) {
          const firstAddress = addressesData[0].address;
          console.log("✅ Setting HBL origin agent address:", firstAddress);
          form.setFieldValue("agent_address", firstAddress);
        } else {
          console.log("⚠️ No valid address found in addresses_data");
          // Clear address if no addresses_data available
          form.setFieldValue("agent_address", "");
        }
      } else {
        console.log("⚠️ No mawbOriginAgentData or addresses_data found");
        // Clear address if no agent_data
        form.setFieldValue("agent_address", "");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  // Auto-set routed_by to MAWB origin agent name when routed is "agent"
  useEffect(() => {
    if (form.values.routed === "agent") {
      const mawbDetails = location.state?.mawbDetails;
      if (!mawbDetails) return;

      // Get agent name from mawbDetails (display name)
      let mawbOriginAgentName =
        (mawbDetails as { agent_name?: string })?.agent_name || "";

      // If agent_name is empty, try to get it from agent_data
      if (
        !mawbOriginAgentName &&
        (mawbDetails as { agent_data?: unknown })?.agent_data
      ) {
        const originAgentData = (mawbDetails as { agent_data?: unknown })
          .agent_data as Record<string, unknown>;
        // Try to get customer_name from agent_data
        mawbOriginAgentName = (originAgentData.customer_name as string) || "";
      }

      if (mawbOriginAgentName && mawbOriginAgentName.trim() !== "") {
        // Auto-set routed_by to MAWB origin agent name if not already set or if MAWB origin agent changed
        if (
          !form.values.routed_by ||
          form.values.routed_by !== mawbOriginAgentName
        ) {
          form.setFieldValue("routed_by", mawbOriginAgentName);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    form.values.routed,
    location.state?.mawbDetails?.agent_name,
    location.state?.mawbDetails?.agent_data,
  ]);

  // Auto-set routed_by to MAWB origin agent when routed is "agent"
  useEffect(() => {
    if (form.values.routed === "agent") {
      const mawbOriginAgent = location.state?.mawbDetails?.agent_name || "";
      if (mawbOriginAgent && mawbOriginAgent.trim() !== "") {
        // Auto-set routed_by to MAWB origin agent if not already set or if MAWB origin agent changed
        if (
          !form.values.routed_by ||
          form.values.routed_by !== mawbOriginAgent
        ) {
          form.setFieldValue("routed_by", mawbOriginAgent);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.values.routed, location.state?.mawbDetails?.agent_name]);

  // Validate step 1 - Validate required fields
  const validateStep1 = () => {
    const errors: Record<string, string> = {};

    if (!form.values.hawb_number?.trim()) {
      errors.hawb_number = "HAWB Number is required";
    }
    if (!form.values.origin_code?.trim()) {
      errors.origin_code = "Origin is required";
    }
    if (!form.values.destination_code?.trim()) {
      errors.destination_code = "Destination is required";
    }
    if (!form.values.trade?.trim()) {
      errors.trade = "Trade is required";
    }
    if (!form.values.routed?.trim()) {
      errors.routed = "Routed is required";
    }
    if (!form.values.routed_by?.trim()) {
      errors.routed_by = "Routed By is required";
    }

    if (Object.keys(errors).length > 0) {
      form.setErrors(errors);
      return false;
    }
    return true;
  };

  // Validate step 2 - Validate required fields and email format
  const validateStep2 = () => {
    const errors: Record<string, string> = {};

    if (!form.values.shipper_name?.trim()) {
      errors.shipper_name = "Shipper Name is required";
    }
    if (!form.values.consignee_name?.trim()) {
      errors.consignee_name = "Consignee Name is required";
    }
    // Email validations
    if (
      form.values.shipper_email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.values.shipper_email)
    ) {
      errors.shipper_email = "Invalid email format";
    }
    if (
      form.values.consignee_email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.values.consignee_email)
    ) {
      errors.consignee_email = "Invalid email format";
    }
    if (
      form.values.agent_email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.values.agent_email)
    ) {
      errors.agent_email = "Invalid email format";
    }
    if (
      form.values.notify1_customer_email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.values.notify1_customer_email)
    ) {
      errors.notify1_customer_email = "Invalid email format";
    }
    if (
      form.values.notify2_customer_email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.values.notify2_customer_email)
    ) {
      errors.notify2_customer_email = "Invalid email format";
    }

    if (Object.keys(errors).length > 0) {
      form.setErrors(errors);
      return false;
    }
    return true;
  };

  // Validate step 3 - Cargo Details
  // Mandatory validations apply to both create and edit modes
  const validateStep3 = () => {
    const newErrors: Record<number, Record<string, string>> = {};
    let hasErrors = false;

    cargoDetails.forEach((cargo, index) => {
      const cargoError: Record<string, string> = {};

      // Mandatory fields: no_of_packages, gross_weight, volume (container_number removed for Air)
      if (cargo.no_of_packages === null || cargo.no_of_packages === undefined) {
        cargoError.no_of_packages = "No of Packages is required";
        hasErrors = true;
      }
      if (cargo.gross_weight === null || cargo.gross_weight === undefined) {
        cargoError.gross_weight = "Gross Weight is required";
        hasErrors = true;
      }
      if (cargo.volume === null || cargo.volume === undefined) {
        cargoError.volume = "Volume Weight is required";
        hasErrors = true;
      }

      if (Object.keys(cargoError).length > 0) {
        newErrors[index] = cargoError;
      }
    });

    setCargoErrors(newErrors);

    if (hasErrors) {
      return false;
    }
    return true;
  };

  // Validate step 4 - Charges
  // Mandatory validations apply to both create and edit modes
  const validateStep4 = () => {
    const newErrors: Record<number, Record<string, string>> = {};
    let hasErrors = false;

    chargesForm.values.charges.forEach((charge, index) => {
      const chargeError: Record<string, string> = {};

      // Mandatory fields: charge_name (or charge_id), pp_cc, currency_id, roe, amount
      if (
        (!charge.charge_name || charge.charge_name.trim() === "") &&
        (charge.charge_id == null || charge.charge_id === 0)
      ) {
        chargeError.charge_name = "Charge Name is required";
        hasErrors = true;
      }
      if (!charge.pp_cc || charge.pp_cc.trim() === "") {
        chargeError.pp_cc = "Prepaid/Collect is required";
        hasErrors = true;
      }
      if (!charge.currency_id || charge.currency_id.trim() === "") {
        chargeError.currency_id = "Currency is required";
        hasErrors = true;
      }
      if (charge.roe === null || charge.roe === undefined) {
        chargeError.roe = "ROE is required";
        hasErrors = true;
      }
      if (charge.amount === null || charge.amount === undefined) {
        chargeError.amount = "Amount is required";
        hasErrors = true;
      }

      if (Object.keys(chargeError).length > 0) {
        newErrors[index] = chargeError;
      }
    });

    setChargeErrors(newErrors);

    if (hasErrors) {
      return false;
    }
    return true;
  };

  // Handle next step
  const handleNext = () => {
    if (active === 0) {
      if (validateStep1()) {
        setActive(1);
      }
    } else if (active === 1) {
      if (validateStep2()) {
        setActive(2);
      }
    } else if (active === 2) {
      // Step 3: Validate cargo details before proceeding to Step 4
      if (validateStep3()) {
        setActive(3);
      }
    } else if (active === 3) {
      // Step 4: Validate charges before saving
      if (validateStep4()) {
        handleSave();
      }
    }
  };

  // Handle previous step
  const handlePrev = () => {
    if (active > 0) {
      setActive(active - 1);
    }
  };

  // Build current form as housing detail (for passing to invoice page)
  const getCurrentHousingDetail = () => {
    const v = form.values;
    return {
      hawb_number: v.hawb_number,
      routed: v.routed,
      routed_by: v.routed_by,
      origin_code: v.origin_code,
      origin_name: v.origin_name,
      destination_code: v.destination_code,
      destination_name: v.destination_name,
      customer_service: v.customer_service,
      trade: v.trade,
      agent_name: v.agent_name,
      agent_address: v.agent_address,
      agent_email: v.agent_email,
      cha_name: v.cha_name,
      cha_address: v.cha_address,
      shipper_code: v.shipper_code,
      shipper_name: v.shipper_name,
      shipper_address: v.shipper_address,
      shipper_email: v.shipper_email,
      shipper_gst_id:
        (v as { shipper_gst_id?: string }).shipper_gst_id ??
        (
          location.state?.job as {
            housing_details?: Array<{ shipper_gst_id?: string | null }>;
          }
        )?.housing_details?.[editIndex ?? 0]?.shipper_gst_id ??
        null,
      shipper_state_id: v.shipper_state_id
        ? Number(v.shipper_state_id)
        : ((editData as { shipper_state_id?: number } | undefined)
            ?.shipper_state_id ??
          (
            location.state?.job as {
              housing_details?: Array<{ shipper_state_id?: number }>;
            }
          )?.housing_details?.[editIndex ?? 0]?.shipper_state_id ??
          null),
      shipment_id:
        (editData as { shipment_id?: string } | undefined)?.shipment_id ?? null,
      consignee_name: v.consignee_name,
      consignee_code: v.consignee_code,
      consignee_address: v.consignee_address,
      consignee_email: v.consignee_email,
      consignee_gst_id:
        (v as { consignee_gst_id?: string }).consignee_gst_id ??
        (
          location.state?.job as {
            housing_details?: Array<{ consignee_gst_id?: string | null }>;
          }
        )?.housing_details?.[editIndex ?? 0]?.consignee_gst_id ??
        null,
      notify1_customer_name: v.notify1_customer_name,
      notify1_customer_address: v.notify1_customer_address,
      notify1_customer_email: v.notify1_customer_email,
      notify2_customer_name: v.notify2_customer_name,
      notify2_customer_address: v.notify2_customer_address,
      notify2_customer_email: v.notify2_customer_email,
      commodity_description: v.commodity_description,
      marks_no: v.marks_no,
      cargo_details: cargoDetails,
      charges: chargesForm.values.charges,
    };
  };

  // Handle save - navigate to ExportJobCreate with housing details
  const handleSave = () => {
    // Prepare cargo details (container_number removed for Air)
    // Keep payload stable; only round known numeric cargo fields to 2dp
    const cargoDetailsForPayload = cargoDetails.map((cargo) => ({
      ...cargo,
      gross_weight: roundToDecimals((cargo as any).gross_weight) ?? null,
      volume: roundToDecimals((cargo as any).volume) ?? null,
      chargeable_weight:
        roundToDecimals((cargo as any).chargeable_weight) ?? null,
    }));

    // Get current form values - ensure we're using the latest form state
    const currentFormValues = form.values;

    console.log("💾 HAWB Form Save - Current Form Values:", {
      origin_code: currentFormValues.origin_code,
      origin_name: currentFormValues.origin_name,
      destination_code: currentFormValues.destination_code,
      destination_name: currentFormValues.destination_name,
      allValues: currentFormValues,
    });

    // Prepare housing detail object - use current form values
    const housingDetail = {
      hawb_number: currentFormValues.hawb_number,
      routed: currentFormValues.routed,
      routed_by: currentFormValues.routed_by,
      origin_code: currentFormValues.origin_code,
      origin_name: currentFormValues.origin_name,
      destination_code: currentFormValues.destination_code,
      destination_name: currentFormValues.destination_name,
      customer_service: currentFormValues.customer_service,
      trade: currentFormValues.trade,
      agent_name: currentFormValues.agent_name,
      agent_address: currentFormValues.agent_address,
      agent_email: currentFormValues.agent_email,
      cha_name: currentFormValues.cha_name,
      cha_address: currentFormValues.cha_address,
      shipper_name: currentFormValues.shipper_name,
      shipper_address: currentFormValues.shipper_address,
      shipper_email: currentFormValues.shipper_email,
      shipper_state_id: currentFormValues.shipper_state_id
        ? Number(currentFormValues.shipper_state_id)
        : ((
            editData as
              | { shipment_id?: string; shipper_state_id?: number }
              | undefined
          )?.shipper_state_id ?? null),
      shipment_id:
        (editData as { shipment_id?: string } | undefined)?.shipment_id ?? null,
      consignee_name: currentFormValues.consignee_name,
      consignee_address: currentFormValues.consignee_address,
      consignee_email: currentFormValues.consignee_email,
      notify1_customer_name: currentFormValues.notify1_customer_name,
      notify1_customer_address: currentFormValues.notify1_customer_address,
      notify1_customer_email: currentFormValues.notify1_customer_email,
      notify2_customer_name: currentFormValues.notify2_customer_name,
      notify2_customer_address: currentFormValues.notify2_customer_address,
      notify2_customer_email: currentFormValues.notify2_customer_email,
      commodity_description: currentFormValues.commodity_description,
      marks_no: currentFormValues.marks_no,
      item_no: currentFormValues.item_no,
      sub_item_no: currentFormValues.sub_item_no,
      events: currentFormValues.events ?? [],
      cargo_details: cargoDetailsForPayload,
      charges: chargesForm.values.charges,
    };

    // Update existing housing details
    let updatedHousingDetails: typeof existingHousingDetails;

    if (isEditMode && editIndex !== undefined) {
      // Replace the existing item at editIndex
      updatedHousingDetails = [...existingHousingDetails];
      updatedHousingDetails[editIndex] = housingDetail;
    } else {
      // Add new housing detail
      updatedHousingDetails = [...existingHousingDetails, housingDetail];
    }

    // Determine navigation path based on edit mode
    const isInEditMode = location.state?.job && location.state.job.id;
    const navigatePath = isInEditMode
      ? "/air/export-job/edit"
      : "/air/export-job/create";

    // Navigate to ExportJobCreate with housing details
    navigate(navigatePath, {
      state: {
        hawbDetails: updatedHousingDetails,
        // Support legacy housingDetails key for backward compatibility
        housingDetails: updatedHousingDetails,
        // Preserve any existing job data
        ...(location.state?.job && { job: location.state.job }),
        // Preserve form state when navigating back
        ...(location.state?.mawbDetails && {
          mawbDetails: location.state.mawbDetails,
        }),
        ...(location.state?.carrierDetails && {
          carrierDetails: location.state.carrierDetails,
        }),
        ...(location.state?.routings && {
          routings: location.state.routings,
        }),
        // Preserve master-level estimates so they can be restored on the job screen
        ...(location.state?.estimates && {
          estimates: location.state.estimates,
        }),
      },
    });
  };

  // Generate PDF preview from current form data
  const generatePDFPreview = () => {
    try {
      setPreviewOpen(true);

      const defaultBranch = user?.branches?.find(
        (branch) => branch.is_default,
      ) ||
        user?.branches?.[0] || { branch_name: "CHENNAI" };
      const country = user?.country || null;

      const hawbData = {
        hawb_number: form.values.hawb_number,
        hawb_no: form.values.hawb_number,
        routed: form.values.routed,
        routed_by: form.values.routed_by,
        origin_code: form.values.origin_code,
        origin_name: form.values.origin_name,
        destination_code: form.values.destination_code,
        destination_name: form.values.destination_name,
        customer_service: form.values.customer_service,
        trade: form.values.trade,
        agent_name: form.values.agent_name,
        agent_address: form.values.agent_address,
        agent_email: form.values.agent_email,
        shipper_name: form.values.shipper_name,
        shipper_address: form.values.shipper_address,
        shipper_email: form.values.shipper_email,
        consignee_name: form.values.consignee_name,
        consignee_address: form.values.consignee_address,
        consignee_email: form.values.consignee_email,
        notify1_customer_name: form.values.notify1_customer_name,
        notify1_customer_address: form.values.notify1_customer_address,
        notify1_customer_email: form.values.notify1_customer_email,
        notify2_customer_name: form.values.notify2_customer_name,
        notify2_customer_address: form.values.notify2_customer_address,
        notify2_customer_email: form.values.notify2_customer_email,
        commodity_description: form.values.commodity_description,
        marks_no: form.values.marks_no,
        cargo_details: cargoDetails.map((cargo) => ({
          no_of_packages: cargo.no_of_packages,
          gross_weight: cargo.gross_weight,
          volume: cargo.volume,
          chargeable_weight: cargo.chargeable_weight,
          haz: cargo.haz === "Yes",
        })),
        mawb_charges: chargesForm.values.charges
          .filter((charge) => charge.charge_name || charge.charge_id != null)
          .map((charge) => ({
            ...(charge.id != null &&
              charge.id !== undefined && { id: Number(charge.id) }),
            charge_id: charge.charge_id ?? null,
            pp_cc: charge.pp_cc || "",
            unit_id: charge.unit_id ? Number(charge.unit_id) : null,
            currency_id: charge.currency_id ? Number(charge.currency_id) : null,
            no_of_unit: charge.no_of_unit ?? null,
            roe: roundToDecimals(charge.roe) ?? null,
            amount_per_unit: roundToDecimals(charge.amount_per_unit) ?? null,
            amount: roundToDecimals(charge.amount) ?? null,
            sell_local_amount: roundToDecimals(charge.local_amount) ?? null,
            unit_cost: roundToDecimals(charge.cost_per_unit) ?? null,
            total_cost: roundToDecimals(charge.total_cost) ?? null,
            cost_local_amount:
              roundToDecimals(charge.cost_local_amount) ?? null,
            supplier_code: charge.supplier_code || null,
            supplier_name: charge.supplier_name || null,
          })),
      };

      const jobData = {
        service: location.state?.mawbDetails?.service || "AIR",
        service_type: "Export",
        ...location.state?.mawbDetails,
        ...location.state?.carrierDetails,
        notes: location.state?.job?.notes || [],
      };

      const blobUrl = generateCargoArrivalNoticePDF(
        jobData,
        hawbData,
        defaultBranch,
        country,
      );
      setPdfBlob(blobUrl);
    } catch (error) {
      console.error("Error generating PDF:", error);
      ToastNotification({
        type: "error",
        message: "Error generating PDF preview",
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
    if (pdfBlob) {
      const link = document.createElement("a");
      link.href = pdfBlob;
      link.download = `Cargo-Arrival-Notice-${form.values.hawb_number || "HAWB"}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      ToastNotification({
        type: "success",
        message: "PDF downloaded successfully",
      });
    }
  };

  return (
    <Box p="md" mx="auto">
      <Group justify="space-between" mb="lg">
        <Text size="xl" fw={600} c="#105476">
          {isEditMode ? "Edit HAWB Details" : "Create HAWB Details"}
        </Text>
        {/* Save button moved to top */}
        <Group>
          {/* <Button
            variant="outline"
            color="#105476"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() =>
              navigate("/SeaExport/import-job/create", {
                state: {
                  housingDetails: existingHousingDetails,
                  // Preserve any existing job data
                  ...(location.state?.job && { job: location.state.job }),
                  // Preserve form state when navigating back
                  ...(location.state?.mawbDetails && {
                    mawbDetails: location.state.mawbDetails,
                  }),
                  ...(location.state?.carrierDetails && {
                    carrierDetails: location.state.carrierDetails,
                  }),
                  ...(location.state?.routings && {
                    routings: location.state.routings,
                  }),
                },
              })
            }
          >
            Back to Export Job
          </Button> */}
          <Button
            color="#105476"
            variant="outline"
            onClick={() => {
              if (active === 0) {
                if (!validateStep1()) return;
                if (!validateStep2()) {
                  setActive(1);
                  return;
                }
                if (!validateStep3()) {
                  setActive(2);
                  return;
                }
                if (!validateStep4()) {
                  setActive(3);
                  return;
                }
                handleSave();
              } else if (active === 1) {
                if (!validateStep2()) return;
                if (!validateStep3()) {
                  setActive(2);
                  return;
                }
                if (!validateStep4()) {
                  setActive(3);
                  return;
                }
                handleSave();
              } else if (active === 2) {
                if (!validateStep3()) return;
                if (!validateStep4()) {
                  setActive(3);
                  return;
                }
                handleSave();
              } else if (active === 3) {
                if (!validateStep4()) return;
                handleSave();
              } else if (active === 4) {
                if (!validateStep1()) {
                  setActive(0);
                  return;
                }
                if (!validateStep2()) {
                  setActive(1);
                  return;
                }
                if (!validateStep3()) {
                  setActive(2);
                  return;
                }
                if (!validateStep4()) {
                  setActive(3);
                  return;
                }
                handleSave();
              }
            }}
          >
            Save HBL
          </Button>
          <Menu shadow="md" width={220} position="bottom-end">
            <Menu.Target>
              <ActionIcon
                variant="subtle"
                color="#105476"
                size="lg"
                styles={{
                  root: {
                    fontFamily: "Inter",
                    fontSize: "13px",
                    border: "1px solid #E9ECEF",
                    borderRadius: "8px",
                    "&:hover": {
                      backgroundColor: "#F8F9FA",
                    },
                  },
                }}
              >
                <IconDotsVertical size={18} />
              </ActionIcon>
            </Menu.Target>

            <Menu.Dropdown
              styles={{
                dropdown: {
                  border: "1px solid #E9ECEF",
                  borderRadius: "8px",
                  padding: "8px",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
                },
              }}
            >
              <Menu.Item
                leftSection={
                  <Box
                    style={{
                      backgroundColor: "#E7F5FF",
                      borderRadius: "6px",
                      padding: "6px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <IconCalendar size={16} color="#105476" />
                  </Box>
                }
                styles={{
                  item: {
                    fontFamily: "Inter",
                    fontSize: "13px",
                    fontWeight: 500,
                    borderRadius: "6px",
                    padding: "10px 12px",
                    marginBottom: "4px",
                    "&:hover": {
                      backgroundColor: "#F8F9FA",
                    },
                  },
                  itemLabel: {
                    fontFamily: "Inter",
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#424242",
                  },
                }}
                onClick={() => {
                  const existing = form.values.events;
                  if (existing.length > 0) {
                    form.setFieldValue("event_modal_rows", [
                      ...existing.map((e) => ({
                        id: e.id,
                        eventType: e.type,
                        eventDate: e.date ? new Date(String(e.date)) : null,
                      })),
                      { id: undefined, eventType: null, eventDate: null },
                    ]);
                  } else {
                    form.setFieldValue("event_modal_rows", [
                      { id: undefined, eventType: null, eventDate: null },
                    ]);
                  }
                  setEventsModalOpen(true);
                }}
              >
                Events
              </Menu.Item>

              <Menu.Item
                leftSection={
                  <Box
                    style={{
                      backgroundColor: "#E7F5FF",
                      borderRadius: "6px",
                      padding: "6px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <IconFileInvoice size={16} color="#105476" />
                  </Box>
                }
                styles={{
                  item: {
                    fontFamily: "Inter",
                    fontSize: "13px",
                    fontWeight: 500,
                    borderRadius: "6px",
                    padding: "10px 12px",
                    marginBottom: "4px",
                    "&:hover": {
                      backgroundColor: "#F8F9FA",
                    },
                  },
                  itemLabel: {
                    fontFamily: "Inter",
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#424242",
                  },
                }}
                onClick={() => {
                  navigate("/job-ledger", {
                    state: {
                      ...(location.state?.job && { job: location.state.job }),
                      ...(location.state?.mawbDetails && {
                        mawbDetails: location.state.mawbDetails,
                      }),
                      ...(location.state?.carrierDetails && {
                        carrierDetails: location.state.carrierDetails,
                      }),
                      ...(location.state?.routings && {
                        routings: location.state.routings,
                      }),
                      housingDetails: [getCurrentHousingDetail()],
                      hawbDetails: [getCurrentHousingDetail()],
                      serviceType: "AIR",
                    },
                  });
                }}
              >
                Job Ledger
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>

      <Modal
        opened={eventsModalOpen}
        onClose={() => setEventsModalOpen(false)}
        title="Events"
        centered
        size="xl"
        styles={{ content: { maxWidth: 640 } }}
      >
        <Stack gap="md">
          {form.values.event_modal_rows.length > 0 && (
            <Grid gutter="sm" style={{ fontWeight: 600, color: "#105476" }}>
              <Grid.Col span={5}>
                <RequiredLabel label="Event Type" required={false} />
              </Grid.Col>
              <Grid.Col span={5}>
                <RequiredLabel label="Event Date" required={false} />
              </Grid.Col>
              <Grid.Col span={2}>
                <RequiredLabel label="Actions" required={false} />
              </Grid.Col>
            </Grid>
          )}

          {form.values.event_modal_rows.map((row, index) => (
            <Grid key={index} align="flex-end" gutter="sm">
              <Grid.Col span={5}>
                <Select
                  placeholder="Select event type"
                  data={eventTypeOptions}
                  value={row.eventType}
                  onChange={(value) =>
                    updateEventRow(index, "eventType", value ?? null)
                  }
                  clearable
                />
              </Grid.Col>
              <Grid.Col span={5}>
                <SingleDateInput
                  placeholder="Pick date"
                  value={row.eventDate}
                  onChange={(value) =>
                    updateEventRow(index, "eventDate", value ?? null)
                  }
                  size="sm"
                />
              </Grid.Col>
              <Grid.Col
                span={2}
                style={{ display: "flex", gap: 4, marginBottom: 4 }}
              >
                {form.values.event_modal_rows.length > 1 && (
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="lg"
                    onClick={() => removeEventRow(index)}
                    title="Remove row"
                  >
                    <IconTrash size={18} />
                  </ActionIcon>
                )}
                {index === form.values.event_modal_rows.length - 1 && (
                  <ActionIcon
                    variant="light"
                    color="blue"
                    size="lg"
                    onClick={addEventRow}
                    title="Add row"
                  >
                    <IconPlus size={18} />
                  </ActionIcon>
                )}
              </Grid.Col>
            </Grid>
          ))}

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => setEventsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitEventsModal}>Save Events</Button>
          </Group>
        </Stack>
      </Modal>

      <Tabs
        value={String(active)}
        onChange={(v) => v !== null && setActive(Number(v))}
        color="#105476"
      >
        <Tabs.List
          mb="md"
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
            borderBottom: "none",
          }}
        >
          <Tabs.Tab
            value="0"
            style={{
              textAlign: "center",
              padding: "12px",
              backgroundColor: "transparent",
              borderBottom: active === 0 ? "3px solid #105476" : "none",
              color: "#105476",
              fontSize: 16,
              fontWeight: active === 0 ? 600 : 400,
            }}
          >
            Shipment Details
          </Tabs.Tab>
          <Tabs.Tab
            value="1"
            style={{
              textAlign: "center",
              padding: "12px",
              backgroundColor: "transparent",
              borderBottom: active === 1 ? "3px solid #105476" : "none",
              color: "#105476",
              fontSize: 16,
              fontWeight: active === 1 ? 600 : 400,
            }}
          >
            Party Details
          </Tabs.Tab>
          <Tabs.Tab
            value="2"
            style={{
              textAlign: "center",
              padding: "12px",
              backgroundColor: "transparent",
              borderBottom: active === 2 ? "3px solid #105476" : "none",
              color: "#105476",
              fontSize: 16,
              fontWeight: active === 2 ? 600 : 400,
            }}
          >
            Cargo Details
          </Tabs.Tab>
          <Tabs.Tab
            value="3"
            style={{
              textAlign: "center",
              padding: "12px",
              backgroundColor: "transparent",
              borderBottom: active === 3 ? "3px solid #105476" : "none",
              color: "#105476",
              fontSize: 16,
              fontWeight: active === 3 ? 600 : 400,
            }}
          >
            Charges
          </Tabs.Tab>
          {isEditMode && (
            <Tabs.Tab
              value="4"
              style={{
                textAlign: "center",
                padding: "12px",
                backgroundColor: "transparent",
                borderBottom: active === 4 ? "3px solid #105476" : "none",
                color: "#105476",
                fontSize: 16,
                fontWeight: active === 4 ? 600 : 400,
              }}
            >
              Accounts
            </Tabs.Tab>
          )}
        </Tabs.List>

        <Tabs.Panel value="0">
          <Group align="center" mb="xs">
            <Text size="md" fw={600} c="#105476">
              Shipment Details
            </Text>
            {isEditMode && editData?.shipment_id && (
              <Badge color="#105476" size="md" variant="light">
                Shipment ID: {editData.shipment_id}
              </Badge>
            )}
          </Group>

          <Box mt="md">
            <Grid>
              <Grid.Col span={4}>
                <FormTextInput
                  label="HAWB Number"
                  required
                  placeholder="Enter HAWB Number"
                  {...form.getInputProps("hawb_number")}
                  error={form.errors.hawb_number}
                />
              </Grid.Col>

              <Grid.Col span={4}>
                <SearchableSelect
                  label="Origin"
                  required
                  apiEndpoint={URL.portMaster}
                  placeholder="Type origin code or name"
                  searchFields={["port_code", "port_name"]}
                  displayFormat={(item: Record<string, unknown>) => ({
                    value: String(item.port_code),
                    label: `${item.port_name} (${item.port_code})`,
                  })}
                  value={form.values.origin_code || null}
                  displayValue={
                    form.values.origin_name && form.values.origin_code
                      ? `${form.values.origin_name} (${form.values.origin_code})`
                      : form.values.origin_code || null
                  }
                  onChange={(value, selectedData) => {
                    // Handle both selection and clearing (value will be null when cleared)
                    form.setFieldValue("origin_code", value || "");
                    if (selectedData) {
                      const portName = selectedData.label.split(" (")[0] || "";
                      form.setFieldValue("origin_name", portName);
                    } else if (!value) {
                      form.setFieldValue("origin_name", "");
                    }
                  }}
                  additionalParams={seaTransportParams}
                  minSearchLength={2}
                  error={form.errors.origin_code as string}
                />
              </Grid.Col>

              <Grid.Col span={4}>
                <SearchableSelect
                  label="Destination"
                  required
                  apiEndpoint={URL.portMaster}
                  placeholder="Type destination code or name"
                  searchFields={["port_code", "port_name"]}
                  displayFormat={(item: Record<string, unknown>) => ({
                    value: String(item.port_code),
                    label: `${item.port_name} (${item.port_code})`,
                  })}
                  value={form.values.destination_code || null}
                  displayValue={
                    form.values.destination_name && form.values.destination_code
                      ? `${form.values.destination_name} (${form.values.destination_code})`
                      : form.values.destination_code || null
                  }
                  onChange={(value, selectedData) => {
                    console.log("🚀 Destination onChange triggered", {
                      value,
                      selectedData,
                    });
                    const hblDestinationCode = value || "";

                    // Update destination fields first
                    form.setFieldValue("destination_code", hblDestinationCode);
                    if (selectedData) {
                      const portName = selectedData.label.split(" (")[0] || "";
                      form.setFieldValue("destination_name", portName);
                    } else if (!value) {
                      form.setFieldValue("destination_name", "");
                    }

                    // Update Trade field immediately based on comparison
                    const mawbDestinationCode =
                      location.state?.mawbDetails?.destination_code || "";

                    console.log("🔍 Comparing destinations:", {
                      hblDestinationCode,
                      mawbDestinationCode,
                      match: hblDestinationCode === mawbDestinationCode,
                    });

                    if (hblDestinationCode && mawbDestinationCode) {
                      // Compare HBL destination with MAWB destination
                      const newTradeValue =
                        hblDestinationCode === mawbDestinationCode
                          ? "Import"
                          : "Transshipment";
                      console.log("✅ Setting Trade value:", newTradeValue);
                      // Use setValues to ensure state is properly updated
                      form.setValues({
                        ...form.values,
                        destination_code: hblDestinationCode,
                        destination_name: selectedData
                          ? selectedData.label.split(" (")[0] || ""
                          : "",
                        trade: newTradeValue,
                      });
                      console.log(
                        "📝 After setValues, form.values.trade:",
                        form.values.trade,
                      );
                    } else if (!hblDestinationCode) {
                      // Clear trade if HBL destination is cleared
                      console.log("🧹 Clearing Trade (no HBL destination)");
                      form.setFieldValue("trade", "");
                    } else {
                      console.log(
                        "⚠️ No MAWB destination found, cannot update Trade",
                      );
                    }
                  }}
                  additionalParams={seaTransportParams}
                  minSearchLength={2}
                  error={form.errors.destination_code as string}
                />
              </Grid.Col>

              <Grid.Col span={4}>
                <Dropdown
                  label="Trade"
                  required
                  placeholder="Select Trade"
                  data={tradeOptions}
                  value={form.values.trade || "Re Export"}
                  disabled
                  onChange={() => {
                    // Prevent changes - trade is always "Re Export" for export pages
                    form.setFieldValue("trade", "Re Export");
                  }}
                  error={form.errors.trade}
                />
              </Grid.Col>

              <Grid.Col span={4}>
                <Dropdown
                  label="Routed"
                  required
                  placeholder="Select Routed"
                  searchable
                  data={[
                    { value: "self", label: "Self" },
                    { value: "agent", label: "Agent" },
                  ]}
                  {...form.getInputProps("routed")}
                  error={form.errors.routed}
                />
              </Grid.Col>

              <Grid.Col span={4}>
                {form.values.routed === "self" ? (
                  salespersonsData.length > 0 ? (
                    <Dropdown
                      label="Routed By"
                      required
                      placeholder="Select salesperson"
                      searchable
                      data={salespersonsData}
                      value={form.values.routed_by}
                      onChange={(value) => {
                        form.setFieldValue("routed_by", value || "");
                      }}
                      error={form.errors.routed_by}
                    />
                  ) : (
                    <FormTextInput
                      label="Routed By"
                      required
                      placeholder="Enter routed by"
                      {...form.getInputProps("routed_by")}
                      error={form.errors.routed_by}
                    />
                  )
                ) : form.values.routed === "agent" ? (
                  <SearchableSelect
                    label="Routed By"
                    required
                    placeholder="Type agent name"
                    apiEndpoint={URL.agent}
                    searchFields={["customer_name", "customer_code"]}
                    displayFormat={(item: Record<string, unknown>) => ({
                      value: String(item.customer_name),
                      label: String(item.customer_name),
                    })}
                    value={form.values.routed_by}
                    displayValue={form.values.routed_by}
                    onChange={(value) => {
                      form.setFieldValue("routed_by", value || "");
                    }}
                    error={form.errors.routed_by as string}
                    minSearchLength={2}
                  />
                ) : (
                  <FormTextInput
                    label="Routed By"
                    required
                    placeholder="Enter routed by"
                    {...form.getInputProps("routed_by")}
                    error={form.errors.routed_by}
                  />
                )}
              </Grid.Col>
              <Grid.Col span={4}>
                <FormTextInput
                  label="Customer Service"
                  placeholder="Enter Customer Service"
                  value={form.values.customer_service}
                  onChange={(e) => {
                    const formattedValue = toTitleCase(e.target.value);
                    form.setFieldValue("customer_service", formattedValue);
                  }}
                  error={form.errors.customer_service}
                />
              </Grid.Col>
            </Grid>
          </Box>
        </Tabs.Panel>

        <Tabs.Panel value="1">
          <Box mt="md">
            {/* Shipper Section */}
            <Text size="md" mt="md" fw={600} c="#105476" mb="xs">
              Shipper
            </Text>
            <Grid mb="xs">
              <Grid.Col span={4}>
                <SearchableSelect
                  label="Shipper Name"
                  required
                  placeholder="Type shipper name"
                  apiEndpoint={URL.shipper}
                  searchFields={["customer_name", "customer_code"]}
                  displayFormat={(item: Record<string, unknown>) => ({
                    value: String(item.customer_code),
                    label: String(item.customer_name),
                  })}
                  value={form.values.shipper_code}
                  displayValue={form.values.shipper_name}
                  onChange={(value, selectedData, originalData) => {
                    form.setFieldValue("shipper_code", value || "");
                    form.setFieldValue(
                      "shipper_name",
                      selectedData?.label || "",
                    );

                    // Use originalData to populate address options and shipper_state_id
                    if (
                      value &&
                      originalData &&
                      (originalData as Record<string, unknown>).addresses_data
                    ) {
                      // Create address options from addresses_data
                      const addressesData = (
                        originalData as Record<string, unknown>
                      ).addresses_data as Array<{
                        id: number;
                        address: string;
                        state_id?: number;
                      }>;

                      const addressOptions = addressesData.map(
                        (addr: { id: number; address: string }) => ({
                          value: addr.address,
                          label: addr.address,
                        }),
                      );

                      setShipperAddressOptions(addressOptions);

                      // Auto-select the first address if available
                      if (
                        addressesData.length > 0 &&
                        addressesData[0].address
                      ) {
                        form.setFieldValue(
                          "shipper_address",
                          addressesData[0].address,
                        );
                      } else {
                        form.setFieldValue("shipper_address", "");
                      }

                      // Set shipper_state_id from first address that has state_id
                      const addrWithState = addressesData.find(
                        (a: { state_id?: number }) => a.state_id != null,
                      );
                      if (addrWithState?.state_id != null) {
                        form.setFieldValue(
                          "shipper_state_id",
                          String(addrWithState.state_id),
                        );
                      } else {
                        form.setFieldValue("shipper_state_id", "");
                      }
                    } else {
                      setShipperAddressOptions([]);
                      form.setFieldValue("shipper_address", "");
                      form.setFieldValue("shipper_state_id", "");
                    }
                  }}
                  returnOriginalData={true}
                  error={form.errors.shipper_name as string}
                  minSearchLength={3}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <FormTextInput
                  label="Shipper Email"
                  type="email"
                  placeholder="Enter Shipper Email"
                  {...form.getInputProps("shipper_email")}
                  error={form.errors.shipper_email}
                />
              </Grid.Col>

              <Grid.Col span={4}>
                {shipperAddressOptions.length > 0 ? (
                  <Dropdown
                    label="Shipper Address"
                    placeholder="Select shipper address"
                    searchable
                    data={shipperAddressOptions}
                    value={form.values.shipper_address || ""}
                    onChange={(value) => {
                      const formattedValue = value ? toTitleCase(value) : "";
                      form.setFieldValue("shipper_address", formattedValue);
                    }}
                    error={form.errors.shipper_address}
                  />
                ) : (
                  <FormTextInput
                    label="Shipper Address"
                    placeholder="Enter shipper address"
                    value={form.values.shipper_address || ""}
                    onChange={(e) => {
                      const formattedValue = toTitleCase(e.target.value);
                      form.setFieldValue("shipper_address", formattedValue);
                    }}
                    error={form.errors.shipper_address}
                  />
                )}
              </Grid.Col>
            </Grid>

            {/* Consignee Section */}
            <Text size="md" mt="md" fw={600} c="#105476" mb="xs">
              Consignee
            </Text>
            <Grid mb="xs">
              <Grid.Col span={4}>
                {consigneeHasResults === false &&
                consigneeSearch.trim().length >= 2 ? (
                  <FormTextInput
                    label="Consignee Name"
                    required
                    placeholder="Enter consignee name"
                    value={consigneeSearch}
                    onChange={(e) => {
                      const v = toTitleCase(e.currentTarget.value);
                      setConsigneeSearch(v);
                      form.setFieldValue("consignee_name", v);
                      form.setFieldValue("consignee_code", "");
                    }}
                    error={form.errors.consignee_name as string}
                  />
                ) : (
                  <Select
                    label="Consignee Name"
                    required
                    placeholder="Select or search consignee"
                    searchable
                    data={consigneeOptions}
                    searchValue={consigneeSearch}
                    onSearchChange={(value) => {
                      const v = toTitleCase(value);
                      setConsigneeSearch(v);
                      debouncedConsigneeSearch(v);
                    }}
                    value={form.values.consignee_code || ""}
                    onChange={(value) => {
                      if (!value) {
                        form.setFieldValue("consignee_code", "");
                        form.setFieldValue("consignee_name", "");
                        form.setFieldValue("consignee_address", "");
                        form.setFieldValue("consignee_email", "");
                        setConsigneeAddressOptions([]);
                        return;
                      }
                      const original = consigneeDataRef.current[value] || {};
                      const name = String(
                        (original as Record<string, unknown>).customer_name ||
                          "",
                      );
                      const email = getPartyEmail(
                        original as Record<string, unknown>,
                      );

                      // Populate address options for Dropdown (keep existing UX)
                      const addressesData = getPartyAddresses(
                        original as Record<string, unknown>,
                      );
                      const addressOptions = addressesData
                        .filter((a) => a.address)
                        .map((a) => {
                          const addr = toTitleCase(String(a.address || ""));
                          return { value: addr, label: addr };
                        });
                      setConsigneeAddressOptions(addressOptions);

                      // Reset address value so it always replaces on re-select
                      form.setFieldValue("consignee_address", "");
                      if (addressOptions.length > 0) {
                        form.setFieldValue(
                          "consignee_address",
                          addressOptions[0].value,
                        );
                      }

                      form.setFieldValue("consignee_code", value);
                      form.setFieldValue("consignee_name", toTitleCase(name));
                      form.setFieldValue("consignee_email", email);
                      setConsigneeSearch(name);
                    }}
                    comboboxProps={{ zIndex: 10 }}
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
                        fontStyle: "medium",
                      },
                    }}
                    nothingFoundMessage="No consignee found - type to enter new consignee"
                    error={form.errors.consignee_name as string}
                  />
                )}
              </Grid.Col>
              <Grid.Col span={4}>
                <FormTextInput
                  label="Consignee Email"
                  type="email"
                  format="normal"
                  placeholder="Enter Consignee Email"
                  {...form.getInputProps("consignee_email")}
                  error={form.errors.consignee_email}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                {consigneeAddressOptions.length > 0 ? (
                  <Dropdown
                    key={`consignee-address-${form.values.consignee_code || "none"}`}
                    label="Consignee Address"
                    placeholder="Select consignee address"
                    searchable
                    data={consigneeAddressOptions}
                    value={form.values.consignee_address || ""}
                    onChange={(value) => {
                      const formattedValue = value ? toTitleCase(value) : "";
                      form.setFieldValue("consignee_address", formattedValue);
                    }}
                    error={form.errors.consignee_address}
                  />
                ) : (
                  <FormTextInput
                    label="Consignee Address"
                    placeholder="Enter consignee address"
                    value={form.values.consignee_address || ""}
                    onChange={(e) => {
                      const formattedValue = toTitleCase(e.target.value);
                      form.setFieldValue("consignee_address", formattedValue);
                    }}
                    error={form.errors.consignee_address}
                  />
                )}
              </Grid.Col>
            </Grid>

            {/* Notify Customer 1 Details */}
            <Text size="md" mt="md" fw={600} c="#105476" mb="xs">
              Notify Customer 1 Details
            </Text>
            <Grid mb="xs">
              <Grid.Col span={4}>
                {notifyCustomerHasResults === false &&
                notifyCustomerSearch.trim().length >= 2 ? (
                  <FormTextInput
                    label="Notify Customer 1 Name"
                    placeholder="Enter notify customer name"
                    value={notifyCustomerSearch}
                    onChange={(e) => {
                      const v = toTitleCase(e.currentTarget.value);
                      setNotifyCustomerSearch(v);
                      form.setFieldValue("notify1_customer_name", v);
                      setNotifyCustomerAddressOptions([]);
                      form.setFieldValue("notify1_customer_address", "");
                      form.setFieldValue("notify1_customer_email", "");
                    }}
                    error={form.errors.notify1_customer_name as string}
                  />
                ) : (
                  <Select
                    label="Notify Customer 1 Name"
                    placeholder="Select or search notify customer"
                    searchable
                    clearable
                    data={notifyCustomerOptions}
                    searchValue={notifyCustomerSearch}
                    onSearchChange={(value) => {
                      const v = toTitleCase(value);
                      setNotifyCustomerSearch(v);
                      debouncedNotifyCustomerSearch(v);
                    }}
                    value={notifyCustomerSelectedId || ""}
                    onChange={(value) => {
                      if (!value) {
                        setNotifyCustomerSelectedId("");
                        form.setFieldValue("notify1_customer_name", "");
                        form.setFieldValue("notify1_customer_address", "");
                        form.setFieldValue("notify1_customer_email", "");
                        setNotifyCustomerAddressOptions([]);
                        return;
                      }
                      const original =
                        notifyCustomerDataRef.current[value] || {};
                      const name = String(
                        (original as Record<string, unknown>).customer_name ||
                          "",
                      );
                      const email = getPartyEmail(
                        original as Record<string, unknown>,
                      );
                      const addressesData = getPartyAddresses(
                        original as Record<string, unknown>,
                      );
                      const addressOptions = addressesData
                        .filter((a) => a.address)
                        .map((a) => {
                          const addr = toTitleCase(String(a.address || ""));
                          return { value: addr, label: addr };
                        });
                      setNotifyCustomerAddressOptions(addressOptions);

                      form.setFieldValue(
                        "notify1_customer_name",
                        toTitleCase(name),
                      );
                      form.setFieldValue("notify1_customer_email", email);
                      form.setFieldValue("notify1_customer_address", "");
                      if (addressOptions.length > 0) {
                        form.setFieldValue(
                          "notify1_customer_address",
                          addressOptions[0].value,
                        );
                      }
                      setNotifyCustomerSearch(name);
                      setNotifyCustomerSelectedId(value);
                    }}
                    comboboxProps={{ zIndex: 10 }}
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
                        fontStyle: "medium",
                      },
                    }}
                    nothingFoundMessage="No notify customer found - type to enter new"
                    error={form.errors.notify1_customer_name as string}
                  />
                )}
              </Grid.Col>
              <Grid.Col span={4}>
                <FormTextInput
                  label="Notify Customer 1 Email"
                  type="email"
                  format="normal"
                  placeholder="Enter Notify Customer 1 Email"
                  {...form.getInputProps("notify1_customer_email")}
                  error={form.errors.notify1_customer_email}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                {notifyCustomerAddressOptions.length > 0 ? (
                  <Dropdown
                    key={`notify1-address-${notifyCustomerSelectedId || "none"}`}
                    label="Notify Customer 1 Address"
                    placeholder="Select notify address"
                    searchable
                    data={notifyCustomerAddressOptions}
                    value={form.values.notify1_customer_address || ""}
                    onChange={(value) => {
                      const formattedValue = value ? toTitleCase(value) : "";
                      form.setFieldValue(
                        "notify1_customer_address",
                        formattedValue,
                      );
                    }}
                    error={form.errors.notify1_customer_address}
                  />
                ) : (
                  <FormTextInput
                    label="Notify Customer 1 Address"
                    placeholder="Enter Notify Customer 1 Address"
                    minRows={2}
                    value={form.values.notify1_customer_address}
                    onChange={(e) => {
                      const formattedValue = toTitleCase(e.currentTarget.value);
                      form.setFieldValue(
                        "notify1_customer_address",
                        formattedValue,
                      );
                    }}
                    error={form.errors.notify1_customer_address}
                  />
                )}
              </Grid.Col>
            </Grid>

            {/* Notify Customer 2 Details */}
            <Text size="md" mt="md" fw={600} c="#105476" mb="xs">
              Notify Customer 2 Details
            </Text>
            <Grid mb="xs">
              <Grid.Col span={4}>
                {notify2CustomerHasResults === false &&
                notify2CustomerSearch.trim().length >= 2 ? (
                  <FormTextInput
                    label="Notify Customer 2 Name"
                    placeholder="Enter notify customer name"
                    value={notify2CustomerSearch}
                    onChange={(e) => {
                      const v = toTitleCase(e.currentTarget.value);
                      setNotify2CustomerSearch(v);
                      form.setFieldValue("notify2_customer_name", v);
                      setNotify2CustomerAddressOptions([]);
                      form.setFieldValue("notify2_customer_address", "");
                      form.setFieldValue("notify2_customer_email", "");
                    }}
                    error={form.errors.notify2_customer_name as string}
                  />
                ) : (
                  <Select
                    label="Notify Customer 2 Name"
                    placeholder="Select or search notify customer"
                    searchable
                    clearable
                    data={notify2CustomerOptions}
                    searchValue={notify2CustomerSearch}
                    onSearchChange={(value) => {
                      const v = toTitleCase(value);
                      setNotify2CustomerSearch(v);
                      debouncedNotify2CustomerSearch(v);
                    }}
                    value={notify2CustomerSelectedId || ""}
                    onChange={(value) => {
                      if (!value) {
                        setNotify2CustomerSelectedId("");
                        form.setFieldValue("notify2_customer_name", "");
                        form.setFieldValue("notify2_customer_address", "");
                        form.setFieldValue("notify2_customer_email", "");
                        setNotify2CustomerAddressOptions([]);
                        return;
                      }
                      const original =
                        notify2CustomerDataRef.current[value] || {};
                      const name = String(
                        (original as Record<string, unknown>).customer_name ||
                          "",
                      );
                      const email = getPartyEmail(
                        original as Record<string, unknown>,
                      );
                      const addressesData = getPartyAddresses(
                        original as Record<string, unknown>,
                      );
                      const addressOptions = addressesData
                        .filter((a) => a.address)
                        .map((a) => {
                          const addr = toTitleCase(String(a.address || ""));
                          return { value: addr, label: addr };
                        });
                      setNotify2CustomerAddressOptions(addressOptions);

                      form.setFieldValue(
                        "notify2_customer_name",
                        toTitleCase(name),
                      );
                      form.setFieldValue("notify2_customer_email", email);
                      form.setFieldValue("notify2_customer_address", "");
                      if (addressOptions.length > 0) {
                        form.setFieldValue(
                          "notify2_customer_address",
                          addressOptions[0].value,
                        );
                      }
                      setNotify2CustomerSearch(name);
                      setNotify2CustomerSelectedId(value);
                    }}
                    comboboxProps={{ zIndex: 10 }}
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
                        fontStyle: "medium",
                      },
                    }}
                    nothingFoundMessage="No notify customer found - type to enter new"
                    error={form.errors.notify2_customer_name as string}
                  />
                )}
              </Grid.Col>
              <Grid.Col span={4}>
                <FormTextInput
                  label="Notify Customer 2 Email"
                  type="email"
                  format="normal"
                  placeholder="Enter Notify Customer 2 Email"
                  {...form.getInputProps("notify2_customer_email")}
                  error={form.errors.notify2_customer_email}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                {notify2CustomerAddressOptions.length > 0 ? (
                  <Dropdown
                    key={`notify2-address-${notify2CustomerSelectedId || "none"}`}
                    label="Notify Customer 2 Address"
                    placeholder="Select notify address"
                    searchable
                    data={notify2CustomerAddressOptions}
                    value={form.values.notify2_customer_address || ""}
                    onChange={(value) => {
                      const formattedValue = value ? toTitleCase(value) : "";
                      form.setFieldValue(
                        "notify2_customer_address",
                        formattedValue,
                      );
                    }}
                    error={form.errors.notify2_customer_address}
                  />
                ) : (
                  <FormTextInput
                    label="Notify Customer 2 Address"
                    placeholder="Enter Notify Customer 2 Address"
                    minRows={2}
                    value={form.values.notify2_customer_address}
                    onChange={(e) => {
                      const formattedValue = toTitleCase(e.currentTarget.value);
                      form.setFieldValue(
                        "notify2_customer_address",
                        formattedValue,
                      );
                    }}
                    error={form.errors.notify2_customer_address}
                  />
                )}
              </Grid.Col>
            </Grid>
            {/* Destination Agent Section */}
            <Text size="md" mt="md" fw={600} c="#105476" mb="xs">
              Destination Agent
            </Text>
            <Grid mb="xs">
              <Grid.Col span={4}>
                <SearchableSelect
                  label="Destination Agent Name"
                  placeholder="Type agent name"
                  apiEndpoint={URL.agent}
                  searchFields={["customer_name", "customer_code"]}
                  displayFormat={(item: Record<string, unknown>) => ({
                    value: String(item.customer_code),
                    label: String(item.customer_name),
                  })}
                  value={form.values.agent_name}
                  displayValue={form.values.agent_name}
                  onChange={(value, _selectedData, originalData) => {
                    const newValue = value || "";

                    form.setFieldValue("agent_name", newValue);

                    // Use originalData to populate address options
                    if (
                      newValue &&
                      originalData &&
                      (originalData as Record<string, unknown>).addresses_data
                    ) {
                      const addressesData = (
                        originalData as Record<string, unknown>
                      ).addresses_data as Array<{
                        id: number;
                        address: string;
                      }>;

                      const addressOptions = addressesData.map(
                        (addr: { id: number; address: string }) => ({
                          value: addr.address,
                          label: addr.address,
                        }),
                      );

                      setAgentAddressOptions(addressOptions);

                      // Auto-select the first address if available
                      if (
                        addressOptions.length > 0 &&
                        addressOptions[0].value
                      ) {
                        form.setFieldValue(
                          "agent_address",
                          addressOptions[0].value,
                        );
                      } else {
                        form.setFieldValue("agent_address", "");
                      }
                    } else {
                      setAgentAddressOptions([]);
                      form.setFieldValue("agent_address", "");
                    }
                  }}
                  returnOriginalData={true}
                  error={form.errors.agent_name as string}
                  minSearchLength={2}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <FormTextInput
                  label="Destination Agent Email"
                  type="email"
                  format="normal"
                  placeholder="Enter Destination Agent Email"
                  {...form.getInputProps("agent_email")}
                  error={form.errors.agent_email}
                />
              </Grid.Col>

              <Grid.Col span={4}>
                {agentAddressOptions.length > 0 ? (
                  <Dropdown
                    label="Destination Agent Address"
                    placeholder="Select destination agent address"
                    searchable
                    data={agentAddressOptions}
                    value={form.values.agent_address || ""}
                    onChange={(value) => {
                      const formattedValue = value ? toTitleCase(value) : "";
                      form.setFieldValue("agent_address", formattedValue);
                    }}
                    error={form.errors.agent_address}
                  />
                ) : (
                  <FormTextInput
                    label="Destination Agent Address"
                    placeholder="Enter Destination Agent Address"
                    minRows={2}
                    value={form.values.agent_address}
                    onChange={(e) => {
                      const formattedValue = toTitleCase(e.currentTarget.value);
                      form.setFieldValue("agent_address", formattedValue);
                    }}
                    error={form.errors.agent_address}
                  />
                )}
              </Grid.Col>
            </Grid>

            <Grid mb="xs">
              <Grid.Col span={4}>
                <SearchableSelect
                  label="CHA Name"
                  placeholder="Type CHA name"
                  apiEndpoint={URL.cha}
                  searchFields={["customer_name", "customer_code"]}
                  displayFormat={(item: Record<string, unknown>) => ({
                    value: String(item.customer_code ?? ""),
                    label: String(item.customer_name ?? ""),
                  })}
                  value={form.values.cha_code || null}
                  displayValue={form.values.cha_name}
                  onChange={(value, _selectedData, originalData) => {
                    const chaCode = value || "";
                    const chaName =
                      (originalData as Record<string, unknown> | undefined)
                        ?.customer_name != null
                        ? String(
                            (originalData as Record<string, unknown>).customer_name,
                          )
                        : "";
                    form.setFieldValue("cha_code", chaCode);
                    form.setFieldValue("cha_name", chaName);

                    const addr =
                      (originalData as Record<string, unknown> | undefined)
                        ?.addresses_data &&
                      Array.isArray(
                        (originalData as Record<string, unknown>).addresses_data,
                      ) &&
                      (
                        (originalData as Record<string, unknown>).addresses_data as Array<{
                          address?: unknown;
                        }>
                      )[0]?.address
                        ? String(
                            (
                              (originalData as Record<string, unknown>).addresses_data as Array<{
                                address?: unknown;
                              }>
                            )[0].address,
                          )
                        : "";

                    if (addr) {
                      form.setFieldValue("cha_address", toTitleCase(addr));
                    } else if (!chaCode) {
                      form.setFieldValue("cha_address", "");
                    }
                  }}
                  returnOriginalData={true}
                  minSearchLength={2}
                />
              </Grid.Col>
              <Grid.Col span={8}>
                <FormTextArea
                  label="CHA Address"
                  placeholder="Enter CHA Address"
                  minRows={2}
                  value={form.values.cha_address}
                  onChange={(e) => {
                    form.setFieldValue("cha_address", e.currentTarget.value);
                  }}
                />
              </Grid.Col>
            </Grid>
          </Box>
        </Tabs.Panel>

        <Tabs.Panel value="2">
          <Box mt="md">
            <Text size="md" fw={600} c="#105476" mb="md">
              Cargo Details
            </Text>

            <Grid mb="md">
              <Grid.Col span={6}>
                <FormTextArea
                  label="Commodity Description"
                  placeholder="Enter Commodity Description"
                  minRows={3}
                  value={form.values.commodity_description}
                  onChange={(e) => {
                    form.setFieldValue("commodity_description", e.currentTarget.value);
                  }}
                  error={form.errors.commodity_description}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <FormTextArea
                  label="Marks No"
                  placeholder="Enter Marks No"
                  minRows={3}
                  value={form.values.marks_no}
                  onChange={(e) => {
                    form.setFieldValue("marks_no", e.currentTarget.value);
                  }}
                  error={form.errors.marks_no}
                />
              </Grid.Col>
            </Grid>

            {/* Dynamic Cargo Rows */}
            <Box mb="md">
              <Grid
                mb="xs"
                style={{
                  fontWeight: 600,
                  color: "#105476",
                }}
                gutter="sm"
              >
                <Grid.Col span={2.2}>
                  <RequiredLabel label="No of Packages" required={true} />
                </Grid.Col>
                <Grid.Col span={2.2}>
                  <RequiredLabel label="Gross Weight (KG)" required={true} />
                </Grid.Col>
                <Grid.Col span={2.2}>
                  <RequiredLabel label="Volume (KG)" required={true} />
                </Grid.Col>
                <Grid.Col span={2.2}>
                  <RequiredLabel
                    label="Chargeable Weight (KG)"
                    required={false}
                  />
                </Grid.Col>
                <Grid.Col span={2.2}>
                  <RequiredLabel label="Haz" required={false} />
                </Grid.Col>
                <Grid.Col span={1}>
                  <Text size="xs" fw={600}>
                    Actions
                  </Text>
                </Grid.Col>
              </Grid>

              {cargoDetails.map((cargo, index) => (
                <Grid key={index} gutter="sm" mb="xs">
                  <Grid.Col span={2.2}>
                    <FormNumberInput
                      placeholder="Enter No of Packages"
                      min={0}
                      hideControls
                      withAsterisk
                      value={cargo.no_of_packages || undefined}
                      onChange={(value) => {
                        const updated = [...cargoDetails];
                        updated[index] = {
                          ...updated[index],
                          no_of_packages: value as number | null,
                        };
                        setCargoDetails(updated);
                        // Clear error when field is updated
                        if (cargoErrors[index]?.no_of_packages) {
                          const newErrors = { ...cargoErrors };
                          if (newErrors[index]) {
                            delete newErrors[index].no_of_packages;
                            if (Object.keys(newErrors[index]).length === 0) {
                              delete newErrors[index];
                            }
                          }
                          setCargoErrors(newErrors);
                        }
                      }}
                      error={cargoErrors[index]?.no_of_packages}
                    />
                  </Grid.Col>
                  <Grid.Col span={2.2}>
                    <FormNumberInput
                      placeholder="Enter Gross Weight"
                      min={0}
                      withAsterisk
                      hideControls
                      decimalScale={2}
                      value={cargo.gross_weight || undefined}
                      onChange={(value) => {
                        const updated = [...cargoDetails];
                        updated[index] = {
                          ...updated[index],
                          gross_weight: value as number | null,
                        };
                        setCargoDetails(updated);
                        // Clear error when field is updated
                        if (cargoErrors[index]?.gross_weight) {
                          const newErrors = { ...cargoErrors };
                          if (newErrors[index]) {
                            delete newErrors[index].gross_weight;
                            if (Object.keys(newErrors[index]).length === 0) {
                              delete newErrors[index];
                            }
                          }
                          setCargoErrors(newErrors);
                        }
                      }}
                      error={cargoErrors[index]?.gross_weight}
                    />
                  </Grid.Col>
                  <Grid.Col span={2.2}>
                    <FormNumberInput
                      placeholder="Enter Volume Weight"
                      min={0}
                      withAsterisk
                      hideControls
                      decimalScale={3}
                      value={cargo.volume || undefined}
                      onChange={(value) => {
                        const updated = [...cargoDetails];
                        updated[index] = {
                          ...updated[index],
                          volume: value as number | null,
                        };
                        setCargoDetails(updated);
                        // Clear error when field is updated
                        if (cargoErrors[index]?.volume) {
                          const newErrors = { ...cargoErrors };
                          if (newErrors[index]) {
                            delete newErrors[index].volume;
                            if (Object.keys(newErrors[index]).length === 0) {
                              delete newErrors[index];
                            }
                          }
                          setCargoErrors(newErrors);
                        }
                      }}
                      error={cargoErrors[index]?.volume}
                    />
                  </Grid.Col>
                  <Grid.Col span={2.2}>
                    <FormNumberInput
                      placeholder=""
                      hideControls
                      decimalScale={2}
                      value={cargo.chargeable_weight || undefined}
                      readOnly
                      disabled
                    />
                  </Grid.Col>
                  <Grid.Col span={2.2}>
                    <Dropdown
                      placeholder="Select Haz"
                      searchable
                      data={[
                        { value: "Yes", label: "Yes" },
                        { value: "No", label: "No" },
                      ]}
                      value={cargo.haz || null}
                      onChange={(value) => {
                        const updated = [...cargoDetails];
                        updated[index] = {
                          ...updated[index],
                          haz: value || "",
                        };
                        setCargoDetails(updated);
                      }}
                    />
                  </Grid.Col>
                  <Grid.Col span={1}>
                    <Group gap="xs">
                      {cargoDetails.length > 1 && (
                        <Button
                          size="sm"
                          variant="light"
                          color="red"
                          px={12}
                          onClick={() => {
                            const updated = cargoDetails.filter(
                              (_, i) => i !== index,
                            );
                            setCargoDetails(updated);
                          }}
                        >
                          <IconTrash size={16} />
                        </Button>
                      )}
                      {cargoDetails.length - 1 === index && (
                        <Button
                          size="sm"
                          variant="light"
                          color="#105476"
                          px={12}
                          onClick={() => {
                            setCargoDetails([
                              ...cargoDetails,
                              {
                                no_of_packages: null,
                                gross_weight: null,
                                volume: null,
                                chargeable_weight: null,
                                haz: "",
                              },
                            ]);
                          }}
                        >
                          <IconPlus size={16} />
                        </Button>
                      )}
                    </Group>
                  </Grid.Col>
                </Grid>
              ))}
            </Box>
          </Box>
        </Tabs.Panel>

        <Tabs.Panel value="3">
          <Box mt="md">
            <Group justify="space-between" align="center" mb="md">
              <Text size="md" fw={600} c="#105476">
                Charges
                {chargesForm.values.charges.length > 1 &&
                  ` (${chargesForm.values.charges.length})`}
              </Text>
              {location.state?.job?.id != null && (
                <Button
                  variant="outline"
                  color="#105476"
                  onClick={() => {
                    const fullDetail = getCurrentHousingDetail();
                    const prepaidCharges = (fullDetail.charges ?? []).filter(
                      (c: { pp_cc?: string }) =>
                        String(c.pp_cc ?? "").trim() === "Prepaid",
                    );
                    const detailForInvoice = {
                      ...fullDetail,
                      charges: prepaidCharges,
                    };
                    navigate("/air/export-job/invoice", {
                      state: {
                        serviceType: "AIR",
                        hawbDetails: [detailForInvoice],
                        housingDetails: [detailForInvoice],
                        is_agent: false,
                        ...(location.state?.job && { job: location.state.job }),
                        ...(location.state?.mawbDetails && {
                          mawbDetails: location.state.mawbDetails,
                        }),
                        ...(location.state?.carrierDetails && {
                          carrierDetails: location.state.carrierDetails,
                        }),
                        ...(location.state?.routings && {
                          routings: location.state.routings,
                        }),
                      },
                    });
                  }}
                >
                  Create Invoice
                </Button>
              )}
            </Group>

            {/* Dynamic Charges Rows */}
            <Box mb="md">
              {/* Group title row: Sell / Cost */}
              <Grid mb={2} gutter="sm" style={{ fontWeight: 700 }}>
                <Grid.Col span={1.4} />
                <Grid.Col span={0.9} />
                <Grid.Col span={0.8} />
                <Grid.Col span={0.8} />
                <Grid.Col span={0.7} />
                <Grid.Col span={0.7} />
                <Grid.Col span={2.55}>
                  <Box
                    style={{
                      border: "1.5px solid #228be6",
                      borderRadius: 6,
                      textAlign: "center",
                      padding: "2px 0",
                      color: "#228be6",
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: 1,
                    }}
                  >
                    SELL
                  </Box>
                </Grid.Col>
                <Grid.Col span={3.65}>
                  <Box
                    style={{
                      border: "1.5px solid #e67700",
                      borderRadius: 6,
                      textAlign: "center",
                      padding: "2px 0",
                      color: "#e67700",
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: 1,
                    }}
                  >
                    COST
                  </Box>
                </Grid.Col>
                <Grid.Col span={0.5} />
              </Grid>
              {/* Field labels row */}
              <Grid
                mb="xs"
                style={{
                  fontWeight: 600,
                  color: "#105476",
                }}
                gutter="sm"
              >
                <Grid.Col span={1.4}>
                  <RequiredLabel label="Charge Name" required />
                </Grid.Col>
                <Grid.Col span={0.9}>
                  <RequiredLabel label="Prepaid / Collect" required />
                </Grid.Col>
                <Grid.Col span={0.8}>
                  <RequiredLabel label="Unit" required={false} />
                </Grid.Col>
                <Grid.Col span={0.8}>
                  <RequiredLabel label="Currency" required />
                </Grid.Col>
                <Grid.Col span={0.7}>
                  <RequiredLabel label="ROE" required />
                </Grid.Col>
                <Grid.Col span={0.7}>
                  <RequiredLabel label="No of Unit" required={false} />
                </Grid.Col>
                <Grid.Col span={0.85}>
                  <RequiredLabel label="Amount/Unit" required={false} />
                </Grid.Col>
                <Grid.Col span={0.85}>
                  <RequiredLabel label="Amount" required />
                </Grid.Col>
                <Grid.Col span={0.85}>
                  <RequiredLabel label="Local Amount" required={false} />
                </Grid.Col>
                <Grid.Col span={0.85}>
                  <RequiredLabel label="Cost/Unit" required={false} />
                </Grid.Col>
                <Grid.Col span={0.85}>
                  <RequiredLabel label="Total Cost" required={false} />
                </Grid.Col>
                <Grid.Col span={0.85}>
                  <RequiredLabel label="Local Amount" required={false} />
                </Grid.Col>
                <Grid.Col span={1.1}>
                  <RequiredLabel label="Supplier" required={false} />
                </Grid.Col>
                <Grid.Col span={0.5}>
                  <RequiredLabel label="Actions" required={false} />
                </Grid.Col>
              </Grid>

              {chargesForm.values.charges.map((charge, index) => (
                <Grid key={index} gutter="sm" mb="xs">
                  <Grid.Col span={1.4}>
                    <SearchableSelect
                      placeholder="Type charge name"
                      apiEndpoint={URL.chargeMaster}
                      searchFields={["charge_name", "charge_code"]}
                      displayFormat={(item: Record<string, unknown>) => ({
                        value: String(item.id ?? ""),
                        label: String(item.charge_name ?? ""),
                      })}
                      value={
                        charge.charge_id != null
                          ? String(charge.charge_id)
                          : null
                      }
                      displayValue={charge.charge_name || undefined}
                      onChange={(value, selectedData) => {
                        const chargeId = value ? Number(value) : null;
                        const chargeName = selectedData?.label ?? "";
                        chargesForm.setFieldValue(
                          `charges.${index}.charge_id`,
                          chargeId,
                        );
                        chargesForm.setFieldValue(
                          `charges.${index}.charge_name`,
                          chargeName,
                        );
                        if (chargeErrors[index]?.charge_name) {
                          const newErrors = { ...chargeErrors };
                          if (newErrors[index]) {
                            delete newErrors[index].charge_name;
                            if (Object.keys(newErrors[index]).length === 0)
                              delete newErrors[index];
                          }
                          setChargeErrors(newErrors);
                        }
                      }}
                      error={chargeErrors[index]?.charge_name}
                      minSearchLength={2}
                      dropdownZIndex={1000}
                      styles={{
                        input: {
                          fontSize: "13px",
                          fontFamily: "Inter",
                          height: "36px",
                        },
                      }}
                    />
                  </Grid.Col>
                  <Grid.Col span={0.9}>
                    <Dropdown
                      placeholder="Select Prepaid/Collect"
                      searchable
                      data={[
                        { value: "Prepaid", label: "Prepaid" },
                        { value: "Collect", label: "Collect" },
                      ]}
                      value={charge.pp_cc || null}
                      onChange={(value) => {
                        chargesForm.setFieldValue(
                          `charges.${index}.pp_cc`,
                          value || "",
                        );
                        if (chargeErrors[index]?.pp_cc) {
                          const newErrors = { ...chargeErrors };
                          if (newErrors[index]) {
                            delete newErrors[index].pp_cc;
                            if (Object.keys(newErrors[index]).length === 0) {
                              delete newErrors[index];
                            }
                          }
                          setChargeErrors(newErrors);
                        }
                      }}
                      error={chargeErrors[index]?.pp_cc}
                    />
                  </Grid.Col>
                  <Grid.Col span={0.8}>
                    <Dropdown
                      placeholder="Select Unit"
                      searchable
                      data={unitOptions}
                      value={charge.unit_id || null}
                      onChange={(value) => {
                        const unitId = value ?? "";
                        const selectedUnit = unitOptions.find(
                          (o) => o.value === unitId,
                        );
                        const labelUpper = (
                          selectedUnit?.label ?? ""
                        ).toUpperCase();
                        let noOfUnit = charge.no_of_unit;
                        if (
                          labelUpper === "SHIPMENT" ||
                          labelUpper === "SHPT" ||
                          labelUpper === "DOC"
                        ) {
                          noOfUnit = 1;
                        }
                        chargesForm.setFieldValue(
                          `charges.${index}.unit_id`,
                          unitId,
                        );
                        if (noOfUnit !== charge.no_of_unit) {
                          chargesForm.setFieldValue(
                            `charges.${index}.no_of_unit`,
                            noOfUnit,
                          );
                        }
                      }}
                    />
                  </Grid.Col>
                  <Grid.Col span={0.8}>
                    <Dropdown
                      placeholder="Select Currency"
                      searchable
                      data={currencyOptions}
                      value={charge.currency_id || null}
                      onChange={(value) => {
                        const currencyId = value ?? "";
                        const code =
                          currencyOptions.find((o) => o.value === currencyId)
                            ?.label ?? "";
                        const roe = code ? getRoeValue(code) : null;
                        chargesForm.setFieldValue(
                          `charges.${index}.currency_id`,
                          currencyId,
                        );
                        if (roe !== null) {
                          chargesForm.setFieldValue(
                            `charges.${index}.roe`,
                            roe,
                          );
                        }
                        if (chargeErrors[index]?.currency_id) {
                          const newErrors = { ...chargeErrors };
                          if (newErrors[index]) {
                            delete newErrors[index].currency_id;
                            if (Object.keys(newErrors[index]).length === 0)
                              delete newErrors[index];
                          }
                          setChargeErrors(newErrors);
                        }
                      }}
                      error={chargeErrors[index]?.currency_id}
                    />
                  </Grid.Col>
                  <Grid.Col span={0.7}>
                    <FormNumberInput
                      placeholder="ROE"
                      min={0}
                      hideControls
                      decimalScale={2}
                      value={charge.roe || undefined}
                      onChange={(value) => {
                        const roe = value as number | null;
                        chargesForm.setFieldValue(`charges.${index}.roe`, roe);
                        if (chargeErrors[index]?.roe) {
                          const newErrors = { ...chargeErrors };
                          if (newErrors[index]) {
                            delete newErrors[index].roe;
                            if (Object.keys(newErrors[index]).length === 0) {
                              delete newErrors[index];
                            }
                          }
                          setChargeErrors(newErrors);
                        }
                      }}
                      error={chargeErrors[index]?.roe}
                    />
                  </Grid.Col>
                  <Grid.Col span={0.7}>
                    <FormNumberInput
                      placeholder="No of Unit"
                      min={0}
                      hideControls
                      {...(() => {
                        const inputProps = chargesForm.getInputProps(
                          `charges.${index}.no_of_unit`,
                        );
                        return {
                          value: inputProps.value as number | undefined,
                          onChange: (value: number | string | null) => {
                            const noOfUnit = value as number | null;
                            chargesForm.setFieldValue(
                              `charges.${index}.no_of_unit`,
                              noOfUnit,
                            );
                            const currentCharge =
                              chargesForm.values.charges[index];
                            if (
                              currentCharge.amount_per_unit != null &&
                              currentCharge.amount_per_unit > 0 &&
                              noOfUnit != null &&
                              noOfUnit > 0
                            ) {
                              chargesForm.setFieldValue(
                                `charges.${index}.amount`,
                                parseFloat(
                                  (noOfUnit * currentCharge.amount_per_unit).toFixed(2),
                                ),
                              );
                            } else {
                              chargesForm.setFieldValue(`charges.${index}.amount`, null);
                            }
                            if (
                              currentCharge.cost_per_unit != null &&
                              currentCharge.cost_per_unit > 0 &&
                              noOfUnit != null &&
                              noOfUnit > 0
                            ) {
                              chargesForm.setFieldValue(
                                `charges.${index}.total_cost`,
                                parseFloat((noOfUnit * currentCharge.cost_per_unit).toFixed(2)),
                              );
                            } else {
                              chargesForm.setFieldValue(`charges.${index}.total_cost`, null);
                            }
                          },
                        };
                      })()}
                    />
                  </Grid.Col>
                  <Grid.Col span={0.85}>
                      <FormNumberInput
                        placeholder="Amount/Unit"
                        min={0}
                        hideControls
                        decimalScale={2}
                        value={charge.amount_per_unit || undefined}
                        onChange={(value) => {
                          const amountPerUnit = value as number | null;
                          chargesForm.setFieldValue(`charges.${index}.amount_per_unit`, amountPerUnit);
                          const currentCharge = chargesForm.values.charges[index];
                          if (amountPerUnit == null || amountPerUnit === 0 || currentCharge.no_of_unit == null || currentCharge.no_of_unit === 0) {
                            chargesForm.setFieldValue(`charges.${index}.amount`, null);
                          } else {
                            chargesForm.setFieldValue(
                              `charges.${index}.amount`,
                              parseFloat(
                                (currentCharge.no_of_unit * amountPerUnit).toFixed(2),
                              ),
                            );
                          }
                          if (chargeErrors[index]?.amount_per_unit) {
                            const newErrors = { ...chargeErrors };
                            if (newErrors[index]) {
                              delete newErrors[index].amount_per_unit;
                              if (Object.keys(newErrors[index]).length === 0) delete newErrors[index];
                            }
                            setChargeErrors(newErrors);
                          }
                        }}
                        error={chargeErrors[index]?.amount_per_unit}
                      />
                  </Grid.Col>
                  <Grid.Col span={0.85}>
                    <FormNumberInput
                      placeholder="Amount"
                      min={0}
                      hideControls
                      decimalScale={2}
                      value={charge.amount || undefined}
                      onChange={(value) => {
                        chargesForm.setFieldValue(`charges.${index}.amount`, value as number | null);
                        if (chargeErrors[index]?.amount) {
                          const newErrors = { ...chargeErrors };
                          if (newErrors[index]) {
                            delete newErrors[index].amount;
                            if (Object.keys(newErrors[index]).length === 0) delete newErrors[index];
                          }
                          setChargeErrors(newErrors);
                        }
                      }}
                      error={chargeErrors[index]?.amount}
                    />
                  </Grid.Col>
                  <Grid.Col span={0.85}>
                    <FormNumberInput
                      placeholder="Local Amount"
                      min={0}
                      hideControls
                      decimalScale={2}
                      value={charge.local_amount || undefined}
                      onChange={(value) => {
                        chargesForm.setFieldValue(
                          `charges.${index}.local_amount`,
                          value as number | null,
                        );
                      }}
                    />
                  </Grid.Col>
                  <Grid.Col span={0.85}>
                    <FormNumberInput
                      placeholder="Cost/Unit"
                      min={0}
                      hideControls
                      decimalScale={2}
                      value={charge.cost_per_unit || undefined}
                      onChange={(value) => {
                        const costPerUnit = value as number | null;
                        chargesForm.setFieldValue(`charges.${index}.cost_per_unit`, costPerUnit);
                        const currentCharge = chargesForm.values.charges[index];
                        if (
                          costPerUnit != null &&
                          costPerUnit > 0 &&
                          currentCharge.no_of_unit != null &&
                          currentCharge.no_of_unit > 0
                        ) {
                          chargesForm.setFieldValue(
                            `charges.${index}.total_cost`,
                            parseFloat((currentCharge.no_of_unit * costPerUnit).toFixed(2)),
                          );
                        } else {
                          chargesForm.setFieldValue(`charges.${index}.total_cost`, null);
                        }
                      }}
                    />
                  </Grid.Col>
                  <Grid.Col span={0.85}>
                    <FormNumberInput
                      placeholder="Total Cost"
                      min={0}
                      hideControls
                      decimalScale={2}
                      value={charge.total_cost || undefined}
                      onChange={(value) => {
                        chargesForm.setFieldValue(
                          `charges.${index}.total_cost`,
                          value as number | null,
                        );
                      }}
                    />
                  </Grid.Col>
                  <Grid.Col span={0.85}>
                    <FormNumberInput
                      placeholder="Local Amount"
                      min={0}
                      hideControls
                      decimalScale={2}
                      value={charge.cost_local_amount || undefined}
                      onChange={(value) => {
                        chargesForm.setFieldValue(
                          `charges.${index}.cost_local_amount`,
                          value as number | null,
                        );
                      }}
                    />
                  </Grid.Col>
                  <Grid.Col span={1.1}>
                    <SearchableSelect
                      placeholder="Type supplier"
                      apiEndpoint={URL.supplierByType}
                      searchFields={["customer_name", "customer_code"]}
                      displayFormat={(item: Record<string, unknown>) => ({
                        value: String(item.customer_code ?? ""),
                        label: String(item.customer_name ?? ""),
                      })}
                      value={charge.supplier_code ? String(charge.supplier_code) : null}
                      displayValue={charge.supplier_name || undefined}
                      onChange={(value, selectedData) => {
                        chargesForm.setFieldValue(`charges.${index}.supplier_code`, value || "");
                        chargesForm.setFieldValue(
                          `charges.${index}.supplier_name`,
                          selectedData?.label || "",
                        );
                      }}
                      minSearchLength={2}
                      dropdownZIndex={1000}
                      styles={{
                        input: {
                          fontSize: "13px",
                          fontFamily: "Inter",
                          height: "36px",
                        },
                      }}
                    />
                  </Grid.Col>
                  <Grid.Col span={0.5} style={{ display: "flex", gap: "6px", alignItems: "center", justifyContent: "flex-start" }}>
                    {chargesForm.values.charges.length - 1 === index && (
                      <ActionIcon
                        variant="light"
                        color="#105476"
                        onClick={() => {
                          chargesForm.insertListItem("charges", {
                            charge_id: null,
                            charge_name: "",
                            pp_cc: "Collect",
                            unit_id: "",
                            no_of_unit: null,
                            currency_id: "",
                            roe: null,
                            amount_per_unit: null,
                            amount: null,
                            local_amount: null,
                            cost_per_unit: null,
                            total_cost: null,
                            cost_local_amount: null,
                            supplier_code: "",
                            supplier_name: "",
                          });
                        }}
                      >
                        <IconPlus size={16} />
                      </ActionIcon>
                    )}
                    {chargesForm.values.charges.length > 1 && (
                      <ActionIcon
                        variant="light"
                        color="red"
                        onClick={() => {
                          chargesForm.removeListItem("charges", index);
                        }}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    )}
                  </Grid.Col>
                </Grid>
              ))}
            </Box>
          </Box>
        </Tabs.Panel>

        {isEditMode && (
          <Tabs.Panel value="4">
            <Box mt="md">
              <Text size="md" fw={600} c="#105476" mb="md">
                Accounts
              </Text>
              {invoiceListLoading ? (
                <Center py="xl">
                  <Loader color="#105476" size="lg" />
                </Center>
              ) : (
                <ScrollArea>
                  <Table
                    withTableBorder
                    withColumnBorders
                    striped
                    highlightOnHover
                    style={{ minWidth: 700 }}
                    styles={{
                      th: {
                        padding: "8px",
                      },
                      td: {
                        padding: "8px",
                      },
                    }}
                  >
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th style={{ fontSize: "12px", fontWeight: 600 }}>
                          Daybook
                        </Table.Th>
                        <Table.Th style={{ fontSize: "12px", fontWeight: 600 }}>
                          Invoice number
                        </Table.Th>
                        <Table.Th style={{ fontSize: "12px", fontWeight: 600 }}>
                          Invoice Date
                        </Table.Th>
                        <Table.Th style={{ fontSize: "12px", fontWeight: 600 }}>
                          Invoice Total
                        </Table.Th>
                        <Table.Th style={{ fontSize: "12px", fontWeight: 600 }}>
                          Status
                        </Table.Th>
                        <Table.Th style={{ fontSize: "12px", fontWeight: 600 }}>
                          Actions
                        </Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {invoiceList.length === 0 ? (
                        <Table.Tr>
                          <Table.Td colSpan={6}>
                            <Center py="xl">
                              <Text c="dimmed">No invoices to display</Text>
                            </Center>
                          </Table.Td>
                        </Table.Tr>
                      ) : (
                        invoiceList.map((row, idx) => {
                          const statusUpper = (row.status ?? "").toUpperCase();
                          const isPosted =
                            statusUpper === "POSTED" || row.status === "posted";
                          const isUnposted =
                            statusUpper === "UNPOSTED" ||
                            row.status === "unpost";
                          const isReversed =
                            statusUpper === "PARTIALLY REVERSED" ||
                            statusUpper === "FULLY REVERSED";
                          const rowKey = `${row.id}-${idx}`;
                          const isExpanded = expandedInvoiceRowId === rowKey;
                          const reverseInvoices = row.reverse_invoices ?? [];
                          const hasReverseInvoices = reverseInvoices.length > 0;

                          return (
                            <Fragment key={rowKey}>
                              <Table.Tr
                                style={
                                  isReversed ? { cursor: "pointer" } : undefined
                                }
                                onClick={(e) => {
                                  if (
                                    (e.target as HTMLElement).closest(
                                      "[data-menu-dropdown],[button]",
                                    )
                                  )
                                    return;

                                  if (!isReversed) {
                                    setExpandedInvoiceRowId(null);
                                    return;
                                  }

                                  setExpandedInvoiceRowId((prev) =>
                                    prev === rowKey ? null : rowKey,
                                  );
                                }}
                              >
                                <Table.Td
                                  style={{ fontSize: "13px", width: "20%" }}
                                >
                                  <Group gap="xs" wrap="nowrap">
                                    {isReversed && (
                                      <Box
                                        component="span"
                                        style={{ display: "inline-flex" }}
                                      >
                                        {isExpanded ? (
                                          <IconChevronUp
                                            size={14}
                                            color="#105476"
                                          />
                                        ) : (
                                          <IconChevronDown
                                            size={14}
                                            color="#105476"
                                          />
                                        )}
                                      </Box>
                                    )}
                                    {row.day_book_name ?? "-"}
                                  </Group>
                                </Table.Td>
                                <Table.Td
                                  style={{ fontSize: "13px", width: "20%" }}
                                >
                                  {row.document_no ?? "-"}
                                </Table.Td>
                                <Table.Td
                                  style={{ fontSize: "13px", width: "15%" }}
                                >
                                  {row.document_date ?? "-"}
                                </Table.Td>
                                <Table.Td
                                  style={{ fontSize: "13px", width: "15%" }}
                                >
                                  {row.total}
                                </Table.Td>
                                <Table.Td
                                  style={{ fontSize: "13px", width: "15%" }}
                                >
                                  <Badge
                                    size="sm"
                                    variant="light"
                                    color={
                                      isUnposted
                                        ? "yellow"
                                        : isPosted
                                          ? "green"
                                          : "#105476"
                                    }
                                  >
                                    {row.status ?? "-"}
                                  </Badge>
                                </Table.Td>
                                <Table.Td
                                  style={{ fontSize: "13px", width: "15%" }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Menu
                                    shadow="md"
                                    width={200}
                                    position="bottom-end"
                                  >
                                    <Menu.Target>
                                      <ActionIcon
                                        variant="subtle"
                                        color="#105476"
                                        size="sm"
                                        styles={{
                                          root: {
                                            fontFamily: "Inter",
                                            fontSize: "13px",
                                            border: "1px solid #E9ECEF",
                                            borderRadius: "8px",
                                            "&:hover": {
                                              backgroundColor: "#F8F9FA",
                                            },
                                          },
                                        }}
                                      >
                                        <IconDotsVertical size={16} />
                                      </ActionIcon>
                                    </Menu.Target>
                                    <Menu.Dropdown
                                      styles={{
                                        dropdown: {
                                          border: "1px solid #E9ECEF",
                                          borderRadius: "8px",
                                          padding: "8px",
                                          boxShadow:
                                            "0 4px 12px rgba(0, 0, 0, 0.1)",
                                        },
                                      }}
                                    >
                                      <Menu.Item
                                        leftSection={
                                          <Box
                                            style={{
                                              backgroundColor: "#E7F5FF",
                                              borderRadius: "6px",
                                              padding: "6px",
                                              display: "flex",
                                              alignItems: "center",
                                              justifyContent: "center",
                                            }}
                                          >
                                            <IconEye
                                              size={16}
                                              color="#105476"
                                            />
                                          </Box>
                                        }
                                        styles={{
                                          item: {
                                            fontFamily: "Inter",
                                            fontSize: "13px",
                                            fontWeight: 500,
                                            borderRadius: "6px",
                                            padding: "10px 12px",
                                            marginBottom: "4px",
                                            "&:hover": {
                                              backgroundColor: "#F8F9FA",
                                            },
                                          },
                                          itemLabel: {
                                            fontFamily: "Inter",
                                            fontSize: "13px",
                                            fontWeight: 500,
                                            color: "#424242",
                                          },
                                        }}
                                        onClick={() =>
                                          navigate(
                                            `/air/export-job/invoice/view/${row.invoice_id}`,
                                            {
                                              state: {
                                                invoiceData: row,
                                                ...(location.state?.job && {
                                                  job: location.state.job,
                                                }),
                                              },
                                            },
                                          )
                                        }
                                      >
                                        View
                                      </Menu.Item>
                                      {isUnposted ? (
                                        <Menu.Item
                                          leftSection={
                                            <Box
                                              style={{
                                                backgroundColor: "#E7F5FF",
                                                borderRadius: "6px",
                                                padding: "6px",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                              }}
                                            >
                                              <IconEdit
                                                size={16}
                                                color="#105476"
                                              />
                                            </Box>
                                          }
                                          styles={{
                                            item: {
                                              fontFamily: "Inter",
                                              fontSize: "13px",
                                              fontWeight: 500,
                                              borderRadius: "6px",
                                              padding: "10px 12px",
                                              marginBottom: "4px",
                                              "&:hover": {
                                                backgroundColor: "#F8F9FA",
                                              },
                                            },
                                            itemLabel: {
                                              fontFamily: "Inter",
                                              fontSize: "13px",
                                              fontWeight: 500,
                                              color: "#424242",
                                            },
                                          }}
                                          onClick={() =>
                                            navigate(
                                              `/air/export-job/invoice/edit/${row.invoice_id}`,
                                              {
                                                state: {
                                                  invoiceData: row,
                                                  ...(location.state?.job && {
                                                    job: location.state.job,
                                                  }),
                                                },
                                              },
                                            )
                                          }
                                        >
                                          Edit
                                        </Menu.Item>
                                      ) : (
                                        <Menu.Item
                                          leftSection={
                                            <Box
                                              style={{
                                                backgroundColor: "#E7F5FF",
                                                borderRadius: "6px",
                                                padding: "6px",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                              }}
                                            >
                                              <IconRefresh
                                                size={16}
                                                color="#105476"
                                              />
                                            </Box>
                                          }
                                          styles={{
                                            item: {
                                              fontFamily: "Inter",
                                              fontSize: "13px",
                                              fontWeight: 500,
                                              borderRadius: "6px",
                                              padding: "10px 12px",
                                              marginBottom: "4px",
                                              "&:hover": {
                                                backgroundColor: "#F8F9FA",
                                              },
                                            },
                                            itemLabel: {
                                              fontFamily: "Inter",
                                              fontSize: "13px",
                                              fontWeight: 500,
                                              color: "#424242",
                                            },
                                          }}
                                          onClick={() =>
                                            navigate(
                                              "/air/export-job/invoice/reverse",
                                              {
                                                state: {
                                                  document_no:
                                                    row.document_no ?? "",
                                                  ...(location.state?.job && {
                                                    job: location.state.job,
                                                  }),
                                                },
                                              },
                                            )
                                          }
                                        >
                                          Invoice Reversal
                                        </Menu.Item>
                                      )}
                                    </Menu.Dropdown>
                                  </Menu>
                                </Table.Td>
                              </Table.Tr>
                              {isReversed && isExpanded && (
                                <Table.Tr>
                                  <Table.Td
                                    px={8}
                                    colSpan={6}
                                    style={{
                                      padding: 0,
                                      verticalAlign: "top",
                                      backgroundColor:
                                        "var(--mantine-color-gray-0)",
                                    }}
                                  >
                                    <Box
                                      p="sm"
                                      style={{ borderTop: "1px solid #E9ECEF" }}
                                    >
                                      <Text
                                        size="sm"
                                        fw={600}
                                        c="#105476"
                                        mb="xs"
                                      >
                                        Reverse invoices
                                      </Text>
                                      <Table
                                        withTableBorder
                                        withColumnBorders
                                        striped
                                        style={{ minWidth: 700 }}
                                      >
                                        <Table.Thead>
                                          <Table.Tr>
                                            <Table.Th
                                              style={{
                                                fontSize: "11px",
                                                fontWeight: 600,
                                                width: "20%",
                                              }}
                                            >
                                              Daybook
                                            </Table.Th>
                                            <Table.Th
                                              style={{
                                                fontSize: "11px",
                                                fontWeight: 600,
                                                width: "20%",
                                              }}
                                            >
                                              Invoice number
                                            </Table.Th>
                                            <Table.Th
                                              style={{
                                                fontSize: "11px",
                                                fontWeight: 600,
                                                width: "15%",
                                              }}
                                            >
                                              Invoice Date
                                            </Table.Th>
                                            <Table.Th
                                              style={{
                                                fontSize: "11px",
                                                fontWeight: 600,
                                                width: "15%",
                                              }}
                                            >
                                              Invoice Total
                                            </Table.Th>
                                            <Table.Th
                                              style={{
                                                fontSize: "11px",
                                                fontWeight: 600,
                                                width: "15%",
                                              }}
                                            >
                                              Status
                                            </Table.Th>
                                            <Table.Th
                                              style={{
                                                fontSize: "11px",
                                                fontWeight: 600,
                                                width: "15%",
                                              }}
                                            >
                                              Actions
                                            </Table.Th>
                                          </Table.Tr>
                                        </Table.Thead>
                                        <Table.Tbody>
                                          {hasReverseInvoices ? (
                                            reverseInvoices.map((rev, idx) => (
                                              <Table.Tr key={rev.id ?? idx}>
                                                <Table.Td
                                                  style={{
                                                    fontSize: "12px",
                                                    width: "20%",
                                                  }}
                                                >
                                                  {rev.day_book_name ?? "-"}
                                                </Table.Td>
                                                <Table.Td
                                                  style={{
                                                    fontSize: "12px",
                                                    width: "20%",
                                                  }}
                                                >
                                                  {rev.document_no ?? "-"}
                                                </Table.Td>
                                                <Table.Td
                                                  style={{
                                                    fontSize: "12px",
                                                    width: "15%",
                                                  }}
                                                >
                                                  {rev.document_date ?? "-"}
                                                </Table.Td>
                                                <Table.Td
                                                  style={{
                                                    fontSize: "12px",
                                                    width: "15%",
                                                  }}
                                                >
                                                  {rev.total ?? "-"}
                                                </Table.Td>
                                                <Table.Td
                                                  style={{
                                                    fontSize: "12px",
                                                    width: "15%",
                                                  }}
                                                >
                                                  <Badge
                                                    size="sm"
                                                    variant="light"
                                                    color="#105476"
                                                  >
                                                    {rev.status ?? "-"}
                                                  </Badge>
                                                </Table.Td>
                                                <Table.Td
                                                  style={{
                                                    fontSize: "12px",
                                                    width: "15%",
                                                  }}
                                                  onClick={(e) =>
                                                    e.stopPropagation()
                                                  }
                                                >
                                                  <Menu
                                                    shadow="md"
                                                    width={200}
                                                    position="bottom-end"
                                                  >
                                                    <Menu.Target>
                                                      <ActionIcon
                                                        variant="subtle"
                                                        color="#105476"
                                                        size="sm"
                                                        styles={{
                                                          root: {
                                                            fontFamily: "Inter",
                                                            fontSize: "13px",
                                                            border:
                                                              "1px solid #E9ECEF",
                                                            borderRadius: "8px",
                                                            "&:hover": {
                                                              backgroundColor:
                                                                "#F8F9FA",
                                                            },
                                                          },
                                                        }}
                                                      >
                                                        <IconDotsVertical
                                                          size={16}
                                                        />
                                                      </ActionIcon>
                                                    </Menu.Target>
                                                    <Menu.Dropdown
                                                      styles={{
                                                        dropdown: {
                                                          border:
                                                            "1px solid #E9ECEF",
                                                          borderRadius: "8px",
                                                          padding: "8px",
                                                          boxShadow:
                                                            "0 4px 12px rgba(0, 0, 0, 0.1)",
                                                        },
                                                      }}
                                                    >
                                                      <Menu.Item
                                                        leftSection={
                                                          <Box
                                                            style={{
                                                              backgroundColor:
                                                                "#E7F5FF",
                                                              borderRadius:
                                                                "6px",
                                                              padding: "6px",
                                                              display: "flex",
                                                              alignItems:
                                                                "center",
                                                              justifyContent:
                                                                "center",
                                                            }}
                                                          >
                                                            <IconEye
                                                              size={16}
                                                              color="#105476"
                                                            />
                                                          </Box>
                                                        }
                                                        styles={{
                                                          item: {
                                                            fontFamily: "Inter",
                                                            fontSize: "13px",
                                                            fontWeight: 500,
                                                            borderRadius: "6px",
                                                            padding:
                                                              "10px 12px",
                                                            marginBottom: "4px",
                                                            "&:hover": {
                                                              backgroundColor:
                                                                "#F8F9FA",
                                                            },
                                                          },
                                                          itemLabel: {
                                                            fontFamily: "Inter",
                                                            fontSize: "13px",
                                                            fontWeight: 500,
                                                            color: "#424242",
                                                          },
                                                        }}
                                                        onClick={() => {
                                                          const targetId =
                                                            (rev.reverse_invoice_id ??
                                                              (row as any)
                                                                .reverse_invoice_id) as number;

                                                          navigate(
                                                            `/air/export-job/invoice/view/${targetId}`,
                                                            {
                                                              state: {
                                                                invoiceData: {
                                                                  ...row,
                                                                  ...rev,
                                                                  id: targetId,
                                                                  document_no:
                                                                    rev.document_no ??
                                                                    (row as any)
                                                                      .document_no,
                                                                  document_date:
                                                                    rev.document_date ??
                                                                    (row as any)
                                                                      .document_date,
                                                                  total:
                                                                    rev.total ??
                                                                    (row as any)
                                                                      .total,
                                                                  status:
                                                                    rev.status ??
                                                                    (row as any)
                                                                      .status,
                                                                  day_book_name:
                                                                    rev.day_book_name ??
                                                                    (row as any)
                                                                      .day_book_name,
                                                                },
                                                                ...(location
                                                                  .state
                                                                  ?.job && {
                                                                  job: location
                                                                    .state.job,
                                                                }),
                                                              },
                                                            },
                                                          );
                                                        }}
                                                      >
                                                        View
                                                      </Menu.Item>
                                                    </Menu.Dropdown>
                                                  </Menu>
                                                </Table.Td>
                                              </Table.Tr>
                                            ))
                                          ) : (
                                            <Table.Tr>
                                              <Table.Td
                                                colSpan={6}
                                                style={{ fontSize: "12px" }}
                                              >
                                                <Center py="md">
                                                  <Text c="dimmed">
                                                    No reverse invoices to
                                                    display
                                                  </Text>
                                                </Center>
                                              </Table.Td>
                                            </Table.Tr>
                                          )}
                                        </Table.Tbody>
                                      </Table>
                                    </Box>
                                  </Table.Td>
                                </Table.Tr>
                              )}
                            </Fragment>
                          );
                        })
                      )}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              )}
            </Box>
          </Tabs.Panel>
        )}
      </Tabs>

      <Group justify="space-between" mt="xl">
        <Button
          variant="outline"
          color="#105476"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => {
            // Determine navigation path based on edit mode
            const isInEditMode = location.state?.job && location.state.job.id;
            const navigatePath = isInEditMode
              ? "/air/export-job/edit"
              : "/air/export-job/create";

            navigate(navigatePath, {
              state: {
                hawbDetails: existingHousingDetails,
                // Support legacy housingDetails key for backward compatibility
                housingDetails: existingHousingDetails,
                // Preserve any existing job data
                ...(location.state?.job && { job: location.state.job }),
                // Preserve form state when navigating back
                ...(location.state?.mawbDetails && {
                  mawbDetails: location.state.mawbDetails,
                }),
                ...(location.state?.carrierDetails && {
                  carrierDetails: location.state.carrierDetails,
                }),
                ...(location.state?.routings && {
                  routings: location.state.routings,
                }),
              },
            });
          }}
        >
          Back to Export Job
        </Button>

        <Group>
          {active > 0 && (
            <Button
              leftSection={<IconChevronLeft size={16} />}
              variant="outline"
              onClick={handlePrev}
            >
              Previous
            </Button>
          )}

          {active < 3 && (
            <Button
              rightSection={<IconChevronRight size={16} />}
              color="#105476"
              onClick={handleNext}
            >
              Next
            </Button>
          )}
          {active === 3 && (
            <Button
              rightSection={<IconChevronRight size={16} />}
              color="#105476"
              onClick={handleNext}
            >
              Save HBL
            </Button>
          )}
        </Group>
      </Group>

      {/* PDF Preview Modal */}
      <Modal
        opened={previewOpen}
        onClose={handleClosePreview}
        title="PDF Preview"
        size="xl"
        styles={{
          body: {
            padding: 0,
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

export default HouseCreate;
