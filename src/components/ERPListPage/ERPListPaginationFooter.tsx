import { useMemo } from "react";
import { ActionIcon, Box, Group, Select, Text } from "@mantine/core";
import {
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
} from "@tabler/icons-react";
import type { ErpListTheme } from "./erpListTheme";
import { DEFAULT_ERP_LIST_THEME } from "./erpListTheme";
import { erpPaginationSelectStyles } from "./erpListMantineStyles";

export interface ERPListPaginationFooterProps {
  theme?: ErpListTheme;
  totalRecords: number;
  /** 0-based page index */
  pageIndex: number;
  pageSize: number;
  onPageIndexChange: (index: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: string[];
  /** Max numbered page buttons (Air Export uses 5). */
  maxPageButtons?: number;
  /** Mantine Select `classNames` (e.g. scope dropdown to Geist). */
  selectClassNames?: Partial<Record<"dropdown" | "option", string>>;
}

/**
 * Table card footer: range text, rows-per-page `Select`, first/prev/numbered/next/last (Air Export).
 */
export function ERPListPaginationFooter({
  theme = DEFAULT_ERP_LIST_THEME,
  totalRecords,
  pageIndex,
  pageSize,
  onPageIndexChange,
  onPageSizeChange,
  pageSizeOptions = ["10", "15", "25", "50"],
  maxPageButtons = 5,
  selectClassNames,
}: ERPListPaginationFooterProps) {
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

  const pageButtonIndices = useMemo(() => {
    const n = Math.min(maxPageButtons, totalPages);
    return Array.from({ length: n }, (_, i) => {
      if (totalPages <= maxPageButtons) return i;
      if (pageIndex < 3) return i;
      if (pageIndex > totalPages - 4) return totalPages - maxPageButtons + i;
      return pageIndex - 2 + i;
    });
  }, [totalPages, pageIndex, maxPageButtons]);

  const { border, muted, fg, cardBg } = theme;

  return (
    <Box px="md" py={10} style={{ borderTop: `1px solid ${border}`, backgroundColor: cardBg }}>
      <Group justify="space-between" wrap="wrap" gap="md">
        <Group gap="md" wrap="wrap" align="center">
          <Text size="sm" c={muted}>
            Showing{" "}
            <Text span fw={600} c={fg}>
              {totalRecords === 0 ? 0 : pageIndex * pageSize + 1}
            </Text>{" "}
            to{" "}
            <Text span fw={600} c={fg}>
              {Math.min((pageIndex + 1) * pageSize, totalRecords)}
            </Text>{" "}
            of{" "}
            <Text span fw={600} c={fg}>
              {totalRecords}
            </Text>{" "}
            results
          </Text>
          <Group gap={6} align="center">
            <Text size="sm" c={muted}>
              Rows:
            </Text>
            <Select
              size="xs"
              w={68}
              value={String(pageSize)}
              onChange={(v) => {
                if (v) {
                  onPageSizeChange(Number(v));
                  onPageIndexChange(0);
                }
              }}
              data={pageSizeOptions}
              classNames={selectClassNames}
              styles={erpPaginationSelectStyles(theme)}
            />
          </Group>
        </Group>
        <Group gap={4} wrap="nowrap">
          <ActionIcon
            variant="default"
            size="md"
            onClick={() => onPageIndexChange(0)}
            disabled={pageIndex === 0}
          >
            <IconChevronsLeft size={16} />
          </ActionIcon>
          <ActionIcon
            variant="default"
            size="md"
            onClick={() => onPageIndexChange(Math.max(0, pageIndex - 1))}
            disabled={pageIndex === 0}
          >
            <IconChevronLeft size={16} />
          </ActionIcon>
          <Group gap={4} mx={4}>
            {pageButtonIndices.map((pNum) => (
              <ActionIcon
                key={pNum}
                size="md"
                variant={pageIndex === pNum ? "filled" : "default"}
                color={pageIndex === pNum ? "blue" : "gray"}
                onClick={() => onPageIndexChange(pNum)}
              >
                <Text size="xs">{pNum + 1}</Text>
              </ActionIcon>
            ))}
          </Group>
          <ActionIcon
            variant="default"
            size="md"
            onClick={() => onPageIndexChange(Math.min(totalPages - 1, pageIndex + 1))}
            disabled={pageIndex >= totalPages - 1}
          >
            <IconChevronRight size={16} />
          </ActionIcon>
          <ActionIcon
            variant="default"
            size="md"
            onClick={() => onPageIndexChange(totalPages - 1)}
            disabled={pageIndex >= totalPages - 1}
          >
            <IconChevronsRight size={16} />
          </ActionIcon>
        </Group>
      </Group>
    </Box>
  );
}
