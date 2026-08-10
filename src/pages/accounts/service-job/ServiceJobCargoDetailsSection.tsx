import { useCallback, useMemo } from "react";
import { ActionIcon, Box, Button, Grid, Group, Text } from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import {
  Dropdown,
  FormTextArea,
  SingleDateInput,
} from "../../../components";
import FormTextInput from "../../../components/FormTextInput";
import FormNumberInput from "../../../components/FormNumberInput";
import RequiredLabel from "../../../components/RequiredLabel";
import { getAPICall } from "../../../service/getApiCall";
import { URL } from "../../../api/serverUrls";
import { API_HEADER } from "../../../store/storeKeys";
import { usePackageTypeOptions } from "../../../hooks/usePackageTypeOptions";
import {
  HOUSE_CARGO_WEIGHT_NUMBER_INPUT_PROPS,
  coerceHouseCargoWeightInput,
  formatHouseCargoChargeableDisplay,
  withRecalculatedChargeableWeight,
  type HouseCargoWeightValue,
} from "../../../utils/houseCargoChargeableWeight";
import type { ServiceJobCargoMode } from "./serviceJobCargoShared";
import {
  EMPTY_SERVICE_JOB_CARGO,
  EMPTY_SERVICE_JOB_CONTAINER,
  isSeaServiceJobCargoMode,
  type ServiceJobCargoDetail,
  type ServiceJobContainerDetail,
} from "./serviceJobCargoShared";

type ServiceJobCargoDetailsSectionProps = {
  cargoMode: ServiceJobCargoMode;
  readOnly?: boolean;
  containers: ServiceJobContainerDetail[];
  onContainersChange: (next: ServiceJobContainerDetail[]) => void;
  cargoDetails: ServiceJobCargoDetail[];
  onCargoDetailsChange: (next: ServiceJobCargoDetail[]) => void;
  commodityDescription: string;
  onCommodityDescriptionChange: (value: string) => void;
  marksNo: string;
  onMarksNoChange: (value: string) => void;
};

export function ServiceJobCargoDetailsSection({
  cargoMode,
  readOnly = false,
  containers,
  onContainersChange,
  cargoDetails,
  onCargoDetailsChange,
  commodityDescription,
  onCommodityDescriptionChange,
  marksNo,
  onMarksNoChange,
}: ServiceJobCargoDetailsSectionProps) {
  const showContainers = isSeaServiceJobCargoMode(cargoMode);
  const weightUnit = cargoMode === "AIR" ? "air" : "ocean";
  const packageTypeOptions = usePackageTypeOptions();

  const { data: rawContainerData = [] } = useQuery({
    queryKey: ["containerType"],
    queryFn: async () => {
      try {
        return await getAPICall(`${URL.containerType}`, API_HEADER);
      } catch {
        return [];
      }
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    enabled: showContainers,
  });

  const containerTypeData = useMemo(() => {
    if (!Array.isArray(rawContainerData) || !rawContainerData.length) return [];
    return rawContainerData.map((item: Record<string, unknown>) => ({
      value: item.container_code ? String(item.container_code) : "",
      label: item.container_name ? String(item.container_name) : "",
    }));
  }, [rawContainerData]);

  const containerNumberOptions = useMemo(
    () =>
      containers
        .map((c) => String(c.container_no ?? "").trim())
        .filter(Boolean)
        .map((no) => ({ value: no, label: no })),
    [containers],
  );

  const updateContainer = useCallback(
    (index: number, patch: Partial<ServiceJobContainerDetail>) => {
      const next = [...containers];
      next[index] = { ...next[index], ...patch };
      onContainersChange(next);
    },
    [containers, onContainersChange],
  );

  const updateCargo = useCallback(
    (index: number, patch: Partial<ServiceJobCargoDetail>) => {
      const next = [...cargoDetails];
      next[index] = { ...next[index], ...patch };
      onCargoDetailsChange(next);
    },
    [cargoDetails, onCargoDetailsChange],
  );

  const updateCargoWeight = useCallback(
    (
      index: number,
      field: "gross_weight" | "volume",
      value: string | number | null | undefined,
      previous: HouseCargoWeightValue,
    ) => {
      const next = [...cargoDetails];
      next[index] = withRecalculatedChargeableWeight(
        {
          ...next[index],
          [field]: coerceHouseCargoWeightInput(value, previous),
        },
        weightUnit,
      );
      onCargoDetailsChange(next);
    },
    [cargoDetails, onCargoDetailsChange, weightUnit],
  );

  return (
    <fieldset
      disabled={readOnly}
      style={{ border: "none", margin: 0, padding: 0, minInlineSize: 0 }}
    >
    <Box mt="md">
      {showContainers && (
        <Box mb="xl">
          <Group justify="space-between" align="flex-start" mb="md">
            <Text size="lg" fw={600} c="#105476">
              Container Details
              {containers.length > 1 ? ` (${containers.length})` : ""}
            </Text>
            {!readOnly && (
              <Button
                variant="light"
                color="#105476"
                leftSection={<IconPlus size={16} />}
                onClick={() =>
                  onContainersChange([...containers, { ...EMPTY_SERVICE_JOB_CONTAINER }])
                }
              >
                Add Container
              </Button>
            )}
          </Group>

          {containers.length > 0 && (
            <Grid
              mb="xs"
              style={{ fontWeight: 600, color: "#105476" }}
              gutter="sm"
            >
              <Grid.Col span={2.2}>
                <RequiredLabel label="Container Type" required={false} />
              </Grid.Col>
              <Grid.Col span={1.8}>
                <RequiredLabel label="Container No" required={false} />
              </Grid.Col>
              <Grid.Col span={1.8}>
                <RequiredLabel label="Actual Seal No" required={false} />
              </Grid.Col>
              <Grid.Col span={1.8}>
                <RequiredLabel label="Customs Seal No" required={false} />
              </Grid.Col>
              <Grid.Col span={1.7}>
                <RequiredLabel label="Loading Date" required={false} />
              </Grid.Col>
              <Grid.Col span={1.7}>
                <RequiredLabel label="Unloading Date" required={false} />
              </Grid.Col>
              <Grid.Col span={0.9}>
                {!readOnly && containers.length > 1 && (
                  <RequiredLabel label="Actions" required={false} />
                )}
              </Grid.Col>
            </Grid>
          )}

          {containers.map((container, index) => (
            <Grid key={`container-${index}`} gutter="sm" mb="xs">
              <Grid.Col span={2.2}>
                <Dropdown
                  placeholder="Container Type"
                  searchable
                  disabled={readOnly}
                  data={containerTypeData}
                  nothingFoundMessage="No container types found"
                  value={container.container_type || null}
                  onChange={(value) =>
                    updateContainer(index, { container_type: value || "" })
                  }
                />
              </Grid.Col>
              <Grid.Col span={1.8}>
                <FormTextInput
                  placeholder="Container number"
                  maxLength={11}
                  readOnly={readOnly}
                  value={container.container_no || ""}
                  onChange={(e) => {
                    const next = e.currentTarget.value.toUpperCase().slice(0, 11);
                    updateContainer(index, { container_no: next });
                  }}
                />
              </Grid.Col>
              <Grid.Col span={1.8}>
                <FormTextInput
                  placeholder="Actual seal number"
                  readOnly={readOnly}
                  value={container.actual_seal_no || ""}
                  onChange={(e) =>
                    updateContainer(index, {
                      actual_seal_no: e.currentTarget.value,
                    })
                  }
                />
              </Grid.Col>
              <Grid.Col span={1.8}>
                <FormTextInput
                  placeholder="Customs seal number"
                  readOnly={readOnly}
                  value={container.customs_seal_no || ""}
                  onChange={(e) =>
                    updateContainer(index, {
                      customs_seal_no: e.currentTarget.value,
                    })
                  }
                />
              </Grid.Col>
              <Grid.Col span={1.7}>
                <SingleDateInput
                  placeholder="YYYY-MM-DD"
                  value={container.loading_date}
                  onChange={(value: Date | null) =>
                    updateContainer(index, { loading_date: value })
                  }
                  size="sm"
                  disabled={readOnly}
                />
              </Grid.Col>
              <Grid.Col span={1.7}>
                <SingleDateInput
                  placeholder="YYYY-MM-DD"
                  value={container.unloading_date}
                  onChange={(value: Date | null) =>
                    updateContainer(index, { unloading_date: value })
                  }
                  size="sm"
                  disabled={readOnly}
                />
              </Grid.Col>
              <Grid.Col span={0.9}>
                {!readOnly && containers.length > 1 && (
                  <ActionIcon
                    variant="light"
                    color="red"
                    onClick={() =>
                      onContainersChange(
                        containers.filter((_, i) => i !== index),
                      )
                    }
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                )}
              </Grid.Col>
            </Grid>
          ))}
        </Box>
      )}

      <Box>
        <Group justify="space-between" align="flex-start" mb="md">
          <Text size="lg" fw={600} c="#105476">
            Cargo Details
            {cargoDetails.length > 1 ? ` (${cargoDetails.length})` : ""}
          </Text>
        </Group>

        <Grid mb="md">
          <Grid.Col span={6}>
            <FormTextArea
              label="Commodity Description"
              placeholder="Enter Commodity Description"
              minRows={3}
              size="sm"
              radius="sm"
              readOnly={readOnly}
              value={commodityDescription}
              onChange={(e) =>
                onCommodityDescriptionChange(e.currentTarget.value)
              }
            />
          </Grid.Col>
          <Grid.Col span={6}>
            <FormTextArea
              label="Marks No"
              placeholder="Enter Marks No"
              minRows={3}
              size="sm"
              radius="sm"
              readOnly={readOnly}
              value={marksNo}
              onChange={(e) => onMarksNoChange(e.currentTarget.value)}
            />
          </Grid.Col>
        </Grid>

        <Grid
          mb="xs"
          style={{ fontWeight: 600, color: "#105476" }}
          gutter="sm"
        >
          {showContainers && (
            <Grid.Col span={1.5}>
              <RequiredLabel label="Container Number" required={false} />
            </Grid.Col>
          )}
          <Grid.Col span={showContainers ? 1.6 : 2}>
            <RequiredLabel label="Package Type" required={false} />
          </Grid.Col>
          <Grid.Col span={showContainers ? 1.2 : 1.8}>
            <RequiredLabel label="No of Packages" required={false} />
          </Grid.Col>
          <Grid.Col span={showContainers ? 1.6 : 1.8}>
            <RequiredLabel label="Gross Weight (KG)" required={false} />
          </Grid.Col>
          <Grid.Col span={showContainers ? 1.6 : 1.8}>
            <RequiredLabel
              label={cargoMode === "AIR" ? "Volume Weight" : "Volume (CBM)"}
              required={false}
            />
          </Grid.Col>
          <Grid.Col span={showContainers ? 1.6 : 1.8}>
            <RequiredLabel
              label={
                cargoMode === "AIR"
                  ? "Chargeable Weight"
                  : "Chargeable Weight (CBM)"
              }
              required={false}
            />
          </Grid.Col>
          <Grid.Col span={showContainers ? 1.2 : 1.8}>
            <RequiredLabel label="Haz" required={false} />
          </Grid.Col>
          <Grid.Col span={showContainers ? 0.7 : 1}>
            {!readOnly && (
              <RequiredLabel label="Actions" required={false} />
            )}
          </Grid.Col>
        </Grid>

        {cargoDetails.map((cargo, index) => (
          <Grid key={`cargo-${index}`} gutter="sm" mb="xs">
            {showContainers && (
              <Grid.Col span={1.5}>
                <Dropdown
                  placeholder={
                    containerNumberOptions.length > 0
                      ? "Select Container Number"
                      : "No containers available"
                  }
                  searchable
                  data={containerNumberOptions}
                  value={cargo.container_number || null}
                  disabled={readOnly || containerNumberOptions.length === 0}
                  clearable
                  onChange={(value) => {
                    const matched = containers.find(
                      (c) => c.container_no === value,
                    );
                    updateCargo(index, {
                      container_number: value || "",
                      container_id:
                        matched?.id != null ? Number(matched.id) : undefined,
                    });
                  }}
                />
              </Grid.Col>
            )}
            <Grid.Col span={showContainers ? 1.6 : 2}>
              <Dropdown
                placeholder="Package Type"
                searchable
                disabled={readOnly}
                data={packageTypeOptions}
                value={cargo.package_type || null}
                clearable
                onChange={(value) =>
                  updateCargo(index, { package_type: value || "" })
                }
              />
            </Grid.Col>
            <Grid.Col span={showContainers ? 1.2 : 1.8}>
              <FormNumberInput
                placeholder="Enter No of Packages"
                min={0}
                hideControls
                readOnly={readOnly}
                value={cargo.no_of_packages ?? undefined}
                onChange={(value) =>
                  updateCargo(index, {
                    no_of_packages:
                      value === "" || value == null ? null : Number(value),
                  })
                }
              />
            </Grid.Col>
            <Grid.Col span={showContainers ? 1.6 : 1.8}>
              <FormNumberInput
                placeholder="Enter Gross Weight"
                min={0}
                hideControls
                readOnly={readOnly}
                {...HOUSE_CARGO_WEIGHT_NUMBER_INPUT_PROPS}
                value={cargo.gross_weight ?? undefined}
                onChange={(value) =>
                  updateCargoWeight(
                    index,
                    "gross_weight",
                    value,
                    cargo.gross_weight,
                  )
                }
                onBlur={(e) => {
                  const raw = e.currentTarget.value.replace(/,/g, "").trim();
                  if (!raw) return;
                  updateCargoWeight(
                    index,
                    "gross_weight",
                    raw,
                    cargo.gross_weight,
                  );
                }}
              />
            </Grid.Col>
            <Grid.Col span={showContainers ? 1.6 : 1.8}>
              <FormNumberInput
                placeholder={
                  cargoMode === "AIR"
                    ? "Enter Volume Weight"
                    : "Enter Volume"
                }
                min={0}
                hideControls
                readOnly={readOnly}
                {...HOUSE_CARGO_WEIGHT_NUMBER_INPUT_PROPS}
                value={cargo.volume ?? undefined}
                onChange={(value) =>
                  updateCargoWeight(index, "volume", value, cargo.volume)
                }
                onBlur={(e) => {
                  const raw = e.currentTarget.value.replace(/,/g, "").trim();
                  if (!raw) return;
                  updateCargoWeight(index, "volume", raw, cargo.volume);
                }}
              />
            </Grid.Col>
            <Grid.Col span={showContainers ? 1.6 : 1.8}>
              <FormTextInput
                placeholder=""
                format="normal"
                value={formatHouseCargoChargeableDisplay(
                  cargo.gross_weight,
                  cargo.volume,
                  weightUnit,
                )}
                readOnly
                disabled
              />
            </Grid.Col>
            <Grid.Col span={showContainers ? 1.2 : 1.8}>
              <Dropdown
                placeholder="Select Haz"
                searchable
                disabled={readOnly}
                data={[
                  { value: "Yes", label: "Yes" },
                  { value: "No", label: "No" },
                ]}
                value={
                  cargo.haz === true
                    ? "Yes"
                    : cargo.haz === false
                      ? "No"
                      : null
                }
                onChange={(value) =>
                  updateCargo(index, {
                    haz:
                      value === "Yes"
                        ? true
                        : value === "No"
                          ? false
                          : null,
                  })
                }
              />
            </Grid.Col>
            <Grid.Col span={showContainers ? 0.7 : 1}>
              {!readOnly && (
                <Group gap="xs">
                  {cargoDetails.length > 1 && (
                    <ActionIcon
                      variant="light"
                      color="red"
                      onClick={() =>
                        onCargoDetailsChange(
                          cargoDetails.filter((_, i) => i !== index),
                        )
                      }
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  )}
                  {index === cargoDetails.length - 1 && (
                    <ActionIcon
                      variant="light"
                      color="#105476"
                      onClick={() =>
                        onCargoDetailsChange([
                          ...cargoDetails,
                          { ...EMPTY_SERVICE_JOB_CARGO },
                        ])
                      }
                    >
                      <IconPlus size={16} />
                    </ActionIcon>
                  )}
                </Group>
              )}
            </Grid.Col>
          </Grid>
        ))}
      </Box>
    </Box>
    </fieldset>
  );
}
