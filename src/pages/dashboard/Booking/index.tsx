import React, { useState, useEffect, useRef } from "react";
import {
  getBookingData,
  BookingItem,
} from "../../../service/dashboard.service";
import { DetailedViewTable, DateRangeInput } from "../../../components";

interface BookingProps {
  onBack?: () => void;
  globalSearch?: string;
  fromDate?: Date | null;
  toDate?: Date | null;
}

const Booking: React.FC<BookingProps> = ({
  onBack,
  globalSearch,
  fromDate: propFromDate,
  toDate: propToDate,
}) => {
  const [bookingData, setBookingData] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const isMountedRef = useRef(false);

  // Use props if provided, otherwise use defaults
  const fromDate = propFromDate;
  const toDate = propToDate;

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

  // Load data on mount and when dates or search change
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
    }
    // Load with dates from props
    loadBookingData(fromDate, toDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate, globalSearch]);

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
        // Commented out - can be used in future case
        // Date filter is now common at top level
        // <DateRangeInput
        //   fromDate={fromDate}
        //   toDate={toDate}
        //   onFromDateChange={handleFromDateChange}
        //   onToDateChange={handleToDateChange}
        //   fromLabel="From Date"
        //   toLabel="To Date"
        //   size="sm"
        //   allowDeselection={true}
        //   showRangeInCalendar={false}
        // />
        undefined
      }
    />
  );
};

export default Booking;
