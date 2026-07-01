import useAuthStore from "../store/authStore";

type MakerCheckerPermissions = {
  maker_checker?: boolean;
  checker?: boolean;
};

/**
 * - maker_checker absent/false: anyone can post on document pages
 * - maker_checker true + checker false: maker cannot post
 * - maker_checker true + checker true: checker can post (normal pages + checker list)
 */
export function canPostDocuments(
  screenPermissions?: MakerCheckerPermissions | null,
): boolean {
  if (!screenPermissions?.maker_checker) {
    return true;
  }
  return Boolean(screenPermissions.checker);
}

/** Checker nav/page is visible only when checker=true. */
export function canAccessCheckerPage(
  screenPermissions?: MakerCheckerPermissions | null,
): boolean {
  return Boolean(screenPermissions?.checker);
}

export function useCanPostDocuments(): boolean {
  const screenPermissions = useAuthStore(
    (state) => state.user?.screen_permissions,
  );
  return canPostDocuments(screenPermissions);
}

export function useCanAccessCheckerPage(): boolean {
  const screenPermissions = useAuthStore(
    (state) => state.user?.screen_permissions,
  );
  return canAccessCheckerPage(screenPermissions);
}
