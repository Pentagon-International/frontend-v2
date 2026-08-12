import { useCallback, useMemo, useState } from "react";
import {
  Box,
  Loader,
  Modal,
  Stack,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { useNavigate } from "react-router-dom";
import { ToastNotification } from "../components";
import {
  type GlobalSearchItem,
  type GlobalSearchNavigateOptions,
  globalSearchItemsFromResponse,
  navigateFromGlobalSearchDocumentNo,
  openGlobalSearchItem,
  runGlobalSearchQuery,
} from "../utils/globalSearchNavigation";

type UseGlobalSearchDocumentNavigationArgs = {
  getOptions?: () => GlobalSearchNavigateOptions;
};

/** Styles for a read-only adjustments Document no field that should remain clickable. */
export const clickableAdjustmentDocumentNoStyles = {
  root: {
    opacity: 1,
    pointerEvents: "auto" as const,
  },
  input: {
    fontSize: "13px",
    fontFamily: "Inter",
    height: "36px",
    backgroundColor: "#f5f5f5",
    opacity: 1,
    pointerEvents: "auto" as const,
    color: "#105476",
    textDecoration: "underline",
    cursor: "pointer",
  },
};

export function useGlobalSearchDocumentNavigation({
  getOptions,
}: UseGlobalSearchDocumentNavigationArgs = {}) {
  const navigate = useNavigate();
  const [documentNavLoading, setDocumentNavLoading] = useState(false);
  const [documentSearchModalOpen, setDocumentSearchModalOpen] = useState(false);
  const [documentSearchResults, setDocumentSearchResults] = useState<
    GlobalSearchItem[]
  >([]);

  const resolveOptions = useCallback(
    () => getOptions?.() ?? {},
    [getOptions],
  );

  const onDocumentNoClick = useCallback(
    async (documentNo: string) => {
      const query = documentNo.trim();
      if (!query || documentNavLoading) return;

      setDocumentNavLoading(true);
      try {
        const result = await navigateFromGlobalSearchDocumentNo(
          navigate,
          query,
          resolveOptions(),
        );

        if (result === "navigated") return;

        if (result === "multiple") {
          const normalized = await runGlobalSearchQuery(query);
          const items = globalSearchItemsFromResponse(normalized);
          setDocumentSearchResults(items);
          setDocumentSearchModalOpen(true);
          return;
        }

        if (result === "not_found") {
          ToastNotification({
            type: "warning",
            message: "No document found for this document number.",
          });
          return;
        }

        ToastNotification({
          type: "error",
          message: "Failed to open document. Please try again.",
        });
      } finally {
        setDocumentNavLoading(false);
      }
    },
    [documentNavLoading, navigate, resolveOptions],
  );

  const handleDocumentSearchResultPick = useCallback(
    async (item: GlobalSearchItem) => {
      setDocumentSearchModalOpen(false);
      setDocumentNavLoading(true);
      try {
        const ok = await openGlobalSearchItem(
          navigate,
          item,
          resolveOptions(),
        );
        if (!ok) {
          ToastNotification({
            type: "warning",
            message: "Navigation is not configured for this document type.",
          });
        }
      } catch {
        ToastNotification({
          type: "error",
          message: "Failed to open document. Please try again.",
        });
      } finally {
        setDocumentNavLoading(false);
        setDocumentSearchResults([]);
      }
    },
    [navigate, resolveOptions],
  );

  const documentNavUi = useMemo(
    () => (
      <>
        {documentNavLoading && (
          <Box
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(255,255,255,0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
            }}
          >
            <Stack align="center" gap="md">
              <Loader size="lg" color="#105476" />
              <Text size="sm" c="dimmed" style={{ fontFamily: "Inter" }}>
                Opening document...
              </Text>
            </Stack>
          </Box>
        )}

        <Modal
          opened={documentSearchModalOpen}
          onClose={() => {
            setDocumentSearchModalOpen(false);
            setDocumentSearchResults([]);
          }}
          title="Select document"
          centered
        >
          <Stack gap="xs">
            {documentSearchResults.map((item) => {
              const key = `${item.module}-${item.sub_module ?? ""}-${item.id}`;
              const label =
                item.display_id ??
                item.primary_code ??
                item.id ??
                "Unknown document";
              return (
                <UnstyledButton
                  key={key}
                  onClick={() => void handleDocumentSearchResultPick(item)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid #E2E8F0",
                    textAlign: "left",
                  }}
                >
                  <Text size="sm" fw={600} style={{ fontFamily: "Inter" }}>
                    {label}
                  </Text>
                  <Text size="xs" c="dimmed" style={{ fontFamily: "Inter" }}>
                    {[item.module, item.sub_module].filter(Boolean).join(" / ")}
                  </Text>
                </UnstyledButton>
              );
            })}
          </Stack>
        </Modal>
      </>
    ),
    [
      documentNavLoading,
      documentSearchModalOpen,
      documentSearchResults,
      handleDocumentSearchResultPick,
    ],
  );

  return {
    onDocumentNoClick,
    documentNavLoading,
    documentNavUi,
  };
}
