import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActionIcon,
  Alert,
  Box,
  Drawer,
  Grid,
  Group,
  Loader,
  Select,
  ScrollArea,
  Stack,
  Text,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import dayjs from "dayjs";
import { useLocation, useNavigate } from "react-router-dom";
import { DateRangeInput, ERPListToolbar } from "../../../../components";
import { CallEntryCustomerDrawerTable } from "../../../../components";
import useAuthStore from "../../../../store/authStore";
import { IconArrowLeft, IconX } from "@tabler/icons-react";
import {
  getCallEntryDashboardData,
  getCallEntryStatistics,
  type CallEntryDashboardResponse,
  type CallEntryDashboardRepRow,
  type CallEntryCustomerData,
  type CallEntryStatisticsResponse,
} from "../../../../service/dashboard.service";
import { CallEntryKpiRow } from "./CallEntryKpiRow";
import { CallEntryActivityLogCard } from "./CallEntryActivityLogCard";
import { CallEntryRepCard } from "./CallEntryRepCard";
import { CallEntryHeatmapCard } from "./CallEntryHeatmapCard";

const PAGE_SIZE = 5;
const ERP_FONT_SANS = "'Geist', sans-serif";

function monthStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

type CallEntryDashboardRouteState = {
  company?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  openCustomerWiseForSalesperson?: string | null;
};

function parseRouteDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = dayjs(value);
  return date.isValid() ? date.toDate() : null;
}

export default function CallEntryDashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = (location.state || {}) as CallEntryDashboardRouteState;
  const user = useAuthStore((state) => state.user);
  const company =
    routeState.company?.trim() ||
    user?.company?.company_name?.trim() ||
    "PENTAGON INDIA";
  const routeFromDate = parseRouteDate(routeState.fromDate);
  const routeToDate = parseRouteDate(routeState.toDate);
  const initialCustomerWiseRep = String(
    routeState.openCustomerWiseForSalesperson || "",
  ).trim();

  const [fromDate, setFromDate] = useState<Date | null>(
    routeFromDate || monthStart(),
  );
  const [toDate, setToDate] = useState<Date | null>(routeToDate || new Date());
  const [salesperson, setSalesperson] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const [repPage, setRepPage] = useState<number>(1);
  const [activityPage, setActivityPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CallEntryDashboardResponse | null>(null);
  const [customerWiseOpened, setCustomerWiseOpened] = useState(false);
  const [customerWiseLoading, setCustomerWiseLoading] = useState(false);
  const [customerWiseError, setCustomerWiseError] = useState<string | null>(
    null,
  );
  const [selectedRepName, setSelectedRepName] = useState<string>("");
  const [customerWise, setCustomerWise] =
    useState<CallEntryStatisticsResponse | null>(null);
  const [isTodayView, setIsTodayView] = useState<boolean>(
    !!(
      routeFromDate &&
      routeToDate &&
      dayjs(routeFromDate).isSame(routeToDate, "day")
    ),
  );
  const isMobile = useMediaQuery("(max-width: 48em)");
  const fromDateIso = fromDate?.toISOString() || "";
  const toDateIso = toDate?.toISOString() || "";

  useEffect(() => {
    setRepPage(1);
    setActivityPage(1);
  }, [fromDateIso, toDateIso, salesperson, type]);

  useEffect(() => {
    if (!fromDate || !toDate) {
      setIsTodayView(false);
      return;
    }
    setIsTodayView(dayjs(fromDate).isSame(toDate, "day"));
  }, [fromDate, toDate]);

  const fetchDashboard = useCallback(async () => {
    if (!fromDate || !toDate) return;
    try {
      setIsLoading(true);
      setError(null);
      const response = await getCallEntryDashboardData({
        company,
        date_from: dayjs(fromDate).format("DD-MM-YYYY"),
        date_to: dayjs(toDate).format("DD-MM-YYYY"),
        calls_by_rep_pagination: {
          index: (repPage - 1) * PAGE_SIZE,
          limit: PAGE_SIZE,
        },
        activity_log_pagination: {
          index: (activityPage - 1) * PAGE_SIZE,
          limit: PAGE_SIZE,
        },
        salesperson: salesperson === "all" ? null : salesperson,
        type: type === "all" ? null : type,
        search: null,
      });
      setData(response);
    } catch (err) {
      console.error("Error fetching call-entry dashboard data:", err);
      setError("Unable to load Call Entry dashboard data.");
    } finally {
      setIsLoading(false);
    }
  }, [activityPage, company, fromDate, repPage, salesperson, toDate, type]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const salespersonOptions = useMemo(() => {
    const list = (data?.calls_by_rep || [])
      .map((r) => r.salesperson)
      .filter(Boolean);
    const unique = Array.from(new Set(list));
    return [
      { value: "all", label: "All reps" },
      ...unique.map((name) => ({ value: name, label: name })),
    ];
  }, [data?.calls_by_rep]);

  const outcomeOptions = [
    { value: "all", label: "All outcomes" },
    { value: "today", label: "Today" },
    { value: "upcoming", label: "Upcoming" },
    { value: "overdue", label: "Overdue" },
    { value: "close", label: "Closed" },
  ];

  const activeRepCount = useMemo(() => {
    return (data?.calls_by_rep || []).filter(
      (row) => (row.total_calls || 0) > 0,
    ).length;
  }, [data?.calls_by_rep]);

  const handleRepRowClick = async (row: CallEntryDashboardRepRow) => {
    if (!fromDate || !toDate) return;
    const salespersonName = String(row.salesperson || "").trim();
    if (!salespersonName) return;
    setSelectedRepName(salespersonName);
    setCustomerWiseOpened(true);
    setCustomerWiseLoading(true);
    setCustomerWiseError(null);
    try {
      const response = await getCallEntryStatistics({
        company,
        date_from: dayjs(fromDate).format("DD-MM-YYYY"),
        date_to: dayjs(toDate).format("DD-MM-YYYY"),
        salesperson: salespersonName,
      });
      setCustomerWise(response);
    } catch (err) {
      console.error("Error fetching customer-wise call entry statistics:", err);
      setCustomerWiseError("Unable to load customer-wise statistics.");
      setCustomerWise(null);
    } finally {
      setCustomerWiseLoading(false);
    }
  };

  useEffect(() => {
    if (!initialCustomerWiseRep || !fromDate || !toDate || isLoading) return;
    if (
      (selectedRepName || "").trim() === initialCustomerWiseRep &&
      customerWiseOpened
    )
      return;
    void handleRepRowClick({
      sno: 0,
      salesperson: initialCustomerWiseRep,
      total_overdue: 0,
      total_today: 0,
      total_upcoming: 0,
      total_closed: 0,
      total_calls: 0,
      percentage: "0%",
    });
    // run once for route-state restore
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCustomerWiseRep, fromDateIso, toDateIso, isLoading]);

  const openFilteredCallEntryList = (args: {
    customerCode: string;
    status: "OVERDUE" | "TODAY" | "UPCOMING" | "CLOSED" | null;
  }) => {
    if (!fromDate || !toDate) return;
    navigate("/call-entry", {
      state: {
        fromDashboard: true,
        returnToDashboard: true,
        dashboardState: {
          source: "callEntryDashboardPage",
          company,
          fromDate: dayjs(fromDate).format("YYYY-MM-DD"),
          toDate: dayjs(toDate).format("YYYY-MM-DD"),
          openCustomerWiseForSalesperson: selectedRepName || null,
        },
        initialFilters: {
          date_from: dayjs(fromDate).format("YYYY-MM-DD"),
          date_to: dayjs(toDate).format("YYYY-MM-DD"),
          customer: args.customerCode || null,
          status: args.status,
          sales_person: selectedRepName || null,
        },
      },
    });
  };

  const handleActivityLogRowClick = (row: {
    id?: number | string;
    status?: string;
  }) => {
    const id = Number(row.id);
    if (!Number.isFinite(id) || id <= 0) return;
    if (!fromDate || !toDate) return;
    console.log("[CallEntryDashboard] ActivityLog click", {
      id,
      rawStatus: row.status,
      fromDate: dayjs(fromDate).format("YYYY-MM-DD"),
      toDate: dayjs(toDate).format("YYYY-MM-DD"),
    });
    navigate(`/call-entry-create/${id}`, {
      state: {
        returnTo: "/dashboard/call-entry-dashboard",
        returnToState: {
          source: "callEntryDashboardPage",
          company,
          fromDate: dayjs(fromDate).format("YYYY-MM-DD"),
          toDate: dayjs(toDate).format("YYYY-MM-DD"),
          openCustomerWiseForSalesperson: selectedRepName || null,
        },
      },
    });
  };

  return (
    <Box
      bg="#F4F6FA"
      mx={{ base: -12, sm: -16, lg: -24 }}
      // px={{ base: 12, sm: 16, }}
      // py={{ base: 12, sm: 16, lg: 24 }}
      mih={520}
      style={{ fontFamily: ERP_FONT_SANS }}
    >
      <Stack gap={9}>
        <ERPListToolbar
          bleed={false}
          leading={
            <Box style={{ minWidth: 0, paddingLeft: 10, paddingRight: 10 }}>
              {/* <Text fz={11} fw={600} c="#7B8DA5" mb={5} style={{ lineHeight: 1.35 }}>
                Pentagon Freight › Sales › Call Entry
              </Text> */}
              <Text
                c="#111827"
                style={{
                  fontSize: "clamp(14px, 5vw, 20px)",
                  lineHeight: 1.08,
                  fontFamily: "Geist",
                  fontWeight: 550,
                }}
                mb={4}
              >
                Call Entry Dashboard
              </Text>
              <Text fz={11} fw={600} c="#8AA0B9" style={{ lineHeight: 1.4 }}>
                {isTodayView ? "Today" : dayjs(fromDate).format("DD MMM")} ·{" "}
                {data?.kpi?.total_calls || 0} calls logged · {activeRepCount}{" "}
                reps active
              </Text>
            </Box>
          }
          actions={
            <Box style={{ minWidth: isMobile ? 300 : 360 }}>
              <Group
                align="center"
                gap={8}
                wrap="wrap"
                style={{ width: "100%" }}
              >
                <DateRangeInput
                  fromDate={fromDate}
                  toDate={toDate}
                  onFromDateChange={setFromDate}
                  onToDateChange={setToDate}
                  fromLabel=""
                  toLabel=""
                  size="xs"
                  allowDeselection={false}
                  showRangeInCalendar={false}
                  hideLabels
                  compactToolbar
                  containerStyle={{ gap: 6 }}
                />
                {/* <Button
                  size="xs"
                  variant={isTodayView ? "filled" : "default"}
                  color="#0B2D59"
                  radius={6}
                  onClick={applyTodayFilter}
                  style={{
                    minWidth: isMobile ? 0 : 74,
                    height: 30,
                    fontWeight: 700,
                    fontSize: 11,
                    flex: isMobile ? "1 1 calc(50% - 4px)" : "1 1 74px",
                  }}
                >
                  Today
                </Button> */}
                <Select
                  style={{
                    flex: isMobile ? "1 1 calc(50% - 4px)" : "1 1 130px",
                    minWidth: isMobile ? 0 : 120,
                  }}
                  size="xs"
                  data={salespersonOptions}
                  value={salesperson}
                  onChange={(v) => setSalesperson(v || "all")}
                  radius={6}
                  styles={{
                    input: {
                      height: 30,
                      minHeight: 30,
                      fontSize: 11,
                      borderColor: "#DCE6F1",
                      color: "#4A607A",
                      fontWeight: 500,
                      background: "#FFFFFF",
                    },
                  }}
                />
                <Select
                  style={{
                    flex: isMobile ? "1 1 calc(50% - 4px)" : "1 1 140px",
                    minWidth: isMobile ? 0 : 130,
                  }}
                  size="xs"
                  data={outcomeOptions}
                  value={type}
                  onChange={(v) => setType(v || "all")}
                  radius={6}
                  styles={{
                    input: {
                      height: 30,
                      minHeight: 30,
                      fontSize: 11,
                      borderColor: "#DCE6F1",
                      color: "#4A607A",
                      fontWeight: 500,
                      background: "#FFFFFF",
                    },
                  }}
                />
                {/* <Button
                  size="xs"
                  variant="filled"
                  color="#F8FAFC"
                  c="#26415F"
                  radius={6}
                  style={{
                    border: "1px solid #DCE6F1",
                    fontWeight: 700,
                    height: 30,
                    fontSize: 11,
                    flex: isMobile ? "1 1 100%" : "1 1 132px",
                    minWidth: isMobile ? 0 : 120,
                  }}
                  onClick={() => navigate("/call-entry-create")}
                >
                  + Log a call
                </Button> */}
              </Group>
            </Box>
          }
        />

        {error ? (
          <Alert color="red" title="Error">
            {error}
          </Alert>
        ) : null}
<Box style={{ paddingLeft: 10, paddingRight: 10 }}>
<CallEntryKpiRow
  data={data}
  loading={isLoading}
  activeType={type}
  onTypeToggle={(nextType) => {
    setType((prev) => (prev === nextType ? "all" : nextType));
  }}
/>
</Box>

        {isLoading && !data ? (
          <Group justify="center" py="xl">
            <Loader size="lg" color="#153F72" />
          </Group>
        ) : (
          <Grid gutter="sm" style={{ paddingLeft: 10, paddingRight: 10 }}>
            <Grid.Col span={{ base: 12, xl: 7 }}>
              <CallEntryActivityLogCard
                rows={data?.activity_log || []}
                page={activityPage}
                total={data?.activity_log_meta?.total || 0}
                pageSize={PAGE_SIZE}
                onPageChange={setActivityPage}
                onRowClick={handleActivityLogRowClick}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, xl: 5 }}>
              <Stack gap="sm">
                <CallEntryRepCard
                  rows={data?.calls_by_rep || []}
                  page={repPage}
                  total={data?.calls_by_rep_meta?.total || 0}
                  pageSize={PAGE_SIZE}
                  onPageChange={setRepPage}
                  onRowClick={(row) => {
                    void handleRepRowClick(row);
                  }}
                />
                <CallEntryHeatmapCard rows={data?.call_heatmap?.rows || []} />
              </Stack>
            </Grid.Col>
          </Grid>
        )}
      </Stack>
      <Drawer
        opened={customerWiseOpened}
        onClose={() => setCustomerWiseOpened(false)}
        position="right"
        size="max(520px, 75vw)"
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
            fontFamily: "Geist, sans-serif",
            borderLeft: "1px solid #E2E8F0",
            boxShadow: "-8px 0 24px rgba(15, 23, 42, 0.1)",
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
            py={12}
            style={{
              borderBottom: "1px solid #EEF2F7",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <Group gap={10} wrap="nowrap" style={{ minWidth: 0 }}>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                aria-label="Back"
                onClick={() => setCustomerWiseOpened(false)}
              >
                <IconArrowLeft size={18} stroke={2} />
              </ActionIcon>
              <Text
                fz={12}
                fw={600}
                c="#64748B"
                truncate
                style={{ minWidth: 0 }}
              >
                {selectedRepName
                  ? `Call Entry · ${selectedRepName.trim()} · Customers`
                  : "Call Entry · Customers"}
              </Text>
            </Group>
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={() => setCustomerWiseOpened(false)}
              aria-label="Close"
            >
              <IconX size={18} stroke={2} />
            </ActionIcon>
          </Box>

          <ScrollArea
            type="scroll"
            scrollbarSize={8}
            style={{ flex: 1, minHeight: 0 }}
          >
            <Box p={20} pb={28} style={{ minWidth: 0 }}>
              <CallEntryCustomerDrawerTable
                rows={(customerWise?.data as CallEntryCustomerData[]) || []}
                summary={customerWise?.summary || null}
                heading={
                  selectedRepName
                    ? `${selectedRepName.trim()} · Customers breakdown`
                    : "Customers breakdown"
                }
                periodLabel={
                  fromDate && toDate
                    ? `${dayjs(fromDate).format("DD MMM YYYY")} – ${dayjs(toDate).format("DD MMM YYYY")}`
                    : undefined
                }
                loading={customerWiseLoading}
                emptyMessage="No customer-wise rows found."
                onMetricClick={(metric, row) => {
                  const status =
                    metric === "total_overdue"
                      ? "OVERDUE"
                      : metric === "total_today"
                        ? "TODAY"
                        : metric === "total_upcoming"
                          ? "UPCOMING"
                          : metric === "total_closed"
                            ? "CLOSED"
                            : null;
                  openFilteredCallEntryList({
                    customerCode: row.customer_code,
                    status,
                  });
                }}
              />
              {customerWiseError ? (
                <Alert color="red" title="Error" mt="sm">
                  {customerWiseError}
                </Alert>
              ) : null}
            </Box>
          </ScrollArea>
        </Box>
      </Drawer>
    </Box>
  );
}
