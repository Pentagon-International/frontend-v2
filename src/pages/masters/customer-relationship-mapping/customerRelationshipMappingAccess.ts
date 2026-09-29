export const CUSTOMER_RELATIONSHIP_MAPPING_EDIT_DENIED_MESSAGE =
  "You don't have access to edit customer relationship mapping.";

type RelationshipMappingAccessUser = {
  is_staff?: boolean | null;
  role_code?: string | null;
  role?: string | null;
} | null | undefined;

export function isAccountsUser(user: RelationshipMappingAccessUser): boolean {
  const roleCode = String(user?.role_code ?? "")
    .trim()
    .toUpperCase();
  const roleName = String(user?.role ?? "")
    .trim()
    .toLowerCase();
  return roleCode === "A" || roleName === "accounts";
}

/** Admin (is_staff) and Accounts users may open the edit screen. */
export function canEditCustomerRelationshipMapping(
  user: RelationshipMappingAccessUser,
): boolean {
  return Boolean(user?.is_staff) || isAccountsUser(user);
}
