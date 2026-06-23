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
  day_book_name?: string;
  day_book_type?: string;
  Dr_Cr?: string;
  dr_cr?: string;
  document_type?: string;
  total?: string | number;
};

type JobInvoiceParentRow = Record<string, unknown> & {
  document_no?: string;
  reverse_invoice_id?: number;
  document_date?: string;
  status?: string;
  day_book_name?: string;
  day_book_type?: string;
  Dr_Cr?: string;
  dr_cr?: string;
  document_type?: string;
  total?: string | number;
};

type JobReverseInvoiceAccountMenuProps = {
  rev: JobReverseInvoiceRow;
  parentRow: JobInvoiceParentRow;
  jobBasePath: string;
  navigate: NavigateFunction;
  job?: unknown;
  deletingReverseId: number | null;
  onRequestDeleteReverseInvoice: (reverseInvoiceId: number) => void;
  resolveDocumentSegment?: (
    rev: JobReverseInvoiceRow,
    parentRow: JobInvoiceParentRow,
  ) => "invoice" | "credit-note";
};

function isCreditNoteDocument(
  rev: JobReverseInvoiceRow,
  parentRow: JobInvoiceParentRow,
): boolean {
  const documentType = String(
    rev.document_type ?? parentRow.document_type ?? "",
  )
    .toUpperCase()
    .trim();
  const drCr = String(
    rev.Dr_Cr ?? rev.dr_cr ?? parentRow.Dr_Cr ?? parentRow.dr_cr ?? "",
  )
    .toLowerCase()
    .trim();
  const dayBookName = String(
    rev.day_book_name ?? parentRow.day_book_name ?? "",
  ).toLowerCase();
  return (
    documentType === "CRN" ||
    drCr === "cr" ||
    dayBookName.includes("credit")
  );
}

export function JobReverseInvoiceAccountMenu({
  rev,
  parentRow,
  jobBasePath,
  navigate,
  job,
  deletingReverseId,
  onRequestDeleteReverseInvoice,
  resolveDocumentSegment,
}: JobReverseInvoiceAccountMenuProps) {
  const reverseInvoiceId = Number(
    rev.reverse_invoice_id ?? parentRow.reverse_invoice_id,
  );
  const { isUnposted } = parseInvoiceStatus(rev.status ?? parentRow.status);
  const documentSegment =
    resolveDocumentSegment?.(rev, parentRow) ??
    (isCreditNoteDocument(rev, parentRow) ? "credit-note" : "invoice");

  const mergedRecord = {
    ...parentRow,
    ...rev,
    id: reverseInvoiceId,
  };

  const handleView = () => {
    navigate(`${jobBasePath}/${documentSegment}/view/${reverseInvoiceId}`, {
      state: {
        invoiceData: {
          ...mergedRecord,
          document_no: getInvoiceDocumentNo(rev, parentRow.document_no),
          document_date: rev.document_date ?? parentRow.document_date,
          total: rev.total ?? parentRow.total,
          status: rev.status ?? parentRow.status,
          day_book_name: rev.day_book_name ?? parentRow.day_book_name,
        },
        fromJobLevel: true,
        ...(job ? { job } : {}),
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
        ...(job ? { job } : {}),
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
        {isUnposted ? (
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
