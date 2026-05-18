import { Box, Button, Flex, Select, Text } from "@mantine/core";
import { IconDownload, IconRefresh } from "@tabler/icons-react";
import type { CollectionTargetVsPerformanceData } from "../collectionTargetVsPerformanceTypes";
import { COL_INK, COL_INK_3, COL_LINE, COL_NAVY_800 } from "../theme";
import { PeriodPillGroup, type PeriodGranularity } from "./PeriodPillGroup";

type CollectionPageHeaderProps = {
  meta: CollectionTargetVsPerformanceData["meta"];
  periodGranularity: PeriodGranularity;
  onPeriodGranularityChange: (value: PeriodGranularity) => void;
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

export function CollectionPageHeader({
  meta,
  periodGranularity,
  onPeriodGranularityChange,
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

      <Flex gap={8} wrap="wrap" justify="flex-end" align="center">
        <PeriodPillGroup value={periodGranularity} onChange={onPeriodGranularityChange} />
        <Button
          size="compact-xs"
          variant="filled"
          styles={{
            root: {
              background: COL_NAVY_800,
              height: 32,
              fontSize: 12,
              fontWeight: 500,
            },
          }}
        >
          {meta.periodLabel}
        </Button>
        <Select
          size="xs"
          value={branchFilter}
          onChange={onBranchFilterChange}
          data={[
            { value: "all", label: "All branches" },
            ...(filterOptions?.branches ?? []),
          ]}
          styles={{ input: { ...selectStyles.input, width: 120 } }}
        />
        <Select
          size="xs"
          value={currencyFilter}
          onChange={onCurrencyFilterChange}
          data={[
            { value: "all", label: "All currencies" },
            ...(filterOptions?.currencies ?? []),
          ]}
          styles={{ input: { ...selectStyles.input, width: 120 } }}
        />
        <Button
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
        </Button>
      </Flex>
    </Flex>
  );
}
