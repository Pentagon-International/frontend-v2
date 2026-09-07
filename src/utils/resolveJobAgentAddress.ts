/**
 * Resolve destination/origin agent address from job / MBL API payloads.
 * Prefer top-level agent_address (API save response) over nested origin_agent_data.
 */
export function resolveJobAgentAddress(
  source: Record<string, unknown> | null | undefined,
  fallbackSources: Array<Record<string, unknown> | null | undefined> = [],
): string {
  const candidates = [source, ...fallbackSources];
  for (const src of candidates) {
    if (!src) continue;
    const top = src.agent_address ?? src.origin_agent_address;
    if (top != null && String(top).trim() !== "") {
      return String(top);
    }
  }

  for (const src of candidates) {
    if (!src) continue;
    const nested = src.origin_agent_data;
    if (!nested || typeof nested !== "object" || Array.isArray(nested)) {
      continue;
    }
    const addressesData = (nested as Record<string, unknown>).addresses_data;
    if (!Array.isArray(addressesData) || addressesData.length === 0) continue;
    const first = addressesData[0] as { address?: unknown };
    if (first?.address != null && String(first.address).trim() !== "") {
      return String(first.address);
    }
  }

  return "";
}
