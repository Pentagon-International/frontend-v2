import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActionIcon,
  Box,
  Button,
  Card,
  Checkbox,
  Divider,
  Grid,
  Group,
  Modal,
  ScrollArea,
  Stack,
  Switch,
  Table,
  Text,
  Badge,
} from "@mantine/core";
import { IconPaperclip, IconPlus, IconSearch, IconTrash } from "@tabler/icons-react";
import { useDisclosure } from "@mantine/hooks";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Dropdown,
  FormMultiSelect,
  FormTextArea,
  FormTextInput,
  SearchableSelect,
  SingleDateInput,
  ToastNotification,
} from "../../../components";
import SupportingDocumentsModal from "../../../components/SupportingDocumentsModal";
import { getAPICall } from "../../../service/getApiCall";
import { postAPICall } from "../../../service/postApiCall";
import { URL } from "../../../api/serverUrls";
import { API_HEADER } from "../../../store/storeKeys";
import useAuthStore from "../../../store/authStore";
import {
  buildAddressLine,
  searchGstinByPan,
  allAttestrAddressesEmpty,
  hasUsableAttestrAddress,
  type AttestrGstinRecord,
} from "../../../service/attestrGstin.service";
import {
  submitCustomerVerification,
  extractApiErrorMessage,
} from "../../../service/customerPanApproval.service";
import {
  EMPTY_SUPPORTING_DOCUMENT,
  validateSupportingDocumentSizes,
  type SupportingDocument,
} from "../../../utils/customerVerificationFormData";
import { isIndianUserFromProfile } from "../../../utils/userNumberFormat";
import {
  buildPanManualCreateFallbackState,
  indiaManualCreatePath,
  panManualCreateFallbackMessage,
} from "../../../utils/panManualCreateFallback";

const TERM_CODE_OPTIONS = [
  { label: "Credit", value: "CREDIT" },
  { label: "Cash", value: "CASH" },
  { label: "Prepaid", value: "PREPAID" },
];

const TWO_DECIMAL_INPUT_REGEX = /^\d*(\.\d{0,2})?$/;

/** Used when mobile/email are left blank in the additional-details modal. */
const DUMMY_MOBILE_NO = "9999999999";
const DUMMY_EMAIL = "noreply@dummy.com";

type CustomerTypeRow = {
  customer_type_code: string;
  customer_type_name: string;
  status?: string;
};

type SalespersonRow = {
  sales_person: string;
};

type SalespersonsResponse = {
  success?: boolean;
  data?: SalespersonRow[];
};

type TdsSectionMasterItem = {
  id?: number;
  tds_section_code?: string;
  tds_section_name?: string;
  status?: string;
};

type CurrencyMasterItem = {
  id?: number;
  code?: string;
  currency_code?: string;
  currency_name?: string;
};

type TdsSectionRow = {
  section_id: number | null;
  section_code: string;
  section_name: string;
  exemption_tds: boolean;
  exemption_certificate_no: string;
  tds_percent: string;
  valid_from: Date | null;
  valid_to: Date | null;
  tds_lower_limit: string;
};

type BankDetailRow = {
  currency: string;
  account_no: string;
  account_name: string;
  bank_name: string;
  iban_no: string;
  swift_no: string;
  bank_address: string;
  ifsc_code: string;
};

type AdditionalDetailsForm = {
  customer_type_code: string[];
  term_code: string;
  own_office: string;
  network_id: string;
  network_name: string;
  credit_amount: string;
  credit_day: string;
  assigned_to: string;
  tds_type: string;
  phone_no: string;
  mobile_no: string;
  email: string;
  iec_code: string;
  tan_no: string;
  arn_no: string;
  uin_no: string;
  composite_regular: string;
  sez: boolean;
  sez_valid_date: string | null;
  msme: boolean;
  msme_no: string;
};

type AdditionalDetailsErrors = Partial<
  Record<keyof AdditionalDetailsForm, string>
> & {
  tds_sections?: string;
  bank_details?: string;
};

const emptyTdsSectionRow = (): TdsSectionRow => ({
  section_id: null,
  section_code: "",
  section_name: "",
  exemption_tds: false,
  exemption_certificate_no: "",
  tds_percent: "",
  valid_from: null,
  valid_to: null,
  tds_lower_limit: "",
});

const emptyBankDetailRow = (): BankDetailRow => ({
  currency: "",
  account_no: "",
  account_name: "",
  bank_name: "",
  iban_no: "",
  swift_no: "",
  bank_address: "",
  ifsc_code: "",
});

const EMPTY_ADDITIONAL_DETAILS: AdditionalDetailsForm = {
  customer_type_code: [],
  term_code: "",
  own_office: "true",
  network_id: "",
  network_name: "",
  credit_amount: "",
  credit_day: "",
  assigned_to: "",
  tds_type: "",
  phone_no: "",
  mobile_no: "",
  email: "",
  iec_code: "",
  tan_no: "",
  arn_no: "",
  uin_no: "",
  composite_regular: "",
  sez: false,
  sez_valid_date: null,
  msme: false,
  msme_no: "",
};

function resolveVendorTypeCode(types: CustomerTypeRow[]): string {
  const preferred = ["supplier", "carrier", "transporter"];
  for (const name of preferred) {
    const match = types.find(
      (t) =>
        String(t.customer_type_name ?? "").trim().toLowerCase() === name,
    );
    if (match?.customer_type_code) return match.customer_type_code;
  }
  return types[0]?.customer_type_code ?? "";
}

function resolveLoggedInAssignTo(
  salespersons: SalespersonRow[],
  user: ReturnType<typeof useAuthStore.getState>["user"],
): string {
  if (!user) return "";
  const candidates = [
    String(user.email ?? "").trim().toLowerCase(),
    String(user.full_name ?? "").trim().toLowerCase(),
    String(user.username ?? "").trim().toLowerCase(),
  ].filter(Boolean);

  for (const sp of salespersons) {
    const person = String(sp.sales_person ?? "").trim();
    const norm = person.toLowerCase();
    if (candidates.some((c) => c === norm)) return person;
    if (candidates.some((c) => norm.includes(c) || c.includes(norm))) {
      return person;
    }
  }

  return (
    salespersons[0]?.sales_person ??
    user.full_name ??
    user.email ??
    user.username ??
    ""
  );
}

function formatDateYYYYMMDD(value: Date | null): string | null {
  if (!value) return null;
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateYYYYMMDD(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseOptionalNumber(value: string | undefined): number | null {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeTwoDecimalString(value: string): string {
  const v = value.trim();
  if (!v) return "";
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  return n.toFixed(2);
}

function isBankDetailRowTouched(row: BankDetailRow): boolean {
  return [
    row.currency,
    row.account_no,
    row.account_name,
    row.bank_name,
    row.iban_no,
    row.swift_no,
    row.bank_address,
    row.ifsc_code,
  ].some((value) => String(value ?? "").trim() !== "");
}

function validateAdditionalDetails(
  form: AdditionalDetailsForm,
  tdsSections: TdsSectionRow[],
  bankDetails: BankDetailRow[],
): AdditionalDetailsErrors {
  const errors: AdditionalDetailsErrors = {};

  if (!form.customer_type_code.length) {
    errors.customer_type_code = "Customer type is required";
  }
  if (!form.term_code.trim()) {
    errors.term_code = "Credit type is required";
  }
  if (!form.own_office) {
    errors.own_office = "Own office selection is required";
  }
  if (!form.assigned_to.trim()) {
    errors.assigned_to = "Assign To is required";
  }
  const isCredit =
    form.term_code.trim().toUpperCase() === "CREDIT";
  if (isCredit && !form.credit_amount.trim()) {
    errors.credit_amount = "Credit amount is required";
  } else if (
    form.credit_amount.trim() &&
    !/^\d+(\.\d{1,2})?$/.test(form.credit_amount.trim()) &&
    !/^\d+$/.test(form.credit_amount.trim())
  ) {
    errors.credit_amount = "Enter a valid credit amount";
  }
  if (isCredit && !form.credit_day.trim()) {
    errors.credit_day = "Credit days is required";
  } else if (form.credit_day.trim() && !/^\d+$/.test(form.credit_day.trim())) {
    errors.credit_day = "Enter a valid number of days";
  }
  if (
    form.email.trim() &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
  ) {
    errors.email = "Please enter a valid email address";
  }
  if (form.sez && !form.sez_valid_date) {
    errors.sez_valid_date = "SEZ validity date is required";
  }
  if (form.msme && !form.msme_no.trim()) {
    errors.msme_no = "MSME number is required";
  }

  for (const row of tdsSections) {
    if (row.section_id == null) continue;
    if (!row.exemption_tds) continue;
    if (!row.exemption_certificate_no.trim()) {
      errors.tds_sections = "Exemption certificate number is required";
      break;
    }
    if (!row.tds_percent.trim() || !/^\d+(\.\d{1,2})?$/.test(row.tds_percent.trim())) {
      errors.tds_sections = "Enter a valid TDS %";
      break;
    }
    if (!row.valid_from || !row.valid_to) {
      errors.tds_sections = "Valid from and valid to are required for exemption";
      break;
    }
    if (
      !row.tds_lower_limit.trim() ||
      !/^\d+(\.\d{1,2})?$/.test(row.tds_lower_limit.trim())
    ) {
      errors.tds_sections = "Enter a valid TDS lower limit";
      break;
    }
  }

  for (const row of bankDetails) {
    if (!isBankDetailRowTouched(row)) continue;
    if (
      !row.account_no.trim() ||
      !row.account_name.trim() ||
      !row.bank_name.trim() ||
      !row.ifsc_code.trim()
    ) {
      errors.bank_details =
        "Account number, account name, bank name and IFSC are required for filled bank rows";
      break;
    }
  }

  return errors;
}

function buildAddressEntry(
  record: AttestrGstinRecord,
  pan: string,
  addressType: "Primary" | "Secondary",
  details: AdditionalDetailsForm,
) {
  const addr = record.primaryAddress ?? {};
  const addressLine = buildAddressLine(addr);
  const lat = Number(addr.latitude);
  const lng = Number(addr.longitude);

  return {
    customer_location: addr.district || addr.locality || "",
    address_type: addressType,
    address: addressLine,
    city: addr.district || "",
    state: addr.state || "",
    country: "India",
    pincode: addr.zip || "",
    phone_no: details.phone_no.trim(),
    mobile_no: details.mobile_no.trim() || DUMMY_MOBILE_NO,
    email: details.email.trim() || DUMMY_EMAIL,
    pan_no: record.pan || pan,
    gst_id: record.gstin || "",
    gst_registration_status: "Registered",
    iec_code: details.iec_code.trim(),
    tan_no: details.tan_no.trim(),
    arn_no: details.arn_no.trim(),
    uin_no: details.uin_no.trim(),
    composite_regular: details.composite_regular,
    sez: details.sez,
    sez_valid_date: details.sez ? details.sez_valid_date : null,
    msme: details.msme,
    msme_no: details.msme ? details.msme_no.trim() : "",
    latitude: Number.isFinite(lat) ? lat : 0,
    longitude: Number.isFinite(lng) ? lng : 0,
  };
}

function buildTdsSectionPayload(rows: TdsSectionRow[]) {
  return rows
    .filter((r) => r.section_id != null)
    .map((r) => ({
      section_id: Number(r.section_id),
      exemption_tds: Boolean(r.exemption_tds),
      exemption_certificate_no: r.exemption_tds
        ? r.exemption_certificate_no.trim() || null
        : null,
      tds_percentage: r.exemption_tds
        ? (() => {
            const v = normalizeTwoDecimalString(r.tds_percent || "");
            return v ? v : null;
          })()
        : null,
      valid_from: r.exemption_tds ? formatDateYYYYMMDD(r.valid_from) : null,
      valid_to: r.exemption_tds ? formatDateYYYYMMDD(r.valid_to) : null,
      tds_lower_limit: r.exemption_tds
        ? (() => {
            const v = normalizeTwoDecimalString(r.tds_lower_limit || "");
            return v ? v : null;
          })()
        : null,
    }));
}

function buildBankDetailsPayload(rows: BankDetailRow[]) {
  return rows.filter(isBankDetailRowTouched).map((row) => ({
    currency: row.currency || "",
    account_no: row.account_no || "",
    account_name: row.account_name || "",
    bank_name: row.bank_name || "",
    iban_no: row.iban_no || null,
    swift_no: row.swift_no || null,
    bank_address: row.bank_address || "",
    ifsc_code: row.ifsc_code || "",
  }));
}

function buildVendorPayload(
  records: AttestrGstinRecord[],
  pan: string,
  details: AdditionalDetailsForm,
  tdsSections: TdsSectionRow[],
  bankDetails: BankDetailRow[],
) {
  const primary = records[0];
  return {
    customer_name: primary.legalName || primary.tradeName || "",
    customer_type_code: details.customer_type_code,
    term_code: details.term_code,
    tds_type: details.tds_type || null,
    own_office: details.own_office === "true",
    status: "ACTIVE",
    assigned_to: details.assigned_to,
    network_id: details.network_id ? Number(details.network_id) : null,
    credit_amount: parseOptionalNumber(details.credit_amount),
    credit_day: parseOptionalNumber(details.credit_day),
    addresses_data: records.map((record, index) =>
      buildAddressEntry(
        record,
        pan,
        index === 0 ? "Primary" : "Secondary",
        details,
      ),
    ),
    bank_details_data: buildBankDetailsPayload(bankDetails),
    tds_section_data: buildTdsSectionPayload(tdsSections),
  };
}

function formatVendorCreateError(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("already exist") ||
    lower.includes("already exists") ||
    lower.includes("customer exist") ||
    lower.includes("vendor exist")
  ) {
    return "This vendor already exists.";
  }
  return message;
}

export default function VendorPanMaster() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isIndiaUser = isIndianUserFromProfile(user?.country);
  const forApprovalPath = "/master/create-vendor";

  useEffect(() => {
    if (!isIndiaUser) {
      navigate("/master/vendor", { replace: true });
    }
  }, [isIndiaUser, navigate]);

  const [panNumber, setPanNumber] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [records, setRecords] = useState<AttestrGstinRecord[]>([]);
  const [selectedGstins, setSelectedGstins] = useState<Set<string>>(new Set());
  const [searchMessage, setSearchMessage] = useState("");
  const [supportingDocuments, setSupportingDocuments] = useState<
    SupportingDocument[]
  >([{ ...EMPTY_SUPPORTING_DOCUMENT }]);
  const [
    documentsModalOpened,
    { open: openDocumentsModal, close: closeDocumentsModal },
  ] = useDisclosure(false);
  const [
    detailsModalOpened,
    { open: openDetailsModal, close: closeDetailsModal },
  ] = useDisclosure(false);
  const [additionalDetails, setAdditionalDetails] =
    useState<AdditionalDetailsForm>(EMPTY_ADDITIONAL_DETAILS);
  const [detailsErrors, setDetailsErrors] = useState<AdditionalDetailsErrors>(
    {},
  );
  const [tdsSections, setTdsSections] = useState<TdsSectionRow[]>([
    emptyTdsSectionRow(),
  ]);
  const [bankDetails, setBankDetails] = useState<BankDetailRow[]>([
    emptyBankDetailRow(),
  ]);

  const { data: customerTypes = [] } = useQuery({
    queryKey: ["customerTypes", "vendor-pan-master", "category=vendor"],
    queryFn: async () => {
      const response = (await getAPICall(
        `${URL.customerType}?category=vendor`,
        API_HEADER,
      )) as
        | { success?: boolean; data?: CustomerTypeRow[] }
        | CustomerTypeRow[];
      if (Array.isArray(response)) {
        return response.filter((t) => t.status !== "INACTIVE");
      }
      if (response?.success && Array.isArray(response.data)) {
        return response.data.filter((t) => t.status !== "INACTIVE");
      }
      return [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: salespersons = [] } = useQuery({
    queryKey: ["salespersons", "vendor-pan-master"],
    queryFn: async () => {
      const response = (await postAPICall(
        URL.salespersons,
        { customer_code: "" },
        API_HEADER,
      )) as SalespersonsResponse;
      return Array.isArray(response?.data) ? response.data : [];
    },
    staleTime: 10 * 60 * 1000,
  });

  const { data: tdsSectionMaster = [] } = useQuery({
    queryKey: ["tdsSectionMaster", "vendor-pan-master"],
    queryFn: async () => {
      try {
        const response = await getAPICall(`${URL.tdsSectionMaster}`, API_HEADER);
        return (response as { data?: unknown[] })?.data ?? response ?? [];
      } catch (error) {
        console.error("Error fetching TDS section master:", error);
        return [];
      }
    },
    staleTime: 10 * 60 * 1000,
  });

  const { data: currencyMasterData = [] } = useQuery({
    queryKey: ["currencyMaster", "vendor-pan-master"],
    queryFn: async () => {
      try {
        const response = await getAPICall(`${URL.currencyMaster}`, API_HEADER);
        const raw = (response as { data?: unknown[] })?.data ?? response;
        return Array.isArray(raw) ? (raw as CurrencyMasterItem[]) : [];
      } catch (error) {
        console.error("Error fetching currency master:", error);
        return [];
      }
    },
    staleTime: Infinity,
  });

  const vendorTypeCode = useMemo(
    () => resolveVendorTypeCode(customerTypes),
    [customerTypes],
  );

  const assignedTo = useMemo(
    () => resolveLoggedInAssignTo(salespersons, user),
    [salespersons, user],
  );

  const goToManualCreate = useCallback(
    (records: AttestrGstinRecord[]) => {
      ToastNotification({
        type: "error",
        message: panManualCreateFallbackMessage("vendor"),
      });
      navigate(indiaManualCreatePath(forApprovalPath), {
        state: buildPanManualCreateFallbackState({
          pan: panNumber.trim().toUpperCase(),
          records,
        }),
      });
    },
    [forApprovalPath, navigate, panNumber],
  );

  const customerTypeOptions = useMemo(
    () =>
      customerTypes.map((t) => ({
        value: t.customer_type_code,
        label: t.customer_type_name,
      })),
    [customerTypes],
  );

  const salespersonOptions = useMemo(
    () =>
      salespersons
        .map((sp) => String(sp.sales_person ?? "").trim())
        .filter(Boolean)
        .map((person) => ({ value: person, label: person })),
    [salespersons],
  );

  const tdsSectionOptions = useMemo(() => {
    const rows = (tdsSectionMaster ?? []) as TdsSectionMasterItem[];
    return rows
      .filter((r) =>
        r.status ? String(r.status).toUpperCase() === "ACTIVE" : true,
      )
      .filter((r) => r.tds_section_code && r.tds_section_name)
      .map((r) => ({
        value: String(r.id ?? ""),
        label: String(r.tds_section_name),
        section_code: String(r.tds_section_code),
      }));
  }, [tdsSectionMaster]);

  const currencyOptions = useMemo(() => {
    return currencyMasterData
      .map((c) => {
        const code = String(c.currency_code ?? c.code ?? "").trim();
        if (!code) return null;
        return { value: code, label: code };
      })
      .filter(Boolean) as { value: string; label: string }[];
  }, [currencyMasterData]);

  const allSelected =
    records.length > 0 && selectedGstins.size === records.length;
  const someSelected =
    selectedGstins.size > 0 && selectedGstins.size < records.length;

  const toggleGstin = useCallback((gstin: string) => {
    setSelectedGstins((prev) => {
      const next = new Set(prev);
      if (next.has(gstin)) next.delete(gstin);
      else next.add(gstin);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedGstins((prev) => {
      if (records.length > 0 && prev.size === records.length) {
        return new Set();
      }
      return new Set(records.map((r) => r.gstin));
    });
  }, [records]);

  const updateAdditionalDetails = useCallback(
    <K extends keyof AdditionalDetailsForm>(
      key: K,
      value: AdditionalDetailsForm[K],
    ) => {
      setAdditionalDetails((prev) => ({ ...prev, [key]: value }));
      setDetailsErrors((prev) => {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    [],
  );

  const updateTdsSection = useCallback(
    <K extends keyof TdsSectionRow>(
      index: number,
      key: K,
      value: TdsSectionRow[K],
    ) => {
      setTdsSections((prev) =>
        prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)),
      );
      setDetailsErrors((prev) => {
        if (!prev.tds_sections) return prev;
        const next = { ...prev };
        delete next.tds_sections;
        return next;
      });
    },
    [],
  );

  const updateBankDetail = useCallback(
    <K extends keyof BankDetailRow>(
      index: number,
      key: K,
      value: BankDetailRow[K],
    ) => {
      setBankDetails((prev) =>
        prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)),
      );
      setDetailsErrors((prev) => {
        if (!prev.bank_details) return prev;
        const next = { ...prev };
        delete next.bank_details;
        return next;
      });
    },
    [],
  );

  const handleSearchClick = async () => {
    const pan = panNumber.trim().toUpperCase();
    if (!pan) {
      ToastNotification({
        type: "error",
        message: "Please enter a PAN number before searching",
      });
      return;
    }

    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
      ToastNotification({
        type: "error",
        message: "Please enter a valid PAN (e.g. AAGCP4765J)",
      });
      return;
    }

    try {
      setIsSearching(true);
      setSelectedGstins(new Set());
      setRecords([]);
      setSearchMessage("");

      const response = await searchGstinByPan(pan);

      if (!response.valid) {
        ToastNotification({
          type: "error",
          message:
            response.message ||
            "No valid GST registrations found for this PAN.",
        });
        return;
      }

      const list = response.records ?? [];
      if (!list.length) {
        ToastNotification({
          type: "info",
          message: "No GST registrations found for this PAN.",
        });
        return;
      }

      if (allAttestrAddressesEmpty(list)) {
        goToManualCreate(list);
        return;
      }

      setRecords(list);
      setSearchMessage(response.message ?? "");
    } catch (error) {
      console.error("Attestr GSTIN search error:", error);
      goToManualCreate([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleOpenDetailsModal = () => {
    const selected = records.filter((r) => selectedGstins.has(r.gstin));
    if (!selected.length) {
      ToastNotification({
        type: "error",
        message:
          "Please select at least one GST registration to create a vendor",
      });
      return;
    }

    if (selected.some((record) => !hasUsableAttestrAddress(record))) {
      goToManualCreate(selected);
      return;
    }

    setAdditionalDetails({
      ...EMPTY_ADDITIONAL_DETAILS,
      customer_type_code: vendorTypeCode ? [vendorTypeCode] : [],
      assigned_to: assignedTo,
    });
    setTdsSections([emptyTdsSectionRow()]);
    setBankDetails([emptyBankDetailRow()]);
    setDetailsErrors({});
    openDetailsModal();
  };

  const handleCreateVendors = async () => {
    const selected = records.filter((r) => selectedGstins.has(r.gstin));
    if (!selected.length) {
      ToastNotification({
        type: "error",
        message:
          "Please select at least one GST registration to create a vendor",
      });
      return;
    }

    const errors = validateAdditionalDetails(
      additionalDetails,
      tdsSections,
      bankDetails,
    );
    if (Object.keys(errors).length > 0) {
      setDetailsErrors(errors);
      ToastNotification({
        type: "error",
        message: "Please fill the required vendor details",
      });
      return;
    }

    setIsCreating(true);

    try {
      const sizeError = validateSupportingDocumentSizes(supportingDocuments);
      if (sizeError) {
        ToastNotification({ type: "error", message: sizeError });
        return;
      }

      const payload = buildVendorPayload(
        selected,
        panNumber.trim().toUpperCase(),
        additionalDetails,
        tdsSections,
        bankDetails,
      );
      if (
        payload.addresses_data.some((addr) => !String(addr.address ?? "").trim())
      ) {
        closeDetailsModal();
        goToManualCreate(selected);
        return;
      }
      const response = (await submitCustomerVerification(
        payload,
        supportingDocuments,
      )) as { message?: string } | null;

      const apiMessage =
        response &&
        typeof response === "object" &&
        typeof response.message === "string" &&
        response.message.trim()
          ? response.message.trim()
          : null;

      ToastNotification({
        type: "success",
        message:
          apiMessage ??
          (selected.length === 1
            ? "Vendor verification submitted successfully."
            : `Vendor verification submitted with ${selected.length} addresses.`),
      });
      closeDetailsModal();
      setPanNumber("");
      setRecords([]);
      setSelectedGstins(new Set());
      setSearchMessage("");
      setSupportingDocuments([{ ...EMPTY_SUPPORTING_DOCUMENT }]);
      setAdditionalDetails({ ...EMPTY_ADDITIONAL_DETAILS });
      setTdsSections([emptyTdsSectionRow()]);
      setBankDetails([emptyBankDetailRow()]);
      setDetailsErrors({});
      navigate("/master/vendor-approval-status", { replace: true });
    } catch (error) {
      const apiMessage = formatVendorCreateError(extractApiErrorMessage(error));
      const isBlankAddressError = /blank|address/i.test(apiMessage);
      if (
        isBlankAddressError &&
        selected.some((record) => !hasUsableAttestrAddress(record))
      ) {
        closeDetailsModal();
        goToManualCreate(selected);
        return;
      }
      ToastNotification({
        type: "error",
        message: apiMessage,
      });
    } finally {
      setIsCreating(false);
    }
  };

  if (!isIndiaUser) {
    return null;
  }

  return (
    <Card shadow="sm" padding="lg" radius="md">
      <Group justify="space-between" mb="md">
        <Text size="md" fw={600}>
          Create Vendor from PAN
        </Text>
      </Group>

      <Group align="flex-end" gap="sm" mt="lg">
        <FormTextInput
          label="PAN Number"
          placeholder="Enter PAN Number"
          format="capital"
          value={panNumber}
          onChange={(e) => setPanNumber(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !isSearching) {
              e.preventDefault();
              void handleSearchClick();
            }
          }}
          style={{ flex: 1, maxWidth: 400 }}
          size="sm"
          maxLength={10}
        />
        <Button
          color="#105476"
          variant="light"
          size="sm"
          onClick={handleSearchClick}
          loading={isSearching}
          aria-label="Search by PAN"
        >
          <IconSearch size={16} />
        </Button>
      </Group>

      {records.length > 0 && (
        <Group gap="md" mt="md">
          <Text size="xs" c="dimmed" />
          {searchMessage && (
            <Text size="xs" c="dimmed">
              {searchMessage}
            </Text>
          )}
        </Group>
      )}

      {records.length > 0 && (
        <Card
          withBorder
          radius="md"
          p={0}
          mt="xl"
          style={{ borderColor: "#e2e8f0", overflow: "hidden" }}
        >
          <ScrollArea.Autosize mah={480}>
            <Table
              striped
              highlightOnHover
              withTableBorder={false}
              horizontalSpacing="lg"
              verticalSpacing="sm"
            >
              <Table.Thead style={{ background: "#f1f5f9" }}>
                <Table.Tr>
                  <Table.Th w={44}>
                    <Checkbox
                      checked={allSelected}
                      indeterminate={someSelected}
                      onChange={toggleSelectAll}
                      aria-label="Select all GSTIN rows"
                    />
                  </Table.Th>
                  <Table.Th w={150}>GSTIN</Table.Th>
                  <Table.Th pl={48} maw={320}>
                    Company Name
                  </Table.Th>
                  <Table.Th>State</Table.Th>
                  <Table.Th>District</Table.Th>
                  <Table.Th>Pin Code</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {records.map((row) => {
                  const selected = selectedGstins.has(row.gstin);
                  return (
                    <Table.Tr
                      key={row.gstin}
                      style={{
                        background: selected ? "#f0f9ff" : undefined,
                        cursor: "pointer",
                      }}
                      onClick={() => toggleGstin(row.gstin)}
                    >
                      <Table.Td onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selected}
                          onChange={() => toggleGstin(row.gstin)}
                          aria-label={`Select ${row.gstin}`}
                        />
                      </Table.Td>
                      <Table.Td>
                        <Text fz={13} fw={600} c="#105476">
                          {row.gstin}
                        </Text>
                      </Table.Td>
                      <Table.Td pl={48}>
                        <Text fz={13} fw={500} lineClamp={2}>
                          {row.legalName || "—"}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text fz={13}>{row.primaryAddress?.state || "—"}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text fz={13}>
                          {row.primaryAddress?.district || "—"}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text fz={13}>{row.primaryAddress?.zip || "—"}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          size="sm"
                          variant="light"
                          color={row.active ? "green" : "gray"}
                        >
                          {row.status || (row.active ? "Active" : "Inactive")}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </ScrollArea.Autosize>
        </Card>
      )}

      {records.length > 0 && (
        <Group justify="flex-end" mt="xl">
          <Button
            variant="outline"
            color="#105476"
            leftSection={<IconPaperclip size={16} />}
            onClick={openDocumentsModal}
          >
            Attach Documents
          </Button>
          <Button
            color="#105476"
            onClick={handleOpenDetailsModal}
            disabled={selectedGstins.size === 0}
          >
            Create Vendor
            {selectedGstins.size > 0 ? ` (${selectedGstins.size})` : ""}
          </Button>
        </Group>
      )}

      <SupportingDocumentsModal
        opened={documentsModalOpened}
        onClose={closeDocumentsModal}
        documents={supportingDocuments}
        onChange={setSupportingDocuments}
        title="Attach Supporting Documents"
      />

      <Modal
        opened={detailsModalOpened}
        onClose={() => !isCreating && closeDetailsModal()}
        title="Additional Vendor Details"
        centered
        size="xl"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Fill India vendor details that are not fetched from GSTIN search.
            These values will be included in the create payload.
          </Text>

          <ScrollArea.Autosize mah="65vh" offsetScrollbars type="auto">
            <Stack gap="lg">
              <div>
                <Text size="sm" fw={600} c="#105476" mb="sm">
                  Vendor details
                </Text>
                <Grid gutter="sm">
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <FormMultiSelect
                      label="Customer Type"
                      withAsterisk
                      placeholder="Select customer type"
                      searchable
                      data={customerTypeOptions}
                      value={additionalDetails.customer_type_code}
                      onChange={(value) =>
                        updateAdditionalDetails("customer_type_code", value)
                      }
                      error={detailsErrors.customer_type_code}
                      dropdownZIndex={1000}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Dropdown
                      label="Credit Type"
                      withAsterisk
                      placeholder="Select credit type"
                      data={TERM_CODE_OPTIONS}
                      value={additionalDetails.term_code || null}
                      onChange={(value) =>
                        updateAdditionalDetails("term_code", value ?? "")
                      }
                      error={detailsErrors.term_code}
                      dropdownZIndex={1000}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Dropdown
                      label="Own Office"
                      withAsterisk
                      placeholder="Select Own Office"
                      data={[
                        { value: "true", label: "Yes" },
                        { value: "false", label: "No" },
                      ]}
                      value={additionalDetails.own_office || null}
                      onChange={(value) =>
                        updateAdditionalDetails("own_office", value ?? "")
                      }
                      error={detailsErrors.own_office}
                      dropdownZIndex={1000}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <SearchableSelect
                      label="Network Name"
                      placeholder="Search network..."
                      apiEndpoint={URL.networkMaster}
                      value={additionalDetails.network_id || null}
                      displayValue={additionalDetails.network_name || null}
                      onChange={(value, selectedData) => {
                        setAdditionalDetails((prev) => ({
                          ...prev,
                          network_id: value ?? "",
                          network_name: selectedData?.label ?? "",
                        }));
                      }}
                      displayFormat={(item: Record<string, unknown>) => ({
                        value: String(item.id ?? ""),
                        label: String(item.network_name ?? ""),
                      })}
                      searchFields={["network_name"]}
                      dropdownZIndex={1000}
                      minSearchLength={1}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <FormTextInput
                      label="Credit Amount"
                      withAsterisk={
                        additionalDetails.term_code.trim().toUpperCase() ===
                        "CREDIT"
                      }
                      placeholder="Enter credit amount"
                      format="normal"
                      value={additionalDetails.credit_amount}
                      onChange={(e) => {
                        const next = e.target.value;
                        if (next === "" || TWO_DECIMAL_INPUT_REGEX.test(next)) {
                          updateAdditionalDetails("credit_amount", next);
                        }
                      }}
                      error={detailsErrors.credit_amount}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <FormTextInput
                      label="Credit Day"
                      withAsterisk={
                        additionalDetails.term_code.trim().toUpperCase() ===
                        "CREDIT"
                      }
                      placeholder="Enter credit days"
                      format="normal"
                      value={additionalDetails.credit_day}
                      onChange={(e) =>
                        updateAdditionalDetails(
                          "credit_day",
                          e.target.value.replace(/\D/g, ""),
                        )
                      }
                      error={detailsErrors.credit_day}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Dropdown
                      label="Assign To"
                      withAsterisk
                      placeholder="Select Salesperson"
                      searchable
                      data={salespersonOptions}
                      nothingFoundMessage="No salespersons found"
                      value={additionalDetails.assigned_to || null}
                      onChange={(value) =>
                        updateAdditionalDetails("assigned_to", value || "")
                      }
                      error={detailsErrors.assigned_to}
                      dropdownZIndex={1000}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Dropdown
                      label="TDS Type"
                      placeholder="Select TDS type"
                      data={[
                        { value: "Company", label: "Company" },
                        { value: "Individual", label: "Individual" },
                        { value: "Partnership", label: "Partnership" },
                      ]}
                      value={additionalDetails.tds_type || null}
                      onChange={(value) =>
                        updateAdditionalDetails("tds_type", value ?? "")
                      }
                      clearable
                      dropdownZIndex={1000}
                    />
                  </Grid.Col>
                </Grid>
              </div>

              <Divider />

              <div>
                <Group justify="space-between" mb="sm">
                  <Text size="sm" fw={600} c="#105476">
                    TDS Section details
                  </Text>
                  <Button
                    variant="outline"
                    size="xs"
                    leftSection={<IconPlus size={14} />}
                    onClick={() =>
                      setTdsSections((prev) => [...prev, emptyTdsSectionRow()])
                    }
                    color="#105476"
                  >
                    Add
                  </Button>
                </Group>
                {detailsErrors.tds_sections && (
                  <Text size="xs" c="red" mb="xs">
                    {detailsErrors.tds_sections}
                  </Text>
                )}
                <Stack gap="md">
                  {tdsSections.map((row, index) => (
                    <Card key={index} withBorder padding="md" radius="md" bg="#fafafa">
                      <Group justify="space-between" align="center" mb="sm">
                        <Text size="sm" fw={600} c="#105476">
                          TDS Section {index + 1}
                        </Text>
                        {tdsSections.length > 1 && (
                          <ActionIcon
                            variant="light"
                            color="red"
                            onClick={() =>
                              setTdsSections((prev) =>
                                prev.filter((_, i) => i !== index),
                              )
                            }
                            aria-label="Remove TDS section"
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        )}
                      </Group>
                      <Grid gutter="sm">
                        <Grid.Col span={{ base: 12, sm: 4 }}>
                          <Dropdown
                            label="Section Name"
                            placeholder="Select section name"
                            searchable
                            data={tdsSectionOptions}
                            value={
                              row.section_id != null ? String(row.section_id) : ""
                            }
                            onChange={(value) => {
                              const selected = tdsSectionOptions.find(
                                (o) => o.value === value,
                              );
                              const sectionId =
                                value != null && value !== ""
                                  ? Number(value)
                                  : null;
                              setTdsSections((prev) =>
                                prev.map((r, i) =>
                                  i === index
                                    ? {
                                        ...r,
                                        section_id: sectionId,
                                        section_code:
                                          selected?.section_code || "",
                                        section_name: selected?.label || "",
                                      }
                                    : r,
                                ),
                              );
                              setDetailsErrors((prev) => {
                                if (!prev.tds_sections) return prev;
                                const next = { ...prev };
                                delete next.tds_sections;
                                return next;
                              });
                            }}
                            dropdownZIndex={1000}
                          />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, sm: 4 }}>
                          <FormTextInput
                            label="Section Code"
                            placeholder="Section code"
                            format="normal"
                            disabled
                            value={row.section_code}
                          />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, sm: 4 }}>
                          <Box pt={28}>
                            <Switch
                              label="Exemption TDS"
                              description={row.exemption_tds ? "Yes" : "No"}
                              checked={row.exemption_tds}
                              onChange={(e) => {
                                const checked = e.currentTarget.checked;
                                setTdsSections((prev) =>
                                  prev.map((r, i) =>
                                    i === index
                                      ? {
                                          ...r,
                                          exemption_tds: checked,
                                          ...(checked
                                            ? {}
                                            : {
                                                exemption_certificate_no: "",
                                                tds_percent: "",
                                                valid_from: null,
                                                valid_to: null,
                                                tds_lower_limit: "",
                                              }),
                                        }
                                      : r,
                                  ),
                                );
                              }}
                            />
                          </Box>
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, sm: 4 }}>
                          <FormTextInput
                            label="Exemption Certificate No"
                            placeholder="Certificate number"
                            format="normal"
                            disabled={!row.exemption_tds}
                            withAsterisk={row.exemption_tds}
                            value={row.exemption_certificate_no}
                            onChange={(e) =>
                              updateTdsSection(
                                index,
                                "exemption_certificate_no",
                                e.target.value,
                              )
                            }
                          />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, sm: 4 }}>
                          <FormTextInput
                            label="TDS %"
                            placeholder="TDS %"
                            format="normal"
                            disabled={!row.exemption_tds}
                            withAsterisk={row.exemption_tds}
                            inputMode="decimal"
                            value={row.tds_percent}
                            onChange={(e) => {
                              const next = e.target.value;
                              if (
                                next === "" ||
                                TWO_DECIMAL_INPUT_REGEX.test(next)
                              ) {
                                updateTdsSection(index, "tds_percent", next);
                              }
                            }}
                          />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, sm: 4 }}>
                          <FormTextInput
                            label="TDS Lower Limit"
                            placeholder="Lower limit"
                            format="normal"
                            disabled={!row.exemption_tds}
                            withAsterisk={row.exemption_tds}
                            inputMode="decimal"
                            value={row.tds_lower_limit}
                            onChange={(e) => {
                              const next = e.target.value;
                              if (
                                next === "" ||
                                TWO_DECIMAL_INPUT_REGEX.test(next)
                              ) {
                                updateTdsSection(
                                  index,
                                  "tds_lower_limit",
                                  next,
                                );
                              }
                            }}
                          />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, sm: 4 }}>
                          <SingleDateInput
                            label="Valid From"
                            placeholder="Select date"
                            disabled={!row.exemption_tds}
                            withAsterisk={row.exemption_tds}
                            value={row.valid_from}
                            onChange={(value) =>
                              updateTdsSection(index, "valid_from", value)
                            }
                          />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, sm: 4 }}>
                          <SingleDateInput
                            label="Valid To"
                            placeholder="Select date"
                            disabled={!row.exemption_tds}
                            withAsterisk={row.exemption_tds}
                            value={row.valid_to}
                            onChange={(value) =>
                              updateTdsSection(index, "valid_to", value)
                            }
                          />
                        </Grid.Col>
                      </Grid>
                    </Card>
                  ))}
                </Stack>
              </div>

              <Divider />

              <div>
                <Group justify="space-between" mb="sm">
                  <Text size="sm" fw={600} c="#105476">
                    Bank Details
                  </Text>
                  <Button
                    variant="outline"
                    size="xs"
                    leftSection={<IconPlus size={14} />}
                    onClick={() =>
                      setBankDetails((prev) => [...prev, emptyBankDetailRow()])
                    }
                    color="#105476"
                  >
                    Add
                  </Button>
                </Group>
                {detailsErrors.bank_details && (
                  <Text size="xs" c="red" mb="xs">
                    {detailsErrors.bank_details}
                  </Text>
                )}
                <Stack gap="md">
                  {bankDetails.map((row, index) => {
                    const rowTouched = isBankDetailRowTouched(row);
                    return (
                      <Card
                        key={index}
                        withBorder
                        padding="md"
                        radius="md"
                        bg="#fafafa"
                      >
                        <Group justify="space-between" align="center" mb="sm">
                          <Text size="sm" fw={600} c="#105476">
                            Bank Detail {index + 1}
                          </Text>
                          {bankDetails.length > 1 && (
                            <ActionIcon
                              variant="light"
                              color="red"
                              onClick={() =>
                                setBankDetails((prev) =>
                                  prev.filter((_, i) => i !== index),
                                )
                              }
                              aria-label="Remove bank detail"
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          )}
                        </Group>
                        <Grid gutter="sm">
                          <Grid.Col span={{ base: 12, sm: 4 }}>
                            <Dropdown
                              label="Currency"
                              placeholder="Select currency"
                              searchable
                              data={currencyOptions}
                              value={row.currency || null}
                              onChange={(value) =>
                                updateBankDetail(
                                  index,
                                  "currency",
                                  value ?? "",
                                )
                              }
                              clearable
                              dropdownZIndex={1000}
                            />
                          </Grid.Col>
                          <Grid.Col span={{ base: 12, sm: 4 }}>
                            <FormTextInput
                              label="Account No"
                              placeholder="Enter account number"
                              format="normal"
                              withAsterisk={rowTouched}
                              value={row.account_no}
                              onChange={(e) =>
                                updateBankDetail(
                                  index,
                                  "account_no",
                                  e.target.value,
                                )
                              }
                            />
                          </Grid.Col>
                          <Grid.Col span={{ base: 12, sm: 4 }}>
                            <FormTextInput
                              label="Account Name"
                              placeholder="Enter account name"
                              withAsterisk={rowTouched}
                              value={row.account_name}
                              onChange={(e) =>
                                updateBankDetail(
                                  index,
                                  "account_name",
                                  e.target.value,
                                )
                              }
                            />
                          </Grid.Col>
                          <Grid.Col span={{ base: 12, sm: 4 }}>
                            <FormTextInput
                              label="Bank Name"
                              placeholder="Enter bank name"
                              withAsterisk={rowTouched}
                              value={row.bank_name}
                              onChange={(e) =>
                                updateBankDetail(
                                  index,
                                  "bank_name",
                                  e.target.value,
                                )
                              }
                            />
                          </Grid.Col>
                          <Grid.Col span={{ base: 12, sm: 4 }}>
                            <FormTextInput
                              label="IBAN No"
                              placeholder="Enter IBAN number"
                              format="capital"
                              value={row.iban_no}
                              onChange={(e) =>
                                updateBankDetail(
                                  index,
                                  "iban_no",
                                  e.target.value,
                                )
                              }
                            />
                          </Grid.Col>
                          <Grid.Col span={{ base: 12, sm: 4 }}>
                            <FormTextInput
                              label="SWIFT No"
                              placeholder="Enter SWIFT code"
                              format="capital"
                              value={row.swift_no}
                              onChange={(e) =>
                                updateBankDetail(
                                  index,
                                  "swift_no",
                                  e.target.value,
                                )
                              }
                            />
                          </Grid.Col>
                          <Grid.Col span={{ base: 12, sm: 4 }}>
                            <FormTextInput
                              label="IFSC Code"
                              placeholder="Enter IFSC code"
                              format="capital"
                              withAsterisk={rowTouched}
                              value={row.ifsc_code}
                              onChange={(e) =>
                                updateBankDetail(
                                  index,
                                  "ifsc_code",
                                  e.target.value,
                                )
                              }
                            />
                          </Grid.Col>
                          <Grid.Col span={{ base: 12, sm: 8 }}>
                            <FormTextArea
                              label="Bank Address"
                              placeholder="Enter bank address"
                              minRows={2}
                              format="initcap"
                              value={row.bank_address}
                              onChange={(e) =>
                                updateBankDetail(
                                  index,
                                  "bank_address",
                                  e.currentTarget.value,
                                )
                              }
                            />
                          </Grid.Col>
                        </Grid>
                      </Card>
                    );
                  })}
                </Stack>
              </div>

              <Divider />

              <div>
                <Text size="sm" fw={600} c="#105476" mb="sm">
                  Contact details
                </Text>
                <Grid gutter="sm">
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <FormTextInput
                      label="Landline Number"
                      placeholder="Enter landline number"
                      format="normal"
                      value={additionalDetails.phone_no}
                      onChange={(e) =>
                        updateAdditionalDetails("phone_no", e.target.value)
                      }
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <FormTextInput
                      label="Mobile Number"
                      placeholder="Enter mobile number"
                      format="normal"
                      value={additionalDetails.mobile_no}
                      onChange={(e) =>
                        updateAdditionalDetails("mobile_no", e.target.value)
                      }
                      error={detailsErrors.mobile_no}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <FormTextInput
                      label="Email Id"
                      placeholder="Enter email address"
                      format="normal"
                      value={additionalDetails.email}
                      onChange={(e) =>
                        updateAdditionalDetails("email", e.target.value)
                      }
                      error={detailsErrors.email}
                    />
                  </Grid.Col>
                </Grid>
              </div>

              <Divider />

              <div>
                <Text size="sm" fw={600} c="#105476" mb="sm">
                  GST details
                </Text>
                <Grid gutter="sm">
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <FormTextInput
                      label="IEC Code"
                      placeholder="Enter IEC Code"
                      format="capital"
                      value={additionalDetails.iec_code}
                      onChange={(e) =>
                        updateAdditionalDetails("iec_code", e.target.value)
                      }
                      error={detailsErrors.iec_code}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <FormTextInput
                      label="TAN No"
                      placeholder="Enter TAN number"
                      format="capital"
                      value={additionalDetails.tan_no}
                      onChange={(e) =>
                        updateAdditionalDetails("tan_no", e.target.value)
                      }
                      error={detailsErrors.tan_no}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <FormTextInput
                      label="ARN No"
                      placeholder="Enter ARN number"
                      format="normal"
                      value={additionalDetails.arn_no}
                      onChange={(e) =>
                        updateAdditionalDetails("arn_no", e.target.value)
                      }
                      error={detailsErrors.arn_no}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <FormTextInput
                      label="UIN No"
                      placeholder="Enter UIN number"
                      format="normal"
                      value={additionalDetails.uin_no}
                      onChange={(e) =>
                        updateAdditionalDetails("uin_no", e.target.value)
                      }
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <Dropdown
                      label="Composite / Regular"
                      placeholder="Select"
                      data={[
                        { value: "composite", label: "Composite" },
                        { value: "Regular", label: "Regular" },
                      ]}
                      value={additionalDetails.composite_regular || null}
                      onChange={(value) =>
                        updateAdditionalDetails(
                          "composite_regular",
                          value ?? "",
                        )
                      }
                      clearable
                      dropdownZIndex={1000}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <Dropdown
                      label="SEZ"
                      placeholder="Select"
                      data={[
                        { value: "Yes", label: "Yes" },
                        { value: "No", label: "No" },
                      ]}
                      value={additionalDetails.sez ? "Yes" : "No"}
                      onChange={(value) => {
                        const enabled = value === "Yes";
                        setAdditionalDetails((prev) => ({
                          ...prev,
                          sez: enabled,
                          sez_valid_date: enabled ? prev.sez_valid_date : null,
                        }));
                        setDetailsErrors((prev) => {
                          const next = { ...prev };
                          delete next.sez;
                          delete next.sez_valid_date;
                          return next;
                        });
                      }}
                      dropdownZIndex={1000}
                    />
                  </Grid.Col>
                  {additionalDetails.sez && (
                    <Grid.Col span={{ base: 12, sm: 4 }}>
                      <SingleDateInput
                        label="SEZ Validity Date"
                        placeholder="Select SEZ validity date"
                        withAsterisk
                        value={parseDateYYYYMMDD(
                          additionalDetails.sez_valid_date,
                        )}
                        onChange={(value) =>
                          updateAdditionalDetails(
                            "sez_valid_date",
                            formatDateYYYYMMDD(value),
                          )
                        }
                        error={detailsErrors.sez_valid_date}
                      />
                    </Grid.Col>
                  )}
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <Dropdown
                      label="MSME"
                      placeholder="Select"
                      data={[
                        { value: "Yes", label: "Yes" },
                        { value: "No", label: "No" },
                      ]}
                      value={additionalDetails.msme ? "Yes" : "No"}
                      onChange={(value) => {
                        const enabled = value === "Yes";
                        setAdditionalDetails((prev) => ({
                          ...prev,
                          msme: enabled,
                          msme_no: enabled ? prev.msme_no : "",
                        }));
                        setDetailsErrors((prev) => {
                          const next = { ...prev };
                          delete next.msme;
                          delete next.msme_no;
                          return next;
                        });
                      }}
                      dropdownZIndex={1000}
                    />
                  </Grid.Col>
                  {additionalDetails.msme && (
                    <Grid.Col span={{ base: 12, sm: 4 }}>
                      <FormTextInput
                        label="MSME No"
                        withAsterisk
                        placeholder="Enter MSME number"
                        format="normal"
                        value={additionalDetails.msme_no}
                        onChange={(e) =>
                          updateAdditionalDetails("msme_no", e.target.value)
                        }
                        error={detailsErrors.msme_no}
                      />
                    </Grid.Col>
                  )}
                </Grid>
              </div>
            </Stack>
          </ScrollArea.Autosize>

          <Divider />
          <Group justify="flex-end" gap="sm">
            <Button
              variant="outline"
              color="#105476"
              onClick={closeDetailsModal}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              color="#105476"
              onClick={handleCreateVendors}
              loading={isCreating}
            >
              Submit for Approval
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Card>
  );
}
