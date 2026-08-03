import { Box, Center, Loader, Text } from "@mantine/core";
import {
  MantineReactTable,
  MRT_ColumnDef,
  useMantineReactTable,
} from "mantine-react-table";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { apiCallProtected } from "../api/axios";
import { URL } from "../api/serverUrls";

export type BookingRow = Record<string, unknown>;

type LastBookingsListProps = {
  /** API `service` filter — e.g. `"AIR"`, `"INLAND"`, or `["FCL","LCL"]` for ocean */
  service: string | string[];
  serviceType: "EXPORT" | "IMPORT";
  /** Restrict list to this customer (from the booking row Duplicate was opened on) */
  customerCode?: string | null;
  onRowSelect?: (row: BookingRow) => void;
};

function LastBookingsList({
  service,
  serviceType,
  customerCode,
  onRowSelect,
}: LastBookingsListProps) {
  const serviceKey = Array.isArray(service) ? service.join(",") : service;
  const effectiveCustomerCode = customerCode?.trim() || null;

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["last-bookings", serviceType, serviceKey, effectiveCustomerCode],
    enabled: Boolean(effectiveCustomerCode),
    queryFn: async () => {
      const res = (await apiCallProtected.post(
        `${URL.customerServiceShipmentFilter}?index=0&limit=14`,
        {
          filters: {
            service_type: serviceType,
            service,
            customer_code: effectiveCustomerCode,
          },
        },
      )) as Record<string, unknown>;

      const data = res?.data;
      if (data && Array.isArray(data)) return data as BookingRow[];
      if (Array.isArray(res?.results)) return res.results as BookingRow[];
      if (Array.isArray(res?.result)) return res.result as BookingRow[];
      return [];
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });

  const columns = useMemo<MRT_ColumnDef<BookingRow>[]>(
    () => [
      {
        accessorKey: "shipment_code",
        header: "Booking ID",
        Cell: ({ cell }) => cell.getValue<string>() || "-",
      },
      {
        accessorKey: "customer_name",
        header: "Customer",
        Cell: ({ cell }) => cell.getValue<string>() || "-",
      },
      {
        id: "route",
        header: "Route",
        Cell: ({ row }) => {
          const origin =
            (row.original.origin_code_read as string) ||
            (row.original.origin_code as string) ||
            "";
          const destination =
            (row.original.destination_code_read as string) ||
            (row.original.destination_code as string) ||
            "";
          if (!origin && !destination) return "-";
          return `${origin || "-"} → ${destination || "-"}`;
        },
      },
      {
        accessorKey: "service",
        header: "Service",
        Cell: ({ cell }) => cell.getValue<string>() || "-",
      },
      {
        accessorKey: "date",
        header: "Date",
        Cell: ({ cell }) => {
          const value = cell.getValue<string>();
          if (!value) return "-";
          return dayjs(value).isValid()
            ? dayjs(value).format("DD MMM YYYY")
            : value;
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        Cell: ({ cell }) => cell.getValue<string>() || "-",
      },
      {
        accessorKey: "customer_service_name",
        header: "Handler",
        Cell: ({ cell }) => cell.getValue<string>() || "-",
      },
    ],
    [],
  );

  const table = useMantineReactTable({
    columns,
    data: rows,
    enableColumnFilters: false,
    enablePagination: false,
    enableTopToolbar: false,
    enableColumnActions: false,
    enableSorting: false,
    enableBottomToolbar: false,
    enableColumnPinning: false,
    enableStickyHeader: true,
    layoutMode: "grid",
    mantineTableProps: {
      striped: false,
      highlightOnHover: true,
      withTableBorder: false,
      withColumnBorders: false,
      style: { width: "100%" },
    },
    mantinePaperProps: {
      shadow: "sm",
      p: "md",
      radius: "md",
      style: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        maxHeight: "1536px",
        overflow: "auto",
      },
    },
    mantineTableBodyRowProps: ({ row }) => ({
      onClick: () => {
        if (!onRowSelect) return;
        onRowSelect(row.original as BookingRow);
      },
      style: {
        cursor: onRowSelect ? "pointer" : "default",
      },
    }),
  });

  if (!effectiveCustomerCode) {
    return (
      <Center h="100%" mih={200}>
        <Text c="dimmed">Customer not available for this booking</Text>
      </Center>
    );
  }

  if (isLoading) {
    return (
      <Center h="100%" mih={200}>
        <Loader color="#105476" size="lg" />
      </Center>
    );
  }

  if (rows.length === 0) {
    return (
      <Center h="100%" mih={200}>
        <Text c="dimmed">No recent bookings found</Text>
      </Center>
    );
  }

  return (
    <Box p="md">
      <MantineReactTable table={table} />
    </Box>
  );
}

export default LastBookingsList;
