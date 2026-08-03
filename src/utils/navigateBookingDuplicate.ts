import { getAPICall } from "../service/getApiCall";
import { URL } from "../api/serverUrls";
import { API_HEADER } from "../store/storeKeys";
import { ToastNotification } from "../components";
import { prepareBookingDuplicateData } from "./prepareBookingDuplicateData";

type NavigateFn = (to: string, options?: { state?: unknown }) => void;

/**
 * Fetches a booking by id, strips identity fields, and navigates to create
 * with `prefillFromLastBookings` so the stepper can map values into a new booking.
 */
export async function navigateBookingDuplicate(options: {
  bookingId: string | number;
  navigate: NavigateFn;
  createPath?: string;
  onStart?: () => void;
  onEnd?: () => void;
  persistListState?: () => void;
}): Promise<void> {
  const {
    bookingId,
    navigate,
    createPath = "./create",
    onStart,
    onEnd,
    persistListState,
  } = options;

  onStart?.();
  try {
    persistListState?.();
    const response = (await getAPICall(
      `${URL.customerServiceShipment}${bookingId}/`,
      API_HEADER,
    )) as {
      success?: boolean;
      data?: Record<string, unknown> | Record<string, unknown>[];
    };

    const bookingItem =
      Array.isArray(response?.data) && response.data.length > 0
        ? response.data[0]
        : (response?.data as Record<string, unknown> | undefined);

    if (!response?.success || !bookingItem) {
      ToastNotification({
        type: "error",
        message: "Failed to load booking for duplicate.",
      });
      return;
    }

    navigate(createPath, {
      state: {
        duplicateBooking: prepareBookingDuplicateData(bookingItem),
        prefillFromLastBookings: true,
      },
    });
  } catch (error) {
    console.error("Error preparing booking duplicate:", error);
    ToastNotification({
      type: "error",
      message: "Failed to load booking for duplicate. Please try again.",
    });
  } finally {
    onEnd?.();
  }
}
