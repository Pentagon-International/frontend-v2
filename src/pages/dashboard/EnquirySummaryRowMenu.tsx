import {
  ActionIcon,
  Box,
  Group,
  Loader,
  Menu,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { IconDotsVertical, IconEdit, IconEye, IconTag, IconX } from "@tabler/icons-react";
import type { Location, NavigateFunction } from "react-router-dom";
import type { RefObject } from "react";
import { URL } from "../../api/serverUrls";
import { apiCallProtected } from "../../api/axios";
import { ToastNotification } from "../../components";
import { useListFilterStore } from "../../store/listFilterStore";

export type EnquiryRowMenuContext = {
  navigate: NavigateFunction;
  location: Location;
  saveFiltersToStore: () => void;
  savePreviewFiltersToStore: () => void;
  showPreviewTable: boolean;
  filters: Record<string, unknown>;
  filtersApplied: boolean;
  fromDate: Date | null;
  toDate: Date | null;
  customerDisplayValue: string | null;
  originDisplayValue: string | null;
  destinationDisplayValue: string | null;
  returnToDashboardRef: RefObject<boolean>;
  showEnquiryPreview: (row: unknown) => void;
  handleCancelEnquiry: (row: unknown) => void;
  cancellingEnquiryId: number | null;
  listKey: string;
  detailedListKey: string;
  /**
   * Create / edit targets for the record form. Defaults: `/enquiry-create`.
   * Use for RFQ lists: `{ createQuotation: "/rfq-create", editRecord: "/rfq-create" }`.
   */
  recordFormPaths?: {
    createQuotation?: string;
    editRecord?: string;
  };
  /** Shown in the "Edit …" item (default "Enquiry"). */
  editRecordLabel?: string;
};

type Props = {
  row: Record<string, unknown>;
  opened: boolean;
  onOpenChange: (open: boolean) => void;
  ctx: EnquiryRowMenuContext;
  menuStyles?: { dropdown: Record<string, unknown> };
  dropdownClassName?: string;
};

function preserveAndNavigate(
  ctx: EnquiryRowMenuContext,
  navigatePath: string,
  extraState: Record<string, unknown> = {},
) {
  const {
    navigate,
    saveFiltersToStore,
    savePreviewFiltersToStore,
    showPreviewTable,
    filters,
    filtersApplied,
    fromDate,
    toDate,
    customerDisplayValue,
    originDisplayValue,
    destinationDisplayValue,
    detailedListKey,
    listKey,
  } = ctx;
  saveFiltersToStore();
  if (showPreviewTable) savePreviewFiltersToStore();
  const currentFilterState = {
    filters,
    filtersApplied,
    fromDate,
    toDate,
    displayValues: {
      customer_code: customerDisplayValue,
      origin_code: originDisplayValue,
      destination_code: destinationDisplayValue,
    },
  };
  if (showPreviewTable) {
    useListFilterStore.getState().setShouldRestore(detailedListKey, true);
  } else {
    useListFilterStore.getState().setShouldRestore(listKey, true);
  }
  navigate(navigatePath, { state: { ...extraState, preserveFilters: currentFilterState, fromEnquiry: true } });
}

export function EnquirySummaryRowMenu({ row, opened, onOpenChange, ctx, menuStyles, dropdownClassName }: Props) {
  const createQuotationPath = ctx.recordFormPaths?.createQuotation ?? "/enquiry-create";
  const editRecordPath = ctx.recordFormPaths?.editRecord ?? "/enquiry-create";
  const editRecordLabel = ctx.editRecordLabel ?? "Enquiry";
  const statusU = String(row?.status ?? "").toUpperCase();
  const isTerminalQuote = ["GAINED", "LOST", "QUOTE CREATED"].includes(statusU);
  const rowId = (row as { id?: number })?.id;

  return (
    <Menu
      withinPortal
      position="bottom-end"
      shadow="sm"
      radius="md"
      opened={opened}
      onChange={onOpenChange}
      styles={menuStyles}
      classNames={dropdownClassName ? { dropdown: dropdownClassName } : undefined}
    >
      <Menu.Target>
        <ActionIcon variant="subtle" color="gray" aria-label="Row actions">
          <IconDotsVertical size={16} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Box px={10} py={5}>
          <UnstyledButton
            onClick={() => {
              onOpenChange(false);
              preserveAndNavigate(ctx, createQuotationPath, { ...row });
            }}
            style={{
              opacity: isTerminalQuote ? 0.5 : 1,
              cursor: isTerminalQuote ? "not-allowed" : "pointer",
            }}
            disabled={isTerminalQuote}
          >
            <Group gap="sm">
              <IconEye size={16} style={{ color: "#105476" }} />
              <Text size="sm">Create Quotation</Text>
            </Group>
          </UnstyledButton>
        </Box>
        <Menu.Divider />
        {isTerminalQuote && (
          <>
            <Box px={10} py={5}>
              <UnstyledButton
                onClick={async () => {
                  try {
                    onOpenChange(false);
                    const filterPayload = { filters: { enquiry_id: row.enquiry_id } };
                    const response = await apiCallProtected.post(`${URL.quotationFilter}`, filterPayload);
                    const data = response as { data?: unknown[] };
                    if (data && Array.isArray(data.data) && data.data.length > 0) {
                      const quotationData = data.data[0];
                      preserveAndNavigate(ctx, "/quotation-create", {
                        ...quotationData,
                        actionType: "edit",
                      });
                    } else {
                      ToastNotification({ type: "warning", message: "No quotation found for this enquiry" });
                    }
                  } catch (error: unknown) {
                    const err = error as { message?: string };
                    ToastNotification({
                      type: "error",
                      message: `Error fetching quotation: ${err?.message || "Unknown error"}`,
                    });
                  }
                }}
              >
                <Group gap="sm">
                  <IconEdit size={16} style={{ color: "#105476" }} />
                  <Text size="sm">Edit Quotation</Text>
                </Group>
              </UnstyledButton>
            </Box>
            <Menu.Divider />
          </>
        )}
        <Box px={10} py={5}>
          <UnstyledButton
            onClick={() => {
              onOpenChange(false);
              preserveAndNavigate(ctx, "/get-rate", { ...row });
            }}
          >
            <Group gap="sm">
              <IconTag size={16} style={{ color: "#105476" }} />
              <Text size="sm">Get Rate</Text>
            </Group>
          </UnstyledButton>
        </Box>
        <Menu.Divider />
        {!ctx.location.state?.returnToDashboard && !ctx.returnToDashboardRef.current && (
          <>
            <Box px={10} py={5}>
              <UnstyledButton
                onClick={() => {
                  onOpenChange(false);
                  preserveAndNavigate(ctx, editRecordPath, { ...row, actionType: "edit" });
                }}
              >
                <Group gap="sm">
                  <IconEdit size={16} style={{ color: "#105476" }} />
                  <Text size="sm">Edit {editRecordLabel}</Text>
                </Group>
              </UnstyledButton>
            </Box>
            <Menu.Divider />
          </>
        )}
        <Box px={10} py={5}>
          <UnstyledButton
            onClick={() => {
              onOpenChange(false);
              ctx.showEnquiryPreview(row);
            }}
          >
            <Group gap="sm">
              <IconEye size={16} style={{ color: "#105476" }} />
              <Text size="sm">Preview</Text>
            </Group>
          </UnstyledButton>
        </Box>
        <Menu.Divider />
        <Box px={10} py={5}>
          <UnstyledButton
            onClick={() => {
              onOpenChange(false);
              ctx.handleCancelEnquiry(row);
            }}
            disabled={ctx.cancellingEnquiryId === rowId}
          >
            <Group gap="sm">
              {ctx.cancellingEnquiryId === rowId ? (
                <Loader size={16} color="red" />
              ) : (
                <IconX size={16} style={{ color: "red" }} />
              )}
              <Text size="sm" c="red">
                {ctx.cancellingEnquiryId === rowId ? "Cancelling..." : "Cancel"}
              </Text>
            </Group>
          </UnstyledButton>
        </Box>
      </Menu.Dropdown>
    </Menu>
  );
}
