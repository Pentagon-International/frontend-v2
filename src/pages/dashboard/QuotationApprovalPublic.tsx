import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card,
  Text,
  Button,
  Group,
  Stack,
  Center,
  Loader,
  Alert,
  Badge,
  Grid,
  Divider,
  Textarea,
} from "@mantine/core";
import { IconCheck, IconX, IconAlertCircle } from "@tabler/icons-react";
import { ToastNotification } from "../../components";
import { URL } from "../../api/serverUrls";
import { apiCall } from "../../api/axios";
import { postAPICall } from "../../service/postApiCall";
import { toTitleCase } from "../../utils/textFormatter";
import useAuthStore from "../../store/authStore";

type QuotationData = {
  quotation_id: string;
  enquiry_id: string;
  customer_name: string;
  salesperson: string;
  origin: string;
  destination: string;
  quote_type: string;
  valid_upto: string;
  service: string;
  trade: string;
  approval_status?: string;
};

function QuotationApprovalPublic() {
  const { quotationId } = useParams<{ quotationId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [quotations, setQuotations] = useState<QuotationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isApproved, setIsApproved] = useState(false);
  const [isRejected, setIsRejected] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [remarksError, setRemarksError] = useState("");
  const [apiMessage, setApiMessage] = useState("");

  useEffect(() => {
    if (quotationId) {
      fetchQuotationDetails();
    }
  }, [quotationId]);

  const fetchQuotationDetails = async () => {
    try {
      setLoading(true);

      // For public access, we don't use authentication headers
      const result = await postAPICall(`${URL.quotatoionPublicGetData}`, {
        quotation_id: quotationId,
        pulse_id: user?.pulse_id || "",
      });
      // console.log("result value---", result);

      const response = result?.data as QuotationData[];

      console.log(response);

      setQuotations(response || []);

      // Check if already approved/rejected (check first quotation's status)
      if (response && response.length > 0) {
        const firstQuotation = response[0];
        if (firstQuotation.approval_status === "GAINED") {
          setIsApproved(true);
        } else if (firstQuotation.approval_status === "LOST") {
          setIsRejected(true);
        }
      }
    } catch (error) {
      console.error("Error fetching quotation details:", error);
      setError("Failed to load quotation details");
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (action: "GAINED" | "LOST") => {
    // Validate remarks only for reject action
    if (action === "LOST" && !remarks.trim()) {
      setRemarksError(
        "Remarks are mandatory when rejecting a quotation. Please provide your comments."
      );
      return;
    }

    setRemarksError("");

    try {
      setApprovalLoading(true);

      const payload = {
        quotation_id: parseInt(quotationId!),
        status: action,
        pulse_id: user?.pulse_id || "",
        ...(action === "LOST" && { remark: remarks.trim() }),
      };

      console.log(payload);
      console.log(URL.quotationApproval);

      const response = await apiCall.post(URL.quotationApproval, payload);
      const data = response.data;

      // console.log("API Response:", data);
      // console.log("Action:", action);

      // Handle the response based on your API structure
      if (data.status && data.data) {
        const quotationStatus = data.data.quotation_status;

        if (quotationStatus === "GAINED") {
          setIsApproved(true);
          setIsRejected(false);
        } else if (quotationStatus === "LOST") {
          setIsRejected(true);
          setIsApproved(false);
        }

        // Store the API message for display
        setApiMessage(data.message);
      }

      // Refresh quotation data
      // await fetchQuotationDetails();
      if (quotations.length > 0 && data.status && data.data) {
        setQuotations((prev) =>
          prev.map((quotation) => ({
            ...quotation,
            approval_status: data.data.quotation_status,
          }))
        );
      }
    } catch (error) {
      console.error("Error processing approval:", error);
      ToastNotification({
        type: "error",
        message: `Failed to ${action} quotation`,
      });
    } finally {
      setApprovalLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <Center h="50vh">
        <Stack align="center">
          <Loader size="lg" color="#105476" />
          <Text c="dimmed">Loading quotation details...</Text>
        </Stack>
      </Center>
    );
  }

  if (error) {
    return (
      <Center h="50vh">
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Error"
          color="red"
          variant="light"
        >
          {error}
        </Alert>
      </Center>
    );
  }

  if (!quotations || quotations.length === 0) {
    return (
      <Center h="50vh">
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Not Found"
          color="yellow"
          variant="light"
        >
          Quotations not found
        </Alert>
      </Center>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        padding: "16px",
      }}
    >
      <Card
        shadow="lg"
        padding="lg"
        radius="lg"
        withBorder
        style={{ maxWidth: "1200px", margin: "0 auto" }}
      >
        <Stack gap="md">
          {/* Header */}
          <Group justify="space-between" align="center">
            <Stack gap={0}>
              <Text size="xl" fw={700} c="#105476">
                Quotation Approval Request
              </Text>
              <Text size="sm" c="dimmed">
                Quotation ID: {quotations[0]?.quotation_id}
              </Text>
              <Text size="sm" c="dimmed">
                Enquiry ID: {quotations[0]?.enquiry_id}
              </Text>
              <Text size="sm" c="dimmed">
                Customer: {quotations[0]?.customer_name}
              </Text>
            </Stack>

            {/* {quotations[0]?.approval_status && (
              <Badge
                color={
                  quotations[0].approval_status === "GAINED"
                    ? "green"
                    : quotations[0].approval_status === "LOST"
                      ? "red"
                      : "#105476"
                }
                size="lg"
              >
                {quotations[0].approval_status}
              </Badge>
            )} */}
          </Group>

          <Divider />

          {/* Multiple Quotations Display */}
          <Stack gap="lg">
            {quotations.map((quotation, index) => (
              <Card key={index} shadow="sm" padding="md" radius="md" withBorder>
                <Stack gap="sm">
                  <Group justify="space-between" align="center">
                    <Text size="lg" fw={600} c="#105476">
                      Service {index + 1}
                    </Text>
                    {/* <Badge color="blue" variant="light">
                      {quotation.service} - {quotation.trade}
                    </Badge> */}
                  </Group>

                  <Grid>
                    <Grid.Col span={6}>
                      <Stack gap={4}>
                        <Text size="sm" fw={500} c="dimmed">
                          Route Information
                        </Text>
                        <Text size="sm">Origin: {quotation.origin}</Text>
                        <Text size="sm">
                          Destination: {quotation.destination}
                        </Text>
                        <Text size="sm">
                          Quote Type: {quotation.quote_type}
                        </Text>
                      </Stack>
                    </Grid.Col>

                    <Grid.Col span={6}>
                      <Stack gap={4}>
                        <Text size="sm" fw={500} c="dimmed">
                          Service Details
                        </Text>
                        <Text size="sm">Service: {quotation.service}</Text>
                        <Text size="sm">Trade: {quotation.trade}</Text>
                        <Text size="sm">
                          Sales Person: {quotation.salesperson}
                        </Text>
                        <Text size="sm">
                          Valid Until: {formatDate(quotation.valid_upto)}
                        </Text>
                      </Stack>
                    </Grid.Col>
                  </Grid>
                </Stack>
              </Card>
            ))}
          </Stack>

          <Divider />

          {/* Approval Section */}
          {!isApproved && !isRejected ? (
            <Stack gap="sm">
              <Text size="lg" fw={600} c="#105476" ta="center">
                Please review the quotation and provide your approval
              </Text>

              <Text size="sm" c="dimmed" ta="center">
                By clicking "Accept", you agree to the terms and rates specified
                in this quotation. By clicking "Reject", you decline this
                quotation and must provide feedback.
              </Text>
              {/* 
              {!remarks.trim() && (
                <Alert
                  icon={<IconAlertCircle size={16} />}
                  title="Remarks Required"
                  color="yellow"
                  variant="light"
                >
                  Please provide detailed remarks/comments before you can
                  approve or reject this quotation.
                </Alert>
              )} */}

              {/* Remarks Input */}
              <Stack
                gap="sm"
                style={{ maxWidth: "88.5%", margin: "0 auto", width: "100%" }}
              >
                <Text size="md" fw={600} c="#105476">
                  Remarks/Comments{" "}
                  <span style={{ color: "red" }}>(Required for rejection)</span>
                </Text>
                <Textarea
                  placeholder="Please provide your detailed comments or remarks about this quotation. This field is mandatory before you can approve or reject the quotation..."
                  value={remarks}
                  onChange={(e) => {
                    const formattedValue = toTitleCase(e.currentTarget.value);
                    setRemarks(formattedValue);
                    if (remarksError) setRemarksError("");
                  }}
                  minRows={3}
                  maxRows={5}
                  size="md"
                  styles={{
                    input: {
                      borderColor: remarksError ? "#fa5252" : undefined,
                      fontSize: "14px",
                      lineHeight: "1.5",
                    },
                    label: {
                      fontSize: "14px",
                      fontWeight: 600,
                    },
                  }}
                />
                <Group justify="space-between" align="center">
                  <Text size="xs" c="dimmed">
                    Remarks are optional for approval but required for rejection
                  </Text>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setRemarks("");
                      setRemarksError("");
                    }}
                  >
                    Clear Remarks
                  </Button>
                </Group>
              </Stack>

              <Group justify="center" gap="lg">
                <Button
                  size="lg"
                  color="green"
                  leftSection={<IconCheck size={20} />}
                  onClick={() => handleApproval("GAINED")}
                  loading={approvalLoading && isApproved}
                  disabled={approvalLoading || isApproved}
                  title="Click to approve this quotation"
                >
                  Accept Quotation
                </Button>

                <Button
                  size="lg"
                  color="red"
                  variant="outline"
                  leftSection={<IconX size={20} />}
                  onClick={() => handleApproval("LOST")}
                  loading={approvalLoading && isRejected}
                  disabled={approvalLoading || !remarks.trim()}
                  title={
                    !remarks.trim()
                      ? "Please enter remarks before rejecting"
                      : ""
                  }
                >
                  Reject Quotation
                </Button>
              </Group>
            </Stack>
          ) : (
            <Stack gap="sm">
              <Center>
                <Alert
                  icon={
                    isApproved ? (
                      <IconCheck size={16} />
                    ) : (
                      <IconCheck size={16} />
                    )
                  }
                  title={isApproved ? "Quotation gained" : "Quotation lost"}
                  color={isApproved ? "green" : "yellow"}
                  variant="light"
                >
                  {apiMessage ||
                    (isApproved
                      ? "This quotation has been successfully gained. Thank you for your business!"
                      : "This quotation is marked as lost")}
                </Alert>

                {/* Show submitted remarks */}
                {/* {remarks.trim() && (
                  <Card shadow="xs" padding="md" radius="md" withBorder>
                    <Text size="sm" fw={500} c="dimmed" mb="xs">
                      Your Remarks:
                    </Text>
                    <Text size="sm" style={{ fontStyle: "italic" }}>
                      "{remarks}"
                    </Text>
                  </Card>
                )} */}
              </Center>
              {/* 
              <Group justify="center">
                <Button variant="outline" onClick={() => window.close()}>
                  Close Window
                </Button>
              </Group> */}
            </Stack>
          )}
        </Stack>
      </Card>
    </div>
  );
}

export default QuotationApprovalPublic;
