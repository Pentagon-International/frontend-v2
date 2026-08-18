import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import {
  ActionIcon,
  Box,
  Center,
  Group,
  Loader,
  Menu,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import {
  IconArrowRight,
  IconDotsVertical,
  IconEdit,
  IconEye,
  IconFilterFilled,
  IconRoute,
  IconX,
} from "@tabler/icons-react";
import type { ErpListTheme } from "../../components/ERPListPage/erpListTheme";
import { ERP_LIST_GEIST_ROOT_CLASS } from "../../components/ERPListPage/erpListGeistShell";
import {
  erpListDataRowProps,
  erpListStickyActionTdStyle,
  erpListStickyActionThStyle,
  erpListTableElementStyle,
  erpListTdPaddingStyle,
  erpListThStyle,
} from "../../components/ERPListPage/erpListTableStyles";
import { formatMoneyAmountForUi } from "../../utils/nonDecimalMoneyAmount";

/** One origin→destination pair extracted from a pipeline entry. */
export type PipelineRoutePair = {
  /** Display token for origin — typically the port code (e.g. "INMAA"). */
  originCode: string;
  /** Friendly name for origin (used in tooltip / fallback). */
  originName: string;
  /** Display token for destination — typically the port code (e.g. "DEL"). */
  destinationCode: string;
  /** Friendly name for destination (used in tooltip / fallback). */
  destinationName: string;
};

/** Display tokens aggregated across a customer's `pipelines[]` array. */
export type PipelineRowAggregates = {
  /** Unique service codes (e.g. ["AIR", "FCL"]). */
  services: string[];
  /** Unique origin → destination pairs (preserves first-seen order). */
  routes: PipelineRoutePair[];
  /** Unique frequency names (e.g. ["Daily", "Weekly"]). */
  frequencies: string[];
};

/** List row: metrics + aggregates + `raw` for navigation to create page */
export type PipelineListRow = PipelineRowAggregates & {
  sno: number;
  customer_code: string;
  customer_name: string;
  created_by: string;
  created_at?: string;
  updated_by?: string;
  updated_at?: string;
  total_profit: number;
  total_volume: number;
  pipelines: unknown[];
  raw: {
    customer_code: string;
    customer_name: string;
    created_by: string;
    created_at?: string;
    updated_by?: string;
    updated_at?: string;
    pipelines: unknown[];
    total_profit: number;
    total_volume: number;
  };
};

/* ─────────────────────────────────────────────────────────────────────────────
 * Column-header filter types & primitives
 *
 * Pipeline renders six filterable columns — all of which map 1:1 to the
 * advanced filter section so the column header sends the SAME backend
 * payload that the advanced filter would. No new API, no payload shape
 * changes — purely additive over the existing filter flow.
 *
 *   • `customer_name`  → backend `customer_code`        (SearchableSelect)
 *   • `sales_person`   → backend `created_by`           (Select)
 *   • `service`        → backend `service`              (Select)
 *   • `origin`         → backend `origin_port_code`     (SearchableSelect)
 *   • `destination`    → backend `destination_port_code`(SearchableSelect)
 *   • `frequency`      → backend `frequency_id`         (Select)
 * ─────────────────────────────────────────────────────────────────────────── */

export type PipelineHeaderFilterKey =
  | "customer_name"
  | "sales_person"
  | "service"
  | "origin"
  | "destination"
  | "frequency";

export type PipelineHeaderFilterValues = Record<
  PipelineHeaderFilterKey,
  string
>;

export type PipelineHeaderInputContext = {
  autoFocus: boolean;
  onClose: () => void;
};

export type PipelineHeaderRenderInput = (
  ctx: PipelineHeaderInputContext,
) => ReactNode;

export type PipelineHeaderFiltersProp = {
  values: PipelineHeaderFilterValues;
  onChange: (key: PipelineHeaderFilterKey, value: string) => void;
  /**
   * Parent-supplied rich editors per column. The parent typically passes a
   * `SearchableSelect` / `Select` here so the column filter mirrors the
   * advanced filter section, keeping the API payload identical.
   */
  renderInput?: Partial<Record<PipelineHeaderFilterKey, PipelineHeaderRenderInput>>;
  /** Optional formatter — e.g. `customer_code` → friendly `customer_name`. */
  displayFormatter?: Partial<Record<PipelineHeaderFilterKey, (value: string) => string>>;
};

/**
 * `route` is a UI-only pseudo column that wraps the `origin` + `destination`
 * dual editor — backend payload still ships them as separate keys.
 */
type PipelineEditingColumn = PipelineHeaderFilterKey | "route" | null;

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
 * Fallback editor used when no `renderInput` is supplied for a column.
 * Maintains its own typing buffer and only commits upstream after 1000ms of
 * inactivity (clear-X bypasses the debounce).
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

  useEffect(() => {
    if (value !== lastEmittedRef.current || value === "") {
      setLocalValue(value);
      lastEmittedRef.current = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

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
 * Specialised Route header. When unfiltered it reads as the plain "Route"
 * column name; when filtered it shows the codes side-by-side ("INMAA → DEL")
 * with a filter-icon affordance — mirrors EnquiryMaster's `FilterableRouteHeaderLabel`.
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

/** Renders the column label (or the active filter value) as a clickable button that opens the edit input. */
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
 * Container around the editor input. Auto-focuses on mount, collapses on
 * Escape and when focus leaves all inputs in this cell. Supports absolute
 * positioning via `style` so the column width does not jump.
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

/**
 * Per-column min widths so the absolute-positioned editor doesn't crop and
 * the original column label width is preserved during edit.
 */
const FILTERABLE_MIN_WIDTHS: Record<PipelineHeaderFilterKey, number> = {
  customer_name: 220,
  sales_person: 160,
  service: 110,
  origin: 140,
  destination: 140,
  frequency: 130,
};

/** Combined Route column width — fits "INMAA → DEL" pairs comfortably. */
const PIPELINE_COL_ROUTE_MIN = 220;

type PipelineListNativeTableProps = {
  theme: ErpListTheme;
  rows: PipelineListRow[];
  isEmpty: boolean;
  onView: (row: PipelineListRow) => void;
  onEdit: (row: PipelineListRow) => void;
  /** Click-to-edit inline filters bound to the parent's filter state. */
  headerFilters?: PipelineHeaderFiltersProp;
  /** When true, renders an in-tbody loader instead of the row list (header / footer stay visible). */
  loading?: boolean;
  /** Friendlier message for the in-tbody loader. */
  loadingMessage?: string;
};

export function PipelineListNativeTable({
  theme,
  rows,
  isEmpty,
  onView,
  onEdit,
  headerFilters,
  loading = false,
  loadingMessage = "Loading…",
}: PipelineListNativeTableProps) {
  const { muted, fg, fontSans, primary } = theme;
  const colCount = 10;
  const actionColStyle = {
    ...erpListStickyActionTdStyle(theme),
    textAlign: "center" as const,
  };

  // ── Header-filter state (only used when `headerFilters` is supplied) ──────
  const [editingHeaderColumn, setEditingHeaderColumn] =
    useState<PipelineEditingColumn>(null);

  const openHeaderEditor = useCallback(
    (col: NonNullable<PipelineEditingColumn>) => setEditingHeaderColumn(col),
    [],
  );
  const makeCollapseHeader = useCallback(
    (col: NonNullable<PipelineEditingColumn>) => () =>
      setEditingHeaderColumn((cur) => (cur === col ? null : cur)),
    [],
  );
  const collapseRoute = useCallback(
    () => setEditingHeaderColumn((cur) => (cur === "route" ? null : cur)),
    [],
  );

  const hf = headerFilters;
  const filterValues: PipelineHeaderFilterValues | null = hf?.values ?? null;
  const customInput = (key: PipelineHeaderFilterKey) => hf?.renderInput?.[key];
  const formatDisplay = (key: PipelineHeaderFilterKey, raw: string) =>
    hf?.displayFormatter?.[key]?.(raw) ?? raw;

  /**
   * Renders a click-to-edit single-key filterable column header.
   *
   * The label always renders in normal flow (so it determines the cell's
   * width); while editing it's `visibility: hidden` and the editor overlays
   * with `position: absolute` so the column width does not shift.
   */
  const renderFilterableHeader = (
    key: PipelineHeaderFilterKey,
    label: string,
    placeholder: string,
    align: "left" | "center" | "right" = "left",
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
            align={align}
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

  /**
   * Combined Route column header. Shows "Route" when unfiltered, "INMAA → DEL"
   * code pair when filtered. Click opens a dual editor (origin + destination
   * side-by-side) that writes to the SAME backend keys as the advanced filter
   * (`origin_port_code` / `destination_port_code`).
   */
  const renderRouteHeader = (): ReactNode => {
    if (!hf || !filterValues) return "Route";
    const isEditing = editingHeaderColumn === "route";
    const originVal = filterValues.origin ?? "";
    const destinationVal = filterValues.destination ?? "";

    return (
      <div
        style={{
          position: "relative",
          width: "100%",
          minHeight: 26,
          display: "flex",
          alignItems: "center",
        }}
      >
        <span
          style={{
            display: "block",
            visibility: isEditing ? "hidden" : "visible",
            pointerEvents: isEditing ? "none" : undefined,
            width: "100%",
          }}
        >
          <FilterableRouteHeaderLabel
            originCode={originVal}
            destinationCode={destinationVal}
            onClick={() => openHeaderEditor("route")}
            theme={theme}
          />
        </span>
        {isEditing && (
          <FilterableHeaderEdit
            onCollapse={collapseRoute}
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
            }}
          >
            <Group gap={4} wrap="nowrap" align="center" style={{ width: "100%" }}>
              <Box style={{ flex: 1, minWidth: 0 }}>
                {customInput("origin")?.({
                  autoFocus: true,
                  onClose: collapseRoute,
                }) ?? (
                  <HeaderFilterInput
                    value={originVal}
                    onChange={(val) => hf.onChange("origin", val)}
                    placeholder="Origin"
                    ariaLabel="Filter Origin"
                    autoFocus
                  />
                )}
              </Box>
              <Box style={{ flex: 1, minWidth: 0 }}>
                {customInput("destination")?.({
                  autoFocus: false,
                  onClose: collapseRoute,
                }) ?? (
                  <HeaderFilterInput
                    value={destinationVal}
                    onChange={(val) => hf.onChange("destination", val)}
                    placeholder="Destination"
                    ariaLabel="Filter Destination"
                  />
                )}
              </Box>
            </Group>
          </FilterableHeaderEdit>
        )}
      </div>
    );
  };

  return (
    <table style={erpListTableElementStyle(theme)}>
      <thead>
        <tr style={{ height: 52.4 }}>
          <th style={{ ...erpListThStyle(theme, { textAlign: "left" }), minWidth: 40 }}>S.No</th>
          <th style={erpListThStyle(theme, { textAlign: "left" })}>Customer Code</th>
          <th
            style={{
              ...erpListThStyle(theme, { textAlign: "left" }),
              ...(hf ? { minWidth: FILTERABLE_MIN_WIDTHS.customer_name } : {}),
            }}
          >
            {renderFilterableHeader("customer_name", "Customer Name", "Customer Name")}
          </th>
          <th
            style={{
              ...erpListThStyle(theme, { textAlign: "left" }),
              ...(hf ? { minWidth: FILTERABLE_MIN_WIDTHS.sales_person } : {}),
            }}
          >
            {renderFilterableHeader("sales_person", "Sales Person", "Sales Person")}
          </th>
          <th
            style={{
              ...erpListThStyle(theme, { textAlign: "left" }),
              ...(hf ? { minWidth: FILTERABLE_MIN_WIDTHS.service } : {}),
            }}
          >
            {renderFilterableHeader("service", "Service", "Service")}
          </th>
          <th
            style={{
              ...erpListThStyle(theme, { textAlign: "left" }),
              whiteSpace: "nowrap",
              minWidth: hf ? PIPELINE_COL_ROUTE_MIN : undefined,
            }}
          >
            {renderRouteHeader()}
          </th>
          <th
            style={{
              ...erpListThStyle(theme, { textAlign: "left" }),
              ...(hf ? { minWidth: FILTERABLE_MIN_WIDTHS.frequency } : {}),
            }}
          >
            {renderFilterableHeader("frequency", "Frequency", "Frequency")}
          </th>
          <th style={erpListThStyle(theme, { textAlign: "right" })}>Total Profit</th>
          <th style={erpListThStyle(theme, { textAlign: "right" })}>Total Volume</th>
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
            <td colSpan={colCount} style={{ padding: 60, textAlign: "center" }}>
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
                  <IconRoute size={24} color={muted} />
                </Box>
                <Box>
                  <Text fw={500} c={fg} style={{ fontFamily: fontSans }}>
                    No pipeline records
                  </Text>
                  <Text size="sm" c={muted} mt={4} style={{ fontFamily: fontSans }}>
                    Try adjusting your search or filters
                  </Text>
                </Box>
              </Stack>
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr key={`${row.customer_code}-${row.sno}`} {...erpListDataRowProps(theme)}>
              <td style={erpListTdPaddingStyle()}>
                <Text fw={600} size="sm" c={fg} style={{ fontFamily: fontSans }}>
                  {row.sno}
                </Text>
              </td>
              <td style={erpListTdPaddingStyle()}>
                <Text size="sm" c={fg} style={{ fontFamily: fontSans }}>
                  {row.customer_code}
                </Text>
              </td>
              <td style={{ ...erpListTdPaddingStyle(), maxWidth: 220 }}>
                <Text size="sm" c={fg} lineClamp={2} style={{ fontFamily: fontSans }}>
                  {row.customer_name}
                </Text>
              </td>
              <td style={erpListTdPaddingStyle()}>
                <Text size="sm" c={muted} style={{ fontFamily: fontSans }}>
                  {row.created_by}
                </Text>
              </td>
              <td style={erpListTdPaddingStyle()}>
                <Text
                  size="sm"
                  c={fg}
                  style={{ fontFamily: fontSans, whiteSpace: "normal" }}
                  lineClamp={2}
                  title={row.services.join(", ")}
                >
                  {row.services.length > 0 ? row.services.join(", ") : "—"}
                </Text>
              </td>
              <td
                style={{
                  ...erpListTdPaddingStyle(),
                  whiteSpace: "nowrap",
                }}
                title={
                  row.routes.length > 0
                    ? row.routes
                        .map(
                          (r) =>
                            `${(r.originName || r.originCode || "—").trim()} → ${(r.destinationName || r.destinationCode || "—").trim()}`,
                        )
                        .join("\n")
                    : undefined
                }
              >
                {row.routes.length > 0 ? (
                  <Stack gap={2}>
                    {row.routes.map((r, idx) => {
                      const left = (r.originCode || r.originName || "—").trim();
                      const right = (r.destinationCode || r.destinationName || "—").trim();
                      return (
                        <Group
                          key={`${left}->${right}-${idx}`}
                          gap={4}
                          wrap="nowrap"
                          align="center"
                        >
                          <Text
                            size="sm"
                            c={fg}
                            fw={600}
                            style={{ fontFamily: fontSans }}
                          >
                            {left}
                          </Text>
                          <IconArrowRight size={12} color={muted} />
                          <Text
                            size="sm"
                            c={fg}
                            style={{ fontFamily: fontSans }}
                          >
                            {right}
                          </Text>
                        </Group>
                      );
                    })}
                  </Stack>
                ) : (
                  <Text size="sm" c={muted} style={{ fontFamily: fontSans }}>
                    —
                  </Text>
                )}
              </td>
              <td style={erpListTdPaddingStyle()}>
                <Text
                  size="sm"
                  c={muted}
                  style={{ fontFamily: fontSans, whiteSpace: "normal" }}
                  lineClamp={2}
                  title={row.frequencies.join(", ")}
                >
                  {row.frequencies.length > 0 ? row.frequencies.join(", ") : "—"}
                </Text>
              </td>
              <td
                style={{
                  ...erpListTdPaddingStyle(),
                  textAlign: "right",
                  fontSize: 14,
                  color: muted,
                }}
              >
                {formatMoneyAmountForUi(row.total_profit ?? 0)}
              </td>
              <td
                style={{
                  ...erpListTdPaddingStyle(),
                  textAlign: "right",
                  fontSize: 14,
                  fontWeight: 500,
                  color: fg,
                }}
              >
                {(row.total_volume ?? 0).toLocaleString(undefined, {
                  maximumFractionDigits: 1,
                })}
              </td>
              <td style={actionColStyle}>
                <PipelineRowMenu
                  onView={() => onView(row)}
                  onEdit={() => onEdit(row)}
                  iconAccent={primary}
                />
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function PipelineRowMenu({
  onView,
  onEdit,
  iconAccent = "#105476",
}: {
  onView: () => void;
  onEdit: () => void;
  iconAccent?: string;
}) {
  const [opened, setOpened] = useState(false);
  return (
    <Menu
      withinPortal
      position="bottom-end"
      shadow="sm"
      radius="md"
      opened={opened}
      onChange={setOpened}
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
              setOpened(false);
              onView();
            }}
          >
            <Group gap="sm">
              <IconEye size={16} style={{ color: iconAccent }} />
              <Text size="sm">View</Text>
            </Group>
          </UnstyledButton>
        </Box>
        <Menu.Divider />
        <Box px={10} py={5}>
          <UnstyledButton
            onClick={() => {
              setOpened(false);
              onEdit();
            }}
          >
            <Group gap="sm">
              <IconEdit size={16} style={{ color: iconAccent }} />
              <Text size="sm">Edit</Text>
            </Group>
          </UnstyledButton>
        </Box>
      </Menu.Dropdown>
    </Menu>
  );
}
