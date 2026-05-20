import { Box, Flex, Skeleton, Text } from "@mantine/core";
import { branchDotColor, formatAmountInCr } from "../../accountsDashboardNormalize";
import type { BranchOpenItemsSection } from "../financePendingActivitiesTypes";
import {
  BRANCH_CHIP_CITY,
  PA_BAD_BG,
  PA_BRANCH_GRID,
  PA_CARD_BG,
  PA_INK,
  PA_INK_3,
  PA_INK_4,
  PA_LINE,
  PA_NAVY_800,
  PA_WARN_BG,
} from "../theme";
import { DistributionBar } from "./DistributionBar";

function formatCountAmount(count: number, amountCr: number, display?: string): string {
  if (display) return display;
  return `${count} · ₹${formatAmountInCr(amountCr)}`;
}

function BranchOpenItemRow({
  row,
  isTotal,
}: {
  row: BranchOpenItemsSection["rows"][0];
  isTotal?: boolean;
}) {
  const chipCity =
    row.branchVariant && BRANCH_CHIP_CITY[row.branchVariant]
      ? BRANCH_CHIP_CITY[row.branchVariant]
      : row.branchName;

  return (
    <Box
      style={{
        ...PA_BRANCH_GRID,
        borderBottom: isTotal ? "none" : `1px solid ${PA_LINE}`,
        borderTop: isTotal ? `2px solid ${PA_NAVY_800}` : undefined,
        background: isTotal ? "#f8fafc" : PA_CARD_BG,
        fontWeight: isTotal ? 600 : 400,
        marginTop: isTotal ? 4 : 0,
        paddingTop: isTotal ? 12 : 10,
        paddingBottom: isTotal ? 12 : 10,
      }}
    >
      <Box style={{ minWidth: 0 }}>
        {!isTotal ? (
          <Flex align="center" gap={6} wrap="wrap">
            <Box
              component="span"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 10.5,
                fontWeight: 600,
                padding: "2px 7px",
                borderRadius: 3,
                background: "#f8fafc",
                color: PA_INK,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                border: `1px solid ${PA_LINE}`,
              }}
            >
              <Box
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: branchDotColor(row.branchVariant),
                }}
              />
              {chipCity}
            </Box>
            {row.watchLabel ? (
              <Box
                component="span"
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "2px 6px",
                  borderRadius: 3,
                  background: row.watchTone === "bad" ? PA_BAD_BG : PA_WARN_BG,
                  color: row.watchTone === "bad" ? "#991b1b" : "#92400e",
                  textTransform: "uppercase",
                }}
              >
                {row.watchLabel}
              </Box>
            ) : null}
          </Flex>
        ) : (
          <Text fz={12} fw={600} c={PA_INK}>
            {row.branchName}
          </Text>
        )}
        {row.subtitle && !isTotal ? (
          <Text fz={10.5} c={PA_INK_4} mt={4}>
            {row.subtitle}
          </Text>
        ) : null}
      </Box>
      <Text fz={12} c={PA_INK_3} style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        {formatCountAmount(row.invoiceCount, row.invoiceAmountCr, row.invoiceDisplay)}
      </Text>
      <Text fz={12} c={PA_INK_3} style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        {formatCountAmount(row.costCount, row.costAmountCr, row.costDisplay)}
      </Text>
      <Box>{isTotal ? null : <DistributionBar segments={row.distribution} />}</Box>
      <Text
        fz={12}
        fw={isTotal ? 700 : 600}
        c={PA_INK}
        style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}
      >
        {row.totalExposureDisplay ?? `₹${formatAmountInCr(row.totalExposureCr)}`}
      </Text>
      <Text fz={11} c={PA_INK_3} style={{ textAlign: "right" }}>
        {row.owner || "—"}
      </Text>
    </Box>
  );
}

type BranchOpenItemsTableProps = {
  section: BranchOpenItemsSection;
  loading?: boolean;
};

export function BranchOpenItemsTable({ section, loading }: BranchOpenItemsTableProps) {
  const headerStyle = {
    fontSize: 10,
    fontWeight: 600,
    color: PA_INK_4,
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
  };

  return (
    <Box
      style={{
        background: PA_CARD_BG,
        border: `1px solid ${PA_LINE}`,
        borderRadius: 10,
        overflow: "hidden",
        marginBottom: 14,
      }}
    >
      <Flex
        align="baseline"
        justify="space-between"
        gap={10}
        px={18}
        py={14}
        style={{ borderBottom: `1px solid ${PA_LINE}` }}
      >
        <Text fz={13} fw={600} c={PA_INK}>
          By Branch — Open Items
        </Text>
        <Text fz={11} c={PA_INK_4}>
          Count · ₹ exposure
        </Text>
      </Flex>

      <Box px={0} pb={8}>
        <Box
          style={{
            ...PA_BRANCH_GRID,
            paddingBottom: 8,
            borderBottom: `1px solid ${PA_LINE}`,
            color: PA_INK_4,
          }}
        >
          <Text style={headerStyle}>Branch</Text>
          <Text style={{ ...headerStyle, textAlign: "right" }}>Invoices</Text>
          <Text style={{ ...headerStyle, textAlign: "right" }}>Costs</Text>
          <Text style={headerStyle}>Distribution</Text>
          <Text style={{ ...headerStyle, textAlign: "right" }}>Total exposure</Text>
          <Text style={{ ...headerStyle, textAlign: "right" }}>Owner</Text>
        </Box>

        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Box key={i} px={18} py={10}>
              <Skeleton height={40} />
            </Box>
          ))
        ) : (
          <>
            {section.rows.map((row) => (
              <BranchOpenItemRow key={row.id ?? row.branchName} row={row} />
            ))}
            <BranchOpenItemRow row={section.total} isTotal />
          </>
        )}
      </Box>
    </Box>
  );
}
