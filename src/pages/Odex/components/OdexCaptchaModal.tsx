import { useState } from "react";
import { Button, Group, Modal, Text, TextInput } from "@mantine/core";
import { odexApi } from "../../../services/odexApi";
import { ToastNotification } from "../../../components";

type Props = {
  opened: boolean;
  jobId: string | number;
  onClose: () => void;
  onSubmitted?: () => void;
};

export default function OdexCaptchaModal({
  opened,
  jobId,
  onClose,
  onSubmitted,
}: Props) {
  const [captcha, setCaptcha] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!captcha.trim()) {
      ToastNotification({
        type: "error",
        message: "Please enter the captcha value",
      });
      return;
    }
    setSubmitting(true);
    try {
      await odexApi.submitCaptcha(jobId, captcha.trim());
      ToastNotification({
        type: "success",
        message: "Captcha submitted. Automation will resume.",
      });
      setCaptcha("");
      onSubmitted?.();
      onClose();
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string; detail?: string } } })
          ?.response?.data?.message ??
        (err as { response?: { data?: { message?: string; detail?: string } } })
          ?.response?.data?.detail ??
        "Failed to submit captcha";
      ToastNotification({ type: "error", message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="ODEX Captcha Required"
      centered
    >
      <Text size="sm" mb="md" c="dimmed">
        Enter the captcha value to continue automation.
      </Text>
      <TextInput
        label="Captcha"
        placeholder="Enter captcha"
        value={captcha}
        onChange={(e) => setCaptcha(e.currentTarget.value)}
        mb="md"
      />
      <Group justify="flex-end">
        <Button variant="outline" color="#105476" onClick={onClose}>
          Cancel
        </Button>
        <Button color="#105476" loading={submitting} onClick={handleSubmit}>
          Submit
        </Button>
      </Group>
    </Modal>
  );
}
