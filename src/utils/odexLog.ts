import type { OdexLogLine } from "../types/odex";

export function mapOdexLogLine(raw: Record<string, unknown>): OdexLogLine {
  const message = String(
    raw.log_message ?? raw.message ?? "",
  ).trim();
  const levelRaw = raw.log_level ?? raw.level;
  const level =
    levelRaw != null && String(levelRaw).trim() !== ""
      ? String(levelRaw).trim()
      : null;

  return {
    id: raw.id != null ? Number(raw.id) : undefined,
    level,
    message,
    log_level: level,
    log_message: message,
    step_id: raw.step_id != null ? Number(raw.step_id) : null,
    created_at: raw.created_at ? String(raw.created_at) : null,
  };
}
