import { useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  Button,
  Group,
  Modal,
  NumberInput,
  Stack,
  Text,
  Textarea,
  MantineProvider,
} from "@mantine/core";
import { emotionTransform, MantineEmotionProvider } from "@mantine/emotion";
import { apiCallProtected } from "../api/axios";
import { URL } from "../api/serverUrls";
import { API_HEADER } from "../store/storeKeys";
import { defaultTheme } from "../theme/brandThemeDefault";
import ToastNotification from "../components/ToastNotification";

export type JobProfitHouseAction = "verify" | "confirm";

export type JobProfitHouseNavContext = {
  shipment_id?: string | null;
  is_sales?: boolean | null;
  status?: string | null;
  brokerage?: number | null;
  brokerage_remark?: string | null;
  verified_by?: string | null;
  verified_at?: string | null;
  confirmed_by?: string | null;
  confirmed_at?: string | null;
};

export type JobProfitHousePatchPayload = {
  shipment_id: string;
  verified?: boolean;
  confirmed?: boolean;
  brokerage?: number;
  brokerage_remark?: string;
};

export type JobProfitHouseAuditRecord = {
  verified_by?: string | null;
  verified_at?: string | null;
  confirmed_by?: string | null;
  confirmed_at?: string | null;
  status?: string | null;
  brokerage?: number | null;
  brokerage_remark?: string | null;
  hold_remark?: string | null;
  shipment_id?: string | null;
};

export type JobProfitHousePatchResult = {
  success?: boolean;
  status?: boolean | string;
  message?: string;
  detail?: string;
  verified_by?: string | null;
  verified_at?: string | null;
  confirmed_by?: string | null;
  confirmed_at?: string | null;
  brokerage?: number | null;
  brokerage_remark?: string | null;
  /** API may return a single house object or a list of house rows. */
  data?: JobProfitHouseAuditRecord | JobProfitHouseAuditRecord[] | null;
};

/** Unwrap the house row from a PATCH response (`data` object or array). */
export function pickProfitHouseRecord(
  response?: JobProfitHousePatchResult | null,
  shipmentId?: string | null,
): JobProfitHouseAuditRecord | null {
  const raw = response?.data;
  if (Array.isArray(raw)) {
    const wanted = String(shipmentId ?? "").trim();
    if (wanted) {
      const matched = raw.find(
        (row) => String(row?.shipment_id ?? "").trim() === wanted,
      );
      if (matched) return matched;
    }
    return raw[0] ?? null;
  }
  if (raw && typeof raw === "object") return raw;
  return null;
}

/** Pick audit fields from a house PATCH response (top-level or nested `data`). */
export function pickProfitHouseAuditFields(
  response?: JobProfitHousePatchResult | null,
  shipmentId?: string | null,
): {
  verified_by: string | null;
  verified_at: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  status: string | null;
  brokerage: number | null;
  brokerage_remark: string | null;
  hold_remark: string | null;
} {
  const nested = pickProfitHouseRecord(response, shipmentId);
  const verified_by =
    nested?.verified_by ?? response?.verified_by ?? null;
  const verified_at =
    nested?.verified_at ?? response?.verified_at ?? null;
  const confirmed_by =
    nested?.confirmed_by ?? response?.confirmed_by ?? null;
  const confirmed_at =
    nested?.confirmed_at ?? response?.confirmed_at ?? null;
  const brokerageRaw = nested?.brokerage ?? response?.brokerage ?? null;
  const brokerage =
    brokerageRaw != null && Number.isFinite(Number(brokerageRaw))
      ? Number(brokerageRaw)
      : null;
  const brokerage_remark =
    nested?.brokerage_remark ?? response?.brokerage_remark ?? null;
  const hold_remarkRaw = nested?.hold_remark ?? null;
  const hold_remark =
    hold_remarkRaw != null ? String(hold_remarkRaw).trim() || null : null;
  // Prefer nested house status; never treat a boolean top-level `status` as profit status.
  const statusRaw = nested?.status;
  const status =
    typeof statusRaw === "string" && statusRaw.trim()
      ? statusRaw.trim()
      : null;
  return {
    verified_by: verified_by != null ? String(verified_by) : null,
    verified_at: verified_at != null ? String(verified_at) : null,
    confirmed_by: confirmed_by != null ? String(confirmed_by) : null,
    confirmed_at: confirmed_at != null ? String(confirmed_at) : null,
    status,
    brokerage,
    brokerage_remark:
      brokerage_remark != null ? String(brokerage_remark) : null,
    hold_remark,
  };
}

export function normalizeProfitStatus(status?: string | null): string {
  return String(status ?? "")
    .trim()
    .toLowerCase();
}

const PROFIT_STATUS_LABELS: Record<string, string> = {
  sent_to_verify: "Pending for verification",
  verified: "Pricing verified pending for sales confirmation",
  confirmed: "Sales Confirmed",
  hold: "Hold",
  approved: "Approved",
  rejected: "Rejected",
  hold_confirmed: "Approved",
  hold_rejected: "Rejected",
};

export const PROFIT_STATUS_FILTER_OPTIONS = [
  { value: "sent_to_verify", label: PROFIT_STATUS_LABELS.sent_to_verify },
  { value: "verified", label: PROFIT_STATUS_LABELS.verified },
  { value: "confirmed", label: PROFIT_STATUS_LABELS.confirmed },
  { value: "hold", label: PROFIT_STATUS_LABELS.hold },
  { value: "approved", label: PROFIT_STATUS_LABELS.approved },
  { value: "rejected", label: PROFIT_STATUS_LABELS.rejected },
] as const;

/** Human-readable label for job profit verification status keys. */
export function getProfitStatusLabel(status?: string | null): string {
  const key = normalizeProfitStatus(status);
  if (!key) return "";
  return PROFIT_STATUS_LABELS[key] ?? String(status ?? "").trim();
}

/** No further verify/confirm/brokerage actions after confirm, hold, or hold decision. */
export function isProfitFlowComplete(status?: string | null): boolean {
  const s = normalizeProfitStatus(status);
  return (
    s === "confirmed" ||
    s === "hold" ||
    s === "approved" ||
    s === "rejected" ||
    s === "hold_confirmed" ||
    s === "hold_rejected"
  );
}

/** True when salesperson confirm (or a hold/approval decision) has been applied. */
export function isProfitConfirmed(status?: string | null): boolean {
  const s = normalizeProfitStatus(status);
  return (
    s === "confirmed" ||
    s === "hold" ||
    s === "approved" ||
    s === "rejected" ||
    s === "hold_confirmed" ||
    s === "hold_rejected"
  );
}

export function isProfitOnHold(status?: string | null): boolean {
  return normalizeProfitStatus(status) === "hold";
}

/** Hold from status and/or a non-empty hold_remark on the brokerage/house response. */
export function isProfitHoldFromResponse(options: {
  status?: string | null;
  holdRemark?: string | null;
}): boolean {
  return (
    isProfitOnHold(options.status) ||
    Boolean(String(options.holdRemark ?? "").trim())
  );
}

export type JobProfitHoldDecision = "approve" | "reject";

export type JobProfitHoldDecisionPayload = {
  items: Array<{
    shipment_id: string;
    hold_confirmed?: boolean;
    hold_rejected?: boolean;
  }>;
};

export function buildHoldDecisionPayload(
  shipmentId: string,
  decision: JobProfitHoldDecision,
): JobProfitHoldDecisionPayload {
  const shipment_id = String(shipmentId ?? "").trim();
  if (decision === "approve") {
    return { items: [{ shipment_id, hold_confirmed: true }] };
  }
  return { items: [{ shipment_id, hold_rejected: true }] };
}

export async function patchJobProfitHoldDecision(
  payload: JobProfitHoldDecisionPayload,
) {
  const response = (await apiCallProtected.patch(
    `${URL.jobProfitVerification}house/`,
    payload,
    API_HEADER,
  )) as JobProfitHousePatchResult;

  if (response?.success === false || response?.status === false) {
    throw new Error(
      response.message ??
        response.detail ??
        "Failed to update hold decision.",
    );
  }

  return response;
}

/** Approve / Reject hold dialogs outside Menu trees so they survive dropdown unmount. */
export function runJobProfitHoldDecision(options: {
  shipmentId: string;
  decision: JobProfitHoldDecision;
  onSuccess?: (response?: JobProfitHousePatchResult) => void;
}) {
  const shipmentId = String(options.shipmentId ?? "").trim();
  if (!shipmentId) {
    ToastNotification({
      type: "error",
      message: "Shipment number not found.",
    });
    return;
  }

  const isApprove = options.decision === "approve";
  let loading = false;
  let error: string | null = null;

  mountPortal(({ update, destroy }) => {
    const render = () => {
      update(
        <ConfirmActionModal
          title={isApprove ? "Approve" : "Reject"}
          message={
            isApprove
              ? `Approve for shipment ${shipmentId}?`
              : `Reject for shipment ${shipmentId}?`
          }
          confirmLabel={isApprove ? "Approve" : "Reject"}
          loading={loading}
          error={error}
          onClose={() => {
            if (!loading) destroy();
          }}
          onConfirm={() => {
            if (loading) return;
            loading = true;
            error = null;
            render();

            void (async () => {
              try {
                const response = await patchJobProfitHoldDecision(
                  buildHoldDecisionPayload(shipmentId, options.decision),
                );
                ToastNotification({
                  type: "success",
                  message:
                    response?.message ??
                    (isApprove
                      ? "Hold approved successfully"
                      : "Hold rejected successfully"),
                });
                destroy();
                options.onSuccess?.(response);
              } catch (err: unknown) {
                loading = false;
                error = resolveApiErrorMessage(
                  err,
                  "Failed to update hold decision.",
                );
                ToastNotification({ type: "error", message: error });
                render();
              }
            })();
          }}
        />,
      );
    };
    render();
  });
}

export function canShowVerifyProfit(params: {
  is_sales?: boolean | null;
  status?: string | null;
}): boolean {
  // Pricing (is_sales=false) and sales (is_sales=true) can both verify.
  if (params.is_sales !== true && params.is_sales !== false) return false;
  if (isProfitFlowComplete(params.status)) return false;
  const status = normalizeProfitStatus(params.status);
  return status !== "verified";
}

export function canShowConfirmProfit(params: {
  is_sales?: boolean | null;
  status?: string | null;
}): boolean {
  // Confirm is only for sales users (is_sales=true), after verify.
  // Hold applies only after salesperson confirms — do not block on hold_remark alone.
  if (params.is_sales !== true) return false;
  if (isProfitFlowComplete(params.status)) return false;
  return normalizeProfitStatus(params.status) === "verified";
}

/** Sales can update brokerage only after verify, before confirm. */
export function canUpdateBrokerage(params: {
  is_sales?: boolean | null;
  status?: string | null;
}): boolean {
  if (params.is_sales !== true) return false;
  if (isProfitFlowComplete(params.status)) return false;
  return normalizeProfitStatus(params.status) === "verified";
}

export function resolveApiErrorMessage(
  err: unknown,
  fallback = "Failed to update profit verification.",
): string {
  if (err instanceof Error && err.message.trim()) return err.message.trim();
  if (err && typeof err === "object") {
    const record = err as Record<string, unknown>;
    if (typeof record.message === "string" && record.message.trim()) {
      return record.message.trim();
    }
    if (typeof record.detail === "string" && record.detail.trim()) {
      return record.detail.trim();
    }
    if (
      typeof record.error_message === "string" &&
      record.error_message.trim()
    ) {
      return record.error_message.trim();
    }
  }
  if (typeof err === "string" && err.trim()) return err.trim();
  return fallback;
}

/** True when the API `brokerage` amount is already set (non-null, non-empty). */
export function hasExistingBrokerage(
  brokerage?: number | string | null,
): boolean {
  return (
    brokerage !== null &&
    brokerage !== undefined &&
    String(brokerage).trim() !== ""
  );
}

function hasBrokerageValues(options: {
  brokerage?: number | string | null;
  brokerageRemark?: string | null;
}): boolean {
  const hasAmount = hasExistingBrokerage(options.brokerage);
  const hasRemark = String(options.brokerageRemark ?? "").trim() !== "";
  return hasAmount || hasRemark;
}

/** Brokerage-only payload (does not mark confirmed). */
export function buildBrokeragePayload(options: {
  shipmentId: string;
  brokerage?: number | string | null;
  brokerageRemark?: string | null;
}): JobProfitHousePatchPayload {
  const shipment_id = String(options.shipmentId ?? "").trim();
  const payload: JobProfitHousePatchPayload = { shipment_id };

  const rawBrokerage = options.brokerage;
  if (
    rawBrokerage !== null &&
    rawBrokerage !== undefined &&
    String(rawBrokerage).trim() !== ""
  ) {
    const amount = Number(rawBrokerage);
    if (Number.isFinite(amount)) {
      payload.brokerage = amount;
    }
  }

  const remark = String(options.brokerageRemark ?? "").trim();
  if (remark) {
    payload.brokerage_remark = remark;
  }

  return payload;
}

export async function patchJobProfitHouse(payload: JobProfitHousePatchPayload) {
  const response = (await apiCallProtected.patch(
    `${URL.jobProfitVerification}house/`,
    payload,
    API_HEADER,
  )) as JobProfitHousePatchResult;

  if (response?.success === false || response?.status === false) {
    throw new Error(
      response.message ??
        response.detail ??
        "Failed to update profit verification.",
    );
  }

  return response;
}

/** Save brokerage only — separate from confirm. */
export async function saveJobProfitBrokerage(options: {
  shipmentId: string;
  brokerage?: number | string | null;
  brokerageRemark?: string | null;
}) {
  return patchJobProfitHouse(
    buildBrokeragePayload({
      shipmentId: options.shipmentId,
      brokerage: options.brokerage,
      brokerageRemark: options.brokerageRemark,
    }),
  );
}

function ConfirmActionModal({
  title,
  message,
  confirmLabel,
  loading,
  error,
  onClose,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  loading: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      opened
      onClose={onClose}
      title={
        <Text fw={600} size="md" style={{ fontFamily: "Inter" }}>
          {title}
        </Text>
      }
      centered
      zIndex={400}
      closeOnClickOutside={!loading}
      closeOnEscape={!loading}
      withCloseButton={!loading}
    >
      <Text size="sm" c="dimmed" mb="md" style={{ fontFamily: "Inter" }}>
        {message}
      </Text>
      {error ? (
        <Text size="sm" c="red" mb="md" style={{ fontFamily: "Inter" }}>
          {error}
        </Text>
      ) : null}
      <Group justify="flex-end" gap="xs">
        <Button variant="subtle" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button color="#105476" onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </Group>
    </Modal>
  );
}

function ConfirmProfitBrokerageModal({
  shipmentId,
  initialBrokerage,
  initialRemark,
  loading,
  error,
  onClose,
  onSubmit,
}: {
  shipmentId: string;
  initialBrokerage?: number | null;
  initialRemark?: string | null;
  loading: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (values: {
    brokerage: number | string | null;
    brokerageRemark: string;
  }) => void;
}) {
  const [brokerage, setBrokerage] = useState<string | number | null>(
    initialBrokerage ?? null,
  );
  const [remark, setRemark] = useState(String(initialRemark ?? ""));

  return (
    <Modal
      opened
      onClose={onClose}
      title={
        <Text fw={600} size="md" style={{ fontFamily: "Inter" }}>
          Confirm profit
        </Text>
      }
      centered
      zIndex={400}
      closeOnClickOutside={!loading}
      closeOnEscape={!loading}
      withCloseButton={!loading}
    >
      <Stack gap="sm">
        <Text size="sm" c="dimmed" style={{ fontFamily: "Inter" }}>
          Confirm profit for shipment {shipmentId}. Brokerage is optional —
          leave blank to confirm without brokerage.
        </Text>
        <NumberInput
          label="Brokerage amount"
          placeholder="Optional — skip if none"
          value={brokerage ?? undefined}
          onChange={(value) => setBrokerage(value === "" ? null : value)}
          min={0}
          decimalScale={2}
          thousandSeparator=","
          hideControls
          styles={{
            label: { fontFamily: "Inter", fontSize: 13, fontWeight: 500 },
            input: { fontFamily: "Inter" },
          }}
        />
        <Textarea
          label="Brokerage remark"
          placeholder="Optional (required when HOLD)"
          value={remark}
          onChange={(e) => setRemark(e.currentTarget.value)}
          minRows={2}
          styles={{
            label: { fontFamily: "Inter", fontSize: 13, fontWeight: 500 },
            input: { fontFamily: "Inter" },
          }}
        />
        {error ? (
          <Text size="sm" c="red" style={{ fontFamily: "Inter" }}>
            {error}
          </Text>
        ) : null}
        <Group justify="flex-end" gap="xs">
          <Button variant="subtle" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            color="#105476"
            loading={loading}
            onClick={() =>
              onSubmit({
                brokerage,
                brokerageRemark: remark,
              })
            }
          >
            Confirm
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function mountPortal(renderNode: (api: {
  update: (node: ReactNode) => void;
  destroy: () => void;
}) => void) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  let settled = false;

  const destroy = () => {
    if (settled) return;
    settled = true;
    root.unmount();
    container.remove();
  };

  const update = (node: ReactNode) => {
    root.render(
      <MantineEmotionProvider>
        <MantineProvider theme={defaultTheme} stylesTransform={emotionTransform}>
          {node}
        </MantineProvider>
      </MantineEmotionProvider>,
    );
  };

  renderNode({ update, destroy });
}

/**
 * Verify / Confirm dialogs outside Menu trees so they survive dropdown unmount.
 * Confirm can optionally collect brokerage first (saved separately), then confirm.
 */
export function runJobProfitHouseAction(options: {
  shipmentId: string;
  action: JobProfitHouseAction;
  /** When confirming, show optional brokerage fields (list page). */
  askBrokerage?: boolean;
  initialBrokerage?: number | null;
  initialBrokerageRemark?: string | null;
  onSuccess?: (response?: JobProfitHousePatchResult) => void;
}) {
  const shipmentId = String(options.shipmentId ?? "").trim();
  if (!shipmentId) {
    ToastNotification({
      type: "error",
      message: "Shipment number not found.",
    });
    return;
  }

  if (options.action === "verify") {
    let loading = false;
    let error: string | null = null;

    mountPortal(({ update, destroy }) => {
      const render = () => {
        update(
          <ConfirmActionModal
            title="Verify profit"
            message={`Verify profit for shipment ${shipmentId}?`}
            confirmLabel="Verify"
            loading={loading}
            error={error}
            onClose={() => {
              if (!loading) destroy();
            }}
            onConfirm={() => {
              if (loading) return;
              loading = true;
              error = null;
              render();

              void (async () => {
                try {
                  const response = await patchJobProfitHouse({
                    shipment_id: shipmentId,
                    verified: true,
                  });
                  ToastNotification({
                    type: "success",
                    message:
                      response?.message ?? "Profit verified successfully",
                  });
                  destroy();
                  options.onSuccess?.(response);
                } catch (err: unknown) {
                  loading = false;
                  error = resolveApiErrorMessage(err);
                  ToastNotification({ type: "error", message: error });
                  render();
                }
              })();
            }}
          />,
        );
      };
      render();
    });
    return;
  }

  // Skip brokerage fields when amount is already on the record (salesperson sees them once).
  const askBrokerage =
    options.askBrokerage !== false &&
    !hasExistingBrokerage(options.initialBrokerage);

  // Confirm without brokerage prompt (e.g. Job Ledger menu when form is separate,
  // or brokerage was already saved earlier).
  if (!askBrokerage) {
    let loading = false;
    let error: string | null = null;

    mountPortal(({ update, destroy }) => {
      const render = () => {
        update(
          <ConfirmActionModal
            title="Confirm profit"
            message={`Confirm profit for shipment ${shipmentId}?`}
            confirmLabel="Confirm"
            loading={loading}
            error={error}
            onClose={() => {
              if (!loading) destroy();
            }}
            onConfirm={() => {
              if (loading) return;
              loading = true;
              error = null;
              render();

              void (async () => {
                try {
                  const response = await patchJobProfitHouse({
                    shipment_id: shipmentId,
                    confirmed: true,
                  });
                  ToastNotification({
                    type: "success",
                    message:
                      response?.message ?? "Profit confirmed successfully",
                  });
                  destroy();
                  options.onSuccess?.(response);
                } catch (err: unknown) {
                  loading = false;
                  error = resolveApiErrorMessage(err);
                  ToastNotification({ type: "error", message: error });
                  render();
                }
              })();
            }}
          />,
        );
      };
      render();
    });
    return;
  }

  // Confirm with optional brokerage prompt (list page).
  let loading = false;
  let error: string | null = null;

  mountPortal(({ update, destroy }) => {
    const render = () => {
      update(
        <ConfirmProfitBrokerageModal
          shipmentId={shipmentId}
          initialBrokerage={options.initialBrokerage}
          initialRemark={options.initialBrokerageRemark}
          loading={loading}
          error={error}
          onClose={() => {
            if (!loading) destroy();
          }}
          onSubmit={(values) => {
            if (loading) return;
            loading = true;
            error = null;
            render();

            void (async () => {
              try {
                if (
                  hasBrokerageValues({
                    brokerage: values.brokerage,
                    brokerageRemark: values.brokerageRemark,
                  })
                ) {
                  await saveJobProfitBrokerage({
                    shipmentId,
                    brokerage: values.brokerage,
                    brokerageRemark: values.brokerageRemark,
                  });
                }

                const response = await patchJobProfitHouse({
                  shipment_id: shipmentId,
                  confirmed: true,
                });
                ToastNotification({
                  type: "success",
                  message:
                    response?.message ?? "Profit confirmed successfully",
                });
                destroy();
                options.onSuccess?.(response);
              } catch (err: unknown) {
                loading = false;
                error = resolveApiErrorMessage(err);
                ToastNotification({ type: "error", message: error });
                render();
              }
            })();
          }}
        />,
      );
    };
    render();
  });
}
