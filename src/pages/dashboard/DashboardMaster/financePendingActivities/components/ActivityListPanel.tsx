import { useState } from "react";
import {
  Box,
  Button,
  Flex,
  Group,
  Skeleton,
  Text,
} from "@mantine/core";
import {
  IconChevronRight,
  IconFileInvoice,
  IconPackage,
  IconReceipt,
  IconArrowsExchange,
} from "@tabler/icons-react";
import { branchDotColor } from "../../accountsDashboardNormalize";
import { formatPendingActivityAmountCr } from "../financePendingActivitiesAmountFormat";
import type { ActivityListPanel as ActivityListPanelData, PendingActivityCategory } from "../financePendingActivitiesTypes";
import {
  PA_ACTIVITY_ROW_GRID,
  PA_BAD,
  PA_CARD_BG,
  PA_INK,
  PA_INK_3,
  PA_INK_4,
  PA_KPI_ICON_BG,
  PA_KPI_STRIPE,
  PA_LINE,
  PA_NAVY_800,
  PA_VOUCHER_ROW_GRID,
  PA_WARN,
} from "../theme";

const ICONS = {
  invoices: IconFileInvoice,
  costs: IconPackage,
  vouchers: IconReceipt,
  credit_notes: IconArrowsExchange,
} as const;

function ageColor(days: number): string {
  if (days >= 18) return PA_BAD;
  if (days >= 10) return PA_WARN;
  return PA_INK_3;
}

type ActivityListPanelProps = {
  panel: ActivityListPanelData;
  loading?: boolean;
  showTypeColumn?: boolean;
  compact?: boolean;
  currencyCode?: string;
  onPageChange?: (pageIndex: number) => void;
};

export function ActivityListPanel({
  panel,
  loading,
  showTypeColumn,
  compact,
  currencyCode = "INR",
  onPageChange,
}: ActivityListPanelProps) {
  const code = currencyCode.trim().toUpperCase() || "INR";
  const [activeTab, setActiveTab] = useState(panel.filterTabs?.[0]?.value ?? "all");
  const rowGrid = showTypeColumn ? PA_VOUCHER_ROW_GRID : PA_ACTIVITY_ROW_GRID;
  const tone: PendingActivityCategory = panel.id;
  const Icon = ICONS[tone];
  const pagination = panel.pagination;
  const pageCount =
    pagination && pagination.limit > 0
      ? Math.max(1, Math.ceil(pagination.total / pagination.limit))
      : 0;
  const currentPage =
    pagination && pagination.limit > 0
      ? Math.floor(pagination.index / pagination.limit) + 1
      : 1;

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
        marginBottom: compact ? 0 : 14,
        height: compact ? "100%" : undefined,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Flex
        align="flex-start"
        justify="space-between"
        gap={10}
        wrap="wrap"
        px={16}
        py={12}
        style={{ borderBottom: `1px solid ${PA_LINE}` }}
      >
        <Box style={{ minWidth: 0 }}>
          <Text fz={13} fw={600} c={PA_INK}>
            {panel.title}
          </Text>
          <Text fz={11} c={PA_INK_4} mt={2}>
            {panel.subtitle}
          </Text>
        </Box>
        {panel.filterTabs?.length ? (
          <Box
            style={{
              display: "inline-flex",
              gap: 2,
              background: "#f8fafc",
              border: `1px solid ${PA_LINE}`,
              borderRadius: 6,
              padding: 2,
            }}
          >
            {panel.filterTabs.map((tab) => (
              <Button
                key={tab.value}
                size="compact-xs"
                variant="subtle"
                onClick={() => setActiveTab(tab.value)}
                styles={{
                  root: {
                    height: "auto",
                    minHeight: 24,
                    padding: "3px 10px",
                    fontSize: 11,
                    fontWeight: activeTab === tab.value ? 600 : 500,
                    color: activeTab === tab.value ? PA_INK : PA_INK_3,
                    background: activeTab === tab.value ? "#ffffff" : "transparent",
                    boxShadow:
                      activeTab === tab.value ? "0 1px 2px rgba(15,23,42,0.06)" : "none",
                  },
                }}
              >
                {tab.label}
              </Button>
            ))}
          </Box>
        ) : null}
      </Flex>

      <Box style={{ flex: 1, minHeight: 0 }}>
        <Box
          style={{
            ...rowGrid,
            paddingBottom: 6,
            borderBottom: `1px solid ${PA_LINE}`,
            color: PA_INK_4,
            paddingTop: 4,
          }}
        >
          <div />
          <Text style={headerStyle}>
            {showTypeColumn ? "Voucher / Beneficiary" : "Shipment / Customer"}
          </Text>
          {showTypeColumn ? (
            <Text style={headerStyle}>Type</Text>
          ) : (
            <Text style={headerStyle}>Job ref</Text>
          )}
          <Text style={{ ...headerStyle, textAlign: "right" }}>Amount</Text>
          <Text style={{ ...headerStyle, textAlign: "right" }}>Age</Text>
          <Text style={headerStyle}>Branch</Text>
          <div />
        </Box>

        {loading ? (
          Array.from({ length: pagination?.limit ?? 4 }).map((_, i) => (
            <Box key={i} px={16} py={8}>
              <Skeleton height={36} />
            </Box>
          ))
        ) : panel.items.length === 0 ? (
          <Box px={16} py={24} style={{ textAlign: "center" }}>
            <Text fz={12} c={PA_INK_4}>
              No items in this period.
            </Text>
          </Box>
        ) : (
          panel.items.map((item) => (
            <Box
              key={item.id ?? item.reference}
              component="button"
              type="button"
              style={{
                ...rowGrid,
                width: "100%",
                border: "none",
                borderBottom: `1px solid ${PA_LINE}`,
                background: "transparent",
                textAlign: "left",
                cursor: "pointer",
                transition: "background-color 120ms ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#f8fafc";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <Box
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  background: PA_KPI_ICON_BG[tone],
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon size={14} color={PA_KPI_STRIPE[tone]} stroke={1.75} />
              </Box>
              <Box style={{ minWidth: 0 }}>
                <Text fz={12} fw={600} c={PA_INK} lineClamp={1}>
                  {item.title}
                </Text>
                <Text fz={10.5} c={PA_INK_4} mt={2} lineClamp={1}>
                  {item.subtitle}
                  {item.statusNote ? ` · ${item.statusNote}` : ""}
                </Text>
              </Box>
              {showTypeColumn ? (
                <Box>
                  {item.typeTag ? (
                    <Box
                      component="span"
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: 4,
                        background: "#f1f5f9",
                        color: PA_INK_3,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {item.typeTag}
                    </Box>
                  ) : (
                    <Text fz={11} c={PA_INK_4}>
                      —
                    </Text>
                  )}
                </Box>
              ) : (
                <Text fz={11} c={PA_INK_3} style={{ fontFamily: "var(--font-mono, monospace)" }}>
                  {item.reference}
                </Text>
              )}
              <Text
                fz={12}
                fw={600}
                c={PA_INK}
                style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}
              >
                {item.amountDisplay ?? formatPendingActivityAmountCr(item.amountCr, code)}
              </Text>
              <Text
                fz={11}
                fw={600}
                c={ageColor(item.ageDays)}
                style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}
              >
                {item.ageDays} d
              </Text>
              {item.branchCode ? (
                <Box
                  component="span"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 10,
                    fontWeight: 600,
                    padding: "2px 6px",
                    borderRadius: 3,
                    background: "#f8fafc",
                    border: `1px solid ${PA_LINE}`,
                    textTransform: "uppercase",
                  }}
                >
                  <Box
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: branchDotColor(item.branchVariant),
                    }}
                  />
                  {item.branchCode}
                </Box>
              ) : (
                <Text fz={11} c={PA_INK_4}>
                  —
                </Text>
              )}
              <IconChevronRight size={14} color={PA_INK_4} style={{ justifySelf: "end" }} />
            </Box>
          ))
        )}
      </Box>

      {pagination && pageCount > 1 && onPageChange ? (
        <Flex
          px={16}
          py={10}
          align="center"
          justify="space-between"
          gap={8}
          wrap="wrap"
          style={{
            borderTop: `1px solid ${PA_LINE}`,
            background: "#f8fafc",
          }}
        >
          <Text fz={11} c={PA_INK_4}>
            {pagination.total} {panel.moreLabel ?? "items"}
            {panel.moreCount ? ` · ${panel.moreCount} not shown` : ""}
          </Text>
          <Group gap={6}>
            <Button
              size="compact-xs"
              variant="default"
              disabled={loading || currentPage <= 1}
              onClick={() => onPageChange(Math.max(0, pagination.index - pagination.limit))}
              styles={{
                root: {
                  height: 28,
                  borderColor: PA_LINE,
                  fontSize: 11,
                  fontWeight: 500,
                },
              }}
            >
              Previous
            </Button>
            <Text fz={11} c={PA_INK_3} style={{ fontVariantNumeric: "tabular-nums" }}>
              Page {currentPage} of {pageCount}
            </Text>
            <Button
              size="compact-xs"
              variant="default"
              disabled={loading || currentPage >= pageCount}
              onClick={() => onPageChange(pagination.index + pagination.limit)}
              styles={{
                root: {
                  height: 28,
                  borderColor: PA_LINE,
                  fontSize: 11,
                  fontWeight: 500,
                },
              }}
            >
              Next
            </Button>
          </Group>
        </Flex>
      ) : panel.moreCount ? (
        <Box
          px={16}
          py={10}
          style={{
            borderTop: `1px solid ${PA_LINE}`,
            background: "#f8fafc",
            textAlign: "center",
          }}
        >
          <Text fz={11.5} c={PA_INK_3}>
            + {panel.moreCount} more {panel.moreLabel ?? "items"}
          </Text>
        </Box>
      ) : null}
    </Box>
  );
}
