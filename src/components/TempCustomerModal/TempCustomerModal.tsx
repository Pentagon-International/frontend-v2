import { useEffect, useState } from "react";
import { Button, Grid, Group, Modal, Stack } from "@mantine/core";
import { useForm } from "@mantine/form";
import { postAPICall } from "../../service/postApiCall";
import { URL } from "../../api/serverUrls";
import { API_HEADER } from "../../store/storeKeys";
import ToastNotification from "../ToastNotification";
import FormTextInput from "../FormTextInput";
import FormTextArea from "../FormTextArea";
import TempCustomerCityField from "./TempCustomerCityField";
import {
  getApiResponseMessage,
  getServerErrorMessage,
  isApiFailureResponse,
} from "../../utils/apiErrorMessage";

export type TempCustomerResponse = {
  id: number;
  temp_code: string;
  customer_name: string;
  address: string;
  city: string;
  email: string;
  contact_number: string;
  created_by?: string;
  branch_code?: string;
  company_code?: string;
  created_at?: string;
  updated_at?: string;
};

type TempCustomerModalProps = {
  opened: boolean;
  onClose: () => void;
  customerName: string;
  onSaved: (response: TempCustomerResponse) => void;
};

export default function TempCustomerModal({
  opened,
  onClose,
  customerName,
  onSaved,
}: TempCustomerModalProps) {
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm({
    initialValues: {
      address: "",
      city: "",
      email: "",
      contact_number: "",
    },
    validate: {
      address: (value) => (value.trim() ? null : "Address is required"),
      city: (value) => (value.trim() ? null : "City is required"),
      email: (value) => {
        if (!value.trim()) return "Email is required";
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailPattern.test(value.trim()) ? null : "Enter a valid email";
      },
      contact_number: (value) =>
        value.trim() ? null : "Mobile number is required",
    },
  });

  useEffect(() => {
    if (opened) {
      setIsSaving(false);
      form.setValues({
        address: "",
        city: "",
        email: "",
        contact_number: "",
      });
      form.clearErrors();
    }
  }, [opened, customerName]);

  const handleSave = async () => {
    const trimmedName = customerName.trim();
    if (!trimmedName) {
      ToastNotification({
        type: "error",
        message: "Customer name is required before saving details",
      });
      return;
    }

    const validation = form.validate();
    if (validation.hasErrors) return;

    setIsSaving(true);
    try {
      const payload = {
        customer_name: trimmedName,
        address: form.values.address.trim(),
        city: form.values.city.trim(),
        email: form.values.email.trim(),
        contact_number: form.values.contact_number.trim(),
      };

      const response = (await postAPICall(
        URL.tempCustomer,
        payload,
        API_HEADER
      )) as TempCustomerResponse;

      if (isApiFailureResponse(response)) {
        ToastNotification({
          type: "error",
          message: getApiResponseMessage(
            response,
            "Failed to create temporary customer"
          ),
        });
        return;
      }

      if (!response?.temp_code) {
        ToastNotification({
          type: "error",
          message: getApiResponseMessage(
            response,
            "Invalid response from server"
          ),
        });
        return;
      }

      onSaved(response);
      onClose();
    } catch (error) {
      ToastNotification({
        type: "error",
        message: getServerErrorMessage(
          error,
          "Failed to create temporary customer"
        ),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={isSaving ? () => {} : onClose}
      title="New Customer Details"
      size="md"
      centered
      closeOnClickOutside={false}
      closeOnEscape={!isSaving}
      withCloseButton={!isSaving}
    >
      <Stack gap="sm">
        <Grid>
          <Grid.Col span={12}>
            <FormTextArea
              label="Address"
              withAsterisk
              placeholder="Enter complete address"
              minRows={3}
              {...form.getInputProps("address")}
            />
          </Grid.Col>
          <Grid.Col span={6}>
            <TempCustomerCityField
              key={opened ? `city-${customerName}` : "city-closed"}
              value={form.values.city}
              error={form.errors.city as string}
              onChange={(city) => form.setFieldValue("city", city)}
            />
          </Grid.Col>
          <Grid.Col span={6}>
            <FormTextInput
              format="normal"
              label="Mobile Number"
              withAsterisk
              {...form.getInputProps("contact_number")}
            />
          </Grid.Col>
          <Grid.Col span={12}>
            <FormTextInput
              label="Email"
              withAsterisk
              format="normal"
              {...form.getInputProps("email")}
            />
          </Grid.Col>
        </Grid>
        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button color="#105476" onClick={handleSave} loading={isSaving}>
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
