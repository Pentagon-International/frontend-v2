import useAuthStore from "../store/authStore";
import { isVietnamBranchFromUser } from "../utils/nonDecimalMoneyAmount";

/** Vietnam Accounts team — matched against login/display identity fields. */
const VIETNAM_ACCOUNTS_TEAM_NAMES = [
  "mina",
  "wendy",
  "dhaval",
  "dipali",
] as const;

/** Accounts access only when logged into Vietnam branch (denied on other branches). */
const VIETNAM_ONLY_ACCOUNTS_TEAM_NAMES = ["linal"] as const;

type AccountsTeamName =
  | (typeof VIETNAM_ACCOUNTS_TEAM_NAMES)[number]
  | (typeof VIETNAM_ONLY_ACCOUNTS_TEAM_NAMES)[number];

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
  teamNames: readonly AccountsTeamName[],
): boolean {
  if (!user) return false;

  const identities = getUserIdentityValues(user);
  if (!identities.length) return false;

  return teamNames.some((teamMember) =>
    identities.some((identity) => identityMatchesTeamMember(identity, teamMember)),
  );
}

/** Vietnam branch: Accounts sub-nav is limited to the Accounts team. */
export function isVietnamAccountsAllowedUser(
  user: ReturnType<typeof useAuthStore.getState>["user"],
): boolean {
  return (
    isAccountsTeamMember(user, VIETNAM_ACCOUNTS_TEAM_NAMES) ||
    isAccountsTeamMember(user, VIETNAM_ONLY_ACCOUNTS_TEAM_NAMES)
  );
}

function isVietnamOnlyAccountsUser(
  user: ReturnType<typeof useAuthStore.getState>["user"],
): boolean {
  return isAccountsTeamMember(user, VIETNAM_ONLY_ACCOUNTS_TEAM_NAMES);
}

export function canAccessAccountsSubNav(
  user: ReturnType<typeof useAuthStore.getState>["user"],
): boolean {
  if (isVietnamOnlyAccountsUser(user)) {
    return isVietnamBranchFromUser(user);
  }
  if (!isVietnamBranchFromUser(user)) return true;
  return isAccountsTeamMember(user, VIETNAM_ACCOUNTS_TEAM_NAMES);
}

export function useCanAccessAccountsSubNav(): boolean {
  const user = useAuthStore((state) => state.user);
  return canAccessAccountsSubNav(user);
}
