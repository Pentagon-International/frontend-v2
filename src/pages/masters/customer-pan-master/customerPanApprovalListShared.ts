import useAuthStore from "../../../store/authStore";
import { DEFAULT_ERP_LIST_THEME } from "../../../components/ERPListPage/erpListTheme";
import type { CustomerPanApprovalFilters } from "../../../service/customerPanApproval.service";

export type CustomerPanListFilterState = {
  customer_name: string;
  status: string;
  assigned_to: string;
  created_by: string;
};

export const DEFAULT_CUSTOMER_PAN_LIST_FILTERS: CustomerPanListFilterState = {
  customer_name: "",
  status: "",
  assigned_to: "",
  created_by: "",
};

export const CUSTOMER_PAN_APPROVAL_LIST_THEME = DEFAULT_ERP_LIST_THEME;

export function resolveLoggedInUsername(
  user: ReturnType<typeof useAuthStore.getState>["user"],
): string {
  return String(
    user?.username ?? user?.full_name ?? user?.user_identifier ?? "",
  ).trim();
}

export function buildCustomerPanListApiFilters(input: {
  appliedFilters: CustomerPanListFilterState;
  debouncedSearch: string;
  partyType: "customer" | "vendor" | "agent";
  /** When set, always applied as the created_by filter (approval status pages). */
  fixedCreatedBy?: string;
}): CustomerPanApprovalFilters {
  const { appliedFilters, debouncedSearch, partyType, fixedCreatedBy } = input;
  const createdBy =
    fixedCreatedBy?.trim() ||
    appliedFilters.created_by.trim() ||
    undefined;

  return {
    customer_name:
      appliedFilters.customer_name.trim() ||
      debouncedSearch.trim() ||
      undefined,
    status: appliedFilters.status.trim() || undefined,
    assigned_to: appliedFilters.assigned_to.trim() || undefined,
    created_by: createdBy,
    customer_type: partyType,
  };
}
