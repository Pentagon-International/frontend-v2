import {
  Box,
  Button,
  Flex,
  Grid,
  Group,
  Loader,
  Select,
  Text,
  TextInput,
  Center,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconCheck } from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import * as yup from "yup";
import { yupResolver } from "mantine-form-yup-resolver";
import { ToastNotification } from "../../../components";
import { postAPICall } from "../../../service/postApiCall";
import { putAPICall } from "../../../service/putApiCall";
import { URL } from "../../../api/serverUrls";
import { API_HEADER } from "../../../store/storeKeys";

type ChartOfAccountsData = {
  id?: number;
  gl_head: string;
  group_code: string;
  group_name: string;
  subgroup_code: string;
  subgroup_name: string;
  account_name: string;
  gl_account_code: string;
  sl_code: string;
};

const glHeadOptions = [
  { value: "ASSET", label: "ASSET" },
  { value: "LIABILITY", label: "LIABILITY" },
  { value: "INCOME", label: "INCOME" },
  { value: "EXPENDITURE", label: "EXPENDITURE" },
];

const schema = yup.object().shape({
  gl_head: yup.string().required("GL Head is required"),
  group_code: yup.string().required("Group Code is required"),
  group_name: yup.string().required("Group Name is required"),
  subgroup_code: yup.string().required("Subgroup Code is required"),
  subgroup_name: yup.string().required("Subgroup Name is required"),
  account_name: yup.string().required("Account Name is required"),
  gl_account_code: yup.string().required("GL Account Code is required"),
});

function ChartOfAccountsCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const editFormData = location.state as ChartOfAccountsData | undefined;
  const isEditMode = !!editFormData?.id;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ChartOfAccountsData>({
    mode: "controlled",
    initialValues: {
      id: editFormData?.id,
      gl_head: editFormData?.gl_head || "",
      group_code: editFormData?.group_code || "",
      group_name: editFormData?.group_name || "",
      subgroup_code: editFormData?.subgroup_code || "",
      subgroup_name: editFormData?.subgroup_name || "",
      account_name: editFormData?.account_name || "",
      gl_account_code: editFormData?.gl_account_code || "",
      sl_code: editFormData?.sl_code || "",
    },
    validate: yupResolver(schema),
  });

  const handleSubmit = async (values: ChartOfAccountsData): Promise<void> => {
    setIsSubmitting(true);
    try {
      if (isEditMode) {
        // Edit mode: Use PUT request
        const response = await putAPICall(
          URL.chartOfAccounts,
          values,
          API_HEADER,
        );
        ToastNotification({
          type: "success",
          message: "Chart of Accounts updated successfully",
        });
        navigate("/master/chart-of-accounts", {
          state: { refreshData: true },
        });
      } else {
        // Create mode: Use POST request
        const response = await postAPICall(
          URL.chartOfAccounts,
          values,
          API_HEADER,
        );
        ToastNotification({
          type: "success",
          message: "Chart of Accounts created successfully",
        });
        navigate("/master/chart-of-accounts", {
          state: { refreshData: true },
        });
      }
    } catch (err: any) {
      ToastNotification({
        type: "error",
        message: `Error while ${isEditMode ? "updating" : "creating"} Chart of Accounts: ${err?.message || "Unknown error"}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box
      component="form"
      style={{
        backgroundColor: "#F8F8F8",
        position: "relative",
        borderRadius: "8px",
        overflow: "hidden",
      }}
      onSubmit={form.onSubmit(handleSubmit)}
    >
      {isSubmitting && (
        <Center
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(255, 255, 255, 0.65)",
            zIndex: 15,
          }}
        >
          <Loader color="#105476" size="lg" />
        </Center>
      )}

      <Box p="sm" mx="auto" style={{ backgroundColor: "#F8F8F8" }}>
        <Flex
          gap="md"
          align="flex-start"
          style={{ height: "calc(100vh - 112px)", width: "100%" }}
        >
          {/* Vertical Sidebar */}
          <Box
            style={{
              minWidth: 240,
              width: "100%",
              maxWidth: 250,
              height: "100%",
              alignSelf: "stretch",
              borderRadius: "8px",
              backgroundColor: "#FFFFFF",
              position: "sticky",
              top: 0,
            }}
          >
            <Box
              style={{
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
              }}
            >
              <Text
                size="md"
                fw={600}
                c="#105476"
                style={{
                  fontFamily: "Inter",
                  fontStyle: "medium",
                  fontSize: "16px",
                  color: "#105476",
                  textAlign: "center",
                }}
              >
                {isEditMode
                  ? "Edit Chart of Accounts"
                  : "Create Chart of Accounts"}
              </Text>
              {/* <Text
                size="sm"
                fw={500}
                style={{
                  fontFamily: "Inter",
                  fontStyle: "medium",
                  color: "#444953",
                  textAlign: "center",
                }}
              >
                {isEditMode ? "Update account details" : "Fill in account details to create a new chart of accounts entry"}
              </Text> */}
            </Box>
          </Box>

          {/* Main Content Area */}
          <Box
            style={{
              flex: 1,
              width: "100%",
              borderRadius: "8px",
              display: "flex",
              flexDirection: "column",
              height: "100%",
              overflow: "hidden",
              gap: "8px",
            }}
          >
            <Box
              style={{
                flex: 1,
                overflowY: "auto",
                borderRadius: "8px",
                backgroundColor: "#FFFFFF",
              }}
            >
              <Grid style={{ padding: "24px" }}>
                {/* Account Information Section */}
                <Grid.Col span={12}>
                  <Box mb="md">
                    {/* <Text size="md" fw={600} c="#105476" mb="md" style={{ borderBottom: "2px solid #105476", paddingBottom: "8px", fontFamily: "Inter" }}>
                      Account Information
                    </Text> */}
                    <Grid>
                      <Grid.Col span={6}>
                        <Select
                          label="GL Head"
                          placeholder="Select GL Head"
                          data={glHeadOptions}
                          {...form.getInputProps("gl_head")}
                          styles={{
                            label: {
                              fontSize: "13px",
                              fontWeight: 500,
                              color: "#495057",
                              marginBottom: "6px",
                              fontFamily: "Inter",
                            },
                            input: {
                              fontSize: "13px",
                              height: "36px",
                              fontFamily: "Inter",
                            },
                          }}
                        />
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <TextInput
                          label="Account Name"
                          placeholder="Enter Account Name"
                          {...form.getInputProps("account_name")}
                          styles={{
                            label: {
                              fontSize: "13px",
                              fontWeight: 500,
                              color: "#495057",
                              marginBottom: "6px",
                              fontFamily: "Inter",
                            },
                            input: {
                              fontSize: "13px",
                              height: "36px",
                              fontFamily: "Inter",
                            },
                          }}
                        />
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <TextInput
                          label="GL Account Code"
                          placeholder="Enter GL Account Code"
                          {...form.getInputProps("gl_account_code")}
                          styles={{
                            label: {
                              fontSize: "13px",
                              fontWeight: 500,
                              color: "#495057",
                              marginBottom: "6px",
                              fontFamily: "Inter",
                            },
                            input: {
                              fontSize: "13px",
                              height: "36px",
                              fontFamily: "Inter",
                            },
                          }}
                        />
                      </Grid.Col>

                      <Grid.Col span={6}>
                        <TextInput
                          label="SL Code"
                          placeholder="Enter SL Code"
                          {...form.getInputProps("sl_code")}
                          styles={{
                            label: {
                              fontSize: "13px",
                              fontWeight: 500,
                              color: "#495057",
                              marginBottom: "6px",
                              fontFamily: "Inter",
                            },
                            input: {
                              fontSize: "13px",
                              height: "36px",
                              fontFamily: "Inter",
                            },
                          }}
                        />
                      </Grid.Col>
                    </Grid>
                  </Box>
                </Grid.Col>

                {/* Group Information Section */}
                <Grid.Col span={12}>
                  <Box mb="md">
                    {/* <Text size="md" fw={600} c="#105476" mb="md" style={{ borderBottom: "2px solid #105476", paddingBottom: "8px", fontFamily: "Inter" }}>
                      Group Information
                    </Text> */}
                    <Grid>
                      <Grid.Col span={6}>
                        <TextInput
                          label="Group Name"
                          placeholder="Enter Group Name"
                          {...form.getInputProps("group_name")}
                          styles={{
                            label: {
                              fontSize: "13px",
                              fontWeight: 500,
                              color: "#495057",
                              marginBottom: "6px",
                              fontFamily: "Inter",
                            },
                            input: {
                              fontSize: "13px",
                              height: "36px",
                              fontFamily: "Inter",
                            },
                          }}
                        />
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <TextInput
                          label="Group Code"
                          placeholder="Enter Group Code"
                          {...form.getInputProps("group_code")}
                          styles={{
                            label: {
                              fontSize: "13px",
                              fontWeight: 500,
                              color: "#495057",
                              marginBottom: "6px",
                              fontFamily: "Inter",
                            },
                            input: {
                              fontSize: "13px",
                              height: "36px",
                              fontFamily: "Inter",
                            },
                          }}
                        />
                      </Grid.Col>
                    </Grid>
                  </Box>
                </Grid.Col>

                {/* Subgroup Information Section */}
                <Grid.Col span={12}>
                  <Box mb="md">
                    {/* <Text size="md" fw={600} c="#105476" mb="md" style={{ borderBottom: "2px solid #105476", paddingBottom: "8px", fontFamily: "Inter" }}>
                      Subgroup Information
                    </Text> */}
                    <Grid>
                      <Grid.Col span={6}>
                        <TextInput
                          label="Subgroup Name"
                          placeholder="Enter Subgroup Name"
                          {...form.getInputProps("subgroup_name")}
                          styles={{
                            label: {
                              fontSize: "13px",
                              fontWeight: 500,
                              color: "#495057",
                              marginBottom: "6px",
                              fontFamily: "Inter",
                            },
                            input: {
                              fontSize: "13px",
                              height: "36px",
                              fontFamily: "Inter",
                            },
                          }}
                        />
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <TextInput
                          label="Subgroup Code"
                          placeholder="Enter Subgroup Code"
                          {...form.getInputProps("subgroup_code")}
                          styles={{
                            label: {
                              fontSize: "13px",
                              fontWeight: 500,
                              color: "#495057",
                              marginBottom: "6px",
                              fontFamily: "Inter",
                            },
                            input: {
                              fontSize: "13px",
                              height: "36px",
                              fontFamily: "Inter",
                            },
                          }}
                        />
                      </Grid.Col>
                    </Grid>
                  </Box>
                </Grid.Col>
              </Grid>
            </Box>

            {/* Footer Buttons */}
            <Box
              style={{
                padding: "20px 32px",
                backgroundColor: "#ffffff",
                borderRadius: "8px",
              }}
            >
              <Group justify="space-between">
                <Group gap="sm">
                  <Button
                    variant="outline"
                    color="gray"
                    size="sm"
                    styles={{
                      root: {
                        borderColor: "#d0d0d0",
                        color: "#666",
                        fontSize: "13px",
                        fontFamily: "Inter",
                        fontStyle: "medium",
                      },
                    }}
                    onClick={() => navigate("/master/chart-of-accounts")}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                </Group>

                <Group gap="sm">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSubmitting}
                    style={{
                      backgroundColor: isSubmitting ? "#105476BB" : "#105476",
                      fontSize: "13px",
                      fontFamily: "Inter",
                      fontStyle: "medium",
                    }}
                    leftSection={<IconCheck size={16} />}
                  >
                    {isEditMode ? "Update" : "Create"}
                  </Button>
                </Group>
              </Group>
            </Box>
          </Box>
        </Flex>
      </Box>
    </Box>
  );
}

export default ChartOfAccountsCreate;
