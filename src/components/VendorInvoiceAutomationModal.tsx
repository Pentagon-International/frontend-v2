import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Modal,
  ScrollArea,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  ThemeIcon,
} from "@mantine/core";
import { IconFileInvoice, IconUpload } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { Dropdown, ToastNotification } from "./index";
import {
  extractSupplierInvoiceId,
  isVendorInvoiceCreated,
  isVendorInvoiceCreationSettled,
  isVendorInvoiceExtracted,
  isVendorInvoiceExtractionSettled,
  pollVendorInvoiceRecord,
  startVendorInvoiceCreation,
  uploadVendorInvoicePdf,
  type VendorInvoiceExtractedData,
  type VendorInvoiceRecord,
} from "../utils/vendorInvoiceAutomation";
import { URL } from "../api/serverUrls";
import { apiCallProtected } from "../api/axios";
import { API_HEADER } from "../store/storeKeys";
import { useIsAdminUser } from "../hooks/useIsAdminUser";
import { postAPICall } from "../service/postApiCall";
import { formatMoneyAmountForUi } from "../utils/nonDecimalMoneyAmount";

const fetchDaybookByType = async (
  documentType: "CRJ" | "CRJREV" = "CRJ",
): Promise<{ id?: number; name?: string }[]> => {
  try {
    const response = await postAPICall(
      URL.daybook,
      { filters: { document_type: documentType } },
      API_HEADER,
    );
    const data = (response as { data?: unknown[] })?.data ?? [];
    return Array.isArray(data) ? (data as { id?: number; name?: string }[]) : [];
  } catch {
    return [];
  }
};

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

function FieldKV({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string | number | null;
  mono?: boolean;
}) {
  const display =
    value === null || value === undefined || String(value).trim() === ""
      ? "—"
      : String(value);
  return (
    <Box>
      <Text size="xs" c="dimmed" mb={2}>
        {label}
      </Text>
      <Text
        size="sm"
        fw={500}
        style={mono ? { fontFamily: "monospace", fontSize: 12 } : undefined}
      >
        {display}
      </Text>
    </Box>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <Text size="sm" fw={600} c="#105476" mt="sm" mb={6}>
      {title}
    </Text>
  );
}

function ExtractedPayloadBreakdown({
  record,
  extracted,
}: {
  record: VendorInvoiceRecord;
  extracted: VendorInvoiceExtractedData;
}) {
  const isAdmin = useIsAdminUser();
  const [tab, setTab] = useState<string | null>("form");
  const hasPayload = Object.keys(extracted).length > 0;
  const statusUpper = String(extracted.status ?? "").toUpperCase();

  const tabs = useMemo(() => {
    const items = [{ value: "form", label: "Form View" }];
    if (isAdmin) items.push({ value: "raw", label: "Raw JSON" });
    return items;
  }, [isAdmin]);

  useEffect(() => {
    if (!tabs.some((t) => t.value === tab)) setTab("form");
  }, [tabs, tab]);

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(extracted, null, 2));
      ToastNotification({ type: "success", message: "JSON copied" });
    } catch {
      ToastNotification({ type: "error", message: "Copy failed" });
    }
  };

  return (
    <Box
      style={{
        border: "1px solid #e9ecef",
        borderRadius: 10,
        background: "#f8f9fa",
        overflow: "hidden",
      }}
    >
      <Group justify="space-between" p="md" pb="xs" wrap="wrap" gap="sm">
        <Box style={{ minWidth: 0, flex: 1 }}>
          <Text size="xs" c="dimmed" mb={4}>
            ID #{record.id} · {record.file_name ?? "Invoice"}
          </Text>
          <Group gap="xs" wrap="wrap">
            {extracted.Inv_Crn_no && (
              <Badge color="#105476" variant="light">
                {extracted.Inv_Crn_no}
              </Badge>
            )}
            {extracted.status && (
              <Badge
                color={statusUpper === "POSTED" ? "green" : "gray"}
                variant="light"
              >
                {extracted.status}
              </Badge>
            )}
            {extracted.Dr_Cr && (
              <Badge color={extracted.Dr_Cr === "Cr" ? "green" : "red"} variant="outline">
                {extracted.Dr_Cr}
              </Badge>
            )}
            {record.status && (
              <Badge color="blue" variant="dot">
                {record.status}
              </Badge>
            )}
          </Group>
        </Box>
        {isAdmin && (
          <Button variant="light" size="xs" color="#105476" onClick={copyJson}>
            Copy JSON
          </Button>
        )}
      </Group>

      <Tabs value={tab} onChange={setTab} px="md" pb="md">
        <Tabs.List>
          {tabs.map((t) => (
            <Tabs.Tab key={t.value} value={t.value}>
              {t.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>

        <Tabs.Panel value="form" pt="sm">
          {!hasPayload ? (
            <Text size="sm" c="dimmed" ta="center" py="lg">
              No extracted data yet
            </Text>
          ) : (
            <ScrollArea.Autosize mah="55vh" type="auto" offsetScrollbars>
              <Stack gap="xs" pr="xs">
                <SectionTitle title="Invoice Details" />
                <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="sm">
                  <FieldKV label="Date" value={extracted.date} />
                  <FieldKV label="Due Date" value={extracted.due_date} />
                  <FieldKV
                    label="PRQ Reference No."
                    value={extracted.prq_reference_no}
                    mono
                  />
                  <FieldKV
                    label="Inv / CRN No."
                    value={extracted.Inv_Crn_no}
                    mono
                  />
                  <FieldKV label="Job No." value={extracted.job_no} />
                  <FieldKV label="Master No." value={extracted.master_bl} />
                </SimpleGrid>

                <SectionTitle title="Parties" />
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  <FieldKV label="Agent Name" value={extracted.agent_name} />
                  <FieldKV
                    label="Customer GST No."
                    value={extracted.customer_gst_no}
                    mono
                  />
                  <FieldKV
                    label="Location GST No."
                    value={extracted.location_gst_no}
                    mono
                  />
                </SimpleGrid>

                <SectionTitle title="Tax Summary" />
                <SimpleGrid cols={{ base: 2, sm: 5 }} spacing="xs">
                  {[
                    { label: "Taxable", value: extracted.taxable_amount },
                    { label: "Non-Taxable", value: extracted.non_taxable_amount },
                    { label: "CGST", value: extracted.cgst_amount },
                    { label: "SGST", value: extracted.sgst_amount },
                    { label: "IGST", value: extracted.igst_amount },
                  ].map((cell) => (
                    <Box
                      key={cell.label}
                      p="sm"
                      style={{
                        background: "#fff",
                        border: "1px solid #e9ecef",
                        borderRadius: 8,
                        textAlign: "center",
                      }}
                    >
                      <Text size="sm" fw={600}>
                        {cell.value != null && String(cell.value).trim() !== ""
                          ? `₹${cell.value}`
                          : "—"}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {cell.label}
                      </Text>
                    </Box>
                  ))}
                </SimpleGrid>

                <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm" mt="xs">
                  <FieldKV
                    label="Inv / CRN Amount"
                    value={
                      extracted.Inv_crn_amount
                        ? `₹${extracted.Inv_crn_amount}`
                        : undefined
                    }
                  />
                  <FieldKV
                    label="Approved Amount"
                    value={
                      extracted.approved_amount
                        ? `₹${extracted.approved_amount}`
                        : undefined
                    }
                  />
                  <FieldKV
                    label="Difference Amount"
                    value={
                      extracted.difference_amount
                        ? `₹${extracted.difference_amount}`
                        : undefined
                    }
                  />
                </SimpleGrid>

                {Array.isArray(extracted.charges_data) &&
                  extracted.charges_data.length > 0 && (
                    <>
                      <SectionTitle
                        title={`Charge Lines (${extracted.charges_data.length})`}
                      />
                      <ScrollArea type="auto" offsetScrollbars>
                        <Table
                          striped
                          highlightOnHover
                          withTableBorder
                          withColumnBorders
                          fz="xs"
                          style={{ minWidth: 900 }}
                        >
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th>#</Table.Th>
                              <Table.Th>Narration</Table.Th>
                              <Table.Th>Shipment No.</Table.Th>
                              <Table.Th>HSN/SAC Code</Table.Th>
                              <Table.Th>Dr/Cr</Table.Th>
                              <Table.Th>Amount</Table.Th>
                              <Table.Th>Local Amt</Table.Th>
                              <Table.Th>ROE</Table.Th>
                              <Table.Th>CGST</Table.Th>
                              <Table.Th>SGST</Table.Th>
                              <Table.Th>IGST</Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {extracted.charges_data.map((c, i) => (
                              <Table.Tr key={i}>
                                <Table.Td>{i + 1}</Table.Td>
                                <Table.Td style={{ maxWidth: 200 }}>
                                  {c.narration ?? "—"}
                                </Table.Td>
                                <Table.Td>{c.shipment_no ?? "—"}</Table.Td>
                                <Table.Td>{c.hsn_sac_code ?? "—"}</Table.Td>
                                <Table.Td>
                                  <Badge
                                    size="xs"
                                    color={c.Dr_Cr === "Cr" ? "green" : "red"}
                                    variant="light"
                                  >
                                    {c.Dr_Cr ?? "—"}
                                  </Badge>
                                </Table.Td>
                                <Table.Td>₹{c.amount ?? "—"}</Table.Td>
                                <Table.Td>
                                  ₹
                                  {c.amount_in_local == null
                                    ? "—"
                                    : formatMoneyAmountForUi(
                                        Number(c.amount_in_local),
                                      )}
                                </Table.Td>
                                <Table.Td>{c.roe ?? "—"}</Table.Td>
                                <Table.Td>
                                  {c.cgst != null
                                    ? `₹${c.cgst} (${c.cgst_rate}%)`
                                    : "—"}
                                </Table.Td>
                                <Table.Td>
                                  {c.sgst != null
                                    ? `₹${c.sgst} (${c.sgst_rate}%)`
                                    : "—"}
                                </Table.Td>
                                <Table.Td>
                                  {c.igst != null
                                    ? `₹${c.igst} (${c.igst_rate}%)`
                                    : "—"}
                                </Table.Td>
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
                        </Table>
                      </ScrollArea>
                    </>
                  )}

                {record.failer_message && (
                  <>
                    <SectionTitle title="Error Details" />
                    <Box
                      p="sm"
                      style={{
                        background: "#fff5f5",
                        border: "1px solid #ffc9c9",
                        borderRadius: 8,
                      }}
                    >
                      <Text size="sm" c="red">
                        {record.failer_message}
                      </Text>
                    </Box>
                  </>
                )}
              </Stack>
            </ScrollArea.Autosize>
          )}
        </Tabs.Panel>

        {isAdmin && (
          <Tabs.Panel value="raw" pt="sm">
            <ScrollArea.Autosize mah="55vh" type="auto" offsetScrollbars>
              <Box
                component="pre"
                p="sm"
                style={{
                  margin: 0,
                  background: "#fff",
                  border: "1px solid #e9ecef",
                  borderRadius: 8,
                  fontFamily: "monospace",
                  fontSize: 12,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {JSON.stringify(extracted, null, 2)}
              </Box>
            </ScrollArea.Autosize>
          </Tabs.Panel>
        )}
      </Tabs>
    </Box>
  );
}

export function VendorInvoiceAutomationModal({
  opened,
  onClose,
  shipmentNo,
}: VendorInvoiceAutomationModalProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputId = useId();
  const resetKeyRef = useRef(0);

  const [step, setStep] = useState<ModalStep>("upload");
  const [files, setFiles] = useState<File[]>([]);
  const [record, setRecord] = useState<VendorInvoiceRecord | null>(null);
  const [dayBookId, setDayBookId] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [startingJob, setStartingJob] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const { data: daybookData = [], isLoading: isDaybookLoading } = useQuery({
    queryKey: ["daybook", "CRJ", "vendor-invoice-automation"],
    queryFn: () => fetchDaybookByType("CRJ"),
    staleTime: Infinity,
    enabled: opened,
  });

  const daybookOptions = useMemo(() => {
    if (!Array.isArray(daybookData)) return [];
    return daybookData
      .map((item) => ({
        value: String(item.id ?? ""),
        label: item.name ?? "",
      }))
      .filter((o) => o.value);
  }, [daybookData]);

  const resetModal = useCallback(() => {
    resetKeyRef.current += 1;
    setStep("upload");
    setFiles([]);
    setRecord(null);
    setDayBookId("");
    setUploading(false);
    setStartingJob(false);
    // Keep isRedirecting so the full-screen loader stays visible after modal close
  }, []);

  useEffect(() => {
    if (!opened && !isRedirecting) {
      resetModal();
    }
  }, [opened, isRedirecting, resetModal]);

  const handleClose = () => {
    if (uploading || startingJob || isRedirecting) return;
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
        isVendorInvoiceExtractionSettled,
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
    setIsRedirecting(true);
    const returnNav = {
      returnTo: `${location.pathname}${location.search}`,
      ...(location.state != null ? { returnToState: location.state } : {}),
    };
    try {
      const res = await apiCallProtected.get(
        `${URL.supplierInvoice}${invoiceId}/`,
        API_HEADER,
      );
      const invoiceRecord = resolveSupplierInvoiceRecord(res);
      navigate("/supplier-invoice/edit", {
        state: { ...(invoiceRecord ?? { id: invoiceId }), ...returnNav },
      });
    } catch {
      navigate(`/supplier-invoice/edit/${invoiceId}`, { state: returnNav });
    }
  };

  const handleStartJob = async () => {
    if (!record?.id || !shipmentNo.trim()) return;
    const parsedDayBookId = Number(dayBookId);
    if (!Number.isFinite(parsedDayBookId) || parsedDayBookId <= 0) {
      ToastNotification({
        type: "error",
        message: "Please select a day book before starting invoice creation.",
      });
      return;
    }
    setStartingJob(true);
    setStep("creating");
    try {
      const startResponse = await startVendorInvoiceCreation(
        [record.id],
        shipmentNo.trim(),
        parsedDayBookId,
      );
      let invoiceId = extractSupplierInvoiceId(startResponse, record);

      if (!invoiceId) {
        const createdRecord = await pollVendorInvoiceRecord(
          record.id,
          (item) => isVendorInvoiceCreationSettled(item),
        );
        // Throws on INVOICE_FAILED
        const created = isVendorInvoiceCreated(createdRecord);
        invoiceId = extractSupplierInvoiceId(null, createdRecord);
        if (!invoiceId && created) {
          throw new Error(
            "Invoice was created but vendor invoice id was not returned.",
          );
        }
      }

      if (!invoiceId) {
        throw new Error("Vendor invoice was not created.");
      }

      ToastNotification({
        type: "success",
        message: "Vendor invoice created successfully. Navigating to vendor invoice edit page...",
      });
      await redirectToSupplierInvoiceEdit(invoiceId);
      onClose();
    } catch (error) {
      setIsRedirecting(false);
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
    <>
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
      size={step === "review" ? "xl" : "lg"}
      centered
      closeOnClickOutside={!uploading && !startingJob && !isRedirecting}
      closeOnEscape={!uploading && !startingJob && !isRedirecting}
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
                : isRedirecting
                  ? "Opening vendor invoice..."
                  : "Creating vendor invoice..."}
            </Text>
          </Stack>
        )}

        {step === "review" && record && (
          <>
            <ExtractedPayloadBreakdown
              record={record}
              extracted={extracted}
            />
            
            <Group justify="space-between">
              <Dropdown
                placeholder={
                  isDaybookLoading ? "Loading..." : "Select day book"
                }
                data={daybookOptions}
                value={dayBookId || null}
                onChange={(v) => setDayBookId(v ?? "")}
                searchable
                withAsterisk
                disabled={isDaybookLoading || startingJob}
                dropdownZIndex={400}
              />
              <Group gap="sm">
              <Button variant="default" onClick={handleClose} disabled={startingJob}>
                Cancel
              </Button>
              <Button
                color="#105476"
                loading={startingJob}
                disabled={!dayBookId || isDaybookLoading}
                onClick={handleStartJob}
              >
                Start Job
              </Button>
              </Group>
            </Group>
          </>
        )}
      </Stack>
    </Modal>
    </>
  );
}
