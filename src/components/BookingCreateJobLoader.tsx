import { Box, Center, Loader, Stack, Text } from "@mantine/core";

type BookingCreateJobLoaderProps = {
  active: boolean;
  message?: string;
};

/** Full-page overlay while booking → job-create API runs and navigation to job edit begins. */
export function BookingCreateJobLoader({
  active,
  message = "Creating job and opening job details…",
}: BookingCreateJobLoaderProps) {
  if (!active) return null;

  return (
    <Box
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(255, 255, 255, 0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
      }}
    >
      <Center>
        <Stack align="center" gap="md">
          <Loader size="lg" color="#105476" />
          <Text size="sm" fw={500} c="#105476">
            {message}
          </Text>
        </Stack>
      </Center>
    </Box>
  );
}
