import { createRoot, type Root } from "react-dom/client";
import {
  Box,
  Button,
  Group,
  Menu,
  Modal,
  Text,
  MantineProvider,
} from "@mantine/core";
import { emotionTransform, MantineEmotionProvider } from "@mantine/emotion";
import { IconShieldCheck } from "@tabler/icons-react";
import { apiCallProtected } from "../api/axios";
import { URL } from "../api/serverUrls";
import { API_HEADER } from "../store/storeKeys";
import { defaultTheme } from "../theme/brandThemeDefault";
import ToastNotification from "./ToastNotification";

type SendForVerificationMenuItemProps = {
  /** Returns house shipment_id values to include in the PATCH payload. */
  getShipmentIds: () => Array<string | number | null | undefined>;
  /**
   * When provided, the item is hidden until the job has been saved
   * (same pattern as other house action menu items).
   */
  jobId?: number | string | null;
};

const menuItemStyles = {
  item: {
    fontFamily: "Inter",
    fontSize: "13px",
    fontWeight: 500,
    borderRadius: "6px",
    padding: "10px 12px",
    marginBottom: "4px",
    "&:hover": {
      backgroundColor: "#F8F9FA",
    },
  },
  itemLabel: {
    fontFamily: "Inter",
    fontSize: "13px",
    fontWeight: 500,
    color: "#424242",
    whiteSpace: "nowrap",
  },
} as const;

function normalizeShipmentIds(
  values: Array<string | number | null | undefined>,
): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const value of values) {
    const id = String(value ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function ConfirmSendForVerificationModal({
  shipmentIds,
  loading,
  onClose,
  onConfirm,
}: {
  shipmentIds: string[];
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const confirmMessage =
    shipmentIds.length === 1
      ? `Send house ${shipmentIds[0]} to Accounts?`
      : `Send ${shipmentIds.length} houses to Accounts?`;

  return (
    <Modal
      opened
      onClose={onClose}
      title={
        <Text fw={600} size="md" style={{ fontFamily: "Inter" }}>
          Send to Accounts
        </Text>
      }
      centered
      zIndex={400}
      closeOnClickOutside={!loading}
      closeOnEscape={!loading}
      withCloseButton={!loading}
    >
      <Text size="sm" c="dimmed" mb="md" style={{ fontFamily: "Inter" }}>
        {confirmMessage}
      </Text>
      <Group justify="flex-end" gap="xs">
        <Button variant="subtle" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button color="#105476" onClick={onConfirm} loading={loading}>
          Confirm
        </Button>
      </Group>
    </Modal>
  );
}

async function sendHousesForVerification(shipmentIds: string[]) {
  const response = (await apiCallProtected.patch(
    `${URL.jobProfitVerification}house/`,
    {
      items: shipmentIds.map((shipment_id) => ({
        shipment_id,
        sent_to_accounts: true,
      })),
    },
    API_HEADER,
  )) as {
    success?: boolean;
    status?: boolean;
    message?: string;
    detail?: string;
  };

  if (response?.success === false || response?.status === false) {
    throw new Error(
      response.message ??
        response.detail ??
        "Failed to send to Accounts.",
    );
  }

  return response;
}

/**
 * Confirm + PATCH outside the Menu tree so the dialog survives dropdown unmount.
 */
function runSendForVerificationFlow(shipmentIds: string[]) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  let loading = false;
  let settled = false;

  const destroy = () => {
    if (settled) return;
    settled = true;
    root.unmount();
    container.remove();
  };

  const render = () => {
    root.render(
      <MantineEmotionProvider>
        <MantineProvider theme={defaultTheme} stylesTransform={emotionTransform}>
          <ConfirmSendForVerificationModal
            shipmentIds={shipmentIds}
            loading={loading}
            onClose={() => {
              if (!loading) destroy();
            }}
            onConfirm={() => {
              if (loading) return;
              loading = true;
              render();

              void (async () => {
                try {
                  const response = await sendHousesForVerification(shipmentIds);
                  ToastNotification({
                    type: "success",
                    message:
                      response?.message ??
                      (shipmentIds.length === 1
                        ? "House sent to Accounts successfully"
                        : "Houses sent to Accounts successfully"),
                  });
                  destroy();
                } catch (err: unknown) {
                  loading = false;
                  render();
                  ToastNotification({
                    type: "error",
                    message:
                      err instanceof Error
                        ? err.message
                        : "Failed to send to Accounts.",
                  });
                }
              })();
            }}
          />
        </MantineProvider>
      </MantineEmotionProvider>,
    );
  };

  render();
}

export function SendForVerificationMenuItem({
  getShipmentIds,
  jobId,
}: SendForVerificationMenuItemProps) {
  if (jobId !== undefined && jobId == null) return null;

  return (
    <Menu.Item
      leftSection={
        <Box
          style={{
            backgroundColor: "#E7F5FF",
            borderRadius: "6px",
            padding: "6px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <IconShieldCheck size={16} color="#105476" />
        </Box>
      }
      styles={menuItemStyles}
      onClick={() => {
        const ids = normalizeShipmentIds(getShipmentIds());
        if (ids.length === 0) {
          ToastNotification({
            type: "error",
            message: "Shipment number not found to send to Accounts.",
          });
          return;
        }
        runSendForVerificationFlow(ids);
      }}
    >
      Send to Accounts
    </Menu.Item>
  );
}
