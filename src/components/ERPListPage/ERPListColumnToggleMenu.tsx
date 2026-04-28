import { Button, Checkbox, Group, Menu, Text } from "@mantine/core";
import { IconSettings } from "@tabler/icons-react";
import type { CSSProperties } from "react";
import type { ErpListTheme } from "./erpListTheme";
import { DEFAULT_ERP_LIST_THEME } from "./erpListTheme";
import { erpToolbarOutlineButtonStyles } from "./erpListMantineStyles";

export interface ERPListColumnToggleItem {
  id: string;
  label: string;
  checked: boolean;
  onToggle: () => void;
}

export interface ERPListColumnToggleMenuProps {
  theme?: ErpListTheme;
  items: ERPListColumnToggleItem[];
  triggerLabel?: string;
  menuTitle?: string;
  menuWidth?: number | string;
  menuStyles?: { dropdown?: CSSProperties };
  classNames?: Partial<Record<"dropdown", string>>;
}

/**
 * "Columns" menu with checkbox rows (Air Export column visibility pattern).
 */
export function ERPListColumnToggleMenu({
  theme = DEFAULT_ERP_LIST_THEME,
  items,
  triggerLabel = "Columns",
  menuTitle = "Toggle Columns",
  menuWidth = 200,
  menuStyles,
  classNames,
}: ERPListColumnToggleMenuProps) {
  return (
    <Menu shadow="md" width={menuWidth} styles={menuStyles} classNames={classNames}>
      <Menu.Target>
        <Button
          variant="default"
          size="xs"
          leftSection={<IconSettings size={14} />}
          styles={erpToolbarOutlineButtonStyles(theme)}
        >
          {triggerLabel}
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label style={{ fontSize: 12, fontFamily: theme.fontSans }}>{menuTitle}</Menu.Label>
        {items.map((item) => (
          <Menu.Item key={item.id} closeMenuOnClick={false} onClick={item.onToggle}>
            <Group gap="sm" wrap="nowrap">
              <Checkbox
                size="xs"
                checked={item.checked}
                onChange={() => {}}
                styles={{ input: { cursor: "pointer", fontFamily: theme.fontSans } }}
              />
              <Text size="xs" tt="capitalize" style={{ fontFamily: theme.fontSans }}>
                {item.label}
              </Text>
            </Group>
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
