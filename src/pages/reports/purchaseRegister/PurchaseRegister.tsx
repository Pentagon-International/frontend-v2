import { Box, Button, Card, Grid, Group, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import dayjs from "dayjs";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import SingleDateInput from "../../../components/SingleDateInput";
import Dropdown from "../../../components/Dropdown";
import ToastNotification from "../../../components/ToastNotification";
import { URL } from "../../../api/serverUrls";
import { postAPICall } from "../../../service/postApiCall";

type PurchaseRegisterFormValues = {
  from_date: Date | null;
  to_date: Date | null;
  with_gst: "yes" | "no";
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

export default function PurchaseRegister() {
  const navigate = useNavigate();
  const [printing, setPrinting] = useState(false);

  const form = useForm<PurchaseRegisterFormValues>({
    initialValues: {
      from_date: null,
      to_date: null,
      with_gst: "no",
    },
  });

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
      csv_variant: form.values.with_gst === "yes" ? "gst" : "default",
    };

    const body = {
      report_type: "purchase_register",
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
      downloadBlob(blob, `purchase-register-${stamp}.csv`);
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
          Purchase Register
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
            <Dropdown
              label="With GST"
              data={[
                { value: "yes", label: "Yes" },
                { value: "no", label: "No" },
              ]}
              value={form.values.with_gst}
              onChange={(v) => form.setFieldValue("with_gst", (v as "yes" | "no") || "yes")}
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

