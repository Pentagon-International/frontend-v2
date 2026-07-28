import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  Box,
  Button,
  Group,
  Loader,
  Modal,
  Stack,
  Text,
  ThemeIcon,
} from "@mantine/core";
import { IconFileInvoice, IconUpload } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { ToastNotification } from "./index";
import {
  extractSupplierInvoiceId,
  isVendorInvoiceCreated,
  isVendorInvoiceExtracted,
  pollVendorInvoiceRecord,
  startVendorInvoiceCreation,
  uploadVendorInvoicePdf,
  type VendorInvoiceRecord,
} from "../utils/vendorInvoiceAutomation";
import { URL } from "../api/serverUrls";
import { apiCallProtected } from "../api/axios";
import { API_HEADER } from "../store/storeKeys";

type ModalStep = "upload" | "extracting" | "review" | "creating";

type VendorInvoiceAutomationModalProps = {
  opened: boolean;
  onClose: () => void;
  shipmentNo: string;
};

function resolveSupplierInvoiceRecord(raw: unknown): Record<string, unknown> | null {
  const payload = raw as { data?: unknown };
  const data = payload?.data ?? raw;
  if (Array.isArray(data)) {
    return data.length > 0 && typeof data[0] === "object"
      ? (data[0] as Record<string, unknown>)
      : null;
  }
  return data && typeof data === "object" ? (data as Record<string, unknown>) : null;
}

export function VendorInvoiceAutomationModal({
  opened,
  onClose,
  shipmentNo,
}: VendorInvoiceAutomationModalProps) {
  const navigate = useNavigate();
  const fileInputId = useId();
  const resetKeyRef = useRef(0);

  const [step, setStep] = useState<ModalStep>("upload");
  const [files, setFiles] = useState<File[]>([]);
  const [record, setRecord] = useState<VendorInvoiceRecord | null>(null);
  const [uploading, setUploading] = useState(false);
  const [startingJob, setStartingJob] = useState(false);

  const resetModal = useCallback(() => {
    resetKeyRef.current += 1;
    setStep("upload");
    setFiles([]);
    setRecord(null);
    setUploading(false);
    setStartingJob(false);
  }, []);

  useEffect(() => {
    if (!opened) {
      resetModal();
    }
  }, [opened, resetModal]);

  const handleClose = () => {
    if (uploading || startingJob) return;
    onClose();
  };

  const addFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const allowed = /\.(pdf|jpg|jpeg|png|gif|bmp|webp|tiff?|svg)$/i;
    const next = Array.from(fileList).filter((f) => allowed.test(f.name));
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...next.filter((f) => !names.has(f.name))];
    });
  };

  const handleUploadAndExtract = async () => {
    if (!files.length || !shipmentNo.trim()) return;
    setUploading(true);
    setStep("extracting");
    try {
      const { recordId } = await uploadVendorInvoicePdf(files);
      const extractedRecord = await pollVendorInvoiceRecord(
        recordId,
        (item) =>
          item.status === "done" ||
          item.status === "COMPLETED" ||
          item.status === "failed" ||
          isVendorInvoiceExtracted(item),
      );
      if (!isVendorInvoiceExtracted(extractedRecord)) {
        throw new Error(
          extractedRecord.failer_message || "No extracted invoice data found.",
        );
      }
      setRecord(extractedRecord);
      setStep("review");
    } catch (error) {
      ToastNotification({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to upload and extract vendor invoice.",
      });
      setStep("upload");
    } finally {
      setUploading(false);
    }
  };

  const redirectToSupplierInvoiceEdit = async (invoiceId: number) => {
    try {
      const res = await apiCallProtected.get(
        `${URL.supplierInvoice}${invoiceId}/`,
        API_HEADER,
      );
      const invoiceRecord = resolveSupplierInvoiceRecord(res);
      navigate("/supplier-invoice/edit", {
        state: invoiceRecord ?? { id: invoiceId },
      });
    } catch {
      navigate(`/supplier-invoice/edit/${invoiceId}`);
    }
  };

  const handleStartJob = async () => {
    if (!record?.id || !shipmentNo.trim()) return;
    setStartingJob(true);
    setStep("creating");
    try {
      const startResponse = await startVendorInvoiceCreation(
        [record.id],
        shipmentNo.trim(),
      );
      let invoiceId = extractSupplierInvoiceId(startResponse, record);

      if (!invoiceId) {
        const createdRecord = await pollVendorInvoiceRecord(
          record.id,
          (item) =>
            item.status === "INVOICE_CREATED" ||
            item.status === "failed" ||
            extractSupplierInvoiceId(null, item) != null,
        );
        invoiceId = extractSupplierInvoiceId(null, createdRecord);
        if (!invoiceId && isVendorInvoiceCreated(createdRecord)) {
          throw new Error(
            "Invoice was created but supplier invoice id was not returned.",
          );
        }
      }

      if (!invoiceId) {
        throw new Error("Supplier invoice was not created.");
      }

      ToastNotification({
        type: "success",
        message: "Vendor invoice created successfully.",
      });
      onClose();
      await redirectToSupplierInvoiceEdit(invoiceId);
    } catch (error) {
      ToastNotification({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to start vendor invoice creation.",
      });
      setStep("review");
    } finally {
      setStartingJob(false);
    }
  };

  const extracted = record?.extracted_data ?? {};

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Group gap="sm">
          <ThemeIcon size={32} radius="md" color="#105476" variant="light">
            <IconFileInvoice size={18} />
          </ThemeIcon>
          <Box>
            <Text fw={600} size="sm">
              Automate Vendor Invoice
            </Text>
            <Text size="xs" c="dimmed">
              Shipment: {shipmentNo || "—"}
            </Text>
          </Box>
        </Group>
      }
      size="lg"
      centered
      closeOnClickOutside={!uploading && !startingJob}
      closeOnEscape={!uploading && !startingJob}
    >
      <Stack gap="md">
        {step === "upload" && (
          <>
            <Box
              onClick={() =>
                (document.getElementById(fileInputId) as HTMLInputElement)?.click()
              }
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                addFiles(e.dataTransfer.files);
              }}
              style={{
                border: "1.5px dashed #7dd3fc",
                borderRadius: 12,
                padding: 28,
                textAlign: "center",
                cursor: "pointer",
                background: "#f0f9ff",
              }}
            >
              <IconUpload size={28} color="#105476" />
              <Text size="sm" mt="xs">
                Drop invoice PDF or click to browse
              </Text>
              <Text size="xs" c="dimmed">
                PDF or image formats supported
              </Text>
            </Box>
            <input
              id={fileInputId}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.gif,.bmp,.webp,.tiff,.tif,.svg,image/*"
              multiple
              onChange={(e) => addFiles(e.target.files)}
              style={{ display: "none" }}
            />
            {files.map((file, index) => (
              <Group
                key={`${file.name}-${index}`}
                justify="space-between"
                p="xs"
                style={{ border: "1px solid #e9ecef", borderRadius: 8 }}
              >
                <Text size="sm" fw={500}>
                  {file.name}
                </Text>
                <Button
                  variant="subtle"
                  color="red"
                  size="xs"
                  onClick={() =>
                    setFiles((prev) => prev.filter((_, i) => i !== index))
                  }
                >
                  Remove
                </Button>
              </Group>
            ))}
            <Group justify="flex-end">
              <Button variant="default" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                color="#105476"
                leftSection={<IconUpload size={16} />}
                disabled={!files.length || uploading}
                onClick={handleUploadAndExtract}
              >
                Upload & Extract
              </Button>
            </Group>
          </>
        )}

        {(step === "extracting" || step === "creating") && (
          <Stack align="center" py="xl" gap="sm">
            <Loader color="#105476" />
            <Text size="sm" fw={500}>
              {step === "extracting"
                ? "Extracting invoice data..."
                : "Creating supplier invoice..."}
            </Text>
          </Stack>
        )}

        {step === "review" && record && (
          <>
            <Box
              p="md"
              style={{
                border: "1px solid #e9ecef",
                borderRadius: 10,
                background: "#f8f9fa",
              }}
            >
              <Text size="sm" fw={600} mb={8}>
                Extracted Invoice
              </Text>
              <Stack gap={4}>
                <Text size="sm">
                  <Text span c="dimmed">
                    File:{" "}
                  </Text>
                  {record.file_name ?? "—"}
                </Text>
                <Text size="sm">
                  <Text span c="dimmed">
                    Inv / CRN No:{" "}
                  </Text>
                  {extracted.Inv_Crn_no ?? "—"}
                </Text>
                <Text size="sm">
                  <Text span c="dimmed">
                    Agent:{" "}
                  </Text>
                  {extracted.agent_name ?? "—"}
                </Text>
                <Text size="sm">
                  <Text span c="dimmed">
                    Amount:{" "}
                  </Text>
                  {extracted.Inv_crn_amount
                    ? `₹${extracted.Inv_crn_amount}`
                    : "—"}
                </Text>
                <Text size="sm">
                  <Text span c="dimmed">
                    Charge lines:{" "}
                  </Text>
                  {extracted.charges_data?.length ?? 0}
                </Text>
              </Stack>
            </Box>
            <Group justify="flex-end">
              <Button variant="default" onClick={handleClose} disabled={startingJob}>
                Cancel
              </Button>
              <Button
                color="#105476"
                loading={startingJob}
                onClick={handleStartJob}
              >
                Start Job
              </Button>
            </Group>
          </>
        )}
      </Stack>
    </Modal>
  );
}
