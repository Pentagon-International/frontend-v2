import type { ReactNode } from "react";
import { Box } from "@mantine/core";
import { ERPListFilterPanel } from "./ERPListFilterPanel";
import type { ERPListFilterPanelProps } from "./ERPListFilterPanel";
import { ERPListPageRoot } from "./ERPListPageRoot";
import { ERPListTableCard } from "./ERPListTableCard";
import type { ERPListTableCardProps } from "./ERPListTableCard";
import { ERPListToolbar } from "./ERPListToolbar";
import type { ERPListToolbarProps } from "./ERPListToolbar";
import type { ErpListTheme } from "./erpListTheme";
import { DEFAULT_ERP_LIST_THEME } from "./erpListTheme";

/** Sub-header strip: KPIs / title (leading), metrics (secondary), search & actions (trailing). */
export type ERPListScreenToolbarConfig = Pick<
  ERPListToolbarProps,
  "leading" | "secondary" | "actions"
>;

/** Collapsible advanced filters; only mounted when `opened` is true. */
export type ERPListScreenFiltersConfig = { opened: boolean } & Omit<
  ERPListFilterPanelProps,
  "theme"
>;

/** White table surface: scroll region + optional bulk bar + footer (e.g. pagination). */
export type ERPListScreenTableConfig = {
  selectionBar?: ReactNode;
  footer?: ReactNode;
  mainPy?: ERPListTableCardProps["mainPy"];
  children: ReactNode;
};

export interface ERPListScreenProps {
  theme?: ErpListTheme;
  /**
   * `page` — full list route (bleed, `100vh` column background; default).
   * `embedded` — dashboard / inset panels: no full-bleed, no `minHeight: 100vh`, no outer horizontal padding on table.
   */
  layout?: "page" | "embedded";
  /** Passed to the outer wrapper (`ERPListPageRoot` or `embedded` column). */
  className?: string;
  toolbar: ERPListScreenToolbarConfig;
  /**
   * Filter sheet. Pass `opened: false` to hide, or omit `filters` entirely.
   * When `opened` is true, `children` should be the filter field grid.
   */
  filters?: ERPListScreenFiltersConfig | null;
  table: ERPListScreenTableConfig;
}

/**
 * **Global list screen shell** (Air Export Booking reference layout):
 * full-bleed toolbar → optional filter panel → table card.
 *
 * **Companion primitives** (same folder / barrel) for parity with that screen:
 * - `ERPListStatPill`, `ERPListToolbar`, `ERPListFilterPanel`, `ERPListTableCard`
 * - `ERPListPaginationFooter` — range + rows select + page controls
 * - `ERPListFilterActionsFooter` — Clear + Apply for filter sheets
 * - `ERPListBulkSelectionBar` — selected count + action slot
 * - `ERPListTableLoading` — centered loader in the table body
 * - `ERPListTableEmpty` — icon + title + hint (Air Export “no data” block)
 * - `ERPListColumnToggleMenu` — column visibility menu
 * - `erpToolbarOutlineButtonStyles`, `erpToolbarPrimaryButtonStyles`, `erpToolbarSelectStyles`, …
 */
export function ERPListScreen({
  theme = DEFAULT_ERP_LIST_THEME,
  layout = "page",
  className,
  toolbar,
  filters,
  table,
}: ERPListScreenProps) {
  const showFilters = Boolean(filters?.opened);
  const embedded = layout === "embedded";
  const bleed = !embedded;

  const content = (
    <>
      <ERPListToolbar
        theme={theme}
        leading={toolbar.leading}
        secondary={toolbar.secondary}
        actions={toolbar.actions}
        bleed={bleed}
      />
      {showFilters && filters ? (
        <ERPListFilterPanel
          theme={theme}
          title={filters.title}
          subtitle={filters.subtitle}
          headerIcon={filters.headerIcon}
          onClose={filters.onClose}
          closeLabel={filters.closeLabel}
          footer={filters.footer}
        >
          {filters.children}
        </ERPListFilterPanel>
      ) : null}
      <ERPListTableCard
        theme={theme}
        selectionBar={table.selectionBar}
        footer={table.footer}
        mainPy={table.mainPy ?? (embedded ? "xs" : "md")}
        flush={embedded}
      >
        {table.children}
      </ERPListTableCard>
    </>
  );

  if (embedded) {
    return (
      <Box
        className={className}
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {content}
      </Box>
    );
  }

  return <ERPListPageRoot theme={theme} className={className}>{content}</ERPListPageRoot>;
}
