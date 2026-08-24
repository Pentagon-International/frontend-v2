export type ShipmentPartyAddressOption = {
  value: string;
  label: string;
  email: string;
};

type ShipmentPartyRow = Record<string, unknown>;

export function shipmentPartyAddressesMatch(a?: string, b?: string): boolean {
  return (
    String(a || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase() ===
    String(b || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
  );
}

export function shipmentPartyAddressMatchesSearch(
  options: Array<{ value: string; label: string }>,
  search: string,
): boolean {
  const trimmed = search.trim();
  if (!trimmed) return false;
  return options.some(
    (item) =>
      shipmentPartyAddressesMatch(item.label, trimmed) ||
      shipmentPartyAddressesMatch(item.value, trimmed),
  );
}

export function shouldUseCustomShipmentPartyAddress(
  custom: boolean,
  address: string,
  options: Array<{ value: string; label: string }>,
): boolean {
  return (
    custom ||
    options.length === 0 ||
    (!!address &&
      !options.some((item) =>
        shipmentPartyAddressesMatch(item.value, address),
      ))
  );
}

function readAddresses(
  original: ShipmentPartyRow | null | undefined,
): Array<Record<string, unknown>> {
  const raw =
    original?.addresses_data ?? original?.addresses ?? original?.address_data;
  return Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : [];
}

export function mapShipmentPartyAddressOptions(
  original: ShipmentPartyRow | null | undefined,
  formatAddress: (address: string) => string = (value) => value,
): ShipmentPartyAddressOption[] {
  const seen = new Set<string>();
  const options: ShipmentPartyAddressOption[] = [];
  for (const item of readAddresses(original)) {
    const rawAddress = String(item.address ?? item.address1 ?? "").trim();
    if (!rawAddress) continue;
    const address = formatAddress(rawAddress);
    const key = address.replace(/\s+/g, " ").trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    options.push({
      value: address,
      label: address,
      email: String(item.email ?? ""),
    });
  }
  return options;
}

export function mapShipmentPartySearchResults(
  results: unknown,
): {
  options: Array<{ value: string; label: string }>;
  map: Record<string, ShipmentPartyRow>;
} {
  const arr = Array.isArray(results) ? (results as ShipmentPartyRow[]) : [];
  const byName = new Map<string, { id: string; item: ShipmentPartyRow }>();

  for (const item of arr) {
    const name = String(item.customer_name ?? "").trim();
    if (!name) continue;
    const nameKey = name.toLowerCase();
    const id = String(item.id ?? nameKey);
    const existing = byName.get(nameKey);
    if (!existing) {
      byName.set(nameKey, {
        id,
        item: { ...item, addresses_data: readAddresses(item) },
      });
      continue;
    }
    existing.item = {
      ...existing.item,
      addresses_data: [
        ...readAddresses(existing.item),
        ...readAddresses(item),
      ],
    };
  }

  const options: Array<{ value: string; label: string }> = [];
  const map: Record<string, ShipmentPartyRow> = {};
  for (const { id, item } of byName.values()) {
    map[id] = item;
    options.push({
      value: id,
      label: String(item.customer_name ?? ""),
    });
  }
  return { options, map };
}
