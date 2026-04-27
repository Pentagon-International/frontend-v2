import type { RefObject } from "react";
import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Box,
  Group,
  Menu,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import {
  IconBook,
  IconDotsVertical,
  IconEdit,
  IconExternalLink,
  IconEye,
  IconFileText,
} from "@tabler/icons-react";
import type { Location } from "react-router-dom";
import dayjs from "dayjs";
import type { ErpListTheme } from "../../components/ERPListPage/erpListTheme";
import { ERP_LIST_GEIST_ROOT_CLASS } from "../../components/ERPListPage/erpListGeistShell";
import {
  erpListDataRowProps,
  erpListRouteListCell,
  erpListRowActionMenuTdStyle,
  erpListTableElementStyle,
  erpListTdPaddingStyle,
  erpListThActionsSpacer,
  erpListThStyle,
} from "../../components";

/** Row shape used by quotation list (aligned with QuotationMaster `QuotationData`). */
export type QuotationTableRow = {
  id: number;
  sno?: number;
  enquiry_id?: string;
  customer_name?: string;
  sales_person?: string;
  reference_no?: string;
  origin_code_list?: string[];
  destination_code_list?: string[];
  valid_upto_list?: string[];
  reject_remark?: string;
  status?: string;
  quotation?: Array<{
    created_at?: string;
    revision?: number;
    quotation_service_id?: number;
  }>;
};

export type QuotationVisibleColumns = {
  sno: boolean;
  enquiry_id: boolean;
  customer_name: boolean;
  sales_person: boolean;
  created_at: boolean;
  /** One column: origin → destination (same as Air Export Booking “Route”). */
  route: boolean;
  reference_no: boolean;
  valid_upto_list: boolean;
  revision: boolean;
  reject_remark: boolean;
  status: boolean;
};

export type QuotationRowMenuContext = {
  location: Location;
  isApprovalMode: boolean;
  returnToDashboardRef: RefObject<boolean | undefined>;
  primaryActionLabel: string;
  /** Tabler icon component (e.g. IconEdit, IconExternalLink). */
  PrimaryActionIcon: typeof IconEdit | typeof IconExternalLink;
  showQuotationPreview: (row: QuotationTableRow) => void;
  handlePrimaryAction: (row: QuotationTableRow) => void;
  canCreateBookingFromRow: (row: QuotationTableRow) => boolean;
  handleCreateBookingFromRow: (row: QuotationTableRow) => void;
};

function QuotationRowMenu({
  row,
  ctx,
}: {
  row: QuotationTableRow;
  ctx: QuotationRowMenuContext;
}) {
  const [menuOpened, setMenuOpened] = useState(false);
  const {
    isApprovalMode,
    primaryActionLabel,
    PrimaryActionIcon,
    showQuotationPreview,
    handlePrimaryAction,
    canCreateBookingFromRow,
    handleCreateBookingFromRow,
    location,
  } = ctx;
  const showCreateBooking = canCreateBookingFromRow(row);

  return (
    <Menu
      withinPortal
      position="bottom-end"
      shadow="sm"
      radius="md"
      opened={menuOpened}
      onChange={setMenuOpened}
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
              setMenuOpened(false);
              showQuotationPreview(row);
            }}
          >
            <Group gap="sm">
              <IconEye size={16} style={{ color: "#105476" }} />
              <Text size="sm">Preview</Text>
            </Group>
          </UnstyledButton>
        </Box>
        {(isApprovalMode || !location.state?.returnToDashboard) && (
          <>
            <Menu.Divider />
            <Box px={10} py={5}>
              <UnstyledButton
                onClick={() => {
                  setMenuOpened(false);
                  handlePrimaryAction(row);
                }}
              >
                <Group gap="sm">
                  <PrimaryActionIcon size={16} style={{ color: "#105476" }} />
                  <Text size="sm">{primaryActionLabel}</Text>
                </Group>
              </UnstyledButton>
            </Box>
          </>
        )}
        {showCreateBooking && (
          <>
            <Menu.Divider />
            <Box px={10} py={5}>
              <UnstyledButton
                onClick={() => {
                  setMenuOpened(false);
                  handleCreateBookingFromRow(row);
                }}
              >
                <Group gap="sm">
                  <IconBook size={16} style={{ color: "#105476" }} />
                  <Text size="sm">Create Booking</Text>
                </Group>
              </UnstyledButton>
            </Box>
          </>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}

type QuotationListNativeTableProps = {
  theme: ErpListTheme;
  rows: QuotationTableRow[];
  visible: QuotationVisibleColumns;
  dateFormat: string;
  isEmpty: boolean;
  onFetchRevision: (quotationServiceId: number) => void;
  rowMenuCtx: QuotationRowMenuContext;
};

/**
 * Air Export–style native table for quotation list (replaces MRT in card body).
 */
export function QuotationListNativeTable({
  theme,
  rows,
  visible,
  dateFormat,
  isEmpty,
  onFetchRevision,
  rowMenuCtx,
}: QuotationListNativeTableProps) {
  const { muted, fg, primary, fontSans } = theme;
  const colCount =
    [
      visible.sno,
      visible.enquiry_id,
      visible.customer_name,
      visible.sales_person,
      visible.created_at,
      visible.route,
      visible.reference_no,
      visible.valid_upto_list,
      visible.revision,
      visible.reject_remark,
      visible.status,
    ].filter(Boolean).length + 1;

  return (
    <table style={erpListTableElementStyle(theme)}>
      <thead>
        <tr>
          {visible.sno && <th style={erpListThStyle(theme)}>S.No</th>}
          {visible.enquiry_id && (
            <th style={{ ...erpListThStyle(theme), minWidth: 200 }}>Enquiry ID</th>
          )}
          {visible.customer_name && (
            <th style={{ ...erpListThStyle(theme), minWidth: 200 }}>Customer</th>
          )}
          {visible.sales_person && <th style={erpListThStyle(theme)}>Sales Person</th>}
          {visible.created_at && <th style={erpListThStyle(theme)}>Quote Date</th>}
          {visible.route && <th style={erpListThStyle(theme)}>Route</th>}
          {visible.reference_no && <th style={erpListThStyle(theme)}>Reference No</th>}
          {visible.valid_upto_list && <th style={erpListThStyle(theme)}>Valid Upto</th>}
          {visible.revision && <th style={erpListThStyle(theme)}>Revision</th>}
          {visible.reject_remark && <th style={erpListThStyle(theme)}>Remark</th>}
          {visible.status && <th style={erpListThStyle(theme)}>Status</th>}
          <th style={erpListThActionsSpacer(theme, 44)} />
        </tr>
      </thead>
      <tbody>
        {isEmpty || rows.length === 0 ? (
          <tr>
            <td
              colSpan={colCount}
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
                  <IconFileText size={24} color={muted} />
                </Box>
                <Box>
                  <Text fw={500} c={fg} style={{ fontFamily: fontSans }}>
                    No quotations found
                  </Text>
                  <Text size="sm" c={muted} mt={4} style={{ fontFamily: fontSans }}>
                    Try adjusting your search or filters
                  </Text>
                </Box>
              </Stack>
            </td>
          </tr>
        ) : (
          rows.map((row) => {
            const quoteCreatedAt =
              Array.isArray(row.quotation) && row.quotation.length > 0
                ? row.quotation[0]?.created_at
                : null;
            return (
              <tr key={row.id} {...erpListDataRowProps(theme)}>
                {visible.sno && (
                  <td style={erpListTdPaddingStyle()}>
                    <Text fw={600} size="sm" c={fg} style={{ fontFamily: fontSans }}>
                      {row.sno ?? "—"}
                    </Text>
                  </td>
                )}
                {visible.enquiry_id && (
                  <td style={erpListTdPaddingStyle()}>
                    <Text fw={600} size="sm" c={fg} style={{ fontFamily: fontSans }}>
                      {row.enquiry_id ?? "—"}
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
                      {row.sales_person ?? "—"}
                    </Text>
                  </td>
                )}
                {visible.created_at && (
                  <td style={{ ...erpListTdPaddingStyle(), color: muted, fontFamily: fontSans }}>
                    {quoteCreatedAt ? dayjs(quoteCreatedAt).format(dateFormat) : "—"}
                  </td>
                )}
                {visible.route && (
                  <td style={erpListTdPaddingStyle()}>
                    {erpListRouteListCell(row.origin_code_list, row.destination_code_list, {
                      primary,
                      fg,
                      muted,
                      fontSans,
                    })}
                  </td>
                )}
                {visible.reference_no && (
                  <td style={{ ...erpListTdPaddingStyle(), color: muted }}>
                    <Text size="sm" style={{ fontFamily: fontSans }}>
                      {row.reference_no || "—"}
                    </Text>
                  </td>
                )}
                {visible.valid_upto_list && (
                  <td style={erpListTdPaddingStyle()}>
                    {!row.valid_upto_list?.length ? (
                      "—"
                    ) : (
                      <div style={{ lineHeight: 1.4, fontFamily: fontSans, fontSize: 14, color: fg }}>
                        {row.valid_upto_list.map((d, i) => (
                          <div key={i}>{dayjs(d).format(dateFormat)}</div>
                        ))}
                      </div>
                    )}
                  </td>
                )}
                {visible.revision && (
                  <td style={erpListTdPaddingStyle()}>
                    {!row.quotation ? null : (
                      <Stack gap="xs">
                        {row.quotation.map((quote, index) => {
                          if (quote.revision === 0) {
                            return (
                              <Text key={index} px={8} size="sm" c={fg} style={{ fontFamily: fontSans }}>
                                -
                              </Text>
                            );
                          }
                          return (
                            <Badge
                              key={index}
                              style={{ cursor: "pointer" }}
                              onClick={() =>
                                quote.quotation_service_id != null &&
                                onFetchRevision(quote.quotation_service_id)
                              }
                              color={primary}
                              size="sm"
                            >
                              {quote.revision}
                            </Badge>
                          );
                        })}
                      </Stack>
                    )}
                  </td>
                )}
                {visible.reject_remark && (
                  <td style={{ ...erpListTdPaddingStyle(), maxWidth: 200 }}>
                    {row.reject_remark == null || String(row.reject_remark).trim() === "" ? (
                      "—"
                    ) : (
                      <Tooltip
                        label={String(row.reject_remark)}
                        multiline
                        w={300}
                        position="top"
                        withArrow
                        styles={{ tooltip: { fontFamily: fontSans, fontSize: 12 } }}
                      >
                        <Text
                          size="sm"
                          c={fg}
                          style={{
                            cursor: "pointer",
                            lineHeight: 1.4,
                            whiteSpace: "pre-line",
                            fontFamily: fontSans,
                          }}
                        >
                          {String(row.reject_remark).trim().length > 10
                            ? `${String(row.reject_remark).trim().slice(0, 10)}...`
                            : String(row.reject_remark).trim()}
                        </Text>
                      </Tooltip>
                    )}
                  </td>
                )}
                {visible.status && (
                  <td style={erpListTdPaddingStyle()}>
                    <StatusBadge status={row.status} />
                  </td>
                )}
                <td style={erpListRowActionMenuTdStyle()}>
                  <QuotationRowMenu
                    row={row}
                    ctx={{
                      ...rowMenuCtx,
                    }}
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

function StatusBadge({ status }: { status: string | undefined }) {
  if (!status) {
    return (
      <Badge color="gray" size="sm">
        Pending
      </Badge>
    );
  }
  const s = status.toUpperCase();
  const blue = s === "QUOTE APPROVED" || status === "Quote Approved";
  return (
    <Badge
      color={s === "GAINED" ? "green" : s === "LOST" ? "red" : blue ? "blue" : "cyan"}
      size="sm"
    >
      {s}
    </Badge>
  );
}
