import {
  Drawer,
  Divider,
  Box,
  Loader,
  Text,
  Stack,
  Group,
  Grid,
  Card,
} from "@mantine/core";
import DateRangeInput from "../DateRangeInput";
import useDateFormat from "../../hooks/useDateFormat";
import { formatDateForUi } from "../../utils/dateFormat";
import { formatMoneyAmountForUi } from "../../utils/nonDecimalMoneyAmount";

interface CustomerDataDrawerProps {
  opened: boolean;
  title: string;

  // Close drawer handler
  onClose: () => void;

  // Loading state
  isLoading: boolean;

  // Customer Information
  customerSalesperson?: string | null;
  customerCreditDay?: number | null;
  customerLastVisited?: string | null;
  customerTotalCreditAmount?: number | null;
  totalOutstandingAmount?: number;
  customerCurrency?: string;

  // Revenue & Profit
  totalRevenue?: number | null;
  totalProfit?: number | null;

  // Date Range Filter
  isAdmin: boolean;
  fromDate: string | null;
  toDate: string | null;
  onFromDateChange: (date: string | null) => void;
  onToDateChange: (date: string | null) => void;

  // Table sections
  quotationData: any[];
  shipmentData: any[];
  callEntryData: any[];
  potentialProfilingData: any[];

  // Navigation handler
  onQuotationClick: (quotation: any) => void;
}

export default function CustomerDataDrawer({
  opened,
  title,
  onClose,
  isLoading,

  customerSalesperson,
  customerCreditDay,
  customerLastVisited,
  customerTotalCreditAmount,
  totalOutstandingAmount = 0,
  customerCurrency = "₹",

  totalRevenue,
  totalProfit,

  isAdmin,
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,

  quotationData,
  shipmentData,
  callEntryData,
  potentialProfilingData,

  onQuotationClick,
}: CustomerDataDrawerProps) {
  const dateFormat = useDateFormat();
  const formatDrawerMoney = (value: number) => formatMoneyAmountForUi(value);

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={title}
      size="70%"
      position="right"
      styles={{
        title: { fontFamily: "Inter, sans-serif", fontWeight: 600 },
      }}
    >
      <Divider mb="md" />

      {isLoading ? (
        <Box ta="center" py="xl">
          <Loader size="lg" color="#105476" />
          <Text
            mt="md"
            c="dimmed"
            size="lg"
            style={{ fontFamily: "Inter, sans-serif" }}
          >
            Loading customer data...
          </Text>
        </Box>
      ) : (
        <Stack gap="lg">
          {/* =================== CUSTOMER INFO =================== */}
          {(customerCreditDay ||
            customerSalesperson ||
            customerLastVisited ||
            customerTotalCreditAmount ||
            totalOutstandingAmount !== 0 ||
            totalRevenue ||
            totalProfit) && (
            <Box>
              <Group justify="space-between" align="flex-start" mb="md">
                <Text
                  size="lg"
                  fw={700}
                  c="#105476"
                  style={{
                    paddingBottom: "6px",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  ℹ️ Customer Information
                </Text>

                {isAdmin && (
                  <Box style={{ width: "400px" }}>
                    <DateRangeInput
                      fromDate={fromDate}
                      toDate={toDate}
                      onFromDateChange={onFromDateChange}
                      onToDateChange={onToDateChange}
                      fromLabel="From"
                      toLabel="To"
                      size="xs"
                      inputWidth="180px"
                    />
                  </Box>
                )}
              </Group>

              <Grid gutter="md">
                {/* LEFT CARD */}
                <Grid.Col span={{ base: 12, md: isAdmin ? 6 : 12 }}>
                  <Card
                    shadow="sm"
                    padding="lg"
                    radius="md"
                    withBorder
                    style={{
                      border: "1px solid #e9ecef",
                      backgroundColor: "#ffffff",
                      height: "100%",
                    }}
                  >
                    <Grid gutter="md">
                      {customerSalesperson && (
                        <Grid.Col span={{ base: 12, sm: 6 }}>
                          <Text
                            size="xs"
                            fw={600}
                            c="#666"
                            mb={6}
                            style={{
                              fontFamily: "Inter, sans-serif",
                            }}
                          >
                            Salesperson
                          </Text>
                          <Text
                            size="sm"
                            fw={500}
                            c="#333"
                            style={{
                              fontFamily: "Inter, sans-serif",
                            }}
                          >
                            {customerSalesperson}
                          </Text>
                        </Grid.Col>
                      )}

                      <Grid.Col span={{ base: 12, sm: 6 }}>
                        <Text size="xs" fw={600} c="#666" mb={6}>
                          Credit Days
                        </Text>
                        <Text size="sm" fw={500} c="#333">
                          {customerCreditDay !== null
                            ? `${customerCreditDay} days`
                            : "-"}
                        </Text>
                      </Grid.Col>

                      {customerTotalCreditAmount !== null && (
                        <Grid.Col span={{ base: 12, sm: 6 }}>
                          <Text size="xs" fw={600} c="#666" mb={6}>
                            Credit Amount
                          </Text>
                          <Text size="sm" fw={500} c="#333">
                            {customerCurrency}{" "}
                            {formatDrawerMoney(customerTotalCreditAmount)}
                          </Text>
                        </Grid.Col>
                      )}

                      <Grid.Col span={{ base: 12, sm: 6 }}>
                        <Text size="xs" fw={600} c="#666" mb={6}>
                          Total Outstanding
                        </Text>
                        <Text
                          size="sm"
                          fw={500}
                          style={{
                            color:
                              totalOutstandingAmount > 0
                                ? "#28a745"
                                : totalOutstandingAmount < 0
                                  ? "#dc3545"
                                  : "#333",
                          }}
                        >
                          {customerCurrency}{" "}
                          {formatDrawerMoney(totalOutstandingAmount)}
                        </Text>
                      </Grid.Col>

                      <Grid.Col span={{ base: 12, sm: 6 }}>
                        <Text size="xs" fw={600} c="#666" mb={6}>
                          Last Visited
                        </Text>
                        <Text size="sm" fw={500} c="#333">
                          {customerLastVisited
                            ? formatDateForUi(
                                customerLastVisited,
                                dateFormat,
                                "-",
                              )
                            : "-"}
                        </Text>
                      </Grid.Col>
                    </Grid>
                  </Card>
                </Grid.Col>

                {/* RIGHT CARD (Admin Only) */}
                {isAdmin && (
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Card
                      shadow="sm"
                      padding="lg"
                      radius="md"
                      withBorder
                      style={{
                        border: "1px solid #e9ecef",
                        backgroundColor: "#ffffff",
                        height: "100%",
                      }}
                    >
                      <Group justify="space-evenly" mt={10}>
                        {totalRevenue !== null && (
                          <Box ta="center">
                            <Text size="xs" fw={600} c="#666" mb={6}>
                              Total Revenue
                            </Text>
                            <Text size="sm" fw={500} c="#FF9800">
                              {customerCurrency}{" "}
                              {formatDrawerMoney(totalRevenue ?? 0)}
                            </Text>
                          </Box>
                        )}

                        {totalProfit !== null && (
                          <Box ta="center">
                            <Text size="xs" fw={600} c="#666" mb={6}>
                              Total Profit
                            </Text>
                            <Text size="sm" fw={500} c="#105476">
                              {customerCurrency}{" "}
                              {formatDrawerMoney(totalProfit ?? 0)}
                            </Text>
                          </Box>
                        )}
                      </Group>
                    </Card>
                  </Grid.Col>
                )}
              </Grid>
            </Box>
          )}

          {/* =================== QUOTATIONS =================== */}
          <Box>
            <Text
              size="lg"
              fw={700}
              mb="md"
              c="#105476"
              style={{
                // borderBottom: "2px solid #105476",
                paddingBottom: "6px",
              }}
            >
              📋 Recent Quotations
            </Text>
            <Box
              py="sm"
              style={{
                height: "100%",
                maxHeight: 400, // adjust based on your card height (≈ 2 rows)
                overflowY: "auto",
                overflowX: "hidden",
                width: "100%",
                paddingRight: 4, // avoids scrollbar overlap
              }}
            >
              {quotationData.length > 0 ? (
                <Grid gutter="md">
                  {quotationData.map((q: any) => (
                    <Grid.Col key={q.id} span={{ base: 12, sm: 6, md: 4 }}>
                      <Card
                        shadow="sm"
                        padding="md"
                        radius="md"
                        withBorder
                        style={{
                          border: "1px solid #e9ecef",
                          backgroundColor: "#ffffff",
                          transition: "all 0.2s ease",
                          cursor: "pointer",
                          height: "100%",
                          boxShadow :"0 2px 8px rgba(0,0,0,0.1)"
                        }}
                        onClick={() => onQuotationClick(q)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "translateY(-2px)";
                          e.currentTarget.style.boxShadow =
                            "0 8px 20px rgba(16, 84, 118, 0.1)";
                          e.currentTarget.style.borderColor = "#105476";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "translateY(0)";
                          e.currentTarget.style.boxShadow =
                            "0 2px 8px rgba(0,0,0,0.1)";
                          e.currentTarget.style.borderColor = "#e9ecef";
                        }}
                      >
                        <Stack gap="sm">
                          <Group justify="space-between" align="center">
                            <Text size="sm" fw={600} c="#105476">
                              {q.enquiry_received_date
                                ? formatDateForUi(
                                    q.enquiry_received_date,
                                    dateFormat,
                                    "-",
                                  )
                                : "-"}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {q.service || "-"}
                            </Text>
                          </Group>

                          <Group gap="sm">
                            <Box style={{ flex: 1, minWidth: 0 }}>
                              <Text size="xs" fw={600} c="#666" mb={2}>
                                Origin
                              </Text>
                              <Text size="sm" fw={500} c="#333" truncate>
                                {q.origin_name || "-"}
                              </Text>
                            </Box>

                            <Box style={{ flex: 1, minWidth: 0 }}>
                              <Text size="xs" fw={600} c="#666" mb={2}>
                                Destination
                              </Text>
                              <Text size="sm" fw={500} c="#333" truncate>
                                {q.destination_name || "-"}
                              </Text>
                            </Box>
                          </Group>

                          {/* Additional Quotation Details */}
                          <Group gap="sm">
                            <Box style={{ flex: 1 }}>
                              <Text size="xs" fw={600} c="#666" mb={2}>
                                Container Type
                              </Text>
                              <Text size="sm" fw={500} c="#333" truncate>
                                {q.fcl_details && q.fcl_details.length > 0
                                  ? q.fcl_details
                                      .map((detail) => detail.container_type)
                                      .join(", ")
                                  : "-"}
                              </Text>
                            </Box>
                            <Box style={{ flex: 1 }}>
                              <Text size="xs" fw={600} c="#666" mb={2}>
                                No. of Containers
                              </Text>
                              <Text size="sm" fw={500} c="#333" truncate>
                                {q.fcl_details && q.fcl_details.length > 0
                                  ? q.fcl_details
                                      .map((detail) => detail.no_of_containers)
                                      .join(", ")
                                  : "-"}
                              </Text>
                            </Box>
                          </Group>

                          {/* Status at the bottom */}
                          <Group justify="space-between" align="center">
                            <Text size="xs" fw={600} c="#666">
                              Status:
                            </Text>
                            <Text size="sm" fw={500} c="#28a745">
                              {q.status || "-"}
                            </Text>
                          </Group>
                        </Stack>
                      </Card>
                    </Grid.Col>
                  ))}
                </Grid>
              ) : (
                <Card
                  shadow="sm"
                  padding="md"
                  radius="md"
                  withBorder
                  style={{ backgroundColor: "#f8f9fa" }}
                >
                  <Box ta="center" py="sm">
                    <Text c="dimmed" size="sm">
                      No quotations found for this customer
                    </Text>
                  </Box>
                </Card>
              )}
            </Box>
          </Box>

          {/* =================== SHIPMENTS =================== */}
          <Box>
            <Text size="lg" fw={700} mb="md" pb={6} c="#105476">
              📦 Recent Shipments
            </Text>
            <Box
              py="sm"
              style={{
                height: "100%",
                maxHeight: 420, // adjust based on your card height (≈ 2 rows)
                overflowY: "auto",
                overflowX: "hidden",
                width: "100%",
                paddingRight: 4, // avoids scrollbar overlap
              }}
            >
              {shipmentData.length > 0 ? (
                <Grid gutter="md">
                  {shipmentData.map((shipment: any, index: number) => (
                    <Grid.Col key={index} span={{ base: 12, sm: 6, md: 4 }}>
                      <Card
                        shadow="sm"
                        padding="md"
                        radius="md"
                        withBorder
                        style={{
                          border: "1px solid #e9ecef",
                          backgroundColor: "#ffffff",
                          transition: "all 0.2s ease",
                          cursor: "pointer",
                          height: "100%",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "translateY(-2px)";
                          e.currentTarget.style.boxShadow =
                            "0 8px 20px rgba(16, 84, 118, 0.1)";
                          e.currentTarget.style.borderColor = "#105476";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "translateY(0)";
                          e.currentTarget.style.boxShadow =
                            "0 2px 8px rgba(0,0,0,0.1)";
                          e.currentTarget.style.borderColor = "#e9ecef";
                        }}
                      >
                        <Stack gap="sm">
                          <Group justify="space-between" align="center">
                            <Text size="sm" fw={600} c="#105476">
                              {shipment.customer_name || "-"}
                            </Text>
                          </Group>

                          <Box>
                            <Text size="xs" fw={600} c="#666" mb={2}>
                              Booking No
                            </Text>
                            <Text size="sm" fw={500} c="#333">
                              {shipment.booking_no || "-"}
                            </Text>
                          </Box>
                        </Stack>
                      </Card>
                    </Grid.Col>
                  ))}
                </Grid>
              ) : (
                <Card
                  shadow="sm"
                  padding="md"
                  radius="md"
                  withBorder
                  style={{ backgroundColor: "#f8f9fa" }}
                >
                  <Box ta="center" py="sm">
                    <Text c="dimmed" size="sm">
                      No shipments found for this customer
                    </Text>
                  </Box>
                </Card>
              )}
            </Box>
          </Box>

          {/* =================== CALL ENTRIES =================== */}
          <Box>
            <Text size="lg" fw={700} mb="md" pb={6} c="#105476">
              📞 Recent Call Entries
            </Text>
            <Box
              py="sm"
              style={{
                height: "100%",
                maxHeight: 350, // adjust based on your card height (≈ 2 rows)
                overflowY: "auto",
                overflowX: "hidden",
                width: "100%",
                paddingRight: 4, // avoids scrollbar overlap
              }}
            >
              {callEntryData.length > 0 ? (
                <Grid gutter="sm" w={"100%"}>
                  {callEntryData.map((call: any) => (
                    <Grid.Col key={call.id} span={{ base: 12, sm: 6, md: 4 }}>
                      <Card
                        shadow="sm"
                        padding="md"
                        radius="md"
                        withBorder
                        style={{
                          border: "1px solid #e9ecef",
                          backgroundColor: "#ffffff",
                          transition: "all 0.2s ease",
                          cursor: "pointer",
                          height: "100%",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "translateY(-2px)";
                          e.currentTarget.style.boxShadow =
                            "0 8px 20px rgba(16, 84, 118, 0.1)";
                          e.currentTarget.style.borderColor = "#105476";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "translateY(0)";
                          e.currentTarget.style.boxShadow =
                            "0 2px 8px rgba(0,0,0,0.1)";
                          e.currentTarget.style.borderColor = "#e9ecef";
                        }}
                      >
                        <Stack gap="sm">
                          <Group justify="space-between" align="center">
                            <Text size="sm" fw={600} c="#105476">
                              {call.call_date
                                ? formatDateForUi(
                                    call.call_date,
                                    dateFormat,
                                    "-",
                                  )
                                : "-"}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {call.call_mode || "-"}
                            </Text>
                          </Group>

                          <Group gap="sm">
                            <Box style={{ flex: 1 }}>
                              <Text size="xs" fw={600} c="#666" mb={2}>
                                Follow-up Date
                              </Text>
                              <Text size="sm" fw={500} c="#333">
                                {call.followup_date
                                  ? formatDateForUi(
                                      call.followup_date,
                                      dateFormat,
                                      "-",
                                    )
                                  : "-"}
                              </Text>
                            </Box>
                            <Box style={{ flex: 1 }}>
                              <Text size="xs" fw={600} c="#666" mb={2}>
                                Action
                              </Text>
                              <Text
                                size="sm"
                                fw={500}
                                c="#333"
                                style={{
                                  display: "-webkit-box",
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: "vertical",
                                  overflow: "hidden",
                                  lineHeight: "1.4",
                                }}
                              >
                                {call.followup_action || "-"}
                              </Text>
                            </Box>
                          </Group>

                          <Box>
                            <Text size="xs" fw={600} c="#666" mb={2}>
                              Call Summary
                            </Text>
                            <Text
                              size="sm"
                              fw={500}
                              c="#333"
                              style={{
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                                lineHeight: "1.4",
                              }}
                            >
                              {call.call_summary || "-"}
                            </Text>
                          </Box>
                        </Stack>
                      </Card>
                    </Grid.Col>
                  ))}
                </Grid>
              ) : (
                <Card
                  shadow="sm"
                  padding="md"
                  radius="md"
                  withBorder
                  style={{ backgroundColor: "#f8f9fa" }}
                >
                  <Box ta="center" py="sm">
                    <Text c="dimmed" size="sm">
                      No call entries found for this customer
                    </Text>
                  </Box>
                </Card>
              )}
            </Box>
          </Box>

          {/* =================== POTENTIAL PROFILING =================== */}
          <Box>
            <Text size="lg" fw={700} mb="md" pb={6} c="#105476">
              🎯 Potential Profiling
            </Text>
            <Box
              py="sm"
              style={{
                height: "100%",
                maxHeight: 420, // adjust based on your card height (≈ 2 rows)
                overflowY: "auto",
                overflowX: "hidden",
                width: "100%",
                paddingRight: 4, // avoids scrollbar overlap
              }}
            >
              {potentialProfilingData.length > 0 ? (
                <Grid gutter="md">
                  {potentialProfilingData.map((profile: any) => (
                    <Grid.Col
                      key={profile.id}
                      span={{ base: 12, sm: 6, md: 4 }}
                    >
                      <Card
                        shadow="sm"
                        padding="md"
                        radius="md"
                        withBorder
                        style={{
                          border: "1px solid #e9ecef",
                          backgroundColor: "#ffffff",
                          transition: "all 0.2s ease",
                          cursor: "pointer",
                          height: "100%",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "translateY(-2px)";
                          e.currentTarget.style.boxShadow =
                            "0 8px 20px rgba(16, 84, 118, 0.1)";
                          e.currentTarget.style.borderColor = "#105476";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "translateY(0)";
                          e.currentTarget.style.boxShadow =
                            "0 2px 8px rgba(0,0,0,0.1)";
                          e.currentTarget.style.borderColor = "#e9ecef";
                        }}
                      >
                        <Stack gap="sm">
                          <Text size="sm" fw={600} c="#105476">
                            {profile.service || "-"}
                          </Text>

                          <Group>
                            <Box style={{ flex: 1 }}>
                              <Text size="xs" fw={600} c="#666" mb={2}>
                                Origin
                              </Text>
                              <Text size="sm" fw={500} c="#333" truncate>
                                {profile.origin_port_name || "-"}
                              </Text>
                            </Box>

                            <Box style={{ flex: 1 }}>
                              <Text size="xs" fw={600} c="#666" mb={2}>
                                Destination
                              </Text>
                              <Text size="sm" fw={500} c="#333" truncate>
                                {profile.destination_port_name || "-"}
                              </Text>
                            </Box>
                          </Group>

                          <Group gap="sm">
                            <Box style={{ flex: 1 }}>
                              <Text size="xs" fw={600} c="#666" mb={2}>
                                No. of Shipments
                              </Text>
                              <Text size="sm" fw={500} c="#333">
                                {profile.no_of_shipments || "-"}
                              </Text>
                            </Box>
                            <Box style={{ flex: 1 }}>
                              <Text size="xs" fw={600} c="#666" mb={2}>
                                Frequency
                              </Text>
                              <Text size="sm" fw={500} c="#333">
                                {profile.frequency_name || "-"}
                              </Text>
                            </Box>
                          </Group>

                          <Group gap="sm">
                            <Box style={{ flex: 1 }}>
                              <Text size="xs" fw={600} c="#666" mb={2}>
                                Volume
                              </Text>
                              <Text size="sm" fw={500} c="#333">
                                {profile.volume || "-"}
                              </Text>
                            </Box>
                            <Box style={{ flex: 1 }}>
                              <Text size="xs" fw={600} c="#666" mb={2}>
                                Potential Profit
                              </Text>
                              <Text size="sm" fw={500} c="#28a745">
                                {profile.potential_profit
                                  ? `${customerCurrency} ${formatDrawerMoney(profile.potential_profit)}`
                                  : "-"}
                              </Text>
                            </Box>
                          </Group>
                        </Stack>
                      </Card>
                    </Grid.Col>
                  ))}
                </Grid>
              ) : (
                <Card
                  shadow="sm"
                  padding="md"
                  radius="md"
                  withBorder
                  style={{ backgroundColor: "#f8f9fa" }}
                >
                  <Box ta="center" py="sm">
                    <Text c="dimmed" size="sm">
                      No potential profiling data found for this customer
                    </Text>
                  </Box>
                </Card>
              )}
            </Box>
          </Box>
        </Stack>
      )}
    </Drawer>
  );
}
