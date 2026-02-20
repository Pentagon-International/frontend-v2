import { useEffect, useState } from "react";
import { Box, Button, Flex, Grid, Group, Text, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconCheck } from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import * as yup from "yup";
import { yupResolver } from "mantine-form-yup-resolver";
import { postAPICall } from "../../../service/postApiCall";
import { putAPICall } from "../../../service/putApiCall";
import { API_HEADER } from "../../../store/storeKeys";
import { ToastNotification } from "../../../components";
import { URL } from "../../../api/serverUrls";

type GSTSACFormData = {
  sac_code: string;
  sac_name: string;
};

const schema = yup.object().shape({
  sac_code: yup.string().required("SAC code is required"),
  sac_name: yup.string().required("SAC name is required"),
});

export default function GSTSACCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const editData = (location.state as GSTSACFormData & { id?: number }) || null;
  const isEditMode = !!editData?.id;

  const form = useForm<GSTSACFormData>({
    initialValues: {
      sac_code: "",
      sac_name: "",
    },
    validate: yupResolver(schema),
  });

  useEffect(() => {
    if (isEditMode && editData) {
      form.setValues({
        sac_code: editData.sac_code || "",
        sac_name: editData.sac_name || "",
      });
    }
  }, [isEditMode, editData]);

  const handleSubmit = async (values: GSTSACFormData) => {
    setIsSubmitting(true);

    try {
      if (isEditMode) {
        const updateData = {
          ...values,
          id: editData.id,
        };
        await putAPICall(URL.gstSacMaster, updateData, API_HEADER);
        ToastNotification({
          type: "success",
          message: "GST SAC updated successfully",
        });
      } else {
        await postAPICall(URL.gstSacMaster, values, API_HEADER);
        ToastNotification({
          type: "success",
          message: "GST SAC created successfully",
        });
      }

      navigate("/master/gst-sac");
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      ToastNotification({
        type: "error",
        message: `Error ${isEditMode ? "updating" : "creating"} GST SAC: ${errorMessage}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate("/master/gst-sac");
  };

  return (
    <Box
      component="form"
      onSubmit={form.onSubmit(handleSubmit)}
      style={{
        backgroundColor: "#F8F8F8",
        position: "relative",
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      <Box p="sm" mx="auto" style={{ backgroundColor: "#F8F8F8" }}>
        <Flex
          gap="md"
          align="flex-start"
          style={{ height: "calc(100vh - 112px)", width: "100%" }}
        >
          {/* Side Heading Area */}
          <Box
            style={{
              minWidth: 180,
              width: "100%",
              maxWidth: 220,
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
                alignItems: "center",
                justifyContent: "center",
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
                {isEditMode ? "Edit GST SAC" : "Create GST SAC"}
              </Text>
            </Box>
          </Box>

          {/* Main Content Area */}
          <Box
            style={{
              flex: 1,
              borderRadius: "8px",
              display: "flex",
              flexDirection: "column",
              height: "100%",
              overflow: "hidden",
            }}
          >
            <Box
              style={{
                flex: 1,
                overflowY: "auto",
                paddingBottom: "8px",
                backgroundColor: "#F8F8F8",
              }}
            >
              <Grid
                style={{
                  backgroundColor: "#FFFFFF",
                  height: "100%",
                  borderRadius: "8px",
                  padding: "24px",
                }}
              >
                <Grid.Col span={6}>
                  <TextInput
                    label="SAC Code"
                    placeholder="Enter SAC code"
                    withAsterisk
                    {...form.getInputProps("sac_code")}
                    styles={{
                      input: {
                        fontSize: "13px",
                        fontFamily: "Inter",
                      },
                      label: {
                        fontSize: "13px",
                        fontWeight: 500,
                        color: "#424242",
                        marginBottom: "4px",
                        fontFamily: "Inter",
                        fontStyle: "medium",
                      },
                    }}
                  />
                </Grid.Col>

                <Grid.Col span={6}>
                  <TextInput
                    label="SAC Name"
                    placeholder="Enter SAC name"
                    withAsterisk
                    {...form.getInputProps("sac_name")}
                    styles={{
                      input: {
                        fontSize: "13px",
                        fontFamily: "Inter",
                      },
                      label: {
                        fontSize: "13px",
                        fontWeight: 500,
                        color: "#424242",
                        marginBottom: "4px",
                        fontFamily: "Inter",
                        fontStyle: "medium",
                      },
                    }}
                  />
                </Grid.Col>
              </Grid>
            </Box>

            {/* Footer Buttons */}
            <Box
              style={{
                borderRadius: "8px",
                padding: "20px 32px",
                backgroundColor: "#ffffff",
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
                    onClick={handleCancel}
                  >
                    Cancel
                  </Button>
                </Group>

                <Group gap="sm">
                  <Button
                    type="submit"
                    size="sm"
                    loading={isSubmitting}
                    disabled={isSubmitting}
                    style={{
                      backgroundColor: "#105476",
                      fontSize: "13px",
                      fontFamily: "Inter",
                      fontStyle: "medium",
                      cursor: isSubmitting ? "not-allowed" : "pointer",
                    }}
                    rightSection={<IconCheck size={16} />}
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
