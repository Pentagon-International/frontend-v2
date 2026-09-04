import React from "react";
import { DateInput, type DateInputProps } from "@mantine/dates";
import { Group } from "@mantine/core";
import {
  IconCalendar,
  IconChevronRight,
  IconChevronLeft,
} from "@tabler/icons-react";
import useDateFormat from "../hooks/useDateFormat";
import { parseTypedDate } from "../utils/dateFormat";

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
  /** Match Air Export / list toolbar: 32px inputs, Geist 12px, #E2E8F0 border */
  compactToolbar?: boolean;
  /**
   * Merged into each from/to `DateInput` `styles` (label + input + calendar bits).
   * Use `erpListFilterUnifiedMantineStyles(theme)` on ERP list filter panels.
   * When set, default Inter 13px labels and legacy input sizing are skipped.
   */
  filterFieldStyles?: DateInputProps["styles"];
  /**
   * Class names for both date fields (e.g. `{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }`).
   * `Record` allowed so `dropdown` is not lost when Mantine’s type omits it.
   */
  dateInputClassNames?: DateInputProps["classNames"] | Record<string, string>;
}

const DateRangeInput: React.FC<DateRangeInputProps> = ({
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  fromLabel = "From Date",
  toLabel = "To Date",
  fromPlaceholder,
  toPlaceholder,
  allowDeselection = true,
  showRangeInCalendar = false,
  size = "sm",
  disabled = false,
  minDate,
  maxDate,
  containerStyle,
  inputWidth,
  hideLabels = false,
  compactToolbar = false,
  filterFieldStyles,
  dateInputClassNames,
}) => {
  const hasUnifiedFilterStyles =
    filterFieldStyles != null &&
    typeof filterFieldStyles === "object" &&
    !Array.isArray(filterFieldStyles);
  /** List filters + compact 32px row (Air Export) */
  const filterRowLayout = hasUnifiedFilterStyles || compactToolbar;
  const dateFormat = useDateFormat();

  // Helper to check if date is selected
  const isDateSelected = (
    date: Date | null,
    selectedDate: Date | null,
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
      date.getDate(),
    ).getTime();
    const normalizedFrom = new Date(
      fromDate.getFullYear(),
      fromDate.getMonth(),
      fromDate.getDate(),
    ).getTime();
    const normalizedTo = new Date(
      toDate.getFullYear(),
      toDate.getMonth(),
      toDate.getDate(),
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

  const toolbarInputStyles = hasUnifiedFilterStyles
    ? {}
    : compactToolbar
      ? {
          input: {
            height: 32,
            minHeight: 32,
            fontSize: 12,
            borderColor: "#e2e8f0",
            fontFamily: "'Geist', sans-serif",
          },
        }
      : {
          input: {
            height: "36px",
            fontSize: "13px",
            fontFamily: "Inter",
          },
        };

  const legacyLabelStyle = {
    fontSize: "13px" as const,
    fontWeight: 500,
    color: "#000000",
    marginBottom: "4px",
    fontFamily: "Inter",
  };

  const mergedFieldStyles: DateInputProps["styles"] = {
    ...getDateStyles(),
    ...toolbarInputStyles,
    ...(hasUnifiedFilterStyles
      ? (filterFieldStyles as NonNullable<typeof filterFieldStyles>)
      : {}),
  };

  const calendarIconSize = filterRowLayout ? 14 : 18;

  return (
    <Group
      gap={filterRowLayout ? "sm" : "md"}
      align={hideLabels ? "center" : "flex-end"}
      w={filterRowLayout ? "auto" : "100%"}
      grow={!filterRowLayout}
      wrap="nowrap"
      style={containerStyle}
    >
      <DateInput
        key={`from-${dateFormat}`}
        style={inputWidth ? { width: inputWidth } : undefined}
        label={hideLabels ? undefined : fromLabel}
        labelProps={
          hasUnifiedFilterStyles || hideLabels
            ? undefined
            : { style: legacyLabelStyle }
        }
        placeholder={dateFormat}
        value={fromDate}
        onChange={handleFromDateChange}
        valueFormat={dateFormat}
        dateParser={(input) => parseTypedDate(input, dateFormat)}
        leftSection={<IconCalendar size={calendarIconSize} />}
        leftSectionPointerEvents="none"
        radius={filterRowLayout ? "sm" : "md"}
        classNames={dateInputClassNames}
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
        styles={mergedFieldStyles}
      />
      <DateInput
        key={`to-${dateFormat}`}
        style={inputWidth ? { width: inputWidth } : undefined}
        label={hideLabels ? undefined : toLabel}
        labelProps={
          hasUnifiedFilterStyles || hideLabels
            ? undefined
            : { style: legacyLabelStyle }
        }
        placeholder={dateFormat}
        value={toDate}
        onChange={handleToDateChange}
        valueFormat={dateFormat}
        dateParser={(input) => parseTypedDate(input, dateFormat)}
        leftSection={<IconCalendar size={calendarIconSize} />}
        leftSectionPointerEvents="none"
        radius={filterRowLayout ? "sm" : "md"}
        classNames={dateInputClassNames}
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
        styles={mergedFieldStyles}
      />
    </Group>
  );
};

export default DateRangeInput;
