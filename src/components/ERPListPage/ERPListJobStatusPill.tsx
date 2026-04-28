import { Box } from "@mantine/core";

/** Status chip matching Air Export Booking `StatusPill` (dot + label) for Active / Closed / Cancel. */
export function ERPListJobStatusPill({ status }: { status: string | undefined | null }) {
  const u = (status || "").toUpperCase();
  const cfg =
    u === "CANCEL" || u.includes("CANCEL")
      ? { label: "Cancel", dot: "#ef4444", bg: "#fef2f2", color: "#b91c1c" }
      : u === "CLOSED"
        ? { label: "Closed", dot: "#3b82f6", bg: "#eff6ff", color: "#1d4ed8" }
        : { label: "Active", dot: "#10b981", bg: "#ecfdf5", color: "#047857" };

  return (
    <Box
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "2px 10px",
        borderRadius: 9999,
        backgroundColor: cfg.bg,
        color: cfg.color,
        fontSize: 12,
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}
    >
      <Box
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          backgroundColor: cfg.dot,
          flexShrink: 0,
        }}
      />
      {cfg.label}
    </Box>
  );
}
