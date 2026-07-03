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
  Loader,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconFilterFilled, IconX } from "@tabler/icons-react";
import type { ErpListTheme } from "../../../components/ERPListPage/erpListTheme";
import type { ErpListBodyCellTone } from "../../../components/ERPListPage/erpListTableStyles";
import {
  erpListDataRowProps,
  erpListStickyActionTdStyle,
  erpListStickyActionThStyle,
  erpListTableElementStyle,
  erpListTdCellToneStyle,
  erpListTdPaddingStyle,
  erpListThStyle,
} from "../../../components/ERPListPage/erpListTableStyles";

/* ─────────────────────────────────────────────────────────────────────────────
 * Column-header filter primitives (opt-in via `headerFilters` prop)
 *
 * Mirrors the EnquiryMaster / Pipeline pattern: each column can supply a
 * `filterKey`, and the parent provides a `headerFilters` prop with values +
 * onChange. A click on the header swaps the label for an inline editor; the
 * editor is absolutely positioned so the column width never shifts.
 * ─────────────────────────────────────────────────────────────────────────── */

export type TariffHeaderFilterValues = Record<string, string>;

export type TariffHeaderInputContext = {
  autoFocus: boolean;
  onClose: () => void;
};

export type TariffHeaderRenderInput = (
  ctx: TariffHeaderInputContext,
) => ReactNode;

export type TariffHeaderFiltersProp = {
  values: TariffHeaderFilterValues;
  onChange: (key: string, value: string) => void;
  /** Rich per-column editors (SearchableSelect / Select / SingleDateInput …). */
  renderInput?: Record<string, TariffHeaderRenderInput>;
  /** Friendly label for the collapsed header (e.g. `carrier_code` → name). */
  displayFormatter?: Record<string, (value: string) => string>;
};

export type TariffListColumn<TRow> = {
  id: string;
  header: string;
  align?: "left" | "right" | "center";
  /** Matches {@link AirExportBookingMaster} body cell emphasis (date vs key vs number). */
  cellTone?: ErpListBodyCellTone;
  cellMaxWidth?: number;
  cell: (row: TRow, rowIndex: number) => ReactNode;
  /** When set, the column header is click-to-edit and writes to `headerFilters.values[filterKey]`. */
  filterKey?: string;
  /** Placeholder used by the default `HeaderFilterInput` (rich `renderInput` ignores this). */
  filterPlaceholder?: string;
  /** Min header width so the absolute-positioned editor doesn't crop. */
  filterMinWidth?: number;
};

export type { ErpListBodyCellTone } from "../../../components/ERPListPage/erpListTableStyles";

const HEADER_FILTER_TEXTINPUT_STYLES = {
  input: {
    height: 26,
    minHeight: 26,
    fontSize: 12,
    paddingLeft: 8,
    paddingRight: 24,
  },
} as const;

/** Default editor — 1000ms-debounced text input with an instant-clear "X". */
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

/** Clickable header label that swaps to the filter value chip when active. */
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

/** Editor container — collapses on Escape or when focus leaves all inputs. */
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

export type TariffMasterListNativeTableProps<TRow> = {
  theme: ErpListTheme;
  rows: TRow[];
  getRowKey: (row: TRow, index: number) => string;
  getSno: (row: TRow, index: number) => number;
  columns: TariffListColumn<TRow>[];
  isEmpty: boolean;
  emptyIcon: ReactNode;
  emptyTitle: string;
  emptyHint?: string;
  renderActions: (row: TRow) => ReactNode;
  /** Optional click-to-edit header-filter wiring (per `column.filterKey`). */
  headerFilters?: TariffHeaderFiltersProp;
  /** When true, the body shows a centered loader (header / footer stay visible). */
  loading?: boolean;
  /** Friendly message rendered below the in-tbody loader. */
  loadingMessage?: string;
};

export function TariffMasterListNativeTable<TRow>({
  theme,
  rows,
  getRowKey,
  getSno,
  columns,
  isEmpty,
  emptyIcon,
  emptyTitle,
  emptyHint = "Try adjusting your search or filters",
  renderActions,
  headerFilters,
  loading = false,
  loadingMessage = "Loading…",
}: TariffMasterListNativeTableProps<TRow>) {
  const { muted, fg, fontSans, primary } = theme;
  const colCount = 1 + columns.length + 1;
  const actionColStyle = {
    ...erpListStickyActionTdStyle(theme),
    textAlign: "center" as const,
  };

  // Header-filter editing state (only relevant when `headerFilters` is supplied).
  const [editingColumn, setEditingColumn] = useState<string | null>(null);

  const openEditor = useCallback((colId: string) => {
    setEditingColumn(colId);
  }, []);
  const makeCollapse = useCallback(
    (colId: string) => () =>
      setEditingColumn((cur) => (cur === colId ? null : cur)),
    [],
  );

  const hf = headerFilters;
  const customInput = (key: string) => hf?.renderInput?.[key];
  const formatDisplay = (key: string, raw: string) =>
    hf?.displayFormatter?.[key]?.(raw) ?? raw;

  /**
   * Renders a click-to-edit filterable column header. The label always
   * renders in normal flow (so it determines the cell's width); while
   * editing it's `visibility: hidden` and the editor overlays with
   * `position: absolute` so the column width doesn't shift on toggle.
   */
  const renderHeaderForColumn = (col: TariffListColumn<TRow>): ReactNode => {
    if (!hf || !col.filterKey) return col.header;

    const key = col.filterKey;
    const isEditing = editingColumn === col.id;
    const rawVal = hf.values[key] ?? "";
    const display = rawVal ? formatDisplay(key, rawVal) : "";
    const align: "left" | "right" | "center" =
      col.align === "right" ? "right" : col.align === "center" ? "center" : "left";
    const custom = customInput(key);

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
            width: "100%",
            visibility: isEditing ? "hidden" : "visible",
            pointerEvents: isEditing ? "none" : undefined,
          }}
        >
          <FilterableHeaderLabel
            label={col.header}
            filterDisplay={display}
            onClick={() => openEditor(col.id)}
            theme={theme}
            align={align}
          />
        </span>
        {isEditing && (
          <FilterableHeaderEdit
            onCollapse={makeCollapse(col.id)}
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
                onClose: makeCollapse(col.id),
              })
            ) : (
              <HeaderFilterInput
                autoFocus
                value={rawVal}
                onChange={(next) => hf.onChange(key, next)}
                placeholder={col.filterPlaceholder ?? "Filter..."}
                ariaLabel={`Filter ${col.header}`}
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
        <tr style={hf ? { height: 52.4 } : undefined}>
          <th style={{ ...erpListThStyle(theme, { textAlign: "left" }), minWidth: 40 }}>
            S.No
          </th>
          {columns.map((col) => {
            const isFilterable = Boolean(hf && col.filterKey);
            const thStyle: CSSProperties = {
              ...erpListThStyle(theme, {
                textAlign:
                  col.align === "right"
                    ? "right"
                    : col.align === "center"
                      ? "center"
                      : "left",
              }),
              ...(isFilterable && col.filterMinWidth != null
                ? { minWidth: col.filterMinWidth }
                : {}),
            };
            return (
              <th key={col.id} style={thStyle}>
                {renderHeaderForColumn(col)}
              </th>
            );
          })}
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
                  {emptyIcon}
                </Box>
                <Box>
                  <Text fw={500} c={fg} style={{ fontFamily: fontSans }}>
                    {emptyTitle}
                  </Text>
                  <Text size="sm" c={muted} mt={4} style={{ fontFamily: fontSans }}>
                    {emptyHint}
                  </Text>
                </Box>
              </Stack>
            </td>
          </tr>
        ) : (
          rows.map((row, index) => (
            <tr key={getRowKey(row, index)} {...erpListDataRowProps(theme)}>
              <td style={erpListTdPaddingStyle()}>
                <Text fw={600} size="sm" c={fg} style={{ fontFamily: fontSans }}>
                  {getSno(row, index)}
                </Text>
              </td>
              {columns.map((col) => {
                const align = col.align;
                const tone = col.cellTone ?? "default";
                const fromTone = erpListTdCellToneStyle(theme, tone);
                const hasNumericTone = tone === "numeric" || tone === "numericStrong";
                return (
                  <td
                    key={col.id}
                    style={{
                      ...fromTone,
                      ...(col.cellMaxWidth != null ? { maxWidth: col.cellMaxWidth } : {}),
                      ...(!hasNumericTone && align === "right"
                        ? { textAlign: "right" as const }
                        : !hasNumericTone && align === "center"
                          ? { textAlign: "center" as const }
                          : {}),
                    }}
                  >
                    {col.cell(row, index)}
                  </td>
                );
              })}
              <td style={actionColStyle}>{renderActions(row)}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
