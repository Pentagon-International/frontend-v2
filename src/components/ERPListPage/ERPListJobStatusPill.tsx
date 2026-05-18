import { Box } from "@mantine/core";

type PillCfg = { label: string; dot: string; bg: string; color: string };

/** Status chip (dot + label): job-generation (PENDING / GENERATED / INACTIVE) plus legacy Active / Closed / Cancel. */
export function ERPListJobStatusPill({ status }: { status: string | undefined | null }) {
  const u = (status || "").toUpperCase();
  let cfg: PillCfg;
  if (u === "PENDING") {
    cfg = { label: "Pending", dot: "#d97706", bg: "#fef3c7", color: "#b45309" };
  } else if (u === "GENERATED") {
    cfg = { label: "Generated", dot: "#059669", bg: "#d1fae5", color: "#047857" };
  } else if (u === "INACTIVE") {
    cfg = { label: "Inactive", dot: "#6b7280", bg: "#f3f4f6", color: "#4b5563" };
  } else if (u === "CANCEL" || u.includes("CANCEL")) {
    cfg = { label: "Cancel", dot: "#ef4444", bg: "#fef2f2", color: "#b91c1c" };
  } else if (u === "CLOSED") {
    cfg = { label: "Closed", dot: "#3b82f6", bg: "#eff6ff", color: "#1d4ed8" };
  } else {
    cfg = { label: "Active", dot: "#10b981", bg: "#ecfdf5", color: "#047857" };
  }

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
