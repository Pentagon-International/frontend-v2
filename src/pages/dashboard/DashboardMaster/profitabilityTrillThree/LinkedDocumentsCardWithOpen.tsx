import { Box, Button, Flex, Text } from "@mantine/core";
import { CARD_BG, INK, INK_3, INK_4, LINE, PAGE_BG } from "../profitabilityTrillOne/constants";
import { profitabilityTrillFonts } from "../profitabilityTrillOne/utils";
import type { JobLinkedDocument } from "../profitabilityTrillTwo/types";

type LinkedDocumentsCardWithOpenProps = {
  documents: JobLinkedDocument[];
  onOpenDocument?: (doc: JobLinkedDocument) => void;
};

/** Openable variant used by ProfitabilityTrillTwo — original LinkedDocumentsCard remains unchanged. */
export function LinkedDocumentsCardWithOpen({
  documents,
  onOpenDocument,
}: LinkedDocumentsCardWithOpenProps) {
  return (
    <Box
      style={{
        background: CARD_BG,
        border: `1px solid ${LINE}`,
        borderRadius: 10,
        overflow: "hidden",
        height: "100%",
      }}
    >
      <Box px={14} py={12} style={{ borderBottom: `1px solid ${LINE}` }}>
        <Text fw={600} fz={13} c={INK}>
          Linked Documents
        </Text>
      </Box>
      <Box p={12}>
        <Flex direction="column" gap={8}>
          {documents.map((doc) => (
            <Box
              key={`${doc.label}-${doc.id}`}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 100px 90px",
                gap: 10,
                alignItems: "center",
                padding: "8px 10px",
                background: PAGE_BG,
                borderRadius: 6,
              }}
            >
              <Box style={{ minWidth: 0 }}>
                <Text fz={12} fw={500} c={INK}>
                  {doc.label}
                </Text>
                <Text
                  fz={11}
                  c={INK_4}
                  mt={1}
                  style={{ fontFamily: profitabilityTrillFonts.mono }}
                >
                  {doc.id}
                </Text>
              </Box>
              <Text fz={11} c={INK_3} ta="right">
                {doc.date ?? ""}
              </Text>
              {doc.invoiceId ? (
                <Button
                  size="compact-xs"
                  variant="default"
                  onClick={() => onOpenDocument?.(doc)}
                  styles={{
                    root: {
                      height: 28,
                      fontSize: 11,
                      fontWeight: 500,
                      borderColor: LINE,
                      color: INK_3,
                      width: "100%",
                    },
                  }}
                >
                  {doc.actionLabel ?? "Open →"}
                </Button>
              ) : (
                <Text fz={10} c={INK_4} ta="right">
                  {doc.status ?? ""}
                </Text>
              )}
            </Box>
          ))}
        </Flex>
      </Box>
    </Box>
  );
}
