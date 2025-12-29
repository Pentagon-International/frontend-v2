import React, { useState, useEffect, useRef } from "react";
import {
  getBookingData,
  BookingItem,
} from "../../../service/dashboard.service";
import { DetailedViewTable, DateRangeInput } from "../../../components";

interface BookingProps {
  onBack?: () => void;
  globalSearch?: string;
}

const Booking: React.FC<BookingProps> = ({ onBack, globalSearch }) => {
  // Get first day of current month and today's date
  const getDefaultFromDate = (): Date => {
    const now = new Date();
    // return new Date(now.getFullYear(), now.getMonth(), 1);
    return now;
  };

  const getDefaultToDate = (): Date => {
    return new Date();
  };

  const [bookingData, setBookingData] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState<Date | null>(getDefaultFromDate());
  const [toDate, setToDate] = useState<Date | null>(getDefaultToDate());
  const isMountedRef = useRef(false);

  const loadBookingData = async (from?: Date | null, to?: Date | null) => {
    try {
      setLoading(true);
      // console.log("Loading booking data with dates:", { from, to });

      const response = await getBookingData(from, to, globalSearch);
      // console.log("Booking data loaded:", response);
      setBookingData(response.data || []);
    } catch (error) {
      console.error("Error loading booking data:", error);
      setBookingData([]);
    } finally {
      setLoading(false);
    }
  };

  // Load data on mount with default dates
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      // Load with default dates (first day of month to today)
      loadBookingData(fromDate, toDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load data only when both dates are selected, or when dates are cleared, or when search changes
  useEffect(() => {
    if (isMountedRef.current) {
      if (fromDate && toDate) {
        // Both dates selected - load with payload
        loadBookingData(fromDate, toDate);
      } else if (!fromDate && !toDate) {
        // Both dates cleared - load with empty payload
        loadBookingData(null, null);
      }
      // If only one date is selected, don't make API call
      // Note: globalSearch changes will trigger reload through the dependency array
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate, globalSearch]);

  // Handle date changes
  const handleFromDateChange = (date: Date | null) => {
    setFromDate(date);
  };

  const handleToDateChange = (date: Date | null) => {
    setToDate(date);
  };

  return (
    <DetailedViewTable
      data={bookingData}
      title="Booking"
      drillLevel={0}
      moduleType="booking"
      onClose={onBack || (() => {})}
      loading={loading}
      showBackButton={false}
      showCloseButton={false}
      headerActions={
        <DateRangeInput
          fromDate={fromDate}
          toDate={toDate}
          onFromDateChange={handleFromDateChange}
          onToDateChange={handleToDateChange}
          fromLabel="From Date"
          toLabel="To Date"
          size="sm"
          allowDeselection={true}
          showRangeInCalendar={false}
        />
      }
    />
  );
};

export default Booking;
