import React from "react";
import { DateInput } from "@mantine/dates";
import {
  IconCalendar,
  IconChevronRight,
  IconChevronLeft,
} from "@tabler/icons-react";

export interface SingleDateInputProps {
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

const SingleDateInput: React.FC<SingleDateInputProps> = ({
  label,
  placeholder = "YYYY-MM-DD",
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

  // Handle date selection with deselection capability
  const handleDateChange = (date: Date | null) => {
    if (allowDeselection) {
      // Allow deselection if clicking the same date
      if (
        date &&
        value &&
        date.getDate() === value.getDate() &&
        date.getMonth() === value.getMonth() &&
        date.getFullYear() === value.getFullYear()
      ) {
        onChange(null);
        return;
      }
    }
    onChange(date);
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
    <DateInput
      label={label}
      placeholder={placeholder}
      value={value}
      onChange={handleDateChange}
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
      error={error}
      withAsterisk={withAsterisk}
      getDayProps={(date) => {
        const isSelected = isDateSelected(date, value);
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
            borderRadius: isSelected ? "6px" : "6px",
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
  );
};

export default SingleDateInput;
