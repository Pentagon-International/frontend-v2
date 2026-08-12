import React, { useState } from "react";
import { TextInput, TextInputProps } from "@mantine/core";
import { toTitleCase } from "../utils/textFormatter";

export type TextFormatType = "normal" | "initcap" | "capital";

export interface FormTextInputProps extends TextInputProps {
  format?: TextFormatType;
}

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

const applyFormat = (value: string, format: TextFormatType): string => {
  switch (format) {
    case "capital":
      return value.toUpperCase();
    case "initcap":
      return toTitleCase(value);
    case "normal":
    default:
      return value;
  }
};

const FormTextInput = React.forwardRef<HTMLInputElement, FormTextInputProps>(
  ({ format = "initcap", onChange, value, defaultValue, styles: userStyles, ...props }, ref) => {
  const isControlled = value !== undefined;

  const [internalValue, setInternalValue] = useState<string>(
    defaultValue ? applyFormat(String(defaultValue), format) : ""
  );

  const displayValue = isControlled
    ? applyFormat(String(value ?? ""), format)
    : internalValue;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = applyFormat(e.target.value, format);

    if (!isControlled) {
      setInternalValue(formatted);
    }

    // Pass the formatted value upstream
    e.target.value = formatted;
    onChange?.(e);
  };

    const base = getStandardFieldStyles();
    return (
      <TextInput
        ref={ref}
        autoComplete="off"
        radius="sm"
        size="sm"
        styles={{
          ...userStyles,
          label: { ...base.label, ...userStyles?.label },
          input: { ...base.input, ...userStyles?.input },
        }}
        {...props}
        value={displayValue}
        onChange={handleChange}
      />
    );
  },
);

export default FormTextInput;