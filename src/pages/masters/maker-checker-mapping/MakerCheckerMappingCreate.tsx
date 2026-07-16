import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Center,
  Flex,
  Grid,
  Group,
  Loader,
  MultiSelect,
  NumberInput,
  Text,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconCheck } from "@tabler/icons-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as yup from "yup";
import { yupResolver } from "mantine-form-yup-resolver";
import {
  SearchableSelect,
  ToastNotification,
  Dropdown,
} from "../../../components";
import MasterAuditHeadingRow from "../../../components/MasterAuditHeadingRow";
import { useMasterEditAuditRefresh } from "../../../hooks/useMasterEditAuditRefresh";
import SearchableMultiSelect from "../../../components/SearchableMultiSelect";
import { URL } from "../../../api/serverUrls";
import { apiCallProtected } from "../../../api/axios";
import { postAPICall } from "../../../service/postApiCall";
import { putAPICall } from "../../../service/putApiCall";
import { API_HEADER } from "../../../store/storeKeys";
import {
  documentTypeIdsFromRecord,
  fetchBranchMasterOptions,
  fetchDocumentTypeMasterIdOptions,
  formatUserMasterSelectOption,
  makerDisplayValuesFromRecord,
  makerIdsFromRecord,
  type MakerCheckerMappingRecord,
} from "./makerCheckerMappingShared";

type MakerCheckerMappingFormData = {
  maker_ids: string[];
  checker_id: string;
  document_type_ids: string[];
  limit_amount: number | "";
  branch_code: string;
};

const commonLabelStyles = {
  fontSize: "13px",
  fontWeight: 500,
  color: "#424242",
  marginBottom: "4px",
  fontFamily: "Inter",
  fontStyle: "medium",
};

const commonInputStyles = {
  input: {
    fontSize: "13px",
    fontFamily: "Inter",
  },
  label: commonLabelStyles,
};

const schema = yup.object().shape({
  maker_ids: yup
    .array()
    .of(yup.string().required())
    .min(1, "At least one maker is required"),
  checker_id: yup.string().required("Checker is required"),
  document_type_ids: yup
    .array()
    .of(yup.string().required())
    .min(1, "At least one doc type is required"),
  limit_amount: yup
    .number()
    .nullable()
    .transform((value, originalValue) =>
      originalValue === "" || originalValue == null ? null : value,
    )
    .min(0, "Limit amount must be zero or greater")
    .optional(),
  branch_code: yup.string().optional(),
});

function formatLimitAmount(value: number | ""): string | undefined {
  if (value === "" || value == null) return undefined;
  return Number(value).toFixed(2);
}

function parseLimitAmount(
  value: string | number | null | undefined,
): number | "" {
  if (value == null || value === "") return "";
  const num = Number(value);
  return Number.isFinite(num) ? num : "";
}

function readApiResponseBody(response: unknown): {
  status?: boolean;
  message?: string;
} | null {
  if (!response || typeof response !== "object") return null;
  return response as { status?: boolean; message?: string };
}

function parseMakerCheckerMutationResponse(
  response: unknown,
  fallbackSuccess: string,
  fallbackError: string,
): { ok: true; message: string } | { ok: false; message: string } {
  const body = readApiResponseBody(response);
  if (!body) {
    return { ok: true, message: fallbackSuccess };
  }

  if (body.status === false) {
    return {
      ok: false,
      message: (body.message ?? "").trim() || fallbackError,
    };
  }

  return {
    ok: true,
    message: (body.message ?? "").trim() || fallbackSuccess,
  };
}

function readApiErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const direct = err as Record<string, unknown>;
    if (typeof direct.message === "string" && direct.message.trim()) {
      return direct.message.trim();
    }
    if ("response" in err) {
      const data = (err as { response?: { data?: unknown } }).response?.data;
      if (data && typeof data === "object" && !Array.isArray(data)) {
        const body = data as Record<string, unknown>;
        if (typeof body.message === "string" && body.message.trim()) {
          return body.message.trim();
        }
        if (typeof body.detail === "string" && body.detail.trim()) {
          return body.detail.trim();
        }
      }
    }
  }
  if (err instanceof Error && err.message.trim()) return err.message.trim();
  return "Unknown error";
}

async function fetchMakerCheckerMappingById(
  id: number,
): Promise<MakerCheckerMappingRecord | null> {
  const response = (await apiCallProtected.post(
    `${URL.makerCheckerMasterFilter}?index=0&limit=1`,
    { filters: { id } },
  )) as { data?: MakerCheckerMappingRecord[] };
  const row = Array.isArray(response?.data) ? response.data[0] : null;
  return row ?? null;
}

export default function MakerCheckerMappingCreate() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const location = useLocation();
  const { id: routeId } = useParams<{ id: string }>();
  const editId = routeId ? Number(routeId) : null;
  const isEditMode = editId != null && !Number.isNaN(editId);
  const editState = (location.state as MakerCheckerMappingRecord | null) ?? null;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [makerDisplayValues, setMakerDisplayValues] = useState<
    Record<string, string>
  >({});
  const [checkerDisplayName, setCheckerDisplayName] = useState<
    string | undefined
  >();

  const { data: editRecord, isLoading: isLoadingEdit } = useQuery({
    queryKey: ["maker-checker-mapping", editId],
    queryFn: () => fetchMakerCheckerMappingById(editId as number),
    enabled: isEditMode,
    initialData: editState?.id === editId ? editState : undefined,
    staleTime: 0,
  });

  const { auditSource, applyAuditFromResponse, refreshAuditFromDetail } =
    useMasterEditAuditRefresh(
      isEditMode
        ? ((editRecord as Record<string, unknown> | undefined) ??
            (editState as Record<string, unknown> | null) ??
            null)
        : null,
      {
        detailBaseUrl: isEditMode ? URL.makerCheckerMaster : undefined,
        recordId: editId,
        enabled: isEditMode,
      },
    );

  const { data: docTypeOptions = [], isLoading: docTypesLoading } = useQuery({
    queryKey: ["documentTypeMasterIdOptions"],
    queryFn: fetchDocumentTypeMasterIdOptions,
    staleTime: Infinity,
  });

  const { data: branchOptions = [], isLoading: branchesLoading } = useQuery({
    queryKey: ["branchMasterOptions"],
    queryFn: fetchBranchMasterOptions,
    staleTime: Infinity,
  });

  const docTypeSelectData = useMemo(
    () => docTypeOptions.map((opt) => ({ value: opt.value, label: opt.label })),
    [docTypeOptions],
  );

  const form = useForm<MakerCheckerMappingFormData>({
    initialValues: {
      maker_ids: [],
      checker_id: "",
      document_type_ids: [],
      limit_amount: "",
      branch_code: "",
    },
    validate: yupResolver(schema),
  });

  useEffect(() => {
    if (!isEditMode || !editRecord) return;

    form.setValues({
      maker_ids: makerIdsFromRecord(editRecord),
      checker_id:
        editRecord.checker_id != null ? String(editRecord.checker_id) : "",
      document_type_ids: documentTypeIdsFromRecord(editRecord),
      limit_amount: parseLimitAmount(editRecord.limit_amount),
      branch_code: String(editRecord.branch_code ?? ""),
    });
    setMakerDisplayValues(makerDisplayValuesFromRecord(editRecord));
    setCheckerDisplayName(editRecord.checker_name);
  }, [isEditMode, editRecord]);

  const handleSubmit = async (values: MakerCheckerMappingFormData) => {
    setIsSubmitting(true);

    const limitAmount = formatLimitAmount(values.limit_amount);
    const payload: Record<string, unknown> = {
      maker_ids: values.maker_ids.map((id) => Number(id)),
      checker_id: Number(values.checker_id),
      document_type_ids: values.document_type_ids.map((id) => Number(id)),
      status: editRecord?.status ?? "ACTIVE",
    };

    if (values.branch_code.trim()) {
      payload.branch_code = values.branch_code.trim();
    }
    if (limitAmount != null) {
      payload.limit_amount = limitAmount;
    }

    try {
      const response =
        isEditMode && editId != null
          ? await putAPICall(
              URL.makerCheckerMaster,
              { ...payload, id: editId },
              API_HEADER,
            )
          : await postAPICall(URL.makerCheckerMaster, payload, API_HEADER);

      const result = parseMakerCheckerMutationResponse(
        response,
        isEditMode
          ? "Maker & Checker Mapping updated successfully"
          : "Maker & Checker Mapping created successfully",
        isEditMode
          ? "Failed to update Maker & Checker Mapping"
          : "Failed to create Maker & Checker Mapping",
      );

      if (!result.ok) {
        ToastNotification({
          type: "error",
          message: result.message,
        });
        return;
      }

      ToastNotification({
        type: "success",
        message: result.message,
      });

      if (isEditMode && editId != null) {
        applyAuditFromResponse(response);
        await refreshAuditFromDetail(editId);
      }

      await queryClient.invalidateQueries({
        queryKey: ["maker-checker-master"],
      });
      if (isEditMode && editId != null) {
        await queryClient.invalidateQueries({
          queryKey: ["maker-checker-mapping", editId],
        });
      }

      navigate("/master/maker-checker-mapping", {
        state: { refreshData: true },
      });
    } catch (err: unknown) {
      ToastNotification({
        type: "error",
        message: readApiErrorMessage(err),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate("/master/maker-checker-mapping");
  };

  if (isEditMode && isLoadingEdit && !editRecord) {
    return (
      <Center h="calc(100vh - 112px)">
        <Loader color="#105476" />
      </Center>
    );
  }

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
                    fontSize: "16px",
                    textAlign: "center",
                  }}
                >
                  {isEditMode
                    ? "Edit Maker & Checker Mapping"
                    : "Create Maker & Checker Mapping"}
                </Text>
              </MasterAuditHeadingRow>
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
                  <SearchableMultiSelect
                    label="Maker"
                    placeholder="Type user name"
                    apiEndpoint={URL.user}
                    searchFields={["user_name", "employee_id", "id"]}
                    displayFormat={formatUserMasterSelectOption}
                    value={form.values.maker_ids}
                    displayValues={makerDisplayValues}
                    onChange={(values, selectedData) => {
                      form.setFieldValue("maker_ids", values);
                      setMakerDisplayValues((prev) => {
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
                    dropdownZIndex={100}
                    styles={commonInputStyles}
                    error={
                      typeof form.errors.maker_ids === "string"
                        ? form.errors.maker_ids
                        : undefined
                    }
                  />
                </Grid.Col>

                <Grid.Col span={6}>
                  <SearchableSelect
                    label="Checker"
                    placeholder="Type user name"
                    apiEndpoint={URL.user}
                    searchFields={["user_name", "employee_id", "id"]}
                    displayFormat={formatUserMasterSelectOption}
                    value={form.values.checker_id || null}
                    displayValue={checkerDisplayName}
                    onChange={(value, selectedData) => {
                      form.setFieldValue("checker_id", value ?? "");
                      setCheckerDisplayName(selectedData?.label);
                    }}
                    minSearchLength={2}
                    withAsterisk
                    dropdownZIndex={100}
                    styles={commonInputStyles}
                    error={
                      typeof form.errors.checker_id === "string"
                        ? form.errors.checker_id
                        : undefined
                    }
                  />
                </Grid.Col>

                <Grid.Col span={6}>
                  <MultiSelect
                    label="Doc Type"
                    placeholder={
                      docTypesLoading
                        ? "Loading doc types..."
                        : "Select doc type(s)"
                    }
                    data={docTypeSelectData}
                    value={form.values.document_type_ids}
                    onChange={(value) =>
                      form.setFieldValue("document_type_ids", value)
                    }
                    searchable
                    clearable
                    withAsterisk
                    disabled={docTypesLoading}
                    styles={commonInputStyles}
                    error={
                      typeof form.errors.document_type_ids === "string"
                        ? form.errors.document_type_ids
                        : undefined
                    }
                  />
                </Grid.Col>

                <Grid.Col span={6}>
                  <NumberInput
                    label="Limit Amount"
                    placeholder="Enter limit amount (optional)"
                    value={form.values.limit_amount}
                    onChange={(value) =>
                      form.setFieldValue(
                        "limit_amount",
                        typeof value === "number" ? value : "",
                      )
                    }
                    min={0}
                    decimalScale={2}
                    styles={commonInputStyles}
                    error={
                      typeof form.errors.limit_amount === "string"
                        ? form.errors.limit_amount
                        : undefined
                    }
                  />
                </Grid.Col>

                <Grid.Col span={6}>
                  <Dropdown
                    label="Branch"
                    placeholder={
                      branchesLoading ? "Loading branches..." : "Select branch"
                    }
                    data={branchOptions}
                    value={form.values.branch_code || null}
                    onChange={(value) =>
                      form.setFieldValue("branch_code", value ?? "")
                    }
                    clearable
                    disabled={branchesLoading}
                    dropdownZIndex={100}
                    styles={commonInputStyles}
                    error={
                      typeof form.errors.branch_code === "string"
                        ? form.errors.branch_code
                        : undefined
                    }
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
                    },
                  }}
                  onClick={handleCancel}
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  size="sm"
                  loading={isSubmitting}
                  disabled={isSubmitting}
                  style={{
                    backgroundColor: "#105476",
                    fontSize: "13px",
                    fontFamily: "Inter",
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
