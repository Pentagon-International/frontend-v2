import { Box, Button, Menu } from "@mantine/core";
import { IconTextScanAi } from "@tabler/icons-react";

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
    whiteSpace: "nowrap",
  },
} as const;

const buttonStyles = {
  root: {
    fontFamily: "Inter",
    fontSize: "13px",
    fontWeight: 500,
  },
} as const;

type AutomateVendorInvoiceTriggerProps = {
  variant: "menu" | "button";
  shipmentNo: string;
  onOpen: (shipmentNo: string) => void;
  buttonVariant?: "outline" | "light";
};

export function AutomateVendorInvoiceTrigger({
  variant,
  shipmentNo,
  onOpen,
  buttonVariant = "outline",
}: AutomateVendorInvoiceTriggerProps) {
  const handleOpen = () => {
    if (!shipmentNo.trim()) return;
    onOpen(shipmentNo.trim());
  };

  if (variant === "button") {
    return (
      <Button
        variant={buttonVariant}
        color="#105476"
        size="sm"
        leftSection={<IconTextScanAi size={16} />}
        styles={buttonStyles}
        onClick={handleOpen}
      >
        Automate Vendor Invoice
      </Button>
    );
  }

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
          <IconTextScanAi size={16} color="#105476" />
        </Box>
      }
      styles={menuItemStyles}
      onClick={handleOpen}
    >
      Automate Vendor Invoice
    </Menu.Item>
  );
}
