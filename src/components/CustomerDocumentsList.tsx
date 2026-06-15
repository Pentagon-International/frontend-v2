import { Anchor, Box, Stack, Text } from "@mantine/core";
import {
  getCustomerDocumentFileLabel,
  getCustomerDocumentUrl,
  openCustomerDocumentInNewTab,
  type CustomerDocumentListItem,
} from "../utils/customerDocuments";

type CustomerDocumentsListProps = {
  documents: CustomerDocumentListItem[];
  title?: string;
  emptyMessage?: string;
};

export default function CustomerDocumentsList({
  documents,
  title = "Supporting Documents",
  emptyMessage,
}: CustomerDocumentsListProps) {
  if (!documents.length) {
    if (!emptyMessage) return null;
    return (
      <Text size="sm" c="dimmed">
        {emptyMessage}
      </Text>
    );
  }

  return (
    <Box>
      <Text size="sm" fw={600} c="#105476" mb="xs">
        {title}
      </Text>
      <Stack gap={6}>
        {documents.map((doc) => {
          const label = getCustomerDocumentFileLabel(doc);
          const url = getCustomerDocumentUrl(doc);
          return (
            <Box key={doc.id ?? label}>
              {url ? (
                <Anchor
                  size="sm"
                  c="#105476"
                  fw={500}
                  underline="hover"
                  style={{ cursor: "pointer" }}
                  onClick={(event) => {
                    event.preventDefault();
                    openCustomerDocumentInNewTab(doc);
                  }}
                >
                  {label}
                </Anchor>
              ) : (
                <Text size="sm" c="dimmed">
                  {label}
                </Text>
              )}
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}
