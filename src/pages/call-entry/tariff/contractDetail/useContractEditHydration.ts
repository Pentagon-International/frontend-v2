import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import {
  consumeContractEditPayload,
  CONTRACT_EDIT_STATE_KEY,
  peekContractEditPayload,
} from "./contractEditSession";
import { mapDetailToCreateForm } from "./mapDetailToCreateForm";
import type { MappedCreateContractForm } from "./mapDetailToCreateForm";
import type { ContractDetailResponse } from "./types";

type ContractEditHydrationSetters = {
  setContractId: (value: string) => void;
  setCarrierCode: (value: string) => void;
  setCarrierLabel: (value: string) => void;
  setVendorReference: (value: string) => void;
  setService: (value: string) => void;
  setCoverageDescription: (value: string) => void;
  setCurrencyCode: (value: string) => void;
  setCurrencyLabel: (value: string) => void;
  setValidFrom: (value: string) => void;
  setValidTo: (value: string) => void;
  setApproverLabel: (value: string) => void;
  setAutoRenew: (value: boolean) => void;
  setAutoRenewDays: (value: number | null) => void;
  setInternalNotes: (value: string) => void;
  setRateRows: (value: MappedCreateContractForm["rateRows"]) => void;
  setSurchargeRows: (value: MappedCreateContractForm["surchargeRows"]) => void;
};

function applyMappedForm(
  mapped: MappedCreateContractForm,
  setters: ContractEditHydrationSetters,
) {
  setters.setContractId(mapped.contractId);
  setters.setCarrierCode(mapped.carrierCode);
  setters.setCarrierLabel(mapped.carrierLabel);
  setters.setVendorReference(mapped.vendorReference);
  setters.setService(mapped.service);
  setters.setCoverageDescription(mapped.coverageDescription);
  setters.setCurrencyCode(mapped.currencyCode);
  setters.setCurrencyLabel(mapped.currencyLabel);
  setters.setValidFrom(mapped.validFrom);
  setters.setValidTo(mapped.validTo);
  setters.setApproverLabel(mapped.approverLabel);
  setters.setAutoRenew(mapped.autoRenew);
  setters.setAutoRenewDays(mapped.autoRenewDays);
  setters.setInternalNotes(mapped.internalNotes);
  setters.setRateRows(mapped.rateRows);
  setters.setSurchargeRows(mapped.surchargeRows);
}

function resolveEditDetail(locationState: unknown): ContractDetailResponse | null {
  const stateDetail = (locationState as Record<string, unknown> | null)?.[
    CONTRACT_EDIT_STATE_KEY
  ];

  if (
    stateDetail &&
    typeof stateDetail === "object" &&
    (stateDetail as ContractDetailResponse).contract_basics
  ) {
    return stateDetail as ContractDetailResponse;
  }

  return peekContractEditPayload();
}

export function useContractEditHydration(setters: ContractEditHydrationSetters) {
  const location = useLocation();
  const settersRef = useRef(setters);
  const hydratedForNavigationRef = useRef<string | null>(null);

  settersRef.current = setters;

  useEffect(() => {
    const navigationKey = `${location.pathname}:${location.key}`;
    if (hydratedForNavigationRef.current === navigationKey) return;

    const detail = resolveEditDetail(location.state);
    if (!detail?.contract_basics) return;

    applyMappedForm(mapDetailToCreateForm(detail), settersRef.current);
    hydratedForNavigationRef.current = navigationKey;
    consumeContractEditPayload();
  }, [location.key, location.pathname, location.state]);
}
