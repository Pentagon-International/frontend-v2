import {
  Group,
  Select,
  TextInput,
  type SelectProps,
  type TextInputProps,
} from "@mantine/core";
import { IconCalendar } from "@tabler/icons-react";
import { DateRangeInput } from "../../../../components";

export type EnquiryConversionPageFilters = {
  fromDate: Date | null;
  toDate: Date | null;
  type: string | null;
  service: string | null;
  salesperson: string;
};

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All types" },
  { value: "Active", label: "Active" },
  { value: "GAINED", label: "Won (gained)" },
  { value: "LOST", label: "Lost" },
  { value: "QUOTE CREATED", label: "Quote created" },
];

const SERVICE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All modes" },
  { value: "Air", label: "Air" },
  { value: "LCL", label: "LCL" },
  { value: "FCL", label: "FCL" },
  { value: "OTHERS", label: "Others" },
];

const selectBase: SelectProps["styles"] = {
  input: {
    fontSize: 12,
    height: 32,
    minHeight: 32,
  },
};

const textInputBase: TextInputProps["styles"] = {
  input: {
    fontSize: 12,
    height: 32,
    minHeight: 32,
  },
};

/** ERP-style filter row for Enquiry Conversion module (drives POST body). */
export function EnquiryConversionFilters({
  filters,
  onFiltersChange,
  disabled,
}: {
  filters: EnquiryConversionPageFilters;
  onFiltersChange: (next: EnquiryConversionPageFilters) => void;
  disabled?: boolean;
}) {
  const set =
    <K extends keyof EnquiryConversionPageFilters>(key: K) =>
    (value: EnquiryConversionPageFilters[K]) =>
      onFiltersChange({ ...filters, [key]: value });

  return (
    <Group gap="xs" justify="flex-end" wrap="wrap" align="flex-end">
      <Group gap={6} wrap="nowrap" align="flex-end">
        <IconCalendar size={16} color="#64748B" style={{ marginBottom: 8 }} />
        <DateRangeInput
          fromDate={filters.fromDate}
          toDate={filters.toDate}
          onFromDateChange={set("fromDate")}
          onToDateChange={set("toDate")}
          fromLabel=""
          toLabel=""
          size="xs"
          allowDeselection={false}
          showRangeInCalendar={false}
          hideLabels
          compactToolbar
          disabled={disabled}
          containerStyle={{ gap: 8 }}
        />
      </Group>
      <Select
        placeholder="Type"
        size="xs"
        w={140}
        disabled={disabled}
        data={TYPE_OPTIONS}
        value={filters.type ?? ""}
        onChange={(v) => set("type")(v || null)}
        styles={selectBase}
      />
      <Select
        placeholder="Mode"
        size="xs"
        w={120}
        disabled={disabled}
        data={SERVICE_OPTIONS}
        value={filters.service ?? ""}
        onChange={(v) => set("service")(v || null)}
        styles={selectBase}
      />
      <TextInput
        placeholder="Salesperson"
        size="xs"
        w={150}
        disabled={disabled}
        value={filters.salesperson}
        onChange={(e) => set("salesperson")(e.currentTarget.value)}
        styles={textInputBase}
      />
    </Group>
  );
}
