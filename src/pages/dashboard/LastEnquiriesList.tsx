import { Box, Center, Loader, Text } from "@mantine/core";
import {
  MantineReactTable,
  MRT_ColumnDef,
  useMantineReactTable,
} from "mantine-react-table";
import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiCallProtected } from "../../api/axios";
import { URL } from "../../api/serverUrls";

type EnquiryRow = Record<string, unknown>;

type LocationState = {
  customer_code?: string;
};

type LastEnquiriesListProps = {
  customerCode?: string;
  onRowSelect?: (row: EnquiryRow) => void;
  moduleLabel?: string;
  moduleKeyPrefix?: string;
};

function LastEnquiriesList({
  customerCode,
  onRowSelect,
  moduleLabel = "Enquiry",
  moduleKeyPrefix = "ENQUIRY",
}: LastEnquiriesListProps) {
  const location = useLocation();
  const customerCodeFromState = (location.state as LocationState | null)
    ?.customer_code;
  const effectiveCustomerCode = customerCode ?? customerCodeFromState;

  const queryBase = moduleKeyPrefix.toLowerCase();
  const modulePluralKey = queryBase === "enquiry" ? "enquiries" : `${queryBase}s`;

  const { data: rows = [], isLoading } = useQuery({
    queryKey: [`last-${modulePluralKey}`, effectiveCustomerCode],
    enabled: Boolean(effectiveCustomerCode),
    queryFn: async () => {
      const payload = {
        filters: {
          customer_code: effectiveCustomerCode,
          // status: "ACTIVE",
          status: ["ACTIVE", "LOST", "QUOTE CREATED", "GAINED"],
        },
      };

      const res = (await apiCallProtected.post(
        `${URL.enquiryFilter}?index=0&limit=14`,
        payload,
      )) as any;

      const data = res?.data;
      if (data && Array.isArray(data.data)) return data.data as EnquiryRow[];
      if (Array.isArray(data)) return data as EnquiryRow[];
      return [];
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });

  const columns = useMemo<MRT_ColumnDef<EnquiryRow>[]>(
    () => [
      // { accessorKey: "customer_name", header: "Customer Name" },
      { accessorKey: "enquiry_id", header: `${moduleLabel} ID` },
      { accessorKey: "sales_person", header: "Sales Person" },
      {
        accessorKey: "service_trade_combined",
        header: "Service",
        Cell: ({ row }: any) => {
          const original = row.original || {};

          const serviceValue =
            original?.service_list ||
            original?.service ||
            original?.service_name ||
            "";
          const tradeValue = original?.trade_list || original?.trade || "";

          if (!serviceValue && !tradeValue) {
            const servicesArr = original?.services;
            if (Array.isArray(servicesArr) && servicesArr.length > 0) {
              return servicesArr
                .map((s: any) => {
                  const sv = s?.service || s?.service_name || "";
                  const tv = s?.trade || "";
                  if (!sv && !tv) return "";
                  if (!sv) return String(tv);
                  if (!tv) return String(sv);
                  return `${sv} - ${tv}`;
                })
                .filter(Boolean)
                .join(", ") || "-";
            }
            return "-";
          }
          if (!serviceValue) {
            return tradeValue;
          }
          if (!tradeValue) {
            return serviceValue;
          }
          return `${serviceValue} - ${tradeValue}`;
        },
      },
      { accessorKey: "origin_list", header: "Origin",         Cell: ({ cell }) => {
          const originList = cell.getValue<string[]>();
          if (
            !originList ||
            !Array.isArray(originList) ||
            originList.length === 0
          ) {
            return "-";
          }
          return (
            <div style={{ lineHeight: "1.4" }}>
              {originList.map((origin, index) => (
                <div key={index}>{origin}</div>
              ))}
            </div>
          );
        }, },
      { accessorKey: "destination_list", header: "Destination",         Cell: ({ cell }) => {
          const destinationList = cell.getValue<string[]>();
          if (
            !destinationList ||
            !Array.isArray(destinationList) ||
            destinationList.length === 0
          ) {
            return "-";
          }
          return (
            <div style={{ lineHeight: "1.4" }}>
              {destinationList.map((destination, index) => (
                <div key={index}>{destination}</div>
              ))}
            </div>
          );
        }, },
      { accessorKey: "reference_no", header: "Reference No",   Cell: ({ cell }) => {
          const value = cell.getValue<string>();
          return value || "-";
        }, },
      { accessorKey: "enquiry_received_date", header: `${moduleLabel} Date` },
      { accessorKey: "status", header: "Status" },
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
        onRowSelect(row.original as EnquiryRow);
      },
      style: {
        cursor: onRowSelect ? "pointer" : "default",
      },
    }),
  });

  if (!effectiveCustomerCode) {
    return (
      <Center h="100%">
        <Text c="dimmed">Customer not selected</Text>
      </Center>
    );
  }

  if (isLoading) {
    return (
      <Center h="100%">
        <Loader color="#2563EB" size="lg" />
      </Center>
    );
  }

  return (
    <Box p="md">
      <MantineReactTable table={table} />
    </Box>
  );
}

export default LastEnquiriesList;
