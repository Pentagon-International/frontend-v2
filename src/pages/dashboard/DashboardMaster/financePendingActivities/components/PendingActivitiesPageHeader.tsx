import { Box, Button, Flex, Select, Text } from "@mantine/core";
import { IconDownload, IconRefresh } from "@tabler/icons-react";
import { SingleDateInput } from "../../../../../components";
import type { FinancePendingActivitiesData } from "../financePendingActivitiesTypes";
import { PA_INK, PA_INK_3, PA_INK_4, PA_LINE } from "../theme";
import { PeriodPillGroup, type PeriodGranularity } from "../../collectionTargetVsPerformance/components/PeriodPillGroup";

type PendingActivitiesPageHeaderProps = {
  meta: FinancePendingActivitiesData["meta"];
  periodGranularity: PeriodGranularity;
  onPeriodGranularityChange: (value: PeriodGranularity) => void;
  fromDate: Date | null;
  toDate: Date | null;
  onFromDateChange: (value: Date | null) => void;
  onToDateChange: (value: Date | null) => void;
  branchFilter: string | null;
  onBranchFilterChange: (value: string | null) => void;
  ownerFilter: string | null;
  onOwnerFilterChange: (value: string | null) => void;
  filterOptions?: FinancePendingActivitiesData["filterOptions"];
  onRefresh: () => void;
};

const selectStyles = {
  input: {
    height: 32,
    minHeight: 32,
    borderColor: PA_LINE,
    fontSize: 12,
    fontWeight: 500,
  },
} as const;

const dateFieldStyles = {
  input: {
    height: 32,
    minHeight: 32,
    borderColor: PA_LINE,
    fontSize: 12,
    fontWeight: 500,
    width: 132,
  },
} as const;

export function PendingActivitiesPageHeader({
  meta,
  periodGranularity,
  onPeriodGranularityChange,
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  branchFilter,
  onBranchFilterChange,
  ownerFilter,
  onOwnerFilterChange,
  filterOptions,
  onRefresh,
}: PendingActivitiesPageHeaderProps) {
  return (
    <Flex justify="space-between" align="flex-start" gap="md" wrap="wrap" mb="lg">
      <Box style={{ minWidth: 0 }}>
        <Text
          style={{
            fontSize: "clamp(20px, 3vw, 26px)",
            fontWeight: 600,
            letterSpacing: "-0.02em",
            color: PA_INK,
            lineHeight: 1.15,
          }}
        >
          {meta.title}
        </Text>
        <Text fz={12} c={PA_INK_3} mt={6} style={{ lineHeight: 1.5 }}>
          {meta.subtitle}
        </Text>
      </Box>

      <Flex gap={8} wrap="wrap" justify="flex-end" align="flex-end">
        <PeriodPillGroup value={periodGranularity} onChange={onPeriodGranularityChange} />
        <Box>
          <Text fz={10} fw={600} c={PA_INK_4} mb={4} style={{ letterSpacing: "0.04em" }}>
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
          <Text fz={10} fw={600} c={PA_INK_4} mb={4} style={{ letterSpacing: "0.04em" }}>
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
          value={ownerFilter}
          onChange={onOwnerFilterChange}
          data={[
            { value: "all", label: "All owners" },
            ...(filterOptions?.owners ?? []),
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
              borderColor: PA_LINE,
              color: PA_INK_3,
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
