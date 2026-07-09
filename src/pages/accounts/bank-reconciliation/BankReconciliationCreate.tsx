import { useMemo, useState } from "react";
import {
  ActionIcon,
  Box,
  Button,
  Grid,
  Group,
  NumberInput,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import {
  IconArrowLeft,
  IconFolder,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { SingleDateInput, ToastNotification } from "../../../components";
import FormTextInput from "../../../components/FormTextInput";
import RequiredLabel from "../../../components/RequiredLabel";

type ChequeNotClearedRow = {
  date: Date | null;
  daybook: string;
  document_no: string;
  cheque_no: string;
  cheque_date: Date | null;
  cheque_clr_date: Date | null;
  party: string;
  amount: number | null;
};

type BankEntryRow = {
  date: Date | null;
  narration: string;
  cheque_no: string;
  cheque_clr_date: Date | null;
  our_reference: string;
  amount: number | null;
};

type BankReconciliationForm = {
  brs_no: string;
  date: Date | null;
  currency_code: string;
  status: string;
  bank_balance: number | null;
  bank_account_code: string;
  bank_account_sub_code: string;
  bank_account_name: string;
  as_per_statement: number | null;
  file_name: string;
  cheque_issued: ChequeNotClearedRow[];
  bank_credit: BankEntryRow[];
  cheque_deposited: ChequeNotClearedRow[];
  bank_debit: BankEntryRow[];
};

const STATUS_OPTIONS = [
  { value: "UNPOSTED", label: "Unposted" },
  { value: "POSTED", label: "Posted" },
];

const inputStyles = {
  input: { fontSize: "13px", fontFamily: "Inter", height: "36px" },
  label: { fontSize: "13px", fontFamily: "Inter", marginBottom: "4px" },
};

const cellInput = {
  input: { fontSize: "12px", fontFamily: "Inter", height: "32px" },
};

function emptyChequeRow(): ChequeNotClearedRow {
  return {
    date: null,
    daybook: "",
    document_no: "",
    cheque_no: "",
    cheque_date: null,
    cheque_clr_date: null,
    party: "",
    amount: null,
  };
}

function emptyBankRow(): BankEntryRow {
  return {
    date: null,
    narration: "",
    cheque_no: "",
    cheque_clr_date: null,
    our_reference: "",
    amount: null,
  };
}

function sumAmounts(
  rows: Array<{ amount: number | null | undefined }>,
): number {
  return rows.reduce((sum, row) => {
    const n = Number(row.amount);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
}

function formatAmount(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Text
      fw={600}
      size="sm"
      mb={6}
      style={{ fontFamily: "Inter", color: "#0f172a" }}
    >
      {children}
    </Text>
  );
}

function GridTotal({ label, value }: { label?: string; value: number }) {
  return (
    <Group justify="flex-end" mt={6} gap="xs">
      <Text size="sm" fw={600} style={{ fontFamily: "Inter" }}>
        {label ?? "Total"}
      </Text>
      <TextInput
        readOnly
        value={formatAmount(value)}
        w={140}
        styles={cellInput}
      />
    </Group>
  );
}

export default function BankReconciliationCreate() {
  const navigate = useNavigate();
  const [fileInputKey, setFileInputKey] = useState(0);

  const form = useForm<BankReconciliationForm>({
    initialValues: {
      brs_no: "",
      date: new Date(),
      currency_code: "",
      status: "UNPOSTED",
      bank_balance: null,
      bank_account_code: "",
      bank_account_sub_code: "",
      bank_account_name: "",
      as_per_statement: null,
      file_name: "",
      cheque_issued: [emptyChequeRow()],
      bank_credit: [emptyBankRow()],
      cheque_deposited: [emptyChequeRow()],
      bank_debit: [emptyBankRow()],
    },
    validate: {
      date: (v) => (!v ? "Date is required" : null),
      bank_account_code: (v) => (!v?.trim() ? "Bank account code is required" : null),
      as_per_statement: (v) =>
        v === null || v === undefined ? "As per statement is required" : null,
    },
  });

  const chequeIssuedTotal = useMemo(
    () => sumAmounts(form.values.cheque_issued),
    [form.values.cheque_issued],
  );
  const bankCreditTotal = useMemo(
    () => sumAmounts(form.values.bank_credit),
    [form.values.bank_credit],
  );
  const chequeDepositedTotal = useMemo(
    () => sumAmounts(form.values.cheque_deposited),
    [form.values.cheque_deposited],
  );
  const bankDebitTotal = useMemo(
    () => sumAmounts(form.values.bank_debit),
    [form.values.bank_debit],
  );

  const grandTotal = useMemo(() => {
    const bankBalance = Number(form.values.bank_balance) || 0;
    return (
      bankBalance + chequeIssuedTotal + bankCreditTotal - chequeDepositedTotal - bankDebitTotal
    );
  }, [
    form.values.bank_balance,
    chequeIssuedTotal,
    bankCreditTotal,
    chequeDepositedTotal,
    bankDebitTotal,
  ]);

  const differenceAmount = useMemo(() => {
    const statement = Number(form.values.as_per_statement);
    if (!Number.isFinite(statement)) return 0;
    return Math.round((grandTotal - statement) * 100) / 100;
  }, [grandTotal, form.values.as_per_statement]);

  const handleFilePick = (file: File | null) => {
    form.setFieldValue("file_name", file?.name ?? "");
  };

  const handleGetDetail = () => {
    ToastNotification({
      type: "info",
      message: "Get Detail will be available once API is integrated",
    });
  };

  const handleUpload = () => {
    ToastNotification({
      type: "info",
      message: "Upload will be available once API is integrated",
    });
  };

  const handlePost = () => {
    const result = form.validate();
    if (result.hasErrors) {
      ToastNotification({
        type: "error",
        message: "Please fill all required fields",
      });
      return;
    }
    ToastNotification({
      type: "info",
      message: "Post will be available once API is integrated",
    });
  };

  const handleDocument = () => {
    ToastNotification({
      type: "info",
      message: "Document attachment will be available once API is integrated",
    });
  };

  const renderChequeGrid = (
    field: "cheque_issued" | "cheque_deposited",
    partyLabel: string,
  ) => {
    const rows = form.values[field];
    return (
      <Box
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          overflow: "hidden",
          background: "#fff",
        }}
      >
        <ScrollArea h={180} offsetScrollbars>
          <Table
            horizontalSpacing={4}
            verticalSpacing={2}
            style={{ minWidth: 980 }}
          >
            <Table.Thead>
              <Table.Tr style={{ background: "#f8fafc" }}>
                <Table.Th w={40}>SNo</Table.Th>
                <Table.Th w={110}>Date</Table.Th>
                <Table.Th w={90}>Daybook</Table.Th>
                <Table.Th w={140}>Document No</Table.Th>
                <Table.Th w={100}>Cheque No</Table.Th>
                <Table.Th w={110}>Cheque Date</Table.Th>
                <Table.Th w={120}>Cheque Clr Date</Table.Th>
                <Table.Th w={160}>{partyLabel}</Table.Th>
                <Table.Th w={110}>Amount</Table.Th>
                <Table.Th w={40} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((_, index) => (
                <Table.Tr key={`${field}-${index}`}>
                  <Table.Td>
                    <Text size="xs" ta="center">
                      {index + 1}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <SingleDateInput
                      value={rows[index].date}
                      onChange={(date) =>
                        form.setFieldValue(`${field}.${index}.date`, date)
                      }
                      styles={cellInput}
                    />
                  </Table.Td>
                  <Table.Td>
                    <TextInput
                      value={rows[index].daybook}
                      onChange={(e) =>
                        form.setFieldValue(
                          `${field}.${index}.daybook`,
                          e.currentTarget.value,
                        )
                      }
                      styles={cellInput}
                    />
                  </Table.Td>
                  <Table.Td>
                    <TextInput
                      value={rows[index].document_no}
                      onChange={(e) =>
                        form.setFieldValue(
                          `${field}.${index}.document_no`,
                          e.currentTarget.value,
                        )
                      }
                      rightSection={
                        <Text size="xs" c="dimmed" pr={4}>
                          ...
                        </Text>
                      }
                      styles={cellInput}
                    />
                  </Table.Td>
                  <Table.Td>
                    <TextInput
                      value={rows[index].cheque_no}
                      onChange={(e) =>
                        form.setFieldValue(
                          `${field}.${index}.cheque_no`,
                          e.currentTarget.value,
                        )
                      }
                      styles={cellInput}
                    />
                  </Table.Td>
                  <Table.Td>
                    <SingleDateInput
                      value={rows[index].cheque_date}
                      onChange={(date) =>
                        form.setFieldValue(
                          `${field}.${index}.cheque_date`,
                          date,
                        )
                      }
                      styles={cellInput}
                    />
                  </Table.Td>
                  <Table.Td>
                    <SingleDateInput
                      value={rows[index].cheque_clr_date}
                      onChange={(date) =>
                        form.setFieldValue(
                          `${field}.${index}.cheque_clr_date`,
                          date,
                        )
                      }
                      styles={cellInput}
                    />
                  </Table.Td>
                  <Table.Td>
                    <TextInput
                      value={rows[index].party}
                      onChange={(e) =>
                        form.setFieldValue(
                          `${field}.${index}.party`,
                          e.currentTarget.value,
                        )
                      }
                      styles={cellInput}
                    />
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      value={rows[index].amount ?? undefined}
                      onChange={(v) =>
                        form.setFieldValue(
                          `${field}.${index}.amount`,
                          typeof v === "number" ? v : null,
                        )
                      }
                      decimalScale={2}
                      hideControls
                      styles={cellInput}
                    />
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      size="sm"
                      disabled={rows.length <= 1}
                      onClick={() => form.removeListItem(field, index)}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
        <Group justify="space-between" px="sm" py={6}>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconPlus size={14} />}
            onClick={() => form.insertListItem(field, emptyChequeRow())}
          >
            Add row
          </Button>
          <GridTotal value={sumAmounts(rows)} />
        </Group>
      </Box>
    );
  };

  const renderBankGrid = (field: "bank_credit" | "bank_debit") => {
    const rows = form.values[field];
    return (
      <Box
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          overflow: "hidden",
          background: "#fff",
        }}
      >
        <ScrollArea h={180} offsetScrollbars>
          <Table
            horizontalSpacing={4}
            verticalSpacing={2}
            style={{ minWidth: 860 }}
          >
            <Table.Thead>
              <Table.Tr style={{ background: "#f8fafc" }}>
                <Table.Th w={40}>SNo</Table.Th>
                <Table.Th w={110}>Date</Table.Th>
                <Table.Th w={220}>
                  <RequiredLabel label="Narration" required />
                </Table.Th>
                <Table.Th w={100}>Cheque No</Table.Th>
                <Table.Th w={120}>Cheque Clr Date</Table.Th>
                <Table.Th w={140}>Our Reference</Table.Th>
                <Table.Th w={110}>
                  <RequiredLabel label="Amount" required />
                </Table.Th>
                <Table.Th w={40} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((_, index) => (
                <Table.Tr key={`${field}-${index}`}>
                  <Table.Td>
                    <Text size="xs" ta="center">
                      {index + 1}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <SingleDateInput
                      value={rows[index].date}
                      onChange={(date) =>
                        form.setFieldValue(`${field}.${index}.date`, date)
                      }
                      styles={cellInput}
                    />
                  </Table.Td>
                  <Table.Td>
                    <TextInput
                      value={rows[index].narration}
                      onChange={(e) =>
                        form.setFieldValue(
                          `${field}.${index}.narration`,
                          e.currentTarget.value,
                        )
                      }
                      styles={cellInput}
                    />
                  </Table.Td>
                  <Table.Td>
                    <TextInput
                      value={rows[index].cheque_no}
                      onChange={(e) =>
                        form.setFieldValue(
                          `${field}.${index}.cheque_no`,
                          e.currentTarget.value,
                        )
                      }
                      styles={cellInput}
                    />
                  </Table.Td>
                  <Table.Td>
                    <SingleDateInput
                      value={rows[index].cheque_clr_date}
                      onChange={(date) =>
                        form.setFieldValue(
                          `${field}.${index}.cheque_clr_date`,
                          date,
                        )
                      }
                      styles={cellInput}
                    />
                  </Table.Td>
                  <Table.Td>
                    <TextInput
                      value={rows[index].our_reference}
                      onChange={(e) =>
                        form.setFieldValue(
                          `${field}.${index}.our_reference`,
                          e.currentTarget.value,
                        )
                      }
                      styles={cellInput}
                    />
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      value={rows[index].amount ?? undefined}
                      onChange={(v) =>
                        form.setFieldValue(
                          `${field}.${index}.amount`,
                          typeof v === "number" ? v : null,
                        )
                      }
                      decimalScale={2}
                      hideControls
                      styles={cellInput}
                    />
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      size="sm"
                      disabled={rows.length <= 1}
                      onClick={() => form.removeListItem(field, index)}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
        <Group justify="space-between" px="sm" py={6}>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconPlus size={14} />}
            onClick={() => form.insertListItem(field, emptyBankRow())}
          >
            Add row
          </Button>
          <GridTotal value={sumAmounts(rows)} />
        </Group>
      </Box>
    );
  };

  return (
    <Box p="md" style={{ background: "#F0F4F8", minHeight: "100%" }}>
      <Group justify="space-between" mb="md">
        <Group gap="sm">
          <Button
            variant="default"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate("/bank-reconciliation")}
          >
            Back
          </Button>
          <Text fw={700} size="lg" style={{ fontFamily: "Inter" }}>
            Bank Reconciliation
          </Text>
        </Group>
        <Group gap="xs">
          <Button variant="default" onClick={handleUpload}>
            Upload
          </Button>
          <Button variant="default" onClick={handleGetDetail}>
            Get Detail
          </Button>
          <Button color="teal" onClick={handlePost}>
            Post
          </Button>
          <Button variant="default" onClick={handleDocument}>
            Document
          </Button>
        </Group>
      </Group>

      <Box
        p="md"
        mb="md"
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
        }}
      >
        <Grid gutter="md">
          <Grid.Col span={{ base: 12, md: 3 }}>
            <FormTextInput
              label="BRS No"
              placeholder="BRS number"
              value={form.values.brs_no}
              onChange={(e) => form.setFieldValue("brs_no", e.currentTarget.value)}
              styles={inputStyles}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <SingleDateInput
              label="Date"
              withAsterisk
              value={form.values.date}
              onChange={(date) => form.setFieldValue("date", date)}
              styles={inputStyles}
              error={form.errors.date as string | undefined}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 2 }}>
            <FormTextInput
              label="Currency Code"
              placeholder="Currency"
              value={form.values.currency_code}
              onChange={(e) =>
                form.setFieldValue("currency_code", e.currentTarget.value)
              }
              styles={inputStyles}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 2 }}>
            <Select
              label="Status"
              data={STATUS_OPTIONS}
              value={form.values.status}
              onChange={(v) => form.setFieldValue("status", v ?? "UNPOSTED")}
              styles={inputStyles}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 2 }}>
            <NumberInput
              label="Bank Balance"
              value={form.values.bank_balance ?? undefined}
              onChange={(v) =>
                form.setFieldValue(
                  "bank_balance",
                  typeof v === "number" ? v : null,
                )
              }
              decimalScale={2}
              hideControls
              readOnly
              styles={inputStyles}
            />
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 6 }}>
            <Text size="sm" mb={4} style={{ fontFamily: "Inter" }}>
              <RequiredLabel label="Bank Account Code" required />
            </Text>
            <Group grow align="flex-start">
              <TextInput
                placeholder="Account code"
                value={form.values.bank_account_code}
                onChange={(e) =>
                  form.setFieldValue("bank_account_code", e.currentTarget.value)
                }
                error={form.errors.bank_account_code}
                styles={inputStyles}
              />
              <TextInput
                placeholder="Sub code"
                value={form.values.bank_account_sub_code}
                onChange={(e) =>
                  form.setFieldValue(
                    "bank_account_sub_code",
                    e.currentTarget.value,
                  )
                }
                styles={inputStyles}
              />
            </Group>
            {form.values.bank_account_name ? (
              <Text size="xs" c="dimmed" mt={4}>
                {form.values.bank_account_name}
              </Text>
            ) : null}
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <NumberInput
              label="As Per Statement"
              withAsterisk
              value={form.values.as_per_statement ?? undefined}
              onChange={(v) =>
                form.setFieldValue(
                  "as_per_statement",
                  typeof v === "number" ? v : null,
                )
              }
              decimalScale={2}
              hideControls
              error={form.errors.as_per_statement}
              styles={inputStyles}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <TextInput
              label="File Name"
              placeholder="Select file"
              value={form.values.file_name}
              readOnly
              rightSection={
                <ActionIcon
                  variant="subtle"
                  component="label"
                  aria-label="Browse file"
                >
                  <IconFolder size={16} />
                  <input
                    key={fileInputKey}
                    type="file"
                    hidden
                    onChange={(e) => {
                      handleFilePick(e.currentTarget.files?.[0] ?? null);
                      setFileInputKey((k) => k + 1);
                    }}
                  />
                </ActionIcon>
              }
              styles={inputStyles}
            />
          </Grid.Col>
        </Grid>
      </Box>

      <Stack gap="md">
        <Box>
          <SectionTitle>Add : Cheque Issued But Not Cleared</SectionTitle>
          {renderChequeGrid("cheque_issued", "Paid To")}
        </Box>

        <Grid gutter="md">
          <Grid.Col span={{ base: 12, md: 9 }}>
            <SectionTitle>Add : Bank Credit</SectionTitle>
            {renderBankGrid("bank_credit")}
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Box pt={28}>
              <Text size="sm" fw={600} mb={4}>
                Credit Total
              </Text>
              <TextInput
                readOnly
                value={formatAmount(bankCreditTotal)}
                styles={inputStyles}
              />
            </Box>
          </Grid.Col>
        </Grid>

        <Box>
          <SectionTitle>Less : Cheque Deposited But Not Cleared</SectionTitle>
          {renderChequeGrid("cheque_deposited", "Received From")}
        </Box>

        <Grid gutter="md">
          <Grid.Col span={{ base: 12, md: 9 }}>
            <SectionTitle>Less : Bank Debit</SectionTitle>
            {renderBankGrid("bank_debit")}
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Box pt={28}>
              <Text size="sm" fw={600} mb={4}>
                Debit Total
              </Text>
              <TextInput
                readOnly
                value={formatAmount(bankDebitTotal)}
                styles={inputStyles}
              />
            </Box>
          </Grid.Col>
        </Grid>
      </Stack>

      <Group justify="flex-end" gap="xl" mt="lg" wrap="wrap">
        <Group gap="xs">
          <Text size="sm" fw={600}>
            Difference Amount
          </Text>
          <TextInput
            readOnly
            value={formatAmount(differenceAmount)}
            w={160}
            styles={inputStyles}
          />
        </Group>
        <Group gap="xs">
          <Text size="sm" fw={600}>
            Grand Total
          </Text>
          <TextInput
            readOnly
            value={formatAmount(grandTotal)}
            w={160}
            styles={inputStyles}
          />
        </Group>
      </Group>
    </Box>
  );
}
