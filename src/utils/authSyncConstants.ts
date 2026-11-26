/** Shared BroadcastChannel name for cross-tab auth / active-branch sync. */
export const AUTH_SYNC_CHANNEL = "pentagon-auth-sync";

export type AuthSyncMessage = {
  type: "USER_UPDATED" | "BRANCH_CHANGED";
  branchId?: number;
  at: number;
};

/** Notify other same-origin browsing contexts that user/branch cache changed. */
export function broadcastAuthUserUpdated(payload?: {
  branchId?: number;
  type?: AuthSyncMessage["type"];
}): void {
  if (typeof BroadcastChannel === "undefined") return;

  try {
    const channel = new BroadcastChannel(AUTH_SYNC_CHANNEL);
    const message: AuthSyncMessage = {
      type: payload?.type ?? "USER_UPDATED",
      branchId: payload?.branchId,
      at: Date.now(),
    };
    channel.postMessage(message);
    channel.close();
  } catch {
    // BroadcastChannel unavailable — `storage` event remains the fallback.
  }
}
