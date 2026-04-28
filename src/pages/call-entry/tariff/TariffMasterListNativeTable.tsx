import type { ReactNode } from "react";
import { Box, Stack, Text } from "@mantine/core";
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

export type TariffListColumn<TRow> = {
  id: string;
  header: string;
  align?: "left" | "right" | "center";
  /** Matches {@link AirExportBookingMaster} body cell emphasis (date vs key vs number). */
  cellTone?: ErpListBodyCellTone;
  cellMaxWidth?: number;
  cell: (row: TRow, rowIndex: number) => ReactNode;
};

export type { ErpListBodyCellTone } from "../../../components/ERPListPage/erpListTableStyles";

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
}: TariffMasterListNativeTableProps<TRow>) {
  const { muted, fg, fontSans } = theme;
  const colCount = 1 + columns.length + 1;
  const actionColStyle = {
    ...erpListStickyActionTdStyle(theme),
    textAlign: "center" as const,
  };

  return (
    <table style={erpListTableElementStyle(theme)}>
      <thead>
        <tr>
          <th style={erpListThStyle(theme, { textAlign: "left" })}>S.No</th>
          {columns.map((col) => (
            <th
              key={col.id}
              style={erpListThStyle(theme, {
                textAlign:
                  col.align === "right"
                    ? "right"
                    : col.align === "center"
                      ? "center"
                      : "left",
              })}
            >
              {col.header}
            </th>
          ))}
          <th style={erpListStickyActionThStyle(theme, 80)} aria-label="Actions" />
        </tr>
      </thead>
      <tbody>
        {isEmpty || rows.length === 0 ? (
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
