import { useEffect, useRef, useState } from "react";
import {
  ActionIcon,
  Box,
  Button,
  Flex,
  Grid,
  Group,
  Text,
  TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconCheck, IconPlus, IconTrash } from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import * as yup from "yup";
import { yupResolver } from "mantine-form-yup-resolver";
import { postAPICall } from "../../../service/postApiCall";
import { putAPICall } from "../../../service/putApiCall";
import { getAPICall } from "../../../service/getApiCall";
import { API_HEADER } from "../../../store/storeKeys";
import { Dropdown, SearchableSelect, ToastNotification } from "../../../components";
import MasterAuditHeadingRow from "../../../components/MasterAuditHeadingRow";
import { useMasterEditAuditRefresh } from "../../../hooks/useMasterEditAuditRefresh";
import { URL } from "../../../api/serverUrls";

type GSTRateFormData = {
  sac_id: string;
  status: string;
};

type RateDetailRow = {
  id?: number;
  state_id: string | null;
  state_name: string;
  cgst: string;
  sgst: string;
  igst: string;
};

type EditState = {
  id?: number | string;
  sac_id?: number | string;
  sac_code?: string;
  sac_name?: string;
  status?: string;
  rate?: unknown[];
};

const fieldStyles = {
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
  },
};

const schema = yup.object().shape({
  sac_id: yup.string().required("SAC is required"),
  status: yup.string().required("Status is required"),
});

const createEmptyRateRow = (): RateDetailRow => ({
  id: undefined,
  state_id: null,
  state_name: "",
  cgst: "",
  sgst: "",
  igst: "",
});

const flattenApiErrorMessages = (
  value: unknown,
  parts: string[] = [],
): string[] => {
  if (value == null) return parts;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) parts.push(trimmed);
    return parts;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return parts;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => flattenApiErrorMessages(item, parts));
    return parts;
  }
  if (typeof value === "object") {
    Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
      if (key === "success" || key === "status" || key === "code") return;
      flattenApiErrorMessages(item, parts);
    });
  }
  return parts;
};

const extractGstRateErrorMessage = (err: unknown): string => {
  // Response interceptor rejects plain objects: { message: "..." }
  if (err && typeof err === "object") {
    const obj = err as {
      message?: unknown;
      response?: { data?: unknown };
      data?: unknown;
      error_message?: unknown;
      detail?: unknown;
    };

    if (typeof obj.message === "string" && obj.message.trim() !== "") {
      return obj.message.trim();
    }
    if (Array.isArray(obj.message)) {
      const fromMessage = flattenApiErrorMessages(obj.message);
      if (fromMessage.length > 0) return fromMessage.join(" ");
    }
    if (typeof obj.error_message === "string" && obj.error_message.trim()) {
      return obj.error_message.trim();
    }
    if (typeof obj.detail === "string" && obj.detail.trim()) {
      return obj.detail.trim();
    }

    const fromResponse = flattenApiErrorMessages(obj.response?.data);
    if (fromResponse.length > 0) return fromResponse.join(" ");

    const fromData = flattenApiErrorMessages(obj.data);
    if (fromData.length > 0) return fromData.join(" ");

    // Last resort: flatten the whole reject payload (DRF field map, etc.)
    const fromWhole = flattenApiErrorMessages(obj);
    if (fromWhole.length > 0) return fromWhole.join(" ");
  }

  if (typeof err === "string" && err.trim() !== "") {
    return err.trim();
  }

  return "Something went wrong while saving GST Rate. Please try again.";
};

const mapRateRows = (rows: unknown[]): RateDetailRow[] =>
  rows.map((row) => {
    const item = row as Record<string, unknown>;
    return {
      id:
        item.id !== undefined && item.id !== null ? Number(item.id) : undefined,
      state_id:
        item.state_id !== undefined &&
        item.state_id !== null &&
        String(item.state_id).trim() !== ""
          ? String(item.state_id)
          : null,
      state_name: String(item.state_name ?? ""),
      cgst: String(item.cgst ?? ""),
      sgst: String(item.sgst ?? ""),
      igst: String(item.igst ?? ""),
    };
  });

const extractDetailPayload = (
  response: { data?: unknown } | Record<string, unknown>,
): Record<string, unknown> | undefined => {
  const body = (response as { data?: unknown })?.data ?? response;
  const nestedData = Array.isArray(body)
    ? body
    : (body as { data?: unknown })?.data;
  if (Array.isArray(nestedData)) {
    return (nestedData[0] as Record<string, unknown> | undefined) ?? undefined;
  }
  if (nestedData && typeof nestedData === "object") {
    return nestedData as Record<string, unknown>;
  }
  if (!Array.isArray(body) && body && typeof body === "object") {
    return body as Record<string, unknown>;
  }
  return undefined;
};

export default function GSTRateCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const lastLoadedEditIdRef = useRef<number | null>(null);
  const [selectedSac, setSelectedSac] = useState<{
    sac_code?: string;
    sac_name?: string;
  } | null>(null);

  const editData = (location.state as EditState | null) || null;
  const routeIsEdit = location.pathname.includes("/edit");
  const editIdFromQuery = (() => {
    const idParam = new URLSearchParams(location.search).get("id");
    if (!idParam) return null;
    const parsed = Number(idParam);
    return Number.isFinite(parsed) ? parsed : null;
  })();
  const editId =
    editData?.id !== undefined && editData?.id !== null
      ? Number(editData.id)
      : editIdFromQuery;
  const isEditMode = routeIsEdit || editId !== null;

  const { auditSource, applyAuditFromResponse, refreshAuditFromDetail } =
    useMasterEditAuditRefresh(
      isEditMode
        ? ((editData as Record<string, unknown> | null) ??
            (editId != null ? { id: editId } : null))
        : null,
      {
        detailBaseUrl: isEditMode ? URL.gstRateMaster : undefined,
        recordId: editId,
        enabled: isEditMode && editId != null,
      },
    );

  const form = useForm<GSTRateFormData>({
    initialValues: {
      sac_id: "",
      status: "ACTIVE",
    },
    validate: yupResolver(schema),
  });
  const [rateRows, setRateRows] = useState<RateDetailRow[]>([
    createEmptyRateRow(),
  ]);

  useEffect(() => {
    if (!isEditMode) return;
    let cancelled = false;

    if (editData) {
      form.setValues({
        sac_id:
          editData.sac_id !== undefined && editData.sac_id !== null
            ? String(editData.sac_id)
            : "",
        status: editData.status || "ACTIVE",
      });
      setSelectedSac({
        sac_code: editData.sac_code ?? "",
        sac_name: editData.sac_name ?? "",
      });
      if (Array.isArray(editData.rate) && editData.rate.length > 0) {
        setRateRows(mapRateRows(editData.rate));
      }
    }

    if (editId === null) return;
    if (lastLoadedEditIdRef.current === editId) return;
    lastLoadedEditIdRef.current = editId;

    const loadEditData = async () => {
      try {
        const response = (await getAPICall(
          `${URL.gstRateMaster}${editId}/`,
          API_HEADER,
        )) as { data?: unknown } | Record<string, unknown>;
        const apiPayload = extractDetailPayload(response);
        if (cancelled || !apiPayload) return;

        form.setValues({
          sac_id:
            apiPayload.sac_id !== undefined && apiPayload.sac_id !== null
              ? String(apiPayload.sac_id)
              : "",
          status: String(apiPayload.status ?? "ACTIVE"),
        });
        setSelectedSac({
          sac_code: String(apiPayload.sac_code ?? ""),
          sac_name: String(apiPayload.sac_name ?? ""),
        });

        const existingRate = Array.isArray(apiPayload.rate)
          ? (apiPayload.rate as unknown[])
          : [];
        if (existingRate.length > 0) {
          setRateRows(mapRateRows(existingRate));
        } else if (Array.isArray(editData?.rate) && editData.rate.length > 0) {
          setRateRows(mapRateRows(editData.rate));
        } else {
          setRateRows([createEmptyRateRow()]);
        }
      } catch (error) {
        console.error("Error loading GST Rate Master for edit:", error);
        if (!cancelled && editData) {
          form.setValues({
            sac_id:
              editData.sac_id !== undefined && editData.sac_id !== null
                ? String(editData.sac_id)
                : "",
            status: editData.status || "ACTIVE",
          });
          setSelectedSac({
            sac_code: editData.sac_code ?? "",
            sac_name: editData.sac_name ?? "",
          });
          if (Array.isArray(editData.rate) && editData.rate.length > 0) {
            setRateRows(mapRateRows(editData.rate));
          } else {
            setRateRows([createEmptyRateRow()]);
          }
        }
      }
    };
    loadEditData();
    return () => {
      cancelled = true;
    };
  }, [isEditMode, editId]);

  const handleSubmit = async (values: GSTRateFormData) => {
    setIsSubmitting(true);

    try {
      const hasInvalidRateRow = rateRows.some(
        (row) =>
          !row.state_id ||
          row.cgst.trim() === "" ||
          row.sgst.trim() === "" ||
          row.igst.trim() === "",
      );
      if (hasInvalidRateRow) {
        ToastNotification({
          type: "error",
          message:
            "Please fill State, CGST %, SGST % and IGST % for all rate detail rows.",
        });
        setIsSubmitting(false);
        return;
      }

      const stateIds = rateRows.map((row) => row.state_id);
      if (new Set(stateIds).size !== stateIds.length) {
        const duplicateNames = rateRows
          .filter(
            (row, index) =>
              row.state_id &&
              stateIds.indexOf(row.state_id) !== index,
          )
          .map((row) => row.state_name || row.state_id)
          .filter(Boolean);
        const uniqueDupes = [...new Set(duplicateNames)];
        ToastNotification({
          type: "error",
          message:
            uniqueDupes.length > 0
              ? `State "${uniqueDupes.join(", ")}" is duplicated in rate details. Each state can be mapped only once per SAC.`
              : "Duplicate states are not allowed in rate details. Each state can be mapped only once per SAC.",
        });
        setIsSubmitting(false);
        return;
      }

      const payload = {
        sac_id: Number(values.sac_id),
        status: values.status,
        rate: rateRows.map((row) => ({
          ...(row.id != null ? { id: row.id } : {}),
          state_id: Number(row.state_id),
          cgst: row.cgst,
          sgst: row.sgst,
          igst: row.igst,
        })),
      };

      if (isEditMode) {
        const updateData = {
          ...payload,
          id: editId,
        };
        const res = await putAPICall(URL.gstRateMaster, updateData, API_HEADER);
        applyAuditFromResponse(res);
        await refreshAuditFromDetail(editId);
        ToastNotification({
          type: "success",
          message: "GST Rate Master updated successfully",
        });
      } else {
        await postAPICall(URL.gstRateMaster, payload, API_HEADER);
        ToastNotification({
          type: "success",
          message: "GST Rate Master created successfully",
        });
      }

      navigate("/master/gst-rate", { state: { refreshData: true } });
    } catch (err: unknown) {
      const errorMessage = extractGstRateErrorMessage(err);
      ToastNotification({
        type: "error",
        message:
          errorMessage ||
          "Something went wrong while saving GST Rate. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate("/master/gst-rate");
  };

  const updateRateRow = (
    index: number,
    key: keyof RateDetailRow,
    value: string | null,
  ) => {
    setRateRows((prev) =>
      prev.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [key]: value } : row,
      ),
    );
  };

  const addRateRow = () =>
    setRateRows((prev) => [...prev, createEmptyRateRow()]);
  const removeRateRow = (index: number) => {
    setRateRows((prev) =>
      prev.length > 1 ? prev.filter((_, i) => i !== index) : prev,
    );
  };

  const sacDisplayValue =
    selectedSac?.sac_code || selectedSac?.sac_name
      ? `${selectedSac?.sac_code ?? ""} - ${selectedSac?.sac_name ?? ""}`.trim()
      : "";

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
                    fontStyle: "medium",
                    fontSize: "16px",
                    color: "#105476",
                    textAlign: "center",
                  }}
                >
                  {isEditMode ? "Edit GST Rate" : "Create GST Rate"}
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
                  // height: "100%",
                  borderRadius: "8px",
                  padding: "24px",
                }}
                gutter="xs"
              >
                <Grid.Col span={8}>
                  <SearchableSelect
                    label="SAC"
                    placeholder="Search SAC code or name"
                    styles={fieldStyles}
                    required
                    apiEndpoint={URL.gstSacMaster}
                    searchFields={["sac_code", "sac_name"]}
                    displayFormat={(item: Record<string, unknown>) => ({
                      value: String(item.id ?? ""),
                      label: `${String(item.sac_code ?? "")} - ${String(item.sac_name ?? "")}`,
                    })}
                    value={form.values.sac_id || null}
                    displayValue={sacDisplayValue}
                    minSearchLength={1}
                    returnOriginalData={true}
                    onChange={(value, _selectedData, originalData) => {
                      const selectedItem = originalData as
                        | {
                            id?: number | string;
                            sac_code?: string;
                            sac_name?: string;
                          }
                        | null
                        | undefined;
                      form.setFieldValue(
                        "sac_id",
                        selectedItem?.id != null
                          ? String(selectedItem.id)
                          : value ?? "",
                      );
                      setSelectedSac({
                        sac_code: selectedItem?.sac_code ?? "",
                        sac_name: selectedItem?.sac_name ?? "",
                      });
                    }}
                    error={form.errors.sac_id as string}
                    dropdownZIndex={1000}
                  />
                </Grid.Col>
                <Grid.Col span={4}>
                  <Dropdown
                    label="Status"
                    data={["ACTIVE", "INACTIVE"]}
                    value={form.values.status}
                    styles={fieldStyles}
                    onChange={(val) =>
                      form.setFieldValue("status", val || "ACTIVE")
                    }
                    error={form.errors.status as string}
                    dropdownZIndex={1000}
                  />
                </Grid.Col>

                <Grid.Col span={12}>
                  <Text
                    size="lg"
                    fw={600}
                    c="#105476"
                    mt="lg"
                    mb="sm"
                    style={{ fontFamily: "Inter", marginTop: "8px" }}
                  >
                    Rate Details
                  </Text>
                </Grid.Col>

                <Grid.Col span={12}>
                  <Grid gutter="sm" style={{ marginBottom: "6px" }}>
                    <Grid.Col span={0.8}>
                      <Text size="13px" fw={500} c="#424242" style={{ fontFamily: "Inter" }}>
                        Sl No
                      </Text>
                    </Grid.Col>
                    <Grid.Col span={4.2}>
                      <Text size="13px" fw={500} c="#424242" style={{ fontFamily: "Inter" }}>
                        State
                      </Text>
                    </Grid.Col>
                    <Grid.Col span={2}>
                      <Text size="13px" fw={500} c="#424242" style={{ fontFamily: "Inter" }}>
                        CGST %
                      </Text>
                    </Grid.Col>
                    <Grid.Col span={2}>
                      <Text size="13px" fw={500} c="#424242" style={{ fontFamily: "Inter" }}>
                        SGST %
                      </Text>
                    </Grid.Col>
                    <Grid.Col span={2}>
                      <Text size="13px" fw={500} c="#424242" style={{ fontFamily: "Inter" }}>
                        IGST %
                      </Text>
                    </Grid.Col>
                    <Grid.Col span={1} />
                  </Grid>
                </Grid.Col>

                {rateRows.map((row, index) => (
                  <Grid.Col
                    span={12}
                    key={
                      row.id != null ? `rate-${row.id}` : `rate-new-${index}`
                    }
                  >
                    <Grid gutter="sm" align="center">
                      <Grid.Col span={0.8}>
                        <TextInput
                          value={String(index + 1)}
                          readOnly
                          styles={fieldStyles}
                        />
                      </Grid.Col>
                      <Grid.Col span={4.2}>
                        <SearchableSelect
                          placeholder="Select state"
                          apiEndpoint={URL.state}
                          additionalParams={{ country_code: "IN" }}
                          value={row.state_id}
                          displayValue={row.state_name || ""}
                          dropdownZIndex={1100}
                          minSearchLength={1}
                          searchFields={["state_name", "state_code"]}
                          displayFormat={(item: Record<string, unknown>) => ({
                            value: String(item.id ?? ""),
                            label: String(item.state_name ?? ""),
                          })}
                          returnOriginalData
                          styles={fieldStyles}
                          onChange={(value, selectedData, originalData) => {
                            setRateRows((prev) =>
                              prev.map((r, rowIndex) => {
                                if (rowIndex !== index) return r;
                                if (!value) {
                                  return {
                                    ...r,
                                    state_id: null,
                                    state_name: "",
                                  };
                                }
                                const nextName =
                                  selectedData?.label ??
                                  (originalData?.state_name != null
                                    ? String(originalData.state_name)
                                    : r.state_name);
                                return {
                                  ...r,
                                  state_id: value,
                                  state_name: nextName,
                                };
                              }),
                            );
                          }}
                        />
                      </Grid.Col>
                      <Grid.Col span={2}>
                        <TextInput
                          value={row.cgst}
                          styles={fieldStyles}
                          onChange={(e) =>
                            updateRateRow(index, "cgst", e.currentTarget.value)
                          }
                        />
                      </Grid.Col>
                      <Grid.Col span={2}>
                        <TextInput
                          value={row.sgst}
                          styles={fieldStyles}
                          onChange={(e) =>
                            updateRateRow(index, "sgst", e.currentTarget.value)
                          }
                        />
                      </Grid.Col>
                      <Grid.Col span={2}>
                        <TextInput
                          value={row.igst}
                          styles={fieldStyles}
                          onChange={(e) =>
                            updateRateRow(index, "igst", e.currentTarget.value)
                          }
                        />
                      </Grid.Col>
                      <Grid.Col span={1}>
                        <Group gap={4} >
                          <ActionIcon
                            variant="light"
                            color="red"
                            onClick={() => removeRateRow(index)}
                          >
                            <IconTrash size={18} />
                          </ActionIcon>
                          {index === rateRows.length - 1 && (
                            <ActionIcon
                              variant="light"
                              color="#105476"
                              onClick={addRateRow}
                            >
                              <IconPlus size={18} />
                            </ActionIcon>
                          )}
                        </Group>
                      </Grid.Col>
                    </Grid>
                  </Grid.Col>
                ))}
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
