import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Flex,
  Grid,
  Group,
  NumberInput,
  Text,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconCheck } from "@tabler/icons-react";
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
  currency_id: string;
  currency_code: string;
  sell_rate: string;
  buy_rate: string;
  rate_date: Date | null;
};

type EditState = {
  id?: number;
  country_id?: number;
  country_code?: string;
  country_name?: string;
  currency_id?: number;
  currency_code?: string;
  sell_rate?: string | number;
  buy_rate?: string | number;
  rate_date?: string | null;
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

const rateSchema = yup
  .string()
  .required("This field is required")
  .test("is-decimal", "Enter a valid rate", (value) => {
    if (!value?.trim()) return false;
    return /^\d+(\.\d{1,6})?$/.test(value.trim());
  });

const schema = yup.object().shape({
  country_id: yup.string().required("Country is required"),
  currency_id: yup.string().required("Currency is required"),
  sell_rate: rateSchema,
  buy_rate: rateSchema,
  rate_date: yup.date().nullable().required("Rate date is required"),
});

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

export default function ExchangeRateMasterCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const editData = (location.state as EditState | null) || null;
  const isEditMode = !!editData?.id;
  const { auditSource, applyAuditFromResponse, refreshAuditFromDetail } =
    useMasterEditAuditRefresh(
      isEditMode ? (editData as Record<string, unknown>) : null,
      {
        detailBaseUrl: isEditMode ? URL.exchangeRateMaster : undefined,
        recordId: editData?.id,
        enabled: isEditMode,
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
      currency_id: "",
      currency_code: "",
      sell_rate: "",
      buy_rate: "",
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
        country_name:
          editData.country_name || editData.country_code || "",
        currency_id:
          editData.currency_id != null ? String(editData.currency_id) : "",
        currency_code: editData.currency_code || "",
        sell_rate:
          editData.sell_rate != null ? String(editData.sell_rate) : "",
        buy_rate: editData.buy_rate != null ? String(editData.buy_rate) : "",
        rate_date: parseRateDate(editData.rate_date),
      });
      return;
    }

    form.setValues({
      country_id: defaultCountry.country_id,
      country_code: defaultCountry.country_code,
      country_name: defaultCountry.country_name,
      currency_id: "",
      currency_code: "",
      sell_rate: "",
      buy_rate: "",
      rate_date: new Date(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init once from edit/default country
  }, [isEditMode, editData?.id, defaultCountry.country_id]);

  const handleSubmit = async (values: ExchangeRateFormData) => {
    setIsSubmitting(true);

    try {
      const payload = {
        country: Number(values.country_id),
        currency: Number(values.currency_id),
        sell_rate: formatRateForPayload(values.sell_rate),
        buy_rate: formatRateForPayload(values.buy_rate),
        rate_date: formatDateToYYYYMMDD(values.rate_date),
      };

      if (isEditMode && editData?.id != null) {
        const response = await putAPICall(
          URL.exchangeRateMaster,
          {
            ...payload,
            id: editData.id,
          },
          API_HEADER,
        );
        applyAuditFromResponse(response);
        await refreshAuditFromDetail(editData.id);
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
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      ToastNotification({
        type: "error",
        message: `Error ${isEditMode ? "updating" : "creating"} Exchange Rate Master: ${errorMessage}`,
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
                  height: "100%",
                  borderRadius: "8px",
                  padding: "24px",
                }}
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

                <Grid.Col span={6}></Grid.Col>

                <Grid.Col span={6}>
                  <SearchableSelect
                    label="Currency"
                    placeholder="Search currency"
                    withAsterisk
                    apiEndpoint={URL.currencyMaster}
                    value={form.values.currency_id || null}
                    displayValue={form.values.currency_code || undefined}
                    returnOriginalData
                    onChange={(val, selectedData, originalData) => {
                      if (val == null) {
                        form.setFieldValue("currency_id", "");
                        form.setFieldValue("currency_code", "");
                        return;
                      }
                      form.setFieldValue("currency_id", val);
                      const code =
                        (originalData as {
                          currency_code?: string;
                          code?: string;
                        } | null)?.currency_code ??
                        (originalData as { code?: string } | null)?.code ??
                        selectedData?.label ??
                        "";
                      form.setFieldValue("currency_code", String(code));
                    }}
                    dropdownZIndex={1000}
                    minSearchLength={1}
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
                    size="sm"
                    styles={fieldStyles}
                    error={form.errors.currency_id}
                  />
                </Grid.Col>

                <Grid.Col span={6}>
                  <SingleDateInput
                    label="Rate Date"
                    placeholder="Select rate date"
                    value={form.values.rate_date}
                    onChange={(date) =>
                      form.setFieldValue("rate_date", date)
                    }
                    size="sm"
                    withAsterisk
                    error={form.errors.rate_date as string}
                  />
                </Grid.Col>

                <Grid.Col span={6}>
                  <NumberInput
                    label="Sell Rate"
                    placeholder="Enter sell rate"
                    withAsterisk
                    value={
                      form.values.sell_rate === ""
                        ? ""
                        : Number(form.values.sell_rate)
                    }
                    onChange={(value) =>
                      form.setFieldValue(
                        "sell_rate",
                        value === "" || value == null ? "" : String(value),
                      )
                    }
                    min={0}
                    decimalScale={ROE_DECIMAL_PLACES}
                    fixedDecimalScale={false}
                    hideControls
                    error={form.errors.sell_rate}
                    styles={fieldStyles}
                  />
                </Grid.Col>

                <Grid.Col span={6}>
                  <NumberInput
                    label="Buy Rate"
                    placeholder="Enter buy rate"
                    withAsterisk
                    value={
                      form.values.buy_rate === ""
                        ? ""
                        : Number(form.values.buy_rate)
                    }
                    onChange={(value) =>
                      form.setFieldValue(
                        "buy_rate",
                        value === "" || value == null ? "" : String(value),
                      )
                    }
                    min={0}
                    decimalScale={ROE_DECIMAL_PLACES}
                    fixedDecimalScale={false}
                    hideControls
                    error={form.errors.buy_rate}
                    styles={fieldStyles}
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
