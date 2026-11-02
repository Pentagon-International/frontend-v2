import { Box, Stack, Text } from "@mantine/core";

/** User-readable error list shown at the top of automation preview. */
export function AutomationPreviewErrorBanner({
  messages,
  title = "Error details",
}: {
  messages: string[];
  title?: string;
}) {
  if (!messages.length) return null;

  return (
    <Box
      p="sm"
      style={{
        background: "#fff5f5",
        border: "1px solid #ffc9c9",
        borderRadius: 8,
      }}
    >
      <Text size="xs" fw={600} c="red" mb={4}>
        {title}
      </Text>
      {messages.length === 1 ? (
        <Text size="sm" c="red" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {messages[0]}
        </Text>
      ) : (
        <Stack gap={4}>
          {messages.map((message) => (
            <Text
              key={message}
              size="sm"
              c="red"
              style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
            >
              • {message}
            </Text>
          ))}
        </Stack>
      )}
    </Box>
  );
}
