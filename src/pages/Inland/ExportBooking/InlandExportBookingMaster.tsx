import {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef,
  type CSSProperties,
} from "react";
import * as XLSX from "xlsx";
import {
  Group,
  Flex,
  Button,
  Text,
  Center,
  Loader,
  Stack,
  Grid,
  Menu,
  ActionIcon,
  Box,
  Modal,
  Tooltip,
  Select,
  Drawer,
  MantineProvider,
  createTheme,
  rem,
} from "@mantine/core";
import {
  IconFilter,
  IconPlus,
  IconDots,
  IconEdit,
  IconDownload,
  IconArrowRight,
  IconPackage,
  IconCircleCheck,
  IconClock,
  IconStack2,
  IconScale,
  IconEye,
  IconFileText,
  IconBriefcase,
  IconCircleX,
  IconSelector,
  IconBook2,
  IconTruckDelivery,
  IconPlaneDeparture,
  IconPlaneArrival,
  IconMapPin,
  IconSearch,
  IconX,
  IconCopy,
} from "@tabler/icons-react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { URL } from "../../../api/serverUrls";
import {
  SearchableSelect,
  SingleDateInput,
  ToastNotification,
  ERPListBulkSelectionBar,
  ERPListColumnHeaderFilter,
  ERPListColumnToggleMenu,
  ERPListFilterActionsFooter,
  ERPListPaginationFooter,
  ERPListScreen,
  ERPListStatPill,
  erpListFilterUnifiedMantineStyles,
  erpListStickyActionTdStyle,
  erpListStickyActionThStyle,
  erpToolbarOutlineButtonStyles,
  erpToolbarPrimaryButtonStyles,
  erpToolbarSelectStyles,
  BookingCreateJobLoader,
  getBookingRowAirVolume,
  LastBookingsList,
  type ErpListTheme,
} from "../../../components";
import { useForm } from "@mantine/form";
import { apiCallProtected } from "../../../api/axios";
import { createJobFromBooking } from "../../../utils/bookingCreateJob";
import { navigateBookingDuplicate } from "../../../utils/navigateBookingDuplicate";
import { putAPICall } from "../../../service/putApiCall";
import { API_HEADER } from "../../../store/storeKeys";
import dayjs from "dayjs";
import { useDebouncedValue, useDisclosure } from "@mantine/hooks";
import { useListFilterStore } from "../../../store/listFilterStore";
import FormTextInput from "../../../components/FormTextInput";
import { getBookingShipmentFilterListTotal } from "../../../utils/bookingShipmentFilterListTotal";
import { formatDisplayJobId } from "../../../utils/displayJobId";
import useDateFormat from "../../../hooks/useDateFormat";

const LIST_KEY = "INLAND_EXPORT_BOOKING_MASTER";

/** Scoped subtree: only Geist / Geist Mono (see `index.css`). */
const INLAND_EXPORT_GEIST_ROOT_CLASS = "inland-export-booking-geist-root";
const INLAND_EXPORT_GEIST_MONO_CLASS = "inland-export-geist-mono";

/** Sans + mono: Geist files only; generic `sans-serif` / `monospace` are not additional typefaces. */
const V0_FONT_SANS = "'Geist', sans-serif";
const V0_FONT_MONO = "'Geist Mono', monospace";

const v0RootTypography = {
  fontFamily: V0_FONT_SANS,
  fontSize: 14,
  lineHeight: 1.5,
  WebkitFontSmoothing: "antialiased" as const,
  MozOsxFontSmoothing: "grayscale" as const,
};

const v0ModalStyles = {
  content: { fontFamily: V0_FONT_SANS },
  body: { fontFamily: V0_FONT_SANS, fontSize: 14 },
  header: { fontFamily: V0_FONT_SANS },
  title: { fontFamily: V0_FONT_SANS },
};

const v0ModalClassNames = {
  content: INLAND_EXPORT_GEIST_ROOT_CLASS,
  body: INLAND_EXPORT_GEIST_ROOT_CLASS,
  inner: INLAND_EXPORT_GEIST_ROOT_CLASS,
};

const v0MenuStyles = {
  dropdown: { fontFamily: V0_FONT_SANS, fontSize: 14 },
};

const AIR_EXPORT_FILTER_SELECT_CLASSNAMES = {
  dropdown: INLAND_EXPORT_GEIST_ROOT_CLASS,
  option: INLAND_EXPORT_GEIST_ROOT_CLASS,
};

/** One visual rhythm for all filter controls (labels + 32px inputs, Geist) — matches toolbar / ERP density. */
const AIR_EXPORT_FILTER_BORDER = "#e2e8f0";
const AIR_EXPORT_FILTER_UNIFIED_STYLES = {
  label: {
    fontFamily: V0_FONT_SANS,
    fontSize: 12,
    fontWeight: 500,
    color: "#64748b",
    lineHeight: 1.25,
    marginBottom: 6,
    display: "block" as const,
    minHeight: 15,
  },
  input: {
    fontFamily: V0_FONT_SANS,
    fontSize: 12,
    height: 32,
    minHeight: 32,
    borderColor: AIR_EXPORT_FILTER_BORDER,
  },
  dropdown: {
    fontFamily: V0_FONT_SANS,
    fontSize: 12,
  },
  option: {
    fontFamily: V0_FONT_SANS,
    fontSize: 12,
  },
} as const;

/** Mantine theme slice: v0 uses Geist + Tailwind defaults (text-xs 12px, text-sm 14px, text-lg 18px). */
const airExportV0MantineTheme = createTheme({
  fontFamily: V0_FONT_SANS,
  fontFamilyMonospace: V0_FONT_MONO,
  headings: { fontFamily: V0_FONT_SANS },
  fontSizes: {
    xs: rem(12),
    sm: rem(14),
    md: rem(16),
    lg: rem(18),
    xl: rem(20),
  },
});

// ---------- Types ----------
type ExportShipmentData = {
  id: number;
  sno: number;
  shipment_code: string;
  enquiry_id?: string | null;
  date: string;
  service: string;
  service_code?: string;
  service_name?: string;
  customer_name: string;
  origin_name: string;
  destination_name: string;
  customer_service_name: string;
  job_no?: string | null;
  status?: string;
  destination_agent_code?: string;
  destination_agent_address?: string;
  destination_agent_email?: string;
  destination_agent_name?: string;
  destination_agent_phone?: string;
  notify1_customer_name?: string;
  notify1_customer_address?: string;
  notify1_customer_email?: string;
  cha?: string;
  cha_id?: number | null;
  cha_address?: string;
  shipment_terms_code?: string;
  origin_code?: string;
  destination_code?: string;
  is_hazardous?: boolean;
  customer_code_read?: string;
  customer_code?: string;
  origin_code_read?: string;
  destination_code_read?: string;
  etd?: string;
  eta?: string;
  atd?: string;
  ata?: string;
  carrier_code_read?: string;
  voyage_no?: string;
  flight_no?: string;
  mawb_date?: string;
  /** When set, shipment has passed pickup — drives “Picked up” milestone in list/drawer. */
  actual_pickup_date?: string | null;
  /** When set, shipment is treated as delivered for milestone display. */
  actual_delivery_date?: string | null;
  carrier_booking_no?: string;
  igm_no?: string;
  igm_date?: string;
  mawb_no?: string;
  routed?: string;
  routed_by?: string;
  agent_name?: string;
  agent_address?: string;
  agent_email?: string;
  shipper_name?: string;
  shipper_address?: string;
  shipper_email?: string;
  consignee_name?: string;
  consignee_address?: string;
  consignee_email?: string;
  notify_customer_name?: string;
  notify_customer_address?: string;
  notify_customer_email?: string;
  shipment_terms_code_read?: string;
  marks_no?: string | null;
  commodity_description?: string | null;
  service_type?: string;
  events?: Array<Record<string, unknown>>;
  routing_details?: Array<Record<string, unknown>>;
  cargo_details?: Array<Record<string, unknown>>;
  rate_details?: Array<Record<string, unknown>>;
  housing_details?: Array<Record<string, unknown>>;
  /** Current milestone code from API (e.g. BOOKED, PICKED_UP). */
  last_milestone?: string | null;
  last_milestone_date?: string | null;
  last_milestone_time?: string | null;
  /** Ordered steps for list/drawer timeline; drives labels, active state, and dates. */
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

type FilterState = {
  booking_id: string | null;
  enquiry_id: string | null;
  customer: string | null;
  service: string | null;
  origin: string | null;
  destination: string | null;
  date: Date | null;
  /** Backend `houseno` filter (icontains on shipment_code's house number). */
  houseno: string | null;
  /** Backend `customer_service_name` filter for the handler column. */
  customer_service_name: string | null;
  /** Backend `masterno` filter for the MAWB column (icontains on master AWB no). */
  mawb_no: string | null;
};

type PersistedListFilters = {
  booking_id: string | null;
  enquiry_id: string | null;
  customer: string | null;
  service: string | null;
  origin: string | null;
  destination: string | null;
  date: string | null;
  houseno: string | null;
  customer_service_name: string | null;
  mawb_no: string | null;
  filtersApplied: boolean;
  showFilters: boolean;
  pageIndex: number;
};

type VisibleColumnsState = {
  sno: boolean;
  shipment: boolean;
  houseno: boolean;
  date: boolean;
  customer: boolean;
  route: boolean;
  status: boolean;
  job_no: boolean;
  volume: boolean;
  mawb: boolean;
  flight: boolean;
  pieces: boolean;
  weight: boolean;
  handler: boolean;
  lastMilestone: boolean;
};

/** Matches `summary` on `customerServiceShipmentFilter` for air export (totals are filter-scoped). */
type AirExportShipmentListSummary = {
  total_shipments?: number;
  status_counts?: {
    booked?: number;
    received?: number;
    generated?: number;
    closed?: number;
    cancel?: number;
    pending?: number;
  };
  totals?: {
    pcs?: number;
    weight_kg?: number;
  };
};

type AirExportListQueryResult = {
  data: ExportShipmentData[];
  total: number;
  summary?: AirExportShipmentListSummary;
};

/** Air export journey steps — order is fixed; index drives timeline state. */
const EXPORT_MILESTONES = [
  { label: "Booked", Icon: IconBook2, accent: "#4f46e5", soft: "#eef2ff" },
  {
    label: "Picked up",
    Icon: IconTruckDelivery,
    accent: "#0284c7",
    soft: "#e0f2fe",
  },
  { label: "Received", Icon: IconPackage, accent: "#7c3aed", soft: "#f3e8ff" },
  {
    label: "Departure",
    Icon: IconPlaneDeparture,
    accent: "#0891b2",
    soft: "#ecfeff",
  },
  {
    label: "Arrived",
    Icon: IconPlaneArrival,
    accent: "#059669",
    soft: "#ecfdf5",
  },
  { label: "Delivered", Icon: IconMapPin, accent: "#16a34a", soft: "#f0fdf4" },
] as const;

type MilestonePhase = "completed" | "current" | "upcoming";

function milestonePhase(i: number, activeIdx: number): MilestonePhase {
  if (i < activeIdx) return "completed";
  if (i === activeIdx) return "current";
  return "upcoming";
}

function rgbaFromHex(hex: string, a: number): string {
  const x = hex.replace("#", "");
  const v =
    x.length === 3
      ? x
          .split("")
          .map((c) => c + c)
          .join("")
      : x;
  const r = Number.parseInt(v.slice(0, 2), 16);
  const g = Number.parseInt(v.slice(2, 4), 16);
  const b = Number.parseInt(v.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/** Map event / master event label to milestone index (0–5). Returns null if unknown. */
function mapEventStringToMilestoneIndex(s: string): number | null {
  const u = s.toUpperCase();
  if (/\bDELIVER|HANDOVER|\bPOD\b|PROOF\s+OF\s+DELIVERY/.test(u)) return 5;
  if (/\bARRIV|\bATA\b|\bLAND(ED|ING)?\b/.test(u)) return 4;
  if (
    /\bDEPART|\bATD\b|TAKE[\s-]?OFF|AIRBORNE|EXPORT\s+FLIGHT|FLIGHT\s+DEP/.test(
      u,
    )
  )
    return 3;
  if (/\bRECEIV|GATE\s+IN|TERMINAL|WAREHOUSE\s+IN|ACCEPTANCE/.test(u)) return 2;
  if (/\bPICK|COLLECT|COLLECTION|CARGO\s+READY|GATE\s+OUT/.test(u)) return 1;
  if (/\bBOOK|CONFIRM|BOOKING/.test(u)) return 0;
  return null;
}

function getMaxMilestoneIndexFromEvents(
  events: ExportShipmentData["events"],
): number | null {
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

/** Map API `last_milestone` / `route_milestones[].code` to `EXPORT_MILESTONES` index (accent / icon). */
function mapMilestoneCodeToIndex(code: string | null | undefined): number {
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

function getExportMilestoneStyleByIndex(
  i: number,
): (typeof EXPORT_MILESTONES)[number] {
  return EXPORT_MILESTONES[
    Math.min(Math.max(i, 0), EXPORT_MILESTONES.length - 1)
  ];
}

/** `when` for one API route milestone (date + optional time). */
function formatRouteMilestoneWhen(m: {
  date?: string | null;
  time?: string | null;
}): string {
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
function formatLastMilestoneApiDateTime(row: ExportShipmentData): string {
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

function getRouteMilestonesActiveIndex(
  steps: NonNullable<ExportShipmentData["route_milestones"]>,
  row: ExportShipmentData,
): number {
  const byActive = steps.findIndex((m) => m.active);
  if (byActive >= 0) return byActive;
  if (row.last_milestone) {
    const byCode = steps.findIndex((m) => m.code === row.last_milestone);
    if (byCode >= 0) return byCode;
  }
  return Math.max(0, steps.length - 1);
}

// ---------- Pure helpers ----------
function normalizeBookingStatus(s: string | undefined | null): string {
  const u = (s || "").toUpperCase();
  if (u.includes("CANCEL")) return "CANCEL";
  if (u === "BOOKED") return "BOOKED";
  if (u === "RECEIVED") return "RECEIVED";
  return u || "GENERATED";
}

/**
 * Latest milestone index (0–5) from status, dates, documents, pickup/delivery dates, and `events`.
 * Uses the highest signal so rows can sit at Booked vs Picked up vs Departure vs Delivered distinctly.
 */
function getLastMilestoneIndex(row: ExportShipmentData): number {
  const st = normalizeBookingStatus(row.status);
  const raw = (row.status || "").toUpperCase();
  if (st === "CANCEL" || raw.includes("CANCEL")) return 0;

  let idx = -1;

  const fromEvents = getMaxMilestoneIndexFromEvents(row.events);
  if (fromEvents != null) idx = Math.max(idx, fromEvents);

  if (raw.includes("DELIVER")) idx = Math.max(idx, 5);
  if (hasTruthyDate(row.actual_delivery_date)) idx = Math.max(idx, 5);

  if (row.ata?.trim()) idx = Math.max(idx, 4);

  if (row.atd?.trim()) idx = Math.max(idx, 3);
  if (
    /\b(DEPART|DEPARTED|DISPATCH|DISPATCHED|IN\s*TRANSIT|EXPORTED|FLT\s*DEP)\b/i.test(
      raw,
    )
  ) {
    idx = Math.max(idx, 3);
  }

  if (st === "RECEIVED") idx = Math.max(idx, 2);

  if (/\b(PICK\s*UP|PICKUP|PICKED\s*UP|GATE\s*OUT|COLLECTED)\b/i.test(raw)) {
    idx = Math.max(idx, 1);
  }
  if (hasTruthyDate(row.actual_pickup_date)) idx = Math.max(idx, 1);

  if (
    st === "BOOKED" &&
    (row.mawb_no?.trim() || row.carrier_booking_no?.trim())
  ) {
    idx = Math.max(idx, 1);
  }

  if (st === "BOOKED") idx = Math.max(idx, 0);
  if (st === "GENERATED") idx = Math.max(idx, 0);

  if (idx < 0) idx = 0;
  return Math.min(idx, 5);
}

function getLastMilestoneLabel(row: ExportShipmentData): string {
  const i = getLastMilestoneIndex(row);
  return getExportMilestoneStyleByIndex(i).label;
}

/**
 * Table primary line: API `last_milestone` + matching `route_milestones[].label` when present,
 * else label derived from code / computed milestone.
 */
function getLastMilestoneDisplayLabel(row: ExportShipmentData): string {
  if (row.last_milestone) {
    const m = row.route_milestones?.find((x) => x.code === row.last_milestone);
    if (m?.label) return m.label;
    return getExportMilestoneStyleByIndex(
      mapMilestoneCodeToIndex(row.last_milestone),
    ).label;
  }
  return getLastMilestoneLabel(row);
}

/** Milestone meta for table — same `accent` / `soft` / `Icon` as the sidebar timeline, keyed by API code when present. */
function getLastMilestoneStep(
  row: ExportShipmentData,
): (typeof EXPORT_MILESTONES)[number] {
  if (row.last_milestone) {
    return getExportMilestoneStyleByIndex(
      mapMilestoneCodeToIndex(row.last_milestone),
    );
  }
  return getExportMilestoneStyleByIndex(getLastMilestoneIndex(row));
}

function getMilestoneDrawerDetail(
  row: ExportShipmentData,
  index: number,
): { detail: string; when: string } {
  const oc =
    row.origin_name || row.origin_code_read || row.origin_code || "Origin";
  const dc =
    row.destination_name ||
    row.destination_code_read ||
    row.destination_code ||
    "Destination";
  switch (index) {
    case 0:
      return {
        detail: "Booking confirmed",
        when: row.date ? dayjs(row.date).format("DD MMM, HH:mm") : "—",
      };
    case 1:
      return {
        detail: `${oc} — cargo / docs ready`,
        when: hasTruthyDate(row.actual_pickup_date)
          ? dayjs(String(row.actual_pickup_date)).format("DD MMM, HH:mm")
          : "—",
      };
    case 2:
      return { detail: "Received at export facility / terminal", when: "—" };
    case 3:
      return {
        detail: String(oc),
        when: row.atd
          ? dayjs(row.atd).format("DD MMM, HH:mm")
          : row.etd
            ? `Est. ${dayjs(row.etd).format("DD MMM, HH:mm")}`
            : "—",
      };
    case 4:
      return {
        detail: String(dc),
        when: row.ata
          ? dayjs(row.ata).format("DD MMM, HH:mm")
          : row.eta
            ? `Est. ${dayjs(row.eta).format("DD MMM, HH:mm")}`
            : "—",
      };
    case 5:
      return {
        detail: String(dc),
        when: hasTruthyDate(row.actual_delivery_date)
          ? dayjs(String(row.actual_delivery_date)).format("DD MMM, HH:mm")
          : "—",
      };
    default:
      return { detail: "", when: "—" };
  }
}

/** When string if API did not send `last_milestone_*` — legacy computation from booking fields. */
function getLastMilestoneWhenFromComputed(row: ExportShipmentData): string {
  const i = getLastMilestoneIndex(row);
  const idx = Math.min(Math.max(i, 0), EXPORT_MILESTONES.length - 1);
  return getMilestoneDrawerDetail(row, idx).when;
}

/** Date/time for “Last milestone” column: API `last_milestone_date` / `time`, else route step, else legacy. */
function getLastMilestoneWhen(row: ExportShipmentData): string {
  if (hasTruthyDate(row.last_milestone_date)) {
    return formatLastMilestoneApiDateTime(row);
  }
  if (row.last_milestone && row.route_milestones?.length) {
    const hit = row.route_milestones.find((m) => m.code === row.last_milestone);
    if (hit) return formatRouteMilestoneWhen(hit);
  }
  return getLastMilestoneWhenFromComputed(row);
}

function getRowPW(row: ExportShipmentData): { pieces: number; weight: number } {
  const cargo = row.cargo_details;
  if (Array.isArray(cargo) && cargo.length > 0) {
    const pieces = cargo.reduce(
      (s, c) => s + Number((c as Record<string, unknown>).no_of_packages ?? 0),
      0,
    );
    const weight = cargo.reduce(
      (s, c) => s + Number((c as Record<string, unknown>).gross_weight ?? 0),
      0,
    );
    return { pieces, weight };
  }
  return { pieces: 0, weight: 0 };
}

function initials(name: string | undefined | null): string {
  if (!name?.trim()) return "?";
  return name
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function firstName(name: string | undefined | null): string {
  if (!name?.trim()) return "—";
  return name.trim().split(/\s+/)[0] ?? "—";
}

type MilestoneDrawerStepRowProps = {
  step: (typeof EXPORT_MILESTONES)[number];
  displayLabel: string;
  detail: string;
  when: string;
  i: number;
  total: number;
  activeIdx: number;
  currentStageHint: string;
  /** Theme bits from parent (drawer) */
  fg: string;
  muted: string;
  primary: string;
  border: string;
  bg: string;
};

/**
 * One row in the milestone drawer: shared styling for API `route_milestones` and legacy
 * `EXPORT_MILESTONES` paths (accent / soft match sidebar timeline).
 */
function MilestoneDrawerStepRow({
  step,
  displayLabel,
  detail,
  when,
  i,
  total,
  activeIdx,
  currentStageHint,
  fg,
  muted,
  primary,
  border,
  bg,
}: MilestoneDrawerStepRowProps) {
  const phase = milestonePhase(i, activeIdx);
  const NodeIcon = step.Icon;
  const iconSize = phase === "current" ? 18 : 16;

  const connector =
    i < total - 1 ? (
      i < activeIdx ? (
        <Box
          style={{
            width: 2,
            height: 32,
            marginTop: 4,
            backgroundColor: rgbaFromHex(step.accent, 0.55),
            borderRadius: 1,
          }}
        />
      ) : i === activeIdx ? (
        <Box
          style={{
            width: 2,
            height: 32,
            marginTop: 4,
            borderRadius: 1,
            background: `repeating-linear-gradient(to bottom, ${primary} 0, ${primary} 5px, transparent 5px, transparent 9px)`,
          }}
        />
      ) : (
        <Box
          style={{
            width: 2,
            height: 32,
            marginTop: 4,
            backgroundColor: "#e2e8f0",
            borderRadius: 1,
          }}
        />
      )
    ) : null;

  const phaseLabel =
    phase === "completed" ? "Done" : phase === "current" ? "Active" : "Pending";

  return (
    <Group align="flex-start" wrap="nowrap" gap="md">
      <Flex
        direction="column"
        align="center"
        style={{ width: 40, flexShrink: 0 }}
      >
        <Box mt={2}>
          {phase === "completed" ? (
            <Box
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                backgroundColor: rgbaFromHex(step.accent, 0.15),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: `2px solid ${rgbaFromHex(step.accent, 0.45)}`,
              }}
            >
              <NodeIcon size={iconSize} color={step.accent} stroke={2} />
            </Box>
          ) : phase === "current" ? (
            <Box
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                border: `3px solid ${step.accent}`,
                backgroundColor: step.soft,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `0 0 0 4px ${rgbaFromHex(step.accent, 0.14)}`,
              }}
            >
              <NodeIcon size={iconSize} color={step.accent} stroke={2} />
            </Box>
          ) : (
            <Box
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                border: "2px dashed #cbd5e1",
                backgroundColor: "#f8fafc",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <NodeIcon size={iconSize} color="#94a3b8" stroke={1.75} />
            </Box>
          )}
        </Box>
        {connector}
      </Flex>
      <Stack
        gap={6}
        pb="md"
        style={{
          flex: 1,
          minWidth: 0,
          padding:
            phase === "upcoming" ? "4px 0 12px 0" : "10px 12px 12px 12px",
          borderRadius: 10,
          ...(phase === "completed"
            ? {
                backgroundColor: rgbaFromHex(step.accent, 0.07),
                borderLeft: `3px solid ${step.accent}`,
              }
            : {}),
          ...(phase === "current"
            ? {
                backgroundColor: step.soft,
                border: `1px solid ${rgbaFromHex(step.accent, 0.35)}`,
                boxShadow: `0 0 0 3px ${rgbaFromHex(step.accent, 0.1)}`,
              }
            : {}),
        }}
      >
        <Group
          justify="space-between"
          gap="xs"
          wrap="nowrap"
          align="flex-start"
        >
          <Group gap={8} wrap="nowrap" align="center">
            <Text
              fw={phase === "current" ? 700 : phase === "completed" ? 600 : 500}
              size="sm"
              c={phase === "upcoming" ? muted : fg}
              lh={1.3}
            >
              {displayLabel}
            </Text>
            <Text
              size="xs"
              fw={600}
              style={{
                flexShrink: 0,
                padding: "2px 8px",
                borderRadius: 9999,
                fontSize: 10,
                letterSpacing: "0.02em",
                backgroundColor:
                  phase === "completed"
                    ? rgbaFromHex(step.accent, 0.14)
                    : phase === "current"
                      ? rgbaFromHex(step.accent, 0.22)
                      : "#f1f5f9",
                color: phase === "upcoming" ? muted : step.accent,
              }}
            >
              {phaseLabel}
            </Text>
          </Group>
          <Text
            size="xs"
            c={phase === "current" ? step.accent : muted}
            ta="right"
            style={{ flexShrink: 0 }}
            fw={phase === "current" ? 600 : 400}
          >
            {when}
          </Text>
        </Group>
        <Text size="xs" c="dimmed" lh={1.4}>
          {detail}
        </Text>
        {phase === "current" && currentStageHint !== "" ? (
          <Box
            mt={2}
            p="sm"
            style={{
              backgroundColor: bg,
              borderRadius: 8,
              border: `1px solid ${border}`,
            }}
          >
            <Text size="xs" c={muted}>
              {currentStageHint}
            </Text>
          </Box>
        ) : null}
      </Stack>
    </Group>
  );
}

// ---------- Sub-components ----------
function StatusPill({ status }: { status: string | undefined | null }) {
  const n = normalizeBookingStatus(status);
  const cfg =
    n === "BOOKED"
      ? { label: "Booked", dot: "#10b981", bg: "#ecfdf5", color: "#047857" }
      : n === "RECEIVED"
        ? { label: "Received", dot: "#3b82f6", bg: "#eff6ff", color: "#1d4ed8" }
        : n === "CANCEL"
          ? {
              label: "Cancelled",
              dot: "#ef4444",
              bg: "#fef2f2",
              color: "#b91c1c",
            }
          : {
              label: "Generated",
              dot: "#f59e0b",
              bg: "#fffbeb",
              color: "#b45309",
            };

  return (
    <Box
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "2px 10px",
        borderRadius: 9999,
        backgroundColor: cfg.bg,
        color: cfg.color,
        fontSize: 12,
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}
    >
      <Box
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          backgroundColor: cfg.dot,
          flexShrink: 0,
        }}
      />
      {cfg.label}
    </Box>
  );
}

// ---------- Main Component ----------
function InlandExportBookingMaster() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const getState = useListFilterStore((s) => s.getState);
  const setStoreFilters = useListFilterStore((s) => s.setFilters);
  const setStoreSearch = useListFilterStore((s) => s.setSearch);
  const setStoreDisplayValues = useListFilterStore((s) => s.setDisplayValues);
  const clearAllExcept = useListFilterStore((s) => s.clearAllExcept);
  const clearAllStore = useListFilterStore((s) => s.clearAll);
  const setShouldRestore = useListFilterStore((s) => s.setShouldRestore);
  const dateFormat = useDateFormat();
  const airTransportParams = useMemo(() => ({ transport_mode: "AIR" }), []);

  // ---- restore flag ----
  const [isRestoring, setIsRestoring] = useState(true);

  // ---- filter panel ----
  const [showFilters, setShowFilters] = useState(false);
  const [filtersApplied, setFiltersApplied] = useState(false);

  // ---- pagination ----
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(15);
  const [totalRecords, setTotalRecords] = useState(0);

  // ---- display names ----
  const [customerDisplayName, setCustomerDisplayName] = useState<string | null>(
    null,
  );
  const [originDisplayName, setOriginDisplayName] = useState<string | null>(
    null,
  );
  const [destinationDisplayName, setDestinationDisplayName] = useState<
    string | null
  >(null);

  // ---- table state ----
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<VisibleColumnsState>({
    sno: true,
    shipment: true,
    houseno: true,
    date: true,
    customer: true,
    route: true,
    status: true,
    job_no: true,
    volume: true,
    mawb: true,
    flight: true,
    pieces: true,
    weight: true,
    handler: true,
    lastMilestone: true,
  });

  const [milestoneDrawerRow, setMilestoneDrawerRow] =
    useState<ExportShipmentData | null>(null);

  // ---- search ----
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch] = useDebouncedValue(searchQuery, 1000);

  /**
   * Column-header filtering: which header is currently in "edit" mode.
   * Lifted here so opening one header collapses any other open editor and
   * the editor survives the surrounding table re-renders.
   */
  const [editingHeaderId, setEditingHeaderId] = useState<string | null>(null);
  const openHeaderEditor = useCallback(
    (id: string) => setEditingHeaderId(id),
    [],
  );
  const collapseHeaderEditor = useCallback(
    (id: string) => setEditingHeaderId((cur) => (cur === id ? null : cur)),
    [],
  );

  // ---- cancel modal ----
  const [cancelConfirmRow, setCancelConfirmRow] =
    useState<ExportShipmentData | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const [createJobBookingId, setCreateJobBookingId] = useState<number | null>(
    null,
  );
  const [isDuplicatingBooking, setIsDuplicatingBooking] = useState(false);
  const [duplicateCustomerCode, setDuplicateCustomerCode] = useState<
    string | null
  >(null);
  const [
    lastBookingsDrawerOpened,
    { open: openLastBookingsDrawer, close: closeLastBookingsDrawer },
  ] = useDisclosure(false);

  const openDuplicateForRow = useCallback(
    (row: ExportShipmentData) => {
      const customerCode =
        (row.customer_code_read || row.customer_code || "").trim() || null;
      setDuplicateCustomerCode(customerCode);
      openLastBookingsDrawer();
    },
    [openLastBookingsDrawer],
  );

  const handleCloseLastBookingsDrawer = useCallback(() => {
    closeLastBookingsDrawer();
    setDuplicateCustomerCode(null);
  }, [closeLastBookingsDrawer]);

  // ---- filter form ----
  const filterForm = useForm<FilterState>({
    initialValues: {
      booking_id: null,
      enquiry_id: null,
      customer: null,
      service: null,
      origin: null,
      destination: null,
      date: null,
      houseno: null,
      customer_service_name: null,
      mawb_no: null,
    },
  });

  // ---- route helpers ----
  const isCreateRoute = location.pathname.endsWith("/create");
  const isEditRoute = location.pathname.endsWith("/edit");
  const showMasterTable = !isCreateRoute && !isEditRoute;

  const searchParams = new URLSearchParams(location.search);
  const shouldRefetch = searchParams.get("refetch") === "true";

  // ---- filter payload ----
  const buildFilterPayload = () => {
    const v = filterForm.values;
    const p: Record<string, string> = {};
    if (v.booking_id?.trim()) p.shipment_code = v.booking_id.trim();
    if (v.enquiry_id?.trim()) p.enquiry_id = v.enquiry_id.trim();
    if (v.customer) p.customer_code = v.customer;
    if (v.service) p.service = v.service;
    if (v.origin) p.origin_code = v.origin;
    if (v.destination) p.destination_code = v.destination;
    if (v.date) p.date = dayjs(v.date).format("YYYY-MM-DD");
    if (v.houseno?.trim()) p.houseno = v.houseno.trim();
    if (v.customer_service_name?.trim())
      p.customer_service_name = v.customer_service_name.trim();
    if (v.mawb_no?.trim()) p.masterno = v.mawb_no.trim();
    return p;
  };

  const buildRequestFilters = (searchValue: string): Record<string, string> => {
    const extra: Record<string, string> = {};
    if (filtersApplied) Object.assign(extra, buildFilterPayload());
    const trimmed = searchValue.trim();
    if (trimmed) extra.search = trimmed;
    if (statusFilter !== "all") extra.status = statusFilter;
    return extra;
  };

  /**
   * Header-filter writes update form values, immediately mark filters as
   * applied (so `buildRequestFilters` includes them), reset pagination, and
   * persist to the global list-filter store. Display labels (customer /
   * origin / destination names) are also captured for restoration.
   */
  const commitHeaderFilters = useCallback(
    (
      updates: Partial<FilterState>,
      displayUpdates?: {
        customer?: string | null;
        origin?: string | null;
        destination?: string | null;
      },
    ) => {
      const nextValues = { ...filterForm.values, ...updates };
      filterForm.setValues(updates);
      setFiltersApplied(true);
      setPageIndex(0);
      const nextCustomerDisplay =
        displayUpdates && "customer" in displayUpdates
          ? (displayUpdates.customer ?? null)
          : customerDisplayName;
      const nextOriginDisplay =
        displayUpdates && "origin" in displayUpdates
          ? (displayUpdates.origin ?? null)
          : originDisplayName;
      const nextDestinationDisplay =
        displayUpdates && "destination" in displayUpdates
          ? (displayUpdates.destination ?? null)
          : destinationDisplayName;
      if (displayUpdates && "customer" in displayUpdates) {
        setCustomerDisplayName(nextCustomerDisplay);
      }
      if (displayUpdates && "origin" in displayUpdates) {
        setOriginDisplayName(nextOriginDisplay);
      }
      if (displayUpdates && "destination" in displayUpdates) {
        setDestinationDisplayName(nextDestinationDisplay);
      }
      const persisted: PersistedListFilters = {
        booking_id: nextValues.booking_id,
        enquiry_id: nextValues.enquiry_id,
        customer: nextValues.customer,
        service: nextValues.service,
        origin: nextValues.origin,
        destination: nextValues.destination,
        date: nextValues.date
          ? dayjs(nextValues.date).format("YYYY-MM-DD")
          : null,
        houseno: nextValues.houseno,
        customer_service_name: nextValues.customer_service_name,
        mawb_no: nextValues.mawb_no,
        filtersApplied: true,
        showFilters,
        pageIndex: 0,
      };
      setStoreFilters(LIST_KEY, persisted);
      setStoreDisplayValues(LIST_KEY, {
        customer: nextCustomerDisplay,
        origin: nextOriginDisplay,
        destination: nextDestinationDisplay,
      });
    },
    [
      filterForm,
      customerDisplayName,
      originDisplayName,
      destinationDisplayName,
      showFilters,
      setStoreFilters,
      setStoreDisplayValues,
    ],
  );

  // ---- data query ----
  const {
    data: exportShipmentsResponse,
    isLoading,
    isFetching,
    refetch: refetchExportShipments,
  } = useQuery<AirExportListQueryResult>({
    queryKey: [
      "inland-export-booking/filter/",
      pageIndex,
      pageSize,
      filtersApplied,
      filtersApplied ? JSON.stringify(filterForm.values) : "-",
      debouncedSearch,
      statusFilter,
    ],
    enabled: !isRestoring && searchQuery === debouncedSearch,
    queryFn: async (): Promise<AirExportListQueryResult> => {
      try {
        const offset = pageIndex * pageSize;
        const url = `${URL.customerServiceShipmentFilter}?index=${offset}&limit=${pageSize}`;
        const response = (await apiCallProtected.post(url, {
          filters: {
            service_type: "EXPORT",
            service: "INLAND",
            ...buildRequestFilters(debouncedSearch),
          },
        })) as Record<string, unknown>;

        if (response && typeof response === "object") {
          let data: ExportShipmentData[] = [];
          if (Array.isArray(response.data))
            data = response.data as ExportShipmentData[];
          else if (Array.isArray(response.results))
            data = response.results as ExportShipmentData[];
          else if (Array.isArray(response.result))
            data = response.result as ExportShipmentData[];

          const listTotal = getBookingShipmentFilterListTotal(
            response,
            data,
            offset,
          );

          const rawSummary = response.summary;
          const summary: AirExportShipmentListSummary | undefined =
            rawSummary &&
            typeof rawSummary === "object" &&
            !Array.isArray(rawSummary)
              ? (rawSummary as AirExportShipmentListSummary)
              : undefined;

          const summaryTotal = summary?.total_shipments;
          const total =
            typeof summaryTotal === "number" && !Number.isNaN(summaryTotal)
              ? summaryTotal
              : listTotal;
          setTotalRecords(total);

          return { data, total, summary };
        }
        setTotalRecords(0);
        return { data: [], total: 0, summary: undefined };
      } catch {
        setTotalRecords(0);
        return { data: [], total: 0, summary: undefined };
      }
    },
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
    const maxPageIndex = totalPages - 1;
    if (pageIndex > maxPageIndex) {
      setPageIndex(maxPageIndex);
    }
  }, [totalRecords, pageSize, pageIndex]);

  const displayData = useMemo(
    () => exportShipmentsResponse?.data ?? [],
    [exportShipmentsResponse],
  );

  // ---- derived table data ----
  const tableRows = useMemo(() => {
    const rows = [...displayData];
    if (sortConfig) {
      rows.sort((a, b) => {
        let aVal: string | number = "";
        let bVal: string | number = "";
        if (sortConfig.key === "shipment") {
          aVal = a.shipment_code || "";
          bVal = b.shipment_code || "";
        } else if (sortConfig.key === "date") {
          aVal = a.date || "";
          bVal = b.date || "";
        } else if (sortConfig.key === "customer") {
          aVal = a.customer_name || "";
          bVal = b.customer_name || "";
        } else if (sortConfig.key === "weight") {
          aVal = getRowPW(a).weight;
          bVal = getRowPW(b).weight;
        }
        if (typeof aVal === "string") {
          return sortConfig.direction === "asc"
            ? aVal.localeCompare(bVal as string)
            : (bVal as string).localeCompare(aVal);
        }
        return sortConfig.direction === "asc"
          ? aVal - (bVal as number)
          : (bVal as number) - aVal;
      });
    }
    return rows;
  }, [displayData, sortConfig]);

  const stats = useMemo(() => {
    const rows = displayData;
    const fromRows = () => {
      let totalPieces = 0;
      let totalWeight = 0;
      rows.forEach((r) => {
        const pw = getRowPW(r);
        totalPieces += pw.pieces;
        totalWeight += pw.weight;
      });
      return { totalPieces, totalWeight };
    };

    const summary = exportShipmentsResponse?.summary;
    if (summary) {
      const fallback = fromRows();
      return {
        total: summary.total_shipments ?? totalRecords,
        booked: summary.status_counts?.booked ?? 0,
        received: summary.status_counts?.received ?? 0,
        generated: summary.status_counts?.generated ?? 0,
        canceled: summary.status_counts?.cancel ?? 0,
        totalPieces: summary.totals?.pcs ?? fallback.totalPieces,
        totalWeight: summary.totals?.weight_kg ?? fallback.totalWeight,
      };
    }

    const { totalPieces, totalWeight } = fromRows();
    return {
      total: totalRecords,
      booked: rows.filter((r) => normalizeBookingStatus(r.status) === "BOOKED")
        .length,
      received: rows.filter(
        (r) => normalizeBookingStatus(r.status) === "RECEIVED",
      ).length,
      generated: rows.filter(
        (r) => normalizeBookingStatus(r.status) === "GENERATED",
      ).length,
      canceled: rows.filter((r) => {
        const s = normalizeBookingStatus(r.status);
        return s === "CANCEL" || s === "CANCELED" || s === "CANCELLED";
      }).length,
      totalPieces,
      totalWeight,
    };
  }, [displayData, totalRecords, exportShipmentsResponse?.summary]);

  const columnToggleItems = useMemo(
    () =>
      (Object.keys(visibleColumns) as (keyof VisibleColumnsState)[]).map(
        (key) => ({
          id: String(key),
          label: String(key),
          checked: visibleColumns[key],
          onToggle: () =>
            setVisibleColumns((prev) => ({
              ...prev,
              [key]: !prev[key],
            })),
        }),
      ),
    [visibleColumns],
  );

  const isDataLoading = isRestoring || isLoading || isFetching;

  // Reset to first page whenever the search term changes (after debounce).
  // Use a ref to skip the initial value (and any restore-driven update) so we don't clobber a restored pageIndex.
  const lastDebouncedSearchRef = useRef<string | null>(null);
  useEffect(() => {
    if (isRestoring) return;
    if (lastDebouncedSearchRef.current === null) {
      lastDebouncedSearchRef.current = debouncedSearch;
      return;
    }
    if (lastDebouncedSearchRef.current === debouncedSearch) return;
    lastDebouncedSearchRef.current = debouncedSearch;
    setPageIndex((prev) => (prev === 0 ? prev : 0));
  }, [debouncedSearch, isRestoring]);

  // ---- restore state ----
  useEffect(() => {
    const stored = getState(LIST_KEY);
    const shouldRestore = stored?.shouldRestore === true;
    if (!shouldRestore) {
      setIsRestoring(false);
      return;
    }

    const f = stored.filters as PersistedListFilters | undefined;
    if (f && typeof f === "object") {
      filterForm.setValues({
        booking_id: f.booking_id ?? null,
        enquiry_id: f.enquiry_id ?? null,
        customer: f.customer ?? null,
        service: f.service ?? null,
        origin: f.origin ?? null,
        destination: f.destination ?? null,
        date: f.date ? dayjs(f.date, "YYYY-MM-DD").toDate() : null,
        houseno: f.houseno ?? null,
        customer_service_name: f.customer_service_name ?? null,
        mawb_no: f.mawb_no ?? null,
      });
      setFiltersApplied(Boolean(f.filtersApplied));
      setShowFilters(Boolean(f.showFilters));
      setPageIndex(typeof f.pageIndex === "number" ? f.pageIndex : 0);
    }
    const dv = stored.displayValues;
    if (dv) {
      setCustomerDisplayName(dv.customer ?? null);
      setOriginDisplayName(dv.origin ?? null);
      setDestinationDisplayName(dv.destination ?? null);
    }
    if (typeof stored.search === "string") setSearchQuery(stored.search);
    clearAllExcept(LIST_KEY);
    setShouldRestore(LIST_KEY, false);
    setIsRestoring(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  // ---- persist & navigate ----
  const persistListState = useCallback(() => {
    const persisted: PersistedListFilters = {
      booking_id: filterForm.values.booking_id,
      enquiry_id: filterForm.values.enquiry_id,
      customer: filterForm.values.customer,
      service: filterForm.values.service,
      origin: filterForm.values.origin,
      destination: filterForm.values.destination,
      date: filterForm.values.date
        ? dayjs(filterForm.values.date).format("YYYY-MM-DD")
        : null,
      houseno: filterForm.values.houseno,
      customer_service_name: filterForm.values.customer_service_name,
      mawb_no: filterForm.values.mawb_no,
      filtersApplied,
      showFilters,
      pageIndex,
    };
    setStoreFilters(LIST_KEY, persisted);
    setStoreDisplayValues(LIST_KEY, {
      customer: customerDisplayName,
      origin: originDisplayName,
      destination: destinationDisplayName,
    });
    setStoreSearch(LIST_KEY, searchQuery);
    setShouldRestore(LIST_KEY, true);
  }, [
    filterForm.values,
    filtersApplied,
    showFilters,
    pageIndex,
    customerDisplayName,
    originDisplayName,
    destinationDisplayName,
    searchQuery,
    setStoreFilters,
    setStoreDisplayValues,
    setStoreSearch,
    setShouldRestore,
  ]);

  const persistListAndNavigate = useCallback(() => {
    persistListState();
    navigate("./create");
  }, [persistListState, navigate]);

  // ---- refetch effects ----
  useEffect(() => {
    if (shouldRefetch) {
      queryClient.invalidateQueries({
        queryKey: ["inland-export-booking/filter/"],
      });
      const newSearchParams = new URLSearchParams(location.search);
      newSearchParams.delete("refetch");
      const newSearch = newSearchParams.toString();
      navigate(
        newSearch ? `${location.pathname}?${newSearch}` : location.pathname,
        { replace: true },
      );
    }
  }, [
    shouldRefetch,
    queryClient,
    location.search,
    location.pathname,
    navigate,
  ]);

  useEffect(() => {
    if (location.state?.refreshData) {
      queryClient.removeQueries({ queryKey: ["inland-export-booking/filter/"] });
      setTimeout(() => {
        void refetchExportShipments();
      }, 50);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [
    location.state,
    refetchExportShipments,
    navigate,
    location.pathname,
    queryClient,
  ]);

  useEffect(() => {
    setSelectedIds([]);
  }, [pageIndex, pageSize, statusFilter, debouncedSearch]);

  // ---- handlers ----
  const handleExport = (rows: ExportShipmentData[]) => {
    if (rows.length === 0) {
      ToastNotification({ type: "info", message: "No rows to export" });
      return;
    }
    const sheetRows = rows.map((r) => {
      const pw = getRowPW(r);
      return {
        Shipment: r.shipment_code,
        "Enquiry ID": r.enquiry_id ?? "",
        Date: r.date ? dayjs(r.date).format("DD MMM YYYY") : "",
        Customer: r.customer_name ?? "",
        Origin: r.origin_code_read || r.origin_code || "",
        Destination: r.destination_code_read || r.destination_code || "",
        Status: normalizeBookingStatus(r.status),
        "Last Milestone": getLastMilestoneLabel(r),
        MAWB: r.mawb_no ?? "",
        Flight: r.flight_no ?? "",
        Pcs: pw.pieces,
        "Weight kg": pw.weight,
        Handler: r.customer_service_name ?? "",
      };
    });
    const ws = XLSX.utils.json_to_sheet(sheetRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Export Bookings");
    XLSX.writeFile(
      wb,
      `air_export_bookings_${dayjs().format("YYYY-MM-DD_HH-mm")}.xlsx`,
    );
  };

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev?.key === key)
        return prev.direction === "asc" ? { key, direction: "desc" } : null;
      return { key, direction: "asc" };
    });
  };

  const applyFilters = () => {
    const v = filterForm.values;
    const hasValues =
      v.booking_id?.trim() ||
      v.enquiry_id?.trim() ||
      v.customer ||
      v.service ||
      v.origin ||
      v.destination ||
      v.date ||
      v.houseno?.trim() ||
      v.customer_service_name?.trim() ||
      v.mawb_no?.trim();
    if (!hasValues) {
      setFiltersApplied(false);
      setPageIndex(0);
      ToastNotification({
        type: "info",
        message: "No filters selected, showing all data",
      });
    } else {
      setPageIndex(0);
      setFiltersApplied(true);
      const persisted: PersistedListFilters = {
        booking_id: v.booking_id,
        enquiry_id: v.enquiry_id,
        customer: v.customer,
        service: v.service,
        origin: v.origin,
        destination: v.destination,
        date: v.date ? dayjs(v.date).format("YYYY-MM-DD") : null,
        houseno: v.houseno,
        customer_service_name: v.customer_service_name,
        mawb_no: v.mawb_no,
        filtersApplied: true,
        showFilters: false,
        pageIndex: 0,
      };
      setStoreFilters(LIST_KEY, persisted);
      setStoreDisplayValues(LIST_KEY, {
        customer: customerDisplayName,
        origin: originDisplayName,
        destination: destinationDisplayName,
      });
      setStoreSearch(LIST_KEY, searchQuery);
      ToastNotification({ type: "success", message: "Filters applied" });
    }
    setShowFilters(false);
  };

  const clearAllFilters = () => {
    filterForm.reset();
    setFiltersApplied(false);
    setSearchQuery("");
    setPageIndex(0);
    setCustomerDisplayName(null);
    setOriginDisplayName(null);
    setDestinationDisplayName(null);
    setShowFilters(false);
    clearAllStore(LIST_KEY);
    queryClient.invalidateQueries({ queryKey: ["inland-export-booking/filter/"] });
    ToastNotification({ type: "success", message: "Filters cleared" });
  };

  const handleConfirmCancel = async () => {
    if (!cancelConfirmRow) return;
    setIsCancelling(true);
    try {
      const payload = { ...cancelConfirmRow, status: "CANCEL" };
      await putAPICall(URL.customerServiceShipment, payload, API_HEADER);
      ToastNotification({ type: "success", message: "Booking cancelled" });
      setCancelConfirmRow(null);
      queryClient.invalidateQueries({
        queryKey: ["inland-export-booking/filter/"],
      });
      void refetchExportShipments();
    } catch (err: unknown) {
      ToastNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to cancel",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const handleCreateJob = async (booking: ExportShipmentData) => {
    await createJobFromBooking(booking as unknown as Record<string, unknown>, {
      navigate,
      mode: "inland-export",
      onStart: () => setCreateJobBookingId(booking.id),
      onEnd: () => setCreateJobBookingId(null),
      invalidateList: () => {
        queryClient.invalidateQueries({
          queryKey: ["inland-export-booking/filter/"],
        });
        void refetchExportShipments();
      },
    });
  };

  // ---- Row action menu ----
  const RowMenu = ({ row }: { row: ExportShipmentData }) => {
    const statusUpper = (row.status ?? "").toUpperCase();
    const isCancel = statusUpper.includes("CANCEL");
    const canCancel = statusUpper !== "GENERATED" && !isCancel;
    const isBooked = statusUpper === "BOOKED";
    return (
      <Menu
        shadow="md"
        width={200}
        position="bottom-end"
        styles={v0MenuStyles}
        classNames={{ dropdown: INLAND_EXPORT_GEIST_ROOT_CLASS }}
      >
        <Menu.Target>
          <ActionIcon variant="subtle" color="gray" size="sm">
            <IconDots size={16} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          {/* <Menu.Item
            leftSection={<IconEye size={14} />}
            disabled={isCancel}
            onClick={() => {
              if (!isCancel) {
                persistListState();
                navigate("./edit", { state: { job: row } });
              }
            }}
          >
            View Details
          </Menu.Item> */}
          <Menu.Item
            leftSection={<IconEdit size={14} />}
            disabled={isCancel}
            onClick={() => {
              if (!isCancel) {
                persistListState();
                navigate("./edit", { state: { job: row } });
              }
            }}
          >
            Edit Booking
          </Menu.Item>
          <Menu.Item
            leftSection={<IconCopy size={14} />}
            disabled={isDuplicatingBooking}
            onClick={() => openDuplicateForRow(row)}
          >
            Duplicate
          </Menu.Item>
          <Menu.Divider />
          {/* <Menu.Item leftSection={<IconFileText size={14} />}
            onClick={() => ToastNotification({ type: "info", message: "Generate AWB coming soon" })}>
            Generate AWB
          </Menu.Item> */}
          {isBooked && (
            <Menu.Item
              leftSection={<IconBriefcase size={14} />}
              disabled={createJobBookingId === row.id}
              onClick={() => void handleCreateJob(row)}
            >
              {createJobBookingId === row.id ? "Creating job…" : "Create Job"}
            </Menu.Item>
          )}
          <Menu.Divider />
          <Menu.Item
            leftSection={<IconCircleX size={14} />}
            color="red"
            disabled={!canCancel}
            onClick={() => {
              if (canCancel) setCancelConfirmRow(row);
            }}
          >
            Cancel Booking
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    );
  };

  // ---- Sortable header ----
  const Th = ({
    col,
    label,
    sortable = false,
    align = "left",
    minwidth = 120,
  }: {
    col: string;
    label: string;
    sortable?: boolean;
    align?: "left" | "right";
    minwidth?: number;
  }) => {
    const active = sortConfig?.key === col;
    return (
      <th
        style={{
          ...headerThStyle(align),
          minWidth: minwidth ? minwidth : undefined,
        }}
      >
        {sortable ? (
          <button
            type="button"
            onClick={() => handleSort(col)}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              color: active ? primary : muted,
              fontSize: "inherit",
              fontWeight: "inherit",
            }}
          >
            {label}
            <IconSelector size={12} style={{ opacity: active ? 1 : 0.5 }} />
          </button>
        ) : (
          label
        )}
      </th>
    );
  };

  // ---- theme constants ----
  const border = "#e2e8f0";
  const muted = "#64748b";
  const fg = "#0f172a";
  const primary = "#105476";
  /** Table header / chrome (muted band inside the white card). */
  const bg = "#f8fafc";
  /** Same as AppShell main + `--page-bg` so the column isn’t a second gray behind the card. */
  const pageBg = "#F0F4F8";
  const cardBg = "#ffffff";

  const erpTheme: ErpListTheme = {
    border,
    muted,
    fg,
    primary,
    headerBg: bg,
    pageBg,
    cardBg,
    fontSans: V0_FONT_SANS,
  };

  // ---- shared table cell styles ----
  /**
   * Common `<th>` style. Centralized so every table header — sortable,
   * filterable, or plain — uses identical padding, font weight/size,
   * color, background and border. Mirrors the MRT `mantineTableHeadCellProps`
   * pattern used in {@link ReceiptMaster}: one place to tweak header look.
   *
   * Pass `minWidthPx` for filterable columns so the cell width stays stable
   * when the header toggles between label and inline editor.
   */
  const headerThStyle = (
    align: "left" | "right" = "left",
    minWidthPx?: number,
  ): CSSProperties => ({
    padding: "10px 14px",
    textAlign: align,
    fontWeight: 500,
    fontSize: 14,
    color: muted,
    backgroundColor: bg,
    borderBottom: `1px solid ${border}`,
    whiteSpace: "nowrap",
    userSelect: "none",
    ...(typeof minWidthPx === "number"
      ? { minWidth: minWidthPx, width: minWidthPx }
      : {}),
  });

  /**
   * Common `<td>` style. Defaults to the standard `10px 14px` body padding;
   * accepts per-cell overrides for alignment, color, font weight/size,
   * maxWidth, and verticalAlign so individual cells (Pcs/Weight numeric,
   * Customer truncation, Last Milestone) don't repeat the base block.
   */
  const bodyTdStyle = (opts?: {
    align?: "left" | "right" | "center";
    color?: string;
    fontSize?: number;
    fontWeight?: number;
    maxWidth?: number;
    verticalAlign?: "top" | "middle" | "bottom";
  }): CSSProperties => ({
    padding: "10px 14px",
    ...(opts?.align ? { textAlign: opts.align } : {}),
    ...(opts?.color ? { color: opts.color } : {}),
    ...(opts?.fontSize ? { fontSize: opts.fontSize } : {}),
    ...(opts?.fontWeight ? { fontWeight: opts.fontWeight } : {}),
    ...(opts?.maxWidth ? { maxWidth: opts.maxWidth } : {}),
    ...(opts?.verticalAlign ? { verticalAlign: opts.verticalAlign } : {}),
  });

  // ===================== RENDER =====================
  return (
    <MantineProvider theme={airExportV0MantineTheme}>
      <Box className={INLAND_EXPORT_GEIST_ROOT_CLASS} style={v0RootTypography}>
        {showMasterTable && (
          <ERPListScreen
            theme={erpTheme}
            toolbar={{
              leading: (
                <>
                  <ERPListStatPill
                    theme={erpTheme}
                    icon={<IconPackage size={14} color={primary} />}
                    value={stats.total}
                    label="Total"
                  />
                  <ERPListStatPill
                    theme={erpTheme}
                    icon={<IconCircleCheck size={14} color="#059669" />}
                    iconBackground="#d1fae5"
                    iconColor="#059669"
                    value={stats.booked}
                    label="Booked"
                  />
                  <ERPListStatPill
                    theme={erpTheme}
                    icon={<IconPackage size={14} color="#105476" />}
                    iconBackground="#dbeafe"
                    iconColor="#105476"
                    value={stats.received}
                    label="Received"
                  />
                  <ERPListStatPill
                    theme={erpTheme}
                    icon={<IconClock size={14} color="#d97706" />}
                    iconBackground="#fef3c7"
                    iconColor="#d97706"
                    value={stats.generated}
                    label="Generated"
                  />
                  <ERPListStatPill
                    theme={erpTheme}
                    icon={<IconCircleX size={14} color="#dc2626" />}
                    iconBackground="#fee2e2"
                    iconColor="#dc2626"
                    value={stats.canceled}
                    label="Canceled"
                  />
                </>
              ),
              secondary: (
                <>
                  <Group gap={8} wrap="nowrap" align="center">
                    <IconStack2
                      size={16}
                      color={muted}
                      style={{ flexShrink: 0 }}
                    />
                    <Text fw={600} size="sm" c={fg} component="span">
                      {stats.totalPieces.toLocaleString()}
                    </Text>
                    <Text size="xs" c={muted} component="span">
                      pcs
                    </Text>
                  </Group>
                  <Group gap={8} wrap="nowrap" align="center">
                    <IconScale
                      size={16}
                      color={muted}
                      style={{ flexShrink: 0 }}
                    />
                    <Text fw={600} size="sm" c={fg} component="span">
                      {stats.totalWeight.toLocaleString(undefined, {
                        maximumFractionDigits: 1,
                      })}
                    </Text>
                    <Text size="xs" c={muted} component="span">
                      kg
                    </Text>
                  </Group>
                </>
              ),
              actions: (
                <>
                  <Select
                    size="xs"
                    w={130}
                    value={statusFilter}
                    onChange={(v) => {
                      setStatusFilter(v || "all");
                      setPageIndex(0);
                    }}
                    data={[
                      { value: "all", label: "All Status" },
                      { value: "BOOKED", label: "Booked" },
                      { value: "RECEIVED", label: "Received" },
                      { value: "GENERATED", label: "Generated" },
                      { value: "CLOSED", label: "Closed" },
                      { value: "CANCEL", label: "Cancelled" },
                    ]}
                    classNames={{
                      dropdown: INLAND_EXPORT_GEIST_ROOT_CLASS,
                      option: INLAND_EXPORT_GEIST_ROOT_CLASS,
                    }}
                    styles={erpToolbarSelectStyles(erpTheme)}
                  />
                  <ERPListColumnToggleMenu
                    theme={erpTheme}
                    items={columnToggleItems}
                    menuStyles={v0MenuStyles}
                    classNames={{ dropdown: INLAND_EXPORT_GEIST_ROOT_CLASS }}
                  />
                  <FormTextInput
                    placeholder="Search..."
                    leftSection={<IconSearch size={14} />}
                    rightSection={
                      searchQuery ? (
                        <ActionIcon
                          variant="transparent"
                          size="sm"
                          onClick={() => setSearchQuery("")}
                          aria-label="Clear search"
                        >
                          <IconX size={14} />
                        </ActionIcon>
                      ) : null
                    }
                    w={220}
                    size="xs"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.currentTarget.value)}
                    styles={{
                      input: {
                        height: 32,
                        minHeight: 32,
                        fontSize: 12,
                        borderColor: border,
                        fontFamily: V0_FONT_SANS,
                      },
                    }}
                  />
                  <Button
                    variant="default"
                    size="xs"
                    styles={erpToolbarOutlineButtonStyles(erpTheme)}
                    leftSection={<IconFilter size={14} />}
                    onClick={() => setShowFilters((s) => !s)}
                  >
                    {showFilters ? "Hide filters" : "Filters"}
                  </Button>
                  <Button
                    size="xs"
                    leftSection={<IconPlus size={14} />}
                    styles={erpToolbarPrimaryButtonStyles(erpTheme)}
                    onClick={persistListAndNavigate}
                  >
                    New Booking
                  </Button>
                </>
              ),
            }}
            filters={{
              opened: showFilters,
              title: "Filters",
              subtitle:
                "Refine bookings by reference, customer, route, or date",
              onClose: () => setShowFilters(false),
              footer: (
                <ERPListFilterActionsFooter
                  theme={erpTheme}
                  onClear={clearAllFilters}
                  onApply={applyFilters}
                  applyLoading={isDataLoading}
                  applyDisabled={isDataLoading}
                />
              ),
              children: (
                <Grid gutter={{ base: "md", md: "lg" }} align="stretch">
                  <Grid.Col span={{ base: 12, sm: 6, md: 4, xl: 2 }}>
                    <Box
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        width: "100%",
                        minHeight: 0,
                      }}
                    >
                      <FormTextInput
                        size="xs"
                        label="Booking ID"
                        placeholder="Enter Booking ID"
                        styles={AIR_EXPORT_FILTER_UNIFIED_STYLES}
                        value={filterForm.values.booking_id ?? ""}
                        onChange={(e) =>
                          filterForm.setFieldValue(
                            "booking_id",
                            e.currentTarget.value || null,
                          )
                        }
                      />
                    </Box>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6, md: 4, xl: 2 }}>
                    <Box
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        width: "100%",
                        minHeight: 0,
                      }}
                    >
                      <FormTextInput
                        size="xs"
                        label="Enquiry ID"
                        placeholder="Enter Enquiry ID"
                        styles={AIR_EXPORT_FILTER_UNIFIED_STYLES}
                        value={filterForm.values.enquiry_id ?? ""}
                        onChange={(e) =>
                          filterForm.setFieldValue(
                            "enquiry_id",
                            e.currentTarget.value || null,
                          )
                        }
                      />
                    </Box>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6, md: 4, xl: 2 }}>
                    <Box
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        width: "100%",
                        minHeight: 0,
                      }}
                    >
                      <SearchableSelect
                        size="xs"
                        label="Customer"
                        placeholder="Type customer name"
                        apiEndpoint={URL.allCustomers}
                        searchFields={["customer_name", "customer_code"]}
                        displayFormat={(item: Record<string, unknown>) => ({
                          value: String(item.customer_code),
                          label: String(item.customer_name),
                        })}
                        value={filterForm.values.customer}
                        displayValue={customerDisplayName}
                        onChange={(value, selectedData) => {
                          filterForm.setFieldValue("customer", value || "");
                          setCustomerDisplayName(selectedData?.label || null);
                        }}
                        minSearchLength={2}
                        dropdownZIndex={1000}
                        classNames={AIR_EXPORT_FILTER_SELECT_CLASSNAMES}
                        styles={AIR_EXPORT_FILTER_UNIFIED_STYLES}
                      />
                    </Box>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6, md: 4, xl: 2 }}>
                    <Box
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        width: "100%",
                        minHeight: 0,
                      }}
                    >
                      <SingleDateInput
                        key={`date-${filterForm.values.date}`}
                        label="Date"
                        placeholder="YYYY-MM-DD"
                        size="xs"
                        value={filterForm.values.date}
                        onChange={(d) => filterForm.setFieldValue("date", d)}
                        classNames={{ dropdown: INLAND_EXPORT_GEIST_ROOT_CLASS }}
                        styles={{
                          ...AIR_EXPORT_FILTER_UNIFIED_STYLES,
                          input: {
                            ...AIR_EXPORT_FILTER_UNIFIED_STYLES.input,
                            minHeight: 32,
                          },
                        }}
                      />
                    </Box>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6, md: 4, xl: 2 }}>
                    <Box
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        width: "100%",
                        minHeight: 0,
                      }}
                    >
                      <SearchableSelect
                        size="xs"
                        label="Origin"
                        placeholder="Type origin code or name"
                        apiEndpoint={URL.portMaster}
                        searchFields={["port_code", "port_name"]}
                        displayFormat={(item: Record<string, unknown>) => ({
                          value: String(item.port_code),
                          label: `${item.port_name} (${item.port_code})`,
                        })}
                        value={filterForm.values.origin}
                        displayValue={originDisplayName}
                        onChange={(value, selectedData) => {
                          filterForm.setFieldValue("origin", value || "");
                          setOriginDisplayName(selectedData?.label || null);
                        }}
                        minSearchLength={3}
                        additionalParams={airTransportParams}
                        dropdownZIndex={1000}
                        classNames={AIR_EXPORT_FILTER_SELECT_CLASSNAMES}
                        styles={AIR_EXPORT_FILTER_UNIFIED_STYLES}
                      />
                    </Box>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6, md: 4, xl: 2 }}>
                    <Box
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        width: "100%",
                        minHeight: 0,
                      }}
                    >
                      <SearchableSelect
                        size="xs"
                        label="Destination"
                        placeholder="Type destination code or name"
                        apiEndpoint={URL.portMaster}
                        searchFields={["port_code", "port_name"]}
                        displayFormat={(item: Record<string, unknown>) => ({
                          value: String(item.port_code),
                          label: `${item.port_name} (${item.port_code})`,
                        })}
                        value={filterForm.values.destination}
                        displayValue={destinationDisplayName}
                        onChange={(value, selectedData) => {
                          filterForm.setFieldValue("destination", value || "");
                          setDestinationDisplayName(
                            selectedData?.label || null,
                          );
                        }}
                        minSearchLength={3}
                        additionalParams={airTransportParams}
                        dropdownZIndex={1000}
                        classNames={AIR_EXPORT_FILTER_SELECT_CLASSNAMES}
                        styles={AIR_EXPORT_FILTER_UNIFIED_STYLES}
                      />
                    </Box>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6, md: 4, xl: 2 }}>
                    <Box
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        width: "100%",
                        minHeight: 0,
                      }}
                    >
                      <FormTextInput
                        size="xs"
                        label="House No"
                        placeholder="Enter House No"
                        styles={AIR_EXPORT_FILTER_UNIFIED_STYLES}
                        value={filterForm.values.houseno ?? ""}
                        onChange={(e) =>
                          filterForm.setFieldValue(
                            "houseno",
                            e.currentTarget.value || null,
                          )
                        }
                      />
                    </Box>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6, md: 4, xl: 2 }}>
                    <Box
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        width: "100%",
                        minHeight: 0,
                      }}
                    >
                      <FormTextInput
                        size="xs"
                        label="Customer Service"
                        placeholder="Enter Customer Service"
                        styles={AIR_EXPORT_FILTER_UNIFIED_STYLES}
                        value={filterForm.values.customer_service_name ?? ""}
                        onChange={(e) =>
                          filterForm.setFieldValue(
                            "customer_service_name",
                            e.currentTarget.value || null,
                          )
                        }
                      />
                    </Box>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6, md: 4, xl: 2 }}>
                    <Box
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        width: "100%",
                        minHeight: 0,
                      }}
                    >
                      <FormTextInput
                        size="xs"
                        label="MAWB"
                        placeholder="Enter MAWB"
                        styles={AIR_EXPORT_FILTER_UNIFIED_STYLES}
                        value={filterForm.values.mawb_no ?? ""}
                        onChange={(e) =>
                          filterForm.setFieldValue(
                            "mawb_no",
                            e.currentTarget.value || null,
                          )
                        }
                      />
                    </Box>
                  </Grid.Col>
                </Grid>
              ),
            }}
            table={{
              selectionBar:
                selectedIds.length > 0 ? (
                  <ERPListBulkSelectionBar
                    theme={erpTheme}
                    count={selectedIds.length}
                    entityLabel="booking"
                  >
                    <Button
                      variant="default"
                      size="xs"
                      leftSection={<IconFileText size={13} />}
                      onClick={() =>
                        ToastNotification({
                          type: "info",
                          message: "Generate AWB coming soon",
                        })
                      }
                    >
                      Generate AWB
                    </Button>
                    <Button
                      variant="default"
                      size="xs"
                      leftSection={<IconDownload size={13} />}
                      onClick={() =>
                        handleExport(
                          tableRows.filter((r) => selectedIds.includes(r.id)),
                        )
                      }
                    >
                      Export Selected
                    </Button>
                    <Button
                      variant="subtle"
                      color="red"
                      size="xs"
                      onClick={() => setSelectedIds([])}
                    >
                      Clear
                    </Button>
                  </ERPListBulkSelectionBar>
                ) : undefined,
              footer: (
                <ERPListPaginationFooter
                  theme={erpTheme}
                  totalRecords={totalRecords}
                  pageIndex={pageIndex}
                  pageSize={pageSize}
                  onPageIndexChange={setPageIndex}
                  onPageSizeChange={setPageSize}
                  selectClassNames={{
                    dropdown: INLAND_EXPORT_GEIST_ROOT_CLASS,
                    option: INLAND_EXPORT_GEIST_ROOT_CLASS,
                  }}
                />
              ),
              children: (
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 14,
                    backgroundColor: cardBg,
                  }}
                >
                  <thead>
                    <tr style={{ height: 52.4 }}>
                      {visibleColumns.sno && (
                        <Th col="sno" label="S.No" minwidth={40} />
                      )}
                      {visibleColumns.shipment && (
                        <th style={headerThStyle("left", 160)}>
                          <ERPListColumnHeaderFilter
                            label="Booking ID"
                            value={filterForm.values.booking_id ?? ""}
                            displayValue={filterForm.values.booking_id ?? ""}
                            theme={erpTheme}
                            placeholder="Filter Booking ID"
                            isEditing={editingHeaderId === "shipment"}
                            onStartEdit={() => openHeaderEditor("shipment")}
                            onStopEdit={() => collapseHeaderEditor("shipment")}
                            onChange={(next) =>
                              commitHeaderFilters({ booking_id: next || null })
                            }
                          />
                        </th>
                      )}
                      {visibleColumns.houseno && (
                        <th style={headerThStyle("left", 140)}>
                          <ERPListColumnHeaderFilter
                            label="House No"
                            value={filterForm.values.houseno ?? ""}
                            displayValue={filterForm.values.houseno ?? ""}
                            theme={erpTheme}
                            placeholder="Filter House No"
                            isEditing={editingHeaderId === "houseno"}
                            onStartEdit={() => openHeaderEditor("houseno")}
                            onStopEdit={() => collapseHeaderEditor("houseno")}
                            onChange={(next) =>
                              commitHeaderFilters({ houseno: next || null })
                            }
                          />
                        </th>
                      )}
                      {visibleColumns.customer && (
                        <th style={headerThStyle("left", 220)}>
                          <ERPListColumnHeaderFilter
                            label="Customer"
                            value={filterForm.values.customer ?? ""}
                            displayValue={
                              customerDisplayName ??
                              filterForm.values.customer ??
                              ""
                            }
                            onChange={() => {}}
                            theme={erpTheme}
                            isEditing={editingHeaderId === "customer"}
                            onStartEdit={() => openHeaderEditor("customer")}
                            onStopEdit={() => collapseHeaderEditor("customer")}
                            renderEditor={({ autoFocus, onClose }) => (
                              <SearchableSelect
                                autoFocus={autoFocus}
                                size="xs"
                                apiEndpoint={URL.customer}
                                searchFields={[
                                  "customer_name",
                                  "customer_code",
                                ]}
                                placeholder="Type customer"
                                displayFormat={(
                                  item: Record<string, unknown>,
                                ) => ({
                                  value: String(item.customer_code),
                                  label: String(item.customer_name),
                                })}
                                value={filterForm.values.customer}
                                displayValue={customerDisplayName}
                                onChange={(value, selectedData) => {
                                  commitHeaderFilters(
                                    { customer: value || null },
                                    { customer: selectedData?.label ?? null },
                                  );
                                  if (value) onClose();
                                }}
                                minSearchLength={1}
                                dropdownZIndex={1000}
                                classNames={AIR_EXPORT_FILTER_SELECT_CLASSNAMES}
                                styles={AIR_EXPORT_FILTER_UNIFIED_STYLES}
                              />
                            )}
                          />
                        </th>
                      )}
                      {visibleColumns.date && (
                        <th style={headerThStyle("left", 140)}>
                          <ERPListColumnHeaderFilter
                            label="Date"
                            value={
                              filterForm.values.date
                                ? dayjs(filterForm.values.date).format(
                                    "YYYY-MM-DD",
                                  )
                                : ""
                            }
                            displayValue={
                              filterForm.values.date
                                ? dayjs(filterForm.values.date).format(
                                    dateFormat,
                                  )
                                : ""
                            }
                            onChange={() => {}}
                            theme={erpTheme}
                            isEditing={editingHeaderId === "date"}
                            onStartEdit={() => openHeaderEditor("date")}
                            onStopEdit={() => collapseHeaderEditor("date")}
                            renderEditor={({ autoFocus, onClose }) => (
                              <SingleDateInput
                                key={`date-h-${filterForm.values.date}`}
                                // placeholder="YYYY-MM-DD"
                                size="xs"
                                value={filterForm.values.date}
                                onChange={(d) => {
                                  commitHeaderFilters({ date: d });
                                  if (d) onClose();
                                }}
                                classNames={{
                                  dropdown: INLAND_EXPORT_GEIST_ROOT_CLASS,
                                }}
                                styles={AIR_EXPORT_FILTER_UNIFIED_STYLES}
                                {...(autoFocus ? { autoFocus: true } : {})}
                              />
                            )}
                          />
                        </th>
                      )}
                      {visibleColumns.route && (
                        <th style={headerThStyle("left", 200)}>
                          <ERPListColumnHeaderFilter
                            label="Route"
                            value={
                              (filterForm.values.origin ?? "") +
                              (filterForm.values.destination ?? "")
                            }
                            displayValue={
                              filterForm.values.origin ||
                              filterForm.values.destination
                                ? `${filterForm.values.origin ?? "—"} → ${
                                    filterForm.values.destination ?? "—"
                                  }`
                                : ""
                            }
                            onChange={() => {}}
                            theme={erpTheme}
                            isEditing={editingHeaderId === "route"}
                            onStartEdit={() => openHeaderEditor("route")}
                            onStopEdit={() => collapseHeaderEditor("route")}
                            renderEditor={({ autoFocus }) => (
                              <Group
                                gap={4}
                                wrap="nowrap"
                                style={{ width: "100%" }}
                              >
                                <Box style={{ flex: 1, minWidth: 0 }}>
                                  <SearchableSelect
                                    autoFocus={autoFocus}
                                    size="xs"
                                    apiEndpoint={URL.portMaster}
                                    additionalParams={airTransportParams}
                                    searchFields={["port_code", "port_name"]}
                                    placeholder="Origin"
                                    displayFormat={(
                                      item: Record<string, unknown>,
                                    ) => ({
                                      value: String(item.port_code),
                                      label: `${item.port_name} (${item.port_code})`,
                                    })}
                                    value={filterForm.values.origin}
                                    displayValue={originDisplayName}
                                    onChange={(value, selectedData) =>
                                      commitHeaderFilters(
                                        { origin: value || null },
                                        { origin: selectedData?.label ?? null },
                                      )
                                    }
                                    minSearchLength={1}
                                    dropdownZIndex={1000}
                                    classNames={
                                      AIR_EXPORT_FILTER_SELECT_CLASSNAMES
                                    }
                                    styles={AIR_EXPORT_FILTER_UNIFIED_STYLES}
                                  />
                                </Box>
                                <Box style={{ flex: 1, minWidth: 0 }}>
                                  <SearchableSelect
                                    size="xs"
                                    apiEndpoint={URL.portMaster}
                                    additionalParams={airTransportParams}
                                    searchFields={["port_code", "port_name"]}
                                    placeholder="Destination"
                                    displayFormat={(
                                      item: Record<string, unknown>,
                                    ) => ({
                                      value: String(item.port_code),
                                      label: `${item.port_name} (${item.port_code})`,
                                    })}
                                    value={filterForm.values.destination}
                                    displayValue={destinationDisplayName}
                                    onChange={(value, selectedData) =>
                                      commitHeaderFilters(
                                        { destination: value || null },
                                        {
                                          destination:
                                            selectedData?.label ?? null,
                                        },
                                      )
                                    }
                                    minSearchLength={1}
                                    dropdownZIndex={1000}
                                    classNames={
                                      AIR_EXPORT_FILTER_SELECT_CLASSNAMES
                                    }
                                    styles={AIR_EXPORT_FILTER_UNIFIED_STYLES}
                                  />
                                </Box>
                              </Group>
                            )}
                          />
                        </th>
                      )}
                      {visibleColumns.status && (
                        <Th col="status" label="Status" />
                      )}
                      {visibleColumns.job_no && (
                        <Th col="job_no" label="Job ID" minwidth={180} />
                      )}
                      {visibleColumns.volume && (
                        <Th col="volume" label="Volume" minwidth={120} />
                      )}
                      {visibleColumns.mawb && (
                        <th style={headerThStyle("left", 160)}>
                          <ERPListColumnHeaderFilter
                            label="MAWB"
                            value={filterForm.values.mawb_no ?? ""}
                            displayValue={filterForm.values.mawb_no ?? ""}
                            theme={erpTheme}
                            placeholder="Filter MAWB"
                            isEditing={editingHeaderId === "mawb"}
                            onStartEdit={() => openHeaderEditor("mawb")}
                            onStopEdit={() => collapseHeaderEditor("mawb")}
                            onChange={(next) =>
                              commitHeaderFilters({ mawb_no: next || null })
                            }
                          />
                        </th>
                      )}
                      {visibleColumns.flight && (
                        <Th col="flight" label="Flight" />
                      )}
                      {visibleColumns.pieces && (
                        <Th col="pieces" label="Pcs" align="right" />
                      )}
                      {visibleColumns.weight && (
                        <Th col="weight" label="Weight" align="right" />
                      )}
                      {visibleColumns.handler && (
                        <th style={headerThStyle("left", 120)}>
                          <ERPListColumnHeaderFilter
                            label="Customer Service"
                            value={
                              filterForm.values.customer_service_name ?? ""
                            }
                            displayValue={
                              filterForm.values.customer_service_name ?? ""
                            }
                            theme={erpTheme}
                            placeholder="Filter Customer Service"
                            isEditing={editingHeaderId === "handler"}
                            onStartEdit={() => openHeaderEditor("handler")}
                            onStopEdit={() => collapseHeaderEditor("handler")}
                            onChange={(next) =>
                              commitHeaderFilters({
                                customer_service_name: next || null,
                              })
                            }
                          />
                        </th>
                      )}
                      {visibleColumns.lastMilestone && (
                        <Th col="lastMilestone" label="Last Milestone" />
                      )}
                      <th style={erpListStickyActionThStyle(erpTheme, 80)}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {isDataLoading ? (
                      <tr>
                        <td
                          colSpan={20}
                          style={{ padding: 80, textAlign: "center" }}
                        >
                          <Center>
                            <Stack align="center" gap="sm">
                              <Loader size="lg" color={primary} />
                              <Text
                                c="dimmed"
                                size="sm"
                                style={{ fontFamily: V0_FONT_SANS }}
                              >
                                Loading export bookings...
                              </Text>
                            </Stack>
                          </Center>
                        </td>
                      </tr>
                    ) : tableRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={20}
                          style={{ padding: 60, textAlign: "center" }}
                        >
                          <Stack align="center" gap="md">
                            <Box
                              style={{
                                width: 48,
                                height: 48,
                                borderRadius: "50%",
                                backgroundColor: "#f1f5f9",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <IconPackage size={24} color={muted} />
                            </Box>
                            <Box>
                              <Text fw={500} c={fg}>
                                No bookings found
                              </Text>
                              <Text size="sm" c={muted} mt={4}>
                                Try adjusting your search or filters
                              </Text>
                            </Box>
                          </Stack>
                        </td>
                      </tr>
                    ) : (
                      tableRows.map((booking) => {
                        const pw = getRowPW(booking);
                        const lastMs = getLastMilestoneStep(booking);
                        const LastMilestoneColIcon = lastMs.Icon;
                        const lastMilestoneWhen = getLastMilestoneWhen(booking);
                        const oc =
                          booking.origin_code_read || booking.origin_code || "";
                        const dc =
                          booking.destination_code_read ||
                          booking.destination_code ||
                          "";
                        const sel = selectedIds.includes(booking.id);
                        return (
                          <tr
                            key={booking.id}
                            style={{
                              borderBottom: `1px solid ${border}`,
                              backgroundColor: sel ? `${primary}08` : undefined,
                              transition: "background 0.12s",
                            }}
                            onMouseEnter={(e) => {
                              if (!sel)
                                (
                                  e.currentTarget as HTMLTableRowElement
                                ).style.backgroundColor = "#f8fafc";
                            }}
                            onMouseLeave={(e) => {
                              if (!sel)
                                (
                                  e.currentTarget as HTMLTableRowElement
                                ).style.backgroundColor = "";
                            }}
                          >
                            {/* <td style={{ padding: "10px 14px" }}>
                                <Checkbox size="xs" checked={sel} onChange={() => { toggleRow(booking.id); }} />
                              </td> */}
                            {visibleColumns.sno && (
                              <td style={bodyTdStyle()}>
                                <Text fw={600} size="sm" c={fg}>
                                  {booking.sno}
                                </Text>
                              </td>
                            )}
                            {visibleColumns.shipment && (
                              <td style={bodyTdStyle()}>
                                <Text fw={600} size="sm" c={fg}>
                                  {booking.shipment_code}
                                </Text>
                                {booking.enquiry_id ? (
                                  <Text fz={10} c={muted}>
                                    {booking.enquiry_id}
                                  </Text>
                                ) : null}
                              </td>
                            )}
                            {visibleColumns.houseno && (
                              <td style={bodyTdStyle({ color: muted })}>
                                {booking.houseno ? booking.houseno : "—"}
                              </td>
                            )}
                            {visibleColumns.customer && (
                              <td style={bodyTdStyle({ maxWidth: 200 })}>
                                <Tooltip
                                  label={booking.customer_name ?? ""}
                                  withArrow
                                  styles={{
                                    tooltip: {
                                      fontFamily: V0_FONT_SANS,
                                      fontSize: 12,
                                    },
                                  }}
                                >
                                  <Text
                                    size="sm"
                                    c={fg}
                                    lineClamp={1}
                                    style={{ cursor: "default" }}
                                  >
                                    {booking.customer_name ?? "—"}
                                  </Text>
                                </Tooltip>
                              </td>
                            )}
                            {visibleColumns.date && (
                              <td style={bodyTdStyle({ color: muted })}>
                                {booking.date
                                  ? dayjs(booking.date).format("DD MMM")
                                  : "—"}
                              </td>
                            )}
                            {visibleColumns.route && (
                              <td style={bodyTdStyle()}>
                                <Group gap={6} wrap="nowrap">
                                  <Text fw={600} size="sm" c={primary}>
                                    {oc || "—"}
                                  </Text>
                                  <IconArrowRight size={12} color={muted} />
                                  <Text fw={500} size="sm" c={fg}>
                                    {dc || "—"}
                                  </Text>
                                </Group>
                              </td>
                            )}
                            {visibleColumns.status && (
                              <td style={bodyTdStyle()}>
                                <StatusPill status={booking.status} />
                              </td>
                            )}
                            {visibleColumns.job_no && (
                              <td
                                className={INLAND_EXPORT_GEIST_MONO_CLASS}
                                style={{
                                  ...bodyTdStyle({ color: muted }),
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {formatDisplayJobId(booking.job_no, booking.service_code) || "—"}
                              </td>
                            )}
                            {visibleColumns.volume && (
                              <td style={bodyTdStyle({ color: muted })}>
                                {getBookingRowAirVolume(booking.cargo_details)}
                              </td>
                            )}
                            {visibleColumns.mawb && (
                              <td
                                className={INLAND_EXPORT_GEIST_MONO_CLASS}
                                style={bodyTdStyle({
                                  fontSize: 12,
                                  color: muted,
                                })}
                              >
                                {booking.mawb_no ? (
                                  <Text size="xs" fw={500} c={fg}>
                                    {booking.mawb_no}
                                  </Text>
                                ) : (
                                  <Text size="sm" c={muted}>
                                    —
                                  </Text>
                                )}
                              </td>
                            )}
                            {visibleColumns.flight && (
                              <td style={bodyTdStyle()}>
                                {booking.flight_no ? (
                                  <Text size="xs" fw={500} c={fg}>
                                    {booking.flight_no}
                                  </Text>
                                ) : (
                                  <Text size="sm" c={muted}>
                                    —
                                  </Text>
                                )}
                              </td>
                            )}
                            {visibleColumns.pieces && (
                              <td
                                style={bodyTdStyle({
                                  align: "right",
                                  fontSize: 14,
                                  color: muted,
                                })}
                              >
                                {pw.pieces}
                              </td>
                            )}
                            {visibleColumns.weight && (
                              <td
                                style={bodyTdStyle({
                                  align: "right",
                                  fontSize: 14,
                                  fontWeight: 500,
                                  color: fg,
                                })}
                              >
                                {pw.weight.toFixed(1)}
                              </td>
                            )}
                            {visibleColumns.handler && (
                              <td style={bodyTdStyle()}>
                                <Group gap={8} wrap="nowrap">
                                  <Box
                                    style={{
                                      width: 24,
                                      height: 24,
                                      borderRadius: "50%",
                                      backgroundColor: `${primary}1a`,
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      flexShrink: 0,
                                    }}
                                  >
                                    <Text fz={10} fw={600} c={primary}>
                                      {initials(booking.customer_service_name)}
                                    </Text>
                                  </Box>
                                  <Text
                                    size="xs"
                                    c={muted}
                                    lineClamp={1}
                                    maw={100}
                                  >
                                    {firstName(booking.customer_service_name)}
                                  </Text>
                                </Group>
                              </td>
                            )}
                            {visibleColumns.lastMilestone && (
                              <td
                                style={bodyTdStyle({
                                  maxWidth: 260,
                                  verticalAlign: "top",
                                })}
                              >
                                <Box
                                  component="button"
                                  type="button"
                                  onClick={() => setMilestoneDrawerRow(booking)}
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: "22px minmax(0, 1fr)",
                                    columnGap: 8,
                                    rowGap: 4,
                                    alignItems: "start",
                                    justifyItems: "stretch",
                                    width: "100%",
                                    margin: 0,
                                    padding: "4px 0",
                                    fontFamily: V0_FONT_SANS,
                                    cursor: "pointer",
                                    textAlign: "left",
                                    background: "transparent",
                                    border: "none",
                                    boxShadow: "none",
                                    transition: "opacity 0.12s",
                                  }}
                                  onMouseEnter={(e) => {
                                    (
                                      e.currentTarget as HTMLButtonElement
                                    ).style.opacity = "0.82";
                                  }}
                                  onMouseLeave={(e) => {
                                    (
                                      e.currentTarget as HTMLButtonElement
                                    ).style.opacity = "1";
                                  }}
                                >
                                  <Box
                                    style={{
                                      gridColumn: 1,
                                      gridRow: 1,
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      width: 22,
                                      paddingTop: 2,
                                    }}
                                    aria-hidden
                                  >
                                    <LastMilestoneColIcon
                                      size={15}
                                      color={lastMs.accent}
                                      stroke={2}
                                    />
                                  </Box>
                                  <Text
                                    component="span"
                                    size="sm"
                                    fw={600}
                                    c={lastMs.accent}
                                    lh={1.35}
                                    style={{
                                      gridColumn: 2,
                                      gridRow: 1,
                                      minWidth: 0,
                                      textAlign: "left",
                                    }}
                                  >
                                    {getLastMilestoneDisplayLabel(booking)}
                                  </Text>
                                  <Text
                                    size="xs"
                                    lh={1.35}
                                    style={{
                                      gridColumn: 2,
                                      gridRow: 2,
                                      minWidth: 0,
                                      textAlign: "left",
                                      color:
                                        lastMilestoneWhen === "—"
                                          ? muted
                                          : rgbaFromHex(lastMs.accent, 0.92),
                                      fontWeight:
                                        lastMilestoneWhen === "—" ? 400 : 500,
                                    }}
                                  >
                                    {lastMilestoneWhen}
                                  </Text>
                                </Box>
                              </td>
                            )}
                            <td style={erpListStickyActionTdStyle(erpTheme)}>
                              <RowMenu row={booking} />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              ),
            }}
          />
        )}

        {/* ===== MILESTONE TIMELINE DRAWER ===== */}
        <Drawer
          opened={!!milestoneDrawerRow}
          onClose={() => setMilestoneDrawerRow(null)}
          position="right"
          size="md"
          title={
            milestoneDrawerRow ? (
              <Stack gap={2}>
                <Text fw={700} size="md" c={fg}>
                  {milestoneDrawerRow.shipment_code}
                </Text>
                {milestoneDrawerRow.enquiry_id ? (
                  <Text size="xs" c="dimmed">
                    {milestoneDrawerRow.enquiry_id}
                  </Text>
                ) : null}
              </Stack>
            ) : null
          }
          classNames={{
            content: INLAND_EXPORT_GEIST_ROOT_CLASS,
            body: INLAND_EXPORT_GEIST_ROOT_CLASS,
            header: INLAND_EXPORT_GEIST_ROOT_CLASS,
          }}
          styles={{
            content: { fontFamily: V0_FONT_SANS },
            body: { fontFamily: V0_FONT_SANS },
            header: { fontFamily: V0_FONT_SANS },
          }}
        >
          {milestoneDrawerRow ? (
            <Stack gap="md">
              <Text fw={600} size="sm" c={fg}>
                Route milestones
              </Text>
              <Stack gap={0}>
                {(() => {
                  const row = milestoneDrawerRow;
                  const api = row.route_milestones;
                  if (api && api.length > 0) {
                    const activeIdx = getRouteMilestonesActiveIndex(api, row);
                    return api.map((rm, i) => (
                      <MilestoneDrawerStepRow
                        key={`${rm.code}-${i}`}
                        step={getExportMilestoneStyleByIndex(
                          mapMilestoneCodeToIndex(rm.code),
                        )}
                        displayLabel={rm.label}
                        detail={rm.note?.trim() ? rm.note : "—"}
                        when={formatRouteMilestoneWhen(rm)}
                        i={i}
                        total={api.length}
                        activeIdx={activeIdx}
                        currentStageHint=""
                        fg={fg}
                        muted={muted}
                        primary={primary}
                        border={border}
                        bg={bg}
                      />
                    ));
                  }
                  const activeIdx = getLastMilestoneIndex(row);
                  return EXPORT_MILESTONES.map((step, i) => {
                    const { detail, when } = getMilestoneDrawerDetail(row, i);
                    return (
                      <MilestoneDrawerStepRow
                        key={step.label}
                        step={step}
                        displayLabel={step.label}
                        detail={detail}
                        when={when}
                        i={i}
                        total={EXPORT_MILESTONES.length}
                        activeIdx={activeIdx}
                        currentStageHint=""
                        fg={fg}
                        muted={muted}
                        primary={primary}
                        border={border}
                        bg={bg}
                      />
                    );
                  });
                })()}
              </Stack>
            </Stack>
          ) : null}
        </Drawer>

        {/* ===== CANCEL MODAL ===== */}
        <Modal
          opened={!!cancelConfirmRow}
          onClose={() => !isCancelling && setCancelConfirmRow(null)}
          title={
            <Text fw={600} size="md">
              Cancel Booking
            </Text>
          }
          centered
          size="sm"
          styles={v0ModalStyles}
          classNames={v0ModalClassNames}
        >
          <Text size="sm" c="dimmed" mb="md">
            Are you sure you want to cancel booking{" "}
            <Text span fw={600} c={fg}>
              {cancelConfirmRow?.shipment_code}
            </Text>
            ? This action cannot be undone.
          </Text>
          <Group justify="flex-end" gap={8}>
            <Button
              variant="default"
              onClick={() => setCancelConfirmRow(null)}
              disabled={isCancelling}
            >
              Keep Booking
            </Button>
            <Button
              color="red"
              onClick={handleConfirmCancel}
              loading={isCancelling}
            >
              Cancel Booking
            </Button>
          </Group>
        </Modal>

        <Drawer
          opened={lastBookingsDrawerOpened}
          onClose={handleCloseLastBookingsDrawer}
          position="right"
          size="70%"
          title="Last Bookings"
          titleProps={{ style: { fontWeight: "bold" } }}
          classNames={v0ModalClassNames}
          styles={v0ModalStyles}
        >
          <LastBookingsList
            service="INLAND"
            serviceType="EXPORT"
            customerCode={duplicateCustomerCode}
            onRowSelect={(row) => {
              const bookingId = row.id as string | number | undefined;
              if (bookingId == null) {
                ToastNotification({
                  type: "error",
                  message: "Selected booking has no id.",
                });
                return;
              }
              handleCloseLastBookingsDrawer();
              void navigateBookingDuplicate({
                bookingId,
                navigate,
                persistListState,
                onStart: () => setIsDuplicatingBooking(true),
                onEnd: () => setIsDuplicatingBooking(false),
              });
            }}
          />
        </Drawer>

        <BookingCreateJobLoader
          active={createJobBookingId != null || isDuplicatingBooking}
          message={
            isDuplicatingBooking
              ? "Preparing duplicate booking…"
              : undefined
          }
        />
        <Outlet />
      </Box>
    </MantineProvider>
  );
}

export default InlandExportBookingMaster;
