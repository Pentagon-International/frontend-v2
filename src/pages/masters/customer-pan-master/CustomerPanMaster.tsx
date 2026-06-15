import { useCallback, useMemo, useState } from "react";
import {
  Button,
  Card,
  Checkbox,
  Group,
  ScrollArea,
  Table,
  Text,
  TextInput,
  Badge,
} from "@mantine/core";
import { IconPaperclip, IconSearch } from "@tabler/icons-react";
import { useDisclosure } from "@mantine/hooks";
import { useQuery } from "@tanstack/react-query";
import { ToastNotification } from "../../../components";
import SupportingDocumentsModal from "../../../components/SupportingDocumentsModal";
import { getAPICall } from "../../../service/getApiCall";
import { postAPICall } from "../../../service/postApiCall";
import { URL } from "../../../api/serverUrls";
import { API_HEADER } from "../../../store/storeKeys";
import useAuthStore from "../../../store/authStore";
import {
  // searchGstinByPan, // uncomment when switching from hardcoded test data to live API
  buildAddressLine,
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
import {
  extractDocumentsListFromResponse,
  mapDocumentsListToSupportingDocuments,
  type CustomerDocumentListItem,
} from "../../../utils/customerDocuments";

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

function buildAddressEntry(
  record: AttestrGstinRecord,
  pan: string,
  addressType: "Primary" | "Secondary",
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
    phone_no: DUMMY_PHONE,
    mobile_no: DUMMY_PHONE,
    email: DUMMY_EMAIL,
    pan_no: record.pan || pan,
    gst_id: record.gstin || "",
    gst_registration_status: "Registered",
    latitude: Number.isFinite(lat) ? lat : 0,
    longitude: Number.isFinite(lng) ? lng : 0,
  };
}

function buildCustomerPayload(
  records: AttestrGstinRecord[],
  pan: string,
  customerTypeCode: string,
  assignedTo: string,
) {
  const primary = records[0];
  return {
    customer_name: primary.legalName || primary.tradeName || "",
    customer_type_code: [customerTypeCode],
    term_code: "CREDIT",
    own_office: false,
    status: "ACTIVE",
    assigned_to: assignedTo,
    addresses_data: records.map((record, index) =>
      buildAddressEntry(
        record,
        pan,
        index === 0 ? "Primary" : "Secondary",
      ),
    ),
  };
}

function formatCustomerCreateError(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("already exist") ||
    lower.includes("already exists") ||
    lower.includes("customer exist")
  ) {
    return "This customer already exists.";
  }
  return message;
}

export default function CustomerPanMaster() {
  const user = useAuthStore((s) => s.user);
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

      // Live API — uncomment searchGstinByPan import and line below when testing is done:
      // const response = await searchGstinByPan(pan);
      const response = {
    "valid": true,
    "message": null,
    "records": [
        {
            "gstin": "27AAGCP4765J1ZY",
            "active": true,
            "pan": "AAGCP4765J",
            "registered": "01-07-2017",
            "legalName": "PENTAGON INTERNATIONAL FREIGHT SOLUTIONS PRIVATE LIMITED",
            "tradeName": "PENTAGON INTERNATIONAL FREIGHT SOLUTIONS PRIVATE LIMITED",
            "status": "Active",
            "type": "Regular",
            "constitution": "Private Limited Company",
            "primaryAddress": {
                "type": "PRIMARY",
                "building": "SATELLITE SILVER CO OP PREMISES SOC LTD",
                "buildingName": "",
                "floor": "204",
                "street": "ANDHERI KURLA ROAD",
                "locality": "Mumbai",
                "district": "Mumbai Suburban",
                "state": "Maharashtra",
                "zip": "400059",
                "latitude": "19.1124590000001",
                "longitude": "72.8738440000001",
                "nature": "Service Provision, Supplier of Services"
            }
        },
        {
            "gstin": "07AAGCP4765J1Z0",
            "active": true,
            "pan": "AAGCP4765J",
            "registered": "14-07-2017",
            "legalName": "PENTAGON INTERNATIONAL FREIGHT SOLUTIONS PRIVATE LIMITED",
            "tradeName": "PENTAGON INTERNATIONAL FREIGHT SOLUTIONS PRIVATE LIMITED",
            "status": "Active",
            "type": "Regular",
            "constitution": "Private Limited Company",
            "primaryAddress": {
                "type": "PRIMARY",
                "building": "A-50",
                "buildingName": "",
                "floor": "GROUND FLOOR",
                "street": "STREET NO 09,ROAD NO 4",
                "locality": "MAHIPALPUR EXTENTION",
                "district": "New Delhi",
                "state": "Delhi",
                "zip": "110037",
                "latitude": "",
                "longitude": "",
                "nature": "Supplier of Services"
            }
        },
        {
            "gstin": "33AAGCP4765J1Z5",
            "active": true,
            "pan": "AAGCP4765J",
            "registered": "26-07-2017",
            "legalName": "PENTAGON INTERNATIONAL FREIGHT SOLUTIONS PRIVATE LIMITED",
            "tradeName": "PENTAGON INTERNATIONAL FREIGHT SOLUTIONS PRIVATE LIMITED",
            "status": "Active",
            "type": "Regular",
            "constitution": "Private Limited Company",
            "primaryAddress": {
                "type": "PRIMARY",
                "building": "OLD NO 6,",
                "buildingName": "",
                "floor": "NEW NO 15",
                "street": "DR GOPALA MENON TOAD",
                "locality": "KODAMBAKKAM",
                "district": "Chennai",
                "state": "Tamil Nadu",
                "zip": "600024",
                "latitude": "",
                "longitude": "",
                "nature": "Supplier of Services"
            }
        },
        {
            "gstin": "27AAGCP4765J2ZX",
            "active": true,
            "pan": "AAGCP4765J",
            "registered": "01-04-2025",
            "legalName": "PENTAGON INTERNATIONAL FREIGHT SOLUTIONS PRIVATE LIMITED",
            "tradeName": "PENTAGON INTERNATIONAL FREIGHT SOLUTIONS PRIVATE LIMITED",
            "status": "Active",
            "type": "Input Service Distributor (ISD)",
            "constitution": "Private Limited Company",
            "primaryAddress": {
                "type": "PRIMARY",
                "building": "SATELLITE SILVER CO OP PREMISES SOC LTD",
                "buildingName": "",
                "floor": "204",
                "street": "ANDHERI KURLA ROAD",
                "locality": "Mumbai",
                "district": "Mumbai Suburban",
                "state": "Maharashtra",
                "zip": "400059",
                "latitude": "19.1113500000001",
                "longitude": "72.869313",
                "nature": "Recipient of Goods or Services"
            }
        },
        {
            "gstin": "29AAGCP4765J2ZT",
            "active": true,
            "pan": "AAGCP4765J",
            "registered": "26-12-2024",
            "legalName": "PENTAGON INTERNATIONAL FREIGHT SOLUTIONS PRIVATE LIMITED",
            "tradeName": "PENTAGON INTERNATIONAL FREIGHT SOLUTIONS PRIVATE LIMITED",
            "status": "Active",
            "type": "Regular",
            "constitution": "Private Limited Company",
            "primaryAddress": {
                "type": "PRIMARY",
                "building": "Building No.3",
                "buildingName": "Srinidhi Envoy",
                "floor": "1st Floor",
                "street": "3A, 4th Cross",
                "locality": "Bengaluru",
                "district": "Bengaluru Urban",
                "state": "Karnataka",
                "zip": "560043",
                "latitude": "13.010323",
                "longitude": "77.659339",
                "nature": "Supplier of Services"
            }
        },
        {
            "gstin": "24AAGCP4765J1Z4",
            "active": true,
            "pan": "AAGCP4765J",
            "registered": "12-08-2022",
            "legalName": "PENTAGON INTERNATIONAL FREIGHT SOLUTIONS PRIVATE LIMITED",
            "tradeName": "PENTAGON INTERNATIONAL FREIGHT SOLUTIONS PRIVATE LIMITED",
            "status": "Active",
            "type": "Regular",
            "constitution": "Private Limited Company",
            "primaryAddress": {
                "type": "PRIMARY",
                "building": "Office No.10",
                "buildingName": "Plot No.211, Ward 12-B",
                "floor": "1st floor",
                "street": "Shah Avenue-1",
                "locality": "Gandhidham",
                "district": "Kachchh",
                "state": "Gujarat",
                "zip": "370201",
                "latitude": "23.061393",
                "longitude": "70.126118",
                "nature": "Supplier of Services"
            }
        }
    ]
};

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
        message: "Please select at least one GST registration to create a customer",
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

    try {
      const sizeError = validateSupportingDocumentSizes(supportingDocuments);
      if (sizeError) {
        ToastNotification({ type: "error", message: sizeError });
        return;
      }

      const payload = buildCustomerPayload(
        selected,
        panNumber.trim().toUpperCase(),
        customerTypeCode,
        assignedTo,
      );
      const response = (await submitCustomerVerification(
        payload,
        supportingDocuments,
      )) as { message?: string; documents_list?: CustomerDocumentListItem[] } | null;

      const uploadedDocs = extractDocumentsListFromResponse(response);
      if (uploadedDocs.length > 0) {
        setSupportingDocuments([
          ...mapDocumentsListToSupportingDocuments(uploadedDocs),
          { ...EMPTY_SUPPORTING_DOCUMENT },
        ]);
      }

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
            ? "Customer verification submitted successfully."
            : `Customer verification submitted with ${selected.length} addresses.`),
      });
      setSelectedGstins(new Set());
      if (uploadedDocs.length === 0) {
        setSupportingDocuments([{ ...EMPTY_SUPPORTING_DOCUMENT }]);
      }
    } catch (error) {
      ToastNotification({
        type: "error",
        message: formatCustomerCreateError(extractApiErrorMessage(error)),
      });
    } finally {
      setIsCreating(false);
    }
  };

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

      {records.length > 0 && (
        <Group gap="md" mt="md">
          <Text size="xs" c="dimmed">
            Assign To: <strong>{assignedTo || "—"}</strong>
          </Text>
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
            onClick={handleCreateCustomers}
            disabled={selectedGstins.size === 0}
            loading={isCreating}
          >
            Create Customer
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
    </Card>
  );
}
