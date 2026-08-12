import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../../../store/authStore";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Divider,
  Grid,
  Group,
  Loader,
  Menu,
  Modal,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import useDateFormat from "../../../hooks/useDateFormat";
import {
  formatDateForUi,
  formatDateTimeForUi,
} from "../../../utils/dateFormat";
import {
  IconCheck,
  IconDotsVertical,
  IconEye,
  IconFilter,
  IconSearch,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import {
  MantineReactTable,
  MRT_ColumnDef,
  useMantineReactTable,
} from "mantine-react-table";
import { useDebouncedValue } from "@mantine/hooks";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dropdown,
  FormTextArea,
  FormTextInput,
  SearchableSelect,
  SingleDateInput,
  ToastNotification,
} from "../../../components";
import PaginationBar from "../../../components/PaginationBar/PaginationBar";
import { URL } from "../../../api/serverUrls";
import {
  approveCustomerPan,
  extractApiErrorMessage,
  fetchCustomerPanPendingList,
  fetchRelatedCustomers,
  formatCustomerPanDisplayValue,
  rejectCustomerPan,
  updateCustomerVerification,
  type CustomerPanApprovalAddress,
  type CustomerPanApprovalFilters,
  type CustomerPanApprovalRow,
  type RelatedCustomer,
} from "../../../service/customerPanApproval.service";
import CustomerDocumentsList from "../../../components/CustomerDocumentsList";
import {
  isIndianUserFromProfile,
  isVietnameseBranch,
  type BranchCurrencyContext,
  type UserCountryProfile,
} from "../../../utils/userNumberFormat";

export type ForeignBranchProfile = {
  isDubaiUser: boolean;
  isKenyaUser: boolean;
  isVietnamUser: boolean;
  isChinaUser: boolean;
};

export function getForeignBranchProfile(
  country?: UserCountryProfile,
  branches?: BranchCurrencyContext[] | null,
): ForeignBranchProfile {
  const defaultBranch = branches?.find((b) => b.is_default) ?? branches?.[0];
  const countryCode = String(country?.country_code ?? "").toUpperCase();
  const countryName = String(country?.country_name ?? "").toLowerCase();

  const isKenyaUser =
    String(defaultBranch?.branch_code ?? "").toUpperCase() === "KE" ||
    countryCode === "KE" ||
    countryName.includes("kenya");

  const isDubaiUser =
    countryCode === "AE" ||
    countryName.includes("united arab emirates") ||
    countryName.includes("uae") ||
    countryName.includes("dubai");

  const isChinaUser =
    countryCode === "CN" || countryName.toUpperCase() === "CHINA";

  const isVietnamUser = isVietnameseBranch(branches);

  return { isDubaiUser, isKenyaUser, isVietnamUser, isChinaUser };
}

function formatCustomerTypesDisplay(row: CustomerPanApprovalRow): string {
  const types = row.customer_types;
  if (!Array.isArray(types) || types.length === 0) return "—";
  const labels = types
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        return String(
          record.customer_type_name ?? record.customer_type_code ?? "",
        ).trim();
      }
      return "";
    })
    .filter(Boolean);
  return labels.length > 0 ? labels.join(", ") : "—";
}

type TableRow = CustomerPanApprovalRow & { sno: number };

type PendingAction = {
  row: CustomerPanApprovalRow;
  type: "approve" | "reject" | "view";
};

const TERM_CODE_OPTIONS = [
  { label: "Credit", value: "CREDIT" },
  { label: "Cash", value: "CASH" },
  { label: "Prepaid", value: "PREPAID" },
];

const MODAL_DROPDOWN_Z_INDEX = 1000;

function normalizeTermCodeValue(termCode?: string | null): string | null {
  const normalized = String(termCode ?? "").trim().toUpperCase();
  if (!normalized) return null;
  return (
    TERM_CODE_OPTIONS.find((option) => option.value === normalized)?.value ??
    normalized
  );
}

const TWO_DECIMAL_INPUT_REGEX = /^\d*(\.\d{0,2})?$/;

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

function cloneApprovalRow(row: CustomerPanApprovalRow): CustomerPanApprovalRow {
  return {
    ...row,
    addresses_data: (row.addresses_data ?? []).map((address) => ({
      ...address,
    })),
    tds_section_data: (row.tds_section_data ?? []).map((item) => ({
      ...item,
    })),
    bank_details_data: (row.bank_details_data ?? []).map((item) => ({
      ...item,
    })),
  };
}

/** Client-side checks before saving an approval-edit row. */
function getApprovalEditValidationError(
  row: CustomerPanApprovalRow,
  requireIndiaTaxIds: boolean,
): string | null {
  const term = String(row.term_code ?? "").trim().toUpperCase();
  if (term === "CREDIT") {
    const days =
      row.credit_day === null || row.credit_day === undefined
        ? ""
        : String(row.credit_day).trim();
    const amount = String(row.credit_amount ?? "").trim();
    if (!days) return "Credit days is required when Credit Type is Credit";
    if (!/^\d+$/.test(days)) return "Enter a valid number of credit days";
    if (!amount) return "Credit amount is required when Credit Type is Credit";
    if (!/^\d+(\.\d{1,2})?$/.test(amount) && !/^\d+$/.test(amount)) {
      return "Enter a valid credit amount";
    }
  }

  if (requireIndiaTaxIds) {
    const addresses = row.addresses_data ?? [];
    for (let i = 0; i < addresses.length; i += 1) {
      const address = addresses[i];
      const label = addresses.length > 1 ? ` (address ${i + 1})` : "";
      if (!String(address.iec_code ?? "").trim()) {
        return `IEC Code is required${label}`;
      }
      if (!String(address.tan_no ?? "").trim()) {
        return `TAN is required${label}`;
      }
      if (!String(address.arn_no ?? "").trim()) {
        return `ARN is required${label}`;
      }
    }
  }

  return null;
}

function buildCustomerVerificationPayload(
  row: CustomerPanApprovalRow,
): Record<string, unknown> {
  return {
    customer_name: row.customer_name ?? "",
    term_code: row.term_code ?? "",
    tds_type: row.tds_type ?? null,
    own_office: Boolean(row.own_office),
    status: row.status ?? "ACTIVE",
    assigned_to: row.assigned_to ?? row.created_by ?? "",
    network_id: row.network_id ?? null,
    network_name: row.network_name ?? null,
    credit_day:
      row.credit_day === null || row.credit_day === undefined
        ? null
        : Number(row.credit_day),
    credit_amount:
      row.credit_amount === null ||
      row.credit_amount === undefined ||
      String(row.credit_amount).trim() === ""
        ? null
        : row.credit_amount,
    addresses_data: (row.addresses_data ?? []).map((address) => ({
      ...address,
      sez: Boolean(address.sez),
      msme: Boolean(address.msme),
      sez_valid_date: address.sez ? (address.sez_valid_date ?? null) : null,
      msme_no: address.msme ? (address.msme_no ?? "") : "",
    })),
    ...(Array.isArray(row.tds_section_data)
      ? { tds_section_data: row.tds_section_data }
      : {}),
    ...(Array.isArray(row.bank_details_data)
      ? { bank_details_data: row.bank_details_data }
      : {}),
  };
}

type FilterFormState = {
  customer_name: string;
  status: string;
};

const DEFAULT_FILTERS: FilterFormState = {
  customer_name: "",
  status: "",
};

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "All" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "active", label: "Active" },
];

export function getStatusBadgeColor(status?: string): string {
  const normalized = String(status ?? "")
    .trim()
    .toLowerCase();
  if (normalized === "active") return "green";
  if (normalized === "approved") return "teal";
  if (normalized === "rejected") return "red";
  if (normalized === "pending") return "yellow";
  return "gray";
}

function isFinalizedCustomerStatus(status?: string): boolean {
  const normalized = String(status ?? "")
    .trim()
    .toLowerCase();
  return normalized === "approved" || normalized === "rejected";
}

type DetailField = {
  label: string;
  value: unknown;
  fullWidth?: boolean;
};

function hasDetailValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return true;
  if (typeof value === "boolean") return true;
  return true;
}

function formatDetailValue(value: unknown, dateFormat: string): string {
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      return formatDateTimeForUi(value, dateFormat);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
      return formatDateForUi(value, dateFormat);
    }
  }
  return formatCustomerPanDisplayValue(value);
}

function DetailSection({
  title,
  fields,
}: {
  title: string;
  fields: DetailField[];
}) {
  const dateFormat = useDateFormat();
  const visibleFields = fields.filter((field) => hasDetailValue(field.value));
  if (visibleFields.length === 0) return null;

  return (
    <Box>
      <Text
        size="xs"
        fw={700}
        c="#105476"
        tt="uppercase"
        mb="xs"
        style={{ letterSpacing: "0.04em" }}
      >
        {title}
      </Text>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
        {visibleFields.map((field) => (
          <Box
            key={field.label}
            style={field.fullWidth ? { gridColumn: "1 / -1" } : undefined}
          >
            <Text size="xs" c="dimmed" fw={500} mb={2}>
              {field.label}
            </Text>
            <Text size="sm" style={{ wordBreak: "break-word" }}>
              {formatDetailValue(field.value, dateFormat)}
            </Text>
          </Box>
        ))}
      </SimpleGrid>
    </Box>
  );
}

export type ApprovalPartyType = "customer" | "vendor" | "agent";

export function CustomerPanApprovalDetails({
  row,
  editable = false,
  onChange,
  partyType = "customer",
  requireIndiaTaxIds = true,
  foreignBranchProfile,
}: {
  row: CustomerPanApprovalRow;
  editable?: boolean;
  onChange?: (next: CustomerPanApprovalRow) => void;
  partyType?: ApprovalPartyType;
  /** When true (India users), IEC/TAN/ARN are marked required in edit mode. */
  requireIndiaTaxIds?: boolean;
  foreignBranchProfile?: ForeignBranchProfile;
}) {
  const branchProfile = foreignBranchProfile ?? {
    isDubaiUser: false,
    isKenyaUser: false,
    isVietnamUser: false,
    isChinaUser: false,
  };
  const addresses = row.addresses_data ?? [];
  const isVendor = partyType === "vendor";
  const entityLabel =
    partyType === "vendor"
      ? "Vendor"
      : partyType === "agent"
        ? "Agent"
        : "Customer";
  const tdsSections = row.tds_section_data ?? [];
  const bankDetails = row.bank_details_data ?? [];

  const updateRow = (patch: Partial<CustomerPanApprovalRow>) => {
    onChange?.({ ...row, ...patch });
  };

  const updateAddress = (
    index: number,
    patch: Partial<CustomerPanApprovalAddress>,
  ) => {
    const nextAddresses = addresses.map((address, addressIndex) =>
      addressIndex === index ? { ...address, ...patch } : address,
    );
    onChange?.({ ...row, addresses_data: nextAddresses });
  };

  const updateTdsRow = (index: number, patch: Record<string, unknown>) => {
    const next = tdsSections.map((item, i) =>
      i === index ? { ...item, ...patch } : item,
    );
    updateRow({ tds_section_data: next });
  };

  const updateBankRow = (index: number, patch: Record<string, unknown>) => {
    const next = bankDetails.map((item, i) =>
      i === index ? { ...item, ...patch } : item,
    );
    updateRow({ bank_details_data: next });
  };

  if (!editable) {
    return (
      <Stack gap="md">
        <Card withBorder padding="md" radius="md" bg="#fafbfc">
          <Stack gap="md">
            <Box>
              <Text size="xs" c="dimmed" fw={500} mb={4}>
                {entityLabel} Name
              </Text>
              <Text size="md" fw={600} c="#105476" style={{ lineHeight: 1.4 }}>
                {row.customer_name || "—"}
              </Text>
            </Box>

            <DetailSection
              title="General Information"
              fields={
                requireIndiaTaxIds
                  ? [
                      { label: "Term Code", value: row.term_code },
                      { label: "TDS Type", value: row.tds_type },
                      { label: "Own Office", value: row.own_office },
                      { label: `${entityLabel} Status`, value: row.status },
                      { label: "Assign To", value: row.created_by },
                      { label: "Network", value: row.network_name },
                    ]
                  : [
                      {
                        label: `${entityLabel} Type`,
                        value: formatCustomerTypesDisplay(row),
                      },
                      { label: "Credit Type", value: row.term_code },
                      { label: "Own Office", value: row.own_office },
                      { label: "Network Name", value: row.network_name },
                      {
                        label: "Assign To",
                        value: row.assigned_to ?? row.created_by,
                      },
                    ]
              }
            />

            <DetailSection
              title="Credit Terms"
              fields={[
                { label: "Credit Days", value: row.credit_day },
                { label: "Credit Amount", value: row.credit_amount },
              ]}
            />
          </Stack>
        </Card>

        {addresses.length > 0 && (
          <Box>
            <Group justify="space-between" mb="sm">
              <Text size="sm" fw={600} c="#105476">
                Address Details
              </Text>
              <Badge variant="light" color="#105476" size="sm">
                {addresses.length} address{addresses.length === 1 ? "" : "es"}
              </Badge>
            </Group>
            <Stack gap="sm">
              {addresses.map((address, index) => (
                <CustomerPanAddressDetails
                  key={address.id ?? `address-${index}`}
                  address={address}
                  index={index}
                  requireIndiaTaxIds={requireIndiaTaxIds}
                  foreignBranchProfile={branchProfile}
                />
              ))}
            </Stack>
          </Box>
        )}

        {addresses.length === 0 && (
          <Text size="sm" c="dimmed" ta="center" py="sm">
            No address details available.
          </Text>
        )}

        {requireIndiaTaxIds && isVendor && tdsSections.length > 0 && (
          <Card withBorder padding="md" radius="md" bg="#fafbfc">
            <Text size="sm" fw={600} c="#105476" mb="sm">
              TDS Section Details
            </Text>
            <Stack gap="sm">
              {tdsSections.map((item, index) => (
                <DetailSection
                  key={`tds-view-${index}`}
                  title={`TDS Section ${index + 1}`}
                  fields={[
                    {
                      label: "Section ID",
                      value: item.section_id ?? item.tds_section_code,
                    },
                    {
                      label: "Section Name",
                      value: item.tds_section_name ?? item.section_name,
                    },
                    { label: "Exemption TDS", value: item.exemption_tds },
                    {
                      label: "Exemption Certificate No",
                      value: item.exemption_certificate_no,
                    },
                    {
                      label: "TDS %",
                      value: item.tds_percentage ?? item.tds_percent,
                    },
                    { label: "Valid From", value: item.valid_from },
                    { label: "Valid To", value: item.valid_to },
                    { label: "TDS Lower Limit", value: item.tds_lower_limit },
                  ]}
                />
              ))}
            </Stack>
          </Card>
        )}

        {isVendor && bankDetails.length > 0 && (
          <Card withBorder padding="md" radius="md" bg="#fafbfc">
            <Text size="sm" fw={600} c="#105476" mb="sm">
              Bank Details
            </Text>
            <Stack gap="sm">
              {bankDetails.map((item, index) => (
                <DetailSection
                  key={`bank-view-${index}`}
                  title={`Bank ${index + 1}`}
                  fields={[
                    { label: "Currency", value: item.currency },
                    { label: "Account No", value: item.account_no },
                    { label: "Account Name", value: item.account_name },
                    { label: "Bank Name", value: item.bank_name },
                    { label: "IFSC", value: item.ifsc_code },
                    { label: "IBAN", value: item.iban_no },
                    { label: "SWIFT", value: item.swift_no },
                    {
                      label: "Bank Address",
                      value: item.bank_address,
                      fullWidth: true,
                    },
                  ]}
                />
              ))}
            </Stack>
          </Card>
        )}

        {row.documents_list && row.documents_list.length > 0 && (
          <Card withBorder padding="md" radius="md" bg="#fafbfc">
            <CustomerDocumentsList documents={row.documents_list} />
          </Card>
        )}
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <Card withBorder padding="md" radius="md" bg="#fafbfc">
        <Stack gap="md">
          <Box>
            <Text size="xs" c="dimmed" fw={500} mb={4}>
              {entityLabel} Name
            </Text>
            <Text size="md" fw={600} c="#105476" style={{ lineHeight: 1.4 }}>
              {row.customer_name || "—"}
            </Text>
          </Box>

          <Text size="xs" fw={700} c="#105476" tt="uppercase">
            General Information
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            {!requireIndiaTaxIds && (
              <FormTextInput
                format="normal"
                label={`${entityLabel} Type`}
                value={formatCustomerTypesDisplay(row)}
                disabled
              />
            )}
            <Dropdown
              label="Credit Type"
              data={TERM_CODE_OPTIONS}
              value={normalizeTermCodeValue(row.term_code)}
              onChange={(value) => updateRow({ term_code: value ?? "" })}
              dropdownZIndex={MODAL_DROPDOWN_Z_INDEX}
              clearable
            />
            <Dropdown
              label="Own Office"
              data={[
                { value: "true", label: "Yes" },
                { value: "false", label: "No" },
              ]}
              value={
                row.own_office === undefined || row.own_office === null
                  ? null
                  : row.own_office
                    ? "true"
                    : "false"
              }
              onChange={(value) =>
                updateRow({
                  own_office:
                    value === null || value === undefined
                      ? undefined
                      : value === "true",
                })
              }
              dropdownZIndex={MODAL_DROPDOWN_Z_INDEX}
              clearable
            />
            {requireIndiaTaxIds && (
              <>
                <FormTextInput
                  format="normal"
                  label={`${entityLabel} Status`}
                  value={row.status ?? ""}
                  onChange={(e) => updateRow({ status: e.target.value })}
                />
                {isVendor && (
                  <Dropdown
                    label="TDS Type"
                    data={[
                      { value: "Individual", label: "Individual" },
                      { value: "Company", label: "Company" },
                    ]}
                    value={row.tds_type || null}
                    onChange={(value) => updateRow({ tds_type: value ?? null })}
                    dropdownZIndex={MODAL_DROPDOWN_Z_INDEX}
                    clearable
                  />
                )}
              </>
            )}
            <FormTextInput
              format="normal"
              label="Assign To"
              value={row.assigned_to ?? row.created_by ?? ""}
              onChange={(e) => updateRow({ assigned_to: e.target.value })}
            />
            <SearchableSelect
              label="Network Name"
              placeholder="Search network..."
              apiEndpoint={URL.networkMaster}
              value={
                row.network_id != null && row.network_id !== undefined
                  ? String(row.network_id)
                  : null
              }
              displayValue={row.network_name || null}
              onChange={(value, selectedData) =>
                updateRow({
                  network_id: value ? Number(value) : null,
                  network_name: selectedData?.label ?? "",
                })
              }
              displayFormat={(item: Record<string, unknown>) => ({
                value: String(item.id ?? ""),
                label: String(item.network_name ?? ""),
              })}
              searchFields={["network_name"]}
              dropdownZIndex={MODAL_DROPDOWN_Z_INDEX}
              minSearchLength={1}
            />
          </SimpleGrid>

          <Text size="xs" fw={700} c="#105476" tt="uppercase">
            Credit Terms
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <FormTextInput format="normal"
              label="Credit Days"
              withAsterisk={
                String(row.term_code ?? "").trim().toUpperCase() === "CREDIT"
              }
              value={
                row.credit_day === null || row.credit_day === undefined
                  ? ""
                  : String(row.credit_day)
              }
              onChange={(e) => {
                const next = e.target.value.replace(/\D/g, "");
                updateRow({
                  credit_day: next === "" ? undefined : Number(next),
                });
              }}
            />
            <FormTextInput format="normal"
              label="Credit Amount"
              withAsterisk={
                String(row.term_code ?? "").trim().toUpperCase() === "CREDIT"
              }
              value={
                row.credit_amount === null || row.credit_amount === undefined
                  ? ""
                  : String(row.credit_amount)
              }
              onChange={(e) => {
                const next = e.target.value;
                if (next === "" || TWO_DECIMAL_INPUT_REGEX.test(next)) {
                  updateRow({ credit_amount: next });
                }
              }}
            />
          </SimpleGrid>
        </Stack>
      </Card>

      {addresses.length > 0 && (
        <Box>
          <Group justify="space-between" mb="sm">
            <Text size="sm" fw={600} c="#105476">
              Address Details
            </Text>
            <Badge variant="light" color="#105476" size="sm">
              {addresses.length} address{addresses.length === 1 ? "" : "es"}
            </Badge>
          </Group>
          <Stack gap="sm">
            {addresses.map((address, index) => (
              <CustomerPanAddressDetails
                key={address.id ?? `address-${index}`}
                address={address}
                index={index}
                editable
                onChange={(patch) => updateAddress(index, patch)}
                requireIndiaTaxIds={requireIndiaTaxIds}
                foreignBranchProfile={branchProfile}
              />
            ))}
          </Stack>
        </Box>
      )}

      {addresses.length === 0 && (
        <Text size="sm" c="dimmed" ta="center" py="sm">
          No address details available.
        </Text>
      )}

      {requireIndiaTaxIds && isVendor && (
        <Card withBorder padding="md" radius="md" bg="#fafbfc">
          <Group justify="space-between" mb="sm">
            <Text size="sm" fw={600} c="#105476">
              TDS Section Details
            </Text>
            <Button
              size="xs"
              variant="light"
              color="#105476"
              onClick={() =>
                updateRow({
                  tds_section_data: [
                    ...tdsSections,
                    {
                      section_id: null,
                      exemption_tds: false,
                      exemption_certificate_no: "",
                      tds_percentage: "",
                      valid_from: null,
                      valid_to: null,
                      tds_lower_limit: "",
                    },
                  ],
                })
              }
            >
              Add TDS
            </Button>
          </Group>
          <Stack gap="sm">
            {(tdsSections.length > 0 ? tdsSections : [{}]).map((item, index) => (
              <Card key={`tds-edit-${index}`} withBorder padding="sm" radius="md">
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  <FormTextInput format="normal"
                    label="Section ID"
                    value={
                      item.section_id == null ? "" : String(item.section_id)
                    }
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "");
                      updateTdsRow(index, {
                        section_id: v === "" ? null : Number(v),
                      });
                    }}
                  />
                  <Dropdown
                    label="Exemption TDS"
                    data={[
                      { value: "true", label: "Yes" },
                      { value: "false", label: "No" },
                    ]}
                    value={item.exemption_tds ? "true" : "false"}
                    onChange={(value) =>
                      updateTdsRow(index, {
                        exemption_tds: value === "true",
                      })
                    }
                  />
                  <FormTextInput format="normal"
                    label="Exemption Certificate No"
                    value={String(item.exemption_certificate_no ?? "")}
                    onChange={(e) =>
                      updateTdsRow(index, {
                        exemption_certificate_no: e.target.value,
                      })
                    }
                  />
                  <FormTextInput format="normal"
                    label="TDS %"
                    value={String(
                      item.tds_percentage ?? item.tds_percent ?? "",
                    )}
                    onChange={(e) => {
                      const next = e.target.value;
                      if (next === "" || TWO_DECIMAL_INPUT_REGEX.test(next)) {
                        updateTdsRow(index, { tds_percentage: next });
                      }
                    }}
                  />
                  <SingleDateInput
                    label="Valid From"
                    value={parseDateYYYYMMDD(
                      item.valid_from != null
                        ? String(item.valid_from)
                        : null,
                    )}
                    onChange={(date) =>
                      updateTdsRow(index, {
                        valid_from: formatDateYYYYMMDD(date),
                      })
                    }
                  />
                  <SingleDateInput
                    label="Valid To"
                    value={parseDateYYYYMMDD(
                      item.valid_to != null ? String(item.valid_to) : null,
                    )}
                    onChange={(date) =>
                      updateTdsRow(index, {
                        valid_to: formatDateYYYYMMDD(date),
                      })
                    }
                  />
                  <FormTextInput format="normal"
                    label="TDS Lower Limit"
                    value={String(item.tds_lower_limit ?? "")}
                    onChange={(e) => {
                      const next = e.target.value;
                      if (next === "" || TWO_DECIMAL_INPUT_REGEX.test(next)) {
                        updateTdsRow(index, { tds_lower_limit: next });
                      }
                    }}
                  />
                </SimpleGrid>
              </Card>
            ))}
          </Stack>
        </Card>
      )}

      {isVendor && (
        <Card withBorder padding="md" radius="md" bg="#fafbfc">
          <Group justify="space-between" mb="sm">
            <Text size="sm" fw={600} c="#105476">
              Bank Details
            </Text>
            <Button
              size="xs"
              variant="light"
              color="#105476"
              onClick={() =>
                updateRow({
                  bank_details_data: [
                    ...bankDetails,
                    {
                      currency: "",
                      account_no: "",
                      account_name: "",
                      bank_name: "",
                      iban_no: "",
                      swift_no: "",
                      bank_address: "",
                      ifsc_code: "",
                    },
                  ],
                })
              }
            >
              Add Bank
            </Button>
          </Group>
          <Stack gap="sm">
            {(bankDetails.length > 0 ? bankDetails : [{}]).map(
              (item, index) => (
                <Card
                  key={`bank-edit-${index}`}
                  withBorder
                  padding="sm"
                  radius="md"
                >
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                    <FormTextInput format="normal"
                      label="Currency"
                      value={String(item.currency ?? "")}
                      onChange={(e) =>
                        updateBankRow(index, { currency: e.target.value })
                      }
                    />
                    <FormTextInput format="normal"
                      label="Account No"
                      value={String(item.account_no ?? "")}
                      onChange={(e) =>
                        updateBankRow(index, { account_no: e.target.value })
                      }
                    />
                    <FormTextInput format="normal"
                      label="Account Name"
                      value={String(item.account_name ?? "")}
                      onChange={(e) =>
                        updateBankRow(index, { account_name: e.target.value })
                      }
                    />
                    <FormTextInput format="normal"
                      label="Bank Name"
                      value={String(item.bank_name ?? "")}
                      onChange={(e) =>
                        updateBankRow(index, { bank_name: e.target.value })
                      }
                    />
                    <FormTextInput format="normal"
                      label="IFSC"
                      value={String(item.ifsc_code ?? "")}
                      onChange={(e) =>
                        updateBankRow(index, { ifsc_code: e.target.value })
                      }
                    />
                    <FormTextInput format="normal"
                      label="IBAN"
                      value={String(item.iban_no ?? "")}
                      onChange={(e) =>
                        updateBankRow(index, { iban_no: e.target.value })
                      }
                    />
                    <FormTextInput format="normal"
                      label="SWIFT"
                      value={String(item.swift_no ?? "")}
                      onChange={(e) =>
                        updateBankRow(index, { swift_no: e.target.value })
                      }
                    />
                    <FormTextArea
                      format="initcap"
                      label="Bank Address"
                      minRows={2}
                      value={String(item.bank_address ?? "")}
                      onChange={(e) =>
                        updateBankRow(index, { bank_address: e.target.value })
                      }
                    />
                  </SimpleGrid>
                </Card>
              ),
            )}
          </Stack>
        </Card>
      )}

      {row.documents_list && row.documents_list.length > 0 && (
        <Card withBorder padding="md" radius="md" bg="#fafbfc">
          <CustomerDocumentsList documents={row.documents_list} />
        </Card>
      )}
    </Stack>
  );
}

function SimilarCustomerCard({
  customer,
  index,
}: {
  customer: RelatedCustomer;
  index: number;
}) {
  return (
    <Card withBorder padding="md" radius="md">
      <Group gap="xs" mb="sm" wrap="nowrap" align="flex-start">
        <Badge variant="filled" color="#105476" size="sm" circle>
          {index + 1}
        </Badge>
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Text size="sm" fw={600} c="#105476" style={{ lineHeight: 1.4 }}>
            {customer.customer_name || "—"}
          </Text>
          <Group gap="xs" mt={6} wrap="wrap">
            {customer.customer_code && (
              <Text size="xs" c="dimmed">
                Code: {customer.customer_code}
              </Text>
            )}
            {customer.status && (
              <Badge
                size="xs"
                variant="light"
                color={getStatusBadgeColor(customer.status)}
              >
                {customer.status}
              </Badge>
            )}
          </Group>
        </Box>
      </Group>

      <Stack gap="xs">
        {customer.address && (
          <Box>
            <Text size="xs" c="dimmed" fw={500} mb={2}>
              Address
            </Text>
            <Text size="sm" style={{ wordBreak: "break-word" }}>
              {customer.address}
            </Text>
          </Box>
        )}

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          {customer.city && (
            <Box>
              <Text size="xs" c="dimmed" fw={500} mb={2}>
                City
              </Text>
              <Text size="sm">{customer.city}</Text>
            </Box>
          )}
          {customer.phone_no && (
            <Box>
              <Text size="xs" c="dimmed" fw={500} mb={2}>
                Phone
              </Text>
              <Text size="sm">{customer.phone_no}</Text>
            </Box>
          )}
          {customer.email && (
            <Box
              style={{ gridColumn: customer.phone_no ? undefined : "1 / -1" }}
            >
              <Text size="xs" c="dimmed" fw={500} mb={2}>
                Email
              </Text>
              <Text size="sm" style={{ wordBreak: "break-word" }}>
                {customer.email}
              </Text>
            </Box>
          )}
        </SimpleGrid>
      </Stack>
    </Card>
  );
}

function CustomerPanAddressDetails({
  address,
  index,
  editable = false,
  onChange,
  requireIndiaTaxIds = false,
  foreignBranchProfile,
}: {
  address: CustomerPanApprovalAddress;
  index: number;
  editable?: boolean;
  onChange?: (patch: Partial<CustomerPanApprovalAddress>) => void;
  requireIndiaTaxIds?: boolean;
  foreignBranchProfile?: ForeignBranchProfile;
}) {
  const branchProfile = foreignBranchProfile ?? {
    isDubaiUser: false,
    isKenyaUser: false,
    isVietnamUser: false,
    isChinaUser: false,
  };

  const foreignTaxFields: DetailField[] = [];
  if (!requireIndiaTaxIds) {
    if (branchProfile.isDubaiUser) {
      foreignTaxFields.push(
        { label: "TRN No", value: address.trn_no },
        { label: "Validity Date", value: address.validity_date },
      );
    }
    if (branchProfile.isKenyaUser || branchProfile.isChinaUser) {
      foreignTaxFields.push({
        label: branchProfile.isKenyaUser ? "PIN Number" : "TIN Number",
        value: address.gst_id,
      });
    }
    if (branchProfile.isVietnamUser) {
      foreignTaxFields.push({
        label: "Tax Exemption",
        value: address.sez ? "Yes" : "No",
      });
    }
  }
  if (!editable) {
    return (
      <Card withBorder padding="md" radius="md">
        <Group gap="xs" mb="md" wrap="nowrap" align="flex-start">
          <Badge variant="filled" color="#105476" size="sm" circle>
            {index + 1}
          </Badge>
          <Box style={{ flex: 1 }}>
            <Group gap="xs" mb={4}>
              {address.address_type && (
                <Badge variant="light" color="gray" size="sm">
                  {address.address_type}
                </Badge>
              )}
              {address.customer_location && (
                <Text size="sm" fw={600}>
                  {address.customer_location}
                </Text>
              )}
            </Group>
          </Box>
        </Group>

        <Stack gap="md">
          <DetailSection
            title="Location"
            fields={[
              { label: "Address", value: address.address, fullWidth: true },
              { label: "City", value: address.city },
              { label: "State", value: address.state },
              { label: "Country", value: address.country },
              {
                label: requireIndiaTaxIds ? "Pin Code" : "Pin/Zip Code",
                value: address.pincode,
              },
            ]}
          />

          <DetailSection
            title="Contact"
            fields={[
              {
                label: requireIndiaTaxIds ? "Phone" : "Landline Number",
                value: address.phone_no,
              },
              { label: "Mobile", value: address.mobile_no },
              {
                label: requireIndiaTaxIds ? "Email" : "Email Id",
                value: address.email,
                fullWidth: true,
              },
            ]}
          />

          {requireIndiaTaxIds ? (
            <DetailSection
              title="Tax & Registration"
              fields={[
                { label: "PAN", value: address.pan_no },
                {
                  label: "GST Registration Status",
                  value: address.gst_registration_status,
                },
                { label: "Tax ID / GSTIN", value: address.gst_id },
                { label: "IEC Code", value: address.iec_code },
                { label: "TAN", value: address.tan_no },
                { label: "ARN", value: address.arn_no },
                { label: "UIN", value: address.uin_no },
                {
                  label: "Composite / Regular",
                  value: address.composite_regular,
                },
                { label: "SEZ", value: address.sez },
                { label: "SEZ Validity Date", value: address.sez_valid_date },
                { label: "MSME", value: address.msme },
                { label: "MSME No", value: address.msme_no },
                {
                  label: "PAN–Aadhaar Linked",
                  value: address.pan_aadhaar_link,
                },
                { label: "ITR Filed", value: address.Itr_filed },
                {
                  label: "TDS Threshold",
                  value: address.tds_threshold_flag,
                },
              ]}
            />
          ) : (
            foreignTaxFields.length > 0 && (
              <DetailSection title="Tax Details" fields={foreignTaxFields} />
            )
          )}
        </Stack>
      </Card>
    );
  }

  return (
    <Card withBorder padding="md" radius="md">
      <Group gap="xs" mb="md" wrap="nowrap" align="flex-start">
        <Badge variant="filled" color="#105476" size="sm" circle>
          {index + 1}
        </Badge>
        <Text size="sm" fw={600} c="#105476">
          Address {index + 1}
        </Text>
      </Group>

      <Stack gap="md">
        <Text size="xs" fw={700} c="#105476" tt="uppercase">
          Location
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <FormTextInput format="normal"
            label="Location"
            value={address.customer_location ?? ""}
            onChange={(e) => onChange?.({ customer_location: e.target.value })}
          />
          <Dropdown
            label="Address Type"
            data={[
              { value: "Primary", label: "Primary" },
              { value: "Secondary", label: "Secondary" },
              { value: "Billing", label: "Billing" },
              { value: "Shipping", label: "Shipping" },
            ]}
            value={address.address_type || null}
            onChange={(value) => onChange?.({ address_type: value ?? "" })}
            dropdownZIndex={MODAL_DROPDOWN_Z_INDEX}
          />
          <FormTextArea
            format="initcap"
            label="Address"
            minRows={2}
            style={{ gridColumn: "1 / -1" }}
            value={address.address ?? ""}
            onChange={(e) => onChange?.({ address: e.target.value })}
          />
          <FormTextInput format="normal"
            label="City"
            value={address.city ?? ""}
            onChange={(e) => onChange?.({ city: e.target.value })}
          />
          <FormTextInput format="normal"
            label="State"
            value={address.state ?? ""}
            onChange={(e) => onChange?.({ state: e.target.value })}
          />
          <FormTextInput format="normal"
            label="Country"
            value={address.country ?? ""}
            onChange={(e) => onChange?.({ country: e.target.value })}
          />
          <FormTextInput format="normal"
            label={requireIndiaTaxIds ? "Pin Code" : "Pin/Zip Code"}
            value={address.pincode ?? ""}
            onChange={(e) => onChange?.({ pincode: e.target.value })}
          />
        </SimpleGrid>

        <Text size="xs" fw={700} c="#105476" tt="uppercase">
          Contact
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <FormTextInput format="normal"
            label={requireIndiaTaxIds ? "Phone" : "Landline Number"}
            value={address.phone_no ?? ""}
            onChange={(e) => onChange?.({ phone_no: e.target.value })}
          />
          <FormTextInput format="normal"
            label="Mobile"
            value={address.mobile_no ?? ""}
            onChange={(e) => onChange?.({ mobile_no: e.target.value })}
          />
          <FormTextInput format="normal"
            label={requireIndiaTaxIds ? "Email" : "Email Id"}
            style={{ gridColumn: "1 / -1" }}
            value={address.email ?? ""}
            onChange={(e) => onChange?.({ email: e.target.value })}
          />
        </SimpleGrid>

        {requireIndiaTaxIds ? (
          <>
            <Text size="xs" fw={700} c="#105476" tt="uppercase">
              Tax & Registration
            </Text>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <FormTextInput format="normal"
            label="PAN"
            value={address.pan_no ?? ""}
            onChange={(e) => onChange?.({ pan_no: e.target.value })}
          />
          <Dropdown
            label="GST Registration Status"
            data={[
              { value: "Registered", label: "Registered" },
              { value: "Unregistered", label: "Unregistered" },
            ]}
            value={address.gst_registration_status || null}
            onChange={(value) =>
              onChange?.({ gst_registration_status: value ?? "" })
            }
            clearable
          />
          <FormTextInput format="normal"
            label="Tax ID / GSTIN"
            value={address.gst_id ?? ""}
            onChange={(e) => onChange?.({ gst_id: e.target.value })}
          />
          <FormTextInput format="normal"
            label="IEC Code"
            withAsterisk={requireIndiaTaxIds}
            value={address.iec_code ?? ""}
            onChange={(e) => onChange?.({ iec_code: e.target.value })}
          />
          <FormTextInput format="normal"
            label="TAN"
            withAsterisk={requireIndiaTaxIds}
            value={address.tan_no ?? ""}
            onChange={(e) => onChange?.({ tan_no: e.target.value })}
          />
          <FormTextInput format="normal"
            label="ARN"
            withAsterisk={requireIndiaTaxIds}
            value={address.arn_no ?? ""}
            onChange={(e) => onChange?.({ arn_no: e.target.value })}
          />
          <FormTextInput format="normal"
            label="UIN"
            value={address.uin_no ?? ""}
            onChange={(e) => onChange?.({ uin_no: e.target.value })}
          />
          <Dropdown
            label="Composite / Regular"
            data={[
              { value: "composite", label: "Composite" },
              { value: "Regular", label: "Regular" },
            ]}
            value={address.composite_regular || null}
            onChange={(value) =>
              onChange?.({ composite_regular: value ?? "" })
            }
            clearable
          />
          <Dropdown
            label="SEZ"
            data={[
              { value: "Yes", label: "Yes" },
              { value: "No", label: "No" },
            ]}
            value={address.sez ? "Yes" : "No"}
            onChange={(value) =>
              onChange?.({
                sez: value === "Yes",
                sez_valid_date:
                  value === "Yes" ? address.sez_valid_date ?? null : null,
              })
            }
          />
          {!!address.sez && (
            <SingleDateInput
              label="SEZ Validity Date"
              placeholder="Select SEZ validity date"
              value={parseDateYYYYMMDD(address.sez_valid_date)}
              onChange={(value) =>
                onChange?.({ sez_valid_date: formatDateYYYYMMDD(value) })
              }
            />
          )}
          <Dropdown
            label="MSME"
            data={[
              { value: "Yes", label: "Yes" },
              { value: "No", label: "No" },
            ]}
            value={address.msme ? "Yes" : "No"}
            onChange={(value) =>
              onChange?.({
                msme: value === "Yes",
                msme_no: value === "Yes" ? address.msme_no ?? "" : "",
              })
            }
          />
          {!!address.msme && (
            <FormTextInput format="normal"
              label="MSME No"
              value={address.msme_no ?? ""}
              onChange={(e) => onChange?.({ msme_no: e.target.value })}
            />
          )}
            </SimpleGrid>
          </>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            {branchProfile.isDubaiUser && (
              <>
                <FormTextInput
                  format="normal"
                  label="TRN No"
                  value={address.trn_no ?? ""}
                  onChange={(e) => onChange?.({ trn_no: e.target.value })}
                />
                <SingleDateInput
                  label="Validity Date"
                  placeholder="Select validity date"
                  value={parseDateYYYYMMDD(address.validity_date)}
                  onChange={(value) =>
                    onChange?.({ validity_date: formatDateYYYYMMDD(value) })
                  }
                />
              </>
            )}
            {(branchProfile.isKenyaUser || branchProfile.isChinaUser) && (
              <FormTextInput
                format="normal"
                label={
                  branchProfile.isKenyaUser ? "PIN Number" : "TIN Number"
                }
                value={address.gst_id ?? ""}
                onChange={(e) => onChange?.({ gst_id: e.target.value })}
              />
            )}
            {branchProfile.isVietnamUser && (
              <Dropdown
                label="Tax Exemption"
                data={[
                  { value: "Yes", label: "Yes" },
                  { value: "No", label: "No" },
                ]}
                value={address.sez ? "Yes" : "No"}
                onChange={(value) =>
                  onChange?.({ sez: value === "Yes" })
                }
              />
            )}
          </SimpleGrid>
        )}
      </Stack>
    </Card>
  );
}

export default function ApproveCustomerPanMaster({
  partyType = "customer",
}: {
  partyType?: ApprovalPartyType;
} = {}) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isIndiaUser = isIndianUserFromProfile(user?.country);
  const foreignBranchProfile = useMemo(
    () => getForeignBranchProfile(user?.country, user?.branches),
    [user?.country, user?.branches],
  );
  const hasCustomerApprovalScreen = Boolean(
    user?.screen_permissions?.customer_approval_screen,
  );
  const canAccessApproval = hasCustomerApprovalScreen;
  const entityLabel =
    partyType === "vendor"
      ? "Vendor"
      : partyType === "agent"
        ? "Agent"
        : "Customer";
  const entityLabelLower = partyType;

  const queryClient = useQueryClient();
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );
  const [editableApprovalRow, setEditableApprovalRow] =
    useState<CustomerPanApprovalRow | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [isUpdatingCustomer, setIsUpdatingCustomer] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 500);
  const [draftFilters, setDraftFilters] =
    useState<FilterFormState>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<FilterFormState>(DEFAULT_FILTERS);
  const [similarModalOpen, setSimilarModalOpen] = useState(false);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [similarCustomers, setSimilarCustomers] = useState<RelatedCustomer[]>(
    [],
  );
  const [similarSearchName, setSimilarSearchName] = useState("");

  const apiFilters = useMemo<CustomerPanApprovalFilters>(
    () => ({
      customer_name:
        appliedFilters.customer_name.trim() ||
        debouncedSearch.trim() ||
        undefined,
      status: appliedFilters.status.trim() || undefined,
      customer_type: partyType,
    }),
    [appliedFilters, partyType, debouncedSearch],
  );

  const {
    data: listResult,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: [
      "customerPanPending",
      partyType,
      pageIndex,
      pageSize,
      apiFilters.customer_name,
      apiFilters.status,
    ],
    queryFn: async () => {
      const index = pageIndex * pageSize;
      const result = await fetchCustomerPanPendingList(
        index,
        pageSize,
        apiFilters,
      );
      return result;
    },
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (listResult) {
      setTotalCount(listResult.total);
    }
  }, [listResult]);

  useEffect(() => {
    setPageIndex(0);
  }, [debouncedSearch]);

  const rawRows = listResult?.rows ?? [];

  const displayRows = useMemo<TableRow[]>(
    () =>
      rawRows.map((row, index) => ({
        ...row,
        sno: row.sno ?? pageIndex * pageSize + index + 1,
      })),
    [rawRows, pageIndex, pageSize],
  );

  const applyFilters = () => {
    setAppliedFilters({ ...draftFilters });
    setPageIndex(0);
  };

  const clearFilters = () => {
    setDraftFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setSearch("");
    setPageIndex(0);
  };

  const handleShowSimilarCustomers = useCallback(
    async (customerName: string) => {
      setSimilarModalOpen(true);
      setSimilarLoading(true);
      setSimilarCustomers([]);
      setSimilarSearchName(customerName);

      try {
        const result = await fetchRelatedCustomers(customerName);
        setSimilarCustomers(result.data ?? []);
      } catch (error) {
        ToastNotification({
          type: "error",
          message: extractApiErrorMessage(error),
        });
        setSimilarModalOpen(false);
      } finally {
        setSimilarLoading(false);
      }
    },
    [],
  );

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setPageIndex(0);
  };

  const handlePageChange = (newPage: number) => {
    setPageIndex(newPage - 1);
  };

  const refreshList = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["customerPanPending"] });
    await refetch();
  }, [queryClient, refetch]);

  const handleConfirmAction = async () => {
    if (!pendingAction || pendingAction.type === "view") return;

    setIsSubmittingAction(true);
    try {
      if (pendingAction.type === "approve") {
        await approveCustomerPan(pendingAction.row.id);
        ToastNotification({
          type: "success",
          message: `${entityLabel} approved successfully.`,
        });
      } else {
        await rejectCustomerPan(pendingAction.row.id);
        ToastNotification({
          type: "success",
          message: `${entityLabel} rejected successfully.`,
        });
      }
      setPendingAction(null);
      setEditableApprovalRow(null);
      await refreshList();
    } catch (error) {
      ToastNotification({
        type: "error",
        message: extractApiErrorMessage(error),
      });
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleUpdateCustomer = async () => {
    if (!pendingAction || pendingAction.type !== "approve") return;

    const rowToUpdate = editableApprovalRow ?? pendingAction.row;
    const validationError = getApprovalEditValidationError(
      rowToUpdate,
      isIndiaUser,
    );
    if (validationError) {
      ToastNotification({ type: "error", message: validationError });
      return;
    }

    setIsUpdatingCustomer(true);
    try {
      await updateCustomerVerification(
        pendingAction.row.id,
        buildCustomerVerificationPayload(rowToUpdate),
      );
      ToastNotification({
        type: "success",
        message: `${entityLabel} updated successfully.`,
      });
      await refreshList();
    } catch (error) {
      ToastNotification({
        type: "error",
        message: extractApiErrorMessage(error),
      });
    } finally {
      setIsUpdatingCustomer(false);
    }
  };

  const columns = useMemo<MRT_ColumnDef<TableRow>[]>(
    () => [
      {
        accessorKey: "sno",
        header: "S.No",
        size: 60,
        minSize: 50,
        maxSize: 70,
        enableColumnFilter: false,
        enableSorting: false,
      },
      {
        accessorKey: "customer_name",
        header: `${entityLabel} Name`,
        size: 300,
        Cell: ({ row }) => {
          const customerName = row.original.customer_name;
          return (
            <Group gap={4} wrap="nowrap" align="flex-start">
              <Text
                size="sm"
                fw={600}
                c="#105476"
                lineClamp={2}
                style={{ flex: 1, minWidth: 0 }}
              >
                {customerName || "—"}
              </Text>
              {customerName && (
                <Tooltip
                  label={`Show similar ${entityLabelLower}s`}
                  withArrow
                >
                  <ActionIcon
                    variant="subtle"
                    color="#105476"
                    size="sm"
                    aria-label={`Show similar ${entityLabelLower}s`}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleShowSimilarCustomers(customerName);
                    }}
                  >
                    <IconUsers size={14} />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
          );
        },
      },
      {
        accessorKey: "term_code",
        header: "Term Code",
        size: 110,
        Cell: ({ cell }) => (
          <Text size="sm">{cell.getValue<string>() || "—"}</Text>
        ),
      },
      {
        accessorKey: "created_by",
        header: "Assign To",
        size: 200,
        Cell: ({ row }) => (
          <Text size="sm" lineClamp={2}>
            {row.original.created_by || "—"}
          </Text>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 130,
        Cell: ({ row }) => {
          const status = row.original.status;
          const label = status?.trim() || "—";
          return (
            <Badge
              color={getStatusBadgeColor(status)}
              size="sm"
              variant="light"
            >
              {label}
            </Badge>
          );
        },
      },
      {
        accessorKey: "approved_by",
        header: "Approved By",
        size: 180,
        Cell: ({ row }) => (
          <Text size="sm" lineClamp={2}>
            {row.original.approved_by?.trim() || "—"}
          </Text>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        size: 50,
        Cell: ({ row }) => {
          const [menuOpened, setMenuOpened] = useState(false);
          const item = row.original;
          const isFinalized = isFinalizedCustomerStatus(item.status);

          return (
            <Menu
              withinPortal
              position="bottom-end"
              shadow="sm"
              radius="md"
              opened={menuOpened}
              onChange={setMenuOpened}
            >
              <Menu.Target>
                <ActionIcon variant="subtle" color="gray">
                  <IconDotsVertical size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                {isFinalized ? (
                  <Box px={10} py={5}>
                    <UnstyledButton
                      onClick={() => {
                        setMenuOpened(false);
                        setEditableApprovalRow(null);
                        setPendingAction({ row: item, type: "view" });
                      }}
                    >
                      <Group gap="sm">
                        <IconEye size={16} style={{ color: "#105476" }} />
                        <Text size="sm">View {entityLabel}</Text>
                      </Group>
                    </UnstyledButton>
                  </Box>
                ) : (
                  <>
                    <Box px={10} py={5}>
                      <UnstyledButton
                        onClick={() => {
                          setMenuOpened(false);
                          setEditableApprovalRow(cloneApprovalRow(item));
                          setPendingAction({ row: item, type: "approve" });
                        }}
                      >
                        <Group gap="sm">
                          <IconCheck size={16} style={{ color: "#2f9e44" }} />
                          <Text size="sm">Approve</Text>
                        </Group>
                      </UnstyledButton>
                    </Box>
                    <Menu.Divider />
                    <Box px={10} py={5}>
                      <UnstyledButton
                        onClick={() => {
                          setMenuOpened(false);
                          setEditableApprovalRow(null);
                          setPendingAction({ row: item, type: "reject" });
                        }}
                      >
                        <Group gap="sm">
                          <IconX size={16} style={{ color: "#e03131" }} />
                          <Text size="sm">Reject</Text>
                        </Group>
                      </UnstyledButton>
                    </Box>
                  </>
                )}
              </Menu.Dropdown>
            </Menu>
          );
        },
      },
    ],
    [entityLabel, entityLabelLower, handleShowSimilarCustomers],
  );

  const table = useMantineReactTable<TableRow>({
    columns,
    data: displayRows,
    enableColumnFilters: false,
    enablePagination: false,
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
    },
    mantineTableBodyCellProps: {
      style: {
        padding: "8px 12px",
        fontSize: "13px",
        backgroundColor: "#ffffff",
      },
    },
    mantineTableHeadCellProps: {
      style: {
        padding: "6px 12px",
        fontSize: "12px",
        backgroundColor: "#ffffff",
        top: 0,
        zIndex: 3,
        borderBottom: "1px solid #e9ecef",
      },
    },
    mantineTableContainerProps: {
      style: {
        fontSize: "13px",
        width: "100%",
        minHeight: "300px",
        maxHeight: "59vh",
        overflowY: "auto",
        overflowX: "auto",
        position: "relative",
      },
    },
  });

  const tableLoading = isLoading || isFetching;

  useEffect(() => {
    if (!canAccessApproval) {
      navigate("/master", { replace: true });
    }
  }, [canAccessApproval, navigate]);

  if (!canAccessApproval) {
    return null;
  }

  return (
    <>
      <Card
        shadow="sm"
        pt="md"
        pb="sm"
        px="md"
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
        <Box>
          <Group justify="space-between" align="center" pb="sm">
            <Text
              size="md"
              fw={600}
              c="#1E293B"
              style={{ fontFamily: "Inter", fontSize: "16px" }}
            >
              Approve {entityLabel}s
            </Text>

            <Group gap="xs" wrap="nowrap">
              <TextInput
                placeholder="Search..."
                leftSection={<IconSearch size={16} />}
                rightSection={
                  search ? (
                    <ActionIcon
                      variant="transparent"
                      size="sm"
                      onClick={() => setSearch("")}
                      style={{ cursor: "pointer" }}
                    >
                      <IconX size={16} />
                    </ActionIcon>
                  ) : null
                }
                w={248}
                size="sm"
                value={search}
                onChange={(e) => setSearch(e.currentTarget.value)}
                styles={{
                  input: {
                    borderRadius: "4px",
                    fontSize: "14px",
                    fontFamily: "Inter",
                    fontstyle: "regular",
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
                    "&:active": {
                      border: "1px solid #105476",
                      color: "#FFFFFF",
                    },
                  },
                }}
              >
                <IconFilter size={18} />
              </ActionIcon>
            </Group>
          </Group>
        </Box>

        {showFilters && (
          <Box
            tt="capitalize"
            mb="sm"
            p="sm"
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
              mb="sm"
              px="md"
              style={{
                backgroundColor: "#F8FAFC",
                padding: "4px 8px",
              }}
            >
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
              <Grid.Col span={2.4}>
                <FormTextInput
                  format="normal"
                  label={`${entityLabel} Name`}
                  placeholder={`Enter ${entityLabelLower} name`}
                  size="xs"
                  value={draftFilters.customer_name}
                  onChange={(event) =>
                    setDraftFilters((prev) => ({
                      ...prev,
                      customer_name: event.currentTarget.value,
                    }))
                  }
                />
              </Grid.Col>

              <Grid.Col span={2.4}>
                <Dropdown
                  label="Status"
                  placeholder="Select status"
                  size="xs"
                  data={STATUS_FILTER_OPTIONS}
                  value={draftFilters.status}
                  onChange={(value) =>
                    setDraftFilters((prev) => ({
                      ...prev,
                      status: value ?? "",
                    }))
                  }
                />
              </Grid.Col>
            </Grid>

            <Group justify="flex-end" gap="sm" style={{ margin: "8px 8px" }}>
              <Button
                size="sm"
                variant="default"
                onClick={clearFilters}
                leftSection={<IconX size={16} />}
                styles={{
                  root: {
                    borderRadius: "4px",
                    fontSize: "14px",
                    fontFamily: "Inter",
                    fontWeight: 600,
                    height: "36px",
                    border: "1px solid #D0D1D4",
                    color: "#1E293B",
                  },
                }}
              >
                Clear Filters
              </Button>
              <Button
                size="sm"
                onClick={applyFilters}
                loading={tableLoading}
                disabled={tableLoading}
                leftSection={<IconFilter size={16} />}
                styles={{
                  root: {
                    backgroundColor: "#105476",
                    borderRadius: "4px",
                    fontSize: "14px",
                    fontFamily: "Inter",
                    fontWeight: 600,
                    height: "36px",
                    "&:hover": {
                      backgroundColor: "#0d4261",
                    },
                  },
                }}
              >
                Apply Filters
              </Button>
            </Group>
          </Box>
        )}

        {tableLoading ? (
          <Center py="xl" style={{ flex: 1 }}>
            <Stack align="center" gap="md">
              <Loader size="lg" color="#105476" />
              <Text c="dimmed">
                Loading pending {entityLabelLower} verification records...
              </Text>
            </Stack>
          </Center>
        ) : (
          <>
            <MantineReactTable table={table} />
            <PaginationBar
              pageSize={pageSize}
              currentPage={pageIndex + 1}
              totalRecords={totalCount}
              onPageSizeChange={handlePageSizeChange}
              onPageChange={handlePageChange}
              pageSizeOptions={["10", "25", "50"]}
            />
          </>
        )}
      </Card>

      <Modal
        opened={pendingAction !== null}
        onClose={() => {
          if (isSubmittingAction || isUpdatingCustomer) return;
          setPendingAction(null);
          setEditableApprovalRow(null);
        }}
        title={
          pendingAction?.type === "approve"
            ? `Approve ${entityLabel}`
            : pendingAction?.type === "reject"
              ? `Reject ${entityLabel}`
              : `View ${entityLabel}`
        }
        centered
        size="xl"
        zIndex={400}
      >
        <Stack gap="md">
          <Box
            p="sm"
            style={{
              borderRadius: 8,
              backgroundColor:
                pendingAction?.type === "approve"
                  ? "#ebfbee"
                  : pendingAction?.type === "reject"
                    ? "#fff5f5"
                    : "#f8f9fa",
              border: `1px solid ${
                pendingAction?.type === "approve"
                  ? "#b2f2bb"
                  : pendingAction?.type === "reject"
                    ? "#ffc9c9"
                    : "#e9ecef"
              }`,
            }}
          >
            <Text size="sm" fw={500}>
              {pendingAction?.type === "approve"
                ? `Review and edit ${entityLabelLower} details. Use Update to save changes, or Approve to approve.`
                : pendingAction?.type === "reject"
                  ? `Please review all ${entityLabelLower} and address details before rejecting.`
                  : `${entityLabel} details are shown in view-only mode.`}
            </Text>
          </Box>
          {pendingAction?.row && (
            <ScrollArea.Autosize mah="60vh" offsetScrollbars type="auto">
              <CustomerPanApprovalDetails
                row={
                  pendingAction.type === "approve" && editableApprovalRow
                    ? editableApprovalRow
                    : pendingAction.row
                }
                editable={pendingAction.type === "approve"}
                onChange={
                  pendingAction.type === "approve"
                    ? setEditableApprovalRow
                    : undefined
                }
                partyType={partyType}
                requireIndiaTaxIds={isIndiaUser}
                foreignBranchProfile={foreignBranchProfile}
              />
            </ScrollArea.Autosize>
          )}
          <Divider />
          <Group justify="flex-end" gap="sm">
            <Button
              variant="outline"
              color="#105476"
              size="xs"
              onClick={() => {
                setPendingAction(null);
                setEditableApprovalRow(null);
              }}
              disabled={isSubmittingAction || isUpdatingCustomer}
            >
              {pendingAction?.type === "view" ? "Close" : "Cancel"}
            </Button>
            {pendingAction?.type === "approve" && (
              <Button
                size="xs"
                variant="outline"
                color="#105476"
                onClick={handleUpdateCustomer}
                loading={isUpdatingCustomer}
                disabled={isSubmittingAction}
              >
                Update
              </Button>
            )}
            {pendingAction?.type !== "view" && (
              <Button
                size="xs"
                color={pendingAction?.type === "approve" ? "green" : "red"}
                onClick={handleConfirmAction}
                loading={isSubmittingAction}
                disabled={isUpdatingCustomer}
              >
                {pendingAction?.type === "approve" ? "Approve" : "Reject"}
              </Button>
            )}
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={similarModalOpen}
        onClose={() => !similarLoading && setSimilarModalOpen(false)}
        title={`Similar ${entityLabel}s`}
        centered
        size="lg"
      >
        {similarLoading ? (
          <Center py="xl">
            <Stack align="center" gap="md">
              <Loader size="lg" color="#105476" />
              <Text c="dimmed" size="sm">
                Finding similar {entityLabelLower}s...
              </Text>
            </Stack>
          </Center>
        ) : (
          <Stack gap="md">
            <Box
              p="sm"
              style={{
                borderRadius: 8,
                backgroundColor: "#f8f9fa",
                border: "1px solid #e9ecef",
              }}
            >
              <Group justify="space-between" align="center" wrap="nowrap">
                <Text size="sm" c="dimmed" lineClamp={2} style={{ flex: 1 }}>
                  Matches for{" "}
                  <Text span fw={600} c="#105476">
                    {similarSearchName}
                  </Text>
                </Text>
                <Badge variant="light" color="#105476" size="sm">
                  {similarCustomers.length} found
                </Badge>
              </Group>
            </Box>

            {similarCustomers.length > 0 ? (
              <ScrollArea.Autosize mah="58vh" offsetScrollbars type="auto">
                <Stack gap="sm">
                  {similarCustomers.map((customer, index) => (
                    <SimilarCustomerCard
                      key={customer.id ?? `similar-${index}`}
                      customer={customer}
                      index={index}
                    />
                  ))}
                </Stack>
              </ScrollArea.Autosize>
            ) : (
              <Text size="sm" c="dimmed" ta="center" py="md">
                No similar {entityLabelLower}s found.
              </Text>
            )}
          </Stack>
        )}
      </Modal>
    </>
  );
}
