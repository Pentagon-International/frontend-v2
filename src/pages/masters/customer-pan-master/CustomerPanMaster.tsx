import { useCallback, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  Checkbox,
  Group,
  ScrollArea,
  Stack,
  Table,
  Text,
  TextInput,
  Badge,
} from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { ToastNotification } from "../../../components";
import { postAPICall } from "../../../service/postApiCall";
import { getAPICall } from "../../../service/getApiCall";
import { URL } from "../../../api/serverUrls";
import { API_HEADER } from "../../../store/storeKeys";
import useAuthStore from "../../../store/authStore";
import {
  searchGstinByPan,
  buildAddressLine,
  type AttestrGstinRecord,
} from "../../../service/attestrGstin.service";

const DUMMY_EMAIL = "customer@dummy.local";
const DUMMY_PHONE = "9999999999";

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

function resolveCustomerTypeCode(types: CustomerTypeRow[]): string {
  const match = types.find(
    (t) =>
      String(t.customer_type_name ?? "").trim().toLowerCase() === "customer",
  );
  if (match?.customer_type_code) return match.customer_type_code;
  const loose = types.find((t) =>
    String(t.customer_type_name ?? "").toLowerCase().includes("customer"),
  );
  return loose?.customer_type_code ?? "customer";
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
    if (
      candidates.some(
        (c) => norm.includes(c) || c.includes(norm),
      )
    ) {
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

function buildCustomerPayload(
  record: AttestrGstinRecord,
  pan: string,
  customerTypeCode: string,
  assignedTo: string,
) {
  const addr = record.primaryAddress ?? {};
  const addressLine = buildAddressLine(addr);
  const lat = Number(addr.latitude);
  const lng = Number(addr.longitude);

  return {
    customer_name: record.legalName || record.tradeName || "",
    customer_type_code: [customerTypeCode],
    term_code: "CREDIT",
    own_office: false,
    status: "ACTIVE",
    assigned_to: assignedTo,
    addresses_data: [
      {
        customer_location: addr.locality || addr.district || "",
        address_type: "Primary",
        address: addressLine,
        city: addr.locality || addr.district || "",
        state: addr.state || "",
        country: "India",
        pincode: addr.zip || "",
        phone_no: DUMMY_PHONE,
        mobile_no: DUMMY_PHONE,
        email: DUMMY_EMAIL,
        pan_no: record.pan || pan,
        gst_id: record.gstin || "",
        gst_registration_status: record.status || "",
        latitude: Number.isFinite(lat) ? lat : 0,
        longitude: Number.isFinite(lng) ? lng : 0,
      },
    ],
  };
}

export default function CustomerPanMaster() {
  const user = useAuthStore((s) => s.user);
  const [panNumber, setPanNumber] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [records, setRecords] = useState<AttestrGstinRecord[]>([]);
  const [selectedGstins, setSelectedGstins] = useState<Set<string>>(new Set());
  const [searchMessage, setSearchMessage] = useState("");

  const { data: customerTypes = [] } = useQuery({
    queryKey: ["customerTypes", "pan-master"],
    queryFn: async () => {
      const response = (await getAPICall(`${URL.customerType}`, API_HEADER)) as
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
    queryKey: ["salespersons", "pan-master"],
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

  const customerTypeCode = useMemo(
    () => resolveCustomerTypeCode(customerTypes),
    [customerTypes],
  );

  const assignedTo = useMemo(
    () => resolveLoggedInAssignTo(salespersons, user),
    [salespersons, user],
  );

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

      setRecords(list);
      setSearchMessage(response.message ?? "");
    } catch (error) {
      console.error("Attestr GSTIN search error:", error);
      ToastNotification({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to search GST registrations for this PAN",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleCreateCustomers = async () => {
    const selected = records.filter((r) => selectedGstins.has(r.gstin));
    if (!selected.length) {
      ToastNotification({
        type: "error",
        message: "Please select at least one GST registration to create customers",
      });
      return;
    }

    if (!assignedTo) {
      ToastNotification({
        type: "error",
        message:
          "Could not resolve Assign To for the logged-in user. Check salesperson mapping.",
      });
      return;
    }

    setIsCreating(true);
    let created = 0;
    const failures: string[] = [];

    for (const record of selected) {
      try {
        const payload = buildCustomerPayload(
          record,
          panNumber.trim().toUpperCase(),
          customerTypeCode,
          assignedTo,
        );
        await postAPICall(URL.customer, payload, API_HEADER);
        created += 1;
      } catch (error) {
        const label = record.gstin || record.legalName;
        const msg =
          error instanceof Error ? error.message : "Create failed";
        failures.push(`${label}: ${msg}`);
      }
    }

    setIsCreating(false);

    if (created > 0) {
      ToastNotification({
        type: "success",
        message: `Created ${created} customer${created === 1 ? "" : "s"} successfully.`,
      });
      setSelectedGstins(new Set());
    }

    if (failures.length) {
      ToastNotification({
        type: "error",
        message:
          failures.length === selected.length
            ? failures[0]
            : `${failures.length} failed: ${failures[0]}`,
      });
    }
  };

  const primaryLegalName = records[0]?.legalName ?? "";

  return (
    <Card shadow="sm" padding="lg" radius="md">
      <Group justify="space-between" mb="md">
        <Text size="md" fw={600}>
          Create Customer from PAN
        </Text>
      </Group>

      <Group align="flex-end" gap="sm" mt="lg">
        <TextInput
          label="PAN Number"
          placeholder="Enter PAN Number"
          value={panNumber}
          onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
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

      {primaryLegalName && (
        <Box
          mt="lg"
          p="sm"
          style={{
            borderRadius: 8,
            backgroundColor: "#f5fbff",
            border: "1px solid #c5e4f5",
          }}
        >
          <Text size="xs" c="dimmed" fw={500} tt="uppercase">
            Company from PAN
          </Text>
          <Text size="lg" fw={700} c="#105476" mt={4}>
            {primaryLegalName}
          </Text>
          <Group gap="md" mt={6}>
            <Text size="xs" c="dimmed">
              Assign To: <strong>{assignedTo || "—"}</strong>
            </Text>
          </Group>
          {searchMessage && (
            <Text size="xs" c="dimmed" mt={4}>
              {searchMessage}
            </Text>
          )}
        </Box>
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
              horizontalSpacing="md"
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
                  <Table.Th>GSTIN</Table.Th>
                  <Table.Th>Company Name</Table.Th>
                  <Table.Th>Location</Table.Th>
                  <Table.Th>State</Table.Th>
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
                      <Table.Td>
                        <Text fz={13} fw={500} maw={280} lineClamp={2}>
                          {row.legalName || "—"}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text fz={13}>
                          {row.primaryAddress?.locality || "—"}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text fz={13}>{row.primaryAddress?.state || "—"}</Text>
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
            color="#105476"
            onClick={handleCreateCustomers}
            disabled={selectedGstins.size === 0}
            loading={isCreating}
          >
            Create Customer{selectedGstins.size > 1 ? "s" : ""}
            {selectedGstins.size > 0 ? ` (${selectedGstins.size})` : ""}
          </Button>
        </Group>
      )}
    </Card>
  );
}
