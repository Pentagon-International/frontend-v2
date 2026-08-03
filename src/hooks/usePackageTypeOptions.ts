import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { URL } from "../api/serverUrls";
import { apiCallProtected } from "../api/axios";
import { API_HEADER } from "../store/storeKeys";
import {
  extractPackageTypeList,
  mapPackageTypeOptions,
} from "../utils/packageTypeOptions";

/** Fetches package types for job House Cargo dropdowns (code value / code-name label). */
export function usePackageTypeOptions() {
  const { data: rawRecords = [] } = useQuery({
    queryKey: ["package-type-master-options"],
    queryFn: async () => {
      try {
        const response = await apiCallProtected.get(
          `${URL.packageTypeMaster}?index=0&limit=1000`,
          API_HEADER,
        );
        return extractPackageTypeList(response);
      } catch (error) {
        console.error("Error fetching package type options:", error);
        return [];
      }
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  return useMemo(
    () => mapPackageTypeOptions(rawRecords, { activeOnly: true }),
    [rawRecords],
  );
}
