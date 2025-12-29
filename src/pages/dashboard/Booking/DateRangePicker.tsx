import React, { useState, useEffect } from "react";
import { Calendar } from "@mantine/dates";
import { Group, Text, Paper, Box, Button, Badge } from "@mantine/core";
import {
  IconChevronRight,
  IconChevronLeft,
  IconCalendar,
} from "@tabler/icons-react";
import dayjs from "dayjs";

interface DateRangePickerProps {
  fromDate: Date | null;
  toDate: Date | null;
  onChange?: (from: Date | null, to: Date | null) => void;
  onClose?: () => void;
  displaySelectedRange?: (from: Date | null, to: Date | null) => void;
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({
  fromDate,
  toDate,
  onChange,
  onClose,
  displaySelectedRange,
}) => {
  const [selectedFrom, setSelectedFrom] = useState<Date | null>(fromDate);
  const [selectedTo, setSelectedTo] = useState<Date | null>(toDate);
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);

  // Sync internal state with props when they change
  useEffect(() => {
    setSelectedFrom(fromDate);
    setSelectedTo(toDate);
  }, [fromDate, toDate]);

  // Notify parent of selection changes for display
  useEffect(() => {
    if (displaySelectedRange) {
      displaySelectedRange(selectedFrom, selectedTo);
    }
  }, [selectedFrom, selectedTo, displaySelectedRange]);

  // Helper to compare dates without time
  const compareDates = (date1: Date, date2: Date): number => {
    const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
    const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());
    return d1.getTime() - d2.getTime();
  };

  // Helper to check if two dates are the same day
  const isSameDay = (date1: Date, date2: Date): boolean => {
    return compareDates(date1, date2) === 0;
  };

  const handleDateClick = (date: Date | null) => {
    if (!date) return;

    // Normalize date to remove time component
    const normalizedDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );

    // Check if clicking the same date (deselection)
    if (
      selectedFrom &&
      isSameDay(normalizedDate, selectedFrom) &&
      !selectedTo
    ) {
      setSelectedFrom(null);
      setHoveredDate(null);
      return;
    }
    if (selectedTo && isSameDay(normalizedDate, selectedTo)) {
      setSelectedTo(null);
      return;
    }

    if (!selectedFrom || (selectedFrom && selectedTo)) {
      // Start new selection
      setSelectedFrom(normalizedDate);
      setSelectedTo(null);
      setHoveredDate(null);
    } else if (selectedFrom && !selectedTo) {
      // Complete selection
      if (compareDates(normalizedDate, selectedFrom) < 0) {
        // If clicked date is before from date, swap them
        setSelectedTo(selectedFrom);
        setSelectedFrom(normalizedDate);
      } else {
        setSelectedTo(normalizedDate);
      }
      setHoveredDate(null);
    }
  };

  const isInRange = (date: Date) => {
    if (!selectedFrom) return false;
    if (selectedFrom && selectedTo) {
      return (
        compareDates(date, selectedFrom) >= 0 &&
        compareDates(date, selectedTo) <= 0
      );
    }
    if (selectedFrom && hoveredDate) {
      const start =
        compareDates(selectedFrom, hoveredDate) < 0
          ? selectedFrom
          : hoveredDate;
      const end =
        compareDates(selectedFrom, hoveredDate) > 0
          ? selectedFrom
          : hoveredDate;
      return compareDates(date, start) >= 0 && compareDates(date, end) <= 0;
    }
    return false;
  };

  const isRangeStart = (date: Date) => {
    if (!selectedFrom) return false;
    return isSameDay(date, selectedFrom);
  };

  const isRangeEnd = (date: Date) => {
    if (!selectedTo) return false;
    return isSameDay(date, selectedTo);
  };

  const handleApply = () => {
    // Only call onChange if provided (for API integration)
    // Otherwise just close the popover
    if (onChange) {
      onChange(selectedFrom, selectedTo);
    }
    if (onClose) {
      onClose();
    }
  };

  const handleClear = () => {
    setSelectedFrom(null);
    setSelectedTo(null);
    setHoveredDate(null);
    if (displaySelectedRange) {
      displaySelectedRange(null, null);
    }
  };

  const handleCancel = () => {
    // Reset to original values
    setSelectedFrom(fromDate);
    setSelectedTo(toDate);
    setHoveredDate(null);
    if (displaySelectedRange) {
      displaySelectedRange(fromDate, toDate);
    }
    if (onClose) {
      onClose();
    }
  };

  return (
    <Paper p="md" shadow="md" radius="md" withBorder>
      <Box mb="md">
        <Group justify="space-between" mb="xs">
          <Text fw={600} size="sm">
            Select Date Range
          </Text>
          <Button
            variant="subtle"
            size="xs"
            onClick={handleClear}
            disabled={!selectedFrom && !selectedTo}
          >
            Clear
          </Button>
        </Group>
        <Box p="xs" style={{ backgroundColor: "#f8f9fa", borderRadius: "4px" }}>
          <Group gap="xs">
            <IconCalendar size={16} />
            <Badge variant="light" color="blue" size="sm">
              {selectedFrom
                ? dayjs(selectedFrom).format("YYYY-MM-DD")
                : "Click to select start date"}
            </Badge>
            <Text size="sm" c="dimmed" fw={500}>
              to
            </Text>
            <Badge variant="light" color="blue" size="sm">
              {selectedTo
                ? dayjs(selectedTo).format("YYYY-MM-DD")
                : "Click to select end date"}
            </Badge>
          </Group>
          {/* {selectedFrom && selectedTo && (
            <Text size="xs" c="dimmed" mt="xs">
              Payload: date_from: "{dayjs(selectedFrom).format("YYYY-MM-DD")}",
              date_to: "{dayjs(selectedTo).format("YYYY-MM-DD")}" (
              {dayjs(selectedTo).diff(dayjs(selectedFrom), "day") + 1} days)
            </Text>
          )} */}
        </Box>
      </Box>
      <Calendar
        getDayProps={(date) => {
          const inRange = isInRange(date);
          const isStart = isRangeStart(date);
          const isEnd = isRangeEnd(date);

          return {
            onClick: (e: React.MouseEvent) => {
              e.preventDefault();
              e.stopPropagation();
              handleDateClick(date);
            },
            onMouseEnter: (e: React.MouseEvent) => {
              if (selectedFrom && !selectedTo) {
                setHoveredDate(date);
              }
              // Add hover effect
              const target = e.currentTarget as HTMLElement;
              if (!isStart && !isEnd) {
                target.style.backgroundColor = inRange ? "#d0ebff" : "#e7f5ff";
              } else {
                target.style.backgroundColor = "#1c7ed6";
              }
            },
            onMouseLeave: (e: React.MouseEvent) => {
              const target = e.currentTarget as HTMLElement;
              if (inRange) {
                target.style.backgroundColor =
                  isStart || isEnd ? "#228be6" : "#e7f5ff";
              } else {
                target.style.backgroundColor = "";
              }
            },
            style: {
              backgroundColor: inRange
                ? isStart || isEnd
                  ? "#228be6"
                  : "#e7f5ff"
                : undefined,
              color: isStart || isEnd ? "#fff" : undefined,
              fontWeight: isStart || isEnd ? 600 : undefined,
              borderRadius:
                selectedFrom && selectedTo
                  ? isStart
                    ? "6px 0 0 6px"
                    : isEnd
                      ? "0 6px 6px 0"
                      : inRange
                        ? "0"
                        : "6px"
                  : isStart || isEnd
                    ? "6px"
                    : "6px",
              cursor: "pointer",
              transition: "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
            },
          };
        }}
        hideOutsideDates
        nextIcon={<IconChevronRight size={16} />}
        previousIcon={<IconChevronLeft size={16} />}
        styles={{
          day: {
            width: "2.5rem",
            height: "2.5rem",
            fontSize: "0.9rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
          },
          calendarHeaderLevel: {
            fontSize: "1rem",
            fontWeight: 500,
            marginBottom: "0.5rem",
            flex: 1,
            textAlign: "center",
          },
          calendarHeaderControl: {
            width: "2rem",
            height: "2rem",
            margin: "0 0.5rem",
          },
          calendarHeader: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.5rem",
          },
        }}
      />
      <Group justify="flex-end" mt="md">
        <Button variant="default" onClick={handleCancel}>
          Cancel
        </Button>
        <Button onClick={handleApply} disabled={!selectedFrom || !selectedTo}>
          Apply
        </Button>
      </Group>
    </Paper>
  );
};

export default DateRangePicker;
