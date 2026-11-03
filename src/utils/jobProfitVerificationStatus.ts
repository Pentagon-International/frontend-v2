/** Normalize job profit verification status keys from filter/job-create. */
export function normalizeProfitVerificationStatus(
  status?: string | null,
): string {
  return String(status ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

const PROFIT_VERIFICATION_STATUS_LABELS: Record<string, string> = {
  sent_for_verification: "Sent for Verification",
  pending_for_verification: "Pending for Verification",
  pending: "Pending for Verification",
};

/** Filter values sent to `filter/job-create` as `verification_status`. */
export const PROFIT_VERIFICATION_STATUS_FILTER_OPTIONS = [
  {
    value: "sent_for_verification",
    label: PROFIT_VERIFICATION_STATUS_LABELS.sent_for_verification,
  },
  {
    value: "pending_for_verification",
    label: PROFIT_VERIFICATION_STATUS_LABELS.pending_for_verification,
  },
] as const;

/** Title-case labels for UI (handles underscore and spaced API variants). */
export function getProfitVerificationStatusLabel(
  status?: string | null,
): string {
  const raw = String(status ?? "").trim();
  if (!raw) return "";
  const key = normalizeProfitVerificationStatus(raw);
  if (PROFIT_VERIFICATION_STATUS_LABELS[key]) {
    return PROFIT_VERIFICATION_STATUS_LABELS[key];
  }
  // Fallback: title-case words from spaced/underscored raw value
  return raw
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
