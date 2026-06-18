import type { OdexTimelineEvent } from "../types/odex";

export function humanizeOdexToken(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatOdexTimelineTitle(event: OdexTimelineEvent): string {
  if (event.step_name?.trim()) {
    return humanizeOdexToken(event.step_name.trim());
  }
  const type = String(event.event_type ?? event.type ?? "event");
  return humanizeOdexToken(type);
}

export function mapOdexTimelineEvent(
  raw: Record<string, unknown>,
): OdexTimelineEvent {
  const eventType = String(raw.event_type ?? raw.type ?? "event");
  const stepName =
    raw.step_name != null && String(raw.step_name).trim() !== ""
      ? String(raw.step_name)
      : null;
  const message =
    raw.message != null && String(raw.message).trim() !== ""
      ? String(raw.message)
      : null;
  const timestamp = String(
    raw.timestamp ?? raw.created_at ?? new Date().toISOString(),
  );

  return {
    id: raw.id != null ? Number(raw.id) : undefined,
    type: eventType,
    event_type: eventType,
    step_name: stepName,
    step_order: raw.step_order != null ? Number(raw.step_order) : null,
    status: raw.status != null ? String(raw.status) : null,
    log_level: raw.log_level != null ? String(raw.log_level) : null,
    message,
    created_at: timestamp,
  };
}

/** Timeline rows that belong in the milestone view (logs have their own tab). */
export function isOdexTimelineMilestone(event: OdexTimelineEvent): boolean {
  const type = String(event.event_type ?? event.type).toLowerCase();
  return type !== "log";
}

export function timelineEventColor(event: OdexTimelineEvent): string {
  const type = String(event.event_type ?? event.type).toLowerCase();
  const status = String(event.status ?? "").toLowerCase();

  if (type.includes("fail") || status === "failed") return "red";
  if (
    type.includes("complete") ||
    status === "completed" ||
    type === "job_completed"
  ) {
    return "green";
  }
  if (type.includes("start") || status === "running") return "blue";
  if (type === "job_created" || status === "queued") return "gray";
  return "blue";
}
