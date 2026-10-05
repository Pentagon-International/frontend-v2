import { Button, Group, Modal, Text } from "@mantine/core";

type Props = {
  opened: boolean;
  loading?: boolean;
  count: number;
  onClose: () => void;
  onConfirm: () => void;
};

export default function ApprovePaymentsConfirmModal({
  opened,
  loading,
  count,
  onClose,
  onConfirm,
}: Props) {
  const label = count === 1 ? "1 payment" : `${count} payments`;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Text fw={600} size="md" style={{ fontFamily: "'Geist', sans-serif" }}>
          Approve payment{count === 1 ? "" : "s"}
        </Text>
      }
      centered
      zIndex={400}
    >
      <Text
        size="sm"
        c="dimmed"
        mb="md"
        style={{ fontFamily: "'Geist', sans-serif" }}
      >
        Are you sure you want to approve {label}? This will mark the selected
        POSTED payment{count === 1 ? "" : "s"} as approved.
      </Text>
      <Group justify="flex-end" gap="xs">
        <Button variant="subtle" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button color="teal" onClick={onConfirm} loading={loading}>
          Approve
        </Button>
      </Group>
    </Modal>
  );
}
