import type { CSSProperties, ReactNode } from "react";
import { Box } from "@mantine/core";

/** Shared Mantine Modal styles for Select Document (fixed header/footer, scroll middle). */
export const selectDocumentModalStyles = {
  title: { fontWeight: 600, color: "#105476" },
  content: {
    display: "flex",
    flexDirection: "column" as const,
    maxHeight: "85vh",
  },
  body: {
    position: "relative" as const,
    display: "flex",
    flexDirection: "column" as const,
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
  },
};

const scrollAreaStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  overflowX: "auto",
  paddingRight: 4,
  // Firefox — thicker than "thin"
  scrollbarWidth: "auto",
  scrollbarColor: "#7a97a8 #e6eef2",
};

type SelectDocumentModalLayoutProps = {
  toolbar: ReactNode;
  footer: ReactNode;
  children: ReactNode;
  /** Viewport height for the docs list region. */
  listMaxHeight?: string | number;
};

/**
 * Pins search/upload at top and Cancel/Select at bottom; only the
 * documents list scrolls (with a wider scrollbar for easier grabbing).
 */
export default function SelectDocumentModalLayout({
  toolbar,
  footer,
  children,
  listMaxHeight = "min(58vh, 560px)",
}: SelectDocumentModalLayoutProps) {
  return (
    <Box
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        maxHeight: "calc(85vh - 70px)",
      }}
    >
      <style>{`
        .select-document-modal-scroll::-webkit-scrollbar {
          width: 14px;
          height: 14px;
        }
        .select-document-modal-scroll::-webkit-scrollbar-track {
          background: #e6eef2;
          border-radius: 8px;
        }
        .select-document-modal-scroll::-webkit-scrollbar-thumb {
          background: #7a97a8;
          border-radius: 8px;
          border: 3px solid #e6eef2;
        }
        .select-document-modal-scroll::-webkit-scrollbar-thumb:hover {
          background: #105476;
        }
      `}</style>

      <Box
        style={{
          flexShrink: 0,
          paddingBottom: 10,
          borderBottom: "1px solid #e6eef2",
          background: "#fff",
          zIndex: 2,
        }}
      >
        {toolbar}
      </Box>

      <Box
        className="select-document-modal-scroll"
        style={{
          ...scrollAreaStyle,
          maxHeight: listMaxHeight,
          marginTop: 10,
          marginBottom: 10,
        }}
      >
        {children}
      </Box>

      <Box
        style={{
          flexShrink: 0,
          paddingTop: 12,
          borderTop: "1px solid #e6eef2",
          background: "#fff",
          zIndex: 2,
        }}
      >
        {footer}
      </Box>
    </Box>
  );
}
