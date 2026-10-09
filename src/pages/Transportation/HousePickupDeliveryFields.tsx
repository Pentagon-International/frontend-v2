import { Divider, Grid, Text } from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";
import { SingleDateInput } from "../../components";
import FormTextInput from "../../components/FormTextInput";
import SearchableSelect from "../../components/SearchableSelect";
import { URL } from "../../api/serverUrls";
import { toTitleCase } from "../../utils/textFormatter";
import type { HousePickupDeliveryFormValues } from "./housePickupDelivery";

type HousePickupDeliveryFieldsProps<
  T extends HousePickupDeliveryFormValues,
> = {
  readOnly?: boolean;
  form: UseFormReturnType<T>;
};

function addressOption(item: Record<string, unknown>) {
  const addressesData =
    (item.addresses_data as Array<Record<string, unknown>>) || [];
  const firstAddress = addressesData[0];
  if (firstAddress) {
    return {
      value: String(firstAddress.id),
      label: `${firstAddress.address} - ${item.customer_name}`,
    };
  }
  return {
    value: String(item.id || ""),
    label: String(item.customer_name || ""),
  };
}

export function HousePickupDeliveryFields<
  T extends HousePickupDeliveryFormValues,
>({
  readOnly = false,
  form,
}: HousePickupDeliveryFieldsProps<T>) {
  return (
    <>
      <Text size="sm" fw={600} mb="sm" c="#105476">
        Pickup Details
      </Text>
      <Grid mb="md" gutter="sm">
        <Grid.Col span={6}>
          <FormTextInput
            label="Pickup Location"
            placeholder="Enter pickup location"
            value={form.values.pickup_location}
            disabled={readOnly}
            onChange={(e) =>
              form.setFieldValue("pickup_location", toTitleCase(e.target.value))
            }
          />
        </Grid.Col>
        <Grid.Col span={6}>
          <SearchableSelect
            dropdownZIndex={null}
            label="Pickup From"
            placeholder="Type port name or code"
            apiEndpoint={URL.portMaster}
            searchFields={["port_code", "port_name"]}
            displayFormat={(item: Record<string, unknown>) => ({
              value: String(item.port_code),
              label: `${item.port_name} (${item.port_code})`,
            })}
            value={form.values.pickup_from_code}
            displayValue={form.values.pickup_from_name || null}
            disabled={readOnly}
            minSearchLength={2}
            onChange={(value, selectedData) => {
              form.setFieldValue("pickup_from_code", value || "");
              form.setFieldValue("pickup_from_name", selectedData?.label || "");
            }}
          />
        </Grid.Col>
        <Grid.Col span={12}>
          <SearchableSelect
            dropdownZIndex={null}
            label="Pickup Address"
            placeholder="Type customer name"
            apiEndpoint={URL.allCustomers}
            searchFields={["customer_code", "customer_name"]}
            displayFormat={addressOption}
            value={form.values.pickup_address_id}
            displayValue={form.values.pickup_address_text || null}
            disabled={readOnly}
            minSearchLength={3}
            onChange={(value, selectedData) => {
              form.setFieldValue("pickup_address_id", value || "");
              form.setFieldValue(
                "pickup_address_text",
                selectedData?.label || "",
              );
            }}
          />
        </Grid.Col>
        <Grid.Col span={3}>
          <SingleDateInput
            label="Planned Pickup Date"
            placeholder="YYYY-MM-DD"
            value={form.values.planned_pickup_date}
            readOnly={readOnly}
            onChange={(date) =>
              form.setFieldValue("planned_pickup_date", date)
            }
          />
        </Grid.Col>
        <Grid.Col span={3}>
          <SingleDateInput
            label="Actual Pickup Date"
            placeholder="YYYY-MM-DD"
            value={form.values.actual_pickup_date}
            readOnly={readOnly}
            onChange={(date) => form.setFieldValue("actual_pickup_date", date)}
          />
        </Grid.Col>
        <Grid.Col span={3}>
          <SearchableSelect
            dropdownZIndex={null}
            label="Transporter Name"
            placeholder="Type transporter / customer name"
            apiEndpoint={URL.transporter}
            searchFields={["customer_code", "customer_name"]}
            displayFormat={(item: Record<string, unknown>) => ({
              value: String(item.customer_code),
              label: String(item.customer_name),
            })}
            value={form.values.transporter_code}
            displayValue={form.values.transporter_name || null}
            disabled={readOnly}
            minSearchLength={2}
            onChange={(value, selectedData) => {
              form.setFieldValue("transporter_code", value || "");
              form.setFieldValue("transporter_name", selectedData?.label || "");
            }}
          />
        </Grid.Col>
        <Grid.Col span={3}>
          <FormTextInput
            label="Transporter Email Id"
            placeholder="Enter transporter email"
            type="email"
            format="normal"
            {...form.getInputProps("transporter_email")}
            disabled={readOnly}
          />
        </Grid.Col>
      </Grid>

      <Divider my="md" />

      <Text size="sm" fw={600} mb="sm" c="#105476">
        Delivery Details
      </Text>
      <Grid gutter="sm">
        <Grid.Col span={6}>
          <FormTextInput
            label="Delivery Location"
            placeholder="Enter delivery location"
            value={form.values.delivery_location}
            disabled={readOnly}
            onChange={(e) =>
              form.setFieldValue(
                "delivery_location",
                toTitleCase(e.target.value),
              )
            }
          />
        </Grid.Col>
        <Grid.Col span={6}>
          <SearchableSelect
            dropdownZIndex={null}
            label="Delivery From"
            placeholder="Type port name or code"
            apiEndpoint={URL.portMaster}
            searchFields={["port_code", "port_name"]}
            displayFormat={(item: Record<string, unknown>) => ({
              value: String(item.port_code),
              label: `${item.port_name} (${item.port_code})`,
            })}
            value={form.values.delivery_from_code}
            displayValue={form.values.delivery_from_name || null}
            disabled={readOnly}
            minSearchLength={2}
            onChange={(value, selectedData) => {
              form.setFieldValue("delivery_from_code", value || "");
              form.setFieldValue(
                "delivery_from_name",
                selectedData?.label || "",
              );
            }}
          />
        </Grid.Col>
        <Grid.Col span={12}>
          <SearchableSelect
            dropdownZIndex={null}
            label="Delivery Address"
            placeholder="Type delivery address"
            apiEndpoint={URL.allCustomers}
            searchFields={["customer_code", "customer_name"]}
            displayFormat={addressOption}
            value={form.values.delivery_address_id}
            displayValue={form.values.delivery_address_text || null}
            disabled={readOnly}
            minSearchLength={3}
            onChange={(value, selectedData) => {
              form.setFieldValue("delivery_address_id", value || "");
              form.setFieldValue(
                "delivery_address_text",
                selectedData?.label || "",
              );
            }}
          />
        </Grid.Col>
        <Grid.Col span={3}>
          <SingleDateInput
            label="Planned Delivery Date"
            placeholder="YYYY-MM-DD"
            value={form.values.planned_delivery_date}
            readOnly={readOnly}
            onChange={(date) =>
              form.setFieldValue("planned_delivery_date", date)
            }
          />
        </Grid.Col>
        <Grid.Col span={3}>
          <SingleDateInput
            label="Actual Delivery Date"
            placeholder="YYYY-MM-DD"
            value={form.values.actual_delivery_date}
            readOnly={readOnly}
            onChange={(date) =>
              form.setFieldValue("actual_delivery_date", date)
            }
          />
        </Grid.Col>
      </Grid>
    </>
  );
}
