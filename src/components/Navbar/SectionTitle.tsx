import { Text } from "@mantine/core";

export const SectionTitle = ({ title }: { title: string }) => {
  return (
    <Text
      px={6}
      py={4}
      style={{
        color: "#3D5470",
        textTransform: "uppercase",
        fontSize: "10.5px",
        fontWeight: 600,
        letterSpacing: "0.09em",
      }}
    >
      {title}
    </Text>
  );
};
