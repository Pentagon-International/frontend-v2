import { Grid, Text } from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";
import { SearchableSelect, Dropdown } from "../../components";
import FormTextInput from "../../components/FormTextInput";
import { URL } from "../../api/serverUrls";

export type JobMasterPartyDetailsValues = {
  shipper_id: string;
  shipper_name: string;
  shipper_email: string;
  shipper_address_id: string;
  shipper_address: string;
  consignee_id: string;
  consignee_name: string;
  consignee_email: string;
  consignee_address_id: string;
  consignee_address: string;
  carrier_agent_id: string;
  carrier_agent_name: string;
  carrier_agent_email: string;
  carrier_agent_address_id: string;
  carrier_agent_address: string;
};

export type PartyAddressOption = {
  value: string;
  label: string;
  email: string;
  address: string;
};

export const getJobMasterAddressOptions = (
  originalData?: Record<string, unknown> | null,
): PartyAddressOption[] => {
  const addresses = Array.isArray(originalData?.addresses_data)
    ? (originalData.addresses_data as Array<Record<string, unknown>>)
    : [];
  return addresses
    .map((item) => ({
      value: String(item.id ?? ""),
      label: String(item.address ?? ""),
      email: String(item.email ?? ""),
      address: String(item.address ?? ""),
      isPrimary: String(item.address_type ?? "").toLowerCase() === "primary",
    }))
    .filter((item) => item.value && item.address)
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
    .map(({ value, label, email, address }) => ({ value, label, email, address }));
};

type JobMasterPartyDetailsPanelProps = {
  idPrefix: string;
  disabled?: boolean;
  partyDetailsForm: UseFormReturnType<JobMasterPartyDetailsValues>;
  shipperAddressOptions: PartyAddressOption[];
  setShipperAddressOptions: (options: PartyAddressOption[]) => void;
  consigneeAddressOptions: PartyAddressOption[];
  setConsigneeAddressOptions: (options: PartyAddressOption[]) => void;
  carrierAgentAddressOptions: PartyAddressOption[];
  setCarrierAgentAddressOptions: (options: PartyAddressOption[]) => void;
  shipperAddressSearch: string;
  setShipperAddressSearch: (value: string) => void;
  consigneeAddressSearch: string;
  setConsigneeAddressSearch: (value: string) => void;
  carrierAgentAddressSearch: string;
  setCarrierAgentAddressSearch: (value: string) => void;
  shipperAddressCustom: boolean;
  setShipperAddressCustom: (value: boolean) => void;
  consigneeAddressCustom: boolean;
  setConsigneeAddressCustom: (value: boolean) => void;
  carrierAgentAddressCustom: boolean;
  setCarrierAgentAddressCustom: (value: boolean) => void;
};

export function JobMasterPartyDetailsPanel({
  idPrefix,
  disabled = false,
  partyDetailsForm,
  shipperAddressOptions,
  setShipperAddressOptions,
  consigneeAddressOptions,
  setConsigneeAddressOptions,
  carrierAgentAddressOptions,
  setCarrierAgentAddressOptions,
  shipperAddressSearch,
  setShipperAddressSearch,
  consigneeAddressSearch,
  setConsigneeAddressSearch,
  carrierAgentAddressSearch,
  setCarrierAgentAddressSearch,
  shipperAddressCustom,
  setShipperAddressCustom,
  consigneeAddressCustom,
  setConsigneeAddressCustom,
  carrierAgentAddressCustom,
  setCarrierAgentAddressCustom,
}: JobMasterPartyDetailsPanelProps) {
  return (
    <fieldset
      disabled={disabled}
      style={{ border: "none", margin: 0, padding: 0, minInlineSize: 0 }}
    >
      <Text size="lg" fw={600} c="#105476" mb="md">
        Party Details
      </Text>

      <Grid gutter="sm" mb="md">
        <Grid.Col span={12}>
          <Text fw={600} c="#105476">
            Shipper Details
          </Text>
        </Grid.Col>
        <Grid.Col span={4}>
          <SearchableSelect
            key={`${idPrefix}-shipper-${partyDetailsForm.values.shipper_id}:${partyDetailsForm.values.shipper_name ?? "_"}`}
            size="sm"
            label="Shipper Name"
            dropdownZIndex={10}
            apiEndpoint={URL.shipper}
            placeholder="Type shipper name"
            searchFields={["customer_name", "customer_code"]}
            displayFormat={(item: Record<string, unknown>) => ({
              value: String(item.id ?? ""),
              label: String(item.customer_name ?? ""),
            })}
            value={partyDetailsForm.values.shipper_id || null}
            displayValue={partyDetailsForm.values.shipper_name || null}
            disabled={disabled}
            onChange={(value, selectedData, originalData) => {
              const options = getJobMasterAddressOptions(originalData);
              const primary = options[0];
              partyDetailsForm.setFieldValue("shipper_id", value || "");
              partyDetailsForm.setFieldValue("shipper_name", selectedData?.label || "");
              partyDetailsForm.setFieldValue("shipper_email", primary?.email || "");
              partyDetailsForm.setFieldValue("shipper_address_id", primary?.value || "");
              partyDetailsForm.setFieldValue("shipper_address", primary?.address || "");
              if (!value) {
                partyDetailsForm.setFieldValue("shipper_name", "");
                partyDetailsForm.setFieldValue("shipper_email", "");
                partyDetailsForm.setFieldValue("shipper_address_id", "");
                partyDetailsForm.setFieldValue("shipper_address", "");
              }
              setShipperAddressOptions(value ? options : []);
              setShipperAddressSearch("");
              setShipperAddressCustom(false);
            }}
            minSearchLength={2}
            returnOriginalData={true}
          />
        </Grid.Col>
        <Grid.Col span={4}>
          <FormTextInput
            label="Shipper Email"
            readOnly={disabled}
            value={partyDetailsForm.values.shipper_email}
            onChange={(e) =>
              partyDetailsForm.setFieldValue("shipper_email", e.currentTarget.value)
            }
          />
        </Grid.Col>
        <Grid.Col span={4}>
          {shipperAddressCustom ||
          (!!partyDetailsForm.values.shipper_address &&
            (!partyDetailsForm.values.shipper_address_id ||
              !shipperAddressOptions.some(
                (item) => item.value === partyDetailsForm.values.shipper_address_id,
              ))) ? (
            <FormTextInput
              label="Shipper Address"
              readOnly={disabled}
              value={partyDetailsForm.values.shipper_address}
              onChange={(e) => {
                const nextValue = e.currentTarget.value;
                partyDetailsForm.setFieldValue("shipper_address", nextValue);
                if (!nextValue.trim()) {
                  setShipperAddressCustom(false);
                  setShipperAddressSearch("");
                  partyDetailsForm.setFieldValue("shipper_address_id", "");
                }
              }}
            />
          ) : (
            <Dropdown
              size="sm"
              label="Shipper Address"
              disabled={disabled}
              data={shipperAddressOptions.map((item) => ({
                value: item.value,
                label: item.label,
              }))}
              value={partyDetailsForm.values.shipper_address_id || null}
              searchValue={shipperAddressSearch}
              onSearchChange={(value) => {
                setShipperAddressSearch(value);
                const hasMatch = shipperAddressOptions.some(
                  (item) => item.label.toLowerCase() === value.trim().toLowerCase(),
                );
                if (value.trim() && !hasMatch) {
                  setShipperAddressCustom(true);
                  partyDetailsForm.setFieldValue("shipper_address_id", "");
                  partyDetailsForm.setFieldValue("shipper_address", value);
                }
              }}
              onChange={(value) => {
                const selected = shipperAddressOptions.find((item) => item.value === value);
                partyDetailsForm.setFieldValue("shipper_address_id", value || "");
                partyDetailsForm.setFieldValue("shipper_address", selected?.address || "");
              }}
              searchable
              clearable
            />
          )}
        </Grid.Col>
      </Grid>

      <Grid gutter="sm" mb="md">
        <Grid.Col span={12}>
          <Text fw={600} c="#105476">
            Consignee Details
          </Text>
        </Grid.Col>
        <Grid.Col span={4}>
          <SearchableSelect
            size="sm"
            label="Consignee Name"
            dropdownZIndex={10}
            apiEndpoint={URL.consignee}
            placeholder="Type consignee name"
            searchFields={["customer_name", "customer_code"]}
            displayFormat={(item: Record<string, unknown>) => ({
              value: String(item.id ?? ""),
              label: String(item.customer_name ?? ""),
            })}
            value={partyDetailsForm.values.consignee_id || null}
            displayValue={partyDetailsForm.values.consignee_name || null}
            disabled={disabled}
            onChange={(value, selectedData, originalData) => {
              const options = getJobMasterAddressOptions(originalData);
              const primary = options[0];
              partyDetailsForm.setFieldValue("consignee_id", value || "");
              partyDetailsForm.setFieldValue("consignee_name", selectedData?.label || "");
              partyDetailsForm.setFieldValue("consignee_email", primary?.email || "");
              partyDetailsForm.setFieldValue("consignee_address_id", primary?.value || "");
              partyDetailsForm.setFieldValue("consignee_address", primary?.address || "");
              if (!value) {
                partyDetailsForm.setFieldValue("consignee_name", "");
                partyDetailsForm.setFieldValue("consignee_email", "");
                partyDetailsForm.setFieldValue("consignee_address_id", "");
                partyDetailsForm.setFieldValue("consignee_address", "");
              }
              setConsigneeAddressOptions(value ? options : []);
              setConsigneeAddressSearch("");
              setConsigneeAddressCustom(false);
            }}
            minSearchLength={2}
            returnOriginalData={true}
          />
        </Grid.Col>
        <Grid.Col span={4}>
          <FormTextInput
            label="Consignee Email"
            readOnly={disabled}
            value={partyDetailsForm.values.consignee_email}
            onChange={(e) =>
              partyDetailsForm.setFieldValue("consignee_email", e.currentTarget.value)
            }
          />
        </Grid.Col>
        <Grid.Col span={4}>
          {consigneeAddressCustom ||
          (!!partyDetailsForm.values.consignee_address &&
            (!partyDetailsForm.values.consignee_address_id ||
              !consigneeAddressOptions.some(
                (item) => item.value === partyDetailsForm.values.consignee_address_id,
              ))) ? (
            <FormTextInput
              label="Consignee Address"
              readOnly={disabled}
              value={partyDetailsForm.values.consignee_address}
              onChange={(e) => {
                const nextValue = e.currentTarget.value;
                partyDetailsForm.setFieldValue("consignee_address", nextValue);
                if (!nextValue.trim()) {
                  setConsigneeAddressCustom(false);
                  setConsigneeAddressSearch("");
                  partyDetailsForm.setFieldValue("consignee_address_id", "");
                }
              }}
            />
          ) : (
            <Dropdown
              size="sm"
              label="Consignee Address"
              disabled={disabled}
              data={consigneeAddressOptions.map((item) => ({
                value: item.value,
                label: item.label,
              }))}
              value={partyDetailsForm.values.consignee_address_id || null}
              searchValue={consigneeAddressSearch}
              onSearchChange={(value) => {
                setConsigneeAddressSearch(value);
                const hasMatch = consigneeAddressOptions.some(
                  (item) => item.label.toLowerCase() === value.trim().toLowerCase(),
                );
                if (value.trim() && !hasMatch) {
                  setConsigneeAddressCustom(true);
                  partyDetailsForm.setFieldValue("consignee_address_id", "");
                  partyDetailsForm.setFieldValue("consignee_address", value);
                }
              }}
              onChange={(value) => {
                const selected = consigneeAddressOptions.find((item) => item.value === value);
                partyDetailsForm.setFieldValue("consignee_address_id", value || "");
                partyDetailsForm.setFieldValue("consignee_address", selected?.address || "");
              }}
              searchable
              clearable
            />
          )}
        </Grid.Col>
      </Grid>

      <Grid gutter="sm" mb="md">
        <Grid.Col span={12}>
          <Text fw={600} c="#105476">
            Carrier Agent Details
          </Text>
        </Grid.Col>
        <Grid.Col span={4}>
          <SearchableSelect
            key={`${idPrefix}-carrier-agent-${partyDetailsForm.values.carrier_agent_id}:${partyDetailsForm.values.carrier_agent_name ?? "_"}`}
            size="sm"
            label="Carrier Agent Name"
            dropdownZIndex={10}
            apiEndpoint={URL.customerByTypes}
            additionalParams={{ types: "Carrier-agent" }}
            placeholder="Type carrier agent name"
            searchFields={["customer_name", "customer_code"]}
            displayFormat={(item: Record<string, unknown>) => ({
              value: String(item.id ?? ""),
              label: String(item.customer_name ?? ""),
            })}
            value={partyDetailsForm.values.carrier_agent_id || null}
            displayValue={partyDetailsForm.values.carrier_agent_name || null}
            disabled={disabled}
            onChange={(value, selectedData, originalData) => {
              const options = getJobMasterAddressOptions(originalData);
              const primary = options[0];
              partyDetailsForm.setFieldValue("carrier_agent_id", value || "");
              partyDetailsForm.setFieldValue(
                "carrier_agent_name",
                selectedData?.label || "",
              );
              partyDetailsForm.setFieldValue(
                "carrier_agent_email",
                primary?.email || "",
              );
              partyDetailsForm.setFieldValue(
                "carrier_agent_address_id",
                primary?.value || "",
              );
              partyDetailsForm.setFieldValue(
                "carrier_agent_address",
                primary?.address || "",
              );
              if (!value) {
                partyDetailsForm.setFieldValue("carrier_agent_name", "");
                partyDetailsForm.setFieldValue("carrier_agent_email", "");
                partyDetailsForm.setFieldValue("carrier_agent_address_id", "");
                partyDetailsForm.setFieldValue("carrier_agent_address", "");
              }
              setCarrierAgentAddressOptions(value ? options : []);
              setCarrierAgentAddressSearch("");
              setCarrierAgentAddressCustom(false);
            }}
            minSearchLength={2}
            returnOriginalData={true}
          />
        </Grid.Col>
        <Grid.Col span={4}>
          <FormTextInput
            label="Carrier Agent Email"
            readOnly={disabled}
            value={partyDetailsForm.values.carrier_agent_email}
            onChange={(e) =>
              partyDetailsForm.setFieldValue(
                "carrier_agent_email",
                e.currentTarget.value,
              )
            }
          />
        </Grid.Col>
        <Grid.Col span={4}>
          {carrierAgentAddressCustom ||
          (!!partyDetailsForm.values.carrier_agent_address &&
            (!partyDetailsForm.values.carrier_agent_address_id ||
              !carrierAgentAddressOptions.some(
                (item) =>
                  item.value === partyDetailsForm.values.carrier_agent_address_id,
              ))) ? (
            <FormTextInput
              label="Carrier Agent Address"
              readOnly={disabled}
              value={partyDetailsForm.values.carrier_agent_address}
              onChange={(e) => {
                const nextValue = e.currentTarget.value;
                partyDetailsForm.setFieldValue("carrier_agent_address", nextValue);
                if (!nextValue.trim()) {
                  setCarrierAgentAddressCustom(false);
                  setCarrierAgentAddressSearch("");
                  partyDetailsForm.setFieldValue("carrier_agent_address_id", "");
                }
              }}
            />
          ) : (
            <Dropdown
              size="sm"
              label="Carrier Agent Address"
              disabled={disabled}
              data={carrierAgentAddressOptions.map((item) => ({
                value: item.value,
                label: item.label,
              }))}
              value={partyDetailsForm.values.carrier_agent_address_id || null}
              searchValue={carrierAgentAddressSearch}
              onSearchChange={(value) => {
                setCarrierAgentAddressSearch(value);
                const hasMatch = carrierAgentAddressOptions.some(
                  (item) => item.label.toLowerCase() === value.trim().toLowerCase(),
                );
                if (value.trim() && !hasMatch) {
                  setCarrierAgentAddressCustom(true);
                  partyDetailsForm.setFieldValue("carrier_agent_address_id", "");
                  partyDetailsForm.setFieldValue("carrier_agent_address", value);
                }
              }}
              onChange={(value) => {
                const selected = carrierAgentAddressOptions.find(
                  (item) => item.value === value,
                );
                partyDetailsForm.setFieldValue("carrier_agent_address_id", value || "");
                partyDetailsForm.setFieldValue(
                  "carrier_agent_address",
                  selected?.address || "",
                );
              }}
              searchable
              clearable
            />
          )}
        </Grid.Col>
      </Grid>
    </fieldset>
  );
}
