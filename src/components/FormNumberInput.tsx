import { NumberInput, NumberInputProps } from "@mantine/core";
import React from "react";
import { getAmountNumberInputFormatProps } from "../utils/amountDisplayFormat";

export type FormNumberInputProps = NumberInputProps & {
  /** Country grouping for auto-calc total columns only. Value stays numeric. */
  groupThousands?: boolean;
};

const FormNumberInput: React.FC<FormNumberInputProps> = ({
  groupThousands = false,
  ...props
}) => {
  const grouping = groupThousands
    ? getAmountNumberInputFormatProps()
    : undefined;

  return (
    <NumberInput
      decimalScale={2}   // default: restrict input to 2 decimal places
      {...grouping}
      {...props}
      styles={{
        label: {
          fontSize: "13px",
          fontWeight: 500,
          color: "#424242",
          marginBottom: "4px",
          fontFamily: "Inter",
        },
        input: {
          fontSize: "13px",
          fontFamily: "Inter",
          height: "36px",
        },
        ...props.styles, // allow overriding styles if needed
      }}
    />
  );
};

export default FormNumberInput;
