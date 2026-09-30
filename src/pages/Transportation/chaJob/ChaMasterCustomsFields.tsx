import { Grid } from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";
import FormTextInput from "../../../components/FormTextInput";
import { SingleDateInput } from "../../../components";
import type { ChaMasterCustomsFormValues } from "./chaJobCustomsFields";

type ChaMasterCustomsFieldsProps = {
  isChaMode: boolean;
  serviceType?: "Import" | "Export" | null;
  readOnly?: boolean;
  form: UseFormReturnType<ChaMasterCustomsFormValues & Record<string, unknown>>;
};

export function ChaMasterCustomsFields({
  isChaMode,
  serviceType,
  readOnly = false,
  form,
}: ChaMasterCustomsFieldsProps) {
  if (!isChaMode || (serviceType !== "Import" && serviceType !== "Export")) {
    return null;
  }

  if (serviceType === "Import") {
    return (
      <>
        <Grid.Col span={3}>
          <FormTextInput
            format="capital"
            label="BOE Number"
            placeholder="Enter BOE Number"
            {...form.getInputProps("boe_no")}
            disabled={readOnly}
            error={form.errors.boe_no}
          />
        </Grid.Col>
        <Grid.Col span={3}>
          <SingleDateInput
            label="BOE Date"
            placeholder="YYYY-MM-DD"
            readOnly={readOnly}
            value={form.values.boe_date}
            onChange={(value) => form.setFieldValue("boe_date", value)}
            size="sm"
          />
        </Grid.Col>
      </>
    );
  }

  return (
    <>
      <Grid.Col span={3}>
          <FormTextInput
            format="capital"
            label="SB Number"
            placeholder="Enter SB Number"
            {...form.getInputProps("sb_no")}
            disabled={readOnly}
            error={form.errors.sb_no}
          />
      </Grid.Col>
      <Grid.Col span={3}>
        <SingleDateInput
          label="SB Date"
          placeholder="YYYY-MM-DD"
          readOnly={readOnly}
          value={form.values.sb_date}
          onChange={(value) => form.setFieldValue("sb_date", value)}
          size="sm"
        />
      </Grid.Col>
    </>
  );
}
