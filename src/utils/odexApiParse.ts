export function unwrapOdexResponse<T>(res: unknown): T {
  if (res == null) return res as T;
  const root = res as Record<string, unknown>;
  if (root.data !== undefined && root.data !== null) {
    const inner = root.data as Record<string, unknown>;
    if (Array.isArray(inner)) return inner as T;
    if (inner.data !== undefined) return inner.data as T;
    return root.data as T;
  }
  return res as T;
}

export function parseOdexListResponse(res: unknown): {
  results: unknown[];
  total: number;
} {
  const unwrapped = unwrapOdexResponse<unknown>(res);
  if (Array.isArray(unwrapped)) {
    return { results: unwrapped, total: unwrapped.length };
  }
  const obj = (unwrapped ?? {}) as Record<string, unknown>;
  const results = (obj.results ??
    obj.data ??
    obj.jobs ??
    []) as unknown[];
  const list = Array.isArray(results) ? results : [];
  const total =
    typeof obj.total === "number"
      ? obj.total
      : typeof obj.count === "number"
        ? obj.count
        : list.length;
  return { results: list, total };
}

export function normalizeOdexStatus(status: unknown): string {
  const s = String(status ?? "queued").trim().toLowerCase();
  if (s === "pending") return "queued";
  return s;
}

/** Extract list payloads from ODEX responses using `data` or `events`. */
export function unwrapOdexEventsArray(res: unknown): unknown[] {
  if (res == null) return [];
  if (Array.isArray(res)) return res;

  const root = res as Record<string, unknown>;
  if (Array.isArray(root.events)) return root.events;
  if (Array.isArray(root.data)) return root.data;

  if (root.data != null && typeof root.data === "object") {
    const inner = root.data as Record<string, unknown>;
    if (Array.isArray(inner.events)) return inner.events;
    if (Array.isArray(inner.data)) return inner.data;
  }

  return [];
}
