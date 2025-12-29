import {
  Box,
  Button,
  Card,
  Grid,
  Group,
  Loader,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  ScrollArea,
  Badge,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconCheck, IconPlus, IconUser } from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import * as yup from "yup";
import { yupResolver } from "mantine-form-yup-resolver";
import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { getAPICall } from "../../service/getApiCall";
import { URL } from "../../api/serverUrls";
import { API_HEADER } from "../../store/storeKeys";
import { postAPICall } from "../../service/postApiCall";
import { putAPICall } from "../../service/putApiCall";
import { ToastNotification } from "../../components";
import useAuthStore from "../../store/authStore";
import { useQuery } from "@tanstack/react-query";

type LeadFormData = {
  name: string; // Company Name
  contact_person: string;
  contact_number: string;
  email_id: string;
  address: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  assigned_to: string;
  status: string;
  message: string;
  interest_level: string;
};

type UserMasterData = {
  id: number;
  user_id: string;
  user_name: string;
  employee_id: string;
  pulse_id: string | null;
  email_id: string;
  status: string;
};

const interestLevelOptions = [
  { value: "High", label: "High" },
  { value: "Medium", label: "Medium" },
  { value: "Low", label: "Low" },
];

const statusOptions = [
  { value: "New", label: "New" },
  { value: "Contacted", label: "Contacted" },
  { value: "Qualified", label: "Qualified" },
  { value: "Converted", label: "Converted" },
  { value: "Lost", label: "Lost" },
];

const schema = yup.object().shape({
  name: yup.string().required("Company name is required"),
  assigned_to: yup.string().required("Assigned to is required"),
  contact_number: yup
    .string()
    .test("phone-format", "Invalid phone number format", (value) => {
      if (!value || value.trim() === "") return true; // Optional field
      const cleanPhone = value.startsWith("+")
        ? "+" + value.substring(1).replace(/\D/g, "")
        : value.replace(/\D/g, "");
      if (cleanPhone.startsWith("+")) {
        const digitsOnly = cleanPhone.substring(1);
        return digitsOnly.length >= 7 && digitsOnly.length <= 15;
      }
      return cleanPhone.length >= 7 && cleanPhone.length <= 15;
    }),
  email_id: yup.string().email("Invalid email format"),
  pincode: yup
    .string()
    .test("pincode-format", "Pincode must be exactly 6 digits", (value) => {
      if (!value || value.trim() === "") return true; // Optional field
      return /^\d{6}$/.test(value);
    }),
  message: yup.string().max(500, "Message cannot exceed 500 characters"),
});

function CreateLead() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const leadData = (location.state as any)?.leadData;
  const isEditMode = !!leadData;

  // Fetch user master data for Assigned To dropdown
  const { data: usersData = [], isLoading: usersLoading } = useQuery({
    queryKey: ["userMaster"],
    queryFn: async () => {
      try {
        const response = (await getAPICall(URL.user, API_HEADER)) as UserMasterData[];
        return Array.isArray(response) ? response : [];
      } catch (err: unknown) {
        console.error("Error fetching user master:", err);
        ToastNotification({
          type: "error",
          message: `Error fetching user data: ${err instanceof Error ? err.message : "Unknown error"}`,
        });
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  const userOptions = usersData
    .filter((item) => item?.user_name)
    .map((item) => ({
      value: item.user_name,
      label:  item.user_name,
    }));

  const form = useForm<LeadFormData>({
    mode: "controlled",
    initialValues: {
      name: leadData?.name || "",
      contact_person: leadData?.contact_person || "",
      contact_number: leadData?.contact_number || "",
      email_id: leadData?.email_id || "",
      address: leadData?.location?.address || "",
      city: leadData?.location?.city || "",
      state: leadData?.location?.state || "",
      country: leadData?.location?.country || "",
      pincode: leadData?.location?.pincode || "",
      assigned_to: leadData?.assigned_to || "",
      status: leadData?.status || "New",
      message: "",
      interest_level: leadData?.remark?.interest_level || "",
    },
    validate: yupResolver(schema),
  });

  // Load existing chat history if in edit mode
  const [chatHistory, setChatHistory] = useState<
    Array<{
      sender: string;
      message: string;
      sender_id: number;
      timestamp: string;
    }>
  >(() => {
    if (leadData?.remark?.messages && Array.isArray(leadData.remark.messages)) {
      return leadData.remark.messages;
    }
    return [];
  });

  useEffect(() => {
    if (isEditMode && leadData) {
      form.setValues({
        name: leadData.name || "",
        contact_person: leadData.contact_person || "",
        contact_number: leadData.contact_number || "",
        email_id: leadData.email_id || "",
        address: leadData.location?.address || "",
        city: leadData.location?.city || "",
        state: leadData.location?.state || "",
        country: leadData.location?.country || "",
        pincode: leadData.location?.pincode || "",
        assigned_to: leadData.assigned_to || "",
        status: leadData.status || "New",
        message: "",
        interest_level: leadData.remark?.interest_level || "",
      });
    }
  }, [isEditMode, leadData]);

  const handleSubmit = async (values: LeadFormData) => {
    try {
      setIsSubmitting(true);

      // Prepare messages array
      let allMessages = [...chatHistory];
      if (values.message.trim()) {
        const newMessage = {
          message: values.message.trim(),
          sender: user?.full_name || user?.username || "Unknown",
          sender_id: user?.user_id || 0,
          timestamp: new Date().toISOString(),
        };
        allMessages = [...chatHistory, newMessage];
      }

      const requestData: any = {
        name: values.name.trim(),
        assigned_to: values.assigned_to.trim(),
      };

      // Add optional fields only if they have values
      if (values.contact_person.trim()) {
        requestData.contact_person = values.contact_person.trim();
      }

      if (values.contact_number.trim()) {
        requestData.contact_number = values.contact_number.trim();
      }

      if (values.email_id.trim()) {
        requestData.email_id = values.email_id.trim();
      }

      // Add location only if at least one field has a value
      const hasLocation =
        values.address.trim() ||
        values.city.trim() ||
        values.state.trim() ||
        values.country.trim() ||
        values.pincode.trim();
      if (hasLocation) {
        requestData.location = {};
        if (values.address.trim()) requestData.location.address = values.address.trim();
        if (values.city.trim()) requestData.location.city = values.city.trim();
        if (values.state.trim()) requestData.location.state = values.state.trim();
        if (values.country.trim()) requestData.location.country = values.country.trim();
        if (values.pincode.trim()) requestData.location.pincode = values.pincode.trim();
      }

      // Add remark only if there are messages or interest level
      if (allMessages.length > 0 || values.interest_level) {
        requestData.remark = {
          messages: allMessages,
        };
        if (values.interest_level) {
          requestData.remark.interest_level = values.interest_level;
        }
      }

      // Add status only if it has a value
      if (values.status) {
        requestData.status = values.status;
      }

      let response;
      if (isEditMode) {
        // Update existing lead using PUT with lead ID
        // Include id in requestData for putAPICall to construct URL
        const updateData = {
          ...requestData,
          id: leadData.id,
        };
        response = await putAPICall(URL.lead, updateData, API_HEADER);
        ToastNotification({
          type: "success",
          message: "Lead updated successfully",
        });
      } else {
        // Create new lead using POST
        response = await postAPICall(URL.lead, requestData, API_HEADER);
        ToastNotification({
          type: "success",
          message: "Lead created successfully",
        });
      }

      // Navigate back to lead list with refresh flag
      const returnTo = (location.state as any)?.returnTo || "/lead";
      navigate(returnTo, {
        state: {
          refreshData: true,
          restoreFilters: (location.state as any)?.restoreFilters,
        },
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      ToastNotification({
        type: "error",
        message: `Error ${isEditMode ? "updating" : "creating"} lead: ${errorMessage}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box p="md">
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        {/* Header Section */}
        <Stack gap="md" mb="xl">
          <Group gap="sm">
            <IconUser size={32} color="#105476" />
            <Box>
              <Text size="xl" fw={600} c="#105476">
                {isEditMode ? "Update Lead" : "Create New Lead"}
              </Text>
              <Text size="sm" c="dimmed">
                {isEditMode
                  ? "Update interest level and add remarks"
                  : "Fill in company and contact details to create a new lead"}
              </Text>
            </Box>
          </Group>
        </Stack>

        <form onSubmit={form.onSubmit(handleSubmit)}>
          {/* Basic Information Section */}
          <Card shadow="xs" padding="md" radius="md" withBorder mb="md" bg="#f8f9fa">
            <Text size="md" fw={600} c="#105476" mb="md" style={{ borderBottom: "2px solid #105476", paddingBottom: "8px" }}>
              Basic Information
            </Text>
            <Grid>
              <Grid.Col span={12}>
                <TextInput
                  label="Company Name"
                  placeholder="Enter company name"
                  required
                  {...form.getInputProps("name")}
                  styles={{
                    label: { fontSize: "13px", fontWeight: 500, color: "#495057", marginBottom: "6px" },
                    input: { fontSize: "13px" },
                  }}
                />
              </Grid.Col>
              <Grid.Col span={12}>
                <TextInput
                  label="Contact Person's Name"
                  placeholder="Enter contact person's name"
                  {...form.getInputProps("contact_person")}
                  styles={{
                    label: { fontSize: "13px", fontWeight: 500, color: "#495057", marginBottom: "6px" },
                    input: { fontSize: "13px" },
                  }}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="Contact Number"
                  placeholder="Enter contact number (e.g., +91 9876543210)"
                  {...form.getInputProps("contact_number")}
                  styles={{
                    label: { fontSize: "13px", fontWeight: 500, color: "#495057", marginBottom: "6px" },
                    input: { fontSize: "13px" },
                  }}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="Email ID"
                  placeholder="Enter email address"
                  type="email"
                  {...form.getInputProps("email_id")}
                  styles={{
                    label: { fontSize: "13px", fontWeight: 500, color: "#495057", marginBottom: "6px" },
                    input: { fontSize: "13px" },
                  }}
                />
              </Grid.Col>
            </Grid>
          </Card>

          {/* Location Section */}
          <Card shadow="xs" padding="md" radius="md" withBorder mb="md" bg="#f8f9fa">
            <Text size="md" fw={600} c="#105476" mb="md" style={{ borderBottom: "2px solid #105476", paddingBottom: "8px" }}>
              Location
            </Text>
            <Grid>
              <Grid.Col span={12}>
                <Textarea
                  label="Address"
                  placeholder="Enter full address (Door No, Street, Area)"
                  minRows={3}
                  maxRows={5}
                  {...form.getInputProps("address")}
                  styles={{
                    label: { fontSize: "13px", fontWeight: 500, color: "#495057", marginBottom: "6px" },
                    input: { fontSize: "13px" },
                  }}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="City"
                  placeholder="Enter city"
                  {...form.getInputProps("city")}
                  styles={{
                    label: { fontSize: "13px", fontWeight: 500, color: "#495057", marginBottom: "6px" },
                    input: { fontSize: "13px" },
                  }}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="State"
                  placeholder="Enter state"
                  {...form.getInputProps("state")}
                  styles={{
                    label: { fontSize: "13px", fontWeight: 500, color: "#495057", marginBottom: "6px" },
                    input: { fontSize: "13px" },
                  }}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="Country"
                  placeholder="Enter country"
                  {...form.getInputProps("country")}
                  styles={{
                    label: { fontSize: "13px", fontWeight: 500, color: "#495057", marginBottom: "6px" },
                    input: { fontSize: "13px" },
                  }}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="Pincode"
                  placeholder="Enter 6-digit pincode"
                  maxLength={6}
                  {...form.getInputProps("pincode")}
                  styles={{
                    label: { fontSize: "13px", fontWeight: 500, color: "#495057", marginBottom: "6px" },
                    input: { fontSize: "13px" },
                  }}
                />
              </Grid.Col>
            </Grid>
          </Card>

          {/* Assignment & Status Section */}
          <Card shadow="xs" padding="md" radius="md" withBorder mb="md" bg="#f8f9fa">
            <Text size="md" fw={600} c="#105476" mb="md" style={{ borderBottom: "2px solid #105476", paddingBottom: "8px" }}>
              Assignment & Status
            </Text>
            <Grid>
              <Grid.Col span={6}>
                <Select
                  label="Assigned To"
                  placeholder="Select person..."
                  required
                  searchable
                  data={userOptions}
                  disabled={usersLoading}
                  {...form.getInputProps("assigned_to")}
                  styles={{
                    label: { fontSize: "13px", fontWeight: 500, color: "#495057", marginBottom: "6px" },
                    input: { fontSize: "13px" },
                  }}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <Select
                  label="Status"
                  placeholder="Select status"
                  data={statusOptions}
                  {...form.getInputProps("status")}
                  styles={{
                    label: { fontSize: "13px", fontWeight: 500, color: "#495057", marginBottom: "6px" },
                    input: { fontSize: "13px" },
                  }}
                />
              </Grid.Col>
            </Grid>
          </Card>

          {/* Remarks Section */}
          <Card shadow="xs" padding="md" radius="md" withBorder mb="md" bg="#f8f9fa">
            <Text size="md" fw={600} c="#105476" mb="md" style={{ borderBottom: "2px solid #105476", paddingBottom: "8px" }}>
              Remarks
            </Text>

            {/* Chat History - Only show in edit mode if messages exist */}
            {isEditMode && chatHistory.length > 0 && (
              <Box mb="md">
                <Text size="sm" fw={600} c="#105476" mb="sm">
                  Previous Messages
                </Text>
                <Card shadow="xs" padding="md" radius="md" withBorder bg="#ffffff" style={{ maxHeight: "300px" }}>
                  <ScrollArea style={{ maxHeight: "250px" }}>
                    <Stack gap="xs">
                      {chatHistory.map((msg, index) => {
                        const isSentByMe =
                          msg.sender === user?.full_name ||
                          msg.sender === user?.username ||
                          msg.sender_id === user?.user_id;
                        const prevMessage = index > 0 ? chatHistory[index - 1] : null;
                        const showSenderHeader =
                          !prevMessage || prevMessage.sender !== msg.sender;
                        const showDateSeparator =
                          !prevMessage ||
                          dayjs(msg.timestamp).format("DD-MM-YYYY") !==
                            dayjs(prevMessage.timestamp).format("DD-MM-YYYY");

                        return (
                          <Box key={index}>
                            {/* Date Separator */}
                            {showDateSeparator && (
                              <Group justify="center" my="md">
                                <Badge
                                  size="sm"
                                  variant="light"
                                  color="gray"
                                  style={{ textTransform: "none" }}
                                >
                                  {dayjs(msg.timestamp).format("DD MMMM YYYY")}
                                </Badge>
                              </Group>
                            )}

                            {/* Message Bubble */}
                            <Group
                              align="flex-start"
                              gap="xs"
                              style={{
                                flexDirection: isSentByMe ? "row-reverse" : "row",
                              }}
                            >
                              <Box
                                style={{
                                  maxWidth: "75%",
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: isSentByMe ? "flex-end" : "flex-start",
                                }}
                              >
                                {/* Sender Name */}
                                {showSenderHeader && (
                                  <Text
                                    size="xs"
                                    fw={600}
                                    c="#105476"
                                    mb={4}
                                    style={{
                                      paddingLeft: isSentByMe ? "0" : "8px",
                                      paddingRight: isSentByMe ? "8px" : "0",
                                    }}
                                  >
                                    {msg.sender}
                                  </Text>
                                )}

                                {/* Message Bubble */}
                                <Box
                                  style={{
                                    backgroundColor: isSentByMe ? "#105476" : "#ffffff",
                                    color: isSentByMe ? "#ffffff" : "#333",
                                    padding: "10px 14px",
                                    borderRadius: isSentByMe
                                      ? "12px 12px 4px 12px"
                                      : "12px 12px 12px 4px",
                                    boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                                    border: isSentByMe
                                      ? "none"
                                      : "1px solid #e9ecef",
                                  }}
                                >
                                  <Text
                                    size="sm"
                                    style={{
                                      whiteSpace: "pre-wrap",
                                      wordBreak: "break-word",
                                      lineHeight: 1.5,
                                      color: isSentByMe ? "#ffffff" : "#333",
                                    }}
                                  >
                                    {msg.message}
                                  </Text>
                                </Box>

                                {/* Timestamp */}
                                <Text
                                  size="xs"
                                  c="dimmed"
                                  mt={4}
                                  style={{
                                    paddingLeft: isSentByMe ? "0" : "8px",
                                    paddingRight: isSentByMe ? "8px" : "0",
                                  }}
                                >
                                  {dayjs(msg.timestamp).format("HH:mm")}
                                </Text>
                              </Box>
                            </Group>
                          </Box>
                        );
                      })}
                    </Stack>
                  </ScrollArea>
                </Card>
              </Box>
            )}

            <Grid>
              <Grid.Col span={12}>
                <Textarea
                  label="New Message (Optional)"
                  placeholder={isEditMode ? "Add a follow-up message..." : "Enter initial message..."}
                  minRows={3}
                  maxRows={5}
                  maxLength={500}
                  {...form.getInputProps("message")}
                  styles={{
                    label: { fontSize: "13px", fontWeight: 500, color: "#495057", marginBottom: "6px" },
                    input: { fontSize: "13px" },
                  }}
                />
                <Text size="xs" c="dimmed" mt={4} ta="right">
                  {form.values.message.length} / 500
                </Text>
              </Grid.Col>
              <Grid.Col span={12}>
                <Select
                  label="Interest Level"
                  placeholder="Select interest level"
                  data={interestLevelOptions}
                  {...form.getInputProps("interest_level")}
                  styles={{
                    label: { fontSize: "13px", fontWeight: 500, color: "#495057", marginBottom: "6px" },
                    input: { fontSize: "13px" },
                  }}
                />
              </Grid.Col>
            </Grid>
          </Card>

          {/* Action Buttons */}
          <Group justify="flex-end" mt="xl">
            <Button
              variant="outline"
              color="#105476"
              onClick={() => {
                const returnTo = (location.state as any)?.returnTo || "/lead";
                navigate(returnTo);
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              color="#105476"
              leftSection={isSubmitting ? <Loader size="sm" /> : isEditMode ? <IconCheck size={18} /> : <IconPlus size={18} />}
              loading={isSubmitting}
              disabled={isSubmitting}
            >
              {isEditMode ? "Update Lead" : "Create Lead"}
            </Button>
          </Group>
        </form>
      </Card>
    </Box>
  );
}

export default CreateLead;

