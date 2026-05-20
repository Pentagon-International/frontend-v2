import { Box, Skeleton, Text } from "@mantine/core";
import { IconFileInvoice, IconPackage, IconReceipt, IconArrowsExchange } from "@tabler/icons-react";
import type { PendingActivityKpi } from "../financePendingActivitiesTypes";
import { formatAmountInCr } from "../../accountsDashboardNormalize";
import {
  PA_BAD,
  PA_CARD_BG,
  PA_INK,
  PA_INK_3,
  PA_INK_4,
  PA_KPI_ICON_BG,
  PA_KPI_STRIPE,
  PA_LINE,
  PA_WARN,
} from "../theme";

const ICONS = {
  invoices: IconFileInvoice,
  costs: IconPackage,
  vouchers: IconReceipt,
  credit_notes: IconArrowsExchange,
} as const;

type PendingActivityKpiCardProps = {
  kpi: PendingActivityKpi;
  loading?: boolean;
};

export function PendingActivityKpiCard({ kpi, loading }: PendingActivityKpiCardProps) {
  const Icon = ICONS[kpi.id];

  if (loading) {
    return (
      <Box
        style={{
          background: PA_CARD_BG,
          border: `1px solid ${PA_LINE}`,
          borderRadius: 10,
          padding: "14px 16px",
          minHeight: 130,
        }}
      >
        <Skeleton height={10} width="55%" mb={10} />
        <Skeleton height={28} width="70%" mb={8} />
        <Skeleton height={12} width="90%" />
      </Box>
    );
  }

  const highlightColor =
    kpi.highlightTone === "bad" ? PA_BAD : kpi.highlightTone === "warn" ? PA_WARN : PA_INK_4;

  return (
    <Box
      style={{
        background: PA_CARD_BG,
        border: `1px solid ${PA_LINE}`,
        borderRadius: 10,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <Box
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: PA_KPI_STRIPE[kpi.id],
        }}
      />
      <Box p="md" pt={14}>
        <Box style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
          <Box
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: PA_KPI_ICON_BG[kpi.id],
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Icon size={18} color={PA_KPI_STRIPE[kpi.id]} stroke={1.75} />
          </Box>
          <Box style={{ minWidth: 0 }}>
            <Text fz={12} fw={600} c={PA_INK} lineClamp={1}>
              {kpi.label}
            </Text>
            <Text fz={10.5} c={PA_INK_4} mt={2} lineClamp={2}>
              {kpi.subtitle}
            </Text>
          </Box>
        </Box>
        <Text
          style={{
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: "-0.02em",
            color: PA_INK,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <Text span c={PA_INK_3} fz={14} fw={500} mr={2}>
            ₹
          </Text>
          {kpi.amountDisplay ?? formatAmountInCr(kpi.amountCr)}
        </Text>
        <FlexMiniStats kpi={kpi} highlightColor={highlightColor} />
      </Box>
    </Box>
  );
}

function FlexMiniStats({
  kpi,
  highlightColor,
}: {
  kpi: PendingActivityKpi;
  highlightColor: string;
}) {
  return (
    <Box
      mt={10}
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "6px 14px",
        fontSize: 10.5,
        color: PA_INK_4,
      }}
    >
      <Text component="span" fz={10.5}>
        Count{" "}
        <Text component="span" fw={600} c={PA_INK}>
          {kpi.count}
        </Text>
      </Text>
      <Text component="span" fz={10.5}>
        Avg age{" "}
        <Text component="span" fw={600} c={PA_INK}>
          {kpi.avgAgeDays} d
        </Text>
      </Text>
      {kpi.highlightLabel && kpi.highlightValue !== undefined ? (
        <Text component="span" fz={10.5} c={highlightColor}>
          {kpi.highlightLabel}{" "}
          <Text component="span" fw={600}>
            {kpi.highlightValue}
          </Text>
        </Text>
      ) : null}
    </Box>
  );
}
