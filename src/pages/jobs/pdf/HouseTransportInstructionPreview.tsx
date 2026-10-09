import { useState } from "react";
import {
  Box,
  Button,
  Center,
  Group,
  Loader,
  Menu,
  Modal,
  Stack,
  Text,
} from "@mantine/core";
import {
  IconDownload,
  IconPrinter,
  IconSend,
  IconTruck,
  IconX,
} from "@tabler/icons-react";
import { URL } from "../../../api/serverUrls";
import { ToastNotification } from "../../../components";
import useAuthStore from "../../../store/authStore";

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
  },
};

function resolveHousingId(
  housingId: number | string | null | undefined,
): number | null {
  if (housingId == null || housingId === "") return null;
  const id = typeof housingId === "number" ? housingId : Number(housingId);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function HouseTransportInstructionMenuItem({
  onClick,
}: {
  onClick: () => void;
}) {
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
          <IconTruck size={16} color="#105476" />
        </Box>
      }
      styles={menuItemStyles}
      onClick={onClick}
    >
      Transport Instruction
    </Menu.Item>
  );
}

export function useHouseTransportInstructionPreview(options: {
  housingId: number | string | null | undefined;
  onSendEmail: (pdfBlobUrl: string, fileName: string) => void;
}) {
  const housingId = resolveHousingId(options.housingId);
  const [opened, setOpened] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<string | null>(null);
  const [fileName, setFileName] = useState(
    `TransportInstruction-${housingId ?? "house"}.pdf`,
  );

  const closePreview = () => {
    setOpened(false);
    setPdfBlob((current) => {
      if (current) window.URL.revokeObjectURL(current);
      return null;
    });
  };

  const openPreview = async (housingIdOverride?: number | string | null) => {
    const overrideIsId =
      typeof housingIdOverride === "number" ||
      typeof housingIdOverride === "string";
    const id = resolveHousingId(
      overrideIsId ? housingIdOverride : options.housingId,
    );
    if (!id) return;
    setFileName(`TransportInstruction-${id}.pdf`);
    setOpened(true);
    setPdfBlob((current) => {
      if (current) window.URL.revokeObjectURL(current);
      return null;
    });
    try {
      const token = useAuthStore.getState().accessToken;
      const response = await fetch(
        `${URL.base}${URL.jobCreate}transport-instruction/${id}/pdf/`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      setPdfBlob(window.URL.createObjectURL(blob));
    } catch (error) {
      console.error("Error fetching transport instruction PDF:", error);
      ToastNotification({
        type: "error",
        message: "Failed to load transport instruction PDF",
      });
      setOpened(false);
    }
  };

  const downloadPdf = () => {
    if (!pdfBlob) return;
    const link = document.createElement("a");
    link.href = pdfBlob;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printPdf = () => {
    if (!pdfBlob) return;
    const win = window.open(pdfBlob, "_blank");
    if (win) win.print();
  };

  const modal = (
    <Modal
      opened={opened}
      onClose={closePreview}
      title="Transport Instruction"
      centered
      size="95%"
      overlayProps={{
        backgroundOpacity: 0.55,
        blur: 3,
      }}
      styles={{
        content: {
          minHeight: "90vh",
          maxWidth: "1200px",
        },
        body: {
          padding: 0,
          height: "100%",
        },
      }}
    >
      <Stack h="82vh">
        {pdfBlob ? (
          <>
            <iframe
              src={pdfBlob}
              style={{
                width: "100%",
                height: "100%",
                border: "none",
                borderRadius: "8px",
              }}
              title="Transport Instruction Preview"
            />
            <Group
              justify="flex-end"
              p="md"
              style={{ borderTop: "1px solid #e9ecef" }}
            >
              <Button
                variant="outline"
                onClick={closePreview}
                leftSection={<IconX size={16} />}
              >
                Close
              </Button>
              <Button
                variant="outline"
                onClick={printPdf}
                leftSection={<IconPrinter size={16} />}
              >
                Print
              </Button>
              <Button
                onClick={downloadPdf}
                leftSection={<IconDownload size={16} />}
                color="#105476"
              >
                Download PDF
              </Button>
              <Button
                onClick={() => options.onSendEmail(pdfBlob, fileName)}
                leftSection={<IconSend size={16} />}
                color="#105476"
                variant="outline"
              >
                Send Email
              </Button>
            </Group>
          </>
        ) : (
          <Center h="100%">
            <Stack align="center">
              <Loader size="lg" color="#105476" />
              <Text c="dimmed">Generating PDF preview...</Text>
            </Stack>
          </Center>
        )}
      </Stack>
    </Modal>
  );

  return {
    enabled: housingId != null,
    openPreview,
    modal,
  };
}
