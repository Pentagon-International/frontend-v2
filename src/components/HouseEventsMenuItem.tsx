import { Box, Menu } from "@mantine/core";
import { IconCalendar } from "@tabler/icons-react";

type HouseEventsMenuItemProps = {
  onClick: () => void;
};

const menuItemStyles = {
  item: {
    fontFamily: "Inter",
    fontSize: "13px",
    fontWeight: 500,
    borderRadius: "6px",
    padding: "10px 12px",
    marginBottom: "4px",
    "&:hover": {
      backgroundColor: "#F8F9FA",
    },
  },
  itemLabel: {
    fontFamily: "Inter",
    fontSize: "13px",
    fontWeight: 500,
    color: "#424242",
  },
} as const;

export function HouseEventsMenuItem({ onClick }: HouseEventsMenuItemProps) {
  return (
    <Menu.Item
      leftSection={
        <Box
          style={{
            backgroundColor: "#E7F5FF",
            borderRadius: "6px",
            padding: "6px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <IconCalendar size={16} color="#105476" />
        </Box>
      }
      styles={menuItemStyles}
      onClick={onClick}
    >
      Events
    </Menu.Item>
  );
}
