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
  onGainClick?: () => void;
  onLostClick?: () => void;
  onNotVisitedClick?: () => void;
}

const CustomerInteractionStatusCard = ({
  data,
  loading,
  onGainClick,
  onLostClick,
  onNotVisitedClick,
}: CustomerInteractionStatusCardProps) => {
  return (
    <Box>
      {loading ? (
        <Center h={200}>
          <Loader size="lg" color="#2563EB" />
        </Center>
      ) : (
        <Grid gutter="md">
          {/* Gain */}
          <Grid.Col span={4}>
            <Card
              shadow="xs"
              p="md"
              radius="md"
              style={{
                cursor: "pointer",
                background: "linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)",
                border: "1px solid #BBF7D0",
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
                height: "88px",
              }}
              onClick={onGainClick}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 6px 16px rgba(22, 163, 74, 0.18)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "";
              }}
            >
              <Stack align="flex-start" gap={3} justify="center" h="100%">
                <Text style={{ fontSize: "11px", color: "#64748B", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Gain
                </Text>
                <Text style={{ fontSize: "1.6rem", fontWeight: 700, color: "#16A34A", lineHeight: 1 }}>
                  {data?.gain || 0}
                </Text>
                <Text style={{ fontSize: "11px", color: "#86EFAC" }}>
                  Salesperson: {data?.gainSalesperson || 0}
                </Text>
              </Stack>
            </Card>
          </Grid.Col>

          {/* Not Visited */}
          <Grid.Col span={4}>
            <Card
              shadow="xs"
              p="md"
              radius="md"
              style={{
                cursor: "pointer",
                background: "linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)",
                border: "1px solid #FDE68A",
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
                height: "88px",
              }}
              onClick={onNotVisitedClick}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 6px 16px rgba(217, 119, 6, 0.18)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "";
              }}
            >
              <Stack align="flex-start" gap={3} justify="center" h="100%">
                <Text style={{ fontSize: "11px", color: "#64748B", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Not Visited
                </Text>
                <Text style={{ fontSize: "1.6rem", fontWeight: 700, color: "#D97706", lineHeight: 1 }}>
                  {data?.notVisited || 0}
                </Text>
                <Text style={{ fontSize: "11px", color: "#FCD34D" }}>
                  Salesperson: {data?.notVisitedSalesperson || 0}
                </Text>
              </Stack>
            </Card>
          </Grid.Col>

          {/* Lost */}
          <Grid.Col span={4}>
            <Card
              shadow="xs"
              p="md"
              radius="md"
              style={{
                cursor: "pointer",
                background: "linear-gradient(135deg, #FFF5F5 0%, #FEE2E2 100%)",
                border: "1px solid #FECACA",
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
                height: "88px",
              }}
              onClick={onLostClick}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 6px 16px rgba(220, 38, 38, 0.18)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "";
              }}
            >
              <Stack align="flex-start" gap={3} justify="center" h="100%">
                <Text style={{ fontSize: "11px", color: "#64748B", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Lost
                </Text>
                <Text style={{ fontSize: "1.6rem", fontWeight: 700, color: "#DC2626", lineHeight: 1 }}>
                  {data?.lost || 0}
                </Text>
                <Text style={{ fontSize: "11px", color: "#FCA5A5" }}>
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
