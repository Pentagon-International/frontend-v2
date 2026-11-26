import useAuthStore from "../store/authStore";
import {
  AUTH_SYNC_CHANNEL,
  type AuthSyncMessage,
} from "./authSyncConstants";

export {
  AUTH_SYNC_CHANNEL,
  broadcastAuthUserUpdated,
  type AuthSyncMessage,
} from "./authSyncConstants";

function getDefaultUserBranchId(
  user: {
    branches?: Array<{ is_default?: boolean; user_branch_id?: number }>;
  } | null,
): number | null {
  if (!user?.branches?.length) return null;
  const defaultBranch =
    user.branches.find((branch) => branch.is_default === true) ??
    user.branches[0];
  const id = defaultBranch?.user_branch_id;
  return typeof id === "number" ? id : null;
}

/**
 * Rehydrate auth Zustand state from localStorage.
 * When the default branch differs from the in-memory store (another tab
 * switched branch), reload this tab so all branch-scoped UI/forms reset.
 * The originating tab already has the new branch in memory, so
 * `branchChanged` is false there and it is not reloaded.
 */
export function syncAuthFromLocalStorage(): boolean {
  const prevBranchId = getDefaultUserBranchId(useAuthStore.getState().user);

  let user = null;
  try {
    user = JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    user = null;
  }

  const accessToken = localStorage.getItem("accessToken");
  const refreshToken = localStorage.getItem("refreshToken");

  if (accessToken && refreshToken && user) {
    useAuthStore.setState({ accessToken, refreshToken, user });
  } else if (!accessToken && !user) {
    // Logged out / cleared in another tab — clear in-memory auth only.
    // Avoid hard redirect here so an open form is not abruptly wiped.
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
    });
  }

  const nextBranchId = getDefaultUserBranchId(useAuthStore.getState().user);
  const branchChanged = prevBranchId !== nextBranchId;

  if (branchChanged) {
    // Full reload ensures route state, forms, and caches match the new branch.
    // Query invalidation alone leaves open create/edit screens on stale data.
    window.location.reload();
    return true;
  }

  return false;
}

/**
 * Listen for cross-tab auth/branch updates.
 * - `storage` fires in *other* tabs when localStorage.user is written
 * - BroadcastChannel covers richer same-browser messaging
 * - A branch change in another tab reloads this tab (see syncAuthFromLocalStorage)
 */
export function setupAuthCrossTabSync(): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.storageArea !== localStorage) return;

    // localStorage.clear() in another tab
    if (event.key === null) {
      syncAuthFromLocalStorage();
      return;
    }

    if (event.key !== "user") return;

    syncAuthFromLocalStorage();
  };

  window.addEventListener("storage", onStorage);

  let channel: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== "undefined") {
    try {
      channel = new BroadcastChannel(AUTH_SYNC_CHANNEL);
      channel.onmessage = (event: MessageEvent<AuthSyncMessage>) => {
        const type = event.data?.type;
        if (type === "USER_UPDATED" || type === "BRANCH_CHANGED") {
          syncAuthFromLocalStorage();
        }
      };
    } catch {
      channel = null;
    }
  }

  return () => {
    window.removeEventListener("storage", onStorage);
    channel?.close();
  };
}
