import { useState } from "react";
import {
  Box,
  Button,
  Grid,
  Group,
  Modal,
  Stack,
  Text,
} from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";
import { IconDownload, IconPlus, IconTrash, IconUpload, IconX } from "@tabler/icons-react";
import FormTextInput from "./FormTextInput";
import ToastNotification from "./ToastNotification";
import {
  EMPTY_SUPPORTING_DOCUMENT,
  MAX_SUPPORTING_DOCUMENT_SIZE,
  type SupportingDocument,
} from "../utils/customerVerificationFormData";
import { openCustomerDocumentInNewTab } from "../utils/customerDocuments";

type SupportingDocumentsModalProps = {
  opened: boolean;
  onClose: () => void;
  documents: SupportingDocument[];
  onChange: (documents: SupportingDocument[]) => void;
  title?: string;
  readOnly?: boolean;
  onSubmit?: () => void;
  submitLabel?: string;
  submitLoading?: boolean;
  zIndex?: number;
};

function getExistingFileLabel(doc: SupportingDocument): string {
  return (
    doc.name?.trim() ||
    doc.original_document_name?.trim() ||
    "Download file"
  );
}

export default function SupportingDocumentsModal({
  opened,
  onClose,
  documents,
  onChange,
  title = "Attach Supporting Documents",
  readOnly = false,
  onSubmit,
  submitLabel = "Upload",
  submitLoading = false,
  zIndex,
}: SupportingDocumentsModalProps) {
  const [fileErrors, setFileErrors] = useState<Record<number, string>>({});

  const updateDocument = (index: number, patch: Partial<SupportingDocument>) => {
    const next = [...documents];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const removeDocument = (index: number) => {
    if (documents.length === 1) {
      onChange([{ ...EMPTY_SUPPORTING_DOCUMENT }]);
    } else {
      onChange(documents.filter((_, i) => i !== index));
    }
    setFileErrors((prev) => {
      const next: Record<number, string> = {};
      Object.entries(prev).forEach(([key, value]) => {
        const keyNum = Number(key);
        if (keyNum < index) next[keyNum] = value;
        else if (keyNum > index) next[keyNum - 1] = value;
      });
      return next;
    });
  };

  const handleFileDrop = (index: number, files: File[]) => {
    if (readOnly || files.length === 0) return;
    const file = files[0];

    if (fileErrors[index]) {
      const newErrors = { ...fileErrors };
      delete newErrors[index];
      setFileErrors(newErrors);
    }

    if (file.size > MAX_SUPPORTING_DOCUMENT_SIZE) {
      setFileErrors((prev) => ({
        ...prev,
        [index]: `File size exceeds 5MB limit. Current size: ${(file.size / (1024 * 1024)).toFixed(2)}MB`,
      }));
      ToastNotification({
        type: "error",
        message: `File "${file.name}" exceeds 5MB limit`,
      });
      return;
    }

    updateDocument(index, {
      file,
      document_url: undefined,
      document_id: undefined,
      original_document_name: undefined,
    });
  };

  const rows =
    documents.length > 0 ? documents : [{ ...EMPTY_SUPPORTING_DOCUMENT }];

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title}
      size="xl"
      centered
      zIndex={zIndex}
      styles={{ title: { fontWeight: 600, color: "#105476" } }}
    >
      <Stack gap="sm">
        {rows.map((doc, index) => (
          <Grid key={index} columns={12} gutter="sm" align="flex-end">
            <Grid.Col span={5.5}>
              <FormTextInput
                label="Document Name"
                placeholder="Enter document name"
                value={doc.name}
                onChange={(e) =>
                  updateDocument(index, { name: e.currentTarget.value })
                }
                readOnly={readOnly}
              />
            </Grid.Col>
            <Grid.Col span={5.5}>
              <Box>
                <Text size="sm" fw={500} mb={4}>
                  File
                </Text>
                <Dropzone
                  onDrop={(files) => handleFileDrop(index, files)}
                  onReject={() => {
                    setFileErrors((prev) => ({
                      ...prev,
                      [index]: "File size exceeds 5MB limit",
                    }));
                  }}
                  maxSize={MAX_SUPPORTING_DOCUMENT_SIZE}
                  accept={undefined}
                  multiple={false}
                  disabled={readOnly}
                  styles={{
                    root: {
                      border: "1px solid var(--mantine-color-gray-4)",
                      borderRadius: "var(--mantine-radius-sm)",
                      backgroundColor: "var(--mantine-color-white)",
                      minHeight: "36px",
                      padding: 0,
                      "&:hover": {
                        borderColor: "var(--mantine-color-gray-5)",
                      },
                    },
                    inner: {
                      padding: 0,
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
                      cursor: readOnly ? "default" : "pointer",
                    }}
                  >
                    <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
                      {doc.file ? (
                        <>
                          <IconUpload
                            size={16}
                            color="var(--mantine-color-dimmed)"
                          />
                          <Text size="sm" truncate style={{ flex: 1 }}>
                            {doc.file.name}
                          </Text>
                        </>
                      ) : doc.document_url ? (
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
                                id: doc.document_id ?? 0,
                                document_url: doc.document_url,
                                document_name: doc.name,
                                file_name: doc.original_document_name,
                              });
                            }}
                          >
                            {getExistingFileLabel(doc)}
                          </Text>
                        </>
                      ) : (
                        <>
                          <IconUpload
                            size={16}
                            color="var(--mantine-color-dimmed)"
                          />
                          <Text size="sm" c="dimmed" truncate style={{ flex: 1 }}>
                            {readOnly
                              ? "No file attached"
                              : "Drag and drop or click to select file"}
                          </Text>
                        </>
                      )}
                    </Group>
                    {(doc.file || doc.document_url) && !readOnly && (
                      <Button
                        variant="subtle"
                        color="red"
                        size="xs"
                        p={4}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (fileErrors[index]) {
                            const newErrors = { ...fileErrors };
                            delete newErrors[index];
                            setFileErrors(newErrors);
                          }
                          updateDocument(index, {
                            file: null,
                            document_url: undefined,
                            document_id: undefined,
                            original_document_name: undefined,
                          });
                        }}
                        style={{ pointerEvents: "auto" }}
                      >
                        <IconX size={14} />
                      </Button>
                    )}
                  </Group>
                </Dropzone>
                {fileErrors[index] && (
                  <Text size="xs" c="red" mt={4}>
                    {fileErrors[index]}
                  </Text>
                )}
              </Box>
            </Grid.Col>
            {!readOnly && (
              <Grid.Col span={1}>
                <Button
                  type="button"
                  variant="light"
                  color="red"
                  size="sm"
                  px={12}
                  onClick={() => removeDocument(index)}
                >
                  <IconTrash size={16} />
                </Button>
              </Grid.Col>
            )}
          </Grid>
        ))}

        <Group justify="space-between" mt="sm">
          {!readOnly && (
            <Button
              type="button"
              variant="light"
              color="#105476"
              leftSection={<IconPlus size={16} />}
              onClick={() =>
                onChange([...rows, { ...EMPTY_SUPPORTING_DOCUMENT }])
              }
            >
              Add Document
            </Button>
          )}
          <Group gap="sm" ml="auto">
            <Button variant="outline" onClick={onClose}>
              {readOnly ? "Close" : "Cancel"}
            </Button>
            {onSubmit ? (
              <Button
                color="#105476"
                onClick={onSubmit}
                loading={submitLoading}
              >
                {submitLabel}
              </Button>
            ) : (
              <Button onClick={onClose}>Done</Button>
            )}
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
