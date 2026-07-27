import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
} from "react";
import {
  Paper,
  Box,
  Group,
  Text,
  Select,
  TextInput,
  Button,
  Tabs,
  Grid,
  Divider,
  Stack,
  ActionIcon,
  Loader,
  Tooltip,
  Anchor,
  Modal,
  UnstyledButton,
  Menu,
  Center,
} from "@mantine/core";
import {
  MantineReactTable,
  MRT_ColumnDef,
  useMantineReactTable,
} from "mantine-react-table";
import {
  IconFilter,
  IconChevronLeft,
  IconX,
  IconDotsVertical,
  IconDownload,
  IconFileInvoice,
} from "@tabler/icons-react";
import { apiCallProtected } from "../../../api/axios";
import { API_HEADER } from "../../../store/storeKeys";
import { useLocation, useNavigate } from "react-router-dom";
import { URL } from "../../../api/serverUrls";
import { ToastNotification } from "../../../components";
import {
  type GlobalSearchItem,
  globalSearchItemsFromResponse,
  navigateFromGlobalSearchDocumentNo,
  openGlobalSearchItem,
  runGlobalSearchQuery,
} from "../../../utils/globalSearchNavigation";
import useAuthStore from "../../../store/authStore";
import { getDefaultBranchCurrencyCode } from "../../../utils/userNumberFormat";
import {
  bindMoneyWholeNumberMode,
  formatMoneyAmountBound,
  isVietnamBranchFromUser,
} from "../../../utils/nonDecimalMoneyAmount";

interface JobLedgerData {
  id: number;
  segment: string;
  job: string;
  sno: number;
  subjob: string;
  documentType: string;
  daybookName: string;
  documentNo: string;
  date: string;
  partyName: string;
  billingCurrencyCode: string;
  billingAmount: number;
  debit: number;
  credit: number;
  revenue: number;
  actualCost: number;
  neutral: number;
  reversed: boolean;
}

interface JobLedgerProps {}

type FilterState = {
  segmentCode: string | null;
  jobNo: string | null;
  location: string | null;
  subjobNo: string | null;
  hbl_hawb_no: string | null;
  withAutoEntry: string | null;
  status: string | null;
};

type JobLedgerSummary = {
  total_debit?: number | null;
  total_credit?: number | null;
  total_revence?: number | null;
  total_cost?: number | null;
  total_neutral?: number | null;
  net_profit_Credit_Debit?: number | null;
  net_profit_revenue_cost?: number | null;
};

type JobLedgerApiRow = {
  sno?: number;
  service?: string;
  service_code?: string;
  job_id?: string;
  location?: string;
  branch_name?: string;
  hbl_hawb_no?: string;
  day_book_code?: string;
  day_book_name?: string;
  document_type?: string;
  document_no?: string;
  date?: string;
  party_name?: string;
  currency_code?: string;
  billing_currency_code?: string;
  billing_amount?: number | null;
  debit_local_amount?: number | null;
  credit_local_amount?: number | null;
  revence?: number | null;
  cost?: number | null;
  neutral?: number | null;
  reversed?: boolean;
};

type JobLedgerApiResponse = {
  job_id?: string;
  service_code?: string;
  total?: number;
  summary?: JobLedgerSummary;
  data?: JobLedgerApiRow[];
};

const formatJobLedgerJobLabel = (response: JobLedgerApiResponse): string => {
  const jobId = (response?.job_id ?? "").toString().trim();
  const serviceCode = (response?.service_code ?? "").toString().trim();

  if (!jobId && !serviceCode) return "";
  if (!jobId) return serviceCode;
  if (!serviceCode) return jobId;
  if (jobId.startsWith(`${serviceCode}-`)) return jobId;
  return `${serviceCode}-${jobId}`;
};

const JOB_EDIT_PATH_BY_SERVICE_NAME: Record<string, string> = {
  "Air Import": "/air/import-job/edit",
  "Air Export": "/air/export-job/edit",
  "Ocean Import": "/SeaExport/import-job/edit",
  "Ocean Export": "/SeaExport/export-job/edit",
};

type JobLedgerRequestFilters = {
  job_id: string;
  location: string;
  segment_code: string;
  hbl_hawb_no: string;
  charges?: boolean;
  type?: string;
};

type ChargeWiseSummary = {
  total_debit?: string | number | null;
  total_credit?: string | number | null;
  provisional?: {
    total_revenue?: string | number | null;
    total_cost?: string | number | null;
    total_neutral?: string | number | null;
  };
  actual?: {
    total_revenue?: string | number | null;
    total_cost?: string | number | null;
    total_neutral?: string | number | null;
  };
  net_profit_credit_debit?: string | number | null;
  net_profit_revenue_cost?: string | number | null;
};

type ChargeWiseApiRow = {
  sno?: number;
  charge_code?: string;
  charge_name?: string;
  debit_local_amount?: string | number | null;
  credit_local_amount?: string | number | null;
  provisional_revenue?: string | number | null;
  provisional_cost?: string | number | null;
  provisional_neutral?: string | number | null;
  actual_revenue?: string | number | null;
  actual_cost?: string | number | null;
  actual_neutral?: string | number | null;
};

type ChargeWiseApiResponse = {
  total?: number;
  summary?: ChargeWiseSummary;
  data?: ChargeWiseApiRow[];
};

type ChargeWiseData = {
  id: number;
  sno: number;
  chargeCode: string;
  chargeName: string;
  debit: string;
  credit: string;
  provisionalRevenue: string;
  provisionalCost: string;
  provisionalNeutral: string;
  actualRevenue: string;
  actualCost: string;
  actualNeutral: string;
};

/** Preserve API amount formatting: strings as-is; JSON numbers with one decimal when whole. */
const toApiDisplayAmount = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "string") {
    const trimmed = v.trim();
    return trimmed;
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    return Number.isInteger(v) ? v.toFixed(1) : String(v);
  }
  return "";
};

const parseDisplayAmount = (v: string): number => {
  if (!v.trim()) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

type ServiceMasterRow = {
  service_code?: string | number | null;
  service_name?: string | null;
};

const JobLedger: React.FC<JobLedgerProps> = () => {
  const [activeTab, setActiveTab] = useState<string | null>("document");
  const [showFilters, setShowFilters] = useState(false);

  const navigate = useNavigate();
  const routerLocation = useLocation();
  const navState = (routerLocation.state ?? {}) as any;
  const user = useAuthStore((state) => state.user);
  const isVietnamBranch = useMemo(() => isVietnamBranchFromUser(user), [user]);
  bindMoneyWholeNumberMode(isVietnamBranch);
  const activeCurrencyCode = useMemo(
    () => getDefaultBranchCurrencyCode(user?.branches),
    [user?.branches],
  );
  const amountColumnLabel = useCallback(
    (label: string) =>
      activeCurrencyCode ? `${label} (${activeCurrencyCode})` : label,
    [activeCurrencyCode],
  );

  const inferredJobIdFinal: string | null =
    (navState?.jobId as string | number | null)?.toString?.() ??
    (navState?.job_id as string | number | null)?.toString?.() ??
    (navState?.id as string | number | null)?.toString?.() ??
    null;

  const inferredLocationFinal: string | null =
    (navState?.location as string | null) ?? null;

  const inferredSegmentCodeFinal: string | null =
    (navState?.segment_code as string | null) ??
    (navState?.segmentCode as string | null) ??
    null;

  const inferredHblHawbFinal: string | null =
    (navState?.hbl_hawb_no as string | null) ?? null;

  const jobReturnTo = (navState?.jobReturnTo as string | undefined)?.trim() ?? "";
  const jobReturnToState = navState?.jobReturnToState;

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    segmentCode: inferredSegmentCodeFinal,
    jobNo: inferredJobIdFinal,
    location: inferredLocationFinal,
    subjobNo: null,
    hbl_hawb_no: inferredHblHawbFinal,
    withAutoEntry: null,
    status: null,
  });

  // Real data (loaded from API)
  const [tableData, setTableData] = useState<JobLedgerData[]>([]);
  const [jobLedgerSummary, setJobLedgerSummary] =
    useState<JobLedgerSummary | null>(null);
  const [jobLedgerJobLabel, setJobLedgerJobLabel] = useState<string | null>(
    null,
  );
  const [jobLedgerLoading, setJobLedgerLoading] = useState<boolean>(false);
  const [jobLedgerError, setJobLedgerError] = useState<string | null>(null);
  const [apiFilters, setApiFilters] = useState<JobLedgerRequestFilters | null>(
    null,
  );
  const [segmentOptions, setSegmentOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [segmentOptionsLoading, setSegmentOptionsLoading] = useState(false);
  const [documentNavLoading, setDocumentNavLoading] = useState(false);
  const [documentSearchModalOpen, setDocumentSearchModalOpen] = useState(false);
  const [documentSearchResults, setDocumentSearchResults] = useState<
    GlobalSearchItem[]
  >([]);
  const [chargeTableData, setChargeTableData] = useState<ChargeWiseData[]>([]);
  const [chargeSummary, setChargeSummary] = useState<ChargeWiseSummary | null>(
    null,
  );
  const [chargeLoading, setChargeLoading] = useState<boolean>(false);
  const [chargeError, setChargeError] = useState<string | null>(null);
  const chargeFiltersRef = useRef<string | null>(null);
  const [costSheetPreviewOpen, setCostSheetPreviewOpen] = useState(false);
  const [costSheetPdfUrl, setCostSheetPdfUrl] = useState<string | null>(null);
  const [costSheetLoading, setCostSheetLoading] = useState(false);

  const getJobLedgerReturnState = useCallback(
    () => ({
      jobId: filters.jobNo,
      job_id: filters.jobNo,
      location: filters.location,
      segment_code: filters.segmentCode,
      segmentCode: filters.segmentCode,
      service_name: navState?.service_name,
      hbl_hawb_no: filters.hbl_hawb_no,
      ...(jobReturnTo ? { jobReturnTo } : {}),
      ...(jobReturnToState != null ? { jobReturnToState } : {}),
      ...(navState?.job ? { job: navState.job } : {}),
    }),
    [
      filters.jobNo,
      filters.location,
      filters.segmentCode,
      filters.hbl_hawb_no,
      jobReturnTo,
      jobReturnToState,
      navState?.job,
      navState?.service_name,
    ],
  );

  const handleBack = useCallback(() => {
    if (jobReturnTo && jobReturnTo !== "/job-ledger") {
      navigate(
        jobReturnTo,
        jobReturnToState != null ? { state: jobReturnToState } : undefined,
      );
      return;
    }

    const serviceName = (navState?.service_name as string | undefined)?.trim() ?? "";
    const fallbackPath = JOB_EDIT_PATH_BY_SERVICE_NAME[serviceName];
    if (fallbackPath && filters.jobNo) {
      navigate(fallbackPath, {
        state: {
          jobId: filters.jobNo,
          ...(navState?.job ? { job: navState.job } : {}),
        },
      });
      return;
    }

    navigate(-1);
  }, [
    navigate,
    jobReturnTo,
    jobReturnToState,
    navState?.job,
    navState?.service_name,
    filters.jobNo,
  ]);

  const getDocumentNavigationOptions = useCallback(
    () => ({
      returnTo: "/job-ledger",
      returnToState: getJobLedgerReturnState(),
    }),
    [getJobLedgerReturnState],
  );

  const handleDocumentNumberClick = useCallback(
    async (documentNo: string) => {
      const query = documentNo.trim();
      if (!query || documentNavLoading) return;

      setDocumentNavLoading(true);
      try {
        const result = await navigateFromGlobalSearchDocumentNo(
          navigate,
          query,
          getDocumentNavigationOptions(),
        );

        if (result === "navigated") return;

        if (result === "multiple") {
          const normalized = await runGlobalSearchQuery(query);
          const items = globalSearchItemsFromResponse(normalized);
          setDocumentSearchResults(items);
          setDocumentSearchModalOpen(true);
          return;
        }

        if (result === "not_found") {
          ToastNotification({
            type: "warning",
            message: "No document found for this document number.",
          });
          return;
        }

        ToastNotification({
          type: "error",
          message: "Failed to open document. Please try again.",
        });
      } finally {
        setDocumentNavLoading(false);
      }
    },
    [documentNavLoading, getDocumentNavigationOptions, navigate],
  );

  const handleDocumentSearchResultPick = useCallback(
    async (item: GlobalSearchItem) => {
      setDocumentSearchModalOpen(false);
      setDocumentNavLoading(true);
      try {
        const ok = await openGlobalSearchItem(
          navigate,
          item,
          getDocumentNavigationOptions(),
        );
        if (!ok) {
          ToastNotification({
            type: "warning",
            message: "Navigation is not configured for this document type.",
          });
        }
      } catch {
        ToastNotification({
          type: "error",
          message: "Failed to open document. Please try again.",
        });
      } finally {
        setDocumentNavLoading(false);
        setDocumentSearchResults([]);
      }
    },
    [getDocumentNavigationOptions, navigate],
  );

  // Filter functions
  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  const updateFilter = (key: keyof FilterState, value: unknown) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const clearAllFilters = () => {
    // setFilters({
    //   segmentCode: null,
    //   jobNo: null,
    //   location: null,
    //   subjobNo: null,
    //   hbl_hawb_no: null,
    //   withAutoEntry: null,
    //   status: null,
    // });
    setFilters({
      segmentCode: null,
      jobNo: inferredJobIdFinal,
      location: null,
      subjobNo: null,
      hbl_hawb_no: null,
      withAutoEntry: null,
      status: null,
    });
    setApiFilters(null);
    setTableData([]);
    setJobLedgerSummary(null);
    setJobLedgerJobLabel(null);
    setChargeTableData([]);
    setChargeSummary(null);
    setChargeError(null);
    chargeFiltersRef.current = null;
    setJobLedgerError(null);
    setShowFilters(false);
  };

  const toNumber = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const buildJobLedgerFiltersFromUI = (
    uiFilters: FilterState,
  ): JobLedgerRequestFilters => {
    return {
      job_id: (uiFilters.jobNo ?? "").toString().trim(),
      location: (uiFilters.location ?? "").toString().trim(),
      segment_code: (uiFilters.segmentCode ?? "").toString().trim(),
      hbl_hawb_no: (uiFilters.hbl_hawb_no ?? "").toString().trim(),
    };
  };

  const fetchChargeWiseJobLedger = async (
    requestFilters: JobLedgerRequestFilters,
  ) => {
    const filtersKey = JSON.stringify({
      ...requestFilters,
      charges: true,
    });
    setChargeLoading(true);
    setChargeError(null);
    setChargeTableData([]);
    setChargeSummary(null);
    try {
      const response = await apiCallProtected.post(
        `${URL.jobLedger}`,
        { filters: { ...requestFilters, charges: true } },
        API_HEADER,
      );
      const result = response as ChargeWiseApiResponse;
      const apiRows = Array.isArray(result?.data) ? result.data : [];
      setChargeSummary(result?.summary ?? null);
      setChargeTableData(
        apiRows.map((d, idx) => {
          const id = Number(d?.sno ?? idx + 1);
          return {
            id: Number.isFinite(id) ? id : idx + 1,
            sno: d?.sno ?? idx + 1,
            chargeCode: (d?.charge_code ?? "").toString(),
            chargeName: (d?.charge_name ?? "").toString(),
            debit: toApiDisplayAmount(d?.debit_local_amount),
            credit: toApiDisplayAmount(d?.credit_local_amount),
            provisionalRevenue: toApiDisplayAmount(d?.provisional_revenue),
            provisionalCost: toApiDisplayAmount(d?.provisional_cost),
            provisionalNeutral: toApiDisplayAmount(d?.provisional_neutral),
            actualRevenue: toApiDisplayAmount(d?.actual_revenue),
            actualCost: toApiDisplayAmount(d?.actual_cost),
            actualNeutral: toApiDisplayAmount(d?.actual_neutral),
          };
        }),
      );
      chargeFiltersRef.current = filtersKey;
    } catch (err) {
      setChargeError("Failed to load Charge Wise ledger. Please try again.");
      setChargeTableData([]);
      setChargeSummary(null);
      chargeFiltersRef.current = null;
      // eslint-disable-next-line no-console
      console.error("ChargeWise JobLedger fetch error:", err);
    } finally {
      setChargeLoading(false);
    }
  };

  const getCurrentRequestFilters = useCallback((): JobLedgerRequestFilters => {
    if (apiFilters) return apiFilters;
    return {
      job_id: (filters.jobNo ?? inferredJobIdFinal ?? "").toString().trim(),
      location: (filters.location ?? inferredLocationFinal ?? "")
        .toString()
        .trim(),
      segment_code: (filters.segmentCode ?? inferredSegmentCodeFinal ?? "")
        .toString()
        .trim(),
      hbl_hawb_no: (filters.hbl_hawb_no ?? "").toString().trim(),
    };
  }, [
    apiFilters,
    filters.jobNo,
    filters.location,
    filters.segmentCode,
    filters.hbl_hawb_no,
    inferredJobIdFinal,
    inferredLocationFinal,
    inferredSegmentCodeFinal,
  ]);

  const handleCloseCostSheetPreview = useCallback(() => {
    setCostSheetPreviewOpen(false);
    setCostSheetLoading(false);
    if (costSheetPdfUrl) {
      window.URL.revokeObjectURL(costSheetPdfUrl);
    }
    setCostSheetPdfUrl(null);
  }, [costSheetPdfUrl]);

  const handleDownloadCostSheetPdf = useCallback(() => {
    if (!costSheetPdfUrl) return;
    const jobId =
      (filters.jobNo ?? inferredJobIdFinal ?? "job").toString().trim() || "job";
    const hbl = (filters.hbl_hawb_no ?? "").toString().trim();
    const fileName = hbl
      ? `job-cost-sheet-${jobId}-${hbl}.pdf`
      : `job-cost-sheet-${jobId}.pdf`;
    const link = document.createElement("a");
    link.href = costSheetPdfUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [costSheetPdfUrl, filters.jobNo, filters.hbl_hawb_no, inferredJobIdFinal]);

  const handleJobCostSheet = useCallback(async () => {
    const requestFilters = getCurrentRequestFilters();
    if (!requestFilters.job_id) {
      ToastNotification({
        type: "error",
        message: "Job ID is required to generate Job Cost Sheet.",
      });
      return;
    }

    setCostSheetPreviewOpen(true);
    setCostSheetLoading(true);
    if (costSheetPdfUrl) {
      window.URL.revokeObjectURL(costSheetPdfUrl);
      setCostSheetPdfUrl(null);
    }

    try {
      const pdfFilters: Record<string, string> = {
        job_id: requestFilters.job_id,
        type: "pdf",
      };
      if (requestFilters.location) {
        pdfFilters.location = requestFilters.location;
      }
      if (requestFilters.segment_code) {
        pdfFilters.segment_code = requestFilters.segment_code;
      }
      // House navigation includes hbl_hawb_no; master-level omits it.
      if (requestFilters.hbl_hawb_no) {
        pdfFilters.hbl_hawb_no = requestFilters.hbl_hawb_no;
      }

      const response = await apiCallProtected.post(
        `${URL.jobLedger}`,
        { filters: pdfFilters },
        { ...API_HEADER, responseType: "blob" },
      );

      const blob =
        response instanceof Blob
          ? response
          : (response as { data?: Blob })?.data instanceof Blob
            ? (response as { data: Blob }).data
            : null;

      if (!blob || blob.size === 0) {
        throw new Error("Empty PDF response from server");
      }

      const head = await blob.slice(0, 256).text();
      const headTrim = head.trimStart();
      if (headTrim.startsWith("{") || headTrim.startsWith("[")) {
        let message = "Failed to generate Job Cost Sheet PDF";
        try {
          const parsed = JSON.parse(await blob.text()) as {
            detail?: string;
            message?: string;
            error?: string;
          };
          message =
            parsed.detail || parsed.message || parsed.error || message;
        } catch {
          /* keep default */
        }
        throw new Error(message);
      }

      const pdfUrl = window.URL.createObjectURL(blob);
      setCostSheetPdfUrl(pdfUrl);
    } catch (error: unknown) {
      console.error("Job Cost Sheet PDF error:", error);
      ToastNotification({
        type: "error",
        message:
          (error as { message?: string })?.message ||
          "Failed to generate Job Cost Sheet PDF",
      });
      setCostSheetPreviewOpen(false);
      setCostSheetPdfUrl(null);
    } finally {
      setCostSheetLoading(false);
    }
  }, [costSheetPdfUrl, getCurrentRequestFilters]);

  useEffect(() => {
    return () => {
      if (costSheetPdfUrl) {
        window.URL.revokeObjectURL(costSheetPdfUrl);
      }
    };
  }, [costSheetPdfUrl]);

  const fetchJobLedger = async (requestFilters: JobLedgerRequestFilters) => {
    setJobLedgerLoading(true);
    setJobLedgerError(null);
    setTableData([]);
    setJobLedgerSummary(null);
    setJobLedgerJobLabel(null);
    try {
      const response = await apiCallProtected.post(
        `${URL.jobLedger}`,
        { filters: requestFilters },
        API_HEADER,
      );
      const result = response as JobLedgerApiResponse;
      const apiRows = Array.isArray(result?.data) ? result.data : [];
      setJobLedgerSummary(result?.summary ?? null);
      setJobLedgerJobLabel(formatJobLedgerJobLabel(result));
      setTableData(
        apiRows.map((d, idx) => {
          const id = Number(d?.sno ?? idx + 1);
          return {
            id: Number.isFinite(id) ? id : idx + 1,
            segment: (d?.service ?? "").toString(),
            job: (d?.job_id ?? "").toString(),
            sno: d?.sno ?? 0,
            // Response doesn't have "subjob" like the UI. Using HBL/AWB as a closest match.
            subjob: (d?.hbl_hawb_no ?? "").toString(),
            documentType: (d?.document_type ?? "").toString(),
            daybookName: (d?.day_book_name ?? "").toString(),
            documentNo: (d?.document_no ?? "").toString(),
            date: (d?.date ?? "").toString(),
            partyName: (d?.party_name ?? "").toString(),
            billingCurrencyCode: (
              d?.billing_currency_code ??
              d?.currency_code ??
              ""
            ).toString(),
            billingAmount: toNumber(d?.billing_amount),
            debit: toNumber(d?.debit_local_amount),
            credit: toNumber(d?.credit_local_amount),
            revenue: toNumber(d?.revence),
            actualCost: toNumber(d?.cost),
            neutral: toNumber(d?.neutral),
            reversed: Boolean(d?.reversed),
          };
        }),
      );
    } catch (err) {
      setJobLedgerError("Failed to load Job Ledger. Please try again.");
      setTableData([]);
      setJobLedgerSummary(null);
      setJobLedgerJobLabel(null);
      // eslint-disable-next-line no-console
      console.error("JobLedger fetch error:", err);
    } finally {
      setJobLedgerLoading(false);
    }
  };

  const handleApplyFilters = () => {
    const built = buildJobLedgerFiltersFromUI(filters);
    setJobLedgerError(null);
    setChargeError(null);
    chargeFiltersRef.current = null;
    setApiFilters(built);
    fetchJobLedger(built);
    if (activeTab === "charge") {
      fetchChargeWiseJobLedger(built);
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function fetchServiceMaster() {
      setSegmentOptionsLoading(true);
      try {
        const res = await apiCallProtected.get(
          `${URL.serviceMaster}`,
          API_HEADER,
        );
        const rows = (res?.data ?? res) as ServiceMasterRow[];
        const list = Array.isArray(rows) ? rows : [];

        const options = list
          .map((r) => ({
            value: (r?.service_code ?? "").toString(),
            label: (r?.service_name ?? "").toString(),
          }))
          .filter((o) => o.value && o.label);

        if (!isMounted) return;
        setSegmentOptions(options);
      } catch (e) {
        if (!isMounted) return;
        setSegmentOptions([]);
      } finally {
        if (!isMounted) return;
        setSegmentOptionsLoading(false);
      }
    }

    fetchServiceMaster();
    return () => {
      isMounted = false;
    };
  }, []);

  // Always hit API when screen opens (even if some filters are blank).
  const didInitialFetchRef = useRef(false);
  useEffect(() => {
    if (didInitialFetchRef.current) return;
    didInitialFetchRef.current = true;

    const requestFilters: JobLedgerRequestFilters = {
      job_id: (filters.jobNo ?? inferredJobIdFinal ?? "").toString().trim(),
      location: (filters.location ?? inferredLocationFinal ?? "")
        .toString()
        .trim(),
      segment_code: (filters.segmentCode ?? inferredSegmentCodeFinal ?? "")
        .toString()
        .trim(),
      hbl_hawb_no: (filters.hbl_hawb_no ?? "").toString().trim(),
    };

    fetchJobLedger(requestFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep existing flow where changing `apiFilters` triggers a fetch too.
  useEffect(() => {
    if (!apiFilters) return;
    fetchJobLedger(apiFilters);
    if (activeTab === "charge") {
      fetchChargeWiseJobLedger(apiFilters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiFilters]);

  useEffect(() => {
    if (activeTab !== "charge") return;

    const requestFilters = getCurrentRequestFilters();
    const filtersKey = JSON.stringify({
      ...requestFilters,
      charges: true,
    });
    if (chargeFiltersRef.current === filtersKey) return;

    fetchChargeWiseJobLedger(requestFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, getCurrentRequestFilters]);

  // Calculate totals from API summary (fallback to calculated totals)
  const totals = useMemo(() => {
    // Use API summary if available, otherwise calculate from table data
    if (jobLedgerSummary) {
      return {
        totalDebit: toNumber(jobLedgerSummary.total_debit),
        totalCredit: toNumber(jobLedgerSummary.total_credit),
        totalRevenue: toNumber(jobLedgerSummary.total_revence),
        totalActualCost: toNumber(jobLedgerSummary.total_cost),
        grossProfit: toNumber(jobLedgerSummary.net_profit_revenue_cost),
        totalNeutral: toNumber(jobLedgerSummary.total_neutral),
      };
    }

    // Fallback to calculating from table data
    const totalDebit = tableData.reduce((sum, row) => sum + row.debit, 0);
    const totalCredit = tableData.reduce((sum, row) => sum + row.credit, 0);
    const totalRevenue = tableData.reduce((sum, row) => sum + row.revenue, 0);
    const totalActualCost = tableData.reduce(
      (sum, row) => sum + row.actualCost,
      0,
    );
    const totalNeutral = tableData.reduce((sum, row) => sum + row.neutral, 0);
    const grossProfit = totalRevenue - totalActualCost;

    return {
      totalDebit,
      totalCredit,
      totalRevenue,
      totalActualCost,
      grossProfit,
      totalNeutral,
    };
  }, [jobLedgerSummary, tableData]);

  const chargeTotals = useMemo(() => {
    if (chargeSummary) {
      return {
        totalDebit: toApiDisplayAmount(chargeSummary.total_debit),
        totalCredit: toApiDisplayAmount(chargeSummary.total_credit),
        provisionalRevenue: toApiDisplayAmount(
          chargeSummary.provisional?.total_revenue,
        ),
        provisionalCost: toApiDisplayAmount(
          chargeSummary.provisional?.total_cost,
        ),
        provisionalNeutral: toApiDisplayAmount(
          chargeSummary.provisional?.total_neutral,
        ),
        actualRevenue: toApiDisplayAmount(chargeSummary.actual?.total_revenue),
        actualCost: toApiDisplayAmount(chargeSummary.actual?.total_cost),
        actualNeutral: toApiDisplayAmount(chargeSummary.actual?.total_neutral),
        netProfitCreditDebit: toApiDisplayAmount(
          chargeSummary.net_profit_credit_debit,
        ),
      };
    }

    const totalDebit = chargeTableData.reduce(
      (sum, row) => sum + parseDisplayAmount(row.debit),
      0,
    );
    const totalCredit = chargeTableData.reduce(
      (sum, row) => sum + parseDisplayAmount(row.credit),
      0,
    );
    const provisionalRevenue = chargeTableData.reduce(
      (sum, row) => sum + parseDisplayAmount(row.provisionalRevenue),
      0,
    );
    const provisionalCost = chargeTableData.reduce(
      (sum, row) => sum + parseDisplayAmount(row.provisionalCost),
      0,
    );
    const provisionalNeutral = chargeTableData.reduce(
      (sum, row) => sum + parseDisplayAmount(row.provisionalNeutral),
      0,
    );
    const actualRevenue = chargeTableData.reduce(
      (sum, row) => sum + parseDisplayAmount(row.actualRevenue),
      0,
    );
    const actualCost = chargeTableData.reduce(
      (sum, row) => sum + parseDisplayAmount(row.actualCost),
      0,
    );
    const actualNeutral = chargeTableData.reduce(
      (sum, row) => sum + parseDisplayAmount(row.actualNeutral),
      0,
    );

    return {
      totalDebit: toApiDisplayAmount(totalDebit),
      totalCredit: toApiDisplayAmount(totalCredit),
      provisionalRevenue: toApiDisplayAmount(provisionalRevenue),
      provisionalCost: toApiDisplayAmount(provisionalCost),
      provisionalNeutral: toApiDisplayAmount(provisionalNeutral),
      actualRevenue: toApiDisplayAmount(actualRevenue),
      actualCost: toApiDisplayAmount(actualCost),
      actualNeutral: toApiDisplayAmount(actualNeutral),
      netProfitCreditDebit: toApiDisplayAmount(totalCredit - totalDebit),
    };
  }, [chargeSummary, chargeTableData]);

  const chargeTableBorder = "1px solid #CBD5E1";
  const chargeTableSectionBorder = "1px solid #94A3B8";

  const chargeTableHeaderStyle: React.CSSProperties = {
    padding: "6px 8px",
    fontSize: "14px",
    fontFamily: "Inter",
    color: "#1E293B",
    backgroundColor: "#F8FAFC",
    border: chargeTableBorder,
    textAlign: "center",
    fontWeight: 600,
    overflow: "hidden",
    wordBreak: "break-word",
  };

  const chargeTableGroupHeaderStyle: React.CSSProperties = {
    ...chargeTableHeaderStyle,
    borderBottom: chargeTableSectionBorder,
  };

  const chargeTableSectionStartStyle: React.CSSProperties = {
    borderLeft: chargeTableSectionBorder,
  };

  const chargeTableCellStyle: React.CSSProperties = {
    padding: "4px 8px",
    fontSize: "14px",
    fontFamily: "Inter",
    color: "#334155",
    backgroundColor: "#ffffff",
    border: chargeTableBorder,
  };

  const chargeTableAmountCellStyle: React.CSSProperties = {
    ...chargeTableCellStyle,
    backgroundColor: "#F8FAFC",
    textAlign: "right",
  };

  const chargeTableFooterLabelStyle: React.CSSProperties = {
    ...chargeTableCellStyle,
    fontWeight: 600,
    backgroundColor: "#F8FAFC",
  };

  const chargeTableFooterAmountStyle: React.CSSProperties = {
    ...chargeTableAmountCellStyle,
    fontWeight: 600,
  };

  const chargeTableColWidths = {
    sno: 48,
    chargeName: 280,
    amount: 88,
  } as const;

  const chargeTableMinWidth =
    chargeTableColWidths.sno +
    chargeTableColWidths.chargeName +
    chargeTableColWidths.amount * 8;

  const chargeTableColumnCount = 10;

  const withChargeSectionStart = (
    style: React.CSSProperties,
  ): React.CSSProperties => ({
    ...style,
    ...chargeTableSectionStartStyle,
  });

  const renderChargeTableColGroup = () => (
    <colgroup>
      <col style={{ width: chargeTableColWidths.sno }} />
      <col style={{ width: chargeTableColWidths.chargeName }} />
      {Array.from({ length: 8 }).map((_, i) => (
        <col key={i} style={{ width: chargeTableColWidths.amount }} />
      ))}
    </colgroup>
  );

  const ledgerContentHeight = "min(520px, calc(100vh - 260px))";

  // Columns definition for MantineReactTable
  const columns = useMemo<MRT_ColumnDef<JobLedgerData>[]>(
    () => [
      // {
      //   accessorKey: "segment",
      //   header: "Segment",
      //   size: 100,
      //   enableColumnFilter: false,
      //   enableSorting: false,
      // },
      // {
      //   accessorKey: "job",
      //   header: "Job",
      //   size: 120,
      //   enableColumnFilter: false,
      //   enableSorting: false,
      // },
      {
        accessorKey: "sno",
        header: "S.No",
        size: 50,
        enableColumnFilter: false,
        enableSorting: false,
        mantineTableBodyCellProps: { style: { padding: "4px 8px" } },
        mantineTableHeadCellProps: { style: { padding: "6px 10px" } },
      },
      {
        accessorKey: "subjob",
        header: "HBL/HAWB No.",
        size: 120,
        minSize: 120,
        grow: false,
        enableColumnFilter: false,
        enableSorting: false,
        mantineTableBodyCellProps: { style: { padding: "4px 8px" } },
        mantineTableHeadCellProps: { style: { padding: "6px 10px" } },
      },
      {
        accessorKey: "documentType",
        header: "Daybook",
        size: 58,
        grow: false,
        enableColumnFilter: false,
        enableSorting: false,
        mantineTableBodyCellProps: { style: { padding: "4px 4px" } },
        mantineTableHeadCellProps: { style: { padding: "6px 4px" } },
      },
      // {
      //   accessorKey: "daybookName",
      //   header: "Daybook Name",
      //   size: 160,
      //   enableColumnFilter: false,
      //   enableSorting: false,
      // },
      {
        accessorKey: "documentNo",
        header: "Document number",
        size: 140,
        minSize: 140,
        grow: false,
        enableColumnFilter: false,
        enableSorting: false,
        Cell: ({ row, cell }) => {
          const value = cell.getValue<string>();
          if (!value) return "-";

          const link = (
            <Anchor
              component="button"
              type="button"
              size="sm"
              c={row.original.reversed ? "#B45309" : "#105476"}
              td="underline"
              fw={row.original.reversed ? 500 : 400}
              style={{ fontFamily: "Inter", cursor: "pointer" }}
              onClick={() => void handleDocumentNumberClick(value)}
            >
              {value}
            </Anchor>
          );

          if (!row.original.reversed) {
            return link;
          }

          return (
            <Tooltip label="This document is reversed" withArrow>
              {link}
            </Tooltip>
          );
        },
        mantineTableBodyCellProps: { style: { padding: "4px 8px" } },
        mantineTableHeadCellProps: { style: { padding: "6px 10px" } },
      },
      {
        accessorKey: "date",
        header: "Date",
        size: 105,
        enableColumnFilter: false,
        enableSorting: false,
        mantineTableBodyCellProps: { style: { padding: "4px 8px" } },
        mantineTableHeadCellProps: { style: { padding: "6px 10px" } },
      },
      {
        accessorKey: "partyName",
        header: "Party Name",
        size: 120,
        minSize: 100,
        maxSize: 140,
        grow: false,
        enableColumnFilter: false,
        enableSorting: false,
        Cell: ({ cell }) => {
          const value = cell.getValue<string>();
          if (!value) return "-";
          return (
            <Tooltip label={value} withArrow multiline maw={320}>
              <Text
                size="sm"
                truncate="end"
                style={{
                  fontFamily: "Inter",
                  display: "block",
                  maxWidth: "100%",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {value}
              </Text>
            </Tooltip>
          );
        },
        mantineTableBodyCellProps: {
          style: {
            padding: "4px 8px",
            maxWidth: 140,
            whiteSpace: "nowrap",
            overflow: "hidden",
          },
        },
        mantineTableHeadCellProps: { style: { padding: "6px 10px" } },
      },
      {
        accessorKey: "billingCurrencyCode",
        header: "Curr",
        size: 72,
        grow: false,
        enableColumnFilter: false,
        enableSorting: false,
        Cell: ({ cell }) => {
          const value = cell.getValue<string>();
          return value || "-";
        },
        mantineTableBodyCellProps: { style: { padding: "4px 4px" } },
        mantineTableHeadCellProps: { style: { padding: "6px 4px" } },
      },
      {
        accessorKey: "billingAmount",
        header: "Billing Amt",
        size: 72,
        grow: false,
        enableColumnFilter: false,
        enableSorting: false,
        Cell: ({ cell }) => {
          const value = cell.getValue<string>();
          return value || "-";
        },
        mantineTableBodyCellProps: { style: { padding: "4px 4px" } },
        mantineTableHeadCellProps: { style: { padding: "6px 4px" } },
      },
      {
        accessorKey: "debit",
        header: amountColumnLabel("Debit"),
        size: 70,
        grow: false,
        enableColumnFilter: false,
        enableSorting: false,
        Cell: ({ cell }) => {
          const value = cell.getValue<number>();
          return value > 0 ? formatMoneyAmountBound(value) : "-";
        },
        mantineTableBodyCellProps: {
          style: {
            backgroundColor: "#F8FAFC",
            padding: "4px 6px",
            textAlign: "center",
          },
        },
        mantineTableHeadCellProps: {
          style: {
            backgroundColor: "#F8FAFC",
            padding: "6px 6px",
            textAlign: "center",
          },
        },
      },
      {
        accessorKey: "credit",
        header: amountColumnLabel("Credit"),
        size: 88,
        grow: false,
        enableColumnFilter: false,
        enableSorting: false,
        Cell: ({ cell }) => {
          const value = cell.getValue<number>();
          return value > 0 ? formatMoneyAmountBound(value) : "-";
        },
        mantineTableBodyCellProps: {
          style: {
            backgroundColor: "#F8FAFC",
            padding: "4px 6px",
            textAlign: "center",
          },
        },
        mantineTableHeadCellProps: {
          style: {
            backgroundColor: "#F8FAFC",
            padding: "6px 6px",
            textAlign: "center",
          },
        },
      },
      {
        accessorKey: "revenue",
        header: amountColumnLabel("Revenue"),
        size: 88,
        grow: false,
        enableColumnFilter: false,
        enableSorting: false,
        Cell: ({ cell }) => {
          const value = cell.getValue<number>();
          return formatMoneyAmountBound(value);
        },
        mantineTableBodyCellProps: {
          style: {
            backgroundColor: "#F8FAFC",
            padding: "4px 6px",
            textAlign: "center",
          },
        },
        mantineTableHeadCellProps: {
          style: {
            backgroundColor: "#F8FAFC",
            padding: "6px 6px",
            textAlign: "center",
          },
        },
      },
      {
        accessorKey: "actualCost",
        header: amountColumnLabel("Actual Cost"),
        size: 92,
        grow: false,
        enableColumnFilter: false,
        enableSorting: false,
        Cell: ({ cell }) => {
          const value = cell.getValue<number>();
          return formatMoneyAmountBound(value);
        },
        mantineTableBodyCellProps: {
          style: {
            backgroundColor: "#F8FAFC",
            padding: "4px 6px",
            textAlign: "center",
          },
        },
        mantineTableHeadCellProps: {
          style: {
            backgroundColor: "#F8FAFC",
            padding: "6px 6px",
            textAlign: "center",
          },
        },
      },
      {
        accessorKey: "neutral",
        header: amountColumnLabel("Neutral"),
        size: 88,
        grow: false,
        enableColumnFilter: false,
        enableSorting: false,
        Cell: ({ cell }) => {
          const value = cell.getValue<number>();
          return formatMoneyAmountBound(value);
        },
        mantineTableBodyCellProps: {
          style: {
            backgroundColor: "#F8FAFC",
            padding: "4px 6px",
            textAlign: "center",
          },
        },
        mantineTableHeadCellProps: {
          style: {
            backgroundColor: "#F8FAFC",
            padding: "6px 6px",
            textAlign: "center",
          },
        },
      },
    ],
    [amountColumnLabel, handleDocumentNumberClick],
  );

  const tableMinWidth = useMemo(
    () => columns.reduce((total, col) => total + (col.size ?? 0), 0),
    [columns],
  );

  // Create table instance
  const table = useMantineReactTable({
    columns,
    data: tableData,
    enableColumnFilters: false,
    enablePagination: false,
    enableTopToolbar: false,
    enableBottomToolbar: false,
    enableColumnActions: false,
    enableSorting: false,
    enableColumnPinning: false,
    enableStickyHeader: true,
    layoutMode: "grid",
    mantineTableProps: {
      striped: false,
      highlightOnHover: true,
      withTableBorder: false,
      withColumnBorders: false,
      style: { width: "100%", minWidth: tableMinWidth },
    },
    mantinePaperProps: {
      shadow: "sm",
      p: "xs",
      radius: "md",
      style: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        maxHeight: "100%",
        overflow: "hidden",
      },
    },
    mantineTableBodyCellProps: {
      style: {
        width: "fit-content",
        padding: "4px 8px",
        fontSize: "14px",
        fontFamily: "Inter",
        color: "#334155",
        backgroundColor: "#ffffff",
      },
    },
    mantineTableBodyRowProps: {
      style: {
        height: "40px",
      },
    },
    mantineTableHeadCellProps: {
      style: {
        width: "fit-content",
        padding: "6px 12px",
        fontSize: "14px",
        fontFamily: "Inter",
        color: "#1E293B",
        backgroundColor: "#F8FAFC",
        borderBottom: "1px solid #F3F3F3",
        top: 0,
        zIndex: 3,
      },
    },
    mantineTableContainerProps: {
      style: {
        height: "100%",
        flexGrow: 1,
        minHeight: 0,
        position: "relative",
        overflow: "auto",
        maxWidth: "100%",
      },
    },
    renderEmptyRowsFallback: () => (
      <tr>
        <td colSpan={columns.length}>
          <Box py="xl" ta="center">
            <Stack align="center" gap="md">
              <Text c="dimmed" style={{ fontFamily: "Inter, sans-serif" }}>
                No data to display
              </Text>
            </Stack>
          </Box>
        </td>
      </tr>
    ),
  });

  return (
    <Box p="md" style={{ position: "relative" }}>
      {documentNavLoading && (
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
            <Text size="sm" c="dimmed" style={{ fontFamily: "Inter" }}>
              Opening document...
            </Text>
          </Stack>
        </Box>
      )}

      <Modal
        opened={documentSearchModalOpen}
        onClose={() => {
          setDocumentSearchModalOpen(false);
          setDocumentSearchResults([]);
        }}
        title="Select document"
        centered
      >
        <Stack gap="xs">
          {documentSearchResults.map((item) => {
            const key = `${item.module}-${item.sub_module ?? ""}-${item.id}`;
            const label =
              item.display_id ??
              item.primary_code ??
              item.id ??
              "Unknown document";
            return (
              <UnstyledButton
                key={key}
                onClick={() => void handleDocumentSearchResultPick(item)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #E2E8F0",
                  textAlign: "left",
                }}
              >
                <Text size="sm" fw={600} style={{ fontFamily: "Inter" }}>
                  {label}
                </Text>
                <Text size="xs" c="dimmed" style={{ fontFamily: "Inter" }}>
                  {[item.module, item.sub_module].filter(Boolean).join(" / ")}
                </Text>
              </UnstyledButton>
            );
          })}
        </Stack>
      </Modal>
      {/* Header */}
      {/* <Paper shadow="xs" p="lg" mb="md" withBorder> */}
      {/* <Group justify="space-between" mb="md">
          <Text size="lg" fw={600} c="#105476">
            Job Ledger
          </Text>
          <Group>
            <Button
              variant={showFilters ? "filled" : "outline"}
              leftSection={<IconFilter size={16} />}
              size="sm"
              onClick={toggleFilters}
              styles={{
                root: {
                  backgroundColor: showFilters ? "#105476" : "transparent",
                  borderRadius: "4px",
                  color: showFilters ? "white" : "#105476",
                  fontSize: "14px",
                  fontFamily: "Inter",
                  fontStyle: "semibold",
                  border: "1px solid #105476",
                  "&:hover": {
                    backgroundColor: showFilters ? "#105476" : "#E0F5FF",
                  },
                },
              }}
            >
              {/* Filters */}
      {/* </Button> */}
      {/* <Button
              variant="outline"
              size="sm"
              leftSection={<IconDownload size={16} />}
            >
              Export
            </Button> */}
      {/* </Group>
        </Group> */}

      {/* Filter Section */}
      {/* {showFilters && (
          <Box
            tt="capitalize"
            mb="sm"
            p="sm"
            style={{
              backgroundColor: "#F8F9FA",
              borderRadius: "8px",
              border: "1px solid #E9ECEF",
            }}
          >
            <Group justify="space-between" mb="xs">
              <Text
                size="sm"
                fw={600}
                c="#1E293B"
                style={{ fontFamily: "Inter", fontSize: "14px" }}
              >
                Filter
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

            <Grid gutter="sm" px="md" pt="xs" pb="sm">
              <Grid.Col span={2}>
                <TextInput
                  label="Segment Code"
                  placeholder="Enter Segment Code"
                  size="xs"
                  value={filters.segmentCode || ""}
                  onChange={(e) =>
                    updateFilter("segmentCode", e.target.value || null)
                  }
                />
              </Grid.Col>

              <Grid.Col span={2}>
                <TextInput
                  label="Job No"
                  placeholder="Enter Job No"
                  size="xs"
                  value={filters.jobNo || ""}
                  onChange={(e) =>
                    updateFilter("jobNo", e.target.value || null)
                  }
                />
              </Grid.Col>

              <Grid.Col span={2}>
                <TextInput
                  label="Location"
                  placeholder="Enter Location"
                  size="xs"
                  value={filters.location || ""}
                  onChange={(e) =>
                    updateFilter("location", e.target.value || null)
                  }
                />
              </Grid.Col>

              <Grid.Col span={2}>
                <TextInput
                  label="Subjob No"
                  placeholder="Enter Subjob No"
                  size="xs"
                  value={filters.subjobNo || ""}
                  onChange={(e) =>
                    updateFilter("subjobNo", e.target.value || null)
                  }
                />
              </Grid.Col>

              <Grid.Col span={2}>
                <TextInput
                  label="HBL/HAWB No."
                  placeholder="Enter HBL/HAWB No"
                  size="xs"
                  value={filters.hbl_hawb_no || ""}
                  onChange={(e) =>
                    updateFilter("hbl_hawb_no", e.target.value || null)
                  }
                />
              </Grid.Col>

              <Grid.Col span={2}>
                <Select
                  label="With Auto Entry"
                  placeholder="Select option"
                  size="xs"
                  data={[
                    { value: "yes", label: "Yes" },
                    { value: "no", label: "No" },
                  ]}
                  value={filters.withAutoEntry}
                  onChange={updateFilter.bind(null, "withAutoEntry")}
                />
              </Grid.Col>

              <Grid.Col span={2}>
                <Select
                  label="Status"
                  placeholder="Select status"
                  size="xs"
                  data={[
                    { value: "paid", label: "Paid" },
                    { value: "pending", label: "Pending" },
                    { value: "completed", label: "Completed" },
                    { value: "cancelled", label: "Cancelled" },
                  ]}
                  value={filters.status}
                  onChange={updateFilter.bind(null, "status")}
                />
              </Grid.Col>

              <Grid.Col span={4}>
                <Group gap="sm" mt="lg">
                  <Button
                    size="xs"
                    onClick={clearAllFilters}
                    variant="outline"
                    style={{
                      borderColor: "#105476",
                      color: "#105476",
                      fontSize: "12px",
                      fontFamily: "Inter",
                    }}
                  >
                    Clear
                  </Button>
                  <Button
                    size="xs"
                    onClick={handleApplyFilters}
                    variant="filled"
                    style={{
                      backgroundColor: "#105476",
                      color: "white",
                      fontSize: "12px",
                      fontFamily: "Inter",
                      "&:hover": {
                        backgroundColor: "#0d3a5a",
                      },
                    }}
                  >
                    Apply
                  </Button>
                </Group>
              </Grid.Col>
            </Grid>
          </Box>
        )} */}

      {/* Filter Section */}
      {/* <Grid> */}
      {/* <Grid.Col span={3}>
            <TextInput
              placeholder="Search..."
              leftSection={<IconSearch size={16} />}
              value={searchValue}
              onChange={(event) => setSearchValue(event.currentTarget.value)}
            />
          </Grid.Col> */}
      {/* <Grid.Col span={2}>
            <Select
              placeholder="Filter Type"
              data={[
                { value: "all", label: "All Types" },
                { value: "invoice", label: "Invoice" },
                { value: "receipt", label: "Receipt" },
                { value: "journal", label: "Journal" },
              ]}
              value={filterType}
              onChange={setFilterType}
            />
          </Grid.Col>
          <Grid.Col span={2}>
            <Select
              placeholder="Filter Status"
              data={[
                { value: "all", label: "All Status" },
                { value: "paid", label: "Paid" },
                { value: "pending", label: "Pending" },
                { value: "completed", label: "Completed" },
              ]}
              value={filterStatus}
              onChange={setFilterStatus}
            />
          </Grid.Col>
          <Grid.Col span={2}>
            <Button
              variant="outline"
              leftSection={<IconFilter size={16} />}
              fullWidth
            >
              Apply Filters
            </Button>
          </Grid.Col> */}
      {/* </Grid> */}
      {/* </Paper> */}

      {/* Tabs Section */}
      <Paper shadow="xs" p="lg" mb="md" withBorder>
        <Group justify="space-between" mb="md">
          <Text size="lg" fw={600} c="#105476">
            Job Ledger
          </Text>
          <Group gap="md">
            <Group gap={6} wrap="nowrap">
              <Text
                size="lg"
                fw={600}
                c="#105476"
                style={{ fontFamily: "Inter" }}
              >
                Segment:
              </Text>
              <Text size="lg" c="dimmed" style={{ fontFamily: "Inter" }}>
                {navState?.service_name}
              </Text>
            </Group>
            <Group gap={6} wrap="nowrap">
              <Text
                size="lg"
                fw={600}
                c="#105476"
                style={{ fontFamily: "Inter" }}
              >
                Job:
              </Text>
              <Text size="lg" c="dimmed" style={{ fontFamily: "Inter" }}>
                {jobLedgerJobLabel || filters.jobNo || "-"}
              </Text>
            </Group>
            <Button
              variant={showFilters ? "filled" : "outline"}
              leftSection={<IconFilter size={16} />}
              size="sm"
              onClick={toggleFilters}
              styles={{
                root: {
                  backgroundColor: showFilters ? "#105476" : "transparent",
                  borderRadius: "4px",
                  color: showFilters ? "white" : "#105476",
                  fontSize: "14px",
                  fontFamily: "Inter",
                  fontStyle: "semibold",
                  border: "1px solid #105476",
                  "&:hover": {
                    backgroundColor: showFilters ? "#105476" : "#E0F5FF",
                  },
                },
              }}
            >
              {/* Filters */}
            </Button>
            <Menu
              withinPortal
              position="bottom-end"
              shadow="md"
              width={220}
            >
              <Menu.Target>
                <ActionIcon
                  variant="outline"
                  size="lg"
                  aria-label="Job ledger actions"
                  styles={{
                    root: {
                      borderRadius: "4px",
                      color: "#105476",
                      border: "1px solid #105476",
                      "&:hover": {
                        backgroundColor: "#E0F5FF",
                      },
                    },
                  }}
                >
                  <IconDotsVertical size={18} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
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
                  onClick={() => void handleJobCostSheet()}
                  disabled={costSheetLoading}
                >
                  Job Cost Sheet
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
            <Button
              variant="outline"
              size="sm"
              leftSection={<IconChevronLeft size={16} />}
              onClick={handleBack}
              styles={{
                root: {
                  borderRadius: "4px",
                  color: "#105476",
                  fontSize: "14px",
                  fontFamily: "Inter",
                  fontStyle: "semibold",
                  border: "1px solid #105476",
                  "&:hover": {
                    backgroundColor: "#E0F5FF",
                  },
                },
              }}
            >
              Back
            </Button>
            {/* <Button
              variant="outline"
              size="sm"
              leftSection={<IconDownload size={16} />}
            >
              Export
            </Button> */}
          </Group>
        </Group>

        {/* Filter Section */}
        {showFilters && (
          <Box
            tt="capitalize"
            mb="sm"
            p="sm"
            style={{
              backgroundColor: "#F8F9FA",
              borderRadius: "8px",
              border: "1px solid #E9ECEF",
            }}
          >
            <Group justify="space-between" mb="xs">
              <Text
                size="sm"
                fw={600}
                c="#1E293B"
                style={{ fontFamily: "Inter", fontSize: "14px" }}
              >
                Filter
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

            <Grid gutter="sm" px="md" pt="xs" pb="sm">
              <Grid.Col span={2}>
                <Select
                  label="Segment Code"
                  placeholder="Select Segment Code"
                  size="xs"
                  searchable
                  clearable
                  data={segmentOptions}
                  value={filters.segmentCode || ""}
                  onChange={(value) =>
                    updateFilter("segmentCode", value || null)
                  }
                  disabled={segmentOptionsLoading}
                  rightSection={
                    segmentOptionsLoading ? <Loader size={14} /> : undefined
                  }
                />
              </Grid.Col>

              <Grid.Col span={2}>
                <TextInput
                  label="Job No"
                  placeholder="Enter Job No"
                  size="xs"
                  value={filters.jobNo || ""}
                  onChange={(e) =>
                    updateFilter("jobNo", e.target.value || null)
                  }
                />
              </Grid.Col>

              <Grid.Col span={2}>
                <TextInput
                  label="Location"
                  placeholder="Enter Location"
                  size="xs"
                  value={filters.location || ""}
                  onChange={(e) =>
                    updateFilter("location", e.target.value || null)
                  }
                />
              </Grid.Col>

              {/* <Grid.Col span={2}>
                <TextInput
                  label="Subjob No"
                  placeholder="Enter Subjob No"
                  size="xs"
                  value={filters.subjobNo || ""}
                  onChange={(e) =>
                    updateFilter("subjobNo", e.target.value || null)
                  }
                />
              </Grid.Col> */}

              <Grid.Col span={2}>
                <TextInput
                  label="HBL/HAWB No."
                  placeholder="Enter HBL/HAWB No"
                  size="xs"
                  value={filters.hbl_hawb_no || ""}
                  onChange={(e) =>
                    updateFilter("hbl_hawb_no", e.target.value || null)
                  }
                />
              </Grid.Col>

              {/* <Grid.Col span={2}>
                <Select
                  label="With Auto Entry"
                  placeholder="Select option"
                  size="xs"
                  data={[
                    { value: "yes", label: "Yes" },
                    { value: "no", label: "No" },
                  ]}
                  value={filters.withAutoEntry}
                  onChange={updateFilter.bind(null, "withAutoEntry")}
                />
              </Grid.Col> */}

              {/* <Grid.Col span={2}>
                <Select
                  label="Status"
                  placeholder="Select status"
                  size="xs"
                  data={[
                    { value: "paid", label: "Paid" },
                    { value: "pending", label: "Pending" },
                    { value: "completed", label: "Completed" },
                    { value: "cancelled", label: "Cancelled" },
                  ]}
                  value={filters.status}
                  onChange={updateFilter.bind(null, "status")}
                />
              </Grid.Col> */}

              <Grid.Col span={4}>
                <Group gap="sm" mt="lg">
                  <Button
                    size="xs"
                    onClick={clearAllFilters}
                    variant="outline"
                    style={{
                      borderColor: "#105476",
                      color: "#105476",
                      fontSize: "12px",
                      fontFamily: "Inter",
                    }}
                  >
                    Clear
                  </Button>
                  <Button
                    size="xs"
                    onClick={handleApplyFilters}
                    variant="filled"
                    style={{
                      backgroundColor: "#105476",
                      color: "white",
                      fontSize: "12px",
                      fontFamily: "Inter",
                      "&:hover": {
                        backgroundColor: "#0d3a5a",
                      },
                    }}
                  >
                    Apply
                  </Button>
                </Group>
              </Grid.Col>
            </Grid>
          </Box>
        )}
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="document">Document Wise</Tabs.Tab>
            <Tabs.Tab value="charge">Charge Wise</Tabs.Tab>
            <Tabs.Tab value="links">Links</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="document" pt="md">
            {/* Document Wise Content */}
            <Box
              style={{
                height: ledgerContentHeight,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              {/* Table */}
              <Box
                style={{
                  position: "relative",
                  flex: 1,
                  minHeight: 0,
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                }}
              >
                {jobLedgerLoading && (
                  <Box
                    style={{
                      position: "absolute",
                      inset: 0,
                      zIndex: 5,
                      background: "rgba(255,255,255,0.6)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Loader size="md" color="#105476" />
                  </Box>
                )}
                <MantineReactTable table={table} />
              </Box>

              {/* Totals Section */}
              <Divider my="xs" />
              {jobLedgerLoading && (
                <Text size="sm" c="dimmed" mb="xs">
                  Loading job ledger...
                </Text>
              )}
              {jobLedgerError && (
                <Text size="sm" c="red" mb="xs">
                  {jobLedgerError}
                </Text>
              )}
              <Box style={{ flexShrink: 0, paddingTop: 4, paddingBottom: 2 }}>
                <Grid gutter="xs">
                  <Grid.Col span={{ base: 12, sm: 6, md: 2 }}>
                    <Stack gap={0}>
                      <Text size="sm" c="dimmed">
                        {amountColumnLabel("Total Debit")}
                      </Text>
                      <Text size="lg" fw={600}>
                        {formatMoneyAmountBound(totals.totalDebit)}
                      </Text>
                    </Stack>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6, md: 2 }}>
                    <Stack gap={0}>
                      <Text size="sm" c="dimmed">
                        {amountColumnLabel("Total Credit")}
                      </Text>
                      <Text size="lg" fw={600}>
                        {formatMoneyAmountBound(totals.totalCredit)}
                      </Text>
                    </Stack>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6, md: 2 }}>
                    <Stack gap={0}>
                      <Text size="sm" c="dimmed">
                        {amountColumnLabel("Total Revenue")}
                      </Text>
                      <Text size="lg" fw={600}>
                        {formatMoneyAmountBound(totals.totalRevenue)}
                      </Text>
                    </Stack>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6, md: 2 }}>
                    <Stack gap={0}>
                      <Text size="sm" c="dimmed">
                        {amountColumnLabel("Total Actual Cost")}
                      </Text>
                      <Text size="lg" fw={600}>
                        {formatMoneyAmountBound(totals.totalActualCost)}
                      </Text>
                    </Stack>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6, md: 2 }}>
                    <Stack gap={0}>
                      <Text size="sm" c="dimmed">
                        Gross Profit
                      </Text>
                      <Text size="lg" fw={600}>
                        {formatMoneyAmountBound(totals.grossProfit)}
                      </Text>
                    </Stack>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6, md: 2 }}>
                    <Stack gap={0}>
                      <Text size="sm" c="dimmed">
                        {amountColumnLabel("Total Neutral")}
                      </Text>
                      <Text size="lg" fw={600} c="#105476">
                        {formatMoneyAmountBound(totals.totalNeutral)}
                      </Text>
                    </Stack>
                  </Grid.Col>
                </Grid>
              </Box>
            </Box>
          </Tabs.Panel>

          <Tabs.Panel value="charge" pt="md">
            <Box
              style={{
                height: ledgerContentHeight,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              <Box
                style={{
                  position: "relative",
                  flex: 1,
                  minHeight: 0,
                  overflow: "auto",
                }}
              >
                {chargeLoading && (
                  <Box
                    style={{
                      position: "absolute",
                      inset: 0,
                      zIndex: 5,
                      background: "rgba(255,255,255,0.6)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Loader size="md" color="#105476" />
                  </Box>
                )}

                {chargeError && (
                  <Text size="sm" c="red" mb="sm" px="xs">
                    {chargeError}
                  </Text>
                )}

                <table
                  style={{
                    width: "100%",
                    minWidth: chargeTableMinWidth,
                    borderCollapse: "collapse",
                    tableLayout: "fixed",
                  }}
                >
                  {renderChargeTableColGroup()}
                  <thead>
                    <tr>
                      <th
                        rowSpan={2}
                        style={{
                          ...chargeTableHeaderStyle,
                          position: "sticky",
                          top: 0,
                          zIndex: 3,
                        }}
                      >
                        S.No
                      </th>
                      <th
                        rowSpan={2}
                        style={{
                          ...chargeTableHeaderStyle,
                          textAlign: "left",
                          position: "sticky",
                          top: 0,
                          zIndex: 3,
                          whiteSpace: "normal",
                          lineHeight: 1.2,
                          fontSize: "13px",
                          overflow: "hidden",
                          wordBreak: "break-word",
                        }}
                      >
                        Charge Name
                      </th>
                      <th
                        colSpan={2}
                        style={{
                          ...chargeTableGroupHeaderStyle,
                          ...chargeTableSectionStartStyle,
                          position: "sticky",
                          top: 0,
                          zIndex: 3,
                        }}
                      >
                        Amount
                      </th>
                      <th
                        colSpan={3}
                        style={{
                          ...chargeTableGroupHeaderStyle,
                          ...chargeTableSectionStartStyle,
                          position: "sticky",
                          top: 0,
                          zIndex: 3,
                        }}
                      >
                        Provisional
                      </th>
                      <th
                        colSpan={3}
                        style={{
                          ...chargeTableGroupHeaderStyle,
                          ...chargeTableSectionStartStyle,
                          position: "sticky",
                          top: 0,
                          zIndex: 3,
                        }}
                      >
                        Actual
                      </th>
                    </tr>
                    <tr>
                      <th
                        style={{
                          ...chargeTableHeaderStyle,
                          ...chargeTableSectionStartStyle,
                          position: "sticky",
                          top: 34,
                          zIndex: 3,
                          fontSize: "12px",
                          whiteSpace: "normal",
                          lineHeight: 1.2,
                        }}
                      >
                        {amountColumnLabel("Debit")}
                      </th>
                      <th
                        style={{
                          ...chargeTableHeaderStyle,
                          position: "sticky",
                          top: 34,
                          zIndex: 3,
                          fontSize: "12px",
                          whiteSpace: "normal",
                          lineHeight: 1.2,
                        }}
                      >
                        {amountColumnLabel("Credit")}
                      </th>
                      <th
                        style={{
                          ...chargeTableHeaderStyle,
                          ...chargeTableSectionStartStyle,
                          position: "sticky",
                          top: 34,
                          zIndex: 3,
                          fontSize: "12px",
                          whiteSpace: "normal",
                          lineHeight: 1.2,
                        }}
                      >
                        {amountColumnLabel("Revenue")}
                      </th>
                      <th
                        style={{
                          ...chargeTableHeaderStyle,
                          position: "sticky",
                          top: 34,
                          zIndex: 3,
                          fontSize: "12px",
                          whiteSpace: "normal",
                          lineHeight: 1.2,
                        }}
                      >
                        {amountColumnLabel("Cost")}
                      </th>
                      <th
                        style={{
                          ...chargeTableHeaderStyle,
                          position: "sticky",
                          top: 34,
                          zIndex: 3,
                          fontSize: "12px",
                          whiteSpace: "normal",
                          lineHeight: 1.2,
                        }}
                      >
                        {amountColumnLabel("Neutral")}
                      </th>
                      <th
                        style={{
                          ...chargeTableHeaderStyle,
                          ...chargeTableSectionStartStyle,
                          position: "sticky",
                          top: 34,
                          zIndex: 3,
                          fontSize: "12px",
                          whiteSpace: "normal",
                          lineHeight: 1.2,
                        }}
                      >
                        {amountColumnLabel("Revenue")}
                      </th>
                      <th
                        style={{
                          ...chargeTableHeaderStyle,
                          position: "sticky",
                          top: 34,
                          zIndex: 3,
                          fontSize: "12px",
                          whiteSpace: "normal",
                          lineHeight: 1.2,
                        }}
                      >
                        {amountColumnLabel("Cost")}
                      </th>
                      <th
                        style={{
                          ...chargeTableHeaderStyle,
                          position: "sticky",
                          top: 34,
                          zIndex: 3,
                          fontSize: "12px",
                          whiteSpace: "normal",
                          lineHeight: 1.2,
                        }}
                      >
                        {amountColumnLabel("Neutral")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {chargeTableData.length === 0 && !chargeLoading ? (
                      <tr>
                        <td
                          colSpan={chargeTableColumnCount}
                          style={{
                            ...chargeTableCellStyle,
                            textAlign: "center",
                            padding: "32px 8px",
                          }}
                        >
                          <Text c="dimmed" style={{ fontFamily: "Inter" }}>
                            No data to display
                          </Text>
                        </td>
                      </tr>
                    ) : (
                      chargeTableData.map((row) => (
                        <tr key={row.id}>
                          <td
                            style={{
                              ...chargeTableCellStyle,
                              textAlign: "center",
                            }}
                          >
                            {row.sno}
                          </td>
                          <td
                            style={{
                              ...chargeTableCellStyle,
                              textAlign: "left",
                              overflow: "hidden",
                            }}
                          >
                            <Tooltip
                              label={row.chargeName}
                              withArrow
                              multiline
                              maw={320}
                              disabled={!row.chargeName}
                            >
                              <Text
                                size="sm"
                                truncate="end"
                                style={{
                                  fontFamily: "Inter",
                                  display: "block",
                                  maxWidth: "100%",
                                }}
                              >
                                {row.chargeName || "-"}
                              </Text>
                            </Tooltip>
                          </td>
                          <td
                            style={withChargeSectionStart(
                              chargeTableAmountCellStyle,
                            )}
                          >
                            {row.debit}
                          </td>
                          <td style={chargeTableAmountCellStyle}>
                            {row.credit}
                          </td>
                          <td
                            style={withChargeSectionStart(
                              chargeTableAmountCellStyle,
                            )}
                          >
                            {row.provisionalRevenue}
                          </td>
                          <td style={chargeTableAmountCellStyle}>
                            {row.provisionalCost}
                          </td>
                          <td style={chargeTableAmountCellStyle}>
                            {row.provisionalNeutral}
                          </td>
                          <td
                            style={withChargeSectionStart(
                              chargeTableAmountCellStyle,
                            )}
                          >
                            {row.actualRevenue}
                          </td>
                          <td style={chargeTableAmountCellStyle}>
                            {row.actualCost}
                          </td>
                          <td style={chargeTableAmountCellStyle}>
                            {row.actualNeutral}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </Box>

              {chargeTableData.length > 0 && (
                <Box
                  style={{
                    flexShrink: 0,
                    borderTop: "1px solid #CBD5E1",
                    backgroundColor: "#F8FAFC",
                    overflowX: "auto",
                  }}
                >
                  <table
                    style={{
                      width: "100%",
                      minWidth: chargeTableMinWidth,
                      borderCollapse: "collapse",
                      tableLayout: "fixed",
                    }}
                  >
                    {renderChargeTableColGroup()}
                    <tbody>
                      <tr>
                        <td
                          colSpan={2}
                          style={{
                            ...chargeTableFooterLabelStyle,
                            textAlign: "left",
                          }}
                        >
                          Total
                        </td>
                        <td style={chargeTableFooterAmountStyle}>
                          {chargeTotals.totalDebit}
                        </td>
                        <td style={chargeTableFooterAmountStyle}>
                          {chargeTotals.totalCredit}
                        </td>
                        <td style={chargeTableFooterAmountStyle}>
                          {chargeTotals.provisionalRevenue}
                        </td>
                        <td style={chargeTableFooterAmountStyle}>
                          {chargeTotals.provisionalCost}
                        </td>
                        <td style={chargeTableFooterAmountStyle}>
                          {chargeTotals.provisionalNeutral}
                        </td>
                        <td style={chargeTableFooterAmountStyle}>
                          {chargeTotals.actualRevenue}
                        </td>
                        <td style={chargeTableFooterAmountStyle}>
                          {chargeTotals.actualCost}
                        </td>
                        <td style={chargeTableFooterAmountStyle}>
                          {chargeTotals.actualNeutral}
                        </td>
                      </tr>
                      <tr>
                        <td
                          colSpan={2}
                          style={{
                            ...chargeTableFooterLabelStyle,
                            textAlign: "left",
                          }}
                        >
                          Profit (Credit-Debit)
                        </td>
                        <td style={chargeTableFooterAmountStyle}>
                          {chargeTotals.netProfitCreditDebit}
                        </td>
                        <td style={chargeTableFooterAmountStyle} />
                        <td colSpan={6} style={chargeTableFooterAmountStyle} />
                      </tr>
                    </tbody>
                  </table>
                </Box>
              )}
            </Box>
          </Tabs.Panel>

          <Tabs.Panel value="links" pt="md">
            <Text c="dimmed">Links View - To be implemented</Text>
          </Tabs.Panel>
        </Tabs>
      </Paper>

      <Modal
        opened={costSheetPreviewOpen}
        onClose={handleCloseCostSheetPreview}
        title={
          <Text size="lg" fw={600} c="#105476">
            Job Cost Sheet
          </Text>
        }
        centered
        size="95%"
        overlayProps={{
          backgroundOpacity: 0.55,
          blur: 3,
        }}
        styles={{
          content: {
            minHeight: "90vh",
            maxWidth: "1200px",
          },
          body: {
            padding: 0,
            height: "100%",
          },
        }}
      >
        <Stack h="82vh">
          {costSheetPdfUrl ? (
            <>
              <iframe
                src={costSheetPdfUrl}
                style={{
                  width: "100%",
                  height: "100%",
                  border: "none",
                  borderRadius: "8px",
                }}
                title="Job Cost Sheet PDF Preview"
              />
              <Group
                justify="flex-end"
                p="md"
                style={{ borderTop: "1px solid #e9ecef" }}
              >
                <Button
                  variant="outline"
                  onClick={handleCloseCostSheetPreview}
                  leftSection={<IconX size={16} />}
                >
                  Close
                </Button>
                <Button
                  onClick={handleDownloadCostSheetPdf}
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
                <Text c="dimmed">
                  {costSheetLoading
                    ? "Generating Job Cost Sheet preview..."
                    : "No PDF available"}
                </Text>
              </Stack>
            </Center>
          )}
        </Stack>
      </Modal>
    </Box>
  );
};

export default JobLedger;
