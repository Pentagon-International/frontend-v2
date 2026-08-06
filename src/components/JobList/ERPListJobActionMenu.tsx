import type { ReactNode } from "react";
import { ActionIcon, Box, Menu, Tooltip } from "@mantine/core";
import {
  IconDotsVertical,
  IconEdit,
  IconEye,
  IconLock,
  IconLockOpen,
  IconX,
} from "@tabler/icons-react";
import {
  ERP_LIST_GEIST_ROOT_CLASS,
  erpListGeistMenuDropdownStyles,
} from "../ERPListPage/erpListGeistShell";

type ERPListJobActionMenuProps = {
  status: string | null | undefined;
  variant?: "job-page" | "closure-page" | "reopen-page";
  onEdit?: () => void;
  /** When job is CLOSED, opens view-only flow (same as global search). */
  onView?: () => void;
  onCancel?: () => void;
  onCloseJob?: () => void;
  onReopenJob?: () => void;
  canCancel?: boolean;
};

function DisabledMenuItemWithTooltip({
  label,
  tooltip,
  leftSection,
  color,
}: {
  label: string;
  tooltip: string;
  leftSection: ReactNode;
  color?: string;
}) {
  return (
    <Tooltip
      label={tooltip}
      withArrow
      position="left"
      withinPortal
    >
      <Box component="span" display="block" style={{ width: "100%" }}>
        <Menu.Item leftSection={leftSection} color={color} disabled>
          {label}
        </Menu.Item>
      </Box>
    </Tooltip>
  );
}

export function ERPListJobActionMenu({
  status,
  variant = "job-page",
  onEdit,
  onView,
  onCancel,
  onCloseJob,
  onReopenJob,
  canCancel = true,
}: ERPListJobActionMenuProps) {
  const statusUpper = (status ?? "").toUpperCase();
  const isCancel = statusUpper === "CANCEL";
  const isClosed = statusUpper === "CLOSED";
  const showCancel = variant === "job-page";
  const showEdit = variant === "job-page";
  const showCloseJob = variant === "closure-page";
  const showReopenJob = variant === "reopen-page";
  const cancelDisabled = !canCancel || isClosed;

  return (
    <Menu
      withinPortal
      position="bottom-end"
      shadow="md"
      width={200}
      styles={erpListGeistMenuDropdownStyles}
      classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
    >
      <Menu.Target>
        <ActionIcon variant="subtle" color="gray" size="sm">
          <IconDotsVertical size={16} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        {showEdit &&
          (isClosed ? (
            onView ? (
              <Menu.Item
                leftSection={<IconEye size={14} />}
                onClick={onView}
              >
                View
              </Menu.Item>
            ) : (
              <DisabledMenuItemWithTooltip
                label="Edit"
                tooltip="This job is already closed"
                leftSection={<IconEdit size={14} />}
              />
            )
          ) : (
            <Menu.Item
              leftSection={<IconEdit size={14} />}
              disabled={isCancel}
              onClick={onEdit}
            >
              Edit
            </Menu.Item>
          ))}

        {showCancel &&
          (isClosed ? (
            <DisabledMenuItemWithTooltip
              label="Cancel"
              tooltip="This job is already closed"
              leftSection={<IconX size={14} />}
              color="red"
            />
          ) : (
            <Menu.Item
              leftSection={<IconX size={14} />}
              color="red"
              disabled={cancelDisabled}
              onClick={onCancel}
            >
              Cancel
            </Menu.Item>
          ))}

        {showCloseJob &&
          (isClosed ? (
            <DisabledMenuItemWithTooltip
              label="Close Job"
              tooltip="This job is already closed"
              leftSection={<IconLock size={14} />}
            />
          ) : (
            <Menu.Item
              leftSection={<IconLock size={14} />}
              onClick={onCloseJob}
            >
              Close Job
            </Menu.Item>
          ))}

        {showReopenJob &&
          (statusUpper === "ACTIVE" ? (
            <DisabledMenuItemWithTooltip
              label="Reopen Job"
              tooltip="This job is already active"
              leftSection={<IconLockOpen size={14} />}
            />
          ) : (
            <Menu.Item
              leftSection={<IconLockOpen size={14} />}
              onClick={onReopenJob}
            >
              Reopen Job
            </Menu.Item>
          ))}
      </Menu.Dropdown>
    </Menu>
  );
}
