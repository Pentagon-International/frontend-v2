import { Group, Text, UnstyledButton } from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";

type UnpostedDocumentDeleteMenuRowProps = {
  disabled?: boolean;
  onClick: () => void;
  fontFamily?: string;
};

/** ERP list menu row matching UnpostedDocumentsList delete styling. */
export function UnpostedDocumentDeleteMenuRow({
  disabled,
  onClick,
  fontFamily = "Inter",
}: UnpostedDocumentDeleteMenuRowProps) {
  return (
    <UnstyledButton disabled={disabled} onClick={onClick}>
      <Group gap="sm">
        <IconTrash size={16} color="#C92A2A" />
        <Text size="sm" style={{ fontFamily }} c="#C92A2A">
          Delete
        </Text>
      </Group>
    </UnstyledButton>
  );
}
