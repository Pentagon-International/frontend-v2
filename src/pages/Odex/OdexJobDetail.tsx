import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Center,
  Collapse,
  Divider,
  Flex,
  Group,
  Image,
  Loader,
  Modal,
  Progress,
  RingProgress,
  ScrollArea,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  Textarea,
  ThemeIcon,
  Timeline,
} from "@mantine/core";
import {
  IconAlertCircle,
  IconArrowLeft,
  IconCamera,
  IconCheck,
  IconCircleCheck,
  IconClock,
  IconDownload,
  IconFileCode,
  IconListDetails,
  IconMessage,
  IconMessage2Bolt,
  IconPhoto,
  IconRefresh,
  IconTimeline,
  IconX,
} from "@tabler/icons-react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { Link, useNavigate, useParams } from "react-router-dom";
import dayjs from "dayjs";
import { ToastNotification } from "../../components";
import { useOdexJobDetail } from "../../hooks/useOdexJobDetail";
import useDateFormat from "../../hooks/useDateFormat";
import { odexApi } from "../../services/odexApi";
import type { OdexFieldMapping, OdexScreenshot } from "../../types/odex";
import {
  formatOdexScreenshotLabel,
  getOdexScreenshotSrc,
} from "../../utils/odexScreenshot";
import {
  formatOdexTimelineTitle,
  isOdexTimelineMilestone,
  timelineEventColor,
} from "../../utils/odexTimeline";
import OdexCaptchaModal from "./components/OdexCaptchaModal";
import OdexStatusBadge from "./components/OdexStatusBadge";
import { CONSOL_IMPORT_JOB_EDIT_PATH, ODEX_JOBS_PATH } from "./odexUrls";
import useAuthStore from "../../store/authStore";

const PRIMARY = "#105476";
const PAGE_BG = "#F8F8F8";
const CARD_BG = "#FFFFFF";
const CARD_BORDER = "1px solid #E9ECEF";

const ODEX_DETAIL_TABS = [
  { value: "summary", label: "Summary", access: "public" },
  { value: "payload", label: "Payload", access: "admin" },
  { value: "fields", label: "Filled Fields", access: "public" },
  { value: "timeline", label: "Timeline", access: "public" },
  { value: "screenshots", label: "Screenshots", access: "public" },
  { value: "logs", label: "Logs", access: "admin" },
  { value: "result", label: "Result", access: "admin" },
] as const;

type OdexDetailTab = (typeof ODEX_DETAIL_TABS)[number]["value"];

function odexTabStyle(active: boolean): CSSProperties {
  return {
    textAlign: "center",
    padding: "12px 16px",
    backgroundColor: "transparent",
    borderBottom: active ? `3px solid ${PRIMARY}` : "none",
    color: PRIMARY,
    fontSize: 14,
    fontWeight: active ? 700 : 500,
  };
}

function formatJson(value: unknown): string {
  if (value == null) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function timelineIcon(type: string) {
  const t = type.toLowerCase();
  if (t.includes("fail")) return <IconX size={14} />;
  if (t.includes("complete") || t === "job_completed")
    return <IconCheck size={14} />;
  return undefined;
}

function SectionCard({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Box mb="lg">
      <Group justify="space-between" align="flex-start" mb="md" wrap="wrap">
        <Stack gap={2}>
          <Text fw={600} size="md" c={PRIMARY} style={{ fontFamily: "Inter" }}>
            {title}
          </Text>
          {description ? (
            <Text size="sm" c="dimmed" style={{ fontFamily: "Inter" }}>
              {description}
            </Text>
          ) : null}
        </Stack>
        {actions}
      </Group>
      {children}
    </Box>
  );
}

export default function OdexJobDetail() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const dateFormat = useDateFormat();

  const formatDateTime = (value: string | null | undefined) => {
    if (!value) return "—";
    const d = dayjs(value);
    return d.isValid() ? d.format(`${dateFormat} HH:mm`) : "—";
  };

  const {
    job,
    fieldMappings,
    screenshots,
    steps,
    logs,
    timeline,
    result,
    loading,
    error,
    reload,
  } = useOdexJobDetail(jobId);

  const [activeTab, setActiveTab] = useState<OdexDetailTab>("summary");
  const [captchaOpen, setCaptchaOpen] = useState(false);
  const [overridesOpen, setOverridesOpen] = useState(false);
  const [screenshotModal, setScreenshotModal] = useState<OdexScreenshot | null>(
    null,
  );
  const [cancelling, setCancelling] = useState(false);
  const user = useAuthStore((state) => state.user);
  const isUserAdmin = Boolean(user?.is_staff);

  const sortedMappings = useMemo(
    () =>
      [...fieldMappings].sort(
        (a, b) => (b.confidence ?? 0) - (a.confidence ?? 0),
      ),
    [fieldMappings],
  );

  const milestoneTimeline = useMemo(
    () => timeline.filter(isOdexTimelineMilestone),
    [timeline],
  );

  const canCancel =
    job &&
    ["queued", "pending", "running", "waiting_captcha"].includes(
      String(job.status).toLowerCase(),
    );

  const showCaptcha =
    job && String(job.status).toLowerCase() === "waiting_captcha";

  const progressValue = job?.progress_percentage ?? 0;
  const isActiveJob =
    job &&
    !["completed", "failed", "cancelled"].includes(
      String(job.status).toLowerCase(),
    );

  const durationLabel = useMemo(() => {
    if (job?.duration_seconds != null) return `${job.duration_seconds}s`;
    if (job?.started_at && job?.completed_at) {
      return `${dayjs(job.completed_at).diff(dayjs(job.started_at), "second")}s`;
    }
    return "—";
  }, [job]);

  const handleCancel = async () => {
    if (!jobId) return;
    setCancelling(true);
    try {
      await odexApi.cancelJob(jobId);
      ToastNotification({ type: "success", message: "ODEX job cancelled" });
      reload();
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to cancel job";
      ToastNotification({ type: "error", message });
    } finally {
      setCancelling(false);
    }
  };

  const exportMappingsCsv = () => {
    const header =
      "payload_field,payload_value,portal_field,selector,confidence\n";
    const lines = sortedMappings.map((m) =>
      [
        m.payload_field,
        JSON.stringify(m.payload_value ?? ""),
        m.portal_field ?? "",
        m.selector ?? "",
        m.confidence ?? "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([header + lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `odex-field-mappings-${jobId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const referenceNumber =
    job?.reference_number ??
    (result?.reference_number as string | undefined) ??
    (job?.final_result?.reference_number as string | undefined);

  const tabBadgeCount = (tab: OdexDetailTab): number | null => {
    switch (tab) {
      case "fields":
        return sortedMappings.length > 0 ? sortedMappings.length : null;
      case "timeline":
        return milestoneTimeline.length > 0 ? milestoneTimeline.length : null;
      case "screenshots":
        return screenshots.length > 0 ? screenshots.length : null;
      default:
        return null;
    }
  };

  if (loading && !job) {
    return (
      <Box
        style={{
          backgroundColor: PAGE_BG,
          borderRadius: 8,
          minHeight: "calc(100vh - 112px)",
        }}
      >
        <Center py={80}>
          <Loader color={PRIMARY} size="lg" />
        </Center>
      </Box>
    );
  }

  if (error && !job) {
    return (
      <Box
        p="sm"
        style={{ backgroundColor: PAGE_BG, minHeight: "calc(100vh - 112px)" }}
      >
        <Box
          maw={720}
          mx="auto"
          p="lg"
          style={{
            backgroundColor: CARD_BG,
            borderRadius: 8,
            border: CARD_BORDER,
          }}
        >
          <Alert color="red" title="Error" icon={<IconAlertCircle size={16} />}>
            {error}
          </Alert>
          <Button
            mt="md"
            variant="outline"
            color={PRIMARY}
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate(ODEX_JOBS_PATH)}
          >
            Back to ODEX Jobs
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      style={{
        backgroundColor: PAGE_BG,
        position: "relative",
        borderRadius: 8,
        overflow: "hidden",
        height: "100%",
        marginTop: 8,
      }}
    >
      {loading && job ? (
        <Center
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(255, 255, 255, 0.65)",
            zIndex: 15,
          }}
        >
          <Loader color={PRIMARY} size="lg" />
        </Center>
      ) : null}

      <Box
        p="sm"
        mx="auto"
        style={{ backgroundColor: PAGE_BG, height: "100%" }}
      >
        <Flex
          direction="column"
          gap={8}
          style={{ height: "calc(100vh - 88px)", width: "100%" }}
        >
          {/* Header strip */}
          <Box
            style={{
              backgroundColor: CARD_BG,
              borderRadius: 8,
              padding: "8px 24px",
              border: CARD_BORDER,
              flexShrink: 0,
            }}
          >
            <Group
              justify="space-between"
              align="flex-start"
              wrap="wrap"
              gap="md"
            >
              <Stack gap="xs" style={{ flex: 1, minWidth: 260 }}>
                <Text
                  size="md"
                  fw={600}
                  c={PRIMARY}
                  style={{ fontFamily: "Inter", fontSize: 16 }}
                >
                  ODEX Job — {job?.job_ref || jobId}
                </Text>
                <Group gap="sm" wrap="wrap">
                  <OdexStatusBadge status={job?.status ?? "queued"} />
                  {job?.odex_type ? (
                    <Badge variant="outline" color={PRIMARY}>
                      {job.odex_type.replace(/_/g, " ")}
                    </Badge>
                  ) : null}
                </Group>
                {job?.last_log ? (
                  <Group gap={4} align="center">
                    <IconMessage2Bolt size={16} color="#105476" />
                    <Text
                      size="sm"
                      c="dimmed"
                      lineClamp={2}
                      style={{ fontFamily: "Inter" }}
                    >
                      {job.last_log}
                    </Text>
                  </Group>
                ) : null}
                {isActiveJob && progressValue > 0 ? (
                  <Box maw={480}>
                    <Group justify="space-between" mb={6}>
                      <Text size="xs" fw={500} c="dimmed">
                        Progress
                      </Text>
                      <Text size="xs" fw={600} c={PRIMARY}>
                        {Math.round(progressValue)}%
                      </Text>
                    </Group>
                    <Progress
                      value={progressValue}
                      color={PRIMARY}
                      size="md"
                      radius="xl"
                    />
                  </Box>
                ) : null}
              </Stack>
              <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="lg" mt={12}>
                <Box>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={4}>
                    Filled Fields
                  </Text>
                  <Text size="lg" fw={600} c={PRIMARY}>
                    {sortedMappings.length ?? "—"}
                  </Text>
                </Box>
                <Box>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={4}>
                    Screenshots
                  </Text>
                  <Text size="lg" fw={600} c={PRIMARY}>
                    {screenshots.length || job?.screenshot_count || 0}
                  </Text>
                </Box>
                <Box>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={4}>
                    Duration
                  </Text>
                  <Text size="lg" fw={600} c={PRIMARY}>
                    {durationLabel}
                  </Text>
                </Box>
                <Box>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={4}>
                    Consol Job
                  </Text>
                  {job?.consol_job_id ? (
                    <Anchor
                      component={Link}
                      to={CONSOL_IMPORT_JOB_EDIT_PATH}
                      state={{ job: { id: job.consol_job_id } }}
                      c={PRIMARY}
                      size="lg"
                      fw={600}
                    >
                      #{job.consol_job_id}
                    </Anchor>
                  ) : (
                    <Text size="lg" fw={600} c={PRIMARY}>
                      —
                    </Text>
                  )}
                </Box>
              </SimpleGrid>
            </Group>
            {job?.error_message ? (
              <Alert
                color="red"
                title="Automation failed"
                icon={<IconAlertCircle size={16} stroke={3} />}
                radius="md"
                mt="sm"
                p={"8px 16px"}
                h={"fit-content"}
                styles={{ icon: { marginTop: 0, marginInlineEnd: 2 } }}
              >
                {job.error_message}
              </Alert>
            ) : null}

            {referenceNumber ? (
              <Alert
                color="green"
                title="Reference Number"
                icon={<IconCircleCheck size={16} stroke={3} />}
                radius="md"
                mt="sm"
                p={"8px 16px"}
                h={"fit-content"}
                styles={{ icon: { marginTop: 0, marginInlineEnd: 2 } }}
              >
                <Text fw={700} size="xl" ff="monospace">
                  {referenceNumber}
                </Text>
              </Alert>
            ) : null}
          </Box>

          {/* Tabs + scrollable content */}
          <Box
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              borderRadius: 8,
              minHeight: 0,
            }}
          >
            <Tabs
              value={activeTab}
              onChange={(v) => {
                if (v) setActiveTab(v as OdexDetailTab);
              }}
              color={PRIMARY}
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                overflow: "hidden",
                minHeight: 0,
              }}
            >
              <Tabs.List
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  borderBottom: CARD_BORDER,
                  backgroundColor: CARD_BG,
                  padding: "0 12px",
                  borderRadius: "8px 8px 0 0",
                  flexShrink: 0,
                  minHeight: 44,
                }}
              >
                {ODEX_DETAIL_TABS.map((tab) => {
                  if (tab.access === "admin" && !isUserAdmin) return null;
                  const count = tabBadgeCount(tab.value);
                  return (
                    <Tabs.Tab
                      key={tab.value}
                      value={tab.value}
                      style={odexTabStyle(activeTab === tab.value)}
                      rightSection={
                        count != null ? (
                          <Badge size="sm" radius="xl" ml={6}>
                            {count}
                          </Badge>
                        ) : undefined
                      }
                    >
                      {tab.label}
                    </Tabs.Tab>
                  );
                })}
              </Tabs.List>

              <Box
                style={{
                  flex: 1,
                  overflowY: "auto",
                  backgroundColor: CARD_BG,
                  padding: "12px 24px 12px",
                  borderRadius: "0 0 8px 8px",
                  border: CARD_BORDER,
                  borderTop: "none",
                }}
              >
                <Tabs.Panel value="summary">
                  <Stack gap="lg">
                    <SectionCard
                      title="Job timeline"
                      description="Key timestamps for this automation run"
                    >
                      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
                        <Box>
                          <Text size="xs" c="dimmed" mb={4}>
                            Created
                          </Text>
                          <Text size="sm" fw={500}>
                            {formatDateTime(job?.created_at)}
                          </Text>
                        </Box>
                        <Box>
                          <Text size="xs" c="dimmed" mb={4}>
                            Started
                          </Text>
                          <Text size="sm" fw={500}>
                            {formatDateTime(job?.started_at)}
                          </Text>
                        </Box>
                        <Box>
                          <Text size="xs" c="dimmed" mb={4}>
                            Completed
                          </Text>
                          <Text size="sm" fw={500}>
                            {formatDateTime(job?.completed_at)}
                          </Text>
                        </Box>
                        <Box>
                          <Text size="xs" c="dimmed" mb={4}>
                            Job ID
                          </Text>
                          <Text size="sm" fw={500} ff="monospace">
                            {jobId}
                          </Text>
                        </Box>
                      </SimpleGrid>
                    </SectionCard>

                    {isActiveJob && (
                      <SectionCard title="Live status">
                        <Group align="center" gap="xl">
                          <RingProgress
                            size={100}
                            thickness={10}
                            sections={[
                              { value: progressValue, color: PRIMARY },
                            ]}
                            label={
                              <Center>
                                <Text size="sm" fw={700} c={PRIMARY}>
                                  {Math.round(progressValue)}%
                                </Text>
                              </Center>
                            }
                          />
                          <Stack gap={4}>
                            <OdexStatusBadge status={job?.status ?? "queued"} />
                            <Text size="sm" c="dimmed">
                              Automation updates in real time while the job is
                              active.
                            </Text>
                          </Stack>
                        </Group>
                      </SectionCard>
                    )}

                    {steps.length > 0 && (
                      <SectionCard title="Automation steps">
                        <Table withTableBorder striped highlightOnHover>
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th>Step</Table.Th>
                              <Table.Th>Status</Table.Th>
                              <Table.Th>Started</Table.Th>
                              <Table.Th>Completed</Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {steps.map((s, i) => (
                              <Table.Tr key={s.id ?? i}>
                                <Table.Td fw={500}>{s.step_name}</Table.Td>
                                <Table.Td>
                                  <Badge
                                    variant="light"
                                    color={
                                      s.status.toLowerCase().includes("fail")
                                        ? "red"
                                        : s.status
                                              .toLowerCase()
                                              .includes("complete")
                                          ? "green"
                                          : "blue"
                                    }
                                  >
                                    {s.status}
                                  </Badge>
                                </Table.Td>
                                <Table.Td>
                                  {formatDateTime(s.started_at)}
                                </Table.Td>
                                <Table.Td>
                                  {formatDateTime(s.completed_at)}
                                </Table.Td>
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
                        </Table>
                      </SectionCard>
                    )}
                  </Stack>
                </Tabs.Panel>

                <Tabs.Panel value="payload">
                  <SectionCard
                    title="Extracted payload"
                    description="Data sent to the ODEX portal automation engine"
                  >
                    <Textarea
                      readOnly
                      autosize
                      minRows={14}
                      value={formatJson(job?.extracted_payload)}
                      styles={{
                        input: {
                          fontFamily: "ui-monospace, monospace",
                          fontSize: 12,
                          backgroundColor: "#F8F9FA",
                        },
                      }}
                    />
                    <Divider my="md" />
                    <Button
                      variant="light"
                      color={PRIMARY}
                      size="compact-sm"
                      onClick={() => setOverridesOpen((o) => !o)}
                    >
                      {overridesOpen ? "Hide" : "Show"} frontend overrides
                    </Button>
                    <Collapse in={overridesOpen} mt="md">
                      <Textarea
                        label="Frontend overrides"
                        readOnly
                        autosize
                        minRows={8}
                        value={formatJson(job?.frontend_overrides)}
                        styles={{
                          input: {
                            fontFamily: "ui-monospace, monospace",
                            fontSize: 12,
                            backgroundColor: "#F8F9FA",
                          },
                        }}
                      />
                    </Collapse>
                  </SectionCard>
                </Tabs.Panel>

                <Tabs.Panel value="fields">
                  <SectionCard
                    title="Field mappings"
                    description="Portal fields matched from the job payload, sorted by confidence"
                    actions={
                      <Button
                        variant="outline"
                        color={PRIMARY}
                        size="xs"
                        leftSection={<IconDownload size={14} />}
                        onClick={exportMappingsCsv}
                        disabled={sortedMappings.length === 0}
                      >
                        Export CSV
                      </Button>
                    }
                  >
                    <ScrollArea>
                      <Table withTableBorder striped highlightOnHover>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Payload field</Table.Th>
                            <Table.Th>Payload value</Table.Th>
                            <Table.Th>Portal field</Table.Th>
                            <Table.Th>Selector</Table.Th>
                            <Table.Th>Confidence</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {sortedMappings.length === 0 ? (
                            <Table.Tr>
                              <Table.Td colSpan={5}>
                                <Text size="sm" c="dimmed" ta="center" py="lg">
                                  No field mappings yet
                                </Text>
                              </Table.Td>
                            </Table.Tr>
                          ) : (
                            sortedMappings.map((m: OdexFieldMapping, i) => (
                              <Table.Tr key={m.id ?? i}>
                                <Table.Td fw={500}>{m.payload_field}</Table.Td>
                                <Table.Td maw={280}>
                                  <Text size="sm" lineClamp={2}>
                                    {typeof m.payload_value === "object"
                                      ? JSON.stringify(m.payload_value)
                                      : String(m.payload_value ?? "")}
                                  </Text>
                                </Table.Td>
                                <Table.Td>{m.portal_field ?? "—"}</Table.Td>
                                <Table.Td>
                                  <Text size="xs" ff="monospace" c="dimmed">
                                    {m.selector ?? "—"}
                                  </Text>
                                </Table.Td>
                                <Table.Td>
                                  {m.confidence != null ? (
                                    <Badge
                                      variant="light"
                                      color={
                                        (m.confidence > 1
                                          ? m.confidence
                                          : m.confidence * 100) >= 80
                                          ? "green"
                                          : (m.confidence > 1
                                                ? m.confidence
                                                : m.confidence * 100) >= 50
                                            ? "yellow"
                                            : "gray"
                                      }
                                    >
                                      {(m.confidence > 1
                                        ? m.confidence
                                        : m.confidence * 100
                                      ).toFixed(0)}
                                      %
                                    </Badge>
                                  ) : (
                                    "—"
                                  )}
                                </Table.Td>
                              </Table.Tr>
                            ))
                          )}
                        </Table.Tbody>
                      </Table>
                    </ScrollArea>
                  </SectionCard>
                </Tabs.Panel>

                <Tabs.Panel value="timeline">
                  <SectionCard
                    title="Event timeline"
                    description="Job lifecycle and automation step milestones (log lines are in the Logs tab)"
                  >
                    {milestoneTimeline.length === 0 ? (
                      <Text c="dimmed" size="sm" py="lg" ta="center">
                        No timeline events yet
                      </Text>
                    ) : (
                      <Timeline
                        active={milestoneTimeline.length}
                        bulletSize={28}
                        lineWidth={2}
                      >
                        {milestoneTimeline.map((ev, i) => (
                          <Timeline.Item
                            key={ev.id ?? `${ev.type}-${ev.created_at}-${i}`}
                            title={formatOdexTimelineTitle(ev)}
                            bullet={timelineIcon(ev.type)}
                            color={timelineEventColor(ev)}
                          >
                            <Group gap="xs" mb={4}>
                              {ev.status ? (
                                <Badge size="xs" variant="light" color="gray">
                                  {ev.status}
                                </Badge>
                              ) : null}
                              {ev.step_order != null ? (
                                <Badge
                                  size="xs"
                                  variant="outline"
                                  color={PRIMARY}
                                >
                                  Step {ev.step_order}
                                </Badge>
                              ) : null}
                            </Group>
                            {ev.message &&
                            ev.message !== ev.step_name &&
                            formatOdexTimelineTitle(ev).toLowerCase() !==
                              ev.message.toLowerCase() ? (
                              <Text size="sm" c="dimmed">
                                {ev.message}
                              </Text>
                            ) : null}
                            <Text size="xs" c="dimmed" mt={4}>
                              {formatDateTime(ev.created_at)}
                            </Text>
                          </Timeline.Item>
                        ))}
                      </Timeline>
                    )}
                  </SectionCard>
                </Tabs.Panel>

                <Tabs.Panel value="screenshots">
                  <SectionCard
                    title="Automation screenshots"
                    description="Captured at key steps during portal automation"
                  >
                    {screenshots.length === 0 ? (
                      <Center py={48}>
                        <Stack align="center" gap="xs">
                          <ThemeIcon
                            size={48}
                            radius="xl"
                            variant="light"
                            color={PRIMARY}
                          >
                            <IconCamera size={24} />
                          </ThemeIcon>
                          <Text c="dimmed" size="sm">
                            No screenshots captured yet
                          </Text>
                        </Stack>
                      </Center>
                    ) : (
                      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
                        {screenshots.map((shot) => {
                          const src = getOdexScreenshotSrc(shot, true);
                          return (
                            <Box
                              key={shot.id}
                              style={{
                                border: CARD_BORDER,
                                borderRadius: 8,
                                cursor: "pointer",
                                overflow: "hidden",
                                backgroundColor: CARD_BG,
                              }}
                              onClick={() => setScreenshotModal(shot)}
                            >
                              <Box pos="relative">
                                <Image
                                  src={src}
                                  alt={formatOdexScreenshotLabel(shot)}
                                  height={200}
                                  fit="cover"
                                  fallbackSrc="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200'%3E%3Crect fill='%23f1f3f5' width='400' height='200'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' fill='%23adb5bd' font-size='14'%3EImage unavailable%3C/text%3E%3C/svg%3E"
                                />
                                <Badge
                                  pos="absolute"
                                  top={10}
                                  left={10}
                                  variant="filled"
                                  color={PRIMARY}
                                  size="sm"
                                >
                                  {formatOdexScreenshotLabel(shot)}
                                </Badge>
                              </Box>
                              <Stack gap={4} p="sm">
                                {/* {shot.step_id != null && (
                                  <Text size="xs" c="dimmed">
                                    Step #{shot.step_id}
                                  </Text>
                                )} */}
                                <Text size="xs" c="dimmed">
                                  {formatDateTime(shot.created_at)}
                                </Text>
                              </Stack>
                            </Box>
                          );
                        })}
                      </SimpleGrid>
                    )}
                  </SectionCard>
                </Tabs.Panel>

                <Tabs.Panel value="logs">
                  <SectionCard title="Execution logs">
                    <ScrollArea h={480} type="auto" offsetScrollbars>
                      <Box
                        p="md"
                        style={{
                          backgroundColor: "#0d1117",
                          borderRadius: 8,
                          fontFamily: "ui-monospace, monospace",
                          fontSize: 12,
                          color: "#c9d1d9",
                          minHeight: 440,
                          lineHeight: 1.6,
                        }}
                      >
                        {logs.length === 0 ? (
                          <Text c="dimmed">No logs yet</Text>
                        ) : (
                          logs.map((line, i) => (
                            <Text
                              key={line.id ?? i}
                              size="xs"
                              mb={6}
                              component="div"
                            >
                              {line.created_at ? (
                                <Text span c="#8b949e">
                                  [{formatDateTime(line.created_at)}]{` `}
                                </Text>
                              ) : null}
                              {line.level ? (
                                <Text
                                  span
                                  c={
                                    line.level.toLowerCase() === "error"
                                      ? "#f85149"
                                      : line.level.toLowerCase() === "warning"
                                        ? "#d29922"
                                        : "#58a6ff"
                                  }
                                  fw={600}
                                >
                                  [{line.level}]{` `}
                                </Text>
                              ) : null}
                              {line.message || line.log_message}
                            </Text>
                          ))
                        )}
                      </Box>
                    </ScrollArea>
                  </SectionCard>
                </Tabs.Panel>

                <Tabs.Panel value="result">
                  <SectionCard
                    title="Final result"
                    description="Outcome returned after automation completed"
                  >
                    <Textarea
                      readOnly
                      autosize
                      minRows={16}
                      value={formatJson(job?.final_result ?? result)}
                      styles={{
                        input: {
                          fontFamily: "ui-monospace, monospace",
                          fontSize: 12,
                          backgroundColor: "#F8F9FA",
                        },
                      }}
                    />
                  </SectionCard>
                </Tabs.Panel>
              </Box>
            </Tabs>
          </Box>

          {/* Footer action bar — matches Air Export Booking stepper footer */}
          <Box
            style={{
              borderRadius: 8,
              backgroundColor: CARD_BG,
              minHeight: 60,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              padding: "8px 24px",
              border: CARD_BORDER,
              flexShrink: 0,
            }}
          >
            <Button
              variant="outline"
              color={PRIMARY}
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => navigate(ODEX_JOBS_PATH)}
            >
              Back to List
            </Button>
            <Group gap={8}>
              <Button
                variant="outline"
                color={PRIMARY}
                leftSection={<IconRefresh size={16} />}
                onClick={() => reload()}
                loading={loading}
              >
                Refresh
              </Button>
              {canCancel ? (
                <Button
                  color="red"
                  variant="outline"
                  loading={cancelling}
                  onClick={handleCancel}
                >
                  Cancel Job
                </Button>
              ) : null}
              {showCaptcha ? (
                <Button color="orange" onClick={() => setCaptchaOpen(true)}>
                  Submit Captcha
                </Button>
              ) : null}
            </Group>
          </Box>
        </Flex>
      </Box>

      <OdexCaptchaModal
        opened={captchaOpen}
        jobId={jobId ?? ""}
        onClose={() => setCaptchaOpen(false)}
        onSubmitted={reload}
      />

      <Modal
        opened={screenshotModal != null}
        onClose={() => setScreenshotModal(null)}
        title={
          screenshotModal
            ? formatOdexScreenshotLabel(screenshotModal)
            : "Screenshot"
        }
        size="xl"
        centered
        padding="md"
      >
        {screenshotModal ? (
          <Stack gap="sm">
            <Group gap="xs">
              {screenshotModal.step_id != null && (
                <Badge variant="light" color="gray">
                  Step #{screenshotModal.step_id}
                </Badge>
              )}
              <Text size="xs" c="dimmed">
                {formatDateTime(screenshotModal.created_at)}
              </Text>
            </Group>
            <Box style={{ width: "100%", display: "flex", justifyContent: "center" }}>
              <TransformWrapper>
                <TransformComponent>
                  <Image
                    src={getOdexScreenshotSrc(screenshotModal)}
                    alt={formatOdexScreenshotLabel(screenshotModal)}
                    fit="contain"
                    radius="md"
                  />
                </TransformComponent>
              </TransformWrapper>
            </Box>
          </Stack>
        ) : null}
      </Modal>
    </Box>
  );
}
