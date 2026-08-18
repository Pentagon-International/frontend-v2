import { Box, Button, Card, Grid, Group, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import SingleDateInput from "../../../components/SingleDateInput";
import ToastNotification from "../../../components/ToastNotification";
import { URL } from "../../../api/serverUrls";
import { postAPICall } from "../../../service/postApiCall";
import useAuthStore from "../../../store/authStore";

export type FapiaoReportSide = "cost" | "sell";

type FapiaoReportFormValues = {
  from_date: Date | null;
  to_date: Date | null;
};

type UserBranch = {
  is_default?: boolean;
  branch_code?: string | null;
  branch_name?: string | null;
  country?: { country_code?: string; country_name?: string | null };
};

export function isChinaDefaultBranch(
  branches?: UserBranch[] | null,
  userCountry?: { country_code?: string; country_name?: string | null } | null,
): boolean {
  const defaultBranch = branches?.find((b) => b.is_default === true);
  if (!defaultBranch) return false;
  const countryCode = String(defaultBranch.country?.country_code ?? "")
    .trim()
    .toUpperCase();
  if (countryCode === "CN" || countryCode.includes("CHINA")) return true;
  const countryName = String(defaultBranch.country?.country_name ?? "")
    .toUpperCase();
  if (countryName.includes("CHINA")) return true;
  const branchCode = String(defaultBranch.branch_code ?? "").toUpperCase();
  const branchName = String(defaultBranch.branch_name ?? "").toUpperCase();
  if (branchCode === "CHN" || branchName.includes("CHINA")) return true;
  const userCountryCode = String(userCountry?.country_code ?? "")
    .trim()
    .toUpperCase();
  const userCountryName = String(userCountry?.country_name ?? "").toUpperCase();
  return userCountryCode === "CN" || userCountryName.includes("CHINA");
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

type FapiaoReportProps = {
  side: FapiaoReportSide;
};

export default function FapiaoReport({ side }: FapiaoReportProps) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [printing, setPrinting] = useState(false);
  const isChinaUser = useMemo(
    () =>
      isChinaDefaultBranch(
        user?.branches as UserBranch[] | undefined,
        user?.country,
      ),
    [user?.branches, user?.country],
  );

  const title = side === "cost" ? "Cost Fapiao Report" : "Sell Fapiao Report";
  const filePrefix =
    side === "cost" ? "cost-fapiao-report" : "sell-fapiao-report";

  const form = useForm<FapiaoReportFormValues>({
    initialValues: {
      from_date: null,
      to_date: null,
    },
  });

  useEffect(() => {
    if (!isChinaUser) {
      navigate("/reports", { replace: true });
    }
  }, [isChinaUser, navigate]);

  const handleDownload = async () => {
    if (!form.values.from_date) {
      ToastNotification({ type: "error", message: "From date is required" });
      return;
    }
    if (!form.values.to_date) {
      ToastNotification({ type: "error", message: "To date is required" });
      return;
    }

    const body = {
      report_type: "fapiao_report",
      format: "csv",
      filters: {
        from_date: dayjs(form.values.from_date).format("YYYY-MM-DD"),
        to_date: dayjs(form.values.to_date).format("YYYY-MM-DD"),
        side,
      },
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
      downloadBlob(blob, `${filePrefix}-${stamp}.csv`);
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

  if (!isChinaUser) return null;

  return (
    <Box>
      <Group justify="space-between" mb="md">
        <Title order={4} style={{ color: "#105476" }}>
          {title}
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

          <Grid.Col span={12}>
            <Group justify="flex-end" mt="xs">
              <Button variant="default" onClick={() => navigate("/reports")}>
                Back
              </Button>
              <Button loading={printing} onClick={handleDownload}>
                Download
              </Button>
            </Group>
          </Grid.Col>
        </Grid>
      </Card>
    </Box>
  );
}
