import {
  Box,
  Button,
  Group,
  Loader,
  Stack,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { IconDownload, IconUpload } from "@tabler/icons-react";
import { useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { URL } from "../../../api/serverUrls";
import { apiCallProtected } from "../../../api/axios";
import { ToastNotification } from "../../../components";
import { getServerErrorMessage } from "../../../utils/apiErrorMessage";
import useAuthStore from "../../../store/authStore";
import { API_HEADER } from "../../../store/storeKeys";

type SalaryUploadResult = {
  status?: boolean;
  message?: string;
  data?: {
    errors?: string[];
    accepted_rows?: number;
    rejected_rows?: number;
    journal_voucher?: {
      id?: number;
      journal_no?: string;
      status?: string;
    } | null;
  };
};

/** Build a simple toast from API failure (interceptor: `{ message, details }`). */
function salaryUploadErrorToast(error: unknown): string {
  if (!error || typeof error !== "object") {
    return "Upload failed.";
  }
  const err = error as {
    message?: string;
    details?: { errors?: string[] };
    response?: { data?: SalaryUploadResult };
  };

  const detailErrors = err.details?.errors;
  if (Array.isArray(detailErrors) && detailErrors.length > 0) {
    return detailErrors.join("\n");
  }

  const raw = err.response?.data;
  const rawErrors = raw?.data?.errors;
  if (Array.isArray(rawErrors) && rawErrors.length > 0) {
    return rawErrors.join("\n");
  }

  if (typeof err.message === "string" && err.message.trim()) {
    return err.message.trim();
  }

  return getServerErrorMessage(error, "Upload failed.");
}

function salaryUploadPayloadToast(payload: SalaryUploadResult): string {
  const rowErrors = payload.data?.errors ?? [];
  if (rowErrors.length > 0) {
    return rowErrors.join("\n");
  }
  return payload.message?.trim() || "Upload failed.";
}

export default function JournalVoucherSalaryUpload() {
  const user = useAuthStore((s) => s.user);
  const canAccess = Boolean(
    user?.screen_permissions?.salary_journal_voucher_upload,
  );
  if (!canAccess) return <Navigate to="/" replace />;
  return <JournalVoucherSalaryUploadContent />;
}

function JournalVoucherSalaryUploadContent() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleDownloadTemplate = async () => {
    setIsDownloading(true);
    try {
      const response = (await apiCallProtected.get(
        `${URL.journalVoucher}salary-download-template/`,
        {
          ...API_HEADER,
          responseType: "blob",
        },
      )) as Blob | { data?: Blob };

      const blob =
        response instanceof Blob
          ? response
          : response?.data instanceof Blob
            ? response.data
            : null;
      if (!(blob instanceof Blob) || blob.size === 0) {
        throw new Error("Empty template response from server");
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        "salary_journal_voucher_bulk_upload_template.csv",
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: unknown) {
      ToastNotification({
        type: "error",
        message: getServerErrorMessage(
          error,
          "Failed to download salary JV template",
        ),
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      ToastNotification({
        type: "error",
        message: "Please select a CSV file to upload",
      });
      return;
    }
    setIsUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", selectedFile);
      const response = (await apiCallProtected.post(
        `${URL.journalVoucher}salary-bulk-upload/`,
        fd,
        {
          ...API_HEADER,
          headers: {
            ...API_HEADER.headers,
            "Content-Type": "multipart/form-data",
          },
        },
      )) as unknown;

      let payload: SalaryUploadResult | null = null;
      if (response && typeof response === "object") {
        const maybeAxios = response as {
          data?: SalaryUploadResult;
          status?: number | boolean;
          message?: string;
        };
        if (
          maybeAxios.data &&
          typeof maybeAxios.data === "object" &&
          ("message" in maybeAxios.data || "data" in maybeAxios.data)
        ) {
          payload = maybeAxios.data;
        } else {
          payload = response as SalaryUploadResult;
        }
      }
      if (!payload) {
        throw new Error("Unexpected upload response");
      }

      const jv = payload?.data?.journal_voucher;
      if (payload?.status && jv?.id) {
        ToastNotification({
          type: "success",
          message:
            payload.message ||
            `Salary journal voucher ${jv.journal_no || jv.id} created as UNPOSTED`,
        });
      } else {
        ToastNotification({
          type: "error",
          message: salaryUploadPayloadToast(payload),
        });
      }
    } catch (error: unknown) {
      ToastNotification({
        type: "error",
        message: salaryUploadErrorToast(error),
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Box p="md" maw={720} mx="auto">
      {(isDownloading || isUploading) && (
        <Box
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(255,255,255,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <Stack align="center" gap="md">
            <Loader size="lg" color="#105476" />
            <Text size="sm" c="#105476" fw={500}>
              {isDownloading ? "Downloading template..." : "Uploading salary CSV..."}
            </Text>
          </Stack>
        </Box>
      )}

      <Group justify="space-between" mb="md" wrap="wrap">
        <Text size="xl" fw={700} c="#105476">
          Salary Journal Voucher Upload
        </Text>
        <UnstyledButton
          c="#105476"
          onClick={handleDownloadTemplate}
          disabled={isDownloading}
        >
          <Group gap={6}>
            <IconDownload size={16} />
            <Text size="sm" fw={600}>
              Download Template
            </Text>
          </Group>
        </UnstyledButton>
      </Group>

      <Text size="sm" c="dimmed" mb="md">
        Upload the salary CSV to create one UNPOSTED journal voucher. If any
        row fails, the whole upload is blocked and the error is shown in a toast.
      </Text>

      <Box
        p="xl"
        style={{
          border: "1px dashed #A6B0C3",
          borderRadius: 8,
          textAlign: "center",
          cursor: "pointer",
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <Stack align="center" gap={6}>
          <Box
            bg="#E7F0FD"
            style={{
              width: 64,
              height: 64,
              borderRadius: 999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <IconUpload size={28} color="#105476" />
          </Box>
          <Text size="sm">
            {selectedFile ? selectedFile.name : "Click to browse your CSV file"}
          </Text>
          <Text size="xs" c="dimmed">
            Supports: csv format
          </Text>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              setSelectedFile(file);
            }}
          />
        </Stack>
      </Box>

      <Group justify="flex-end" mt="md">
        <Button
          color="#105476"
          onClick={handleUpload}
          disabled={!selectedFile || isUploading}
        >
          Upload
        </Button>
      </Group>
    </Box>
  );
}
