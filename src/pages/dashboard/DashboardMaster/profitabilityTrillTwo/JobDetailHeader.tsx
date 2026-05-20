import { Box, Flex, Text } from "@mantine/core";
import { branchChipDotColor } from "./normalize";
import { CARD_BG, INK, INK_3, INK_4, LINE } from "../profitabilityTrillOne/constants";
import type { JobProfitabilityDetail } from "./types";
import { profitabilityTrillFonts } from "../profitabilityTrillOne/utils";

const STATUS_STYLES: Record<string, { background: string; color: string }> = {
  invoiced: { background: "#e0e7ff", color: "#3730a3" },
  pending: { background: "#fef3c7", color: "#92400e" },
  transit: { background: "#e0f2fe", color: "#075985" },
  delivered: { background: "#dcfce7", color: "#166534" },
};

type JobDetailHeaderProps = {
  detail: JobProfitabilityDetail;
};

export function JobDetailHeader({ detail }: JobDetailHeaderProps) {
  const statusStyle = STATUS_STYLES[detail.status.toLowerCase()] ?? STATUS_STYLES.invoiced;

  return (
    <Box
      style={{
        background: CARD_BG,
        border: `1px solid ${LINE}`,
        borderRadius: 10,
        padding: 18,
        marginBottom: 14,
      }}
    >
      <Flex align="flex-start" gap={14} mb={14} wrap="wrap">
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Text
            fz={13}
            c={INK_3}
            style={{ fontFamily: profitabilityTrillFonts.mono, letterSpacing: "0.01em" }}
          >
            {detail.jobId}
          </Text>
          <Text
            mt={4}
            style={{
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              color: INK,
              lineHeight: 1.2,
            }}
          >
            {detail.customer}
          </Text>
          <Text fz={11} c={INK_4} mt={3}>
            {detail.lane} · {detail.segment}
          </Text>
        </Box>
        <Box
          component="span"
          style={{
            fontSize: 10,
            fontWeight: 600,
            padding: "3px 8px",
            borderRadius: 3,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            ...statusStyle,
          }}
        >
          {detail.statusLabel}
        </Box>
      </Flex>

      <Box
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 14,
        }}
      >
        {[
          {
            label: "Branch",
            value: (
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
                  color: INK,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  border: `1px solid ${LINE}`,
                }}
              >
                <Box
                  component="span"
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: branchChipDotColor(detail.branch.code),
                  }}
                />
                {detail.branch.label}
              </Box>
            ),
          },
          { label: "Salesperson", value: detail.salesperson },
          { label: "Delivered", value: detail.delivered, mono: true },
          { label: "Volume", value: detail.volume },
        ].map((cell) => (
          <Box key={cell.label}>
            <Text
              fz={10}
              c={INK_4}
              tt="uppercase"
              style={{ letterSpacing: "0.04em", fontWeight: 500 }}
            >
              {cell.label}
            </Text>
            {typeof cell.value === "string" ? (
              <Text
                fz={13}
                fw={500}
                c={INK}
                mt={2}
                style={cell.mono ? { fontFamily: profitabilityTrillFonts.mono } : undefined}
              >
                {cell.value}
              </Text>
            ) : (
              <Box mt={2}>{cell.value}</Box>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
