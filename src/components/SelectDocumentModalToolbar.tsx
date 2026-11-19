import { Button, FileButton, Group, Text, TextInput } from "@mantine/core";
import { IconDownload, IconSearch, IconUpload, IconX } from "@tabler/icons-react";
import { downloadSelectDocumentSampleXlsx } from "../utils/selectDocumentModalSearch";

type SelectDocumentModalToolbarProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  selectedFile: File | null;
  onFileChange: (file: File | null) => void;
  onSelectDocuments: () => void;
  selectDocumentsLoading?: boolean;
};

/**
 * Search + file upload + "Select documents" controls for outstanding
 * allocation "Select Document" modals (payment / receipt / overseas).
 */
export default function SelectDocumentModalToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  selectedFile,
  onFileChange,
  onSelectDocuments,
  selectDocumentsLoading = false,
}: SelectDocumentModalToolbarProps) {
  const canSelectDocuments =
    Boolean(searchValue.trim()) || selectedFile != null;

  return (
    <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
      <TextInput
        placeholder={searchPlaceholder}
        value={searchValue}
        onChange={(e) => onSearchChange(e.currentTarget.value)}
        leftSection={<IconSearch size={16} />}
        rightSection={
          searchValue ? (
            <IconX
              size={14}
              style={{ cursor: "pointer" }}
              onClick={() => onSearchChange("")}
              aria-label="Clear search"
            />
          ) : null
        }
        style={{ flex: 1, minWidth: 220 }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && canSelectDocuments) {
            e.preventDefault();
            onSelectDocuments();
          }
        }}
      />
      <Group gap="xs" align="flex-end">
        <Button
          variant="subtle"
          color="#105476"
          leftSection={<IconDownload size={16} />}
          onClick={downloadSelectDocumentSampleXlsx}
        >
          Sample
        </Button>
        <FileButton
          onChange={onFileChange}
          accept=".xlsx,.xls,.csv,.txt,text/plain,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        >
          {(props) => (
            <Button
              {...props}
              variant="outline"
              color="#105476"
              leftSection={<IconUpload size={16} />}
            >
              Upload
            </Button>
          )}
        </FileButton>
        <Button
          color="#105476"
          onClick={onSelectDocuments}
          disabled={!canSelectDocuments}
          loading={selectDocumentsLoading}
        >
          Select documents
        </Button>
      </Group>
      {selectedFile ? (
        <Group gap={6} w="100%" justify="flex-end">
          <Text size="xs" c="dimmed">
            File: {selectedFile.name}
          </Text>
          <Button
            variant="subtle"
            color="gray"
            size="compact-xs"
            onClick={() => onFileChange(null)}
          >
            Clear file
          </Button>
        </Group>
      ) : null}
    </Group>
  );
}
