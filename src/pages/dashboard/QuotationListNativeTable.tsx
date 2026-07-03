import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import {
  ActionIcon,
  Badge,
  Box,
  Center,
  Group,
  Loader,
  Menu,
  Stack,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import {
  IconArrowRight,
  IconBook,
  IconDotsVertical,
  IconEdit,
  IconExternalLink,
  IconEye,
  IconFileText,
  IconFilterFilled,
  IconX,
} from "@tabler/icons-react";
import type { Location } from "react-router-dom";
import dayjs from "dayjs";
import type { ErpListTheme } from "../../components/ERPListPage/erpListTheme";
import { ERP_LIST_GEIST_ROOT_CLASS } from "../../components/ERPListPage/erpListGeistShell";
import {
  erpListDataRowProps,
  erpListRouteListCell,
  erpListStickyActionTdStyle,
  erpListStickyActionThStyle,
  erpListTableElementStyle,
  erpListTdPaddingStyle,
  erpListThStyle,
  getQuotationServiceVolume,
} from "../../components";

/** Row shape used by quotation list (aligned with QuotationMaster `QuotationData`). */
export type QuotationTableRow = {
  id: number;
  sno?: number;
  enquiry_id?: string;
  customer_name?: string;
  sales_person?: string;
  reference_no?: string;
  origin_code_list?: string[];
  destination_code_list?: string[];
  valid_upto_list?: string[];
  reject_remark?: string;
  status?: string;
  service?: string;
  quotation?: Array<{
    quotation_id?: string;
    service_type?: string;
    service?: string;
    trade?: string;
    cargo_details?: unknown[];
    fcl_details?: unknown[];
    created_at?: string;
    revision?: number;
    quotation_service_id?: number;
  }>;
};

export type QuotationVisibleColumns = {
  sno: boolean;
  enquiry_id: boolean;
  quotation_id: boolean;
  customer_name: boolean;
  sales_person: boolean;
  created_at: boolean;
  /** One column: origin → destination (same as Air Export Booking “Route”). */
  route: boolean;
  service: boolean;
  volume: boolean;
  reference_no: boolean;
  /** Immediately after Reference No in the table. */
  status: boolean;
  valid_upto_list: boolean;
  revision: boolean;
  reject_remark: boolean;
};

export type QuotationRowMenuContext = {
  location: Location;
  isApprovalMode: boolean;
  returnToDashboardRef: RefObject<boolean | undefined>;
  primaryActionLabel: string;
  /** Tabler icon component (e.g. IconEdit, IconExternalLink). */
  PrimaryActionIcon: typeof IconEdit | typeof IconExternalLink;
  showQuotationPreview: (row: QuotationTableRow) => void;
  handlePrimaryAction: (row: QuotationTableRow) => void;
  canCreateBookingFromRow: (row: QuotationTableRow) => boolean;
  handleCreateBookingFromRow: (row: QuotationTableRow) => void;
};

/* ─────────────────────────────────────────────────────────────────────────────
 * Column-header filter types & primitives
 *
 * Same pattern as `EnquiryListNativeTables`: each filterable column header is
 * normally a plain label; clicking it transforms into an inline editor. The
 * parent owns the underlying filter state and supplies a `renderInput` per
 * column so the editor type (TextInput / Select / SearchableSelect /
 * SingleDateInput) mirrors the advanced filter section exactly.
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * Filterable column keys (only the ones that appear in the advanced filter
 * section). `origin` and `destination` are independent filter fields even
 * though they share one visual column (Route).
 */
export type QuotationHeaderFilterKey =
  | "enquiry_id"
  | "customer_name"
  | "sales_person"
  | "origin"
  | "destination"
  | "status"
  | "valid_upto_list"
  | "revision"
  | "reject_remark";

export type QuotationHeaderFilterValues = Record<
  QuotationHeaderFilterKey,
  string
>;

/** Context passed to a header column's custom input renderer. */
export type QuotationHeaderInputContext = {
  /** Whether the input should auto-focus when mounted (always `true` for now). */
  autoFocus: boolean;
  /**
   * Imperatively collapse the cell back to display mode (e.g. immediately
   * after an option is picked from a `SearchableSelect`). Optional — blur
   * already collapses the cell.
   */
  onClose: () => void;
};

export type QuotationHeaderRenderInput = (
  ctx: QuotationHeaderInputContext,
) => ReactNode;

export type QuotationHeaderFiltersProp = {
  values: QuotationHeaderFilterValues;
  onChange: (key: QuotationHeaderFilterKey, value: string) => void;
  /**
   * Optional per-column custom input. When provided, used INSTEAD of the
   * default `TextInput` once the user clicks the column header to enter edit
   * mode. The parent typically supplies a `SearchableSelect` (customer /
   * port), `Select` (status / sales person), or `SingleDateInput` here so the
   * column filters mirror the advanced filter section — keeping the API
   * payload shape identical.
   */
  renderInput?: Partial<Record<QuotationHeaderFilterKey, QuotationHeaderRenderInput>>;
  /**
   * Optional per-column formatter for the collapsed header label. Useful
   * when the underlying filter value is a code (e.g. `INMAA`) but a
   * friendlier label (e.g. `Chennai (INMAA)`) is available from a sibling
   * display-value cache.
   */
  displayFormatter?: Partial<
    Record<QuotationHeaderFilterKey, (value: string) => string>
  >;
};

/**
 * Tracks which column is currently in edit mode. `route` is a shared edit
 * column that exposes both `origin` and `destination` inputs side-by-side.
 */
type QuotationEditingColumn = QuotationHeaderFilterKey | "route" | null;

const HEADER_FILTER_TEXTINPUT_STYLES = {
  input: {
    height: 26,
    minHeight: 26,
    fontSize: 12,
    paddingLeft: 8,
    paddingRight: 24,
  },
} as const;

/**
 * Generic free-text header filter input with a local typing buffer.
 *
 * Per-keystroke API hits are bad UX, so the input maintains its own local
 * state and only forwards `onChange` to the parent (which mutates global
 * filters / triggers refetch) after 1000ms of inactivity. The clear (X)
 * button bypasses the debounce so clearing is instant.
 */
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
  const [localValue, setLocalValue] = useState(value);
  const [debouncedLocalValue] = useDebouncedValue(localValue, 1000);
  const lastEmittedRef = useRef(value);

  // Sync external value -> local (Clear All / restore / advanced filter edits).
  useEffect(() => {
    if (value !== lastEmittedRef.current || value === "") {
      setLocalValue(value);
      lastEmittedRef.current = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Forward debounced local -> parent.
  useEffect(() => {
    if (debouncedLocalValue !== lastEmittedRef.current) {
      lastEmittedRef.current = debouncedLocalValue;
      onChange(debouncedLocalValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedLocalValue]);

  return (
    <TextInput
      size="xs"
      value={localValue}
      onChange={(e) => setLocalValue(e.currentTarget.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      autoFocus={autoFocus}
      styles={HEADER_FILTER_TEXTINPUT_STYLES}
      rightSection={
        localValue ? (
          <ActionIcon
            variant="transparent"
            size="xs"
            color="gray"
            onMouseDown={(e) => {
              // Prevent the input from blurring before our handler can fire.
              e.preventDefault();
            }}
            onClick={() => {
              setLocalValue("");
              lastEmittedRef.current = "";
              onChange("");
            }}
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
 * - Unfiltered → plain `"Route"` label.
 * - Filtered → raw `ORIGIN → DESTINATION` codes (mirrors the body cell).
 *
 * Clicking opens the inline route editor (origin + destination dual input).
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
        style={{ marginLeft: 6 }}
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
        fontWeight: 500,
        cursor: "pointer",
        textAlign: align,
        justifyContent:
          align === "right"
            ? "flex-end"
            : align === "center"
              ? "center"
              : "flex-start",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        minWidth: 0,
      }}
      title={
        isFiltered ? `Filter: ${filterDisplay}\nClick to edit` : `Click to filter`
      }
    >
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          minWidth: 0,
        }}
      >
        {isFiltered ? filterDisplay : label}
      </span>
      {isFiltered && <IconFilterFilled size={14} color={theme.muted} />}
    </UnstyledButton>
  );
}

/**
 * Container around the edit input(s). Auto-focuses on mount, collapses on
 * Escape, and collapses on blur once focus leaves all inputs in this cell.
 *
 * Accepts an optional `style` so callers can absolutely-position the editor
 * over the (visibility-hidden) label and prevent the column width from
 * jumping when the editor is wider than the label.
 */
function FilterableHeaderEdit({
  onCollapse,
  children,
  style,
}: {
  onCollapse: () => void;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleBlur = useCallback(
    (_e: ReactFocusEvent) => {
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
      style={{ width: "100%", minWidth: 0, ...style }}
    >
      {children}
    </div>
  );
}

const QUOTATION_ROUTE_COL_MIN = 130;
const QUOTATION_ROUTE_COL_MAX = 150;

function quotationRouteTooltip(
  originList?: string[],
  destList?: string[],
): string {
  const oa = originList ?? [];
  const da = destList ?? [];
  const lineCount = Math.max(oa.length, da.length, 1);
  return Array.from({ length: lineCount }, (_, i) => {
    const oc = oa[i]?.trim() || "—";
    const dc = da[i]?.trim() || "—";
    return `${oc} → ${dc}`;
  }).join("\n");
}

function quotationServiceLabel(
  quote: { service_type?: string; service?: string; trade?: string },
  rowService?: string,
): string {
  const type = (quote.service_type || quote.service || rowService || "").trim();
  const trade = (quote.trade || "").trim();
  if (type && trade) return `${type} - ${trade}`;
  return type || "—";
}

function QuotationRowMenu({
  row,
  ctx,
}: {
  row: QuotationTableRow;
  ctx: QuotationRowMenuContext;
}) {
  const [menuOpened, setMenuOpened] = useState(false);
  const {
    isApprovalMode,
    primaryActionLabel,
    PrimaryActionIcon,
    showQuotationPreview,
    handlePrimaryAction,
    canCreateBookingFromRow,
    handleCreateBookingFromRow,
    location,
  } = ctx;
  const showCreateBooking = canCreateBookingFromRow(row);

  return (
    <Menu
      withinPortal
      position="bottom-end"
      shadow="sm"
      radius="md"
      opened={menuOpened}
      onChange={setMenuOpened}
      classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
    >
      <Menu.Target>
        <ActionIcon variant="subtle" color="gray" aria-label="Row actions">
          <IconDotsVertical size={16} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Box px={10} py={5}>
          <UnstyledButton
            onClick={() => {
              setMenuOpened(false);
              showQuotationPreview(row);
            }}
          >
            <Group gap="sm">
              <IconEye size={16} style={{ color: "#105476" }} />
              <Text size="sm">Preview</Text>
            </Group>
          </UnstyledButton>
        </Box>
        {(isApprovalMode || !location.state?.returnToDashboard) && (
          <>
            <Menu.Divider />
            <Box px={10} py={5}>
              <UnstyledButton
                onClick={() => {
                  setMenuOpened(false);
                  handlePrimaryAction(row);
                }}
              >
                <Group gap="sm">
                  <PrimaryActionIcon size={16} style={{ color: "#105476" }} />
                  <Text size="sm">{primaryActionLabel}</Text>
                </Group>
              </UnstyledButton>
            </Box>
          </>
        )}
        {showCreateBooking && (
          <>
            <Menu.Divider />
            <Box px={10} py={5}>
              <UnstyledButton
                onClick={() => {
                  setMenuOpened(false);
                  handleCreateBookingFromRow(row);
                }}
              >
                <Group gap="sm">
                  <IconBook size={16} style={{ color: "#105476" }} />
                  <Text size="sm">Create Booking</Text>
                </Group>
              </UnstyledButton>
            </Box>
          </>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}

type QuotationListNativeTableProps = {
  theme: ErpListTheme;
  rows: QuotationTableRow[];
  visible: QuotationVisibleColumns;
  dateFormat: string;
  isEmpty: boolean;
  onFetchRevision: (quotationServiceId: number) => void;
  rowMenuCtx: QuotationRowMenuContext;
  /** Click-to-edit inline filters that bind to the parent's filter state. */
  headerFilters?: QuotationHeaderFiltersProp;
  /** When true, renders an in-tbody loader instead of the row list (header/footer stay visible). */
  loading?: boolean;
  /** Optional friendlier message for the in-tbody loader. */
  loadingMessage?: string;
};

/**
 * Air Export–style native table for quotation list (replaces MRT in card body).
 */
export function QuotationListNativeTable({
  theme,
  rows,
  visible,
  dateFormat,
  isEmpty,
  onFetchRevision,
  rowMenuCtx,
  headerFilters,
  loading = false,
  loadingMessage = "Loading…",
}: QuotationListNativeTableProps) {
  const { muted, fg, primary, fontSans } = theme;
  const colCount =
    [
      visible.sno,
      visible.enquiry_id,
      visible.quotation_id,
      visible.customer_name,
      visible.sales_person,
      visible.created_at,
      visible.route,
      visible.service,
      visible.volume,
      visible.reference_no,
      visible.status,
      visible.valid_upto_list,
      visible.revision,
      visible.reject_remark,
    ].filter(Boolean).length + 1;

  // ── Header-filter state (only used when `headerFilters` prop is supplied) ──
  const [editingHeaderColumn, setEditingHeaderColumn] =
    useState<QuotationEditingColumn>(null);

  const openHeaderEditor = useCallback(
    (col: NonNullable<QuotationEditingColumn>) =>
      setEditingHeaderColumn(col),
    [],
  );
  const makeCollapseHeader = useCallback(
    (col: NonNullable<QuotationEditingColumn>) => () =>
      setEditingHeaderColumn((cur) => (cur === col ? null : cur)),
    [],
  );

  // Pull custom renderer / display-formatter / values from prop (when present).
  const hf = headerFilters;
  const filterValues: QuotationHeaderFilterValues | null = hf?.values ?? null;
  const customInput = (key: QuotationHeaderFilterKey) =>
    hf?.renderInput?.[key];
  const formatDisplay = (key: QuotationHeaderFilterKey, raw: string) =>
    hf?.displayFormatter?.[key]?.(raw) ?? raw;

  /**
   * Renders a click-to-edit single-key filterable column header.
   *
   * The label is always rendered in normal flow (so it determines the cell's
   * width); when editing, it's visibility-hidden and the editor is overlaid
   * with `position: absolute` so the column width does not jump.
   */
  const renderFilterableHeader = (
    key: QuotationHeaderFilterKey,
    label: string,
    placeholder: string,
  ): ReactNode => {
    if (!hf || !filterValues) return label;
    const isEditing = editingHeaderColumn === key;
    const filterDisplay = formatDisplay(key, filterValues[key]);
    const custom = customInput(key);

    return (
      <div style={{ position: "relative", width: "100%", minHeight: 26, display: "flex", alignItems: "center" }}>
        <span
          style={{
            display: "block",
            visibility: isEditing ? "hidden" : "visible",
            pointerEvents: isEditing ? "none" : undefined,
          }}
        >
          <FilterableHeaderLabel
            label={label}
            filterDisplay={filterDisplay}
            onClick={() => openHeaderEditor(key)}
            theme={theme}
          />
        </span>
        {isEditing && (
          <FilterableHeaderEdit
            onCollapse={makeCollapseHeader(key)}
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
            }}
          >
            {custom ? (
              custom({
                autoFocus: true,
                onClose: makeCollapseHeader(key),
              })
            ) : (
              <HeaderFilterInput
                autoFocus
                value={filterValues[key]}
                onChange={(next) => hf.onChange(key, next)}
                placeholder={placeholder}
                ariaLabel={`Filter ${label}`}
              />
            )}
          </FilterableHeaderEdit>
        )}
      </div>
    );
  };

  return (
    <table style={erpListTableElementStyle(theme)}>
      <thead>
        <tr style={{ height: 52.4 }}>
          {visible.sno && <th style={{...erpListThStyle(theme),minWidth:40}}>S.No</th>}
          {visible.enquiry_id && (
            <th style={{ ...erpListThStyle(theme), minWidth: 200 }}>
              {renderFilterableHeader("enquiry_id", "Enquiry ID", "Filter ID")}
            </th>
          )}
          {visible.quotation_id && (
            <th style={{ ...erpListThStyle(theme), minWidth: 120 }}>
              Quotation ID
            </th>
          )}
          {visible.customer_name && (
            <th style={{ ...erpListThStyle(theme), minWidth: 200 }}>
              {renderFilterableHeader(
                "customer_name",
                "Customer",
                "Search customer",
              )}
            </th>
          )}
          {visible.sales_person && (
            <th style={{ ...erpListThStyle(theme)}}>
              {renderFilterableHeader(
                "sales_person",
                "Sales Person",
                "Sales person",
              )}
            </th>
          )}
          {visible.created_at && (
            <th style={{ ...erpListThStyle(theme), whiteSpace: "nowrap" }}>
              Quote Date
            </th>
          )}
          {visible.route && (
            <th
              style={{
                ...erpListThStyle(theme),
                minWidth: QUOTATION_ROUTE_COL_MIN,
                maxWidth: QUOTATION_ROUTE_COL_MAX,
                width: QUOTATION_ROUTE_COL_MAX,
              }}
            >
              {hf && filterValues ? (
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    minHeight: 26,
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      visibility:
                        editingHeaderColumn === "route" ? "hidden" : "visible",
                      pointerEvents:
                        editingHeaderColumn === "route" ? "none" : undefined,
                    }}
                  >
                    <FilterableRouteHeaderLabel
                      originCode={filterValues.origin}
                      destinationCode={filterValues.destination}
                      onClick={() => openHeaderEditor("route")}
                      theme={theme}
                    />
                  </span>
                  {editingHeaderColumn === "route" && (
                    <FilterableHeaderEdit
                      onCollapse={makeCollapseHeader("route")}
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <Group gap={6} wrap="nowrap" style={{ width: "100%" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {customInput("origin")?.({
                            autoFocus: true,
                            onClose: makeCollapseHeader("route"),
                          }) ?? (
                            <HeaderFilterInput
                              autoFocus
                              value={filterValues.origin}
                              onChange={(next) => hf.onChange("origin", next)}
                              placeholder="Origin"
                              ariaLabel="Filter origin"
                            />
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {customInput("destination")?.({
                            autoFocus: false,
                            onClose: makeCollapseHeader("route"),
                          }) ?? (
                            <HeaderFilterInput
                              value={filterValues.destination}
                              onChange={(next) =>
                                hf.onChange("destination", next)
                              }
                              placeholder="Destination"
                              ariaLabel="Filter destination"
                            />
                          )}
                        </div>
                      </Group>
                    </FilterableHeaderEdit>
                  )}
                </div>
              ) : (
                "Route"
              )}
            </th>
          )}
          {visible.service && (
            <th style={{ ...erpListThStyle(theme), minWidth: 100 }}>
              Service
            </th>
          )}
          {visible.volume && (
            <th style={{ ...erpListThStyle(theme), minWidth: 120 }}>
              Volume
            </th>
          )}
          {visible.reference_no && (
            <th style={erpListThStyle(theme)}>Reference No</th>
          )}
          {visible.status && (
            <th
              style={{
                ...erpListThStyle(theme),
                whiteSpace: "nowrap",
                minWidth: 140,
              }}
            >
              {renderFilterableHeader("status", "Status", "Status")}
            </th>
          )}
          {visible.valid_upto_list && (
            <th
              style={{
                ...erpListThStyle(theme),
                whiteSpace: "nowrap",
                minWidth: 160,
              }}
            >
              {renderFilterableHeader(
                "valid_upto_list",
                "Valid Upto",
                "Valid upto",
              )}
            </th>
          )}
          {visible.revision && (
            <th style={{ ...erpListThStyle(theme), minWidth: 150 }}>
              {renderFilterableHeader("revision", "Revision", "Revision")}
            </th>
          )}
          {visible.reject_remark && (
            <th style={{ ...erpListThStyle(theme), minWidth: 150 }}>
              {renderFilterableHeader(
                "reject_remark",
                "Remark",
                "Search remark",
              )}
            </th>
          )}
          <th style={erpListStickyActionThStyle(theme, 80)}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <tr>
            <td colSpan={colCount} style={{ padding: 60 }}>
              <Center>
                <Stack align="center" gap="md">
                  <Loader color={primary} />
                  <Text size="sm" c={muted} style={{ fontFamily: fontSans }}>
                    {loadingMessage}
                  </Text>
                </Stack>
              </Center>
            </td>
          </tr>
        ) : isEmpty || rows.length === 0 ? (
          <tr>
            <td
              colSpan={colCount}
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
                  <IconFileText size={24} color={muted} />
                </Box>
                <Box>
                  <Text fw={500} c={fg} style={{ fontFamily: fontSans }}>
                    No quotations found
                  </Text>
                  <Text size="sm" c={muted} mt={4} style={{ fontFamily: fontSans }}>
                    Try adjusting your search or filters
                  </Text>
                </Box>
              </Stack>
            </td>
          </tr>
        ) : (
          rows.map((row) => {
            const quoteCreatedAt =
              Array.isArray(row.quotation) && row.quotation.length > 0
                ? row.quotation[0]?.created_at
                : null;
            return (
              <tr key={row.id} {...erpListDataRowProps(theme)}>
                {visible.sno && (
                  <td style={erpListTdPaddingStyle()}>
                    <Text fw={600} size="sm" c={fg} style={{ fontFamily: fontSans }}>
                      {row.sno ?? "—"}
                    </Text>
                  </td>
                )}
                {visible.enquiry_id && (
                  <td style={erpListTdPaddingStyle()}>
                    <Text fw={600} size="sm" c={fg} style={{ fontFamily: fontSans }}>
                      {row.enquiry_id ?? "—"}
                    </Text>
                  </td>
                )}
                {visible.quotation_id && (
                  <td style={erpListTdPaddingStyle()}>
                    {!row.quotation?.length ? (
                      <Text size="sm" c={muted} style={{ fontFamily: fontSans }}>
                        —
                      </Text>
                    ) : (
                      <Stack gap={4}>
                        {row.quotation.map((quote, quoteIndex) => (
                          <Text
                            key={`${row.id}-qid-${quoteIndex}`}
                            size="sm"
                            fw={500}
                            c={primary}
                            style={{ fontFamily: fontSans }}
                          >
                            {quote.quotation_id?.trim() || "—"}
                          </Text>
                        ))}
                      </Stack>
                    )}
                  </td>
                )}
                {visible.customer_name && (
                  <td style={{ ...erpListTdPaddingStyle(), maxWidth: 200 }}>
                    <Tooltip
                      label={String(row.customer_name ?? "")}
                      withArrow
                      styles={{ tooltip: { fontFamily: fontSans, fontSize: 12 } }}
                    >
                      <Text size="sm" c={fg} lineClamp={1} style={{ cursor: "default", fontFamily: fontSans }}>
                        {row.customer_name ?? "—"}
                      </Text>
                    </Tooltip>
                  </td>
                )}
                {visible.sales_person && (
                  <td style={erpListTdPaddingStyle()}>
                    <Text size="sm" c={fg} style={{ fontFamily: fontSans }}>
                      {row.sales_person ?? "—"}
                    </Text>
                  </td>
                )}
                {visible.created_at && (
                  <td
                    style={{
                      ...erpListTdPaddingStyle(),
                      color: muted,
                      fontFamily: fontSans,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {quoteCreatedAt ? dayjs(quoteCreatedAt).format(dateFormat) : "—"}
                  </td>
                )}
                {visible.route && (
                  <td
                    style={{
                      ...erpListTdPaddingStyle(),
                      maxWidth: QUOTATION_ROUTE_COL_MAX,
                      overflow: "hidden",
                    }}
                  >
                    <Tooltip
                      label={quotationRouteTooltip(
                        row.origin_code_list,
                        row.destination_code_list,
                      )}
                      withArrow
                      multiline
                      styles={{ tooltip: { fontFamily: fontSans, fontSize: 12 } }}
                    >
                      <Box style={{ overflow: "hidden", minWidth: 0 }}>
                        {erpListRouteListCell(
                          row.origin_code_list,
                          row.destination_code_list,
                          { primary, fg, muted, fontSans },
                          { compact: true },
                        )}
                      </Box>
                    </Tooltip>
                  </td>
                )}
                {visible.service && (
                  <td style={erpListTdPaddingStyle()}>
                    {!row.quotation?.length ? (
                      <Text size="sm" c={fg} style={{ fontFamily: fontSans }}>
                        {row.service?.trim() ? row.service : "—"}
                      </Text>
                    ) : (
                      <Stack gap={4}>
                        {row.quotation.map((quote, quoteIndex) => (
                          <Text
                            key={`${row.id}-svc-${quoteIndex}`}
                            size="sm"
                            c={fg}
                            style={{ fontFamily: fontSans }}
                          >
                            {quotationServiceLabel(quote, row.service)}
                          </Text>
                        ))}
                      </Stack>
                    )}
                  </td>
                )}
                {visible.volume && (
                  <td style={{ ...erpListTdPaddingStyle(), color: muted }}>
                    {!row.quotation?.length ? (
                      <Text size="sm" c={muted} style={{ fontFamily: fontSans }}>
                        —
                      </Text>
                    ) : (
                      <Stack gap={4}>
                        {row.quotation.map((quote, quoteIndex) => (
                          <Text
                            key={`${row.id}-vol-${quoteIndex}`}
                            size="sm"
                            style={{ fontFamily: fontSans }}
                          >
                            {getQuotationServiceVolume(quote)}
                          </Text>
                        ))}
                      </Stack>
                    )}
                  </td>
                )}
                {visible.reference_no && (
                  <td style={{ ...erpListTdPaddingStyle(), color: muted }}>
                    <Text size="sm" style={{ fontFamily: fontSans }}>
                      {row.reference_no || "—"}
                    </Text>
                  </td>
                )}
                {visible.status && (
                  <td
                    style={{
                      ...erpListTdPaddingStyle(),
                      whiteSpace: "nowrap",
                      verticalAlign: "middle",
                      minWidth: 140,
                    }}
                  >
                    <StatusBadge status={row.status} fontSans={fontSans} />
                  </td>
                )}
                {visible.valid_upto_list && (
                  <td
                    style={{
                      ...erpListTdPaddingStyle(),
                      whiteSpace: "nowrap",
                      fontFamily: fontSans,
                      fontSize: 14,
                      color: fg,
                    }}
                  >
                    {!row.valid_upto_list?.length ? (
                      "—"
                    ) : (
                      row.valid_upto_list.map((d) => dayjs(d).format(dateFormat)).join(", ")
                    )}
                  </td>
                )}
                {visible.revision && (
                  <td style={erpListTdPaddingStyle()}>
                    {!row.quotation ? null : (
                      <Stack gap="xs">
                        {row.quotation.map((quote, index) => {
                          if (quote.revision === 0) {
                            return (
                              <Text key={index} px={8} size="sm" c={fg} style={{ fontFamily: fontSans }}>
                                -
                              </Text>
                            );
                          }
                          return (
                            <Badge
                              key={index}
                              style={{ cursor: "pointer" }}
                              onClick={() =>
                                quote.quotation_service_id != null &&
                                onFetchRevision(quote.quotation_service_id)
                              }
                              color={primary}
                              size="sm"
                            >
                              {quote.revision}
                            </Badge>
                          );
                        })}
                      </Stack>
                    )}
                  </td>
                )}
                {visible.reject_remark && (
                  <td style={{ ...erpListTdPaddingStyle(), maxWidth: 200 }}>
                    {row.reject_remark == null || String(row.reject_remark).trim() === "" ? (
                      "—"
                    ) : (
                      <Tooltip
                        label={String(row.reject_remark)}
                        multiline
                        w={300}
                        position="top"
                        withArrow
                        styles={{ tooltip: { fontFamily: fontSans, fontSize: 12 } }}
                      >
                        <Text
                          size="sm"
                          c={fg}
                          style={{
                            cursor: "pointer",
                            lineHeight: 1.4,
                            whiteSpace: "pre-line",
                            fontFamily: fontSans,
                          }}
                        >
                          {String(row.reject_remark).trim().length > 10
                            ? `${String(row.reject_remark).trim().slice(0, 10)}...`
                            : String(row.reject_remark).trim()}
                        </Text>
                      </Tooltip>
                    )}
                  </td>
                )}
                <td
                  style={{
                    ...erpListStickyActionTdStyle(theme),
                    textAlign: "center",
                  }}
                >
                  <QuotationRowMenu
                    row={row}
                    ctx={{
                      ...rowMenuCtx,
                    }}
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

const statusBadgeRootStyle = {
  whiteSpace: "nowrap" as const,
  flexWrap: "nowrap" as const,
  maxWidth: "100%",
};

function StatusBadge({
  status,
  fontSans,
}: {
  status: string | undefined;
  fontSans: string;
}) {
  const badgeStyles = {
    root: {
      ...statusBadgeRootStyle,
      fontFamily: fontSans,
    },
  };

  if (!status) {
    return (
      <Badge color="gray" size="sm" styles={badgeStyles}>
        Pending
      </Badge>
    );
  }
  const s = status.toUpperCase();
  const blue = s === "QUOTE APPROVED" || status === "Quote Approved";
  const label = status;
  return (
    <Tooltip
      label={label}
      withArrow
      position="top"
      styles={{ tooltip: { fontFamily: fontSans, fontSize: 12, whiteSpace: "nowrap" } }}
    >
      <Badge
        color={s === "GAINED" ? "green" : s === "LOST" ? "red" : blue ? "blue" : "cyan"}
        size="sm"
        styles={badgeStyles}
      >
        {s}
      </Badge>
    </Tooltip>
  );
}
