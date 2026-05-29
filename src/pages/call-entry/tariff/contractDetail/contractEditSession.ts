import type { ContractDetailResponse } from "./types";

export const CONTRACT_EDIT_STATE_KEY = "contractEdit";

const SESSION_KEY = "tariff-contract-edit-payload";

export function stashContractForEdit(detail: ContractDetailResponse): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(detail));
}

export function peekContractEditPayload(): ContractDetailResponse | null {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as ContractDetailResponse;
  } catch {
    return null;
  }
}

export function consumeContractEditPayload(): ContractDetailResponse | null {
  const payload = peekContractEditPayload();
  sessionStorage.removeItem(SESSION_KEY);
  return payload;
}
