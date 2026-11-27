import useAuthStore from "../store/authStore";
import { isAccountsUser } from "../pages/masters/customer-relationship-mapping/customerRelationshipMappingAccess";

/** Staff users (is_staff). */
export function useIsAdminUser(): boolean {
  return useAuthStore((state) => state.user?.is_staff ?? false);
}

/**
 * Admin (is_staff) and Accounts team can create new master records;
 * others may only view/edit where otherwise allowed.
 */
export function useCanCreateMaster(): boolean {
  return useAuthStore((state) => {
    const user = state.user;
    if (!user) return false;
    if (user.is_staff) return true;
    if (user.accounts === true) return true;
    return isAccountsUser(user);
  });
}
