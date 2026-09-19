import useAuthStore from "../../../store/authStore";
import { DEFAULT_ERP_LIST_THEME } from "../../../components/ERPListPage/erpListTheme";
import type { CustomerPanApprovalFilters } from "../../../service/customerPanApproval.service";

export type CustomerPanListFilterState = {
  customer_name: string;
  status: string;
  /** UI "Assign To" → API `created_by`. */
  assigned_to: string;
  approved_by: string;
};

export const DEFAULT_CUSTOMER_PAN_LIST_FILTERS: CustomerPanListFilterState = {
  customer_name: "",
  status: "",
  assigned_to: "",
  approved_by: "",
};

/** Empty / "All" omits `status` from the API payload. */
export const CUSTOMER_PAN_STATUS_FILTER_OPTIONS = [
  { value: "", label: "All" },
  { value: "approved", label: "Approved" },
  { value: "pending", label: "Pending" },
  { value: "rejected", label: "Rejected" },
];

export const CUSTOMER_PAN_APPROVAL_LIST_THEME = DEFAULT_ERP_LIST_THEME;

export function resolveLoggedInUsername(
  user: ReturnType<typeof useAuthStore.getState>["user"],
): string {
  return String(
    user?.username ?? user?.full_name ?? user?.user_identifier ?? "",
  ).trim();
}

export function resolveUserEmail(
  user: ReturnType<typeof useAuthStore.getState>["user"],
): string {
  return String(user?.email ?? user?.user_identifier ?? "").trim();
}

export function buildCustomerPanListApiFilters(input: {
  appliedFilters: CustomerPanListFilterState;
  debouncedSearch: string;
  partyType: "customer" | "vendor" | "agent";
  /**
   * Non-admin approval-status scope. Admins must omit this so all records load.
   * Sent as API `assigned_to` only when provided.
   */
  fixedAssignedTo?: string;
}): CustomerPanApprovalFilters {
  const { appliedFilters, debouncedSearch, partyType, fixedAssignedTo } =
    input;

  const status = appliedFilters.status.trim();
  const createdBy = appliedFilters.assigned_to.trim();
  const approvedBy = appliedFilters.approved_by.trim();
  const fixedAssigned = fixedAssignedTo?.trim();

  const filters: CustomerPanApprovalFilters = {
    customer_type: partyType,
  };

  const customerName =
    appliedFilters.customer_name.trim() || debouncedSearch.trim();
  if (customerName) filters.customer_name = customerName;
  // "All" / empty → do not include status key
  if (status) filters.status = status;
  // Assign To column/filter uses created_by
  if (createdBy) filters.created_by = createdBy;
  if (approvedBy) filters.approved_by = approvedBy;
  if (fixedAssigned) filters.assigned_to = fixedAssigned;

  return filters;
}

export function customerPanStatusFilterLabel(status: string): string {
  if (!status.trim()) return "All";
  const match = CUSTOMER_PAN_STATUS_FILTER_OPTIONS.find(
    (option) => option.value === status,
  );
  return match?.label ?? status;
}
