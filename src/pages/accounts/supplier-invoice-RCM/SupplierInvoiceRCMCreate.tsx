import {
    Badge,
    Box,
    Button,
    Grid,
    Group,
    Loader,
    Modal,
    NumberInput,
    Stack,
    Text,
    Textarea,
    TextInput,
  } from "@mantine/core";
  import { useForm } from "@mantine/form";
  import {
    IconArrowLeft,
    IconChevronRight,
    IconPlus,
    IconTrash,
    IconUpload,
    IconDownload,
    IconX,
  } from "@tabler/icons-react";
  import { useState, useMemo, useEffect, useCallback, useRef } from "react";
  import { useDisclosure } from "@mantine/hooks";
  import { Dropzone } from "@mantine/dropzone";
  import { useNavigate, useLocation } from "react-router-dom";
  import EditPageHeadingRow from "../../../components/EditPageHeadingRow";
  import { mergeEditPageAuditSources, appendEditPageAuditPatch } from "../../../utils/editPageAuditInfo";
  import { useQuery } from "@tanstack/react-query";
  import { URL } from "../../../api/serverUrls";
  import { apiCallProtected } from "../../../api/axios";
  import {
    Dropdown,
    SearchableSelect,
    SingleDateInput,
    ToastNotification,
  } from "../../../components";
  import { getAPICall } from "../../../service/getApiCall";
  import { API_HEADER } from "../../../store/storeKeys";
  import { postAPICall } from "../../../service/postApiCall";
  import useAuthStore from "../../../store/authStore";
  import { useCanPostDocuments } from "../../../hooks/useCanPostDocuments";
  import { isIndianUserCountry } from "../../../utils/userNumberFormat";
  import {
    findJobCreateDropdownRow,
    mapJobCreateDropdownOptions,
  } from "../../../utils/jobCreateDropdown";
  import {
    bindMoneyWholeNumberMode,
    clampCurrencyMoneyAmountBound,
    clampMoneyAmountBound,
    formatMoneyAmount,
    formatMoneyAmountBound,
    formatMoneyAmountForUi,
    getAmountDecimalScale,
    isVietnamBranchFromUser,
    roundLocalMoneyToDecimals,
  } from "../../../utils/nonDecimalMoneyAmount";
  import { getAmountNumberInputFormatProps } from "../../../utils/amountDisplayFormat";
  import { useAccountsDocumentCurrencyRoe } from "../../../hooks/useAccountsDocumentCurrencyRoe";
  import {
    formatRoeForAccountsPayload,
    parseRoeForPayload,
    ROE_DECIMAL_PLACES,
  } from "../../../utils/exchangeRateRoe";
  
  const fetchCurrencyMaster = async () => {
    try {
      const response = await getAPICall(`${URL.currencyMaster}`, API_HEADER);
      return response;
    } catch (error) {
      console.error("Error fetching currency master:", error);
      return [];
    }
  };
  
  const fetchStateMaster = async () => {
    try {
      const response = await getAPICall(`${URL.state}`, API_HEADER);
      return (response as { data?: unknown[] })?.data ?? response ?? [];
    } catch (error) {
      console.error("Error fetching state master:", error);
      return [];
    }
  };
  
  const fetchTdsSectionMaster = async () => {
    try {
      const response = await getAPICall(`${URL.tdsSectionMaster}`, API_HEADER);
      return (response as { data?: unknown[] })?.data ?? response ?? [];
    } catch (error) {
      console.error("Error fetching TDS section master:", error);
      return [];
    }
  };
  
  const fetchDaybookByType = async (
    documentType: "CRJ" | "CRJREV",
  ): Promise<unknown[]> => {
    try {
      const payload = { filters: { document_type: documentType } };
      const response = await postAPICall(URL.daybook, payload, API_HEADER);
      return (response as { data?: unknown[] })?.data ?? [];
    } catch (error) {
      console.error("Error fetching daybook:", error);
      return [];
    }
  };
  
  const fetchChargeMaster = async () => {
    try {
      const response = await postAPICall(
        URL.chargeMasterFilter,
        { filters: {} },
        API_HEADER,
      );
      return (response as { data?: unknown[] })?.data ?? [];
    } catch (error) {
      console.error("Error fetching charge master:", error);
      return [];
    }
  };
  
  // GET job-create dropdown list (shipment_id, service_id for get-effective-sac)
  const fetchJobCreate = async () => {
    try {
      const response = await getAPICall(URL.filterJobCreate, API_HEADER);
      return (
        (response as { data?: { shipment_id?: string; service_id?: number }[] })
          ?.data ?? []
      );
    } catch (error) {
      console.error("Error fetching job-create:", error);
      return [];
    }
  };
  
  // Fetch effective SAC for charge + service: POST { items: [{ charge_id, service_id }] }
  const fetchGetEffectiveSac = async (
    items: { charge_id: number; service_id: number }[],
  ) => {
    try {
      const response = await postAPICall(
        URL.gstChargeMappingGetEffectiveSac,
        { items },
        API_HEADER,
      );
      return (
        (
          response as {
            data?: Array<{
              charge_id: number;
              service_id: number;
              sac_code?: string | null;
              sac_name?: string | null;
              error?: string;
            }>;
          }
        )?.data ?? []
      );
    } catch (error) {
      console.error("Error fetching get-effective-sac:", error);
      return [];
    }
  };
  
  const CRN_OPTIONS = [
    { value: "Cost", label: "Cost" },
    { value: "Revenue", label: "Revenue" },
    { value: "Neutral", label: "Neutral" },
  ];
  
  type ChargeRow = {
    id?: number;
    account_id?: number | null;
    account_code: string;
    account_name?: string;
    subledger_code: string;
    CRN: string;
    narration: string;
    shipment_no: string;
    charge_id: number | null;
    charge_name?: string;
    currency_id: number | null;
    roe: number | null;
    amount: number | null;
    amount_in_local: number | null;
    tax_code: string;
    Dr_Cr: "Cr" | "Dr";
  };
  
  type SupportingDocument = {
    name: string;
    file: File | null;
    document_url?: string;
    document_id?: number;
    original_document_name?: string;
  };
  
  type SupplierInvoiceFormValues = {
    cbp_number: string;
    cost_center: string;
    day_book_id: string;
    date: Date | null;
    due_date: Date | null;
    creditor_agent: string;
    agent_code: string;
    state_id: string;
    tds_section_code: string;
    note: string;
    narration: string;
    customer_gst_no: string;
    location_gst_no: string;
    type: "INV" | "CRN";
    Inv_Crn_note: Date | null;
    Inv_Crn_no: string;
    roe: number | null;
    currency_id: string;
    taxable_amount: number | null;
    non_taxable_amount: number | null;
    cgst_amount: number | null;
    sgst_amount: number | null;
    igst_amount: number | null;
    Inv_crn_amount: number | null;
    approved_amount: number | null;
    difference_amount: number | null;
    status: string;
    Dr_Cr: "Cr" | "Dr"; // Sent in payload; no UI field. Supplier Invoice = "Dr", Reverse = "Cr"
    charges_data: ChargeRow[];
    supporting_documents: SupportingDocument[];
  };
  
  function round2(n: number): number {
    return Math.round(n * 100) / 100;
  }
  
  function normalizeDate(value: Date | string | null | undefined): Date | null {
    if (value === null || value === undefined) return null;
    if (value instanceof Date) return value;
    const d = new Date(value as string);
    return isNaN(d.getTime()) ? null : d;
  }
  
  const AMOUNT_MAX = 9999999999999.99; // 13 digits + 2 decimals = 15 digits max
  
  function clampAmount(value: number | null | undefined): number | null {
    if (value == null || !Number.isFinite(value))
      return value === undefined ? null : value;
    const rounded = clampCurrencyMoneyAmountBound(value);
    if (rounded == null) return null;
    if (Math.abs(rounded) > AMOUNT_MAX)
      return rounded > 0 ? AMOUNT_MAX : -AMOUNT_MAX;
    return rounded;
  }

  /** Local amounts: whole numbers for Vietnam branch; else 2 decimals. */
  function clampLocalAmount(value: number | null | undefined): number | null {
    if (value == null || !Number.isFinite(value))
      return value === undefined ? null : value;
    const rounded = clampMoneyAmountBound(value);
    if (rounded == null) return null;
    if (Math.abs(rounded) > AMOUNT_MAX)
      return rounded > 0 ? AMOUNT_MAX : -AMOUNT_MAX;
    return rounded;
  }

  function toLocalAmount(value: number | string | null | undefined): number | null {
    const rounded = roundLocalMoneyToDecimals(value);
    return rounded == null || !Number.isFinite(rounded) ? null : rounded;
  }

  function formatAmountToTwoDecimals(value: number | null | undefined): string {
    if (value == null || !Number.isFinite(value)) {
      return formatMoneyAmount(0, false);
    }
    const clamped = clampAmount(value);
    return formatMoneyAmount(clamped ?? 0, false);
  }

  function formatLocalAmount(value: number | null | undefined): string {
    if (value == null || !Number.isFinite(value)) {
      return formatMoneyAmountBound(0);
    }
    const clamped = clampLocalAmount(value);
    return formatMoneyAmountBound(clamped ?? 0);
  }
  
  /** YYYY-MM-DD for supplier invoice RCM API payloads (local calendar day) */
  function formatDDMMYYYY(d: Date): string {
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${year}-${month}-${day}`;
  }
  
  function normalizeDrCr(value: unknown): "Dr" | "Cr" {
    const raw = String(value ?? "").trim().toUpperCase();
    if (raw === "CR" || raw === "CREDIT") return "Cr";
    return "Dr";
  }
  
  /** Accept YYYY-MM-DD or DD-MM-YYYY from API when hydrating edit/view */
  function parseDDMMYYYY(s: string | null | undefined): Date | null {
    if (s == null || String(s).trim() === "") return null;
    const p = String(s).trim().split("-");
    if (p.length !== 3) return null;
    const a = String(p[0] ?? "").trim();
    const b = String(p[1] ?? "").trim();
    const c = String(p[2] ?? "").trim();
    let d: number;
    let m: number;
    let y: number;
    if (a.length === 4) {
      y = parseInt(a, 10);
      m = parseInt(b, 10) - 1;
      d = parseInt(c, 10);
    } else {
      d = parseInt(a, 10);
      m = parseInt(b, 10) - 1;
      y = parseInt(c, 10);
    }
    if (!Number.isFinite(d) || !Number.isFinite(m) || !Number.isFinite(y))
      return null;
    const date = new Date(y, m, d);
    return isNaN(date.getTime()) ? null : date;
  }
  
  type ApiCharge = {
    id?: number;
    account_code?: string;
    gl_account_code?: string; // list API may return either
    account_name?: string;
    subledger_code?: string;
    CRN?: string;
    narration?: string;
    shipment_no?: string;
    charge_id?: number;
    currency_id?: number;
    roe?: number | string;
    amount?: number | string;
    amount_in_local?: number | string;
    tax_code?: string;
    Dr_Cr?: string;
  };
  
  /** Invoice row from list API (filter/supplier-invoice) — used for View/Edit from list. Same shape as list response item. */
  type SupplierInvoiceListItem = Record<string, unknown> & {
    id?: number;
    charges?: ApiCharge[];
  };
  
  function mapApiChargesToRows(charges: ApiCharge[]): ChargeRow[] {
    if (!Array.isArray(charges)) return [];
    return charges.map((c) => ({
      id: c.id,
      account_code: String(c.account_code ?? c.gl_account_code ?? "").trim(),
      account_name: c.account_name ?? "",
      subledger_code: c.subledger_code ?? "",
      CRN: c.CRN ?? "",
      narration: c.narration ?? "",
      shipment_no: String(c.shipment_no ?? "").trim(),
      charge_id: c.charge_id ?? null,
      charge_name: (c as { charge_name?: unknown }).charge_name != null ? String((c as { charge_name?: unknown }).charge_name) : "",
      currency_id: c.currency_id ?? null,
      roe:
        typeof c.roe === "string" ? parseFloat(c.roe) || null : (c.roe ?? null),
      amount:
        typeof c.amount === "string"
          ? parseFloat(c.amount) || null
          : (c.amount ?? null),
      amount_in_local: toLocalAmount(c.amount_in_local),
      tax_code: c.tax_code ?? "",
      Dr_Cr: (() => {
        const v = (c.Dr_Cr ?? "").toString().toUpperCase();
        return (v === "CR" || v === "DR" ? (v === "CR" ? "Cr" : "Dr") : "Dr") as
          | "Dr"
          | "Cr";
      })(),
    }));
  }
  
  const inputStyles = {
    input: {
      fontSize: "13px",
      fontFamily: "Inter",
      height: "36px",
    },
    label: {
      fontSize: "13px",
      fontFamily: "Inter",
      marginBottom: "4px",
    },
  };
  
  const readOnlyFieldStyles = {
    input: {
      fontSize: "13px",
      fontFamily: "Inter",
      height: "36px",
      backgroundColor: "#f5f5f5",
      cursor: "default",
    },
    label: inputStyles.label,
  };

  /** ROE validation text below the input without affecting flex-end row alignment */
  function FieldErrorBelow({ error }: { error?: string | null }) {
    if (!error) return null;
    return (
      <Text
        size="xs"
        c="red"
        style={{
          position: "absolute",
          top: "100%",
          left: 0,
          right: 0,
          marginTop: 4,
          lineHeight: 1.2,
        }}
      >
        {error}
      </Text>
    );
  }
  
  // Reversal: non-editable via styling (only daybook and date editable) — same idea as ReceiptCreate
  const reversalNonEditableStyles = {
    root: { opacity: 1, pointerEvents: "none" as const },
    input: {
      fontSize: "13px",
      fontFamily: "Inter",
      height: "36px",
      backgroundColor: "#f5f5f5",
      cursor: "default",
      opacity: 1,
      pointerEvents: "none" as const,
    },
    label: inputStyles.label,
  };
  
  type SupplierInvoiceCreateProps = {
    isReversal?: boolean;
    titleOverride?: string;
    backPath?: string;
  };
  
  export default function SupplierInvoiceCreate({
    isReversal = false,
    titleOverride,
  backPath = "/supplier-invoice-rcm",
  }: SupplierInvoiceCreateProps = {}) {
    const navigate = useNavigate();
    const location = useLocation();
    const user = useAuthStore((state) => state.user);
    const canPostDocuments = useCanPostDocuments();
    const pathname = location.pathname;
    const isViewMode = pathname.includes("/view");
    const isEditMode = pathname.includes("/edit");
    const isReversalCreate =
      isReversal && pathname.includes("/reversal/create");
    // Load from list: state is invoice row (Supplier Invoice list) — same pattern as ReceiptCreate
    const invoiceFromState =
      location.state as SupplierInvoiceListItem | null | undefined;

    useEffect(() => {
      setAuditPatch(null);
    }, [location.key]);
  
    // Reversal mode: header "Cr", charges "Dr" (opposite of Supplier Invoice: header "Dr", charges "Cr")
    useEffect(() => {
      if (isReversal) {
        form.setFieldValue("Dr_Cr", "Cr");
        form.values.charges_data.forEach((_, i) => {
          form.setFieldValue(`charges_data.${i}.Dr_Cr`, "Dr");
        });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isReversal]);
  
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [saveResponse, setSaveResponse] = useState<{
      id?: number;
      crj_number?: string;
      reverse_crj_number?: string;
      Inv_Crn_no?: string;
      status?: string;
    } | null>(null);
    const [auditPatch, setAuditPatch] = useState<Record<string, unknown> | null>(
      null,
    );
    const saveResponseRef = useRef<typeof saveResponse>(null);
    useEffect(() => {
      saveResponseRef.current = saveResponse;
    }, [saveResponse]);
  
    const [calcLoading, setCalcLoading] = useState(false);
    const [calcLoadingText, setCalcLoadingText] = useState<string>("");
  
    const parseNum = (v: unknown): number | null => {
      if (v == null || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const [
      documentsModalOpened,
      { open: openDocumentsModal, close: closeDocumentsModal },
    ] = useDisclosure(false);
    const [fileErrors, setFileErrors] = useState<{ [key: number]: string }>({});
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  
    const downloadFile = (url: string, fileName: string) => {
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
  
    const {
      defaultBranchCurrencyId,
      isLocalCurrency,
      syncRoeForCurrencyChange,
      onRoeValueChange,
      validateRoeField,
      validateRoeToast,
    } = useAccountsDocumentCurrencyRoe();

    const isIndiaUser =
      isIndianUserCountry(user?.country?.country_code) ||
      String(user?.country?.country_name ?? "")
        .toLowerCase()
        .includes("india");

    const isVietnamBranch = useMemo(
      () => isVietnamBranchFromUser(user),
      [user],
    );
    bindMoneyWholeNumberMode(isVietnamBranch);
    const currencyAmountDecimalScale = getAmountDecimalScale(false);
    const localAmountDecimalScale = getAmountDecimalScale(isVietnamBranch);

    const cjvColSpans = useMemo(
      () =>
        isIndiaUser
          ? {
              dayBook: 1.25,
              date: 1.25,
              dueDate: 1.25,
              vendor: 1.5,
              state: 1.25,
              tds: 1.25,
              customerGst: 1,
              note: 1.25,
              narration: 1.25,
            }
          : {
              dayBook: 1.5,
              date: 1.5,
              dueDate: 1.5,
              vendor: 2,
              note: 2.25,
              narration: 2.25,
            },
      [isIndiaUser],
    );

    const agentColSpans = useMemo(
      () =>
        isIndiaUser
          ? {
              type: 0.8,
              invCrnNo: 0.95,
              invCrnDate: 0.95,
              currency: 0.9,
              roe: 0.8,
              taxable: 0.95,
              nonTaxable: 0.95,
              cgst: 0.95,
              sgst: 0.95,
              igst: 0.95,
              invCrnAmount: 0.95,
              approved: 0.95,
              difference: 0.95,
            }
          : {
              type: 0.85,
              invCrnNo: 1.1,
              invCrnDate: 1.25,
              currency: 1,
              roe: 0.9,
              taxable: 1.1,
              nonTaxable: 1.25,
              invCrnAmount: 1.15,
              approved: 1.15,
              difference: 1.15,
            },
      [isIndiaUser],
    );

    const chargeColSpans = useMemo(
      () =>
        isIndiaUser
          ? {
              shipment: 1.25,
              charge: 1.25,
              crn: 0.8,
              account: 1,
              subledger: 1,
              narration: 1.6,
              currency: 0.75,
              roe: 0.65,
              amount: 0.8,
              localAmount: 0.8,
              sac: 0.75,
              drCr: 0.75,
              actions: 0.5,
            }
          : {
              shipment: 1.35,
              charge: 1.35,
              crn: 0.85,
              account: 1.05,
              subledger: 1.05,
              narration: 1.75,
              currency: 0.8,
              roe: 0.7,
              amount: 0.85,
              localAmount: 0.85,
              drCr: 0.8,
              actions: 0.5,
            },
      [isIndiaUser],
    );

    const getDrCrDefaultsByType = useCallback(
      (type: "INV" | "CRN") =>
        type === "CRN"
          ? ({ header: "Dr", charge: "Cr" } as const)
          : ({ header: "Cr", charge: "Dr" } as const),
      [],
    );

    const form = useForm<SupplierInvoiceFormValues>({
      initialValues: {
        cbp_number: "",
        cost_center: "",
        day_book_id: "",
        date: new Date(),
        due_date: new Date(),
        creditor_agent: "",
        agent_code: "",
        state_id: "",
        tds_section_code: "",
        note: "",
        narration: "",
        customer_gst_no: "",
        location_gst_no: "",
        type: "INV",
        Inv_Crn_note: null,
        Inv_Crn_no: "",
        roe: null,
        currency_id: defaultBranchCurrencyId || "",
        taxable_amount: null,
        non_taxable_amount: null,
        cgst_amount: null,
        sgst_amount: null,
        igst_amount: null,
        Inv_crn_amount: null,
        approved_amount: null,
        difference_amount: null,
        status: "UNPOSTED",
        Dr_Cr: isReversal ? "Dr" : "Cr", // Header: Supplier="Cr", Reverse="Dr" (payload only)
        charges_data: [
          {
            account_code: "",
            account_name: "",
            subledger_code: "",
            CRN: "Cost",
            narration: "",
            shipment_no: "",
            charge_id: null,
            currency_id:
              defaultBranchCurrencyId
                ? Number(defaultBranchCurrencyId)
                : null,
            roe: defaultBranchCurrencyId ? 1 : null,
            amount: null,
            amount_in_local: null,
            tax_code: "",
            Dr_Cr: isReversal ? "Cr" : "Dr", // Charges: Supplier default="Dr", Reverse default="Cr"
          },
        ],
        supporting_documents: [] as SupportingDocument[],
      },
      validate: {
        day_book_id: (v) => (!v ? "Day book is required" : null),
        date: (v) => (!v ? "Date is required" : null),
        due_date: (v) => (!v ? "Due date is required" : null),
        currency_id: (v) => (!v ? "Currency is required" : null),
        state_id: (v) =>
          isIndiaUser && !v ? "State is required" : null,
        Inv_Crn_no: (v) =>
          !String(v ?? "").trim() ? "Inv/Crn No is required" : null,
        Inv_Crn_note: (v) => (!v ? "Inv/Crn Date is required" : null),
      },
    });
  
    const { data: currencyData = [], isLoading: isCurrencyLoading } = useQuery({
      queryKey: ["currencyMaster"],
      queryFn: fetchCurrencyMaster,
      staleTime: Infinity,
    });
  
    const { data: stateData = [], isLoading: isStateLoading } = useQuery({
      queryKey: ["stateMaster"],
      queryFn: fetchStateMaster,
      staleTime: Infinity,
      enabled: isIndiaUser,
    });
  
    const { data: tdsSectionData = [], isLoading: isTdsSectionLoading } =
      useQuery({
        queryKey: ["tdsSectionMaster"],
        queryFn: fetchTdsSectionMaster,
        staleTime: Infinity,
        enabled: isIndiaUser,
      });
  
    const daybookDocumentType = isReversal ? "CRJREV" : "CRJ";
    const { data: daybookData = [], isLoading: isDaybookLoading } = useQuery({
      queryKey: ["daybook", daybookDocumentType],
      queryFn: () => fetchDaybookByType(daybookDocumentType),
      staleTime: Infinity,
    });
  
    const { isLoading: isChargeLoading } = useQuery({
      queryKey: ["chargeMaster"],
      queryFn: fetchChargeMaster,
      staleTime: Infinity,
    });

    const { data: sacCodes = [] } = useQuery({
      queryKey: ["gstSacMasterFilter", "supplier-invoice-rcm"],
      queryFn: async () => {
        try {
          const res = await postAPICall(URL.gstSacMasterFilter, {}, API_HEADER);
          const maybeAxios = res as { data?: unknown };
          const payloadUnknown: unknown = maybeAxios?.data ?? res;
          const isObj = (v: unknown): v is Record<string, unknown> =>
            typeof v === "object" && v !== null && !Array.isArray(v);

          let rows: unknown[] = [];
          if (Array.isArray(payloadUnknown)) {
            rows = payloadUnknown;
          } else if (
            isObj(payloadUnknown) &&
            Array.isArray(payloadUnknown.data)
          ) {
            rows = payloadUnknown.data as unknown[];
          } else if (
            isObj(payloadUnknown) &&
            isObj(payloadUnknown.data) &&
            Array.isArray((payloadUnknown.data as Record<string, unknown>).data)
          ) {
            rows = (payloadUnknown.data as Record<string, unknown>)
              .data as unknown[];
          }

          const list = rows as Array<{ sac_code?: unknown }>;
          return list
            .map((r) => String(r?.sac_code ?? "").trim())
            .filter(Boolean);
        } catch (e) {
          console.error("Error fetching SAC master:", e);
          return [] as string[];
        }
      },
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      enabled: isIndiaUser,
    });

    const sacCodeOptions = useMemo(() => {
      const uniq = new Set<string>();
      (Array.isArray(sacCodes) ? sacCodes : []).forEach((c) => {
        const v = String(c ?? "").trim();
        if (v) uniq.add(v);
      });
      return Array.from(uniq);
    }, [sacCodes]);

    const sacCodeOptionsForForm = useMemo(() => {
      const uniq = new Set<string>(sacCodeOptions);
      (form.values.charges_data ?? []).forEach((c) => {
        const v = String(c.tax_code ?? "").trim();
        if (v) uniq.add(v);
      });
      return Array.from(uniq);
    }, [sacCodeOptions, form.values.charges_data]);
  
    const currencyOptions = useMemo(() => {
      const data = currencyData as {
        id?: number;
        currency_code?: string;
        code?: string;
      }[];
      if (!Array.isArray(data)) return [];
      return data
        .map((item) => ({
          value: String(item.id ?? ""),
          label:
            (item.currency_code ?? item.code ?? "").toString().trim() ||
            String(item.id ?? ""),
        }))
        .filter((o) => o.value);
    }, [currencyData]);

    const headerCurrencyCode = useMemo(
      () =>
        currencyOptions.find((o) => o.value === form.values.currency_id)?.label ??
        "",
      [currencyOptions, form.values.currency_id],
    );
    const isHeaderLocalCurrency = isLocalCurrency(
      headerCurrencyCode,
      form.values.currency_id,
    );

    const stateOptions = useMemo(() => {
      const data = stateData as {
        id?: number;
        state_name?: string;
        name?: string;
      }[];
      if (!Array.isArray(data)) return [];
      return data.map((item) => ({
        value: String(item.id ?? ""),
        label: item.state_name ?? item.name ?? "",
      }));
    }, [stateData]);
  
    const effectiveStateOptions = useMemo(() => {
      // For reversal-create: ensure the selected state's *name* is visible even before master loads.
      const data = (invoiceFromState ?? {}) as Record<string, unknown>;
      const id = data.state_id != null ? String(data.state_id) : "";
      const name = data.state_name != null ? String(data.state_name) : "";
      if (!isReversalCreate || !id || !name) return stateOptions;
      if (stateOptions.some((o) => o.value === id)) return stateOptions;
      return [{ value: id, label: name }, ...stateOptions];
    }, [invoiceFromState, isReversalCreate, stateOptions]);
  
    const tdsSectionOptions = useMemo(() => {
      const data = tdsSectionData as {
        tds_section_code?: string | number;
        tds_section_name?: string;
      }[];
      if (!Array.isArray(data)) return [];
      return data
        .map((item) => {
          const code = String(item.tds_section_code ?? "").trim();
          const name = String(item.tds_section_name ?? "").trim();
          const label =
            name && code ? `${name} - ${code}` : name || code;
          return { value: code, label };
        })
        .filter((o) => o.value);
    }, [tdsSectionData]);
  
    const daybookOptions = useMemo(() => {
      const data = daybookData as { id?: number; name?: string }[];
      if (!Array.isArray(data)) return [];
      return data.map((item) => ({
        value: String(item.id ?? ""),
        label: item.name ?? "",
      }));
    }, [daybookData]);
  
    const selectedDaybookLabel =
      daybookOptions.find((o) => o.value === String(form.values.day_book_id))
        ?.label ?? "";
    const selectedDaybookLabelUpper = selectedDaybookLabel.toUpperCase();
    const isOverseasCrjDaybook = selectedDaybookLabelUpper.includes("OVERSEAS");
    const vendorApiEndpoint = isOverseasCrjDaybook ? URL.agent : URL.supplierByType;
  
    const isDaybookSelected = !!form.values.day_book_id;
  
    // chargeOptions no longer used; charge selection uses SearchableSelect + API endpoint.
  
    const { data: jobCreateData = [] } = useQuery({
      queryKey: ["jobCreate"],
      queryFn: fetchJobCreate,
      staleTime: 60_000,
    });
  
    const jobList = jobCreateData as {
      type?: string;
      job_id?: string;
      shipment_id?: string;
      service_id?: number;
    }[];
    const shipmentOptions = useMemo(() => {
      if (!Array.isArray(jobList)) return [];
      return mapJobCreateDropdownOptions(
        jobList as Array<Record<string, unknown>>,
      );
    }, [jobList]);

    const getServiceIdByShipmentId = useCallback(
      (shipmentId: string | null | undefined): number | null => {
        if (!shipmentId || !Array.isArray(jobList)) return null;
        const item = findJobCreateDropdownRow(
          jobList as Array<Record<string, unknown>>,
          shipmentId,
        );
        return item?.service_id != null ? Number(item.service_id) : null;
      },
      [jobList],
    );
  
    const fetchSacForChargeRow = useCallback(
      (index: number, chargeId: number | null, shipmentNo: string) => {
        if (!isIndiaUser || chargeId == null || !shipmentNo) return;
        const serviceId = getServiceIdByShipmentId(shipmentNo);
        if (serviceId == null) return;
        fetchGetEffectiveSac([
          { charge_id: chargeId, service_id: serviceId },
        ]).then((data) => {
          const item = data.find((x) => x.charge_id === chargeId);
          if (item?.sac_code != null && item.sac_code !== "") {
            form.setFieldValue(`charges_data.${index}.tax_code`, item.sac_code);
          }
        });
      },
      [getServiceIdByShipmentId, isIndiaUser],
    );
  
    const [agentDisplayName, setAgentDisplayName] = useState<string | null>(null);
    const isVendorSelected =
      !!String(form.values.agent_code ?? "").trim() ||
      !!String(agentDisplayName ?? "").trim();
  
    useEffect(() => {
      const effectiveCurrency =
        form.values.currency_id || defaultBranchCurrencyId || "";
      if (!effectiveCurrency) return;
      if (!form.values.currency_id) {
        form.setFieldValue("currency_id", defaultBranchCurrencyId);
      }
      // Don't overwrite charges_data in view/edit — they were loaded from list state
      if (isViewMode || isEditMode) return;
      // Set local currency + ROE on charge rows
      const charges = form.values.charges_data;
      const next = charges.map((c) => {
        const resolvedId =
          c.currency_id ??
          (effectiveCurrency ? Number(effectiveCurrency) : null);
        const currencyIdStr =
          resolvedId != null ? String(resolvedId) : effectiveCurrency;
        const code =
          currencyOptions.find((o) => o.value === currencyIdStr)?.label ?? "";
        const patch: Partial<ChargeRow> = {};
        if (c.currency_id == null && resolvedId != null) {
          patch.currency_id = resolvedId;
        }
        if (isLocalCurrency(code, currencyIdStr) && c.roe !== 1) {
          patch.roe = 1;
        }
        return Object.keys(patch).length > 0 ? { ...c, ...patch } : c;
      });
      if (
        next.some(
          (c, i) =>
            c.currency_id !== charges[i]?.currency_id ||
            c.roe !== charges[i]?.roe,
        )
      ) {
        form.setFieldValue("charges_data", next);
      }
      if (!isViewMode && !isEditMode) {
        const currCode =
          currencyOptions.find((o) => o.value === effectiveCurrency)?.label ??
          "";
        if (currCode && form.values.roe == null) {
          syncRoeForCurrencyChange(
            currCode,
            (roe) => form.setFieldValue("roe", roe),
            effectiveCurrency,
          );
        }
      }
    }, [
      defaultBranchCurrencyId,
      form.values.currency_id,
      isViewMode,
      isEditMode,
      currencyOptions,
      syncRoeForCurrencyChange,
      isLocalCurrency,
    ]);
  
    // Auto-calc amount_in_local = ROE * Amount whenever ROE or Amount changes
    const chargesAmountRoeKey = form.values.charges_data
      .map((c) => `${c.amount}-${c.roe}`)
      .join(",");
    useEffect(() => {
      const charges = form.values.charges_data;
      let changed = false;
      const next = charges.map((c) => {
        const amount = c.amount ?? 0;
        const roe = c.roe ?? 0;
        const local = clampLocalAmount(amount * roe);
        if (local !== (c.amount_in_local ?? null)) changed = true;
        return { ...c, amount_in_local: local };
      });
      if (changed) form.setFieldValue("charges_data", next);
    }, [chargesAmountRoeKey]);
  
    // Auto-calc Inv/Crn Amount = sum of breakup amounts
    const invCrnCalcKey = [
      form.values.taxable_amount,
      form.values.non_taxable_amount,
      form.values.cgst_amount,
      form.values.sgst_amount,
      form.values.igst_amount,
    ].join("|");
    useEffect(() => {
      const inv =
        (parseNum(form.values.taxable_amount) ?? 0) +
        (parseNum(form.values.non_taxable_amount) ?? 0) +
        (isIndiaUser
          ? (parseNum(form.values.cgst_amount) ?? 0) +
            (parseNum(form.values.sgst_amount) ?? 0) +
            (parseNum(form.values.igst_amount) ?? 0)
          : 0);
      const nextInv = clampLocalAmount(inv);
      if (nextInv !== (form.values.Inv_crn_amount ?? null)) {
        form.setFieldValue("Inv_crn_amount", nextInv);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [invCrnCalcKey, isIndiaUser]);
  
    // Auto-calc Approved Amount = |sum(Dr) − sum(Cr)| of charge local amounts (same for INV and CRN).
    // Difference Amount = Inv/Crn Amount − Approved Amount.
    const chargesNetKey = form.values.charges_data
      .map((c) => `${c.amount_in_local}-${c.Dr_Cr}`)
      .join(",");
    useEffect(() => {
      const charges = form.values.charges_data ?? [];
      const netLocal = round2(
        charges.reduce((acc, row) => {
          const amt = parseNum(row.amount_in_local) ?? 0;
          if (!amt) return acc;
          // Dr adds, Cr subtracts — difference of all Drs vs Crs
          return row.Dr_Cr === "Cr" ? acc - amt : acc + amt;
        }, 0),
      );
      // Absolute difference so approved stays non-negative for INV and CRN
      const nextApproved = clampLocalAmount(Math.abs(netLocal));
      if (nextApproved !== (form.values.approved_amount ?? null)) {
        form.setFieldValue("approved_amount", nextApproved);
      }
  
      const inv = parseNum(form.values.Inv_crn_amount) ?? 0;
      const approved = nextApproved ?? 0;
      const diff = clampLocalAmount(round2(inv - approved));
      if (diff !== (form.values.difference_amount ?? null)) {
        form.setFieldValue("difference_amount", diff);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chargesNetKey, form.values.Inv_crn_amount]);
  
    // Map list page row data (location.state) to form for view/edit and reversal create (same flow as ReceiptCreate)
    useEffect(() => {
      const runForViewEdit = isViewMode || isEditMode;
      const runForReversalCreate = isReversalCreate && invoiceFromState?.id != null;
      if (!runForViewEdit && !runForReversalCreate) return;
      if (!invoiceFromState || invoiceFromState.id == null) return;
      const data = invoiceFromState as Record<string, unknown>;
      const chargesArray = Array.isArray(data.charges)
        ? (data.charges as ApiCharge[])
        : Array.isArray(data.charges_data)
          ? (data.charges_data as ApiCharge[])
          : [];
      let mappedCharges =
        chargesArray.length > 0 ? mapApiChargesToRows(chargesArray) : [];
      // Dr/Cr handling:
      // - View/Edit: keep Dr/Cr as returned by API (including GST/TDS-generated rows).
      // - Reversal Create: invert charge row Dr/Cr relative to source invoice.
      const headerDrCr = isReversal ? ("Dr" as const) : ("Cr" as const);
      if (runForReversalCreate) {
        mappedCharges = mappedCharges.map((c) => ({
          ...c,
          Dr_Cr: c.Dr_Cr === "Cr" ? "Dr" : "Cr",
        }));
      }
      // Reversal create: daybook empty so user selects; date and due_date auto-set to today
      const daybookId =
        runForReversalCreate
          ? ""
          : data.day_book_id != null
            ? String(data.day_book_id)
            : "";
  
      // Reversal create: Credit Journal Voucher date and Agent INV/CRN Detail due_date auto-set to today
      // List API returns date/due_date as DD-MM-YYYY; use parseDDMMYYYY so they display in edit/view
      const dateValue = runForReversalCreate
        ? new Date()
        : parseDDMMYYYY((data.date as string) ?? undefined) ??
          normalizeDate((data.date as string) ?? null);
      const dueDateValue = runForReversalCreate
        ? new Date()
        : parseDDMMYYYY((data.due_date as string) ?? undefined) ??
          normalizeDate((data.due_date as string) ?? null);
  
      // Reversal create: do not set saveResponse so daybook and date stay editable; saveResponse set after POST
      if (!runForReversalCreate) {
        setSaveResponse({
          id: data.id != null ? Number(data.id) : undefined,
          crj_number: data.crj_number != null ? String(data.crj_number) : "",
          reverse_crj_number:
            data.reverse_crj_number != null
              ? String(data.reverse_crj_number)
              : "",
          Inv_Crn_no: data.Inv_Crn_no != null ? String(data.Inv_Crn_no) : "",
          status: data.status != null ? String(data.status) : "UNPOSTED",
        });
      }
      setAgentDisplayName(
        (data.creditor_agent ?? data.agent_name ?? null) as string | null,
      );
      form.setValues({
        cbp_number: (data.cbp_number ?? "") as string,
        cost_center: (data.cost_center ?? "") as string,
        day_book_id: daybookId,
        date: dateValue,
        due_date: dueDateValue,
        creditor_agent: (data.creditor_agent ?? "") as string,
        agent_code: (data.agent_code ?? "") as string,
        state_id: data.state_id != null ? String(data.state_id) : "",
        tds_section_code: (data.tds_section_code ?? "") as string,
        note: (data.note ?? "") as string,
        narration: (data.narration ?? "") as string,
        customer_gst_no: (data.customer_gst_no ?? "") as string,
        location_gst_no: (data.location_gst_no ?? "") as string,
        type: ((data.type as "INV" | "CRN" | undefined) ?? "INV") as "INV" | "CRN",
        Inv_Crn_note:
          parseDDMMYYYY((data.Inv_Crn_note as string) ?? undefined) ??
          normalizeDate((data.Inv_Crn_note as string) ?? null),
        Inv_Crn_no: (data.Inv_Crn_no ?? "") as string,
        roe:
          data.roe != null && data.roe !== ""
            ? parseRoeForPayload(data.roe)
            : null,
        currency_id: data.currency_id != null ? String(data.currency_id) : "",
        taxable_amount:
          data.taxable_amount != null
            ? parseFloat(String(data.taxable_amount))
            : null,
        non_taxable_amount:
          data.non_taxable_amount != null
            ? parseFloat(String(data.non_taxable_amount))
            : null,
        cgst_amount:
          data.cgst_amount != null ? parseFloat(String(data.cgst_amount)) : null,
        sgst_amount:
          data.sgst_amount != null ? parseFloat(String(data.sgst_amount)) : null,
        igst_amount:
          data.igst_amount != null ? parseFloat(String(data.igst_amount)) : null,
        Inv_crn_amount: toLocalAmount(data.Inv_crn_amount),
        approved_amount: toLocalAmount(data.approved_amount),
        difference_amount: toLocalAmount(data.difference_amount),
        status: (runForReversalCreate
          ? "UNPOSTED"
          : (data.status ?? "UNPOSTED")) as string,
        Dr_Cr: headerDrCr,
        charges_data: mappedCharges,
      });
      // Force charges to apply (same as ReceiptCreate: setFieldValue after setValues so list array is always shown)
      form.setFieldValue("charges_data", mappedCharges);
      // Support documents for edit/view flows
      const rawDocs =
        (invoiceFromState as any)?.documents ??
        (invoiceFromState as any)?.supporting_documents;
      form.setFieldValue(
        "supporting_documents",
        mapApiDocumentsToSupportingDocuments(rawDocs),
      );
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [invoiceFromState?.id, isViewMode, isEditMode, isReversalCreate, isReversal, location.key]);
  
    // Auto-select "LOCAL CRJ" daybook when coming from Payment Request → Create Supplier Invoice
    useEffect(() => {
      const prData = (location.state as any)?.paymentRequestData;
      if (!prData || isViewMode || isEditMode || isReversal) return;
      if (!daybookOptions.length) return;
      if (form.values.day_book_id) return; // already set — don't overwrite
      const localCrj = daybookOptions.find((o) =>
        o.label.trim().toUpperCase() === "LOCAL CRJ",
      );
      if (localCrj) {
        form.setFieldValue("day_book_id", localCrj.value);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [daybookOptions]);
  
    // Pre-fill from Payment Request when navigating from PaymentRequestApproval (Create Supplier Invoice)
    useEffect(() => {
      const prData = (location.state as any)?.paymentRequestData as Record<string, any> | null | undefined;
      if (!prData || isViewMode || isEditMode || isReversal) return;
  
      const prDate = parseDDMMYYYY(String(prData.date ?? "")) ?? null;
      const amountNum =
        prData.amount != null && prData.amount !== ""
          ? parseFloat(String(prData.amount)) || null
          : null;
  
      const charges = Array.isArray(prData.charges) ? prData.charges : [];
      const mappedCharges: ChargeRow[] = charges.map((c: Record<string, any>) => ({
        // For GST rows from Payment Request, CRN should be Revenue.
        // Other charges should continue as Cost.
        // Charge names are compared in uppercase to handle casing differences.
        CRN: [
          "STATE GOODS AND SERVICE TAX",
          "CENTRAL GOODS AND SERVICE TAX",
          "INTEGRATED GOODS AND SERVICE TAX",
        ].includes(String(c.charge_name ?? "").trim().toUpperCase())
          ? "Revenue"
          : "Cost",
        // Do not map Account/Subledger from Payment Request.
        account_code: "",
        account_name: "",
        subledger_code: "",
        narration: "",
        shipment_no: String(c.job_no ?? c.job_id ?? ""),
        charge_id: c.charge_id != null ? Number(c.charge_id) : null,
        charge_name: String(c.charge_name ?? ""),
        currency_id: c.currency_id != null ? Number(c.currency_id) : null,
        roe: c.roe != null && c.roe !== "" ? parseRoeForPayload(c.roe) : null,
        amount: c.amount != null && c.amount !== "" ? parseFloat(String(c.amount)) || null : null,
        amount_in_local: c.local_amount != null && c.local_amount !== "" ? parseFloat(String(c.local_amount)) || null : null,
        tax_code: String(c.sac_code ?? ""),
        Dr_Cr: "Cr" as const,
      }));
  
      // Header fields
      const actualInvNo = String(
        prData.actual_inv_no ?? prData.actual_invoice_no ?? "",
      ).trim();
      form.setFieldValue(
        "Inv_Crn_no",
        actualInvNo,
      );
      form.setFieldValue("creditor_agent", String(prData.paid_to ?? ""));
      form.setFieldValue("agent_code", String(prData.paid_to ?? ""));
      form.setFieldValue("customer_gst_no", String(prData.customer_gst_no ?? ""));
      form.setFieldValue("location_gst_no", String(prData.location_gst_no ?? ""));
      form.setFieldValue("tds_section_code", String(prData.tds_section_code ?? ""));
  
      // State
      if (prData.state_id != null) {
        form.setFieldValue("state_id", String(prData.state_id));
      }
  
      // Currency (header)
      if (prData.currency_id != null) {
        form.setFieldValue("currency_id", String(prData.currency_id));
      }
  
      // Date / due date
      if (prDate) {
        form.setFieldValue("date", prDate);
        form.setFieldValue("due_date", prDate);
      }
  
      // Invoice amount
      if (amountNum != null) {
        form.setFieldValue("Inv_crn_amount", amountNum);
        form.setFieldValue("approved_amount", amountNum);
      }
  
      setAgentDisplayName(String(prData.paid_to ?? "") || null);
      if (mappedCharges.length > 0) {
        form.setFieldValue("charges_data", mappedCharges);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
  
    const buildPayload = (
      values: SupplierInvoiceFormValues,
      statusOverride?: string,
    ) => {
      const isCreate = saveResponse?.id == null;
      const chargesPayload = values.charges_data.map((c) => {
        const taxCode = String(c.tax_code ?? "").trim();
        const base = {
          account_code: c.account_code || "",
          account_name: c.account_name || "",
          subledger_code: c.subledger_code || "",
          CRN: c.CRN || "",
          narration: c.narration || "",
          shipment_no: c.shipment_no || "",
          charge_id: c.charge_id ?? null,
          currency_id: c.currency_id ?? null,
          roe: formatRoeForAccountsPayload(c.roe),
          amount: formatAmountToTwoDecimals(c.amount ?? 0),
          amount_in_local: formatLocalAmount(c.amount_in_local ?? 0),
          tax_code: taxCode,
          Dr_Cr: c.Dr_Cr,
        };
        // Create: do not include id in charges; Update: include id when charge exists
        if (!isCreate && c.id != null) return { ...base, id: c.id };
        return base;
      });
      return {
        ...(saveResponse?.id != null ? { id: saveResponse.id } : {}),
        day_book_id: values.day_book_id ? Number(values.day_book_id) : null,
        date: values.date ? formatDDMMYYYY(new Date(values.date)) : "",
        agent_name: agentDisplayName ?? "",
        state_id: values.state_id ? Number(values.state_id) : null,
        tds_section_code: values.tds_section_code || "",
        note: values.note || "",
        narration: values.narration || "",
        customer_gst_no: values.customer_gst_no || "",
        location_gst_no: values.location_gst_no || "",
        type: values.type ?? "INV",
        Inv_Crn_note: values.Inv_Crn_note
          ? formatDDMMYYYY(new Date(values.Inv_Crn_note))
          : "",
        Inv_Crn_no: values.Inv_Crn_no || "",
        roe: parseRoeForPayload(values.roe) ?? null,
        currency_id: values.currency_id ? Number(values.currency_id) : null,
        taxable_amount: formatAmountToTwoDecimals(values.taxable_amount ?? 0),
        non_taxable_amount: formatAmountToTwoDecimals(
          values.non_taxable_amount ?? 0,
        ),
        cgst_amount: formatAmountToTwoDecimals(values.cgst_amount ?? 0),
        sgst_amount: formatAmountToTwoDecimals(values.sgst_amount ?? 0),
        igst_amount: formatAmountToTwoDecimals(values.igst_amount ?? 0),
        Inv_crn_amount: formatLocalAmount(values.Inv_crn_amount ?? 0),
        approved_amount: formatLocalAmount(values.approved_amount ?? 0),
        difference_amount: formatLocalAmount(
          values.difference_amount ?? 0,
        ),
        due_date: values.due_date
          ? formatDDMMYYYY(new Date(values.due_date))
          : "",
        status:
          statusOverride ??
          (isCreate && isReversal ? "UNPOSTED" : values.status ?? "UNPOSTED"),
        Dr_Cr: values.Dr_Cr,
        charges_data: chargesPayload,
        ...buildSupplierInvoiceDocumentIdsPayload(values, isCreate),
      };
    };
  
    const FORM_DATA_HEADERS = {
      ...API_HEADER,
      headers: {
        ...(API_HEADER as any).headers,
        "Content-Type": "multipart/form-data",
      },
    };
  
    const mapApiDocumentsToSupportingDocuments = (
      docs: Array<Record<string, any>> | undefined,
    ): SupportingDocument[] => {
      if (!Array.isArray(docs) || docs.length === 0) return [];
      return docs.map((doc) => {
        const downloadUrl =
          doc.document_url ??
          doc.document_download_url ??
          doc.url ??
          (typeof doc.document === "string" ? doc.document : "") ??
          "";
        // Document row PK only — never object_id / content_type / invoice id
        const rawId = doc.id ?? doc.document_id ?? doc.pk;
        const documentId =
          rawId != null && Number.isFinite(Number(rawId))
            ? Number(rawId)
            : undefined;
        return {
          name: (doc.document_name ?? doc.file_name ?? doc.name ?? "").toString(),
          file: null,
          document_url: downloadUrl,
          document_id: documentId,
          original_document_name:
            doc.original_document_name ??
            doc.document_name ??
            doc.file_name ??
            "",
        };
      });
    };

    /**
     * Edit: send PKs of existing docs still on the form (not deleted).
     * New uploads go in FormData only — without document_id.
     */
    const buildSupplierInvoiceDocumentIdsPayload = (
      values: SupplierInvoiceFormValues,
      isCreate: boolean,
    ): { document_ids: number[] } | Record<string, never> => {
      if (isCreate) return {};

      const remainingDocumentIds = values.supporting_documents
        .map((d) => d.document_id)
        .filter((id): id is number => id != null && Number.isFinite(Number(id)))
        .map((id) => Number(id));

      return { document_ids: remainingDocumentIds };
    };

    const buildSupplierInvoiceFormData = (
      payload: Record<string, unknown>,
      formKey: "supplier_invoice" | "reverse_supplier_invoice",
    ): FormData => {
      const fd = new FormData();
      fd.append(formKey, JSON.stringify(payload));

      // New documents only — create without document_id
      let fileIndex = 0;
      form.values.supporting_documents.forEach((doc) => {
        if (!doc.file) return;

        fd.append(`document_names[${fileIndex}]`, (doc.name ?? "").toString());
        fd.append(`document[${fileIndex}]`, doc.file);
        fileIndex++;
      });

      return fd;
    };
  
    const applyReverseInvoiceResponseToForm = (
      data: Record<string, unknown> & {
        charges_data?: ApiCharge[];
        charges?: ApiCharge[];
      },
    ) => {
      const charges =
        Array.isArray(data.charges_data) ? data.charges_data : (Array.isArray(data.charges) ? data.charges : []);
      const mappedCharges = mapApiChargesToRows(charges as ApiCharge[]);
      form.setValues({
        cbp_number: (data.cbp_number ?? "") as string,
        cost_center: (data.cost_center ?? "") as string,
        day_book_id: data.day_book_id != null ? String(data.day_book_id) : "",
        date: parseDDMMYYYY(data.date as string) ?? form.values.date,
        due_date: parseDDMMYYYY(data.due_date as string) ?? form.values.due_date,
        creditor_agent: (data.creditor_agent ?? "") as string,
        agent_code: (data.agent_code ?? "") as string,
        state_id: data.state_id != null ? String(data.state_id) : "",
        tds_section_code: (data.tds_section_code ?? "") as string,
        note: (data.note ?? "") as string,
        narration: (data.narration ?? "") as string,
        customer_gst_no: (data.customer_gst_no ?? "") as string,
        location_gst_no: (data.location_gst_no ?? "") as string,
        Inv_Crn_note:
          parseDDMMYYYY((data.Inv_Crn_note as string) ?? undefined) ??
          normalizeDate((data.Inv_Crn_note as string) ?? null),
        Inv_Crn_no: (data.Inv_Crn_no ?? "") as string,
        currency_id: data.currency_id != null ? String(data.currency_id) : "",
        taxable_amount:
          data.taxable_amount != null
            ? parseFloat(String(data.taxable_amount))
            : null,
        non_taxable_amount:
          data.non_taxable_amount != null
            ? parseFloat(String(data.non_taxable_amount))
            : null,
        cgst_amount:
          data.cgst_amount != null ? parseFloat(String(data.cgst_amount)) : null,
        sgst_amount:
          data.sgst_amount != null ? parseFloat(String(data.sgst_amount)) : null,
        igst_amount:
          data.igst_amount != null ? parseFloat(String(data.igst_amount)) : null,
        Inv_crn_amount: toLocalAmount(data.Inv_crn_amount),
        approved_amount: toLocalAmount(data.approved_amount),
        difference_amount: toLocalAmount(data.difference_amount),
        status: (data.status ?? "UNPOSTED") as string,
        Dr_Cr: (data.Dr_Cr ?? "Cr") as "Cr" | "Dr",
        charges_data: mappedCharges,
      });
      form.setFieldValue("charges_data", mappedCharges);
      setAgentDisplayName(
        (data.creditor_agent ?? data.agent_name ?? null) as string | null,
      );
    };
  
    const handleSubmit = async (
      values: SupplierInvoiceFormValues,
    ): Promise<number | null> => {
      setIsSubmitting(true);
      try {
        // If shipment is selected, charge becomes mandatory (TDS rows won't have shipment_no)
        const missingChargeAt = (values.charges_data ?? []).findIndex(
          (c) => String(c.shipment_no ?? "").trim() !== "" && c.charge_id == null,
        );
        if (missingChargeAt >= 0) {
          form.setFieldError(
            `charges_data.${missingChargeAt}.charge_id`,
            "Charge is required",
          );
          ToastNotification({
            type: "error",
            message: "Please select charge for the shipment row before saving.",
          });
          return null;
        }
  
        const hasAtLeastOneCharge = (values.charges_data ?? []).some(
          (c) => c.amount != null && c.amount !== 0,
        );
        if (!hasAtLeastOneCharge) {
          ToastNotification({
            type: "error",
            message: "Please enter at least one charge before saving.",
          });
          return null;
        }

        const headerRoeToastError = validateRoeToast(
          headerCurrencyCode,
          values.roe,
          values.currency_id,
        );
        if (headerRoeToastError) {
          form.setFieldError(
            "roe",
            validateRoeField(headerCurrencyCode, values.roe, values.currency_id) ??
              headerRoeToastError,
          );
          ToastNotification({ type: "error", message: headerRoeToastError });
          return null;
        }

        for (let i = 0; i < (values.charges_data ?? []).length; i++) {
          const charge = values.charges_data[i];
          const chargeCode =
            currencyOptions.find((o) => o.value === String(charge.currency_id ?? ""))
              ?.label ?? "";
          const chargeRoeToastError = validateRoeToast(
            chargeCode,
            charge.roe,
            charge.currency_id != null ? String(charge.currency_id) : null,
          );
          if (chargeRoeToastError) {
            form.setFieldError(
              `charges_data.${i}.roe`,
              validateRoeField(
                chargeCode,
                charge.roe,
                charge.currency_id != null ? String(charge.currency_id) : null,
              ) ?? chargeRoeToastError,
            );
            ToastNotification({ type: "error", message: chargeRoeToastError });
            return null;
          }
        }

        const payload = buildPayload(values);
        (payload as Record<string, unknown>).is_agent = isOverseasCrjDaybook ? true : false;
        const isEdit = saveResponse?.id != null;
        // Reversal create: include source invoice's crj_number (required by API)
        if (isReversal && !isEdit && invoiceFromState) {
          const sourceCrj = (invoiceFromState as Record<string, unknown>)
            .crj_number;
          if (sourceCrj != null && sourceCrj !== "")
            (payload as Record<string, unknown>).crj_number = String(sourceCrj);
        }
        const reversalUrl = isReversal ? URL.reverseSupplierInvoice : URL.supplierInvoice;
        // For multipart, we call apiCallProtected directly (no helper appending payload.id/).
        const reversalEditUrl =
          isReversal && saveResponse?.id != null
            ? URL.reverseSupplierInvoice
            : null;
  
        if (isEdit) {
          const baseUrl = reversalEditUrl ?? URL.supplierInvoice;
          const id = (payload as any).id ?? saveResponse?.id;
          const fd = buildSupplierInvoiceFormData(
            payload,
            isReversal ? "reverse_supplier_invoice" : "supplier_invoice",
          );
  
          const raw = (await apiCallProtected.put(
            `${baseUrl}${id}/`,
            fd,
            FORM_DATA_HEADERS,
          )) as any;
  
          const data = raw?.data?.data ?? raw?.data ?? raw;
          if (data) {
            const dataWithReverse = data as { reverse_crj_number?: string };
            setSaveResponse({
              id: data.id ?? saveResponse?.id,
              crj_number: data.crj_number ?? saveResponse?.crj_number ?? "",
              reverse_crj_number:
                dataWithReverse.reverse_crj_number ??
                saveResponse?.reverse_crj_number ??
                "",
              Inv_Crn_no: data.Inv_Crn_no ?? saveResponse?.Inv_Crn_no ?? "",
              status:
                data.status != null
                  ? String(data.status)
                  : (saveResponse?.status ?? "UNPOSTED"),
            });
            setAuditPatch((prev) => appendEditPageAuditPatch(prev, data));
            if (isReversal) {
              applyReverseInvoiceResponseToForm(
                data as Record<string, unknown> & {
                  charges_data?: ApiCharge[];
                  charges?: ApiCharge[];
                },
              );
            } else if (Array.isArray(data.charges)) {
              form.setFieldValue(
                "charges_data",
                mapApiChargesToRows(data.charges),
              );
            }
  
            // Refresh supporting docs so downloads work in edit/view
            form.setFieldValue(
              "supporting_documents",
              mapApiDocumentsToSupportingDocuments((data as any).documents),
            );
            ToastNotification({
              message: isReversal
                ? "Supplier invoice reverse updated successfully"
                : "Supplier invoice updated successfully",
              type: "success",
            });
            return data.id != null
              ? Number(data.id)
              : id != null
                ? Number(id)
                : null;
          }
        } else {
          const fd = buildSupplierInvoiceFormData(
            payload,
            isReversal ? "reverse_supplier_invoice" : "supplier_invoice",
          );
          const raw = (await apiCallProtected.post(
            reversalUrl,
            fd,
            FORM_DATA_HEADERS,
          )) as any;
  
          const data = raw?.data?.data ?? raw?.data ?? raw;
          if (data) {
            const dataWithReverse = data as { reverse_crj_number?: string };
            setSaveResponse({
              id: data.id,
              crj_number: data.crj_number ?? "",
              reverse_crj_number: dataWithReverse.reverse_crj_number ?? "",
              Inv_Crn_no: data.Inv_Crn_no ?? "",
              status: data.status != null ? String(data.status) : "UNPOSTED",
            });
            if (isReversal) {
              applyReverseInvoiceResponseToForm(
                data as Record<string, unknown> & {
                  charges_data?: ApiCharge[];
                  charges?: ApiCharge[];
                },
              );
            } else if (Array.isArray(data.charges)) {
              form.setFieldValue(
                "charges_data",
                mapApiChargesToRows(data.charges),
              );
            }
  
            form.setFieldValue(
              "supporting_documents",
              mapApiDocumentsToSupportingDocuments((data as any).documents),
            );
            ToastNotification({
              message: isReversal
                ? "Supplier invoice reverse created successfully"
                : "Supplier invoice created successfully",
              type: "success",
            });
            return data.id != null ? Number(data.id) : null;
          }
        }
      } catch (error: unknown) {
        console.error(
          saveResponse?.id != null ? "Error updating" : "Error creating",
          "supplier invoice:",
          error,
        );
        ToastNotification({
          message:
            (error as { message?: string })?.message ??
            (saveResponse?.id != null
              ? "Failed to update supplier invoice"
              : "Failed to create supplier invoice"),
          type: "error",
        });
        return null;
      } finally {
        setIsSubmitting(false);
      }
      return null;
    };
  
    const handlePost = async () => {
      if (saveResponse?.id == null) return;
      setIsSubmitting(true);
      try {
        const diff = round2(parseNum(form.values.difference_amount) ?? 0);
        if (diff !== 0) {
          ToastNotification({
            type: "error",
            message: `Difference Amount must be ${formatMoneyAmountForUi(0)} to post. Current: ${formatMoneyAmountForUi(diff)}.`,
          });
          return;
        }
  
        const payload = buildPayload(form.values, "POSTED");
        (payload as Record<string, unknown>).is_agent =
          isOverseasCrjDaybook ? true : false;
        const postUrl = isReversal
          ? URL.reverseSupplierInvoice
          : URL.supplierInvoice;
  
        const fd = buildSupplierInvoiceFormData(
          payload,
          isReversal ? "reverse_supplier_invoice" : "supplier_invoice",
        );
  
        const raw = (await apiCallProtected.put(
          `${postUrl}${saveResponse.id}/`,
          fd,
          FORM_DATA_HEADERS,
        )) as any;
  
        const data = raw?.data?.data ?? raw?.data ?? raw;
        if (data) {
          const statusStr =
            (data as { status?: unknown }).status != null
              ? String((data as { status?: unknown }).status)
              : "POSTED";
          setSaveResponse((prev) =>
            prev ? { ...prev, status: statusStr } : null,
          );
          setAuditPatch((prev) => appendEditPageAuditPatch(prev, data));
          form.setFieldValue("status", "POSTED");
          if (Array.isArray((data as { charges?: ApiCharge[] }).charges)) {
            form.setFieldValue(
              "charges_data",
              mapApiChargesToRows((data as { charges: ApiCharge[] }).charges),
            );
          }
  
          form.setFieldValue(
            "supporting_documents",
            mapApiDocumentsToSupportingDocuments((data as any).documents),
          );
          ToastNotification({
            message: "Supplier invoice posted successfully",
            type: "success",
          });
        }
      } catch (error: unknown) {
        console.error("Error posting supplier invoice:", error);
        ToastNotification({
          message:
            (error as { message?: string })?.message ??
            "Failed to post supplier invoice",
          type: "error",
        });
      } finally {
        setIsSubmitting(false);
      }
    };
  
    const statusUpper = String(saveResponse?.status ?? "").toUpperCase();
    const isReadOnly =
      isViewMode || (saveResponse != null && statusUpper === "POSTED");
    // Reversal create/edit: only daybook and date editable; rest non-editable. Once posted, full read-only.
    const reversalFormDisabled = isReversal;
    const effectiveInputStyles = isReadOnly
      ? readOnlyFieldStyles
      : isReversal
        ? reversalNonEditableStyles
        : inputStyles;
    // Daybook and date: editable in reversal create/edit when !isReadOnly; read-only when posted or view
    const daybookAndDateStyles = isReadOnly ? readOnlyFieldStyles : inputStyles;
    const daybookDateDisabled = isReadOnly;

    const showAuditInfo =
      isViewMode ||
      isEditMode ||
      pathname.includes("/reversal/edit") ||
      pathname.includes("/reversal/view");
    const invoiceAuditSource = mergeEditPageAuditSources(
      invoiceFromState,
      saveResponse,
      auditPatch,
    );
  
    const addChargeRow = () => {
      const currencyIdStr =
        form.values.currency_id || defaultBranchCurrencyId || "";
      const currCode =
        currencyOptions.find((o) => o.value === currencyIdStr)?.label ?? "";
      const newIndex = form.values.charges_data.length;
      form.insertListItem("charges_data", {
        account_code: "",
        account_name: "",
        subledger_code: "",
        CRN: "Cost",
        narration: "",
        shipment_no: "",
        charge_id: null,
        charge_name: "",
        currency_id:
          defaultBranchCurrencyId != null
            ? Number(defaultBranchCurrencyId)
            : currencyIdStr
              ? Number(currencyIdStr)
              : null,
        roe: currCode && isLocalCurrency(currCode, currencyIdStr) ? 1 : null,
        amount: null,
        amount_in_local: null,
        tax_code: "",
        Dr_Cr: isReversal ? "Cr" : "Dr",
      });
      if (currCode) {
        syncRoeForCurrencyChange(
          currCode,
          (roe) => {
            form.setFieldValue(`charges_data.${newIndex}.roe`, roe);
          },
          currencyIdStr,
        );
      }
    };
  
    return (
      <Box p={"sm"} style={{ position: "relative" }}>
        {(isSubmitting || calcLoading) && (
          <Box
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(255,255,255,0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
            }}
          >
            <Stack align="center" gap="md">
              <Loader size="lg" color="#105476" />
              <Text size="sm" c="#105476" fw={500}>
                {calcLoading ? calcLoadingText : "Saving supplier invoice..."}
              </Text>
            </Stack>
          </Box>
        )}
        <Stack gap="md">
          <Group justify="space-between" wrap="nowrap">
            <EditPageHeadingRow
              visible={showAuditInfo && Boolean(invoiceAuditSource)}
              auditSource={invoiceAuditSource}
              animateKey={(invoiceAuditSource as { id?: number })?.id}
            >
              <Text size="xl" fw={600} c="#105476">
                {pathname.includes("/reversal/create") && saveResponse?.id == null
                  ? "Create Supplier Invoice Reverse"
                  : pathname.includes("/reversal/create") && saveResponse?.id != null
                    ? "Edit Supplier Invoice Reverse"
                    : pathname.includes("/reversal/edit")
                      ? "Edit Supplier Invoice Reverse"
                      : pathname.includes("/reversal/view")
                      ? "View Supplier Invoice Reverse"
                      : titleOverride ??
                          (isEditMode
                            ? "Edit Supplier Invoice/RCM"
                            : isViewMode
                              ? "View Supplier Invoice/RCM"
                              : "Create Supplier Invoice/RCM")}
              </Text>
            </EditPageHeadingRow>
            <Group gap="md" wrap="nowrap">
              {saveResponse && (
                <Group gap="sm" wrap="nowrap">
                  <Group gap="xs" wrap="nowrap">
                    <Text size="sm" fw={500} c="dimmed">
                      CRJ Number:
                    </Text>
                    <Badge
                      size="sm"
                      variant="light"
                      color="#105476"
                      styles={{ root: { textTransform: "none" } }}
                    >
                      {isReversal
                        ? (saveResponse.reverse_crj_number ??
                          saveResponse.crj_number ??
                          saveResponse.Inv_Crn_no ??
                          "—")
                        : (saveResponse.crj_number ??
                          saveResponse.Inv_Crn_no ??
                          "—")}
                    </Badge>
                  </Group>
                  <Group gap="xs" wrap="nowrap">
                    <Text size="sm" fw={500} c="dimmed">
                      Status:
                    </Text>
                    <Badge
                      size="sm"
                      variant="light"
                      color={
                        String(saveResponse.status ?? "").toUpperCase() ===
                        "UNPOSTED"
                          ? "gray"
                          : "green"
                      }
                      styles={{ root: { textTransform: "none" } }}
                    >
                      {String(saveResponse.status ?? "").toUpperCase() || "—"}
                    </Badge>
                  </Group>
                </Group>
              )}
              <Button
                variant="outline"
                color="#105476"
                leftSection={<IconArrowLeft size={16} />}
                onClick={() => navigate(backPath)}
              >
                Back
              </Button>
            </Group>
          </Group>
  
          <Box
            component="form"
            onSubmit={
              isReadOnly
                ? (e: React.FormEvent) => e.preventDefault()
                : form.onSubmit((values) =>
                    handleSubmit(values as SupplierInvoiceFormValues),
                  )
            }
          >
            {/* Segment: Credit Journal Voucher — CBP Number through Location GST No */}
            <Text size="sm" fw={600} c="#105476" mb="xs">
              Credit Journal Voucher
            </Text>
            <Grid mb="md">
              {/* <Grid.Col span={1}>
                <TextInput
                  label="CBP Number"
                  placeholder="CBP Number"
                  value={form.values.cbp_number}
                  onChange={(e) =>
                    form.setFieldValue("cbp_number", e.target.value)
                  }
                  styles={effectiveInputStyles}
                  disabled={isReadOnly || reversalFormDisabled}
                />
              </Grid.Col>
              <Grid.Col span={1}>
                <TextInput
                  label="Cost Center"
                  placeholder="Cost Center"
                  value={form.values.cost_center}
                  onChange={(e) =>
                    form.setFieldValue("cost_center", e.target.value)
                  }
                  styles={effectiveInputStyles}
                  disabled={isReadOnly || reversalFormDisabled}
                />
              </Grid.Col> */}
              <Grid.Col span={cjvColSpans.dayBook}>
                <Dropdown
                  label="Day Book"
                  placeholder={
                    isDaybookLoading ? "Loading..." : "Select day book"
                  }
                  data={daybookOptions}
                  value={form.values.day_book_id || null}
                  onChange={(v) => {
                    form.setFieldValue("day_book_id", v ?? "");
                    // In reversal-create, vendor/state may be prefilled from source invoice and
                    // the fields are disabled; clearing them here blocks creation.
                    if (!isReversalCreate) {
                      form.setFieldValue("agent_code", "");
                      setAgentDisplayName(null);
                      if (isIndiaUser) {
                        form.setFieldValue("state_id", "");
                      }
                    }
                  }}
                  searchable
                  withAsterisk
                  error={form.errors.day_book_id}
                  disabled={isDaybookLoading || daybookDateDisabled}
                  styles={daybookAndDateStyles}
                />
              </Grid.Col>
              <Grid.Col span={cjvColSpans.date}>
                <SingleDateInput
                  label="Date"
                  placeholder="Select date"
                  value={normalizeDate(form.values.date)}
                  onChange={(d) => {
                    form.setFieldValue("date", d);
                    if (!form.values.due_date) form.setFieldValue("due_date", d);
                  }}
                  withAsterisk
                  error={form.errors.date ? String(form.errors.date) : undefined}
                  disabled={daybookDateDisabled || !isVendorSelected}
                />
              </Grid.Col>
              <Grid.Col span={cjvColSpans.dueDate}>
                <SingleDateInput
                  label="Due Date"
                  placeholder="Select due date"
                  value={normalizeDate(form.values.due_date)}
                  onChange={(d) => form.setFieldValue("due_date", d)}
                  withAsterisk
                  error={
                    form.errors.due_date
                      ? String(form.errors.due_date)
                      : undefined
                  }
                  disabled={isReadOnly || reversalFormDisabled}
                />
              </Grid.Col>
              <Grid.Col span={cjvColSpans.vendor}>
                <SearchableSelect
                  label="Vendor/Supplier"
                  disabled={isReadOnly || reversalFormDisabled || !isDaybookSelected}
                  placeholder="Type supplier name"
                  apiEndpoint={vendorApiEndpoint}
                  searchFields={["customer_name", "customer_code"]}
                  displayFormat={(item: Record<string, unknown>) => ({
                    value: String(item.customer_code ?? item.id ?? ""),
                    label: String(item.customer_name ?? item.customer_code ?? ""),
                  })}
                  value={form.values.agent_code || null}
                  displayValue={agentDisplayName ?? undefined}
                  returnOriginalData
                  onChange={(value, selectedData, originalData) => {
                    form.setFieldValue("agent_code", value ?? "");
                    setAgentDisplayName(selectedData?.label ?? null);
                    const addresses =
                      (originalData?.addresses_data as
                        | Array<{
                            address_type?: string;
                            state_id?: number | null;
                            gst_id?: string | null;
                          }>
                        | undefined) ?? [];

                    const primary =
                      addresses.find(
                        (a) =>
                          String(a.address_type ?? "").toUpperCase() === "PRIMARY",
                      ) ?? addresses[0];

                    if (isIndiaUser) {
                      if (primary?.state_id != null) {
                        form.setFieldValue("state_id", String(primary.state_id));
                      }
                      form.setFieldValue(
                        "customer_gst_no",
                        primary?.gst_id != null ? String(primary.gst_id) : "",
                      );
                    }
                  }}
                  dropdownZIndex={1000}
                  styles={effectiveInputStyles}
                />
              </Grid.Col>
            {isIndiaUser && (
              <Grid.Col span={cjvColSpans.state}>
                <Dropdown
                  label="State"
                  placeholder={isStateLoading ? "Loading..." : "Select state"}
                  data={effectiveStateOptions}
                  value={form.values.state_id || null}
                  onChange={(v) => form.setFieldValue("state_id", v ?? "")}
                  searchable
                  withAsterisk
                  error={form.errors.state_id}
                  disabled={
                    isStateLoading ||
                    isReadOnly ||
                    reversalFormDisabled ||
                    !isVendorSelected
                  }
                  styles={effectiveInputStyles}
                />
              </Grid.Col>
            )}
            {isIndiaUser && (
              <Grid.Col span={cjvColSpans.tds}>
                <Dropdown
                  label="TDS Section Code"
                  placeholder={
                    isTdsSectionLoading ? "Loading..." : "Select TDS section"
                  }
                  data={tdsSectionOptions}
                  value={form.values.tds_section_code || null}
                  onChange={(v) =>
                    form.setFieldValue("tds_section_code", v ?? "")
                  }
                  searchable
                  clearable
                  disabled={
                    isTdsSectionLoading ||
                    isReadOnly ||
                    reversalFormDisabled ||
                    !isVendorSelected
                  }
                  styles={effectiveInputStyles}
                />
              </Grid.Col>
            )}
            {isIndiaUser && (
              <Grid.Col span={cjvColSpans.customerGst}>
                <TextInput
                  label="Customer GST No"
                  placeholder="Customer GST No"
                  value={form.values.customer_gst_no}
                  onChange={(e) =>
                    form.setFieldValue("customer_gst_no", e.target.value)
                  }
                  styles={effectiveInputStyles}
                  disabled={isReadOnly || reversalFormDisabled || !isVendorSelected}
                />
              </Grid.Col>
            )}
              <Grid.Col span={cjvColSpans.note}>
                <Textarea
                  label="Note"
                  placeholder="Note"
                  value={form.values.note}
                  onChange={(e) => form.setFieldValue("note", e.target.value)}
                  rows={2}
                  styles={effectiveInputStyles}
                  disabled={isReadOnly || reversalFormDisabled || !isVendorSelected}
                />
              </Grid.Col>
              <Grid.Col span={cjvColSpans.narration}>
                <Textarea
                  label="Narration"
                  placeholder="Narration"
                  value={form.values.narration}
                  onChange={(e) =>
                    form.setFieldValue("narration", e.target.value)
                  }
                  rows={2}
                  styles={effectiveInputStyles}
                  disabled={isReadOnly || reversalFormDisabled || !isVendorSelected}
                />
              </Grid.Col>
            </Grid>
  
            {/* Segment: Agent INV/CRN Detail — Due Date, Currency, Inv/Crn Note through Difference Amount */}
            <Text size="sm" fw={600} c="#105476" mb="xs">
              Agent INV/CRN Detail
            </Text>
            <Grid
              mb="md"
              columns={12}
              align="flex-end"
              pb={form.errors.roe ? 20 : 0}
            >
              <Grid.Col span={agentColSpans.type}>
                <Dropdown
                  label="Type"
                  placeholder="Type"
                  data={[
                    { value: "INV", label: "INV" },
                    { value: "CRN", label: "CRN" },
                  ]}
                  value={form.values.type}
                  onChange={(v) => {
                    const nextType = v === "CRN" ? "CRN" : "INV";
                    const defaults = getDrCrDefaultsByType(nextType);
                    form.setFieldValue("type", nextType);
                    form.setFieldValue("Dr_Cr", defaults.header);
                    form.values.charges_data.forEach((_, idx) => {
                      form.setFieldValue(
                        `charges_data.${idx}.Dr_Cr`,
                        defaults.charge,
                      );
                    });
                  }}
                  disabled={isReadOnly || reversalFormDisabled || !isVendorSelected}
                  styles={effectiveInputStyles}
                />
              </Grid.Col>
              <Grid.Col span={agentColSpans.invCrnNo}>
                <TextInput
                  label="Inv/Crn No"
                  placeholder="Inv/Crn No"
                  withAsterisk
                  value={form.values.Inv_Crn_no}
                  onChange={(e) =>
                    form.setFieldValue("Inv_Crn_no", e.target.value)
                  }
                  error={form.errors.Inv_Crn_no}
                  styles={effectiveInputStyles}
                  disabled={isReadOnly || reversalFormDisabled || !isVendorSelected}
                />
              </Grid.Col>
              <Grid.Col span={agentColSpans.invCrnDate}>
                <SingleDateInput
                  label="Inv/Crn Date"
                  placeholder="Select Inv/Crn Date"
                  withAsterisk
                  value={normalizeDate(form.values.Inv_Crn_note)}
                  onChange={(d) => {
                    form.setFieldValue("Inv_Crn_note", d);
                    if (d) form.clearFieldError("Inv_Crn_note");
                  }}
                  error={
                    form.errors.Inv_Crn_note
                      ? String(form.errors.Inv_Crn_note)
                      : undefined
                  }
                  disabled={isReadOnly || reversalFormDisabled || !isVendorSelected}
                />
              </Grid.Col>
              <Grid.Col span={agentColSpans.currency}>
                <Dropdown
                  label="Currency"
                  placeholder={
                    isCurrencyLoading ? "Loading..." : "Select currency"
                  }
                  data={currencyOptions}
                  value={form.values.currency_id || null}
                  onChange={(v) => {
                    form.setFieldValue("currency_id", v ?? "");
                    const code =
                      currencyOptions.find((o) => o.value === v)?.label ?? "";
                    form.clearFieldError("roe");
                    if (code) {
                      syncRoeForCurrencyChange(
                        code,
                        (roe) => form.setFieldValue("roe", roe),
                        v ?? "",
                      );
                    }
                  }}
                  searchable
                  withAsterisk
                  error={form.errors.currency_id}
                  disabled={
                    isCurrencyLoading ||
                    isReadOnly ||
                    reversalFormDisabled ||
                    !isVendorSelected
                  }
                  styles={effectiveInputStyles}
                />
              </Grid.Col>
              <Grid.Col span={agentColSpans.roe}>
                <Box style={{ position: "relative" }}>
                  <NumberInput
                    label="ROE"
                    placeholder="0"
                    value={form.values.roe ?? undefined}
                    onChange={(v) =>
                      onRoeValueChange(
                        headerCurrencyCode,
                        typeof v === "number" ? v : null,
                        (roe) => form.setFieldValue("roe", roe),
                        form.setFieldError,
                        form.clearFieldError,
                        "roe",
                        form.values.currency_id,
                      )
                    }
                    min={0}
                    decimalScale={ROE_DECIMAL_PLACES}
                    hideControls
                    disabled={
                      isReadOnly ||
                      reversalFormDisabled ||
                      !isVendorSelected ||
                      isHeaderLocalCurrency
                    }
                    styles={effectiveInputStyles}
                  />
                  <FieldErrorBelow error={form.errors.roe} />
                </Box>
              </Grid.Col>
              <Grid.Col span={agentColSpans.taxable}>
                <NumberInput
                  label="Taxable Amount"
                  disabled={isReadOnly || reversalFormDisabled}
                  placeholder="0"
                  value={form.values.taxable_amount ?? undefined}
                  onChange={(v) =>
                    form.setFieldValue(
                      "taxable_amount",
                      typeof v === "number" ? clampAmount(v) : null,
                    )
                  }
                  min={0}
                  decimalScale={currencyAmountDecimalScale}
                  hideControls
                  styles={effectiveInputStyles}
                />
              </Grid.Col>
              <Grid.Col span={agentColSpans.nonTaxable}>
                <NumberInput
                  label="Non Taxable Amount"
                  disabled={isReadOnly || reversalFormDisabled}
                  placeholder="0"
                  value={form.values.non_taxable_amount ?? undefined}
                  onChange={(v) =>
                    form.setFieldValue(
                      "non_taxable_amount",
                      typeof v === "number" ? clampAmount(v) : null,
                    )
                  }
                  min={0}
                  decimalScale={currencyAmountDecimalScale}
                  hideControls
                  styles={effectiveInputStyles}
                />
              </Grid.Col>
            {isIndiaUser && (
              <Grid.Col span={agentColSpans.cgst}>
                <NumberInput
                  label="CGST Amount"
                  disabled={isReadOnly || reversalFormDisabled}
                  placeholder="0"
                  value={form.values.cgst_amount ?? undefined}
                  onChange={(v) =>
                    form.setFieldValue(
                      "cgst_amount",
                      typeof v === "number" ? clampAmount(v) : null,
                    )
                  }
                  min={0}
                  decimalScale={currencyAmountDecimalScale}
                  hideControls
                  styles={effectiveInputStyles}
                />
              </Grid.Col>
            )}
            {isIndiaUser && (
              <Grid.Col span={agentColSpans.sgst}>
                <NumberInput
                  label="SGST Amount"
                  disabled={isReadOnly || reversalFormDisabled}
                  placeholder="0"
                  value={form.values.sgst_amount ?? undefined}
                  onChange={(v) =>
                    form.setFieldValue(
                      "sgst_amount",
                      typeof v === "number" ? clampAmount(v) : null,
                    )
                  }
                  min={0}
                  decimalScale={currencyAmountDecimalScale}
                  hideControls
                  styles={effectiveInputStyles}
                />
              </Grid.Col>
            )}
            {isIndiaUser && (
              <Grid.Col span={agentColSpans.igst}>
                <NumberInput
                  label="IGST Amount"
                  placeholder="0"
                  value={form.values.igst_amount ?? undefined}
                  onChange={(v) =>
                    form.setFieldValue(
                      "igst_amount",
                      typeof v === "number" ? clampAmount(v) : null,
                    )
                  }
                  min={0}
                  decimalScale={currencyAmountDecimalScale}
                  hideControls
                  styles={effectiveInputStyles}
                  disabled={isReadOnly || reversalFormDisabled}
                />
              </Grid.Col>
            )}

              <Grid.Col span={agentColSpans.invCrnAmount}>
                <NumberInput
                  label="Inv/Crn Amount"
                  disabled
                  placeholder="0"
                  value={form.values.Inv_crn_amount ?? undefined}
                  onChange={() => {}}
                  min={0}
                  decimalScale={localAmountDecimalScale}
                  {...getAmountNumberInputFormatProps()}
                  hideControls
                  styles={effectiveInputStyles}
                />
              </Grid.Col>
              <Grid.Col span={agentColSpans.approved}>
                <NumberInput
                  label="Approved Amount"
                  disabled
                  placeholder="0"
                  value={form.values.approved_amount ?? undefined}
                  onChange={() => {}}
                  min={0}
                  decimalScale={localAmountDecimalScale}
                  {...getAmountNumberInputFormatProps()}
                  hideControls
                  styles={effectiveInputStyles}
                />
              </Grid.Col>
              <Grid.Col span={agentColSpans.difference}>
                <NumberInput
                  label="Difference Amount"
                  disabled
                  placeholder="0"
                  value={form.values.difference_amount ?? undefined}
                  onChange={() => {}}
                  decimalScale={localAmountDecimalScale}
                  {...getAmountNumberInputFormatProps()}
                  hideControls
                  styles={effectiveInputStyles}
                />
              </Grid.Col>
            </Grid>
  
            {/* Charges Section — span 12, grid form like InvoiceCreate */}
            <Grid mt={"sm"}>
              <Grid.Col span={12}>
                <Group justify="space-between" align="center">
                  <Text size="sm" fw={600} c="#105476">
                    Charges
                  </Text>
                  <Group gap="xs">
                    {isIndiaUser && (
                      <Button
                        type="button"
                        size="sm"
                        variant="light"
                        color="#105476"
                        disabled={
                          isReadOnly ||
                          reversalFormDisabled ||
                          !isVendorSelected
                        }
                        onClick={async () => {
                          if (!saveResponse?.id) {
                            const hasCharge = form.values.charges_data.some(
                              (c) => c.amount != null && c.amount !== 0,
                            );
                            if (!hasCharge) {
                              ToastNotification({
                                type: "error",
                                message: "Please enter at least one charge before calculating GST.",
                              });
                              return;
                            }
                          }
  
                          let supplierInvoiceId = saveResponse?.id ?? null;
                          if (!supplierInvoiceId) {
                            const v = form.validate();
                            if (v.hasErrors) return;
                            setCalcLoading(true);
                            setCalcLoadingText("Creating supplier invoice first");
                            supplierInvoiceId = await handleSubmit(form.values);
                            if (!supplierInvoiceId) {
                              setCalcLoading(false);
                              return;
                            }
                          }
  
                          try {
                            setCalcLoading(true);
                            setCalcLoadingText("Calculating GST...");
                            const res = await postAPICall(
                              URL.invoiceCalculateGstBreakup,
                              { supplier_invoice_id: supplierInvoiceId },
                              API_HEADER,
                            );
  
                            const data = res as Record<string, unknown>;
                            const chargesFromApi =
                              (data.charges as Array<Record<string, unknown>> | undefined) ??
                              ((data.data as Record<string, unknown> | undefined)
                                ?.charges as Array<Record<string, unknown>> | undefined) ??
                              [];
                            const sacWiseTotals =
                              (data.sac_wise_totals as
                                | Array<Record<string, unknown>>
                                | undefined) ??
                              ((data.data as Record<string, unknown> | undefined)
                                ?.sac_wise_totals as
                                | Array<Record<string, unknown>>
                                | undefined) ??
                              [];
  
                            if (Array.isArray(chargesFromApi) && chargesFromApi.length) {
                              const next = form.values.charges_data.map((c) => {
                                const match = chargesFromApi.find(
                                  (x) =>
                                    Number(x.charge_id) === Number(c.charge_id),
                                );
                                if (!match) return c;
                                return {
                                  ...c,
                                  // Intentionally DO NOT map SAC/tax_code from calculate-gst-breakup.
                                };
                              });
                              form.setFieldValue("charges_data", next);
                            }
  
                            if (Array.isArray(sacWiseTotals) && sacWiseTotals.length) {
                              const existing = form.values.charges_data;
                              const newRows: ChargeRow[] = sacWiseTotals
                                .map((t): ChargeRow | null => {
                                  const chargeId = Number(t.charge_id);
                                  if (!Number.isFinite(chargeId)) return null;
                                  const amount = parseNum(t.total_amount);
                                  const currencyId = parseNum(t.currency_id);
                                  const roe = parseNum(t.roe);
                                  const Dr_Cr: "Dr" | "Cr" = normalizeDrCr(
                                    (t.Dr_Cr as unknown) ??
                                      (t.Dr_cr as unknown) ??
                                      (t.cr_dr as unknown) ??
                                      (t.Cr_Dr as unknown) ??
                                      (t.Cr_dr as unknown),
                                  );
  
                                  const row: ChargeRow = {
                                    account_code: String(t.account_code ?? ""),
                                    account_name: String(t.account_name ?? ""),
                                    subledger_code: String(t.subledger_code ?? ""),
                                    // GST breakup rows should always be Neutral
                                    CRN: "Neutral",
                                    narration: String(t.narration ?? ""),
                                    shipment_no: String(t.shipment_no ?? ""),
                                    charge_id: chargeId,
                                    charge_name: String(t.charge_name ?? ""),
                                    currency_id:
                                      currencyId != null ? Number(currencyId) : null,
                                    roe: parseRoeForPayload(roe),
                                    amount: amount != null ? Number(amount) : null,
                                    amount_in_local:
                                      amount != null
                                        ? clampLocalAmount(Number(amount))
                                        : null,
                                    // Intentionally DO NOT map SAC/tax_code from calculate-gst-breakup.
                                    tax_code: "",
                                    Dr_Cr,
                                  };
                                  return row;
                                })
                                .filter((x): x is ChargeRow => x !== null);
  
                              const deduped = newRows.filter((nr) => {
                                return !existing.some(
                                  (er) =>
                                    Number(er.charge_id) === Number(nr.charge_id) &&
                                    String(er.account_code ?? "") ===
                                      String(nr.account_code ?? "") &&
                                    String(er.subledger_code ?? "") ===
                                      String(nr.subledger_code ?? "") &&
                                    Number(er.amount ?? 0) === Number(nr.amount ?? 0) &&
                                    er.Dr_Cr === nr.Dr_Cr,
                                );
                              });
  
                              if (deduped.length) {
                                form.setFieldValue("charges_data", [
                                  ...existing,
                                  ...deduped,
                                ]);
                              }
                            }
  
                            // Optional: set header totals if API returns them
                            const cgst = parseNum((data.cgst_total as unknown) ?? (data.cgst_amount as unknown));
                            const sgst = parseNum((data.sgst_total as unknown) ?? (data.sgst_amount as unknown));
                            const igst = parseNum((data.igst_total as unknown) ?? (data.igst_amount as unknown));
                            if (cgst != null) form.setFieldValue("cgst_amount", cgst);
                            if (sgst != null) form.setFieldValue("sgst_amount", sgst);
                            if (igst != null) form.setFieldValue("igst_amount", igst);
                          } catch (e: unknown) {
                            ToastNotification({
                              type: "error",
                              message:
                                e instanceof Error
                                  ? e.message
                                  : "Failed to calculate GST breakup",
                            });
                          } finally {
                            setCalcLoading(false);
                          }
                        }}
                      >
                        Calculate GST
                      </Button>
                    )}
                    {isIndiaUser &&
                      String(form.values.tds_section_code ?? "").trim() !== "" &&
                      !isReversal && (
                       <Button
                        type="button"
                        size="sm"
                        variant="light"
                        color="#105476"
                        disabled={
                          isReadOnly ||
                          reversalFormDisabled ||
                          !isVendorSelected
                        }
                        onClick={async () => {
                          if (!saveResponse?.id) {
                            const hasCharge = form.values.charges_data.some(
                              (c) => c.amount != null && c.amount !== 0,
                            );
                            if (!hasCharge) {
                              ToastNotification({
                                type: "error",
                                message: "Please enter at least one charge before calculating TDS.",
                              });
                              return;
                            }
                          }
  
                          // If invoice not yet saved, save first
                          let supplierInvoiceId = saveResponse?.id ?? null;
                          if (!supplierInvoiceId) {
                            const v = form.validate();
                            if (v.hasErrors) return;
                            setCalcLoading(true);
                            setCalcLoadingText("Creating supplier invoice first");
                            supplierInvoiceId = await handleSubmit(form.values);
                            if (!supplierInvoiceId) {
                              setCalcLoading(false);
                              return;
                            }
                          }
  
                          try {
                            setCalcLoading(true);
                            setCalcLoadingText("Calculating TDS...");
                            const res = await postAPICall(
                              URL.tdsCalculation,
                              { supplier_invoice_id: supplierInvoiceId },
                              API_HEADER,
                            );
  
                            const data = res as Record<string, unknown>;
                            const rows =
                              (data.data as Array<Record<string, unknown>> | undefined) ??
                              [];
  
                            if (!Array.isArray(rows) || rows.length === 0) {
                              ToastNotification({
                                type: "error",
                                message: "No TDS rows returned from calculation.",
                              });
                              return;
                            }
  
                            const existing = form.values.charges_data;
                            const tdsChargeRows: ChargeRow[] = rows
                              .map((r): ChargeRow | null => {
                                const amount = parseNum(r.amount);
                                const currencyId = parseNum(r.currency_id);
                                const roe = parseNum(r.roe);
                                if (amount == null) return null;
                                return {
                                  account_code: String(r.account_code ?? ""),
                                  account_name: String(r.account_name ?? ""),
                                  subledger_code: String(r.subledger_code ?? ""),
                                  // Do not set CRN from TDS response
                                  CRN: "",
                                  narration: String(r.narration ?? ""),
                                  shipment_no: "",
                                  charge_id: null,
                                  charge_name: "",
                                  currency_id:
                                    currencyId != null ? Number(currencyId) : null,
                                  roe: parseRoeForPayload(roe),
                                  amount: Number(amount),
                                  amount_in_local: clampLocalAmount(Number(amount)),
                                  tax_code: "",
                                  Dr_Cr: normalizeDrCr(
                                    (r.Dr_cr as unknown) ??
                                      (r.Dr_Cr as unknown) ??
                                      (r.dr_cr as unknown) ??
                                      (r.cr_dr as unknown),
                                  ),
                                };
                              })
                              .filter((x): x is ChargeRow => x !== null);
  
                            const deduped = tdsChargeRows.filter((nr) => {
                              return !existing.some(
                                (er) =>
                                  String(er.account_code ?? "") ===
                                    String(nr.account_code ?? "") &&
                                  String(er.subledger_code ?? "") ===
                                    String(nr.subledger_code ?? "") &&
                                  Number(er.amount ?? 0) === Number(nr.amount ?? 0) &&
                                  er.Dr_Cr === nr.Dr_Cr &&
                                  String(er.charge_name ?? "") ===
                                    String(nr.charge_name ?? ""),
                              );
                            });
  
                            if (deduped.length) {
                              form.setFieldValue("charges_data", [
                                ...existing,
                                ...deduped,
                              ]);
                            }
                          } finally {
                            setCalcLoading(false);
                          }
                        }}
                      >
                        Calculate TDS
                      </Button>
                    )}
                  </Group>
                </Group>
  
                <Box mb="sm" mt="sm">
                  <Grid
                    w="100%"
                    gutter="sm"
                    py="sm"
                    style={{
                      position: "sticky",
                      top: 45,
                      // zIndex: 100,
                      backgroundColor: "white",
                      fontWeight: 600,
                      color: "#105476",
                    }}
                  >
                    <Grid.Col span={chargeColSpans.shipment} style={{ fontSize: "13px" }}>
                      Shipment No
                    </Grid.Col>
                    <Grid.Col span={chargeColSpans.charge} style={{ fontSize: "13px" }}>
                      Charge
                    </Grid.Col>
                    <Grid.Col span={chargeColSpans.crn} style={{ fontSize: "13px" }}>
                      CRN
                    </Grid.Col>
                    <Grid.Col span={chargeColSpans.account} style={{ fontSize: "13px" }}>
                      Account
                    </Grid.Col>
                    <Grid.Col span={chargeColSpans.subledger} style={{ fontSize: "13px" }}>
                      Subledger
                    </Grid.Col>
                    <Grid.Col span={chargeColSpans.narration} style={{ fontSize: "13px" }}>
                      Narration
                    </Grid.Col>
                    <Grid.Col span={chargeColSpans.currency} style={{ fontSize: "13px" }}>
                      Currency
                    </Grid.Col>
                    <Grid.Col span={chargeColSpans.roe} style={{ fontSize: "13px" }}>
                      ROE
                    </Grid.Col>
                    <Grid.Col span={chargeColSpans.amount} style={{ fontSize: "13px" }}>
                      Amount
                    </Grid.Col>
                    <Grid.Col span={chargeColSpans.localAmount} style={{ fontSize: "13px" }}>
                      Local Amount
                    </Grid.Col>
                    {isIndiaUser && (
                      <Grid.Col span={chargeColSpans.sac} style={{ fontSize: "13px" }}>
                        SAC Code
                      </Grid.Col>
                    )}
                    <Grid.Col span={chargeColSpans.drCr} style={{ fontSize: "13px" }}>
                      Dr/Cr
                    </Grid.Col>
                    <Grid.Col span={chargeColSpans.actions} style={{ fontSize: "13px" }}>
                      Actions
                    </Grid.Col>
                  </Grid>
  
                  {form.values.charges_data.map((row, index) => (
                    <Grid
                      key={index}
                      w="100%"
                      gutter="sm"
                      mt={index !== 0 ? "sm" : 0}
                    >
                      <Grid.Col span={chargeColSpans.shipment}>
                        <Dropdown
                          placeholder="Shipment No"
                          data={shipmentOptions}
                          value={row.shipment_no || null}
                          disabled={isReadOnly || reversalFormDisabled}
                          onChange={(v) => {
                            const shipmentNo = v ?? "";
                            form.setFieldValue(
                              `charges_data.${index}.shipment_no`,
                              shipmentNo,
                            );
                            fetchSacForChargeRow(
                              index,
                              row.charge_id,
                              shipmentNo,
                            );
                          }}
                          searchable
                          clearable
                          styles={{
                            input: {
                              fontSize: "13px",
                              fontFamily: "Inter",
                              height: "36px",
                            },
                          }}
                        />
                      </Grid.Col>
                      <Grid.Col span={chargeColSpans.charge}>
                        <SearchableSelect
                          placeholder="Charge"
                          apiEndpoint={URL.chargeMaster}
                          value={
                            row.charge_id != null ? String(row.charge_id) : null
                          }
                          displayValue={row.charge_name || undefined}
                          dropdownZIndex={1100}
                          minSearchLength={1}
                          searchFields={["charge_code", "charge_name", "id"]}
                          displayFormat={(item: Record<string, unknown>) => {
                            const id = String(item.id ?? "").trim();
                            const name = String(item.charge_name ?? "").trim();
                            return {
                              value: id,
                              label: name,
                            };
                          }}
                          returnOriginalData
                          error={
                            form.errors[`charges_data.${index}.charge_id`]
                              ? String(form.errors[`charges_data.${index}.charge_id`])
                              : undefined
                          }
                          onChange={(v, selectedData, originalData) => {
                            const chargeId =
                              v && Number.isFinite(Number(v)) ? Number(v) : null;
                            form.setFieldValue(
                              `charges_data.${index}.charge_id`,
                              chargeId,
                            );
                            const nextName =
                              selectedData?.label ??
                              (originalData?.charge_name != null
                                ? String(originalData.charge_name)
                                : "");
                            form.setFieldValue(
                              `charges_data.${index}.charge_name`,
                              chargeId ? nextName : "",
                            );
                            if (chargeId != null && row.shipment_no) {
                              fetchSacForChargeRow(
                                index,
                                chargeId,
                                row.shipment_no,
                              );
                            }
                            if (!chargeId) {
                              form.setFieldValue(
                                `charges_data.${index}.tax_code`,
                                "",
                              );
                            }
                          }}
                          disabled={isChargeLoading || isReadOnly || reversalFormDisabled}
                          styles={{
                            input: {
                              fontSize: "13px",
                              fontFamily: "Inter",
                              height: "36px",
                            },
                          }}
                        />
                      </Grid.Col>
                      <Grid.Col span={chargeColSpans.crn}>
                        <Dropdown
                          placeholder=""
                          data={CRN_OPTIONS}
                          value={row.CRN || null}
                          onChange={(v) =>
                            form.setFieldValue(
                              `charges_data.${index}.CRN`,
                              v ?? "",
                            )
                          }
                          disabled={isReadOnly || reversalFormDisabled}
                          styles={{
                            input: {
                              fontSize: "13px",
                              fontFamily: "Inter",
                              height: "36px",
                            },
                          }}
                        />
                      </Grid.Col>
                      <Grid.Col span={chargeColSpans.account}>
                        <SearchableSelect
                          placeholder="Search by account name"
                          apiEndpoint={URL.chartOfAccounts}
                          value={
                            row.account_id != null ? String(row.account_id) : null
                          }
                          dropdownZIndex={1100}
                          minSearchLength={1}
                          searchFields={["gl_name", "gl_account_code", "account_name", "id"]}
                          displayFormat={(item: Record<string, unknown>) => {
                            const id = String(item.id ?? "").trim();
                            const glName = String(item.gl_name ?? "").trim();
                            const gl = String(item.gl_account_code ?? "").trim();
                            const name = String(item.account_name ?? "").trim();
                            return {
                              value: id,
                              label: [name, gl, glName].filter(Boolean).join(" - "),
                            };
                          }}
                          displayValue={
                            row.account_name
                              ? `${row.account_name}${
                                  row.account_code ? ` - ${row.account_code}` : ""
                                }`
                              : row.account_code || undefined
                          }
                          returnOriginalData
                          onChange={(value, _selectedData, originalData) => {
                            if (!value || !originalData) {
                              form.setFieldValue(
                                `charges_data.${index}.account_id`,
                                null,
                              );
                              form.setFieldValue(
                                `charges_data.${index}.account_code`,
                                "",
                              );
                              form.setFieldValue(
                                `charges_data.${index}.subledger_code`,
                                "",
                              );
                              form.setFieldValue(
                                `charges_data.${index}.account_name`,
                                "",
                              );
                              return;
                            }
                            form.setFieldValue(
                              `charges_data.${index}.account_id`,
                              Number.isFinite(Number(value))
                                ? Number(value)
                                : null,
                            );
                            form.setFieldValue(
                              `charges_data.${index}.account_code`,
                              originalData.gl_account_code !== undefined &&
                                originalData.gl_account_code !== null
                                ? String(originalData.gl_account_code)
                                : "",
                            );
                            form.setFieldValue(
                              `charges_data.${index}.subledger_code`,
                              originalData.sl_code !== undefined &&
                                originalData.sl_code !== null
                                ? String(originalData.sl_code)
                                : "",
                            );
                            form.setFieldValue(
                              `charges_data.${index}.account_name`,
                              [
                                String(
                                  (originalData as Record<string, unknown>)
                                    .gl_account_code ?? "",
                                ).trim(),
                                String(
                                  (originalData as Record<string, unknown>)
                                    .account_name ?? "",
                                ).trim(),
                                String(
                                  (originalData as Record<string, unknown>).gl_name ??
                                    "",
                                ).trim(),
                              ]
                                .filter(Boolean)
                                .join(" - "),
                            );
                          }}
                          disabled={
                            isReadOnly ||
                            reversalFormDisabled ||
                            (String(row.shipment_no ?? "").trim() !== "" &&
                              row.charge_id != null)
                          }
                          styles={{
                            input: {
                              fontSize: "13px",
                              fontFamily: "Inter",
                              height: "36px",
                            },
                          }}
                        />
                      </Grid.Col>
                      <Grid.Col span={chargeColSpans.subledger}>
                        <TextInput
                          placeholder="Subledger"
                          value={row.subledger_code}
                          readOnly
                          disabled={
                            isReadOnly ||
                            reversalFormDisabled ||
                            (String(row.shipment_no ?? "").trim() !== "" &&
                              row.charge_id != null)
                          }
                          styles={{
                            input: {
                              fontSize: "13px",
                              fontFamily: "Inter",
                              height: "36px",
                            },
                          }}
                        />
                      </Grid.Col>
                      <Grid.Col span={chargeColSpans.narration}>
                        <TextInput
                          placeholder="Narration"
                          value={row.narration}
                          onChange={(e) =>
                            form.setFieldValue(
                              `charges_data.${index}.narration`,
                              e.target.value,
                            )
                          }
                          disabled={isReadOnly || reversalFormDisabled}
                          styles={{
                            input: {
                              fontSize: "13px",
                              fontFamily: "Inter",
                              height: "36px",
                            },
                          }}
                        />
                      </Grid.Col>
                      <Grid.Col span={chargeColSpans.currency}>
                        <Dropdown
                          placeholder="Currency"
                          data={currencyOptions}
                          value={
                            row.currency_id != null
                              ? String(row.currency_id)
                              : null
                          }
                          onChange={(v) => {
                            const id = v ? Number(v) : null;
                            form.setFieldValue(
                              `charges_data.${index}.currency_id`,
                              id,
                            );
                            const code =
                              currencyOptions.find((o) => o.value === v)?.label ??
                              "";
                          if (code) {
                            form.clearFieldError(`charges_data.${index}.roe`);
                            syncRoeForCurrencyChange(
                              code,
                              (roe) => {
                                form.setFieldValue(
                                  `charges_data.${index}.roe`,
                                  roe,
                                );
                              },
                              v ?? "",
                            );
                          }
                          }}
                          searchable
                          clearable
                          disabled={isCurrencyLoading || isReadOnly || reversalFormDisabled}
                          styles={{
                            input: {
                              fontSize: "13px",
                              fontFamily: "Inter",
                              height: "36px",
                            },
                          }}
                        />
                      </Grid.Col>
                      <Grid.Col span={chargeColSpans.roe}>
                        <Box style={{ position: "relative" }}>
                          <NumberInput
                            placeholder="ROE"
                            value={row.roe ?? undefined}
                            onChange={(v) => {
                              const chargeCode =
                                currencyOptions.find(
                                  (o) =>
                                    o.value === String(row.currency_id ?? ""),
                                )?.label ?? "";
                              onRoeValueChange(
                                chargeCode,
                                typeof v === "number" ? v : null,
                                (roe) =>
                                  form.setFieldValue(
                                    `charges_data.${index}.roe`,
                                    roe,
                                  ),
                                form.setFieldError,
                                form.clearFieldError,
                                `charges_data.${index}.roe`,
                                row.currency_id != null
                                  ? String(row.currency_id)
                                  : null,
                              );
                            }}
                            min={0}
                            decimalScale={ROE_DECIMAL_PLACES}
                            hideControls
                            disabled={
                              isReadOnly ||
                              reversalFormDisabled ||
                              isLocalCurrency(
                                currencyOptions.find(
                                  (o) =>
                                    o.value === String(row.currency_id ?? ""),
                                )?.label ?? "",
                                row.currency_id != null
                                  ? String(row.currency_id)
                                  : null,
                              )
                            }
                            styles={{
                              input: {
                                fontSize: "13px",
                                fontFamily: "Inter",
                                height: "36px",
                              },
                            }}
                          />
                          <FieldErrorBelow
                            error={
                              form.errors[`charges_data.${index}.roe`] as
                                | string
                                | undefined
                            }
                          />
                        </Box>
                      </Grid.Col>
                      <Grid.Col span={0.8}>
                        <NumberInput
                          placeholder="0"
                          value={row.amount ?? undefined}
                          onChange={(v) =>
                            form.setFieldValue(
                              `charges_data.${index}.amount`,
                              typeof v === "number" ? clampAmount(v) : null,
                            )
                          }
                          min={0}
                          decimalScale={currencyAmountDecimalScale}
                          hideControls
                          disabled={isReadOnly || reversalFormDisabled}
                          styles={{
                            input: {
                              fontSize: "13px",
                              fontFamily: "Inter",
                              height: "36px",
                            },
                          }}
                        />
                      </Grid.Col>
                      <Grid.Col span={0.8}>
                        <NumberInput
                          placeholder="0"
                          value={row.amount_in_local ?? undefined}
                          readOnly
                          min={0}
                          decimalScale={localAmountDecimalScale}
                          {...getAmountNumberInputFormatProps()}
                          hideControls
                          styles={readOnlyFieldStyles}
                        />
                      </Grid.Col>
                    {isIndiaUser && (
                      <Grid.Col span={chargeColSpans.sac}>
                        <Dropdown
                          searchable
                          clearable
                          placeholder="SAC Code"
                          data={sacCodeOptionsForForm}
                          value={String(row.tax_code ?? "").trim() || null}
                          onChange={(val) =>
                            form.setFieldValue(
                              `charges_data.${index}.tax_code`,
                              String(val ?? "").trim(),
                            )
                          }
                          disabled={isReadOnly || reversalFormDisabled}
                          styles={{
                            input: {
                              fontSize: "13px",
                              fontFamily: "Inter",
                              height: "36px",
                            },
                          }}
                        />
                      </Grid.Col>
                    )}
                    <Grid.Col span={chargeColSpans.drCr}>
                        <Dropdown
                          data={[
                            { value: "Dr", label: "Dr" },
                            { value: "Cr", label: "Cr" },
                          ]}
                          value={row.Dr_Cr}
                          onChange={(v) =>
                            form.setFieldValue(
                              `charges_data.${index}.Dr_Cr`,
                              (v === "Dr" ? "Dr" : "Cr") as "Cr" | "Dr",
                            )
                          }
                          disabled={isReadOnly || reversalFormDisabled}
                          styles={{
                            input: {
                              fontSize: "13px",
                              fontFamily: "Inter",
                              height: "36px",
                            },
                          }}
                        />
                      </Grid.Col>
                      <Grid.Col span={0.5}>
                        <Group gap="xs">
                          {!isReadOnly &&
                            !reversalFormDisabled &&
                            form.values.charges_data.length > 1 && (
                              <Button
                                type="button"
                                variant="light"
                                color="red"
                                size="sm"
                                px={12}
                                onClick={() =>
                                  form.removeListItem("charges_data", index)
                                }
                              >
                                <IconTrash size={16} />
                              </Button>
                            )}
                          {!isReadOnly &&
                            form.values.charges_data.length - 1 === index && (
                              <Button
                                type="button"
                                radius="sm"
                                px={12}
                                size="sm"
                                variant="light"
                                color="#105476"
                                onClick={addChargeRow}
                                disabled={reversalFormDisabled}
                              >
                                <IconPlus size={16} />
                              </Button>
                            )}
                        </Group>
                      </Grid.Col>
                    </Grid>
                  ))}
                </Box>
              </Grid.Col>
            </Grid>
  
            {/* Supporting Documents Modal */}
            <Modal
                opened={documentsModalOpened}
                onClose={closeDocumentsModal}
                title={isReadOnly ? "Supporting Documents" : "Attach Supporting Documents"}
                size="xl"
                centered
                style={{ fontFamily: "Inter" }}
                styles={{ title: { fontWeight: 600, color: "#105476" } }}
              >
                <Stack gap="xs">
                  {form.values.supporting_documents.map((doc, index) => (
                    <Grid
                      key={index}
                      columns={12}
                      gutter="sm"
                      align="flex-end"
                      pb={
                        form.errors[`charges_data.${index}.roe`] ? 18 : 0
                      }
                    >
                      <Grid.Col span={5.5}>
                        <TextInput
                          label="Document Name"
                          placeholder="Enter document name"
                          value={doc.name}
                          disabled={isReadOnly}
                          onChange={(e) => {
                            if (isReadOnly) return;
                            const updatedDocs = [
                              ...form.values.supporting_documents,
                            ];
                            updatedDocs[index] = {
                              ...updatedDocs[index],
                              name: e.target.value,
                            };
                            form.setFieldValue(
                              "supporting_documents",
                              updatedDocs,
                            );
                          }}
                        />
                      </Grid.Col>
                      <Grid.Col span={5.5}>
                        <Box>
                          <Text size="sm" fw={500} mb={4}>
                            File
                          </Text>
                          <Dropzone
                            onDrop={(files: File[]) => {
                              if (isReadOnly) return;
                              if (files.length === 0) return;
                              const file = files[0];
                              if (fileErrors[index]) {
                                const newErrors = { ...fileErrors };
                                delete newErrors[index];
                                setFileErrors(newErrors);
                              }
                              if (file.size > MAX_FILE_SIZE) {
                                const newErrors = { ...fileErrors };
                                newErrors[index] = `File size exceeds 10MB limit. Current size: ${(file.size / (1024 * 1024)).toFixed(2)}MB`;
                                setFileErrors(newErrors);
                                ToastNotification({
                                  type: "error",
                                  message: `File "${file.name}" exceeds 10MB limit`,
                                });
                                return;
                              }
                              const updatedDocs = [
                                ...form.values.supporting_documents,
                              ];
                              updatedDocs[index] = {
                                ...updatedDocs[index],
                                file,
                                document_url: undefined,
                              };
                              form.setFieldValue(
                                "supporting_documents",
                                updatedDocs,
                              );
                            }}
                            onReject={(files: any[]) => {
                              if (isReadOnly) return;
                              const rejection = files[0];
                              if (
                                rejection?.errors?.some(
                                  (e: any) => e.code === "file-too-large",
                                )
                              ) {
                                const newErrors = { ...fileErrors };
                                newErrors[index] = "File size exceeds 10MB limit";
                                setFileErrors(newErrors);
                              }
                            }}
                            maxSize={MAX_FILE_SIZE}
                            accept={undefined}
                            multiple={false}
                            styles={{
                              root: {
                                border: "1px solid var(--mantine-color-gray-4)",
                                borderRadius: "var(--mantine-radius-sm)",
                                backgroundColor: "var(--mantine-color-white)",
                                minHeight: "36px",
                                padding: "0",
                              },
                              inner: {
                                padding: "0",
                                minHeight: "36px",
                              },
                            }}
                          >
                            <Group
                              justify="space-between"
                              gap="xs"
                              px="sm"
                              style={{
                                minHeight: "36px",
                                pointerEvents: "none",
                                cursor: "pointer",
                              }}
                            >
                              <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
                                {doc.file ? (
                                  <>
                                    <IconUpload
                                      size={16}
                                      color="var(--mantine-color-dimmed)"
                                    />
                                    <Text
                                      size="sm"
                                      truncate
                                      style={{
                                        flex: 1,
                                        color: "var(--mantine-color-dark)",
                                      }}
                                    >
                                      {doc.file.name}
                                    </Text>
                                  </>
                                ) : doc.document_url ? (
                                  <>
                                    <IconDownload
                                      size={16}
                                      color="var(--mantine-color-blue-6)"
                                    />
                                    <Text
                                      size="sm"
                                      truncate
                                      style={{
                                        flex: 1,
                                        color: "var(--mantine-color-blue-6)",
                                        cursor: "pointer",
                                        textDecoration: "underline",
                                        pointerEvents: "auto",
                                      }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (
                                          doc.document_url &&
                                          doc.original_document_name
                                        ) {
                                          downloadFile(
                                            doc.document_url,
                                            doc.original_document_name,
                                          );
                                        }
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.opacity = "0.8";
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.opacity = "1";
                                      }}
                                    >
                                      {doc.original_document_name ||
                                        "Download file"}
                                    </Text>
                                  </>
                                ) : (
                                  <>
                                    <IconUpload
                                      size={16}
                                      color="var(--mantine-color-dimmed)"
                                    />
                                    <Text
                                      size="sm"
                                      c="dimmed"
                                      truncate
                                      style={{ flex: 1 }}
                                    >
                                      Drag and drop or click to select file
                                    </Text>
                                  </>
                                )}
                              </Group>
                              {!isReadOnly && (doc.file || doc.document_url) && (
                                <Button
                                  variant="subtle"
                                  color="red"
                                  size="xs"
                                  p={4}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (fileErrors[index]) {
                                      const newErrors = { ...fileErrors };
                                      delete newErrors[index];
                                      setFileErrors(newErrors);
                                    }
                                    const updatedDocs = [
                                      ...form.values.supporting_documents,
                                    ];
                                    updatedDocs[index] = {
                                      ...updatedDocs[index],
                                      file: null,
                                      document_url: undefined,
                                      document_id: undefined,
                                    };
                                    form.setFieldValue(
                                      "supporting_documents",
                                      updatedDocs,
                                    );
                                  }}
                                  style={{ pointerEvents: "auto" }}
                                >
                                  <IconX size={14} />
                                </Button>
                              )}
                            </Group>
                          </Dropzone>
                          {fileErrors[index] && (
                            <Text size="xs" c="red" mt={4}>
                              {fileErrors[index]}
                            </Text>
                          )}
                        </Box>
                      </Grid.Col>
                      {!isReadOnly && (
                        <Grid.Col span={1}>
                          <Button
                            variant="light"
                            color="red"
                            onClick={() => {
                              if (fileErrors[index]) {
                                const newErrors = { ...fileErrors };
                                delete newErrors[index];
                                setFileErrors(newErrors);
                              }
                              if (
                                form.values.supporting_documents.length === 1
                              ) {
                                form.setFieldValue("supporting_documents", [
                                  { name: "", file: null },
                                ]);
                              } else {
                                const updatedDocs =
                                  form.values.supporting_documents.filter(
                                    (_, i) => i !== index,
                                  );
                                form.setFieldValue(
                                  "supporting_documents",
                                  updatedDocs,
                                );
                                const newErrors: { [key: number]: string } = {};
                                Object.keys(fileErrors).forEach((key) => {
                                  const keyNum = parseInt(key);
                                  if (keyNum < index) {
                                    newErrors[keyNum] = fileErrors[keyNum];
                                  } else if (keyNum > index) {
                                    newErrors[keyNum - 1] = fileErrors[keyNum];
                                  }
                                });
                                setFileErrors(newErrors);
                              }
                            }}
                          >
                            <IconTrash size={16} />
                          </Button>
                        </Grid.Col>
                      )}
                      <Grid.Col span={1} offset={11}>
                        {!isReadOnly &&
                          index ===
                            form.values.supporting_documents.length - 1 && (
                            <Button
                              variant="light"
                              color="#105476"
                              onClick={() => {
                                form.setFieldValue("supporting_documents", [
                                  ...form.values.supporting_documents,
                                  { name: "", file: null },
                                ]);
                              }}
                            >
                              <IconPlus size={16} />
                            </Button>
                          )}
                      </Grid.Col>
                    </Grid>
                  ))}
  
                  {!isReadOnly &&
                    form.values.supporting_documents.length === 0 && (
                      <Button
                        variant="light"
                        color="#105476"
                        leftSection={<IconPlus size={16} />}
                        onClick={() => {
                          form.setFieldValue("supporting_documents", [
                            { name: "", file: null },
                          ]);
                        }}
                        fullWidth
                      >
                        Add Document
                      </Button>
                    )}
  
                  <Group justify="flex-end" mt="md">
                    <Button variant="outline" onClick={closeDocumentsModal}>
                      Close
                    </Button>
                  </Group>
                </Stack>
              </Modal>
  
            <Group justify="flex-end" mt="lg" gap="sm">
              <Button
                variant="outline"
                size="sm"
                styles={{
                  root: {
                    borderColor: "#105476",
                    color: "#666",
                    fontSize: "13px",
                    fontFamily: "Inter",
                  },
                }}
                onClick={() => {
                  if (!isReadOnly && form.values.supporting_documents.length === 0) {
                    form.setFieldValue("supporting_documents", [
                      { name: "", file: null },
                    ]);
                  }
                  const newErrors: { [key: number]: string } = {};
                  form.values.supporting_documents.forEach((doc, idx) => {
                    if (doc.file && doc.file.size > MAX_FILE_SIZE) {
                      newErrors[idx] = `File size exceeds 10MB limit. Current size: ${(doc.file.size / (1024 * 1024)).toFixed(2)}MB`;
                    }
                  });
                  setFileErrors(newErrors);
                  openDocumentsModal();
                }}
                disabled={isSubmitting}
              >
                {isReadOnly ? "View supporting document(s)" : "Attach supporting document"}
              </Button>
  
              {!isReadOnly && (
                <>
                  <Button
                    type="submit"
                    color="#105476"
                    rightSection={<IconChevronRight size={16} />}
                    loading={isSubmitting}
                  >
                    {saveResponse?.id != null
                      ? isReversal
                        ? "Update"
                        : "Update Supplier Invoice"
                      : isReversal
                        ? "Create Supplier Invoice Reverse"
                        : "Save Supplier Invoice"}
                  </Button>
                  {saveResponse?.id != null && canPostDocuments && statusUpper === "UNPOSTED" && (
                    <Button
                      type="button"
                      color="black"
                      loading={isSubmitting}
                      onClick={handlePost}
                    >
                      Post
                    </Button>
                  )}
                </>
              )}
            </Group>
          </Box>
        </Stack>
      </Box>
    );
  }
  