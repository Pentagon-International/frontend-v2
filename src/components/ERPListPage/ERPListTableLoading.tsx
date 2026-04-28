import { Center, Loader, Stack, Text } from "@mantine/core";
import type { ErpListTheme } from "./erpListTheme";
import { DEFAULT_ERP_LIST_THEME } from "./erpListTheme";

export interface ERPListTableLoadingProps {
  theme?: ErpListTheme;
  message?: string;
}

/** Centered loader inside the table card body (Air Export pattern). */
export function ERPListTableLoading({
  theme = DEFAULT_ERP_LIST_THEME,
  message = "Loading…",
}: ERPListTableLoadingProps) {
  return (
    <Center py={80} style={{ backgroundColor: theme.cardBg }}>
      <Stack align="center" gap="md">
        <Loader size="lg" color={theme.primary} />
        <Text c="dimmed" size="sm" style={{ fontFamily: theme.fontSans }}>
          {message}
        </Text>
      </Stack>
    </Center>
  );
}
