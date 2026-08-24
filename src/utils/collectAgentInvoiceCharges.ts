/** Charges on a housing row may be `charges` (air/sea) or `mawb_charges` (air import). */
export function getHousingChargeArray(
  hawb: Record<string, unknown>,
): Record<string, unknown>[] {
  const ch = hawb.charges;
  if (Array.isArray(ch) && ch.length > 0)
    return ch as Record<string, unknown>[];
  const mc = hawb.mawb_charges;
  if (Array.isArray(mc) && mc.length > 0)
    return mc as Record<string, unknown>[];
  return [];
}

export function isCollectChargeRow(c: Record<string, unknown>): boolean {
  const pp = String(c.pp_cc ?? "")
    .trim()
    .toUpperCase();
  return pp === "COLLECT" || pp === "CC";
}

/** Collect charges from the given housings (one house or every house on the job). */
export function collectAgentChargesFromHousings(
  housings: Array<Record<string, unknown>>,
): Record<string, unknown>[] {
  return housings.flatMap((hawb) =>
    getHousingChargeArray(hawb)
      .filter(isCollectChargeRow)
      .map((c) => ({
        ...c,
        shipment_id: String(
          c.shipment_id ?? hawb.shipment_id ?? hawb.shipment_no ?? "",
        ).trim(),
        shipper_id: String(
          c.shipper_id ?? hawb.shipper_code ?? hawb.shipper_id ?? "",
        ).trim(),
      })),
  );
}

/**
 * House-level agent invoice: only the opened house.
 * Master/job-level agent invoice: Collect charges from every house.
 */
export function resolveAgentInvoiceCollectCharges(options: {
  fromHouseLevel: boolean;
  navHouses: Array<Record<string, unknown>>;
  jobHouses: Array<Record<string, unknown>>;
}): Record<string, unknown>[] {
  const { fromHouseLevel, navHouses, jobHouses } = options;

  const houseKey = (h: Record<string, unknown>) =>
    String(h.shipment_id ?? h.shipment_no ?? h.id ?? "").trim();

  if (fromHouseLevel) {
    let merged = collectAgentChargesFromHousings(navHouses);
    if (merged.length === 0 && navHouses[0]) {
      const premerged = getHousingChargeArray(navHouses[0]).filter(
        isCollectChargeRow,
      );
      if (premerged.length > 0) return premerged;
    }
    if (merged.length > 0) return merged;

    const openedKey = navHouses[0] ? houseKey(navHouses[0]) : "";
    if (openedKey) {
      const matchingJobHouses = jobHouses.filter(
        (h) => houseKey(h) === openedKey,
      );
      if (matchingJobHouses.length > 0) {
        return collectAgentChargesFromHousings(matchingJobHouses);
      }
    }
    return merged;
  }

  const fromJob = collectAgentChargesFromHousings(jobHouses);
  const fromNav = collectAgentChargesFromHousings(navHouses);
  if (fromJob.length >= fromNav.length && fromJob.length > 0) return fromJob;
  if (fromNav.length > 0) return fromNav;
  if (navHouses[0]) {
    const premerged = getHousingChargeArray(navHouses[0]).filter(
      isCollectChargeRow,
    );
    if (premerged.length > 0) return premerged;
  }
  return fromJob;
}
