import { getAPICall } from "../service/getApiCall";
import { API_HEADER } from "../store/storeKeys";

export type EditPageAuditInfo = {
  created_by: string | null;
  created_at: string | null;
  updated_by: string | null;
  updated_at: string | null;
};

const pickAuditValue = (
  source: Record<string, unknown>,
  ...keys: string[]
): string | null => {
  for (const key of keys) {
    const value = source[key];
    if (value == null) continue;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
      continue;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return null;
};

/** Merge record payloads so list/detail audit fields survive partial saveResponse state. */
export const mergeEditPageAuditSources = (
  ...sources: Array<Record<string, unknown> | null | undefined>
): Record<string, unknown> | null => {
  const merged = sources.reduce<Record<string, unknown>>((acc, source) => {
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      return acc;
    }
    return { ...acc, ...source };
  }, {});

  return Object.keys(merged).length > 0 ? merged : null;
};

/** Merge save/update API payload into a running audit patch (response already unwrapped). */
export const appendEditPageAuditPatch = (
  prev: Record<string, unknown> | null | undefined,
  response: unknown,
): Record<string, unknown> | null => {
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    return prev ?? null;
  }
  return mergeEditPageAuditSources(prev, response as Record<string, unknown>);
};

export const normalizeEditPageAuditInfo = (
  source: Record<string, unknown> | null | undefined,
): EditPageAuditInfo | null => {
  if (!source) return null;

  return {
    created_by: pickAuditValue(
      source,
      "created_by_name",
      "created_by",
      "sales_person",
    ),
    created_at: pickAuditValue(source, "created_at", "created_date"),
    updated_by: pickAuditValue(source, "updated_by_name", "updated_by"),
    updated_at: pickAuditValue(source, "updated_at", "updated_date"),
  };
};

export const hasEditPageUpdatedInfo = (
  auditInfo: EditPageAuditInfo | null | undefined,
): boolean =>
  Boolean(auditInfo?.updated_by?.trim() || auditInfo?.updated_at?.trim());

export const EDIT_PAGE_AUDIT_SIDEBAR_Z_INDEX = {
  default: 2,
  hovered: 1100,
} as const;

export const EDIT_PAGE_AUDIT_TOOLTIP_Z_INDEX = 10000;

/** Unwrap axios / nested API payloads for audit field extraction. */
export const unwrapApiRecord = (
  response: unknown,
): Record<string, unknown> | null => {
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    return null;
  }
  const obj = response as Record<string, unknown>;
  if ("data" in obj) {
    const data = obj.data;
    if (data && typeof data === "object" && !Array.isArray(data)) {
      const inner = data as Record<string, unknown>;
      if (
        "data" in inner &&
        inner.data &&
        typeof inner.data === "object" &&
        !Array.isArray(inner.data)
      ) {
        return inner.data as Record<string, unknown>;
      }
      return inner;
    }
  }
  return obj;
};

/** Fetch a single master record by id for audit fields (GET {baseUrl}{id}/). */
export const fetchMasterRecordById = async (
  baseUrl: string,
  id: number,
): Promise<Record<string, unknown> | null> => {
  const response = await getAPICall(`${baseUrl}${id}/`, API_HEADER);
  return unwrapApiRecord(response);
};
