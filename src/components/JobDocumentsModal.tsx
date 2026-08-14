import {
  ActionIcon,
  Box,
  Button,
  Grid,
  Group,
  Modal,
  Stack,
  Text,
} from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";
import { IconDownload, IconPlus, IconTrash, IconUpload } from "@tabler/icons-react";
import Dropdown from "./Dropdown";
import FormTextInput from "./FormTextInput";
import RequiredLabel from "./RequiredLabel";
import { ToastNotification } from "./index";
import type {
  DocumentTypeMasterOption,
  JobDocumentModalRow,
} from "../utils/jobDocuments";
import { openCustomerDocumentInNewTab } from "../utils/customerDocuments";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

type JobDocumentsModalProps = {
  opened: boolean;
  onClose: () => void;
  rows: JobDocumentModalRow[];
  readOnly?: boolean;
  uploading?: boolean;
  docTypeOptions?: DocumentTypeMasterOption[];
  docCodeErrors?: Record<number, string>;
  onAddRow: () => void;
  onUpdateRow: (
    index: number,
    field: "documentName" | "doc_code" | "file" | "document_url",
    value: string | File | null | undefined,
  ) => void;
  onRemoveRow: (index: number) => void;
  onSubmit: () => void;
};

export default function JobDocumentsModal({
  opened,
  onClose,
  rows,
  readOnly = false,
  uploading = false,
  docTypeOptions = [],
  docCodeErrors = {},
  onAddRow,
  onUpdateRow,
  onRemoveRow,
  onSubmit,
}: JobDocumentsModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={readOnly ? "Documents" : "Attach Documents"}
      centered
      size="xl"
      styles={{ content: { maxWidth: 720 } }}
    >
      <Stack gap="md">
        {rows.length > 0 && (
          <Grid
            columns={12}
            gutter="sm"
            style={{ fontWeight: 600, color: "#105476" }}
          >
            <Grid.Col span={4}>
              <RequiredLabel label="Document Name" required={false} />
            </Grid.Col>
            <Grid.Col span={3}>
              <RequiredLabel label="File" required={false} />
            </Grid.Col>
            <Grid.Col span={3}>
              <RequiredLabel label="Doc Type" required={false} />
            </Grid.Col>
            <Grid.Col span={2}>
              <RequiredLabel label="Actions" required={false} />
            </Grid.Col>
          </Grid>
        )}
        {rows.map((row, index) => (
          <Grid key={index} columns={12} gutter="sm" align="flex-end">
            <Grid.Col span={4}>
              <FormTextInput
                placeholder="Enter document name"
                value={row.documentName}
                readOnly={readOnly}
                onChange={(e) =>
                  onUpdateRow(index, "documentName", e.target.value)
                }
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <Box>
                {readOnly ? (
                  <Group
                    gap="xs"
                    px="sm"
                    style={{
                      minHeight: "36px",
                      border: "1px solid var(--mantine-color-gray-4)",
                      borderRadius: "var(--mantine-radius-sm)",
                    }}
                  >
                    {row.document_url ? (
                      <>
                        <IconDownload
                          size={16}
                          color="var(--mantine-color-blue-6)"
                        />
                        <Text
                          size="sm"
                          truncate
                          style={{
                            flex: 1,
                            color: "var(--mantine-color-blue-6)",
                            cursor: "pointer",
                            textDecoration: "underline",
                          }}
                          onClick={() =>
                            openCustomerDocumentInNewTab({
                              id: row.id ?? 0,
                              document_url: row.document_url,
                              document_name: row.documentName,
                              file_name: row.userFileName,
                            })
                          }
                        >
                          {row.userFileName || "View file"}
                        </Text>
                      </>
                    ) : (
                      <Text size="sm" c="dimmed">
                        No file attached
                      </Text>
                    )}
                  </Group>
                ) : (
                  <Dropzone
                    onDrop={(files: File[]) => {
                      if (files.length === 0) return;
                      const file = files[0];
                      if (file.size > MAX_FILE_SIZE) {
                        ToastNotification({
                          type: "error",
                          message: `File "${file.name}" exceeds 10MB limit`,
                        });
                        return;
                      }
                      onUpdateRow(index, "file", file);
                      onUpdateRow(index, "document_url", undefined);
                    }}
                    onReject={() => {
                      ToastNotification({
                        type: "error",
                        message: "File size exceeds 10MB limit",
                      });
                    }}
                    maxSize={MAX_FILE_SIZE}
                    accept={undefined}
                    multiple={false}
                    disabled={false}
                    styles={{
                      root: {
                        border: "1px solid var(--mantine-color-gray-4)",
                        borderRadius: "var(--mantine-radius-sm)",
                        backgroundColor: "var(--mantine-color-white)",
                        minHeight: "36px",
                        padding: "0",
                      },
                      inner: {
                        padding: "0",
                        minHeight: "36px",
                      },
                    }}
                  >
                    <Group
                      justify="space-between"
                      gap="xs"
                      px="sm"
                      style={{
                        minHeight: "36px",
                        pointerEvents: "none",
                        cursor: "pointer",
                      }}
                    >
                      <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
                        {row.file ? (
                          <>
                            <IconUpload
                              size={16}
                              color="var(--mantine-color-dimmed)"
                            />
                            <Text
                              size="sm"
                              truncate
                              style={{
                                flex: 1,
                                color: "var(--mantine-color-dark)",
                              }}
                            >
                              {row.file.name}
                            </Text>
                          </>
                        ) : row.document_url ? (
                          <>
                            <IconDownload
                              size={16}
                              color="var(--mantine-color-blue-6)"
                            />
                            <Text
                              size="sm"
                              truncate
                              style={{
                                flex: 1,
                                color: "var(--mantine-color-blue-6)",
                                cursor: "pointer",
                                textDecoration: "underline",
                                pointerEvents: "auto",
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                openCustomerDocumentInNewTab({
                                  id: row.id ?? 0,
                                  document_url: row.document_url,
                                  document_name: row.documentName,
                                  file_name: row.userFileName,
                                });
                              }}
                            >
                              {row.userFileName || "Download file"}
                            </Text>
                          </>
                        ) : (
                          <>
                            <IconUpload
                              size={16}
                              color="var(--mantine-color-dimmed)"
                            />
                            <Text
                              size="sm"
                              c="dimmed"
                              truncate
                              style={{ flex: 1 }}
                            >
                              Drag and drop or click to select file
                            </Text>
                          </>
                        )}
                      </Group>
                    </Group>
                  </Dropzone>
                )}
              </Box>
            </Grid.Col>
            <Grid.Col span={3}>
              {readOnly ? (
                <FormTextInput
                  value={row.doc_code ?? ""}
                  readOnly
                  placeholder="—"
                />
              ) : (
                <Dropdown
                  placeholder="Select doc type"
                  data={docTypeOptions}
                  value={row.doc_code || null}
                  onChange={(value) =>
                    onUpdateRow(index, "doc_code", value ?? "")
                  }
                  searchable
                  clearable
                  dropdownZIndex={3000}
                  error={docCodeErrors[index]}
                />
              )}
            </Grid.Col>
            {!readOnly && (
              <Grid.Col
                span={2}
                style={{ display: "flex", gap: 4, marginBottom: 4 }}
              >
                {rows.length > 1 && (
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    onClick={() => onRemoveRow(index)}
                    aria-label="Remove document row"
                  >
                    <IconTrash size={18} />
                  </ActionIcon>
                )}
                {index === rows.length - 1 && (
                  <ActionIcon
                    variant="light"
                    color="blue"
                    onClick={onAddRow}
                    aria-label="Add document row"
                  >
                    <IconPlus size={18} />
                  </ActionIcon>
                )}
              </Grid.Col>
            )}
          </Grid>
        ))}
        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={onClose}>
            {readOnly ? "Close" : "Cancel"}
          </Button>
          {!readOnly && (
            <Button onClick={onSubmit} loading={uploading}>
              Attach
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  );
}
