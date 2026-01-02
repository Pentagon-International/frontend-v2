import React from "react";
import { DateInput } from "@mantine/dates";
import { Group } from "@mantine/core";
import {
  IconCalendar,
  IconChevronRight,
  IconChevronLeft,
} from "@tabler/icons-react";

export interface DateRangeInputProps {
  fromDate: Date | null;
  toDate: Date | null;
  onFromDateChange: (date: Date | null) => void;
  onToDateChange: (date: Date | null) => void;
  fromLabel?: string;
  toLabel?: string;
  fromPlaceholder?: string;
  toPlaceholder?: string;
  allowDeselection?: boolean;
  showRangeInCalendar?: boolean;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  containerStyle?: React.CSSProperties;
  inputWidth?: number | string;
  disabled?: boolean;
  minDate?: Date;
  maxDate?: Date;
  hideLabels?: boolean;
}

const DateRangeInput: React.FC<DateRangeInputProps> = ({
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  fromLabel = "From Date",
  toLabel = "To Date",
  fromPlaceholder = "YYYY-MM-DD",
  toPlaceholder = "YYYY-MM-DD",
  allowDeselection = true,
  showRangeInCalendar = false,
  size = "sm",
  disabled = false,
  minDate,
  maxDate,
  containerStyle,
  inputWidth,
  hideLabels = false,
}) => {
  // Helper to check if date is selected
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

  // Helper to check if date is in range
  const isDateInRange = (date: Date): boolean => {
    if (!fromDate || !toDate || !showRangeInCalendar) return false;
    const normalizedDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    ).getTime();
    const normalizedFrom = new Date(
      fromDate.getFullYear(),
      fromDate.getMonth(),
      fromDate.getDate()
    ).getTime();
    const normalizedTo = new Date(
      toDate.getFullYear(),
      toDate.getMonth(),
      toDate.getDate()
    ).getTime();
    return normalizedDate >= normalizedFrom && normalizedDate <= normalizedTo;
  };

  // Handle date selection with deselection capability
  const handleFromDateChange = (date: Date | null) => {
    if (allowDeselection) {
      // Allow deselection if clicking the same date
      if (
        date &&
        fromDate &&
        date.getDate() === fromDate.getDate() &&
        date.getMonth() === fromDate.getMonth() &&
        date.getFullYear() === fromDate.getFullYear()
      ) {
        onFromDateChange(null);
        return;
      }
    }
    onFromDateChange(date);
  };

  const handleToDateChange = (date: Date | null) => {
    if (allowDeselection) {
      // Allow deselection if clicking the same date
      if (
        date &&
        toDate &&
        date.getDate() === toDate.getDate() &&
        date.getMonth() === toDate.getMonth() &&
        date.getFullYear() === toDate.getFullYear()
      ) {
        onToDateChange(null);
        return;
      }
    }
    onToDateChange(date);
  };

  // Function to get styles for calendar days
  const getDateStyles = () => {
    return {
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
      // Style for selected date in calendar
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
      // Hide dates from other months
      weekday: {
        color: "#868e96",
      },
      dayOutside: {
        opacity: 0,
        pointerEvents: "none" as const,
        visibility: "hidden" as const,
      },
      calendarHeaderLevel: {
        fontSize: "1rem",
        fontWeight: 500,
        marginBottom: "0.5rem",
        flex: 1,
        textAlign: "center" as const,
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
    };
  };

  return (
    <Group
      gap="md"
      align={hideLabels ? "center" : "flex-end"}
      w={"100%"}
      grow
      style={containerStyle}
    >
      <DateInput
        style={inputWidth ? { width: inputWidth } : undefined}
        label={hideLabels ? undefined : fromLabel}
        labelProps={{
          style: {
            fontSize: "13px",
            fontWeight: 500,
            color: "#000000",
            marginBottom: "4px",
            fontFamily: "Inter",
          },
        }}
        placeholder={fromPlaceholder}
        value={fromDate}
        onChange={handleFromDateChange}
        valueFormat="YYYY-MM-DD"
        leftSection={<IconCalendar size={18} />}
        leftSectionPointerEvents="none"
        radius="md"
        size={size}
        nextIcon={<IconChevronRight size={16} />}
        previousIcon={<IconChevronLeft size={16} />}
        clearable
        hideOutsideDates
        disabled={disabled}
        minDate={minDate}
        maxDate={maxDate}
        getDayProps={(date) => {
          const isSelected = isDateSelected(date, fromDate);
          const inRange = showRangeInCalendar && isDateInRange(date);
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
                target.style.backgroundColor = inRange ? "#e7f5ff" : "";
                target.style.borderRadius = inRange ? "0" : "";
              } else {
                target.style.backgroundColor = "#228be6";
              }
            },
            style: {
              backgroundColor: isSelected
                ? "#228be6"
                : inRange
                  ? "#e7f5ff"
                  : undefined,
              color: isSelected ? "#fff" : undefined,
              fontWeight: isSelected ? 600 : undefined,
              borderRadius: isSelected ? "6px" : inRange ? "0" : "6px",
              cursor: "pointer",
              transition: "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
            },
          };
        }}
        styles={getDateStyles()}
      />
      <DateInput
        style={inputWidth ? { width: inputWidth } : undefined}
        label={hideLabels ? undefined : toLabel}
        labelProps={{
          style: {
            fontSize: "13px",
            fontWeight: 500,
            color: "#000000",
            marginBottom: "4px",
            fontFamily: "Inter",
          },
        }}
        placeholder={toPlaceholder}
        value={toDate}
        onChange={handleToDateChange}
        valueFormat="YYYY-MM-DD"
        leftSection={<IconCalendar size={18} />}
        leftSectionPointerEvents="none"
        radius="md"
        size={size}
        nextIcon={<IconChevronRight size={16} />}
        previousIcon={<IconChevronLeft size={16} />}
        minDate={fromDate || minDate || undefined}
        maxDate={maxDate}
        clearable
        hideOutsideDates
        disabled={disabled}
        getDayProps={(date) => {
          const isSelected = isDateSelected(date, toDate);
          const isFromSelected =
            showRangeInCalendar && isDateSelected(date, fromDate);
          const inRange = showRangeInCalendar && isDateInRange(date);
          const isStartDate = isFromSelected && fromDate && toDate;
          const isEndDate = isSelected && fromDate && toDate;

          return {
            onMouseEnter: (e: React.MouseEvent) => {
              const target = e.currentTarget as HTMLElement;
              if (!isSelected && !isFromSelected) {
                target.style.backgroundColor = "#e9ecef";
                target.style.borderRadius = "6px";
              } else {
                target.style.backgroundColor = "#1c7ed6";
              }
            },
            onMouseLeave: (e: React.MouseEvent) => {
              const target = e.currentTarget as HTMLElement;
              if (!isSelected && !isFromSelected) {
                target.style.backgroundColor = inRange ? "#e7f5ff" : "";
                if (inRange) {
                  if (isStartDate) {
                    target.style.borderRadius = "6px 0 0 6px";
                  } else if (isEndDate) {
                    target.style.borderRadius = "0 6px 6px 0";
                  } else {
                    target.style.borderRadius = "0";
                  }
                } else {
                  target.style.borderRadius = "6px";
                }
              } else {
                target.style.backgroundColor = "#228be6";
              }
            },
            style: {
              backgroundColor:
                isSelected || isFromSelected
                  ? "#228be6"
                  : inRange
                    ? "#e7f5ff"
                    : undefined,
              color: isSelected || isFromSelected ? "#fff" : undefined,
              fontWeight: isSelected || isFromSelected ? 600 : undefined,
              borderRadius:
                isSelected || isFromSelected
                  ? "6px"
                  : inRange && isStartDate
                    ? "6px 0 0 6px"
                    : inRange && isEndDate
                      ? "0 6px 6px 0"
                      : inRange
                        ? "0"
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
        styles={getDateStyles()}
      />
    </Group>
  );
};

export default DateRangeInput;
