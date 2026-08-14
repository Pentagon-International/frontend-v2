import { Anchor, Box, Stack, Text } from "@mantine/core";
import {
  getCustomerDocumentLabel,
  getCustomerDocumentUrl,
  openCustomerDocumentInNewTab,
  type CustomerDocumentListItem,
} from "../utils/customerDocuments";

type CustomerDocumentsListProps = {
  documents: CustomerDocumentListItem[];
  title?: string;
  emptyMessage?: string;
  hideTitle?: boolean;
};

export default function CustomerDocumentsList({
  documents,
  title = "Supporting Documents",
  emptyMessage,
  hideTitle = false,
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
      {!hideTitle && (
        <Text size="sm" fw={600} c="#105476" mb="xs">
          {title}
        </Text>
      )}
      <Stack gap={6}>
        {documents.map((doc) => {
          const label = getCustomerDocumentLabel(doc);
          const url = getCustomerDocumentUrl(doc);
          return (
            <Box key={doc.id ?? label}>
              {url ? (
                <Anchor
                  size="sm"
                  c="#105476"
                  fw={500}
                  underline="hover"
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
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
