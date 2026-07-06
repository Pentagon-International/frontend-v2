import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { URL } from "../../api/serverUrls";
import FormTextInput from "../FormTextInput";
import SearchableSelect from "../SearchableSelect";

type TempCustomerCityFieldProps = {
  value: string;
  error?: string;
  onChange: (city: string) => void;
};

type CityInputMode = "search" | "freeText";

export default function TempCustomerCityField({
  value,
  error,
  onChange,
}: TempCustomerCityFieldProps) {
  const [inputMode, setInputMode] = useState<CityInputMode>("search");
  const freeTextInputRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    if (inputMode !== "freeText") return;

    const input = freeTextInputRef.current;
    if (!input) return;

    const cursor = input.value.length;
    input.focus();
    input.setSelectionRange(cursor, cursor);
  }, [inputMode, value]);

  const resetToSearch = useCallback(() => {
    setInputMode("search");
    onChange("");
  }, [onChange]);

  const handleSearchComplete = useCallback(
    ({
      searchTerm,
      hasResults,
    }: {
      searchTerm: string;
      hasResults: boolean;
    }) => {
      const trimmed = searchTerm.trim();
      if (hasResults || !trimmed) return;

      setInputMode("freeText");
      onChange(trimmed);
    },
    [onChange]
  );

  const handleSelectChange = (
    nextValue: string | null,
    selectedData?: { value: string; label: string } | null
  ) => {
    if (!nextValue) {
      resetToSearch();
      return;
    }

    setInputMode("search");
    onChange(selectedData?.label?.trim() || "");
  };

  const handleFreeTextChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    if (!nextValue.trim()) {
      resetToSearch();
      return;
    }

    onChange(nextValue);
  };

  if (inputMode === "freeText") {
    return (
      <FormTextInput
        ref={freeTextInputRef}
        label="City"
        withAsterisk
        placeholder="Type city name"
        value={value}
        onChange={handleFreeTextChange}
        error={error}
        format="initcap"
      />
    );
  }

  return (
    <SearchableSelect
      label="City"
      withAsterisk
      placeholder="Type city name"
      apiEndpoint={URL.city}
      searchFields={["city_name"]}
      displayFormat={(item: Record<string, unknown>) => ({
        value: String(item.id ?? item.city_code ?? ""),
        label: String(item.city_name ?? ""),
      })}
      value=""
      displayValue={value.trim() ? value : null}
      onChange={handleSelectChange}
      onSearchComplete={handleSearchComplete}
      hideEmptyResultsMessage
      dropdownZIndex={1000}
      minSearchLength={1}
      error={error}
    />
  );
}
