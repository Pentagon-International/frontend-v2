"use client";
import { Group, Text, Select, ActionIcon } from "@mantine/core";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";

interface PaginationBarProps {
  pageSize: number;
  currentPage: number;
  totalRecords: number;
  onPageSizeChange: (size: number) => void;
  onPageChange: (page: number) => void;
  pageSizeOptions?: string[];
}

export default function PaginationBar({
  pageSize,
  currentPage,
  totalRecords,
  onPageSizeChange,
  onPageChange,
  pageSizeOptions = ["10", "25", "50"],
}: PaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

  const rangeText = totalRecords === 0
    ? "0–0 of 0"
    : `${(currentPage - 1) * pageSize + 1}–${Math.min(
        currentPage * pageSize,
        totalRecords
      )} of ${totalRecords}`;

  return (
    <Group
      w="100%"
      justify="space-between"
      align="center"
      p="xs"
      wrap="nowrap"
      pt="md"
    >
      {/* Rows per page + range */}
      <Group gap="sm" align="center" wrap="nowrap">
        <Text size="sm" c="dimmed">
          Rows per page
        </Text>

        <Select
          size="xs"
          data={pageSizeOptions}
          value={String(pageSize)}
          onChange={(value) => {
            if (!value) return;
            onPageSizeChange(Number(value));
          }}
          w={110}
          styles={{ input: { fontSize: 12, height: 30 } } as any}
        />

        <Text size="sm" c="dimmed">
          {rangeText}
        </Text>
      </Group>

      {/* Navigation */}
      <Group gap="xs" align="center" wrap="nowrap" pr={50}>
        <ActionIcon
          variant="default"
          size="sm"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
        >
          <IconChevronLeft size={16} />
        </ActionIcon>

        <Text size="sm" ta="center" style={{ width: 26 }}>
          {currentPage}
        </Text>

        <Text size="sm" c="dimmed">
          of {totalPages}
        </Text>

        <ActionIcon
          variant="default"
          size="sm"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
        >
          <IconChevronRight size={16} />
        </ActionIcon>
      </Group>
    </Group>
  );
}
