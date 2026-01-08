import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Card,
  Group,
  Text,
  Select,
  Grid,
  Stack,
  ActionIcon,
  Badge,
  Flex,
  Tooltip,
  Modal,
  ScrollArea,
} from "@mantine/core";
import {
  IconCalendar,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconPlus,
  IconArrowLeft,
  IconCalendarEvent,
  IconList,
} from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import { getAPICall } from "../../service/getApiCall";
import { URL } from "../../api/serverUrls";
import { API_HEADER } from "../../store/storeKeys";
import { ToastNotification } from "../../components";
import { useDisclosure } from "@mantine/hooks";
import dayjs from "dayjs";

type CallEntryData = {
  id: number;
  customer_name: string;
  call_date: string;
  call_mode_name: string;
  followup_date: string;
  followup_action_name: string;
  call_summary: string;
};

type ViewMode = "weekly" | "monthly";

function CallEntryCalendar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [callEntries, setCallEntries] = useState<CallEntryData[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("weekly");

  // Date and filter states
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());

  // Modal states
  const [opened, { open, close }] = useDisclosure(false);
  const [selectedDateEntries, setSelectedDateEntries] = useState<
    CallEntryData[]
  >([]);
  const [selectedDateStr, setSelectedDateStr] = useState("");

  // Generate year options (current year and next year)
  const yearOptions = [
    {
      value: String(new Date().getFullYear() - 1),
      label: String(new Date().getFullYear() - 1),
    },
    {
      value: String(new Date().getFullYear()),
      label: String(new Date().getFullYear()),
    },
    {
      value: String(new Date().getFullYear() + 1),
      label: String(new Date().getFullYear() + 1),
    },
  ];

  // Generate month options
  const monthOptions = [
    { value: "0", label: "January" },
    { value: "1", label: "February" },
    { value: "2", label: "March" },
    { value: "3", label: "April" },
    { value: "4", label: "May" },
    { value: "5", label: "June" },
    { value: "6", label: "July" },
    { value: "7", label: "August" },
    { value: "8", label: "September" },
    { value: "9", label: "October" },
    { value: "10", label: "November" },
    { value: "11", label: "December" },
  ];

  // Fetch call entries data
  const fetchCallEntries = async () => {
    setLoading(true);
    try {
      let startDate, endDate;

      if (viewMode === "monthly") {
        // For monthly view, get entire year's data
        startDate = dayjs(new Date(selectedYear, 0, 1)).format("YYYY-MM-DD");
        endDate = dayjs(new Date(selectedYear, 11, 31)).format("YYYY-MM-DD");
      } else {
        // For weekly view, get current month's data
        startDate = dayjs(new Date(selectedYear, selectedMonth, 1)).format(
          "YYYY-MM-DD"
        );
        endDate = dayjs(new Date(selectedYear, selectedMonth + 1, 0)).format(
          "YYYY-MM-DD"
        );
      }

      const data = await getAPICall(
        `${URL.callEntry}?start_date=${startDate}&end_date=${endDate}`,
        API_HEADER
      );

      if (data && Array.isArray(data)) {
        setCallEntries(data);
      } else if (data && data.results) {
        setCallEntries(data.results);
      } else {
        setCallEntries([]);
      }
    } catch (error) {
      console.error("Error fetching call entries:", error);
      ToastNotification({
        type: "error",
        message: "Failed to fetch call entries",
      });
      setCallEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCallEntries();
  }, [selectedYear, selectedMonth, viewMode]);

  // Get entries for a specific date or month
  const getEntriesForDate = (
    date: Date,
    isMonthView: boolean = false
  ): CallEntryData[] => {
    if (isMonthView) {
      // For monthly view, get all entries for that month
      const yearMonth = dayjs(date).format("YYYY-MM");
      return callEntries.filter(
        (entry) => dayjs(entry.call_date).format("YYYY-MM") === yearMonth
      );
    } else {
      // For weekly view, get entries for specific date
      const dateStr = dayjs(date).format("YYYY-MM-DD");
      return callEntries.filter(
        (entry) => dayjs(entry.call_date).format("YYYY-MM-DD") === dateStr
      );
    }
  };

  // Navigate to create new call entry with pre-filled date
  const handleCreateEntry = (date: Date) => {
    const formattedDate = dayjs(date).format("YYYY-MM-DD");
    navigate("/call-entry-create", {
      state: { prefilledDate: formattedDate, returnTo: "/call-entry-calendar" },
    });
  };

  // Show entries for a specific date
  const handleShowEntries = (date: Date, entries: CallEntryData[]) => {
    setSelectedDateEntries(entries);
    setSelectedDateStr(dayjs(date).format("MMMM DD, YYYY"));
    open();
  };

  // Generate calendar weeks for weekly view
  const generateWeeklyCalendar = () => {
    const startOfMonth = new Date(selectedYear, selectedMonth, 1);
    const endOfMonth = new Date(selectedYear, selectedMonth + 1, 0);
    const startOfWeek = new Date(startOfMonth);
    startOfWeek.setDate(startOfMonth.getDate() - startOfMonth.getDay());

    const weeks = [];
    let currentWeek = [];
    let currentDate = new Date(startOfWeek);

    for (let i = 0; i < 42; i++) {
      // 6 weeks max
      if (currentDate > endOfMonth && currentWeek.length > 0) {
        break;
      }

      currentWeek.push(new Date(currentDate));

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    return weeks;
  };

  // Generate calendar months for monthly view (12 months of the year)
  const generateMonthlyCalendar = () => {
    const months = [];

    for (let month = 0; month < 12; month++) {
      months.push(new Date(selectedYear, month, 1));
    }

    return months;
  };

  // Navigation handlers
  const handlePrevious = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNext = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const renderDayCell = (date: Date, isCurrentMonth: boolean = true) => {
    const entries = getEntriesForDate(date, viewMode === "monthly");
    const isToday = dayjs(date).isSame(
      dayjs(),
      viewMode === "monthly" ? "month" : "day"
    );
    const displayText =
      viewMode === "monthly" ? dayjs(date).format("MMM") : date.getDate();

    return (
      <Card
        key={date.toISOString()}
        padding="xs"
        radius="sm"
        withBorder
        style={{
          minHeight: viewMode === "weekly" ? 120 : 80,
          opacity: isCurrentMonth ? 1 : 0.5,
          backgroundColor: isToday ? "#f8f9fa" : "white",
          border: isToday ? "2px solid #105476" : "1px solid #e9ecef",
        }}
      >
        <Flex justify="space-between" align="center" mb="xs">
          <Text
            size="sm"
            fw={isToday ? 600 : 400}
            c={isToday ? "#105476" : "dimmed"}
          >
            {displayText}
          </Text>
          <ActionIcon
            size="sm"
            variant="light"
            color="#105476"
            onClick={() => handleCreateEntry(date)}
          >
            <IconPlus size={18} />
          </ActionIcon>
        </Flex>

        <Stack gap={2}>
          {entries
            .slice(0, viewMode === "weekly" ? 3 : 2)
            .map((entry, index) => (
              <Tooltip
                key={entry.id}
                label={`${entry.customer_name} - ${entry.call_summary?.substring(0, 50)}...`}
              >
                <Badge
                  size="xs"
                  variant="light"
                  color="#105476"
                  style={{
                    cursor: "pointer",
                    maxWidth: "100%",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  onClick={() => handleShowEntries(date, entries)}
                >
                  {entry.customer_name.substring(0, 12)}...
                </Badge>
              </Tooltip>
            ))}

          {entries.length > (viewMode === "weekly" ? 3 : 2) && (
            <Text
              size="xs"
              c="dimmed"
              style={{ cursor: "pointer" }}
              onClick={() => handleShowEntries(date, entries)}
            >
              +{entries.length - (viewMode === "weekly" ? 3 : 2)} more
            </Text>
          )}
        </Stack>
      </Card>
    );
  };

  const weeks = viewMode === "weekly" ? generateWeeklyCalendar() : [];
  const monthDays = viewMode === "monthly" ? generateMonthlyCalendar() : [];

  return (
    <Box>
      {/* Header */}
      <Card shadow="sm" padding="lg" radius="md" withBorder mb="md">
        <Group justify="space-between" align="center" mb="md">
          <Group>
            <Button
              variant="outline"
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => {
                // Check if we have preserved filters to restore
                const preserveFilters = (location.state as any)
                  ?.preserveFilters;
                if (preserveFilters) {
                  navigate("/call-entry", {
                    state: {
                      restoreFilters: preserveFilters,
                      refreshData: true,
                    },
                  });
                } else {
                  navigate("/call-entry");
                }
              }}
              color="#105476"
            >
              Back to List
            </Button>
            <Text size="lg" fw={600} c="#105476">
              Call Entry Calendar
            </Text>
          </Group>

          <Group>
            <Button.Group>
              <Button
                variant={viewMode === "weekly" ? "filled" : "outline"}
                onClick={() => setViewMode("weekly")}
                color="#105476"
                leftSection={<IconCalendar size={16} />}
              >
                Weekly
              </Button>
              <Button
                variant={viewMode === "monthly" ? "filled" : "outline"}
                onClick={() => setViewMode("monthly")}
                color="#105476"
                leftSection={<IconCalendarEvent size={16} />}
              >
                Monthly
              </Button>
            </Button.Group>
          </Group>
        </Group>

        {/* Filters */}
        <Group justify="space-between" align="center">
          <Group>
            <Select
              label="Year"
              value={String(selectedYear)}
              onChange={(value) => setSelectedYear(Number(value))}
              data={yearOptions}
              w={100}
              rightSection={<IconChevronDown size={14} />}
            />
            <Select
              label="Month"
              value={String(selectedMonth)}
              onChange={(value) => setSelectedMonth(Number(value))}
              data={monthOptions}
              w={150}
              rightSection={<IconChevronDown size={14} />}
            />
          </Group>

          <Group>
            <ActionIcon
              variant="outline"
              onClick={handlePrevious}
              color="#105476"
            >
              <IconChevronLeft size={18} />
            </ActionIcon>
            <Text size="lg" fw={500} w={200} ta="center">
              {viewMode === "monthly"
                ? selectedYear.toString()
                : dayjs(new Date(selectedYear, selectedMonth)).format(
                    "MMMM YYYY"
                  )}
            </Text>
            <ActionIcon variant="outline" onClick={handleNext} color="#105476">
              <IconChevronRight size={18} />
            </ActionIcon>
          </Group>
        </Group>
      </Card>

      {/* Calendar Grid */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        {loading ? (
          <Text ta="center" py="xl">
            Loading...
          </Text>
        ) : (
          <>
            {viewMode === "weekly" ? (
              <Stack gap="md">
                {/* Day headers */}
                <Grid>
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                    (day) => (
                      <Grid.Col key={day} span={12 / 7}>
                        <Text ta="center" fw={600} c="#105476">
                          {day}
                        </Text>
                      </Grid.Col>
                    )
                  )}
                </Grid>

                {/* Week rows */}
                {weeks.map((week, weekIndex) => (
                  <Grid key={weekIndex}>
                    {week.map((date) => (
                      <Grid.Col key={date.toISOString()} span={12 / 7}>
                        {renderDayCell(date, date.getMonth() === selectedMonth)}
                      </Grid.Col>
                    ))}
                  </Grid>
                ))}
              </Stack>
            ) : (
              /* Monthly Grid View - 12 months */
              <Grid>
                {monthDays.map((date) => (
                  <Grid.Col key={date.toISOString()} span={3}>
                    {renderDayCell(date)}
                  </Grid.Col>
                ))}
              </Grid>
            )}
          </>
        )}
      </Card>

      {/* Modal for showing entries */}
      <Modal
        opened={opened}
        onClose={close}
        title={`Call Entries for ${selectedDateStr}`}
        size="lg"
        centered
      >
        <Stack gap="md">
          {selectedDateEntries.length === 0 ? (
            <Text ta="center" c="dimmed">
              No call entries for this date
            </Text>
          ) : (
            <ScrollArea.Autosize maxHeight={400}>
              {selectedDateEntries.map((entry) => (
                <Card
                  key={entry.id}
                  padding="md"
                  radius="sm"
                  withBorder
                  mb="sm"
                >
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Text fw={600}>{entry.customer_name}</Text>
                      <Badge variant="light" color="#105476">
                        {entry.call_mode_name}
                      </Badge>
                    </Group>
                    <Text size="sm" c="dimmed">
                      {entry.call_summary}
                    </Text>
                    <Group>
                      <Text size="xs" c="dimmed">
                        Follow-up:{" "}
                        {dayjs(entry.followup_date).format("MMM DD, YYYY")}
                      </Text>
                      <Badge size="xs" variant="outline" color="blue">
                        {entry.followup_action_name}
                      </Badge>
                    </Group>
                  </Stack>
                </Card>
              ))}
            </ScrollArea.Autosize>
          )}
        </Stack>
      </Modal>
    </Box>
  );
}

export default CallEntryCalendar;
