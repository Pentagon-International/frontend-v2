import { Box, Menu } from "@mantine/core";
import { IconReceipt } from "@tabler/icons-react";
import { ToastNotification } from "./index";
import { getHouseShipmentNo } from "../utils/paymentRequestAutomation";

type HouseAutomatePaymentRequestMenuItemProps = {
  getCurrentHousingDetail: () => Record<string, unknown>;
  jobId?: number | string | null;
  onOpen: (shipmentNo: string) => void;
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
    whiteSpace: "nowrap",
  },
} as const;

export function HouseAutomatePaymentRequestMenuItem({
  getCurrentHousingDetail,
  jobId,
  onOpen,
}: HouseAutomatePaymentRequestMenuItemProps) {
  if (jobId == null) return null;

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
          <IconReceipt size={16} color="#105476" />
        </Box>
      }
      styles={menuItemStyles}
      onClick={() => {
        const shipmentNo = getHouseShipmentNo(getCurrentHousingDetail());
        if (!shipmentNo) {
          ToastNotification({
            type: "error",
            message: "Shipment number not found for payment request automation.",
          });
          return;
        }
        onOpen(shipmentNo);
      }}
    >
      Automate Payment Request
    </Menu.Item>
  );
}
