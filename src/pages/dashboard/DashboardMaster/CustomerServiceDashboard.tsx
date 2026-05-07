import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Drawer,
  Flex,
  Group,
  Loader,
  Paper,
  RingProgress,
  ScrollArea,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Tabs,
  Text,
  TextInput,
  ThemeIcon,
  Tooltip,
} from "@mantine/core";
import {
  IconAlertTriangle,
  IconArrowRight,
  IconBellRinging,
  IconCalendarDue,
  IconCheck,
  IconChevronRight,
  IconClockHour4,
  IconDownload,
  IconFileInvoice,
  IconMail,
  IconPhone,
  IconPlane,
  IconRefresh,
  IconSearch,
  IconShip,
  IconTruckDelivery,
  IconUserCircle,
  IconX,
} from "@tabler/icons-react";
import dayjs from "dayjs";
import { apiCallProtected } from "../../../api/axios";
import { URL } from "../../../api/serverUrls";

type SummaryBucket = {
  label: string;
  title: string;
  count: number;
  unit: string;
  color: string;
  bands: {
    label: string;
    value: number;
    tone: "neutral" | "warning" | "danger";
  }[];
  trendText?: string;
  trendDirection?: "up" | "down" | "flat";
  footer?: string;
};

type CustomerServiceSummary = {
  updatedAgo: string;
  breachedShipments: number;
  breachText: string;
  export: SummaryBucket;
  import: SummaryBucket;
  billing: SummaryBucket;
  exceptions: SummaryBucket;
  activeShipments: number;
  documentsPending: number;
  slaCompliance: number;
  averageResponseTime: string;
  teamWorkload: WorkloadRow[];
  followUps: FollowUpRow[];
};

type ShipmentStatus = "on_track" | "at_risk" | "breached";

type ShipmentRow = {
  id: string;
  refType: string;
  reference: string;
  houseReference?: string;
  bookingReference?: string;
  customer: string;
  customerCode?: string;
  laneFrom: string;
  laneTo: string;
  laneName?: string;
  mode: "Ocean FCL" | "Ocean LCL" | "Air Freight" | string;
  segment: "Export" | "Import" | string;
  stage: string;
  progress: number;
  eta: string;
  etaStatus: string;
  daysPending: number;
  owner: string;
  ownerInitials: string;
  ownerRole?: string;
  status: ShipmentStatus;
  vessel?: string;
  container?: string;
  shipper?: string;
  consignee?: string;
  incoterm?: string;
  invoiceValue?: string;
  packageInfo?: string;
  weightVolume?: string;
  currentStatusDetail?: string;
  lastChase?: string;
  documents?: DocumentRow[];
  timeline?: TimelineRow[];
  comms?: CommunicationRow[];
};

type DocumentRow = {
  name: string;
  meta: string;
  status: "Ready" | "Submitted" | "Filed" | "Pending" | "Missing";
};

type TimelineRow = {
  title: string;
  detail: string;
  state: "done" | "active" | "pending";
};

type CommunicationRow = {
  channel: "Email" | "Phone" | "Note";
  text: string;
  time: string;
};

type WorkloadRow = {
  name: string;
  role: string;
  initials: string;
  count: number;
  tone: string;
};

type FollowUpRow = {
  text: string;
  due: string;
  overdue?: boolean;
};

type FilterState = {
  queue: string;
  segment: string;
  mode: string;
  owner: string;
  status: string;
  search: string;
};

type CustomerServiceDashboardProps = {
  fromDate?: Date | null;
  toDate?: Date | null;
  globalSearch?: string;
};

const PAGE_BG = "#f4f7fb";
const NAVY = "#0b2341";
const INK = "#172033";
const MUTED = "#64748b";
const BORDER = "#e5eaf2";
const SUCCESS = "#16a34a";
const WARNING = "#f59e0b";
const DANGER = "#e11d48";
const INFO = "#0ea5e9";

const DEFAULT_FILTERS: FilterState = {
  queue: "pending-bl-awb",
  segment: "All",
  mode: "All",
  owner: "All",
  status: "All",
  search: "",
};

const SAMPLE_DOCUMENTS: DocumentRow[] = [
  { name: "Commercial Invoice", meta: "INV-2104887 · PDF · 2.1MB", status: "Ready" },
  { name: "Packing List", meta: "PL-2104887 · PDF · 880KB", status: "Ready" },
  { name: "Shipping Instruction", meta: "SI submitted to Maersk · Apr 08", status: "Submitted" },
  { name: "VGM Declaration", meta: "14,240 kg · Declared Apr 09 09:15", status: "Filed" },
  { name: "Master Bill of Lading", meta: "Awaiting carrier · Draft received Apr 18", status: "Pending" },
  { name: "House BL (HBL)", meta: "Will issue after MBL confirmation", status: "Pending" },
  { name: "Certificate of Origin", meta: "Not yet received from shipper", status: "Missing" },
];

const SAMPLE_TIMELINE: TimelineRow[] = [
  { title: "Booking confirmed", detail: "Apr 02, 10:14 · Maersk MAEU240915", state: "done" },
  { title: "Cargo gated in at origin port", detail: "Apr 08, 16:48 · Shanghai Yangshan Terminal", state: "done" },
  { title: "Loaded on vessel · MV Nordic Breeze V.2405W", detail: "Apr 10, 03:22 · SLA & VGM filed", state: "done" },
  {
    title: "BL / AWB release pending",
    detail: "Since Apr 18, 11:00 · 6 days open · Aging critical",
    state: "active",
  },
  { title: "Vessel arrival at destination", detail: "Scheduled May 12", state: "pending" },
  { title: "Delivery & POD", detail: "-", state: "pending" },
  { title: "Invoice raised", detail: "-", state: "pending" },
];

const SAMPLE_COMMS: CommunicationRow[] = [
  {
    channel: "Email",
    text: "Chased carrier for draft BL confirmation and customer escalation note.",
    time: "Today 10:42",
  },
  {
    channel: "Phone",
    text: "Customer service called origin desk; carrier reply expected by EOD.",
    time: "Yesterday 17:15",
  },
  {
    channel: "Note",
    text: "Customer approved draft with spelling correction. Awaiting OBL dispatch.",
    time: "Apr 21 13:05",
  },
];

const SAMPLE_ROWS: ShipmentRow[] = [
  {
    id: "MBL-2104887",
    refType: "EXP",
    reference: "MBL-2104887",
    houseReference: "HBL-PEN-77120",
    bookingReference: "BKG-44821",
    customer: "Acme Electronics Corp.",
    customerCode: "ACME-044",
    laneFrom: "SHA",
    laneTo: "LAX",
    laneName: "Shanghai - Los Angeles",
    mode: "Ocean FCL",
    segment: "Export",
    stage: "BL release pending",
    progress: 72,
    eta: "May 12",
    etaStatus: "ETA slipped 2d",
    daysPending: 6,
    owner: "Priya Raman",
    ownerInitials: "PR",
    ownerRole: "Customer Service · Ocean FCL Desk",
    status: "breached",
    vessel: "MV Nordic Breeze · V.2405W",
    container: "MSCU7728190",
    shipper: "Longhai Trading Co.",
    consignee: "Acme Electronics Corp.",
    incoterm: "FOB Shanghai",
    invoiceValue: "USD 182,400",
    packageInfo: "1 x 40 HC · 420 CTN",
    weightVolume: "14,240 kg · 28.4 CBM",
    currentStatusDetail:
      "Awaiting carrier confirmation. Last chase Apr 22, 14:30 to Priya Raman. Customer requested update via email 3h ago.",
    lastChase: "3h ago",
    documents: SAMPLE_DOCUMENTS,
    timeline: SAMPLE_TIMELINE,
    comms: SAMPLE_COMMS,
  },
  {
    id: "AWB-176-2291883",
    refType: "IMP",
    reference: "AWB-176-2291883",
    houseReference: "HAWB-PEN-99214",
    customer: "Nordex GmbH",
    customerCode: "NDX-012",
    laneFrom: "FRA",
    laneTo: "ORD",
    laneName: "Frankfurt - Chicago",
    mode: "Air Freight",
    segment: "Import",
    stage: "HAWB awaiting stamp",
    progress: 66,
    eta: "Apr 28",
    etaStatus: "On time",
    daysPending: 5,
    owner: "Sofia Krause",
    ownerInitials: "SK",
    ownerRole: "Customer Service · Air Desk",
    status: "breached",
    currentStatusDetail: "Awaiting HAWB stamp from destination agent. Follow-up due today.",
  },
  {
    id: "MBL-3301120",
    refType: "EXP",
    reference: "MBL-3301120",
    houseReference: "HBL-PEN-77304",
    customer: "Pacifica Foods Inc.",
    customerCode: "PAC-008",
    laneFrom: "OAK",
    laneTo: "YOK",
    laneName: "Oakland - Yokohama",
    mode: "Ocean FCL",
    segment: "Export",
    stage: "Awaiting OBL courier",
    progress: 70,
    eta: "May 18",
    etaStatus: "On time",
    daysPending: 7,
    owner: "Priya Raman",
    ownerInitials: "PR",
    ownerRole: "Customer Service · Ocean FCL Desk",
    status: "breached",
    currentStatusDetail: "OBL courier booking pending; consignee has requested scan copy.",
  },
  {
    id: "MBL-2104902",
    refType: "EXP",
    reference: "MBL-2104902",
    houseReference: "HBL-PEN-77188",
    customer: "Brightway Retail Ltd.",
    customerCode: "BRW-077",
    laneFrom: "SIN",
    laneTo: "LGB",
    laneName: "Singapore - Long Beach",
    mode: "Ocean FCL",
    segment: "Export",
    stage: "Telex release requested",
    progress: 58,
    eta: "May 09",
    etaStatus: "On time",
    daysPending: 6,
    owner: "Arjun Kapoor",
    ownerInitials: "AK",
    ownerRole: "Team Lead",
    status: "breached",
  },
  {
    id: "MBL-4482210",
    refType: "EXP",
    reference: "MBL-4482210",
    houseReference: "HBL-PEN-77422",
    customer: "TransAtlas Motors",
    customerCode: "TAM-091",
    laneFrom: "HAM",
    laneTo: "CHS",
    laneName: "Hamburg - Charleston",
    mode: "Ocean FCL",
    segment: "Export",
    stage: "BL draft in review",
    progress: 46,
    eta: "May 02",
    etaStatus: "On time",
    daysPending: 3,
    owner: "Priya Raman",
    ownerInitials: "PR",
    status: "at_risk",
  },
  {
    id: "AWB-014-55710928",
    refType: "EXP",
    reference: "AWB-014-55710928",
    customer: "Vesta Cosmetics",
    customerCode: "VES-033",
    laneFrom: "CDG",
    laneTo: "JFK",
    laneName: "Paris - New York",
    mode: "Air Freight",
    segment: "Export",
    stage: "AWB release requested",
    progress: 78,
    eta: "Apr 26",
    etaStatus: "On time",
    daysPending: 4,
    owner: "Sofia Krause",
    ownerInitials: "SK",
    status: "at_risk",
  },
  {
    id: "MBL-7781240",
    refType: "IMP",
    reference: "MBL-7781240",
    houseReference: "HBL-PEN-77510",
    customer: "Helix BioSciences",
    customerCode: "HLX-019",
    laneFrom: "BCN",
    laneTo: "MIA",
    laneName: "Barcelona - Miami",
    mode: "Ocean LCL",
    segment: "Import",
    stage: "Awaiting consolidation",
    progress: 54,
    eta: "May 14",
    etaStatus: "On time",
    daysPending: 2,
    owner: "Lena Chen",
    ownerInitials: "LC",
    status: "on_track",
  },
  {
    id: "MBL-5520198",
    refType: "EXP",
    reference: "MBL-5520198",
    houseReference: "HBL-PEN-77601",
    customer: "Orion Textiles",
    customerCode: "ORI-056",
    laneFrom: "BOM",
    laneTo: "RTM",
    laneName: "Mumbai - Rotterdam",
    mode: "Ocean FCL",
    segment: "Export",
    stage: "OBL printing",
    progress: 62,
    eta: "May 20",
    etaStatus: "On time",
    daysPending: 1,
    owner: "Arjun Kapoor",
    ownerInitials: "AK",
    status: "on_track",
  },
];

const SAMPLE_SUMMARY: CustomerServiceSummary = {
  updatedAgo: "47 sec ago",
  breachedShipments: 4,
  breachText:
    "BL release >5 days aging for Acme Electronics, Nordex GmbH, Pacifica Foods & Brightway Retail. Customer escalation risk.",
  export: {
    label: "Export",
    title: "BL / AWB Release Pending",
    count: 23,
    unit: "shipments",
    color: INFO,
    bands: [
      { label: "0-2D", value: 11, tone: "neutral" },
      { label: "3-5D", value: 8, tone: "warning" },
      { label: ">5D", value: 4, tone: "danger" },
    ],
    trendText: "+3 since yesterday",
    trendDirection: "up",
  },
  import: {
    label: "Import",
    title: "CAN / DO Pending",
    count: 17,
    unit: "shipments",
    color: "#7c3aed",
    bands: [
      { label: "0-2D", value: 9, tone: "neutral" },
      { label: "3-5D", value: 6, tone: "warning" },
      { label: ">5D", value: 2, tone: "danger" },
    ],
    trendText: "-2 since yesterday",
    trendDirection: "down",
  },
  billing: {
    label: "Billing",
    title: "Invoice Not Raised",
    count: 31,
    unit: "jobs",
    color: WARNING,
    bands: [
      { label: "0-3D", value: 18, tone: "neutral" },
      { label: "4-7D", value: 9, tone: "warning" },
      { label: ">7D", value: 4, tone: "danger" },
    ],
    footer: "$184.2K unbilled",
  },
  exceptions: {
    label: "Urgent",
    title: "Exceptions & Delays",
    count: 12,
    unit: "active",
    color: DANGER,
    bands: [
      { label: "ETA slip", value: 5, tone: "neutral" },
      { label: "Customs", value: 4, tone: "warning" },
      { label: "On hold", value: 3, tone: "danger" },
    ],
    trendText: "+4 need escalation",
    trendDirection: "up",
  },
  activeShipments: 147,
  documentsPending: 9,
  slaCompliance: 91.4,
  averageResponseTime: "42 min",
  teamWorkload: [
    { name: "Priya Raman", role: "Ocean FCL", initials: "PR", count: 28, tone: INFO },
    { name: "Marcus Tan", role: "Import", initials: "MT", count: 22, tone: "#6366f1" },
    { name: "Sofia Krause", role: "Air Freight", initials: "SK", count: 44, tone: WARNING },
    { name: "Arjun Kapoor", role: "Team Lead", initials: "AK", count: 25, tone: "#14b8a6" },
    { name: "Lena Chen", role: "LCL Desk", initials: "LC", count: 35, tone: "#ec4899" },
    { name: "Diego Navarro", role: "EU Ocean", initials: "DN", count: 18, tone: "#4f46e5" },
  ],
  followUps: [
    { text: "Chase Maersk agent for BL release - Acme Electronics", due: "Overdue", overdue: true },
    { text: "Send revised CAN to Brightway Retail - Rotterdam import", due: "Due in 2h" },
    { text: "Confirm invoice approval for Vesta Cosmetics", due: "Today" },
    { text: "Escalate missing COO from Pacifica Foods", due: "Overdue", overdue: true },
  ],
};

const queueOptions = [
  { value: "pending-bl-awb", label: "Pending BL/AWB" },
  { value: "pending-can-do", label: "Pending CAN/DO" },
  { value: "invoice-pending", label: "Invoice Pending" },
  // { value: "exceptions", label: "Exceptions" },
  // { value: "live-shipments", label: "Live Shipments" },
];

function safeNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function deriveInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "CS";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function normalizeBucket(raw: unknown, fallback: SummaryBucket): SummaryBucket {
  const record = (raw ?? {}) as Record<string, unknown>;
  const bandsRaw = Array.isArray(record.bands)
    ? record.bands
    : Array.isArray(record.aging)
      ? record.aging
      : [];

  return {
    ...fallback,
    label: firstString(record.label, record.type, fallback.label),
    title: firstString(record.title, record.name, fallback.title),
    count: safeNumber(record.count ?? record.total ?? record.value, fallback.count),
    unit: firstString(record.unit, fallback.unit),
    color: firstString(record.color, fallback.color),
    bands:
      bandsRaw.length > 0
        ? bandsRaw.map((band, index) => {
            const item = (band ?? {}) as Record<string, unknown>;
            return {
              label: firstString(item.label, item.name, fallback.bands[index]?.label ?? ""),
              value: safeNumber(item.value ?? item.count, fallback.bands[index]?.value ?? 0),
              tone:
                item.tone === "danger" || item.tone === "warning" || item.tone === "neutral"
                  ? item.tone
                  : fallback.bands[index]?.tone ?? "neutral",
            };
          })
        : fallback.bands,
    trendText: firstString(record.trendText, record.trend, fallback.trendText),
    trendDirection:
      record.trendDirection === "up" || record.trendDirection === "down" || record.trendDirection === "flat"
        ? record.trendDirection
        : fallback.trendDirection,
    footer: firstString(record.footer, fallback.footer),
  };
}

function normalizeSummary(raw: unknown): CustomerServiceSummary {
  const root = (raw ?? {}) as Record<string, unknown>;
  const data = ((root.data ?? root.summary ?? root) ?? {}) as Record<string, unknown>;
  return {
    updatedAgo: firstString(data.updatedAgo, data.updated_ago, data.last_updated, SAMPLE_SUMMARY.updatedAgo),
    breachedShipments: safeNumber(
      data.breachedShipments ?? data.breached_shipments ?? data.breached_count,
      SAMPLE_SUMMARY.breachedShipments,
    ),
    breachText: firstString(data.breachText, data.breach_text, data.alert, SAMPLE_SUMMARY.breachText),
    export: normalizeBucket(data.export ?? data.Export, SAMPLE_SUMMARY.export),
    import: normalizeBucket(data.import ?? data.Import, SAMPLE_SUMMARY.import),
    billing: normalizeBucket(data.billing ?? data.Billing, SAMPLE_SUMMARY.billing),
    exceptions: normalizeBucket(data.exceptions ?? data.Exceptions, SAMPLE_SUMMARY.exceptions),
    activeShipments: safeNumber(data.activeShipments ?? data.active_shipments, SAMPLE_SUMMARY.activeShipments),
    documentsPending: safeNumber(data.documentsPending ?? data.documents_pending, SAMPLE_SUMMARY.documentsPending),
    slaCompliance: safeNumber(data.slaCompliance ?? data.sla_compliance, SAMPLE_SUMMARY.slaCompliance),
    averageResponseTime: firstString(
      data.averageResponseTime,
      data.average_response_time,
      SAMPLE_SUMMARY.averageResponseTime,
    ),
    teamWorkload: Array.isArray(data.teamWorkload)
      ? data.teamWorkload.map((item, index) => {
          const row = (item ?? {}) as Record<string, unknown>;
          const name = firstString(row.name, row.owner, SAMPLE_SUMMARY.teamWorkload[index]?.name);
          return {
            name,
            role: firstString(row.role, row.desk, SAMPLE_SUMMARY.teamWorkload[index]?.role),
            initials: firstString(row.initials, deriveInitials(name)),
            count: safeNumber(row.count ?? row.shipments, SAMPLE_SUMMARY.teamWorkload[index]?.count ?? 0),
            tone: firstString(row.tone, row.color, SAMPLE_SUMMARY.teamWorkload[index]?.tone ?? INFO),
          };
        })
      : SAMPLE_SUMMARY.teamWorkload,
    followUps: Array.isArray(data.followUps)
      ? data.followUps.map((item, index) => {
          const row = (item ?? {}) as Record<string, unknown>;
          return {
            text: firstString(row.text, row.title, SAMPLE_SUMMARY.followUps[index]?.text),
            due: firstString(row.due, row.dueText, SAMPLE_SUMMARY.followUps[index]?.due),
            overdue: Boolean(row.overdue),
          };
        })
      : SAMPLE_SUMMARY.followUps,
  };
}

function normalizeShipment(raw: unknown, index: number): ShipmentRow {
  const row = (raw ?? {}) as Record<string, unknown>;
  const customer = firstString(
    row.customer,
    row.customer_name,
    (row.customer_details as Record<string, unknown> | undefined)?.customer_name,
    SAMPLE_ROWS[index % SAMPLE_ROWS.length].customer,
  );
  const owner = firstString(row.owner, row.assigned_to, row.salesperson, SAMPLE_ROWS[index % SAMPLE_ROWS.length].owner);
  const segment = firstString(row.segment, row.trade, row.service_type, SAMPLE_ROWS[index % SAMPLE_ROWS.length].segment);
  const statusText = firstString(row.status, row.sla_status, SAMPLE_ROWS[index % SAMPLE_ROWS.length].status);
  const status: ShipmentStatus =
    statusText.toLowerCase().includes("breach") || safeNumber(row.daysPending ?? row.days_pending) > 5
      ? "breached"
      : statusText.toLowerCase().includes("risk")
        ? "at_risk"
        : "on_track";

  return {
    ...SAMPLE_ROWS[index % SAMPLE_ROWS.length],
    id: firstString(row.id, row.job_id, row.reference, row.mbl_no, row.awb_no, SAMPLE_ROWS[index % SAMPLE_ROWS.length].id),
    refType: firstString(row.refType, row.ref_type, segment.slice(0, 3).toUpperCase()),
    reference: firstString(row.reference, row.job_id, row.mbl_no, row.awb_no, SAMPLE_ROWS[index % SAMPLE_ROWS.length].reference),
    houseReference: firstString(row.houseReference, row.house_reference, row.hbl_no, row.houseno, SAMPLE_ROWS[index % SAMPLE_ROWS.length].houseReference),
    bookingReference: firstString(row.bookingReference, row.booking_reference, row.booking_id, SAMPLE_ROWS[index % SAMPLE_ROWS.length].bookingReference),
    customer,
    customerCode: firstString(row.customerCode, row.customer_code, SAMPLE_ROWS[index % SAMPLE_ROWS.length].customerCode),
    laneFrom: firstString(row.laneFrom, row.origin_code, row.origin, SAMPLE_ROWS[index % SAMPLE_ROWS.length].laneFrom),
    laneTo: firstString(row.laneTo, row.destination_code, row.destination, SAMPLE_ROWS[index % SAMPLE_ROWS.length].laneTo),
    laneName: firstString(row.laneName, row.lane, SAMPLE_ROWS[index % SAMPLE_ROWS.length].laneName),
    mode: firstString(row.mode, row.service, row.shipment_mode, SAMPLE_ROWS[index % SAMPLE_ROWS.length].mode),
    segment,
    stage: firstString(row.stage, row.current_stage, row.event_name, SAMPLE_ROWS[index % SAMPLE_ROWS.length].stage),
    progress: Math.min(100, Math.max(0, safeNumber(row.progress, SAMPLE_ROWS[index % SAMPLE_ROWS.length].progress))),
    eta: firstString(row.eta, row.ETA, row.etd, SAMPLE_ROWS[index % SAMPLE_ROWS.length].eta),
    etaStatus: firstString(row.etaStatus, row.eta_status, SAMPLE_ROWS[index % SAMPLE_ROWS.length].etaStatus),
    daysPending: safeNumber(row.daysPending ?? row.days_pending ?? row.pending_days, SAMPLE_ROWS[index % SAMPLE_ROWS.length].daysPending),
    owner,
    ownerInitials: firstString(row.ownerInitials, row.owner_initials, deriveInitials(owner)),
    ownerRole: firstString(row.ownerRole, row.owner_role, SAMPLE_ROWS[index % SAMPLE_ROWS.length].ownerRole),
    status,
    currentStatusDetail: firstString(row.currentStatusDetail, row.current_status_detail, row.remarks, SAMPLE_ROWS[index % SAMPLE_ROWS.length].currentStatusDetail),
  };
}

function bandToneStyle(tone: SummaryBucket["bands"][number]["tone"]) {
  if (tone === "danger") return { background: "#ffe4ea", color: "#e11d48" };
  if (tone === "warning") return { background: "#fff4c2", color: "#b77905" };
  return { background: "#f8fafc", color: "#6b7280" };
}

function statusColor(status: ShipmentStatus) {
  if (status === "breached") return "#e11d48";
  if (status === "at_risk") return "#b77905";
  return "#16a34a";
}

function modeTone(mode: string) {
  return mode.toLowerCase().includes("air")
    ? { bg: "#fff8d6", color: "#8a6500", border: "#fff1a6", icon: <IconPlane size={14} /> }
    : { bg: "#e7f7ff", color: "#075985", border: "#d7f0fb", icon: <IconShip size={14} /> };
}

async function fetchSummary() {
  const response = await apiCallProtected.get(URL.dashboard.customerServiceDashboardSummary);
  return normalizeSummary(response.data);
}

async function fetchShipments(filters: FilterState, fromDate?: Date | null, toDate?: Date | null, globalSearch?: string) {
  const payload = {
    queue: filters.queue,
    segment: filters.segment === "All" ? undefined : filters.segment,
    mode: filters.mode === "All" ? undefined : filters.mode,
    owner: filters.owner === "All" ? undefined : filters.owner,
    status: filters.status === "All" ? undefined : filters.status,
    search: filters.search.trim() || globalSearch?.trim() || undefined,
    date_from: fromDate ? dayjs(fromDate).format("YYYY-MM-DD") : undefined,
    date_to: toDate ? dayjs(toDate).format("YYYY-MM-DD") : undefined,
    index: 0,
    limit: 50,
  };
  const response = await apiCallProtected.post(URL.dashboard.customerServiceDashboardShipments, payload);
  const body = response.data as { data?: unknown[]; results?: unknown[]; count?: number };
  const rows = Array.isArray(body.data) ? body.data : Array.isArray(body.results) ? body.results : [];
  return rows.map(normalizeShipment);
}

function MetricCard({
  bucket,
  loading,
  onClick,
}: {
  bucket: SummaryBucket;
  loading?: boolean;
  onClick?: () => void;
}) {
  const isInteractive = Boolean(onClick) && !loading;

  return (
    <Paper
      radius={10}
      p={0}
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={isInteractive ? onClick : undefined}
      onKeyDown={
        isInteractive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      style={{
        border: `1px solid ${BORDER}`,
        borderLeft: `4px solid ${bucket.color}`,
        boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
        minHeight: 188,
        overflow: "hidden",
        background: "#ffffff",
        cursor: isInteractive ? "pointer" : "default",
        transition: "transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease",
      }}
    >
      <Box px={20} py={18} h="100%">
        {loading ? (
          <Stack gap="sm" justify="space-between" h="100%">
            <Skeleton height={12} width="34%" />
            <Skeleton height={30} width="52%" />
            <Skeleton height={48} />
            <Skeleton height={10} width="42%" />
          </Stack>
        ) : (
          <Stack gap={0} justify="space-between" h="100%">
            <Box>
              <Text size="10px" tt="uppercase" fw={800} c="#a9b4c4" lts={1.1}>
                {bucket.label}
              </Text>
              <Text size="15px" fw={800} c={INK} mt={2}>
                {bucket.title}
              </Text>
            </Box>
            <Group align="baseline" gap={8} mt={12}>
              <Text size="38px" fw={800} c="#0f172a" lh={0.95}>
                {bucket.count}
              </Text>
              <Text size="13px" c="#475569">
                {bucket.unit}
              </Text>
            </Group>
            <SimpleGrid cols={3} spacing={8} mt={12}>
              {bucket.bands.map((band) => (
                <Box
                  key={`${bucket.title}-${band.label}`}
                  ta="center"
                  py={9}
                  style={{ borderRadius: 8, minHeight: 50, ...bandToneStyle(band.tone) }}
                >
                  <Text size="15px" fw={800} lh={1.1}>
                    {band.value}
                  </Text>
                  <Text size="10px" fw={700} mt={4} lh={1}>
                    {band.label}
                  </Text>
                </Box>
              ))}
            </SimpleGrid>
            <Group justify="space-between" gap="xs" mt={14}>
              <Text
                size="12px"
                c={bucket.trendDirection === "up" ? DANGER : bucket.trendDirection === "down" ? SUCCESS : MUTED}
                fw={600}
              >
                {bucket.trendDirection === "up" ? "▲ " : bucket.trendDirection === "down" ? "▼ " : ""}
                {bucket.trendText || bucket.footer || "Updated live"}
              </Text>
              <IconArrowRight size={14} color="#94a3b8" />
            </Group>
          </Stack>
        )}
      </Box>
    </Paper>
  );
}

function StatTile({
  title,
  value,
  subtitle,
  color,
}: {
  title: string;
  value: string;
  subtitle: string;
  color: string;
}) {
  return (
    <Paper radius={12} p={16} style={{ border: `1px solid ${BORDER}`, background: "#fff" }}>
      <Text size="10px" tt="uppercase" fw={800} c="#94a3b8" lts={0.8}>
        {title}
      </Text>
      <Group align="baseline" gap={8} mt={4}>
        <Text size="26px" fw={800} c={INK} lh={1}>
          {value}
        </Text>
      </Group>
      <Text size="11px" c={color} mt={6} fw={600}>
        {subtitle}
      </Text>
    </Paper>
  );
}

function QueueTabs({ value, onChange, counts }: { value: string; onChange: (value: string) => void; counts: Record<string, number> }) {
  return (
    <Group gap={6} p={0} style={{ flexWrap: "wrap" }}>
      {queueOptions.map((option) => (
        <Button
          key={option.value}
          variant="transparent"
          size="xs"
          radius={6}
          onClick={() => onChange(option.value)}
          styles={{
            root: {
              height: 30,
              color: value === option.value ? "#111827" : "#667085",
              background: value === option.value ? "#ffffff" : "transparent",
              border: value === option.value ? "1px solid #e6ebf2" : "1px solid transparent",
              boxShadow: value === option.value ? "0 4px 12px rgba(15, 23, 42, 0.08)" : "none",
              fontWeight: value === option.value ? 800 : 600,
              paddingInline: 10,
              fontSize: 12,
              letterSpacing: "-0.01em",
            },
          }}
          rightSection={
            <Badge
              size="xs"
              radius="xl"
              color={value === option.value ? "dark" : "gray"}
              styles={{
                root: {
                  height: 17,
                  minWidth: 22,
                  paddingInline: 7,
                  background: value === option.value ? NAVY : "#e9eef6",
                  color: value === option.value ? "#ffffff" : "#475569",
                },
              }}
            >
              {counts[option.value] ?? 0}
            </Badge>
          }
        >
          {option.label}
        </Button>
      ))}
    </Group>
  );
}

function ShipmentProgress({ progress, status }: { progress: number; status: ShipmentStatus }) {
  const filled = Math.max(1, Math.round(progress / 16.7));
  return (
    <Group gap={4} mt={6} wrap="nowrap">
      {Array.from({ length: 6 }).map((_, index) => (
        <Box
          key={index}
          h={4}
          w={20}
          style={{
            borderRadius: 99,
            background: index < filled ? "#12385b" : "#e3e8ef",
          }}
        />
      ))}
      <Box h={8} w={8} style={{ borderRadius: 99, background: status === "on_track" ? SUCCESS : WARNING, marginLeft: 0 }} />
    </Group>
  );
}

function OwnerAvatar({ initials, color = INFO, size = 30 }: { initials: string; color?: string; size?: number }) {
  return (
    <Flex
      align="center"
      justify="center"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        color: "#fff",
        fontSize: size > 28 ? 11 : 10,
        fontWeight: 800,
        flex: "0 0 auto",
      }}
    >
      {initials}
    </Flex>
  );
}

const SHIPMENT_COLUMNS = [
  { label: "Reference / Customer", width: 270 },
  { label: "Lane", width: 160 },
  { label: "Mode", width: 110 },
  { label: "Stage / Progress", width: 175 },
  { label: "ETA / ATA", width: 105 },
  { label: "Days Pending", width: 110 },
  { label: "Owner", width: 100 },
  { label: "Action", width: 85 },
] as const;

function ShipmentTable({
  rows,
  loading,
  onOpen,
  queueValue,
  onQueueChange,
  counts,
  searchValue,
  onSearchChange,
  totalRows,
}: {
  rows: ShipmentRow[];
  loading: boolean;
  onOpen: (row: ShipmentRow) => void;
  queueValue: string;
  onQueueChange: (value: string) => void;
  counts: Record<string, number>;
  searchValue: string;
  onSearchChange: (value: string) => void;
  totalRows: number;
}) {
  const displayRows = loading ? SAMPLE_ROWS.slice(0, 6) : rows;
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  return (
    <Paper
      radius={10}
      style={{
        border: "1px solid #e7ebf1",
        overflow: "hidden",
        background: "#fff",
        boxShadow: "0 12px 30px rgba(15, 23, 42, 0.045)",
      }}
    >
      <Flex
        px={16}
        py={10}
        justify="space-between"
        align="center"
        gap={10}
        wrap="wrap"
        style={{ borderBottom: "1px solid #e7ebf1", background: "#fbfcfe" }}
      >
        <Box style={{ minWidth: 0, flex: "1 1 560px" }}>
          <QueueTabs value={queueValue} onChange={onQueueChange} counts={counts} />
        </Box>
        <Group gap={12} wrap="nowrap" style={{ flex: "0 1 auto", minWidth: 0 }}>
          <TextInput
            size="xs"
            w="clamp(190px, 20vw, 250px)"
            placeholder="Filter by ref, customer, lane"
            value={searchValue}
            onChange={(event) => onSearchChange(event.currentTarget.value)}
            leftSection={<IconSearch size={14} color="#98a2b3" />}
            rightSection={
              searchValue ? (
                <ActionIcon size="xs" variant="subtle" onClick={() => onSearchChange("")} aria-label="Clear search">
                  <IconX size={13} />
                </ActionIcon>
              ) : null
            }
            styles={{
              input: {
                height: 32,
                borderColor: "#e6ebf2",
                background: "#ffffff",
                borderRadius: 8,
                fontSize: 12,
                color: "#475467",
              },
            }}
          />
          {loading ? <Loader size={18} color="blue" /> : null}
          <Text size="12px" c="#667085" style={{ whiteSpace: "nowrap" }}>
            Showing <b>{rows.length}</b> of <b>{totalRows}</b>
          </Text>
        </Group>
      </Flex>
      <ScrollArea type="auto">
        <Box miw={1115}>
          <Flex px={16} py={11} style={{ borderBottom: "1px solid #e7ebf1", background: "#fbfcfe" }}>
            {SHIPMENT_COLUMNS.map((column) => (
              <Text
                key={column.label}
                size="10.5px"
                tt="uppercase"
                fw={800}
                c="#7b8798"
                style={{
                  width: column.width,
                  flex: `0 0 ${column.width}px`,
                  letterSpacing: "0.04em",
                }}
              >
                {column.label}
              </Text>
            ))}
          </Flex>
          <Stack gap={0}>
            {displayRows.map((row) => {
              const mode = modeTone(row.mode);
              return (
                <Flex
                  key={row.id}
                  px={16}
                  py={11}
                  align="center"
                  style={{
                    minHeight: 72,
                    borderBottom: "1px solid #e7ebf1",
                    opacity: loading ? 0.45 : 1,
                    cursor: loading ? "default" : "pointer",
                    transition: "background 150ms ease",
                  }}
                  onClick={() => {
                    if (!loading) onOpen(row);
                  }}
                  onMouseEnter={(event) => {
                    setHoveredRowId(row.id);
                    event.currentTarget.style.background = "#f8fbff";
                  }}
                  onMouseLeave={(event) => {
                    setHoveredRowId(null);
                    event.currentTarget.style.background = "#ffffff";
                  }}
                >
                  <Box w={270} flex="0 0 270px">
                    <Group gap={8} wrap="nowrap">
                      <Badge
                        size="xs"
                        radius={5}
                        color={row.segment === "Import" ? "violet" : "blue"}
                        variant="light"
                        styles={{
                          root: {
                            height: 18,
                            paddingInline: 6,
                            background: "#e8f5ff",
                            color: "#2384c6",
                            fontSize: 10,
                            fontWeight: 900,
                          },
                        }}
                      >
                        {row.refType}
                      </Badge>
                      <Text size="13px" fw={800} c="#1f2937" lineClamp={1}>
                        {row.customer}
                      </Text>
                    </Group>
                    <Text size="10.5px" c="#9aa4b2" mt={4} ff="'IBM Plex Mono', monospace">
                      {row.reference}
                      {row.houseReference ? ` · ${row.houseReference}` : ""}
                    </Text>
                  </Box>
                  <Box w={160} flex="0 0 160px">
                    <Text size="12px" fw={900} c="#1f2937" ff="'IBM Plex Mono', monospace">
                      {row.laneFrom} → {row.laneTo}
                    </Text>
                    <Text size="10.5px" c="#9aa4b2" mt={3}>
                      #{row.customerCode || "CS-REF"}
                    </Text>
                  </Box>
                  <Box w={110} flex="0 0 110px">
                    <Flex
                      align="center"
                      justify="center"
                      px={8}
                      py={7}
                      style={{
                        width: 76,
                        minHeight: 36,
                        borderRadius: 5,
                        background: mode.bg,
                        border: `1px solid ${mode.border}`,
                        color: mode.color,
                      }}
                    >
                      <Text size="11px" fw={900} tt="uppercase" ta="center" lh={1.05}>
                        {row.mode}
                      </Text>
                    </Flex>
                  </Box>
                  <Box w={175} flex="0 0 175px">
                    <Text size="12px" fw={700} c="#1f2937">
                      {row.stage}
                    </Text>
                    <ShipmentProgress progress={row.progress} status={row.status} />
                  </Box>
                  <Box w={105} flex="0 0 105px">
                    <Text size="12px" fw={800} c="#1f2937">
                      {row.eta}
                    </Text>
                    <Text size="10.5px" c={row.etaStatus.toLowerCase().includes("slipped") ? DANGER : SUCCESS} fw={700}>
                      {row.etaStatus}
                    </Text>
                  </Box>
                  <Box w={110} flex="0 0 110px">
                    <Badge
                      radius={6}
                      styles={{
                        root: {
                          height: 26,
                          minWidth: 48,
                          background: row.status === "breached" ? "#ffe3eb" : row.status === "at_risk" ? "#fff1c7" : "#dff9e8",
                          color: statusColor(row.status),
                          fontWeight: 800,
                          fontSize: 12,
                        },
                      }}
                    >
                      {row.daysPending}d
                    </Badge>
                  </Box>
                  <Group w={100} flex="0 0 100px" gap={8} wrap="nowrap">
                    <OwnerAvatar initials={row.ownerInitials} size={28} />
                    <Text size="12px" c="#344054" lineClamp={1}>
                      {row.owner.split(" ")[0]}
                    </Text>
                  </Group>
                  <Group
                    w={85}
                    flex="0 0 85px"
                    gap={6}
                    justify="flex-end"
                    onClick={(event) => event.stopPropagation()}
                    style={{ opacity: hoveredRowId === row.id ? 1 : 0.22, transition: "opacity 140ms ease" }}
                  >
                    <Tooltip label="Send email">
                      <ActionIcon variant="default" color="gray" size="sm" radius={6} aria-label="Send email">
                        <IconMail size={15} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Call customer">
                      <ActionIcon variant="default" color="gray" size="sm" radius={6} aria-label="Call customer">
                        <IconPhone size={15} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Open details">
                      <ActionIcon
                        variant="light"
                        color="green"
                        size="sm"
                        radius={6}
                        aria-label="Open shipment details"
                        onClick={() => onOpen(row)}
                        styles={{ root: { background: "#eefbf0", color: "#22c55e" } }}
                      >
                        <IconCheck size={15} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Flex>
              );
            })}
          </Stack>
        </Box>
      </ScrollArea>
      {!loading && rows.length === 0 && (
        <Stack align="center" gap={6} py={42}>
          <ThemeIcon variant="light" color="blue" size={44} radius="xl">
            <IconSearch size={22} />
          </ThemeIcon>
          <Text fw={800} c={INK}>
            No shipments match these filters
          </Text>
          <Text size="12px" c={MUTED}>
            Try clearing search, owner, or SLA filters.
          </Text>
        </Stack>
      )}
    </Paper>
  );
}

function SidePanel({ summary }: { summary: CustomerServiceSummary }) {
  return (
    <Stack gap={12}>
      <Paper radius={14} p={16} style={{ border: `1px solid ${BORDER}`, background: "#fff" }}>
        <Group justify="space-between" mb={6}>
          <Text size="13px" fw={800} c={INK}>
            SLA Compliance · 7 days
          </Text>
          <Text size="11px" c={MUTED}>
            Details
          </Text>
        </Group>
        <Group align="center" gap={16}>
          <RingProgress
            size={92}
            thickness={10}
            roundCaps
            sections={[
              { value: summary.slaCompliance, color: SUCCESS },
              { value: Math.max(0, 100 - summary.slaCompliance), color: "#fee2e2" },
            ]}
            label={
              <Text ta="center" size="17px" fw={900} c={INK}>
                {summary.slaCompliance.toFixed(1)}%
              </Text>
            }
          />
          <Stack gap={7} style={{ flex: 1 }}>
            <LegendRow color={SUCCESS} label="On-track" value={114} />
            <LegendRow color={WARNING} label="At risk" value={9} />
            <LegendRow color={DANGER} label="Breached" value={4} />
          </Stack>
        </Group>
      </Paper>
      <Paper radius={14} p={16} style={{ border: `1px solid ${BORDER}`, background: "#fff" }}>
        <Group justify="space-between" mb={12}>
          <Text size="13px" fw={800} c={INK}>
            Team Workload
          </Text>
          <Text size="11px" c={MUTED}>
            Reassign
          </Text>
        </Group>
        <Stack gap={11}>
          {summary.teamWorkload.map((row) => (
            <Group key={row.name} justify="space-between" wrap="nowrap">
              <Group gap={8} wrap="nowrap">
                <OwnerAvatar initials={row.initials} color={row.tone} />
                <Box>
                  <Text size="12px" fw={800} c={INK}>
                    {row.name}
                  </Text>
                  <Text size="10px" c={MUTED}>
                    {row.role}
                  </Text>
                </Box>
              </Group>
              <Box ta="right">
                <Text size="13px" fw={900} c={INK}>
                  {row.count}
                </Text>
                <Text size="10px" c={MUTED}>
                  shipments
                </Text>
              </Box>
            </Group>
          ))}
        </Stack>
      </Paper>
      <Paper radius={14} p={16} style={{ border: `1px solid ${BORDER}`, background: "#fff" }}>
        <Group justify="space-between" mb={12}>
          <Text size="13px" fw={800} c={INK}>
            My Follow-ups · Today
          </Text>
          <Text size="11px" c={MUTED}>
            {summary.followUps.length} open
          </Text>
        </Group>
        <Stack gap={10}>
          {summary.followUps.map((item) => (
            <Group key={item.text} align="flex-start" gap={8} wrap="nowrap">
              <Box mt={3} w={12} h={12} style={{ border: `1px solid ${BORDER}`, borderRadius: 3 }} />
              <Box style={{ flex: 1 }}>
                <Text size="11px" fw={700} c={INK} lineClamp={2}>
                  {item.text}
                </Text>
                <Text size="10px" c={item.overdue ? DANGER : WARNING} fw={700} mt={2}>
                  {item.due}
                </Text>
              </Box>
            </Group>
          ))}
        </Stack>
      </Paper>
    </Stack>
  );
}

function LegendRow({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <Group justify="space-between" gap={8}>
      <Group gap={6}>
        <Box w={8} h={8} style={{ background: color, borderRadius: 2 }} />
        <Text size="11px" c={MUTED}>
          {label}
        </Text>
      </Group>
      <Text size="11px" fw={800} c={INK}>
        {value}
      </Text>
    </Group>
  );
}

const detailTabStyles = {
  tab: {
    paddingInline: 12,
    paddingBlock: 10,
    color: "#667085",
    fontSize: 12,
    fontWeight: 700,
    borderBottomWidth: 2,
    "&[data-active]": {
      color: "#111827",
      borderBottomColor: NAVY,
    },
  },
};

function documentStatusTone(status: DocumentRow["status"]) {
  if (status === "Missing") {
    return { iconBg: "#fff1f2", badgeBg: "#ffe4ea", color: "#e11d48", border: "#fecdd3" };
  }
  if (status === "Pending") {
    return { iconBg: "#fff8d6", badgeBg: "#fff4c2", color: "#b77905", border: "#fde68a" };
  }
  return { iconBg: "#eafaf0", badgeBg: "#dcfce7", color: "#16a34a", border: "#bbf7d0" };
}

function DetailDrawer({ shipment, onClose }: { shipment: ShipmentRow | null; onClose: () => void }) {
  const open = Boolean(shipment);
  const documents = shipment?.documents ?? SAMPLE_DOCUMENTS;
  const timeline = shipment?.timeline ?? SAMPLE_TIMELINE;
  const comms = shipment?.comms ?? SAMPLE_COMMS;

  return (
    <Drawer
      opened={open}
      onClose={onClose}
      position="right"
      size={520}
      padding={0}
      withCloseButton={false}
      overlayProps={{ backgroundOpacity: 0.5, blur: 1 }}
      styles={{
        content: {
          background: "#fff",
          maxWidth: "100vw",
          boxShadow: "-18px 0 40px rgba(15, 23, 42, 0.18)",
        },
        body: { height: "100%", display: "flex", flexDirection: "column" },
      }}
    >
      {shipment && (
        <>
          <Box px={22} pt={18} pb={14} style={{ borderBottom: `1px solid ${BORDER}` }}>
            <Group justify="space-between" align="flex-start">
              <Box style={{ minWidth: 0 }}>
                <Text size="10px" tt="uppercase" fw={900} c="#94a3b8" lts={1.2}>
                  {shipment.segment} · {shipment.mode}
                </Text>
                <Text size="20px" fw={900} c="#111827" mt={3} lh={1.15}>
                  {shipment.customer}
                </Text>
                <Text size="11px" c="#667085" mt={4} ff="'IBM Plex Mono', monospace">
                  {shipment.reference}
                  {shipment.houseReference ? ` · ${shipment.houseReference}` : ""}
                  {shipment.bookingReference ? ` · Booking ${shipment.bookingReference}` : ""}
                </Text>
              </Box>
              <ActionIcon
                variant="default"
                color="gray"
                radius={8}
                size={30}
                onClick={onClose}
                aria-label="Close detail panel"
                styles={{ root: { borderColor: "#edf1f5", color: "#667085" } }}
              >
                <IconX size={16} />
              </ActionIcon>
            </Group>
          </Box>
          <Tabs defaultValue="overview" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            <Tabs.List
              px={22}
              style={{
                borderBottom: `1px solid ${BORDER}`,
                minHeight: 38,
              }}
            >
              <Tabs.Tab value="overview" styles={detailTabStyles}>
                Overview
              </Tabs.Tab>
              <Tabs.Tab value="documents" styles={detailTabStyles}>
                Documents <span style={{ color: "#98a2b3", marginLeft: 4 }}>{documents.length}</span>
              </Tabs.Tab>
              <Tabs.Tab value="timeline" styles={detailTabStyles}>
                Timeline
              </Tabs.Tab>
              <Tabs.Tab value="comms" styles={detailTabStyles}>
                Comms <span style={{ color: "#98a2b3", marginLeft: 4 }}>{Math.max(12, comms.length)}</span>
              </Tabs.Tab>
            </Tabs.List>
            <ScrollArea style={{ flex: 1 }}>
              <Tabs.Panel value="overview" p={22}>
                <Stack gap={18}>
                  <Paper radius={8} p={14} style={{ border: `1px solid ${BORDER}`, background: "#fbfdff" }}>
                    <Group justify="space-between" align="center" wrap="nowrap">
                      <Box>
                        <Text size="26px" fw={900} c="#111827" lh={1}>
                          {shipment.laneFrom}
                        </Text>
                        <Text size="11px" c="#667085" mt={4}>
                          {shipment.laneName?.split("-")[0]?.trim() || "Origin"}
                        </Text>
                        <Text size="10px" c="#98a2b3" mt={4}>
                          Departed Apr 10
                        </Text>
                      </Box>
                      <Box mx={14} style={{ flex: 1, height: 1, background: "#cbd5e1", position: "relative" }}>
                        <Flex
                          align="center"
                          justify="center"
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            background: WARNING,
                            color: "#fff",
                            position: "absolute",
                            left: "50%",
                            top: -14,
                            transform: "translateX(-50%)",
                          }}
                        >
                          <IconTruckDelivery size={14} />
                        </Flex>
                      </Box>
                      <Box ta="right">
                        <Text size="26px" fw={900} c="#111827" lh={1}>
                          {shipment.laneTo}
                        </Text>
                        <Text size="11px" c="#667085" mt={4}>
                          {shipment.laneName?.split("-")[1]?.trim() || "Destination"}
                        </Text>
                        <Text size="10px" c="#98a2b3" mt={4}>
                          ETA {shipment.eta}
                        </Text>
                      </Box>
                    </Group>
                    <Group justify="space-between" mt={14} gap={8}>
                      <Text size="11px" c="#667085">
                        Mode: <b>{shipment.mode}</b>
                      </Text>
                      <Text size="11px" c="#667085">
                        Vessel: <b>{shipment.vessel || "Pending"}</b>
                      </Text>
                      <Text size="11px" c="#667085">
                        Container: <b>{shipment.container || "-"}</b>
                      </Text>
                    </Group>
                  </Paper>
                  <Box>
                    <Text size="10px" tt="uppercase" fw={900} c="#98a2b3" lts={0.9} mb={12}>
                      Shipment Details
                    </Text>
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={16}>
                      <InfoBlock label="Consignee" value={shipment.consignee || shipment.customer} />
                      <InfoBlock label="Shipper" value={shipment.shipper || "-"} />
                      <InfoBlock label="Master BL" value={shipment.reference} />
                      <InfoBlock label="House BL" value={shipment.houseReference || "-"} />
                      <InfoBlock label="Weight / Volume" value={shipment.weightVolume || "-"} />
                      <InfoBlock label="Packages" value={shipment.packageInfo || "-"} />
                      <InfoBlock label="Incoterm" value={shipment.incoterm || "-"} />
                      <InfoBlock label="Invoice Value" value={shipment.invoiceValue || "-"} />
                    </SimpleGrid>
                  </Box>
                  <Box>
                    <Text size="10px" tt="uppercase" fw={900} c="#98a2b3" lts={0.9} mb={8}>
                      Current Status
                    </Text>
                    <Paper radius={8} p={13} style={{ background: "#fff7d6", border: "1px solid #facc15" }}>
                      <Group gap={8} mb={6}>
                        <IconBellRinging size={16} color="#a16207" />
                        <Text size="13px" fw={900} c="#854d0e">
                          {shipment.stage}
                        </Text>
                      </Group>
                      <Text size="11px" c="#7c5b10" lh={1.45}>
                        {shipment.currentStatusDetail || "Customer service activity is in progress."}
                      </Text>
                    </Paper>
                  </Box>
                  <Box>
                    <Text size="10px" tt="uppercase" fw={900} c="#98a2b3" lts={0.9} mb={8}>
                      Assigned
                    </Text>
                    <Paper radius={8} p={12} style={{ border: `1px solid ${BORDER}`, background: "#fbfdff" }}>
                    <Group justify="space-between">
                      <Group gap={12}>
                        <OwnerAvatar initials={shipment.ownerInitials} size={38} />
                        <Box>
                          <Text size="13px" fw={900} c="#111827">
                            {shipment.owner}
                          </Text>
                          <Text size="11px" c="#667085">
                            {shipment.ownerRole || "Customer Service"}
                          </Text>
                        </Box>
                      </Group>
                      <Button size="xs" variant="subtle" color="gray">
                        Reassign
                      </Button>
                    </Group>
                    </Paper>
                  </Box>
                </Stack>
              </Tabs.Panel>
              <Tabs.Panel value="documents" p={22}>
                <Stack gap={10}>
                  <Text size="10px" tt="uppercase" fw={900} c="#98a2b3" lts={0.9}>
                    Required Documents
                  </Text>
                  {documents.map((doc) => {
                    const tone = documentStatusTone(doc.status);
                    return (
                      <Paper
                        key={doc.name}
                        radius={8}
                        p={12}
                        style={{
                          minHeight: 58,
                          border: "1px solid #e7ebf1",
                          background: "#fff",
                          boxShadow: "0 4px 12px rgba(15, 23, 42, 0.025)",
                        }}
                      >
                        <Group justify="space-between" wrap="nowrap">
                          <Group gap={12} wrap="nowrap" style={{ minWidth: 0 }}>
                            <ThemeIcon
                              radius={8}
                              size={34}
                              style={{
                                background: tone.iconBg,
                                color: tone.color,
                                border: `1px solid ${tone.border}`,
                                flex: "0 0 auto",
                              }}
                            >
                              {doc.status === "Missing" ? <IconAlertTriangle size={17} /> : <IconFileInvoice size={17} />}
                            </ThemeIcon>
                            <Box style={{ minWidth: 0 }}>
                              <Text size="13px" fw={900} c="#111827" lineClamp={1}>
                                {doc.name}
                              </Text>
                              <Text size="10.5px" c="#98a2b3" ff="'IBM Plex Mono', monospace" lineClamp={1}>
                                {doc.meta}
                              </Text>
                            </Box>
                          </Group>
                          <Badge
                            radius={6}
                            styles={{
                              root: {
                                height: 22,
                                background: tone.badgeBg,
                                color: tone.color,
                                fontSize: 10,
                                fontWeight: 900,
                                flex: "0 0 auto",
                              },
                            }}
                          >
                            {doc.status.toUpperCase()}
                          </Badge>
                        </Group>
                      </Paper>
                    );
                  })}
                </Stack>
              </Tabs.Panel>
              <Tabs.Panel value="timeline" p={22}>
                <Stack gap={0}>
                  {timeline.map((item, index) => (
                    <Group key={`${item.title}-${index}`} align="flex-start" gap={12} wrap="nowrap">
                      <Stack align="center" gap={0}>
                        <Flex
                          align="center"
                          justify="center"
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: "50%",
                            background: item.state === "done" ? SUCCESS : item.state === "active" ? WARNING : "#fff",
                            border: item.state === "pending" ? `2px solid ${BORDER}` : "none",
                            color: "#fff",
                          }}
                        >
                          {item.state === "done" ? <IconCheck size={12} /> : null}
                        </Flex>
                        {index < timeline.length - 1 && <Box h={42} w={2} style={{ background: BORDER }} />}
                      </Stack>
                      <Box pb={16}>
                        <Text size="13px" fw={900} c={item.state === "pending" ? "#98a2b3" : "#111827"}>
                          {item.title}
                        </Text>
                        <Text size="10.5px" c={item.state === "active" ? DANGER : "#667085"}>
                          {item.detail.includes("Aging critical") ? (
                            <>
                              {item.detail.replace(" · Aging critical", "")} ·{" "}
                              <Text span c={DANGER} fw={900}>
                                Aging critical
                              </Text>
                            </>
                          ) : (
                            item.detail
                          )}
                        </Text>
                      </Box>
                    </Group>
                  ))}
                </Stack>
              </Tabs.Panel>
              <Tabs.Panel value="comms" p={22}>
                <Stack gap={12}>
                  {comms.map((comm) => (
                    <Paper key={`${comm.channel}-${comm.time}`} radius={10} p={12} style={{ border: `1px solid ${BORDER}` }}>
                      <Group gap={10} align="flex-start" wrap="nowrap">
                        <ThemeIcon variant="light" color={comm.channel === "Phone" ? "green" : comm.channel === "Email" ? "blue" : "gray"}>
                          {comm.channel === "Phone" ? <IconPhone size={17} /> : comm.channel === "Email" ? <IconMail size={17} /> : <IconClockHour4 size={17} />}
                        </ThemeIcon>
                        <Box>
                          <Group gap={8}>
                            <Text size="12px" fw={900} c={INK}>
                              {comm.channel}
                            </Text>
                            <Text size="10px" c={MUTED}>
                              {comm.time}
                            </Text>
                          </Group>
                          <Text size="12px" c={MUTED} mt={4}>
                            {comm.text}
                          </Text>
                        </Box>
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              </Tabs.Panel>
            </ScrollArea>
          </Tabs>
          <Group
            px={20}
            py={14}
            gap={10}
            grow
            style={{
              borderTop: `1px solid ${BORDER}`,
              background: "#fff",
              boxShadow: "0 -8px 18px rgba(15, 23, 42, 0.035)",
            }}
          >
            <Button variant="default" radius={6} styles={{ root: { height: 34, fontWeight: 800 } }}>
              Chase agent
            </Button>
            <Button variant="default" radius={6} styles={{ root: { height: 34, fontWeight: 800 } }}>
              Add follow-up
            </Button>
            <Button color="dark" radius={6} styles={{ root: { height: 34, background: NAVY, fontWeight: 800 } }}>
              Mark complete
            </Button>
          </Group>
        </>
      )}
    </Drawer>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Text size="10px" tt="uppercase" fw={900} c="#94a3b8" lts={0.6}>
        {label}
      </Text>
      <Text size="13px" fw={800} c={INK} mt={3}>
        {value}
      </Text>
    </Box>
  );
}

const CustomerServiceDashboard: React.FC<CustomerServiceDashboardProps> = ({ fromDate, toDate, globalSearch }) => {
  const [summary, setSummary] = useState<CustomerServiceSummary>(SAMPLE_SUMMARY);
  const [rows, setRows] = useState<ShipmentRow[]>(SAMPLE_ROWS);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(true);
  const [selectedShipment, setSelectedShipment] = useState<ShipmentRow | null>(null);
  const [apiNotice, setApiNotice] = useState<string | null>(null);
  const shipmentTableRef = useRef<HTMLDivElement | null>(null);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const nextSummary = await fetchSummary();
      setSummary(nextSummary);
      setApiNotice(null);
    } catch {
      setSummary(SAMPLE_SUMMARY);
      setApiNotice("Showing sample CS operations data until the dashboard summary API is available.");
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const loadShipments = useCallback(async () => {
    setTableLoading(true);
    try {
      const nextRows = await fetchShipments(filters, fromDate, toDate, globalSearch);
      setRows(nextRows);
      setApiNotice(null);
    } catch {
      setRows(SAMPLE_ROWS);
      setApiNotice("Showing sample CS operations data until the shipment table API is available.");
    } finally {
      setTableLoading(false);
    }
  }, [filters, fromDate, toDate, globalSearch]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    loadShipments();
  }, [loadShipments]);

  const filteredRows = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    return rows.filter((row) => {
      if (filters.segment !== "All" && row.segment !== filters.segment) return false;
      if (filters.mode !== "All" && row.mode !== filters.mode) return false;
      if (filters.owner !== "All" && row.owner !== filters.owner) return false;
      if (filters.status !== "All" && row.status !== filters.status) return false;
      if (!query) return true;
      return [row.customer, row.reference, row.houseReference, row.laneFrom, row.laneTo, row.stage, row.owner]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [filters, rows]);

  const counts = useMemo(
    () => ({
      "pending-bl-awb": summary.export.count,
      "pending-can-do": summary.import.count,
      "invoice-pending": summary.billing.count,
      exceptions: summary.exceptions.count,
      "live-shipments": summary.activeShipments,
    }),
    [summary],
  );

  const modeOptions = useMemo(
    () => ["All", ...Array.from(new Set(rows.map((row) => row.mode))).filter(Boolean)].map((value) => ({ value, label: value })),
    [rows],
  );
  const ownerOptions = useMemo(
    () => ["All", ...Array.from(new Set(rows.map((row) => row.owner))).filter(Boolean)].map((value) => ({ value, label: value })),
    [rows],
  );

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const scrollToShipmentQueue = useCallback((queue: FilterState["queue"]) => {
    setFilters((current) => ({ ...current, queue }));
    requestAnimationFrame(() => {
      shipmentTableRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, []);

  const headerContextLabel = useMemo(() => {
    const ownerLabel = filters.owner === "All" ? "All agents" : filters.owner;
    const modeLabel = filters.mode === "All" ? "All modes" : filters.mode;
    const segmentLabel = filters.segment === "All" ? "Export / Import" : filters.segment;

    return `Today · Apr 24 · ${ownerLabel} · ${modeLabel} · ${segmentLabel}`;
  }, [filters.mode, filters.owner, filters.segment]);

  return (
    <Box
      style={{
        minHeight: "100%",
        background: PAGE_BG,
        fontFamily: "'Inter', 'Geist', sans-serif",
      }}
    >
      <Stack gap={16}>
        <Paper radius={0} p={18} style={{ border: `1px solid ${BORDER}`, borderRadius: 14, background: "#fff" }}>
          <Flex
            justify="space-between"
            align="flex-start"
            gap={24}
            wrap="nowrap"
            style={{
              overflowX: "auto",
              scrollbarWidth: "thin",
              WebkitOverflowScrolling: "touch",
            }}
          >
            <Box style={{ minWidth: 420, flex: "1 0 auto" }}>
              <Text size="12px" c="#94a3b8" fw={700}>
                Pentagon Freight · Customer Service · Overview
              </Text>
              <Text size="24px" fw={900} c={INK} mt={7}>
                Customer Service — Live Operations
              </Text>
              <Text size="12px" c={MUTED} mt={3}>
                Team Lead view · 6 agents · {summary.activeShipments} active shipments · {headerContextLabel} · Updated{" "}
                {summary.updatedAgo}
              </Text>
            </Box>
            <Group gap={8} wrap="nowrap" style={{ flexShrink: 0, marginLeft: "auto" }}>
              {/* <Button size="xs" variant="filled" styles={{ root: { background: NAVY } }}>
                Today · Apr 24
              </Button> */}
              <Select
                size="xs"
                w={130}
                value={filters.owner}
                data={ownerOptions}
                onChange={(value) => updateFilter("owner", value || "All")}
                leftSection={<IconUserCircle size={14} color={SUCCESS} />}
              />
              <Select size="xs" w={118} value={filters.mode} data={modeOptions} onChange={(value) => updateFilter("mode", value || "All")} />
              <Select
                size="xs"
                w={130}
                value={filters.segment}
                data={["All", "Export", "Import"].map((value) => ({ value, label: value === "All" ? "Export / Import" : value }))}
                onChange={(value) => updateFilter("segment", value || "All")}
              />
              <Button size="xs" variant="default" leftSection={<IconDownload size={14} />}>
                Export
              </Button>
            </Group>
          </Flex>
        </Paper>

      {/*  <Paper
          radius={12}
          p={14}
          style={{
            border: "1px solid #fecdd3",
            borderLeft: `4px solid ${DANGER}`,
            background: "#fff7f8",
          }}
        >
          <Group justify="space-between" gap={12} wrap="nowrap">
            <Group gap={12} wrap="nowrap">
              <ThemeIcon variant="light" color="red" radius="xl">
                <IconAlertTriangle size={18} />
              </ThemeIcon>
              <Text size="13px" c={INK}>
                <b>{summary.breachedShipments} shipments breached SLA.</b> {summary.breachText}
              </Text>
            </Group>
            <Button size="xs" variant="default" rightSection={<IconChevronRight size={13} />}>
              Review now
            </Button>
          </Group>
        </Paper> */}

        {/* {apiNotice && (
          <Paper radius={10} p={10} style={{ border: "1px solid #bae6fd", background: "#f0f9ff" }}>
            <Group gap={8}>
              <IconRefresh size={15} color={INFO} />
              <Text size="12px" c="#075985" fw={700}>
                {apiNotice}
              </Text>
            </Group>
          </Paper>
        )} */}

        <SimpleGrid cols={{ base: 1, md: 3 }} spacing={18}>
          <MetricCard
            bucket={summary.export}
            loading={summaryLoading}
            onClick={() => scrollToShipmentQueue("pending-bl-awb")}
          />
          <MetricCard
            bucket={summary.import}
            loading={summaryLoading}
            onClick={() => scrollToShipmentQueue("pending-can-do")}
          />
          <MetricCard
            bucket={summary.billing}
            loading={summaryLoading}
            onClick={() => scrollToShipmentQueue("invoice-pending")}
          />
          {/* <MetricCard bucket={summary.exceptions} loading={summaryLoading} /> */}
        </SimpleGrid>

        {/* <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing={12}>
          <StatTile title="Active Shipments" value={String(summary.activeShipments)} subtitle="6 escalated · 47 at port" color={INFO} />
          <StatTile title="Docs Pending (BL / VGM)" value={String(summary.documentsPending)} subtitle="2 need cutoff" color={DANGER} />
          <StatTile title="SLA Compliance (7d)" value={`${summary.slaCompliance.toFixed(1)}%`} subtitle="+2.8 pts vs last week" color={SUCCESS} />
          <StatTile title="Avg. Response Time" value={summary.averageResponseTime} subtitle="8 min vs target" color={SUCCESS} />
        </SimpleGrid> */}

        <Flex ref={shipmentTableRef} gap={14} align="flex-start" direction={{ base: "column", xl: "row" }}>
          <Stack gap={12} style={{ flex: 1, minWidth: 0, width: "100%" }}>
            <ShipmentTable
              rows={filteredRows}
              loading={tableLoading}
              onOpen={setSelectedShipment}
              queueValue={filters.queue}
              onQueueChange={(value) => updateFilter("queue", value)}
              counts={counts}
              searchValue={filters.search}
              onSearchChange={(value) => updateFilter("search", value)}
              totalRows={rows.length}
            />
          </Stack>
          {/* <Box w={{ base: "100%", xl: 300 }} style={{ flexShrink: 0 }}>
            <SidePanel summary={summary} />
          </Box> */}
        </Flex>
      </Stack>
      <DetailDrawer shipment={selectedShipment} onClose={() => setSelectedShipment(null)} />
    </Box>
  );
};

export default CustomerServiceDashboard;
