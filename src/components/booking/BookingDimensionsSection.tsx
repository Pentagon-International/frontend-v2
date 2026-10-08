/**
 * BookingDimensionsSection – reusable dimension rows editor for AIR/LCL bookings.
 */
import React, { useCallback } from "react";
import { Grid, Group, Button, Text, Box } from "@mantine/core";
import { IconTrash, IconPlus } from "@tabler/icons-react";
import Dropdown from "../Dropdown";
import FormNumberInput from "../FormNumberInput";
import {
  DimensionRow,
  getDimensionValue,
  calcRowVolWeight,
  computeDimensionTotals,
  DIMENSION_UNIT_OPTIONS_BY_SERVICE,
} from "../../utils/dimensionCargoSync";

export interface BookingDimensionsSectionProps {
  service: "AIR" | "LCL" | "INLAND" | string;
  dimensionUnit: string;
  rows: DimensionRow[];
  onUnitChange: (unit: string) => void;
  onRowsChange: (rows: DimensionRow[]) => void;
  onTotalsChange: (totals: {
    totalPieces: number;
    totalVolWeight: number;
  }) => void;
  readOnly?: boolean;
  /** When set, title sits left and the unit dropdown (no label) sits right. */
  headerTitle?: string;
}

function newRow(divisor: number): DimensionRow {
  return {
    pieces: null,
    length: null,
    width: null,
    height: null,
    value: divisor,
    vol_weight: null,
  };
}

const labelSx = {
  fontSize: "13px",
  fontWeight: 500,
  color: "#424242",
  marginBottom: 4,
} as const;

const BookingDimensionsSection: React.FC<BookingDimensionsSectionProps> = ({
  service,
  dimensionUnit,
  rows,
  onUnitChange,
  onRowsChange,
  onTotalsChange,
  readOnly = false,
  headerTitle,
}) => {
  const unitOptions =
    DIMENSION_UNIT_OPTIONS_BY_SERVICE[service?.toUpperCase() as string] ??
    DIMENSION_UNIT_OPTIONS_BY_SERVICE["AIR"];

  const divisor = getDimensionValue(service, dimensionUnit);

  const recalcAndNotify = useCallback(
    (updated: DimensionRow[]) => {
      onRowsChange(updated);
      onTotalsChange(computeDimensionTotals(updated));
    },
    [onRowsChange, onTotalsChange],
  );

  const handleUnitChange = (unit: string | null) => {
    const u = unit || "Centimeter";
    onUnitChange(u);
    const newDivisor = getDimensionValue(service, u);
    const updated = rows.map((r) => ({
      ...r,
      value: newDivisor,
      vol_weight:
        (Number(r.pieces) || 0) > 0 || (Number(r.length) || 0) > 0
          ? calcRowVolWeight(
              Number(r.length) || 0,
              Number(r.width) || 0,
              Number(r.height) || 0,
              Number(r.pieces) || 0,
              newDivisor,
            )
          : null,
    }));
    recalcAndNotify(updated);
  };

  const handleAddRow = () => {
    recalcAndNotify([...rows, newRow(divisor)]);
  };

  const handleRemoveRow = (idx: number) => {
    recalcAndNotify(rows.filter((_, i) => i !== idx));
  };

  const handleFieldChange = (
    idx: number,
    field: keyof DimensionRow,
    rawVal: number | string | null | undefined,
  ) => {
    const val =
      rawVal === "" || rawVal === undefined ? null : Number(rawVal) || null;
    const updated = rows.map((r, i) => {
      if (i !== idx) return r;
      const next = { ...r, [field]: val };
      if (
        field === "pieces" ||
        field === "length" ||
        field === "width" ||
        field === "height"
      ) {
        next.vol_weight = calcRowVolWeight(
          Number(field === "length" ? val : r.length) || 0,
          Number(field === "width" ? val : r.width) || 0,
          Number(field === "height" ? val : r.height) || 0,
          Number(field === "pieces" ? val : r.pieces) || 0,
          divisor,
        );
      }
      return next;
    });
    recalcAndNotify(updated);
  };

  const unitDropdown = (
    <Box style={{ width: 200, maxWidth: "40%" }}>
      <Dropdown
        label={headerTitle ? undefined : "Dimension Unit"}
        placeholder="Select unit"
        data={unitOptions}
        value={dimensionUnit || null}
        disabled={readOnly}
        onChange={handleUnitChange}
      />
    </Box>
  );

  return (
    <Box mt={headerTitle ? 0 : "md"}>
      {headerTitle ? (
        <Group justify="space-between" align="center" mb="sm">
          <Text size="md" fw={600} c="#105476">
            {headerTitle}
          </Text>
          {unitDropdown}
        </Group>
      ) : (
        <Group justify="space-between" align="flex-end" mb="xs">
          {unitDropdown}
          {!readOnly && rows.length === 0 && (
            <Button
              size="sm"
              variant="light"
              color="#105476"
              leftSection={<IconPlus size={15} />}
              onClick={handleAddRow}
            >
              Add dimension
            </Button>
          )}
        </Group>
      )}
      {headerTitle && !readOnly && rows.length === 0 && (
        <Group justify="flex-end" mb="xs">
          <Button
            size="sm"
            variant="light"
            color="#105476"
            leftSection={<IconPlus size={15} />}
            onClick={handleAddRow}
          >
            Add dimension
          </Button>
        </Group>
      )}

      {rows.length > 0 && (
        <>
          <Grid gutter="sm" mb={6}>
            <Grid.Col span={2}>
              <Text style={labelSx}>Pieces</Text>
            </Grid.Col>
            <Grid.Col span={2}>
              <Text style={labelSx}>Length</Text>
            </Grid.Col>
            <Grid.Col span={2}>
              <Text style={labelSx}>Width</Text>
            </Grid.Col>
            <Grid.Col span={2}>
              <Text style={labelSx}>Height</Text>
            </Grid.Col>
            <Grid.Col span={2}>
              <Text style={labelSx}>Vol Weight</Text>
            </Grid.Col>
            <Grid.Col span={2}>
              <Text style={labelSx}> </Text>
            </Grid.Col>
          </Grid>

          {rows.map((row, idx) => (
            <Grid key={idx} gutter="sm" mb={6} align="flex-end">
              <Grid.Col span={2}>
                <FormNumberInput
                  placeholder="Pcs"
                  min={0}
                  decimalScale={0}
                  value={row.pieces ?? ""}
                  disabled={readOnly}
                  onChange={(v) =>
                    handleFieldChange(idx, "pieces", v as number)
                  }
                />
              </Grid.Col>
              <Grid.Col span={2}>
                <FormNumberInput
                  placeholder="L"
                  min={0}
                  decimalScale={2}
                  value={row.length ?? ""}
                  disabled={readOnly}
                  onChange={(v) =>
                    handleFieldChange(idx, "length", v as number)
                  }
                />
              </Grid.Col>
              <Grid.Col span={2}>
                <FormNumberInput
                  placeholder="W"
                  min={0}
                  decimalScale={2}
                  value={row.width ?? ""}
                  disabled={readOnly}
                  onChange={(v) =>
                    handleFieldChange(idx, "width", v as number)
                  }
                />
              </Grid.Col>
              <Grid.Col span={2}>
                <FormNumberInput
                  placeholder="H"
                  min={0}
                  decimalScale={2}
                  value={row.height ?? ""}
                  disabled={readOnly}
                  onChange={(v) =>
                    handleFieldChange(idx, "height", v as number)
                  }
                />
              </Grid.Col>
              <Grid.Col span={2}>
                <FormNumberInput
                  placeholder="Vol Wt"
                  min={0}
                  decimalScale={3}
                  value={row.vol_weight ?? ""}
                  readOnly
                  disabled
                />
              </Grid.Col>
              <Grid.Col span={2}>
                {!readOnly && (
                  <Group gap="xs" wrap="nowrap">
                    {rows.length > 1 && (
                      <Button
                        size="sm"
                        variant="light"
                        color="red"
                        px={10}
                        onClick={() => handleRemoveRow(idx)}
                      >
                        <IconTrash size={15} />
                      </Button>
                    )}
                    {idx === rows.length - 1 && (
                      <Button
                        size="sm"
                        variant="light"
                        color="#105476"
                        px={10}
                        onClick={handleAddRow}
                      >
                        <IconPlus size={15} />
                      </Button>
                    )}
                  </Group>
                )}
              </Grid.Col>
            </Grid>
          ))}
        </>
      )}
    </Box>
  );
};

export default BookingDimensionsSection;
