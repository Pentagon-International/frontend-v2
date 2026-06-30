import { useEffect, useMemo, useState } from "react";
import {
  Anchor,
  Box,
  Button,
  Group,
  Modal,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Text,
  TextInput,
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
import {
  buildOdexOverridesPayload,
  ODEX_ISO_CODE_OPTIONS,
  ODEX_SOC_FLAG_OPTIONS,
  odexOverrideContainerKey,
  validateOdexOverrideForm,
  type OdexContainerOverrideFormValue,
  type OdexOverrideHousingInput,
  type OdexOverrideMblContainer,
} from "../../../utils/odexOverrides";
import { ODEX_JOB_TYPES } from "../odexConstants";
import { ODEX_JOBS_PATH } from "../odexUrls";

type Props = {
  opened: boolean;
  onClose: () => void;
  consolJobId: number | null | undefined;
  disabled?: boolean;
  onJobStarted?: (odexJobId: number | string) => void;
  housingDetails?: OdexOverrideHousingInput[];
  mblContainers?: OdexOverrideMblContainer[];
};

export default function OdexTriggerModal({
  opened,
  onClose,
  consolJobId,
  disabled,
  onJobStarted,
  housingDetails = [],
  mblContainers = [],
}: Props) {
  const [odexType, setOdexType] = useState<string>(ODEX_JOB_TYPES[0].value);
  const [mobileNo, setMobileNo] = useState("");
  const [containerOverrides, setContainerOverrides] = useState<
    Record<string, OdexContainerOverrideFormValue>
  >({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!opened) return;
    setMobileNo("");
    setContainerOverrides({});
    setOdexType(ODEX_JOB_TYPES[0].value);
  }, [opened]);

  const containerRows = useMemo(
    () =>
      mblContainers
        .map((container) => {
          const containerNo = String(container.container_no ?? "").trim();
          if (!containerNo) return null;
          return {
            key: odexOverrideContainerKey(containerNo),
            containerNo,
            containerType: container.container_type?.trim() || "—",
          };
        })
        .filter((row): row is NonNullable<typeof row> => row != null),
    [mblContainers],
  );

  const setContainerField = (
    key: string,
    field: keyof OdexContainerOverrideFormValue,
    value: string,
  ) => {
    setContainerOverrides((prev) => ({
      ...prev,
      [key]: {
        soc_flag: prev[key]?.soc_flag ?? "",
        iso_code: prev[key]?.iso_code ?? "",
        [field]: value,
      },
    }));
  };

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

    if (housingDetails.length === 0) {
      ToastNotification({
        type: "error",
        message: "Add at least one house bill before pushing to Odex.",
      });
      return;
    }

    const validationError = validateOdexOverrideForm(
      mobileNo,
      containerRows.map((row) => row.key),
      containerOverrides,
    );
    if (validationError) {
      ToastNotification({
        type: "error",
        message: validationError,
      });
      return;
    }

    const overrides = buildOdexOverridesPayload(
      mobileNo,
      housingDetails,
      containerOverrides,
    );

    setSubmitting(true);
    try {
      const res = await odexApi.createJob({
        job_id: Number(consolJobId),
        odex_type: odexType,
        overrides,
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
      size="lg"
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

        <TextInput
          placeholder="Requester Mobile No"
          value={mobileNo}
          onChange={(event) => setMobileNo(event.currentTarget.value)}
          disabled={disabled}
          autoComplete="off"
        />

        <Box>
          <Text size="sm" fw={600} c="#105476" mb="xs">
            Container overrides
          </Text>
          <ScrollArea.Autosize mah={320} offsetScrollbars>
            <Stack gap="sm">
              {containerRows.length === 0 ? (
                <Text size="sm" c="dimmed">
                  Add MBL container numbers before pushing to Odex.
                </Text>
              ) : (
                containerRows.map((row) => {
                  const values = containerOverrides[row.key] ?? {
                    soc_flag: "",
                    iso_code: "",
                  };

                  return (
                    <Paper
                      key={row.key}
                      withBorder
                      p="sm"
                      radius="md"
                      bg="#f8f9fa"
                    >
                      <Text size="xs" c="dimmed" mb="sm">
                        Container: {row.containerNo} · Type: {row.containerType}
                      </Text>
                      <Group grow align="flex-start">
                        <Select
                          placeholder="Soc Flag"
                          data={[...ODEX_SOC_FLAG_OPTIONS]}
                          value={values.soc_flag || null}
                          onChange={(value) =>
                            setContainerField(row.key, "soc_flag", value ?? "")
                          }
                          disabled={disabled}
                        />
                        <Select
                          placeholder="Iso code"
                          data={[...ODEX_ISO_CODE_OPTIONS]}
                          value={values.iso_code || null}
                          onChange={(value) =>
                            setContainerField(row.key, "iso_code", value ?? "")
                          }
                          disabled={disabled}
                          searchable
                        />
                      </Group>
                    </Paper>
                  );
                })
              )}
            </Stack>
          </ScrollArea.Autosize>
        </Box>

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
