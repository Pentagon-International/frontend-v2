import { Textarea, TextareaProps } from "@mantine/core";
import React from "react";

const FormTextArea: React.FC<TextareaProps> = (props) => {
  return (
    <Textarea
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
        },
        ...props.styles,
      }}
    />
  );
};

export default FormTextArea;