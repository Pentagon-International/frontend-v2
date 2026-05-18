import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { getEnquiryConversionDashboardData } from "../../../../service/dashboard.service";
import type { EnquiryConversionPageFilters } from "./EnquiryConversionFilters";

export function useEnquiryConversionDashboard(params: {
  company: string;
  filters: EnquiryConversionPageFilters;
  search?: string | null;
}) {
  const { company, filters, search } = params;
  const fd = filters.fromDate;
  const td = filters.toDate;

  return useQuery({
    queryKey: [
      "enquiryConversionDashboard",
      company,
      fd?.toISOString() ?? "",
      td?.toISOString() ?? "",
      search?.trim() ?? "",
      filters.type ?? "",
      filters.service ?? "",
      filters.salesperson.trim(),
    ],
    queryFn: () =>
      getEnquiryConversionDashboardData({
        company,
        date_from: dayjs(fd!).format("DD-MM-YYYY"),
        date_to: dayjs(td!).format("DD-MM-YYYY"),
        search: search?.trim() || null,
        type: filters.type?.trim() || null,
        service: filters.service?.trim() || null,
        salesperson: filters.salesperson.trim() || null,
      }),
    enabled: !!(company && fd && td),
    // Dashboard module should refetch on every navigation (no stale cache).
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });
}
