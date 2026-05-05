import { useMemo } from "react";
import { Group, Select, type SelectProps } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { enquiryConversionColors } from "./enquiryConversionTokens";
import {
  DateRangeInput,
  DEFAULT_ERP_LIST_THEME,
  erpToolbarSelectStyles,
} from "../../../../components";
import { apiCallProtected } from "../../../../api/axios";
import { URL } from "../../../../api/serverUrls";

export type EnquiryConversionPageFilters = {
  fromDate: Date | null;
  toDate: Date | null;
  type: string | null;
  service: string | null;
  salesperson: string;
};

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All types" },
  { value: "ACTIVE", label: "Active" },
  { value: "GAINED", label: "Won (gained)" },
  { value: "LOST", label: "Lost" },
  { value: "QUOTE CREATED", label: "Quote created" },
];

const SERVICE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All modes" },
  { value: "AIR", label: "Air" },
  { value: "LCL", label: "LCL" },
  { value: "FCL", label: "FCL" },
  { value: "OTHERS", label: "Others" },
];

const selectStyles: SelectProps["styles"] = {
  ...erpToolbarSelectStyles(DEFAULT_ERP_LIST_THEME),
  input: {
    ...erpToolbarSelectStyles(DEFAULT_ERP_LIST_THEME).input,
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
    border: `1px solid ${enquiryConversionColors.panelBorder}`,
    color: enquiryConversionColors.heading,
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
  const { data: salespersonsData = [], isLoading: salespersonsLoading } =
    useQuery({
      queryKey: ["salespersons"],
      queryFn: async () => {
        try {
          const response = await apiCallProtected.post(URL.salespersons, {});
          const data = response as any;
          return Array.isArray(data?.data) ? data.data : [];
        } catch (error) {
          console.error("Error fetching salespersons data:", error);
          return [];
        }
      },
      staleTime: 10 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    });

  const salespersonOptions = useMemo(() => {
    if (!salespersonsData || !Array.isArray(salespersonsData)) {
      return [];
    }
    return [
      ...salespersonsData
        .filter((item: any) => item?.sales_person)
        .map((item: any) => ({
          value: String(item.sales_person),
          label: String(item.sales_person),
        })),
    ];
  }, [salespersonsData]);

  const set =
    <K extends keyof EnquiryConversionPageFilters>(key: K) =>
    (value: EnquiryConversionPageFilters[K]) =>
      onFiltersChange({ ...filters, [key]: value });

  return (
    <Group gap={8} justify="flex-end" wrap="nowrap" align="center">
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
        containerStyle={{ gap: 6 }}
      />
      <Select
        placeholder="All types"
        size="xs"
        w={130}
        disabled={disabled}
        data={TYPE_OPTIONS}
        value={filters.type ?? ""}
        onChange={(v) => set("type")(v || null)}
        styles={selectStyles}
      />
      <Select
        placeholder="All modes"
        size="xs"
        w={120}
        disabled={disabled}
        data={SERVICE_OPTIONS}
        value={filters.service ?? ""}
        onChange={(v) => set("service")(v || null)}
        styles={selectStyles}
      />
      <Select
        placeholder={salespersonsLoading ? "Loading reps..." : "All reps"}
        size="xs"
        w={180}
        disabled={disabled || salespersonsLoading}
        data={salespersonOptions}
        searchable
        clearable
        nothingFoundMessage="No reps found"
        value={filters.salesperson || null}
        onChange={(v) => set("salesperson")(v || "")}
        styles={selectStyles}
      />
    </Group>
  );
}
