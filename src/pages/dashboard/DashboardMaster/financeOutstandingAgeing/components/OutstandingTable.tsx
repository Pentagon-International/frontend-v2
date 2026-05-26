import type { CSSProperties } from "react";
import { Box, Button, Flex, Group, SimpleGrid, Skeleton, Text } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { ERP_LIST_FONT_SANS } from "../../../../../components/ERPListPage/erpListGeistShell";
import { branchDotColor } from "../../accountsDashboardNormalize";
import type {
  OutstandingTableRow,
  OutstandingTableSection,
  OutstandingViewMode,
} from "../financeOutstandingAgeingTypes";
import {
  BRANCH_CHIP_CITY,
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

const TABLE_SCROLL_MIN_WIDTH = 1080;

function tableRowGrid(compact: boolean): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: compact
      ? "minmax(120px, 1.35fr) repeat(9, minmax(52px, 1fr)) minmax(44px, 0.7fr)"
      : "minmax(140px, 1.4fr) repeat(9, minmax(64px, 1fr)) minmax(56px, 0.75fr)",
    gap: compact ? 8 : 12,
    alignItems: "center",
    padding: compact ? "10px 12px" : "10px 18px",
  };
}

const stickyFirstColStyle = (bg: string): CSSProperties => ({
  position: "sticky",
  left: 0,
  zIndex: 2,
  background: bg,
  boxShadow: "4px 0 8px -4px rgba(15, 23, 42, 0.12)",
  minWidth: 0,
});

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

type AmountMetric = {
  label: string;
  value: string;
  highlight?: boolean;
};

function rowAmountMetrics(row: OutstandingTableRow, currency: string): AmountMetric[] {
  return [
    { label: "Outstanding", value: formatCell(row.amounts.outstanding, currency) },
    { label: "Overdue", value: formatCell(row.amounts.overdue, currency) },
    { label: "DSO Days", value: row.amounts.dso_days },
    { label: "1–30", value: formatCell(row.amounts.days1_30, currency) },
    { label: "31–60", value: formatCell(row.amounts.days31_60, currency) },
    {
      label: "61–90",
      value: formatCell(row.amounts.days61_90, currency),
      highlight: row.highlight60Plus,
    },
    {
      label: "90–180",
      value: formatCell(row.amounts.days90_180, currency),
      highlight: row.highlight60Plus,
    },
    {
      label: "180+",
      value: formatCell(row.amounts.days180_plus, currency),
      highlight: row.highlight60Plus,
    },
    { label: "Open lines", value: row.amounts.open_line_count },
  ];
}

function OutstandingTableMobileCard({
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
        py={12}
        px={12}
        style={{
          background: "#f8fafc",
          borderTop: `1px solid ${OST_LINE}`,
          textAlign: "center",
        }}
      >
        <Text fz={11.5} c={OST_INK_3}>
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
  const rowBg = isTotal ? "#f8fafc" : OST_CARD_BG;

  return (
    <Box
      px={12}
      py={10}
      style={{
        borderBottom: isTotal ? "none" : `1px solid ${OST_LINE}`,
        borderTop: isTotal ? `2px solid ${OST_NAVY_800}` : undefined,
        background: rowBg,
        fontFamily: ERP_LIST_FONT_SANS,
        marginTop: isTotal ? 4 : 0,
      }}
    >
      <Flex justify="space-between" align="flex-start" gap={8} wrap="nowrap">
        <Box style={{ minWidth: 0, flex: 1 }}>
          {chipCity ? (
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
                maxWidth: "100%",
              }}
            >
              {row.branchVariant ? (
                <Box
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: branchDotColor(row.branchVariant),
                  }}
                />
              ) : null}
              <Text component="span" lineClamp={1}>
                {chipCity}
              </Text>
            </Box>
          ) : null}
          <Text fz={12} fw={isTotal ? 600 : 500} c={OST_INK} mt={chipCity ? 4 : 0} lineClamp={2}>
            {row.primaryLabel}
          </Text>
          {row.subtitle ? (
            <Text fz={10.5} c={OST_INK_4} mt={4} lineClamp={3}>
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
        {!isTotal ? (
          <Box
            component="span"
            style={{
              flexShrink: 0,
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
        ) : null}
      </Flex>
      <SimpleGrid cols={2} spacing={8} mt={10}>
        {rowAmountMetrics(row, currency).map((metric) => (
          <Box key={metric.label}>
            <Text fz={10} fw={600} c={OST_INK_4} tt="uppercase" style={{ letterSpacing: "0.05em" }}>
              {metric.label}
            </Text>
            <Text
              fz={12}
              fw={metric.highlight || isTotal ? 600 : 400}
              c={metric.highlight ? OST_BAD : OST_INK}
              mt={2}
              style={{ fontVariantNumeric: "tabular-nums", wordBreak: "break-word" }}
            >
              {metric.value}
            </Text>
          </Box>
        ))}
      </SimpleGrid>
    </Box>
  );
}

function OutstandingTableRowView({
  row,
  isTotal,
  firstColumnLabel,
  currency,
  compact,
}: {
  row: OutstandingTableRow;
  isTotal?: boolean;
  firstColumnLabel: string;
  currency: string;
  compact: boolean;
}) {
  const rowGrid = tableRowGrid(compact);
  const rowBg = isTotal ? "#f8fafc" : OST_CARD_BG;

  if (row.isMoreFooter) {
    return (
      <Box
        style={{
          ...rowGrid,
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
        ...rowGrid,
        borderBottom: isTotal ? "none" : `1px solid ${OST_LINE}`,
        borderTop: isTotal ? `2px solid ${OST_NAVY_800}` : undefined,
        background: rowBg,
        fontWeight: isTotal ? 600 : 400,
        marginTop: isTotal ? 4 : 0,
        paddingTop: isTotal ? 12 : 10,
        paddingBottom: isTotal ? 12 : 10,
        fontFamily: ERP_LIST_FONT_SANS,
      }}
    >
      <Box style={{ ...stickyFirstColStyle(rowBg), minWidth: 0 }}>
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
        {row.amounts.dso_days}
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
        {formatCell(row.amounts.days61_90, currency)}
      </Text>
      <Text
        fz={12}
        fw={row.highlight60Plus ? 600 : 400}
        c={row.highlight60Plus ? OST_BAD : OST_INK_3}
        style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}
      >
        {formatCell(row.amounts.days90_180, currency)}
      </Text>
      <Text
        fz={12}
        fw={row.highlight60Plus ? 600 : 400}
        c={row.highlight60Plus ? OST_BAD : OST_INK_3}
        style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}
      >
        {formatCell(row.amounts.days180_plus, currency)}
      </Text>
      <Text fz={12} c={OST_INK_3} style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        {row.amounts.open_line_count}
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

export type OutstandingTablePagination = {
  index: number;
  limit: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  loading?: boolean;
};

type OutstandingTableProps = {
  section: OutstandingTableSection;
  viewMode: OutstandingViewMode;
  partyLabel: string;
  /** From API `summary.currency` (e.g. INR). */
  currency?: string;
  loading?: boolean;
  /** Customer list pagination (`index` / `limit` query params). */
  pagination?: OutstandingTablePagination;
  /** When true, table sits inside a parent card (no extra outer border). */
  embedded?: boolean;
};

function OutstandingTablePaginationBar({
  pagination,
  compact,
}: {
  pagination: OutstandingTablePagination;
  compact?: boolean;
}) {
  const { index, limit, total, onPrev, onNext, loading } = pagination;
  const currentPage = Math.floor(index / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const rangeStart = total > 0 ? index + 1 : 0;
  const rangeEnd = total > 0 ? Math.min(total, index + limit) : 0;

  return (
    <Flex
      justify={compact ? "center" : "space-between"}
      align="center"
      direction={compact ? "column" : "row"}
      wrap="wrap"
      gap={8}
      mt={12}
      pt={12}
      style={{ borderTop: `1px solid ${OST_LINE}` }}
    >
      <Text fz={11} fw={600} c={OST_INK_3} ta={compact ? "center" : "left"}>
        Showing {rangeStart}-{rangeEnd} of {total}
      </Text>
      <Group gap={6} justify={compact ? "center" : "flex-end"} w={compact ? "100%" : undefined}>
        <Button
          size="compact-sm"
          variant="default"
          leftSection={<IconChevronLeft size={14} />}
          disabled={index <= 0 || loading}
          onClick={onPrev}
          styles={{
            root: { height: 28, fontSize: 11, borderColor: OST_LINE, color: OST_INK_3 },
          }}
        >
          Prev
        </Button>
        <Text fz={11} fw={500} c={OST_INK_3} style={{ minWidth: 72, textAlign: "center" }}>
          Page {currentPage}/{totalPages}
        </Text>
        <Button
          size="compact-sm"
          variant="default"
          rightSection={<IconChevronRight size={14} />}
          disabled={index + limit >= total || loading}
          onClick={onNext}
          styles={{
            root: { height: 28, fontSize: 11, borderColor: OST_LINE, color: OST_INK_3 },
          }}
        >
          Next
        </Button>
      </Group>
    </Flex>
  );
}

export function OutstandingTable({
  section,
  viewMode,
  partyLabel,
  currency = "",
  loading,
  pagination,
  embedded,
}: OutstandingTableProps) {
  const isMobile = useMediaQuery("(max-width: 48em)") ?? false;
  const isCompact = useMediaQuery("(max-width: 62em)") ?? false;
  const firstCol = viewMode === "branch" ? "Branch" : partyLabel;
  const showPagination = viewMode === "party" && pagination && pagination.total > 0;
  const rowGrid = tableRowGrid(isCompact);

  const headerStyle = {
    fontSize: isCompact ? 9 : 10,
    fontWeight: 600,
    color: OST_INK_4,
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
    whiteSpace: "nowrap" as const,
  };

  const tableBody = loading ? (
    Array.from({ length: 5 }).map((_, i) => (
      <Box key={i} py={10} px={isMobile ? 12 : 0}>
        <Skeleton height={isMobile ? 120 : 36} />
      </Box>
    ))
  ) : isMobile ? (
    <>
      {section.rows.map((row) => (
        <OutstandingTableMobileCard
          key={row.id ?? row.primaryLabel}
          row={row}
          firstColumnLabel={partyLabel}
          currency={currency}
        />
      ))}
      {section.moreFooter ? (
        <OutstandingTableMobileCard
          row={section.moreFooter}
          firstColumnLabel={partyLabel}
          currency={currency}
        />
      ) : null}
      <OutstandingTableMobileCard
        row={section.total}
        isTotal
        firstColumnLabel={partyLabel}
        currency={currency}
      />
    </>
  ) : (
    <>
      <Box
        style={{
          ...rowGrid,
          paddingBottom: 8,
          borderBottom: `1px solid ${OST_LINE}`,
          color: OST_INK_4,
          background: OST_CARD_BG,
        }}
      >
        <Text style={{ ...headerStyle, ...stickyFirstColStyle(OST_CARD_BG) }}>{firstCol}</Text>
        <Text style={{ ...headerStyle, textAlign: "right" }}>Outstanding</Text>
        <Text style={{ ...headerStyle, textAlign: "right" }}>Overdue</Text>
        <Text style={{ ...headerStyle, textAlign: "right" }}>DSO Days</Text>
        <Text style={{ ...headerStyle, textAlign: "right" }}>1–30</Text>
        <Text style={{ ...headerStyle, textAlign: "right" }}>31–60</Text>
        <Text style={{ ...headerStyle, textAlign: "right" }}>61-90</Text>
        <Text style={{ ...headerStyle, textAlign: "right" }}>90–180</Text>
        <Text style={{ ...headerStyle, textAlign: "right" }}>180+</Text>
        <Text style={{ ...headerStyle, textAlign: "right" }}>Open lines</Text>
        <Text style={{ ...headerStyle, textAlign: "right" }}>Risk</Text>
      </Box>
      {section.rows.map((row) => (
        <OutstandingTableRowView
          key={row.id ?? row.primaryLabel}
          row={row}
          firstColumnLabel={partyLabel}
          currency={currency}
          compact={isCompact}
        />
      ))}
      {section.moreFooter ? (
        <OutstandingTableRowView
          row={section.moreFooter}
          firstColumnLabel={partyLabel}
          currency={currency}
          compact={isCompact}
        />
      ) : null}
      <OutstandingTableRowView
        row={section.total}
        isTotal
        firstColumnLabel={partyLabel}
        currency={currency}
        compact={isCompact}
      />
    </>
  );

  return (
    <Box
      style={{
        background: embedded ? "transparent" : OST_CARD_BG,
        border: embedded ? "none" : `1px solid ${OST_LINE}`,
        borderRadius: embedded ? 0 : 10,
        overflow: "hidden",
        width: "100%",
        minWidth: 0,
      }}
    >
      <Box px={embedded ? 0 : { base: 0, sm: 18 }} pb={12} pt={embedded ? 0 : 4} style={{ minWidth: 0 }}>
        {!isMobile && !loading && section.rows.length > 0 ? (
          <Text fz={10} c={OST_INK_4} mb={6} ta="right" style={{ display: isCompact ? "block" : "none" }}>
            Scroll horizontally to view all columns
          </Text>
        ) : null}
        <Box
          style={{
            overflowX: isMobile ? "visible" : "auto",
            WebkitOverflowScrolling: "touch",
            width: "100%",
            minWidth: 0,
            marginLeft: embedded ? 0 : undefined,
            marginRight: embedded ? 0 : undefined,
          }}
        >
          <Box style={{ minWidth: isMobile ? undefined : TABLE_SCROLL_MIN_WIDTH }}>
            {tableBody}
          </Box>
        </Box>
        {showPagination && pagination ? (
          <Box px={isMobile ? 12 : 0}>
            <OutstandingTablePaginationBar pagination={pagination} compact={isMobile} />
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}
