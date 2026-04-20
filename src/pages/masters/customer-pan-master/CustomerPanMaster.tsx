import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Card,
  Checkbox,
  Group,
  Stack,
  Text,
  TextInput,
  Divider,
} from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { ToastNotification } from "../../../components";
import { postAPICall } from "../../../service/postApiCall";
import { URL } from "../../../api/serverUrls";
import { API_HEADER } from "../../../store/storeKeys";

type PanAddress = {
  id: number;
  address: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  phone_no?: string;
  mobile_no?: string;
  email?: string;
  pan_no?: string;
  gst_id?: string;
  gst_registration_status?: string;
};

export default function CustomerPanMaster() {
  const [panNumber, setPanNumber] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [addresses, setAddresses] = useState<PanAddress[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [customerName, setCustomerName] = useState("");
  const [apiMessage, setApiMessage] = useState("");
  const navigate = useNavigate();

  const handleSearchClick = async () => {
    const pan = panNumber.trim();
    if (!pan) {
      ToastNotification({
        type: "error",
        message: "Please enter a PAN number before searching",
      });
      return;
    }

    try {
      setIsSearching(true);
      setSelectedIds(new Set());
      setAddresses([]);
      setCustomerName("");
      setApiMessage("");

      const response = (await postAPICall(
        URL.panGstByPan,
        { pan_no: pan },
        API_HEADER,
      )) as {
        status?: string;
        message?: string;
        data?: {
          pan_no?: string;
          customer_name?: string;
          gst_uin_list?: Array<{
            gst_uin?: string;
            status?: string;
            state?: string;
            address?: string;
          }>;
        };
      };

      const status = response?.status;
      const message = response?.message ?? "";
      const data = response?.data;

      if (!status || status.toLowerCase() !== "success" || !data) {
        ToastNotification({
          type: "error",
          message:
            message ||
            "No GST registrations found for this PAN. Please verify the PAN number.",
        });
        return;
      }

      setCustomerName(data.customer_name ?? "");
      setApiMessage(message);

      const gstList = Array.isArray(data.gst_uin_list)
        ? data.gst_uin_list
        : [];

      if (!gstList.length) {
        ToastNotification({
          type: "info",
          message: "No GST registrations found for this PAN.",
        });
        setAddresses([]);
        return;
      }

      const mapped: PanAddress[] = gstList.map((item, index) => ({
        id: index + 1,
        address: item.address ?? "",
        city: "",
        state: item.state ?? "",
        country: "",
        pincode: "",
        phone_no: "",
        mobile_no: "",
        email: "",
        pan_no: data.pan_no ?? pan,
        gst_id: item.gst_uin ?? "",
        gst_registration_status: item.status ?? "",
      }));

      setAddresses(mapped);
    } catch (error) {
      console.error("Error searching by PAN:", error);
      ToastNotification({
        type: "error",
        message: "Failed to search addresses for this PAN number",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const toggleAddressSelection = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCreateCustomer = () => {
    const selected = addresses.filter((addr) => selectedIds.has(addr.id));

    if (selected.length === 0) {
      ToastNotification({
        type: "error",
        message: "Please select at least one address before creating a customer",
      });
      return;
    }

    const mappedAddresses = selected.map((addr) => ({
      customer_location: "",
      address_type: "Primary",
      address: addr.address,
      city: addr.city,
      state: addr.state,
      country: addr.country || "",
      pincode: addr.pincode,
      phone_no: addr.phone_no ?? "",
      mobile_no: addr.mobile_no ?? "",
      email: addr.email ?? "",
      pan_no: addr.pan_no ?? panNumber.trim(),
      gst_id: addr.gst_id ?? "",
      gst_registration_status: addr.gst_registration_status ?? "",
      latitude: 0,
      longitude: 0,
    }));

    navigate("/master/customer/create", {
      state: {
        customerData: {
          customer_name: customerName || "",
          customer_type_code: "customer",
          term_code: "",
          own_office: false,
          assigned_to: "",
          addresses_data: mappedAddresses,
        },
      },
    });
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
          onChange={(e) => setPanNumber(e.target.value)}
          style={{ flex: 1, maxWidth: 400 }}
          size="sm"
        />
        <Button
          color="#2563EB"
          variant="light"
          size="sm"
          onClick={handleSearchClick}
          loading={isSearching}
          aria-label="Search by PAN"
        >
          <IconSearch size={16} />
        </Button>
      </Group>

      {customerName && (
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
            Customer from PAN
          </Text>
          <Text size="lg" fw={700} c="#2563EB" mt={4}>
            {customerName}
          </Text>
          {apiMessage && (
            <Text size="xs" c="dimmed" mt={4}>
              {apiMessage}
            </Text>
          )}
          <Divider mt="sm" />
        </Box>
      )}

      <Stack mt="xl" gap="sm">
        {addresses.length === 0 ? (
          <Text size="sm" c="dimmed">
            No addresses found. Enter a PAN number and search to see matching addresses.
          </Text>
        ) : (
          <Group gap="md" wrap="wrap" align="stretch">
            {addresses.map((addr) => (
              <Card
                key={addr.id}
                withBorder
                padding="md"
                radius="md"
                shadow="xs"
                style={{
                  width: 400,
                  minHeight: 160,
                  borderColor: selectedIds.has(addr.id) ? "#2563EB" : "#e0e0e0",
                  backgroundColor: selectedIds.has(addr.id) ? "#f5fbff" : "#ffffff",
                  display: "flex",
                  alignItems: "stretch",
                }}
              >
                <Group align="flex-start" gap="sm" wrap="nowrap" style={{ width: "100%" }}>
                  <Checkbox
                    checked={selectedIds.has(addr.id)}
                    onChange={() => toggleAddressSelection(addr.id)}
                    mt={4}
                  />
                  <Box style={{ flex: 1, minHeight: 80 }}>
                    <Text size="sm" fw={600} c="#2563EB">
                      {addr.gst_id || "GST UIN not available"}
                    </Text>
                    <Text size="xs" c="dimmed" mt={2}>
                      {addr.state || "State not available"}
                      {addr.gst_registration_status
                        ? ` • ${addr.gst_registration_status}`
                        : ""}
                    </Text>
                    <Text size="sm" mt={6}>
                      {addr.address || "Address not available"}
                    </Text>
                  </Box>
                </Group>
              </Card>
            ))}
          </Group>
        )}
      </Stack>

      <Group justify="flex-end" mt="xl">
        <Button color="#2563EB" onClick={handleCreateCustomer} disabled={selectedIds.size === 0}>
          Create Customer
        </Button>
      </Group>
    </Card>
  );
}

