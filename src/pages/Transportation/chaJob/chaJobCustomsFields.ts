import dayjs from "dayjs";

export type ChaMasterCustomsFormValues = {
  boe_no: string;
  boe_date: Date | null;
  sb_no: string;
  sb_date: Date | null;
};

const CUSTOMS_PAYLOAD_KEYS = ["boe_no", "boe_date", "sb_no", "sb_date"] as const;

/** Dubai users see BOE Number when their is_default branch name contains Dubai. */
export function isDubaiBranchUser(
  user: {
    branches?: Array<{ is_default?: boolean; branch_name?: string | null }> | null;
  } | null | undefined,
): boolean {
  const branch = user?.branches?.find((item) => item.is_default === true);
  return String(branch?.branch_name ?? "").toUpperCase().includes("DUBAI");
}

export function dubaiBoeNumberPayload(
  boeNo: unknown,
): { boe_no: string | null } {
  const value = String(boeNo ?? "").trim();
  return { boe_no: value || null };
}

export function readBoeNumber(source: unknown): string {
  if (source == null || typeof source !== "object") return "";
  return String((source as { boe_no?: unknown }).boe_no ?? "");
}

/** Use the navigation snapshot when it already has boe_no. Otherwise use the job. */
export function readStoredBoeNumber(snapshot: unknown, job: unknown): string {
  if (
    snapshot != null &&
    typeof snapshot === "object" &&
    "boe_no" in snapshot
  ) {
    return readBoeNumber(snapshot);
  }
  return readBoeNumber(job);
}

export function emptyChaMasterCustoms(): ChaMasterCustomsFormValues {
  return {
    boe_no: "",
    boe_date: null,
    sb_no: "",
    sb_date: null,
  };
}

export function toChaFormDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : dayjs(value).startOf("day").toDate();
  }
  const parsed = dayjs(value as string | number);
  return parsed.isValid() ? parsed.startOf("day").toDate() : null;
}

export function formatChaJobDateForPayload(value: unknown): string | null {
  const parsed = toChaFormDate(value);
  return parsed ? dayjs(parsed).format("YYYY-MM-DD") : null;
}

/** CHA create defaults to today. Edit, view, and house round-trip keep the stored date. */
export function resolveChaJobDate(input: {
  mode: "create" | "edit" | "view";
  storedJobDate?: unknown;
}): Date | null {
  const stored = toChaFormDate(input.storedJobDate);
  if (input.mode === "create") {
    return stored ?? dayjs().startOf("day").toDate();
  }
  return stored;
}

export function readChaMasterCustoms(source: unknown): ChaMasterCustomsFormValues {
  const row =
    source != null && typeof source === "object"
      ? (source as Record<string, unknown>)
      : {};
  return {
    boe_no: String(row.boe_no ?? "").trim(),
    boe_date: toChaFormDate(row.boe_date),
    sb_no: String(row.sb_no ?? "").trim(),
    sb_date: toChaFormDate(row.sb_date),
  };
}

/** Only the pair for this CHA service type is sent. Freight payloads must not call this. */
export function pickChaMasterCustomsPayload(
  values: ChaMasterCustomsFormValues,
  serviceType: "Import" | "Export",
): Record<string, string | null> {
  if (serviceType === "Import") {
    return {
      boe_no: values.boe_no.trim() || null,
      boe_date: formatChaJobDateForPayload(values.boe_date),
    };
  }
  return {
    sb_no: values.sb_no.trim() || null,
    sb_date: formatChaJobDateForPayload(values.sb_date),
  };
}

export function pickChaCustomsFromAgentPayload(
  agentPayload: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of CUSTOMS_PAYLOAD_KEYS) {
    if (key in agentPayload) out[key] = agentPayload[key] ?? null;
  }
  return out;
}

export function firstChaHouseConsigneeName(row: {
  housing_details?: ReadonlyArray<{ consignee_name?: unknown }> | null;
}): string {
  const name = String(row.housing_details?.[0]?.consignee_name ?? "").trim();
  return name || "—";
}
