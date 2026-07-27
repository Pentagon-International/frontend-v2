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
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import dayjs from "dayjs";
import {
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconDotsVertical,
  IconEye,
  IconFilter,
  IconFilterOff,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import {
  MantineReactTable,
  MRT_ColumnDef,
  useMantineReactTable,
} from "mantine-react-table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  SearchableSelect,
  SingleDateInput,
  ToastNotification,
} from "../../../components";
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
import { isIndianUserFromProfile } from "../../../utils/userNumberFormat";

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
  };
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

function getStatusBadgeColor(status?: string): string {
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

function formatDetailValue(value: unknown): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const parsed = dayjs(value);
    if (parsed.isValid()) return parsed.format("DD MMM YYYY, hh:mm A");
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
              {formatDetailValue(field.value)}
            </Text>
          </Box>
        ))}
      </SimpleGrid>
    </Box>
  );
}

function CustomerPanApprovalDetails({
  row,
  editable = false,
  onChange,
}: {
  row: CustomerPanApprovalRow;
  editable?: boolean;
  onChange?: (next: CustomerPanApprovalRow) => void;
}) {
  const addresses = row.addresses_data ?? [];

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

  if (!editable) {
    return (
      <Stack gap="md">
        <Card withBorder padding="md" radius="md" bg="#fafbfc">
          <Stack gap="md">
            <Box>
              <Text size="xs" c="dimmed" fw={500} mb={4}>
                Customer Name
              </Text>
              <Text size="md" fw={600} c="#105476" style={{ lineHeight: 1.4 }}>
                {row.customer_name || "—"}
              </Text>
            </Box>

            <DetailSection
              title="General Information"
              fields={[
                { label: "Term Code", value: row.term_code },
                { label: "TDS Type", value: row.tds_type },
                { label: "Own Office", value: row.own_office },
                { label: "Customer Status", value: row.status },
                { label: "Assign To", value: row.created_by },
                { label: "Network", value: row.network_name },
              ]}
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
              Customer Name
            </Text>
            <Text size="md" fw={600} c="#105476" style={{ lineHeight: 1.4 }}>
              {row.customer_name || "—"}
            </Text>
          </Box>

          <Text size="xs" fw={700} c="#105476" tt="uppercase">
            General Information
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <Select
              label="Credit Type"
              data={TERM_CODE_OPTIONS}
              value={row.term_code || null}
              onChange={(value) => updateRow({ term_code: value ?? "" })}
              clearable
            />
            <Select
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
              clearable
            />
            <TextInput
              label="Customer Status"
              value={row.status ?? ""}
              onChange={(e) => updateRow({ status: e.target.value })}
            />
            <TextInput
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
              dropdownZIndex={1000}
              minSearchLength={1}
            />
          </SimpleGrid>

          <Text size="xs" fw={700} c="#105476" tt="uppercase">
            Credit Terms
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <TextInput
              label="Credit Days"
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
            <TextInput
              label="Credit Amount"
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
}: {
  address: CustomerPanApprovalAddress;
  index: number;
  editable?: boolean;
  onChange?: (patch: Partial<CustomerPanApprovalAddress>) => void;
}) {
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
              { label: "Pin Code", value: address.pincode },
            ]}
          />

          <DetailSection
            title="Contact"
            fields={[
              { label: "Phone", value: address.phone_no },
              { label: "Mobile", value: address.mobile_no },
              { label: "Email", value: address.email, fullWidth: true },
            ]}
          />

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
          <TextInput
            label="Location"
            value={address.customer_location ?? ""}
            onChange={(e) => onChange?.({ customer_location: e.target.value })}
          />
          <Select
            label="Address Type"
            data={[
              { value: "Primary", label: "Primary" },
              { value: "Secondary", label: "Secondary" },
              { value: "Billing", label: "Billing" },
              { value: "Shipping", label: "Shipping" },
            ]}
            value={address.address_type || null}
            onChange={(value) => onChange?.({ address_type: value ?? "" })}
          />
          <TextInput
            label="Address"
            style={{ gridColumn: "1 / -1" }}
            value={address.address ?? ""}
            onChange={(e) => onChange?.({ address: e.target.value })}
          />
          <TextInput
            label="City"
            value={address.city ?? ""}
            onChange={(e) => onChange?.({ city: e.target.value })}
          />
          <TextInput
            label="State"
            value={address.state ?? ""}
            onChange={(e) => onChange?.({ state: e.target.value })}
          />
          <TextInput
            label="Country"
            value={address.country ?? ""}
            onChange={(e) => onChange?.({ country: e.target.value })}
          />
          <TextInput
            label="Pin Code"
            value={address.pincode ?? ""}
            onChange={(e) => onChange?.({ pincode: e.target.value })}
          />
        </SimpleGrid>

        <Text size="xs" fw={700} c="#105476" tt="uppercase">
          Contact
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <TextInput
            label="Phone"
            value={address.phone_no ?? ""}
            onChange={(e) => onChange?.({ phone_no: e.target.value })}
          />
          <TextInput
            label="Mobile"
            value={address.mobile_no ?? ""}
            onChange={(e) => onChange?.({ mobile_no: e.target.value })}
          />
          <TextInput
            label="Email"
            style={{ gridColumn: "1 / -1" }}
            value={address.email ?? ""}
            onChange={(e) => onChange?.({ email: e.target.value })}
          />
        </SimpleGrid>

        <Text size="xs" fw={700} c="#105476" tt="uppercase">
          Tax & Registration
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <TextInput
            label="PAN"
            value={address.pan_no ?? ""}
            onChange={(e) => onChange?.({ pan_no: e.target.value })}
          />
          <Select
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
          <TextInput
            label="Tax ID / GSTIN"
            value={address.gst_id ?? ""}
            onChange={(e) => onChange?.({ gst_id: e.target.value })}
          />
          <TextInput
            label="IEC Code"
            value={address.iec_code ?? ""}
            onChange={(e) => onChange?.({ iec_code: e.target.value })}
          />
          <TextInput
            label="TAN"
            value={address.tan_no ?? ""}
            onChange={(e) => onChange?.({ tan_no: e.target.value })}
          />
          <TextInput
            label="ARN"
            value={address.arn_no ?? ""}
            onChange={(e) => onChange?.({ arn_no: e.target.value })}
          />
          <TextInput
            label="UIN"
            value={address.uin_no ?? ""}
            onChange={(e) => onChange?.({ uin_no: e.target.value })}
          />
          <Select
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
          <Select
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
          <Select
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
            <TextInput
              label="MSME No"
              value={address.msme_no ?? ""}
              onChange={(e) => onChange?.({ msme_no: e.target.value })}
            />
          )}
        </SimpleGrid>
      </Stack>
    </Card>
  );
}

export default function ApproveCustomerPanMaster() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isIndiaUser = isIndianUserFromProfile(user?.country);
  const hasCustomerApprovalScreen = Boolean(
    user?.screen_permissions?.customer_approval_screen,
  );
  const canAccessApproval = hasCustomerApprovalScreen || !isIndiaUser;

  const queryClient = useQueryClient();
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [paginationTotal, setPaginationTotal] = useState(1);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );
  const [editableApprovalRow, setEditableApprovalRow] =
    useState<CustomerPanApprovalRow | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [isUpdatingCustomer, setIsUpdatingCustomer] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
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
      customer_name: appliedFilters.customer_name.trim() || undefined,
      status: appliedFilters.status.trim() || undefined,
    }),
    [appliedFilters],
  );

  const {
    data: listResult,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: [
      "customerPanPending",
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
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (listResult) {
      setTotalCount(listResult.total);
      setPaginationTotal(listResult.paginationTotal);
    }
  }, [listResult]);

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

  const handlePageIndexChange = (newPageIndex: number) => {
    setPageIndex(newPageIndex);
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
          message: "Customer approved successfully.",
        });
      } else {
        await rejectCustomerPan(pendingAction.row.id);
        ToastNotification({
          type: "success",
          message: "Customer rejected successfully.",
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
    setIsUpdatingCustomer(true);
    try {
      await updateCustomerVerification(
        pendingAction.row.id,
        buildCustomerVerificationPayload(rowToUpdate),
      );
      ToastNotification({
        type: "success",
        message: "Customer updated successfully.",
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
        header: "Customer Name",
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
                <Tooltip label="Show similar customers" withArrow>
                  <ActionIcon
                    variant="subtle"
                    color="#105476"
                    size="sm"
                    aria-label="Show similar customers"
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
                        <Text size="sm">View Customer</Text>
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
    [handleShowSimilarCustomers],
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
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="space-between" align="center" mb="md" wrap="nowrap">
          <Box>
            <Text size="md" fw={600} c="#105476">
              Approve Customers
            </Text>
            <Text size="xs" c="dimmed" mt={4}>
              Review and approve pending customer verification requests
            </Text>
          </Box>

          <Button
            variant="outline"
            leftSection={<IconFilter size={16} />}
            size="xs"
            color="#105476"
            onClick={() => setShowFilters((prev) => !prev)}
          >
            Filters
          </Button>
        </Group>

        {showFilters && (
          <Card
            shadow="xs"
            padding="md"
            radius="md"
            withBorder
            mb="md"
            bg="#f8f9fa"
          >
            <Group align="center" gap="xs" mb="md">
              <IconFilter size={16} color="#105476" />
              <Text size="sm" fw={500} c="#105476">
                Filters
              </Text>
            </Group>

            <Grid>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label="Customer Name"
                  placeholder="Enter customer name"
                  size="xs"
                  value={draftFilters.customer_name}
                  onChange={(event) =>
                    setDraftFilters((prev) => ({
                      ...prev,
                      customer_name: event.currentTarget.value,
                    }))
                  }
                  styles={{
                    input: { fontSize: 12 },
                    label: {
                      fontSize: 12,
                      fontWeight: 500,
                      color: "#495057",
                    },
                  }}
                />
              </Grid.Col>

              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Select
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
                  styles={{
                    input: { fontSize: 12 },
                    label: {
                      fontSize: 12,
                      fontWeight: 500,
                      color: "#495057",
                    },
                  }}
                />
              </Grid.Col>
            </Grid>

            <Group justify="flex-end" mt="md" gap="sm">
              <Button
                variant="default"
                size="xs"
                leftSection={<IconFilterOff size={14} />}
                onClick={clearFilters}
              >
                Clear
              </Button>
              <Button
                size="xs"
                color="#105476"
                leftSection={<IconFilter size={14} />}
                onClick={applyFilters}
              >
                Apply
              </Button>
            </Group>
          </Card>
        )}

        {tableLoading ? (
          <Center py="xl">
            <Stack align="center" gap="md">
              <Loader size="lg" color="#105476" />
              <Text c="dimmed">
                Loading pending customer verification records...
              </Text>
            </Stack>
          </Center>
        ) : (
          <MantineReactTable table={table} />
        )}

        <Group
          w="100%"
          justify="space-between"
          align="center"
          px="md"
          py="xs"
          style={{ borderTop: "1px solid #e9ecef" }}
          wrap="nowrap"
          mt="xs"
        >
          <Group gap="sm" align="center" wrap="nowrap" mt={10}>
            <Text size="sm" c="dimmed">
              Rows per page
            </Text>
            <Select
              size="xs"
              data={["10", "25", "50"]}
              value={String(pageSize)}
              onChange={(val) => {
                if (!val) return;
                handlePageSizeChange(Number(val));
              }}
              w={110}
              styles={{ input: { fontSize: 12, height: 30 } }}
            />
            <Text size="sm" c="dimmed">
              {(() => {
                if (totalCount === 0) return "0–0 of 0";
                const start = pageIndex * pageSize + 1;
                const end = Math.min((pageIndex + 1) * pageSize, totalCount);
                return `${start}–${end} of ${totalCount}`;
              })()}
            </Text>
          </Group>

          <Group gap="xs" align="center" wrap="nowrap" mt={10}>
            <ActionIcon
              variant="default"
              size="sm"
              onClick={() => handlePageIndexChange(Math.max(0, pageIndex - 1))}
              disabled={pageIndex === 0}
            >
              <IconChevronLeft size={16} />
            </ActionIcon>
            <Text size="sm" ta="center" style={{ width: 26 }}>
              {pageIndex + 1}
            </Text>
            <Text size="sm" c="dimmed">
              of {Math.max(1, paginationTotal)}
            </Text>
            <ActionIcon
              variant="default"
              size="sm"
              onClick={() => {
                const totalPages = Math.max(1, paginationTotal);
                handlePageIndexChange(Math.min(totalPages - 1, pageIndex + 1));
              }}
              disabled={pageIndex >= paginationTotal - 1}
            >
              <IconChevronRight size={16} />
            </ActionIcon>
          </Group>
        </Group>
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
            ? "Approve Customer"
            : pendingAction?.type === "reject"
              ? "Reject Customer"
              : "View Customer"
        }
        centered
        size="xl"
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
                ? "Review and edit customer details. Use Update to save changes, or Approve to approve."
                : pendingAction?.type === "reject"
                  ? "Please review all customer and address details before rejecting."
                  : "Customer details are shown in view-only mode."}
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
        title="Similar Customers"
        centered
        size="lg"
      >
        {similarLoading ? (
          <Center py="xl">
            <Stack align="center" gap="md">
              <Loader size="lg" color="#105476" />
              <Text c="dimmed" size="sm">
                Finding similar customers...
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
                No similar customers found.
              </Text>
            )}
          </Stack>
        )}
      </Modal>
    </>
  );
}
