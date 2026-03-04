import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Card, Checkbox, Group, Stack, Text, TextInput } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { ToastNotification } from "../../../components";

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
};

export default function CustomerPanMaster() {
  const [panNumber, setPanNumber] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [addresses, setAddresses] = useState<PanAddress[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
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
      // TODO: Integrate actual PAN search API here and set the addresses from response.
      // Example:
      // const response = await postAPICall(URL.panLookup, { pan }, API_HEADER);
      // setAddresses(response?.data ?? []);

      // For now, just clear any previous results.
      setAddresses([]);
      setSelectedIds(new Set());
      ToastNotification({
        type: "info",
        message: "PAN search API integration is pending.",
      });
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
      country: addr.country,
      pincode: addr.pincode,
      phone_no: addr.phone_no ?? "",
      mobile_no: addr.mobile_no ?? "",
      email: addr.email ?? "",
      latitude: 0,
      longitude: 0,
    }));

    navigate("/master/customer/create", {
      state: {
        customerData: {
          customer_name: "",
          customer_type_code: "",
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

      <Stack mt="xl" gap="sm">
        {addresses.length === 0 ? (
          <Text size="sm" c="dimmed">
            No addresses found. Enter a PAN number and search to see matching addresses.
          </Text>
        ) : (
          addresses.map((addr) => (
            <Card key={addr.id} withBorder padding="md" radius="md">
              <Group justify="space-between" align="flex-start">
                <Box>
                  <Text size="sm" fw={500}>
                    {addr.address}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {addr.city}, {addr.state}, {addr.country} - {addr.pincode}
                  </Text>
                  {(addr.phone_no || addr.mobile_no || addr.email) && (
                    <Text size="xs" c="dimmed" mt={4}>
                      {[addr.phone_no, addr.mobile_no, addr.email].filter(Boolean).join(" | ")}
                    </Text>
                  )}
                </Box>
                <Checkbox
                  checked={selectedIds.has(addr.id)}
                  onChange={() => toggleAddressSelection(addr.id)}
                  mt={4}
                />
              </Group>
            </Card>
          ))
        )}
      </Stack>

      <Group justify="flex-end" mt="xl">
        <Button color="#105476" onClick={handleCreateCustomer} disabled={selectedIds.size === 0}>
          Create Customer
        </Button>
      </Group>
    </Card>
  );
}

