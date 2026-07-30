import { Box, Button, Card, Grid, Group, Select, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SingleDateInput from "../../../components/SingleDateInput";
import ToastNotification from "../../../components/ToastNotification";
import { URL } from "../../../api/serverUrls";
import { postAPICall } from "../../../service/postApiCall";
import { getFilterBranchMasterOptions } from "../../../service/dashboard.service";
import useAuthStore from "../../../store/authStore";

type GstReportFormValues = {
  from_date: Date | null;
  to_date: Date | null;
  branch_code: string | null;
};

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

export default function GstReport() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [printing, setPrinting] = useState(false);
  const [branchOptions, setBranchOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [branchLoading, setBranchLoading] = useState(false);

  const form = useForm<GstReportFormValues>({
    initialValues: {
      from_date: null,
      to_date: null,
      branch_code: null,
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
    if (!form.values.from_date) {
      ToastNotification({ type: "error", message: "From date is required" });
      return;
    }
    if (!form.values.to_date) {
      ToastNotification({ type: "error", message: "To date is required" });
      return;
    }

    const filters: Record<string, unknown> = {
      from_date: dayjs(form.values.from_date).format("YYYY-MM-DD"),
      to_date: dayjs(form.values.to_date).format("YYYY-MM-DD"),
    };

    if (form.values.branch_code?.trim()) {
      filters.branch_code = form.values.branch_code.trim();
    }

    const body = {
      report_type: "sales_gst_register",
      format: "csv",
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

      // If server returns JSON error in a blob, surface it.
      const head = await blob.slice(0, 256).text();
      const headTrim = head.trimStart();
      if (headTrim.startsWith("{") || headTrim.startsWith("[")) {
        const fullText = await blob.text();
        let parsed: { detail?: unknown; message?: unknown; error?: unknown };
        try {
          parsed = JSON.parse(fullText) as typeof parsed;
        } catch {
          throw new Error(fullText.slice(0, 500) || "Invalid response from server");
        }
        const raw = parsed.detail ?? parsed.message ?? parsed.error ?? fullText;
        const msg = Array.isArray(raw)
          ? raw.map(String).join(", ")
          : typeof raw === "string"
            ? raw
            : JSON.stringify(raw);
        throw new Error(msg || "Report generation failed");
      }

      const stamp = dayjs().format("YYYYMMDD-HHmmss");
      downloadBlob(blob, `gst-report-${stamp}.csv`);
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
          const parsed = JSON.parse(text) as { detail?: string; message?: string };
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
          GST Register Report
        </Title>
      </Group>

      <Card withBorder radius="md" padding="lg">
        <Grid gutter="sm">
          <Grid.Col span={{ base: 12, md: 3 }}>
            <SingleDateInput
              label="From Date"
              value={form.values.from_date}
              onChange={(d) => form.setFieldValue("from_date", d)}
              withAsterisk
              allowDeselection={false}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <SingleDateInput
              label="To Date"
              value={form.values.to_date}
              onChange={(d) => form.setFieldValue("to_date", d)}
              withAsterisk
              allowDeselection={false}
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

          <Grid.Col span={12}>
            <Group justify="flex-end" mt="xs">
              <Button variant="default" onClick={() => navigate("/reports")}>
                Back
              </Button>
              <Button loading={printing} onClick={handlePrint}>
                Download
              </Button>
            </Group>
          </Grid.Col>
        </Grid>
      </Card>
    </Box>
  );
}
