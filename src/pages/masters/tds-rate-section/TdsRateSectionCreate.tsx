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
import { URL } from "../../../api/serverUrls";

type TdsSectionFormData = {
  tds_section_code: string;
  tds_section_name: string;
};

type RateDetailRow = {
  id?: number;
  account_id: string | null;
  rate_type: string;
  rate: string;
  higher_rate: string;
  tds_type: string;
  higher_rate_applicable: boolean;
  rate_account_code: string;
  subledger_code: string;
  account_name: string;
  valid_from_date: string;
};

const schema = yup.object().shape({
  tds_section_code: yup.string().required("TDS section code is required"),
  tds_section_name: yup.string().required("TDS section name is required"),
});

const createEmptyRateRow = (): RateDetailRow => ({
  id: undefined,
  account_id: null,
  rate_type: "Rate",
  rate: "",
  higher_rate: "",
  tds_type: "COMPANY",
  higher_rate_applicable: false,
  rate_account_code: "",
  subledger_code: "",
  account_name: "",
  valid_from_date: "",
});

const mapRateRows = (rows: unknown[]): RateDetailRow[] =>
  rows.map((row) => {
    const item = row as Record<string, unknown>;
    return {
      id:
        item.id !== undefined && item.id !== null ? Number(item.id) : undefined,
      account_id:
        item.account_id !== undefined &&
        item.account_id !== null &&
        String(item.account_id).trim() !== ""
          ? String(item.account_id)
          : null,
      rate_type: String(item.rate_type ?? "Rate"),
      rate: String(item.rate ?? ""),
      higher_rate: String(item.higher_rate ?? ""),
      tds_type: String(item.tds_type ?? "COMPANY"),
      higher_rate_applicable: Boolean(item.higher_rate_applicable),
      rate_account_code: String(item.rate_account_code ?? item.gl_account_code ?? ""),
      subledger_code: String(item.subledger_code ?? item.sl_code ?? ""),
      account_name: String(item.account_name ?? item.account ?? item.account_head ?? ""),
      valid_from_date: String(item.valid_from_date ?? ""),
    };
  });

export default function TdsRateSectionCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const lastLoadedEditIdRef = useRef<number | null>(null);
  const [selectedTdsSection, setSelectedTdsSection] = useState<{
    tds_section_code?: string;
    tds_section_name?: string;
  } | null>(null);

  const editData =
    (location.state as
      | (TdsSectionFormData & { id?: number | string; rate?: unknown[] })
      | null) || null;
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

  const form = useForm<TdsSectionFormData>({
    initialValues: {
      tds_section_code: "",
      tds_section_name: "",
    },
    validate: yupResolver(schema),
  });
  const [rateRows, setRateRows] = useState<RateDetailRow[]>([createEmptyRateRow()]);

  useEffect(() => {
    if (!isEditMode) return;
    let cancelled = false;

    // Always prefill from route state in edit mode.
    if (editData) {
      form.setValues({
        tds_section_code: editData.tds_section_code ?? "",
        tds_section_name: editData.tds_section_name ?? "",
      });
      setSelectedTdsSection({
        tds_section_code: editData.tds_section_code ?? "",
        tds_section_name: editData.tds_section_name ?? "",
      });
      // Prefill detail rows immediately from routed state in edit mode.
      if (Array.isArray(editData.rate) && editData.rate.length > 0) {
        setRateRows(mapRateRows(editData.rate));
      }
    }

    // No id -> can't hit details API, but state prefill above is still applied.
    if (editId === null) return;
    if (lastLoadedEditIdRef.current === editId) return;
    lastLoadedEditIdRef.current = editId;

    const loadEditData = async () => {
      try {
        const response = (await getAPICall(
          `${URL.tdsRateMaster}${editId}/`,
          API_HEADER,
        )) as { data?: unknown } | Record<string, unknown>;
        const body = (response as { data?: unknown })?.data ?? response;
        const nestedData = Array.isArray(body)
          ? body
          : (body as { data?: unknown })?.data;
        const apiPayload = Array.isArray(nestedData)
          ? ((nestedData[0] as Record<string, unknown> | undefined) ?? undefined)
          : nestedData && typeof nestedData === "object"
            ? (nestedData as Record<string, unknown>)
            : !Array.isArray(body) && body && typeof body === "object"
              ? (body as Record<string, unknown>)
              : undefined;
        if (cancelled || !apiPayload) return;

        form.setValues({
          tds_section_code: String(apiPayload.tds_section_code ?? ""),
          tds_section_name: String(apiPayload.tds_section_name ?? ""),
        });
        setSelectedTdsSection({
          tds_section_code: String(apiPayload.tds_section_code ?? ""),
          tds_section_name: String(apiPayload.tds_section_name ?? ""),
        });

        const existingRate = Array.isArray(apiPayload.rate)
          ? (apiPayload.rate as unknown[])
          : [];
        if (existingRate.length > 0) {
          setRateRows(mapRateRows(existingRate));
        } else if (Array.isArray(editData?.rate) && editData.rate.length > 0) {
          // Keep edit rows filled if details API returns empty rate array.
          setRateRows(mapRateRows(editData.rate));
        } else {
          setRateRows([createEmptyRateRow()]);
        }
      } catch (error) {
        console.error("Error loading TDS Rate Master for edit:", error);
        if (!cancelled && editData) {
          form.setValues({
            tds_section_code: editData.tds_section_code ?? "",
            tds_section_name: editData.tds_section_name ?? "",
          });
          setSelectedTdsSection({
            tds_section_code: editData.tds_section_code ?? "",
            tds_section_name: editData.tds_section_name ?? "",
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

  const handleSubmit = async (values: TdsSectionFormData) => {
    setIsSubmitting(true);

    try {
      const hasInvalidRateRow = rateRows.some(
        (row) =>
          !row.rate_type ||
          !row.tds_type ||
          !row.rate ||
          !row.higher_rate ||
          !row.rate_account_code ||
          !row.subledger_code ||
          !row.account_name ||
          !row.valid_from_date,
      );
      if (hasInvalidRateRow) {
        ToastNotification({
          type: "error",
          message: "Please fill all mandatory fields in TDS Rate Detail section.",
        });
        setIsSubmitting(false);
        return;
      }

      const payload = {
        tds_section_code: values.tds_section_code,
        tds_section_name: values.tds_section_name,
        rate: rateRows.map((row) => ({
          ...(row.id != null ? { id: row.id } : {}),
          tds_type: row.tds_type,
          rate_type: row.rate_type,
          rate: row.rate,
          higher_rate: row.higher_rate,
          higher_rate_applicable: row.higher_rate_applicable,
          rate_account_code: row.rate_account_code,
          subledger_code: row.subledger_code,
          account_name: row.account_name,
          valid_from_date: row.valid_from_date,
        })),
      };

      if (isEditMode) {
        const updateData = {
          ...payload,
          id: editId,
        };
        await putAPICall(URL.tdsRateMaster, updateData, API_HEADER);
        ToastNotification({
          type: "success",
          message: "TDS Rate Master updated successfully",
        });
      } else {
        await postAPICall(URL.tdsRateMaster, payload, API_HEADER);
        ToastNotification({
          type: "success",
          message: "TDS Rate Master created successfully",
        });
      }

      navigate("/master/tds-rate-section");
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      ToastNotification({
        type: "error",
        message: `Error ${isEditMode ? "updating" : "creating"} TDS Rate Master: ${errorMessage}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate("/master/tds-rate-section");
  };

  const updateRateRow = (
    index: number,
    key: keyof RateDetailRow,
    value: string | boolean | null,
  ) => {
    setRateRows((prev) =>
      prev.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [key]: value } : row,
      ),
    );
  };

  const addRateRow = () => setRateRows((prev) => [...prev, createEmptyRateRow()]);
  const removeRateRow = (index: number) => {
    setRateRows((prev) =>
      prev.length > 1 ? prev.filter((_, i) => i !== index) : prev,
    );
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
                {isEditMode ? "Edit TDS Rate Section" : "Create TDS Rate Section"}
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
                  <SearchableSelect
                    label="TDS Section"
                    placeholder="Select TDS section"
                    styles={{
                      input: {
                        fontSize: "13px",
                        fontFamily: "Inter",
                      },
                      label: {
                        fontSize: "13px",
                        fontFamily: "Inter",
                      },
                    }}
                    required
                    apiEndpoint={URL.tdsSectionMaster}
                    searchFields={["tds_section_code", "tds_section_name"]}
                    displayFormat={(item: Record<string, unknown>) => ({
                      value: String(item.tds_section_code ?? ""),
                      label: `${String(item.tds_section_code ?? "")} - ${String(item.tds_section_name ?? "")}`,
                    })}
                    value={form.values.tds_section_code || null}
                    displayValue={
                      selectedTdsSection?.tds_section_code &&
                      selectedTdsSection?.tds_section_name
                        ? `${selectedTdsSection.tds_section_code} - ${selectedTdsSection.tds_section_name}`
                        : selectedTdsSection?.tds_section_code ||
                          form.values.tds_section_code ||
                          ""
                    }
                    minSearchLength={1}
                    returnOriginalData={true}
                    onChange={(value, _selectedData, originalData) => {
                      const selectedItem = originalData as
                        | {
                            tds_section_code?: string;
                            tds_section_name?: string;
                          }
                        | null
                        | undefined;
                      form.setFieldValue(
                        "tds_section_code",
                        selectedItem?.tds_section_code ?? value ?? "",
                      );
                      form.setFieldValue(
                        "tds_section_name",
                        selectedItem?.tds_section_name ?? "",
                      );
                      setSelectedTdsSection({
                        tds_section_code:
                          selectedItem?.tds_section_code ?? value ?? "",
                        tds_section_name: selectedItem?.tds_section_name ?? "",
                      });
                    }}
                    error={form.errors.tds_section_code as string}
                    dropdownZIndex={1000}
                  />
                </Grid.Col>
                <Grid.Col span={12}>
                  <Text
                    size="sm"
                    fw={600}
                    c="#105476"
                    style={{ fontFamily: "Inter", marginTop: "8px" }}
                  >
                    TDS Rate Detail
                  </Text>
                </Grid.Col>

                {rateRows.map((row, index) => (
                  <Grid.Col
                    span={12}
                    key={`${row.id ?? "new"}-${row.rate_account_code ?? ""}-${index}`}
                  >
                    <Grid gutter="xs" align="end">
                      <Grid.Col span={0.5}>
                        <TextInput
                          label="Sl No"
                          value={String(index + 1)}
                          readOnly
                          styles={{
                            input: { fontSize: "13px", fontFamily: "Inter" },
                            label: { fontSize: "13px", fontFamily: "Inter" },
                          }}
                        />
                      </Grid.Col>
                      <Grid.Col span={1.3}>
                        <Dropdown
                          label="Rate Type"
                          data={[{"value": "Rate", "label": "Rate"},
                            {"value": "Surcharge", "label": "Surcharge"},
                            {"value": "Edu. Cess", "label": "Edu. Cess"},                           
                          ]}
                          value={row.rate_type}
                          styles={{
                            input: { fontSize: "13px", fontFamily: "Inter" },
                            label: { fontSize: "13px", fontFamily: "Inter" },
                          }}
                          onChange={(val) =>
                            updateRateRow(index, "rate_type", val || "Rate")
                          }
                          dropdownZIndex={1000}
                        />
                      </Grid.Col>
                      <Grid.Col span={1.1}>
                        <TextInput
                          label="Rate %"
                          value={row.rate}
                          styles={{
                            input: { fontSize: "13px", fontFamily: "Inter" },
                            label: { fontSize: "13px", fontFamily: "Inter" },
                          }}
                          onChange={(e) =>
                            updateRateRow(index, "rate", e.currentTarget.value)
                          }
                        />
                      </Grid.Col>
                      <Grid.Col span={1.1}>
                        <TextInput
                          label="Higher Rate %"
                          value={row.higher_rate}
                          styles={{
                            input: { fontSize: "13px", fontFamily: "Inter" },
                            label: { fontSize: "13px", fontFamily: "Inter" },
                          }}
                          onChange={(e) =>
                            updateRateRow(index, "higher_rate", e.currentTarget.value)
                          }
                        />
                      </Grid.Col>
                      <Grid.Col span={1.5}>
                        <Dropdown
                          label="TDS Type"
                          data={["COMPANY", "INDIVIDUAL"]}
                          value={row.tds_type}
                          styles={{
                            input: { fontSize: "13px", fontFamily: "Inter" },
                            label: { fontSize: "13px", fontFamily: "Inter" },
                          }}
                          onChange={(val) =>
                            updateRateRow(index, "tds_type", val || "COMPANY")
                          }
                          dropdownZIndex={1000}
                        />
                      </Grid.Col>
                      <Grid.Col span={1.1}>
                        <Dropdown
                          label="Higher Rate Applicable"
                          data={[
                            { value: "false", label: "No" },
                            { value: "true", label: "Yes" },
                          ]}
                          value={String(row.higher_rate_applicable)}
                          styles={{
                            input: { fontSize: "13px", fontFamily: "Inter" },
                            label: { fontSize: "13px", fontFamily: "Inter" },
                          }}
                          onChange={(val) =>
                            updateRateRow(
                              index,
                              "higher_rate_applicable",
                              val === "true",
                            )
                          }
                          dropdownZIndex={1000}
                        />
                      </Grid.Col>
                      <Grid.Col span={2.5} style={{ position: "relative" }}>
                        <SearchableSelect
                          label="Account"
                          apiEndpoint={URL.chartOfAccounts}
                          value={row.account_id}
                          displayValue={
                            row.account_name || ""
                          }
                          dropdownZIndex={1100}
                          placeholder="Search by account name"
                          styles={{
                            input: { fontSize: "13px", fontFamily: "Inter" },
                            label: { fontSize: "13px", fontFamily: "Inter" },
                          }}
                          withAsterisk
                          minSearchLength={1}
                          searchFields={["gl_account_code", "account_name", "id"]}
                          displayFormat={(item: Record<string, unknown>) => {
                            const id = String(item.id ?? "").trim();
                            const gl = String(item.gl_account_code ?? "").trim();
                            const name = String(item.account_name ?? "").trim();
                            return {
                              value: id,
                              label: name ? `${name}${gl ? ` - ${gl}` : ""}` : gl,
                            };
                          }}
                          returnOriginalData
                          onChange={(value, _selectedData, originalData) => {
                            if (!value) {
                              if (
                                isEditMode &&
                                !originalData &&
                                (row.rate_account_code || row.account_name || row.subledger_code)
                              ) {
                                // Prevent initial/null sync from wiping prefilled edit data.
                                return;
                              }
                              updateRateRow(index, "account_id", null);
                              updateRateRow(index, "rate_account_code", "");
                              updateRateRow(index, "account_name", "");
                              updateRateRow(index, "subledger_code", "");
                              return;
                            }
                            if (!originalData) {
                              // In edit prefill flow, Select can emit value without original item.
                              // Keep existing mapped row data instead of wiping fields.
                              updateRateRow(index, "account_id", value);
                              return;
                            }
                            const nextGl = originalData.gl_account_code;
                            const nextName = originalData.account_name;
                            const nextSl = originalData.sl_code;
                            updateRateRow(index, "account_id", value);
                            updateRateRow(
                              index,
                              "rate_account_code",
                              nextGl !== undefined && nextGl !== null
                                ? String(nextGl)
                                : "",
                            );
                            updateRateRow(
                              index,
                              "account_name",
                              nextName !== undefined && nextName !== null
                                ? String(nextName)
                                : "",
                            );
                            if (nextSl !== undefined && nextSl !== null) {
                              updateRateRow(index, "subledger_code", String(nextSl));
                            }
                          }}
                        />
                        {(row.rate_account_code || row.subledger_code) && (
                          <Text
                            size="11px"
                            c="#666"
                            style={{
                              fontFamily: "Inter",
                              fontSize: "10px",
                              position: "absolute",
                              left: 0,
                              top: "100%",
                              marginTop: 4,
                              marginLeft: 10,
                            }}
                          >
                            GL: {row.rate_account_code || "-"}{" "}
                            <span style={{ margin: "0 6px" }}>|</span>
                            SL: {row.subledger_code || "-"}
                          </Text>
                        )}
                      </Grid.Col>
                      {/* <Grid.Col span={1.1}>
                        <TextInput
                          label="Subledger Code"
                          value={row.subledger_code}
                          styles={{
                            input: { fontSize: "13px", fontFamily: "Inter" },
                            label: { fontSize: "13px", fontFamily: "Inter" },
                          }}
                          onChange={(e) =>
                            updateRateRow(
                              index,
                              "subledger_code",
                              e.currentTarget.value,
                            )
                          }
                        />
                      </Grid.Col> */}
                      <Grid.Col span={1.5}>
                        <TextInput
                          label="Valid From Date"
                          type="date"
                          value={row.valid_from_date}
                          styles={{
                            input: { fontSize: "13px", fontFamily: "Inter" },
                            label: { fontSize: "13px", fontFamily: "Inter" },
                          }}
                          onChange={(e) =>
                            updateRateRow(
                              index,
                              "valid_from_date",
                              e.currentTarget.value,
                            )
                          }
                        />
                      </Grid.Col>
                      <Grid.Col span={0.5}>
                        <Group gap={4}>
                          <ActionIcon
                            variant="light"
                            color="red"
                            onClick={() => removeRateRow(index)}
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                          {index === rateRows.length - 1 && (
                            <ActionIcon
                              variant="light"
                              color="#105476"
                              onClick={addRateRow}
                            >
                              <IconPlus size={14} />
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
