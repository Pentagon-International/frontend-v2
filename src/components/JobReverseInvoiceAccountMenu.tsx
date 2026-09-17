import { ActionIcon, Box, Menu } from "@mantine/core";
import { IconDotsVertical, IconEdit, IconEye } from "@tabler/icons-react";
import type { NavigateFunction } from "react-router-dom";
import { getInvoiceDocumentNo } from "../utils/invoiceDocumentNumber";
import { parseInvoiceStatus } from "../utils/invoiceStatus";
import { JobInvoiceDeleteMenuItem } from "./JobInvoiceDeleteMenuItem";

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
};

const iconBoxStyle = {
  backgroundColor: "#E7F5FF",
  borderRadius: "6px",
  padding: "6px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
} as const;

type JobReverseInvoiceRow = Record<string, unknown> & {
  reverse_invoice_id?: number;
  status?: string;
  document_date?: string;
  reverse_document_no?: string;
  document_no?: string;
  day_book_name?: string | null;
  day_book_type?: string;
  Dr_Cr?: string;
  dr_cr?: string;
  document_type?: string;
  total?: string | number;
  local_total?: string | number;
};

type JobInvoiceParentRow = Record<string, unknown> & {
  document_no?: string;
  reverse_invoice_id?: number;
  document_date?: string;
  status?: string;
  day_book_name?: string | null;
  day_book_type?: string;
  Dr_Cr?: string;
  dr_cr?: string;
  document_type?: string;
  total?: string | number;
  local_total?: string | number;
};

type JobReverseInvoiceAccountMenuProps = {
  rev: JobReverseInvoiceRow;
  parentRow: JobInvoiceParentRow;
  jobBasePath: string;
  navigate: NavigateFunction;
  job?: unknown;
  deletingReverseId: number | null;
  onRequestDeleteReverseInvoice: (reverseInvoiceId: number) => void;
  readOnly?: boolean;
  navigationStateExtras?: Record<string, unknown>;
  /** Kept for call-site compatibility; View/Edit always use invoice/reverse. */
  resolveDocumentSegment?: (
    rev: JobReverseInvoiceRow,
    parentRow: JobInvoiceParentRow,
  ) => "invoice" | "credit-note";
};

export function JobReverseInvoiceAccountMenu({
  rev,
  parentRow,
  jobBasePath,
  navigate,
  job,
  deletingReverseId,
  onRequestDeleteReverseInvoice,
  navigationStateExtras,
  readOnly = false,
}: JobReverseInvoiceAccountMenuProps) {
  const reverseInvoiceId = Number(
    rev.reverse_invoice_id ?? parentRow.reverse_invoice_id,
  );
  const { isUnposted } = parseInvoiceStatus(rev.status ?? parentRow.status);

  const handleView = () => {
    navigate(`${jobBasePath}/invoice/reverse`, {
      state: {
        reverse_invoice_id: reverseInvoiceId,
        document_no: parentRow.document_no ?? "",
        reverse_document_no: getInvoiceDocumentNo(rev, parentRow.document_no),
        invoice_document_no: parentRow.document_no ?? "",
        actionType: "view",
        ...(job ? { job } : {}),
        ...(navigationStateExtras ?? {}),
      },
    });
  };

  const handleEdit = () => {
    navigate(`${jobBasePath}/invoice/reverse`, {
      state: {
        reverse_invoice_id: reverseInvoiceId,
        document_no: parentRow.document_no ?? "",
        reverse_document_no: getInvoiceDocumentNo(rev, parentRow.document_no),
        invoice_document_no: parentRow.document_no ?? "",
        actionType: "edit",
        ...(job ? { job } : {}),
        ...(navigationStateExtras ?? {}),
      },
    });
  };

  return (
    <Menu shadow="md" width={200} position="bottom-end">
      <Menu.Target>
        <ActionIcon
          variant="subtle"
          color="#105476"
          size="sm"
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
          <IconDotsVertical size={16} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown
        styles={{
          dropdown: {
            border: "1px solid #E9ECEF",
            borderRadius: "8px",
            padding: "8px",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
          },
        }}
      >
        <Menu.Item
          leftSection={
            <Box style={iconBoxStyle}>
              <IconEye size={16} color="#105476" />
            </Box>
          }
          styles={menuItemStyles}
          onClick={handleView}
        >
          View
        </Menu.Item>
        {isUnposted && !readOnly ? (
          <>
            <Menu.Item
              leftSection={
                <Box style={iconBoxStyle}>
                  <IconEdit size={16} color="#105476" />
                </Box>
              }
              styles={menuItemStyles}
              onClick={handleEdit}
            >
              Edit
            </Menu.Item>
            <JobInvoiceDeleteMenuItem
              disabled={deletingReverseId === reverseInvoiceId}
              onDelete={() => onRequestDeleteReverseInvoice(reverseInvoiceId)}
            />
          </>
        ) : null}
      </Menu.Dropdown>
    </Menu>
  );
}
