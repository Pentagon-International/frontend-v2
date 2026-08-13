import { useCallback, useMemo } from "react";
import { ActionIcon, Box, Grid, Group, Text } from "@mantine/core";
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
  const rowCount = showContainers
    ? Math.max(containers.length, cargoDetails.length, 1)
    : Math.max(cargoDetails.length, 1);

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

  const padContainers = useCallback(
    (list: ServiceJobContainerDetail[], index: number) => {
      const next = [...list];
      while (next.length <= index) next.push({ ...EMPTY_SERVICE_JOB_CONTAINER });
      return next;
    },
    [],
  );

  const padCargo = useCallback(
    (list: ServiceJobCargoDetail[], index: number) => {
      const next = [...list];
      while (next.length <= index) next.push({ ...EMPTY_SERVICE_JOB_CARGO });
      return next;
    },
    [],
  );

  const updateContainer = useCallback(
    (index: number, patch: Partial<ServiceJobContainerDetail>) => {
      const next = padContainers(containers, index);
      next[index] = { ...next[index], ...patch };
      onContainersChange(next);

      if ("container_no" in patch) {
        const nextCargo = padCargo(cargoDetails, index);
        nextCargo[index] = {
          ...nextCargo[index],
          container_number: String(patch.container_no ?? ""),
          container_id:
            next[index].id != null
              ? Number(next[index].id)
              : nextCargo[index].container_id,
        };
        onCargoDetailsChange(nextCargo);
      }
    },
    [
      cargoDetails,
      containers,
      onCargoDetailsChange,
      onContainersChange,
      padCargo,
      padContainers,
    ],
  );

  const updateCargo = useCallback(
    (index: number, patch: Partial<ServiceJobCargoDetail>) => {
      const next = padCargo(cargoDetails, index);
      next[index] = { ...next[index], ...patch };
      onCargoDetailsChange(next);
    },
    [cargoDetails, onCargoDetailsChange, padCargo],
  );

  const updateCargoWeight = useCallback(
    (
      index: number,
      field: "gross_weight" | "volume",
      value: string | number | null | undefined,
      previous: HouseCargoWeightValue,
    ) => {
      const next = padCargo(cargoDetails, index);
      next[index] = withRecalculatedChargeableWeight(
        {
          ...next[index],
          [field]: coerceHouseCargoWeightInput(value, previous),
        },
        weightUnit,
      );
      onCargoDetailsChange(next);
    },
    [cargoDetails, onCargoDetailsChange, padCargo, weightUnit],
  );

  const addRow = useCallback(() => {
    if (showContainers) {
      const nextContainers = [...containers];
      while (nextContainers.length < rowCount) {
        nextContainers.push({ ...EMPTY_SERVICE_JOB_CONTAINER });
      }
      nextContainers.push({ ...EMPTY_SERVICE_JOB_CONTAINER });
      onContainersChange(nextContainers);
    }

    const nextCargo = [...cargoDetails];
    while (nextCargo.length < rowCount) {
      nextCargo.push({ ...EMPTY_SERVICE_JOB_CARGO });
    }
    nextCargo.push({ ...EMPTY_SERVICE_JOB_CARGO });
    onCargoDetailsChange(nextCargo);
  }, [
    cargoDetails,
    containers,
    onCargoDetailsChange,
    onContainersChange,
    rowCount,
    showContainers,
  ]);

  const removeRow = useCallback(
    (index: number) => {
      if (showContainers) {
        onContainersChange(containers.filter((_, i) => i !== index));
      }
      onCargoDetailsChange(cargoDetails.filter((_, i) => i !== index));
    },
    [
      cargoDetails,
      containers,
      onCargoDetailsChange,
      onContainersChange,
      showContainers,
    ],
  );

  const renderRowActions = (index: number) => {
    if (readOnly) return null;
    return (
      <Group gap="xs">
        {rowCount > 1 && (
          <ActionIcon
            variant="light"
            color="red"
            onClick={() => removeRow(index)}
          >
            <IconTrash size={16} />
          </ActionIcon>
        )}
        {index === rowCount - 1 && (
          <ActionIcon variant="light" color="#105476" onClick={addRow}>
            <IconPlus size={16} />
          </ActionIcon>
        )}
      </Group>
    );
  };

  const renderAirCargoFields = (
    cargo: ServiceJobCargoDetail,
    index: number,
  ) => (
    <>
      <Grid.Col span={1.8}>
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
      <Grid.Col span={1.8}>
        <FormNumberInput
          placeholder="Enter Gross Weight"
          min={0}
          hideControls
          readOnly={readOnly}
          {...HOUSE_CARGO_WEIGHT_NUMBER_INPUT_PROPS}
          value={cargo.gross_weight ?? undefined}
          onChange={(value) =>
            updateCargoWeight(index, "gross_weight", value, cargo.gross_weight)
          }
          onBlur={(e) => {
            const raw = e.currentTarget.value.replace(/,/g, "").trim();
            if (!raw) return;
            updateCargoWeight(index, "gross_weight", raw, cargo.gross_weight);
          }}
        />
      </Grid.Col>
      <Grid.Col span={1.8}>
        <FormNumberInput
          placeholder="Enter Volume Weight"
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
      <Grid.Col span={1.8}>
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
      <Grid.Col span={2}>
        <Dropdown
          placeholder="Package Type"
          searchable
          dropdownZIndex={1000}
          disabled={readOnly}
          data={packageTypeOptions}
          value={cargo.package_type || null}
          clearable
          onChange={(value) =>
            updateCargo(index, { package_type: value || "" })
          }
        />
      </Grid.Col>
      <Grid.Col span={1.8}>
        <Dropdown
          placeholder="Select Haz"
          searchable
          dropdownZIndex={1000}
          disabled={readOnly}
          data={[
            { value: "Yes", label: "Yes" },
            { value: "No", label: "No" },
          ]}
          value={
            cargo.haz === true ? "Yes" : cargo.haz === false ? "No" : null
          }
          onChange={(value) =>
            updateCargo(index, {
              haz: value === "Yes" ? true : value === "No" ? false : null,
            })
          }
        />
      </Grid.Col>
      <Grid.Col span={1}>{renderRowActions(index)}</Grid.Col>
    </>
  );

  return (
    <fieldset
      disabled={readOnly}
      style={{ border: "none", margin: 0, padding: 0, minInlineSize: 0 }}
    >
      <Box mt="md">
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

        <Group justify="space-between" align="flex-start" mb="md">
          <Text size="lg" fw={600} c="#105476">
            {showContainers ? "Cargo and Container Details" : "Cargo Details"}
            {rowCount > 1 ? ` (${rowCount})` : ""}
          </Text>
        </Group>

        {showContainers ? (
          Array.from({ length: rowCount }).map((_, index) => {
            const container =
              containers[index] ?? { ...EMPTY_SERVICE_JOB_CONTAINER };
            const cargo = cargoDetails[index] ?? { ...EMPTY_SERVICE_JOB_CARGO };
            const showLabels = index === 0;
            return (
              <Grid key={`cargo-container-${index}`} gutter="sm" mb="sm" align="flex-end">
                <Grid.Col span={2}>
                  <Dropdown
                    label={showLabels ? "Container Type" : undefined}
                    placeholder="Container Type"
                    searchable
                    dropdownZIndex={1000}
                    disabled={readOnly}
                    data={containerTypeData}
                    nothingFoundMessage="No container types found"
                    value={container.container_type || null}
                    onChange={(value) =>
                      updateContainer(index, { container_type: value || "" })
                    }
                  />
                </Grid.Col>
                <Grid.Col span={2}>
                  <FormTextInput
                    label={showLabels ? "Container No" : undefined}
                    format="capital"
                    placeholder="Container number"
                    maxLength={11}
                    readOnly={readOnly}
                    value={container.container_no || ""}
                    onChange={(e) => {
                      const next = e.currentTarget.value
                        .toUpperCase()
                        .slice(0, 11);
                      updateContainer(index, { container_no: next });
                    }}
                  />
                </Grid.Col>
                <Grid.Col span={2}>
                  <FormNumberInput
                    label={showLabels ? "No of Packages" : undefined}
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
                <Grid.Col span={2}>
                  <FormNumberInput
                    label={showLabels ? "Gross Weight (KG)" : undefined}
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
                <Grid.Col span={2}>
                  <FormNumberInput
                    label={showLabels ? "Volume (CBM)" : undefined}
                    placeholder="Enter Volume"
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
                <Grid.Col span={2}>
                  <FormTextInput
                    label={showLabels ? "Chargeable Weight (CBM)" : undefined}
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
                <Grid.Col span={2}>
                  <Dropdown
                    label={showLabels ? "Package Type" : undefined}
                    placeholder="Package Type"
                    searchable
                    dropdownZIndex={1000}
                    disabled={readOnly}
                    data={packageTypeOptions}
                    value={cargo.package_type || null}
                    clearable
                    onChange={(value) =>
                      updateCargo(index, { package_type: value || "" })
                    }
                  />
                </Grid.Col>
                <Grid.Col span={2}>
                  <FormTextInput
                    label={showLabels ? "Actual Seal No" : undefined}
                    format="capital"
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
                <Grid.Col span={2}>
                  <FormTextInput
                    label={showLabels ? "Customs Seal No" : undefined}
                    format="capital"
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
                <Grid.Col span={2}>
                  <SingleDateInput
                    label={showLabels ? "Loading Date" : undefined}
                    placeholder="YYYY-MM-DD"
                    value={container.loading_date}
                    onChange={(value: Date | null) =>
                      updateContainer(index, { loading_date: value })
                    }
                    size="sm"
                    disabled={readOnly}
                  />
                </Grid.Col>
                <Grid.Col span={2}>
                  <SingleDateInput
                    label={showLabels ? "Unloading Date" : undefined}
                    placeholder="YYYY-MM-DD"
                    value={container.unloading_date}
                    onChange={(value: Date | null) =>
                      updateContainer(index, { unloading_date: value })
                    }
                    size="sm"
                    disabled={readOnly}
                  />
                </Grid.Col>
                <Grid.Col span={2}>
                  <Group gap="xs" align="flex-end" wrap="nowrap">
                    <Box style={{ flex: 1, minWidth: 0 }}>
                      <Dropdown
                        label={showLabels ? "Haz" : undefined}
                        placeholder="Select Haz"
                        searchable
                        dropdownZIndex={1000}
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
                    </Box>
                    {renderRowActions(index)}
                  </Group>
                </Grid.Col>
              </Grid>
            );
          })
        ) : (
          <>
            <Grid
              mb="xs"
              style={{ fontWeight: 600, color: "#105476" }}
              gutter="sm"
            >
              <Grid.Col span={1.8}>
                <RequiredLabel label="No of Packages" required={false} />
              </Grid.Col>
              <Grid.Col span={1.8}>
                <RequiredLabel label="Gross Weight (KG)" required={false} />
              </Grid.Col>
              <Grid.Col span={1.8}>
                <RequiredLabel label="Volume Weight" required={false} />
              </Grid.Col>
              <Grid.Col span={1.8}>
                <RequiredLabel label="Chargeable Weight" required={false} />
              </Grid.Col>
              <Grid.Col span={2}>
                <RequiredLabel label="Package Type" required={false} />
              </Grid.Col>
              <Grid.Col span={1.8}>
                <RequiredLabel label="Haz" required={false} />
              </Grid.Col>
              <Grid.Col span={1}>
                {!readOnly && (
                  <RequiredLabel label="Actions" required={false} />
                )}
              </Grid.Col>
            </Grid>

            {Array.from({ length: rowCount }).map((_, index) => {
              const cargo = cargoDetails[index] ?? { ...EMPTY_SERVICE_JOB_CARGO };
              return (
                <Grid key={`cargo-${index}`} gutter="sm" mb="xs">
                  {renderAirCargoFields(cargo, index)}
                </Grid>
              );
            })}
          </>
        )}
      </Box>
    </fieldset>
  );
}
