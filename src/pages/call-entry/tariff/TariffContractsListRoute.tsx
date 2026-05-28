import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import TariffContractsList from "./TariffContractsList";
import type { TariffContractRow } from "./TariffContractsList";

type ContractListQueryData = {
  data?: TariffContractRow[];
};

export default function TariffContractsListRoute() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleRowClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const row = target.closest("tr.contract-row");
      if (!row) return;

      const vendorReference = row
        .querySelector(".tariff-contracts-contract-sub")
        ?.textContent?.trim();
      if (!vendorReference) return;

      const queries = queryClient.getQueriesData<ContractListQueryData>({
        queryKey: ["tariff-contracts"],
      });

      let match: TariffContractRow | undefined;
      for (const [, queryData] of queries) {
        match = queryData?.data?.find(
          (item) => item.vendor_reference === vendorReference,
        );
        if (match) break;
      }

      if (match?.carrier_code && match?.service) {
        navigate(
          `/tariff/contracts/${encodeURIComponent(match.carrier_code)}/${encodeURIComponent(match.service)}`,
        );
      }
    };

    document.addEventListener("click", handleRowClick);
    return () => document.removeEventListener("click", handleRowClick);
  }, [navigate, queryClient]);

  return (
    <>
      <TariffContractsList />
      <Outlet />
    </>
  );
}
