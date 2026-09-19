import useAuthStore from "../store/authStore";
import { isVietnamBranchFromUser } from "../utils/nonDecimalMoneyAmount";
import {
  isIndianOutstandingBranch,
  type BranchCurrencyContext,
} from "../utils/userNumberFormat";

/** Vietnam Accounts team — matched against login/display identity fields. */
const VIETNAM_ACCOUNTS_TEAM_NAMES = [
  "mina",
  "wendy",
  "dhaval",
  "dipali",
  "linal",
] as const;

/** India Accounts team — Mumbai, Delhi, Pune, Bangalore, Chennai, and other Indian branches. */
const INDIA_ACCOUNTS_TEAM_NAMES = [
  "dipali",
  "akash",
  "ganesh",
  "yogita",
  "linal",
  "aakansha",
  "praful",
] as const;

function normalizeIdentity(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

function getUserIdentityValues(
  user: ReturnType<typeof useAuthStore.getState>["user"],
): string[] {
  if (!user) return [];
  return [
    user.username,
    user.full_name,
    user.user_identifier,
    user.email,
  ]
    .map(normalizeIdentity)
    .filter(Boolean);
}

function identityMatchesTeamMember(
  identity: string,
  teamMember: string,
): boolean {
  if (identity === teamMember) return true;

  const firstWord = identity.split(/\s+/)[0]?.replace(/[._-]+$/g, "") ?? "";
  if (firstWord === teamMember) return true;

  if (
    identity.startsWith(`${teamMember}.`) ||
    identity.startsWith(`${teamMember}_`) ||
    identity.startsWith(`${teamMember}-`)
  ) {
    return true;
  }

  return false;
}

function isAccountsTeamMember(
  user: ReturnType<typeof useAuthStore.getState>["user"],
  teamNames: readonly string[],
): boolean {
  if (!user) return false;

  const identities = getUserIdentityValues(user);
  if (!identities.length) return false;

  return teamNames.some((teamMember) =>
    identities.some((identity) => identityMatchesTeamMember(identity, teamMember)),
  );
}

/**
 * India branch: active working branch (`is_default`) is India.
 * Does not use profile country — users on non-India branches keep Accounts access
 * even when their home/profile country is India.
 */
export function isIndiaBranchFromUser(
  user: ReturnType<typeof useAuthStore.getState>["user"],
): boolean {
  // Login payload includes country/currency on branches; store typing is narrower.
  const branches = user?.branches as BranchCurrencyContext[] | undefined;
  if (!branches?.length) return false;

  // Active branch is `is_default` (not `main_default` / home branch).
  const branch =
    branches.find((b) => b.is_default === true) ?? branches[0];

  return (
    isIndianOutstandingBranch(
      branch?.country?.country_code,
      branch?.currency?.currency_code,
    ) ||
    String(branch?.country?.country_name ?? "")
      .toLowerCase()
      .includes("india")
  );
}

/** Vietnam branch: Accounts sub-nav is limited to the Accounts team. */
export function isVietnamAccountsAllowedUser(
  user: ReturnType<typeof useAuthStore.getState>["user"],
): boolean {
  return isAccountsTeamMember(user, VIETNAM_ACCOUNTS_TEAM_NAMES);
}

/** India branch: Accounts sub-nav is limited to the Accounts team. */
export function isIndiaAccountsAllowedUser(
  user: ReturnType<typeof useAuthStore.getState>["user"],
): boolean {
  return isAccountsTeamMember(user, INDIA_ACCOUNTS_TEAM_NAMES);
}

/** Admin / staff users bypass country Accounts-team restrictions. */
function isAdminUser(
  user: ReturnType<typeof useAuthStore.getState>["user"],
): boolean {
  return Boolean(user?.is_staff);
}

/**
 * Accounts module sub-nav access.
 * Admin (is_staff) users always see all Accounts modules.
 * Vietnam / India restrictions apply only while the active branch is that country;
 * users not on those Accounts teams still get full access on other branches.
 * Job-page navigation remains available for everyone.
 */
export function canAccessAccountsSubNav(
  user: ReturnType<typeof useAuthStore.getState>["user"],
): boolean {
  if (isAdminUser(user)) return true;

  if (isVietnamBranchFromUser(user)) {
    return isAccountsTeamMember(user, VIETNAM_ACCOUNTS_TEAM_NAMES);
  }

  // Restrict only when the current (active) branch is India.
  if (isIndiaBranchFromUser(user)) {
    return isAccountsTeamMember(user, INDIA_ACCOUNTS_TEAM_NAMES);
  }

  return true;
}

export function useCanAccessAccountsSubNav(): boolean {
  const user = useAuthStore((state) => state.user);
  return canAccessAccountsSubNav(user);
}
