import {
  Group,
  Select,
  type SelectProps,
} from "@mantine/core";
import { enquiryConversionColors } from "./enquiryConversionTokens";
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

const selectStyles: SelectProps["styles"] = {
  input: {
    fontSize: 13,
    fontWeight: 600,
    height: 36,
    minHeight: 36,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    border: `1px solid ${enquiryConversionColors.panelBorder}`,
    color: enquiryConversionColors.heading,
  },
  option: {
    fontSize: 13,
    fontWeight: 500,
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
    <Group gap="sm" justify="flex-end" wrap="wrap" align="center">
      <DateRangeInput
        fromDate={filters.fromDate}
        toDate={filters.toDate}
        onFromDateChange={set("fromDate")}
        onToDateChange={set("toDate")}
        fromLabel=""
        toLabel=""
        size="sm"
        allowDeselection={false}
        showRangeInCalendar={false}
        hideLabels
        compactToolbar
        disabled={disabled}
        containerStyle={{ gap: 8 }}
      />
      <Select
        placeholder="All types"
        size="sm"
        w={130}
        disabled={disabled}
        data={TYPE_OPTIONS}
        value={filters.type ?? ""}
        onChange={(v) => set("type")(v || null)}
        styles={selectStyles}
      />
      <Select
        placeholder="All modes"
        size="sm"
        w={120}
        disabled={disabled}
        data={SERVICE_OPTIONS}
        value={filters.service ?? ""}
        onChange={(v) => set("service")(v || null)}
        styles={selectStyles}
      />
      <Select
        placeholder="All reps"
        size="sm"
        w={120}
        disabled={disabled}
        data={[{ value: "", label: "All reps" }]}
        value={filters.salesperson}
        onChange={(v) => set("salesperson")(v || "")}
        styles={selectStyles}
      />
    </Group>
  );
}
