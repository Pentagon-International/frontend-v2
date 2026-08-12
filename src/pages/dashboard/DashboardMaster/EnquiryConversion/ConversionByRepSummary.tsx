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
import { useDashboardChartSearch } from "../../../../hooks/useDashboardChartSearch";
import {
  getEnquiryConversionSalespersonStatistics,
  extractNumericValue,
  type EnquiryConversionSalespersonStatisticsCustomerRow,
} from "../../../../service/dashboard.service";
import type { EnquiryConversionPageFilters } from "./EnquiryConversionFilters";
import { enquiryConversionColors } from "./enquiryConversionTokens";
import { ConversionByRepCustomerwiseEnquiryList } from "./ConversionByRepCustomerwiseEnquiryList";
import {
  EnquiryConversionDrawerBack,
  EnquiryConversionDrawerHeaderSeparator,
} from "./EnquiryConversionDrawerBack";

/** Aligned with Pentagon Sales Dashboard standalone (`:root`, `.dd-*`, `.card`, table drilldown) */
const FONT =
  "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, system-ui, sans-serif";
const INK = "#0f172a";
const INK3 = "#64748b";
const INK4 = "#94a3b8";
const LINE = "#e2e8f0";
const PANEL_BG = "#f1f5f9";
const TABLE_HEAD_BG = "#f8fafc";
const GOOD = "#16a34a";

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
  apiType?: string | null;
  company: string;
  filters: EnquiryConversionPageFilters;
};

export function ConversionByRepSummary({
  opened,
  onClose,
  salesperson,
  apiType = null,
  company,
  filters,
}: Props) {
  const { committed: committedSearch } = useDashboardChartSearch();
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
  const normalizedApiType = (apiType ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
  const stageMetricLabel =
    normalizedApiType === "ACTIVE"
      ? "Active"
      : normalizedApiType === "QUOTE CREATED"
        ? "Quote created"
        : normalizedApiType === "LOST"
          ? "Lost"
          : "Won";

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
      apiType ?? "",
      fd?.toISOString() ?? "",
      td?.toISOString() ?? "",
      committedSearch?.trim() ?? "",
    ],
    queryFn: () =>
      getEnquiryConversionSalespersonStatistics({
        company,
        salesperson: salesperson!,
        date_from: dayjs(fd!).format("DD-MM-YYYY"),
        date_to: dayjs(td!).format("DD-MM-YYYY"),
        type: apiType,
        search: committedSearch?.trim() || null,
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
  const totalStageCount =
    normalizedApiType === "ACTIVE"
      ? extractNumericValue(summary?.total_active)
      : normalizedApiType === "QUOTE CREATED"
        ? extractNumericValue(summary?.total_quote_created)
        : normalizedApiType === "LOST"
          ? extractNumericValue(summary?.total_lost)
          : totalGain;
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
        URL.quotationSendEmail,
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
      size="min(920px, 92vw)"
      padding={0}
      offset={8}
      radius="md"
      zIndex={400}
      withOverlay
      overlayProps={{ backgroundOpacity: 0.32, color: "#0f172a", blur: 0 }}
      styles={{
        header: { display: "none" },
        body: { padding: 0, height: "100%", background: PANEL_BG },
        content: {
          fontFamily: FONT,
          borderLeft: `1px solid ${LINE}`,
          boxShadow: "-16px 0 40px rgba(15, 23, 42, 0.18)",
          background: PANEL_BG,
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
          px={22}
          py={14}
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
            background: enquiryConversionColors.panelBg,
            borderBottom: `1px solid ${LINE}`,
          }}
        >
          <Group gap={10} wrap="nowrap" align="center" style={{ minWidth: 0, flex: 1 }}>
            <EnquiryConversionDrawerBack onClick={handleCloseSummary} />
            <EnquiryConversionDrawerHeaderSeparator />
            <Text
              fw={600}
              fz={14}
              c={INK}
              lh={1.2}
              truncate
              style={{ letterSpacing: "-0.01em", minWidth: 0 }}
            >
              {titleName}
            </Text>
          </Group>
          <Group gap={8} wrap="nowrap" align="center">
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
              size={30}
              radius="md"
              style={{ color: INK3 }}
            >
              <IconX size={18} stroke={2} />
            </ActionIcon>
          </Group>
        </Box>

        <ScrollArea type="scroll" scrollbarSize={8} style={{ flex: 1, minHeight: 0 }}>
          <Stack gap={0} p={22} pb={32} style={{ background: PANEL_BG }}>
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
                <Box
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 12,
                    marginBottom: 16,
                    flexWrap: "wrap",
                  }}
                >
                  <Text
                    component="h2"
                    m={0}
                    fz={18}
                    fw={600}
                    c={INK}
                    lh={1.2}
                    style={{ letterSpacing: "-0.01em" }}
                  >
                    {titleName}
                  </Text>
                  <Text fz={12} c={INK3} fw={400} lh={1.45}>
                    {subLine}
                  </Text>
                </Box>

                <SimpleGrid
                  cols={{ base: 1, sm: 4 }}
                  spacing={10}
                  mb={16}
                  style={{ gridTemplateColumns: "repeat(4, 1fr)" }}
                >
                  <Box
                    p="10px 12px"
                    style={{
                      background: enquiryConversionColors.panelBg,
                      border: `1px solid ${LINE}`,
                      borderRadius: 8,
                    }}
                  >
                    <Text
                      fz={10}
                      fw={500}
                      c={INK3}
                      tt="uppercase"
                      lts="0.04em"
                    >
                      Customers
                    </Text>
                    <Text
                      fz={18}
                      fw={600}
                      c={INK}
                      lh={1.15}
                      mt={2}
                      style={{ letterSpacing: "-0.01em" }}
                    >
                      {totalCustomers.toLocaleString("en-IN")}
                    </Text>
                    <Text fz={10} fw={400} c={INK4} mt={1}>
                      Last 30 days
                    </Text>
                  </Box>
                  {/* <Box
                    p="10px 12px"
                    style={{
                      background: enquiryConversionColors.panelBg,
                      border: `1px solid ${LINE}`,
                      borderRadius: 8,
                    }}
                  >
                    <Text
                      fz={10}
                      fw={500}
                      c={INK3}
                      tt="uppercase"
                      lts="0.04em"
                    >
                      Enquiries
                    </Text>
                    <Text
                      fz={18}
                      fw={600}
                      c={INK}
                      lh={1.15}
                      mt={2}
                      style={{ letterSpacing: "-0.01em" }}
                    >
                      {totalEnquiries.toLocaleString("en-IN")}
                    </Text>
                  </Box> */}
                  <Box
                    p="10px 12px"
                    style={{
                      background: enquiryConversionColors.panelBg,
                      border: `1px solid ${LINE}`,
                      borderRadius: 8,
                    }}
                  >
                    <Text
                      fz={10}
                      fw={500}
                      c={INK3}
                      tt="uppercase"
                      lts="0.04em"
                    >
                      {stageMetricLabel}
                    </Text>
                    <Text
                      fz={18}
                      fw={600}
                      c={GOOD}
                      lh={1.15}
                      mt={2}
                      style={{ letterSpacing: "-0.01em" }}
                    >
                      {totalStageCount.toLocaleString("en-IN")}
                    </Text>
                    <Text fz={10} fw={400} c={GOOD} mt={1}>
                      {winRateLabel}% win rate
                    </Text>
                  </Box>
                  {/* <Box
                    p="10px 12px"
                    style={{
                      background: enquiryConversionColors.panelBg,
                      border: `1px solid ${LINE}`,
                      borderRadius: 8,
                    }}
                  >
                    <Text
                      fz={10}
                      fw={500}
                      c={INK3}
                      tt="uppercase"
                      lts="0.04em"
                    >
                      Won value
                    </Text>
                    <Text
                      fz={18}
                      fw={600}
                      c={INK}
                      lh={1.15}
                      mt={2}
                      style={{ letterSpacing: "-0.01em" }}
                    >
                      —
                    </Text>
                  </Box> */}
                </SimpleGrid>

                <Box
                  style={{
                    background: enquiryConversionColors.panelBg,
                    border: `1px solid ${LINE}`,
                    borderRadius: 10,
                    overflow: "hidden",
                  }}
                >
                  <Box
                    px={18}
                    pt={18}
                    pb={12}
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 10,
                      flexWrap: "wrap",
                      marginBottom: 0,
                    }}
                  >
                    <Text
                      component="h3"
                      m={0}
                      fz={13}
                      fw={600}
                      c={INK}
                      style={{ letterSpacing: "-0.005em" }}
                    >
                      Customer-wise conversion
                    </Text>
                    <Text fz={11} c={INK4} fw={400}>
                      Click a customer for enquiry list
                    </Text>
                  </Box>
                  <Table
                    horizontalSpacing={12}
                    verticalSpacing={11}
                    withRowBorders={false}
                    highlightOnHover
                    highlightOnHoverColor={TABLE_HEAD_BG}
                    style={{ borderTop: `1px solid ${LINE}` }}
                  >
                    <Table.Thead>
                      <Table.Tr>
                        {[
                          "Customer",
                          "Enquiries",
                          stageMetricLabel,
                          // "Win rate",
                          // "Value",
                          "Send email",
                        ].map((h, i) => (
                          <Table.Th
                            key={h}
                            fz={11}
                            fw={500}
                            c={INK3}
                            tt="uppercase"
                            lts="0.04em"
                            ta={
                              i === 0
                                ? "left"
                                : i === 5
                                  ? "center"
                                  : "right"
                            }
                            style={{
                              background: TABLE_HEAD_BG,
                              padding: "10px 12px",
                              borderBottom: `1px solid ${LINE}`,
                              whiteSpace: "nowrap",
                              ...(i === 5 ? { width: 100 } : {}),
                            }}
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
                          const stageMetric =
                            normalizedApiType === "ACTIVE"
                              ? extractNumericValue(r.active)
                              : normalizedApiType === "QUOTE CREATED"
                                ? extractNumericValue(r.quote_created)
                                : normalizedApiType === "LOST"
                                  ? extractNumericValue(r.lost)
                                  : extractNumericValue(r.gained);
                          const rowExtra = r as unknown as Record<string, unknown>;
                          const industryRaw =
                            rowExtra.industry ??
                            rowExtra.customer_industry ??
                            rowExtra.segment;
                          const industry =
                            typeof industryRaw === "string"
                              ? industryRaw.trim()
                              : "";
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
                              <Table.Td
                                style={{
                                  verticalAlign: "middle",
                                  padding: "11px 12px",
                                  borderBottom: `1px solid ${LINE}`,
                                }}
                              >
                                <Text fz={12} fw={600} c={INK} lh={1.35}>
                                  {r.customer_name}
                                </Text>
                                {industry ? (
                                  <Text fz={10.5} c={INK4} mt={1} lh={1.3}>
                                    {industry}
                                  </Text>
                                ) : null}
                              </Table.Td>
                              <Table.Td
                                ta="right"
                                style={{
                                  verticalAlign: "middle",
                                  padding: "11px 12px",
                                  borderBottom: `1px solid ${LINE}`,
                                  fontVariantNumeric: "tabular-nums",
                                }}
                              >
                                <Text fz={12} c={INK} lh={1.35}>
                                  {te.toLocaleString("en-IN")}
                                </Text>
                              </Table.Td>
                              <Table.Td
                                ta="right"
                                style={{
                                  verticalAlign: "middle",
                                  padding: "11px 12px",
                                  borderBottom: `1px solid ${LINE}`,
                                  fontVariantNumeric: "tabular-nums",
                                }}
                              >
                                <Text
                                  fz={12}
                                  fw={600}
                                  c={GOOD}
                                  lh={1.35}
                                  style={{ fontVariantNumeric: "tabular-nums" }}
                                >
                                  {stageMetric.toLocaleString("en-IN")}
                                </Text>
                              </Table.Td>
                              {/* <Table.Td
                                ta="right"
                                style={{
                                  verticalAlign: "middle",
                                  padding: "11px 12px",
                                  borderBottom: `1px solid ${LINE}`,
                                  fontVariantNumeric: "tabular-nums",
                                }}
                              >
                                <Text fz={12} fw={600} c={wrColor} lh={1.35}>
                                  {wrStr}%
                                </Text>
                              </Table.Td> */}
                              {/* <Table.Td
                                ta="right"
                                style={{
                                  verticalAlign: "middle",
                                  padding: "11px 12px",
                                  borderBottom: `1px solid ${LINE}`,
                                  fontVariantNumeric: "tabular-nums",
                                }}
                              >
                                <Text fz={12} fw={600} c={INK} lh={1.35}>
                                  —
                                </Text>
                              </Table.Td> */}
                              <Table.Td
                                ta="center"
                                style={{
                                  width: 100,
                                  verticalAlign: "middle",
                                  padding: "11px 12px",
                                  borderBottom: `1px solid ${LINE}`,
                                }}
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
      apiType={apiType}
      company={company}
      filters={filters}
      customerCode={customerDrawer?.code ?? null}
      customerName={customerDrawer?.name ?? ""}
    />
    </>
  );
}
