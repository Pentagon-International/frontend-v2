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

/** Enquiry tables: wider ID & Service (single-line clamp); Reference No uses shared widths below. */
const ENQUIRY_COL_ID_MIN = 230;
const ENQUIRY_COL_SERVICE_MIN = 110;
const ENQUIRY_COL_SALES_PERSON_MIN = 128;
const ENQUIRY_COL_REFERENCE_TH_MIN = 92;
const ENQUIRY_COL_REFERENCE_TD_MAX = 126;
const ENQUIRY_COL_REFERENCE_TABLE_WIDTH = "9%";
/** Detailed list Route: min width + nowrap so origin → dest stays on one line; full value in tooltip. */
const ENQUIRY_COL_ROUTE_DETAILED_MIN = 330;
/** Summary list Route: room for code pairs on one line; names in tooltip. */
const ENQUIRY_COL_ROUTE_SUMMARY_MIN = 170;
/** Route column tooltips (summary + detailed) — max width of the floating label. */
const ENQUIRY_ROUTE_TOOLTIP_MAX_WIDTH = 300;
/** Summary list: avoid `lineClamp` ellipsis when many columns squeeze auto table layout (DD-MM-YYYY + padding). */
const ENQUIRY_SUMMARY_DATE_COL_MIN = 120;

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
          {visible.enquiry_id && (
            <th style={{ ...erpListThStyle(theme), minWidth: ENQUIRY_COL_ID_MIN }}>Enquiry ID</th>
          )}
          {visible.customer_name && <th style={{ ...erpListThStyle(theme), minWidth: 200 }}>Customer</th>}
          {visible.sales_person && <th style={erpListThStyle(theme)}>Sales Person</th>}
          {visible.service && (
            <th style={{ ...erpListThStyle(theme), minWidth: ENQUIRY_COL_SERVICE_MIN }}>Service</th>
          )}
          {visible.route && (
            <th
              style={{
                ...erpListThStyle(theme),
                whiteSpace: "nowrap",
                minWidth: ENQUIRY_COL_ROUTE_SUMMARY_MIN,
              }}
            >
              Route
            </th>
          )}
          {visible.status && (
            <th style={{ ...erpListThStyle(theme), whiteSpace: "nowrap", minWidth: 140 }}>
              Status
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
              Reference No
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
};

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
                  minWidth: previewColumnThMinWidth(col),
                  ...(col.key === "reference_no"
                    ? { maxWidth: ENQUIRY_COL_REFERENCE_TD_MAX, width: ENQUIRY_COL_REFERENCE_TABLE_WIDTH }
                    : {}),
                  ...(col.kind === "route" ? { whiteSpace: "nowrap" as const } : {}),
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
