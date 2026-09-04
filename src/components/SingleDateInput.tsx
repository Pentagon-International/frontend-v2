import React from "react";
import { DateInput } from "@mantine/dates";
import {
  IconCalendar,
  IconChevronRight,
  IconChevronLeft,
} from "@tabler/icons-react";
import useDateFormat from "../hooks/useDateFormat";
import { parseTypedDate } from "../utils/dateFormat";

export interface SingleDateInputProps {
  label?: string;
  placeholder?: string;
  value: Date | null;
  onChange: (date: Date | null) => void;
  allowDeselection?: boolean;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  disabled?: boolean;
  readOnly?: boolean;
  minDate?: Date;
  maxDate?: Date;
  error?: string;
  withAsterisk?: boolean;
  /** Forwarded to Mantine `DateInput` (e.g. `dropdown` for portaled calendar). */
  classNames?: Record<string, string>;
  /** Shallow-merge over default date field styles (e.g. `fontFamily`). */
  styles?: Record<string, React.CSSProperties & Record<string, unknown>>;
}

const SingleDateInput: React.FC<SingleDateInputProps> = ({
  label,
  placeholder,
  value,
  onChange,
  allowDeselection = true,
  size = "sm",
  disabled = false,
  readOnly = false,
  minDate,
  maxDate,
  error,
  withAsterisk,
  classNames,
  styles: stylesOverride,
}) => {
  const dateFormat = useDateFormat();

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
        // width: "2rem",
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
      key={`single-date-${dateFormat}`}
      label={label}
      placeholder={placeholder ?? dateFormat}
      value={value}
      onChange={handleDateChange}
      valueFormat={dateFormat}
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
      readOnly={readOnly}
      minDate={minDate}
      maxDate={maxDate}
      error={error}
      withAsterisk={withAsterisk}
      classNames={classNames}
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
      getYearControlProps={(year) => {
        const isSelected = isDateSelected(year, value);
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
            width: "100%",
            height: "2.25rem",
            fontSize: "0.9rem",
          },
        };
      }}
      getMonthControlProps={(month) => {
        const isSelected = isDateSelected(month, value);
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
            width: "3rem",
            height: "2.25rem",
            fontSize: "0.9rem",
          },
        };
      }}
      styles={(() => {
        const base = getDateStyles();
        return {
          ...base,
          ...stylesOverride,
          input: { ...base.input, ...stylesOverride?.input },
          label: { ...base.label, ...stylesOverride?.label },
        };
      })()}
    />
  );
};

export default SingleDateInput;
