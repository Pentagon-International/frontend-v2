import { useMemo, useState } from "react";
import {
  ActionIcon,
  Box,
  Button,
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
  Center,
} from "@mantine/core";
import { IconChevronRight, IconSend, IconX } from "@tabler/icons-react";
import { useDisclosure } from "@mantine/hooks";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import { apiCallProtected } from "../../../../api/axios";
import { URL } from "../../../../api/serverUrls";
import {
  getEnquiryConversionDashboardData,
  extractNumericValue,
  type EnquiryConversionSalespersonRow,
} from "../../../../service/dashboard.service";
import type { EnquiryConversionPageFilters } from "./EnquiryConversionFilters";
import type { StageFunnelRow } from "./StageFunnelCard";
import { enquiryConversionColors } from "./enquiryConversionTokens";
import {
  EnquiryConversionDrawerBack,
  EnquiryConversionDrawerHeaderSeparator,
} from "./EnquiryConversionDrawerBack";

const NAVY = "#1E3A8A";
const FONT =
  "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, system-ui, sans-serif";
const INK = "#0f172a";
const INK3 = "#64748b";
const INK4 = "#94a3b8";
const LINE = "#e2e8f0";
const PANEL_BG = "#f1f5f9";
const TABLE_HEAD_BG = "#f8fafc";

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

/** Maps funnel row label from dashboard mapper → POST body `type`. */
export function funnelStageRowToApiType(row: StageFunnelRow | null): string | null {
  if (!row) return null;
  const s = row.stage.trim();
  if (s.toLowerCase() === "active") return "Active";
  if (s === "Quoted") return "QUOTE CREATED";
  if (s === "Won") return "GAINED";
  if (s === "Lost") return "LOST";
  return "Active";
}

function displayStageTitle(row: StageFunnelRow | null): string {
  if (!row) return "Stage";
  if (row.stage.toLowerCase() === "active") return "New";
  return row.stage;
}

/** Raw field from `data[]` for the funnel stage (e.g. `active: "1 (100%)"`). */
function stageMetricFieldForRep(
  item: EnquiryConversionSalespersonRow,
  row: StageFunnelRow
): string | number | undefined {
  const s = row.stage.trim();
  if (s.toLowerCase() === "active") return item.active;
  if (s === "Quoted") return item.quote_created;
  if (s === "Won") return item.gained;
  if (s === "Lost") return item.lost;
  return undefined;
}

/**
 * Parses API strings like `"1 (100%)"` → count `1`, share `100`.
 * If the string has no `(pct%)` suffix, returns count via `extractNumericValue` and `apiSharePct: null`.
 */
function parseCountAndShareFromApiStageField(
  value: string | number | null | undefined
): { count: number; apiSharePct: number | null } {
  if (value == null) return { count: 0, apiSharePct: null };
  if (typeof value === "number") {
    return { count: value, apiSharePct: null };
  }
  const str = String(value).trim();
  const m = str.match(
    /^\s*(\d+(?:\.\d+)?)\s*\(\s*(\d+(?:\.\d+)?)\s*%\s*\)\s*$/i
  );
  if (m) {
    return {
      count: parseFloat(m[1]),
      apiSharePct: parseFloat(m[2]),
    };
  }
  return { count: extractNumericValue(str), apiSharePct: null };
}

function summaryTotalForStage(
  row: StageFunnelRow | null,
  summary: { total_enquiry?: number | string; total_active?: number | string; total_quote_created?: number | string; total_gain?: number | string; total_gained?: number | string; total_lost?: number | string } | undefined
): number {
  if (!row || !summary) return 0;
  const s = row.stage.trim();
  if (s.toLowerCase() === "active") return extractNumericValue(summary.total_active);
  if (s === "Quoted") return extractNumericValue(summary.total_quote_created);
  if (s === "Won")
    return extractNumericValue(summary.total_gain ?? summary.total_gained);
  if (s === "Lost") return extractNumericValue(summary.total_lost);
  return extractNumericValue(summary.total_enquiry);
}

type Props = {
  opened: boolean;
  onClose: () => void;
  stageRow: StageFunnelRow | null;
  company: string;
  filters: EnquiryConversionPageFilters;
  /**
   * Opens the rep summary drawer (`ConversionByRepSummary`). From there, choosing a customer opens
   * `ConversionByRepCustomerwiseEnquiryList` (same flow as “Conversion by Rep”).
   */
  onRepRowClick?: (salesperson: string, apiType: string | null) => void;
};

export function StageFunnelDetails({
  opened,
  onClose,
  stageRow,
  company,
  filters,
  onRepRowClick,
}: Props) {
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
  const [emailRepRow, setEmailRepRow] =
    useState<EnquiryConversionSalespersonRow | null>(null);

  const fd = filters.fromDate;
  const td = filters.toDate;
  const apiType = funnelStageRowToApiType(stageRow);
  const normalizedApiType = (apiType ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
  const stageCountLabel =
    normalizedApiType === "ACTIVE"
      ? "ACTIVE COUNT"
      : normalizedApiType === "QUOTE CREATED"
        ? "QUOTE CREATED COUNT"
        : normalizedApiType === "GAINED"
          ? "WON COUNT"
          : normalizedApiType === "LOST"
            ? "LOST COUNT"
            : "STAGE COUNT";

  const handleDrawerClose = () => {
    closeSendEmail();
    setEmailErrors({ to_email: "", cc_email: "" });
    setEmailRepRow(null);
    setSendingEmail(false);
    onClose();
  };

  const handleOpenSendEmail = (row: EnquiryConversionSalespersonRow) => {
    const cleanedTo = cleanEmailString(row.salesperson_email ?? "");
    const cleanedCc = normalizeCcField(row.cc_mail as string | string[] | undefined);
    const name = row.salesperson?.trim() || "Rep";
    setEmailRepRow(row);
    setEmailForm({
      to_email: cleanedTo,
      cc_email: cleanedCc,
      subject: `Enquiry Conversion - ${name}`,
      message: "",
    });
    setEmailErrors({ to_email: "", cc_email: "" });
    openSendEmail();
  };

  const handleSendEmail = async () => {
    if (!emailRepRow) {
      toast.error("No rep data available to send email");
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

    const row = emailRepRow;
    const salespersonName = (row.salesperson ?? "").trim();
    const data_table = {
      salesperson: salespersonName,
      active: extractNumericValue(row.active),
      gained: extractNumericValue(row.gained),
      lost: extractNumericValue(row.lost),
      quote_created: extractNumericValue(row.quote_created),
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
      setEmailRepRow(null);
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

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: [
      "enquiryConversionStageFunnelDetails",
      company,
      fd?.toISOString() ?? "",
      td?.toISOString() ?? "",
      apiType ?? "",
      filters.service ?? "",
      filters.salesperson.trim(),
      stageRow?.stage ?? "",
    ],
    queryFn: () =>
      getEnquiryConversionDashboardData({
        company,
        date_from: dayjs(fd!).format("DD-MM-YYYY"),
        date_to: dayjs(td!).format("DD-MM-YYYY"),
        type: apiType,
        service: filters.service?.trim() || null,
        salesperson: filters.salesperson.trim() || null,
      }),
    enabled: opened && !!stageRow && !!company && !!fd && !!td,
    staleTime: 20_000,
  });

  const vm = useMemo(() => {
    if (!stageRow) return null;
    const summary = data?.summary;
    const raw = Array.isArray(data?.data) ? data!.data! : [];

    const rowsWithCount = raw.map((item) => {
      const field = stageMetricFieldForRep(item, stageRow);
      const { count, apiSharePct } = parseCountAndShareFromApiStageField(field);
      return { item, count, apiSharePct };
    });

    const sorted = [...rowsWithCount].sort((a, b) => b.count - a.count);
    const totalFromReps = sorted.reduce((s, r) => s + r.count, 0);
    const totalCount = Math.max(
      totalFromReps,
      summaryTotalForStage(stageRow, summary)
    );
    const maxC = Math.max(...sorted.map((r) => r.count), 1);
    const repRows = sorted.map((r) => {
      const share =
        r.apiSharePct != null
          ? r.apiSharePct
          : totalFromReps > 0
            ? (r.count / totalFromReps) * 100
            : 0;
      return {
        item: r.item,
        name: r.item.salesperson ?? "—",
        sub: "—",
        count: r.count,
        share,
        valueLabel: "—" as string,
        barPct: (r.count / maxC) * 100,
      };
    });

    const nAll = raw.length;
    const repsWithWork = repRows.filter((r) => r.count > 0).length;
    const repsActive = repsWithWork > 0 ? repsWithWork : nAll;
    const avgPerRep =
      nAll > 0 ? (totalCount / nAll).toFixed(1) : (repsActive > 0 ? (totalCount / repsActive).toFixed(1) : "0.0");

    return {
      totalCount,
      pipelineLabel: "—" as const,
      repsActive,
      avgPerRep,
      repRows,
      dotColor: stageRow.dotColor || stageRow.barColor,
    };
  }, [data, stageRow]);

  const titleName = displayStageTitle(stageRow);
  const busy = (isLoading || isFetching) && opened;

  return (
    <>
    <Drawer
      opened={opened}
      onClose={handleDrawerClose}
      position="right"
      size="min(920px, 92vw)"
      padding={0}
      offset={8}
      radius="md"
      zIndex={300}
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
            borderBottom: `1px solid ${LINE}`,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
            background: enquiryConversionColors.panelBg,
          }}
        >
          <Group gap={10} wrap="nowrap" align="center" style={{ minWidth: 0, flex: 1 }}>
            <EnquiryConversionDrawerBack onClick={handleDrawerClose} />
            <EnquiryConversionDrawerHeaderSeparator />
            <Text fw={600} fz={14} c={INK} truncate style={{ minWidth: 0, letterSpacing: "-0.01em" }}>
              {titleName} stage
            </Text>
          </Group>
          <ActionIcon
            variant="subtle"
            color="gray"
            onClick={handleDrawerClose}
            aria-label="Close"
            size={30}
            radius="md"
            style={{ color: INK3 }}
          >
            <IconX size={18} stroke={2} />
          </ActionIcon>
        </Box>

        <ScrollArea type="scroll" scrollbarSize={8} style={{ flex: 1, minHeight: 0 }}>
          <Stack gap={0} p={22} pb={32} style={{ background: PANEL_BG }}>
            {error ? (
              <Text fz={13} c="red">
                {(error as Error).message}
              </Text>
            ) : null}

            {stageRow ? (
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
                  <Group gap={8} align="center" wrap="nowrap">
                    <Box
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 4,
                        background: vm?.dotColor ?? stageRow.dotColor ?? stageRow.barColor,
                        flexShrink: 0,
                      }}
                    />
                    <Text component="h2" m={0} fw={600} fz={18} c={INK} lh={1.2} style={{ letterSpacing: "-0.01em" }}>
                      {titleName} · Reps breakdown
                    </Text>
                  </Group>
                  <Text fz={12} fw={400} c={INK3} lh={1.45}>
                    Click a rep to see their customers
                  </Text>
                </Box>

                {busy ? (
                  <Center py={40}>
                    <Loader color="#101C2E" />
                  </Center>
                ) : vm ? (
                  <>
                    <SimpleGrid
                      cols={{ base: 1, sm: 4 }}
                      spacing={10}
                      mb={14}
                      style={{ gridTemplateColumns: "repeat(4, 1fr)" }}
                    >
                      {(
                        [
                          ["TOTAL ENQUIRIES", vm.totalCount.toLocaleString("en-IN")],
                          [
                            stageCountLabel,
                            vm.totalCount.toLocaleString("en-IN"),
                          ],
                          // ["PIPELINE VALUE", vm.pipelineLabel],
                          ["REPS ACTIVE", String(vm.repsActive)],

                          // ["AVG / REP", vm.avgPerRep],
                        ] as const
                      ).map(([label, val]) => (
                        <Box
                          key={label}
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
                            {label}
                          </Text>
                          <Text fz={18} fw={600} c={INK} lh={1.15} mt={2} style={{ letterSpacing: "-0.01em" }}>
                            {val}
                          </Text>
                        </Box>
                      ))}
                    </SimpleGrid>

                    <Box
                      style={{
                        background: enquiryConversionColors.panelBg,
                        border: `1px solid ${LINE}`,
                        borderRadius: 10,
                        overflow: "hidden",
                      }}
                    >
                      <Table
                        horizontalSpacing={12}
                        verticalSpacing={11}
                        withRowBorders={false}
                        highlightOnHover
                        highlightOnHoverColor={TABLE_HEAD_BG}
                      >
                        <Table.Thead>
                          <Table.Tr>
                            {[
                              "Sales rep",
                              "Distribution",
                              "Count",
                              "Share",
                              // "VALUE",
                              "Send email",
                              "",
                            ].map((h, i) => (
                              <Table.Th
                                key={h + String(i)}
                                fz={11}
                                fw={500}
                                c={INK3}
                                tt="uppercase"
                                ta={
                                  i === 0
                                    ? "left"
                                    : i === 5 || i === 6
                                      ? "center"
                                      : "right"
                                }
                                style={
                                  i === 1
                                    ? {
                                        minWidth: 120,
                                        background: TABLE_HEAD_BG,
                                        padding: "10px 12px",
                                        borderBottom: `1px solid ${LINE}`,
                                      }
                                    : i === 5
                                      ? {
                                          width: 100,
                                          background: TABLE_HEAD_BG,
                                          padding: "10px 12px",
                                          borderBottom: `1px solid ${LINE}`,
                                        }
                                      : {
                                          background: TABLE_HEAD_BG,
                                          padding: "10px 12px",
                                          borderBottom: `1px solid ${LINE}`,
                                        }
                                }
                              >
                                {h}
                              </Table.Th>
                            ))}
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {vm.repRows.map((r, idx) => {
                            const openRep = () => {
                              const name = r.name?.trim();
                              if (name && onRepRowClick) onRepRowClick(name, apiType);
                            };
                            return (
                            <Table.Tr
                              key={`${r.name}-${idx}`}
                              onClick={onRepRowClick ? openRep : undefined}
                              onKeyDown={
                                onRepRowClick
                                  ? (ev) => {
                                      if (ev.key === "Enter" || ev.key === " ") {
                                        ev.preventDefault();
                                        openRep();
                                      }
                                    }
                                  : undefined
                              }
                              tabIndex={onRepRowClick ? 0 : undefined}
                              role={onRepRowClick ? "button" : undefined}
                              style={{
                                cursor: onRepRowClick ? "pointer" : undefined,
                              }}
                            >
                              <Table.Td style={{ verticalAlign: "middle", borderBottom: `1px solid ${LINE}` }}>
                                <Text fz={12} fw={600} c={INK}>
                                  {r.name}
                                </Text>
                                {/* <Text fz={11} fw={500} c="#94A3B8" mt={2}>
                                  {r.sub}
                                </Text> */}
                              </Table.Td>
                              <Table.Td style={{ borderBottom: `1px solid ${LINE}` }}>
                                <Box
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    height: 22,
                                  }}
                                >
                                  <Box
                                    style={{
                                      flex: 1,
                                      height: 6,
                                      background: "#F1F5F9",
                                      borderRadius: 3,
                                      overflow: "hidden",
                                      maxWidth: 160,
                                    }}
                                  >
                                    <Box
                                      style={{
                                        width: `${Math.min(100, r.barPct)}%`,
                                        height: "100%",
                                        background: NAVY,
                                        borderRadius: 3,
                                      }}
                                    />
                                  </Box>
                                </Box>
                              </Table.Td>
                              <Table.Td ta="right" style={{ borderBottom: `1px solid ${LINE}` }}>
                                <Text fz={12} fw={600} style={{ fontVariantNumeric: "tabular-nums" }}>
                                  {r.count.toLocaleString("en-IN")}
                                </Text>
                              </Table.Td>
                              <Table.Td ta="right" style={{ borderBottom: `1px solid ${LINE}` }}>
                                <Text fz={12} fw={500} style={{ fontVariantNumeric: "tabular-nums" }}>
                                  {r.share.toFixed(1)}%
                                </Text>
                              </Table.Td>
                              {/* <Table.Td ta="right">
                                <Text fz={13} style={{ fontVariantNumeric: "tabular-nums" }}>
                                  {r.valueLabel}
                                </Text>
                              </Table.Td> */}
                              <Table.Td
                                ta="center"
                                style={{ width: 100, verticalAlign: "middle", borderBottom: `1px solid ${LINE}` }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Tooltip label="Send Email" position="top" withArrow>
                                  <ActionIcon
                                    variant="light"
                                    color="#105476"
                                    size="md"
                                    aria-label="Send email to this rep"
                                    disabled={busy}
                                    onClick={() => handleOpenSendEmail(r.item)}
                                  >
                                    <IconSend size={16} />
                                  </ActionIcon>
                                </Tooltip>
                              </Table.Td>
                              <Table.Td ta="center" style={{ width: 36, borderBottom: `1px solid ${LINE}` }}>
                                <IconChevronRight size={16} color={INK4} stroke={2} />
                              </Table.Td>
                            </Table.Tr>
                            );
                          })}
                        </Table.Tbody>
                      </Table>
                      {vm.repRows.length === 0 ? (
                        <Box px={16} pb={16}>
                          <Text fz={13} c="#94A3B8">
                            No rep breakdown for this filter.
                          </Text>
                        </Box>
                      ) : null}
                    </Box>
                  </>
                ) : null}
              </>
            ) : null}
          </Stack>
        </ScrollArea>
      </Box>
    </Drawer>

    <Modal
      opened={sendEmailOpened}
      onClose={() => {
        closeSendEmail();
        setEmailRepRow(null);
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
              setEmailRepRow(null);
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
    </>
  );
}
