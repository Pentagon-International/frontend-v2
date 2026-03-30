import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Flex,
  Grid,
  Group,
  Text,
  TextInput,
} from "@mantine/core";
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

type TdsSectionFormData = {
  tds_section_code: string;
  tds_section_name: string;
  tds_section_rate: string;
};

const schema = yup.object().shape({
  tds_section_code: yup.string().required("TDS section code is required"),
  tds_section_name: yup.string().required("TDS section name is required"),
  tds_section_rate: yup
    .string()
    .required("Rate is required")
    .matches(
      /^\d+(\.\d{1,2})?$/,
      "Enter a valid rate (e.g. 30 or 30.00)",
    ),
});

export default function TdsSectionCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const editData =
    (location.state as TdsSectionFormData & { id?: number }) || null;
  const isEditMode = !!editData?.id;

  const form = useForm<TdsSectionFormData>({
    initialValues: {
      tds_section_code: "",
      tds_section_name: "",
      tds_section_rate: "",
    },
    validate: yupResolver(schema),
  });

  useEffect(() => {
    if (isEditMode && editData) {
      form.setValues({
        tds_section_code: editData.tds_section_code ?? "",
        tds_section_name: editData.tds_section_name ?? "",
        tds_section_rate:
          editData.tds_section_rate !== undefined &&
          editData.tds_section_rate !== null
            ? String(editData.tds_section_rate)
            : "",
      });
    }
  }, [isEditMode, editData]);

  const handleSubmit = async (values: TdsSectionFormData) => {
    setIsSubmitting(true);

    try {
      if (isEditMode) {
        const updateData = {
          ...values,
          id: editData!.id,
        };
        await putAPICall(URL.tdsSectionMaster, updateData, API_HEADER);
        ToastNotification({
          type: "success",
          message: "TDS section updated successfully",
        });
      } else {
        await postAPICall(URL.tdsSectionMaster, values, API_HEADER);
        ToastNotification({
          type: "success",
          message: "TDS section created successfully",
        });
      }

      navigate("/master/tds-section");
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      ToastNotification({
        type: "error",
        message: `Error ${isEditMode ? "updating" : "creating"} TDS section: ${errorMessage}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate("/master/tds-section");
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
                {isEditMode ? "Edit TDS Section" : "Create TDS Section"}
              </Text>
            </Box>
          </Box>

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
                    label="TDS Section Code"
                    placeholder="Enter TDS section code"
                    withAsterisk
                    {...form.getInputProps("tds_section_code")}
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
                    label="TDS Section Name"
                    placeholder="Enter TDS section name"
                    withAsterisk
                    {...form.getInputProps("tds_section_name")}
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
                    label="Rate(%)"
                    placeholder="Enter rate"
                    withAsterisk
                    {...form.getInputProps("tds_section_rate")}
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
