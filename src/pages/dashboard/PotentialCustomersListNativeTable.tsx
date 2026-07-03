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
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import {
  IconDotsVertical,
  IconFilterFilled,
  IconPlus,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import type { ErpListTheme } from "../../components/ERPListPage/erpListTheme";
import type { ErpListBodyCellTone } from "../../components/ERPListPage/erpListTableStyles";
import { ERP_LIST_GEIST_ROOT_CLASS } from "../../components/ERPListPage/erpListGeistShell";
import {
  erpListDataRowProps,
  erpListStickyActionTdStyle,
  erpListStickyActionThStyle,
  erpListTableElementStyle,
  erpListTdCellToneStyle,
  erpListTdPaddingStyle,
  erpListThStyle,
} from "../../components/ERPListPage/erpListTableStyles";

export type PotentialCustomerTableRow = {
  id: number;
  sno: number;
  customer: string;
  email_id: string;
  commodity: string;
  ice?: string;
  pin?: string;
  phone_no?: string;
  contact_person?: string;
  address?: string;
  city?: string;
  state?: string;
  total_value?: string;
  total_quantity?: string;
  unit?: string;
  assigned_to?: string;
  created_at?: string;
  [key: string]: unknown;
};

export type PotentialCustomerVisibleColumns = {
  sno: boolean;
  customer: boolean;
  email_id: boolean;
  commodity: boolean;
  ice: boolean;
  pin: boolean;
  phone_no: boolean;
  contact_person: boolean;
  address: boolean;
  city: boolean;
  state: boolean;
  total_value: boolean;
  total_quantity: boolean;
  unit: boolean;
  assigned_to: boolean;
  created_at: boolean;
};

const RIGHT_ALIGN_KEYS = new Set<
  keyof PotentialCustomerVisibleColumns
>(["total_value", "total_quantity", "unit"]);

const HEADERS: Record<keyof PotentialCustomerVisibleColumns, string> = {
  sno: "S.No",
  customer: "Customer",
  email_id: "Email",
  commodity: "Commodity",
  ice: "Ice",
  pin: "Pin",
  phone_no: "Phone No.",
  contact_person: "Contact Person",
  address: "Address",
  city: "City",
  state: "State",
  total_value: "Total Value",
  total_quantity: "Total Qty",
  unit: "Unit",
  assigned_to: "Assigned to",
  created_at: "Assigned date",
};

/* ─────────────────────────────────────────────────────────────────────────────
 * Column-header filter types & primitives
 *
 * Same pattern as `EnquiryListNativeTables`: each filterable column header is
 * normally a plain label; clicking it transforms into an inline editor. The
 * parent owns the underlying filter state and supplies a `renderInput` per
 * column so the editor type (TextInput / Select) mirrors the advanced filter
 * section exactly.
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * Filterable column keys. These mirror the columns rendered in this table
 * AND the keys understood by the backend (`customer_code`, `email_id`,
 * `commodity`, `ice`, `pin`, `phone_no`, `contact_person`, `address`,
 * `city`, `state`, `unit`, `assigned_to` via `sales_person`, `created_at`).
 *
 * The keys here intentionally match the table's column keys for ergonomic
 * `<th>` ↔ filter mapping; the parent maps them to the backend payload
 * shape in `handlePotentialHeaderFilterChange`.
 */
export type PotentialCustomerHeaderFilterKey =
  | "customer"
  | "email_id"
  | "commodity"
  | "ice"
  | "pin"
  | "phone_no"
  | "contact_person"
  | "address"
  | "city"
  | "state"
  | "unit"
  | "assigned_to"
  | "created_at";

export type PotentialCustomerHeaderFilterValues = Record<
  PotentialCustomerHeaderFilterKey,
  string
>;

export type PotentialCustomerHeaderInputContext = {
  autoFocus: boolean;
  onClose: () => void;
};

export type PotentialCustomerHeaderRenderInput = (
  ctx: PotentialCustomerHeaderInputContext,
) => ReactNode;

export type PotentialCustomerHeaderFiltersProp = {
  values: PotentialCustomerHeaderFilterValues;
  onChange: (key: PotentialCustomerHeaderFilterKey, value: string) => void;
  /**
   * Optional per-column custom input. When provided, used INSTEAD of the
   * default `TextInput` once the user clicks the column header to enter edit
   * mode. The parent typically supplies a `Select` here so the column filters
   * mirror the advanced filter section — keeping the API payload shape
   * identical.
   */
  renderInput?: Partial<
    Record<PotentialCustomerHeaderFilterKey, PotentialCustomerHeaderRenderInput>
  >;
  /**
   * Optional per-column formatter for the collapsed header label. Useful
   * when the underlying filter value is a code / id but a friendlier label
   * is available.
   */
  displayFormatter?: Partial<
    Record<PotentialCustomerHeaderFilterKey, (value: string) => string>
  >;
};

type PotentialCustomerEditingColumn = PotentialCustomerHeaderFilterKey | null;

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
 * state and only forwards `onChange` to the parent after 1000ms of
 * inactivity. The clear (X) button bypasses the debounce so clearing is
 * instant. External value changes (Clear All / restore / advanced filter
 * edits) sync back into local state.
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

function str(v: unknown): string {
  if (v == null || v === "") return "—";
  return String(v);
}

function bodyCellTone(
  k: keyof PotentialCustomerVisibleColumns,
  isSno: boolean
): ErpListBodyCellTone {
  if (isSno) return "default";
  if (k === "total_value") return "numeric";
  if (k === "total_quantity" || k === "unit") return "numericStrong";
  if (k === "created_at") return "muted";
  return "default";
}

/**
 * Per-column min widths used when the header has a filter input attached.
 * Picked so the editor doesn't squash the original label width and the
 * absolute-positioned editor never visually crops.
 */
const FILTERABLE_MIN_WIDTHS: Partial<
  Record<PotentialCustomerHeaderFilterKey, number>
> = {
  customer: 180,
  email_id: 180,
  commodity: 150,
  ice: 120,
  pin: 120,
  phone_no: 150,
  contact_person: 160,
  address: 200,
  city: 140,
  state: 140,
  unit: 110,
  assigned_to: 160,
  created_at: 160,
};

const FILTERABLE_KEYS = new Set<keyof PotentialCustomerVisibleColumns>([
  "customer",
  "email_id",
  "commodity",
  "ice",
  "pin",
  "phone_no",
  "contact_person",
  "address",
  "city",
  "state",
  "unit",
  "assigned_to",
  "created_at",
]);

type Props = {
  theme: ErpListTheme;
  rows: PotentialCustomerTableRow[];
  visible: PotentialCustomerVisibleColumns;
  isEmpty: boolean;
  /** When true, show assigned columns + actions */
  assignedMode: boolean;
  onCreateCallEntry: (row: PotentialCustomerTableRow) => void;
  /** Click-to-edit inline filters that bind to the parent's filter state. */
  headerFilters?: PotentialCustomerHeaderFiltersProp;
  /** When true, renders an in-tbody loader instead of the row list (header stays visible). */
  loading?: boolean;
  /** Optional friendlier message for the in-tbody loader. */
  loadingMessage?: string;
};

export function PotentialCustomersListNativeTable({
  theme,
  rows,
  visible,
  isEmpty,
  assignedMode,
  onCreateCallEntry,
  headerFilters,
  loading = false,
  loadingMessage = "Loading…",
}: Props) {
  const { fg, muted, fontSans, primary } = theme;
  const displayKeys = (
    Object.keys(HEADERS) as (keyof PotentialCustomerVisibleColumns)[]
  )
    .filter((k) => visible[k] !== false)
    .filter((k) => assignedMode || (k !== "assigned_to" && k !== "created_at"));
  const emptyColSpan = displayKeys.length + (assignedMode ? 1 : 0) || 1;
  const actionColStyle = {
    ...erpListStickyActionTdStyle(theme),
    textAlign: "center" as const,
  };

  // ── Header-filter state (only used when `headerFilters` prop is supplied) ──
  const [editingHeaderColumn, setEditingHeaderColumn] =
    useState<PotentialCustomerEditingColumn>(null);

  const openHeaderEditor = useCallback(
    (col: NonNullable<PotentialCustomerEditingColumn>) =>
      setEditingHeaderColumn(col),
    [],
  );
  const makeCollapseHeader = useCallback(
    (col: NonNullable<PotentialCustomerEditingColumn>) => () =>
      setEditingHeaderColumn((cur) => (cur === col ? null : cur)),
    [],
  );

  const hf = headerFilters;
  const filterValues: PotentialCustomerHeaderFilterValues | null =
    hf?.values ?? null;
  const customInput = (key: PotentialCustomerHeaderFilterKey) =>
    hf?.renderInput?.[key];
  const formatDisplay = (
    key: PotentialCustomerHeaderFilterKey,
    raw: string,
  ) => hf?.displayFormatter?.[key]?.(raw) ?? raw;

  /**
   * Renders a click-to-edit single-key filterable column header.
   *
   * The label is always rendered in normal flow (so it determines the cell's
   * width); when editing, it's visibility-hidden and the editor is overlaid
   * with `position: absolute` so the column width does not jump.
   */
  const renderFilterableHeader = (
    key: PotentialCustomerHeaderFilterKey,
    label: string,
    placeholder: string,
  ): ReactNode => {
    if (!hf || !filterValues) return label;
    const isEditing = editingHeaderColumn === key;
    const filterDisplay = formatDisplay(key, filterValues[key]);
    const custom = customInput(key);

    return (
      <div style={{ position: "relative", width: "100%", minHeight: 26, display: "flex", alignItems: "center", ...(key === "unit" && { justifyContent: "flex-end" }) }}>
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
          {displayKeys.map((k) => {
            const baseStyle = erpListThStyle(theme, {
              textAlign: RIGHT_ALIGN_KEYS.has(k) ? "right" : "left",
            
            });
            // Filterable column → render the click-to-edit header.
            if (hf && filterValues && FILTERABLE_KEYS.has(k)) {
              const minWidth = FILTERABLE_MIN_WIDTHS[k as PotentialCustomerHeaderFilterKey];
              return (
                <th
                  key={k}
                  style={{ ...baseStyle, ...(minWidth ? { minWidth } : {})}}
                >
                  {renderFilterableHeader(
                    k as PotentialCustomerHeaderFilterKey,
                    HEADERS[k],
                    HEADERS[k],
                  )}
                </th>
              );
            }
            // Non-filterable columns — `sno` gets a tight 40px minWidth so
            // the row-number cell stays compact regardless of viewport size.
            const nonFilterableMinWidth = k === "sno" ? 40 : undefined;
            return (
              <th
                key={k}
                style={{
                  ...baseStyle,
                  ...(nonFilterableMinWidth
                    ? { minWidth: nonFilterableMinWidth }
                    : {}),
                }}
              >
                {HEADERS[k]}
              </th>
            );
          })}
          {assignedMode && (
            <th style={erpListStickyActionThStyle(theme, 80)}>Actions</th>
          )}
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <tr>
            <td colSpan={emptyColSpan} style={{ padding: 60 }}>
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
              colSpan={emptyColSpan}
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
                  <IconUsers size={24} color={muted} />
                </Box>
                <Box>
                  <Text fw={500} c={fg}>
                    No potential customers
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
            <tr key={row.id} {...erpListDataRowProps(theme)}>
              {displayKeys.map((k) => {
                const alignRight = RIGHT_ALIGN_KEYS.has(k);
                const isSno = k === "sno";
                const raw = isSno ? String(row.sno) : str(row[k]);
                const isLong =
                  k === "address" || k === "contact_person" || k === "customer";
                const tone = bodyCellTone(k, isSno);
                const fromTone = erpListTdCellToneStyle(theme, tone);
                return (
                  <td
                    key={k}
                    style={{
                      ...fromTone,
                      ...(tone === "default" && alignRight
                        ? {
                            textAlign: "right" as const,
                            fontSize: 14,
                          }
                        : {}),
                      ...(!isSno && k === "customer" ? { maxWidth: 200 } : {}),
                      ...(!isSno && k === "address" ? { maxWidth: 240 } : {}),
                    }}
                  >
                    {isSno ? (
                      <Text fw={600} size="sm" c={fg} style={{ fontFamily: fontSans }}>
                        {row.sno}
                      </Text>
                    ) : isLong ? (
                      <Tooltip
                        label={raw}
                        withArrow
                        multiline
                        w={320}
                        position="top"
                        styles={{ tooltip: { fontFamily: fontSans, fontSize: 12 } }}
                      >
                        <Text
                          size="sm"
                          c={k === "customer" ? fg : muted}
                          lineClamp={k === "address" ? 2 : 1}
                          style={{ fontFamily: fontSans, cursor: "default" }}
                        >
                          {raw}
                        </Text>
                      </Tooltip>
                    ) : tone === "numeric" || tone === "numericStrong" ? (
                      <Text
                        size="sm"
                        c={tone === "numeric" ? muted : fg}
                        fw={tone === "numericStrong" ? 500 : undefined}
                        style={{ fontFamily: fontSans }}
                      >
                        {raw}
                      </Text>
                    ) : (
                      <Text
                        size="sm"
                        c={
                          k === "ice" || k === "pin" || k === "state" || k === "created_at"
                            ? muted
                            : fg
                        }
                        style={{ fontFamily: fontSans }}
                      >
                        {raw}
                      </Text>
                    )}
                  </td>
                );
              })}
              {assignedMode && (
                <td style={actionColStyle}>
                  <RowMenu
                    onCreateCallEntry={() => onCreateCallEntry(row)}
                    iconAccent={primary}
                  />
                </td>
              )}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function RowMenu({
  onCreateCallEntry,
  iconAccent = "#105476",
}: {
  onCreateCallEntry: () => void;
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
              onCreateCallEntry();
            }}
          >
            <Group gap="sm">
              <IconPlus size={16} style={{ color: iconAccent }} />
              <Text size="sm">Create call entry</Text>
            </Group>
          </UnstyledButton>
        </Box>
      </Menu.Dropdown>
    </Menu>
  );
}
