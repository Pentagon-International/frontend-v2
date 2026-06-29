import { URL } from "../api/serverUrls";
import type { JobDocumentsNavigationState } from "../utils/jobDocuments";
import { useJobDocuments } from "./useJobDocuments";

type BookingDocumentsSyncState = Pick<
  JobDocumentsNavigationState,
  "document_ids" | "document_display_list"
>;

/** Booking-level documents (customer-service-shipment upload endpoint). */
export function useBookingPageDocuments(
  onSync?: (state: BookingDocumentsSyncState) => void,
) {
  return useJobDocuments({
    uploadEndpoint: URL.uploadDocument,
    onDocumentsUpdated: (state) => {
      onSync?.({
        document_ids: state.document_ids,
        document_display_list: state.document_display_list,
      });
    },
  });
}
