import { useCallback, useRef } from "react";
import SearchableSelect from "../../../components/SearchableSelect";
import { URL } from "../../../api/serverUrls";

const CARRIER_SEARCH_FIELDS = ["carrier_code", "carrier_name"] as const;

const carrierDisplayFormat = (item: Record<string, unknown>) => ({
  value: String(item.carrier_code),
  label: String(item.carrier_name),
});

type OceanBookingCarrierSelectProps = {
  label?: string;
  value?: string;
  displayValue?: string;
  onChange: (
    value: string | null,
    selectedData?: { value: string; label: string } | null,
  ) => void;
  error?: string;
  dropdownZIndex?: number | null;
};

export default function OceanBookingCarrierSelect({
  label = "Carrier",
  value,
  displayValue,
  onChange,
  error,
  dropdownZIndex = 5,
}: OceanBookingCarrierSelectProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const handleChange = useCallback(
    (
      nextValue: string | null,
      selectedData?: { value: string; label: string } | null,
    ) => {
      onChangeRef.current(nextValue, selectedData);
    },
    [],
  );

  return (
    <SearchableSelect
      label={label}
      placeholder="Type carrier name"
      apiEndpoint={URL.carrier}
      searchFields={[...CARRIER_SEARCH_FIELDS]}
      displayFormat={carrierDisplayFormat}
      dropdownZIndex={dropdownZIndex}
      value={value}
      displayValue={displayValue}
      onChange={handleChange}
      error={error}
      minSearchLength={2}
    />
  );
}
