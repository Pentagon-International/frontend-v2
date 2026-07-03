import { Box, Menu } from "@mantine/core";
import { IconFileInvoice } from "@tabler/icons-react";
import { useLocation, useNavigate } from "react-router-dom";
import { buildHouseAgentInvoiceNavigationState } from "../utils/buildHouseAgentInvoiceNavigationState";

type HouseCreateAgentInvoiceMenuItemProps = {
  invoicePath: string;
  serviceType: string | string[];
  getCurrentHousingDetail: () => Record<string, unknown>;
  jobId?: number | string | null;
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

export function HouseCreateAgentInvoiceMenuItem({
  invoicePath,
  serviceType,
  getCurrentHousingDetail,
  jobId,
}: HouseCreateAgentInvoiceMenuItemProps) {
  const navigate = useNavigate();
  const location = useLocation();

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
          <IconFileInvoice size={16} color="#105476" />
        </Box>
      }
      styles={menuItemStyles}
      onClick={() => {
        navigate(invoicePath, {
          state: buildHouseAgentInvoiceNavigationState(
            getCurrentHousingDetail(),
            location.state,
            serviceType,
          ),
        });
      }}
    >
      Create Agent Invoice
    </Menu.Item>
  );
}
