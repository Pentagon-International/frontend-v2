import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Card,
  Button,
  Grid,
  Text,
  TextInput,
  Textarea,
  Group,
  ActionIcon,
  Stack,
  Box,
  Checkbox,
} from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { SearchableSelect, ToastNotification } from "../../components";
import { URL } from "../../api/serverUrls";
import { postAPICall } from "../../service/postApiCall";
import { getAPICall } from "../../service/getApiCall";
import { API_HEADER } from "../../store/storeKeys";
import { useForm } from "@mantine/form";
import * as yup from "yup";
import { yupResolver } from "mantine-form-yup-resolver";
import { toTitleCase } from "../../utils/textFormatter";

type RateRequestRow = {
  agent_vendor: string | null;
  email: string;
  special_instructions: string;
  cc_email: string;
};

const GetRate = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [salespersonEmail, setSalespersonEmail] = useState<string>("");
  const [specialInstructionDefault, setSpecialInstructionDefault] =
    useState<string>("");
  const [recentRateRequests, setRecentRateRequests] = useState<any[]>([]);

  const enquiryData = useMemo(
    () =>
      (location.state as {
        id?: string | number;
        enquiry_id?: string;
        customer_name?: string;
        services?: Array<{
          id?: number;
          stackable?: boolean;
          hazardous_cargo?: boolean;
          origin_name?: string;
          destination_name?: string;
          shipment_terms_code_read?: string;
          service?: string;
        }>;
        sales_person?: string;
        salesperson_email?: string;
        documents_list?: Array<{
          id?: number;
          document_name?: string;
        }>;
        rate_requests?: Array<{
          enquiry?: string;
          email_id?: string;
          cc_email?: string;
          special_instructions?: string;
        }>;
      } | null) || null,
    [location.state]
  );

  const enquiryId: string | number | null = useMemo(() => {
    const id = enquiryData?.id as string | number | undefined;
    if (id === undefined || id === null) return null;
    return String(id);
  }, [enquiryData]);

  // Helper function to parse emails from comma or semicolon separated string
  const parseEmails = (emailString: string): string[] => {
    if (!emailString || !emailString.trim()) return [];
    // Split by comma or semicolon, then trim each email
    return emailString
      .split(/[,;]/)
      .map((email) => email.trim())
      .filter((email) => email.length > 0);
  };

  // Helper function to validate email format
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validationSchema = yup.object({
    // enquiry_id: yup.mixed().required("Enquiry is required"),
    subject: yup.string().trim().required("Subject is required"),
    document_id: yup.array().of(yup.number()).nullable(),
    rate_request_list: yup
      .array()
      .of(
        yup.object({
          agent_vendor: yup
            .string()
            .trim()
            .required("Agent / Vendor is required"),
          email: yup
            .string()
            .trim()
            .required("Email is required")
            .test(
              "valid-emails",
              "Please enter valid email address(es) separated by comma or semicolon",
              function (value) {
                if (!value || !value.trim()) return false;
                const emails = parseEmails(value);
                if (emails.length === 0) return false;
                // Validate each email
                return emails.every((email) => isValidEmail(email));
              }
            ),
          special_instructions: yup.string().trim().nullable(),
          cc_email: yup
            .string()
            .trim()
            .nullable()
            .test(
              "valid-emails",
              "Please enter valid email address(es) separated by comma or semicolon",
              function (value) {
                if (!value || !value.trim()) return true; // Optional field
                const emails = parseEmails(value);
                if (emails.length === 0) return true; // Empty is valid
                // Validate each email
                return emails.every((email) => isValidEmail(email));
              }
            ),
        })
      )
      .min(1, "Add at least one request"),
  });

  // Function to generate default subject
  const generateDefaultSubject = useMemo((): string => {
    if (!enquiryData) return "";

    const enquiryId = enquiryData.enquiry_id || "";
    const services = enquiryData.services || [];
    const customerName = enquiryData.customer_name || "";

    // Get data from first service
    const firstService = services[0];
    if (!firstService) return enquiryId;

    const originName = firstService.origin_name || "";
    const destinationName = firstService.destination_name || "";
    const shipmentTerms = firstService.shipment_terms_code_read || "";
    const service = firstService.service || "";

    // Format: enquiry_id//origin_name TO destination_name//shipment_terms//service//customer_name
    const parts = [
      enquiryId,
      originName && destinationName
        ? `${originName.toUpperCase()} TO ${destinationName.toUpperCase()}`
        : "",
      shipmentTerms,
      service,
      customerName.toUpperCase(),
    ].filter((part) => part !== "");

    return parts.join("//");
  }, [enquiryData]);

  const [selectedDocuments, setSelectedDocuments] = useState<number[]>([]);

  const form = useForm<{
    enquiry_id: string | null;
    subject: string;
    document_id: number[];
    rate_request_list: RateRequestRow[];
  }>({
    initialValues: {
      enquiry_id: enquiryId,
      subject: generateDefaultSubject,
      document_id: [],
      rate_request_list: [
        {
          agent_vendor: null,
          email: "",
          special_instructions: "",
          cc_email: "",
        },
      ],
    },
    validate: yupResolver(validationSchema),
    validateInputOnChange: true,
  });

  // Generate special instruction and set salesperson email from enquiryData
  useEffect(() => {
    if (!enquiryId) {
      ToastNotification({
        type: "error",
        message: "Missing enquiry id. Open this page from Enquiry list.",
      });
      return;
    }

    if (!enquiryData) {
      return;
    }

    // Set default subject when enquiryData is available
    if (generateDefaultSubject) {
      // Only set if subject is empty or matches the pattern (to avoid overwriting user edits)
      if (!form.values.subject || form.values.subject === "") {
        form.setFieldValue("subject", generateDefaultSubject);
      }
    }

    // Generate special instruction from services
    const services = enquiryData.services || [];
    const instructions: string[] = [];
    let hasNonStackable = false;
    let hasHazardousCargo = false;

    services.forEach((service: any) => {
      if (service.stackable === false && !hasNonStackable) {
        instructions.push("Non Stackable");
        hasNonStackable = true;
      }
      if (service.hazardous_cargo === true && !hasHazardousCargo) {
        instructions.push("Hazardous Cargo");
        hasHazardousCargo = true;
      }
    });

    const defaultInstruction = instructions.join(", ");
    setSpecialInstructionDefault(defaultInstruction);

    // Set default special instruction for all rows
    form.values.rate_request_list.forEach((_, index) => {
      if (!form.values.rate_request_list[index].special_instructions) {
        form.setFieldValue(
          `rate_request_list.${index}.special_instructions`,
          defaultInstruction
        );
      }
    });

    // Handle salesperson email - check if it's already in enquiryData first
    if (enquiryData.salesperson_email) {
      setSalespersonEmail(enquiryData.salesperson_email);
      form.values.rate_request_list.forEach((_, index) => {
        if (!form.values.rate_request_list[index].cc_email) {
          form.setFieldValue(
            `rate_request_list.${index}.cc_email`,
            enquiryData.salesperson_email
          );
        }
      });
    } else if (enquiryData.sales_person) {
      // Fallback: Fetch salesperson email from API if not in enquiryData
      const fetchSalespersonEmail = async () => {
        try {
          const salespersonsResponse = (await getAPICall(
            `${URL.salespersons}`,
            API_HEADER
          )) as any;

          const salespersonsList = Array.isArray(salespersonsResponse)
            ? salespersonsResponse
            : salespersonsResponse?.data || [];

          if (salespersonsList && Array.isArray(salespersonsList)) {
            const salesperson = salespersonsList.find(
              (sp: any) =>
                sp.full_name === enquiryData.sales_person ||
                sp.user_name === enquiryData.sales_person
            );

            if (salesperson && salesperson.email_id) {
              setSalespersonEmail(salesperson.email_id);
              form.values.rate_request_list.forEach((_, index) => {
                if (!form.values.rate_request_list[index].cc_email) {
                  form.setFieldValue(
                    `rate_request_list.${index}.cc_email`,
                    salesperson.email_id
                  );
                }
              });
            }
          }
        } catch (emailError) {
          console.error("Error fetching salesperson email:", emailError);
        }
      };
      fetchSalespersonEmail();
    }
  }, [enquiryId, enquiryData]);

  useEffect(() => {
    if (!enquiryId) {
      return;
    }
    if (form.values.enquiry_id !== enquiryId) {
      form.setFieldValue("enquiry_id", enquiryId);
    }
  }, [enquiryId, form]);

  // Extract recent rate requests from location.state or enquiryData
  useEffect(() => {
    if (location.state) {
      const stateData = location.state as any;
      
      // Check if rate_requests array exists in location.state
      if (stateData.rate_requests && Array.isArray(stateData.rate_requests)) {
        setRecentRateRequests(stateData.rate_requests.slice(0, 5)); // Get latest 5
      } 
      // Check if rate_request data exists as a single object or array in location.state
      else if (stateData.rate_request) {
        const rateRequestData = Array.isArray(stateData.rate_request) 
          ? stateData.rate_request 
          : [stateData.rate_request];
        setRecentRateRequests(rateRequestData.slice(0, 5));
      }
      // Check if enquiryData has rate request information
      else if (enquiryData && (enquiryData as any).rate_requests) {
        const rateRequests = (enquiryData as any).rate_requests;
        setRecentRateRequests(
          Array.isArray(rateRequests) ? rateRequests.slice(0, 5) : []
        );
      }
      // If no rate request data found, set empty array
      else {
        setRecentRateRequests([]);
      }
    } else {
      setRecentRateRequests([]);
    }
  }, [location.state, enquiryData]);

  const addRowBelow = (index: number) => {
    form.insertListItem(
      "rate_request_list",
      {
        agent_vendor: null,
        email: "",
        special_instructions: specialInstructionDefault,
        cc_email: salespersonEmail,
      },
      index + 1
    );
  };

  const removeRow = (index: number) => {
    const current = form.values.rate_request_list;
    if (current.length === 1) {
      form.setFieldValue("rate_request_list", [
        {
          agent_vendor: null,
          email: "",
          special_instructions: specialInstructionDefault,
          cc_email: salespersonEmail,
        },
      ]);
      return;
    }
    form.removeListItem("rate_request_list", index);
  };

  const updateRow = (
    index: number,
    key: keyof RateRequestRow,
    value: string | null
  ) => {
    form.setFieldValue(
      `rate_request_list.${index}.${key}`,
      value as string | null
    );
  };

  const updateRowText = (
    index: number,
    key: keyof RateRequestRow,
    value: string
  ) => {
    form.setFieldValue(`rate_request_list.${index}.${key}`, value);
  };

  const handleSubmit = async () => {
    const validation = form.validate();
    if (validation.hasErrors) return;
    if (!enquiryId) {
      ToastNotification({ type: "error", message: "Enquiry ID not found" });
      return;
    }

    const rate_request_list = form.values.rate_request_list
      .filter((r) => r.agent_vendor && (r.email || "").trim())
      .map((r) => ({
        agent_vendor: r.agent_vendor as string,
        email: r.email,
        special_instructions: r.special_instructions || "",
        cc_email: r.cc_email || "",
      }));

    if (rate_request_list.length === 0) {
      ToastNotification({
        type: "error",
        message: "Add at least one Agent/Vendor and Email",
      });
      return;
    }

    const payload = {
      enquiry_id: enquiryData?.id,
      enquiry_service_id:
        enquiryData?.services
          ?.map((service) => service.id)
          .filter((id): id is number => id !== undefined) || [],
      document_id: selectedDocuments,
      subject: form.values.subject,
      rate_request_list,
    } as const;

    try {
      const res = await postAPICall(URL.rateRequest, payload);
      console.log("Get Rate response:", res);
      ToastNotification({ type: "success", message: "Rate request submitted" });

      // Trigger email for each agent/vendor after successful submission
      if (enquiryData && enquiryData.id) {
        // Extract enquiry_service_id from enquiry services
        const enquiryServiceIds =
          enquiryData.services
            ?.map((service) => service.id)
            .filter((id): id is number => id !== undefined) || [];

        if (enquiryServiceIds.length > 0) {
          // Send email for each agent/vendor row
          // Each row's email field value may contain multiple emails separated by comma or semicolon
          const emailPromises = rate_request_list.map(async (item) => {
            try {
              // Parse emails from the email field (may contain multiple emails as comma/semicolon separated string)
              const emailString = item.email.trim();

              if (!emailString) {
                return; // Skip if email is empty
              }

              // Parse emails into array (always send as array, even for single email)
              const toEmailArray = parseEmails(emailString);

              if (toEmailArray.length === 0) {
                return; // Skip if no valid emails found
              }

              // Parse CC emails from the cc_email field
              const ccEmailString = (item.cc_email || "").trim();
              const ccEmailArray = parseEmails(ccEmailString);

              const emailPayload = {
                enquiry_id: enquiryData.id,
                enquiry_service_id: enquiryServiceIds,
                document_id: selectedDocuments,
                subject: form.values.subject,
                to_email: toEmailArray, // Always send as array, e.g., ["email1@gmail.com", "email2@gmail.com"]
                cc_email: ccEmailArray, // Array of CC emails
                special_instructions: (item.special_instructions || "").trim(),
              };

              await postAPICall(URL.rateRequestSendEmail, emailPayload);
              console.log(
                `Email sent successfully to: ${toEmailArray.join(", ")}`
              );
            } catch (emailError) {
              console.error(
                `Error sending email for agent ${item.agent_vendor}:`,
                emailError
              );
              // Don't show error toast for email failures, just log it
            }
          });

          // Wait for all emails to be sent (but don't block navigation)
          Promise.all(emailPromises).catch((error) => {
            console.error("Error sending some emails:", error);
          });
        }
      }

      navigate(-1);
    } catch (error: unknown) {
      console.error("Get Rate submit error:", error);
      ToastNotification({
        type: "error",
        message: "Please Enter Valid Email address",
      });
    }
  };

  return (
    <Card shadow="sm" padding="xs" radius="md">
      <Group justify="space-between" mb="md">
        <Text size="md" fw={600} c="#105476">
          Get Rate
        </Text>
      </Group>

      <Stack gap="sm">
        {form.values.rate_request_list.map((row, index) => (
          <Box
            key={`rate-row-${index}`}
            p="md"
            style={{ border: "1px solid #e0e0e0", borderRadius: "4px" }}
          >
            <Stack gap="sm">
              {/* First Row: Agent/Vendor and Email */}
              <Grid>
                <Grid.Col span={5}>
                  <SearchableSelect
                    size="xs"
                    label="Agent / Vendor"
                    placeholder="Type agent/vendor"
                    apiEndpoint={URL.customer}
                    searchFields={["customer_code", "customer_name"]}
                    returnOriginalData
                    displayFormat={(item: Record<string, unknown>) => ({
                      value: String(item.customer_code),
                      label: String(item.customer_name),
                    })}
                    value={row.agent_vendor}
                    onChange={(value, _selected, original) => {
                      updateRow(index, "agent_vendor", value || null);
                      const selectedData = original as unknown as {
                        addresses_data?: Array<{
                          email?: string | null | undefined;
                        }>;
                      } | null;
                      const emailFromSelected = (() => {
                        const addresses = selectedData?.addresses_data || [];
                        const found = addresses.find(
                          (a) => (a?.email || "").trim() !== ""
                        );
                        return (found?.email || "").trim();
                      })();
                      console.log("emailFromSelected---", emailFromSelected);

                      if (emailFromSelected) {
                        updateRow(index, "email", emailFromSelected);
                      }
                    }}
                    minSearchLength={3}
                    className="filter-searchable-select"
                    error={
                      (form.errors[
                        `rate_request_list.${index}.agent_vendor`
                      ] as string) || undefined
                    }
                  />
                </Grid.Col>
                <Grid.Col span={5}>
                  <TextInput
                    label="Email"
                    placeholder="name@example.com, name2@example.com or name@example.com; name2@example.com"
                    size="xs"
                    value={row.email}
                    onChange={(e) =>
                      updateRow(index, "email", e.currentTarget.value)
                    }
                    error={
                      (form.errors[
                        `rate_request_list.${index}.email`
                      ] as string) || undefined
                    }
                  />
                </Grid.Col>
                <Grid.Col span={2}>
                  <Box mt="1.625rem">
                    <Group gap="xs">
                      <ActionIcon
                        variant="light"
                        color="#105476"
                        onClick={() => addRowBelow(index)}
                        aria-label="Add row"
                      >
                        <IconPlus size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="light"
                        color="red"
                        onClick={() => removeRow(index)}
                        aria-label="Remove row"
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Box>
                </Grid.Col>
              </Grid>

              {/* Second Row: Special Instruction and CC Email */}
              <Grid>
                <Grid.Col span={5}>
                  <Textarea
                    label="Special Instruction"
                    placeholder="Enter special instructions"
                    size="xs"
                    minRows={3}
                    maxRows={6}
                    value={row.special_instructions}
                    onChange={(e) => {
                      const formattedValue = toTitleCase(e.currentTarget.value);
                      updateRowText(
                        index,
                        "special_instructions",
                        formattedValue
                      );
                    }}
                    error={
                      (form.errors[
                        `rate_request_list.${index}.special_instructions`
                      ] as string) || undefined
                    }
                  />
                </Grid.Col>
                <Grid.Col span={5}>
                  <TextInput
                    label="CC Email"
                    placeholder="cc@example.com, cc2@example.com"
                    size="xs"
                    value={row.cc_email}
                    onChange={(e) =>
                      updateRowText(index, "cc_email", e.currentTarget.value)
                    }
                    error={
                      (form.errors[
                        `rate_request_list.${index}.cc_email`
                      ] as string) || undefined
                    }
                  />
                </Grid.Col>
              </Grid>
            </Stack>
          </Box>
        ))}

        {/* Subject Field */}
        <TextInput
          label="Subject"
          placeholder="Enter subject"
          size="xs"
          my={"sm"}
          value={form.values.subject}
          onChange={(e) => form.setFieldValue("subject", e.currentTarget.value)}
          error={form.errors.subject as string | undefined}
        />

        {/* Document Checkboxes */}
        {enquiryData?.documents_list &&
          enquiryData.documents_list.length > 0 && (
            <Box
              p="md"
              style={{ border: "1px solid #e0e0e0", borderRadius: "4px" }}
            >
              <Text size="sm" fw={500} mb="sm">
                Supporting Documents
              </Text>
              <Stack gap="xs">
                {enquiryData.documents_list.map((doc) => (
                  <Checkbox
                    my={3}
                    key={doc.id}
                    label={doc.document_name || `Document ${doc.id}`}
                    checked={selectedDocuments.includes(doc.id || 0)}
                    onChange={(e) => {
                      const docId = doc.id || 0;
                      let updatedDocuments: number[];
                      if (e.currentTarget.checked) {
                        updatedDocuments = [...selectedDocuments, docId];
                      } else {
                        updatedDocuments = selectedDocuments.filter(
                          (id) => id !== docId
                        );
                      }
                      setSelectedDocuments(updatedDocuments);
                      form.setFieldValue("document_id", updatedDocuments);
                    }}
                  />
                ))}
              </Stack>
            </Box>
          )}
      </Stack>

      <Group justify="space-between" mt="lg">
        <Button
          variant="outline"
          color="#105476"
          size="xs"
          onClick={() => {
            // Restore filter state if preserved
            const preserveFilters = (location.state as any)?.preserveFilters;

            if (preserveFilters) {
              navigate("/enquiry", {
                state: {
                  restoreFilters: preserveFilters,
                  refreshData: true,
                },
              });
            } else {
              navigate("/enquiry", {
                state: { refreshData: true },
              });
            }
          }}
        >
          Back
        </Button>
        <Button
          color="#105476"
          size="xs"
          onClick={() => form.onSubmit(handleSubmit)()}
        >
          Submit
        </Button>
      </Group>
      {/* Recent Rate Requests Section */}
      {recentRateRequests.length > 0 && (
        <Box mt="lg">
          <Group style={{alignItems:"center",justifyContent:"flex-start", gap:5}} mb="md">
            <Text size="md" fw={600} c="#105476">
              Recent Rate Requests 
            </Text>
            {recentRateRequests &&
            <Text fw={500} c="#105476" size="sm">{`(${recentRateRequests[0]?.enquiry})`}</Text>
            }
          </Group>
          <Grid gutter="md">
              {recentRateRequests.map((rateRequest, index) => (
                <Grid.Col key={`rate-request-${index}`} span={12}>
                  <Card
                    shadow="md"
                    padding="md"
                    radius="md"
                    withBorder
                    sx={{
                      border: "1px solid #e0e0e0",
                      backgroundColor: "#ffffff",
                      height: "100%",
                      transition: "all 0.2s ease",
                      cursor: "pointer",
                      "&:hover": {
                        borderColor: "#105476",
                        boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
                      },
                    }}
                  >
                    <Stack gap="sm">
                      <Grid gutter="md">
                        <Grid.Col span={8}>
                          <Text size="sm" fw={600} c="#105476" mb={4}>Subject</Text>
                          <Text size="sm" fw={500} c="#333" mb={4} truncate>{rateRequest.subject || "-"}</Text>
                        </Grid.Col>
                        <Grid.Col span={4}>
                        <Text size="sm" fw={600} c="#105476" mb={4}>
                           Agent / Vendor Name
                          </Text>
                          <Text size="sm" fw={500} c="#333" mb={4}>{rateRequest.agent_vendor_name || "-"}</Text>
                        </Grid.Col>
                      </Grid>
                      <Box style={{display:"flex", justifyContent:"justify-between", alignItems:"center", gap:20}}>
                        <Box style={{flex:1}}>
                          <Text size="sm" fw={600} c="#105476" mb={4}>
                            Email ID
                          </Text>
                          <Text size="sm" fw={500} c="#333">
                            {rateRequest.email_id || "-"}
                          </Text>
                        </Box>
                        <Box style={{flex:1}}>
                          <Text size="sm" fw={600} c="#105476" mb={4}>
                            CC Email
                          </Text>
                          <Text size="sm" fw={500} c="#333">
                            {rateRequest.cc_email || "-"}
                          </Text>
                        </Box>
                        <Box style={{flex:1}}>
                          <Text size="sm" fw={600} c="#105476" mb={4}>
                            Special Instructions
                          </Text>
                          <Text
                            size="sm"
                            fw={500}
                            c="#333"
                            style={{
                              display: "-webkit-box",
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                              lineHeight: "1.4",
                            }}
                            truncate
                          >
                            {rateRequest.special_instructions || "-"}
                          </Text>
                        </Box>
                      </Box>
                    </Stack>
                  </Card>
                </Grid.Col>
              ))}
            </Grid>
        </Box>
      )}

    </Card>
  );
};

export default GetRate;
