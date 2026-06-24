export type BranchOdexFields = {
  odex_username?: string | null;
  odex_password?: string | null;
  has_odex_credentials?: boolean;
};

export type BranchWithOdex = {
  user_branch_id: number;
  branch_code?: string;
  branch_name?: string;
  is_default?: boolean;
} & BranchOdexFields;

export function normalizeLoginBranches(branches: unknown[]): BranchWithOdex[] {
  if (!Array.isArray(branches)) return [];
  return branches.map((raw) => {
    const branch = raw as Record<string, unknown>;
    return {
      ...branch,
      user_branch_id: Number(branch.user_branch_id ?? branch.id ?? 0),
    } as BranchWithOdex;
  });
}

export function getActiveBranch<T extends { is_default?: boolean }>(
  branches?: T[] | null,
): T | undefined {
  if (!branches?.length) return undefined;
  return branches.find((branch) => branch.is_default) ?? branches[0];
}

export function getBranchByUserBranchId<T extends { user_branch_id: number }>(
  branches: T[] | undefined,
  userBranchId: number | undefined,
): T | undefined {
  if (!branches?.length || !userBranchId) return undefined;
  return branches.find((branch) => branch.user_branch_id === userBranchId);
}

export function isBranchOdexConfigured(
  branch?: BranchOdexFields | null,
): boolean {
  return branch?.has_odex_credentials === true;
}

export function hasOdexCredentialsChanged(
  stored: BranchOdexFields | undefined,
  username: string,
  password: string,
): boolean {
  return (
    (username ?? "") !== (stored?.odex_username ?? "") ||
    (password ?? "") !== (stored?.odex_password ?? "")
  );
}

export function extractOdexFieldsFromResponse(
  data: Record<string, unknown>,
): BranchOdexFields {
  const hasFlag = data.has_odex_credentials === true;
  const username =
    data.odex_username != null ? String(data.odex_username) : null;
  const password =
    data.odex_password != null ? String(data.odex_password) : null;

  return {
    odex_username: username,
    odex_password: password,
    has_odex_credentials:
      hasFlag || Boolean(username?.trim() && password?.trim()),
  };
}

export const ODEX_CREDENTIALS_NOT_CONFIGURED_MESSAGE =
  "ODEX credentials are not configured for your current branch. Please save them in Profile before pushing to Odex.";
