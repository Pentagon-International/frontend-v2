import { Textarea, TextareaProps } from "@mantine/core";
import React, { useState } from "react";

export type TextFormatType = "normal" | "initcap" | "capital";

export interface FormTextAreaProps extends TextareaProps {
  format?: TextFormatType;
}

const applyFormat = (value: string, format: TextFormatType): string => {
  switch (format) {
    case "capital":
      return value.toUpperCase();
    case "initcap":
      return value.replace(/\b\w/g, (char) => char.toUpperCase());
    case "normal":
    default:
      return value;
  }
};

const FormTextArea = React.forwardRef<HTMLTextAreaElement, FormTextAreaProps>(
  ({ format = "initcap", onChange, value, defaultValue, ...props }, ref) => {
    const isControlled = value !== undefined;

    const [internalValue, setInternalValue] = useState<string>(
      defaultValue ? applyFormat(String(defaultValue), format) : ""
    );

    const displayValue = isControlled
      ? applyFormat(String(value ?? ""), format)
      : internalValue;

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const formatted = applyFormat(e.target.value, format);

      if (!isControlled) {
        setInternalValue(formatted);
      }

      e.target.value = formatted;
      onChange?.(e);
    };

    return (
      <Textarea
        ref={ref}
        {...props}
        value={displayValue}
        onChange={handleChange}
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
          },
          ...props.styles,
        }}
      />
    );
  }
);

export default FormTextArea;