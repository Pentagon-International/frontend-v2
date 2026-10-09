import { Grid } from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";
import FormTextInput from "../../../components/FormTextInput";

type DubaiBoeNumberFieldProps<T extends { boe_no: string }> = {
  visible: boolean;
  readOnly?: boolean;
  form: UseFormReturnType<T>;
};

/** BOE number only. CHA import already renders its own BOE number and date. */
export function DubaiBoeNumberField<T extends { boe_no: string }>({
  visible,
  readOnly = false,
  form,
}: DubaiBoeNumberFieldProps<T>) {
  if (!visible) return null;

  return (
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
  );
}
