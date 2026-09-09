import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Modal,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  ThemeIcon,
} from "@mantine/core";
import { IconFileInvoice, IconUpload } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { Dropdown, SearchableSelect, SingleDateInput, ToastNotification } from "./index";
import {
  buildVendorInvoiceOverrideDraft,
  buildVendorInvoiceStartPayload,
  extractSupplierInvoiceId,
  isVendorInvoiceCreated,
  isVendorInvoiceCreationSettled,
  isVendorInvoiceExtracted,
  isVendorInvoiceExtractionSettled,
  isOverseasCrjDaybook,
  isVendorInvoiceAlreadyCreated,
  isVendorInvoiceOverrideReady,
  normalizeVendorInvoiceDrCr,
  isVendorInvoiceAbortError,
  pollVendorInvoiceRecord,
  startVendorInvoiceCreation,
  uploadVendorInvoicePdf,
  type VendorInvoiceExtractedData,
  type VendorInvoiceOverrideDraft,
  type VendorInvoiceRecord,
} from "../utils/vendorInvoiceAutomation";
import { URL } from "../api/serverUrls";
import { apiCallProtected } from "../api/axios";
import { API_HEADER } from "../store/storeKeys";
import { useIsAdminUser } from "../hooks/useIsAdminUser";
import { postAPICall } from "../service/postApiCall";

const CRJ_DAYBOOK_TYPES = ["LOCAL CRJ", "OVERSEAS CRJ"] as const;

const fetchCrjDaybooks = async (): Promise<{ id?: number; name?: string }[]> => {
  try {
    const response = await postAPICall(
      URL.daybook,
      { filters: { document_type: "CRJ" } },
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
  shipmentNo?: string;
  /** Existing extracted record. Skips upload and opens the same review preview. */
  reviewRecord?: VendorInvoiceRecord | null;
  onStarted?: () => void;
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
      <Text size="xs" c="dimmed" mb={4} fw={500}>
        {label}
      </Text>
      <Text
        size="sm"
        fw={500}
        style={mono ? { fontFamily: "Inter", fontSize: 13, letterSpacing: 0.2 } : undefined}
      >
        {display}
      </Text>
    </Box>
  );
}

function PreviewSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <Box
      p="md"
      style={{
        background: "#fff",
        border: "1px solid #e9ecef",
        borderRadius: 10,
      }}
    >
      <Group justify="space-between" align="baseline" mb={hint ? 2 : 10} wrap="nowrap">
        <Text size="sm" fw={600} c="#105476">
          {title}
        </Text>
      </Group>
      {hint ? (
        <Text size="xs" c="dimmed" mb={10}>
          {hint}
        </Text>
      ) : null}
      {children}
    </Box>
  );
}

function AmountTile({ label, value }: { label: string; value?: string | number | null }) {
  const text =
    value == null || String(value).trim() === "" ? "—" : `₹${value}`;
  return (
    <Box
      p="sm"
      style={{
        background: "#f8fafc",
        border: "1px solid #e9ecef",
        borderRadius: 8,
      }}
    >
      <Text size="xs" c="dimmed" mb={2}>
        {label}
      </Text>
      <Text size="sm" fw={600}>
        {text}
      </Text>
    </Box>
  );
}

const DR_CR_OPTIONS = [
  { value: "DR", label: "DR" },
  { value: "CR", label: "CR" },
];

const STATUS_OPTIONS = [{ value: "UNPOSTED", label: "UNPOSTED" }];

const fieldStyles = {
  label: {
    fontSize: 12,
    fontWeight: 500,
    color: "#495057",
    marginBottom: 4,
    fontFamily: "Inter",
  },
  input: {
    fontSize: 13,
    fontFamily: "Inter",
    height: 36,
    background: "#fff",
  },
} as const;

function isoDateToDate(value: string): Date | null {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateToIso(value: Date | null): string {
  if (!value) return "";
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${value.getFullYear()}-${month}-${day}`;
}

function ExtractedPayloadBreakdown({
  record,
  extracted,
  shipmentNo,
  shipmentEditable = false,
  onShipmentNoChange,
  override,
  onOverrideChange,
  readOnly = false,
}: {
  record: VendorInvoiceRecord;
  extracted: VendorInvoiceExtractedData;
  shipmentNo: string;
  shipmentEditable?: boolean;
  onShipmentNoChange?: (value: string) => void;
  override: VendorInvoiceOverrideDraft;
  onOverrideChange: (next: VendorInvoiceOverrideDraft) => void;
  readOnly?: boolean;
}) {
  const isAdmin = useIsAdminUser();
  const [tab, setTab] = useState<string | null>("form");
  const hasPayload = Object.keys(extracted).length > 0;
  const statusUpper = String(override.status || extracted.status || "").toUpperCase();

  const tabs = useMemo(() => {
    const items = [{ value: "form", label: "Form View" }];
    if (isAdmin) items.push({ value: "raw", label: "Raw JSON" });
    return items;
  }, [isAdmin]);

  useEffect(() => {
    if (!tabs.some((t) => t.value === tab)) setTab("form");
  }, [tabs, tab]);

  const patchOverride = (patch: Partial<VendorInvoiceOverrideDraft>) => {
    onOverrideChange({ ...override, ...patch });
  };

  const patchCharge = (
    index: number,
    patch: Partial<VendorInvoiceOverrideDraft["charges_data"][number]>,
  ) => {
    onOverrideChange({
      ...override,
      charges_data: override.charges_data.map((row, i) =>
        i === index ? { ...row, ...patch } : row,
      ),
    });
  };

  const [daybookLookupRequested, setDaybookLookupRequested] = useState(false);
  const needsDaybookLabel = Boolean(override.day_book_id) && !String(override.day_book_name ?? "").trim();
  const { data: daybookData = [], isLoading: isDaybookLoading } = useQuery({
    queryKey: ["daybook", "CRJ", "vendor-invoice-automation"],
    queryFn: fetchCrjDaybooks,
    enabled: !readOnly && tab === "form" && (daybookLookupRequested || needsDaybookLabel),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const daybookOptions = useMemo(() => {
    const options = (Array.isArray(daybookData) ? daybookData : [])
      .map((item) => ({
        value: String(item.id ?? ""),
        label: String(item.name ?? "").trim(),
      }))
      .filter(
        (option) =>
          option.value &&
          CRJ_DAYBOOK_TYPES.includes(
            option.label.toUpperCase() as (typeof CRJ_DAYBOOK_TYPES)[number],
          ),
      );
    const currentId = String(override.day_book_id ?? "").trim();
    const currentName = String(override.day_book_name ?? "").trim();
    if (currentId && currentName && !options.some((option) => option.value === currentId)) {
      options.unshift({ value: currentId, label: currentName });
    }
    return options;
  }, [daybookData, override.day_book_id, override.day_book_name]);

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
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        maxWidth: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Group justify="space-between" p="md" pb="xs" wrap="nowrap" gap="sm" style={{ flexShrink: 0 }}>
        <Box style={{ minWidth: 0, flex: 1 }}>
          <Text size="xs" c="dimmed" mb={4}>
            ID #{record.id} · {record.file_name ?? "Invoice"}
          </Text>
          <Group gap="xs" wrap="wrap">
            {(override.Inv_Crn_no || extracted.Inv_Crn_no) && (
              <Badge color="#105476" variant="light">
                {override.Inv_Crn_no || extracted.Inv_Crn_no}
              </Badge>
            )}
            {(override.status || extracted.status) && (
              <Badge
                color={statusUpper === "POSTED" ? "green" : "gray"}
                variant="light"
              >
                {override.status || extracted.status}
              </Badge>
            )}
            {(override.Dr_Cr || extracted.Dr_Cr) && (
              <Badge
                color={
                  (override.Dr_Cr || extracted.Dr_Cr) === "CR" ||
                  (override.Dr_Cr || extracted.Dr_Cr) === "Cr"
                    ? "green"
                    : "red"
                }
                variant="outline"
              >
                {override.Dr_Cr || extracted.Dr_Cr}
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

      <Tabs
        value={tab}
        onChange={setTab}
        px="md"
        pb="md"
        style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}
      >
        <Tabs.List style={{ flexShrink: 0 }}>
          {tabs.map((t) => (
            <Tabs.Tab key={t.value} value={t.value}>
              {t.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>

        <Tabs.Panel
          value="form"
          pt="sm"
          style={{ flex: 1, minHeight: 0, minWidth: 0, maxWidth: "100%", overflow: "hidden", display: "flex", flexDirection: "column" }}
        >
          {!hasPayload ? (
            <Text size="sm" c="dimmed" ta="center" py="lg">
              No extracted data yet
            </Text>
          ) : (
            <Box
              style={{
                flex: 1,
                minHeight: 0,
                maxHeight: "calc(100dvh - 17rem)",
                overflowX: "hidden",
                overflowY: "auto",
                minWidth: 0,
                maxWidth: "100%",
              }}
            >
              <Stack gap="sm" pr="xs">
                <PreviewSection
                  title="Invoice to create"
                  hint="These fields are sent when you start invoice creation. Names are shown; the matching id is stored."
                >
                  <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
                    {shipmentEditable && (
                      <TextInput
                        label="Shipment No."
                        placeholder="Shipment no."
                        withAsterisk
                        value={shipmentNo}
                        onChange={(e) => {
                          const next = e.currentTarget.value;
                          onShipmentNoChange?.(next);
                          patchOverride({
                            charges_data: override.charges_data.map((row) =>
                              row.shipment_no && row.shipment_no !== shipmentNo
                                ? row
                                : { ...row, shipment_no: next },
                            ),
                          });
                        }}
                        styles={fieldStyles}
                        disabled={readOnly}
                      />
                    )}
                    <Dropdown
                      label="Day Book"
                      placeholder={isDaybookLoading ? "Loading..." : "Select day book"}
                      data={daybookOptions}
                      value={override.day_book_id || null}
                      onChange={(value) => {
                        const selected = daybookOptions.find((option) => option.value === value);
                        patchOverride({
                          day_book_id: value ?? "",
                          day_book_name: selected?.label ?? "",
                        });
                      }}
                      onDropdownOpen={() => setDaybookLookupRequested(true)}
                      searchable
                      withAsterisk
                      disabled={readOnly}
                      dropdownZIndex={400}
                    />
                    <SingleDateInput
                      label="Date"
                      placeholder="Select date"
                      withAsterisk
                      size="sm"
                      value={isoDateToDate(override.date)}
                      onChange={(date) => patchOverride({ date: dateToIso(date) })}
                      styles={fieldStyles}
                      disabled={readOnly}
                    />
                    <TextInput
                      label="Inv / CRN No."
                      placeholder="Inv / CRN No."
                      withAsterisk
                      value={override.Inv_Crn_no}
                      onChange={(e) => patchOverride({ Inv_Crn_no: e.currentTarget.value })}
                      styles={fieldStyles}
                      disabled={readOnly}
                    />
                    <SearchableSelect
                      label="Agent"
                      placeholder="Search agent"
                      withAsterisk
                      apiEndpoint={URL.agent}
                      value={override.agent_id || null}
                      displayValue={override.agent_name || undefined}
                      dropdownZIndex={400}
                      minSearchLength={1}
                      searchFields={["customer_name", "customer_code", "id"]}
                      styles={fieldStyles}
                      displayFormat={(item) => ({
                        value: String(item.id ?? ""),
                        label: String(item.customer_name ?? item.agent_name ?? ""),
                      })}
                      onChange={(value, selected) =>
                        patchOverride({
                          agent_id: value ?? "",
                          agent_name: selected?.label ?? "",
                        })
                      }
                      disabled={readOnly}
                    />
                    <SearchableSelect
                      label="State"
                      placeholder="Search state"
                      withAsterisk={!isOverseasCrjDaybook(override.day_book_name)}
                      apiEndpoint={URL.state}
                      value={override.state_id || null}
                      displayValue={override.state_name || undefined}
                      dropdownZIndex={400}
                      minSearchLength={1}
                      searchFields={["state_name", "id"]}
                      styles={fieldStyles}
                      displayFormat={(item) => ({
                        value: String(item.id ?? ""),
                        label: String(item.state_name ?? ""),
                      })}
                      onChange={(value, selected) =>
                        patchOverride({
                          state_id: value ?? "",
                          state_name: selected?.label ?? "",
                        })
                      }
                      disabled={readOnly}
                    />
                    <SearchableSelect
                      label="Currency"
                      placeholder="Search currency"
                      withAsterisk
                      apiEndpoint={URL.currencyMaster}
                      value={override.currency_id || null}
                      displayValue={
                        [override.currency_code, override.currency_name]
                          .filter(Boolean)
                          .join(" · ") || undefined
                      }
                      dropdownZIndex={400}
                      minSearchLength={1}
                      searchFields={["currency_code", "currency_name", "code", "name", "id"]}
                      returnOriginalData
                      styles={fieldStyles}
                      displayFormat={(item) => ({
                        value: String(item.id ?? ""),
                        label: String(item.currency_code ?? item.code ?? ""),
                      })}
                      onChange={(value, selected, original) => {
                        const code = String(
                          original?.currency_code ??
                            original?.code ??
                            selected?.label ??
                            "",
                        );
                        const name = String(
                          original?.currency_name ?? original?.name ?? "",
                        );
                        patchOverride({
                          currency_id: value ?? "",
                          currency_code: code,
                          currency_name: name,
                          charges_data: override.charges_data.map((row) =>
                            row.currency_id
                              ? row
                              : {
                                  ...row,
                                  currency_id: value ?? "",
                                  currency_code: code,
                                },
                          ),
                        });
                      }}
                      disabled={readOnly}
                    />
                    <TextInput
                      label="Taxable Amount"
                      placeholder="0.00"
                      withAsterisk
                      value={override.taxable_amount}
                      onChange={(e) =>
                        patchOverride({ taxable_amount: e.currentTarget.value })
                      }
                      styles={fieldStyles}
                      disabled={readOnly}
                    />
                    <TextInput
                      label="Inv / CRN Amount"
                      placeholder="0.00"
                      withAsterisk
                      value={override.Inv_crn_amount}
                      onChange={(e) =>
                        patchOverride({ Inv_crn_amount: e.currentTarget.value })
                      }
                      styles={fieldStyles}
                      disabled={readOnly}
                    />
                    <Dropdown
                      label="Status"
                      placeholder="Status"
                      data={
                        override.status && override.status !== "UNPOSTED"
                          ? [...STATUS_OPTIONS, { value: override.status, label: override.status }]
                          : STATUS_OPTIONS
                      }
                      value={override.status || null}
                      onChange={(value) => patchOverride({ status: value ?? "" })}
                      withAsterisk
                      searchable
                      disabled={readOnly}
                      dropdownZIndex={400}
                    />
                    <Dropdown
                      label="Dr/Cr"
                      placeholder="Dr/Cr"
                      data={DR_CR_OPTIONS}
                      value={override.Dr_Cr || null}
                      onChange={(value) => {
                        const next = normalizeVendorInvoiceDrCr(value);
                        patchOverride({
                          Dr_Cr: next,
                          charges_data: override.charges_data.map((row) =>
                            row.Dr_Cr ? row : { ...row, Dr_Cr: next },
                          ),
                        });
                      }}
                      withAsterisk
                      disabled={readOnly}
                      dropdownZIndex={400}
                    />
                  </SimpleGrid>
                </PreviewSection>

                <PreviewSection
                  title="Extracted reference"
                  hint="Read-only values from the document. They are not sent in the override."
                >
                  <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="md">
                    <FieldKV label="Due Date" value={extracted.due_date} />
                    <FieldKV label="PRQ Reference No." value={extracted.prq_reference_no} mono />
                    <FieldKV label="Job No." value={extracted.job_no} />
                    <FieldKV label="Master No." value={extracted.master_bl} />
                    <FieldKV label="Type" value={extracted.type} />
                    <FieldKV label="Customer GST No." value={extracted.customer_gst_no} mono />
                    <FieldKV label="Location GST No." value={extracted.location_gst_no} mono />
                  </SimpleGrid>
                </PreviewSection>

                <PreviewSection title="Amounts">
                  <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs">
                    <AmountTile label="Taxable" value={extracted.taxable_amount} />
                    <AmountTile label="Non-Taxable" value={extracted.non_taxable_amount} />
                    <AmountTile label="CGST" value={extracted.cgst_amount} />
                    <AmountTile label="SGST" value={extracted.sgst_amount} />
                    <AmountTile label="IGST" value={extracted.igst_amount} />
                    <AmountTile label="Inv / CRN Amount" value={extracted.Inv_crn_amount} />
                    <AmountTile label="Approved Amount" value={extracted.approved_amount} />
                    <AmountTile label="Difference Amount" value={extracted.difference_amount} />
                  </SimpleGrid>
                </PreviewSection>

                <PreviewSection
                  title={`Charge lines (${override.charges_data.length})`}
                  hint="Each line is editable. Charge and currency show the name; the id is sent in the payload."
                >
                  <Box
                    style={{
                      width: "100%",
                      maxWidth: "100%",
                      overflowX: "auto",
                      overflowY: "hidden",
                    }}
                  >
                    <Table
                      striped
                      highlightOnHover
                      withTableBorder
                      withColumnBorders
                      fz="xs"
                      style={{ minWidth: 1280 }}
                    >
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>#</Table.Th>
                          <Table.Th>Charge</Table.Th>
                          <Table.Th>Narration</Table.Th>
                          <Table.Th>Shipment No.</Table.Th>
                          <Table.Th>Tax Code</Table.Th>
                          <Table.Th>Currency</Table.Th>
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
                        {override.charges_data.map((row, i) => {
                          const extractedLine = extracted.charges_data?.[i];
                          return (
                            <Table.Tr key={i}>
                              <Table.Td>{i + 1}</Table.Td>
                              <Table.Td style={{ minWidth: 180 }}>
                                <SearchableSelect
                                  placeholder="Search charge"
                                  apiEndpoint={URL.chargeMaster}
                                  value={row.charge_id || null}
                                  displayValue={row.charge_name || undefined}
                                  dropdownZIndex={400}
                                  minSearchLength={1}
                                  searchFields={["charge_code", "charge_name", "id"]}
                                  styles={fieldStyles}
                                  displayFormat={(item) => ({
                                    value: String(item.id ?? ""),
                                    label: String(item.charge_name ?? ""),
                                  })}
                                  onChange={(value, selected) =>
                                    patchCharge(i, {
                                      charge_id: value ?? "",
                                      charge_name: selected?.label ?? "",
                                    })
                                  }
                                  disabled={readOnly}
                                />
                              </Table.Td>
                              <Table.Td style={{ minWidth: 160 }}>
                                <TextInput
                                  placeholder="Narration"
                                  value={row.narration}
                                  onChange={(e) =>
                                    patchCharge(i, { narration: e.currentTarget.value })
                                  }
                                  styles={fieldStyles}
                                  disabled={readOnly}
                                />
                              </Table.Td>
                              <Table.Td style={{ minWidth: 140 }}>
                                <TextInput
                                  placeholder={shipmentNo || "Shipment no."}
                                  value={row.shipment_no}
                                  onChange={(e) =>
                                    patchCharge(i, { shipment_no: e.currentTarget.value })
                                  }
                                  styles={fieldStyles}
                                  disabled={readOnly}
                                />
                              </Table.Td>
                              <Table.Td style={{ minWidth: 110 }}>
                                <TextInput
                                  placeholder="Tax code"
                                  value={row.tax_code}
                                  onChange={(e) =>
                                    patchCharge(i, { tax_code: e.currentTarget.value })
                                  }
                                  styles={fieldStyles}
                                  disabled={readOnly}
                                />
                              </Table.Td>
                              <Table.Td style={{ minWidth: 120 }}>
                                <SearchableSelect
                                  placeholder="Search currency"
                                  apiEndpoint={URL.currencyMaster}
                                  value={row.currency_id || null}
                                  displayValue={row.currency_code || undefined}
                                  dropdownZIndex={400}
                                  minSearchLength={1}
                                  searchFields={["currency_code", "currency_name", "code", "name", "id"]}
                                  returnOriginalData
                                  styles={fieldStyles}
                                  displayFormat={(item) => ({
                                    value: String(item.id ?? ""),
                                    label: String(item.currency_code ?? item.code ?? ""),
                                  })}
                                  onChange={(value, selected, original) =>
                                    patchCharge(i, {
                                      currency_id: value ?? "",
                                      currency_code: String(
                                        original?.currency_code ??
                                          original?.code ??
                                          selected?.label ??
                                          "",
                                      ),
                                    })
                                  }
                                  disabled={readOnly}
                                />
                              </Table.Td>
                              <Table.Td style={{ minWidth: 90 }}>
                                <Dropdown
                                  placeholder="Dr/Cr"
                                  data={DR_CR_OPTIONS}
                                  value={row.Dr_Cr || null}
                                  onChange={(value) =>
                                    patchCharge(i, {
                                      Dr_Cr: normalizeVendorInvoiceDrCr(value),
                                    })
                                  }
                                  disabled={readOnly}
                                  dropdownZIndex={400}
                                />
                              </Table.Td>
                              <Table.Td style={{ minWidth: 110 }}>
                                <TextInput
                                  placeholder="0.00"
                                  value={row.amount}
                                  onChange={(e) =>
                                    patchCharge(i, { amount: e.currentTarget.value })
                                  }
                                  styles={fieldStyles}
                                  disabled={readOnly}
                                />
                              </Table.Td>
                              <Table.Td style={{ minWidth: 110 }}>
                                <TextInput
                                  placeholder="0.00"
                                  value={row.amount_in_local}
                                  onChange={(e) =>
                                    patchCharge(i, { amount_in_local: e.currentTarget.value })
                                  }
                                  styles={fieldStyles}
                                  disabled={readOnly}
                                />
                              </Table.Td>
                              <Table.Td style={{ minWidth: 90 }}>
                                <TextInput
                                  placeholder="1.00"
                                  value={row.roe}
                                  onChange={(e) =>
                                    patchCharge(i, { roe: e.currentTarget.value })
                                  }
                                  styles={fieldStyles}
                                  disabled={readOnly}
                                />
                              </Table.Td>
                              <Table.Td>
                                {extractedLine?.cgst != null
                                  ? `₹${extractedLine.cgst} (${extractedLine.cgst_rate}%)`
                                  : "—"}
                              </Table.Td>
                              <Table.Td>
                                {extractedLine?.sgst != null
                                  ? `₹${extractedLine.sgst} (${extractedLine.sgst_rate}%)`
                                  : "—"}
                              </Table.Td>
                              <Table.Td>
                                {extractedLine?.igst != null
                                  ? `₹${extractedLine.igst} (${extractedLine.igst_rate}%)`
                                  : "—"}
                              </Table.Td>
                            </Table.Tr>
                          );
                        })}
                      </Table.Tbody>
                    </Table>
                  </Box>
                </PreviewSection>

                {record.failer_message && (
                  <Box
                    p="sm"
                    style={{
                      background: "#fff5f5",
                      border: "1px solid #ffc9c9",
                      borderRadius: 8,
                    }}
                  >
                    <Text size="xs" fw={600} c="red" mb={4}>
                      Error details
                    </Text>
                    <Text size="sm" c="red">
                      {record.failer_message}
                    </Text>
                  </Box>
                )}
              </Stack>
            </Box>
          )}
        </Tabs.Panel>

        {isAdmin && (
          <Tabs.Panel
            value="raw"
            pt="sm"
            style={{ flex: 1, minHeight: 0, minWidth: 0, maxWidth: "100%", overflow: "hidden", display: "flex", flexDirection: "column" }}
          >
            <Box
              style={{
                flex: 1,
                minHeight: 0,
                maxHeight: "calc(100dvh - 17rem)",
                overflowX: "hidden",
                overflowY: "auto",
                minWidth: 0,
                maxWidth: "100%",
              }}
            >
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
            </Box>
          </Tabs.Panel>
        )}
      </Tabs>
    </Box>
  );
}

function shipmentFromExtracted(
  record: VendorInvoiceRecord | null | undefined,
  fallback = "",
): string {
  const fromCharge = record?.extracted_data?.charges_data?.find((row) =>
    String(row.shipment_no ?? "").trim(),
  )?.shipment_no;
  return String(fallback || fromCharge || "").trim();
}

export function VendorInvoiceAutomationModal({
  opened,
  onClose,
  shipmentNo = "",
  reviewRecord = null,
  onStarted,
}: VendorInvoiceAutomationModalProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputId = useId();
  const resetKeyRef = useRef(0);
  const pollAbortRef = useRef<AbortController | null>(null);

  const beginPoll = () => {
    pollAbortRef.current?.abort();
    const controller = new AbortController();
    pollAbortRef.current = controller;
    return controller.signal;
  };

  const stopPoll = () => {
    pollAbortRef.current?.abort();
    pollAbortRef.current = null;
  };

  const [step, setStep] = useState<ModalStep>("upload");
  const [files, setFiles] = useState<File[]>([]);
  const [record, setRecord] = useState<VendorInvoiceRecord | null>(null);
  const [override, setOverride] = useState<VendorInvoiceOverrideDraft | null>(null);
  const [uploading, setUploading] = useState(false);
  const [startingJob, setStartingJob] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [activeShipmentNo, setActiveShipmentNo] = useState(shipmentNo);

  const resetModal = useCallback(() => {
    resetKeyRef.current += 1;
    setStep("upload");
    setFiles([]);
    setRecord(null);
    setOverride(null);
    setUploading(false);
    setStartingJob(false);
    setActiveShipmentNo(shipmentNo);
    // Keep isRedirecting so the full-screen loader stays visible after modal close
  }, [shipmentNo]);

  useEffect(() => {
    if (!opened && !isRedirecting) {
      stopPoll();
      resetModal();
    }
  }, [opened, isRedirecting, resetModal]);

  useEffect(() => stopPoll, []);

  // Job pages keep this modal mounted and only set shipmentNo when opened.
  // useState(shipmentNo) does not pick that up, so upload would no-op.
  // Review flow (reviewRecord) sets shipment itself — do not overwrite it.
  useEffect(() => {
    if (!opened || reviewRecord) return;
    setActiveShipmentNo(shipmentNo);
  }, [opened, shipmentNo, reviewRecord]);

  useEffect(() => {
    if (!opened || !reviewRecord?.id) return;
    const shipment = shipmentFromExtracted(reviewRecord, shipmentNo);
    setActiveShipmentNo(shipment);
    setRecord(reviewRecord);
    setOverride(
      buildVendorInvoiceOverrideDraft(reviewRecord.extracted_data, shipment),
    );
    setStep("review");
  }, [opened, reviewRecord, shipmentNo]);

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
    const resolvedShipment = (activeShipmentNo || shipmentNo).trim();
    if (!files.length || !resolvedShipment) return;
    if (resolvedShipment !== activeShipmentNo.trim()) {
      setActiveShipmentNo(resolvedShipment);
    }
    setUploading(true);
    setStep("extracting");
    try {
      const { recordId } = await uploadVendorInvoicePdf(files, resolvedShipment);
      const extractedRecord = await pollVendorInvoiceRecord(
        recordId,
        isVendorInvoiceExtractionSettled,
        { signal: beginPoll() },
      );
      if (!isVendorInvoiceExtracted(extractedRecord)) {
        throw new Error(
          extractedRecord.failer_message || "No extracted invoice data found.",
        );
      }
      setRecord(extractedRecord);
      setOverride(
        buildVendorInvoiceOverrideDraft(
          extractedRecord.extracted_data,
          resolvedShipment,
        ),
      );
      setStep("review");
    } catch (error) {
      if (isVendorInvoiceAbortError(error)) return;
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

  const invoiceAlreadyCreated = isVendorInvoiceAlreadyCreated(record?.status);

  const handleStartJob = async () => {
    if (invoiceAlreadyCreated) return;
    if (!record?.id || !activeShipmentNo.trim() || !override) return;
    let startPayload;
    try {
      startPayload = buildVendorInvoiceStartPayload(
        record.id,
        activeShipmentNo.trim(),
        override,
      );
    } catch (error) {
      ToastNotification({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Fill the required invoice fields before starting.",
      });
      return;
    }
    setStartingJob(true);
    setStep("creating");
    try {
      const startResponse = await startVendorInvoiceCreation(startPayload);
      let invoiceId = extractSupplierInvoiceId(startResponse, record);

      if (!invoiceId) {
        const createdRecord = await pollVendorInvoiceRecord(
          record.id,
          (item) => isVendorInvoiceCreationSettled(item),
          { signal: beginPoll() },
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
      onStarted?.();
      onClose();
    } catch (error) {
      if (isVendorInvoiceAbortError(error)) return;
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
              Shipment: {activeShipmentNo || "—"}
            </Text>
          </Box>
        </Group>
      }
      size={"90%"}
      centered
      closeOnClickOutside={!uploading && !startingJob && !isRedirecting}
      closeOnEscape={!uploading && !startingJob && !isRedirecting}
      styles={{
        content: {
          overflow: "hidden",
          maxHeight: "calc(100dvh - 2rem)",
          ...(step === "review"
            ? { height: "calc(100dvh - 2rem)" }
            : {}),
          display: "flex",
          flexDirection: "column",
        },
        body: {
          overflowX: "hidden",
          overflowY: "hidden",
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      <Stack
        gap="md"
        style={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          maxWidth: "100%",
          overflow: "hidden",
        }}
      >
        {step === "upload" && !reviewRecord && (
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

        {step === "review" && record && override && (
          <Stack gap="md" style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: "hidden" }}>
            <ExtractedPayloadBreakdown
              record={record}
              extracted={extracted}
              shipmentNo={activeShipmentNo}
              shipmentEditable={reviewRecord != null}
              onShipmentNoChange={setActiveShipmentNo}
              override={override}
              onOverrideChange={setOverride}
              readOnly={invoiceAlreadyCreated}
            />
            
            <Group justify="flex-end" gap="sm" style={{ flexShrink: 0 }}>
              {invoiceAlreadyCreated && (
                <Text size="sm" c="dimmed">
                  Invoice already created. Create and edit are not allowed.
                </Text>
              )}
              <Button variant="default" onClick={handleClose} disabled={startingJob}>
                Cancel
              </Button>
              {!invoiceAlreadyCreated && (
              <Button
                color="#105476"
                loading={startingJob}
                disabled={
                  startingJob ||
                  !isVendorInvoiceOverrideReady(activeShipmentNo, override)
                }
                onClick={handleStartJob}
              >
                Create Vendor Invoice
              </Button>
              )}
            </Group>
          </Stack>
        )}
      </Stack>
    </Modal>
    </>
  );
}
