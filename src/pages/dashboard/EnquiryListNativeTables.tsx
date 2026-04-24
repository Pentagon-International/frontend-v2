import { Badge, Box, Text } from "@mantine/core";
import type { ReactNode } from "react";
import dayjs from "dayjs";
import type { ErpListTheme } from "../../components/ERPListPage/erpListTheme";
import { EnquirySummaryRowMenu, type EnquiryRowMenuContext } from "./EnquirySummaryRowMenu";
import type { PreviewColDef } from "./EnquiryListPreviewBuild";

export type EnquirySummaryVisibleColumns = {
  sno: boolean;
  enquiry_id: boolean;
  customer_name: boolean;
  sales_person: boolean;
  service: boolean;
  origin: boolean;
  destination: boolean;
  reference_no: boolean;
  date: boolean;
  status: boolean;
  remark: boolean;
};

const thStyle = (theme: ErpListTheme): React.CSSProperties => ({
  padding: "10px 14px",
  textAlign: "left",
  fontWeight: 500,
  fontSize: 14,
  color: theme.muted,
  backgroundColor: theme.headerBg,
  borderBottom: `1px solid ${theme.border}`,
  whiteSpace: "nowrap",
});

const tdStyle = (theme: ErpListTheme): React.CSSProperties => ({
  padding: "10px 14px",
  fontSize: 14,
  color: theme.fg,
  fontFamily: theme.fontSans,
  borderBottom: `1px solid ${theme.border}`,
  verticalAlign: "top",
});

type SummaryRow = Record<string, unknown> & {
  sno?: number;
  enquiry_id?: string;
  customer_name?: string;
  sales_person?: string;
  services?: Array<{ service?: string; trade?: string; service_remark?: string }>;
  origin_list?: string[];
  destination_list?: string[];
  reference_no?: string;
  enquiry_received_date?: string;
  status?: string;
};

function renderServiceCell(services: unknown): ReactNode {
  const list = services as Array<{ service?: string; trade?: string }> | undefined;
  if (!list || !Array.isArray(list) || list.length === 0) return "—";
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
  if (unique.length === 0) return "—";
  return (
    <div style={{ lineHeight: 1.4 }}>
      {unique.map((p, i) => (
        <div key={i}>{p}</div>
      ))}
    </div>
  );
}

function renderStringListCell(list: unknown): ReactNode {
  const arr = list as string[] | undefined;
  if (!arr || !Array.isArray(arr) || arr.length === 0) return "—";
  return (
    <div style={{ lineHeight: 1.4 }}>
      {arr.map((item, i) => (
        <div key={i}>{item}</div>
      ))}
    </div>
  );
}

function renderRemarkCell(services: unknown): ReactNode {
  const list = services as Array<{ service_remark?: string }> | undefined;
  if (!list || !Array.isArray(list) || list.length === 0) return "—";
  const remarks = list.map((s) => s.service_remark).filter((r) => r);
  const unique = [...new Set(remarks as string[])];
  if (unique.length === 0) return "—";
  return (
    <div style={{ lineHeight: 1.4 }}>
      {unique.map((r, i) => (
        <div key={i}>{r}</div>
      ))}
    </div>
  );
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
};

function rowKey(r: SummaryRow, index: number) {
  return (r.id as number | undefined) ?? (r.enquiry_id as string | undefined) ?? `row-${index}`;
}

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
}: SummaryTableProps) {
  const { border, headerBg, cardBg, fontSans, muted } = theme;
  const visibleCount =
    (visible.sno ? 1 : 0) +
    (visible.enquiry_id ? 1 : 0) +
    (visible.customer_name ? 1 : 0) +
    (visible.sales_person ? 1 : 0) +
    (visible.service ? 1 : 0) +
    (visible.origin ? 1 : 0) +
    (visible.destination ? 1 : 0) +
    (visible.reference_no ? 1 : 0) +
    (visible.date ? 1 : 0) +
    (visible.status ? 1 : 0) +
    (visible.remark ? 1 : 0) +
    1;
  const stickyAction: React.CSSProperties = {
    position: "sticky",
    right: 0,
    zIndex: 2,
    backgroundColor: cardBg,
    boxShadow: "-4px 0 8px rgba(15, 23, 42, 0.06)",
    borderLeft: `1px solid ${border}`,
    minWidth: 48,
  };
  const stickyTh: React.CSSProperties = {
    ...thStyle(theme),
    ...stickyAction,
    backgroundColor: headerBg,
  };

  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "separate",
        borderSpacing: 0,
        fontSize: 14,
        backgroundColor: cardBg,
        fontFamily: fontSans,
      }}
    >
      <thead>
        <tr>
          {visible.sno && <th style={thStyle(theme)}>S.No</th>}
          {visible.enquiry_id && <th style={{ ...thStyle(theme), minWidth: 200 }}>Enquiry ID</th>}
          {visible.customer_name && <th style={{ ...thStyle(theme), minWidth: 200 }}>Customer</th>}
          {visible.sales_person && <th style={thStyle(theme)}>Sales Person</th>}
          {visible.service && <th style={thStyle(theme)}>Service</th>}
          {visible.origin && <th style={thStyle(theme)}>Origin</th>}
          {visible.destination && <th style={thStyle(theme)}>Destination</th>}
          {visible.reference_no && <th style={thStyle(theme)}>Reference No</th>}
          {visible.date && <th style={thStyle(theme)}>Enquiry Date</th>}
          {visible.status && <th style={thStyle(theme)}>Status</th>}
          {visible.remark && <th style={thStyle(theme)}>Remark</th>}
          <th style={stickyTh}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td
              colSpan={visibleCount}
              style={{ ...tdStyle(theme), textAlign: "center", padding: 48, color: muted }}
            >
              No enquiries to display
            </td>
          </tr>
        ) : (
          rows.map((row, index) => {
            const k = rowKey(row, index);
            const { label, color } = getStatusBadge(String(row.status ?? ""));
            return (
              <tr key={String(k)}>
                {visible.sno && <td style={tdStyle(theme)}>{row.sno != null ? String(row.sno) : "—"}</td>}
                {visible.enquiry_id && <td style={{ ...tdStyle(theme), minWidth: 200 }}>{row.enquiry_id || "—"}</td>}
                {visible.customer_name && (
                  <td style={{ ...tdStyle(theme), minWidth: 200 }}>{row.customer_name || "—"}</td>
                )}
                {visible.sales_person && <td style={tdStyle(theme)}>{row.sales_person || "—"}</td>}
                {visible.service && <td style={tdStyle(theme)}>{renderServiceCell(row.services)}</td>}
                {visible.origin && <td style={tdStyle(theme)}>{renderStringListCell(row.origin_list)}</td>}
                {visible.destination && (
                  <td style={tdStyle(theme)}>{renderStringListCell(row.destination_list)}</td>
                )}
                {visible.reference_no && <td style={tdStyle(theme)}>{row.reference_no || "—"}</td>}
                {visible.date && (
                  <td style={tdStyle(theme)}>
                    {row.enquiry_received_date
                      ? dayjs(row.enquiry_received_date).format(dateFormat)
                      : "—"}
                  </td>
                )}
                {visible.status && (
                  <td style={tdStyle(theme)}>
                    <Badge
                      size="sm"
                      variant="light"
                      color={color}
                      styles={{
                        root: {
                          textTransform: "none",
                          minWidth: "fit-content",
                          whiteSpace: "nowrap",
                        },
                      }}
                    >
                      {label}
                    </Badge>
                  </td>
                )}
                {visible.remark && <td style={tdStyle(theme)}>{renderRemarkCell(row.services)}</td>}
                <td style={{ ...tdStyle(theme), ...stickyAction }}>
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
  stickySnoColumn?: boolean;
};

export function EnquiryPreviewNativeTable({
  theme,
  columns,
  data,
  dateFormat,
  getStatusBadge,
  stickySnoColumn = true,
}: PreviewTableProps) {
  const { cardBg, fontSans, muted } = theme;
  return (
    <Box style={{ overflow: "auto", maxHeight: "min(70vh, 900px)" }}>
      <table
        style={{
          width: "100%",
          minWidth: 800,
          borderCollapse: "separate",
          borderSpacing: 0,
          fontSize: 14,
          backgroundColor: cardBg,
          fontFamily: fontSans,
        }}
      >
        <thead>
          <tr>
            {columns.map((col, idx) => {
              const isSno = col.kind === "sno" && idx === 0;
              return (
                <th
                  key={col.id}
                  style={{
                    ...thStyle(theme),
                    position: stickySnoColumn && isSno ? "sticky" : undefined,
                    left: stickySnoColumn && isSno ? 0 : undefined,
                    zIndex: stickySnoColumn && isSno ? 3 : undefined,
                    minWidth: col.kind === "sno" ? 56 : 160,
                  }}
                >
                  {col.header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={Math.max(1, columns.length)} style={{ ...tdStyle(theme), textAlign: "center", padding: 40, color: muted }}>
                No data
              </td>
            </tr>
          ) : (
            data.map((row, ri) => (
              <tr key={ri}>
                {columns.map((col, cidx) => {
                  const isSno = col.kind === "sno" && cidx === 0;
                  return (
                    <td
                      key={`${ri}-${col.id}`}
                      style={{
                        ...tdStyle(theme),
                        position: stickySnoColumn && isSno ? "sticky" : undefined,
                        left: stickySnoColumn && isSno ? 0 : undefined,
                        zIndex: stickySnoColumn && isSno ? 1 : undefined,
                        backgroundColor: stickySnoColumn && isSno ? cardBg : undefined,
                        boxShadow: stickySnoColumn && isSno ? "2px 0 6px rgba(15,23,42,0.06)" : undefined,
                      }}
                    >
                      {renderPreviewCell({
                        col,
                        row: row as Record<string, string | number | null | undefined>,
                        dateFormat,
                        getStatusBadge,
                      })}
                    </td>
                  );
                })}
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
}: {
  col: PreviewColDef;
  row: Record<string, string | number | null | undefined>;
  dateFormat: string;
  getStatusBadge: (s: string | undefined | null) => { label: string; color: string };
}): ReactNode {
  if (col.kind === "sno") {
    return row.sno != null ? String(row.sno) : "—";
  }
  if (col.kind === "service") {
    const serviceValue = String(row.service ?? "");
    const tradeValue = String(row.trade ?? "");
    if (!serviceValue && !tradeValue) return "—";
    if (!serviceValue) return tradeValue;
    if (!tradeValue) return serviceValue;
    return `${serviceValue} - ${tradeValue}`;
  }
  if (col.kind === "enquiryDate") {
    const d = row.enquiry_date;
    return d ? dayjs(String(d)).format(dateFormat) : "—";
  }
  if (col.kind === "status") {
    const v = row[col.key as keyof typeof row];
    const { label, color } = getStatusBadge(String(v ?? ""));
    return (
      <Badge size="sm" color={color}>
        {label}
      </Badge>
    );
  }
  const v = row[col.key as keyof typeof row];
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}
