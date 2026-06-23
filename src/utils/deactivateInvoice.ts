import { apiCallProtected } from "../api/axios";
import { URL } from "../api/serverUrls";

/** Soft-delete an invoice by PATCHing status to INACTIVE. */
export async function deactivateInvoice(
  invoiceId: number,
  config?: Record<string, unknown>,
): Promise<void> {
  await apiCallProtected.patch(
    `${URL.invoice}${invoiceId}/`,
    { id: invoiceId, status: "INACTIVE" },
    config,
  );
}
