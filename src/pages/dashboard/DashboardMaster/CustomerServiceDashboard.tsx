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
  Pagination,
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
import { useDebouncedValue } from "@mantine/hooks";
import { apiCallProtected } from "../../../api/axios";
import { URL } from "../../../api/serverUrls";
import {
  ERP_LIST_FONT_SANS,
  ERP_LIST_GEIST_MONO_CLASS,
  ERP_LIST_GEIST_ROOT_CLASS,
} from "../../../components/ERPListPage/erpListGeistShell";

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
  bucketLabel?: string;
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
  bucketLabel: undefined,
  segment: "All",
  mode: "All",
  owner: "All",
  status: "All",
  search: "",
};

const SHIPMENT_PAGE_LIMIT = 10;

const queueOptions = [
  { value: "pending-bl-awb", label: "Pending BL/AWB" },
  { value: "pending-can-do", label: "Pending CAN/DO" },
  { value: "invoice-pending", label: "Invoice Pending" },
  // { value: "exceptions", label: "Exceptions" },
  // { value: "live-shipments", label: "Live Shipments" },
];

const QUEUE_DRILLDOWN_CONFIG: Record<string, { cardType: string }> = {
  "pending-bl-awb": { cardType: "bl_release_pending" },
  "pending-can-do": { cardType: "can_do_pending" },
  "invoice-pending": { cardType: "invoice_not_raised" },
};

const CARD_TYPE_MILESTONE_CODE: Record<string, string> = {
  bl_release_pending: "BL_AWB_RELEASE",
  can_do_pending: "CAN_DO_RELEASE",
  invoice_not_raised: "INVOICE_RAISED",
};

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

function formatDisplayDate(value: unknown) {
  const raw = firstString(value);
  if (!raw) return "-";
  const parsed = dayjs(raw);
  return parsed.isValid() ? parsed.format("MMM DD") : raw;
}

function normalizeSegmentLabel(segment: unknown) {
  const value = firstString(segment, "Export");
  return value.toLowerCase().includes("import") ? "Import" : "Export";
}

function milestoneState(status: string, isFocused: boolean): TimelineRow["state"] {
  const normalized = status.toLowerCase();
  if (normalized === "done" || normalized === "completed") return "done";
  return isFocused ? "active" : "pending";
}

function milestoneDetail(milestone: Record<string, unknown>) {
  const parts = [
    formatDisplayDate(milestone.date),
    firstString(milestone.time),
    firstString(milestone.reference),
    firstString(milestone.location),
    safeNumber(milestone.days_open, 0) > 0 ? `${safeNumber(milestone.days_open, 0)} days open` : "",
    firstString(milestone.aging) ? `Aging ${firstString(milestone.aging)}` : "",
  ].filter((part) => part && part !== "-");

  return parts.length > 0 ? parts.join(" · ") : "-";
}

function findFocusedMilestone(milestones: Record<string, unknown>[], cardType: string) {
  const targetCode = CARD_TYPE_MILESTONE_CODE[cardType];
  return (
    milestones.find((milestone) => firstString(milestone.code) === targetCode) ??
    milestones.find((milestone) => firstString(milestone.status).toLowerCase() === "pending") ??
    milestones[0]
  );
}

function normalizeBucket(raw: unknown, color: string): SummaryBucket {
  const record = (raw ?? {}) as Record<string, unknown>;
  const bandsRaw = Array.isArray(record.bands)
    ? record.bands
    : Array.isArray(record.aging)
      ? record.aging
      : Array.isArray(record.buckets)
        ? record.buckets
        : [];
  const delta = safeNumber(record.delta_since_yesterday ?? record.deltaSinceYesterday, Number.NaN);
  const deltaDirection =
    record.delta_direction === "up" || record.delta_direction === "down" || record.delta_direction === "flat"
      ? record.delta_direction
      : record.trendDirection === "up" || record.trendDirection === "down" || record.trendDirection === "flat"
        ? record.trendDirection
        : undefined;
  const deltaTrendText = Number.isFinite(delta)
    ? `${delta > 0 ? "+" : ""}${delta} since yesterday`
    : undefined;

  return {
    label: firstString(record.label, record.category, record.type),
    title: firstString(record.title, record.name),
    count: safeNumber(record.count ?? record.total ?? record.value),
    unit: firstString(record.unit),
    color: firstString(record.color, color),
    bands: bandsRaw.map((band) => {
      const item = (band ?? {}) as Record<string, unknown>;
      const value = safeNumber(item.value ?? item.count);
      return {
        label: firstString(item.label, item.name),
        value,
        tone:
          item.tone === "danger" || item.tone === "warning" || item.tone === "neutral"
            ? item.tone
            : value > 10
              ? "danger"
              : value > 0
                ? "warning"
                : "neutral",
      };
    }),
    trendText: firstString(record.trendText, record.trend, deltaTrendText),
    trendDirection: deltaDirection,
    footer: firstString(record.footer),
  };
}

function normalizeSummary(raw: unknown): CustomerServiceSummary {
  const root = (raw ?? {}) as Record<string, unknown>;
  const data = ((root.data ?? root.summary ?? root) ?? {}) as Record<string, unknown>;
  return {
    updatedAgo: firstString(data.updatedAgo, data.updated_ago, data.last_updated),
    breachedShipments: safeNumber(
      data.breachedShipments ?? data.breached_shipments ?? data.breached_count,
    ),
    breachText: firstString(data.breachText, data.breach_text, data.alert),
    export: normalizeBucket(data.export ?? data.Export ?? data.bl_release_pending, INFO),
    import: normalizeBucket(data.import ?? data.Import ?? data.can_do_pending, "#7c3aed"),
    billing: normalizeBucket(data.billing ?? data.Billing ?? data.invoice_not_raised, WARNING),
    exceptions: normalizeBucket(data.exceptions ?? data.Exceptions, DANGER),
    activeShipments: safeNumber(data.activeShipments ?? data.active_shipments),
    documentsPending: safeNumber(data.documentsPending ?? data.documents_pending),
    slaCompliance: safeNumber(data.slaCompliance ?? data.sla_compliance),
    averageResponseTime: firstString(
      data.averageResponseTime,
      data.average_response_time,
    ),
    teamWorkload: Array.isArray(data.teamWorkload)
      ? data.teamWorkload.map((item) => {
          const row = (item ?? {}) as Record<string, unknown>;
          const name = firstString(row.name, row.owner);
          return {
            name,
            role: firstString(row.role, row.desk),
            initials: firstString(row.initials, deriveInitials(name)),
            count: safeNumber(row.count ?? row.shipments),
            tone: firstString(row.tone, row.color, INFO),
          };
        })
      : [],
    followUps: Array.isArray(data.followUps)
      ? data.followUps.map((item) => {
          const row = (item ?? {}) as Record<string, unknown>;
          return {
            text: firstString(row.text, row.title),
            due: firstString(row.due, row.dueText),
            overdue: Boolean(row.overdue),
          };
        })
      : [],
  };
}

function normalizeShipment(raw: unknown): ShipmentRow {
  const row = (raw ?? {}) as Record<string, unknown>;
  const customer = firstString(
    row.customer,
    row.customer_name,
    (row.customer_details as Record<string, unknown> | undefined)?.customer_name,
    "Customer not available",
  );
  const owner = firstString(row.owner, row.assigned_to, row.salesperson, "Unassigned");
  const segment = firstString(row.segment, row.trade, row.service_type, "Export");
  const statusText = firstString(row.status, row.sla_status);
  const status: ShipmentStatus =
    statusText.toLowerCase().includes("breach") || safeNumber(row.daysPending ?? row.days_pending) > 5
      ? "breached"
      : statusText.toLowerCase().includes("risk")
        ? "at_risk"
        : "on_track";

  return {
    id: firstString(row.id, row.job_id, row.reference, row.mbl_no, row.awb_no),
    refType: firstString(row.refType, row.ref_type, segment.slice(0, 3).toUpperCase()),
    reference: firstString(row.reference, row.job_id, row.mbl_no, row.awb_no),
    houseReference: firstString(row.houseReference, row.house_reference, row.hbl_no, row.houseno),
    bookingReference: firstString(row.bookingReference, row.booking_reference, row.booking_id),
    customer,
    customerCode: firstString(row.customerCode, row.customer_code),
    laneFrom: firstString(row.laneFrom, row.origin_code, row.origin),
    laneTo: firstString(row.laneTo, row.destination_code, row.destination),
    laneName: firstString(row.laneName, row.lane),
    mode: firstString(row.mode, row.service, row.shipment_mode),
    segment,
    stage: firstString(row.stage, row.current_stage, row.event_name),
    progress: Math.min(100, Math.max(0, safeNumber(row.progress))),
    eta: firstString(row.eta, row.ETA, row.etd),
    etaStatus: firstString(row.etaStatus, row.eta_status),
    daysPending: safeNumber(row.daysPending ?? row.days_pending ?? row.pending_days),
    owner,
    ownerInitials: firstString(row.ownerInitials, row.owner_initials, deriveInitials(owner)),
    ownerRole: firstString(row.ownerRole, row.owner_role),
    status,
    currentStatusDetail: firstString(row.currentStatusDetail, row.current_status_detail, row.remarks),
  };
}

function normalizePipelineShipment(raw: unknown, index: number, cardType: string): ShipmentRow {
  const row = (raw ?? {}) as Record<string, unknown>;
  const milestones = Array.isArray(row.milestones) ? (row.milestones as Record<string, unknown>[]) : [];
  const focusedMilestone = findFocusedMilestone(milestones, cardType) ?? {};
  const doneCount = milestones.filter((milestone) => firstString(milestone.status).toLowerCase() === "done").length;
  const progress = milestones.length > 0 ? Math.round((doneCount / milestones.length) * 100) : 0;
  const daysPending = safeNumber(focusedMilestone.days_open, 0);
  const aging = firstString(focusedMilestone.aging);
  const owner = firstString(row.user, row.owner, row.assigned_to, "Unassigned");
  const serviceType = firstString(row.service_type, "Export");
  const service = firstString(row.service, "Shipment");
  const segment = normalizeSegmentLabel(serviceType);
  const status: ShipmentStatus = aging === "critical" || daysPending > 5 ? "breached" : daysPending > 2 ? "at_risk" : "on_track";
  const id = firstString(row.id, row.job_id, row.reference, `CS-${index + 1}`);
  const reference = serviceType;
  const eta = formatDisplayDate(row.eta_etd);
  const timeline = milestones.map((milestone) => {
    const isFocused = milestone === focusedMilestone;
    return {
      title: firstString(milestone.label, milestone.code, "Milestone"),
      detail: milestoneDetail(milestone),
      state: milestoneState(firstString(milestone.status), isFocused),
    };
  });

  return {
    id,
    refType: segment.slice(0, 3).toUpperCase(),
    reference,
    customer: firstString(row.customer_name, row.customer, "Customer not available"),
    customerCode: id,
    laneFrom: firstString(row.origin_code, row.origin, "-"),
    laneTo: firstString(row.destination_code, row.destination, "-"),
    laneName: `${firstString(row.origin_code, row.origin, "-")} - ${firstString(row.destination_code, row.destination, "-")}`,
    mode: service,
    segment,
    stage: firstString(focusedMilestone.label, "Pending milestone"),
    progress,
    eta,
    etaStatus: aging ? `Aging ${aging}` : firstString(focusedMilestone.status, "Pending"),
    daysPending,
    owner,
    ownerInitials: deriveInitials(owner),
    ownerRole: `Customer Service · ${service}`,
    status,
    currentStatusDetail: firstString(focusedMilestone.note, `${firstString(focusedMilestone.label, "Milestone")} pending for ${daysPending} days.`),
    timeline,
    documents: [],
    comms: [],
  };
}

function extractRowsFromResponse(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;

  const root = (payload ?? {}) as Record<string, unknown>;
  const data = (root.data ?? {}) as Record<string, unknown>;
  const candidates = [
    root.data,
    root.results,
    root.rows,
    root.records,
    root.items,
    data.data,
    data.results,
    data.rows,
    data.records,
    data.items,
  ];

  return candidates.find(Array.isArray) ?? [];
}

function extractCountFromResponse(payload: unknown, fallback: number) {
  const root = (payload ?? {}) as Record<string, unknown>;
  const data = (root.data ?? {}) as Record<string, unknown>;
  return safeNumber(root.count ?? root.total ?? root.total_count ?? data.count ?? data.total ?? data.total_count, fallback);
}

function extractHasNextFromResponse(payload: unknown, fallback: boolean) {
  const root = (payload ?? {}) as Record<string, unknown>;
  const data = (root.data ?? {}) as Record<string, unknown>;
  return Boolean(root.next ?? data.next) || fallback;
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

async function fetchSummary(fromDate?: Date | null, toDate?: Date | null) {
  const response = await apiCallProtected.post(URL.dashboard.customerServiceDashboardSummary, {
    date_from: fromDate ? dayjs(fromDate).format("YYYY-MM-DD") : undefined,
    date_to: toDate ? dayjs(toDate).format("YYYY-MM-DD") : undefined,
  });
  return normalizeSummary(response.data);
}

async function fetchShipments(
  filters: FilterState,
  fromDate?: Date | null,
  toDate?: Date | null,
  globalSearch?: string,
  pageIndex = 0,
  pageLimit = SHIPMENT_PAGE_LIMIT,
) {
  const drilldownConfig = QUEUE_DRILLDOWN_CONFIG[filters.queue];
  if (drilldownConfig) {
    const response = await apiCallProtected.post(
      URL.dashboard.customerServiceDashboardSummary,
      {
        date_from: fromDate ? dayjs(fromDate).format("YYYY-MM-DD") : undefined,
        date_to: toDate ? dayjs(toDate).format("YYYY-MM-DD") : undefined,
        card_type: drilldownConfig.cardType,
        ...(filters.bucketLabel ? { label: filters.bucketLabel } : {}),
        search: filters.search.trim() || globalSearch?.trim() || undefined,
      },
      { params: { index: pageIndex, limit: pageLimit } },
    );
    const rows = extractRowsFromResponse(response.data);
    return {
      rows: rows.map((row, index) => normalizePipelineShipment(row, index, drilldownConfig.cardType)),
      count: extractCountFromResponse(response.data, rows.length),
      hasNext: extractHasNextFromResponse(response.data, rows.length === pageLimit),
    };
  }

  const payload = {
    queue: filters.queue,
    segment: filters.segment === "All" ? undefined : filters.segment,
    mode: filters.mode === "All" ? undefined : filters.mode,
    owner: filters.owner === "All" ? undefined : filters.owner,
    status: filters.status === "All" ? undefined : filters.status,
    search: filters.search.trim() || globalSearch?.trim() || undefined,
    date_from: fromDate ? dayjs(fromDate).format("YYYY-MM-DD") : undefined,
    date_to: toDate ? dayjs(toDate).format("YYYY-MM-DD") : undefined,
  };
  const response = await apiCallProtected.post(URL.dashboard.customerServiceDashboardShipments, payload, {
    params: { index: pageIndex, limit: pageLimit },
  });
  const rows = extractRowsFromResponse(response.data);
  return {
    rows: rows.map(normalizeShipment),
    count: extractCountFromResponse(response.data, rows.length),
    hasNext: extractHasNextFromResponse(response.data, rows.length === pageLimit),
  };
}

function normalizeJobDetailShipment(raw: unknown, base: ShipmentRow): ShipmentRow {
  const row = (raw ?? {}) as Record<string, unknown>;
  const houses = Array.isArray(row.housing_details) ? (row.housing_details as Record<string, unknown>[]) : [];
  const firstHouse = houses[0] ?? {};
  const containers = Array.isArray(row.container_details) ? (row.container_details as Record<string, unknown>[]) : [];
  const firstContainer = containers[0] ?? {};
  const summary = ((firstHouse.summary ?? {}) as Record<string, unknown>) || {};
  const owner = firstString(row.created_by, base.owner);
  const laneFrom = firstString(row.origin_code, firstHouse.origin_code, base.laneFrom);
  const laneTo = firstString(row.destination_code, firstHouse.destination_code, base.laneTo);
  const laneFromName = firstString(row.origin_name, firstHouse.origin_name, laneFrom);
  const laneToName = firstString(row.destination_name, firstHouse.destination_name, laneTo);
  const packages = safeNumber(summary.total_no_of_packages, Number.NaN);
  const grossWeight = firstString(summary.total_gross_weight);
  const volume = firstString(summary.total_volume);

  return {
    ...base,
    reference: firstString(row.mbl_number, row.mawb_no, row.job_id, base.reference),
    houseReference: firstString(firstHouse.hbl_number, firstHouse.hawb_no, base.houseReference),
    bookingReference: firstString(row.booking_no, row.carrier_booking_no, base.bookingReference),
    customer: firstString(firstHouse.consignee_name, firstHouse.notify1_customer_name, row.consignee_name, base.customer),
    laneFrom,
    laneTo,
    laneName: `${laneFromName} - ${laneToName}`,
    mode: firstString(row.service, base.mode),
    segment: normalizeSegmentLabel(firstString(row.service_type, firstHouse.trade, base.segment)),
    eta: formatDisplayDate(row.eta ?? row.ata ?? base.eta),
    owner,
    ownerInitials: deriveInitials(owner),
    ownerRole: `Customer Service · ${firstString(row.branch_code, base.ownerRole)}`,
    vessel: firstString(row.vessel_name, row.flightno, base.vessel),
    container: firstString(firstContainer.container_no, base.container),
    shipper: firstString(firstHouse.shipper_name, row.shipper_name, base.shipper),
    consignee: firstString(firstHouse.consignee_name, row.consignee_name, base.consignee),
    incoterm: firstString(firstHouse.shipment_terms_code, firstHouse.shipment_terms_name, base.incoterm),
    packageInfo: Number.isFinite(packages) ? `${packages} packages` : base.packageInfo,
    weightVolume: [grossWeight ? `${grossWeight} kg` : "", volume ? `${volume} cbm` : ""].filter(Boolean).join(" · ") || base.weightVolume,
    currentStatusDetail: firstString(row.remark_dsr, base.currentStatusDetail),
    timeline: base.timeline,
  };
}

async function fetchShipmentDetail(row: ShipmentRow) {
  const response = await apiCallProtected.get(`job-create/${row.id}/`);
  const rows = extractRowsFromResponse(response.data);
  return normalizeJobDetailShipment(rows[0], row);
}

function MetricCard({
  bucket,
  loading,
  onClick,
  onBandClick,
}: {
  bucket?: SummaryBucket;
  loading?: boolean;
  onClick?: () => void;
  onBandClick?: (label: string) => void;
}) {
  const isInteractive = Boolean(onClick) && !loading && Boolean(bucket);
  const areBandsInteractive = Boolean(onBandClick) && !loading && Boolean(bucket);

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
        borderLeft: `4px solid ${bucket?.color ?? BORDER}`,
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
        ) : !bucket ? (
          <Stack gap={6} justify="center" h="100%">
            <Text size="12px" fw={700} c={INK}>
              No API data
            </Text>
            <Text size="11px" c={MUTED}>
              This card will populate when the summary API returns data.
            </Text>
          </Stack>
        ) : (
          <Stack gap={0} justify="space-between" h="100%">
            <Box>
              <Text size="10px" tt="uppercase" fw={600} c="#a9b4c4" lts={1.1}>
                {bucket.label}
              </Text>
              <Text size="14px" fw={600} c={INK} mt={2}>
                {bucket.title}
              </Text>
            </Box>
            <Group align="baseline" gap={8} mt={12}>
              <Text size="18px" fw={600} c="#0f172a" lh={0.95}>
                {bucket.count}
              </Text>
              <Text size="12px" c="#475569">
                {bucket.unit}
              </Text>
            </Group>
            <SimpleGrid cols={3} spacing={6} mt={8}>
              {bucket.bands.map((band) => (
                <Box
                  key={`${bucket.title}-${band.label}`}
                  ta="center"
                  py={9}
                  role={areBandsInteractive ? "button" : undefined}
                  tabIndex={areBandsInteractive ? 0 : undefined}
                  onClick={
                    areBandsInteractive
                      ? (event) => {
                          event.stopPropagation();
                          onBandClick?.(band.label);
                        }
                      : undefined
                  }
                  onKeyDown={
                    areBandsInteractive
                      ? (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            event.stopPropagation();
                            onBandClick?.(band.label);
                          }
                        }
                      : undefined
                  }
                  style={{ borderRadius: 8, cursor: areBandsInteractive ? "pointer" : "default", ...bandToneStyle(band.tone) }}
                >
                  <Text size="15px" fw={600} lh={1.1}>
                    {band.value}
                  </Text>
                  <Text size="10px" fw={700} mt={4} lh={1}>
                    {band.label}
                  </Text>
                </Box>
              ))}
            </SimpleGrid>
            <Group justify="space-between" gap="xs" mt={8}>
              <Text
                size="10px"
                c={bucket.trendDirection === "up" ? DANGER : bucket.trendDirection === "down" ? SUCCESS : MUTED}
                fw={600}
              >
                {bucket.trendDirection === "up" ? "▲ " : bucket.trendDirection === "down" ? "▼ " : ""}
                {bucket.trendText || bucket.footer || ""}
              </Text>
              {/* <IconArrowRight size={14} color="#94a3b8" /> */}
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
      <Text size="10px" tt="uppercase" fw={600} c="#94a3b8" lts={0.8}>
        {title}
      </Text>
      <Group align="baseline" gap={8} mt={4}>
        <Text size="26px" fw={600} c={INK} lh={1}>
          {value}
        </Text>
      </Group>
      <Text size="11px" c={color} mt={6} fw={600}>
        {subtitle}
      </Text>
    </Paper>
  );
}

function QueueTabs({
  value,
  onChange,
  counts,
  loading,
}: {
  value: string;
  onChange: (value: string) => void;
  counts: Record<string, number>;
  loading?: boolean;
}) {
  return (
    <Group gap={6} p={0} style={{ flexWrap: "wrap" }}>
      {queueOptions.map((option) => (
        <Button
          key={option.value}
          variant="transparent"
          size="xs"
          radius={6}
          onClick={() => onChange(option.value)}
          disabled={loading}
          styles={{
            root: {
              height: 30,
              color: value === option.value ? "#111827" : "#667085",
              background: value === option.value ? "#ffffff" : "transparent",
              border: value === option.value ? "1px solid #e6ebf2" : "1px solid transparent",
              boxShadow: value === option.value ? "0 4px 12px rgba(15, 23, 42, 0.08)" : "none",
              fontWeight: value === option.value ? 600 : 500,
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
              {loading ? <Loader size={8} color={value === option.value ? "white" : "gray"} /> : (counts[option.value] ?? 0)}
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
        fontWeight: 600,
        flex: "0 0 auto",
      }}
    >
      {initials}
    </Flex>
  );
}

const SHIPMENT_COLUMNS = [
  { label: "Reference", width: 120 },
  { label: "Customer", width: 380 },
  { label: "Lane", width: 160 },
  { label: "Mode", width: 110 },
  { label: "Stage / Progress", width: 195 },
  { label: "ETA / ATA", width: 105 },
  // { label: "Days Pending", width: 110 },
  { label: "Owner", width: 100 },
  // { label: "Action", width: 85 },
] as const;

function ShipmentTable({
  rows,
  loading,
  countsLoading,
  onOpen,
  queueValue,
  onQueueChange,
  counts,
  searchValue,
  onSearchChange,
  totalRows,
  hasNextPage,
  page,
  pageSize,
  onPageChange,
}: {
  rows: ShipmentRow[];
  loading: boolean;
  countsLoading?: boolean;
  onOpen: (row: ShipmentRow) => void;
  queueValue: string;
  onQueueChange: (value: string) => void;
  counts: Record<string, number>;
  searchValue: string;
  onSearchChange: (value: string) => void;
  totalRows: number;
  hasNextPage?: boolean;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const displayRows = loading ? [] : rows;
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const selectedQueueLabel = queueOptions.find((option) => option.value === queueValue)?.label ?? "Selected queue";
  const displayTotalRows = Math.max(totalRows, rows.length);
  const totalPages = Math.max(page, Math.ceil(displayTotalRows / pageSize), hasNextPage ? page + 1 : 1);
  return (
    <Paper
      radius={10}
      aria-busy={loading}
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
          <QueueTabs value={queueValue} onChange={onQueueChange} counts={counts} loading={countsLoading} />
        </Box>
        <Group gap={12} wrap="nowrap" style={{ flex: "0 1 auto", minWidth: 0 }}>
          <TextInput
            size="xs"
            w="clamp(190px, 20vw, 250px)"
            placeholder="Filter by ref, customer, lane"
            value={searchValue}
            disabled={loading}
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
          {loading ? (
            <Group gap={6} wrap="nowrap" style={{ whiteSpace: "nowrap" }}>
              <Loader size={16} color="blue" />
              <Text size="11px" c="#2563eb" fw={600}>
                Loading {selectedQueueLabel}
              </Text>
            </Group>
          ) : null}
          <Text size="12px" c="#667085" style={{ whiteSpace: "nowrap" }}>
            Showing <b>{rows.length}</b> of <b>{counts[queueValue] ?? 0}</b>
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
                fw={600}
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
          <Box style={{ position: "relative", minHeight: loading ? 432 : undefined }}>
            {loading ? (
              <Flex
                align="center"
                justify="center"
                direction="column"
                gap={10}
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 2,
                  background: "rgba(255, 255, 255, 0.72)",
                  backdropFilter: "blur(1px)",
                  pointerEvents: "none",
                }}
              >
                <Loader size={32} color="blue" />
                <Text size="12px" c="#2563eb" fw={700}>
                  Loading shipment data...
                </Text>
              </Flex>
            ) : null}
            <Stack gap={0}>
              {loading &&
                Array.from({ length: 6 }).map((_, index) => (
                  <Flex
                    key={`shipment-loading-${index}`}
                    px={16}
                    py={13}
                    align="center"
                    style={{
                      minHeight: 72,
                      borderBottom: "1px solid #e7ebf1",
                    }}
                  >
                    {SHIPMENT_COLUMNS.map((column) => (
                      <Box key={column.label} w={column.width} flex={`0 0 ${column.width}px`}>
                        <Skeleton height={14} width="75%" radius={6} />
                        {column.label === "Reference / Customer" || column.label === "Stage / Progress" ? (
                          <Skeleton height={9} width="52%" radius={6} mt={8} />
                        ) : null}
                      </Box>
                    ))}
                  </Flex>
                ))}
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
                  <Box w={120} flex="0 0 120px">
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
                            fontWeight: 700,
                          },
                        }}
                      >
                        {row.segment}
                      </Badge>
                    </Group>
                  </Box>
                  <Box w={380} flex="0 0 380px">
                    <Group gap={8} wrap="nowrap">
                      <Text size="13px" fw={600} c="#1f2937" lineClamp={1}>
                        {row.customer}
                      </Text>
                    </Group>
                  </Box>
                  <Box w={160} flex="0 0 160px">
                    <Text size="12px" fw={600} c="#1f2937" className={ERP_LIST_GEIST_MONO_CLASS}>
                      {row.laneFrom} → {row.laneTo}
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
                      <Text size="11px" fw={700} tt="uppercase" ta="center" lh={1.05}>
                        {row.mode}
                      </Text>
                    </Flex>
                  </Box>
                  <Box w={195} flex="0 0 195px">
                    <Text size="12px" fw={700} c="#1f2937">
                      {row.stage}
                    </Text>
                    <ShipmentProgress progress={row.progress} status={row.status} />
                  </Box>
                  <Box w={105} flex="0 0 105px">
                    <Text size="12px" fw={600} c="#1f2937">
                      {row.eta}
                    </Text>
                  </Box>
                  {/* <Box w={110} flex="0 0 110px">
                    <Badge
                      radius={6}
                      styles={{
                        root: {
                          height: 26,
                          minWidth: 48,
                          background: row.status === "breached" ? "#ffe3eb" : row.status === "at_risk" ? "#fff1c7" : "#dff9e8",
                          color: statusColor(row.status),
                          fontWeight: 600,
                          fontSize: 12,
                        },
                      }}
                    >
                      {row.daysPending}d
                    </Badge>
                  </Box> */}
                  <Group w={100} flex="0 0 100px" gap={8} wrap="nowrap">
                    <OwnerAvatar initials={row.ownerInitials} size={28} />
                    <Text size="12px" c="#344054" lineClamp={1}>
                      {row.owner.split(" ")[0]}
                    </Text>
                  </Group>
                  {/* <Group
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
                  </Group> */}
                </Flex>
              );
            })}
            </Stack>
          </Box>
        </Box>
      </ScrollArea>
      {!loading && rows.length === 0 && (
        <Stack align="center" gap={6} py={42}>
          <ThemeIcon variant="light" color="blue" size={44} radius="xl">
            <IconSearch size={22} />
          </ThemeIcon>
          <Text fw={600} c={INK}>
            No shipments match these filters
          </Text>
          <Text size="12px" c={MUTED}>
            Try clearing search, owner, or SLA filters.
          </Text>
        </Stack>
      )}
      {!loading && displayTotalRows > 0 && (
        <Group justify="space-between" px={16} py={12} style={{ borderTop: "1px solid #e7ebf1", background: "#fbfcfe" }}>
          <Text size="12px" c="#667085">
            Page <b>{page}</b> of <b>{totalPages}</b>
          </Text>
          <Pagination size="sm" total={totalPages} value={page} onChange={onPageChange} disabled={loading} />
        </Group>
      )}
    </Paper>
  );
}

function SidePanel({ summary }: { summary: CustomerServiceSummary }) {
  return (
    <Stack gap={12}>
      <Paper radius={14} p={16} style={{ border: `1px solid ${BORDER}`, background: "#fff" }}>
        <Group justify="space-between" mb={6}>
          <Text size="13px" fw={600} c={INK}>
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
              <Text ta="center" size="17px" fw={700} c={INK}>
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
          <Text size="13px" fw={600} c={INK}>
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
                  <Text size="12px" fw={600} c={INK}>
                    {row.name}
                  </Text>
                  <Text size="10px" c={MUTED}>
                    {row.role}
                  </Text>
                </Box>
              </Group>
              <Box ta="right">
                <Text size="13px" fw={700} c={INK}>
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
          <Text size="13px" fw={600} c={INK}>
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
      <Text size="11px" fw={600} c={INK}>
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
    fontWeight: 600,
    fontFamily: ERP_LIST_FONT_SANS,
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

function DetailDrawer({ shipment, loading, onClose }: { shipment: ShipmentRow | null; loading?: boolean; onClose: () => void }) {
  const open = Boolean(shipment);
  const documents = shipment?.documents ?? [];
  const timeline = shipment?.timeline ?? [];
  const comms = shipment?.comms ?? [];

  return (
    <Drawer
      opened={open}
      onClose={onClose}
      position="right"
      size={520}
      padding={0}
      withCloseButton={false}
      overlayProps={{ backgroundOpacity: 0.5, blur: 1 }}
      classNames={{
        content: ERP_LIST_GEIST_ROOT_CLASS,
        body: ERP_LIST_GEIST_ROOT_CLASS,
        header: ERP_LIST_GEIST_ROOT_CLASS,
        inner: ERP_LIST_GEIST_ROOT_CLASS,
      }}
      styles={{
        content: {
          background: "#fff",
          maxWidth: "100vw",
          boxShadow: "-18px 0 40px rgba(15, 23, 42, 0.18)",
          fontFamily: ERP_LIST_FONT_SANS,
        },
        body: {
          height: "100%",
          display: "flex",
          flexDirection: "column",
          fontFamily: ERP_LIST_FONT_SANS,
        },
        header: { fontFamily: ERP_LIST_FONT_SANS },
      }}
    >
      {shipment && (
        <>
          <Box px={22} pt={18} pb={14} style={{ borderBottom: `1px solid ${BORDER}` }}>
            <Group justify="space-between" align="flex-start">
              <Box style={{ minWidth: 0 }}>
                <Text size="xs" tt="uppercase" fw={500} c="#64748b" lts={1.2}>
                  {shipment.segment} · {shipment.mode}
                </Text>
                <Text fw={700} size="md" c="#111827" mt={3} lh={1.25}>
                  {shipment.customer}
                </Text>
                <Text size="xs" fw={500} c="dimmed" mt={4} lh={1.45} className={ERP_LIST_GEIST_MONO_CLASS}>
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
            {loading ? (
              <Group gap={6} mt={10} wrap="nowrap">
                <Loader size={14} color="blue" />
                <Text size="xs" c="#2563eb" fw={600}>
                  Loading job details…
                </Text>
              </Group>
            ) : null}
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
              {/* <Tabs.Tab value="comms" styles={detailTabStyles}>
                Comms <span style={{ color: "#98a2b3", marginLeft: 4 }}>{Math.max(12, comms.length)}</span>
              </Tabs.Tab> */}
            </Tabs.List>
            <ScrollArea style={{ flex: 1, position: "relative" }}>
              {loading ? (
                <Box
                  style={{
                    position: "absolute",
                    inset: 0,
                    zIndex: 3,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    background: "rgba(255, 255, 255, 0.78)",
                    backdropFilter: "blur(2px)",
                  }}
                >
                  <Loader size={28} color="blue" />
                  <Text size="12px" c="#2563eb" fw={600}>
                    Loading shipment details…
                  </Text>
                </Box>
              ) : null}
              <Tabs.Panel value="overview" p={22}>
                <Stack gap={18}>
                  <Paper radius={8} p={14} style={{ border: `1px solid ${BORDER}`, background: "#fbfdff" }}>
                    <Group justify="space-between" align="center" wrap="nowrap">
                      <Box>
                        <Text size="26px" fw={600} c="#111827" lh={1}>
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
                        <Text size="26px" fw={600} c="#111827" lh={1}>
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
                    <Text size="10px" tt="uppercase" fw={500} c="#64748b" lts={0.06} mb={12}>
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
                    <Text size="10px" tt="uppercase" fw={500} c="#64748b" lts={0.06} mb={8}>
                      Current Status
                    </Text>
                    <Paper radius={8} p={13} style={{ background: "#fff7d6", border: "1px solid #facc15" }}>
                      <Group gap={8} mb={6}>
                        <IconBellRinging size={16} color="#a16207" />
                        <Text size="13px" fw={600} c="#854d0e">
                          {shipment.stage}
                        </Text>
                      </Group>
                      <Text size="11px" c="#7c5b10" lh={1.45}>
                        {shipment.currentStatusDetail || "Customer service activity is in progress."}
                      </Text>
                    </Paper>
                  </Box>
                  <Box>
                    <Text size="10px" tt="uppercase" fw={500} c="#64748b" lts={0.06} mb={8}>
                      Assigned
                    </Text>
                    <Paper radius={8} p={12} style={{ border: `1px solid ${BORDER}`, background: "#fbfdff" }}>
                    <Group justify="space-between">
                      <Group gap={12}>
                        <OwnerAvatar initials={shipment.ownerInitials} size={38} />
                        <Box>
                          <Text size="13px" fw={600} c="#111827">
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
                  <Text size="10px" tt="uppercase" fw={500} c="#64748b" lts={0.06}>
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
                              <Text size="sm" fw={600} c="#111827" lineClamp={1}>
                                {doc.name}
                              </Text>
                              <Text size="xs" fw={500} c="dimmed" className={ERP_LIST_GEIST_MONO_CLASS} lineClamp={1}>
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
                                fontWeight: 600,
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
                        <Text
                          size="sm"
                          fw={item.state === "active" ? 700 : 600}
                          c={item.state === "pending" ? "#98a2b3" : "#111827"}
                        >
                          {item.title}
                        </Text>
                        <Text size="xs" fw={400} c={item.state === "active" ? DANGER : "dimmed"} className={ERP_LIST_GEIST_MONO_CLASS}>
                          {item.detail.includes("Aging critical") ? (
                            <>
                              {item.detail.replace(" · Aging critical", "")}
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
                            <Text size="12px" fw={600} c={INK}>
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
            <Button variant="default" radius={6} disabled={loading} styles={{ root: { height: 34, fontWeight: 600 } }}>
              Chase agent
            </Button>
            <Button variant="default" radius={6} disabled={loading} styles={{ root: { height: 34, fontWeight: 600 } }}>
              Add follow-up
            </Button>
            <Button color="dark" radius={6} disabled={loading} styles={{ root: { height: 34, background: NAVY, fontWeight: 600 } }}>
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
      <Text size="10px" tt="uppercase" fw={500} c="#64748b" lts={0.06}>
        {label}
      </Text>
      <Text size="13px" fw={600} c={INK} mt={3}>
        {value}
      </Text>
    </Box>
  );
}

const CustomerServiceDashboard: React.FC<CustomerServiceDashboardProps> = ({ fromDate, toDate, globalSearch }) => {
  const [summary, setSummary] = useState<CustomerServiceSummary | null>(null);
  const [rows, setRows] = useState<ShipmentRow[]>([]);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(true);
  const [pageIndex, setPageIndex] = useState(0);
  const [totalShipments, setTotalShipments] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<ShipmentRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [apiNotice, setApiNotice] = useState<string | null>(null);
  const shipmentTableRef = useRef<HTMLDivElement | null>(null);
  const detailFetchSeq = useRef(0);
  const [debouncedShipmentSearch] = useDebouncedValue(filters.search, 500);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const nextSummary = await fetchSummary(fromDate, toDate);
      setSummary(nextSummary);
      setApiNotice(null);
    } catch {
      setSummary(null);
      setApiNotice("Summary data is unavailable. The CS operation cards are waiting for the dashboard summary API.");
    } finally {
      setSummaryLoading(false);
    }
  }, [fromDate, toDate]);

  const loadShipments = useCallback(async () => {
    setTableLoading(true);
    try {
      const nextPage = await fetchShipments(
        { ...filters, search: debouncedShipmentSearch },
        fromDate,
        toDate,
        globalSearch,
        pageIndex,
        SHIPMENT_PAGE_LIMIT,
      );
      setRows(nextPage.rows);
      setTotalShipments(nextPage.count);
      setHasNextPage(nextPage.hasNext);
      setApiNotice(null);
    } catch {
      setRows([]);
      setTotalShipments(0);
      setHasNextPage(false);
      setApiNotice("Shipment table data is unavailable. The selected CS queue is waiting for the dashboard drill-down API.");
    } finally {
      setTableLoading(false);
    }
  }, [
    debouncedShipmentSearch,
    filters.bucketLabel,
    filters.mode,
    filters.owner,
    filters.queue,
    filters.segment,
    filters.status,
    fromDate,
    toDate,
    globalSearch,
    pageIndex,
  ]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    loadShipments();
  }, [loadShipments]);

  useEffect(() => {
    setPageIndex(0);
  }, [fromDate, toDate, globalSearch]);

  useEffect(() => {
    setFilters((current) => {
      const hasMode = current.mode === "All" || rows.some((row) => row.mode === current.mode);
      const hasOwner = current.owner === "All" || rows.some((row) => row.owner === current.owner);
      const hasSegment = current.segment === "All" || rows.some((row) => row.segment === current.segment);
      const hasStatus = current.status === "All" || rows.some((row) => row.status === current.status);

      if (hasMode && hasOwner && hasSegment && hasStatus) return current;

      return {
        ...current,
        mode: hasMode ? current.mode : "All",
        owner: hasOwner ? current.owner : "All",
        segment: hasSegment ? current.segment : "All",
        status: hasStatus ? current.status : "All",
      };
    });
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (filters.segment !== "All" && row.segment !== filters.segment) return false;
      if (filters.mode !== "All" && row.mode !== filters.mode) return false;
      if (filters.owner !== "All" && row.owner !== filters.owner) return false;
      if (filters.status !== "All" && row.status !== filters.status) return false;
      return true;
    });
  }, [filters.segment, filters.mode, filters.owner, filters.status, rows]);

  const counts = useMemo(
    () => ({
      "pending-bl-awb": summary?.export?.count ?? 0,
      "pending-can-do": summary?.import?.count ?? 0,
      "invoice-pending": summary?.billing?.count ?? 0,
      exceptions: summary?.exceptions?.count ?? 0,
      "live-shipments": summary?.activeShipments ?? 0,
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
    setPageIndex(0);
    setFilters((current) => {
      if (key === "queue") {
        return { ...DEFAULT_FILTERS, queue: String(value) };
      }
      return { ...current, [key]: value };
    });
  };

  const scrollToShipmentQueue = useCallback((queue: FilterState["queue"], bucketLabel?: string) => {
    setPageIndex(0);
    setFilters({ ...DEFAULT_FILTERS, queue, bucketLabel });
    requestAnimationFrame(() => {
      shipmentTableRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, []);

  const openShipmentDetail = useCallback(async (row: ShipmentRow) => {
    const seq = ++detailFetchSeq.current;
    setDetailLoading(true);
    setSelectedShipment(row);
    try {
      const detail = await fetchShipmentDetail(row);
      if (detailFetchSeq.current !== seq) return;
      setSelectedShipment((current) => (current?.id === row.id ? detail : current));
    } catch {
      if (detailFetchSeq.current === seq) {
        setApiNotice("Shipment detail data is unavailable. Showing the selected row details.");
      }
    } finally {
      if (detailFetchSeq.current === seq) setDetailLoading(false);
    }
  }, []);

  const headerContextLabel = useMemo(() => {
    const ownerLabel = filters.owner === "All" ? "All agents" : filters.owner;
    const modeLabel = filters.mode === "All" ? "All modes" : filters.mode;
    const segmentLabel = filters.segment === "All" ? "Export / Import" : filters.segment;

    return `Today · Apr 24 · ${ownerLabel} · ${modeLabel} · ${segmentLabel}`;
  }, [filters.mode, filters.owner, filters.segment]);
  const dashboardLoading = summaryLoading || tableLoading;

  return (
    <Box
      style={{
        minHeight: "100%",
        background: PAGE_BG,
        paddingBottom: 30,
      }}
    >
      <Stack gap={16}>
        {/* <Paper radius={0} p={18} style={{ border: `1px solid ${BORDER}`, borderRadius: 14, background: "#fff" }}>
          <Flex
            justify="space-between"
            align="flex-start"
            gap={24}
            wrap="nowrap"
            style={{
              overflowX: "auto",
              overflowY: "hidden",
              scrollbarWidth: "thin",
              WebkitOverflowScrolling: "touch",
            }}
          >
            <Box style={{ minWidth: 420, flex: "1 0 auto" }}>
              <Text size="12px" c="#94a3b8" fw={700}>
                Pentagon Freight · Customer Service · Overview
              </Text>
              <Text size="24px" fw={700} c={INK} mt={7}>
                Customer Service — Live Operations
              </Text>
              <Text size="12px" c={MUTED} mt={3}>
                Team Lead view · 6 agents · {summary?.activeShipments ?? 0} active shipments · {headerContextLabel} · Updated{" "}
                {summary?.updatedAgo || "—"}
              </Text>
            </Box>
            <Group gap={8} wrap="nowrap" style={{ flexShrink: 0, marginLeft: "auto" }}>
              {dashboardLoading ? (
                <Group
                  gap={6}
                  px={10}
                  h={30}
                  wrap="nowrap"
                  style={{
                    border: "1px solid #bfdbfe",
                    borderRadius: 8,
                    background: "#eff6ff",
                    color: "#1d4ed8",
                  }}
                >
                  <Loader size={13} color="blue" />
                  <Text size="11px" fw={700} style={{ whiteSpace: "nowrap" }}>
                    Refreshing CS data
                  </Text>
                </Group>
              ) : null}

              <Select
                size="xs"
                w={130}
                value={filters.owner}
                data={ownerOptions}
                disabled={tableLoading}
                onChange={(value) => updateFilter("owner", value || "All")}
                leftSection={<IconUserCircle size={14} color={SUCCESS} />}
              />
              <Select size="xs" w={118} value={filters.mode} data={modeOptions} disabled={tableLoading} onChange={(value) => updateFilter("mode", value || "All")} />
              <Select
                size="xs"
                w={130}
                value={filters.segment}
                data={["All", "Export", "Import"].map((value) => ({ value, label: value === "All" ? "Export / Import" : value }))}
                disabled={tableLoading}
                onChange={(value) => updateFilter("segment", value || "All")}
              />
              <Button size="xs" variant="default" leftSection={<IconDownload size={14} />}>
                Export
              </Button>
            </Group>
          </Flex>
        </Paper> */}

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

        {apiNotice && (
          <Paper radius={10} p={10} style={{ border: "1px solid #bae6fd", background: "#f0f9ff" }}>
            <Group gap={8}>
              <IconRefresh size={15} color={INFO} />
              <Text size="12px" c="#075985" fw={700}>
                {apiNotice}
              </Text>
            </Group>
          </Paper>
        )}

        <SimpleGrid cols={{ base: 1, md: 3 }} spacing={18}>
          <MetricCard
            bucket={summary?.export}
            loading={summaryLoading}
            onClick={() => scrollToShipmentQueue("pending-bl-awb")}
            onBandClick={(label) => scrollToShipmentQueue("pending-bl-awb", label)}
          />
          <MetricCard
            bucket={summary?.import}
            loading={summaryLoading}
            onClick={() => scrollToShipmentQueue("pending-can-do")}
            onBandClick={(label) => scrollToShipmentQueue("pending-can-do", label)}
          />
          <MetricCard
            bucket={summary?.billing}
            loading={summaryLoading}
            onClick={() => scrollToShipmentQueue("invoice-pending")}
            onBandClick={(label) => scrollToShipmentQueue("invoice-pending", label)}
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
              countsLoading={summaryLoading}
              onOpen={openShipmentDetail}
              queueValue={filters.queue}
              onQueueChange={(value) => updateFilter("queue", value)}
              counts={counts}
              searchValue={filters.search}
              onSearchChange={(value) => updateFilter("search", value)}
              totalRows={totalShipments}
              hasNextPage={hasNextPage}
              page={pageIndex + 1}
              pageSize={SHIPMENT_PAGE_LIMIT}
              onPageChange={(page) => setPageIndex(page - 1)}
            />
          </Stack>
          {/* <Box w={{ base: "100%", xl: 300 }} style={{ flexShrink: 0 }}>
            <SidePanel summary={summary} />
          </Box> */}
        </Flex>
      </Stack>
      <DetailDrawer
        shipment={selectedShipment}
        loading={detailLoading}
        onClose={() => {
          detailFetchSeq.current += 1;
          setDetailLoading(false);
          setSelectedShipment(null);
        }}
      />
    </Box>
  );
};

export default CustomerServiceDashboard;
