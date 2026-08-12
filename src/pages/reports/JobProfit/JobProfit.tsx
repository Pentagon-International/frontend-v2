import {
  Box,
  Button,
  Card,
  Grid,
  Group,
  Select,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import SingleDateInput from "../../../components/SingleDateInput";
import Dropdown from "../../../components/Dropdown";
import SearchableSelect from "../../../components/SearchableSelect";
import ToastNotification from "../../../components/ToastNotification";
import { URL } from "../../../api/serverUrls";
import { apiCallProtected } from "../../../api/axios";
import { postAPICall } from "../../../service/postApiCall";
import { getFilterBranchMasterOptions } from "../../../service/dashboard.service";
import useAuthStore from "../../../store/authStore";

type JobProfitFormValues = {
  service: string | null;
  trade: string | null;
  salesperson: string | null;
  date_from: Date | null;
  date_to: Date | null;
  pol: string;
  pod: string;
  report_format: string | null;
  branch_code: string | null;
  status: string | null;
};

const SERVICE_OPTIONS = [
  { value: "AIR", label: "AIR" },
  { value: "FCL", label: "FCL" },
  { value: "LCL", label: "LCL" },
] as const;

const TRADE_OPTIONS = [
  { value: "IMPORT", label: "IMPORT" },
  { value: "EXPORT", label: "EXPORT" },
] as const;

const JOB_STATUS_OPTIONS = [
  { value: "ACTIVE", label: "ACTIVE" },
  { value: "CLOSED", label: "CLOSED" },
  { value: "CANCEL", label: "CANCEL" },
] as const;

const REPORT_FORMAT_OPTIONS = [
  { value: "pdf", label: "PDF" },
  { value: "csv", label: "CSV" },
];

function toApiService(value: string | null): string | undefined {
  if (!value) return undefined;
  const map: Record<string, string> = {
    AIR: "Air",
    FCL: "FCL",
    LCL: "LCL",
  };
  return map[value] ?? value;
}

function toApiTrade(value: string | null): string | undefined {
  if (!value) return undefined;
  const map: Record<string, string> = {
    IMPORT: "Import",
    EXPORT: "Export",
  };
  return map[value] ?? value;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

function extensionForFormat(
  format: string | null,
  contentType: string | undefined,
): string {
  const ct = (contentType || "").toLowerCase();
  if (ct.includes("pdf")) return "pdf";
  if (ct.includes("text/csv") || ct.includes("csv")) return "csv";
  if (format === "csv") return "csv";
  return "pdf";
}

async function parseBlobError(blob: Blob, fallback: string): Promise<string> {
  const head = await blob.slice(0, 256).text();
  const headTrim = head.trimStart();
  if (!headTrim.startsWith("{") && !headTrim.startsWith("[")) {
    return fallback;
  }
  const fullText = await blob.text();
  try {
    const parsed = JSON.parse(fullText) as {
      detail?: unknown;
      message?: unknown;
      error?: unknown;
    };
    const raw = parsed.detail ?? parsed.message ?? parsed.error ?? fullText;
    if (Array.isArray(raw)) return raw.map(String).join(", ");
    if (typeof raw === "string") return raw;
    return JSON.stringify(raw);
  } catch {
    return fullText.slice(0, 500) || fallback;
  }
}

export default function JobProfit() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [printing, setPrinting] = useState(false);
  const [branchOptions, setBranchOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [branchLoading, setBranchLoading] = useState(false);

  const form = useForm<JobProfitFormValues>({
    initialValues: {
      service: null,
      trade: null,
      salesperson: null,
      date_from: null,
      date_to: null,
      pol: "",
      pod: "",
      report_format: "pdf",
      branch_code: null,
      status: null,
    },
  });

  const { data: salespersonsData = [], isLoading: salespersonsLoading } =
    useQuery({
      queryKey: ["job-profit-salespersons"],
      queryFn: async () => {
        const response = await apiCallProtected.post(URL.salespersons, {});
        const data = response as { data?: unknown[] };
        return Array.isArray(data?.data) ? data.data : [];
      },
      staleTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
    });

  const salespersonOptions = useMemo(() => {
    if (!Array.isArray(salespersonsData)) return [];
    return salespersonsData
      .filter((item: { sales_person?: string }) => item?.sales_person)
      .map((item: { sales_person?: string }) => ({
        value: String(item.sales_person),
        label: String(item.sales_person),
      }));
  }, [salespersonsData]);

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
        const options = branches.map((b) => ({
          value: b.branch_code,
          label: b.branch_name?.trim() || b.branch_code,
        }));
        setBranchOptions(options);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.country?.country_code]);

  const handlePrint = async () => {
    if (!form.values.date_from) {
      ToastNotification({ type: "error", message: "From Date is required" });
      return;
    }
    if (!form.values.date_to) {
      ToastNotification({ type: "error", message: "To Date is required" });
      return;
    }
    if (!form.values.report_format) {
      ToastNotification({
        type: "error",
        message: "Report format is required",
      });
      return;
    }

    const filters: Record<string, string> = {
      date_from: dayjs(form.values.date_from).format("YYYY-MM-DD"),
      date_to: dayjs(form.values.date_to).format("YYYY-MM-DD"),
    };

    const service = toApiService(form.values.service);
    if (service) filters.service = service;

    const trade = toApiTrade(form.values.trade);
    if (trade) filters.trade = trade;

    if (form.values.salesperson?.trim()) {
      filters.salesperson = form.values.salesperson.trim();
    }
    if (form.values.pol?.trim()) {
      filters.pol = form.values.pol.trim();
    }
    if (form.values.pod?.trim()) {
      filters.pod = form.values.pod.trim();
    }
    if (form.values.branch_code?.trim()) {
      filters.branch_code = form.values.branch_code.trim();
    }
    if (form.values.status) {
      filters.status = form.values.status;
    }

    const format = form.values.report_format.toLowerCase();
    const body = {
      report_type: "job_profit_report",
      format,
      filters,
    };

    setPrinting(true);
    try {
      const response = (await postAPICall(URL.reportsGenerate, body, {
        responseType: "blob",
      })) as { data?: Blob; headers?: Record<string, string> };

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
        throw new Error(await parseBlobError(blob, "Report generation failed"));
      }

      const contentType =
        response.headers?.["content-type"] ??
        response.headers?.["Content-Type"];
      const ext = extensionForFormat(format, contentType);
      const stamp = dayjs().format("YYYYMMDD-HHmmss");
      downloadBlob(blob, `job-profit-report-${stamp}.${ext}`);
      ToastNotification({ type: "success", message: "Report downloaded" });
    } catch (e: unknown) {
      const err = e as {
        response?: { data?: Blob };
        message?: string;
      };
      let message = err?.message || "Failed to generate report";
      const data = err?.response?.data;
      if (data instanceof Blob) {
        message = await parseBlobError(data, message);
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
          Job Profit
        </Title>
      </Group>

      <Card withBorder radius="md" padding="lg">
        <Grid gutter="sm">
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Dropdown
              label="Service"
              placeholder="Select service"
              data={[...SERVICE_OPTIONS]}
              value={form.values.service}
              onChange={(v) => form.setFieldValue("service", v)}
              clearable
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Dropdown
              label="Trade"
              placeholder="Select trade"
              data={[...TRADE_OPTIONS]}
              value={form.values.trade}
              onChange={(v) => form.setFieldValue("trade", v)}
              clearable
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Dropdown
              label="Salesperson"
              placeholder={
                salespersonsLoading ? "Loading..." : "Select salesperson"
              }
              data={salespersonOptions}
              value={form.values.salesperson}
              onChange={(v) => form.setFieldValue("salesperson", v)}
              clearable
              searchable
              disabled={salespersonsLoading}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Select
              label="Branch"
              placeholder={branchLoading ? "Loading..." : "Select branch"}
              data={branchOptions}
              value={form.values.branch_code}
              onChange={(v) => form.setFieldValue("branch_code", v)}
              clearable
              searchable
              disabled={branchLoading}
              nothingFoundMessage="No branches"
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
            <SingleDateInput
              label="From Date"
              value={form.values.date_from}
              onChange={(d) => form.setFieldValue("date_from", d)}
              withAsterisk
              allowDeselection={false}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <SingleDateInput
              label="To Date"
              value={form.values.date_to}
              onChange={(d) => form.setFieldValue("date_to", d)}
              withAsterisk
              allowDeselection={false}
            />
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 3 }}>
            <SearchableSelect
              size="sm"
              label="POL"
              placeholder="Type port name"
              apiEndpoint={URL.portMaster}
              dropdownZIndex={10}
              searchFields={["port_code", "port_name"]}
              displayFormat={(item: Record<string, unknown>) => ({
                value: String(item.port_code),
                label: `${item.port_name} (${item.port_code})`,
              })}
              value={form.values.pol}
              displayValue={form.values.pol}
              onChange={(value) => form.setFieldValue("pol", value || "")}
              minSearchLength={2}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <SearchableSelect
              size="sm"
              label="POD"
              placeholder="Type port name"
              apiEndpoint={URL.portMaster}
              dropdownZIndex={10}
              searchFields={["port_code", "port_name"]}
              displayFormat={(item: Record<string, unknown>) => ({
                value: String(item.port_code),
                label: `${item.port_name} (${item.port_code})`,
              })}
              value={form.values.pod}
              displayValue={form.values.pod}
              onChange={(value) => form.setFieldValue("pod", value || "")}
              minSearchLength={2}
            />
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 3 }}>
            <Dropdown
              label="Report Format"
              data={REPORT_FORMAT_OPTIONS}
              value={form.values.report_format}
              onChange={(v) => form.setFieldValue("report_format", v)}
              clearable={false}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Dropdown
              label="Job Status"
              placeholder="Select job status"
              data={[...JOB_STATUS_OPTIONS]}
              value={form.values.status}
              onChange={(v) => form.setFieldValue("status", v)}
              clearable
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
