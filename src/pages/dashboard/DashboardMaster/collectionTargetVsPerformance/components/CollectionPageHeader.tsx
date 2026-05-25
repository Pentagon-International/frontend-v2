import { Box, Button, Flex, Text } from "@mantine/core";
import { IconDownload, IconRefresh } from "@tabler/icons-react";
import { SingleDateInput } from "../../../../../components";
import type { CollectionTargetVsPerformanceData } from "../collectionTargetVsPerformanceTypes";
import { COL_INK, COL_INK_3, COL_INK_4, COL_LINE } from "../theme";
import { CollectionBranchFilterSelect } from "./CollectionBranchFilterSelect";
import { PeriodPillGroup, type PeriodGranularity } from "./PeriodPillGroup";

type CollectionPageHeaderProps = {
  meta: CollectionTargetVsPerformanceData["meta"];
  periodGranularity: PeriodGranularity;
  onPeriodGranularityChange: (value: PeriodGranularity) => void;
  fromDate: Date | null;
  toDate: Date | null;
  onFromDateChange: (value: Date | null) => void;
  onToDateChange: (value: Date | null) => void;
  branchFilter: string | null;
  onBranchFilterChange: (value: string | null) => void;
  currencyFilter: string | null;
  onCurrencyFilterChange: (value: string | null) => void;
  filterOptions?: CollectionTargetVsPerformanceData["filterOptions"];
  onRefresh: () => void;
};

const selectStyles = {
  input: {
    height: 32,
    minHeight: 32,
    borderColor: COL_LINE,
    fontSize: 12,
    fontWeight: 500,
  },
} as const;

const dateFieldStyles = {
  input: {
    height: 32,
    minHeight: 32,
    borderColor: COL_LINE,
    fontSize: 12,
    fontWeight: 500,
    width: 132,
  },
} as const;

export function CollectionPageHeader({
  meta,
  periodGranularity,
  onPeriodGranularityChange,
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  branchFilter,
  onBranchFilterChange,
  currencyFilter,
  onCurrencyFilterChange,
  filterOptions,
  onRefresh,
}: CollectionPageHeaderProps) {
  return (
    <Flex justify="space-between" align="flex-start" gap="md" wrap="wrap" mb="lg">
      <Box style={{ minWidth: 0 }}>
        <Text
          style={{
            fontSize: "clamp(20px, 3vw, 26px)",
            fontWeight: 600,
            letterSpacing: "-0.02em",
            color: COL_INK,
            lineHeight: 1.15,
          }}
        >
          {meta.title}
        </Text>
        <Text fz={12} c={COL_INK_3} mt={6} style={{ lineHeight: 1.5 }}>
          {meta.subtitle}
        </Text>
      </Box>

      <Flex gap={8} wrap="wrap" justify="flex-end" align="flex-end">
        {/* <PeriodPillGroup value={periodGranularity} onChange={onPeriodGranularityChange} /> */}
        <Box>
          <Text fz={10} fw={600} c={COL_INK_4} mb={4} style={{ letterSpacing: "0.04em" }}>
            FROM
          </Text>
          <SingleDateInput
            size="xs"
            placeholder="From date"
            value={fromDate}
            onChange={onFromDateChange}
            allowDeselection={false}
            maxDate={toDate ?? new Date()}
            styles={dateFieldStyles}
          />
        </Box>
        <Box>
          <Text fz={10} fw={600} c={COL_INK_4} mb={4} style={{ letterSpacing: "0.04em" }}>
            TO
          </Text>
          <SingleDateInput
            size="xs"
            placeholder="To date"
            value={toDate}
            onChange={onToDateChange}
            allowDeselection={false}
            minDate={fromDate ?? undefined}
            maxDate={new Date()}
            styles={dateFieldStyles}
          />
        </Box>
        <CollectionBranchFilterSelect
          value={branchFilter}
          onChange={onBranchFilterChange}
        />
        {/* <Select
          size="xs"
          value={currencyFilter}
          onChange={onCurrencyFilterChange}
          data={[
            { value: "all", label: "All currencies" },
            ...(filterOptions?.currencies ?? []),
          ]}
          styles={{ input: { ...selectStyles.input, width: 120 } }}
        /> */}
        {/* <Button
          size="compact-xs"
          variant="default"
          leftSection={<IconDownload size={14} />}
          styles={{
            root: {
              height: 32,
              borderColor: COL_LINE,
              color: COL_INK_3,
              fontSize: 12,
              fontWeight: 500,
            },
          }}
        >
          Export
        </Button>
        <Button
          size="compact-xs"
          variant="subtle"
          color="gray"
          onClick={onRefresh}
          aria-label="Refresh"
        >
          <IconRefresh size={16} />
        </Button> */}
      </Flex>
    </Flex>
  );
}
