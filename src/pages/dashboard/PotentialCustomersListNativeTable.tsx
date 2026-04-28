import { useState } from "react";
import {
  ActionIcon,
  Box,
  Group,
  Menu,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { IconDotsVertical, IconPlus, IconUsers } from "@tabler/icons-react";
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

type Props = {
  theme: ErpListTheme;
  rows: PotentialCustomerTableRow[];
  visible: PotentialCustomerVisibleColumns;
  isEmpty: boolean;
  /** When true, show assigned columns + actions */
  assignedMode: boolean;
  onCreateCallEntry: (row: PotentialCustomerTableRow) => void;
};

export function PotentialCustomersListNativeTable({
  theme,
  rows,
  visible,
  isEmpty,
  assignedMode,
  onCreateCallEntry,
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

  return (
    <table style={erpListTableElementStyle(theme)}>
      <thead>
        <tr>
          {displayKeys.map((k) => (
            <th
              key={k}
              style={erpListThStyle(theme, {
                textAlign: RIGHT_ALIGN_KEYS.has(k) ? "right" : "left",
              })}
            >
              {HEADERS[k]}
            </th>
          ))}
          {assignedMode && (
            <th style={erpListStickyActionThStyle(theme, 80)} aria-label="Actions" />
          )}
        </tr>
      </thead>
      <tbody>
        {isEmpty || rows.length === 0 ? (
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
