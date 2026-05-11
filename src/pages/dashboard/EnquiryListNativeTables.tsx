import {
  ActionIcon,
  Badge,
  Box,
  Center,
  Group,
  Loader,
  Stack,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import dayjs from "dayjs";
import {
  IconArrowRight,
  IconFileText,
  IconFilter,
  IconFilterFilled,
  IconPackage,
  IconX,
} from "@tabler/icons-react";
import type { ErpListTheme } from "../../components/ERPListPage/erpListTheme";
import {
  erpListDataRowProps,
  erpListRouteListCell,
  erpListRowActionMenuTdStyle,
  erpListTableElementStyle,
  erpListTdPaddingStyle,
  erpListThActionsSpacer,
  erpListThStyle,
} from "../../components";
import { EnquirySummaryRowMenu, type EnquiryRowMenuContext } from "./EnquirySummaryRowMenu";
import type { PreviewColDef } from "./EnquiryListPreviewBuild";

/**
 * Header column-filter keys supported by both the Summary and the Detailed list.
 * The values are bound to the parent's existing filter / previewFilter state so we never duplicate state.
 */
export type EnquiryHeaderFilterKey =
  | "enquiry_id"
  | "customer_name"
  | "sales_person"
  | "service"
  | "trade"
  | "origin"
  | "destination"
  | "status"
  | "reference_no";

export type EnquiryHeaderFilterValues = Record<EnquiryHeaderFilterKey, string>;

/** Context passed to a header column's custom input renderer. */
export type EnquiryHeaderInputContext = {
  /** Whether the input should auto-focus when mounted (always `true` for now). */
  autoFocus: boolean;
  /**
   * Imperatively collapse the cell back to display mode (e.g. immediately after
   * an option is picked from a `SearchableSelect` or `Select`). When the cell
   * already collapses on blur this is optional.
   */
  onClose: () => void;
};

export type EnquiryHeaderRenderInput = (ctx: EnquiryHeaderInputContext) => ReactNode;

export type EnquiryHeaderFiltersProp = {
  values: EnquiryHeaderFilterValues;
  onChange: (key: EnquiryHeaderFilterKey, value: string) => void;
  /**
   * Optional per-column custom input. When provided, used INSTEAD of the
   * default `TextInput` once the user clicks the column header to enter edit
   * mode. The parent typically supplies a `SearchableSelect` (customer / port)
   * or `Select` (status / service / trade / sales person) here so the column
   * filters mirror the advanced filter section -- which keeps the API payload
   * shape identical (e.g. customer_code instead of free text).
   */
  renderInput?: Partial<Record<EnquiryHeaderFilterKey, EnquiryHeaderRenderInput>>;
  /**
   * Optional per-column formatter for the collapsed header label. Useful when
   * the underlying filter value is a code (e.g. `INMAA`) but a friendlier label
   * (e.g. `Chennai (INMAA)`) is available from a sibling display-value cache.
   */
  displayFormatter?: Partial<Record<EnquiryHeaderFilterKey, (value: string) => string>>;
};

/** Identifies which column header is currently in "edit" mode (`service` and `route` are dual-input cells). */
type SummaryEditingColumn =
  | "enquiry_id"
  | "customer_name"
  | "sales_person"
  | "service"
  | "route"
  | "status"
  | "reference_no"
  | null;

type PreviewEditingColumn = string | null;

const HEADER_FILTER_TEXTINPUT_STYLES = {
  input: {
    height: 26,
    minHeight: 26,
    fontSize: 12,
    paddingLeft: 8,
    paddingRight: 24,
  },
} as const;

function HeaderFilterInput({
  value,
  onChange,
  placeholder = "Filter...",
  ariaLabel,
  autoFocus,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  ariaLabel: string;
  autoFocus?: boolean;
}) {
  return (
    <TextInput
      size="xs"
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      autoFocus={autoFocus}
      styles={HEADER_FILTER_TEXTINPUT_STYLES}
      rightSection={
        value ? (
          <ActionIcon
            variant="transparent"
            size="xs"
            color="gray"
            onMouseDown={(e) => {
              // Prevent the input from blurring before our handler can fire
              e.preventDefault();
            }}
            onClick={() => onChange("")}
            aria-label={`Clear ${ariaLabel}`}
          >
            <IconX size={12} />
          </ActionIcon>
        ) : null
      }
    />
  );
}

/**
 * Route-column header label.
 *
 * - When neither side is filtered: shows the plain column name `"Route"`
 *   (identical look to every other unfiltered header).
 * - When at least one side is filtered: shows the raw filter CODES in the
 *   same `ORIGIN → DESTINATION` shape used inside the body cells (see
 *   `erpListRouteListCell`) -- intentionally codes only, never the resolved
 *   port names, so the header stays compact even when the user picked the
 *   long "City Name (CODE)" labels from the SearchableSelect. Any missing
 *   side falls back to `"—"` to match the body's "missing value" fallback.
 *
 * Clicking the label opens the inline route editor, exactly like the existing
 * `FilterableHeaderLabel`. Filtered state also shows the small `IconFilterFilled`
 * indicator on the far right so it visually matches the other column headers.
 */
function FilterableRouteHeaderLabel({
  originCode,
  destinationCode,
  onClick,
  theme,
  label = "Route",
}: {
  originCode: string;
  destinationCode: string;
  onClick: () => void;
  theme: ErpListTheme;
  label?: string;
}) {
  const o = originCode.trim();
  const d = destinationCode.trim();
  const isFiltered = o.length > 0 || d.length > 0;

  const baseButtonStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    width: "100%",
    fontFamily: theme.fontSans,
    fontWeight: 500,
    cursor: "pointer",
    textAlign: "left",
    whiteSpace: "nowrap",
    overflow: "hidden",
    minWidth: 0,
  };

  // Unfiltered -> render exactly like `FilterableHeaderLabel` so the header
  // reads as the plain column name "Route" with an ellipsis if it ever needs
  // to truncate.
  if (!isFiltered) {
    return (
      <UnstyledButton
        onClick={onClick}
        className="erp-header-filter-fade"
        style={baseButtonStyle}
        title="Click to filter"
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            minWidth: 0,
          }}
        >
          {label}
        </span>
      </UnstyledButton>
    );
  }

  // Filtered -> show codes only ("INMAA → JFK"), matching the body cell.
  const left = o || "—";
  const right = d || "—";
  return (
    <UnstyledButton
      onClick={onClick}
      className="erp-header-filter-fade"
      style={baseButtonStyle}
      title={`Filter: ${left} → ${right}\nClick to edit`}
    >
      <span
        style={{
          flexShrink: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          color: o ? theme.primary : undefined,
          fontWeight: o ? 600 : 500,
        }}
      >
        {left}
      </span>
      <IconArrowRight
        size={12}
        color={theme.muted}
        style={{ flexShrink: 0 }}
      />
      <span
        style={{
          flexShrink: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          color: d ? theme.fg : undefined,
        }}
      >
        {right}
      </span>
      <IconFilterFilled
        size={14}
        color={theme.muted}
        style={{  marginLeft: 6 }}
      />
    </UnstyledButton>
  );
}

/** Renders the original header label (or the active filter value) as a clickable button that opens the edit input. */
function FilterableHeaderLabel({
  label,
  filterDisplay,
  onClick,
  theme,
  align = "left",
}: {
  label: string;
  filterDisplay: string;
  onClick: () => void;
  theme: ErpListTheme;
  align?: "left" | "center" | "right";
}) {
  const isFiltered = filterDisplay.length > 0;
  return (
    <UnstyledButton
      onClick={onClick}
      className="erp-header-filter-fade"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        width: "100%",
        fontFamily: theme.fontSans,
        // color: isFiltered ? theme.fg : theme.muted,
        fontWeight: 500,
        // fontSize: 14,
        cursor: "pointer",
        textAlign: align,
        justifyContent:
          align === "right" ? "flex-end" : align === "center" ? "center" : "flex-start",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        minWidth: 0,
      }}
      title={isFiltered ? `Filter: ${filterDisplay}\nClick to edit` : `Click to filter`}
    >
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          minWidth: 0,
          // flex: 1,
        }}
        >
        {isFiltered ? filterDisplay : label}
      </span>
      {isFiltered && (
        <IconFilterFilled size={14} color={theme.muted} />
      )}
    </UnstyledButton>
  );
}

/**
 * Container around the edit input(s). Auto-focuses the first input on mount,
 * collapses on Escape, and collapses on blur once focus leaves all inputs in
 * this cell (so the user can tab between dual inputs without flicker).
 */
function FilterableHeaderEdit({
  onCollapse,
  children,
}: {
  /**
   * Must use the functional-set form (`setState((cur) => cur === me ? null : cur)`)
   * so a click on another header that switches the editing column does not get
   * stomped by this collapse handler.
   */
  onCollapse: () => void;
  children: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleBlur = useCallback(
    (_e: ReactFocusEvent) => {
      // Defer the focus check so a click that lands on another input in the
      // same cell (Tab / X-clear) does not falsely trigger a collapse.
      setTimeout(() => {
        const container = containerRef.current;
        if (!container) return;
        if (!container.contains(document.activeElement)) {
          onCollapse();
        }
      }, 0);
    },
    [onCollapse],
  );

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent) => {
      if (e.key === "Escape") {
        onCollapse();
      }
    },
    [onCollapse],
  );

  return (
    <div
      ref={containerRef}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className="erp-header-filter-fade"
      style={{ width: "100%", minWidth: 0 }}
    >
      {children}
    </div>
  );
}

function formatServiceTradeDisplay(service: string, trade: string): string {
  const s = service.trim();
  const t = trade.trim();
  if (s && t) return `${s} - ${t}`;
  return s || t;
}

function formatRouteDisplay(origin: string, destination: string): string {
  const o = origin.trim();
  const d = destination.trim();
  if (o && d) return `${o} → ${d}`;
  return o || d;
}

/** Enquiry tables: wider ID & Service (single-line clamp); Reference No uses shared widths below. */
const ENQUIRY_COL_ID_MIN = 200;
const ENQUIRY_COL_SERVICE_MIN = 180;
const ENQUIRY_COL_SALES_PERSON_MIN = 115;
const ENQUIRY_COL_REFERENCE_TH_MIN = 92;
const ENQUIRY_COL_REFERENCE_TD_MAX = 126;
const ENQUIRY_COL_REFERENCE_TABLE_WIDTH = "9%";
/** Detailed list Route: min width + nowrap so origin → dest stays on one line; full value in tooltip. */
const ENQUIRY_COL_ROUTE_DETAILED_MIN = 330;
/** Summary list Route: room for code pairs on one line; names in tooltip. */
const ENQUIRY_COL_ROUTE_SUMMARY_MIN = 200;
/** Route column tooltips (summary + detailed) — max width of the floating label. */
const ENQUIRY_ROUTE_TOOLTIP_MAX_WIDTH = 300;
/** Summary list: avoid `lineClamp` ellipsis when many columns squeeze auto table layout (DD-MM-YYYY + padding). */
const ENQUIRY_SUMMARY_DATE_COL_MIN = 100;

/** Normalize API values into string arrays so route rows pair by index (or stay a single segment). */
function routePairValuesAsArrays(originVal: unknown, destVal: unknown): { oa: string[]; da: string[] } {
  const toSegments = (v: unknown): string[] => {
    if (Array.isArray(v))
      return (v as unknown[]).map((x) => (x != null ? String(x).trim() : ""));
    if (v != null && String(v).trim() !== "") return [String(v).trim()];
    return [];
  };
  let oa = toSegments(originVal);
  let da = toSegments(destVal);
  const n = Math.max(oa.length, da.length, 1);
  while (oa.length < n) oa.push("");
  while (da.length < n) da.push("");
  return { oa, da };
}

/** Multi-line tooltip: `"Origin → Destination"` per paired row (matches route cell semantics). */
function routePairTooltipLabel(originVal: unknown, destVal: unknown): string {
  const { oa, da } = routePairValuesAsArrays(originVal, destVal);
  const lines: string[] = [];
  for (let i = 0; i < oa.length; i++) {
    const oc = oa[i]?.trim() || "—";
    const dc = da[i]?.trim() || "—";
    lines.push(`${oc} → ${dc}`);
  }
  return lines.join("\n");
}

export type EnquirySummaryVisibleColumns = {
  sno: boolean;
  enquiry_id: boolean;
  customer_name: boolean;
  sales_person: boolean;
  service: boolean;
  /** One column: origin → destination (same layout as Air Export Booking “Route”). */
  route: boolean;
  reference_no: boolean;
  date: boolean;
  status: boolean;
  remark: boolean;
};

type SummaryRow = Record<string, unknown> & {
  sno?: number;
  enquiry_id?: string;
  customer_name?: string;
  sales_person?: string;
  services?: Array<{
    service?: string;
    trade?: string;
    service_remark?: string;
    origin_name?: string;
    destination_name?: string;
    origin_port_name?: string;
    destination_port_name?: string;
  }>;
  /** Port names (download / filter API uses these; codes shown in-route use `*_code_list`). */
  origin_list?: string[];
  destination_list?: string[];
  origin_name_list?: string[];
  destination_name_list?: string[];
  origin_code_list?: string[];
  destination_code_list?: string[];
  reference_no?: string;
  enquiry_received_date?: string;
  status?: string;
};

/** True when at least one side has non-empty entries (paired route tooltip). */
function routeListPairExists(oa?: unknown, da?: unknown): boolean {
  const has = (x: unknown) =>
    Array.isArray(x) && (x as unknown[]).some((e) => e != null && String(e).trim() !== "");
  return has(oa) || has(da);
}

/** Summary Route hover: port/place names (not codes). Prefer explicit `*_name_list`, then `origin_list` / `destination_list`, then `services`. */
function summaryRouteNameTooltip(row: SummaryRow): string {
  if (routeListPairExists(row.origin_name_list, row.destination_name_list)) {
    const t = routePairTooltipLabel(row.origin_name_list, row.destination_name_list).trim();
    if (t) return t;
  }
  if (routeListPairExists(row.origin_list, row.destination_list)) {
    const t = routePairTooltipLabel(row.origin_list, row.destination_list).trim();
    if (t) return t;
  }
  const svc = row.services;
  if (Array.isArray(svc) && svc.length > 0) {
    const lines = svc
      .map((s) => {
        const o = (s.origin_name?.trim() || s.origin_port_name?.trim() || "").trim();
        const d = (s.destination_name?.trim() || s.destination_port_name?.trim() || "").trim();
        if (!o && !d) return null;
        return `${o || "—"} → ${d || "—"}`;
      })
      .filter((x): x is string => x != null);
    if (lines.length > 0) return lines.join("\n");
  }
  return "";
}

function ellipsisTooltipStyles(fontSans: string, whiteSpace: "nowrap" | "pre-line" | "pre-wrap") {
  return { tooltip: { fontFamily: fontSans, fontSize: 12, maxWidth: 360, whiteSpace } as const };
}

function routeTooltipStyles(fontSans: string) {
  return {
    tooltip: {
      fontFamily: fontSans,
      fontSize: 12,
      maxWidth: ENQUIRY_ROUTE_TOOLTIP_MAX_WIDTH,
      whiteSpace: "pre-line" as const,
    },
  };
}

/** Single visible line + full value in tooltip (same pattern as Customer column). */
function TextLineClampTooltip({
  text,
  tooltip,
  fg,
  fontSans,
  fw,
  dimmed,
  color,
  maxWidth = 220,
}: {
  text: string;
  tooltip: string;
  fg: string;
  fontSans: string;
  fw?: number;
  dimmed?: boolean;
  /** Overrides `fg` / `dimmed` when set (e.g. theme muted hex). */
  color?: string;
  maxWidth?: number;
}) {
  const empty = text === "" || text === "—";
  const content = (
    <Text
      fw={fw}
      size="sm"
      {...(color ? {} : dimmed ? { c: "dimmed" as const } : { c: fg })}
      lineClamp={1}
      style={{
        cursor: empty ? undefined : "default",
        fontFamily: fontSans,
        minWidth: 0,
        ...(color ? { color } : {}),
      }}
    >
      {empty ? "—" : text}
    </Text>
  );
  if (empty) {
    return content;
  }
  return (
    <Tooltip label={tooltip} withArrow styles={ellipsisTooltipStyles(fontSans, "pre-line")}>
      <Box style={{ maxWidth, minWidth: 0 }}>{content}</Box>
    </Tooltip>
  );
}

function renderServiceCell(services: unknown, fg: string, fontSans: string): ReactNode {
  const list = services as Array<{ service?: string; trade?: string }> | undefined;
  if (!list || !Array.isArray(list) || list.length === 0) {
    return (
      <Text size="sm" c="dimmed" style={{ fontFamily: fontSans }}>
        —
      </Text>
    );
  }
  const pairs = list
    .map((s) => {
      const service = s.service || "";
      const trade = s.trade || "";
      if (!service && !trade) return null;
      if (!service) return trade;
      if (!trade) return service;
      return `${service} - ${trade}`;
    })
    .filter((p): p is string => p !== null);
  const unique = [...new Set(pairs)];
  if (unique.length === 0) {
    return (
      <Text size="sm" c="dimmed" style={{ fontFamily: fontSans }}>
        —
      </Text>
    );
  }
  const lineText = unique.join(", ");
  const tip = unique.join("\n");
  return (
    <TextLineClampTooltip
      text={lineText}
      tooltip={tip}
      fg={fg}
      fontSans={fontSans}
      maxWidth={ENQUIRY_COL_SERVICE_MIN}
    />
  );
}

function renderRemarkCell(services: unknown, fg: string, fontSans: string): ReactNode {
  const list = services as Array<{ service_remark?: string }> | undefined;
  if (!list || !Array.isArray(list) || list.length === 0) {
    return (
      <Text size="sm" c="dimmed" style={{ fontFamily: fontSans }}>
        —
      </Text>
    );
  }
  const remarks = list.map((s) => s.service_remark).filter((r) => r);
  const unique = [...new Set(remarks as string[])];
  if (unique.length === 0) {
    return (
      <Text size="sm" c="dimmed" style={{ fontFamily: fontSans }}>
        —
      </Text>
    );
  }
  const lineText = unique.join("; ");
  const tip = unique.join("\n");
  return <TextLineClampTooltip text={lineText} tooltip={tip} fg={fg} fontSans={fontSans} maxWidth={260} />;
}

type SummaryTableProps = {
  theme: ErpListTheme;
  rows: SummaryRow[];
  dateFormat: string;
  getStatusBadge: (s: string | undefined | null) => { label: string; color: string };
  visible: EnquirySummaryVisibleColumns;
  rowMenuCtx: EnquiryRowMenuContext;
  actionsOpenKey: string | number | null;
  onActionsKeyChange: (key: string | number | null) => void;
  menuDropdownClassName?: string;
  /**
   * Optional inline column header filters. When provided, a second header row is rendered
   * underneath the existing labels. Values and handlers MUST be bound to the parent page's
   * existing filter state so the advanced filters panel and these header filters stay in sync
   * via a single source of truth (no client-side row filtering happens here).
   */
  headerFilters?: EnquiryHeaderFiltersProp;
  /**
   * When true, the table keeps its `<thead>` (and therefore the click-to-edit
   * header filters) mounted but renders a centered loader inside `<tbody>`
   * instead of the data rows. This avoids unmounting the table -- and losing
   * the open header-filter editor -- whenever a refetch is in flight.
   */
  loading?: boolean;
  /** Optional message shown below the loader spinner (defaults to "Loading…"). */
  loadingMessage?: string;
};

function rowKey(r: SummaryRow, index: number) {
  return (r.id as number | undefined) ?? (r.enquiry_id as string | undefined) ?? `row-${index}`;
}

/**
 * List table: matches {@link AirExportBookingMaster} — `Th` + row borders + `10px 14px` data cells, empty 44px menu header, `10px 8px` centered menu cell.
 */
export function EnquirySummaryNativeTable({
  theme,
  rows,
  dateFormat,
  getStatusBadge,
  visible,
  rowMenuCtx,
  actionsOpenKey,
  onActionsKeyChange,
  menuDropdownClassName,
  headerFilters,
  loading = false,
  loadingMessage = "Loading…",
}: SummaryTableProps) {
  const { fg, fontSans, muted, primary } = theme;
  const visibleCount =
    (visible.sno ? 1 : 0) +
    (visible.enquiry_id ? 1 : 0) +
    (visible.customer_name ? 1 : 0) +
    (visible.sales_person ? 1 : 0) +
    (visible.service ? 1 : 0) +
    (visible.route ? 1 : 0) +
    (visible.reference_no ? 1 : 0) +
    (visible.date ? 1 : 0) +
    (visible.status ? 1 : 0) +
    (visible.remark ? 1 : 0) +
    1;

  // Which column is currently in "edit" mode. Only meaningful when headerFilters is provided.
  const [editingColumn, setEditingColumn] = useState<SummaryEditingColumn>(null);

  const openEditor = useCallback(
    (col: NonNullable<SummaryEditingColumn>) => {
      if (!headerFilters) return;
      setEditingColumn(col);
    },
    [headerFilters],
  );

  // IMPORTANT: use a functional setter so a fast click on another header that
  // already switched the editing column does not get clobbered by this collapse.
  const makeCollapse = useCallback(
    (col: NonNullable<SummaryEditingColumn>) => () => {
      setEditingColumn((cur) => (cur === col ? null : cur));
    },
    [],
  );

  // Localised value pulls (default empty string so the component is safe when
  // `headerFilters` is omitted -- e.g. when this table is rendered from RFQMaster).
  const v = headerFilters?.values;
  const enquiryIdVal = v?.enquiry_id ?? "";
  const customerVal = v?.customer_name ?? "";
  const salesPersonVal = v?.sales_person ?? "";
  const serviceVal = v?.service ?? "";
  const tradeVal = v?.trade ?? "";
  const originVal = v?.origin ?? "";
  const destinationVal = v?.destination ?? "";
  const statusVal = v?.status ?? "";
  const referenceNoVal = v?.reference_no ?? "";

  // Look up the (optional) renderer + display formatter for a single column.
  const customInput = (key: EnquiryHeaderFilterKey) =>
    headerFilters?.renderInput?.[key];
  const formatDisplay = (key: EnquiryHeaderFilterKey, raw: string) =>
    raw ? headerFilters?.displayFormatter?.[key]?.(raw) ?? raw : "";

  return (
    <table style={erpListTableElementStyle(theme)}>
      <thead>
        <tr style={{height:52.4}}>
          {visible.sno && <th style={erpListThStyle(theme)}>S.No</th>}
          {visible.enquiry_id && (
            <th style={{ ...erpListThStyle(theme), minWidth: ENQUIRY_COL_ID_MIN }}>
              {headerFilters && editingColumn === "enquiry_id" ? (
                <FilterableHeaderEdit onCollapse={makeCollapse("enquiry_id")}>
                  {customInput("enquiry_id")?.({
                    autoFocus: true,
                    onClose: makeCollapse("enquiry_id"),
                  }) ?? (
                    <HeaderFilterInput
                      value={enquiryIdVal}
                      onChange={(val) => headerFilters.onChange("enquiry_id", val)}
                      ariaLabel="Filter Enquiry ID"
                      autoFocus
                    />
                  )}
                </FilterableHeaderEdit>
              ) : headerFilters ? (
                <FilterableHeaderLabel
                  label="Enquiry ID"
                  filterDisplay={formatDisplay("enquiry_id", enquiryIdVal)}
                  onClick={() => openEditor("enquiry_id")}
                  theme={theme}
                />
              ) : (
                "Enquiry ID"
              )}
            </th>
          )}
          {visible.customer_name && (
            <th style={{ ...erpListThStyle(theme), minWidth: 180 }}>
              {headerFilters && editingColumn === "customer_name" ? (
                <FilterableHeaderEdit onCollapse={makeCollapse("customer_name")}>
                  {customInput("customer_name")?.({
                    autoFocus: true,
                    onClose: makeCollapse("customer_name"),
                  }) ?? (
                    <HeaderFilterInput
                      value={customerVal}
                      onChange={(val) => headerFilters.onChange("customer_name", val)}
                      ariaLabel="Filter Customer"
                      autoFocus
                    />
                  )}
                </FilterableHeaderEdit>
              ) : headerFilters ? (
                <FilterableHeaderLabel
                  label="Customer"
                  filterDisplay={formatDisplay("customer_name", customerVal)}
                  onClick={() => openEditor("customer_name")}
                  theme={theme}
                />
              ) : (
                "Customer"
              )}
            </th>
          )}
          {visible.sales_person && (
            <th style={{ ...erpListThStyle(theme), minWidth: ENQUIRY_COL_SALES_PERSON_MIN }}>
              {headerFilters && editingColumn === "sales_person" ? (
                <FilterableHeaderEdit onCollapse={makeCollapse("sales_person")}>
                  {customInput("sales_person")?.({
                    autoFocus: true,
                    onClose: makeCollapse("sales_person"),
                  }) ?? (
                    <HeaderFilterInput
                      value={salesPersonVal}
                      onChange={(val) => headerFilters.onChange("sales_person", val)}
                      ariaLabel="Filter Sales Person"
                      autoFocus
                    />
                  )}
                </FilterableHeaderEdit>
              ) : headerFilters ? (
                <FilterableHeaderLabel
                  label="Sales Person"
                  filterDisplay={formatDisplay("sales_person", salesPersonVal)}
                  onClick={() => openEditor("sales_person")}
                  theme={theme}
                />
              ) : (
                "Sales Person"
              )}
            </th>
          )}
          {visible.service && (
            <th style={{ ...erpListThStyle(theme), minWidth: ENQUIRY_COL_SERVICE_MIN }}>
              {headerFilters && editingColumn === "service" ? (
                <FilterableHeaderEdit onCollapse={makeCollapse("service")}>
                  {/* Service column header now exposes a single combined editor
                      (Autocomplete with FCL/LCL/AIR + free text + tick) instead
                      of the previous two side-by-side inputs. The trade filter
                      is still editable via the advanced filter drawer. */}
                  {customInput("service")?.({
                    autoFocus: true,
                    onClose: makeCollapse("service"),
                  }) ?? (
                    <HeaderFilterInput
                      value={serviceVal}
                      onChange={(val) => headerFilters.onChange("service", val)}
                      placeholder="Service"
                      ariaLabel="Filter Service"
                      autoFocus
                    />
                  )}
                </FilterableHeaderEdit>
              ) : headerFilters ? (
                <FilterableHeaderLabel
                  label="Service"
                  filterDisplay={formatServiceTradeDisplay(
                    formatDisplay("service", serviceVal),
                    formatDisplay("trade", tradeVal),
                  )}
                  onClick={() => openEditor("service")}
                  theme={theme}
                />
              ) : (
                "Service"
              )}
            </th>
          )}
          {visible.route && (
            <th
              style={{
                ...erpListThStyle(theme),
                whiteSpace: "nowrap",
                minWidth: ENQUIRY_COL_ROUTE_SUMMARY_MIN,
              }}
            >
              {headerFilters && editingColumn === "route" ? (
                <FilterableHeaderEdit onCollapse={makeCollapse("route")}>
                  <Group gap={4} wrap="nowrap" align="center">
                    <Box style={{ flex: 1, minWidth: 0 }}>
                      {customInput("origin")?.({
                        autoFocus: true,
                        onClose: makeCollapse("route"),
                      }) ?? (
                        <HeaderFilterInput
                          value={originVal}
                          onChange={(val) => headerFilters.onChange("origin", val)}
                          placeholder="Origin"
                          ariaLabel="Filter Origin"
                          autoFocus
                        />
                      )}
                    </Box>
                    <Box style={{ flex: 1, minWidth: 0 }}>
                      {customInput("destination")?.({
                        autoFocus: false,
                        onClose: makeCollapse("route"),
                      }) ?? (
                        <HeaderFilterInput
                          value={destinationVal}
                          onChange={(val) => headerFilters.onChange("destination", val)}
                          placeholder="Destination"
                          ariaLabel="Filter Destination"
                        />
                      )}
                    </Box>
                  </Group>
                </FilterableHeaderEdit>
              ) : headerFilters ? (
                <FilterableRouteHeaderLabel
                  originCode={originVal}
                  destinationCode={destinationVal}
                  onClick={() => openEditor("route")}
                  theme={theme}
                />
              ) : (
                "Route"
              )}
            </th>
          )}
          {visible.status && (
            <th style={{ ...erpListThStyle(theme), whiteSpace: "nowrap", minWidth: 100, maxWidth: 100 }}>
              {headerFilters && editingColumn === "status" ? (
                <FilterableHeaderEdit onCollapse={makeCollapse("status")}>
                  {customInput("status")?.({
                    autoFocus: true,
                    onClose: makeCollapse("status"),
                  }) ?? (
                    <HeaderFilterInput
                      value={statusVal}
                      onChange={(val) => headerFilters.onChange("status", val)}
                      ariaLabel="Filter Status"
                      autoFocus
                    />
                  )}
                </FilterableHeaderEdit>
              ) : headerFilters ? (
                <FilterableHeaderLabel
                  label="Status"
                  filterDisplay={formatDisplay("status", statusVal)}
                  onClick={() => openEditor("status")}
                  theme={theme}
                />
              ) : (
                "Status"
              )}
            </th>
          )}
          {visible.date && (
            <th
              style={{
                ...erpListThStyle(theme),
                whiteSpace: "nowrap",
                minWidth: ENQUIRY_SUMMARY_DATE_COL_MIN,
              }}
            >
              Enquiry Date
            </th>
          )}
          {visible.reference_no && (
            <th
              style={{
                ...erpListThStyle(theme),
                minWidth: ENQUIRY_COL_REFERENCE_TH_MIN,
                maxWidth: ENQUIRY_COL_REFERENCE_TD_MAX,
                width: ENQUIRY_COL_REFERENCE_TABLE_WIDTH,
              }}
            >
              {headerFilters && editingColumn === "reference_no" ? (
                <FilterableHeaderEdit onCollapse={makeCollapse("reference_no")}>
                  {customInput("reference_no")?.({
                    autoFocus: true,
                    onClose: makeCollapse("reference_no"),
                  }) ?? (
                    <HeaderFilterInput
                      value={referenceNoVal}
                      onChange={(val) => headerFilters.onChange("reference_no", val)}
                      ariaLabel="Filter Reference No"
                      autoFocus
                    />
                  )}
                </FilterableHeaderEdit>
              ) : headerFilters ? (
                <FilterableHeaderLabel
                  label="Reference No"
                  filterDisplay={formatDisplay("reference_no", referenceNoVal)}
                  onClick={() => openEditor("reference_no")}
                  theme={theme}
                />
              ) : (
                "Reference No"
              )}
            </th>
          )}
          {visible.remark && <th style={erpListThStyle(theme)}>Remark</th>}
          <th style={erpListThActionsSpacer(theme, 44)} />
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <tr>
            <td colSpan={visibleCount} style={{ padding: 0 }}>
              <Center py={80} style={{ backgroundColor: theme.cardBg }}>
                <Stack align="center" gap="md">
                  <Loader size="lg" color={theme.primary} />
                  <Text c="dimmed" size="sm" style={{ fontFamily: fontSans }}>
                    {loadingMessage}
                  </Text>
                </Stack>
              </Center>
            </td>
          </tr>
        ) : rows.length === 0 ? (
          <tr>
            <td colSpan={visibleCount} style={{ padding: 60, textAlign: "center" }}>
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
                  <Text fw={500} c={fg} style={{ fontFamily: fontSans }}>
                    No enquiries found
                  </Text>
                  <Text size="sm" c={muted} mt={4} style={{ fontFamily: fontSans }}>
                    Try adjusting your search or filters
                  </Text>
                </Box>
              </Stack>
            </td>
          </tr>
        ) : (
          rows.map((row, index) => {
            const k = rowKey(row, index);
            const { label, color } = getStatusBadge(String(row.status ?? ""));
            return (
              <tr key={String(k)} {...erpListDataRowProps(theme)}>
                {visible.sno && (
                  <td style={erpListTdPaddingStyle()}>
                    <TextLineClampTooltip
                      text={row.sno != null ? String(row.sno) : "—"}
                      tooltip={row.sno != null ? String(row.sno) : ""}
                      fg={fg}
                      fontSans={fontSans}
                      fw={600}
                      maxWidth={88}
                    />
                  </td>
                )}
                {visible.enquiry_id && (
                  <td style={{ ...erpListTdPaddingStyle(), minWidth: ENQUIRY_COL_ID_MIN }}>
                    <TextLineClampTooltip
                      text={String(row.enquiry_id ?? "—")}
                      tooltip={String(row.enquiry_id ?? "")}
                      fg={fg}
                      fontSans={fontSans}
                      fw={600}
                      maxWidth={ENQUIRY_COL_ID_MIN}
                    />
                  </td>
                )}
                {visible.customer_name && (
                  <td style={{ ...erpListTdPaddingStyle(), maxWidth: 200 }}>
                    <TextLineClampTooltip
                      text={String(row.customer_name ?? "—")}
                      tooltip={String(row.customer_name ?? "")}
                      fg={fg}
                      fontSans={fontSans}
                      maxWidth={200}
                    />
                  </td>
                )}
                {visible.sales_person && (
                  <td style={erpListTdPaddingStyle()}>
                    <TextLineClampTooltip
                      text={String(row.sales_person ?? "—")}
                      tooltip={String(row.sales_person ?? "")}
                      fg={fg}
                      fontSans={fontSans}
                      maxWidth={220}
                    />
                  </td>
                )}
                {visible.service && (
                  <td style={{ ...erpListTdPaddingStyle(), minWidth: ENQUIRY_COL_SERVICE_MIN }}>
                    {renderServiceCell(row.services, fg, fontSans)}
                  </td>
                )}
                {visible.route && (
                  <td
                    style={{
                      ...erpListTdPaddingStyle(),
                      whiteSpace: "nowrap",
                      minWidth: ENQUIRY_COL_ROUTE_SUMMARY_MIN,
                    }}
                  >
                    {(() => {
                      const nameTip = summaryRouteNameTooltip(row);
                      const cell = erpListRouteListCell(
                        row.origin_code_list,
                        row.destination_code_list,
                        {
                          primary,
                          fg,
                          muted,
                          fontSans,
                        },
                        { wrapContent: false },
                      );
                      if (!nameTip) return cell;
                      return (
                        <Tooltip
                          label={nameTip}
                          withArrow
                          multiline
                          w={ENQUIRY_ROUTE_TOOLTIP_MAX_WIDTH}
                          styles={routeTooltipStyles(fontSans)}
                        >
                          <Box style={{ display: "block", minWidth: 0, maxWidth: "100%" }}>{cell}</Box>
                        </Tooltip>
                      );
                    })()}
                  </td>
                )}
                {visible.status && (
                  <td
                    style={{
                      ...erpListTdPaddingStyle(),
                      whiteSpace: "nowrap",
                      verticalAlign: "middle",
                      minWidth: 100,
                    }}
                  >
                    <Tooltip
                      label={label}
                      withArrow
                      position="top"
                      styles={{
                        tooltip: {
                          fontFamily: fontSans,
                          fontSize: 12,
                          whiteSpace: "nowrap",
                        },
                      }}
                    >
                      <Badge
                        size="sm"
                        variant="light"
                        radius="xl"
                        color={color}
                        styles={{
                          root: {
                            textTransform: "none",
                            minWidth: "fit-content",
                            whiteSpace: "nowrap",
                            flexWrap: "nowrap",
                            maxWidth: "100%",
                            fontFamily: fontSans,
                          },
                        }}
                      >
                        {label}
                      </Badge>
                    </Tooltip>
                  </td>
                )}
                {visible.date && (
                  <td
                    style={{
                      ...erpListTdPaddingStyle(),
                      whiteSpace: "nowrap",
                      minWidth: ENQUIRY_SUMMARY_DATE_COL_MIN,
                    }}
                  >
                    <Text size="sm" style={{ fontFamily: fontSans, color: muted, whiteSpace: "nowrap" }}>
                      {row.enquiry_received_date ? dayjs(row.enquiry_received_date).format(dateFormat) : "—"}
                    </Text>
                  </td>
                )}
                {visible.reference_no && (
                  <td
                    style={{
                      ...erpListTdPaddingStyle(),
                      maxWidth: ENQUIRY_COL_REFERENCE_TD_MAX,
                      width: ENQUIRY_COL_REFERENCE_TABLE_WIDTH,
                    }}
                  >
                    <TextLineClampTooltip
                      text={String(row.reference_no ?? "—")}
                      tooltip={String(row.reference_no ?? "")}
                      fg={fg}
                      fontSans={fontSans}
                      color={muted}
                      maxWidth={ENQUIRY_COL_REFERENCE_TD_MAX}
                    />
                  </td>
                )}
                {visible.remark && (
                  <td style={erpListTdPaddingStyle()}>{renderRemarkCell(row.services, fg, fontSans)}</td>
                )}
                <td style={erpListRowActionMenuTdStyle()}>
                  <EnquirySummaryRowMenu
                    row={row}
                    opened={actionsOpenKey === k}
                    onOpenChange={(o) => onActionsKeyChange(o ? k : null)}
                    ctx={rowMenuCtx}
                    menuStyles={{ dropdown: { fontSize: 14, fontFamily: fontSans } }}
                    dropdownClassName={menuDropdownClassName}
                  />
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}

type PreviewTableProps = {
  theme: ErpListTheme;
  columns: PreviewColDef[];
  data: Record<string, unknown>[];
  dateFormat: string;
  getStatusBadge: (s: string | undefined | null) => { label: string; color: string };
  /**
   * Optional inline column header filters for the Detailed table. Bound to the parent's
   * existing previewFilters state so the advanced filters panel + restore flows stay in sync
   * (single source of truth, no client-side filtering, no duplicate state).
   */
  headerFilters?: EnquiryHeaderFiltersProp;
  /**
   * When true, the table keeps its `<thead>` (and therefore the click-to-edit
   * header filters) mounted but renders a centered loader inside `<tbody>`
   * instead of the data rows. This avoids unmounting the table -- and losing
   * the open header-filter editor -- whenever a refetch is in flight.
   */
  loading?: boolean;
  /** Optional message shown below the loader spinner (defaults to "Loading…"). */
  loadingMessage?: string;
};

/**
 * Maps a Detailed-list column to the header-filter key it should expose, or `null` when
 * the column is not user-searchable from the header (e.g. sno, enquiry date, totals, remark).
 */
function previewColumnFilterKeys(col: PreviewColDef):
  | { single: EnquiryHeaderFilterKey }
  | { dual: [EnquiryHeaderFilterKey, EnquiryHeaderFilterKey]; placeholders: [string, string] }
  | null {
  if (col.kind === "service") {
    return {
      dual: ["service", "trade"],
      placeholders: ["Service", "Trade"],
    };
  }
  if (col.kind === "route") {
    return {
      dual: ["origin", "destination"],
      placeholders: ["Origin", "Destination"],
    };
  }
  switch (col.key) {
    case "enquiry_id":
      return { single: "enquiry_id" };
    case "customer_name":
      return { single: "customer_name" };
    case "sales_person":
      return { single: "sales_person" };
    case "service":
      return { single: "service" };
    case "trade":
      return { single: "trade" };
    case "origin":
      return { single: "origin" };
    case "destination":
      return { single: "destination" };
    case "status":
      return { single: "status" };
    case "reference_no":
      return { single: "reference_no" };
    default:
      return null;
  }
}

function previewColumnThMinWidth(col: PreviewColDef): number {
  if (col.kind === "sno") return 70;
  if (col.kind === "route") return ENQUIRY_COL_ROUTE_DETAILED_MIN;
  if (col.kind === "service") return ENQUIRY_COL_SERVICE_MIN;
  if (col.key === "enquiry_id") return ENQUIRY_COL_ID_MIN;
  if (col.key === "sales_person") return ENQUIRY_COL_SALES_PERSON_MIN;
  if (col.key === "reference_no") return ENQUIRY_COL_REFERENCE_TH_MIN;
  return 160;
}

/**
 * Detailed (preview) list: same table chrome as {@link AirExportBookingMaster} — no sticky columns, `10px 14px` cells, `Text` for values.
 */
export function EnquiryPreviewNativeTable({
  theme,
  columns,
  data,
  dateFormat,
  getStatusBadge,
  headerFilters,
  loading = false,
  loadingMessage = "Loading…",
}: PreviewTableProps) {
  const { fg, fontSans, muted, primary } = theme;

  // Which column id is currently in "edit" mode. Only meaningful when headerFilters is provided.
  const [editingColumn, setEditingColumn] = useState<PreviewEditingColumn>(null);

  const openEditor = useCallback(
    (colId: string) => {
      if (!headerFilters) return;
      setEditingColumn(colId);
    },
    [headerFilters],
  );

  // Use a functional setter so a fast click on a different header that already
  // switched the editing column is not undone by this collapse.
  const makeCollapse = useCallback(
    (colId: string) => () => {
      setEditingColumn((cur) => (cur === colId ? null : cur));
    },
    [],
  );

  return (
    <Box style={{ overflow: "auto" }}>
      <table style={erpListTableElementStyle(theme)}>
        <thead>
          <tr>
            {columns.map((col) => {
              const thStyle: CSSProperties = {
                ...erpListThStyle(theme),
                minWidth: previewColumnThMinWidth(col),
                ...(col.key === "reference_no"
                  ? { maxWidth: ENQUIRY_COL_REFERENCE_TD_MAX, width: ENQUIRY_COL_REFERENCE_TABLE_WIDTH }
                  : {}),
                ...(col.kind === "route" ? { whiteSpace: "nowrap" as const } : {}),
              };

              const mapping = headerFilters ? previewColumnFilterKeys(col) : null;

              // Not filterable -> render the original header text as-is (RFQ + non-filter columns).
              if (!headerFilters || !mapping) {
                return (
                  <th key={col.id} style={thStyle}>
                    {col.header}
                  </th>
                );
              }

              const isEditing = editingColumn === col.id;
              const customInputFn = (key: EnquiryHeaderFilterKey) =>
                headerFilters.renderInput?.[key];
              const formatDisplay = (key: EnquiryHeaderFilterKey, raw: string) =>
                raw ? headerFilters.displayFormatter?.[key]?.(raw) ?? raw : "";

              if ("dual" in mapping) {
                const [k1, k2] = mapping.dual;
                const [p1, p2] = mapping.placeholders;
                const v1 = headerFilters.values[k1] ?? "";
                const v2 = headerFilters.values[k2] ?? "";

                /*
                 * Service column now exposes a single combined editor (the
                 * Autocomplete with FCL/LCL/AIR + free text + tick provided
                 * by the parent via `renderInput.service`). The Route column
                 * keeps the existing dual origin/destination layout.
                 */
                const renderSingleService = col.kind === "service";

                return (
                  <th key={col.id} style={thStyle}>
                    {isEditing ? (
                      <FilterableHeaderEdit onCollapse={makeCollapse(col.id)}>
                        {renderSingleService ? (
                          customInputFn(k1)?.({
                            autoFocus: true,
                            onClose: makeCollapse(col.id),
                          }) ?? (
                            <HeaderFilterInput
                              value={v1}
                              onChange={(val) => headerFilters.onChange(k1, val)}
                              placeholder={p1}
                              ariaLabel={`Filter ${p1}`}
                              autoFocus
                            />
                          )
                        ) : (
                          <Group gap={4} wrap="nowrap" align="center">
                            <Box style={{ flex: 1, minWidth: 0 }}>
                              {customInputFn(k1)?.({
                                autoFocus: true,
                                onClose: makeCollapse(col.id),
                              }) ?? (
                                <HeaderFilterInput
                                  value={v1}
                                  onChange={(val) => headerFilters.onChange(k1, val)}
                                  placeholder={p1}
                                  ariaLabel={`Filter ${p1}`}
                                  autoFocus
                                />
                              )}
                            </Box>
                            <Box style={{ flex: 1, minWidth: 0 }}>
                              {customInputFn(k2)?.({
                                autoFocus: false,
                                onClose: makeCollapse(col.id),
                              }) ?? (
                                <HeaderFilterInput
                                  value={v2}
                                  onChange={(val) => headerFilters.onChange(k2, val)}
                                  placeholder={p2}
                                  ariaLabel={`Filter ${p2}`}
                                />
                              )}
                            </Box>
                          </Group>
                        )}
                      </FilterableHeaderEdit>
                    ) : col.kind === "route" ? (
                      <FilterableRouteHeaderLabel
                        originCode={v1}
                        destinationCode={v2}
                        onClick={() => openEditor(col.id)}
                        theme={theme}
                        label={col.header}
                      />
                    ) : (
                      <FilterableHeaderLabel
                        label={col.header}
                        filterDisplay={formatServiceTradeDisplay(
                          formatDisplay(k1, v1),
                          formatDisplay(k2, v2),
                        )}
                        onClick={() => openEditor(col.id)}
                        theme={theme}
                      />
                    )}
                  </th>
                );
              }

              const key = mapping.single;
              const value = headerFilters.values[key] ?? "";
              return (
                <th key={col.id} style={thStyle}>
                  {isEditing ? (
                    <FilterableHeaderEdit onCollapse={makeCollapse(col.id)}>
                      {customInputFn(key)?.({
                        autoFocus: true,
                        onClose: makeCollapse(col.id),
                      }) ?? (
                        <HeaderFilterInput
                          value={value}
                          onChange={(val) => headerFilters.onChange(key, val)}
                          ariaLabel={`Filter ${col.header}`}
                          autoFocus
                        />
                      )}
                    </FilterableHeaderEdit>
                  ) : (
                    <FilterableHeaderLabel
                      label={col.header}
                      filterDisplay={formatDisplay(key, value)}
                      onClick={() => openEditor(col.id)}
                      theme={theme}
                    />
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={Math.max(1, columns.length)} style={{ padding: 0 }}>
                <Center py={80} style={{ backgroundColor: theme.cardBg }}>
                  <Stack align="center" gap="md">
                    <Loader size="lg" color={theme.primary} />
                    <Text c="dimmed" size="sm" style={{ fontFamily: fontSans }}>
                      {loadingMessage}
                    </Text>
                  </Stack>
                </Center>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={Math.max(1, columns.length)} style={{ padding: 60, textAlign: "center" }}>
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
                    <IconFileText size={24} color={muted} />
                  </Box>
                  <Box>
                    <Text fw={500} c={fg} style={{ fontFamily: fontSans }}>
                      No detailed data
                    </Text>
                    <Text size="sm" c={muted} mt={4} style={{ fontFamily: fontSans }}>
                      Try adjusting your search or filters
                    </Text>
                  </Box>
                </Stack>
              </td>
            </tr>
          ) : (
            data.map((row, ri) => (
              <tr key={ri} {...erpListDataRowProps(theme)}>
                {columns.map((col) => (
                  <td
                    key={`${ri}-${col.id}`}
                    style={{
                      ...erpListTdPaddingStyle(),
                      ...(col.kind === "route"
                        ? { minWidth: ENQUIRY_COL_ROUTE_DETAILED_MIN, whiteSpace: "nowrap" as const }
                        : {}),
                      ...(col.kind === "service" ? { minWidth: ENQUIRY_COL_SERVICE_MIN } : {}),
                      ...(col.key === "enquiry_id" ? { minWidth: ENQUIRY_COL_ID_MIN } : {}),
                      ...(col.key === "sales_person" ? { minWidth: ENQUIRY_COL_SALES_PERSON_MIN } : {}),
                      ...(col.key === "reference_no"
                        ? { maxWidth: ENQUIRY_COL_REFERENCE_TD_MAX, width: ENQUIRY_COL_REFERENCE_TABLE_WIDTH }
                        : {}),
                    }}
                  >
                    {renderPreviewCell({
                      col,
                      row: row as Record<string, string | number | null | undefined>,
                      dateFormat,
                      getStatusBadge,
                      fg,
                      muted,
                      primary,
                      fontSans,
                    })}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </Box>
  );
}

function renderPreviewCell({
  col,
  row,
  dateFormat,
  getStatusBadge,
  fg,
  muted,
  primary,
  fontSans,
}: {
  col: PreviewColDef;
  row: Record<string, string | number | null | undefined>;
  dateFormat: string;
  getStatusBadge: (s: string | undefined | null) => { label: string; color: string };
  fg: string;
  muted: string;
  primary: string;
  fontSans: string;
}): ReactNode {
  if (col.kind === "sno") {
    return (
      <TextLineClampTooltip
        text={row.sno != null ? String(row.sno) : "—"}
        tooltip={row.sno != null ? String(row.sno) : ""}
        fg={fg}
        fontSans={fontSans}
        fw={600}
        maxWidth={56}
      />
    );
  }
  if (col.kind === "service") {
    const serviceValue = String(row.service ?? "");
    const tradeValue = String(row.trade ?? "");
    if (!serviceValue && !tradeValue) {
      return (
        <Text size="sm" c={muted} style={{ fontFamily: fontSans }}>
          —
        </Text>
      );
    }
    const line =
      !serviceValue ? tradeValue : !tradeValue ? serviceValue : `${serviceValue} - ${tradeValue}`;
    return (
      <TextLineClampTooltip
        text={line}
        tooltip={line}
        fg={fg}
        fontSans={fontSans}
        maxWidth={ENQUIRY_COL_SERVICE_MIN}
      />
    );
  }
  if (col.kind === "enquiryDate") {
    const d = row.enquiry_date;
    const formatted = d ? dayjs(String(d)).format(dateFormat) : "—";
    return (
      <TextLineClampTooltip
        text={formatted}
        tooltip={formatted === "—" ? "" : formatted}
        fg={fg}
        fontSans={fontSans}
        color={muted}
        maxWidth={200}
      />
    );
  }
  if (col.kind === "status") {
    const v = row[col.key as keyof typeof row];
    const { label, color } = getStatusBadge(String(v ?? ""));
    return (
      <Tooltip
        label={label}
        withArrow
        position="top"
        styles={{
          tooltip: {
            fontFamily: fontSans,
            fontSize: 12,
            whiteSpace: "nowrap",
          },
        }}
      >
        <Badge
          size="sm"
          variant="light"
          radius="xl"
          color={color}
          styles={{
            root: {
              textTransform: "none",
              fontFamily: fontSans,
              whiteSpace: "nowrap",
              flexWrap: "nowrap",
              maxWidth: "100%",
              minWidth: "fit-content",
            },
          }}
        >
          {label}
        </Badge>
      </Tooltip>
    );
  }
  if (col.kind === "route" && col.routeDestKey) {
    const os = row[col.key as keyof typeof row];
    const ds = row[col.routeDestKey as keyof typeof row];
    const oc = os != null && String(os).trim() !== "" ? String(os) : "—";
    const dc = ds != null && String(ds).trim() !== "" ? String(ds) : "—";
    const tip = routePairTooltipLabel(os, ds).trim() || `${oc} → ${dc}`;
    const body = (
      <Group gap={6} wrap="nowrap" align="center">
        <Text fw={600} size="sm" c={primary} style={{ fontFamily: fontSans, whiteSpace: "nowrap" }}>
          {oc}
        </Text>
        <IconArrowRight size={12} color={muted} style={{ flexShrink: 0 }} />
        <Text fw={500} size="sm" c={fg} style={{ fontFamily: fontSans, whiteSpace: "nowrap" }}>
          {dc}
        </Text>
      </Group>
    );
    const isEmptyCell = oc === "—" && dc === "—";
    if (isEmptyCell) return body;
    return (
      <Tooltip
        label={tip}
        withArrow
        multiline
        w={ENQUIRY_ROUTE_TOOLTIP_MAX_WIDTH}
        styles={routeTooltipStyles(fontSans)}
      >
        <Box style={{ display: "block", minWidth: 0 }}>{body}</Box>
      </Tooltip>
    );
  }
  const v = row[col.key as keyof typeof row];
  if (v === null || v === undefined || v === "") {
    return (
      <Text size="sm" c={muted} style={{ fontFamily: fontSans }}>
        —
      </Text>
    );
  }
  const str = String(v);
  if (col.key === "enquiry_id") {
    return (
      <TextLineClampTooltip
        text={str}
        tooltip={str}
        fg={fg}
        fontSans={fontSans}
        maxWidth={ENQUIRY_COL_ID_MIN}
      />
    );
  }
  if (col.key === "reference_no") {
    return (
      <TextLineClampTooltip
        text={str}
        tooltip={str}
        fg={fg}
        fontSans={fontSans}
        color={muted}
        maxWidth={ENQUIRY_COL_REFERENCE_TD_MAX}
      />
    );
  }
  if (col.key === "sales_person") {
    return (
      <TextLineClampTooltip text={str} tooltip={str} fg={fg} fontSans={fontSans} maxWidth={ENQUIRY_COL_SALES_PERSON_MIN} />
    );
  }
  return <TextLineClampTooltip text={str} tooltip={str} fg={fg} fontSans={fontSans} maxWidth={240} />;
}
