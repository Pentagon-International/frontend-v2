import { ToastNotification } from "../components";
import {
  ALLOC_DOC_OPEN_QUERY,
  stashOpenedDocumentState,
} from "./openAllocationDocumentTab";
import {
  globalSearchItemsFromResponse,
  resolveGlobalSearchItemLocation,
  runGlobalSearchQuery,
  type GlobalSearchItem,
  type GlobalSearchNavigateOptions,
  type ResolvedDocumentLocation,
} from "./globalSearchNavigation";

const normalizeSourceKey = (value: string): string =>
  value.trim().toLowerCase().replace(/[\s-]+/g, "_");

const SOURCE_TO_MODULES: Record<string, string[]> = {
  invoice: ["invoice"],
  credit_note: ["invoice"],
  creditnote: ["invoice"],
  cn: ["invoice"],
  crn: ["invoice"],
  cdn: ["invoice"],
  receipt: ["receipt", "overseas_receipt"],
  overseas_receipt: ["overseas_receipt", "receipt"],
  payment: ["payment", "overseas_payment"],
  overseas_payment: ["overseas_payment", "payment"],
  supplier_invoice: ["supplier_invoice"],
  reverse_invoice: ["reverse_invoice"],
  reverse_receipt: ["reverse_receipt"],
  reverse_payment: ["reverse_payment"],
  reverse_supplier_invoice: ["reverse_supplier_invoice"],
  payment_request: ["payment_request"],
  prq: ["payment_request"],
  journal_voucher: ["journal_voucher"],
  debit_note: ["debit_credit_note"],
  debit_credit_note: ["debit_credit_note"],
};

function pickSearchItem(
  items: GlobalSearchItem[],
  source?: string,
  documentNo?: string,
): GlobalSearchItem | null {
  if (items.length === 0) return null;
  if (items.length === 1) return items[0];

  const docNo = (documentNo ?? "").trim().toUpperCase();
  const exactDisplay = items.find(
    (item) =>
      String(item.display_id ?? "")
        .trim()
        .toUpperCase() === docNo,
  );
  if (exactDisplay) return exactDisplay;

  const preferredModules = SOURCE_TO_MODULES[normalizeSourceKey(source ?? "")];
  if (preferredModules?.length) {
    for (const mod of preferredModules) {
      const match = items.find(
        (item) => normalizeSourceKey(item.module) === mod,
      );
      if (match) return match;
    }
  }

  return items[0];
}

function pathWithViewMode(path: string, statusUpper: string): string {
  if (statusUpper !== "POSTED") return path;
  return path.replace(/\/edit(?=\/|$)/, "/view");
}

export type OpenDocumentInNewTabResult =
  | "opened"
  | "multiple"
  | "not_found"
  | "blocked"
  | "error";

function closeTab(tab: Window | null) {
  if (!tab) return;
  try {
    tab.close();
  } catch {
    // ignore
  }
}

function assignResolvedDocumentToTab(
  tab: Window,
  resolved: ResolvedDocumentLocation,
  stashState = false,
): void {
  const statusUpper = String(
    resolved.state.status ??
      resolved.state.document_status ??
      resolved.state.approved ??
      "",
  )
    .trim()
    .toUpperCase();

  let path = pathWithViewMode(resolved.path, statusUpper);
  const state = {
    ...resolved.state,
    actionType: statusUpper === "POSTED" ? "view" : "edit",
  };

  const isIdInPath = /\/(?:edit|view)\/\d+\/?$/.test(path);
  if (!isIdInPath || stashState) {
    const key = stashOpenedDocumentState(state);
    const joiner = path.includes("?") ? "&" : "?";
    path = `${path}${joiner}${ALLOC_DOC_OPEN_QUERY}=${encodeURIComponent(key)}`;
  }

  tab.location.href = new window.URL(path, window.location.origin).toString();
  try {
    tab.opener = null;
  } catch {
    // ignore
  }
}

/** Opens one global-search document in a new tab. Call from a click handler. */
export async function openGlobalSearchItemInNewTab(
  item: GlobalSearchItem,
  options?: GlobalSearchNavigateOptions,
): Promise<OpenDocumentInNewTabResult> {
  const newTab = window.open("about:blank", "_blank");
  if (!newTab) return "blocked";

  try {
    const resolved = await resolveGlobalSearchItemLocation(item, options);
    if (!resolved) {
      closeTab(newTab);
      return "not_found";
    }
    assignResolvedDocumentToTab(newTab, resolved, true);
    return "opened";
  } catch (e) {
    console.error("Failed to open document in a new tab", e);
    closeTab(newTab);
    return "error";
  }
}

/**
 * Resolves a document number and opens it in a new tab.
 * The blank tab is opened immediately so the browser treats it as a user gesture.
 */
export async function openSearchedDocumentInNewTab(
  documentNo: string,
  options?: GlobalSearchNavigateOptions,
): Promise<OpenDocumentInNewTabResult> {
  const query = documentNo.trim();
  if (!query) return "not_found";

  const newTab = window.open("about:blank", "_blank");
  if (!newTab) return "blocked";

  try {
    const normalized = await runGlobalSearchQuery(query);
    const items = globalSearchItemsFromResponse(normalized);
    if (items.length === 0) {
      closeTab(newTab);
      return "not_found";
    }
    if (items.length > 1) {
      closeTab(newTab);
      return "multiple";
    }

    const resolved = await resolveGlobalSearchItemLocation(items[0], options);
    if (!resolved) {
      closeTab(newTab);
      return "not_found";
    }
    assignResolvedDocumentToTab(newTab, resolved, true);
    return "opened";
  } catch (e) {
    console.error("Failed to open document in a new tab", e);
    closeTab(newTab);
    return "error";
  }
}

/**
 * Opens an allocation source document in a new tab (same stash/hydrator pattern
 * as Document Allocation).
 */
export async function openAllocationSourceDocumentInNewTab(
  sourceNo: string,
  source?: string,
): Promise<void> {
  const query = sourceNo.trim();
  if (!query) {
    ToastNotification({
      type: "warning",
      message: "Document number is not available.",
    });
    return;
  }

  const newTab = window.open("about:blank", "_blank");
  if (!newTab) {
    ToastNotification({
      type: "warning",
      message:
        "Popup blocked. Please allow popups to open the document in a new tab.",
    });
    return;
  }

  try {
    const normalized = await runGlobalSearchQuery(query);
    const items = globalSearchItemsFromResponse(normalized);
    const item = pickSearchItem(items, source, query);

    if (!item) {
      ToastNotification({
        type: "warning",
        message: "No document found for this document number.",
      });
      try {
        newTab.close();
      } catch {
        // ignore
      }
      return;
    }

    const resolved = await resolveGlobalSearchItemLocation(item);
    if (!resolved) {
      ToastNotification({
        type: "warning",
        message: "Navigation is not configured for this document type.",
      });
      closeTab(newTab);
      return;
    }

    assignResolvedDocumentToTab(newTab, resolved);
  } catch (e) {
    console.error("Failed to open allocation source document", e);
    ToastNotification({
      type: "error",
      message: "Failed to open document. Please try again.",
    });
    try {
      newTab.close();
    } catch {
      // ignore
    }
  }
}
