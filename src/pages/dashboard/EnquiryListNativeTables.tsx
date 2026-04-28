import { Badge, Box, Group, Stack, Text, Tooltip } from "@mantine/core";
import type { ReactNode } from "react";
import dayjs from "dayjs";
import { IconArrowRight, IconFileText, IconPackage } from "@tabler/icons-react";
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
  services?: Array<{ service?: string; trade?: string; service_remark?: string }>;
  origin_code_list?: string[];
  destination_code_list?: string[];
  reference_no?: string;
  enquiry_received_date?: string;
  status?: string;
};

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
  return (
    <Stack gap={2}>
      {unique.map((p, i) => (
        <Text key={i} size="sm" c={fg} style={{ fontFamily: fontSans, lineHeight: 1.4 }}>
          {p}
        </Text>
      ))}
    </Stack>
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
  return (
    <Stack gap={2}>
      {unique.map((r, i) => (
        <Text key={i} size="sm" c={fg} style={{ fontFamily: fontSans, lineHeight: 1.4 }}>
          {r}
        </Text>
      ))}
    </Stack>
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

  return (
    <table style={erpListTableElementStyle(theme)}>
      <thead>
        <tr>
          {visible.sno && <th style={erpListThStyle(theme)}>S.No</th>}
          {visible.enquiry_id && <th style={{ ...erpListThStyle(theme), minWidth: 200 }}>Enquiry ID</th>}
          {visible.customer_name && <th style={{ ...erpListThStyle(theme), minWidth: 200 }}>Customer</th>}
          {visible.sales_person && <th style={erpListThStyle(theme)}>Sales Person</th>}
          {visible.service && <th style={erpListThStyle(theme)}>Service</th>}
          {visible.route && <th style={erpListThStyle(theme)}>Route</th>}
          {visible.reference_no && <th style={erpListThStyle(theme)}>Reference No</th>}
          {visible.date && <th style={erpListThStyle(theme)}>Enquiry Date</th>}
          {visible.status && (
            <th style={{ ...erpListThStyle(theme), whiteSpace: "nowrap", minWidth: 140 }}>
              Status
            </th>
          )}
          {visible.remark && <th style={erpListThStyle(theme)}>Remark</th>}
          <th style={erpListThActionsSpacer(theme, 44)} />
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
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
                    <Text fw={600} size="sm" c={fg} style={{ fontFamily: fontSans }}>
                      {row.sno != null ? String(row.sno) : "—"}
                    </Text>
                  </td>
                )}
                {visible.enquiry_id && (
                  <td style={erpListTdPaddingStyle()}>
                    <Text fw={600} size="sm" c={fg} style={{ fontFamily: fontSans }}>
                      {row.enquiry_id || "—"}
                    </Text>
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
                      {row.sales_person || "—"}
                    </Text>
                  </td>
                )}
                {visible.service && (
                  <td style={erpListTdPaddingStyle()}>{renderServiceCell(row.services, fg, fontSans)}</td>
                )}
                {visible.route && (
                  <td style={erpListTdPaddingStyle()}>
                    {erpListRouteListCell(
                      row.origin_code_list,
                      row.destination_code_list,
                      { primary, fg, muted, fontSans },
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
                {visible.date && (
                  <td style={{ ...erpListTdPaddingStyle(), color: muted }}>
                    <Text size="sm" style={{ fontFamily: fontSans }}>
                      {row.enquiry_received_date
                        ? dayjs(row.enquiry_received_date).format(dateFormat)
                        : "—"}
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
};

/**
 * Detailed (preview) list: same table chrome as {@link AirExportBookingMaster} — no sticky columns, `10px 14px` cells, `Text` for values.
 */
export function EnquiryPreviewNativeTable({ theme, columns, data, dateFormat, getStatusBadge }: PreviewTableProps) {
  const { fg, fontSans, muted, primary } = theme;
  return (
    <Box style={{ overflow: "auto" }}>
      <table style={erpListTableElementStyle(theme)}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.id}
                style={{
                  ...erpListThStyle(theme),
                  minWidth: col.kind === "sno" ? 70 : 160,
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
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
                  <td key={`${ri}-${col.id}`} style={erpListTdPaddingStyle()}>
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
      <Text fw={600} size="sm" c={fg} style={{ fontFamily: fontSans }}>
        {row.sno != null ? String(row.sno) : "—"}
      </Text>
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
    if (!serviceValue) {
      return (
        <Text size="sm" c={fg} style={{ fontFamily: fontSans }}>
          {tradeValue}
        </Text>
      );
    }
    if (!tradeValue) {
      return (
        <Text size="sm" c={fg} style={{ fontFamily: fontSans }}>
          {serviceValue}
        </Text>
      );
    }
    return (
      <Text size="sm" c={fg} style={{ fontFamily: fontSans }}>
        {`${serviceValue} - ${tradeValue}`}
      </Text>
    );
  }
  if (col.kind === "enquiryDate") {
    const d = row.enquiry_date;
    return (
      <Text size="sm" c={muted} style={{ fontFamily: fontSans }}>
        {d ? dayjs(String(d)).format(dateFormat) : "—"}
      </Text>
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
    return (
      <Group gap={6} wrap="nowrap" align="center">
        <Text fw={600} size="sm" c={primary} style={{ fontFamily: fontSans }}>
          {oc}
        </Text>
        <IconArrowRight size={12} color={muted} style={{ flexShrink: 0 }} />
        <Text fw={500} size="sm" c={fg} style={{ fontFamily: fontSans }}>
          {dc}
        </Text>
      </Group>
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
  return (
    <Text size="sm" c={fg} style={{ fontFamily: fontSans }}>
      {String(v)}
    </Text>
  );
}
