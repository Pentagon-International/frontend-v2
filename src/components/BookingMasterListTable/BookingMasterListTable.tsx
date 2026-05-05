import { useMemo, useState, type ReactNode } from "react";
import {
  Box,
  Drawer,
  Flex,
  Group,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { IconArrowRight, IconPackage } from "@tabler/icons-react";
import dayjs from "dayjs";
import type { ErpListTheme } from "../ERPListPage";
import {
  BOOKING_EXPORT_MILESTONES,
  type BookingMilestoneRow,
  formatRouteMilestoneWhen,
  getBookingMilestoneStyleByIndex,
  getLastMilestoneDisplayLabel,
  getLastMilestoneIndex,
  getLastMilestoneStep,
  getLastMilestoneWhen,
  getMilestoneDrawerDetail,
  getRouteMilestonesActiveIndex,
  mapMilestoneCodeToIndex,
  milestonePhase,
  normalizeBookingStatus,
  rgbaFromHex,
} from "./bookingMasterListMilestone";

export type BookingMasterVisibleColumns = {
  sno: boolean;
  shipment: boolean;
  houseno: boolean;
  date: boolean;
  customer: boolean;
  route: boolean;
  status: boolean;
  mawb: boolean;
  flight: boolean;
  pieces: boolean;
  weight: boolean;
  handler: boolean;
  lastMilestone: boolean;
  service?: boolean;
};

export const DEFAULT_BOOKING_MASTER_VISIBLE_COLUMNS: BookingMasterVisibleColumns = {
  sno: true,
  shipment: true,
  houseno: true,
  date: true,
  customer: true,
  route: true,
  status: true,
  mawb: true,
  flight: true,
  pieces: true,
  weight: true,
  handler: true,
  lastMilestone: true,
};

export type BookingMasterTableRowModel<TRaw = unknown> = {
  raw: TRaw;
  id: number;
  sno: number;
  milestone: BookingMilestoneRow;
  shipment_code: string;
  enquiry_id?: string | null;
  houseno: string;
  date: string;
  customer_name: string;
  originCode: string;
  destCode: string;
  service?: string;
  status?: string;
  mawb: string;
  flight: string;
  pieces: number;
  weight: number;
  customer_service_name: string;
};

function initials(name: string | undefined | null): string {
  if (!name?.trim()) return "?";
  return name
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function firstName(name: string | undefined | null): string {
  if (!name?.trim()) return "—";
  return name.trim().split(/\s+/)[0] ?? "—";
}

function StatusPill({ status }: { status: string | undefined | null }) {
  const n = normalizeBookingStatus(status);
  const cfg =
    n === "BOOKED"
      ? { label: "Booked", dot: "#10b981", bg: "#ecfdf5", color: "#047857" }
      : n === "RECEIVED"
        ? { label: "Received", dot: "#3b82f6", bg: "#eff6ff", color: "#1d4ed8" }
        : n === "CANCEL"
          ? { label: "Cancelled", dot: "#ef4444", bg: "#fef2f2", color: "#b91c1c" }
          : { label: "Generated", dot: "#f59e0b", bg: "#fffbeb", color: "#b45309" };

  return (
    <Box
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "2px 10px",
        borderRadius: 9999,
        backgroundColor: cfg.bg,
        color: cfg.color,
        fontSize: 12,
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}
    >
      <Box
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          backgroundColor: cfg.dot,
          flexShrink: 0,
        }}
      />
      {cfg.label}
    </Box>
  );
}

function countVisibleDataColumns(
  v: BookingMasterVisibleColumns,
  showServiceColumn: boolean,
): number {
  let n = 0;
  if (v.sno) n++;
  if (v.shipment) n++;
  if (v.date) n++;
  if (v.customer) n++;
  if (v.route) n++;
  if (showServiceColumn && v.service) n++;
  if (v.status) n++;
  if (v.mawb) n++;
  if (v.flight) n++;
  if (v.pieces) n++;
  if (v.weight) n++;
  if (v.handler) n++;
  if (v.lastMilestone) n++;
  n++;
  return n;
}

export type BookingMasterListTableProps<TRaw> = {
  theme: ErpListTheme;
  geistRootClass: string;
  monoClass?: string;
  fontSans: string;
  rows: BookingMasterTableRowModel<TRaw>[];
  visibleColumns: BookingMasterVisibleColumns;
  showServiceColumn: boolean;
  renderActions: (row: TRaw) => ReactNode;
  emptyTitle?: string;
  emptySubtitle?: string;
};

export function BookingMasterListTable<TRaw>({
  theme,
  geistRootClass,
  monoClass,
  fontSans,
  rows,
  visibleColumns: v,
  showServiceColumn,
  renderActions,
  emptyTitle = "No bookings found",
  emptySubtitle = "Try adjusting your search or filters",
}: BookingMasterListTableProps<TRaw>) {
  const { border, muted, fg, primary, headerBg, cardBg } = theme;
  const [drawerModel, setDrawerModel] = useState<BookingMasterTableRowModel<TRaw> | null>(
    null,
  );

  const emptyColSpan = useMemo(
    () => countVisibleDataColumns(v, showServiceColumn),
    [v, showServiceColumn],
  );

  return (
    <>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 14,
          backgroundColor: cardBg,
          fontFamily: fontSans,
        }}
      >
        <thead>
          <tr>
            {v.sno && (
              <th
                style={{
                  padding: "10px 14px",
                  textAlign: "left",
                  fontWeight: 500,
                  fontSize: 14,
                  color: muted,
                  backgroundColor: headerBg,
                  borderBottom: `1px solid ${border}`,
                  whiteSpace: "nowrap",
                }}
              >
                S.No
              </th>
            )}
            {v.shipment && (
              <th
                style={{
                  padding: "10px 14px",
                  textAlign: "left",
                  fontWeight: 500,
                  fontSize: 14,
                  color: muted,
                  backgroundColor: headerBg,
                  borderBottom: `1px solid ${border}`,
                  whiteSpace: "nowrap",
                }}
              >
                Booking ID
              </th>
            )}
            {v.houseno && (
              <th
                style={{
                  padding: "10px 14px",
                  textAlign: "left",
                  fontWeight: 500,
                  fontSize: 14,
                  color: muted,
                  backgroundColor: headerBg,
                  borderBottom: `1px solid ${border}`,
                  whiteSpace: "nowrap",
                }}
              >
                House No
              </th>
            )}
            {v.date && (
              <th
                style={{
                  padding: "10px 14px",
                  textAlign: "left",
                  fontWeight: 500,
                  fontSize: 14,
                  color: muted,
                  backgroundColor: headerBg,
                  borderBottom: `1px solid ${border}`,
                  whiteSpace: "nowrap",
                }}
              >
                Date
              </th>
            )}
            {v.customer && (
              <th
                style={{
                  padding: "10px 14px",
                  textAlign: "left",
                  fontWeight: 500,
                  fontSize: 14,
                  color: muted,
                  backgroundColor: headerBg,
                  borderBottom: `1px solid ${border}`,
                  whiteSpace: "nowrap",
                }}
              >
                Customer
              </th>
            )}
            {v.route && (
              <th
                style={{
                  padding: "10px 14px",
                  textAlign: "left",
                  fontWeight: 500,
                  fontSize: 14,
                  color: muted,
                  backgroundColor: headerBg,
                  borderBottom: `1px solid ${border}`,
                  whiteSpace: "nowrap",
                }}
              >
                Route
              </th>
            )}
            {showServiceColumn && v.service && (
              <th
                style={{
                  padding: "10px 14px",
                  textAlign: "left",
                  fontWeight: 500,
                  fontSize: 14,
                  color: muted,
                  backgroundColor: headerBg,
                  borderBottom: `1px solid ${border}`,
                  whiteSpace: "nowrap",
                }}
              >
                Service
              </th>
            )}
            {v.status && (
              <th
                style={{
                  padding: "10px 14px",
                  textAlign: "left",
                  fontWeight: 500,
                  fontSize: 14,
                  color: muted,
                  backgroundColor: headerBg,
                  borderBottom: `1px solid ${border}`,
                  whiteSpace: "nowrap",
                }}
              >
                Status
              </th>
            )}
            {v.mawb && (
              <th
                style={{
                  padding: "10px 14px",
                  textAlign: "left",
                  fontWeight: 500,
                  fontSize: 14,
                  color: muted,
                  backgroundColor: headerBg,
                  borderBottom: `1px solid ${border}`,
                  whiteSpace: "nowrap",
                }}
              >
                MAWB
              </th>
            )}
            {v.flight && (
              <th
                style={{
                  padding: "10px 14px",
                  textAlign: "left",
                  fontWeight: 500,
                  fontSize: 14,
                  color: muted,
                  backgroundColor: headerBg,
                  borderBottom: `1px solid ${border}`,
                  whiteSpace: "nowrap",
                }}
              >
                Flight
              </th>
            )}
            {v.pieces && (
              <th
                style={{
                  padding: "10px 14px",
                  textAlign: "right",
                  fontWeight: 500,
                  fontSize: 14,
                  color: muted,
                  backgroundColor: headerBg,
                  borderBottom: `1px solid ${border}`,
                  whiteSpace: "nowrap",
                }}
              >
                Pcs
              </th>
            )}
            {v.weight && (
              <th
                style={{
                  padding: "10px 14px",
                  textAlign: "right",
                  fontWeight: 500,
                  fontSize: 14,
                  color: muted,
                  backgroundColor: headerBg,
                  borderBottom: `1px solid ${border}`,
                  whiteSpace: "nowrap",
                }}
              >
                Weight
              </th>
            )}
            {v.handler && (
              <th
                style={{
                  padding: "10px 14px",
                  textAlign: "left",
                  fontWeight: 500,
                  fontSize: 14,
                  color: muted,
                  backgroundColor: headerBg,
                  borderBottom: `1px solid ${border}`,
                  whiteSpace: "nowrap",
                }}
              >
                Customer Service
              </th>
            )}
            {v.lastMilestone && (
              <th
                style={{
                  padding: "10px 14px",
                  textAlign: "left",
                  fontWeight: 500,
                  fontSize: 14,
                  color: muted,
                  backgroundColor: headerBg,
                  borderBottom: `1px solid ${border}`,
                  whiteSpace: "nowrap",
                }}
              >
                Last Milestone
              </th>
            )}
            <th
              style={{
                width: 44,
                backgroundColor: headerBg,
                borderBottom: `1px solid ${border}`,
              }}
            />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={emptyColSpan} style={{ padding: 60, textAlign: "center" }}>
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
                    <Text fw={500} c={fg}>
                      {emptyTitle}
                    </Text>
                    <Text size="sm" c={muted} mt={4}>
                      {emptySubtitle}
                    </Text>
                  </Box>
                </Stack>
              </td>
            </tr>
          ) : (
            rows.map((booking) => {
              const lastMs = getLastMilestoneStep(booking.milestone);
              const LastMilestoneColIcon = lastMs.Icon;
              const lastMilestoneWhen = getLastMilestoneWhen(booking.milestone);
              return (
                <tr
                  key={booking.id}
                  style={{
                    borderBottom: `1px solid ${border}`,
                    transition: "background 0.12s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "#f8fafc";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "";
                  }}
                >
                  {v.sno && (
                    <td style={{ padding: "10px 14px" }}>
                      <Text fw={600} size="sm" c={fg}>
                        {booking.sno}
                      </Text>
                    </td>
                  )}
                  {v.shipment && (
                    <td style={{ padding: "10px 14px" }}>
                      <Text fw={600} size="sm" c={fg}>
                        {booking.shipment_code}
                      </Text>
                      {booking.enquiry_id ? (
                        <Text fz={10} c={muted}>
                          {booking.enquiry_id}
                        </Text>
                      ) : null}
                    </td>
                  )}
                  {v.houseno && (
                    <td style={{ padding: "10px 14px" }}>
                      <Text fw={600} size="sm" c={fg}>
                        {booking.houseno}
                      </Text>
                    </td>
                  )}
                  {v.date && (
                    <td style={{ padding: "10px 14px", color: muted }}>
                      {booking.date ? dayjs(booking.date).format("DD MMM") : "—"}
                    </td>
                  )}
                  {v.customer && (
                    <td style={{ padding: "10px 14px", maxWidth: 200 }}>
                      <Tooltip
                        label={booking.customer_name ?? ""}
                        withArrow
                        styles={{ tooltip: { fontFamily: fontSans, fontSize: 12 } }}
                      >
                        <Text size="sm" c={fg} lineClamp={1} style={{ cursor: "default" }}>
                          {booking.customer_name ?? "—"}
                        </Text>
                      </Tooltip>
                    </td>
                  )}
                  {v.route && (
                    <td style={{ padding: "10px 14px" }}>
                      <Group gap={6} wrap="nowrap">
                        <Text fw={600} size="sm" c={primary}>
                          {booking.originCode || "—"}
                        </Text>
                        <IconArrowRight size={12} color={muted} />
                        <Text fw={500} size="sm" c={fg}>
                          {booking.destCode || "—"}
                        </Text>
                      </Group>
                    </td>
                  )}
                  {showServiceColumn && v.service && (
                    <td style={{ padding: "10px 14px" }}>
                      <Text size="sm" c={fg}>
                        {booking.service?.trim() ? booking.service : "—"}
                      </Text>
                    </td>
                  )}
                  {v.status && (
                    <td style={{ padding: "10px 14px" }}>
                      <StatusPill status={booking.status} />
                    </td>
                  )}
                  {v.mawb && (
                    <td
                      className={monoClass}
                      style={{ padding: "10px 14px", fontSize: 12, color: muted }}
                    >
                      {booking.mawb ? (
                        <Text size="xs" fw={500} c={fg}>
                          {booking.mawb}
                        </Text>
                      ) : (
                        <Text size="sm" c={muted}>
                          —
                        </Text>
                      )}
                    </td>
                  )}
                  {v.flight && (
                    <td style={{ padding: "10px 14px" }}>
                      {booking.flight ? (
                        <Text size="xs" fw={500} c={fg}>
                          {booking.flight}
                        </Text>
                      ) : (
                        <Text size="sm" c={muted}>
                          —
                        </Text>
                      )}
                    </td>
                  )}
                  {v.pieces && (
                    <td
                      style={{
                        padding: "10px 14px",
                        textAlign: "right",
                        fontSize: 14,
                        color: muted,
                      }}
                    >
                      {booking.pieces}
                    </td>
                  )}
                  {v.weight && (
                    <td
                      style={{
                        padding: "10px 14px",
                        textAlign: "right",
                        fontSize: 14,
                        fontWeight: 500,
                        color: fg,
                      }}
                    >
                      {booking.weight.toFixed(1)}
                    </td>
                  )}
                  {v.handler && (
                    <td style={{ padding: "10px 14px" }}>
                      <Group gap={8} wrap="nowrap">
                        <Box
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: "50%",
                            backgroundColor: `${primary}1a`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <Text size={10} fw={600} c={primary}>
                            {initials(booking.customer_service_name)}
                          </Text>
                        </Box>
                        <Text size="xs" c={muted} lineClamp={1} maw={100}>
                          {firstName(booking.customer_service_name)}
                        </Text>
                      </Group>
                    </td>
                  )}
                  {v.lastMilestone && (
                    <td style={{ padding: "10px 14px", maxWidth: 260, verticalAlign: "top" }}>
                      <Box
                        component="button"
                        type="button"
                        onClick={() => setDrawerModel(booking)}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "22px minmax(0, 1fr)",
                          columnGap: 8,
                          rowGap: 4,
                          alignItems: "start",
                          justifyItems: "stretch",
                          width: "100%",
                          margin: 0,
                          padding: "4px 0",
                          fontFamily: fontSans,
                          cursor: "pointer",
                          textAlign: "left",
                          background: "transparent",
                          border: "none",
                          boxShadow: "none",
                          transition: "opacity 0.12s",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.opacity = "0.82";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.opacity = "1";
                        }}
                      >
                        <Box
                          style={{
                            gridColumn: 1,
                            gridRow: 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 22,
                            paddingTop: 2,
                          }}
                          aria-hidden
                        >
                          <LastMilestoneColIcon size={15} color={lastMs.accent} stroke={2} />
                        </Box>
                        <Text
                          component="span"
                          size="sm"
                          fw={600}
                          c={lastMs.accent}
                          lh={1.35}
                          style={{
                            gridColumn: 2,
                            gridRow: 1,
                            minWidth: 0,
                            textAlign: "left",
                          }}
                        >
                          {getLastMilestoneDisplayLabel(booking.milestone)}
                        </Text>
                        <Text
                          size="xs"
                          lh={1.35}
                          style={{
                            gridColumn: 2,
                            gridRow: 2,
                            minWidth: 0,
                            textAlign: "left",
                            color:
                              lastMilestoneWhen === "—"
                                ? muted
                                : rgbaFromHex(lastMs.accent, 0.92),
                            fontWeight: lastMilestoneWhen === "—" ? 400 : 500,
                          }}
                        >
                          {lastMilestoneWhen}
                        </Text>
                      </Box>
                    </td>
                  )}
                  <td style={{ padding: "10px 8px", textAlign: "center" }}>
                    {renderActions(booking.raw)}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      <Drawer
        opened={!!drawerModel}
        onClose={() => setDrawerModel(null)}
        position="right"
        size="md"
        title={
          drawerModel ? (
            <Stack gap={2}>
              <Text fw={700} size="md" c={fg}>
                {drawerModel.shipment_code}
              </Text>
              {drawerModel.enquiry_id ? (
                <Text size="xs" c="dimmed">
                  {drawerModel.enquiry_id}
                </Text>
              ) : null}
            </Stack>
          ) : null
        }
        classNames={{
          content: geistRootClass,
          body: geistRootClass,
          header: geistRootClass,
        }}
        styles={{
          content: { fontFamily: fontSans },
          body: { fontFamily: fontSans },
          header: { fontFamily: fontSans },
        }}
      >
        {drawerModel ? (
          <BookingMilestoneDrawerBody row={drawerModel.milestone} theme={theme} fontSans={fontSans} />
        ) : null}
      </Drawer>
    </>
  );
}

type BookingMilestoneStepRowProps = {
  step: (typeof BOOKING_EXPORT_MILESTONES)[number];
  displayLabel: string;
  detail: string;
  when: string;
  i: number;
  total: number;
  activeIdx: number;
  fg: string;
  muted: string;
  primary: string;
  border: string;
  pageBg: string;
  currentStageNote: string;
};

/** One timeline row: shared for API `route_milestones` and legacy heuristics. */
function BookingMilestoneStepRow({
  step,
  displayLabel,
  detail,
  when,
  i,
  total,
  activeIdx,
  fg,
  muted,
  primary,
  border,
  pageBg,
  currentStageNote,
}: BookingMilestoneStepRowProps) {
  const phase = milestonePhase(i, activeIdx);
  const NodeIcon = step.Icon;
  const iconSize = phase === "current" ? 18 : 16;

  const connector =
    i < total - 1 ? (
      i < activeIdx ? (
        <Box
          style={{
            width: 2,
            height: 32,
            marginTop: 4,
            backgroundColor: rgbaFromHex(step.accent, 0.55),
            borderRadius: 1,
          }}
        />
      ) : i === activeIdx ? (
        <Box
          style={{
            width: 2,
            height: 32,
            marginTop: 4,
            borderRadius: 1,
            background: `repeating-linear-gradient(to bottom, ${primary} 0, ${primary} 5px, transparent 5px, transparent 9px)`,
          }}
        />
      ) : (
        <Box
          style={{
            width: 2,
            height: 32,
            marginTop: 4,
            backgroundColor: "#e2e8f0",
            borderRadius: 1,
          }}
        />
      )
    ) : null;

  const phaseLabel = phase === "completed" ? "Done" : phase === "current" ? "Active" : "Pending";

  return (
    <Group align="flex-start" wrap="nowrap" gap="md">
      <Flex direction="column" align="center" style={{ width: 40, flexShrink: 0 }}>
        <Box mt={2}>
          {phase === "completed" ? (
            <Box
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                backgroundColor: rgbaFromHex(step.accent, 0.15),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: `2px solid ${rgbaFromHex(step.accent, 0.45)}`,
              }}
            >
              <NodeIcon size={iconSize} color={step.accent} stroke={2} />
            </Box>
          ) : phase === "current" ? (
            <Box
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                border: `3px solid ${step.accent}`,
                backgroundColor: step.soft,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `0 0 0 4px ${rgbaFromHex(step.accent, 0.14)}`,
              }}
            >
              <NodeIcon size={iconSize} color={step.accent} stroke={2} />
            </Box>
          ) : (
            <Box
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                border: "2px dashed #cbd5e1",
                backgroundColor: "#f8fafc",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <NodeIcon size={iconSize} color="#94a3b8" stroke={1.75} />
            </Box>
          )}
        </Box>
        {connector}
      </Flex>
      <Stack
        gap={6}
        pb="md"
        style={{
          flex: 1,
          minWidth: 0,
          padding: phase === "upcoming" ? "4px 0 12px 0" : "10px 12px 12px 12px",
          borderRadius: 10,
          ...(phase === "completed"
            ? {
                backgroundColor: rgbaFromHex(step.accent, 0.07),
                borderLeft: `3px solid ${step.accent}`,
              }
            : {}),
          ...(phase === "current"
            ? {
                backgroundColor: step.soft,
                border: `1px solid ${rgbaFromHex(step.accent, 0.35)}`,
                boxShadow: `0 0 0 3px ${rgbaFromHex(step.accent, 0.1)}`,
              }
            : {}),
        }}
      >
        <Group justify="space-between" gap="xs" wrap="nowrap" align="flex-start">
          <Group gap={8} wrap="nowrap" align="center">
            <Text
              fw={phase === "current" ? 700 : phase === "completed" ? 600 : 500}
              size="sm"
              c={phase === "upcoming" ? muted : fg}
              lh={1.3}
            >
              {displayLabel}
            </Text>
            <Text
              size="xs"
              fw={600}
              style={{
                flexShrink: 0,
                padding: "2px 8px",
                borderRadius: 9999,
                fontSize: 10,
                letterSpacing: "0.02em",
                backgroundColor:
                  phase === "completed"
                    ? rgbaFromHex(step.accent, 0.14)
                    : phase === "current"
                      ? rgbaFromHex(step.accent, 0.22)
                      : "#f1f5f9",
                color: phase === "upcoming" ? muted : step.accent,
              }}
            >
              {phaseLabel}
            </Text>
          </Group>
          <Text
            size="xs"
            c={phase === "current" ? step.accent : muted}
            ta="right"
            style={{ flexShrink: 0 }}
            fw={phase === "current" ? 600 : 400}
          >
            {when}
          </Text>
        </Group>
        <Text size="xs" c="dimmed" lh={1.4}>
          {detail}
        </Text>
        {phase === "current" ? (
          <Box
            mt={2}
            p="sm"
            style={{
              backgroundColor: pageBg,
              borderRadius: 8,
              border: `1px solid ${border}`,
            }}
          >
            <Text size="xs" c={muted}>
              {currentStageNote}
            </Text>
          </Box>
        ) : null}
      </Stack>
    </Group>
  );
}

function BookingMilestoneDrawerBody({
  row,
  theme,
  fontSans: _fontSans,
}: {
  row: BookingMilestoneRow;
  theme: ErpListTheme;
  fontSans: string;
}) {
  const { fg, muted, primary, border } = theme;
  const pageBg = theme.pageBg;

  const api = row.route_milestones;
  if (api && api.length > 0) {
    const activeIdx = getRouteMilestonesActiveIndex(api, row);
    return (
      <Stack gap="md">
        <Text fw={600} size="sm" c={fg}>
          Route milestones
        </Text>
        <Stack gap={0}>
          {api.map((rm, i) => {
            const step = getBookingMilestoneStyleByIndex(mapMilestoneCodeToIndex(rm.code));
            const when = formatRouteMilestoneWhen(rm);
            const note = String(rm.note ?? "").trim();
            return (
              <BookingMilestoneStepRow
                key={`${String(rm.code)}-${i}`}
                step={step}
                displayLabel={rm.label}
                detail={note || "—"}
                when={when}
                i={i}
                total={api.length}
                activeIdx={activeIdx}
                fg={fg}
                muted={muted}
                primary={primary}
                border={border}
                pageBg={pageBg}
                currentStageNote=""
              />
            );
          })}
        </Stack>
      </Stack>
    );
  }

  const activeIdx = getLastMilestoneIndex(row);

  return (
    <Stack gap="md">
      <Text fw={600} size="sm" c={fg}>
        Route milestones
      </Text>
      <Stack gap={0}>
        {BOOKING_EXPORT_MILESTONES.map((step, i) => {
          const { detail, when } = getMilestoneDrawerDetail(row, i);
          return (
            <BookingMilestoneStepRow
              key={step.label}
              step={step}
              displayLabel={step.label}
              detail={detail}
              when={when}
              i={i}
              total={BOOKING_EXPORT_MILESTONES.length}
              activeIdx={activeIdx}
              fg={fg}
              muted={muted}
              primary={primary}
              border={border}
              pageBg={pageBg}
              currentStageNote=""
            />
          );
        })}
      </Stack>
    </Stack>
  );
}
