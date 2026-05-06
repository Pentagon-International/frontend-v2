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
  type CustomerOutstandingVsOverdueResponse,
} from "../../../service/dashboard.service";
import {
  dashboardPanelBody,
  dashboardPanelHeaderBand,
  dashboardPanelShell,
  dashboardPanelTitleStyle,
} from "./dashboardPanelStyles";

interface OutstandingVsOverdueCardProps {
  company: string;
  onViewAll?: () => void;
  globalSearch?: string;
}

const toNumber = (value: string | number | undefined | null): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatAmountCompact = (value: string | number | undefined | null): string => {
  const amount = toNumber(value);
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(1)} L`;
  return `${sign}₹${abs.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
};

const formatPercent = (value: number): string => `${value.toFixed(1)}%`;

const progressColors = ["#22c55e", "#84cc16", "#f59e0b", "#fb923c", "#ef4444"];

const OutstandingVsOverdueCard = ({
  company,
  onViewAll,
  globalSearch,
}: OutstandingVsOverdueCardProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] =
    useState<CustomerOutstandingVsOverdueResponse | null>(null);
  const index = 0;
  const limit = 5;

  const fetchCardData = useCallback(async () => {
    if (!company?.trim()) return;
    try {
      setIsLoading(true);
      const data = await getCustomerOutstandingVsOverdueData({
        company,
        index,
        limit,
        ...(globalSearch?.trim() && { search: globalSearch.trim() }),
      });
      setResponse(data);
    } catch (error) {
      console.error("Error loading outstanding vs overdue section:", error);
      setResponse(null);
    } finally {
      setIsLoading(false);
    }
  }, [company, index, limit, globalSearch]);

  useEffect(() => {
    void fetchCardData();
  }, [fetchCardData]);

  const summary = response?.summary;
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
    const currentPct = Math.max(0, 100 - overduePct);

    return {
      currentAmount,
      overdueAmount: overdue,
      ninetyPlusAmount: toNumber(summary["days_90+"]),
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
    const overdue90Plus = toNumber(summary["days_90+"]);
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
      }}
      onClick={onViewAll}
    >
      <Box style={dashboardPanelHeaderBand}>
        <Group justify="space-between" align="center" wrap="nowrap" gap="sm" w="100%">
          <Group gap={8} wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
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
            {summary?.currency || "INR"}
          </Badge>
        </Group>
        <Text size="xs" c="#64748B" mt={4}>
          Total {formatAmountCompact(summary?.total_outstanding)} ·{" "}
          {toNumber(summary?.open_invoices).toLocaleString("en-IN")} invoices
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
                <Text size="10px" fw={700} c="#16A34A" style={{ letterSpacing: "0.06em" }}>
                  CURRENT
                </Text>
                <Text fw={800} c="#16A34A" mt={2} style={{ fontSize: "30px", lineHeight: 1 }}>
                  {formatAmountCompact(metrics.currentAmount)}
                </Text>
                <Text size="xs" c="#16A34A" fw={600} mt={6}>
                  {formatPercent(metrics.currentPct)}
                </Text>
              </Box>
              <Box>
                <Text size="10px" fw={700} c="#EF4444" style={{ letterSpacing: "0.06em" }}>
                  OVERDUE
                </Text>
                <Text fw={800} c="#EF4444" mt={2} style={{ fontSize: "30px", lineHeight: 1 }}>
                  {formatAmountCompact(summary?.total_overdue)}
                </Text>
                <Text size="xs" c="#EF4444" fw={600} mt={6}>
                  {formatPercent(metrics.overduePct)}
                </Text>
              </Box>
              <Box>
                <Text size="10px" fw={700} c="#64748B" style={{ letterSpacing: "0.06em" }}>
                  90+ DAYS
                </Text>
                <Text fw={800} c="#0F172A" mt={2} style={{ fontSize: "30px", lineHeight: 1 }}>
                  {formatAmountCompact(summary?.["days_90+"])}
                </Text>
                <Text size="xs" c="#64748B" fw={600} mt={6}>
                  {toNumber(summary?.customer_count).toLocaleString("en-IN")} customers
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
                  <Text key={segment.label} size="10px" c="#94A3B8" fw={600}>
                    {segment.label}
                  </Text>
                ))}
              </Group>
            </Box>

            <Group justify="space-between" mt="auto" pt={14}>
              <Text size="11px" c="#64748B">
                As of {response?.as_of || "-"}
              </Text>
              <Text size="11px" c="#64748B" fw={600}>
                {toNumber(summary?.customer_count).toLocaleString("en-IN")} customers
              </Text>
            </Group>
          </>
        )}
      </Box>
    </Box>
  );
};

export default OutstandingVsOverdueCard;
