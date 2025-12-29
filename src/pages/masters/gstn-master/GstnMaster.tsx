import { Button, Card, Group, Text, TextInput } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { useState } from "react";
import { ToastNotification } from "../../../components";

export default function GstnMaster() {
  const [gstNumber, setGstNumber] = useState("");

  const handleGetClick = () => {
    ToastNotification({
      type: "error",
      message: "No response from GST server",
    });
  };

  return (
    <Card shadow="sm" padding="lg" radius="md">
      <Text size="md" fw={600} mb="md">
        Link with GST Number
      </Text>

      <Group align="flex-end" gap="sm" mt="lg">
        <TextInput
          label="GST Number"
          placeholder="Enter GST Number"
          value={gstNumber}
          onChange={(e) => setGstNumber(e.target.value)}
          style={{ flex: 1, maxWidth: 400 }}
          size="sm"
        />
        <Button
          color="#105476"
          leftSection={<IconSearch size={16} />}
          size="sm"
          onClick={handleGetClick}
        >
          Get
        </Button>
      </Group>
    </Card>
  );
}
