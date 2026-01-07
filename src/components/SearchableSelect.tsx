import { useState, useEffect, useCallback, useRef } from "react";
import { Select, Loader } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { commonSearchAPI } from "../service/searchApi";

interface SearchableSelectProps {
  apiEndpoint?: string;
  placeholder?: string;
  label?: string;
  value?: string | null;
  displayValue?: string | null; // Optional: what to show in input (different from value)
  onChange: (
    value: string | null,
    selectedData?: { value: string; label: string } | null,
    originalData?: Record<string, unknown> | null // New prop to return full original API data
  ) => void;
  searchFields?: string[];
  displayFormat?: (item: Record<string, unknown>) => {
    value: string;
    label: string;
  };
  required?: boolean;
  withAsterisk?: boolean;
  disabled?: boolean;
  error?: string;
  className?: string;
  minSearchLength?: number; // Minimum characters before triggering search
  size?: string; // Add size prop
  returnOriginalData?: boolean; // New prop to control whether to return original data
  additionalParams?: Record<string, string>; // Additional query parameters to add to the API call
}

export default function SearchableSelect({
  apiEndpoint,
  placeholder = "Search...",
  label,
  value,
  displayValue,
  onChange,
  searchFields = ["id", "name"],
  displayFormat,
  required = false,
  withAsterisk = false,
  disabled = false,
  error,
  className,
  minSearchLength = 3, // Default to 3 characters
  size,
  returnOriginalData = false, // Default to false for backward compatibility
  additionalParams,
}: SearchableSelectProps) {
  // Initialize selected state - if no value but displayValue exists, create temp value
  // Use a stable hash of displayValue to avoid recreating on every render
  const getTempValue = (displayVal: string) => {
    // Create a simple hash from the displayValue for stability
    let hash = 0;
    for (let i = 0; i < displayVal.length; i++) {
      const char = displayVal.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `temp_${Math.abs(hash)}`;
  };

  const getInitialSelected = () => {
    if (value) return value;
    if (displayValue && displayValue.trim() !== "") {
      return getTempValue(displayValue);
    }
    return null;
  };

  const [search, setSearch] = useState(displayValue || "");
  const [debounced] = useDebouncedValue(search, 600); // ⏳ debounce 600ms
  const [data, setData] = useState<Array<{ value: string; label: string }>>(
    () => {
      // Initialize data with displayValue if no value but displayValue exists
      if (!value && displayValue && displayValue.trim() !== "") {
        const tempValue = getTempValue(displayValue);
        return [{ value: tempValue, label: displayValue }];
      }
      return [];
    }
  );
  const [originalData, setOriginalData] = useState<Record<string, unknown>[]>(
    []
  ); // Store original API data
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(getInitialSelected());
  const [selectedItem, setSelectedItem] = useState<{
    value: string;
    label: string;
  } | null>(() => {
    if (value && displayValue) {
      return { value: value, label: displayValue };
    }
    if (!value && displayValue && displayValue.trim() !== "") {
      const tempValue = getTempValue(displayValue);
      return { value: tempValue, label: displayValue };
    }
    return null;
  });
  const [isSearchMode, setIsSearchMode] = useState(false); // Track if user is actively searching
  const [lastSearchTerm, setLastSearchTerm] = useState("");
  const searchRef = useRef<string>(""); // Keep track of current search without triggering effects
  // Cache: maps trimmed-lowercase search terms to array of [{value,label}] and originalData
  /*
  const searchCache = useRef<{
    [term: string]: {
      data: { value: string; label: string }[];
      originalData: Record<string, unknown>[];
    };
  }>({});
  */
  // Track active index for keyboard navigation so Tab can select the highlighted one
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  // Default display format if none provided
  const defaultDisplayFormat = (item: Record<string, unknown>) => {
    if (searchFields.includes("id") && searchFields.includes("name")) {
      return {
        value: String(
          item.id || item.customer_code || item.port_code || item.port_name
        ),
        label: `${item.id || item.customer_code || item.port_code || ""} - ${item.name || item.customer_name || item.port_name || ""}`,
      };
    } else if (searchFields.includes("id")) {
      return {
        value: String(item.id || item.customer_code || item.port_code),
        label: String(item.id || item.customer_code || item.port_code),
      };
    } else {
      return {
        value: String(
          item.id || item.customer_code || item.port_code || item.port_name
        ),
        label: String(item.name || item.customer_name || item.port_name),
      };
    }
  };

  const formatData = displayFormat || defaultDisplayFormat;

  const fetchData = useCallback(async () => {
    // Only hit API if:
    // 1. apiEndpoint is provided
    // 2. Search has minimum required characters
    // 3. User is actively in search mode (not just displaying selected item)
    // 4. There's actually a search term
    // 5. The search term has changed from last search
    if (
      !apiEndpoint ||
      debounced.length < minSearchLength ||
      !isSearchMode ||
      !debounced.trim()
    ) {
      return;
    }

    // Caching disabled: always fetch from API for current debounced term

    setLoading(true);
    try {
      // Build endpoint with additional params if provided
      let endpointWithParams = apiEndpoint;
      if (additionalParams && Object.keys(additionalParams).length > 0) {
        const params = new URLSearchParams();
        Object.entries(additionalParams).forEach(([key, val]) => {
          params.append(key, val);
        });
        endpointWithParams = `${apiEndpoint}?${params.toString()}`;
      }

      const response = await commonSearchAPI({
        endpoint: endpointWithParams,
        query: debounced,
      });

      // Transform API response to Select data
      if (Array.isArray(response)) {
        const transformedData = response.map(formatData);
        setData(transformedData);
        setOriginalData(response); // Store original API data
        setLastSearchTerm(debounced);
        // Reset active index to first item on fresh data
        setActiveIndex(transformedData.length > 0 ? 0 : -1);
      } else {
        setData([]);
        setOriginalData([]);
        setActiveIndex(-1);
      }
    } catch (e) {
      console.error("Search error:", e);
      setData([]);
      setActiveIndex(-1);
      // Do not cache if error
    }
    setLoading(false);
  }, [
    debounced,
    isSearchMode,
    apiEndpoint,
    formatData,
    minSearchLength,
    additionalParams,
  ]);

  useEffect(() => {
    fetchData();
  }, [debounced, fetchData]);

  // Update selected state when value prop changes
  useEffect(() => {
    if (value) {
      setSelected(value || null);
      // If we have a value, check if we need to update the display
      if (!selectedItem || selectedItem.value !== value) {
        // External value change - set up the display
        if (displayValue) {
          // We have a displayValue, so create a selectedItem for proper display
          setSelectedItem({ value: value, label: displayValue });
          setSearch(displayValue);
        } else {
          // No displayValue, just show the value
          setSelectedItem({ value: value, label: value });
          setSearch(value);
        }
        setIsSearchMode(false);
        // Ensure the selected item is in the data array so it displays properly
        setData([{ value: value, label: displayValue || value }]);
      }
    } else if (displayValue && displayValue.trim() !== "") {
      // No value but we have displayValue (edit mode scenario)
      // Create a temporary selectedItem to display the value
      // Use a stable hash of displayValue to avoid recreating on every render
      let hash = 0;
      for (let i = 0; i < displayValue.length; i++) {
        const char = displayValue.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      const tempValue = `temp_${Math.abs(hash)}`;
      setSelected(tempValue);
      setSelectedItem({ value: tempValue, label: displayValue });
      setSearch(displayValue);
      setIsSearchMode(false);
      // Ensure the selected item is in the data array so it displays properly
      setData([{ value: tempValue, label: displayValue }]);
    } else {
      // No value, clear everything
      setSelected(null);
      setSelectedItem(null);
      setSearch("");
      setIsSearchMode(false);
      setData([]);
      setOriginalData([]);
    }
  }, [value, displayValue, selectedItem]);

  const handleSearchChange = (val: string) => {
    searchRef.current = val;
    setSearch(val);

    if (!val.trim()) {
      // User cleared the search
      setSelected(null);
      setSelectedItem(null);
      setIsSearchMode(false);
      setData([]); // keep this, do NOT clear cache
      setOriginalData([]); // keep this, do NOT clear cache
      setActiveIndex(-1);
      onChange(null);
    } else {
      // User is typing - check if they're modifying a selected item or searching fresh
      if (selectedItem && val !== selectedItem.label) {
        // User is modifying the selected item's text - enter search mode
        setIsSearchMode(true);
        setSelected(null);
        setSelectedItem(null);
      } else if (!selectedItem) {
        // User is typing fresh search
        setIsSearchMode(true);
      }
      // As user types a new term (not equal to last debounced term), optimistically reset active index
      if (val.trim().toLowerCase() !== lastSearchTerm.trim().toLowerCase()) {
        setActiveIndex(-1);
      }
      // If val === selectedItem.label, don't enter search mode (user just focused on selected item)
    }
  };

  const handleChange = (val: string | null) => {
    setSelected(val);

    if (val) {
      // Find the selected item and set its label as search text
      const foundItem = data.find((item) => item.value === val);
      if (foundItem) {
        setSelectedItem(foundItem);
        setSearch(foundItem.label);
        setIsSearchMode(false); // Exit search mode
        searchRef.current = foundItem.label;

        // Find the original data for this item
        const originalItem = returnOriginalData
          ? originalData.find((item) => formatData(item).value === val)
          : null;

        onChange(val, foundItem, originalItem); // Pass selected data and original data back
      } else {
        onChange(val); // Pass just value if no item found
      }
    } else {
      setSelectedItem(null);
      setSearch("");
      setIsSearchMode(false);
      searchRef.current = "";
      onChange(null); // Pass null
    }
  };

  return (
    <>
      <Select
        label={label}
        comboboxProps={{
          zIndex: 5,
        }}
        styles={{
          input: { fontSize: "13px", height: "36px", },
          label: {
            fontSize: "13px",
            fontWeight: 500,
            color: "#424242",
            marginBottom: "4px",
            fontFamily: "Inter",
            fontStyle: "medium",
          },
        }}
        searchable
        data={data}
        value={selected}
        searchValue={search} // Explicitly control displayed text
        onSearchChange={handleSearchChange}
        onChange={handleChange}
        size={size}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            if (data.length > 0) {
              setActiveIndex((prev) => {
                const next = prev < 0 ? 0 : Math.min(prev + 1, data.length - 1);
                return next;
              });
            }
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            if (data.length > 0) {
              setActiveIndex((prev) => {
                const next = prev <= 0 ? 0 : prev - 1;
                return next;
              });
            }
          } else if (event.key === "Home") {
            event.preventDefault();
            setActiveIndex(data.length > 0 ? 0 : -1);
          } else if (event.key === "End") {
            event.preventDefault();
            setActiveIndex(data.length > 0 ? data.length - 1 : -1);
          } else if (event.key === "Tab") {
            // On Tab, if user navigated options and nothing selected yet, select active option
            if (!selectedItem && activeIndex >= 0 && data.length > 0) {
              const idx = activeIndex > 0 ? activeIndex - 1 : 0;
              const active = data[idx];
              if (active) {
                handleChange(active.value);
                setSearch(active.label);
                setIsSearchMode(false);
              }
            }
          }
        }}
        placeholder={
          loading
            ? "Searching..."
            : search.length > 0 &&
                search.length < minSearchLength &&
                isSearchMode
              ? `Type ${minSearchLength - search.length} more character${minSearchLength - search.length > 1 ? "s" : ""}...`
              : placeholder
        }
        clearable
        required={required}
        withAsterisk={withAsterisk || required}
        disabled={disabled}
        error={error}
        className={className}
        rightSection={loading ? <Loader size="xs" /> : undefined}
        nothingFoundMessage={
          loading ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px",
              }}
            >
              <Loader size="xs" />
              <span>Searching...</span>
            </div>
          ) : isSearchMode && search.length < minSearchLength ? (
            `Type at least ${minSearchLength} characters to search`
          ) : isSearchMode &&
            search.length >= minSearchLength &&
            data.length === 0 ? (
            "No results found"
          ) : label ? (
            "Search your " + label + ""
          ) : (
            ""
          )
        }
        onFocus={(event) => {
          // Auto-select all text when input is focused
          const input = event.target as HTMLInputElement;
          if (input && input.value) {
            input.select();
          }

          // When focused, ensure the selected item is visible in dropdown
          if (selectedItem) {
            // Always ensure the selected item is in the data array
            const hasSelectedItem = data.some(
              (item) => item.value === selectedItem.value
            );
            if (!hasSelectedItem) {
              setData([selectedItem]);
            }
          }
        }}
        onBlur={() => {
          // If nothing selected after search, pick the active option if available, else first option
          if (!selectedItem && data.length > 0) {
            const idx = activeIndex > 0 ? activeIndex - 1 : 0;
            const pick = data[idx] ?? data[0];
            handleChange(pick.value); // This will set selectedItem, selected, etc.
            setSearch(pick.label); // Immediately update the input with label
            setIsSearchMode(false);
            return;
          }
          // Previous logic - ensure search text shows selected label:
          if (selectedItem && search !== selectedItem.label) {
            setSearch(selectedItem.label);
            setIsSearchMode(false);
          }
        }}
      />
      {/* <Text py={300} px={100}>Active index value:{activeIndex}</Text> */}
    </>
  );
}
