import { useState } from "react";
import {
  ActionIcon,
  Box,
  Button,
  Center,
  Drawer,
  Group,
  Loader,
  Modal,
  ScrollArea,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { IconSend, IconX } from "@tabler/icons-react";
import { useDisclosure } from "@mantine/hooks";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import { apiCallProtected } from "../../../../api/axios";
import { URL } from "../../../../api/serverUrls";
import {
  getEnquiryConversionSalespersonStatistics,
  extractNumericValue,
  type EnquiryConversionSalespersonStatisticsCustomerRow,
} from "../../../../service/dashboard.service";
import type { EnquiryConversionPageFilters } from "./EnquiryConversionFilters";
import { enquiryConversionColors } from "./enquiryConversionTokens";
import { ConversionByRepCustomerwiseEnquiryList } from "./ConversionByRepCustomerwiseEnquiryList";

const FONT = "'Geist', sans-serif";
const GREEN = "#16A34A";
const RED = "#EF4444";

function parseEmails(emailString: string): string[] {
  if (!emailString?.trim()) return [];
  const cleaned = emailString
    .replace(/[\r\n\t]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned
    .split(/[,;]+/)
    .map((e) => e.trim())
    .filter(Boolean);
}

function isValidEmail(email: string): boolean {
  if (!email?.trim()) return false;
  const trimmed = email.trim();
  const emailRegex =
    /^[a-zA-Z0-9][a-zA-Z0-9._+-]*@[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}$/;
  if (trimmed.includes("..")) return false;
  if (trimmed.startsWith(".") || trimmed.endsWith(".")) return false;
  if (trimmed.includes("@.") || trimmed.includes(".@")) return false;
  return emailRegex.test(trimmed);
}

function cleanEmailString(emailStr: string | null | undefined): string {
  if (!emailStr) return "";
  return String(emailStr)
    .replace(/[\r\n\t]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[^\x20-\x7E]/g, "")
    .trim();
}

function normalizeCcField(cc: string | string[] | null | undefined): string {
  if (!cc) return "";
  if (Array.isArray(cc)) {
    return cleanEmailString(cc.filter(Boolean).join(", "));
  }
  return cleanEmailString(cc);
}

type Props = {
  opened: boolean;
  onClose: () => void;
  salesperson: string | null;
  company: string;
  filters: EnquiryConversionPageFilters;
};

export function ConversionByRepSummary({
  opened,
  onClose,
  salesperson,
  company,
  filters,
}: Props) {
  const [customerDrawer, setCustomerDrawer] = useState<{
    code: string;
    name: string;
  } | null>(null);

  const [sendEmailOpened, { open: openSendEmail, close: closeSendEmail }] =
    useDisclosure(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailForm, setEmailForm] = useState({
    to_email: "",
    cc_email: "",
    subject: "",
    message: "",
  });
  const [emailErrors, setEmailErrors] = useState({
    to_email: "",
    cc_email: "",
  });
  /** Rep-level summary email vs customer-row email (same To/CC as dashboard enquiry drill-down). */
  const [emailScope, setEmailScope] = useState<
    | { kind: "rep" }
    | { kind: "customer"; row: EnquiryConversionSalespersonStatisticsCustomerRow }
  >({ kind: "rep" });

  const fd = filters.fromDate;
  const td = filters.toDate;

  const handleCloseSummary = () => {
    setCustomerDrawer(null);
    closeSendEmail();
    setEmailErrors({ to_email: "", cc_email: "" });
    setEmailScope({ kind: "rep" });
    setSendingEmail(false);
    onClose();
  };

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: [
      "enquiryConversionRepSummary",
      company,
      salesperson ?? "",
      fd?.toISOString() ?? "",
      td?.toISOString() ?? "",
    ],
    queryFn: () =>
      getEnquiryConversionSalespersonStatistics({
        company,
        salesperson: salesperson!,
        date_from: dayjs(fd!).format("DD-MM-YYYY"),
        date_to: dayjs(td!).format("DD-MM-YYYY"),
      }),
    enabled: opened && !!salesperson?.trim() && !!company && !!fd && !!td,
    staleTime: 20_000,
  });

  const busy = (isLoading || isFetching) && opened;
  const summary = data?.summary;
  const rows = Array.isArray(data?.data) ? data!.data! : [];

  const totalEnquiries = rows.reduce(
    (s, r) => s + extractNumericValue(r.total_enquiry),
    0
  );
  const totalGain = extractNumericValue(summary?.total_gain);
  const totalCustomers = extractNumericValue(summary?.total_customer_count);
  const winRateOverall =
    totalEnquiries > 0 ? (totalGain / totalEnquiries) * 100 : 0;
  const winRateLabel =
    Math.abs(winRateOverall - Math.round(winRateOverall)) < 0.05
      ? `${Math.round(winRateOverall)}`
      : winRateOverall.toFixed(1);

  const titleName = salesperson?.trim() || data?.salesperson || "Rep";
  const subLine = [
    filters.service?.trim() || "—",
    filters.type?.trim() || "—",
    "all customers",
  ].join(" · ");

  const handleOpenSendEmail = (
    customerRow?: EnquiryConversionSalespersonStatisticsCustomerRow
  ) => {
    if (!data) {
      toast.error("Load rep data before sending email");
      return;
    }
    const cleanedTo = cleanEmailString(data.salesperson_email ?? "");
    const cleanedCc = normalizeCcField(data.cc_mail);
    if (customerRow) {
      setEmailScope({ kind: "customer", row: customerRow });
      setEmailForm({
        to_email: cleanedTo,
        cc_email: cleanedCc,
        subject: `Enquiry Conversion - ${customerRow.customer_name?.trim() || "Customer"}`,
        message: "",
      });
    } else {
      setEmailScope({ kind: "rep" });
      setEmailForm({
        to_email: cleanedTo,
        cc_email: cleanedCc,
        subject: "Enquiry Conversion",
        message: "",
      });
    }
    setEmailErrors({ to_email: "", cc_email: "" });
    openSendEmail();
  };

  const handleSendEmail = async () => {
    if (!data) {
      toast.error("No data available to send email");
      return;
    }
    if (!emailForm.subject.trim()) {
      toast.error("Please enter an email subject");
      return;
    }

    const toEmailString = emailForm.to_email.trim();
    if (!toEmailString) {
      setEmailErrors((e) => ({
        ...e,
        to_email: "Please enter recipient email address(es)",
      }));
      toast.error("Please enter recipient email address(es)");
      return;
    }

    const toEmailArray = parseEmails(toEmailString);
    if (toEmailArray.length === 0) {
      setEmailErrors((e) => ({
        ...e,
        to_email: "Please enter valid email address(es)",
      }));
      toast.error(
        "Please enter valid email address(es) separated by comma or semicolon"
      );
      return;
    }

    const invalidTo = toEmailArray.filter((em) => !isValidEmail(em));
    if (invalidTo.length > 0) {
      setEmailErrors((e) => ({
        ...e,
        to_email: `Invalid email address(es): ${invalidTo.join(", ")}`,
      }));
      toast.error(`Invalid email address(es): ${invalidTo.join(", ")}`);
      return;
    }

    const ccEmailString = emailForm.cc_email.trim();
    let ccEmailArray: string[] = [];
    if (ccEmailString) {
      ccEmailArray = parseEmails(ccEmailString);
      if (ccEmailArray.length > 0) {
        const invalidCc = ccEmailArray.filter((em) => !isValidEmail(em));
        if (invalidCc.length > 0) {
          setEmailErrors((e) => ({
            ...e,
            cc_email: `Invalid email address(es): ${invalidCc.join(", ")}`,
          }));
          toast.error(
            `Invalid CC email address(es): ${invalidCc.join(", ")}`
          );
          return;
        }
      }
    }

    setEmailErrors({ to_email: "", cc_email: "" });

    const sm = data.summary;
    const salespersonName =
      (data.salesperson ?? salesperson ?? "").trim() || "";

    const data_table =
      emailScope.kind === "customer"
        ? {
            salesperson: salespersonName,
            active: emailScope.row.active ?? 0,
            gained: emailScope.row.gained ?? 0,
            lost: emailScope.row.lost ?? 0,
            quote_created: emailScope.row.quote_created ?? 0,
          }
        : {
            salesperson: salespersonName,
            active: sm?.total_active ?? 0,
            gained: sm?.total_gain ?? 0,
            lost: sm?.total_lost ?? 0,
            quote_created: sm?.total_quote_created ?? 0,
          };

    const emailPayload = {
      to_email: toEmailArray.join(", "),
      cc_email: ccEmailArray.length > 0 ? ccEmailArray.join(", ") : "",
      subject: emailForm.subject.trim(),
      message: emailForm.message.trim() || "",
      data_table,
    };

    setSendingEmail(true);
    try {
      const response = await apiCallProtected.post(
        URL.accountsSendEmail,
        emailPayload
      );
      const successMessage =
        (response as { data?: { message?: string } })?.data?.message ||
        "Email sent successfully";
      toast.success(successMessage);
      closeSendEmail();
      setEmailScope({ kind: "rep" });
      setEmailErrors({ to_email: "", cc_email: "" });
    } catch (err: unknown) {
      const ax = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      toast.error(
        ax?.response?.data?.message || ax?.message || "Failed to send email"
      );
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <>
    <Drawer
      opened={opened}
      onClose={handleCloseSummary}
      position="right"
      size="max(480px, 75vw)"
      padding={0}
      offset={8}
      radius="md"
      zIndex={400}
      withOverlay
      overlayProps={{ opacity: 0.35, blur: 2 }}
      styles={{
        header: { display: "none" },
        body: { padding: 0, height: "100%" },
        content: {
          fontFamily: FONT,
          borderLeft: "1px solid #E2E8F0",
          boxShadow: "-8px 0 24px rgba(15, 23, 42, 0.08)",
        },
      }}
    >
      <Box
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          maxHeight: "100%",
        }}
      >
        <Box
          px={20}
          py={14}
          style={{
            borderBottom: "1px solid #EEF2F7",
            flexShrink: 0,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <Box style={{ minWidth: 0 }}>
            <Text fw={700} fz={20} c="#0F172A" lh={1.2}>
              {titleName}
            </Text>
            <Text fz={12} fw={500} c="#94A3B8" mt={6} lh={1.45}>
              {subLine}
            </Text>
          </Box>
          <Group gap={8} wrap="nowrap" align="flex-start" mt={2}>
            <Button
              size="xs"
              variant="light"
              color="blue"
              leftSection={<IconSend size={14} />}
              onClick={() => handleOpenSendEmail()}
              disabled={busy || !data}
            >
              Send email
            </Button>
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={handleCloseSummary}
              aria-label="Close"
            >
              <IconX size={18} stroke={2} />
            </ActionIcon>
          </Group>
        </Box>

        <ScrollArea type="scroll" scrollbarSize={8} style={{ flex: 1, minHeight: 0 }}>
          <Stack gap="md" p={20} pb={32}>
            {error ? (
              <Text fz={13} c="red">
                {(error as Error).message}
              </Text>
            ) : null}

            {busy ? (
              <Center py={48}>
                <Loader color="#101C2E" />
              </Center>
            ) : (
              <>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={12}>
                  <Box
                    p={12}
                    style={{
                      background: enquiryConversionColors.panelBg,
                      border: `1px solid ${enquiryConversionColors.panelBorder}`,
                      borderRadius: enquiryConversionColors.radius,
                      boxShadow: enquiryConversionColors.shadow,
                      minHeight: 92,
                    }}
                  >
                    <Text
                      fz={9}
                      fw={700}
                      c="#8FA2B7"
                      tt="uppercase"
                      lts="0.04em"
                      mb={8}
                    >
                      CUSTOMERS
                    </Text>
                    <Text fz={26} fw={700} c="#0B1F3A" lh={1.1} mb={4}>
                      {totalCustomers.toLocaleString("en-IN")}
                    </Text>
                    <Text fz={11} fw={600} c="#9AAABD">
                      Last 30 days
                    </Text>
                  </Box>
                  <Box
                    p={12}
                    style={{
                      background: enquiryConversionColors.panelBg,
                      border: `1px solid ${enquiryConversionColors.panelBorder}`,
                      borderRadius: enquiryConversionColors.radius,
                      boxShadow: enquiryConversionColors.shadow,
                      minHeight: 92,
                    }}
                  >
                    <Text
                      fz={9}
                      fw={700}
                      c="#8FA2B7"
                      tt="uppercase"
                      lts="0.04em"
                      mb={8}
                    >
                      ENQUIRIES
                    </Text>
                    <Text fz={26} fw={700} c="#0B1F3A" lh={1.1}>
                      {totalEnquiries.toLocaleString("en-IN")}
                    </Text>
                  </Box>
                  <Box
                    p={12}
                    style={{
                      background: enquiryConversionColors.panelBg,
                      border: `1px solid ${enquiryConversionColors.panelBorder}`,
                      borderRadius: enquiryConversionColors.radius,
                      boxShadow: enquiryConversionColors.shadow,
                      minHeight: 92,
                    }}
                  >
                    <Text
                      fz={9}
                      fw={700}
                      c="#8FA2B7"
                      tt="uppercase"
                      lts="0.04em"
                      mb={8}
                    >
                      WON
                    </Text>
                    <Text fz={26} fw={700} c={GREEN} lh={1.1} mb={4}>
                      {totalGain.toLocaleString("en-IN")}
                    </Text>
                    <Text fz={11} fw={700} c={GREEN}>
                      {winRateLabel}% win rate
                    </Text>
                  </Box>
                  <Box
                    p={12}
                    style={{
                      background: enquiryConversionColors.panelBg,
                      border: `1px solid ${enquiryConversionColors.panelBorder}`,
                      borderRadius: enquiryConversionColors.radius,
                      boxShadow: enquiryConversionColors.shadow,
                      minHeight: 92,
                    }}
                  >
                    <Text
                      fz={9}
                      fw={700}
                      c="#8FA2B7"
                      tt="uppercase"
                      lts="0.04em"
                      mb={8}
                    >
                      WON VALUE
                    </Text>
                    <Text fz={26} fw={700} c="#0B1F3A" lh={1.1}>
                      —
                    </Text>
                  </Box>
                </SimpleGrid>

                <Box>
                  <Text fw={700} fz={15} c="#0F172A">
                    Customer-wise conversion
                  </Text>
                  <Text fz={12} fw={500} c="#94A3B8" mt={4}>
                    Click a customer for enquiry list
                  </Text>
                </Box>

                <Box
                  style={{
                    background: enquiryConversionColors.panelBg,
                    border: `1px solid ${enquiryConversionColors.panelBorder}`,
                    borderRadius: enquiryConversionColors.radius,
                    boxShadow: enquiryConversionColors.shadow,
                    overflow: "hidden",
                  }}
                >
                  <Table horizontalSpacing="md" verticalSpacing={12}>
                    <Table.Thead>
                      <Table.Tr style={{ background: "#F8FAFC" }}>
                        {[
                          "CUSTOMER",
                          "ENQUIRIES",
                          "WON",
                          "WIN RATE",
                          "VALUE",
                          "SEND EMAIL",
                        ].map((h, i) => (
                          <Table.Th
                            key={h}
                            fz={10}
                            fw={700}
                            c="#94A3B8"
                            tt="uppercase"
                            ta={
                              i === 0
                                ? "left"
                                : i === 5
                                  ? "center"
                                  : "right"
                            }
                            style={i === 5 ? { width: 100 } : undefined}
                          >
                            {h}
                          </Table.Th>
                        ))}
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {rows.length === 0 ? (
                        <Table.Tr>
                          <Table.Td colSpan={6}>
                            <Text fz={13} c="#94A3B8" py={8}>
                              No customer rows for this rep.
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      ) : (
                        rows.map((r) => {
                          const te = extractNumericValue(r.total_enquiry);
                          const g = extractNumericValue(r.gained);
                          const wr = te > 0 ? (g / te) * 100 : 0;
                          const wrStr =
                            Math.abs(wr - Math.round(wr)) < 0.05
                              ? `${Math.round(wr)}`
                              : wr.toFixed(1);
                          const wrColor = wr > 0 ? GREEN : RED;
                          return (
                            <Table.Tr
                              key={r.customer_code}
                              onClick={() =>
                                setCustomerDrawer({
                                  code: r.customer_code,
                                  name: r.customer_name,
                                })
                              }
                              style={{ cursor: "pointer" }}
                            >
                              <Table.Td style={{ verticalAlign: "top" }}>
                                <Text fz={13} fw={700} c="#0F172A">
                                  {r.customer_name}
                                </Text>
                                <Text fz={11} fw={500} c="#94A3B8" mt={2}>
                                  —
                                </Text>
                              </Table.Td>
                              <Table.Td ta="right">
                                <Text fz={13} style={{ fontVariantNumeric: "tabular-nums" }}>
                                  {te.toLocaleString("en-IN")}
                                </Text>
                              </Table.Td>
                              <Table.Td ta="right">
                                <Text fz={13} fw={700} c={g > 0 ? GREEN : "#0F172A"} style={{ fontVariantNumeric: "tabular-nums" }}>
                                  {g.toLocaleString("en-IN")}
                                </Text>
                              </Table.Td>
                              <Table.Td ta="right">
                                <Text fz={13} fw={700} c={wrColor} style={{ fontVariantNumeric: "tabular-nums" }}>
                                  {wrStr}%
                                </Text>
                              </Table.Td>
                              <Table.Td ta="right">
                                <Text fz={13} style={{ fontVariantNumeric: "tabular-nums" }}>
                                  —
                                </Text>
                              </Table.Td>
                              <Table.Td
                                ta="center"
                                style={{ width: 100, verticalAlign: "middle" }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Tooltip label="Send Email" position="top" withArrow>
                                  <ActionIcon
                                    variant="light"
                                    color="#105476"
                                    size="md"
                                    aria-label="Send email for this customer"
                                    disabled={busy || !data}
                                    onClick={() => handleOpenSendEmail(r)}
                                  >
                                    <IconSend size={16} />
                                  </ActionIcon>
                                </Tooltip>
                              </Table.Td>
                            </Table.Tr>
                          );
                        })
                      )}
                    </Table.Tbody>
                  </Table>
                </Box>
              </>
            )}
          </Stack>
        </ScrollArea>
      </Box>
    </Drawer>

    <Modal
      opened={sendEmailOpened}
      onClose={() => {
        closeSendEmail();
        setEmailScope({ kind: "rep" });
        setEmailErrors({ to_email: "", cc_email: "" });
      }}
      title={
        <Text size="lg" fw={600} c="#1E293B">
          Send Email - Enquiry Conversion
        </Text>
      }
      size="lg"
      centered
      zIndex={500}
      overlayProps={{
        backgroundOpacity: 0.55,
        blur: 3,
      }}
    >
      <Stack gap="md">
        <TextInput
          label="To Email"
          placeholder="name@example.com, name2@example.com or name@example.com; name2@example.com"
          value={emailForm.to_email}
          onChange={(e) => {
            setEmailForm({ ...emailForm, to_email: e.target.value });
            if (emailErrors.to_email) {
              setEmailErrors({ ...emailErrors, to_email: "" });
            }
          }}
          error={emailErrors.to_email}
          required
        />

        <TextInput
          label="CC Email"
          placeholder="cc@example.com, cc2@example.com"
          value={emailForm.cc_email}
          onChange={(e) => {
            setEmailForm({ ...emailForm, cc_email: e.target.value });
            if (emailErrors.cc_email) {
              setEmailErrors({ ...emailErrors, cc_email: "" });
            }
          }}
          error={emailErrors.cc_email}
        />

        <TextInput
          label="Subject"
          placeholder="Enter email subject"
          value={emailForm.subject}
          onChange={(e) =>
            setEmailForm({ ...emailForm, subject: e.target.value })
          }
        />

        <Textarea
          label="Message"
          placeholder="Enter email message"
          value={emailForm.message}
          onChange={(e) =>
            setEmailForm({ ...emailForm, message: e.target.value })
          }
          minRows={4}
        />

        <Group justify="flex-end" mt="md">
          <Button
            variant="outline"
            onClick={() => {
              closeSendEmail();
              setEmailScope({ kind: "rep" });
              setEmailErrors({ to_email: "", cc_email: "" });
            }}
            disabled={sendingEmail}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSendEmail}
            loading={sendingEmail}
            leftSection={<IconSend size={16} />}
            color="blue"
          >
            Send
          </Button>
        </Group>
      </Stack>
    </Modal>

    <ConversionByRepCustomerwiseEnquiryList
      opened={customerDrawer !== null}
      onClose={() => setCustomerDrawer(null)}
      salesperson={salesperson}
      company={company}
      filters={filters}
      customerCode={customerDrawer?.code ?? null}
      customerName={customerDrawer?.name ?? ""}
    />
    </>
  );
}
