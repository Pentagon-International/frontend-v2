import { Button, Group, Modal, Text } from "@mantine/core";

export type CanShowChargesModalProps = {
  opened: boolean;
  onClose: () => void;
  onConfirm: (showCharges: boolean) => void;
};

export function CanShowChargesModal({
  opened,
  onClose,
  onConfirm,
}: CanShowChargesModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Text fw={600} size="md" style={{ fontFamily: "Inter" }}>
          Show charges
        </Text>
      }
      centered
      zIndex={400}
    >
      <Text size="sm" c="dimmed" mb="md" style={{ fontFamily: "Inter" }}>
        Do you want to include charges in the Cargo Arrival Notice PDF?
      </Text>
      <Group justify="flex-end" gap="xs">
        <Button variant="outline" onClick={() => onConfirm(false)}>
          No
        </Button>
        <Button color="#105476" onClick={() => onConfirm(true)}>
          Yes
        </Button>
      </Group>
    </Modal>
  );
}
