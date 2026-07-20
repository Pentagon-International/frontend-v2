import { useEffect, useState } from "react";
import {
  Anchor,
  Button,
  Group,
  Modal,
  Select,
  Stack,
  Text,
} from "@mantine/core";
import { Link } from "react-router-dom";
import { ToastNotification } from "../../../components";
import { odexApi } from "../../../services/odexApi";
import useAuthStore from "../../../store/authStore";
import {
  getActiveBranch,
  isBranchOdexConfigured,
  ODEX_CREDENTIALS_NOT_CONFIGURED_MESSAGE,
} from "../../../utils/branchOdexCredentials";
import type {
  OdexOverrideHousingInput,
  OdexOverrideMblContainer,
} from "../../../utils/odexOverrides";
import { ODEX_JOB_TYPES } from "../odexConstants";
import { ODEX_JOBS_PATH } from "../odexUrls";

const INVOICING_CONSIGNEE_OPTIONS = [
  { value: "MBL", label: "MBL" },
  { value: "HBL", label: "HBL" },
] as const;
const DEFAULT_INVOICING_CONSIGNEE = "HBL";

type Props = {
  opened: boolean;
  onClose: () => void;
  consolJobId: number | null | undefined;
  disabled?: boolean;
  onJobStarted?: (odexJobId: number | string) => void;
  /** Kept for call-site compatibility; no longer used in the modal. */
  housingDetails?: OdexOverrideHousingInput[];
  /** Kept for call-site compatibility; no longer used in the modal. */
  mblContainers?: OdexOverrideMblContainer[];
};

export default function OdexTriggerModal({
  opened,
  onClose,
  consolJobId,
  disabled,
  onJobStarted,
}: Props) {
  const [odexType, setOdexType] = useState<string>(ODEX_JOB_TYPES[0].value);
  const [invoicingConsignee, setInvoicingConsignee] = useState<string>(
    DEFAULT_INVOICING_CONSIGNEE,
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!opened) return;
    setOdexType(ODEX_JOB_TYPES[0].value);
    setInvoicingConsignee(DEFAULT_INVOICING_CONSIGNEE);
  }, [opened]);

  const handleStart = async () => {
    if (!consolJobId) {
      ToastNotification({
        type: "error",
        message: "Save the consol job before starting ODEX automation.",
      });
      return;
    }

    const activeBranch = getActiveBranch(useAuthStore.getState().user?.branches);
    if (!isBranchOdexConfigured(activeBranch)) {
      ToastNotification({
        type: "error",
        message: ODEX_CREDENTIALS_NOT_CONFIGURED_MESSAGE,
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await odexApi.createJob({
        job_id: Number(consolJobId),
        odex_type: odexType,
        invoicing_consignee: invoicingConsignee,
      });
      const newJobId = res.job_id ?? res.id;
      if (newJobId == null) {
        throw new Error("ODEX job id not returned from server");
      }
      ToastNotification({
        type: "success",
        message: "ODEX automation started in the background",
      });
      onJobStarted?.(newJobId);
      onClose();
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
    <Modal
      opened={opened}
      onClose={onClose}
      title="Start ODEX Automation"
      centered
      size="md"
    >
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

        <Select
          label="Invoicing Consignee"
          data={[...INVOICING_CONSIGNEE_OPTIONS]}
          value={invoicingConsignee}
          onChange={(v) => v && setInvoicingConsignee(v)}
          disabled={disabled}
          allowDeselect={false}
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
