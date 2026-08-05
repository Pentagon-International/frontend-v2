import { useCallback, useMemo, useRef } from "react";
import SearchableSelect from "../../../components/SearchableSelect";
import { URL } from "../../../api/serverUrls";
import {
  CARRIER_SEARCH_FIELDS,
  carrierDisplayFormat,
  formatCarrierDisplayValue,
  parseCarrierNameFromLabel,
} from "../../../utils/carrierSelect";

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

  const additionalParams = useMemo(() => ({ transport_mode: "SEA" }), []);

  const handleChange = useCallback(
    (
      nextValue: string | null,
      selectedData?: { value: string; label: string } | null,
    ) => {
      onChangeRef.current(
        nextValue,
        selectedData
          ? {
              value: selectedData.value,
              label: parseCarrierNameFromLabel(selectedData.label),
            }
          : selectedData,
      );
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
      additionalParams={additionalParams}
      dropdownZIndex={dropdownZIndex}
      value={value}
      displayValue={formatCarrierDisplayValue(displayValue, value)}
      onChange={handleChange}
      error={error}
      minSearchLength={2}
    />
  );
}
