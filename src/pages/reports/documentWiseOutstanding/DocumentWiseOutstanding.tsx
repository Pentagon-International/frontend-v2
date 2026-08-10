import {
  Box,
  Button,
  Card,
  Grid,
  Group,
  Select,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Dropdown from "../../../components/Dropdown";
import SearchableSelect from "../../../components/SearchableSelect";
import SingleDateInput from "../../../components/SingleDateInput";
import ToastNotification from "../../../components/ToastNotification";
import { URL } from "../../../api/serverUrls";
import { postAPICall } from "../../../service/postApiCall";
import { getFilterBranchMasterOptions } from "../../../service/dashboard.service";
import useAuthStore from "../../../store/authStore";

type DocumentWiseOutstandingFormValues = {
  format: string | null;
  branch_code: string | null;
  account_id: string | null;
  account_code: string;
  account_name: string;
  sl_code: string;
  to_date: Date | null;
};

function extensionForFormat(contentType: string | undefined): string {
  const ct = (contentType || "").toLowerCase();
  if (ct.includes("text/csv") || ct.includes("csv")) return "csv";
  return "csv";
}

function shouldIncludeSlCode(slCode: string): boolean {
  const trimmed = slCode.trim();
  if (!trimmed) return false;
  if (trimmed === "0") return false;
  const asNumber = Number(trimmed);
  if (!Number.isNaN(asNumber) && asNumber === 0) return false;
  return true;
}

export default function DocumentWiseOutstanding() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [printing, setPrinting] = useState(false);
  const [branchOptions, setBranchOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [branchLoading, setBranchLoading] = useState(false);

  const form = useForm<DocumentWiseOutstandingFormValues>({
    initialValues: {
      format: "csv",
      branch_code: null,
      account_id: null,
      account_code: "",
      account_name: "",
      sl_code: "",
      to_date: null,
    },
  });

  useEffect(() => {
    const countryCode = user?.country?.country_code;
    if (!countryCode) {
      setBranchOptions([]);
      return;
    }

    let cancelled = false;
    const loadBranches = async () => {
      setBranchLoading(true);
      try {
        const branches = await getFilterBranchMasterOptions(countryCode);
        if (cancelled) return;
        setBranchOptions(
          branches.map((b) => ({
            value: b.branch_code,
            label: b.branch_name?.trim() || b.branch_code,
          })),
        );
      } catch (error) {
        console.error("Error loading branch options:", error);
        if (!cancelled) setBranchOptions([]);
      } finally {
        if (!cancelled) setBranchLoading(false);
      }
    };

    void loadBranches();
    return () => {
      cancelled = true;
    };
  }, [user?.country?.country_code]);

  const handlePrint = async () => {
    if (!form.values.account_code?.trim()) {
      ToastNotification({
        type: "error",
        message: "GL Account is required",
      });
      return;
    }

    const fmt = (form.values.format ?? "").trim();
    if (!fmt) {
      ToastNotification({ type: "error", message: "Report format is required" });
      return;
    }

    const filters: Record<string, unknown> = {
      account_code: form.values.account_code.trim(),
    };

    if (form.values.branch_code?.trim()) {
      filters.branch_code = form.values.branch_code.trim();
    }

    if (shouldIncludeSlCode(form.values.sl_code)) {
      filters.sl_code = form.values.sl_code.trim();
    }

    if (form.values.to_date) {
      filters.to_date = dayjs(form.values.to_date).format("YYYY-MM-DD");
    }

    const uiFormat = fmt.toLowerCase();
    const body = {
      report_type: "document_wise_outstanding",
      format: uiFormat,
      filters,
    };

    setPrinting(true);
    try {
      const response = (await postAPICall(URL.reportsGenerate, body, {
        responseType: "blob",
      })) as { data?: Blob; headers?: { "content-type"?: string } };

      const blob =
        response?.data instanceof Blob
          ? response.data
          : (response as unknown as Blob);
      if (!(blob instanceof Blob) || blob.size === 0) {
        throw new Error("Empty response from server");
      }

      const head = await blob.slice(0, 256).text();
      const headTrim = head.trimStart();
      if (headTrim.startsWith("{") || headTrim.startsWith("[")) {
        const fullText = await blob.text();
        let parsed: {
          detail?: unknown;
          message?: unknown;
          error?: unknown;
        };
        try {
          parsed = JSON.parse(fullText) as typeof parsed;
        } catch {
          throw new Error(
            fullText.slice(0, 500) || "Invalid response from server",
          );
        }
        const raw = parsed.detail ?? parsed.message ?? parsed.error ?? fullText;
        const msg = Array.isArray(raw)
          ? raw.map(String).join(", ")
          : typeof raw === "string"
            ? raw
            : JSON.stringify(raw);
        throw new Error(msg || "Report generation failed");
      }

      const contentType = response.headers?.["content-type"] ?? "";
      const ext = extensionForFormat(contentType);
      const stamp = dayjs().format("YYYYMMDD-HHmmss");
      const fileName = `os-report-document-wise-${stamp}.${ext}`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      ToastNotification({ type: "success", message: "Report downloaded" });
    } catch (e: unknown) {
      const err = e as {
        response?: { data?: Blob; status?: number };
        message?: string;
      };
      let message = err?.message || "Failed to generate report";
      const data = err?.response?.data;
      if (data instanceof Blob) {
        try {
          const text = await data.text();
          const parsed = JSON.parse(text) as {
            detail?: string;
            message?: string;
          };
          message = parsed.detail || parsed.message || text || message;
        } catch {
          /* keep default message */
        }
      }
      ToastNotification({ type: "error", message });
    } finally {
      setPrinting(false);
    }
  };

  return (
    <Box>
      <Group justify="space-between" mb="md">
        <Title order={4} style={{ color: "#105476" }}>
          OS Report - Document Wise
        </Title>
      </Group>

      <Card withBorder radius="md" padding="lg">
        <Grid gutter="sm">
          <Grid.Col span={{ base: 12, md: 3 }}>
            <SearchableSelect
              label="GL Account"
              placeholder="Search by GL account"
              apiEndpoint={URL.chartOfAccounts}
              value={form.values.account_id}
              dropdownZIndex={400}
              minSearchLength={1}
              searchFields={["gl_account_code", "account_name", "id"]}
              withAsterisk
              displayFormat={(item: Record<string, unknown>) => {
                const id = String(item.id ?? "").trim();
                const gl = String(item.gl_account_code ?? "").trim();
                const name = String(item.account_name ?? "").trim();
                const glName = String(item.gl_name ?? "").trim();
                return {
                  value: id,
                  label: [name, gl, glName].filter(Boolean).join(" - "),
                };
              }}
              displayValue={
                form.values.account_name
                  ? `${form.values.account_name}${form.values.account_code ? ` - ${form.values.account_code}` : ""}`
                  : form.values.account_code || undefined
              }
              returnOriginalData
              onChange={(value, _selectedData, originalData) => {
                if (!value || !originalData) {
                  form.setFieldValue("account_id", null);
                  form.setFieldValue("account_code", "");
                  form.setFieldValue("account_name", "");
                  form.setFieldValue("sl_code", "");
                  return;
                }
                form.setFieldValue("account_id", value);
                form.setFieldValue(
                  "account_code",
                  originalData.gl_account_code !== undefined &&
                    originalData.gl_account_code !== null
                    ? String(originalData.gl_account_code)
                    : "",
                );
                form.setFieldValue(
                  "account_name",
                  originalData.account_name !== undefined &&
                    originalData.account_name !== null
                    ? String(originalData.account_name)
                    : "",
                );
                form.setFieldValue(
                  "sl_code",
                  originalData.sl_code !== undefined &&
                    originalData.sl_code !== null
                    ? String(originalData.sl_code)
                    : "",
                );
              }}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <SingleDateInput
              label="To Date"
              value={form.values.to_date}
              onChange={(d) => form.setFieldValue("to_date", d)}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Select
              label="Branch"
              placeholder="Select branch"
              data={branchOptions}
              value={form.values.branch_code}
              onChange={(v) => form.setFieldValue("branch_code", v)}
              clearable
              searchable
              disabled={!branchOptions.length && !branchLoading}
              nothingFoundMessage={
                branchLoading ? "Loading branches..." : "No branches found"
              }
              size="sm"
              comboboxProps={{ zIndex: 400 }}
              styles={{
                input: {
                  fontSize: "13px",
                  height: "36px",
                  fontFamily: "Inter",
                },
                label: {
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "#424242",
                  marginBottom: "4px",
                  fontFamily: "Inter",
                },
              }}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <TextInput
              label="SL Code"
              placeholder="SL Code"
              value={form.values.sl_code}
              readOnly
              styles={{
                input: {
                  fontSize: "13px",
                  height: "36px",
                  fontFamily: "Inter",
                  backgroundColor: "var(--mantine-color-gray-0)",
                },
                label: {
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "#424242",
                  marginBottom: "4px",
                  fontFamily: "Inter",
                },
              }}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Dropdown
              label="Report Format"
              data={[{ value: "csv", label: "CSV" }]}
              value={form.values.format}
              onChange={(v) => form.setFieldValue("format", v ?? "csv")}
              withAsterisk
              clearable={false}
            />
          </Grid.Col>

          <Grid.Col span={12}>
            <Group justify="flex-end" mt="xs">
              <Button variant="default" onClick={() => navigate("/reports")}>
                Back
              </Button>
              <Button loading={printing} onClick={handlePrint}>
                Print
              </Button>
            </Group>
          </Grid.Col>
        </Grid>
      </Card>
    </Box>
  );
}
