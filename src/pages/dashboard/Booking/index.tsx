import React, { useState, useEffect, useRef } from "react";
import { Box } from "@mantine/core";
import {
  getBookingData,
  BookingItem,
} from "../../../service/dashboard.service";
import { DetailedViewTable } from "../../../components";
import PaginationBar from "../../../components/PaginationBar/PaginationBar";
import { useDashboardChartSearch } from "../../../hooks/useDashboardChartSearch";

interface BookingProps {
  onBack?: () => void;
  fromDate?: Date | null;
  toDate?: Date | null;
}

const DEFAULT_PAGE_SIZE = 25;

const Booking: React.FC<BookingProps> = ({
  onBack,
  fromDate: propFromDate,
  toDate: propToDate,
}) => {
  const { committed: committedSearch } = useDashboardChartSearch();
  const [bookingData, setBookingData] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [totalRecords, setTotalRecords] = useState(0);
  const prevFiltersKeyRef = useRef<string>("");

  const fromDate = propFromDate;
  const toDate = propToDate;
  const filtersKey = `${fromDate?.toISOString() ?? ""}|${toDate?.toISOString() ?? ""}|${committedSearch ?? ""}`;

  useEffect(() => {
    let cancelled = false;

    // When date range or search changes, reset to first page (skip this fetch if pageIndex will change)
    if (prevFiltersKeyRef.current !== filtersKey) {
      prevFiltersKeyRef.current = filtersKey;
      if (pageIndex !== 0) {
        setPageIndex(0);
        return;
      }
    }

    const loadBookingData = async () => {
      try {
        setLoading(true);
        const response = await getBookingData(
          fromDate,
          toDate,
          committedSearch,
          pageIndex,
          pageSize,
        );
        if (cancelled) return;
        setBookingData(response.data || []);
        setTotalRecords(
          typeof response.total === "number" ? response.total : 0,
        );
      } catch (error) {
        console.error("Error loading booking data:", error);
        if (!cancelled) {
          setBookingData([]);
          setTotalRecords(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadBookingData();
    return () => {
      cancelled = true;
    };
  }, [filtersKey, fromDate, toDate, committedSearch, pageIndex, pageSize]);

  // Keep pageIndex in range when total shrinks
  useEffect(() => {
    if (pageSize <= 0) return;
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
    if (pageIndex > totalPages - 1) {
      setPageIndex(totalPages - 1);
    }
  }, [totalRecords, pageSize, pageIndex]);

  const handlePageChange = (page: number) => {
    setPageIndex(Math.max(0, page - 1));
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPageIndex(0);
  };

  return (
    <Box>
      <DetailedViewTable
        data={bookingData}
        title="Booking"
        drillLevel={0}
        moduleType="booking"
        onClose={onBack || (() => {})}
        loading={loading}
        showBackButton={false}
        showCloseButton={false}
        totalRecords={totalRecords}
        headerActions={undefined}
      />
      <Box style={{ borderTop: "1px solid #e9ecef", flexShrink: 0 }}>
        <PaginationBar
          pageSize={pageSize}
          currentPage={pageIndex + 1}
          totalRecords={totalRecords}
          onPageSizeChange={handlePageSizeChange}
          onPageChange={handlePageChange}
          pageSizeOptions={["10", "25", "50"]}
        />
      </Box>
    </Box>
  );
};

export default Booking;
