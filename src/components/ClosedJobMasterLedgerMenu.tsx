import { ActionIcon, Box, Menu } from "@mantine/core";
import { IconDotsVertical, IconFileInvoice } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import {
  JOB_HOUSE_ACTION_MENU_DROPDOWN_STYLES,
  JOB_HOUSE_ACTION_MENU_WIDTH,
} from "../utils/jobHouseActionMenuStyles";

export type ClosedJobMasterLedgerMenuProps = {
  /** Display job id passed to job ledger (e.g. jobData.job_id). */
  jobId: string | number | null | undefined;
  serviceName: string;
  returnTo: string;
  returnToState?: unknown;
};

/**
 * Master-level actions for closed/view-only jobs: Job Ledger only
 * (matches global-search closed-job behaviour).
 */
export function ClosedJobMasterLedgerMenu({
  jobId,
  serviceName,
  returnTo,
  returnToState,
}: ClosedJobMasterLedgerMenuProps) {
  const navigate = useNavigate();
  if (jobId == null || String(jobId).trim() === "") return null;

  return (
    <Menu
      shadow="md"
      width={JOB_HOUSE_ACTION_MENU_WIDTH}
      position="bottom-end"
    >
      <Menu.Target>
        <ActionIcon
          variant="subtle"
          color="#105476"
          size="lg"
          styles={{
            root: {
              fontFamily: "Inter",
              fontSize: "13px",
              border: "1px solid #E9ECEF",
              borderRadius: "8px",
              "&:hover": {
                backgroundColor: "#F8F9FA",
              },
            },
          }}
        >
          <IconDotsVertical size={18} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown styles={JOB_HOUSE_ACTION_MENU_DROPDOWN_STYLES}>
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
          styles={{
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
          }}
          onClick={() =>
            navigate("/job-ledger", {
              state: {
                jobId,
                service_name: serviceName,
                jobReturnTo: returnTo,
                jobReturnToState: returnToState,
              },
            })
          }
        >
          Job Ledger
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
