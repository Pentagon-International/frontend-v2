import { useEffect, useState } from "react";
import { Button, Group, Modal, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { IconSend } from "@tabler/icons-react";
import toast from "react-hot-toast";
import { apiCallProtected } from "../../../../api/axios";
import { URL } from "../../../../api/serverUrls";
import { extractNumericValue } from "../../../../service/dashboard.service";
import type { RepBarRow } from "./ConversionByRepCard";

function parseEmails(emailString: string): string[] {
  if (!emailString?.trim()) return [];
  const cleaned = emailString
    .replace(/[\r\n\t]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned
    .split(/[,;]+/)
    .map((e) => e.trim())
    .filter(Boolean);
}

function isValidEmail(email: string): boolean {
  if (!email?.trim()) return false;
  const trimmed = email.trim();
  const emailRegex =
    /^[a-zA-Z0-9][a-zA-Z0-9._+-]*@[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}$/;
  if (trimmed.includes("..")) return false;
  if (trimmed.startsWith(".") || trimmed.endsWith(".")) return false;
  if (trimmed.includes("@.") || trimmed.includes(".@")) return false;
  return emailRegex.test(trimmed);
}

function cleanEmailString(emailStr: string | null | undefined): string {
  if (!emailStr) return "";
  return String(emailStr)
    .replace(/[\r\n\t]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[^\x20-\x7E]/g, "")
    .trim();
}

function normalizeCcField(cc: string | string[] | null | undefined): string {
  if (!cc) return "";
  if (Array.isArray(cc)) {
    return cleanEmailString(cc.filter(Boolean).join(", "));
  }
  return cleanEmailString(cc);
}

type Props = {
  opened: boolean;
  onClose: () => void;
  row: RepBarRow | null;
};

export function EnquiryConversionSendEmailModal({ opened, onClose, row }: Props) {
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailForm, setEmailForm] = useState({
    to_email: "",
    cc_email: "",
    subject: "",
    message: "",
  });
  const [emailErrors, setEmailErrors] = useState({
    to_email: "",
    cc_email: "",
  });

  useEffect(() => {
    if (!opened || !row) return;
    const cleanedTo = cleanEmailString(row.salespersonEmail ?? "");
    const cleanedCc = normalizeCcField(row.ccMail);
    const name = row.name?.trim() || "Rep";
    setEmailForm({
      to_email: cleanedTo,
      cc_email: cleanedCc,
      subject: `Enquiry Conversion - ${name}`,
      message: "",
    });
    setEmailErrors({ to_email: "", cc_email: "" });
  }, [opened, row]);

  const handleClose = () => {
    setEmailErrors({ to_email: "", cc_email: "" });
    onClose();
  };

  const handleSendEmail = async () => {
    if (!row) {
      toast.error("No rep data available to send email");
      return;
    }
    if (!emailForm.subject.trim()) {
      toast.error("Please enter an email subject");
      return;
    }

    const toEmailString = emailForm.to_email.trim();
    if (!toEmailString) {
      setEmailErrors((e) => ({
        ...e,
        to_email: "Please enter recipient email address(es)",
      }));
      toast.error("Please enter recipient email address(es)");
      return;
    }

    const toEmailArray = parseEmails(toEmailString);
    if (toEmailArray.length === 0) {
      setEmailErrors((e) => ({
        ...e,
        to_email: "Please enter valid email address(es)",
      }));
      toast.error(
        "Please enter valid email address(es) separated by comma or semicolon"
      );
      return;
    }

    const invalidTo = toEmailArray.filter((em) => !isValidEmail(em));
    if (invalidTo.length > 0) {
      setEmailErrors((e) => ({
        ...e,
        to_email: `Invalid email address(es): ${invalidTo.join(", ")}`,
      }));
      toast.error(`Invalid email address(es): ${invalidTo.join(", ")}`);
      return;
    }

    const ccEmailString = emailForm.cc_email.trim();
    let ccEmailArray: string[] = [];
    if (ccEmailString) {
      ccEmailArray = parseEmails(ccEmailString);
      if (ccEmailArray.length > 0) {
        const invalidCc = ccEmailArray.filter((em) => !isValidEmail(em));
        if (invalidCc.length > 0) {
          setEmailErrors((e) => ({
            ...e,
            cc_email: `Invalid email address(es): ${invalidCc.join(", ")}`,
          }));
          toast.error(
            `Invalid CC email address(es): ${invalidCc.join(", ")}`
          );
          return;
        }
      }
    }

    setEmailErrors({ to_email: "", cc_email: "" });

    const salespersonName = row.name?.trim() || "";
    const data_table = {
      salesperson: salespersonName,
      active: extractNumericValue(row.active),
      gained: extractNumericValue(row.gained),
      lost: extractNumericValue(row.lost),
      quote_created: extractNumericValue(row.quoteCreated),
    };

    const emailPayload = {
      to_email: toEmailArray.join(", "),
      cc_email: ccEmailArray.length > 0 ? ccEmailArray.join(", ") : "",
      subject: emailForm.subject.trim(),
      message: emailForm.message.trim() || "",
      data_table,
    };

    setSendingEmail(true);
    try {
      const response = await apiCallProtected.post(
        URL.quotationSendEmail,
        emailPayload
      );
      const successMessage =
        (response as { data?: { message?: string } })?.data?.message ||
        "Email sent successfully";
      toast.success(successMessage);
      handleClose();
    } catch (err: unknown) {
      const ax = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      toast.error(
        ax?.response?.data?.message || ax?.message || "Failed to send email"
      );
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <Modal
      opened={opened && !!row}
      onClose={handleClose}
      title={
        <Text size="lg" fw={600} c="#1E293B">
          Send Email - Enquiry Conversion
        </Text>
      }
      size="lg"
      centered
      zIndex={500}
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

        <Group justify="flex-end" mt="md">
          <Button variant="outline" onClick={handleClose} disabled={sendingEmail}>
            Cancel
          </Button>
          <Button
            onClick={handleSendEmail}
            loading={sendingEmail}
            leftSection={<IconSend size={16} />}
            color="blue"
          >
            Send
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
