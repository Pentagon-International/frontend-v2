import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Grid,
  Group,
  Loader,
  Select,
  Stack,
  Text,
} from "@mantine/core";
import dayjs from "dayjs";
import { useLocation, useNavigate } from "react-router-dom";
import useAuthStore from "../../../../store/authStore";
import {
  getCallEntryDashboardData,
  type CallEntryDashboardResponse,
} from "../../../../service/dashboard.service";
import { CallEntryKpiRow } from "./CallEntryKpiRow";
import { CallEntryActivityLogCard } from "./CallEntryActivityLogCard";
import { CallEntryRepCard } from "./CallEntryRepCard";
import { CallEntryHeatmapCard } from "./CallEntryHeatmapCard";

const PAGE_SIZE = 5;

function monthStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

type CallEntryDashboardRouteState = {
  company?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
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

  const [fromDate, setFromDate] = useState<Date | null>(routeFromDate || monthStart());
  const [toDate, setToDate] = useState<Date | null>(routeToDate || new Date());
  const [salesperson, setSalesperson] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const [repPage, setRepPage] = useState<number>(1);
  const [activityPage, setActivityPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CallEntryDashboardResponse | null>(null);
  const [isTodayView, setIsTodayView] = useState<boolean>(
    !!(routeFromDate && routeToDate && dayjs(routeFromDate).isSame(routeToDate, "day"))
  );

  useEffect(() => {
    setRepPage(1);
    setActivityPage(1);
  }, [fromDate?.toISOString(), toDate?.toISOString(), salesperson, type]);

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
    const list = (data?.calls_by_rep || []).map((r) => r.salesperson).filter(Boolean);
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
    { value: "closed", label: "Closed" },
  ];

  const activeRepCount = useMemo(() => {
    return (data?.calls_by_rep || []).filter((row) => (row.total_calls || 0) > 0).length;
  }, [data?.calls_by_rep]);

  const applyTodayFilter = () => {
    const t = new Date();
    setFromDate(t);
    setToDate(t);
    setIsTodayView(true);
  };

  return (
    <Box
      bg="#F4F6FA"
      mx={{ base: -12, sm: -16, lg: -24 }}
      px={{ base: 12, sm: 16, lg: 20 }}
      py={{ base: 12, sm: 16, lg: 24 }}
      mih={520}
    >
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
          <Box style={{ flex: "1 1 320px", minWidth: 0 }}>
            <Text fz={12} fw={600} c="#7B8DA5" mb={6}>
              Pentagon Freight › Sales › Call Entry
            </Text>
            <Text fw={700} c="#0B1F3A" lh={1.05} style={{ fontSize: "clamp(24px, 4.2vw, 36px)" }}>
              CallEntry Dashboard
            </Text>
            <Text fz={12} c="#8AA0B9" fw={600} mt={2} style={{ lineHeight: 1.35 }}>
              {isTodayView ? "Today" : dayjs(fromDate).format("DD MMM")} ·{" "}
              {data?.kpi?.total_calls || 0} calls logged · {activeRepCount} reps active
            </Text>
          </Box>

          <Group align="center" gap={8} wrap="wrap" style={{ flex: "1 1 360px" }}>
            <Button
              size="xs"
              variant={isTodayView ? "filled" : "default"}
              color="#0B2D59"
              radius={6}
              onClick={applyTodayFilter}
              style={{ minWidth: 74, fontWeight: 700, flex: "1 1 74px" }}
            >
              Today
            </Button>
            <Select
              style={{ flex: "1 1 130px", minWidth: 120 }}
              size="xs"
              data={salespersonOptions}
              value={salesperson}
              onChange={(v) => setSalesperson(v || "all")}
              radius={6}
            />
            <Select
              style={{ flex: "1 1 140px", minWidth: 130 }}
              size="xs"
              data={outcomeOptions}
              value={type}
              onChange={(v) => setType(v || "all")}
              radius={6}
            />
            <Button
              size="xs"
              variant="filled"
              color="#F8FAFC"
              c="#26415F"
              radius={6}
              style={{
                border: "1px solid #DCE6F1",
                fontWeight: 700,
                flex: "1 1 132px",
                minWidth: 120,
              }}
              onClick={() => navigate("/call-entry-create")}
            >
              + Log a call
            </Button>
          </Group>
        </Group>

        {error ? (
          <Alert color="red" title="Error">
            {error}
          </Alert>
        ) : null}

        <CallEntryKpiRow data={data} />

        {isLoading && !data ? (
          <Group justify="center" py="xl">
            <Loader size="lg" color="#153F72" />
          </Group>
        ) : (
          <Grid gutter="sm">
            <Grid.Col span={{ base: 12, xl: 7 }}>
              <CallEntryActivityLogCard
                rows={data?.activity_log || []}
                page={activityPage}
                total={data?.activity_log_meta?.total || 0}
                pageSize={PAGE_SIZE}
                onPageChange={setActivityPage}
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
                />
                <CallEntryHeatmapCard rows={data?.call_heatmap?.rows || []} />
              </Stack>
            </Grid.Col>
          </Grid>
        )}
      </Stack>
    </Box>
  );
}
