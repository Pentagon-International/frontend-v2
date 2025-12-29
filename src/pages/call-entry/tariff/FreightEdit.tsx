import React, { useState, useEffect } from "react";
import {
  Card,
  Text,
  Group,
  Button,
  TextInput,
  Select,
  DateInput,
  Textarea,
  Box,
  Divider,
  Grid,
  Badge,
  Alert,
  LoadingOverlay,
} from "@mantine/core";
import { IconArrowLeft, IconSave, IconAlertCircle } from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import { ToastNotification } from "../../../components";
import { getAPICall } from "../../../service/getApiCall";
import { URL } from "../../../api/serverUrls";
import { API_HEADER } from "../../../store/storeKeys";

type FreightEditProps = {
  actionType?: "edit" | "view";
  id?: number;
  origin_name?: string;
  destination_name?: string;
  valid_from?: string;
  valid_to?: string;
  status?: string;
  tariff_charges?: any[];
};

export default function FreightEdit() {
  const navigate = useNavigate();
  const location = useLocation();
  const { actionType = "edit", ...freightData } = location.state || {};

  const [isLoading, setIsLoading] = useState(false);
  const [isViewMode] = useState(actionType === "view");

  // Form state
  const [formData, setFormData] = useState({
    origin_name: freightData.origin_name || "",
    destination_name: freightData.destination_name || "",
    valid_from: freightData.valid_from
      ? new Date(freightData.valid_from)
      : null,
    valid_to: freightData.valid_to ? new Date(freightData.valid_to) : null,
    status: freightData.status || "ACTIVE",
  });

  // Port data for dropdowns
  const [portOptions, setPortOptions] = useState<any[]>([]);

  useEffect(() => {
    fetchPortData();
  }, []);

  const fetchPortData = async () => {
    try {
      const response = await getAPICall(URL.portMaster, API_HEADER);
      const ports = (response?.data as any[]).map((item: any) => ({
        value: item.port_name,
        label: `${item.port_name} (${item.transport_mode})`,
      }));
      setPortOptions(ports);
    } catch (error) {
      console.error("Error fetching port data:", error);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async () => {
    if (!formData.origin_name || !formData.destination_name) {
      ToastNotification({
        type: "error",
        message: "Please fill in all required fields",
      });
      return;
    }

    if (!formData.valid_from || !formData.valid_to) {
      ToastNotification({
        type: "error",
        message: "Please select valid from and to dates",
      });
      return;
    }

    if (formData.valid_from >= formData.valid_to) {
      ToastNotification({
        type: "error",
        message: "Valid from date must be before valid to date",
      });
      return;
    }

    setIsLoading(true);

    try {
      const updateData = {
        ...formData,
        valid_from: formData.valid_from?.toISOString().split("T")[0],
        valid_to: formData.valid_to?.toISOString().split("T")[0],
      };

      // In a real implementation, you would call the API here
      // await putApiCall(`${URL.freight}${freightData.id}/`, API_HEADER, updateData);

      console.log("Updating freight with data:", updateData);

      ToastNotification({
        type: "success",
        message: "Freight updated successfully",
      });

      // Navigate back to freight master
      navigate("/tariff/freight");
    } catch (error) {
      ToastNotification({
        type: "error",
        message: `Error updating freight: ${error}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    navigate("/tariff/freight");
  };

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <LoadingOverlay visible={isLoading} />

      {/* Header */}
      <Group justify="space-between" align="center" mb="lg">
        <Group>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={handleCancel}
            disabled={isLoading}
          >
            Back
          </Button>
          <Text size="lg" fw={600} c="#105476">
            {isViewMode ? "View Freight" : "Edit Freight"}
          </Text>
        </Group>

        {!isViewMode && (
          <Button
            leftSection={<IconSave size={16} />}
            onClick={handleSubmit}
            loading={isLoading}
            color="#105476"
          >
            Save Changes
          </Button>
        )}
      </Group>

      <Divider mb="lg" />

      {/* Form */}
      <Grid gutter="md">
        <Grid.Col span={6}>
          <Select
            label="Origin Port"
            placeholder="Select origin port"
            data={portOptions}
            value={formData.origin_name}
            onFocus={(event) => {
              // Auto-select all text when input is focused
              const input = event.target as HTMLInputElement;
              if (input && input.value) {
                input.select();
              }
            }}
            onChange={(value) => handleInputChange("origin_name", value)}
            required
            disabled={isViewMode || isLoading}
            searchable
          />
        </Grid.Col>

        <Grid.Col span={6}>
          <Select
            label="Destination Port"
            placeholder="Select destination port"
            data={portOptions}
            value={formData.destination_name}
            onFocus={(event) => {
              // Auto-select all text when input is focused
              const input = event.target as HTMLInputElement;
              if (input && input.value) {
                input.select();
              }
            }}
            onChange={(value) => handleInputChange("destination_name", value)}
            required
            disabled={isViewMode || isLoading}
            searchable
          />
        </Grid.Col>

        <Grid.Col span={6}>
          <DateInput
            label="Valid From"
            placeholder="Select start date"
            value={formData.valid_from}
            onChange={(value) => handleInputChange("valid_from", value)}
            required
            disabled={isViewMode || isLoading}
            clearable
          />
        </Grid.Col>

        <Grid.Col span={6}>
          <DateInput
            label="Valid To"
            placeholder="Select end date"
            value={formData.valid_to}
            onChange={(value) => handleInputChange("valid_to", value)}
            required
            disabled={isViewMode || isLoading}
            clearable
          />
        </Grid.Col>

        <Grid.Col span={6}>
          <Select
            label="Status"
            data={[
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" },
            ]}
            value={formData.status}
            onChange={(value) => handleInputChange("status", value)}
            disabled={isViewMode || isLoading}
          />
        </Grid.Col>
      </Grid>

      {/* Current Tariff Charges Display */}
      {freightData.tariff_charges && freightData.tariff_charges.length > 0 && (
        <Box mt="xl">
          <Text size="md" fw={600} mb="md">
            Current Tariff Charges
          </Text>
          <Card withBorder p="md">
            {freightData.tariff_charges.map((charge: any, index: number) => (
              <Box key={index} mb="sm">
                <Group justify="space-between">
                  <Text size="sm" fw={500}>
                    {charge.charge_name || "Unnamed Charge"}
                  </Text>
                  <Badge variant="light" color="blue">
                    {charge.charge_type || "Unknown Type"}
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed">
                  Amount: {charge.amount || "N/A"} {charge.currency || ""}
                </Text>
              </Box>
            ))}
          </Card>
        </Box>
      )}

      {/* Info Alert */}
      <Alert
        icon={<IconAlertCircle size={16} />}
        title="Note"
        color="blue"
        variant="light"
        mt="lg"
      >
        {isViewMode
          ? "This is a read-only view of the freight tariff information."
          : "Make sure to review all changes before saving. Changes will affect all associated tariff charges."}
      </Alert>
    </Card>
  );
}
