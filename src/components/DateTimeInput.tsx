import React from "react";
import { DateInput, TimeInput } from "@mantine/dates";
import { Group } from "@mantine/core";
import "dayjs/locale/en";
import {
  IconCalendar,
  IconChevronRight,
  IconChevronLeft,
} from "@tabler/icons-react";
import dayjs from "dayjs";
import useDateFormat from "../hooks/useDateFormat";
import { parseTypedDate } from "../utils/dateFormat";

export interface DateTimeInputProps {
  label?: string;
  placeholder?: string;
  value: Date | null;
  onChange: (date: Date | null) => void;
  allowDeselection?: boolean;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  disabled?: boolean;
  minDate?: Date;
  maxDate?: Date;
  error?: string;
  withAsterisk?: boolean;
}

const DateTimeInput: React.FC<DateTimeInputProps> = ({
  label,
  placeholder,
  value,
  onChange,
  allowDeselection = true,
  size = "sm",
  disabled = false,
  minDate,
  maxDate,
  error,
  withAsterisk,
}) => {
  const dateFormat = useDateFormat();

  // Extract date and time from value
  const dateValue = value ? dayjs(value).toDate() : null;
  const timeValue = value ? dayjs(value).format("HH:mm") : "";

  // Helper to check if date is selected (same as SingleDateInput)
  const isDateSelected = (
    date: Date | null,
    selectedDate: Date | null
  ): boolean => {
    if (!date || !selectedDate) return false;
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    );
  };

  // Handle date change
  const handleDateChange = (date: Date | null) => {
    if (allowDeselection && date && value) {
      // Allow deselection if clicking the same date
      if (
        date.getDate() === value.getDate() &&
        date.getMonth() === value.getMonth() &&
        date.getFullYear() === value.getFullYear()
      ) {
        onChange(null);
        return;
      }
    }

    if (date) {
      // Preserve existing time only if it exists, otherwise set to 00:00 (don't auto-set to current time)
      const existingTime = value ? dayjs(value).format("HH:mm") : "00:00";
      const [hours, minutes] = existingTime.split(":").map(Number);
      const newDateTime = dayjs(date)
        .hour(hours || 0)
        .minute(minutes || 0)
        .second(0)
        .millisecond(0)
        .toDate();
      onChange(newDateTime);
    } else {
      onChange(null);
    }
  };

  // Handle time change from TimeInput
  const handleTimeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const timeStr = event.currentTarget.value;

    if (!timeStr || timeStr.trim() === "") {
      // If time is cleared, keep date but reset time to 00:00
      if (value) {
        const newDateTime = dayjs(value)
          .hour(0)
          .minute(0)
          .second(0)
          .millisecond(0)
          .toDate();
        onChange(newDateTime);
      }
      return;
    }

    // Parse time string (format: HH:mm)
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(timeStr)) {
      // Invalid format, don't update
      return;
    }

    const [hours, minutes] = timeStr.split(":").map(Number);

    // If no date is selected, use today's date
    const baseDate = value || dayjs().toDate();

    // Update the datetime with the selected time
    const newDateTime = dayjs(baseDate)
      .hour(hours)
      .minute(minutes)
      .second(0)
      .millisecond(0)
      .toDate();
    onChange(newDateTime);
  };

  // Function to get styles for calendar/field (same structure as SingleDateInput)
  const getDateStyles = () => {
    return {
      input: {
        fontSize: "13px",
        fontFamily: "Inter",
        height: "36px",
      },
      label: {
        fontSize: "13px",
        fontWeight: 500,
        color: "#424242",
        marginBottom: "4px",
        fontFamily: "Inter",
        fontStyle: "medium",
      },
      day: {
        width: "2.25rem",
        height: "2.25rem",
        fontSize: "0.9rem",
        borderRadius: "6px",
        transition: "all 0.2s ease",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center" as const,
      },
      daySelected: {
        backgroundColor: "#228be6 !important",
        color: "#fff !important",
        fontWeight: 600,
        borderRadius: "6px !important",
        display: "flex !important",
        alignItems: "center !important",
        justifyContent: "center !important",
        textAlign: "center !important",
      },
      weekday: {
        color: "#868e96",
      },
      dayOutside: {
        opacity: 0,
        pointerEvents: "none" as const,
        visibility: "hidden" as const,
      },
      yearsList: {
        width: "100%",
      },
      monthsList: {
        width: "100%",
      },
      calendarHeaderLevel: {
        fontSize: "1rem",
        fontWeight: 500,
        marginBottom: "0.5rem",
        flex: 1,
        textAlign: "center" as const,
      },
      calendarHeaderControl: {
        height: "2rem",
        margin: "0 0.5rem",
      },
      calendarHeader: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "0.5rem",
      },
    };
  };

  const timeInputStyles = {
    input: {
      fontSize: "13px",
      fontFamily: "Inter",
      height: "36px",
      padding: "8px 12px",
      borderRadius: "4px",
    },
    label: {
      fontSize: "13px",
      fontWeight: 500,
      color: "#424242",
      marginBottom: "4px",
      fontFamily: "Inter",
      fontStyle: "medium",
    },
  };

  return (
    <Group gap="xs" align="flex-end" wrap="nowrap">
      <DateInput
        key={`datetime-${dateFormat}`}
        label={label}
        placeholder={`${dateFormat}`}
        value={dateValue}
        onChange={handleDateChange}
        valueFormat={`${dateFormat}`}
        dateParser={(input) => parseTypedDate(input, dateFormat)}
        leftSection={<IconCalendar size={18} />}
        leftSectionPointerEvents="none"
        radius="sm"
        size={size}
        nextIcon={<IconChevronRight size={16} />}
        previousIcon={<IconChevronLeft size={16} />}
        clearable
        hideOutsideDates
        disabled={disabled}
        minDate={minDate}
        maxDate={maxDate}
        error={error}
        withAsterisk={withAsterisk}
        styles={getDateStyles()}
        style={{ flex: 1 }}
        getDayProps={(date) => {
          const isSelected = isDateSelected(date, dateValue);
          return {
            onMouseEnter: (e: React.MouseEvent) => {
              const target = e.currentTarget as HTMLElement;
              if (!isSelected) {
                target.style.backgroundColor = "#e9ecef";
                target.style.borderRadius = "6px";
              } else {
                target.style.backgroundColor = "#1c7ed6";
              }
            },
            onMouseLeave: (e: React.MouseEvent) => {
              const target = e.currentTarget as HTMLElement;
              if (!isSelected) {
                target.style.backgroundColor = "";
                target.style.borderRadius = "";
              } else {
                target.style.backgroundColor = "#228be6";
              }
            },
            style: {
              backgroundColor: isSelected ? "#228be6" : undefined,
              color: isSelected ? "#fff" : undefined,
              fontWeight: isSelected ? 600 : undefined,
              borderRadius: "6px",
              cursor: "pointer",
              transition: "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
            },
          };
        }}
        getYearControlProps={(year) => {
          const isSelected = isDateSelected(year, dateValue);
          return {
            onMouseEnter: (e: React.MouseEvent) => {
              const target = e.currentTarget as HTMLElement;
              if (!isSelected) {
                target.style.backgroundColor = "#e9ecef";
                target.style.borderRadius = "6px";
              } else {
                target.style.backgroundColor = "#1c7ed6";
              }
            },
            onMouseLeave: (e: React.MouseEvent) => {
              const target = e.currentTarget as HTMLElement;
              if (!isSelected) {
                target.style.backgroundColor = "";
                target.style.borderRadius = "";
              } else {
                target.style.backgroundColor = "#228be6";
              }
            },
            style: {
              backgroundColor: isSelected ? "#228be6" : undefined,
              color: isSelected ? "#fff" : undefined,
              fontWeight: isSelected ? 600 : undefined,
              borderRadius: "6px",
              cursor: "pointer",
              transition: "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              width: "100%",
              height: "2.25rem",
              fontSize: "0.9rem",
            },
          };
        }}
        getMonthControlProps={(month) => {
          const isSelected = isDateSelected(month, dateValue);
          return {
            onMouseEnter: (e: React.MouseEvent) => {
              const target = e.currentTarget as HTMLElement;
              if (!isSelected) {
                target.style.backgroundColor = "#e9ecef";
                target.style.borderRadius = "6px";
              } else {
                target.style.backgroundColor = "#1c7ed6";
              }
            },
            onMouseLeave: (e: React.MouseEvent) => {
              const target = e.currentTarget as HTMLElement;
              if (!isSelected) {
                target.style.backgroundColor = "";
                target.style.borderRadius = "";
              } else {
                target.style.backgroundColor = "#228be6";
              }
            },
            style: {
              backgroundColor: isSelected ? "#228be6" : undefined,
              color: isSelected ? "#fff" : undefined,
              fontWeight: isSelected ? 600 : undefined,
              borderRadius: "6px",
              cursor: "pointer",
              transition: "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              width: "3rem",
              height: "2.25rem",
              fontSize: "0.9rem",
            },
          };
        }}
      />
      <TimeInput
        label="Time"
        withSeconds={false}
        radius="sm"
        size={size}
        value={timeValue}
        onChange={handleTimeChange}
        disabled={disabled}
        styles={timeInputStyles}
      />
    </Group>
  );
};

export default DateTimeInput;
