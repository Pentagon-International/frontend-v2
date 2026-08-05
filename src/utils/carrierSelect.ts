/** Shared helpers so carrier SearchableSelect matches origin/destination: `name (code)`. */

export const CARRIER_SEARCH_FIELDS = ["carrier_code", "carrier_name"] as const;

export type CarrierTransportMode = "SEA" | "AIR" | "LAND";

export function carrierDisplayFormat(item: Record<string, unknown>): {
  value: string;
  label: string;
} {
  const code = String(item.carrier_code ?? "");
  const name = String(item.carrier_name ?? code);
  return {
    value: code,
    label: code ? `${name} (${code})` : name,
  };
}

/** For filters that store carrier_name as the select value. */
export function carrierNameValueDisplayFormat(item: Record<string, unknown>): {
  value: string;
  label: string;
} {
  const code = String(item.carrier_code ?? "");
  const name = String(item.carrier_name ?? code);
  return {
    value: name,
    label: code ? `${name} (${code})` : name,
  };
}

/** Parse carrier_name from a `name (code)` label (same split as port fields). */
export function parseCarrierNameFromLabel(label: string): string {
  return label.split(" (")[0] || "";
}

/** Build the controlled display string for an already-selected carrier. */
export function formatCarrierDisplayValue(
  name?: string | null,
  code?: string | null,
): string | null {
  if (name && code) {
    if (name.includes(`(${code})`)) return name;
    return `${name} (${code})`;
  }
  return name || code || null;
}

/** Map FCL/LCL/AIR service to carrier master `transport_mode`. */
export function transportModeFromService(
  service?: string | null,
): "SEA" | "AIR" | undefined {
  const s = String(service ?? "")
    .trim()
    .toUpperCase();
  if (s === "FCL" || s === "LCL") return "SEA";
  if (s === "AIR") return "AIR";
  return undefined;
}

export function carrierTransportParamsFromService(
  service?: string | null,
): { transport_mode: "SEA" | "AIR" } | undefined {
  const mode = transportModeFromService(service);
  return mode ? { transport_mode: mode } : undefined;
}

/** Map routing move_type / transport_type to carrier master `transport_mode`. */
export function transportModeFromMoveType(
  moveType?: string | null,
): CarrierTransportMode | undefined {
  if (!moveType) return undefined;
  const t = moveType.trim().toUpperCase();
  if (t === "AIR") return "AIR";
  if (t === "SEA" || t === "FCL" || t === "LCL" || t === "VESSEL") return "SEA";
  if (t === "ROAD" || t === "RAIL" || t === "LAND") return "LAND";
  return undefined;
}

export function carrierTransportParamsFromMoveType(
  moveType?: string | null,
): { transport_mode: CarrierTransportMode } | undefined {
  const mode = transportModeFromMoveType(moveType);
  return mode ? { transport_mode: mode } : undefined;
}
