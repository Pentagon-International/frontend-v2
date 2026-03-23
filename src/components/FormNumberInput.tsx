import { NumberInput, NumberInputProps } from "@mantine/core";
import React from "react";

const FormNumberInput: React.FC<NumberInputProps> = (props) => {
  return (
    <NumberInput
      decimalScale={2}   // default: restrict input to 2 decimal places
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