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
import { ToastNotification } from "../../../components";
import {
  approveCustomerPan,
  extractApiErrorMessage,
  fetchCustomerPanPendingList,
  fetchRelatedCustomers,
  formatCustomerPanDisplayValue,
  rejectCustomerPan,
  type CustomerPanApprovalAddress,
  type CustomerPanApprovalFilters,
  type CustomerPanApprovalRow,
  type RelatedCustomer,
} from "../../../service/customerPanApproval.service";
import CustomerDocumentsList from "../../../components/CustomerDocumentsList";

type TableRow = CustomerPanApprovalRow & { sno: number };

type PendingAction = {
  row: CustomerPanApprovalRow;
  type: "approve" | "reject";
};

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
  const normalized = String(status ?? "").trim().toLowerCase();
  if (normalized === "active") return "green";
  if (normalized === "approved") return "teal";
  if (normalized === "rejected") return "red";
  if (normalized === "pending") return "yellow";
  return "gray";
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
}: {
  row: CustomerPanApprovalRow;
}) {
  const addresses = row.addresses_data ?? [];

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
            <Box style={{ gridColumn: customer.phone_no ? undefined : "1 / -1" }}>
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
}: {
  address: CustomerPanApprovalAddress;
  index: number;
}) {
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
            { label: "GSTIN", value: address.gst_id },
            { label: "TAN", value: address.tan_no },
            { label: "ARN", value: address.arn_no },
            { label: "UIN", value: address.uin_no },
            {
              label: "Composite / Regular",
              value: address.composite_regular,
            },
            { label: "SEZ", value: address.sez },
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

export default function ApproveCustomerPanMaster() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const hasCustomerApprovalScreen = Boolean(
    user?.screen_permissions?.customer_approval_screen
  );

  const queryClient = useQueryClient();
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [paginationTotal, setPaginationTotal] = useState(1);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
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

  const handleShowSimilarCustomers = useCallback(async (customerName: string) => {
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
  }, []);

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
    if (!pendingAction) return;

    setIsSubmittingAction(true);
    try {
      if (pendingAction.type === "approve") {
        await approveCustomerPan(pendingAction.row.id);
        ToastNotification({
          type: "success",
          message: "Customer PAN approved successfully.",
        });
      } else {
        await rejectCustomerPan(pendingAction.row.id);
        ToastNotification({
          type: "success",
          message: "Customer PAN rejected successfully.",
        });
      }
      setPendingAction(null);
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
                <Box px={10} py={5}>
                  <UnstyledButton
                    onClick={() => {
                      setMenuOpened(false);
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
                      setPendingAction({ row: item, type: "reject" });
                    }}
                  >
                    <Group gap="sm">
                      <IconX size={16} style={{ color: "#e03131" }} />
                      <Text size="sm">Reject</Text>
                    </Group>
                  </UnstyledButton>
                </Box>
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
    if (!hasCustomerApprovalScreen) {
      navigate("/master", { replace: true });
    }
  }, [hasCustomerApprovalScreen, navigate]);

  if (!hasCustomerApprovalScreen) {
    return null;
  }

  return (
    <>
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="space-between" align="center" mb="md" wrap="nowrap">
          <Text size="md" fw={600} c="#105476">
            Approve Customers
          </Text>

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
              <Text c="dimmed">Loading pending customer PAN records...</Text>
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
                handlePageIndexChange(
                  Math.min(totalPages - 1, pageIndex + 1),
                );
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
        onClose={() => !isSubmittingAction && setPendingAction(null)}
        title={
          pendingAction?.type === "approve"
            ? "Approve Customer"
            : "Reject Customer"
        }
        centered
        size="lg"
      >
        <Stack gap="md">
          <Box
            p="sm"
            style={{
              borderRadius: 8,
              backgroundColor:
                pendingAction?.type === "approve" ? "#ebfbee" : "#fff5f5",
              border: `1px solid ${
                pendingAction?.type === "approve" ? "#b2f2bb" : "#ffc9c9"
              }`,
            }}
          >
            <Text size="sm" fw={500}>
              {pendingAction?.type === "approve"
                ? "Please review all customer and address details before approving."
                : "Please review all customer and address details before rejecting."}
            </Text>
          </Box>
          {pendingAction?.row && (
            <ScrollArea.Autosize mah="60vh" offsetScrollbars type="auto">
              <CustomerPanApprovalDetails row={pendingAction.row} />
            </ScrollArea.Autosize>
          )}
          <Divider />
          <Group justify="flex-end" gap="sm">
            <Button
              variant="outline"
              color="#105476"
              size="xs"
              onClick={() => setPendingAction(null)}
              disabled={isSubmittingAction}
            >
              Cancel
            </Button>
            <Button
              size="xs"
              color={pendingAction?.type === "approve" ? "green" : "red"}
              onClick={handleConfirmAction}
              loading={isSubmittingAction}
            >
              {pendingAction?.type === "approve" ? "Approve" : "Reject"}
            </Button>
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
