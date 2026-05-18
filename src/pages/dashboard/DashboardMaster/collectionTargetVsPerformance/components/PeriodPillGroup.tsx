import { Box, Button } from "@mantine/core";

export type PeriodGranularity = "month" | "quarter" | "h1h2" | "fy";

const PERIOD_PILLS: { value: PeriodGranularity; label: string }[] = [
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
  { value: "h1h2", label: "H1/H2" },
  { value: "fy", label: "FY" },
];

type PeriodPillGroupProps = {
  value: PeriodGranularity;
  onChange: (value: PeriodGranularity) => void;
};

export function PeriodPillGroup({ value, onChange }: PeriodPillGroupProps) {
  return (
    <Box
      style={{
        display: "inline-flex",
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: 6,
        padding: 2,
        gap: 1,
      }}
    >
      {PERIOD_PILLS.map((pill) => (
        <Button
          key={pill.value}
          size="compact-xs"
          variant="subtle"
          onClick={() => onChange(pill.value)}
          styles={{
            root: {
              height: 28,
              padding: "0 11px",
              fontSize: 11.5,
              fontWeight: value === pill.value ? 600 : 500,
              color: value === pill.value ? "#0f2744" : "#64748b",
              background: value === pill.value ? "#ffffff" : "transparent",
              boxShadow:
                value === pill.value ? "0 1px 2px rgba(15,23,42,0.06)" : "none",
            },
          }}
        >
          {pill.label}
        </Button>
      ))}
    </Box>
  );
}
