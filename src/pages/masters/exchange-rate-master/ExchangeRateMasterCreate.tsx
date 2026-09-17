import { useEffect, useMemo, useState } from "react";
import {
  ActionIcon,
  Box,
  Button,
  Flex,
  Grid,
  Group,
  NumberInput,
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
import { API_HEADER } from "../../../store/storeKeys";
import {
  SearchableSelect,
  SingleDateInput,
  ToastNotification,
} from "../../../components";
import MasterAuditHeadingRow from "../../../components/MasterAuditHeadingRow";
import { useMasterEditAuditRefresh } from "../../../hooks/useMasterEditAuditRefresh";
import { URL } from "../../../api/serverUrls";
import useAuthStore from "../../../store/authStore";
import { getActiveBranch } from "../../../utils/branchOdexCredentials";
import { ROE_DECIMAL_PLACES } from "../../../utils/exchangeRateRoe";

type ExchangeRateFormData = {
  country_id: string;
  country_code: string;
  country_name: string;
  rate_date: Date | null;
};

type RateDetailRow = {
  id?: number;
  currency_id: string;
  currency_code: string;
  sell_rate: string;
  buy_rate: string;
};

type EditRateItem = {
  id?: number;
  currency_id?: number;
  currency_code?: string;
  sell_rate?: string | number;
  buy_rate?: string | number;
};

type EditState = {
  id?: number;
  country_id?: number;
  country_code?: string;
  country_name?: string;
  rate_date?: string | null;
  rates?: EditRateItem[];
  created_at?: string | null;
  updated_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
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
  country_id: yup.string().required("Country is required"),
  rate_date: yup.date().nullable().required("Rate date is required"),
});

const createEmptyRateRow = (): RateDetailRow => ({
  id: undefined,
  currency_id: "",
  currency_code: "",
  sell_rate: "",
  buy_rate: "",
});

const isValidRate = (value: string): boolean =>
  /^\d+(\.\d{1,6})?$/.test(value.trim());

const formatRateForPayload = (value: string): string => {
  const num = Number(value);
  if (Number.isNaN(num)) return value.trim();
  return num.toFixed(ROE_DECIMAL_PLACES);
};

const formatDateToYYYYMMDD = (date: Date | null): string | null => {
  if (!date) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const parseRateDate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const mapRateRows = (rows: EditRateItem[]): RateDetailRow[] =>
  rows.map((item) => ({
    id: item.id != null ? Number(item.id) : undefined,
    currency_id:
      item.currency_id != null && String(item.currency_id).trim() !== ""
        ? String(item.currency_id)
        : "",
    currency_code: String(item.currency_code ?? ""),
    sell_rate: item.sell_rate != null ? String(item.sell_rate) : "",
    buy_rate: item.buy_rate != null ? String(item.buy_rate) : "",
  }));

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

const extractErrorMessage = (err: unknown): string => {
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

    const fromWhole = flattenApiErrorMessages(obj);
    if (fromWhole.length > 0) return fromWhole.join(" ");
  }

  if (typeof err === "string" && err.trim() !== "") {
    return err.trim();
  }

  return "Something went wrong while saving Exchange Rate. Please try again.";
};

export default function ExchangeRateMasterCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rateRows, setRateRows] = useState<RateDetailRow[]>([
    createEmptyRateRow(),
  ]);

  const editData = (location.state as EditState | null) || null;
  const isEditMode =
    !!editData &&
    (Array.isArray(editData.rates)
      ? editData.rates.length > 0
      : !!editData.id);
  const primaryEditId =
    editData?.id ??
    (Array.isArray(editData?.rates) ? editData?.rates?.[0]?.id : undefined);

  const { auditSource, applyAuditFromResponse, refreshAuditFromDetail } =
    useMasterEditAuditRefresh(
      isEditMode ? (editData as Record<string, unknown>) : null,
      {
        detailBaseUrl: isEditMode ? URL.exchangeRateMaster : undefined,
        recordId: primaryEditId,
        enabled: isEditMode && primaryEditId != null,
      },
    );

  const defaultCountry = useMemo(() => {
    const activeBranch = getActiveBranch(
      user?.branches as
        | Array<{
            is_default?: boolean;
            country?: {
              country_id?: number;
              country_code?: string;
              country_name?: string;
            };
          }>
        | undefined,
    );
    const branchCountry = activeBranch?.country;
    const fallbackCountry = user?.country;
    return {
      country_id:
        branchCountry?.country_id != null
          ? String(branchCountry.country_id)
          : fallbackCountry?.country_id != null
            ? String(fallbackCountry.country_id)
            : "",
      country_code:
        branchCountry?.country_code || fallbackCountry?.country_code || "",
      country_name:
        branchCountry?.country_name || fallbackCountry?.country_name || "",
    };
  }, [user?.branches, user?.country]);

  const form = useForm<ExchangeRateFormData>({
    initialValues: {
      country_id: "",
      country_code: "",
      country_name: "",
      rate_date: null,
    },
    validate: yupResolver(schema),
  });

  useEffect(() => {
    if (isEditMode && editData) {
      form.setValues({
        country_id:
          editData.country_id != null ? String(editData.country_id) : "",
        country_code: editData.country_code || "",
        country_name: editData.country_name || editData.country_code || "",
        rate_date: parseRateDate(editData.rate_date),
      });
      if (Array.isArray(editData.rates) && editData.rates.length > 0) {
        setRateRows(mapRateRows(editData.rates));
      } else {
        setRateRows([createEmptyRateRow()]);
      }
      return;
    }

    form.setValues({
      country_id: defaultCountry.country_id,
      country_code: defaultCountry.country_code,
      country_name: defaultCountry.country_name,
      rate_date: new Date(),
    });
    setRateRows([createEmptyRateRow()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init once from edit/default country
  }, [isEditMode, editData?.id, defaultCountry.country_id]);

  const updateRateRow = (
    index: number,
    key: keyof RateDetailRow,
    value: string | number | undefined,
  ) => {
    setRateRows((prev) =>
      prev.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              [key]: value == null ? "" : String(value),
            }
          : row,
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

  const handleSubmit = async (values: ExchangeRateFormData) => {
    setIsSubmitting(true);

    try {
      const hasInvalidRateRow = rateRows.some(
        (row) =>
          !row.currency_id?.trim() ||
          !isValidRate(row.sell_rate) ||
          !isValidRate(row.buy_rate),
      );
      if (hasInvalidRateRow) {
        ToastNotification({
          type: "error",
          message:
            "Please fill Currency, Sell Rate and Buy Rate for all rate detail rows.",
        });
        setIsSubmitting(false);
        return;
      }

      const currencyIds = rateRows.map((row) => row.currency_id);
      if (new Set(currencyIds).size !== currencyIds.length) {
        const duplicateCodes = rateRows
          .filter(
            (row, index) =>
              row.currency_id &&
              currencyIds.indexOf(row.currency_id) !== index,
          )
          .map((row) => row.currency_code || row.currency_id)
          .filter(Boolean);
        const uniqueDupes = [...new Set(duplicateCodes)];
        ToastNotification({
          type: "error",
          message:
            uniqueDupes.length > 0
              ? `Currency "${uniqueDupes.join(", ")}" is duplicated. Each currency can be mapped only once per rate date.`
              : "Duplicate currencies are not allowed for the same rate date.",
        });
        setIsSubmitting(false);
        return;
      }

      const payload = {
        country: Number(values.country_id),
        rate_date: formatDateToYYYYMMDD(values.rate_date),
        rates: rateRows.map((row) => ({
          ...(row.id != null ? { id: row.id } : {}),
          currency: Number(row.currency_id),
          sell_rate: formatRateForPayload(row.sell_rate),
          buy_rate: formatRateForPayload(row.buy_rate),
        })),
      };

      if (isEditMode && primaryEditId != null) {
        const response = await putAPICall(
          URL.exchangeRateMaster,
          {
            ...payload,
            id: primaryEditId,
          },
          API_HEADER,
        );
        applyAuditFromResponse(response);
        await refreshAuditFromDetail(primaryEditId);
        ToastNotification({
          type: "success",
          message: "Exchange Rate Master updated successfully",
        });
      } else {
        await postAPICall(URL.exchangeRateMaster, payload, API_HEADER);
        ToastNotification({
          type: "success",
          message: "Exchange Rate Master created successfully",
        });
      }

      navigate("/master/exchange-rate-master");
    } catch (err: unknown) {
      ToastNotification({
        type: "error",
        message: `Error ${isEditMode ? "updating" : "creating"} Exchange Rate Master: ${extractErrorMessage(err)}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate("/master/exchange-rate-master");
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
                    color: "#105476",
                    textAlign: "center",
                  }}
                >
                  {isEditMode
                    ? "Edit Exchange Rate Master"
                    : "Create Exchange Rate Master"}
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
                  borderRadius: "8px",
                  padding: "24px",
                }}
                gutter="xs"
              >
                <Grid.Col span={6}>
                  <SearchableSelect
                    label="Country"
                    placeholder="Search country"
                    withAsterisk
                    apiEndpoint={URL.country}
                    value={form.values.country_id || null}
                    displayValue={
                      (() => {
                        const code = form.values.country_code?.trim() || "";
                        const name = form.values.country_name?.trim() || "";
                        if (code && name) return `${code}-${name}`;
                        return code || name || undefined;
                      })()
                    }
                    returnOriginalData
                    disabled
                    onChange={(val, selectedData, originalData) => {
                      if (val == null) {
                        form.setFieldValue("country_id", "");
                        form.setFieldValue("country_name", "");
                        form.setFieldValue("country_code", "");
                        return;
                      }
                      form.setFieldValue("country_id", val);
                      form.setFieldValue(
                        "country_name",
                        selectedData?.label ?? "",
                      );
                      form.setFieldValue(
                        "country_code",
                        (originalData as { country_code?: string } | null)
                          ?.country_code ?? "",
                      );
                    }}
                    dropdownZIndex={1000}
                    minSearchLength={1}
                    displayFormat={(item: Record<string, unknown>) => ({
                      value: String((item as { id?: number }).id ?? ""),
                      label: String(
                        (item as { country_name?: string }).country_name ??
                          (item as { country_code?: string }).country_code ??
                          "",
                      ),
                    })}
                    searchFields={["country_name", "country_code"]}
                    size="sm"
                    styles={fieldStyles}
                    error={form.errors.country_id}
                  />
                </Grid.Col>

                <Grid.Col span={6}>
                  <SingleDateInput
                    label="Rate Date"
                    placeholder="Select rate date"
                    value={form.values.rate_date}
                    onChange={(date) => form.setFieldValue("rate_date", date)}
                    size="sm"
                    withAsterisk
                    error={form.errors.rate_date as string}
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
                    Currency Rates
                  </Text>
                </Grid.Col>

                <Grid.Col span={12}>
                  <Grid gutter="sm" style={{ marginBottom: "6px" }}>
                    <Grid.Col span={0.8}>
                      <Text
                        size="13px"
                        fw={500}
                        c="#424242"
                        style={{ fontFamily: "Inter" }}
                      >
                        Sl No
                      </Text>
                    </Grid.Col>
                    <Grid.Col span={3.4}>
                      <Text
                        size="13px"
                        fw={500}
                        c="#424242"
                        style={{ fontFamily: "Inter" }}
                      >
                        Currency
                      </Text>
                    </Grid.Col>
                    <Grid.Col span={3.4}>
                      <Text
                        size="13px"
                        fw={500}
                        c="#424242"
                        style={{ fontFamily: "Inter" }}
                      >
                        Sell Rate
                      </Text>
                    </Grid.Col>
                    <Grid.Col span={3.4}>
                      <Text
                        size="13px"
                        fw={500}
                        c="#424242"
                        style={{ fontFamily: "Inter" }}
                      >
                        Buy Rate
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
                      <Grid.Col span={3.4}>
                        <SearchableSelect
                          placeholder="Search currency"
                          apiEndpoint={URL.currencyMaster}
                          value={row.currency_id || null}
                          displayValue={row.currency_code || undefined}
                          returnOriginalData
                          dropdownZIndex={1100}
                          minSearchLength={1}
                          styles={fieldStyles}
                          displayFormat={(item: Record<string, unknown>) => {
                            const code = String(
                              (item as { currency_code?: string; code?: string })
                                .currency_code ??
                                (item as { code?: string }).code ??
                                "",
                            );
                            return {
                              value: String((item as { id?: number }).id ?? ""),
                              label: code,
                            };
                          }}
                          searchFields={["currency_code", "code", "name"]}
                          onChange={(val, selectedData, originalData) => {
                            setRateRows((prev) =>
                              prev.map((r, rowIndex) => {
                                if (rowIndex !== index) return r;
                                if (val == null) {
                                  return {
                                    ...r,
                                    currency_id: "",
                                    currency_code: "",
                                  };
                                }
                                const code =
                                  (
                                    originalData as {
                                      currency_code?: string;
                                      code?: string;
                                    } | null
                                  )?.currency_code ??
                                  (originalData as { code?: string } | null)
                                    ?.code ??
                                  selectedData?.label ??
                                  "";
                                return {
                                  ...r,
                                  currency_id: val,
                                  currency_code: String(code),
                                };
                              }),
                            );
                          }}
                        />
                      </Grid.Col>
                      <Grid.Col span={3.4}>
                        <NumberInput
                          placeholder="Enter sell rate"
                          value={
                            row.sell_rate === "" ? "" : Number(row.sell_rate)
                          }
                          onChange={(value) =>
                            updateRateRow(
                              index,
                              "sell_rate",
                              value === "" || value == null
                                ? ""
                                : String(value),
                            )
                          }
                          min={0}
                          decimalScale={ROE_DECIMAL_PLACES}
                          fixedDecimalScale={false}
                          hideControls
                          styles={fieldStyles}
                        />
                      </Grid.Col>
                      <Grid.Col span={3.4}>
                        <NumberInput
                          placeholder="Enter buy rate"
                          value={
                            row.buy_rate === "" ? "" : Number(row.buy_rate)
                          }
                          onChange={(value) =>
                            updateRateRow(
                              index,
                              "buy_rate",
                              value === "" || value == null
                                ? ""
                                : String(value),
                            )
                          }
                          min={0}
                          decimalScale={ROE_DECIMAL_PLACES}
                          fixedDecimalScale={false}
                          hideControls
                          styles={fieldStyles}
                        />
                      </Grid.Col>
                      <Grid.Col span={1}>
                        <Group gap={4}>
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
                    cursor: isSubmitting ? "not-allowed" : "pointer",
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
