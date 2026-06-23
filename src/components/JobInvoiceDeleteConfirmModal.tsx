import { Button, Group, Modal, Text } from "@mantine/core";

export type JobInvoiceDeleteConfirmModalProps = {
  opened: boolean;
  loading?: boolean;
  title?: string;
  message?: string;
  onClose: () => void;
  onConfirm: () => void;
};

export function JobInvoiceDeleteConfirmModal({
  opened,
  loading,
  title = "Delete invoice",
  message = "Are you sure you want to delete this invoice? This action cannot be undone.",
  onClose,
  onConfirm,
}: JobInvoiceDeleteConfirmModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Text fw={600} size="md" style={{ fontFamily: "Inter" }}>
          {title}
        </Text>
      }
      centered
      zIndex={400}
    >
      <Text size="sm" c="dimmed" mb="md" style={{ fontFamily: "Inter" }}>
        {message}
      </Text>
      <Group justify="flex-end" gap="xs">
        <Button variant="subtle" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button color="red" onClick={onConfirm} loading={loading}>
          Yes, delete
        </Button>
      </Group>
    </Modal>
  );
}
