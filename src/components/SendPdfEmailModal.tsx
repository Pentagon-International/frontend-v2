import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Group,
  Modal,
  Stack,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { IconSend } from "@tabler/icons-react";
import { apiCallProtected } from "../api/axios";
import { URL } from "../api/serverUrls";
import ToastNotification from "./ToastNotification";

export type SendPdfEmailModalProps = {
  opened: boolean;
  onClose: () => void;
  pdfBlobUrl: string | null;
  /** Used for the attachment filename (e.g. Bill-Of-Lading-HBL123.pdf) */
  fileName: string;
  /** Shown in modal title and default subject */
  documentLabel: string;
  defaultToEmail?: string;
  defaultCcEmail?: string;
  defaultSubject?: string;
  defaultMessage?: string;
};

const parseEmails = (emailString: string): string[] =>
  emailString
    .split(/[,;]/)
    .map((email) => email.trim())
    .filter((email) => email.length > 0);

const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

/**
 * Send-email modal matching Quotation PDF preview:
 * To / CC / Subject / Message + PDF attachment via multipart FormData.
 */
export default function SendPdfEmailModal({
  opened,
  onClose,
  pdfBlobUrl,
  fileName,
  documentLabel,
  defaultToEmail = "",
  defaultCcEmail = "",
  defaultSubject,
  defaultMessage,
}: SendPdfEmailModalProps) {
  const [sending, setSending] = useState(false);
  const [emailForm, setEmailForm] = useState({
    to_email: defaultToEmail,
    cc_email: defaultCcEmail,
    subject: defaultSubject || documentLabel,
    message: defaultMessage || `Please find the attached ${documentLabel}.`,
  });
  const [emailErrors, setEmailErrors] = useState({
    to_email: "",
    cc_email: "",
  });

  useEffect(() => {
    if (!opened) return;
    setEmailForm({
      to_email: defaultToEmail,
      cc_email: defaultCcEmail,
      subject: defaultSubject || documentLabel,
      message: defaultMessage || `Please find the attached ${documentLabel}.`,
    });
    setEmailErrors({ to_email: "", cc_email: "" });
  }, [
    opened,
    defaultToEmail,
    defaultCcEmail,
    defaultSubject,
    defaultMessage,
    documentLabel,
  ]);

  const handleClose = () => {
    if (sending) return;
    onClose();
  };

  const handleSend = async () => {
    if (!pdfBlobUrl) {
      ToastNotification({
        type: "error",
        message: "PDF not available",
      });
      return;
    }

    const toEmailString = emailForm.to_email.trim();
    if (!toEmailString) {
      setEmailErrors((prev) => ({
        ...prev,
        to_email: "Please enter recipient email address(es)",
      }));
      ToastNotification({
        type: "error",
        message: "Please enter recipient email address(es)",
      });
      return;
    }

    const toEmailArray = parseEmails(toEmailString);
    if (toEmailArray.length === 0) {
      setEmailErrors((prev) => ({
        ...prev,
        to_email: "Please enter valid email address(es)",
      }));
      ToastNotification({
        type: "error",
        message:
          "Please enter valid email address(es) separated by comma or semicolon",
      });
      return;
    }

    const invalidTo = toEmailArray.filter((email) => !isValidEmail(email));
    if (invalidTo.length > 0) {
      setEmailErrors((prev) => ({
        ...prev,
        to_email: `Invalid email address(es): ${invalidTo.join(", ")}`,
      }));
      ToastNotification({
        type: "error",
        message: `Invalid email address(es): ${invalidTo.join(", ")}`,
      });
      return;
    }

    let ccEmailArray: string[] = [];
    const ccEmailString = emailForm.cc_email.trim();
    if (ccEmailString) {
      ccEmailArray = parseEmails(ccEmailString);
      const invalidCc = ccEmailArray.filter((email) => !isValidEmail(email));
      if (invalidCc.length > 0) {
        setEmailErrors((prev) => ({
          ...prev,
          cc_email: `Invalid email address(es): ${invalidCc.join(", ")}`,
        }));
        ToastNotification({
          type: "error",
          message: `Invalid CC email address(es): ${invalidCc.join(", ")}`,
        });
        return;
      }
    }

    setEmailErrors({ to_email: "", cc_email: "" });
    setSending(true);

    try {
      const response = await fetch(pdfBlobUrl);
      const blob = await response.blob();
      const safeName = fileName.toLowerCase().endsWith(".pdf")
        ? fileName
        : `${fileName}.pdf`;
      const pdfFile = new File([blob], safeName, { type: "application/pdf" });

      const formData = new FormData();
      formData.append("to_email", JSON.stringify(toEmailArray));
      if (ccEmailArray.length > 0) {
        formData.append("cc_email", JSON.stringify(ccEmailArray));
      }
      formData.append("subject", emailForm.subject);
      formData.append("message", emailForm.message);
      formData.append("pdf_file", pdfFile);

      await apiCallProtected.post(URL.quotationSendEmail, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      ToastNotification({
        type: "success",
        message: "Email sent successfully",
      });
      onClose();
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      console.error("Error sending document email:", error);
      ToastNotification({
        type: "error",
        message:
          err?.response?.data?.message ||
          err?.message ||
          "Failed to send email",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Text size="lg" fw={600} c="#105476">
          Send Email - {documentLabel}
        </Text>
      }
      size="lg"
      centered
      overlayProps={{
        backgroundOpacity: 0.55,
        blur: 3,
      }}
    >
      <Stack gap="md">
        <TextInput
          label="To Email"
          placeholder="name@example.com, name2@example.com or name@example.com; name2@example.com"
          value={emailForm.to_email}
          onChange={(e) => {
            setEmailForm({ ...emailForm, to_email: e.target.value });
            if (emailErrors.to_email) {
              setEmailErrors({ ...emailErrors, to_email: "" });
            }
          }}
          error={emailErrors.to_email}
          required
        />

        <TextInput
          label="CC Email"
          placeholder="cc@example.com, cc2@example.com"
          value={emailForm.cc_email}
          onChange={(e) => {
            setEmailForm({ ...emailForm, cc_email: e.target.value });
            if (emailErrors.cc_email) {
              setEmailErrors({ ...emailErrors, cc_email: "" });
            }
          }}
          error={emailErrors.cc_email}
        />

        <TextInput
          label="Subject"
          placeholder="Enter email subject"
          value={emailForm.subject}
          onChange={(e) =>
            setEmailForm({ ...emailForm, subject: e.target.value })
          }
        />

        <Textarea
          label="Message"
          placeholder="Enter email message"
          value={emailForm.message}
          onChange={(e) =>
            setEmailForm({ ...emailForm, message: e.target.value })
          }
          minRows={4}
        />

        {pdfBlobUrl && (
          <Box>
            <Text size="sm" fw={500} mb="xs">
              Attachment PDF:
            </Text>
            <iframe
              src={pdfBlobUrl}
              style={{
                width: "100%",
                height: "130px",
                border: "1px solid #e9ecef",
                borderRadius: "8px",
              }}
              title="PDF Preview"
            />
          </Box>
        )}

        <Group justify="flex-end" mt="md">
          <Button variant="outline" onClick={handleClose} disabled={sending}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSend()}
            loading={sending}
            leftSection={<IconSend size={16} />}
            color="#105476"
          >
            Send
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
