import { Box, Text } from "@mantine/core";
import {
  getProfitStatusLabel,
  normalizeProfitStatus,
} from "../utils/jobProfitHouseVerification";

/** Same status pill styling as Job Profit Verification list. */
export function JobProfitStatusPill({
  status,
  emptyAsDash = false,
}: {
  status?: string | null;
  /** When true, empty status shows "—" (list table cells). Default: render nothing. */
  emptyAsDash?: boolean;
}) {
  const raw = String(status ?? "").trim();
  if (!raw) {
    if (!emptyAsDash) return null;
    return (
      <Text size="sm" c="dimmed">
        —
      </Text>
    );
  }

  const key = normalizeProfitStatus(raw);
  const label = getProfitStatusLabel(raw);
  const cfg =
    key === "pending"
      ? { dot: "#f59e0b", bg: "#fffbeb", color: "#b45309" } // amber/orange
      : key === "sent_to_accounts"
        ? { dot: "#0ea5e9", bg: "#e0f2fe", color: "#0369a1" } // sky
        : key === "accounts_verified"
          ? { dot: "#0891b2", bg: "#cffafe", color: "#0e7490" } // cyan
          : key === "sent_to_verify"
            ? { dot: "#d97706", bg: "#fef3c7", color: "#b45309" } // amber
            : key === "verified"
              ? { dot: "#3b82f6", bg: "#eff6ff", color: "#1d4ed8" } // blue
              : key === "confirmed"
                ? { dot: "#10b981", bg: "#ecfdf5", color: "#047857" } // green
                : key === "hold"
                  ? { dot: "#7c3aed", bg: "#f5f3ff", color: "#6d28d9" } // violet
                  : key === "approved" || key === "hold_confirmed"
                    ? { dot: "#4f46e5", bg: "#eef2ff", color: "#3730a3" } // indigo
                    : key === "rejected" || key === "hold_rejected"
                      ? { dot: "#dc2626", bg: "#fef2f2", color: "#b91c1c" } // red
                      : { dot: "#6b7280", bg: "#f3f4f6", color: "#4b5563" }; // gray

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
      {label}
    </Box>
  );
}
