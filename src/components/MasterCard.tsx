import { Box, Flex, Group, Text, UnstyledButton } from "@mantine/core";
import { ReactNode, useState } from "react";

interface MasterCardProps {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
}

export default function MasterCard({ icon, label, onClick }: MasterCardProps) {
  const [hovered, setHovered] = useState(false);
  return (
    // <UnstyledButton onClick={onClick} style={{ width: 140 }}>
    //   <Group
    //     p="sm"
    //     px="md"
    //     style={{
    //       border: "1px solid #E3E8F0",
    //       borderRadius: "12px",
    //       width: 200,
    //       backgroundColor: "white",
    //     }}
    //   >
    //     <Flex align="center" gap="md">
    //       <Box
    //         style={{
    //           backgroundColor: "#F1F5FF",
    //           padding: 10,
    //           borderRadius: "8px",
    //           display: "flex",
    //           alignItems: "center",
    //           justifyContent: "center",
    //         }}
    //       >
    //         {icon}
    //       </Box>
    //       <Text size="sm" fw={500} c="#2A2E34">
    //         {label}
    //       </Text>
    //     </Flex>
    //   </Group>
    // </UnstyledButton>
    <UnstyledButton
      onClick={onClick}
      style={{ width: "100%" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Group
        p="sm"
        px="md"
        style={{
          border: `1px solid ${hovered ? "#105476" : "#E3E8F0"}`,
          borderRadius: "12px",
          width: "100%",
          backgroundColor: hovered ? "#EEF0FA" : "white",
          transition: "all 0.2s ease-in-out",
        }}
      >
        <Flex align="center" gap="md">
          <Box
            style={{
              backgroundColor: hovered ? "#E6EDF7" : "#F1F5FF",
              padding: 10,
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s ease-in-out",
            }}
          >
            {icon}
          </Box>
          <Text
            size="sm"
            fw={hovered ? 600 : 500}
            c={hovered ? "#2A2E34" : "#2A2E34"}
          >
            {label}
          </Text>
        </Flex>
      </Group>
    </UnstyledButton>
  );
}
