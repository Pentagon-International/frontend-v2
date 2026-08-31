import { Grid } from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";
import FormTextInput from "../../../components/FormTextInput";
import { SingleDateInput } from "../../../components";
import type { ChaHouseBlFormValues } from "./chaHouseBlFields";

type ChaHouseBlFormFieldsProps = {
  isChaMode: boolean;
  form: UseFormReturnType<ChaHouseBlFormValues & Record<string, unknown>>;
};

export function ChaHouseBlFormFields({
  isChaMode,
  form,
}: ChaHouseBlFormFieldsProps) {
  if (!isChaMode) return null;

  return (
    <>
      <Grid.Col span={4}>
        <FormTextInput
          format="capital"
          label="BL No"
          placeholder="Enter BL No"
          {...form.getInputProps("bl_no")}
          error={form.errors.bl_no}
        />
      </Grid.Col>
      <Grid.Col span={4}>
        <SingleDateInput
          label="BL Date"
          placeholder="Select BL Date"
          value={form.values.bl_date}
          onChange={(d) => form.setFieldValue("bl_date", d)}
          size="sm"
        />
      </Grid.Col>
    </>
  );
}
