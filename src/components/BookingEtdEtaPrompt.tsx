import { useCallback, useRef, useState } from "react";
import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import dayjs from "dayjs";
import ToastNotification from "./ToastNotification";
import SingleDateInput from "./SingleDateInput";
import {
  bookingHasEtdAndEta,
  hasBookingScheduleDate,
  updateBookingEtdEta,
} from "../utils/bookingScheduleDates";

type PendingPrompt = {
  booking: Record<string, unknown>;
  resolve: (value: Record<string, unknown> | null) => void;
  confirmLabel: string;
  onProceed?: () => void;
  onAbort?: () => void;
};

type EnsureBookingEtdEtaOptions = {
  /** Primary button label, for example "Create Job". */
  confirmLabel?: string;
  /** Called once the user submits valid dates, before the booking is saved. */
  onProceed?: () => void;
  /** Called when saving the dates fails so the caller can clear its loader. */
  onAbort?: () => void;
};

type UseBookingEtdEtaPromptOptions = {
  /** Called after ETD/ETA are saved on the booking. */
  onUpdated?: () => void;
};

function toDateOrNull(value: unknown): Date | null {
  if (!hasBookingScheduleDate(value)) return null;
  if (value instanceof Date) return value;
  const parsed = dayjs(String(value));
  return parsed.isValid() ? parsed.toDate() : null;
}

function readApiErrorMessage(err: unknown): string {
  const axiosErr = err as {
    response?: { data?: { message?: string; detail?: string; error?: string } };
    message?: string;
  };
  return (
    axiosErr?.response?.data?.message ||
    axiosErr?.response?.data?.detail ||
    axiosErr?.response?.data?.error ||
    (err instanceof Error ? err.message : "Failed to update booking ETD and ETA")
  );
}

/**
 * When a booking is missing ETD or ETA, ask for both, save them on the booking,
 * then continue. Bookings that already have both dates resolve immediately.
 */
export function useBookingEtdEtaPrompt(options?: UseBookingEtdEtaPromptOptions) {
  const onUpdatedRef = useRef(options?.onUpdated);
  onUpdatedRef.current = options?.onUpdated;

  const [pending, setPending] = useState<PendingPrompt | null>(null);
  const pendingRef = useRef<PendingPrompt | null>(null);
  const [etd, setEtd] = useState<Date | null>(null);
  const [eta, setEta] = useState<Date | null>(null);
  const [etdError, setEtdError] = useState<string | undefined>();
  const [etaError, setEtaError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const finish = useCallback((result: Record<string, unknown> | null) => {
    const current = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    setSaving(false);
    setEtdError(undefined);
    setEtaError(undefined);
    current?.resolve(result);
  }, []);

  const ensureBookingEtdEta = useCallback(
    (booking: Record<string, unknown>, options?: EnsureBookingEtdEtaOptions) => {
      if (bookingHasEtdAndEta(booking)) {
        return Promise.resolve(booking);
      }
      return new Promise<Record<string, unknown> | null>((resolve) => {
        pendingRef.current?.resolve(null);
        const next: PendingPrompt = {
          booking,
          resolve,
          confirmLabel: options?.confirmLabel ?? "Create Job",
          onProceed: options?.onProceed,
          onAbort: options?.onAbort,
        };
        pendingRef.current = next;
        setPending(next);
        setEtd(toDateOrNull(booking.etd));
        setEta(toDateOrNull(booking.eta));
        setEtdError(undefined);
        setEtaError(undefined);
        setSaving(false);
      });
    },
    [],
  );

  const handleConfirm = async () => {
    const current = pendingRef.current;
    if (!current) return;
    const nextEtdError = etd ? undefined : "ETD is required";
    const nextEtaError = eta ? undefined : "ETA is required";
    setEtdError(nextEtdError);
    setEtaError(nextEtaError);
    if (!etd || !eta) return;

    current.onProceed?.();
    pendingRef.current = null;
    setPending(null);
    setSaving(false);
    setEtdError(undefined);
    setEtaError(undefined);
    try {
      const updated = await updateBookingEtdEta(current.booking, etd, eta);
      current.resolve(updated);
      onUpdatedRef.current?.();
    } catch (err: unknown) {
      current.onAbort?.();
      current.resolve(null);
      ToastNotification({
        type: "error",
        message: readApiErrorMessage(err),
      });
    }
  };

  const datePopoverProps = {
    withinPortal: true,
    zIndex: 5000,
  };

  const bookingEtdEtaPrompt = (
    <Modal
      opened={pending != null}
      onClose={() => {
        if (!saving) finish(null);
      }}
      title="ETD and ETA required"
      centered
      closeOnClickOutside={!saving}
      closeOnEscape={!saving}
      zIndex={400}
      styles={{
        content: { overflow: "visible" },
        body: { overflow: "visible" },
      }}
    >
      <Text size="sm" c="dimmed" mb="md">
        ETD and ETA are required to create a job. Enter them and the job will
        be created from this booking.
      </Text>
      <Stack gap="sm">
        <SingleDateInput
          label="ETD (Estimated Time of Departure)"
          placeholder="YYYY-MM-DD"
          withAsterisk
          value={etd}
          onChange={(date) => {
            setEtd(date);
            setEtdError(undefined);
          }}
          error={etdError}
          popoverProps={datePopoverProps}
        />
        <SingleDateInput
          label="ETA (Estimated Time of Arrival)"
          placeholder="YYYY-MM-DD"
          withAsterisk
          value={eta}
          onChange={(date) => {
            setEta(date);
            setEtaError(undefined);
          }}
          error={etaError}
          popoverProps={datePopoverProps}
        />
      </Stack>
      <Group justify="flex-end" mt="md" gap="xs">
        <Button
          variant="subtle"
          onClick={() => finish(null)}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button onClick={() => void handleConfirm()} loading={saving}>
          {pending?.confirmLabel ?? "Create Job"}
        </Button>
      </Group>
    </Modal>
  );

  return { ensureBookingEtdEta, bookingEtdEtaPrompt };
}
