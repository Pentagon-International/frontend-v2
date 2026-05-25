import { type Dispatch, type SetStateAction } from "react";
import { Box, Button, Flex, Select, Text } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { DashboardChartSearch } from "../../../../../components/DashboardChartSearch";
import type { FinanceOutstandingAgeingData } from "../financeOutstandingAgeingTypes";
import { OST_INK, OST_INK_3 } from "../theme";
import type { PeriodGranularity } from "../../collectionTargetVsPerformance/components/PeriodPillGroup";

export type OutstandingListFilters = {
  location: string;
  customer_name: string;
  risk: string;
};

type OutstandingPageHeaderProps = {
  meta: FinanceOutstandingAgeingData["meta"];
  periodGranularity: PeriodGranularity;
  onPeriodGranularityChange: (value: PeriodGranularity) => void;
  customerOptions: { value: string; label: string }[];
  locationOptions: { value: string; label: string }[];
  filters: OutstandingListFilters;
  onFiltersChange: Dispatch<SetStateAction<OutstandingListFilters>>;
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  onSearchCommit: (value: string) => void;
  onSearchClear: () => void;
  filterOptions?: FinanceOutstandingAgeingData["filterOptions"];
  onRefresh: () => void;
};

const selectInputStyles = {
  input: {
    height: 30,
    minHeight: 30,
    fontSize: 11,
    borderColor: "#E2E8F0",
    color: "#4A607A",
    fontWeight: 500,
    background: "#FFFFFF",
  },
} as const;

export function OutstandingPageHeader({
  meta,
  filters,
  onFiltersChange,
  customerOptions,
  locationOptions,
  searchInput,
  onSearchInputChange,
  onSearchCommit,
  onSearchClear,
}: OutstandingPageHeaderProps) {
  const isMobile = useMediaQuery("(max-width: 48em)");

  return (
    <Flex justify="space-between" align="flex-start" gap="md" wrap="wrap" mb="lg">
      <Box style={{ minWidth: 0 }}>
        <Text
          style={{
            fontSize: "clamp(20px, 3vw, 26px)",
            fontWeight: 600,
            letterSpacing: "-0.02em",
            color: OST_INK,
            lineHeight: 1.15,
          }}
        >
          {meta.title}
        </Text>
        <Text fz={12} c={OST_INK_3} mt={6} style={{ lineHeight: 1.5 }}>
          {meta.subtitle}
        </Text>
      </Box>

      <Flex gap={8} wrap="wrap" justify="flex-end" align="center">
        <Button
          size="xs"
          radius={6}
          variant="filled"
          style={{
            flex: isMobile ? "1 1 calc(50% - 4px)" : "1 1 120px",
            minWidth: isMobile ? 0 : undefined,
          }}
          styles={{
            root: {
              backgroundColor: "#101C2E",
              color: "#FFFFFF",
              height: 30,
              fontSize: 11,
              border: "none",
            },
            label: { fontWeight: 700 },
          }}
        >
          {meta.asOfLabel}
        </Button>
        {/* <Select
          size="xs"
          radius={6}
          data={customerOptions}
          value={filters.customer_name}
          onChange={(value) =>
            onFiltersChange((prev) => ({ ...prev, customer_name: value || "" }))
          }
          style={{
            flex: isMobile ? "1 1 calc(50% - 4px)" : "1 1 170px",
            minWidth: isMobile ? 0 : 120,
          }}
          styles={selectInputStyles}
        /> */}
        <Select
          size="xs"
          radius={6}
          data={[
            { value: "", label: "Risk: All" },
            { value: "HIGH", label: "Risk: HIGH" },
            { value: "MEDIUM", label: "Risk: MEDIUM" },
            { value: "LOW", label: "Risk: LOW" },
          ]}
          value={filters.risk}
          onChange={(value) => onFiltersChange((prev) => ({ ...prev, risk: value || "" }))}
          style={{
            flex: isMobile ? "1 1 calc(50% - 4px)" : "1 1 130px",
            minWidth: isMobile ? 0 : 120,
          }}
          styles={selectInputStyles}
        />
        <Select
          size="xs"
          radius={6}
          data={locationOptions}
          value={filters.location}
          onChange={(value) => onFiltersChange((prev) => ({ ...prev, location: value || "" }))}
          style={{
            flex: isMobile ? "1 1 calc(50% - 4px)" : "1 1 160px",
            minWidth: isMobile ? 0 : 120,
          }}
          styles={selectInputStyles}
        />
        <Box
          style={{
            width: "clamp(200px, 20vw, 280px)",
            minWidth: 200,
            flexShrink: 0,
          }}
        >
          <DashboardChartSearch
            value={searchInput}
            onChange={onSearchInputChange}
            onCommit={onSearchCommit}
            onClear={onSearchClear}
            placeholder="Search customer / salesperson"
          />
        </Box>
      </Flex>
    </Flex>
  );
}
