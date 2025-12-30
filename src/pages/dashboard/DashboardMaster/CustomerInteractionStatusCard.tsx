import { Card, Text, Stack, Box, Loader, Center, Grid } from "@mantine/core";

interface CustomerInteractionData {
  gain: number;
  gainSalesperson: number;
  notVisited: number;
  notVisitedSalesperson: number;
  lost: number;
  lostSalesperson: number;
}

interface CustomerInteractionStatusCardProps {
  data: CustomerInteractionData | null;
  loading: boolean;
  onViewAll?: () => void;
}

const CustomerInteractionStatusCard = ({
  data,
  loading,
}: CustomerInteractionStatusCardProps) => {
  return (
    <Box>
      {loading ? (
        <Center h={200}>
          <Loader size="lg" color="#105476" />
        </Center>
      ) : (
        <Grid gutter="lg">
          {/* Gain Section */}
          <Grid.Col span={4}>
            <Card
              shadow="sm"
              p="md"
              radius="md"
              style={{
                cursor: "pointer",
                background: "#F5FAF5",
                border: "1px solid transparent",
                borderImage: "linear-gradient(135deg, #EFFFED, #ECFCEB) 1",
                transition: "all 0.3s ease",
                height: "100px",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow =
                  "0 4px 12px rgba(48, 128, 40, 0.15)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "";
              }}
            >
              <Stack align="flex-start" gap={4} justify="center" h="100%">
                <Text size="xs" c="dimmed" fw={500}>
                  Gain
                </Text>
                <Text
                  size="2rem"
                  fw={700}
                  c="#308028"
                  style={{ lineHeight: 1 }}
                >
                  {data?.gain || 0}
                </Text>
                <Text size="xs" c="dimmed" mt={2}>
                  Salesperson: {data?.gainSalesperson || 0}
                </Text>
              </Stack>
            </Card>
          </Grid.Col>

          {/* Not Visited Section */}
          <Grid.Col span={4}>
            <Card
              shadow="sm"
              p="md"
              radius="md"
              style={{
                cursor: "pointer",
                background: "#FAF8F5",
                border: "1px solid transparent",
                borderImage: "linear-gradient(135deg, #FFFAED, #FCF7EB) 1",
                transition: "all 0.3s ease",
                height: "100px",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow =
                  "0 4px 12px rgba(181, 137, 27, 0.15)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "";
              }}
            >
              <Stack align="flex-start" gap={4} justify="center" h="100%">
                <Text size="xs" c="dimmed" fw={500}>
                  Not Visited
                </Text>
                <Text
                  size="2rem"
                  fw={700}
                  c="#B5891B"
                  style={{ lineHeight: 1 }}
                >
                  {data?.notVisited || 0}
                </Text>
                <Text size="xs" c="dimmed" mt={2}>
                  Salesperson: {data?.notVisitedSalesperson || 0}
                </Text>
              </Stack>
            </Card>
          </Grid.Col>

          {/* Lost Section */}
          <Grid.Col span={4}>
            <Card
              shadow="sm"
              p="md"
              radius="md"
              style={{
                cursor: "pointer",
                background: "#FAF5F5",
                border: "1px solid transparent",
                borderImage: "linear-gradient(135deg, #FFEDEF, #FFEDEF) 1",
                transition: "all 0.3s ease",
                height: "100px",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow =
                  "0 4px 12px rgba(138, 0, 13, 0.15)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "";
              }}
            >
              <Stack align="flex-start" gap={4} justify="center" h="100%">
                <Text size="xs" c="dimmed" fw={500}>
                  Lost
                </Text>
                <Text
                  size="2rem"
                  fw={700}
                  c="#8A000D"
                  style={{ lineHeight: 1 }}
                >
                  {data?.lost || 0}
                </Text>
                <Text size="xs" c="dimmed" mt={2}>
                  Salesperson: {data?.lostSalesperson || 0}
                </Text>
              </Stack>
            </Card>
          </Grid.Col>
        </Grid>
      )}
    </Box>
  );
};

export default CustomerInteractionStatusCard;
