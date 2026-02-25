import { Text } from "@mantine/core";
import React from "react";

interface RequiredLabelProps {
  label: string;
  required?: boolean;
  size?: string;
  isViewMode?: boolean;
}

const RequiredLabel: React.FC<RequiredLabelProps> = ({
  label,
  required = false,
  isViewMode = false,
  size= "xs"
}) => {
  return (
    <Text
      size={size}
      fw={500}
      style={{
        fontSize: "13px",
        fontFamily: "Inter",
      }}
    >
      {label}
      {!isViewMode && required && (
        <Text component="span" c="red" fw={700}>
          {" "}
          *
        </Text>
      )}
    </Text>
  );
};

export default RequiredLabel;