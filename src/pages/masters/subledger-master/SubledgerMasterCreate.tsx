import { useMemo, useState } from "react";
import { Box, Button, Flex, Grid, Group, Loader, Text, Center } from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconCheck } from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import * as yup from "yup";
import { yupResolver } from "mantine-form-yup-resolver";
import { FormTextInput, ToastNotification } from "../../../components";
import SearchableMultiSelect from "../../../components/SearchableMultiSelect";
import MasterAuditHeadingRow from "../../../components/MasterAuditHeadingRow";
import { useMasterEditAuditRefresh } from "../../../hooks/useMasterEditAuditRefresh";
import { postAPICall } from "../../../service/postApiCall";
import { putAPICall } from "../../../service/putApiCall";
import { URL } from "../../../api/serverUrls";
import { API_HEADER } from "../../../store/storeKeys";

type SubledgerMasterEditState = {
  id?: number;
  account_name?: string;
  sl_code?: string;
  account_code?: string;
  account_codes?: string[];
};

type SubledgerMasterForm = {
  id?: number;
  account_name: string;
  sl_code: string;
  account_codes: string[];
};

const schema = yup.object().shape({
  account_name: yup.string().trim().required("Account Name is required"),
  sl_code: yup.string().trim().required("SL Code is required"),
  account_codes: yup
    .array()
    .of(yup.string())
    .min(1, "Account Code is required")
    .required("Account Code is required"),
});

function accountCodesFromEdit(data?: SubledgerMasterEditState): string[] {
  if (Array.isArray(data?.account_codes) && data.account_codes.length > 0) {
    return data.account_codes.map((code) => String(code).trim()).filter(Boolean);
  }
  const code = String(data?.account_code ?? "").trim();
  return code ? [code] : [];
}

function SubledgerMasterCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const editFormData = location.state as SubledgerMasterEditState | undefined;
  const isEditMode = !!editFormData?.id;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const initialAccountCodes = useMemo(
    () => accountCodesFromEdit(editFormData),
    [editFormData],
  );
  const [accountCodeDisplayValues, setAccountCodeDisplayValues] = useState<
    Record<string, string>
  >(() =>
    Object.fromEntries(initialAccountCodes.map((code) => [code, code])),
  );

  const { auditSource, applyAuditFromResponse, refreshAuditFromDetail } =
    useMasterEditAuditRefresh(
      isEditMode ? (editFormData as Record<string, unknown>) : null,
      {
        detailBaseUrl: isEditMode ? URL.subledgerEnquiryMaster : undefined,
        recordId: editFormData?.id,
        enabled: isEditMode,
      },
    );

  const form = useForm<SubledgerMasterForm>({
    mode: "controlled",
    initialValues: {
      id: editFormData?.id,
      account_name: editFormData?.account_name || "",
      sl_code: editFormData?.sl_code || "",
      account_codes: initialAccountCodes,
    },
    validate: yupResolver(schema),
  });

  const goToList = () => navigate("/master/subledger-master");

  const handleSubmit = async (values: SubledgerMasterForm): Promise<void> => {
    setIsSubmitting(true);
    const payload = {
      ...(isEditMode && values.id != null ? { id: values.id } : {}),
      account_name: values.account_name.trim(),
      sl_code: values.sl_code.trim(),
      account_codes: values.account_codes,
    };
    try {
      const response = isEditMode
        ? await putAPICall(URL.subledgerEnquiryMaster, payload, API_HEADER)
        : await postAPICall(URL.subledgerEnquiryMaster, payload, API_HEADER);
      const body = response as {
        status?: boolean;
        message?: string;
      };
      if (body?.status === false) {
        ToastNotification({
          type: "error",
          message:
            body.message ||
            `Failed to ${isEditMode ? "update" : "create"} Subledger Master.`,
        });
        return;
      }
      if (isEditMode) {
        applyAuditFromResponse(response);
        await refreshAuditFromDetail(editFormData?.id);
      }
      ToastNotification({
        type: "success",
        message:
          body?.message ||
          (isEditMode
            ? "Subledger Master updated successfully."
            : "Subledger Enquiry Master created successfully."),
      });
      goToList();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unknown error";
      ToastNotification({
        type: "error",
        message: `Error while ${isEditMode ? "updating" : "creating"} Subledger Master: ${message}`,
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
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
              }}
            >
              <MasterAuditHeadingRow
                auditSource={auditSource}
                visible={isEditMode}
                justify="center"
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
                  {isEditMode ? "Edit Subledger Master" : "Create Subledger Master"}
                </Text>
              </MasterAuditHeadingRow>
            </Box>
          </Box>

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
                <Grid.Col span={6}>
                  <FormTextInput
                    label="Account Name"
                    placeholder="Enter Account Name"
                    withAsterisk
                    {...form.getInputProps("account_name")}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <FormTextInput
                    label="SL Code"
                    placeholder="Enter SL Code"
                    format="capital"
                    withAsterisk
                    {...form.getInputProps("sl_code")}
                  />
                </Grid.Col>
                <Grid.Col span={12}>
                  <SearchableMultiSelect
                    label="Account Code"
                    placeholder="Type account code or name"
                    apiEndpoint={URL.chartOfAccountsSlCode0}
                    searchFields={["gl_account_code", "account_name"]}
                    displayFormat={(item) => {
                      const code = String(
                        item.gl_account_code ?? item.account_code ?? "",
                      ).trim();
                      const name = String(
                        item.gl_account_name ??
                          item.account_name ??
                          item.gl_name ??
                          "",
                      ).trim();
                      return {
                        value: code,
                        label: name ? `${code} - ${name}` : code,
                      };
                    }}
                    value={form.values.account_codes}
                    displayValues={accountCodeDisplayValues}
                    onChange={(values, selectedData) => {
                      form.setFieldValue("account_codes", values);
                      setAccountCodeDisplayValues((prev) => {
                        const next: Record<string, string> = {};
                        for (const id of values) {
                          const fromSelection = selectedData?.find(
                            (item) => item.value === id,
                          )?.label;
                          next[id] = fromSelection ?? prev[id] ?? id;
                        }
                        return next;
                      });
                    }}
                    minSearchLength={2}
                    withAsterisk
                    error={form.errors.account_codes as string | undefined}
                  />
                </Grid.Col>
              </Grid>
            </Box>

            <Box
              style={{
                padding: "20px 32px",
                backgroundColor: "#ffffff",
                borderRadius: "8px",
              }}
            >
              <Group justify="space-between">
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
                  onClick={goToList}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  loading={isSubmitting}
                  style={{
                    backgroundColor: isSubmitting ? "#105476BB" : "#105476",
                    fontSize: "13px",
                    fontFamily: "Inter",
                    fontStyle: "medium",
                  }}
                  rightSection={<IconCheck size={16} />}
                >
                  {isEditMode ? "Update" : "Create"}
                </Button>
              </Group>
            </Box>
          </Box>
        </Flex>
      </Box>
    </Box>
  );
}

export default SubledgerMasterCreate;
