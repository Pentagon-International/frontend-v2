import { Box, Button, Flex, Select, Text } from "@mantine/core";
import { IconDownload, IconRefresh } from "@tabler/icons-react";
import type { FinanceOutstandingAgeingData } from "../financeOutstandingAgeingTypes";
import { OST_INK, OST_INK_3, OST_LINE, OST_NAVY_800 } from "../theme";
import { PeriodPillGroup, type PeriodGranularity } from "../../collectionTargetVsPerformance/components/PeriodPillGroup";

type OutstandingPageHeaderProps = {
  meta: FinanceOutstandingAgeingData["meta"];
  periodGranularity: PeriodGranularity;
  onPeriodGranularityChange: (value: PeriodGranularity) => void;
  branchFilter: string | null;
  onBranchFilterChange: (value: string | null) => void;
  riskFilter: string | null;
  onRiskFilterChange: (value: string | null) => void;
  filterOptions?: FinanceOutstandingAgeingData["filterOptions"];
  onRefresh: () => void;
};

const selectStyles = {
  input: {
    height: 32,
    minHeight: 32,
    borderColor: OST_LINE,
    fontSize: 12,
    fontWeight: 500,
  },
} as const;

export function OutstandingPageHeader({
  meta,
  periodGranularity,
  onPeriodGranularityChange,
  branchFilter,
  onBranchFilterChange,
  riskFilter,
  onRiskFilterChange,
  filterOptions,
  onRefresh,
}: OutstandingPageHeaderProps) {
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
        <PeriodPillGroup value={periodGranularity} onChange={onPeriodGranularityChange} />
        <Button
          size="compact-xs"
          variant="filled"
          styles={{
            root: {
              background: OST_NAVY_800,
              height: 32,
              fontSize: 12,
              fontWeight: 500,
            },
          }}
        >
          {meta.asOfLabel}
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
          value={riskFilter}
          onChange={onRiskFilterChange}
          data={[
            { value: "all", label: "Risk: All" },
            ...(filterOptions?.risks ?? []),
          ]}
          styles={{ input: { ...selectStyles.input, width: 110 } }}
        />
        <Button
          size="compact-xs"
          variant="default"
          leftSection={<IconDownload size={14} />}
          styles={{
            root: {
              height: 32,
              borderColor: OST_LINE,
              color: OST_INK_3,
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
