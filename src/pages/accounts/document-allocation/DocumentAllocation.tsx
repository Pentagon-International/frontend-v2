import { useState, useEffect, useRef, useMemo } from "react";
import {
  Box,
  Button,
  Badge,
  Card,
  Checkbox,
  Center,
  Flex,
  Grid,
  Group,
  Loader,
  Modal,
  Text,
} from "@mantine/core";
import { IconSearch, IconTrash } from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import EditPageHeadingRow from "../../../components/EditPageHeadingRow";
import { mergeEditPageAuditSources, appendEditPageAuditPatch } from "../../../utils/editPageAuditInfo";
import { URL } from "../../../api/serverUrls";
import { API_HEADER } from "../../../store/storeKeys";
import { postAPICall } from "../../../service/postApiCall";
import { putAPICall } from "../../../service/putApiCall";
import { commonSearchAPI } from "../../../service/searchApi";
import {
  SearchableSelect,
  SingleDateInput,
  ToastNotification,
} from "../../../components";
import FormTextInput from "../../../components/FormTextInput";
import { ROE_DECIMAL_PLACES } from "../../../utils/exchangeRateRoe";
import { useCanPostDocuments } from "../../../hooks/useCanPostDocuments";

type CoaItem = {
  id?: number;
  gl_account_code?: string;
  sl_code?: string;
  account_name?: string;
};

type DocumentAllocationRow = {
  id?: number;
  branch_code?: string | null;
  day_book_id?: number | null;
  day_book_code?: string | null;
  day_book_name?: string | null; // fallback for older response
  document_type?: string | null;
  day_book_document_type?: string | null; // fallback for older response
  document_no?: string | null;
  document_date?: string | null;
  currency_id?: number | null;
  currency_code?: string | null;
  roe?: string | null;
  document_amount?: string | null;
  outstanding_amount?: string | null;
  outstanding_local_amount?: string | null;
  // fallbacks (older response)
  amount?: string | null;
  amount_in_local?: string | null;
  Dr_Cr?: string | null;
};

type DocumentAllocationResponse = {
  data?: DocumentAllocationRow[];
};

type AllocationDocumentsHeader = {
  id?: number;
  status?: string; // normalized from backend document_status
  account_code?: string;
  subledger_code?: string;
  allocation_date?: string;
  allocation_no?: string;
  allocation?: DocumentAllocationRow[];
};

type AllocationDocumentsApiResponse = {
  status?: boolean;
  message?: string;
  data?: {
    id?: number;
    document_status?: string;
    account_code?: string;
    subledger_code?: string;
    allocation_date?: string;
    allocation_no?: string;
    allocation?: DocumentAllocationRow[];
  };
};

/** Editable field styling (aligned with PipelineCreate SearchableSelect / TextInput) */
const fieldInputStyles = {
  input: {
    fontSize: "13px",
    fontFamily: "Inter",
    height: "36px",
  },
};

/** Read-only display fields (aligned with PipelineCreate profile readOnly TextInput) */
const readOnlyInputStyles = {
  input: {
    fontSize: "13px",
    fontFamily: "Inter",
    height: "36px",
    backgroundColor: "#f8f9fa",
    cursor: "not-allowed",
  },
};

const parseDecimal = (value: string): number | null => {
  const cleaned = value.replace(/,/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

const formatFixed = (value: number | null, decimals: number): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  return value.toFixed(decimals);
};

const formatTwoDecimalsFromString = (
  value: string | null | undefined,
): string => {
  const n = parseDecimal(String(value ?? ""));
  return n == null ? "" : formatFixed(n, 2);
};

const formatDateForApi = (date: Date | null): string => {
  if (!date) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

type AllocationDocumentNavRow = {
  id: number;
  account_name?: string;
  account_code?: string;
  subledger_code?: string;
  allocation_no?: string;
  allocation_date?: string;
  document_status?: string;
  allocation?: DocumentAllocationRow[];
};

const parseAllocationDateString = (s: string | null | undefined): Date | null => {
  if (!s || typeof s !== "string") return null;
  const part = s.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(part)) return null;
  const [y, m, d] = part.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const normalizeAllocationLine = (r: DocumentAllocationRow): DocumentAllocationRow => {
  const outAmt = r.outstanding_amount ?? r.amount ?? "";
  const outLocal =
    r.outstanding_local_amount ?? r.amount_in_local ?? "";
  return {
    ...r,
    outstanding_amount: outAmt,
    outstanding_local_amount: outLocal,
    amount: r.amount ?? outAmt,
    amount_in_local: r.amount_in_local ?? outLocal,
  };
};

const fetchCoaAccount = async (
  accountCode: string,
): Promise<CoaItem | null> => {
  try {
    const results = await commonSearchAPI({
      endpoint: URL.chartOfAccounts,
      query: accountCode,
    });
    if (!Array.isArray(results) || results.length === 0) return null;
    const match =
      (results as Record<string, unknown>[]).find(
        (item) => String(item.gl_account_code ?? "") === accountCode,
      ) ?? results[0];
    if (!match) return null;
    return {
      id: match.id != null ? Number(match.id) : undefined,
      gl_account_code:
        match.gl_account_code != null ? String(match.gl_account_code) : undefined,
      sl_code: match.sl_code != null ? String(match.sl_code) : undefined,
      account_name:
        match.account_name != null ? String(match.account_name) : undefined,
    };
  } catch {
    return null;
  }
};

const fetchAllocationDocumentFromApi = async (
  row: AllocationDocumentNavRow,
): Promise<{
  id?: number;
  document_status?: string;
  account_code?: string;
  subledger_code?: string;
  account_name?: string;
  allocation_date?: string;
  allocation_no?: string;
  allocation?: DocumentAllocationRow[];
} | null> => {
  const tryPost = async (filters: Record<string, unknown>) => {
    const axiosRes = (await postAPICall(
      `${URL.outstandingAllocationDocumentsFilter}?index=0&limit=1`,
      { filters },
      API_HEADER,
    )) as {
      data?: {
        data?: Array<{
          id?: number;
          document_status?: string;
          account_code?: string;
          subledger_code?: string;
          account_name?: string;
          allocation_date?: string;
          allocation_no?: string;
          allocation?: DocumentAllocationRow[];
        }>;
      };
    };
    const body = axiosRes?.data;
    const rows = Array.isArray(body?.data)
      ? body.data
      : Array.isArray(body)
        ? body
        : [];
    const first = rows[0] ?? null;
    return first ?? null;
  };

  let doc = await tryPost({ id: row.id });
  if (
    !doc &&
    row.account_code &&
    row.subledger_code &&
    row.allocation_date
  ) {
    doc = await tryPost({
      account_code: row.account_code,
      subledger_code: row.subledger_code,
      allocation_date: row.allocation_date,
    });
  }
  return doc;
};

const fetchDocumentAllocation = async (payload: {
  account_code: string;
  subledger_code?: string;
  /** Optional filter; omitted when user leaves date empty */
  document_date?: string;
}): Promise<DocumentAllocationResponse> => {
  try {
    const response = await postAPICall(
      URL.outstandingAllocations,
      payload,
      API_HEADER,
    );
    return (response as DocumentAllocationResponse) ?? {};
  } catch (error) {
    console.error("Error fetching document allocation:", error);
    throw error;
  }
};

const createAllocationDocuments = async (
  payload: Record<string, unknown>,
): Promise<AllocationDocumentsHeader> => {
  try {
    const response = await postAPICall(
      URL.outstandingAllocationDocuments,
      payload,
      API_HEADER,
    );
    const res = (response as AllocationDocumentsApiResponse) ?? {};
    const doc = res.data ?? {};
    return {
      id: doc.id,
      status: doc.document_status,
      account_code: doc.account_code,
      subledger_code: doc.subledger_code,
      allocation_date: doc.allocation_date,
      allocation_no: doc.allocation_no,
      allocation: Array.isArray(doc.allocation) ? doc.allocation : [],
    };
  } catch (error) {
    console.error("Error saving allocation documents:", error);
    throw error;
  }
};

const putAllocationDocuments = async (
  payload: Record<string, unknown> & { id: number; document_status?: "POSTED" },
): Promise<AllocationDocumentsHeader> => {
  try {
    const response = await putAPICall(
      URL.outstandingAllocationDocuments,
      payload,
      API_HEADER,
    );
    const res = (response as AllocationDocumentsApiResponse) ?? {};
    const doc = res.data ?? {};
    return {
      id: doc.id,
      status: doc.document_status,
      account_code: doc.account_code,
      subledger_code: doc.subledger_code,
      allocation_date: doc.allocation_date,
      allocation_no: doc.allocation_no,
      allocation: Array.isArray(doc.allocation) ? doc.allocation : [],
    };
  } catch (error) {
    console.error("Error posting allocation documents:", error);
    throw error;
  }
};

export default function DocumentAllocation() {
  const navigate = useNavigate();
  const location = useLocation();
  const canPostDocuments = useCanPostDocuments();
  const hydratedDocumentIdRef = useRef<number | null>(null);
  const [isViewMode, setIsViewMode] = useState(false);
  const [isHydrating, setIsHydrating] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<CoaItem | null>(null);
  const [rows, setRows] = useState<DocumentAllocationRow[]>([]);
  const [fetchedRows, setFetchedRows] = useState<DocumentAllocationRow[]>([]);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [savedHeader, setSavedHeader] =
    useState<AllocationDocumentsHeader | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [auditPatch, setAuditPatch] = useState<Record<string, unknown> | null>(
    null,
  );

  const selectedGlAccountCode = selectedAccount?.gl_account_code ?? "";
  const selectedSlCode = selectedAccount?.sl_code ?? "";

  const isLocked =
    String(savedHeader?.status ?? "").toUpperCase() === "POSTED" ||
    isViewMode;
  const hasSavedId = savedHeader?.id != null;

  const allocationAuditSource = useMemo(() => {
    const row = (
      location.state as { allocationDocument?: Record<string, unknown> } | null
    )?.allocationDocument;
    return mergeEditPageAuditSources(row, savedHeader, auditPatch);
  }, [location.state, savedHeader, auditPatch]);

  useEffect(() => {
    hydratedDocumentIdRef.current = null;
    setAuditPatch(null);
  }, [location.key]);

  useEffect(() => {
    const state = location.state as {
      allocationDocument?: AllocationDocumentNavRow;
      allocationMode?: "view" | "edit";
    } | null;

    const row = state?.allocationDocument;
    if (!row?.id) return;
    if (hydratedDocumentIdRef.current === row.id) return;
    hydratedDocumentIdRef.current = row.id;
    const mode = state?.allocationMode === "edit" ? "edit" : "view";

    setIsViewMode(mode === "view");
    setSelectedDate(parseAllocationDateString(row.allocation_date ?? null));

    (async () => {
      setIsHydrating(true);
      try {
        let doc: Awaited<ReturnType<typeof fetchAllocationDocumentFromApi>> =
          null;

        if (Array.isArray(row.allocation) && row.allocation.length > 0) {
          doc = {
            id: row.id,
            document_status: row.document_status,
            account_code: row.account_code,
            subledger_code: row.subledger_code,
            account_name: row.account_name,
            allocation_date: row.allocation_date,
            allocation_no: row.allocation_no,
            allocation: row.allocation,
          };
        } else {
          doc = await fetchAllocationDocumentFromApi(row);
        }

        if (!doc?.id) {
          ToastNotification({
            type: "error",
            message: "Could not load allocation document details.",
          });
          return;
        }

        const resolvedAccountCode =
          doc.account_code ?? row.account_code ?? "";
        const resolvedSlCode = doc.subledger_code ?? row.subledger_code;

        // Prefer account_name from navigation row (most reliable), then API doc
        const rawAccountName =
          (row.account_name?.trim() ||
            doc.account_name?.trim()) ?? "";

        // Fetch full account details from COA to get the proper id and canonical name
        let coaAccount: CoaItem | null = null;
        if (resolvedAccountCode) {
          coaAccount = await fetchCoaAccount(resolvedAccountCode);
        }

        setIsViewMode(mode === "view");

        setSavedHeader({
          id: doc.id,
          status: doc.document_status,
          account_code: resolvedAccountCode || undefined,
          subledger_code: resolvedSlCode,
          allocation_date: doc.allocation_date ?? row.allocation_date,
          allocation_no: doc.allocation_no ?? row.allocation_no,
        });

        setSelectedAccount({
          id: coaAccount?.id,
          gl_account_code: coaAccount?.gl_account_code ?? resolvedAccountCode,
          sl_code: coaAccount?.sl_code ?? resolvedSlCode,
          account_name: coaAccount?.account_name?.trim()
            ? coaAccount.account_name
            : rawAccountName,
        });

        setSelectedDate(
          parseAllocationDateString(
            (doc.allocation_date ?? row.allocation_date) ?? null,
          ),
        );

        const lines = Array.isArray(doc.allocation) ? doc.allocation : [];
        setRows(lines.map(normalizeAllocationLine));
        setHasFetched(lines.length > 0);
      } catch (e) {
        console.error(e);
        ToastNotification({
          type: "error",
          message: "Could not load allocation document details.",
        });
      } finally {
        setIsHydrating(false);
      }
    })();
  }, [location.state]);

  const handleOutstandingAmountChange = (
    rowIndex: number,
    nextAmountRaw: string,
  ) => {
    setRows((prev) => {
      const next = [...prev];
      const current = next[rowIndex] ?? {};

      const roe = parseDecimal(String(current.roe ?? "")) ?? 0;
      const amount = parseDecimal(nextAmountRaw) ?? 0;
      const local = roe * amount;

      next[rowIndex] = {
        ...current,
        outstanding_amount: nextAmountRaw,
        outstanding_local_amount: formatFixed(local, 2),
        // keep older keys in sync (if backend still uses them)
        amount: nextAmountRaw,
        amount_in_local: formatFixed(local, 2),
      };
      return next;
    });
  };

  const normalizeOutstandingAmountToTwoDecimals = (rowIndex: number) => {
    setRows((prev) => {
      const next = [...prev];
      const current = next[rowIndex];
      if (!current) return prev;

      const formatted = formatTwoDecimalsFromString(
        current.outstanding_amount ?? current.amount ?? "",
      );

      const roe = parseDecimal(String(current.roe ?? "")) ?? 0;
      const amount = parseDecimal(formatted) ?? 0;
      const local = roe * amount;

      next[rowIndex] = {
        ...current,
        outstanding_amount: formatted,
        outstanding_local_amount: formatFixed(local, 2),
        amount: formatted,
        amount_in_local: formatFixed(local, 2),
      };

      return next;
    });
  };

  const toggleRowSelection = (row: DocumentAllocationRow, checked: boolean) => {
    const key = row.id != null ? String(row.id) : String(row.document_no ?? "");
    if (!key) return;
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const applySelectedRows = () => {
    const next = fetchedRows.filter((r) => {
      const key = r.id != null ? String(r.id) : String(r.document_no ?? "");
      return key ? selectedRowIds.has(key) : false;
    });
    setRows(next);
    setSavedHeader(null);
    setIsModalOpen(false);
    if (next.length === 0) {
      ToastNotification({
        type: "info",
        message: "No rows selected.",
      });
    }
  };

  const removeAllocationRow = (rowIndex: number) => {
    setRows((prev) => prev.filter((_, idx) => idx !== rowIndex));
  };

  const mergeAllocationResponseIntoRows = (
    currentRows: DocumentAllocationRow[],
    savedAllocations: DocumentAllocationRow[],
  ): DocumentAllocationRow[] => {
    if (!Array.isArray(savedAllocations) || savedAllocations.length === 0) {
      return currentRows;
    }

    return currentRows.map((r) => {
      const match = savedAllocations.find(
        (a) =>
          (a.document_no ?? "").trim() !== "" &&
          String(a.document_no ?? "") === String(r.document_no ?? ""),
      );
      if (!match) return r;

      // Save response allocation rows are minimal; keep existing display fields and just refresh ids + amounts.
      return {
        ...r,
        id: match.id ?? r.id,
        day_book_id: match.day_book_id ?? r.day_book_id,
        currency_id: match.currency_id ?? r.currency_id,
        roe: match.roe ?? r.roe,
        Dr_Cr: match.Dr_Cr ?? r.Dr_Cr,
        outstanding_amount: match.amount ?? r.outstanding_amount ?? r.amount,
        outstanding_local_amount:
          match.amount_in_local ??
          r.outstanding_local_amount ??
          r.amount_in_local,
        amount: match.amount ?? r.amount,
        amount_in_local: match.amount_in_local ?? r.amount_in_local,
      };
    });
  };

  const buildAllocationPayloadRows = (sourceRows: DocumentAllocationRow[]) => {
    return sourceRows
      .filter((r) => (r.document_no ?? "").trim() !== "")
      .map((r) => {
        const amountStr = r.outstanding_amount ?? r.amount ?? "";
        const amountNum = parseDecimal(String(amountStr)) ?? 0;
        const roeNum = parseDecimal(String(r.roe ?? "")) ?? 0;
        const localNum = roeNum * amountNum;

        const payloadRow: Record<string, unknown> = {
          day_book_id: r.day_book_id ?? null,
          document_no: r.document_no ?? "",
          document_date: r.document_date ?? "",
          currency_id: r.currency_id ?? null,
          roe: formatFixed(roeNum, ROE_DECIMAL_PLACES),
          amount: formatFixed(amountNum, 3),
          amount_in_local: formatFixed(localNum, 3),
          Dr_Cr: r.Dr_Cr ?? "",
        };

        if (hasSavedId && r.id != null) {
          payloadRow.id = r.id;
        }

        return payloadRow;
      });
  };

  const handleSaveOrUpdate = async () => {
    if (!selectedGlAccountCode || !selectedSlCode) {
      ToastNotification({
        type: "error",
        message: "Please select an Account Name before saving.",
      });
      return;
    }
    if (rows.length === 0) {
      ToastNotification({
        type: "error",
        message: "No allocation rows to save.",
      });
      return;
    }

    const allocationDate =
      selectedDate != null
        ? formatDateForApi(selectedDate)
        : formatDateForApi(new Date());

    const payloadBase: Record<string, unknown> = {
      account_code: selectedGlAccountCode,
      subledger_code: selectedSlCode,
      allocation_date: allocationDate,
      allocation: buildAllocationPayloadRows(rows),
    };

    setIsSaving(true);
    try {
      const res =
        hasSavedId && savedHeader?.id != null
          ? await putAllocationDocuments({
              ...(payloadBase as Record<string, unknown>),
              id: Number(savedHeader.id),
            })
          : await createAllocationDocuments(payloadBase);
      setSavedHeader(res ?? {});
      setAuditPatch((prev) => appendEditPageAuditPatch(prev, res));

      if (Array.isArray(res?.allocation)) {
        // Merge minimal save response rows into the current rows so UI doesn't "clear"
        setRows((prev) =>
          mergeAllocationResponseIntoRows(prev, res.allocation ?? []),
        );
      }

      ToastNotification({
        type: "success",
        message: hasSavedId ? "Allocation updated." : "Allocation saved.",
      });
    } catch {
      ToastNotification({
        type: "error",
        message: hasSavedId
          ? "Failed to update allocation."
          : "Failed to save allocation.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePost = async () => {
    if (!hasSavedId || savedHeader?.id == null) {
      ToastNotification({
        type: "error",
        message: "Please save the document before posting.",
      });
      return;
    }

    setIsPosting(true);
    try {
      const allocationDate =
        savedHeader?.allocation_date ||
        (selectedDate != null
          ? formatDateForApi(selectedDate)
          : formatDateForApi(new Date()));

      const res = await putAllocationDocuments({
        id: Number(savedHeader.id),
        document_status: "POSTED",
        account_code: selectedGlAccountCode,
        subledger_code: selectedSlCode,
        allocation_date: allocationDate,
        allocation: buildAllocationPayloadRows(rows),
      });
      setSavedHeader(res ?? { ...savedHeader, status: "POSTED" });
      setAuditPatch((prev) => appendEditPageAuditPatch(prev, res));

      if (Array.isArray(res?.allocation)) {
        setRows((prev) =>
          mergeAllocationResponseIntoRows(prev, res.allocation ?? []),
        );
      }

      ToastNotification({
        type: "success",
        message: "Document posted.",
      });
    } catch {
      ToastNotification({
        type: "error",
        message: "Failed to post document.",
      });
    } finally {
      setIsPosting(false);
    }
  };

  const handleGet = async () => {
    if (!selectedAccount || !selectedGlAccountCode) {
      ToastNotification({
        type: "error",
        message: "Please select an Account Name before fetching.",
      });
      return;
    }

    setIsFetching(true);
    try {
      const slTrimmed = String(selectedSlCode ?? "").trim();
      const payload: {
        account_code: string;
        subledger_code?: string;
        document_date?: string;
      } = {
        account_code: selectedGlAccountCode,
        ...(selectedDate != null
          ? { document_date: formatDateForApi(selectedDate) }
          : {}),
      };

      // When SL code is 0, don't send subledger_code at all
      if (slTrimmed !== "" && slTrimmed !== "0") {
        payload.subledger_code = slTrimmed;
      }

      const res = await fetchDocumentAllocation(payload);
      const list = Array.isArray(res?.data) ? res.data : [];
      setHasFetched(true);
      if (list.length === 0) {
        setRows([]);
        setFetchedRows([]);
        setSavedHeader(null);
        ToastNotification({
          type: "info",
          message: "No documents found for the selected account.",
        });
        return;
      }
      setFetchedRows(list);
      setSelectedRowIds(new Set());
      setIsModalOpen(true);
    } catch {
      ToastNotification({
        type: "error",
        message: "Failed to fetch document allocation data.",
      });
    } finally {
      setIsFetching(false);
    }
  };

  const handleBack = () => {
    const historyLength = window.history.length;
    if (historyLength > 1) {
      navigate(-1);
    } else {
      navigate("/accounts");
    }
  };

  return (
    <Box
      style={{
        backgroundColor: "#F8F8F8",
        position: "relative",
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      <Modal
        opened={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Select Allocations"
        size="100%"
        centered
        styles={{
          content: { maxWidth: "95vw" },
        }}
      >
        <Box>
          {/* Modal header */}
          <Grid
            w="100%"
            py="sm"
            style={{
              fontWeight: 600,
              color: "#105476",
            }}
          >
            <Grid.Col span={0.4} style={{ fontSize: "13px" }}>
              Select
            </Grid.Col>
            <Grid.Col span={0.8} style={{ fontSize: "13px" }}>
              Branch
            </Grid.Col>
            <Grid.Col span={1.3} style={{ fontSize: "13px" }}>
              Daybook code
            </Grid.Col>
            <Grid.Col span={0.9} style={{ fontSize: "13px" }}>
              Document Type
            </Grid.Col>
            <Grid.Col span={1.8} style={{ fontSize: "13px" }}>
              Document Number
            </Grid.Col>
            <Grid.Col span={1.1} style={{ fontSize: "13px" }}>
              Document Date
            </Grid.Col>
            <Grid.Col span={0.8} style={{ fontSize: "13px" }}>
              Currency
            </Grid.Col>
            <Grid.Col span={0.7} style={{ fontSize: "13px" }}>
              ROE
            </Grid.Col>
            <Grid.Col span={1.1} style={{ fontSize: "13px" }}>
              Document Amount
            </Grid.Col>
            <Grid.Col span={1.1} style={{ fontSize: "13px" }}>
              Outstanding amount
            </Grid.Col>
            <Grid.Col span={1.5} style={{ fontSize: "13px" }}>
              Outstanding local amount
            </Grid.Col>
            <Grid.Col span={0.4} style={{ fontSize: "13px" }}>
              Dr/Cr
            </Grid.Col>
          </Grid>

          {fetchedRows.map((row, idx) => {
            const key =
              row.id != null ? String(row.id) : String(row.document_no ?? "");
            const isChecked = key ? selectedRowIds.has(key) : false;
            const daybookCode = row.day_book_code ?? row.day_book_name ?? "";
            const docType =
              row.document_type ?? row.day_book_document_type ?? "";
            const outstandingAmt = row.outstanding_amount ?? row.amount ?? "";
            const outstandingLocal =
              row.outstanding_local_amount ?? row.amount_in_local ?? "";
            return (
              <Grid
                key={key || idx}
                w="100%"
                gutter="xs"
                mt={idx !== 0 ? "sm" : 0}
              >
                <Grid.Col span={0.4}>
                  <Checkbox
                    checked={isChecked}
                    onChange={(e) =>
                      toggleRowSelection(row, e.currentTarget.checked)
                    }
                  />
                </Grid.Col>
                <Grid.Col span={0.8}>
                  <FormTextInput
                    value={row.branch_code ?? ""}
                    readOnly
                    styles={{ input: readOnlyInputStyles.input }}
                    format="normal"
                  />
                </Grid.Col>
                <Grid.Col span={1.2}>
                  <FormTextInput
                    value={daybookCode}
                    readOnly
                    styles={{ input: readOnlyInputStyles.input }}
                    format="normal"
                  />
                </Grid.Col>
                <Grid.Col span={0.9}>
                  <FormTextInput
                    value={docType}
                    readOnly
                    styles={{ input: readOnlyInputStyles.input }}
                    format="normal"
                  />
                </Grid.Col>
                <Grid.Col span={1.8}>
                  <FormTextInput
                    value={row.document_no ?? ""}
                    readOnly
                    styles={{ input: readOnlyInputStyles.input }}
                    format="normal"
                  />
                </Grid.Col>
                <Grid.Col span={1.1}>
                  <FormTextInput
                    value={row.document_date ?? ""}
                    readOnly
                    styles={{ input: readOnlyInputStyles.input }}
                    format="normal"
                  />
                </Grid.Col>
                <Grid.Col span={0.8}>
                  <FormTextInput
                    value={row.currency_code ?? ""}
                    readOnly
                    styles={{ input: readOnlyInputStyles.input }}
                    format="normal"
                  />
                </Grid.Col>
                <Grid.Col span={0.7}>
                  <FormTextInput
                    value={row.roe ?? ""}
                    readOnly
                    styles={{ input: readOnlyInputStyles.input }}
                    format="normal"
                  />
                </Grid.Col>
                <Grid.Col span={1.1}>
                  <FormTextInput
                    value={formatTwoDecimalsFromString(row.document_amount)}
                    readOnly
                    styles={{ input: readOnlyInputStyles.input }}
                    format="normal"
                  />
                </Grid.Col>
                <Grid.Col span={1.1}>
                  <FormTextInput
                    value={formatTwoDecimalsFromString(outstandingAmt)}
                    readOnly
                    styles={{ input: readOnlyInputStyles.input }}
                    format="normal"
                  />
                </Grid.Col>
                <Grid.Col span={1.5}>
                  <FormTextInput
                    value={formatTwoDecimalsFromString(outstandingLocal)}
                    readOnly
                    styles={{ input: readOnlyInputStyles.input }}
                    format="normal"
                  />
                </Grid.Col>
                <Grid.Col span={0.4}>
                  <FormTextInput
                    value={row.Dr_Cr ?? ""}
                    readOnly
                    styles={{ input: readOnlyInputStyles.input }}
                    format="normal"
                  />
                </Grid.Col>
              </Grid>
            );
          })}

          <Group justify="flex-end" mt="md">
            <Button
              variant="outline"
              color="gray"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              style={{ backgroundColor: "#105476" }}
              onClick={applySelectedRows}
            >
              Select
            </Button>
          </Group>
        </Box>
      </Modal>

      {(isFetching || isHydrating) && (
        <Center
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(255, 255, 255, 0.65)",
            zIndex: 15,
          }}
        >
          <Loader color="#105476" size="lg" />
        </Center>
      )}

      <Box p="sm" mx="auto" style={{ backgroundColor: "#F8F8F8" }}>
        <Flex
          gap="md"
          align="flex-start"
          style={{ height: "calc(100vh - 112px)", width: "100%" }}
        >
          {/* Main content — PipelineCreate main column */}
          <Box
            style={{
              flex: 1,
              width: "100%",
              borderRadius: "8px",
              display: "flex",
              flexDirection: "column",
              height: "100%",
              overflow: "hidden",
              gap: "8px",
            }}
          >
            <Box
              style={{
                flex: 1,
                overflowY: "auto",
                borderRadius: "8px",
                backgroundColor: "#FFFFFF",
              }}
            >
              <Grid style={{ padding: "24px" }}>
                <Grid.Col span={12}>
                  <Group justify="space-between" align="center" wrap="nowrap">
                  <EditPageHeadingRow
                    visible={hasSavedId && Boolean(allocationAuditSource)}
                    auditSource={allocationAuditSource}
                    animateKey={(allocationAuditSource as { id?: number })?.id}
                  >
                    <Text
                      fw={600}
                      c="#105476"
                      size="sm"
                      style={{ fontFamily: "Inter" }}
                    >
                      Document Allocation
                    </Text>
                  </EditPageHeadingRow>

                    {hasSavedId ? (
                      <Group gap="sm" align="center" wrap="nowrap">
                        <Group gap={6} align="center" wrap="nowrap">
                          <Text size="sm" fw={500} c="dimmed">
                            Allocation No
                          </Text>
                          <Badge
                            size="sm"
                            variant="light"
                            color="#105476"
                            styles={{
                              root: {
                                textTransform: "none",
                                height: 26,
                                display: "inline-flex",
                                alignItems: "center",
                              },
                            }}
                          >
                            {savedHeader?.allocation_no ||
                              (savedHeader?.id != null
                                ? `ALC-${String(savedHeader.id).padStart(6, "0")}`
                                : "—")}
                          </Badge>
                        </Group>

                        <Group gap={6} align="center" wrap="nowrap">
                          <Text size="sm" fw={500} c="dimmed">
                            Status
                          </Text>
                          <Badge
                            size="sm"
                            variant="light"
                            color={
                              String(
                                savedHeader?.status ?? "",
                              ).toUpperCase() === "POSTED"
                                ? "green"
                                : "gray"
                            }
                            styles={{
                              root: {
                                textTransform: "none",
                                height: 26,
                                display: "inline-flex",
                                alignItems: "center",
                              },
                            }}
                          >
                            {String(savedHeader?.status ?? "").toUpperCase() ||
                              "—"}
                          </Badge>
                        </Group>
                      </Group>
                    ) : null}
                  </Group>
                </Grid.Col>

                <Grid.Col span={{ base: 12, sm: 6, md: 5 }}>
                  <SearchableSelect
                    label="Account Name"
                    placeholder="Search by account name"
                    apiEndpoint={URL.chartOfAccounts}
                    value={
                      selectedAccount?.id != null
                        ? String(selectedAccount.id)
                        : null
                    }
                    dropdownZIndex={1100}
                    minSearchLength={1}
                    searchFields={["gl_name", "gl_account_code", "account_name", "id"]}
                    disabled={isLocked}
                    readOnly={isLocked}
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
                    displayValue={selectedAccount?.account_name ?? ""}
                    returnOriginalData
                    onChange={(value, _selectedData, originalData) => {
                      if (!value || !originalData) {
                        setSelectedAccount(null);
                        return;
                      }

                      const nextGl = originalData.gl_account_code;
                      const nextSl = originalData.sl_code;
                      const nextName = originalData.account_name;

                      setSelectedAccount({
                        id:
                          originalData.id !== undefined &&
                          originalData.id !== null
                            ? Number(originalData.id)
                            : undefined,
                        gl_account_code:
                          nextGl !== undefined && nextGl !== null
                            ? String(nextGl)
                            : undefined,
                        sl_code:
                          nextSl !== undefined && nextSl !== null
                            ? String(nextSl)
                            : undefined,
                        account_name:
                          nextName !== undefined && nextName !== null
                            ? String(nextName)
                            : undefined,
                      });
                    }}
                    styles={{
                      input: fieldInputStyles.input,
                      label: {
                        fontSize: "13px",
                        fontFamily: "Inter",
                        marginBottom: "4px",
                      },
                    }}
                  />
                </Grid.Col>

                <Grid.Col span={{ base: 12, sm: 4, md: 3 }}>
                  <FormTextInput
                    label="SL Code"
                    placeholder="SL Code"
                    value={selectedSlCode}
                    readOnly
                    disabled={isLocked}
                    styles={{
                      input: readOnlyInputStyles.input,
                      label: {
                        fontSize: "13px",
                        fontFamily: "Inter",
                        marginBottom: "4px",
                      },
                    }}
                    format="normal"
                  />
                </Grid.Col>

                <Grid.Col span={{ base: 12, sm: 4, md: 3 }}>
                  <SingleDateInput
                    label="Date"
                    placeholder="Select date"
                    value={selectedDate}
                    onChange={setSelectedDate}
                    disabled={isLocked}
                  />
                </Grid.Col>

                <Grid.Col span={{ base: 1, sm: 1, md: 1 }}>
                  <Box pt={22}>
                    <Button
                      fullWidth
                      size="sm"
                      leftSection={<IconSearch size={16} />}
                      onClick={handleGet}
                      disabled={isFetching || isLocked || isHydrating}
                      style={{
                        backgroundColor: "#105476",
                        fontSize: "13px",
                        fontFamily: "Inter",
                      }}
                    >
                      Get
                    </Button>
                  </Box>
                </Grid.Col>

                {hasFetched && rows.length === 0 ? (
                  <Grid.Col span={12}>
                    <Text
                      size="sm"
                      c="dimmed"
                      style={{ fontFamily: "Inter, sans-serif" }}
                    >
                      No data found.
                    </Text>
                  </Grid.Col>
                ) : null}

                {rows.length > 0 ? (
                  <Grid.Col span={12}>
                    <Card withBorder p="md" mt="md" radius="md">
                      <Text size="sm" fw={600} c="#105476">
                        Allocations
                      </Text>

                      <Box mt="xs">
                        {/* Static header (matches InvoiceCreate Charges section style) */}
                        <Grid
                          w="100%"
                          // gutter="sm"
                          py="sm"
                          mb="sm"
                          style={{
                            fontWeight: 600,
                            color: "#105476",
                          }}
                        >
                          <Grid.Col span={0.9} style={{ fontSize: "13px" }}>
                            Branch
                          </Grid.Col>
                          <Grid.Col span={0.8} style={{ fontSize: "13px" }}>
                            Daybook code
                          </Grid.Col>
                          <Grid.Col span={0.7} style={{ fontSize: "13px" }}>
                            Document Type
                          </Grid.Col>
                          <Grid.Col span={1.7} style={{ fontSize: "13px" }}>
                            Document Number
                          </Grid.Col>
                          <Grid.Col span={1.2} style={{ fontSize: "13px" }}>
                            Document Date
                          </Grid.Col>
                          <Grid.Col span={0.9} style={{ fontSize: "13px" }}>
                            Currency
                          </Grid.Col>
                          <Grid.Col span={0.7} style={{ fontSize: "13px" }}>
                            ROE
                          </Grid.Col>
                          <Grid.Col span={1.2} style={{ fontSize: "13px" }}>
                            Document Amount
                          </Grid.Col>
                          <Grid.Col span={1.2} style={{ fontSize: "13px" }}>
                            Outstanding amount
                          </Grid.Col>
                          <Grid.Col span={1.3} style={{ fontSize: "13px" }}>
                            Outstanding local amount
                          </Grid.Col>
                          <Grid.Col span={0.5} style={{ fontSize: "13px" }}>
                            Dr/Cr
                          </Grid.Col>
                          {!isLocked ? (
                            <Grid.Col
                              span={0.5}
                              style={{ fontSize: "13px", textAlign: "center" }}
                            >
                              Action
                            </Grid.Col>
                          ) : null}
                        </Grid>

                        {/* Dynamic rows */}
                        {rows.map((row, index) => (
                          <Grid
                            key={row.id ?? index}
                            w="100%"
                            gutter="xs"
                            mt={index !== 0 ? "sm" : 0}
                          >
                            {/**
                             * Backward-compatible fallbacks for older response:
                             * - day_book_name can stand in for day_book_code
                             * - day_book_document_type can stand in for document_type
                             * - amount/amount_in_local can stand in for outstanding fields
                             */}
                            {(() => {
                              const daybookCode =
                                row.day_book_code ?? row.day_book_name ?? "";
                              const docType =
                                row.document_type ??
                                row.day_book_document_type ??
                                "";
                              const outstandingAmt =
                                row.outstanding_amount ?? row.amount ?? "";
                              const outstandingLocal =
                                row.outstanding_local_amount ??
                                row.amount_in_local ??
                                "";

                              return (
                                <>
                                  <Grid.Col span={0.9}>
                                    <FormTextInput
                                      placeholder="Branch"
                                      value={row.branch_code ?? ""}
                                      readOnly
                                      styles={{
                                        input: readOnlyInputStyles.input,
                                      }}
                                      format="normal"
                                    />
                                  </Grid.Col>
                                  <Grid.Col span={0.8}>
                                    <FormTextInput
                                      placeholder="Daybook code"
                                      value={daybookCode}
                                      readOnly
                                      styles={{
                                        input: readOnlyInputStyles.input,
                                      }}
                                      format="normal"
                                    />
                                  </Grid.Col>
                                  <Grid.Col span={0.7}>
                                    <FormTextInput
                                      placeholder="Document Type"
                                      value={docType}
                                      readOnly
                                      styles={{
                                        input: readOnlyInputStyles.input,
                                      }}
                                      format="normal"
                                    />
                                  </Grid.Col>
                                  <Grid.Col span={1.7}>
                                    <FormTextInput
                                      placeholder="Document Number"
                                      value={row.document_no ?? ""}
                                      readOnly
                                      styles={{
                                        input: readOnlyInputStyles.input,
                                      }}
                                      format="normal"
                                    />
                                  </Grid.Col>
                                  <Grid.Col span={1.2}>
                                    <FormTextInput
                                      placeholder="Document Date"
                                      value={row.document_date ?? ""}
                                      readOnly
                                      styles={{
                                        input: readOnlyInputStyles.input,
                                      }}
                                      format="normal"
                                    />
                                  </Grid.Col>
                                  <Grid.Col span={0.9}>
                                    <FormTextInput
                                      placeholder="Currency"
                                      value={row.currency_code ?? ""}
                                      readOnly
                                      styles={{
                                        input: readOnlyInputStyles.input,
                                      }}
                                      format="normal"
                                    />
                                  </Grid.Col>
                                  <Grid.Col span={0.7}>
                                    <FormTextInput
                                      placeholder="ROE"
                                      value={row.roe ?? ""}
                                      readOnly
                                      styles={{
                                        input: readOnlyInputStyles.input,
                                      }}
                                      format="normal"
                                    />
                                  </Grid.Col>
                                  <Grid.Col span={1.2}>
                                    <FormTextInput
                                      placeholder="Document Amount"
                                      value={formatTwoDecimalsFromString(
                                        row.document_amount,
                                      )}
                                      readOnly
                                      styles={{
                                        input: readOnlyInputStyles.input,
                                      }}
                                      format="normal"
                                    />
                                  </Grid.Col>
                                  <Grid.Col span={1.2}>
                                    <FormTextInput
                                      placeholder="Outstanding amount"
                                      value={outstandingAmt}
                                      onChange={(e) =>
                                        handleOutstandingAmountChange(
                                          index,
                                          e.currentTarget.value,
                                        )
                                      }
                                      onBlur={() =>
                                        normalizeOutstandingAmountToTwoDecimals(
                                          index,
                                        )
                                      }
                                      readOnly={isLocked}
                                      styles={{
                                        input: isLocked
                                          ? readOnlyInputStyles.input
                                          : fieldInputStyles.input,
                                      }}
                                      format="normal"
                                    />
                                  </Grid.Col>
                                  <Grid.Col span={1.3}>
                                    <FormTextInput
                                      placeholder="Outstanding local amount"
                                      value={formatTwoDecimalsFromString(
                                        outstandingLocal,
                                      )}
                                      readOnly
                                      styles={{
                                        input: readOnlyInputStyles.input,
                                      }}
                                      format="normal"
                                    />
                                  </Grid.Col>
                                  <Grid.Col span={0.5}>
                                    <FormTextInput
                                      placeholder="Dr/Cr"
                                      value={row.Dr_Cr ?? ""}
                                      readOnly
                                      styles={{
                                        input: readOnlyInputStyles.input,
                                      }}
                                      format="normal"
                                    />
                                  </Grid.Col>
                                  {!isLocked ? (
                                    <Grid.Col span={0.5}>
                                      <Center h="100%">
                                        <Button
                                          variant="subtle"
                                          color="red"
                                          size="compact-xs"
                                          p={0}
                                          onClick={() =>
                                            removeAllocationRow(index)
                                          }
                                          aria-label="Delete allocation row"
                                        >
                                          <IconTrash size={16} />
                                        </Button>
                                      </Center>
                                    </Grid.Col>
                                  ) : null}
                                </>
                              );
                            })()}
                          </Grid>
                        ))}
                      </Box>
                    </Card>
                  </Grid.Col>
                ) : null}
              </Grid>
            </Box>

            {/* Footer — PipelineCreate Cancel / Back pattern */}
            <Box
              style={{
                padding: "20px 32px",
                backgroundColor: "#ffffff",
                borderRadius: "8px",
              }}
            >
              <Group justify="space-between" align="center">
                <Button
                  variant="outline"
                  color="gray"
                  size="sm"
                  styles={{
                    root: {
                      borderColor: "#d0d0d0",
                      color: "#666",
                      fontSize: "13px",
                      fontFamily: "Inter",
                    },
                  }}
                  onClick={handleBack}
                >
                  Back
                </Button>

                {rows.length > 0 ? (
                  <Group gap="sm">
                    <Button
                      size="sm"
                      style={{ backgroundColor: "#105476" }}
                      onClick={handleSaveOrUpdate}
                      loading={isSaving}
                      disabled={isLocked || rows.length === 0}
                    >
                      {hasSavedId ? "Update" : "Save"}
                    </Button>

                    {hasSavedId && canPostDocuments ? (
                      <Button
                        size="sm"
                        color="black"
                        variant="filled"
                        onClick={handlePost}
                        loading={isPosting}
                        disabled={isLocked}
                      >
                        Post
                      </Button>
                    ) : null}
                  </Group>
                ) : null}
              </Group>
            </Box>
          </Box>
        </Flex>
      </Box>
    </Box>
  );
}
