import { useMemo } from "react";
import { Badge, Box, Group, SegmentedControl, Select, Text } from "@mantine/core";
import { IconArrowRight } from "@tabler/icons-react";
import {
  calculateFinancialYearBudgetRangeForYear,
  type BudgetAggregatedData,
} from "../../../service/dashboard.service";
import {
  dashboardPanelBody,
  dashboardPanelHeaderBand,
  dashboardPanelShell,
  dashboardPanelTitleStyle,
  dashboardViewAllStyle,
} from "./dashboardPanelStyles";

interface BudgetVsActualCardProps {
  budgetRawData: any;
  budgetAggregatedData: BudgetAggregatedData;
  budgetType: "salesperson" | "non-salesperson";
  selectedYear: string | null;
  budgetStartMonth: string;
  budgetEndMonth: string;
  yearOptions: { value: string; label: string }[];
  fromMonthOptions: { value: string; label: string }[];
  toMonthOptions: { value: string; label: string }[];
  handleBudgetViewAll: () => void;
  handleBudgetTypeChange: (value: "salesperson" | "non-salesperson") => void;
  handleBudgetMonthFilterChange: (startMonth: string | null, endMonth: string | null) => void;
  setSelectedYear: (year: string | null) => void;
}

type BudgetSummaryView = {
  budgetYtd: number;
  actualYtd: number;
  varianceYtd: number;
  achievementPct: number;
  forecastStatus: string;
  forecastDirection?: string;
};

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatCrL = (value: number): string => {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(1)} L`;
  return `${sign}₹${abs.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
};

const toTitleCase = (value: string): string =>
  value
    .split("_")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1).toLowerCase() : part))
    .join(" ");

const BudgetVsActualCard = ({
  budgetRawData,
  budgetAggregatedData,
  budgetType,
  selectedYear,
  budgetStartMonth,
  budgetEndMonth,
  yearOptions,
  fromMonthOptions,
  toMonthOptions,
  handleBudgetViewAll,
  handleBudgetTypeChange,
  handleBudgetMonthFilterChange,
  setSelectedYear,
}: BudgetVsActualCardProps) => {
  const normalizedBudgetEndMonth = useMemo(() => {
    if (!selectedYear || !budgetEndMonth) return budgetEndMonth;
    const endMonthPart = budgetEndMonth.split("-")[1];
    return endMonthPart ? `${selectedYear}-${endMonthPart}` : budgetEndMonth;
  }, [selectedYear, budgetEndMonth]);

  const summaryView = useMemo<BudgetSummaryView>(() => {
    const summary = budgetRawData?.summary;
    if (summary && typeof summary === "object") {
      return {
        budgetYtd: toNumber(summary.budget_ytd),
        actualYtd: toNumber(summary.actual_ytd),
        varianceYtd: toNumber(summary.variance_ytd),
        achievementPct: toNumber(summary.achievement_pct),
        forecastStatus: String(summary.forecast_status || "on_track"),
        forecastDirection:
          typeof summary.forecast_direction === "string"
            ? summary.forecast_direction
            : undefined,
      };
    }

    const budgetYtd = toNumber(budgetAggregatedData.totalSalesBudget);
    const actualYtd = toNumber(budgetAggregatedData.totalActualBudget);
    const varianceYtd = actualYtd - budgetYtd;
    const achievementPct = budgetYtd > 0 ? (actualYtd / budgetYtd) * 100 : 0;

    return {
      budgetYtd,
      actualYtd,
      varianceYtd,
      achievementPct,
      forecastStatus: actualYtd >= budgetYtd ? "on_track" : "at_risk",
    };
  }, [budgetAggregatedData.totalActualBudget, budgetAggregatedData.totalSalesBudget, budgetRawData]);

  const progressPct = useMemo(() => {
    if (summaryView.budgetYtd <= 0) return 0;
    const pct = (summaryView.actualYtd / summaryView.budgetYtd) * 100;
    return Math.max(0, Math.min(100, pct));
  }, [summaryView.actualYtd, summaryView.budgetYtd]);

  const repsMeta = useMemo(() => {
    const rows = (budgetRawData?.by_sales_rep_ytd?.rows || []) as Array<{
      achievement_pct?: number;
    }>;
    if (!rows.length) return { onTrack: 0, total: 0 };
    const onTrack = rows.filter((row) => toNumber(row.achievement_pct) >= 100).length;
    return { onTrack, total: rows.length };
  }, [budgetRawData]);

  return (
    <Box style={{ ...dashboardPanelShell, cursor: "pointer" }} onClick={handleBudgetViewAll}>
      <Box style={dashboardPanelHeaderBand}>
        <Group justify="space-between" align="center" wrap="nowrap" gap="sm" w="100%">
          <Group gap="xs" align="center" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
            <Text style={dashboardPanelTitleStyle}>Budget vs Actual</Text>
            <Text size="xs" c="#94A3B8">
              FY
              {selectedYear
                ? `${selectedYear.slice(-2)}-${String(Number(selectedYear) + 1).slice(-2)}`
                : ""}
              {" "}
              YTD {formatCrL(summaryView.budgetYtd)} target
            </Text>
          </Group>
          <Group gap={8} wrap="nowrap" style={{ flexShrink: 0 }}>
            <Badge variant="light" color="blue" radius="sm">
              {budgetType === "salesperson" ? "Sales" : "Non-Sales"}
            </Badge>
            {/* <Text size="sm" c="#105476" style={dashboardViewAllStyle} onClick={handleBudgetViewAll}>
              <Group gap={4} wrap="nowrap">
                <span>View All</span>
                <IconArrowRight size={14} />
              </Group>
            </Text> */}
          </Group>
        </Group>
      </Box>

      <Box style={dashboardPanelBody} onClick={(event) => event.stopPropagation()}>
        <Group gap="xs" wrap="wrap" mb={10}>
          <SegmentedControl
            value={budgetType}
            onChange={(value) => handleBudgetTypeChange(value as "salesperson" | "non-salesperson")}
            data={[
              { label: "Sales", value: "salesperson" },
              { label: "Non-Sales", value: "non-salesperson" },
            ]}
            size="xs"
          />
          <Select
            placeholder="Year"
            value={selectedYear}
            data={yearOptions}
            size="xs"
            w={110}
            onChange={(value) => {
              if (!value) return;
              setSelectedYear(value);
              const range = calculateFinancialYearBudgetRangeForYear(parseInt(value, 10));
              handleBudgetMonthFilterChange(range.start_month, range.end_month);
            }}
          />
          <Select
            placeholder="From Month"
            data={fromMonthOptions}
            value={budgetStartMonth}
            size="xs"
            w={122}
            onChange={(value) => {
              if (!value) return;
              const adjustedEndMonth =
                !budgetEndMonth || budgetEndMonth < value ? value : budgetEndMonth;
              handleBudgetMonthFilterChange(value, adjustedEndMonth);
            }}
          />
          <Select
            placeholder="To Month"
            data={toMonthOptions}
            value={normalizedBudgetEndMonth}
            size="xs"
            w={122}
            onChange={(value) => {
              if (!value) return;
              handleBudgetMonthFilterChange(budgetStartMonth, value);
            }}
          />
        </Group>

        <Group grow gap="lg" wrap="nowrap">
          <Box>
            <Text size="10px" fw={700} c="#64748B" style={{ letterSpacing: "0.06em" }}>
              ACHIEVED
            </Text>
            <Text fw={800} c="#0F172A" mt={1} style={{ fontSize: "28px", lineHeight: 1 }}>
              {summaryView.achievementPct.toFixed(1)}%
            </Text>
            <Text size="xs" c="#64748B" mt={4}>
              {formatCrL(summaryView.actualYtd)}
            </Text>
          </Box>
          <Box>
            <Text size="10px" fw={700} c="#64748B" style={{ letterSpacing: "0.06em" }}>
              VARIANCE
            </Text>
            <Text
              fw={800}
              c={summaryView.varianceYtd < 0 ? "#EF4444" : "#16A34A"}
              mt={1}
              style={{ fontSize: "28px", lineHeight: 1 }}
            >
              {formatCrL(summaryView.varianceYtd)}
            </Text>
            <Text size="xs" c={summaryView.varianceYtd < 0 ? "#EF4444" : "#16A34A"} mt={4}>
              {summaryView.varianceYtd < 0 ? "Below plan" : "Above plan"}
            </Text>
          </Box>
          <Box>
            <Text size="10px" fw={700} c="#64748B" style={{ letterSpacing: "0.06em" }}>
              ON TRACK
            </Text>
            <Text fw={800} c="#0F172A" mt={1} style={{ fontSize: "28px", lineHeight: 1 }}>
              {toTitleCase(summaryView.forecastStatus)}
            </Text>
            <Text size="xs" c="#64748B" mt={4}>
              {repsMeta.total > 0
                ? `${repsMeta.onTrack} of ${repsMeta.total} Reps`
                : summaryView.forecastDirection
                  ? `${toTitleCase(summaryView.forecastDirection)} trend`
                  : "Forecast status"}
            </Text>
          </Box>
        </Group>

        <Box mt={12}>
          <Box
            style={{
              width: "100%",
              height: 16,
              borderRadius: 999,
              background: "linear-gradient(90deg, #E9F2FB 0%, #EEF3F8 100%)",
              border: "1px solid #E2E8F0",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <Box
              style={{
                width: `${progressPct}%`,
                minWidth: progressPct > 0 ? 8 : 0,
                height: "100%",
                background:
                  "linear-gradient(90deg, #1C4B7D 0%, #1F5F99 55%, #2D77B8 100%)",
              }}
            />
          </Box>
          <Group justify="space-between" mt={6}>
            <Text size="10px" c="#94A3B8">
              ₹0
            </Text>
            <Text size="10px" c="#64748B" fw={600}>
              Actual {formatCrL(summaryView.actualYtd)}
            </Text>
            <Text size="10px" c="#94A3B8">
              Target {formatCrL(summaryView.budgetYtd)}
            </Text>
          </Group>
        </Box>
      </Box>
    </Box>
  );
};

export default BudgetVsActualCard;
