import { useState } from "react";
import {
  Anchor,
  Button,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";
import { Link, useNavigate } from "react-router-dom";
import { ToastNotification } from "../../../components";
import { odexApi } from "../../../services/odexApi";
import { ODEX_JOB_TYPES } from "../odexConstants";
import { ODEX_JOBS_PATH, odexJobDetailPath } from "../odexUrls";

type Props = {
  opened: boolean;
  onClose: () => void;
  consolJobId: number | null | undefined;
  disabled?: boolean;
};

export default function OdexTriggerModal({
  opened,
  onClose,
  consolJobId,
  disabled,
}: Props) {
  const navigate = useNavigate();
  const [odexType, setOdexType] = useState<string>(ODEX_JOB_TYPES[0].value);
  const [overridesText, setOverridesText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleStart = async () => {
    if (!consolJobId) {
      ToastNotification({
        type: "error",
        message: "Save the consol job before starting ODEX automation.",
      });
      return;
    }

    let overrides: Record<string, unknown> | undefined;
    if (overridesText.trim()) {
      try {
        overrides = JSON.parse(overridesText) as Record<string, unknown>;
      } catch {
        ToastNotification({
          type: "error",
          message: "Overrides must be valid JSON",
        });
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await odexApi.createJob({
        job_id: Number(consolJobId),
        odex_type: odexType,
        ...(overrides ? { overrides } : {}),
      });
      const newJobId = res.job_id ?? res.id;
      if (newJobId == null) {
        throw new Error("ODEX job id not returned from server");
      }
      ToastNotification({
        type: "success",
        message: "ODEX automation started",
      });
      onClose();
      navigate(odexJobDetailPath(newJobId));
    } catch (err) {
      const message =
        (err as Error)?.message ??
        (err as { response?: { data?: { message?: string; detail?: string } } })
          ?.response?.data?.message ??
        (err as { response?: { data?: { message?: string; detail?: string } } })
          ?.response?.data?.detail ??
        "Failed to start ODEX automation";
      ToastNotification({ type: "error", message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Start ODEX Automation" centered size="md">
      <Stack gap="md">
        <Select
          label="ODEX Type"
          data={ODEX_JOB_TYPES.map((t) => ({
            value: t.value,
            label: t.label,
          }))}
          value={odexType}
          onChange={(v) => v && setOdexType(v)}
          disabled={disabled}
        />
        <Textarea
          label="Overrides (optional JSON)"
          placeholder='{"key": "value"}'
          minRows={4}
          value={overridesText}
          onChange={(e) => setOverridesText(e.currentTarget.value)}
          styles={{ input: { fontFamily: "monospace", fontSize: 12 } }}
          disabled={disabled}
        />
        {!consolJobId && (
          <Text size="sm" c="orange">
            Save the job first to obtain a consol job id.
          </Text>
        )}
        <Group justify="space-between">
          <Anchor component={Link} to={ODEX_JOBS_PATH} size="sm" c="#105476">
            View all ODEX jobs
          </Anchor>
          <Group>
            <Button variant="outline" color="#105476" onClick={onClose}>
              Cancel
            </Button>
            <Button
              color="#105476"
              loading={submitting}
              disabled={disabled || !consolJobId}
              onClick={handleStart}
            >
              Start ODEX
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
