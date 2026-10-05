import { Anchor, Modal, Stack, Table, Text } from "@mantine/core";
import type { PaymentApprovalDocument } from "../types";

type Props = {
  opened: boolean;
  onClose: () => void;
  documentNo?: string | null;
  documents: PaymentApprovalDocument[];
};

function docLabel(doc: PaymentApprovalDocument): string {
  return (
    String(doc.document_name ?? "").trim() ||
    String(doc.file_name ?? "").trim() ||
    "Document"
  );
}

function docUrl(doc: PaymentApprovalDocument): string {
  return String(doc.document_url ?? doc.document ?? doc.url ?? "").trim();
}

export default function AllocationDocumentsModal({
  opened,
  onClose,
  documentNo,
  documents,
}: Props) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Text fw={600} size="md" style={{ fontFamily: "'Geist', sans-serif" }}>
          Attached documents
          {documentNo ? (
            <Text span size="sm" c="dimmed" ml={8}>
              ({documentNo})
            </Text>
          ) : null}
        </Text>
      }
      centered
      size="lg"
      zIndex={400}
    >
      {documents.length === 0 ? (
        <Text size="sm" c="dimmed" style={{ fontFamily: "'Geist', sans-serif" }}>
          No documents attached.
        </Text>
      ) : (
        <Stack gap="sm">
          <Table
            striped
            highlightOnHover
            withTableBorder
            style={{ fontFamily: "'Geist', sans-serif" }}
          >
            <Table.Thead>
              <Table.Tr>
                <Table.Th>S.No</Table.Th>
                <Table.Th>Document</Table.Th>
                <Table.Th>Action</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {documents.map((doc, idx) => {
                const url = docUrl(doc);
                return (
                  <Table.Tr key={String(doc.id ?? idx)}>
                    <Table.Td>{idx + 1}</Table.Td>
                    <Table.Td>{docLabel(doc)}</Table.Td>
                    <Table.Td>
                      {url ? (
                        <Anchor href={url} target="_blank" rel="noreferrer" size="sm">
                          Open
                        </Anchor>
                      ) : (
                        <Text size="sm" c="dimmed">
                          —
                        </Text>
                      )}
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Stack>
      )}
    </Modal>
  );
}
