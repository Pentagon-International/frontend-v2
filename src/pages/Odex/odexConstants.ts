import type { OdexJobStatus } from "../../types/odex";

export const ODEX_JOB_TYPES = [
  { value: "HBL_REQUEST", label: "HBL Request" },
] as const;

export const ODEX_STATUS_FILTER_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "queued", label: "Queued" },
  { value: "running", label: "Running" },
  { value: "waiting_captcha", label: "Waiting Captcha" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
];

export const ODEX_STATUS_COLORS: Record<string, string> = {
  queued: "gray",
  pending: "gray",
  running: "blue",
  waiting_captcha: "orange",
  completed: "green",
  failed: "red",
  cancelled: "gray",
};

export const ODEX_STATUS_LABELS: Record<string, string> = {
  queued: "Queued",
  pending: "Queued",
  running: "Running",
  waiting_captcha: "Waiting Captcha",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

export function getOdexStatusColor(status: OdexJobStatus | string): string {
  const key = String(status ?? "queued").toLowerCase();
  return ODEX_STATUS_COLORS[key] ?? "gray";
}

export function getOdexStatusLabel(status: OdexJobStatus | string): string {
  const key = String(status ?? "queued").toLowerCase();
  return ODEX_STATUS_LABELS[key] ?? key;
}
