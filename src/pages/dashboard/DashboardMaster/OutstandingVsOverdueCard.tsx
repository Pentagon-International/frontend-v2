import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Group,
  Loader,
  Text,
  UnstyledButton,
} from "@mantine/core";
import {
  IconArrowRight,
} from "@tabler/icons-react";
import {
  getCustomerOutstandingVsOverdueData,
  getFilteredOutstandingData,
  type CustomerOutstandingVsOverdueResponse,
  type CustomerOutstandingVsOverdueSummary,
  type FilteredOutstandingResponse,
} from "../../../service/dashboard.service";
import useAuthStore from "../../../store/authStore";
import {
  formatOutstandingAmountCompact,
  formatUserInteger,
  getDefaultBranchCountryCode,
  getDefaultBranchCurrencyCode,
  getOutstandingCurrencyCodeLabel,
  resolveOutstandingDisplayCurrency,
} from "../../../utils/userNumberFormat";
import {
  dashboardPanelBody,
  dashboardPanelHeaderBand,
  dashboardPanelShell,
  dashboardPanelTitleStyle,
} from "./dashboardPanelStyles";
import { enquiryConversionColors } from "./EnquiryConversion/enquiryConversionTokens";

const ERP_FONT_SANS = "'Geist', sans-serif";

interface OutstandingVsOverdueCardProps {
  company: string;
  onViewAll?: () => void;
  globalSearch?: string;
}

const toNumber = (value: string | number | undefined | null): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatPercent = (value: number): string => `${value.toFixed(1)}%`;

const progressColors = ["#22c55e", "#84cc16", "#f59e0b", "#fb923c", "#ef4444"];

function readSummaryDays90Plus(
  summary: CustomerOutstandingVsOverdueSummary | null | undefined
): string | number | undefined {
  if (!summary) return undefined;
  const legacy = (summary as unknown as Record<string, unknown>)["days_90+"];
  const v = summary.days_90_plus ?? legacy;
  return typeof v === "string" || typeof v === "number" ? v : undefined;
}

type CardSummary = {
  total_outstanding: string | number;
  total_overdue: string | number;
  total_overdue_percentage?: string | number;
  open_invoices?: string | number;
  customer_count?: string | number;
  currency?: string;
  days_1_30?: string | number;
  days_31_60?: string | number;
  days_61_90?: string | number;
  days_90_plus?: string | number;
};

function aggregateAgingFromFilteredResponse(
  response: FilteredOutstandingResponse
): Pick<CardSummary, "days_1_30" | "days_31_60" | "days_61_90" | "days_90_plus"> {
  let days1_30 = 0;
  let days31_60 = 0;
  let days61_90 = 0;
  let days90Plus = 0;

  response.data?.forEach((location) => {
    const rows =
      location.outstanding_data ||
      (location as { Salesman_outstanding_data?: unknown[] })
        .Salesman_outstanding_data ||
      [];

    if (!Array.isArray(rows)) return;

    rows.forEach((row) => {
      const item = row as Record<string, string | number | undefined>;
      days1_30 +=
        toNumber(item.days_0_15) +
        toNumber(item.days_16_30);
      days31_60 +=
        toNumber(item.days_31_45) +
        toNumber(item.days_46_60);
      days61_90 += toNumber(item.days_61_90);
      days90Plus +=
        toNumber(item.days_91_120) +
        toNumber(item.days_121_180) +
        toNumber(item.days_181_365) +
        toNumber(item.days_366_730) +
        toNumber(item.days_730);
    });
  });

  return {
    days_1_30: String(days1_30),
    days_31_60: String(days31_60),
    days_61_90: String(days61_90),
    days_90_plus: String(days90Plus),
  };
}

function mapFilteredResponseToCardSummary(
  response: FilteredOutstandingResponse
): CardSummary {
  const summary = response.summary;
  const totalOutstanding =
    summary?.total_outstanding ?? summary?.local_outstanding ?? "0";
  const totalOverdue = summary?.total_overdue ?? "0";
  const outstandingNum = toNumber(totalOutstanding);
  const overdueNum = toNumber(totalOverdue);
  const overduePct =
    outstandingNum > 0 ? (overdueNum / outstandingNum) * 100 : 0;

  let customerCount = 0;
  response.data?.forEach((location) => {
    const rows = location.outstanding_data || [];
    if (Array.isArray(rows)) {
      customerCount += rows.length;
    }
  });

  return {
    total_outstanding: totalOutstanding,
    total_overdue: totalOverdue,
    total_overdue_percentage: overduePct,
    open_invoices: summary?.total ?? customerCount,
    customer_count: customerCount,
    ...aggregateAgingFromFilteredResponse(response),
  };
}

const OutstandingVsOverdueCard = ({
  company,
  onViewAll,
  globalSearch,
}: OutstandingVsOverdueCardProps) => {
  const user = useAuthStore((state) => state.user);
  const userCountryCode = user?.country?.country_code;
  const branchCountryCode = getDefaultBranchCountryCode(user?.branches);
  const branchCurrencyCode = getDefaultBranchCurrencyCode(user?.branches);
  const amountCountryCode = branchCountryCode || userCountryCode;
  const formatCount = (value: string | number | undefined | null) =>
    formatUserInteger(value, userCountryCode);

  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState<CardSummary | null>(null);
  const [asOf, setAsOf] = useState<string>("");

  const trimmedSearch = globalSearch?.trim() || "";

  const displayCurrencyCode = resolveOutstandingDisplayCurrency(
    summary?.currency,
    branchCurrencyCode,
    branchCountryCode,
  );
  const currencyBadgeLabel = getOutstandingCurrencyCodeLabel(
    displayCurrencyCode,
    branchCountryCode,
  );
  const formatAmountCompact = useCallback(
    (value: string | number | undefined | null) =>
      formatOutstandingAmountCompact(
        value,
        amountCountryCode,
        displayCurrencyCode,
      ),
    [amountCountryCode, displayCurrencyCode],
  );

  const fetchCardData = useCallback(async () => {
    if (!company?.trim()) return;
    try {
      setIsLoading(true);

      if (trimmedSearch) {
        const filtered = await getFilteredOutstandingData({
          company,
          search: trimmedSearch,
        });
        setSummary(mapFilteredResponseToCardSummary(filtered));
        setAsOf("");
        return;
      }

      const data: CustomerOutstandingVsOverdueResponse =
        await getCustomerOutstandingVsOverdueData({
          company,
          summaryCard: true,
        });
      setSummary(data.summary ?? null);
      setAsOf(data.as_of || "");
    } catch (error) {
      console.error("Error loading outstanding vs overdue section:", error);
      setSummary(null);
      setAsOf("");
    } finally {
      setIsLoading(false);
    }
  }, [company, trimmedSearch]);

  useEffect(() => {
    void fetchCardData();
  }, [fetchCardData]);

  const metrics = useMemo(() => {
    if (!summary) {
      return {
        currentAmount: 0,
        overdueAmount: 0,
        ninetyPlusAmount: 0,
        currentPct: 0,
        overduePct: 0,
      };
    }
    const totalOutstanding = toNumber(summary.total_outstanding);
    const overdue = toNumber(summary.total_overdue);
    const currentAmount = Math.max(0, totalOutstanding - overdue);
    const overduePct = toNumber(summary.total_overdue_percentage);
    const currentPct =
      overduePct > 0 ? Math.max(0, 100 - overduePct) : totalOutstanding > 0
        ? (currentAmount / totalOutstanding) * 100
        : 0;

    return {
      currentAmount,
      overdueAmount: overdue,
      ninetyPlusAmount: toNumber(readSummaryDays90Plus(summary)),
      currentPct,
      overduePct,
    };
  }, [summary]);

  const agingSegments = useMemo(() => {
    if (!summary) return [];
    const totalOutstanding = Math.max(1, toNumber(summary.total_outstanding));
    const overdue1_30 = toNumber(summary.days_1_30);
    const overdue31_60 = toNumber(summary.days_31_60);
    const overdue61_90 = toNumber(summary.days_61_90);
    const overdue90Plus = toNumber(readSummaryDays90Plus(summary));
    const currentBucket = Math.max(
      0,
      totalOutstanding - (overdue1_30 + overdue31_60 + overdue61_90 + overdue90Plus)
    );
    const raw = [
      { label: "Current", value: currentBucket },
      { label: "1-30", value: overdue1_30 },
      { label: "31-60", value: overdue31_60 },
      { label: "61-90", value: overdue61_90 },
      { label: "90+", value: overdue90Plus },
    ];
    return raw.map((item) => ({
      ...item,
      widthPct: (item.value / totalOutstanding) * 100,
    }));
  }, [summary]);

  return (
    <Box
      style={{
        ...dashboardPanelShell,
        cursor: onViewAll ? "pointer" : "default",
        fontFamily: ERP_FONT_SANS,
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
      }}
      onClick={onViewAll}
    >
      <Box style={dashboardPanelHeaderBand}>
        <Group justify="space-between" align="center" wrap="nowrap" gap="sm" w="100%">
          <Group
            gap={8}
            wrap="nowrap"
            justify="space-between"
            style={{ flex: 1, minWidth: 0, fontFamily: ERP_FONT_SANS, fontWeight: 550 }}
          >
            <Text style={dashboardPanelTitleStyle}>Outstanding vs Overdue</Text>
            <UnstyledButton
              type="button"
              aria-label="Open outstanding detailed view"
              onClick={onViewAll}
              style={{ color: "#94A3B8", display: "inline-flex", alignItems: "center" }}
            >
              <IconArrowRight size={18} stroke={1.6} />
            </UnstyledButton>
          </Group>
          <Badge
            radius="sm"
            variant="light"
            color="blue"
            styles={{
              root: {
                textTransform: "none",
                background: "#EFF6FF",
                color: "#1E3A8A",
                fontWeight: 600,
              },
            }}
          >
            {currencyBadgeLabel}
          </Badge>
        </Group>
        <Text fz={11} fw={600} c="#8AA0B9" mt={4} style={{ lineHeight: 1.4 }}>
          Total {formatAmountCompact(summary?.total_outstanding)} ·{" "}
          {formatCount(summary?.open_invoices)} invoices
        </Text>
      </Box>

      <Box style={dashboardPanelBody}>
        {isLoading ? (
          <Box style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Loader size="lg" color="#153F72" />
          </Box>
        ) : (
          <>
            <Group grow gap="lg" wrap="nowrap">
              <Box>
                <Text
                  size="11px"
                  fw={600}
                  c={enquiryConversionColors.subHeading}
                  tt="uppercase"
                  lts={0.8}
                  mb={12}
                >
                  Current
                </Text>
                <Text fw={700} fz={32} c="#16A34A" lh={1}>
                  {formatAmountCompact(metrics.currentAmount)}
                </Text>
                <Text size="xs" fw={700} c="#16A34A" mt={4}>
                  {formatPercent(metrics.currentPct)}
                </Text>
              </Box>
              <Box>
                <Text
                  size="11px"
                  fw={600}
                  c={enquiryConversionColors.subHeading}
                  tt="uppercase"
                  lts={0.8}
                  mb={12}
                >
                  Overdue
                </Text>
                <Text fw={700} fz={32} c="#EF4444" lh={1}>
                  {formatAmountCompact(summary?.total_overdue)}
                </Text>
                <Text size="xs" fw={700} c="#EF4444" mt={4}>
                  {formatPercent(metrics.overduePct)}
                </Text>
              </Box>
              <Box>
                <Text
                  size="11px"
                  fw={600}
                  c={enquiryConversionColors.subHeading}
                  tt="uppercase"
                  lts={0.8}
                  mb={12}
                >
                  90+ days
                </Text>
                <Text fw={700} fz={32} c={enquiryConversionColors.heading} lh={1}>
                  {formatAmountCompact(readSummaryDays90Plus(summary))}
                </Text>
                <Text size="xs" fw={700} c={enquiryConversionColors.subHeading} mt={4}>
                  {formatCount(summary?.customer_count)} customers
                </Text>
              </Box>
            </Group>

            <Box mt={16}>
              <Group gap={8} wrap="nowrap">
                {agingSegments.map((segment, idx) => (
                  <Box
                    key={segment.label}
                    style={{
                      height: 8,
                      borderRadius: 999,
                      background: progressColors[idx] || "#CBD5E1",
                      width: `${Math.max(5, segment.widthPct)}%`,
                      minWidth: 8,
                    }}
                  />
                ))}
              </Group>
              <Group justify="space-between" mt={8} gap={6} wrap="nowrap">
                {agingSegments.map((segment) => (
                  <Text key={segment.label} size="11px" fw={600} c={enquiryConversionColors.subHeading}>
                    {segment.label}
                  </Text>
                ))}
              </Group>
            </Box>

            <Group justify="space-between" mt="auto" pt={14}>
              <Text fz={11} fw={600} c={enquiryConversionColors.subHeading}>
                As of {asOf || "-"}
              </Text>
              <Text fz={11} fw={600} c={enquiryConversionColors.subHeading}>
                {formatCount(summary?.customer_count)} customers
              </Text>
            </Group>
          </>
        )}
      </Box>
    </Box>
  );
};

export default OutstandingVsOverdueCard;
