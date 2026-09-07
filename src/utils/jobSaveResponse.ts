/**
 * Create/update job API body after axios unwraps `response.data`.
 * Shape: { status, message, data: { id, housing_details, ... } }
 */
export type JobSaveApiResponse = {
  status?: boolean;
  message?: string;
  data?: Record<string, unknown> | null;
};

export function parseJobSaveResponse(
  response: unknown,
  fallbackMessage = "Job saved successfully",
): {
  message: string;
  job: Record<string, unknown> | null;
} {
  const body = (response ?? {}) as JobSaveApiResponse;
  const raw = body.data;
  const job =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : null;
  const message =
    typeof body.message === "string" && body.message.trim()
      ? body.message.trim()
      : fallbackMessage;
  return { message, job };
}

/** Prefer API job id; fall back to known id when response omits nested data. */
export function resolveSavedJobId(
  job: Record<string, unknown> | null,
  fallbackId?: unknown,
): number | null {
  const fromJob = job?.id;
  const raw = fromJob ?? fallbackId;
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}
