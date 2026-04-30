import { Group, Button, Menu } from "@mantine/core";
import { IconChevronDown } from "@tabler/icons-react";

/** Toolbar filters matching mock — wiring to APIs can replace static labels later */
export function EnquiryConversionFilters({
  periodLabel = "Apr 2026 · MTD",
}: {
  periodLabel?: string;
}) {
  return (
    <Group gap="xs" justify="flex-end" wrap="wrap">
      <Menu shadow="md" width={200}>
        <Menu.Target>
          <Button
            size="xs"
            leftSection={<IconChevronDown size={14} />}
            styles={{
              root: {
                backgroundColor: "#105476",
                color: "#fff",
              },
            }}
          >
            {periodLabel}
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item>Apr 2026 · MTD</Menu.Item>
          <Menu.Item>Mar 2026 · Full month</Menu.Item>
        </Menu.Dropdown>
      </Menu>
      <Button variant="default" size="xs" rightSection={<IconChevronDown size={14} />}>
        All reps
      </Button>
      <Button variant="default" size="xs" rightSection={<IconChevronDown size={14} />}>
        All modes
      </Button>
      <Button variant="default" size="xs" rightSection={<IconChevronDown size={14} />}>
        All sources
      </Button>
    </Group>
  );
}
