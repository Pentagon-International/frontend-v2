import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Center,
  Grid,
  Group,
  Loader,
  NumberInput,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useQuery } from "@tanstack/react-query";
import {
  IconArrowLeft,
  // IconFolder,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { apiCallProtected } from "../../../api/axios";
import { URL } from "../../../api/serverUrls";
import {
  SearchableSelect,
  SingleDateInput,
  ToastNotification,
} from "../../../components";
import RequiredLabel from "../../../components/RequiredLabel";
import { useAccountsDocumentCurrencyRoe } from "../../../hooks/useAccountsDocumentCurrencyRoe";
import { useCanPostDocuments } from "../../../hooks/useCanPostDocuments";
import { getAPICall } from "../../../service/getApiCall";
import { postAPICall } from "../../../service/postApiCall";
import { API_HEADER } from "../../../store/storeKeys";
import useAuthStore from "../../../store/authStore";
import useDateFormat from "../../../hooks/useDateFormat";
import dayjs from "dayjs";
import {
  bindMoneyWholeNumberMode,
  formatMoneyAmount,
  getAmountDecimalScale,
  isVietnamBranchFromUser,
} from "../../../utils/nonDecimalMoneyAmount";

type ChequeNotClearedRow = {
  daybook_id: number | null;
  date: Date | null;
  daybook: string;
  document_no: string;
  cheque_no: string;
  cheque_date: Date | null;
  cheque_clr_date: Date | null;
  party: string;
  amount: number | null;
};

type BankEntryRow = {
  date: Date | null;
  narration: string;
  cheque_no: string;
  cheque_clr_date: Date | null;
  our_reference: string;
  amount: number | null;
};

type BankReconciliationForm = {
  date: Date | null;
  currency_code: string;
  status: string;
  bank_balance: number | null;
  bank_account_id: string;
  bank_account_code: string;
  bank_account_sub_code: string;
  bank_account_name: string;
  as_per_statement: number | null;
  remarks: string;
  file_name: string;
  cheque_issued: ChequeNotClearedRow[];
  bank_credit: BankEntryRow[];
  cheque_deposited: ChequeNotClearedRow[];
  bank_debit: BankEntryRow[];
};

type BankReconciliationSaveResponse = {
  id?: number;
  brs_no?: string;
  status?: string;
};

type BankReconciliationChequeLine = {
  date?: string | null;
  daybook_id?: number | null;
  daybook_code?: string | null;
  daybook_name?: string | null;
  document_no?: string | null;
  cheque_no?: string | null;
  cheque_date?: string | null;
  chq_clrd_date?: string | null;
  paid_to?: string | null;
  received_from?: string | null;
  amount?: string | number | null;
  currency_code?: string | null;
};

type BankReconciliationBankLine = {
  date?: string | null;
  narration?: string | null;
  cheque_no?: string | null;
  chq_clrd_date?: string | null;
  our_reference?: string | null;
  amount?: string | number | null;
};

type BankReconciliationRecord = {
  id?: number;
  brs_no?: string;
  brs_date?: string;
  account_code?: string;
  account_name?: string;
  subledger?: string;
  currency_id?: number;
  currency_code?: string;
  currency_name?: string;
  as_per_statement?: string | number | null;
  bank_balance?: string | number | null;
  cheque_issued_total?: string | number | null;
  bank_credit_total?: string | number | null;
  cheque_deposited_total?: string | number | null;
  bank_debit_total?: string | number | null;
  credit_total?: string | number | null;
  debit_total?: string | number | null;
  grand_total?: string | number | null;
  difference_amount?: string | number | null;
  status?: string;
  remarks?: string;
  cheque_issued_lines?: BankReconciliationChequeLine[];
  cheque_deposited_lines?: BankReconciliationChequeLine[];
  bank_credit_lines?: BankReconciliationBankLine[];
  bank_debit_lines?: BankReconciliationBankLine[];
};

type BankReconciliationGetDetailData = {
  account_code?: string;
  subledger?: string;
  account_name?: string;
  as_on_date?: string;
  bank_balance?: string | number | null;
  cheque_issued_lines_total?: string | number | null;
  cheque_deposited_lines_total?: string | number | null;
  cheque_issued_lines?: BankReconciliationChequeLine[];
  cheque_deposited_lines?: BankReconciliationChequeLine[];
};

type BankReconciliationGetDetailResponse = {
  status?: boolean;
  message?: string;
  data?: BankReconciliationGetDetailData;
};

const panelStyle = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: "14px 16px",
};

const sectionBoxStyle = {
  border: "1px solid #e8edf2",
  borderRadius: 6,
  overflow: "hidden" as const,
  background: "#fff",
  marginTop: 6,
};

const creditGroupStyle = {
  ...panelStyle,
  borderLeft: "4px solid #059669",
  background: "linear-gradient(180deg, #f0fdf4 0%, #ffffff 48px)",
};

const debitGroupStyle = {
  ...panelStyle,
  borderLeft: "4px solid #dc2626",
  background: "linear-gradient(180deg, #fef2f2 0%, #ffffff 48px)",
};

const summaryPanelStyle = {
  ...panelStyle,
  borderLeft: "4px solid #105476",
  background: "#f8fafc",
};

function receiptStatusBadgeColor(status?: string): string {
  const statusUpper = String(status ?? "").toUpperCase();
  if (statusUpper === "POSTED") return "green";
  if (statusUpper === "UNPOSTED") return "gray";
  return "#105476";
}

const inputStyles = {
  input: { fontSize: "13px", fontFamily: "Inter", height: "36px" },
  label: { fontSize: "13px", fontFamily: "Inter", marginBottom: "4px" },
};

const cellInput = {
  input: { fontSize: "12px", fontFamily: "Inter", height: "32px" },
};

function emptyChequeRow(): ChequeNotClearedRow {
  return {
    daybook_id: null,
    date: null,
    daybook: "",
    document_no: "",
    cheque_no: "",
    cheque_date: null,
    cheque_clr_date: null,
    party: "",
    amount: null,
  };
}

function emptyBankRow(): BankEntryRow {
  return {
    date: null,
    narration: "",
    cheque_no: "",
    cheque_clr_date: null,
    our_reference: "",
    amount: null,
  };
}

function sumAmounts(
  rows: Array<{ amount: number | null | undefined }>,
): number {
  return rows.reduce((sum, row) => {
    const n = Number(row.amount);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
}

function formatAmount(value: number): string {
  return formatMoneyAmount(value, false);
}

function formatChartOfAccountsLabel(
  glName: string | null | undefined,
  glAccountCode: string | null | undefined,
  accountName: string | null | undefined,
): string {
  const a = String(glName ?? "").trim();
  const b = String(glAccountCode ?? "").trim();
  const c = String(accountName ?? "").trim();
  return [c, b, a].filter(Boolean).join(" - ");
}

/** YYYY-MM-DD for BRS API payloads (local calendar day) */
function formatDateDDMMYYYY(date: Date | null | undefined): string {
  if (!date) return "";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${year}-${month}-${day}`;
}

function parseApiDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const parts = trimmed.split("-");
  if (parts.length !== 3) {
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const [a, b, c] = parts;
  if (a.length === 4) {
    const d = new Date(Number(a), Number(b) - 1, Number(c));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(Number(c), Number(b) - 1, Number(a));
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseAmount(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** UI-only date string for read-only BRS line fields (country-based format) */
function formatDateDisplay(
  date: Date | null | undefined,
  dateFormat: string,
): string {
  if (!date) return "";
  return dayjs(date).format(dateFormat);
}

function mapChequeLineToRow(
  line: BankReconciliationChequeLine,
  partyField: "paid_to" | "received_from",
): ChequeNotClearedRow {
  return {
    daybook_id:
      line.daybook_id != null && Number.isFinite(Number(line.daybook_id))
        ? Number(line.daybook_id)
        : null,
    date: parseApiDate(line.date),
    daybook: String(line.daybook_code ?? line.daybook_name ?? "").trim(),
    document_no: String(line.document_no ?? "").trim(),
    cheque_no: String(line.cheque_no ?? "").trim(),
    cheque_date: parseApiDate(line.cheque_date),
    cheque_clr_date: parseApiDate(line.chq_clrd_date),
    party: String(line[partyField] ?? "").trim(),
    amount: parseAmount(line.amount),
  };
}

function mapBankLineFromApi(line: BankReconciliationBankLine): BankEntryRow {
  return {
    date: parseApiDate(line.date),
    narration: String(line.narration ?? "").trim(),
    cheque_no: String(line.cheque_no ?? "").trim(),
    cheque_clr_date: parseApiDate(line.chq_clrd_date),
    our_reference: String(line.our_reference ?? "").trim(),
    amount: parseAmount(line.amount),
  };
}

function SectionTitle({
  children,
  accent,
}: {
  children: string;
  accent?: "credit" | "debit";
}) {
  const color =
    accent === "credit"
      ? "#047857"
      : accent === "debit"
        ? "#b91c1c"
        : "#0f172a";
  return (
    <Text
      fw={600}
      size="sm"
      pt={6}
      pb={4}
      mb={6}
      style={{
        fontFamily: "Inter",
        color,
        letterSpacing: "0.01em",
      }}
    >
      {children}
    </Text>
  );
}

function GroupPanelTitle({
  title,
  subtitle,
  accent,
}: {
  title: string;
  subtitle: string;
  accent: "credit" | "debit";
}) {
  const color = accent === "credit" ? "#047857" : "#b91c1c";
  return (
    <Box mb="sm">
      <Text
        fw={700}
        size="md"
        style={{ fontFamily: "Inter", color, letterSpacing: "0.02em" }}
      >
        {title}
      </Text>
      <Text size="xs" c="dimmed" style={{ fontFamily: "Inter", marginTop: 2 }}>
        {subtitle}
      </Text>
    </Box>
  );
}

function AmountColumnTotal({
  label,
  value,
  colSpan,
  trailingEmpty = false,
}: {
  label?: string;
  value: number;
  colSpan: number;
  trailingEmpty?: boolean;
}) {
  return (
    <Table.Tr style={{ background: "#f8fafc" }}>
      <Table.Td colSpan={colSpan}>
        <Text
          size="xs"
          fw={600}
          ta="right"
          style={{ fontFamily: "Inter", color: "#475569" }}
        >
          {label ?? "Total"}
        </Text>
      </Table.Td>
      <Table.Td>
        <TextInput
          readOnly
          value={formatAmount(value)}
          styles={{
            ...cellInput,
            input: {
              ...cellInput.input,
              fontWeight: 600,
              textAlign: "right",
              background: "#fff",
            },
          }}
        />
      </Table.Td>
      {trailingEmpty ? <Table.Td /> : null}
    </Table.Tr>
  );
}

function GroupGrandTotal({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "credit" | "debit";
}) {
  const color = accent === "credit" ? "#047857" : "#b91c1c";
  return (
    <Group
      justify="flex-end"
      gap="sm"
      mt="md"
      pt="sm"
      style={{ borderTop: "1px solid #e2e8f0" }}
    >
      <Text fw={700} size="sm" style={{ fontFamily: "Inter", color }}>
        {label}
      </Text>
      <TextInput
        readOnly
        value={formatAmount(value)}
        w={150}
        styles={{
          input: {
            fontSize: "14px",
            fontFamily: "Inter",
            fontWeight: 700,
            height: "36px",
            textAlign: "right",
            color,
            borderColor: color,
            background: "#fff",
          },
        }}
      />
    </Group>
  );
}

export default function BankReconciliationCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: routeId } = useParams();
  const recordId = routeId ? Number(routeId) : null;
  const isViewMode = location.pathname.includes("/view/");
  const isEditMode = recordId != null && !Number.isNaN(recordId);
  const canPostDocuments = useCanPostDocuments();
  const user = useAuthStore((s) => s.user);
  const dateFormat = useDateFormat();
  const isVietnamBranch = useMemo(() => isVietnamBranchFromUser(user), [user]);
  bindMoneyWholeNumberMode(isVietnamBranch);
  const amountDecimalScale = getAmountDecimalScale(false);
  const appliedRecordIdRef = useRef<number | null>(null);
  // const [fileInputKey, setFileInputKey] = useState(0);
  const [detailLoading, setDetailLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [saveResponse, setSaveResponse] =
    useState<BankReconciliationSaveResponse | null>(null);
  const [chequeIssuedApiTotal, setChequeIssuedApiTotal] = useState<
    number | null
  >(null);
  const [chequeDepositedApiTotal, setChequeDepositedApiTotal] = useState<
    number | null
  >(null);
  const { localCurrency } = useAccountsDocumentCurrencyRoe();

  const { data: currencyData = [] } = useQuery({
    queryKey: ["currencyMaster", "bank-reconciliation"],
    queryFn: async () => {
      try {
        return await getAPICall(`${URL.currencyMaster}`, API_HEADER);
      } catch {
        return [];
      }
    },
    staleTime: Infinity,
  });

  const currencyOptions = useMemo(() => {
    const data = currencyData as {
      id?: number;
      currency_code?: string;
      code?: string;
    }[];
    if (!Array.isArray(data)) return [];
    return data
      .map((item) => {
        const code = (item.currency_code ?? item.code ?? "").toString().trim();
        return { value: code, label: code ? code.toUpperCase() : "" };
      })
      .filter((o) => o.value !== "");
  }, [currencyData]);

  const currencyIdMap = useMemo(() => {
    const data = currencyData as {
      id?: number;
      currency_code?: string;
      code?: string;
    }[];
    if (!Array.isArray(data)) return {} as Record<string, number>;
    const map: Record<string, number> = {};
    data.forEach((item) => {
      const code = (item.currency_code ?? item.code ?? "")
        .toString()
        .trim()
        .toUpperCase();
      if (code && item.id != null) map[code] = Number(item.id);
    });
    return map;
  }, [currencyData]);

  const form = useForm<BankReconciliationForm>({
    initialValues: {
      date: new Date(),
      currency_code: "",
      status: "UNPOSTED",
      bank_balance: null,
      bank_account_id: "",
      bank_account_code: "",
      bank_account_sub_code: "",
      bank_account_name: "",
      as_per_statement: null,
      remarks: "",
      file_name: "",
      cheque_issued: [emptyChequeRow()],
      bank_credit: [emptyBankRow()],
      cheque_deposited: [emptyChequeRow()],
      bank_debit: [emptyBankRow()],
    },
    validate: {
      date: (v) => (!v ? "Date is required" : null),
      bank_account_code: (v) =>
        !v?.trim() ? "Bank account is required" : null,
      as_per_statement: (v) =>
        v === null || v === undefined ? "As per statement is required" : null,
    },
  });

  useEffect(() => {
    if (!localCurrency || form.values.currency_code) return;
    form.setFieldValue("currency_code", localCurrency);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localCurrency]);

  const chequeIssuedTotal = useMemo(
    () => sumAmounts(form.values.cheque_issued),
    [form.values.cheque_issued],
  );
  const bankCreditTotal = useMemo(
    () => sumAmounts(form.values.bank_credit),
    [form.values.bank_credit],
  );
  const chequeDepositedTotal = useMemo(
    () => sumAmounts(form.values.cheque_deposited),
    [form.values.cheque_deposited],
  );
  const bankDebitTotal = useMemo(
    () => sumAmounts(form.values.bank_debit),
    [form.values.bank_debit],
  );

  const chequeIssuedSectionTotal = chequeIssuedApiTotal ?? chequeIssuedTotal;
  const chequeDepositedSectionTotal =
    chequeDepositedApiTotal ?? chequeDepositedTotal;

  const creditTotal = useMemo(
    () => chequeIssuedSectionTotal + bankCreditTotal,
    [chequeIssuedSectionTotal, bankCreditTotal],
  );

  const debitTotal = useMemo(
    () => chequeDepositedSectionTotal + bankDebitTotal,
    [chequeDepositedSectionTotal, bankDebitTotal],
  );

  const grandTotal = useMemo(() => {
    const bankBalance = Number(form.values.bank_balance) || 0;
    return bankBalance + creditTotal - debitTotal;
  }, [form.values.bank_balance, creditTotal, debitTotal]);

  const differenceAmount = useMemo(() => {
    const statement = Number(form.values.as_per_statement);
    if (!Number.isFinite(statement)) return 0;
    return Math.round((grandTotal - statement) * 100) / 100;
  }, [grandTotal, form.values.as_per_statement]);

  const isReadOnly =
    isViewMode ||
    String(saveResponse?.status ?? form.values.status).toUpperCase() ===
      "POSTED";

  const pageTitle = isViewMode
    ? "View Bank Reconciliation"
    : isEditMode
      ? "Edit Bank Reconciliation"
      : "Create Bank Reconciliation";

  const displayStatus =
    saveResponse?.status ?? form.values.status ?? "UNPOSTED";
  const displayBrsNo = saveResponse?.brs_no ?? "";

  const validRecordId =
    isEditMode && recordId != null && !Number.isNaN(recordId) ? recordId : null;

  const {
    data: brsRecord,
    isLoading: isBrsFetching,
    isError: isBrsFetchError,
  } = useQuery({
    queryKey: ["bankReconciliation-detail", validRecordId],
    enabled: validRecordId != null,
    queryFn: async (): Promise<BankReconciliationRecord> => {
      const response = await getAPICall(
        `${URL.bankReconciliation}${validRecordId}/`,
        API_HEADER,
      );
      const res = response as
        { data?: BankReconciliationRecord } | BankReconciliationRecord;
      const data =
        res && typeof res === "object" && "data" in res && res.data
          ? res.data
          : (res as BankReconciliationRecord);
      if (!data?.id) {
        throw new Error("Bank reconciliation record not found");
      }
      return data;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  useEffect(() => {
    appliedRecordIdRef.current = null;
  }, [validRecordId]);

  useEffect(() => {
    if (!brsRecord?.id) return;
    if (appliedRecordIdRef.current === brsRecord.id) return;
    appliedRecordIdRef.current = brsRecord.id;

    const issuedLines = Array.isArray(brsRecord.cheque_issued_lines)
      ? brsRecord.cheque_issued_lines
      : [];
    const depositedLines = Array.isArray(brsRecord.cheque_deposited_lines)
      ? brsRecord.cheque_deposited_lines
      : [];
    const bankCreditLines = Array.isArray(brsRecord.bank_credit_lines)
      ? brsRecord.bank_credit_lines
      : [];
    const bankDebitLines = Array.isArray(brsRecord.bank_debit_lines)
      ? brsRecord.bank_debit_lines
      : [];

    form.setValues({
      date: parseApiDate(brsRecord.brs_date) ?? new Date(),
      currency_code: String(brsRecord.currency_code ?? "")
        .trim()
        .toUpperCase(),
      status: brsRecord.status ?? "UNPOSTED",
      bank_balance: parseAmount(brsRecord.bank_balance),
      bank_account_id: "",
      bank_account_code: String(brsRecord.account_code ?? "").trim(),
      bank_account_sub_code: String(brsRecord.subledger ?? "").trim() || "0",
      bank_account_name: String(brsRecord.account_name ?? "").trim(),
      as_per_statement: parseAmount(brsRecord.as_per_statement),
      remarks: String(brsRecord.remarks ?? "").trim(),
      file_name: "",
      cheque_issued:
        issuedLines.length > 0
          ? issuedLines.map((line) => mapChequeLineToRow(line, "paid_to"))
          : [emptyChequeRow()],
      cheque_deposited:
        depositedLines.length > 0
          ? depositedLines.map((line) =>
              mapChequeLineToRow(line, "received_from"),
            )
          : [emptyChequeRow()],
      bank_credit:
        bankCreditLines.length > 0
          ? bankCreditLines.map(mapBankLineFromApi)
          : [emptyBankRow()],
      bank_debit:
        bankDebitLines.length > 0
          ? bankDebitLines.map(mapBankLineFromApi)
          : [emptyBankRow()],
    });

    setChequeIssuedApiTotal(parseAmount(brsRecord.cheque_issued_total) ?? 0);
    setChequeDepositedApiTotal(
      parseAmount(brsRecord.cheque_deposited_total) ?? 0,
    );
    setSaveResponse({
      id: brsRecord.id,
      brs_no: brsRecord.brs_no,
      status: brsRecord.status,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brsRecord]);

  useEffect(() => {
    if (!isBrsFetchError) return;
    ToastNotification({
      type: "error",
      message: "Failed to load bank reconciliation",
    });
    navigate("/bank-reconciliation");
  }, [isBrsFetchError, navigate]);

  const pageLoading = Boolean(validRecordId && isBrsFetching);

  const resolveCurrencyId = (): number | null => {
    const code = String(form.values.currency_code ?? "")
      .trim()
      .toUpperCase();
    if (!code) return null;
    const id = currencyIdMap[code];
    return id != null && Number.isFinite(id) ? id : null;
  };

  const buildSavePayload = (overrideStatus?: string) => {
    const filterBankLines = (rows: BankEntryRow[]) =>
      rows.filter(
        (row) =>
          Boolean(row.narration?.trim()) ||
          Boolean(row.our_reference?.trim()) ||
          row.amount != null,
      );

    const mapIssuedLine = (row: ChequeNotClearedRow) => ({
      date: formatDateDDMMYYYY(row.date) || null,
      daybook_id: row.daybook_id,
      document_no: row.document_no,
      cheque_no: row.cheque_no,
      cheque_date: formatDateDDMMYYYY(row.cheque_date) || null,
      paid_to: row.party,
      amount: row.amount ?? 0,
    });

    const mapDepositedLine = (row: ChequeNotClearedRow) => ({
      date: formatDateDDMMYYYY(row.date) || null,
      daybook_id: row.daybook_id,
      document_no: row.document_no,
      cheque_no: row.cheque_no,
      cheque_date: formatDateDDMMYYYY(row.cheque_date) || null,
      received_from: row.party,
      amount: row.amount ?? 0,
    });

    const mapBankLine = (row: BankEntryRow) => ({
      date: formatDateDDMMYYYY(row.date) || null,
      narration: row.narration,
      our_reference: row.our_reference,
      amount: row.amount ?? 0,
    });

    const values = form.values;

    return {
      ...(saveResponse?.id ? { id: saveResponse.id } : {}),
      brs_date: formatDateDDMMYYYY(values.date),
      account_code: values.bank_account_code,
      subledger: values.bank_account_sub_code.trim() || "0",
      currency_id: resolveCurrencyId(),
      as_per_statement: values.as_per_statement ?? 0,
      bank_balance: values.bank_balance ?? 0,
      cheque_issued_total: chequeIssuedSectionTotal,
      bank_credit_total: bankCreditTotal,
      cheque_deposited_total: chequeDepositedSectionTotal,
      bank_debit_total: bankDebitTotal,
      credit_total: creditTotal,
      debit_total: debitTotal,
      grand_total: grandTotal,
      difference_amount: differenceAmount,
      status: overrideStatus ?? values.status ?? "UNPOSTED",
      remarks: values.remarks ?? "",
      cheque_issued_lines: values.cheque_issued
        .filter((row) => row.document_no?.trim() || row.amount != null)
        .map(mapIssuedLine),
      bank_credit_lines: filterBankLines(values.bank_credit).map(mapBankLine),
      cheque_deposited_lines: values.cheque_deposited
        .filter((row) => row.document_no?.trim() || row.amount != null)
        .map(mapDepositedLine),
      bank_debit_lines: filterBankLines(values.bank_debit).map(mapBankLine),
    };
  };

  // const handleFilePick = (file: File | null) => {
  //   form.setFieldValue("file_name", file?.name ?? "");
  // };

  const handleGetDetail = async () => {
    const accountCode = form.values.bank_account_code.trim();
    if (!accountCode) {
      ToastNotification({
        type: "error",
        message: "Please select a bank account",
      });
      return;
    }
    if (!form.values.date) {
      ToastNotification({
        type: "error",
        message: "Please select a date",
      });
      return;
    }

    const payload = {
      account_code: accountCode,
      subledger: form.values.bank_account_sub_code.trim() || "0",
      as_on_date: formatDateDDMMYYYY(form.values.date),
    };

    setDetailLoading(true);
    try {
      const response = (await postAPICall(
        URL.bankReconciliationGetDetail,
        payload,
        API_HEADER,
      )) as BankReconciliationGetDetailResponse;

      if (!response?.status || !response.data) {
        ToastNotification({
          type: "error",
          message:
            response?.message ?? "Failed to fetch bank reconciliation detail",
        });
        return;
      }

      const data = response.data;
      const issuedLines = Array.isArray(data.cheque_issued_lines)
        ? data.cheque_issued_lines
        : [];
      const depositedLines = Array.isArray(data.cheque_deposited_lines)
        ? data.cheque_deposited_lines
        : [];

      form.setFieldValue("bank_balance", parseAmount(data.bank_balance));
      form.setFieldValue(
        "bank_account_name",
        String(data.account_name ?? form.values.bank_account_name).trim(),
      );
      form.setFieldValue(
        "cheque_issued",
        issuedLines.length > 0
          ? issuedLines.map((line) => mapChequeLineToRow(line, "paid_to"))
          : [emptyChequeRow()],
      );
      form.setFieldValue(
        "cheque_deposited",
        depositedLines.length > 0
          ? depositedLines.map((line) =>
              mapChequeLineToRow(line, "received_from"),
            )
          : [emptyChequeRow()],
      );

      setChequeIssuedApiTotal(parseAmount(data.cheque_issued_lines_total) ?? 0);
      setChequeDepositedApiTotal(
        parseAmount(data.cheque_deposited_lines_total) ?? 0,
      );

      const currencyFromLine =
        issuedLines[0]?.currency_code ?? depositedLines[0]?.currency_code;
      if (currencyFromLine) {
        const code = String(currencyFromLine).trim().toUpperCase();
        const exists = currencyOptions.some(
          (o) => o.value.toUpperCase() === code,
        );
        if (exists) {
          form.setFieldValue("currency_code", code);
        }
      } else if (!form.values.currency_code && localCurrency) {
        form.setFieldValue("currency_code", localCurrency);
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to fetch bank reconciliation detail";
      ToastNotification({ type: "error", message });
    } finally {
      setDetailLoading(false);
    }
  };

  const resetDetailTotals = () => {
    setChequeIssuedApiTotal(null);
    setChequeDepositedApiTotal(null);
  };

  // const handleUpload = () => {
  //   ToastNotification({
  //     type: "info",
  //     message: "Upload will be available once API is integrated",
  //   });
  // };

  const handleSave = async () => {
    const result = form.validate();
    if (result.hasErrors) {
      ToastNotification({
        type: "error",
        message: "Please fill all required fields",
      });
      return;
    }

    if (form.values.bank_balance == null && !saveResponse?.id) {
      ToastNotification({
        type: "error",
        message:
          "Please click Get Detail to load bank balance and cheque lines",
      });
      return;
    }

    const currencyId = resolveCurrencyId();
    if (!currencyId) {
      ToastNotification({
        type: "error",
        message: "Please select a valid currency",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = buildSavePayload("UNPOSTED");
      let response: unknown;

      if (saveResponse?.id) {
        response = await apiCallProtected.put(
          `${URL.bankReconciliation}${saveResponse.id}/`,
          payload,
          API_HEADER,
        );
      } else {
        response = await postAPICall(
          URL.bankReconciliation,
          payload,
          API_HEADER,
        );
      }

      const res = response as {
        data?: BankReconciliationSaveResponse & { brs_no?: string };
        id?: number;
        brs_no?: string;
        status?: string;
      };
      const data = res?.data ?? res;

      if (data?.id) {
        setSaveResponse({
          id: data.id,
          brs_no: data.brs_no,
          status: data.status ?? "UNPOSTED",
        });
        form.setFieldValue("status", data.status ?? "UNPOSTED");
      }

      ToastNotification({
        type: "success",
        message: saveResponse?.id
          ? "Bank reconciliation updated successfully"
          : "Bank reconciliation saved successfully",
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to save bank reconciliation";
      ToastNotification({ type: "error", message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePost = async () => {
    if (!saveResponse?.id) {
      ToastNotification({
        type: "error",
        message: "Save the bank reconciliation first before posting",
      });
      return;
    }

    const result = form.validate();
    if (result.hasErrors) {
      ToastNotification({
        type: "error",
        message: "Please fill all required fields",
      });
      return;
    }

    const currencyId = resolveCurrencyId();
    if (!currencyId) {
      ToastNotification({
        type: "error",
        message: "Please select a valid currency",
      });
      return;
    }

    setIsPosting(true);
    try {
      const payload = buildSavePayload("POSTED");
      const response = await apiCallProtected.put(
        `${URL.bankReconciliation}${saveResponse.id}/`,
        payload,
        API_HEADER,
      );

      const res = response as unknown as {
        data?: BankReconciliationSaveResponse;
        status?: string;
      };
      const data = res?.data ?? res;

      setSaveResponse((prev) => ({
        ...prev,
        id: prev?.id ?? saveResponse.id,
        brs_no: prev?.brs_no,
        status: data?.status ?? "POSTED",
      }));
      form.setFieldValue("status", data?.status ?? "POSTED");

      ToastNotification({
        type: "success",
        message: "Bank reconciliation posted successfully",
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to post bank reconciliation";
      ToastNotification({ type: "error", message });
    } finally {
      setIsPosting(false);
    }
  };

  // const handleDocument = () => {
  //   ToastNotification({
  //     type: "info",
  //     message: "Document attachment will be available once API is integrated",
  //   });
  // };

  const renderChequeGrid = (
    field: "cheque_issued" | "cheque_deposited",
    partyLabel: string,
    sectionTotal: number,
  ) => {
    const rows = form.values[field];
    return (
      <Box style={sectionBoxStyle}>
        <Box style={{ overflowX: "auto" }}>
          <Table
            horizontalSpacing={4}
            verticalSpacing={2}
            style={{ minWidth: 940 }}
          >
            <Table.Thead>
              <Table.Tr style={{ background: "#f8fafc" }}>
                <Table.Th w={40}>SNo</Table.Th>
                <Table.Th w={110}>Date</Table.Th>
                <Table.Th w={90}>Daybook</Table.Th>
                <Table.Th w={140}>Document No</Table.Th>
                <Table.Th w={100}>Cheque No</Table.Th>
                <Table.Th w={110}>Cheque Date</Table.Th>
                <Table.Th w={120}>Cheque Clr Date</Table.Th>
                <Table.Th w={160}>{partyLabel}</Table.Th>
                <Table.Th w={110}>Amount</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((row, index) => (
                <Table.Tr key={`${field}-${index}`}>
                  <Table.Td>
                    <Text size="xs" ta="center">
                      {index + 1}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <TextInput
                      readOnly
                      value={formatDateDisplay(row.date, dateFormat)}
                      styles={cellInput}
                    />
                  </Table.Td>
                  <Table.Td>
                    <TextInput
                      readOnly
                      value={row.daybook}
                      styles={cellInput}
                    />
                  </Table.Td>
                  <Table.Td>
                    <TextInput
                      readOnly
                      value={row.document_no}
                      styles={cellInput}
                    />
                  </Table.Td>
                  <Table.Td>
                    <TextInput
                      readOnly
                      value={row.cheque_no}
                      styles={cellInput}
                    />
                  </Table.Td>
                  <Table.Td>
                    <TextInput
                      readOnly
                      value={formatDateDisplay(row.cheque_date, dateFormat)}
                      styles={cellInput}
                    />
                  </Table.Td>
                  <Table.Td>
                    <TextInput
                      readOnly
                      value={formatDateDisplay(row.cheque_clr_date, dateFormat)}
                      styles={cellInput}
                    />
                  </Table.Td>
                  <Table.Td>
                    <TextInput readOnly value={row.party} styles={cellInput} />
                  </Table.Td>
                  <Table.Td>
                    <TextInput
                      readOnly
                      value={row.amount != null ? formatAmount(row.amount) : ""}
                      styles={cellInput}
                    />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
            <Table.Tfoot>
              <AmountColumnTotal
                label="Total"
                value={sectionTotal}
                colSpan={8}
              />
            </Table.Tfoot>
          </Table>
        </Box>
      </Box>
    );
  };

  const renderBankGrid = (field: "bank_credit" | "bank_debit") => {
    const rows = form.values[field];
    return (
      <Box style={sectionBoxStyle}>
        <Box style={{ overflowX: "auto" }}>
          <Table
            horizontalSpacing={4}
            verticalSpacing={2}
            style={{ minWidth: 860 }}
          >
            <Table.Thead>
              <Table.Tr style={{ background: "#f8fafc" }}>
                <Table.Th w={40}>SNo</Table.Th>
                <Table.Th w={110}>Date</Table.Th>
                <Table.Th w={220}>
                  <RequiredLabel label="Narration" required />
                </Table.Th>
                <Table.Th w={100}>Cheque No</Table.Th>
                <Table.Th w={120}>Cheque Clr Date</Table.Th>
                <Table.Th w={140}>Our Reference</Table.Th>
                <Table.Th w={110}>
                  <RequiredLabel label="Amount" required />
                </Table.Th>
                <Table.Th w={72}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((_, index) => (
                <Table.Tr key={`${field}-${index}`}>
                  <Table.Td>
                    <Text size="xs" ta="center">
                      {index + 1}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <SingleDateInput
                      value={rows[index].date}
                      onChange={(date) =>
                        form.setFieldValue(`${field}.${index}.date`, date)
                      }
                      styles={cellInput}
                      disabled={isReadOnly}
                    />
                  </Table.Td>
                  <Table.Td>
                    <TextInput
                      value={rows[index].narration}
                      onChange={(e) =>
                        form.setFieldValue(
                          `${field}.${index}.narration`,
                          e.currentTarget.value,
                        )
                      }
                      styles={cellInput}
                      readOnly={isReadOnly}
                    />
                  </Table.Td>
                  <Table.Td>
                    <TextInput
                      value={rows[index].cheque_no}
                      onChange={(e) =>
                        form.setFieldValue(
                          `${field}.${index}.cheque_no`,
                          e.currentTarget.value,
                        )
                      }
                      styles={cellInput}
                      readOnly={isReadOnly}
                    />
                  </Table.Td>
                  <Table.Td>
                    <SingleDateInput
                      value={rows[index].cheque_clr_date}
                      onChange={(date) =>
                        form.setFieldValue(
                          `${field}.${index}.cheque_clr_date`,
                          date,
                        )
                      }
                      styles={cellInput}
                      disabled={isReadOnly}
                    />
                  </Table.Td>
                  <Table.Td>
                    <TextInput
                      value={rows[index].our_reference}
                      onChange={(e) =>
                        form.setFieldValue(
                          `${field}.${index}.our_reference`,
                          e.currentTarget.value,
                        )
                      }
                      styles={cellInput}
                      readOnly={isReadOnly}
                    />
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      value={rows[index].amount ?? undefined}
                      onChange={(v) =>
                        form.setFieldValue(
                          `${field}.${index}.amount`,
                          typeof v === "number" ? v : null,
                        )
                      }
                      decimalScale={amountDecimalScale}
                      hideControls
                      styles={cellInput}
                      readOnly={isReadOnly}
                    />
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4} wrap="nowrap" justify="center">
                      {!isReadOnly ? (
                        <>
                          <ActionIcon
                            variant="subtle"
                            color="#105476"
                            size="sm"
                            onClick={() =>
                              form.insertListItem(
                                field,
                                emptyBankRow(),
                                index + 1,
                              )
                            }
                          >
                            <IconPlus size={14} />
                          </ActionIcon>
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            size="sm"
                            disabled={rows.length <= 1}
                            onClick={() => form.removeListItem(field, index)}
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        </>
                      ) : null}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
            <Table.Tfoot>
              <AmountColumnTotal
                label="Total"
                value={sumAmounts(rows)}
                colSpan={6}
                trailingEmpty
              />
            </Table.Tfoot>
          </Table>
        </Box>
      </Box>
    );
  };

  if (pageLoading) {
    return (
      <Box
        p="md"
        style={{
          background: "#F0F4F8",
          minHeight: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Center>
          <Loader color="#105476" />
        </Center>
      </Box>
    );
  }

  return (
    <Box p="md" style={{ background: "#F0F4F8", minHeight: "100%" }}>
      <Group justify="space-between" mb="md" align="flex-start" wrap="wrap">
        <Group gap="sm">
          <Button
            variant="default"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate("/bank-reconciliation")}
          >
            Back
          </Button>
          <Text fw={700} size="lg" style={{ fontFamily: "Inter" }}>
            {pageTitle}
          </Text>
        </Group>
        <Group gap="md" wrap="wrap" align="center">
          <Button
            variant="default"
            onClick={() => void handleGetDetail()}
            loading={detailLoading}
            disabled={isReadOnly}
            leftSection={detailLoading ? <Loader size={14} /> : undefined}
          >
            Get Detail
          </Button>
          {displayBrsNo ? (
            <Group gap="sm" wrap="nowrap">
              <Text size="sm" style={{ fontFamily: "Inter" }}>
                <Text span fw={600}>
                  BRS No:{" "}
                </Text>
                {displayBrsNo}
              </Text>
              <Badge
                size="sm"
                variant="light"
                color={receiptStatusBadgeColor(displayStatus)}
                styles={{ root: { textTransform: "none" } }}
              >
                {displayStatus}
              </Badge>
            </Group>
          ) : null}
        </Group>
      </Group>

      <Box mb="md" style={panelStyle}>
        <Grid gutter="sm" align="flex-start">
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Box>
              <SearchableSelect
                label="Bank Account"
                withAsterisk
                apiEndpoint={URL.chartOfAccounts}
                value={form.values.bank_account_id || null}
                displayValue={form.values.bank_account_name || null}
                placeholder="Search bank account"
                minSearchLength={1}
                dropdownZIndex={1100}
                searchFields={[
                  "account_name",
                  "gl_name",
                  "gl_account_code",
                  "sl_code",
                ]}
                returnOriginalData
                disabled={isReadOnly}
                displayFormat={(item: Record<string, unknown>) => {
                  const i = item as {
                    id?: number;
                    gl_name?: string;
                    gl_account_code?: string;
                    account_name?: string;
                  };
                  return {
                    value: String(i?.id ?? ""),
                    label: formatChartOfAccountsLabel(
                      String(i?.gl_name ?? "").trim(),
                      String(i?.gl_account_code ?? "").trim(),
                      String(i?.account_name ?? "").trim(),
                    ),
                  };
                }}
                onChange={(value, _selected, originalData) => {
                  resetDetailTotals();
                  if (!value || !originalData) {
                    form.setFieldValue("bank_account_id", "");
                    form.setFieldValue("bank_account_code", "");
                    form.setFieldValue("bank_account_sub_code", "");
                    form.setFieldValue("bank_account_name", "");
                    form.setFieldValue("bank_balance", null);
                    form.setFieldValue("cheque_issued", [emptyChequeRow()]);
                    form.setFieldValue("cheque_deposited", [emptyChequeRow()]);
                    return;
                  }

                  const orig = originalData as {
                    gl_account_code?: string;
                    sl_code?: string;
                    account_name?: string;
                  };
                  const glAccountCode = String(
                    orig.gl_account_code ?? "",
                  ).trim();
                  const subCode = String(orig.sl_code ?? "").trim() || "0";
                  const accountName = String(orig.account_name ?? "").trim();

                  form.setFieldValue("bank_account_id", String(value));
                  form.setFieldValue("bank_account_code", glAccountCode);
                  form.setFieldValue("bank_account_sub_code", subCode);
                  form.setFieldValue("bank_account_name", accountName);
                  form.setFieldValue("bank_balance", null);
                  form.setFieldValue("cheque_issued", [emptyChequeRow()]);
                  form.setFieldValue("cheque_deposited", [emptyChequeRow()]);

                  if (!form.values.currency_code && localCurrency) {
                    form.setFieldValue("currency_code", localCurrency);
                  }
                }}
                error={form.errors.bank_account_code as string | undefined}
                styles={inputStyles}
              />
              {/* {form.values.bank_account_code ? (
                <Text size="xs" c="dimmed" mt={4} style={{ lineHeight: 1.3 }}>
                  {[
                    form.values.bank_account_code,
                    form.values.bank_account_sub_code,
                  ]
                    .filter(Boolean)
                    .join(" - ")}
                </Text>
              ) : null} */}
            </Box>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 2 }}>
            <SingleDateInput
              label="Date"
              withAsterisk
              value={form.values.date}
              onChange={(date) => form.setFieldValue("date", date)}
              styles={inputStyles}
              error={form.errors.date as string | undefined}
              disabled={isReadOnly}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 1 }}>
            <Select
              label="Currency"
              placeholder="Cur"
              data={currencyOptions}
              value={form.values.currency_code || null}
              onChange={(v) => form.setFieldValue("currency_code", v ?? "")}
              searchable
              styles={inputStyles}
              disabled={isReadOnly}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 2 }}>
            <NumberInput
              label="As Per Statement"
              withAsterisk
              value={form.values.as_per_statement ?? undefined}
              onChange={(v) =>
                form.setFieldValue(
                  "as_per_statement",
                  typeof v === "number" ? v : null,
                )
              }
              decimalScale={amountDecimalScale}
              hideControls
              error={form.errors.as_per_statement}
              styles={inputStyles}
              readOnly={isReadOnly}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 2 }}>
            <NumberInput
              label="Bank Balance"
              value={form.values.bank_balance ?? undefined}
              onChange={(v) =>
                form.setFieldValue(
                  "bank_balance",
                  typeof v === "number" ? v : null,
                )
              }
              decimalScale={amountDecimalScale}
              hideControls
              readOnly
              styles={inputStyles}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 2 }}>
            <TextInput
              label="Remarks"
              placeholder="Enter remarks"
              value={form.values.remarks}
              onChange={(e) =>
                form.setFieldValue("remarks", e.currentTarget.value)
              }
              styles={inputStyles}
              readOnly={isReadOnly}
            />
          </Grid.Col>
        </Grid>
      </Box>

      <Stack gap="lg">
        <Box style={creditGroupStyle}>
          <GroupPanelTitle title="" subtitle="" accent="credit" />
          <Stack gap="md">
            <Box>
              <SectionTitle accent="credit">
                Cheque Issued But Not Cleared
              </SectionTitle>
              {renderChequeGrid(
                "cheque_issued",
                "Paid To",
                chequeIssuedSectionTotal,
              )}
            </Box>
            <Box>
              <SectionTitle accent="credit">Bank Credit</SectionTitle>
              {renderBankGrid("bank_credit")}
            </Box>
          </Stack>
          <GroupGrandTotal
            label="Credit Total"
            value={creditTotal}
            accent="credit"
          />
        </Box>

        <Box style={debitGroupStyle}>
          <GroupPanelTitle title="" subtitle="" accent="debit" />
          <Stack gap="md">
            <Box>
              <SectionTitle accent="debit">
                Cheque Deposited But Not Cleared
              </SectionTitle>
              {renderChequeGrid(
                "cheque_deposited",
                "Received From",
                chequeDepositedSectionTotal,
              )}
            </Box>
            <Box>
              <SectionTitle accent="debit">Bank Debit</SectionTitle>
              {renderBankGrid("bank_debit")}
            </Box>
          </Stack>
          <GroupGrandTotal
            label="Debit Total"
            value={debitTotal}
            accent="debit"
          />
        </Box>
      </Stack>

      <Box mt="md" style={summaryPanelStyle}>
        <Group justify="flex-end" gap="lg" wrap="wrap" align="flex-end">
          <Group gap="sm" wrap="nowrap">
            <Text
              fw={700}
              size="sm"
              style={{ fontFamily: "Inter", color: "#105476" }}
            >
              Difference Amount
            </Text>
            <TextInput
              readOnly
              value={formatAmount(differenceAmount)}
              w={150}
              styles={{
                input: {
                  fontSize: "14px",
                  fontFamily: "Inter",
                  fontWeight: 700,
                  height: "36px",
                  textAlign: "right",
                  color: "#105476",
                  borderColor: "#105476",
                  background: "#fff",
                },
              }}
            />
          </Group>
          <Group gap="sm" wrap="nowrap">
            <Text
              fw={700}
              size="sm"
              style={{ fontFamily: "Inter", color: "#105476" }}
            >
              Grand Total
            </Text>
            <TextInput
              readOnly
              value={formatAmount(grandTotal)}
              w={150}
              styles={{
                input: {
                  fontSize: "14px",
                  fontFamily: "Inter",
                  fontWeight: 700,
                  height: "36px",
                  textAlign: "right",
                  color: "#105476",
                  borderColor: "#105476",
                  background: "#fff",
                },
              }}
            />
          </Group>
        </Group>
      </Box>

      <Group justify="flex-end" gap="sm" mt="md">
        <Button
          variant="default"
          onClick={() => navigate("/bank-reconciliation")}
        >
          Cancel
        </Button>
        {!isReadOnly && (
          <Button
            color="#105476"
            loading={isSubmitting}
            onClick={() => void handleSave()}
          >
            {saveResponse?.id ? "Update" : "Save"}
          </Button>
        )}
        {saveResponse?.id &&
          canPostDocuments &&
          String(saveResponse.status ?? "").toUpperCase() === "UNPOSTED" && (
            <Button
              color="black"
              loading={isPosting}
              onClick={() => void handlePost()}
            >
              Post
            </Button>
          )}
      </Group>
    </Box>
  );
}
