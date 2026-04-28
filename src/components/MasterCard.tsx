import { Box, Flex, Text, UnstyledButton } from "@mantine/core";
import { ReactNode, useState } from "react";

interface MasterCardProps {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
}

export default function MasterCard({ icon, label, onClick }: MasterCardProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <UnstyledButton
      onClick={onClick}
      style={{ width: "100%" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Flex
        align="center"
        gap="md"
        p="sm"
        px="md"
        style={{
          border: `1px solid ${hovered ? "#BFDBFE" : "#E2E8F0"}`,
          borderRadius: "10px",
          width: "100%",
          backgroundColor: hovered ? "#EFF6FF" : "#ffffff",
          boxShadow: hovered
            ? "0 4px 12px rgba(37, 99, 235, 0.12)"
            : "0 1px 2px rgba(15, 23, 42, 0.04)",
          transition: "all 0.18s ease",
          transform: hovered ? "translateY(-1px)" : "translateY(0)",
        }}
      >
        <Box
          style={{
            backgroundColor: hovered ? "#DBEAFE" : "#F1F5FF",
            padding: 10,
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "background-color 0.18s ease",
          }}
        >
          {icon}
        </Box>
        <Text
          size="sm"
          fw={hovered ? 600 : 500}
          style={{ color: hovered ? "#1D4ED8" : "#334155", lineHeight: 1.4 }}
        >
          {label}
        </Text>
      </Flex>
    </UnstyledButton>
  );
}
