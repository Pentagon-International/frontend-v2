import { Box } from "@mantine/core";

type PillCfg = { label: string; dot: string; bg: string; color: string };

/** Status chip (dot + label): displays status as received from the API. */
export function ERPListJobStatusPill({ status }: { status: string | undefined | null }) {
  const label = String(status ?? "").trim() || "—";
  const u = label.toUpperCase();
  let cfg: PillCfg;
  if (u === "PENDING") {
    cfg = { label, dot: "#d97706", bg: "#fef3c7", color: "#b45309" };
  } else if (u === "GENERATED") {
    cfg = { label, dot: "#059669", bg: "#d1fae5", color: "#047857" };
  } else if (u === "INACTIVE") {
    cfg = { label, dot: "#6b7280", bg: "#f3f4f6", color: "#4b5563" };
  } else if (u === "CANCEL" || u.includes("CANCEL")) {
    cfg = { label, dot: "#ef4444", bg: "#fef2f2", color: "#b91c1c" };
  } else if (u === "CLOSED") {
    cfg = { label, dot: "#3b82f6", bg: "#eff6ff", color: "#1d4ed8" };
  } else {
    cfg = { label, dot: "#10b981", bg: "#ecfdf5", color: "#047857" };
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
