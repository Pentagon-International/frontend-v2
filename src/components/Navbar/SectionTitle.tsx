import { Text, useMantineTheme } from "@mantine/core";

export const SectionTitle = ({ title }: { title: string }) => {
  const theme = useMantineTheme();
  return (
    <Text
      size="xs"
      fw={600}
      style={{
        color: theme.colors.gray[7],
        textTransform: "uppercase",
        fontSize: "12px",
      }}
    >
      {title}
    </Text>
  );
};
