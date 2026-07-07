import { Box, Menu } from "@mantine/core";
import { IconFileInvoice } from "@tabler/icons-react";
import { useLocation, useNavigate } from "react-router-dom";
import { buildHouseJobLedgerNavigationState } from "../utils/buildHouseJobLedgerNavigationState";

type HouseJobLedgerMenuItemProps = {
  serviceName: string;
  getHouseDetail: () => Record<string, unknown>;
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

export function HouseJobLedgerMenuItem({
  serviceName,
  getHouseDetail,
  jobId,
}: HouseJobLedgerMenuItemProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const locationJob = (
    location.state as {
      job?: { job_id?: string | number; id?: string | number };
    } | null
  )?.job;

  const resolvedJobId =
    jobId ?? locationJob?.job_id ?? locationJob?.id ?? null;

  if (resolvedJobId == null) return null;

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
        navigate("/job-ledger", {
          state: buildHouseJobLedgerNavigationState(
            getHouseDetail(),
            location.state,
            {
              serviceName,
              jobId: resolvedJobId,
              jobReturnTo: location.pathname,
              jobReturnToState: location.state,
            },
          ),
        });
      }}
    >
      Job Ledger
    </Menu.Item>
  );
}
