import { isIndianUserFromProfile } from "../../utils/userNumberFormat";
import { isAccountsUser } from "./customer-relationship-mapping/customerRelationshipMappingAccess";

export const PARTY_MASTER_EDIT_DENIED_MESSAGE =
  "Only Accounts users can edit customer, vendor, and agent master data.";

type PartyMasterAccessUser = {
  is_staff?: boolean | null;
  role_code?: string | null;
  role?: string | null;
  accounts?: boolean | null;
  is_accounts?: boolean | null;
  country?: {
    country_code?: string | null;
    country_name?: string | null;
  } | null;
} | null | undefined;

/**
 * India-only: Accounts (and admin/staff) may edit customer/vendor/agent masters.
 * Non-India users keep existing edit access.
 */
export function canEditPartyMaster(user: PartyMasterAccessUser): boolean {
  if (!isIndianUserFromProfile(user?.country)) return true;

  if (Boolean(user?.is_staff)) return true;
  if (user?.accounts === true || user?.is_accounts === true) return true;
  return isAccountsUser(user);
}
