import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { ActionIcon, TextInput, UnstyledButton } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconFilterFilled, IconX } from "@tabler/icons-react";
import type { ErpListTheme } from "./erpListTheme";

/**
 * Shared column-header filter primitives for ERP list/master pages.
 *
 * Pattern mirrors the EnquiryMaster column-header filtering UX:
 *   - Each header shows the column name. Click -> the cell flips to an inline
 *     editor (TextInput by default, or a custom editor via `renderEditor`).
 *   - When a filter value is active, the collapsed label shows the value with
 *     a small filter icon (or a custom `displayValue` such as a human-readable
 *     label).
 *   - The fade animation between label and editor reuses the global
 *     `.erp-header-filter-fade` class defined in `src/index.css`.
 *
 * The text input is internally debounced (default 1000ms) so typing does not
 * spam the API; the clear (X) button fires onChange immediately.
 */

const HEADER_FILTER_TEXTINPUT_STYLES = {
  input: {
    height: 26,
    minHeight: 26,
    fontSize: 12,
    paddingLeft: 8,
    paddingRight: 24,
    width: "100%",
  },
} as const;

export type ERPListHeaderFilterInputProps = {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  ariaLabel: string;
  autoFocus?: boolean;
  /** Debounce delay in ms before calling onChange. Default 1000ms. */
  debounceMs?: number;
};

/**
 * Debounced text input used inside a column header. Local state keeps the
 * input snappy; the parent `onChange` is only invoked after `debounceMs` of
 * inactivity. Clicking the inline clear (X) bypasses the debounce.
 */
export function ERPListHeaderFilterInput({
  value,
  onChange,
  placeholder = "Filter...",
  ariaLabel,
  autoFocus,
  debounceMs = 1000,
}: ERPListHeaderFilterInputProps) {
  const [local, setLocal] = useState(value);
  const [debounced] = useDebouncedValue(local, debounceMs);
  const lastEmittedRef = useRef(value);

  useEffect(() => {
    if (value !== local && value !== lastEmittedRef.current) {
      setLocal(value);
      lastEmittedRef.current = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (debounced === lastEmittedRef.current) return;
    lastEmittedRef.current = debounced;
    onChange(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  return (
    <TextInput
      size="xs"
      value={local}
      onChange={(e) => setLocal(e.currentTarget.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      autoFocus={autoFocus}
      styles={HEADER_FILTER_TEXTINPUT_STYLES}
      rightSection={
        local ? (
          <ActionIcon
            variant="transparent"
            size="xs"
            color="gray"
            onMouseDown={(e) => {
              e.preventDefault();
            }}
            onClick={() => {
              setLocal("");
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

/** Collapsed header label. Shows the active filter value when present.
 *
 * Typography is intentionally inherited from the surrounding `<th>` so this
 * label renders identically to plain-string `header: "..."` columns. The
 * global rule `.mantine-Table-thead th` in `src/index.css` enforces:
 *   - color: #475569
 *   - font-weight: 600
 *   - font-size: 13px
 *   - letter-spacing: 0.02em
 * and pages further set `font-family` via the root class. We must therefore
 * NOT set inline `fontFamily`, `fontWeight`, `fontSize`, or `color` here —
 * any inline value would override that global header styling on the button
 * element (since the global rule targets `<th>`, not its descendants).
 */
function ERPListFilterableHeaderLabel({
  label,
  filterDisplay,
  onClick,
  theme: _theme,
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
        /*
         * `font: inherit` forces font-family, font-size, font-weight,
         * letter-spacing, and line-height to be taken from the parent
         * `<th>`, so a filterable header label renders identically to a
         * plain `header: "..."` column header.
         */
        font: "inherit",
        color: "inherit",
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
        isFiltered
          ? `Filter: ${filterDisplay}\nClick to edit`
          : `Click to filter`
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
      {/*
       * `currentColor` so the filter icon matches the header text color
       * (#475569 from the global `.mantine-Table-thead th` rule). Avoids
       * the previous mismatch where the icon used `theme.muted` (#64748b).
       */}
      {isFiltered && <IconFilterFilled size={12} color="currentColor" />}
    </UnstyledButton>
  );
}

/**
 * Editor container. Collapses on Escape or when focus leaves all descendants
 * (allowing tabbing between sibling inputs in dual-editor headers). A plain
 * block-level wrapper so the embedded editor (SearchableSelect / Select /
 * TextInput) naturally fills the column's available width.
 */
function ERPListFilterableHeaderEdit({
  onCollapse,
  children,
}: {
  onCollapse: () => void;
  children: ReactNode;
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
      if (e.key === "Escape") onCollapse();
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

export type ERPListColumnHeaderFilterProps = {
  /** Column display name (shown when no filter is active). */
  label: string;
  /** Raw filter value (drives the "filtered" indicator + default editor). */
  value: string;
  /** Called when the value changes. Debounced for the default TextInput editor. */
  onChange: (next: string) => void;
  theme: ErpListTheme;
  placeholder?: string;
  ariaLabel?: string;
  align?: "left" | "center" | "right";
  /** Human-readable value shown in the collapsed label when filtered (defaults to `value`). */
  displayValue?: string;
  /** Editor open/close is controlled by the parent. */
  isEditing: boolean;
  onStartEdit: () => void;
  onStopEdit: () => void;
  /** Override the default text input editor (e.g. SearchableSelect, date picker). */
  renderEditor?: (ctx: { autoFocus: boolean; onClose: () => void }) => ReactNode;
};

/**
 * Self-contained column-header filter cell. Use as the `Header` prop of an MRT
 * column or as a `<th>` child in a native table. Parent owns the
 * `isEditing` flag so clicking one header collapses any other open editor.
 *
 * Layout: conditional render (matches `LeadList`). When `isEditing`, the
 * editor replaces the label and fills the column's available width. Column
 * width is expected to be enforced by the parent (e.g. MRT column `size` or
 * `<th>` `minWidth`), and header row height by a fixed `minHeight` on the
 * cell, so toggling between label and editor never resizes the column.
 */
export function ERPListColumnHeaderFilter({
  label,
  value,
  onChange,
  theme,
  placeholder,
  ariaLabel,
  align,
  displayValue,
  isEditing,
  onStartEdit,
  onStopEdit,
  renderEditor,
}: ERPListColumnHeaderFilterProps) {
  return isEditing ? (
    <ERPListFilterableHeaderEdit onCollapse={onStopEdit}>
      {renderEditor ? (
        renderEditor({ autoFocus: true, onClose: onStopEdit })
      ) : (
        <ERPListHeaderFilterInput
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          ariaLabel={ariaLabel ?? `Filter ${label}`}
          autoFocus
        />
      )}
    </ERPListFilterableHeaderEdit>
  ) : (
    <ERPListFilterableHeaderLabel
      label={label}
      filterDisplay={displayValue ?? value}
      onClick={onStartEdit}
      theme={theme}
      align={align}
    />
  );
}
