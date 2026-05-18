import { Box, Flex, Skeleton, Text } from "@mantine/core";
import {
  ERP_LIST_FONT_MONO,
  ERP_LIST_FONT_SANS,
} from "../../../../../components/ERPListPage/erpListGeistShell";
import { branchDotColor, formatAmountInCr } from "../../accountsDashboardNormalize";
import type { BranchCollectionRow } from "../collectionTargetVsPerformanceTypes";
import {
  BRANCH_CHIP_CITY,
  COL_BAD,
  COL_BAD_BG,
  COL_BRANCH_GRID,
  COL_GOOD,
  COL_INK,
  COL_INK_2,
  COL_INK_3,
  COL_INK_4,
  COL_LINE,
  COL_NAVY_900,
  COL_WARN_BG,
} from "../theme";
import { CollectionPerformanceBar } from "./CollectionPerformanceBar";
import { DashboardCard } from "./DashboardCard";

function branchChipLabel(row: BranchCollectionRow): string | null {
  if (row.branchChipLabel) return row.branchChipLabel;
  const key = row.branchVariant?.toLowerCase();
  if (key && BRANCH_CHIP_CITY[key]) return BRANCH_CHIP_CITY[key];
  return row.branchCode ?? null;
}

function BranchCollectionRowView({
  row,
  isTotal,
  onRowClick,
}: {
  row: BranchCollectionRow;
  isTotal?: boolean;
  onRowClick?: (row: BranchCollectionRow) => void;
}) {
  const chipLabel = !isTotal ? branchChipLabel(row) : null;

  return (
    <Box
      component={onRowClick && !isTotal ? "button" : "div"}
      onClick={onRowClick && !isTotal ? () => onRowClick(row) : undefined}
      style={{
        ...COL_BRANCH_GRID,
        borderBottom: isTotal ? "none" : `1px solid ${COL_LINE}`,
        borderTop: isTotal ? `2px solid ${COL_NAVY_900}` : "none",
        borderLeft: "none",
        borderRight: "none",
        paddingTop: isTotal ? 14 : undefined,
        marginTop: isTotal ? 4 : 0,
        fontWeight: isTotal ? 600 : 400,
        width: "100%",
        textAlign: "left",
        background: "transparent",
        cursor: onRowClick && !isTotal ? "pointer" : "default",
        fontFamily: ERP_LIST_FONT_SANS,
      }}
    >
      <Flex align="flex-start" gap={8} style={{ minWidth: 0 }}>
        {chipLabel ? (
          <Box
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 10.5,
              fontWeight: 600,
              padding: "2px 7px",
              borderRadius: 3,
              background: "#f8fafc",
              color: COL_INK_2,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              border: `1px solid ${COL_LINE}`,
              flexShrink: 0,
              marginTop: 1,
            }}
          >
            <Box
              component="span"
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: branchDotColor(row.branchVariant),
              }}
            />
            {chipLabel}
          </Box>
        ) : null}
        <Box style={{ minWidth: 0 }}>
          <Text
            fz={12}
            fw={isTotal ? 600 : 500}
            c={COL_INK}
            tt={isTotal ? undefined : "uppercase"}
            style={{ letterSpacing: isTotal ? undefined : "0.02em" }}
          >
            {row.branchName}
          </Text>
          {row.subtitle ? (
            <Text fz={10.5} c={COL_INK_4} mt={2}>
              {row.subtitle}
              {row.exposureLabel ? (
                <>
                  {" · "}
                  <Box
                    component="span"
                    style={{
                      display: "inline-block",
                      fontSize: 10,
                      fontWeight: 600,
                      padding: "2px 6px",
                      borderRadius: 3,
                      background: row.exposureTone === "bad" ? COL_BAD_BG : COL_WARN_BG,
                      color: row.exposureTone === "bad" ? "#991b1b" : "#92400e",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      verticalAlign: "middle",
                    }}
                  >
                    {row.exposureLabel}
                  </Box>
                </>
              ) : null}
            </Text>
          ) : null}
        </Box>
      </Flex>
      <Text fz={12} c={COL_INK_2} style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        <Text span c={COL_INK_4} fz={10} mr={2}>
          ₹
        </Text>
        {formatAmountInCr(row.target)}
      </Text>
      <Text
        fz={12}
        fw={600}
        c={COL_INK}
        style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}
      >
        <Text span c={COL_INK_4} fz={10} mr={2}>
          ₹
        </Text>
        {formatAmountInCr(row.collected)}
      </Text>
      <CollectionPerformanceBar
        collectedWidthPct={row.barCollectedWidthPct}
        markerLeftPct={row.markerLeftPct}
        tone={row.barTone}
      />
      <Text
        fz={12}
        fw={600}
        c={row.gapDirection === "pos" ? COL_GOOD : COL_BAD}
        style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}
      >
        {row.gapDisplay ?? formatAmountInCr(row.gap)}
      </Text>
      <Text
        fz={11}
        c={COL_INK_3}
        style={{
          fontFamily: ERP_LIST_FONT_MONO,
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {row.achievementPct.toFixed(row.achievementPct % 1 === 0 ? 0 : 1)}%
      </Text>
    </Box>
  );
}

type BranchCollectionTableProps = {
  rows: BranchCollectionRow[];
  total: BranchCollectionRow;
  loading?: boolean;
  onRowClick?: (row: BranchCollectionRow) => void;
};

export function BranchCollectionTable({
  rows,
  total,
  loading,
  onRowClick,
}: BranchCollectionTableProps) {
  const headerStyle = {
    fontSize: 10,
    fontWeight: 600,
    color: COL_INK_4,
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
  };

  return (
    <DashboardCard
      title="Branch Collection Performance"
      subtitle="YTD target vs collected · click for invoice-level drill-down"
      padding="0"
    >
      <Box px={18} pb={18}>
        <Box
          style={{
            ...COL_BRANCH_GRID,
            paddingBottom: 8,
            borderBottom: `1px solid ${COL_LINE}`,
          }}
        >
          <Text style={headerStyle}>Branch</Text>
          <Text style={{ ...headerStyle, textAlign: "right" }}>Target</Text>
          <Text style={{ ...headerStyle, textAlign: "right" }}>Collected</Text>
          <Text style={headerStyle}>Progress</Text>
          <Text style={{ ...headerStyle, textAlign: "right" }}>Gap</Text>
          <Text style={{ ...headerStyle, textAlign: "right" }}>Achvd.</Text>
        </Box>

        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Box key={i} style={{ ...COL_BRANCH_GRID, padding: "12px 0" }}>
              <Skeleton height={32} />
              <Skeleton height={16} />
              <Skeleton height={16} />
              <Skeleton height={22} />
              <Skeleton height={16} />
              <Skeleton height={16} />
            </Box>
          ))
        ) : (
          <>
            {rows.map((row) => (
              <BranchCollectionRowView key={row.id ?? row.branchName} row={row} onRowClick={onRowClick} />
            ))}
            <BranchCollectionRowView row={total} isTotal />
          </>
        )}
      </Box>
    </DashboardCard>
  );
}
