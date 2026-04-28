import { useState } from "react";
import {
  ActionIcon,
  Box,
  Group,
  Menu,
  Stack,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { IconDotsVertical, IconEdit, IconEye, IconRoute } from "@tabler/icons-react";
import type { ErpListTheme } from "../../components/ERPListPage/erpListTheme";
import { ERP_LIST_GEIST_ROOT_CLASS } from "../../components/ERPListPage/erpListGeistShell";
import {
  erpListDataRowProps,
  erpListStickyActionTdStyle,
  erpListStickyActionThStyle,
  erpListTableElementStyle,
  erpListTdPaddingStyle,
  erpListThStyle,
} from "../../components/ERPListPage/erpListTableStyles";

/** List row: metrics + `raw` for navigation to create page */
export type PipelineListRow = {
  sno: number;
  customer_code: string;
  customer_name: string;
  created_by: string;
  total_profit: number;
  total_volume: number;
  pipelines: unknown[];
  raw: {
    customer_code: string;
    customer_name: string;
    created_by: string;
    pipelines: unknown[];
    total_profit: number;
    total_volume: number;
  };
};

type PipelineListNativeTableProps = {
  theme: ErpListTheme;
  rows: PipelineListRow[];
  isEmpty: boolean;
  onView: (row: PipelineListRow) => void;
  onEdit: (row: PipelineListRow) => void;
};

export function PipelineListNativeTable({
  theme,
  rows,
  isEmpty,
  onView,
  onEdit,
}: PipelineListNativeTableProps) {
  const { muted, fg, fontSans, primary } = theme;
  const colCount = 7;
  const actionColStyle = {
    ...erpListStickyActionTdStyle(theme),
    textAlign: "center" as const,
  };

  return (
    <table style={erpListTableElementStyle(theme)}>
      <thead>
        <tr>
          <th style={erpListThStyle(theme, { textAlign: "left" })}>S.No</th>
          <th style={erpListThStyle(theme, { textAlign: "left" })}>Customer Code</th>
          <th style={erpListThStyle(theme, { textAlign: "left" })}>Customer Name</th>
          <th style={erpListThStyle(theme, { textAlign: "left" })}>Sales Person</th>
          <th style={erpListThStyle(theme, { textAlign: "right" })}>Total Profit</th>
          <th style={erpListThStyle(theme, { textAlign: "right" })}>Total Volume</th>
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
                  <IconRoute size={24} color={muted} />
                </Box>
                <Box>
                  <Text fw={500} c={fg} style={{ fontFamily: fontSans }}>
                    No pipeline records
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
            <tr key={`${row.customer_code}-${row.sno}`} {...erpListDataRowProps(theme)}>
              <td style={erpListTdPaddingStyle()}>
                <Text fw={600} size="sm" c={fg} style={{ fontFamily: fontSans }}>
                  {row.sno}
                </Text>
              </td>
              <td style={erpListTdPaddingStyle()}>
                <Text size="sm" c={fg} style={{ fontFamily: fontSans }}>
                  {row.customer_code}
                </Text>
              </td>
              <td style={{ ...erpListTdPaddingStyle(), maxWidth: 220 }}>
                <Text size="sm" c={fg} lineClamp={2} style={{ fontFamily: fontSans }}>
                  {row.customer_name}
                </Text>
              </td>
              <td style={erpListTdPaddingStyle()}>
                <Text size="sm" c={muted} style={{ fontFamily: fontSans }}>
                  {row.created_by}
                </Text>
              </td>
              <td
                style={{
                  ...erpListTdPaddingStyle(),
                  textAlign: "right",
                  fontSize: 14,
                  color: muted,
                }}
              >
                {(row.total_profit ?? 0).toLocaleString()}
              </td>
              <td
                style={{
                  ...erpListTdPaddingStyle(),
                  textAlign: "right",
                  fontSize: 14,
                  fontWeight: 500,
                  color: fg,
                }}
              >
                {(row.total_volume ?? 0).toLocaleString(undefined, {
                  maximumFractionDigits: 1,
                })}
              </td>
              <td style={actionColStyle}>
                <PipelineRowMenu
                  onView={() => onView(row)}
                  onEdit={() => onEdit(row)}
                  iconAccent={primary}
                />
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function PipelineRowMenu({
  onView,
  onEdit,
  iconAccent = "#105476",
}: {
  onView: () => void;
  onEdit: () => void;
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
              onView();
            }}
          >
            <Group gap="sm">
              <IconEye size={16} style={{ color: iconAccent }} />
              <Text size="sm">View</Text>
            </Group>
          </UnstyledButton>
        </Box>
        <Menu.Divider />
        <Box px={10} py={5}>
          <UnstyledButton
            onClick={() => {
              setOpened(false);
              onEdit();
            }}
          >
            <Group gap="sm">
              <IconEdit size={16} style={{ color: iconAccent }} />
              <Text size="sm">Edit</Text>
            </Group>
          </UnstyledButton>
        </Box>
      </Menu.Dropdown>
    </Menu>
  );
}
