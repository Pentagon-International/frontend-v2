import { apiCallProtected } from "../api/axios";
import { URL } from "../api/serverUrls";
import { API_HEADER } from "../store/storeKeys";

/** True when job status is CLOSED (case-insensitive). */
export function isJobClosed(status?: string | null): boolean {
  return String(status ?? "").trim().toUpperCase() === "CLOSED";
}

/** True when the page was opened as View (/view, viewMode, or actionType=view). */
export function isJobOpenedAsView(options: {
  pathname?: string | null;
  viewMode?: boolean | null;
  actionType?: string | null;
}): boolean {
  const pathname = String(options.pathname ?? "").toLowerCase();
  return (
    pathname.includes("/view") ||
    options.viewMode === true ||
    String(options.actionType ?? "").toLowerCase() === "view"
  );
}

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message.trim()) {
    return err.message;
  }
  if (typeof err === "object" && err !== null && "message" in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }
  return fallback;
}

export async function closeJob(id: number): Promise<void> {
  await updateJobStatus(id, "CLOSED", "Failed to close job");
}

export async function reopenJob(id: number): Promise<void> {
  await updateJobStatus(id, "ACTIVE", "Failed to reopen job");
}

async function updateJobStatus(
  id: number,
  status: "CLOSED" | "ACTIVE",
  fallback: string,
): Promise<void> {
  try {
    const response = (await apiCallProtected.patch(
      `${URL.importJob}${id}/`,
      { id, status },
      API_HEADER,
    )) as { status?: boolean; message?: string };

    if (response?.status === false) {
      throw new Error(response?.message || fallback);
    }
  } catch (err: unknown) {
    throw new Error(extractErrorMessage(err, fallback));
  }
}
