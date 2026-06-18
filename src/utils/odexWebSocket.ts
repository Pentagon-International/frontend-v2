import { URL } from "../api/serverUrls";

export function buildOdexJobWebSocketUrl(jobId: string | number): string {
  const apiBase = String(URL.base ?? "").trim();
  const apiOrigin = apiBase
    ? new globalThis.URL(apiBase, window.location.origin).origin
    : window.location.origin;
  const wsProtocol = apiOrigin.startsWith("https") ? "wss" : "ws";
  const wsHost = apiOrigin.replace(/^https?:\/\//, "");
  return `${wsProtocol}://${wsHost}/ws/odex/job/${jobId}/`;
}

export function isOdexActiveStatus(status: string | null | undefined): boolean {
  const s = String(status ?? "").toLowerCase();
  return (
    s === "queued" ||
    s === "pending" ||
    s === "running" ||
    s === "waiting_captcha"
  );
}

export function isOdexTerminalStatus(status: string | null | undefined): boolean {
  const s = String(status ?? "").toLowerCase();
  return s === "completed" || s === "failed" || s === "cancelled";
}
