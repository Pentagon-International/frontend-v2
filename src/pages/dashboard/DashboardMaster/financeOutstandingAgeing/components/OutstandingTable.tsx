import { Box, Skeleton, Text } from "@mantine/core";
import { ERP_LIST_FONT_SANS } from "../../../../../components/ERPListPage/erpListGeistShell";
import { branchDotColor } from "../../accountsDashboardNormalize";
import type {
  OutstandingTableRow,
  OutstandingTableSection,
  OutstandingViewMode,
} from "../financeOutstandingAgeingTypes";
import {
  BRANCH_CHIP_CITY,
  OST_AR_ROW_GRID,
  OST_BAD,
  OST_BAD_BG,
  OST_CARD_BG,
  OST_GOOD_BG,
  OST_INK,
  OST_INK_3,
  OST_INK_4,
  OST_LINE,
  OST_NAVY_800,
  OST_WARN_BG,
} from "../theme";

function riskPillStyle(risk: OutstandingTableRow["risk"]) {
  if (risk === "high") return { bg: OST_BAD_BG, fg: "#b91c1c", label: "High" };
  if (risk === "medium") return { bg: OST_WARN_BG, fg: "#92400e", label: "Medium" };
  return { bg: OST_GOOD_BG, fg: "#166534", label: "Low" };
}

function watchTagStyle(tone?: "warn" | "bad") {
  if (tone === "bad") return { bg: OST_BAD_BG, fg: "#991b1b" };
  return { bg: OST_WARN_BG, fg: "#92400e" };
}

function formatCell(value: string, currency: string): string {
  if (!value || value === "—") return "—";
  if (!currency) return value;
  return `${currency} ${value}`;
}

function OutstandingTableRowView({
  row,
  isTotal,
  firstColumnLabel,
  currency,
}: {
  row: OutstandingTableRow;
  isTotal?: boolean;
  firstColumnLabel: string;
  currency: string;
}) {
  if (row.isMoreFooter) {
    return (
      <Box
        style={{
          ...OST_AR_ROW_GRID,
          background: "#f8fafc",
          borderTop: `1px solid ${OST_LINE}`,
          justifyContent: "center",
        }}
      >
        <Text
          fz={11.5}
          c={OST_INK_3}
          style={{ gridColumn: "1 / -1", textAlign: "center" }}
        >
          + {row.moreCount ?? 0} more {firstColumnLabel.toLowerCase()}s ·{" "}
          <Text component="span" c={OST_NAVY_800} fw={600} style={{ cursor: "pointer" }}>
            View all
          </Text>
        </Text>
      </Box>
    );
  }

  const risk = riskPillStyle(row.risk);
  const branchLabel =
    row.branchName?.trim() ||
    (row.branchVariant ? BRANCH_CHIP_CITY[row.branchVariant] : undefined) ||
    row.primaryLabel;
  const chipCity = row.showBranchChip && branchLabel ? branchLabel : null;

  return (
    <Box
      style={{
        ...OST_AR_ROW_GRID,
        borderBottom: isTotal ? "none" : `1px solid ${OST_LINE}`,
        borderTop: isTotal ? `2px solid ${OST_NAVY_800}` : undefined,
        background: isTotal ? "#f8fafc" : OST_CARD_BG,
        fontWeight: isTotal ? 600 : 400,
        marginTop: isTotal ? 4 : 0,
        paddingTop: isTotal ? 12 : 10,
        paddingBottom: isTotal ? 12 : 10,
        fontFamily: ERP_LIST_FONT_SANS,
      }}
    >
      <Box style={{ minWidth: 0 }}>
        {chipCity ? (
          <Box>
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
                color: OST_INK,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                border: `1px solid ${OST_LINE}`,
              }}
            >
              {row.branchVariant ? (
                <Box
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: branchDotColor(row.branchVariant),
                  }}
                />
              ) : null}
              {chipCity}
            </Box>
            {row.primaryLabel && row.primaryLabel !== chipCity ? (
              <Text fz={12} fw={isTotal ? 600 : 500} c={OST_INK} mt={4}>
                {row.primaryLabel}
              </Text>
            ) : null}
          </Box>
        ) : (
          <Text fz={12} fw={isTotal ? 600 : 500} c={OST_INK}>
            {row.primaryLabel}
          </Text>
        )}
        {row.subtitle ? (
          <Text fz={10.5} c={OST_INK_4} mt={chipCity ? 4 : 2} lineClamp={2}>
            {row.subtitle}
            {row.watchLabel ? (
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
                    ...watchTagStyle(row.watchTone),
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    verticalAlign: "middle",
                  }}
                >
                  {row.watchLabel}
                </Box>
              </>
            ) : null}
          </Text>
        ) : null}
      </Box>
      <Text fz={12} fw={isTotal ? 600 : 600} c={OST_INK} style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        {formatCell(row.amounts.outstanding, currency)}
      </Text>
      <Text fz={12} c={OST_INK_3} style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        {formatCell(row.amounts.overdue, currency)}
      </Text>
      <Text fz={12} c={OST_INK_3} style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        {formatCell(row.amounts.days1_30, currency)}
      </Text>
      <Text fz={12} c={OST_INK_3} style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        {formatCell(row.amounts.days31_60, currency)}
      </Text>
      <Text
        fz={12}
        fw={row.highlight60Plus ? 600 : 400}
        c={row.highlight60Plus ? OST_BAD : OST_INK_3}
        style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}
      >
        {formatCell(row.amounts.days60Plus, currency)}
      </Text>
      <Box style={{ textAlign: "right" }}>
        {isTotal ? (
          <Text fz={12} c={OST_INK_4}>
            —
          </Text>
        ) : (
          <Box
            component="span"
            style={{
              display: "inline-block",
              fontSize: 10.5,
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: 4,
              background: risk.bg,
              color: risk.fg,
              textTransform: "capitalize",
            }}
          >
            {risk.label}
          </Box>
        )}
      </Box>
    </Box>
  );
}

type OutstandingTableProps = {
  section: OutstandingTableSection;
  viewMode: OutstandingViewMode;
  partyLabel: string;
  /** From API `summary.currency` (e.g. INR). */
  currency?: string;
  loading?: boolean;
  /** When true, table sits inside a parent card (no extra outer border). */
  embedded?: boolean;
};

export function OutstandingTable({
  section,
  viewMode,
  partyLabel,
  currency = "",
  loading,
  embedded,
}: OutstandingTableProps) {
  const firstCol = viewMode === "branch" ? "Branch" : partyLabel;

  const headerStyle = {
    fontSize: 10,
    fontWeight: 600,
    color: OST_INK_4,
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
  };

  return (
    <Box
      style={{
        background: embedded ? "transparent" : OST_CARD_BG,
        border: embedded ? "none" : `1px solid ${OST_LINE}`,
        borderRadius: embedded ? 0 : 10,
        overflow: "hidden",
      }}
    >
      <Box px={embedded ? 0 : 18} pb={12} pt={embedded ? 0 : 4}>
        <Box
          style={{
            ...OST_AR_ROW_GRID,
            paddingBottom: 8,
            borderBottom: `1px solid ${OST_LINE}`,
            color: OST_INK_4,
          }}
        >
          <Text style={headerStyle}>{firstCol}</Text>
          <Text style={{ ...headerStyle, textAlign: "right" }}>Outstanding</Text>
          <Text style={{ ...headerStyle, textAlign: "right" }}>Overdue</Text>
          <Text style={{ ...headerStyle, textAlign: "right" }}>1–30</Text>
          <Text style={{ ...headerStyle, textAlign: "right" }}>31–60</Text>
          <Text style={{ ...headerStyle, textAlign: "right" }}>60+</Text>
          <Text style={{ ...headerStyle, textAlign: "right" }}>Risk</Text>
        </Box>

        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Box key={i} py={10}>
              <Skeleton height={36} />
            </Box>
          ))
        ) : (
          <>
            {section.rows.map((row) => (
              <OutstandingTableRowView
                key={row.id ?? row.primaryLabel}
                row={row}
                firstColumnLabel={partyLabel}
                currency={currency}
              />
            ))}
            {section.moreFooter ? (
              <OutstandingTableRowView
                row={section.moreFooter}
                firstColumnLabel={partyLabel}
                currency={currency}
              />
            ) : null}
            <OutstandingTableRowView
              row={section.total}
              isTotal
              firstColumnLabel={partyLabel}
              currency={currency}
            />
          </>
        )}
      </Box>
    </Box>
  );
}
