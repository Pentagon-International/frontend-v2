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

export function odexTimelineEventKey(event: OdexTimelineEvent): string {
  if (event.id != null) return `id:${event.id}`;
  const type = String(event.event_type ?? event.type ?? "");
  const step = event.step_name ?? "";
  const order =
    event.step_order != null ? String(event.step_order) : "";
  return `${type}|${step}|${order}|${event.created_at}`;
}

export function isDuplicateOdexTimelineEvent(
  events: OdexTimelineEvent[],
  event: OdexTimelineEvent,
): boolean {
  const key = odexTimelineEventKey(event);
  return events.some((existing) => odexTimelineEventKey(existing) === key);
}

export function dedupeOdexTimelineEvents(
  events: OdexTimelineEvent[],
): OdexTimelineEvent[] {
  const seen = new Set<string>();
  return events.filter((event) => {
    const key = odexTimelineEventKey(event);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Extract a timeline payload from a WebSocket message envelope. */
export function extractOdexWsTimelinePayload(
  wsRaw: Record<string, unknown>,
): Record<string, unknown> | null {
  if (
    wsRaw.timeline_event != null &&
    typeof wsRaw.timeline_event === "object"
  ) {
    return wsRaw.timeline_event as Record<string, unknown>;
  }
  if (wsRaw.event_type != null) {
    return wsRaw;
  }
  return null;
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
