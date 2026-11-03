import { Box, Text } from "@mantine/core";
import {
  getProfitVerificationStatusLabel,
  normalizeProfitVerificationStatus,
} from "../../utils/jobProfitVerificationStatus";

type PillCfg = { label: string; dot: string; bg: string; color: string };

function resolvePillCfg(status?: string | null): PillCfg | null {
  const raw = String(status ?? "").trim();
  if (!raw) return null;
  const key = normalizeProfitVerificationStatus(raw);
  const label = getProfitVerificationStatusLabel(raw);
  if (key === "sent_for_verification") {
    return { label, dot: "#0ea5e9", bg: "#e0f2fe", color: "#0369a1" };
  }
  if (key === "pending_for_verification" || key === "pending") {
    return { label, dot: "#d97706", bg: "#fef3c7", color: "#b45309" };
  }
  return { label, dot: "#6b7280", bg: "#f3f4f6", color: "#4b5563" };
}

/** Status chip for profit verification workflow states. */
export function JobProfitVerificationStatusPill({
  status,
  emptyAsDash = false,
}: {
  status?: string | null;
  emptyAsDash?: boolean;
}) {
  const cfg = resolvePillCfg(status);
  if (!cfg) {
    if (!emptyAsDash) return null;
    return (
      <Text size="sm" c="dimmed">
        —
      </Text>
    );
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

type JobProfitVerificationStatusCellProps = {
  /** Job-level `verification_status` from filter/job-create. */
  verificationStatus?: string | null;
};

/** List-cell: job-level `verification_status` only (not house-level). */
export function JobProfitVerificationStatusCell({
  verificationStatus,
}: JobProfitVerificationStatusCellProps) {
  return (
    <JobProfitVerificationStatusPill
      status={verificationStatus}
      emptyAsDash
    />
  );
}
