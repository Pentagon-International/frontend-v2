import React from "react";
import { TextInput, TextInputProps } from "@mantine/core";

export interface FormTextInputProps extends TextInputProps {}

const getStandardFieldStyles = () => ({
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
});

const FormTextInput: React.FC<FormTextInputProps> = (props) => {
  return (
    <TextInput
      radius="sm"
      size="sm"
      styles={getStandardFieldStyles()}
      {...props}
    />
  );
};

export default FormTextInput;
