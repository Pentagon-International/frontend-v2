import dayjs from "dayjs";
import { apiCallProtected } from "../api/axios";
import toast from "react-hot-toast";

function downloadBlob(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * POST the DSR list endpoint with the same filters plus `type: "csv"` and save the file.
 */
export async function downloadDsrCsv(options: {
  endpoint: string;
  payload: Record<string, unknown>;
  fileNamePrefix: string;
}): Promise<void> {
  const { endpoint, payload, fileNamePrefix } = options;
  const response = (await apiCallProtected.post(
    endpoint,
    { ...payload, type: "csv" },
    { responseType: "blob" },
  )) as Blob | { data?: Blob };

  const blob =
    response instanceof Blob
      ? response
      : response?.data instanceof Blob
        ? response.data
        : null;

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
    throw new Error(msg || "CSV download failed");
  }

  const stamp = dayjs().format("YYYYMMDD-HHmmss");
  downloadBlob(blob, `${fileNamePrefix}-${stamp}.csv`);
  toast.success("CSV downloaded");
}
