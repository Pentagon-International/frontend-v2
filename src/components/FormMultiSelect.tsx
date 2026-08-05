import { MultiSelect, type MultiSelectProps } from "@mantine/core";

/** MultiSelect styled to match Dropdown / FormTextInput design tokens. */
export type FormMultiSelectProps = MultiSelectProps & {
  dropdownZIndex?: number;
};

const getStandardFieldStyles = () => ({
  label: {
    fontSize: "13px",
    fontWeight: 500,
    color: "#424242",
    marginBottom: "4px",
    fontFamily: "Inter",
    fontStyle: "medium",
  },
  input: {
    fontSize: "13px",
    fontFamily: "Inter",
    minHeight: "36px",
  },
  pill: {
    fontSize: "12px",
    fontFamily: "Inter",
  },
});

export default function FormMultiSelect({
  styles,
  dropdownZIndex = 5,
  comboboxProps,
  searchable = true,
  ...props
}: FormMultiSelectProps) {
  const base = getStandardFieldStyles();

  return (
    <MultiSelect
      searchable={searchable}
      radius="sm"
      size="sm"
      {...props}
      comboboxProps={{
        withinPortal: true,
        zIndex: dropdownZIndex,
        ...comboboxProps,
      }}
      styles={{
        ...styles,
        label: { ...base.label, ...styles?.label },
        input: { ...base.input, ...styles?.input },
        pill: { ...base.pill, ...styles?.pill },
      }}
    />
  );
}
