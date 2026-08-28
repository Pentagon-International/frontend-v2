import Dropdown from "./Dropdown";
import { usePackageTypeOptions } from "../hooks/usePackageTypeOptions";

type BookingPackageTypeDropdownProps = {
  value?: string | null;
  onChange: (value: string) => void;
  /** Omit the field label (e.g. FCL rows that use a header row). */
  hideLabel?: boolean;
};

/** Package Type select for booking cargo details (same master as job House cargo). */
export default function BookingPackageTypeDropdown({
  value,
  onChange,
  hideLabel = false,
}: BookingPackageTypeDropdownProps) {
  const packageTypeOptions = usePackageTypeOptions();

  return (
    <Dropdown
      label={hideLabel ? undefined : "Package Type"}
      placeholder="Package Type"
      searchable
      clearable
      data={packageTypeOptions}
      value={value || null}
      onChange={(next) => onChange(next || "")}
    />
  );
}
