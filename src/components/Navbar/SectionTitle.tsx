import { Text, useMantineTheme } from "@mantine/core";

export const SectionTitle = ({ title }: { title: string }) => {
  const theme = useMantineTheme();
  return (
    <Text
      size="xs"
      px={6}
      py={4}
      fw={400}
      style={{
        color: "#A1A4AA",
        textTransform: "uppercase",
        fontSize: "12px",
      }}
    >
      {title}
    </Text>
  );
};
