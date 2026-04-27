import {
  IconBook2,
  IconMapPin,
  IconPackage,
  IconPlaneArrival,
  IconPlaneDeparture,
  IconTruckDelivery,
} from "@tabler/icons-react";
import dayjs from "dayjs";

/** Row shape required for export-style milestone derivation (air; reused as best-effort for sea). */
export type BookingMilestoneRow = {
  status?: string | null;
  events?: Array<Record<string, unknown>> | null;
  actual_delivery_date?: string | null;
  ata?: string | null;
  atd?: string | null;
  etd?: string | null;
  eta?: string | null;
  actual_pickup_date?: string | null;
  mawb_no?: string | null;
  carrier_booking_no?: string | null;
  origin_name?: string | null;
  origin_code_read?: string | null;
  origin_code?: string | null;
  destination_name?: string | null;
  destination_code_read?: string | null;
  destination_code?: string | null;
  date?: string | null;
  /** API milestone code (e.g. BOOKED, PICKED_UP) — drives table icon/accent and labels when present. */
  last_milestone?: string | null;
  last_milestone_date?: string | null;
  last_milestone_time?: string | null;
  /** Ordered steps for list/drawer when provided by `customerServiceShipmentFilter`. */
  route_milestones?: Array<{
    code: string;
    label: string;
    date?: string | null;
    time?: string | null;
    active?: boolean;
    note?: string;
    source?: unknown;
  }>;
};

export const BOOKING_EXPORT_MILESTONES = [
  { label: "Booked", Icon: IconBook2, accent: "#4f46e5", soft: "#eef2ff" },
  { label: "Picked up", Icon: IconTruckDelivery, accent: "#0284c7", soft: "#e0f2fe" },
  { label: "Received", Icon: IconPackage, accent: "#7c3aed", soft: "#f3e8ff" },
  { label: "Departure", Icon: IconPlaneDeparture, accent: "#0891b2", soft: "#ecfeff" },
  { label: "Arrived", Icon: IconPlaneArrival, accent: "#059669", soft: "#ecfdf5" },
  { label: "Delivered", Icon: IconMapPin, accent: "#16a34a", soft: "#f0fdf4" },
] as const;

export type MilestonePhase = "completed" | "current" | "upcoming";

export function milestonePhase(i: number, activeIdx: number): MilestonePhase {
  if (i < activeIdx) return "completed";
  if (i === activeIdx) return "current";
  return "upcoming";
}

export function rgbaFromHex(hex: string, a: number): string {
  const x = hex.replace("#", "");
  const v = x.length === 3 ? x.split("").map((c) => c + c).join("") : x;
  const r = Number.parseInt(v.slice(0, 2), 16);
  const g = Number.parseInt(v.slice(2, 4), 16);
  const b = Number.parseInt(v.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function mapEventStringToMilestoneIndex(s: string): number | null {
  const u = s.toUpperCase();
  if (/\bDELIVER|HANDOVER|\bPOD\b|PROOF\s+OF\s+DELIVERY/.test(u)) return 5;
  if (/\bARRIV|\bATA\b|\bLAND(ED|ING)?\b/.test(u)) return 4;
  if (/\bDEPART|\bATD\b|TAKE[\s-]?OFF|AIRBORNE|EXPORT\s+FLIGHT|FLIGHT\s+DEP|VESSEL\s+DEP|SAILED/.test(u))
    return 3;
  if (/\bRECEIV|GATE\s+IN|TERMINAL|WAREHOUSE\s+IN|ACCEPTANCE/.test(u)) return 2;
  if (/\bPICK|COLLECT|COLLECTION|CARGO\s+READY|GATE\s+OUT/.test(u)) return 1;
  if (/\bBOOK|CONFIRM|BOOKING/.test(u)) return 0;
  return null;
}

function getMaxMilestoneIndexFromEvents(events: BookingMilestoneRow["events"]): number | null {
  if (!Array.isArray(events) || events.length === 0) return null;
  let max = -1;
  for (const e of events) {
    const rec = e as { type?: string; event_type?: string; name?: string };
    const t = String(rec.type ?? rec.event_type ?? rec.name ?? "").trim();
    if (!t) continue;
    const idx = mapEventStringToMilestoneIndex(t);
    if (idx != null && idx > max) max = idx;
  }
  return max >= 0 ? max : null;
}

function hasTruthyDate(value: string | null | undefined): boolean {
  if (value == null) return false;
  const s = String(value).trim();
  return s.length > 0 && s !== "null";
}

function normalizeMilestoneCodeForMatch(code: string | null | undefined): string {
  if (code == null) return "";
  return String(code).toUpperCase().replace(/\s+/g, "_");
}

/** Match `last_milestone` to `route_milestones[]` (case / spacing safe). */
function findRouteMilestoneByCode(
  steps: NonNullable<BookingMilestoneRow["route_milestones"]> | undefined,
  code: string | null | undefined,
) {
  if (!steps?.length || !code) return undefined;
  const n = normalizeMilestoneCodeForMatch(code);
  return steps.find((m) => normalizeMilestoneCodeForMatch(m.code) === n);
}

/** Map API `last_milestone` / `route_milestones[].code` to `BOOKING_EXPORT_MILESTONES` index. */
export function mapMilestoneCodeToIndex(code: string | null | undefined): number {
  if (!code) return 0;
  const c = String(code).toUpperCase().replace(/\s+/g, "_");
  const m: Record<string, number> = {
    BOOKED: 0,
    PICKED_UP: 1,
    PICKEDUP: 1,
    RECEIVED: 2,
    DEPARTURE: 3,
    ARRIVED: 4,
    DELIVERED: 5,
  };
  return m[c] ?? 0;
}

export function getBookingMilestoneStyleByIndex(
  i: number,
): (typeof BOOKING_EXPORT_MILESTONES)[number] {
  return BOOKING_EXPORT_MILESTONES[Math.min(Math.max(i, 0), BOOKING_EXPORT_MILESTONES.length - 1)];
}

/** `when` for one API route milestone (date + optional time). */
export function formatRouteMilestoneWhen(m: { date?: string | null; time?: string | null }): string {
  if (!hasTruthyDate(m.date)) return "—";
  const dayPart = String(m.date).split("T")[0];
  const d = dayjs(dayPart);
  if (!d.isValid()) return "—";
  if (m.time && String(m.time).trim()) {
    const parts = String(m.time).split(":");
    const hh = parseInt(parts[0] ?? "0", 10);
    const mm = parseInt(parts[1] ?? "0", 10);
    if (Number.isFinite(hh) && Number.isFinite(mm)) {
      return d.hour(hh).minute(mm).second(0).format("DD MMM, HH:mm");
    }
  }
  return d.format("DD MMM, HH:mm");
}

/** Table “Last milestone” time from `last_milestone_date` + `last_milestone_time`. */
function formatLastMilestoneApiDateTime(row: BookingMilestoneRow): string {
  if (!hasTruthyDate(row.last_milestone_date)) return "—";
  const dayPart = String(row.last_milestone_date).split("T")[0];
  const d = dayjs(dayPart);
  if (!d.isValid()) return "—";
  if (row.last_milestone_time && String(row.last_milestone_time).trim()) {
    const parts = String(row.last_milestone_time).split(":");
    const hh = parseInt(parts[0] ?? "0", 10);
    const mm = parseInt(parts[1] ?? "0", 10);
    if (Number.isFinite(hh) && Number.isFinite(mm)) {
      return d.hour(hh).minute(mm).second(0).format("DD MMM, HH:mm");
    }
  }
  return d.format("DD MMM, HH:mm");
}

export function getRouteMilestonesActiveIndex(
  steps: NonNullable<BookingMilestoneRow["route_milestones"]>,
  row: BookingMilestoneRow,
): number {
  const byActive = steps.findIndex((m) => m.active);
  if (byActive >= 0) return byActive;
  if (row.last_milestone) {
    const n = normalizeMilestoneCodeForMatch(row.last_milestone);
    const byCode = steps.findIndex(
      (m) => normalizeMilestoneCodeForMatch(m.code) === n,
    );
    if (byCode >= 0) return byCode;
  }
  return Math.max(0, steps.length - 1);
}

export function normalizeBookingStatus(s: string | undefined | null): string {
  const u = (s || "").toUpperCase();
  if (u.includes("CANCEL")) return "CANCEL";
  if (u === "BOOKED") return "BOOKED";
  if (u === "RECEIVED") return "RECEIVED";
  return u || "GENERATED";
}

export function getLastMilestoneIndex(row: BookingMilestoneRow): number {
  if (row.last_milestone) {
    return mapMilestoneCodeToIndex(row.last_milestone);
  }

  const st = normalizeBookingStatus(row.status);
  const raw = (row.status || "").toUpperCase();
  if (st === "CANCEL" || raw.includes("CANCEL")) return 0;

  let idx = -1;

  const fromEvents = getMaxMilestoneIndexFromEvents(row.events ?? null);
  if (fromEvents != null) idx = Math.max(idx, fromEvents);

  if (raw.includes("DELIVER")) idx = Math.max(idx, 5);
  if (hasTruthyDate(row.actual_delivery_date)) idx = Math.max(idx, 5);

  if (row.ata?.trim()) idx = Math.max(idx, 4);

  if (row.atd?.trim()) idx = Math.max(idx, 3);
  if (/\b(DEPART|DEPARTED|DISPATCH|DISPATCHED|IN\s*TRANSIT|EXPORTED|FLT\s*DEP)\b/i.test(raw)) {
    idx = Math.max(idx, 3);
  }

  if (st === "RECEIVED") idx = Math.max(idx, 2);

  if (/\b(PICK\s*UP|PICKUP|PICKED\s*UP|GATE\s*OUT|COLLECTED)\b/i.test(raw)) {
    idx = Math.max(idx, 1);
  }
  if (hasTruthyDate(row.actual_pickup_date)) idx = Math.max(idx, 1);

  if (st === "BOOKED" && (row.mawb_no?.trim() || row.carrier_booking_no?.trim())) {
    idx = Math.max(idx, 1);
  }

  if (st === "BOOKED") idx = Math.max(idx, 0);
  if (st === "GENERATED") idx = Math.max(idx, 0);

  if (idx < 0) idx = 0;
  return Math.min(idx, 5);
}

function getLastMilestoneLabelFromComputed(row: BookingMilestoneRow): string {
  return getBookingMilestoneStyleByIndex(getLastMilestoneIndex(row)).label;
}

/**
 * Primary line for “Last Milestone” cell: `route_milestones[].label` for `last_milestone` code, else
 * label from code mapping, else computed from status/dates.
 */
export function getLastMilestoneDisplayLabel(row: BookingMilestoneRow): string {
  if (row.last_milestone) {
    const m = findRouteMilestoneByCode(row.route_milestones, row.last_milestone);
    if (m?.label) return m.label;
    return getBookingMilestoneStyleByIndex(mapMilestoneCodeToIndex(row.last_milestone)).label;
  }
  return getLastMilestoneLabelFromComputed(row);
}

export function getLastMilestoneStep(
  row: BookingMilestoneRow,
): (typeof BOOKING_EXPORT_MILESTONES)[number] {
  if (row.last_milestone) {
    return getBookingMilestoneStyleByIndex(mapMilestoneCodeToIndex(row.last_milestone));
  }
  return getBookingMilestoneStyleByIndex(getLastMilestoneIndex(row));
}

export function getMilestoneDrawerDetail(
  row: BookingMilestoneRow,
  index: number,
): { detail: string; when: string } {
  const oc = row.origin_name || row.origin_code_read || row.origin_code || "Origin";
  const dc =
    row.destination_name || row.destination_code_read || row.destination_code || "Destination";
  switch (index) {
    case 0:
      return {
        detail: "Booking confirmed",
        when:
          row.date && dayjs(row.date).isValid()
            ? dayjs(row.date).format("DD MMM, HH:mm")
            : "—",
      };
    case 1:
      return {
        detail: `${oc} — cargo / docs ready`,
        when: hasTruthyDate(row.actual_pickup_date)
          ? dayjs(String(row.actual_pickup_date)).isValid()
            ? dayjs(String(row.actual_pickup_date)).format("DD MMM, HH:mm")
            : String(row.actual_pickup_date)
          : "—",
      };
    case 2:
      return { detail: "Received at export facility / terminal", when: "—" };
    case 3:
      return {
        detail: String(oc),
        when: row.atd?.trim()
          ? dayjs(row.atd).isValid()
            ? dayjs(row.atd).format("DD MMM, HH:mm")
            : row.atd
          : row.etd?.trim()
            ? dayjs(row.etd).isValid()
              ? `Est. ${dayjs(row.etd).format("DD MMM, HH:mm")}`
              : `Est. ${row.etd}`
            : "—",
      };
    case 4:
      return {
        detail: String(dc),
        when: row.ata?.trim()
          ? dayjs(row.ata).isValid()
            ? dayjs(row.ata).format("DD MMM, HH:mm")
            : row.ata
          : row.eta?.trim()
            ? dayjs(row.eta).isValid()
              ? `Est. ${dayjs(row.eta).format("DD MMM, HH:mm")}`
              : `Est. ${row.eta}`
            : "—",
      };
    case 5:
      return {
        detail: String(dc),
        when: hasTruthyDate(row.actual_delivery_date)
          ? dayjs(String(row.actual_delivery_date)).isValid()
            ? dayjs(String(row.actual_delivery_date)).format("DD MMM, HH:mm")
            : String(row.actual_delivery_date)
          : "—",
      };
    default:
      return { detail: "", when: "—" };
  }
}

function getLastMilestoneWhenFromComputed(row: BookingMilestoneRow): string {
  const i = getLastMilestoneIndex(row);
  const idx = Math.min(Math.max(i, 0), BOOKING_EXPORT_MILESTONES.length - 1);
  return getMilestoneDrawerDetail(row, idx).when;
}

/** Date/time for “Last milestone” column: API `last_milestone_date` / `time`, else route step, else legacy. */
export function getLastMilestoneWhen(row: BookingMilestoneRow): string {
  if (hasTruthyDate(row.last_milestone_date)) {
    return formatLastMilestoneApiDateTime(row);
  }
  if (row.last_milestone && row.route_milestones?.length) {
    const hit = findRouteMilestoneByCode(row.route_milestones, row.last_milestone);
    if (hit) return formatRouteMilestoneWhen(hit);
  }
  return getLastMilestoneWhenFromComputed(row);
}

/** Pieces: sum `no_of_packages` when present, else `no_of_containers`; weight from `gross_weight`. */
export function getBookingRowPW(cargoDetails: unknown): { pieces: number; weight: number } {
  if (!Array.isArray(cargoDetails) || cargoDetails.length === 0) {
    return { pieces: 0, weight: 0 };
  }
  let pieces = 0;
  let weight = 0;
  for (const c of cargoDetails) {
    const rec = c as Record<string, unknown>;
    const pkgs = Number(rec.no_of_packages ?? 0);
    const ctn = Number(rec.no_of_containers ?? 0);
    pieces += pkgs > 0 ? pkgs : ctn;
    weight += Number(rec.gross_weight ?? 0);
  }
  return { pieces, weight };
}
