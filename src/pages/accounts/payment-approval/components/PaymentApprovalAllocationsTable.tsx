import { useState } from "react";
import { ActionIcon, Box, Table, Text, Tooltip } from "@mantine/core";
import { IconPaperclip } from "@tabler/icons-react";
import { formatCurrencyAmountForUi } from "../../../../utils/nonDecimalMoneyAmount";
import useDateFormat from "../../../../hooks/useDateFormat";
import { useGlobalSearchDocumentNavigation } from "../../../../hooks/useGlobalSearchDocumentNavigation";
import dayjs from "dayjs";
import type {
  PaymentApprovalAllocation,
  PaymentApprovalDocument,
} from "../types";
import AllocationDocumentsModal from "./AllocationDocumentsModal";

type Props = {
  allocations: PaymentApprovalAllocation[];
};

function formatAmount(value: unknown): string {
  if (value == null || value === "") return "—";
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) ? formatCurrencyAmountForUi(n) : String(value);
}

function cell(value: unknown): string {
  const s = String(value ?? "").trim();
  return s || "—";
}

export default function PaymentApprovalAllocationsTable({ allocations }: Props) {
  const dateFormat = useDateFormat();
  const { onDocumentNoClick, documentNavUi } =
    useGlobalSearchDocumentNavigation();
  const [docsOpen, setDocsOpen] = useState(false);
  const [docs, setDocs] = useState<PaymentApprovalDocument[]>([]);
  const [docsDocNo, setDocsDocNo] = useState<string | null>(null);

  const openDocs = (row: PaymentApprovalAllocation) => {
    setDocs(Array.isArray(row.documents) ? row.documents : []);
    setDocsDocNo(String(row.document_no ?? "").trim() || null);
    setDocsOpen(true);
  };

  if (!allocations.length) {
    return (
      <Box p="md">
        <Text size="sm" c="dimmed" style={{ fontFamily: "'Geist', sans-serif" }}>
          No allocations for this payment.
        </Text>
      </Box>
    );
  }

  return (
    <>
      <Box px="md" py="sm" style={{ overflowX: "auto", background: "#f8fafc" }}>
        <Table
          striped
          highlightOnHover
          withTableBorder
          horizontalSpacing="sm"
          verticalSpacing="xs"
          style={{ fontFamily: "'Geist', sans-serif", fontSize: 13 }}
        >
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Location</Table.Th>
              <Table.Th>Daybook</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Account Name</Table.Th>
              <Table.Th>Document no</Table.Th>
              <Table.Th>Inv/Crn no</Table.Th>
              <Table.Th>Document date</Table.Th>
              <Table.Th>Currency</Table.Th>
              <Table.Th>Adj Curr Amount</Table.Th>
              <Table.Th>Adj local amount</Table.Th>
              <Table.Th>Dr/Cr</Table.Th>
              <Table.Th>Documents</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {allocations.map((row, idx) => {
              const daybook = row.day_book_name || row.day_book_code;
              const account =
                row.subledger_name || row.subledger || row.account_code;
              const currency = row.currency_code || row.currency_name;
              const drCr = row.dr_cr || row.Dr_Cr;
              const invCrn = row.Inv_Crn_no;
              const documentNo = String(row.document_no ?? "").trim();
              const docCount = Array.isArray(row.documents)
                ? row.documents.length
                : 0;
              return (
                <Table.Tr key={String(row.id ?? idx)}>
                  <Table.Td>{cell(row.location)}</Table.Td>
                  <Table.Td>{cell(daybook)}</Table.Td>
                  <Table.Td>{cell(row.type)}</Table.Td>
                  <Table.Td>{cell(account)}</Table.Td>
                  <Table.Td>
                    {documentNo ? (
                      <Text
                        size="sm"
                        component="button"
                        type="button"
                        title="Open document"
                        onClick={() => void onDocumentNoClick(documentNo)}
                        style={{
                          fontFamily: "'Geist', sans-serif",
                          color: "#105476",
                          textDecoration: "underline",
                          cursor: "pointer",
                          background: "none",
                          border: "none",
                          padding: 0,
                        }}
                      >
                        {documentNo}
                      </Text>
                    ) : (
                      "—"
                    )}
                  </Table.Td>
                  <Table.Td>{cell(invCrn)}</Table.Td>
                  <Table.Td>
                    {row.document_date
                      ? dayjs(String(row.document_date)).format(dateFormat)
                      : "—"}
                  </Table.Td>
                  <Table.Td>{cell(currency)}</Table.Td>
                  <Table.Td>{formatAmount(row.adj_curr_amount)}</Table.Td>
                  <Table.Td>{formatAmount(row.adj_local_amount)}</Table.Td>
                  <Table.Td>{cell(drCr)}</Table.Td>
                  <Table.Td>
                    <Tooltip
                      label={
                        docCount
                          ? `View ${docCount} document(s)`
                          : "No documents"
                      }
                      withArrow
                    >
                      <ActionIcon
                        variant="subtle"
                        color="#105476"
                        size="xxl"
                        aria-label="View documents"
                        onClick={() => openDocs(row)}
                        style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 6px" }}
                      >
                        <Text size="sm" mr={2}>
                          View
                        </Text>
                        <IconPaperclip size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Box>

      <AllocationDocumentsModal
        opened={docsOpen}
        onClose={() => setDocsOpen(false)}
        documentNo={docsDocNo}
        documents={docs}
      />
      {documentNavUi}
    </>
  );
}
