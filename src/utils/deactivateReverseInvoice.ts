import { apiCallProtected } from "../api/axios";
import { URL } from "../api/serverUrls";

/** Soft-delete a reverse invoice by PATCHing status to INACTIVE. */
export async function deactivateReverseInvoice(
  reverseInvoiceId: number,
  config?: Record<string, unknown>,
): Promise<void> {
  await apiCallProtected.patch(
    `${URL.reverseInvoice}${reverseInvoiceId}/`,
    { id: reverseInvoiceId, status: "INACTIVE" },
    config,
  );
}
