import { Box, Menu } from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";

type JobInvoiceDeleteMenuItemProps = {
  disabled?: boolean;
  onDelete: () => void;
};

export function JobInvoiceDeleteMenuItem({
  disabled,
  onDelete,
}: JobInvoiceDeleteMenuItemProps) {
  return (
    <Menu.Item
      leftSection={
        <Box
          style={{
            backgroundColor: "#FFE3E3",
            borderRadius: "6px",
            padding: "6px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <IconTrash size={16} color="#C92A2A" />
        </Box>
      }
      styles={{
        item: {
          fontFamily: "Inter",
          fontSize: "13px",
          fontWeight: 500,
          borderRadius: "6px",
          padding: "10px 12px",
          marginBottom: "4px",
          "&:hover": {
            backgroundColor: "#FFF5F5",
          },
        },
        itemLabel: {
          fontFamily: "Inter",
          fontSize: "13px",
          fontWeight: 500,
          color: "#C92A2A",
        },
      }}
      disabled={disabled}
      onClick={onDelete}
    >
      Delete
    </Menu.Item>
  );
}
