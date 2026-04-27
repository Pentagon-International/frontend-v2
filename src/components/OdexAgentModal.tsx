import { useState } from "react";
import {
  Modal,
  Button,
  Text,
  Stack,
  Group,
  Badge,
  Divider,
  List,
  ThemeIcon,
  CopyButton,
  Box,
  Alert,
} from "@mantine/core";
import { detectOS, OS_DISPLAY } from "../utils/detectOs";
import { apiCallProtected } from "../api/axios";

interface Props {
  opened: boolean;
  onClose: () => void;
  mode: "not_installed" | "not_running";
  agentToken?: string;
  serverUrl?: string;
  onAgentReady?: () => void;
}

const INSTALL_STEPS: Record<string, string[]> = {
  windows: [
    "Extract the downloaded ZIP file",
    'Double-click "install_windows.bat"',
    "Look for the O icon in your system tray (bottom-right near clock)",
    "Right-click the icon → Setup / Configure",
    "Paste the Agent Token and Server URL below",
    'Click "Save & Connect"',
    'Come back here and click "Check Connection"',
  ],
  mac: [
    "Extract the downloaded ZIP file",
    'Double-click "install_mac.sh"',
    "Look for the O icon in your menu bar (top-right)",
    "Click the icon → Setup / Configure",
    "Paste the Agent Token and Server URL below",
    'Click "Save & Connect"',
    'Come back here and click "Check Connection"',
  ],
  linux: [
    "Extract: tar -xzf OdexAgent-Linux.tar.gz",
    "Run: bash install_linux.sh",
    "Look for the O icon in your system tray",
    "Right-click → Setup / Configure",
    "Paste the Agent Token and Server URL below",
    'Click "Save & Connect"',
    'Come back here and click "Check Connection"',
  ],
  unknown: [
    "Extract the downloaded file",
    "Run the installer script inside",
    "Look for the O icon in your system tray",
    "Open Setup and paste the token below",
    'Click "Save & Connect"',
  ],
};

export default function OdexAgentDownloadModal({
  opened,
  onClose,
  mode,
  agentToken,
  serverUrl,
  onAgentReady,
}: Props) {
  const os = detectOS();
  const osInfo = OS_DISPLAY[os];
  const steps = INSTALL_STEPS[os] || INSTALL_STEPS.unknown;

  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<
    "connected" | "not_yet" | null
  >(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      const response = await apiCallProtected.get(
        `/job-create/odex/agent/download/?os=${os}`,
        { responseType: "blob" },
      );

      // Create download link
      const blob = new Blob([response.data ?? response]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `OdexAgent-${osInfo.label}${osInfo.ext}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setDownloaded(true);
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ??
        err?.response?.data?.hint ??
        "Download failed. Please contact your IT admin.";
      setDownloadError(msg);
    } finally {
      setDownloading(false);
    }
  };

  const handleCheckConnection = async () => {
    setChecking(true);
    setCheckResult(null);
    try {
      const res = await apiCallProtected.get("/job-create/odex/agent/status/");
      const status = String((res as any)?.data?.status ?? (res as any)?.status ?? "")
        .trim()
        .toLowerCase();

      if (status === "online") {
        setCheckResult("connected");
        setTimeout(() => {
          onClose();
          onAgentReady?.();
        }, 1500);
      } else {
        // "registered" or "not_installed" — not good enough
        setCheckResult("not_yet");
      }
    } catch {
      setCheckResult("not_yet");
    } finally {
      setChecking(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <Text fw={700} size="lg">
            Odex Agent Required
          </Text>
          <Badge color="orange" variant="light" size="sm">
            One-time setup
          </Badge>
        </Group>
      }
      size="lg"
      centered
      closeOnClickOutside={false}
    >
      {mode === "not_running" ? (
        // ── Not running UI ─────────────────────────────────────
        <Stack gap="md">
          <Alert
            color="orange"
            variant="light"
            title="Agent installed but not running"
          >
            Your Odex Agent is installed on this machine but is currently not
            running. Please start it to continue.
          </Alert>

          <Text size="sm" fw={600}>
            How to start the agent:
          </Text>
          <List size="sm" spacing="xs">
            <List.Item>
              Windows: Look for OdexAgent in your Start Menu or double-click
              OdexAgent.exe
            </List.Item>
            <List.Item>
              The O icon should appear in your system tray (bottom-right near
              clock)
            </List.Item>
            <List.Item>
              Once the icon appears, click "Check Connection" below
            </List.Item>
          </List>

          <Divider />

          <Button
            onClick={handleCheckConnection}
            loading={checking}
            color={
              checkResult === "connected"
                ? "green"
                : checkResult === "not_yet"
                  ? "orange"
                  : "teal"
            }
            size="md"
          >
            {checking
              ? "Checking..."
              : checkResult === "connected"
                ? "🟢 Agent Connected! Proceeding..."
                : checkResult === "not_yet"
                  ? "⚠ Still not running — try again"
                  : "✅ I've started it — Check Connection"}
          </Button>

          {checkResult === "not_yet" && (
            <Alert color="orange" variant="light">
              Agent still not detected. Make sure the OdexAgent icon is visible
              in your system tray.
            </Alert>
          )}
        </Stack>
      ) : (
        <Stack gap="md">
          {/* OS Detection */}
          <Alert color="blue" variant="light">
            <Group gap="xs">
              <Text size="sm">Detected OS:</Text>
              <Text size="sm" fw={700}>
                {osInfo.icon} {osInfo.label}
              </Text>
            </Group>
          </Alert>

          {/* What is this */}
          <Text size="sm" c="dimmed">
            A small background agent needs to be installed on your computer
            once. It runs silently in your system tray and only activates when
            you push data to Odex.
          </Text>

          <Divider label="Step 1 — Download" labelPosition="left" />

          {/* Download Button */}
          <Button
            onClick={handleDownload}
            loading={downloading}
            color={downloaded ? "green" : "blue"}
            size="md"
            leftSection={<span>{downloaded ? "✓" : "⬇"}</span>}
            disabled={os === "unknown"}
          >
            {downloading
              ? "Preparing download..."
              : downloaded
                ? `Downloaded OdexAgent-${osInfo.label}${osInfo.ext}`
                : `Download Odex Agent for ${osInfo.label} (${osInfo.ext})`}
          </Button>

          {downloadError && (
            <Alert color="red" variant="light" title="Download failed">
              {downloadError}
            </Alert>
          )}

          {/* Install Steps — show after download */}
          {downloaded && (
            <>
              <Divider label="Step 2 — Install" labelPosition="left" />

              <List
                size="sm"
                spacing="xs"
                icon={
                  <ThemeIcon color="blue" size={20} radius="xl">
                    <span style={{ fontSize: 10 }}>✓</span>
                  </ThemeIcon>
                }
              >
                {steps.map((step, i) => (
                  <List.Item key={i}>{step}</List.Item>
                ))}
              </List>

              {/* Token + Server URL */}
              {(agentToken || serverUrl) && (
                <>
                  <Divider
                    label="Step 3 — Enter these in Agent Setup"
                    labelPosition="left"
                  />
                  <Stack gap="xs">
                    {serverUrl && (
                      <Box>
                        <Text size="xs" fw={600} c="dimmed" mb={4}>
                          SERVER URL
                        </Text>
                        <Group gap="xs">
                          <Box
                            p="xs"
                            style={{
                              background: "var(--mantine-color-gray-1)",
                              borderRadius: 6,
                              flex: 1,
                              fontFamily: "monospace",
                              fontSize: 12,
                              wordBreak: "break-all",
                            }}
                          >
                            {serverUrl}
                          </Box>
                          <CopyButton value={serverUrl}>
                            {({ copied, copy }) => (
                              <Button
                                size="xs"
                                variant="light"
                                color={copied ? "green" : "blue"}
                                onClick={copy}
                              >
                                {copied ? "Copied!" : "Copy"}
                              </Button>
                            )}
                          </CopyButton>
                        </Group>
                      </Box>
                    )}

                    {agentToken && (
                      <Box>
                        <Text size="xs" fw={600} c="dimmed" mb={4}>
                          AGENT TOKEN
                        </Text>
                        <Group gap="xs">
                          <Box
                            p="xs"
                            style={{
                              background: "var(--mantine-color-gray-1)",
                              borderRadius: 6,
                              flex: 1,
                              fontFamily: "monospace",
                              fontSize: 12,
                              wordBreak: "break-all",
                            }}
                          >
                            {agentToken}
                          </Box>
                          <CopyButton value={agentToken}>
                            {({ copied, copy }) => (
                              <Button
                                size="xs"
                                variant="light"
                                color={copied ? "green" : "blue"}
                                onClick={copy}
                              >
                                {copied ? "Copied!" : "Copy"}
                              </Button>
                            )}
                          </CopyButton>
                        </Group>
                      </Box>
                    )}
                  </Stack>
                </>
              )}

              <Divider
                label="Step 4 — Verify Connection"
                labelPosition="left"
              />

              {/* Check Connection */}
              <Button
                onClick={handleCheckConnection}
                loading={checking}
                color={
                  checkResult === "connected"
                    ? "green"
                    : checkResult === "not_yet"
                      ? "orange"
                      : "teal"
                }
                variant={checkResult ? "filled" : "outline"}
                size="md"
              >
                {checking
                  ? "Checking connection..."
                  : checkResult === "connected"
                    ? "🟢 Agent Connected! Proceeding..."
                    : checkResult === "not_yet"
                      ? "⚠ Not connected yet — try again"
                      : "✅ I've installed it — Check Connection"}
              </Button>

              {checkResult === "not_yet" && (
                <Alert color="orange" variant="light">
                  Agent not detected yet. Make sure it's running and you've
                  saved the token in the Setup window.
                </Alert>
              )}
            </>
          )}
        </Stack>
      )}
    </Modal>
  );
}
