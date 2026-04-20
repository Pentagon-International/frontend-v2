import { useState, useEffect, useCallback, useRef } from "react";
import {
  ActionIcon,
  Loader,
  Pill,
  PillsInput,
  Combobox,
  useCombobox,
  ScrollArea,
  Text,
  CheckIcon,
  Group,
} from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import { useDebouncedValue } from "@mantine/hooks";
import { commonSearchAPI } from "../service/searchApi";

interface SelectedOption {
  value: string;
  label: string;
}

interface SearchableMultiSelectProps {
  apiEndpoint?: string;
  placeholder?: string;
  label?: string;
  value?: string[];                            // Array of selected values
  dropdownZIndex?: number | null;
  displayValues?: Record<string, string>;      // Map of value -> label for pre-populated display
  onChange: (
    values: string[],
    selectedData?: SelectedOption[],
    originalData?: Record<string, unknown>[]
  ) => void;
  searchFields?: string[];
  displayFormat?: (item: Record<string, unknown>) => { value: string; label: string };
  required?: boolean;
  withAsterisk?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  error?: string;
  className?: string;
  minSearchLength?: number;
  size?: string;
  returnOriginalData?: boolean;
  additionalParams?: Record<string, string>;
  styles?: Record<string, any>;
  maxValues?: number;                          // Optional cap on number of selections
  /** Show a control that clears all selections (default: true). */
  withClearButton?: boolean;
}

export default function SearchableMultiSelect({
  apiEndpoint,
  placeholder = "Search...",
  label,
  value = [],
  displayValues = {},
  dropdownZIndex = 5,
  onChange,
  searchFields = ["id", "name"],
  displayFormat,
  required = false,
  withAsterisk = false,
  disabled = false,
  readOnly = false,
  error,
  className,
  minSearchLength = 3,
  size,
  returnOriginalData = false,
  additionalParams,
  styles,
  maxValues,
  withClearButton = true,
}: SearchableMultiSelectProps) {
  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
    onDropdownOpen: () => combobox.updateSelectedOptionIndex("active"),
  });

  const [search, setSearch] = useState("");
  const [debounced] = useDebouncedValue(search, 600);
  const [dropdownData, setDropdownData] = useState<SelectedOption[]>([]);
  const [originalData, setOriginalData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [lastSearchTerm, setLastSearchTerm] = useState("");

  // ─── Selected items (internal state) ───────────────────────────────────────
  // Build initial selected items from value + displayValues props
  const buildSelectedItems = (vals: string[], displayMap: Record<string, string>): SelectedOption[] =>
    vals.map((v) => ({ value: v, label: displayMap[v] ?? v }));

  const [selectedItems, setSelectedItems] = useState<SelectedOption[]>(() =>
    buildSelectedItems(value, displayValues)
  );

  // Sync selectedItems when value/displayValues props change externally
  useEffect(() => {
    setSelectedItems(buildSelectedItems(value, displayValues));
  }, [JSON.stringify(value), JSON.stringify(displayValues)]);

  // ─── Default display format (same logic as original) ───────────────────────
  const defaultDisplayFormat = (item: Record<string, unknown>) => {
    if (searchFields.includes("id") && searchFields.includes("name")) {
      return {
        value: String(item.id || item.customer_code || item.port_code || item.port_name),
        label: `${item.id || item.customer_code || item.port_code || ""} - ${item.name || item.customer_name || item.port_name || ""}`,
      };
    } else if (searchFields.includes("id")) {
      return {
        value: String(item.id || item.customer_code || item.port_code),
        label: String(item.id || item.customer_code || item.port_code),
      };
    } else {
      return {
        value: String(item.id || item.customer_code || item.port_code || item.port_name),
        label: String(item.name || item.customer_name || item.port_name),
      };
    }
  };

  const formatData = displayFormat || defaultDisplayFormat;

  // ─── Fetch from API (same debounce/minLength logic as original) ────────────
  const fetchData = useCallback(async () => {
    if (!apiEndpoint || debounced.length < minSearchLength || !isSearchMode || !debounced.trim()) {
      return;
    }

    setLoading(true);
    try {
      let endpointWithParams = apiEndpoint;
      if (additionalParams && Object.keys(additionalParams).length > 0) {
        const params = new URLSearchParams();
        Object.entries(additionalParams).forEach(([key, val]) => params.append(key, val));
        endpointWithParams = `${apiEndpoint}?${params.toString()}`;
      }

      const response = await commonSearchAPI({ endpoint: endpointWithParams, query: debounced });

      if (Array.isArray(response)) {
        setDropdownData(response.map(formatData));
        setOriginalData(response);
        setLastSearchTerm(debounced);
        combobox.openDropdown();
      } else {
        setDropdownData([]);
        setOriginalData([]);
      }
    } catch (e) {
      console.error("Search error:", e);
      setDropdownData([]);
    }
    setLoading(false);
  }, [debounced, isSearchMode, apiEndpoint, formatData, minSearchLength, additionalParams]);

  useEffect(() => {
    fetchData();
  }, [debounced, fetchData]);

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const handleValueSelect = (val: string) => {
    const isAlreadySelected = selectedItems.some((item) => item.value === val);

    let newSelectedItems: SelectedOption[];

    if (isAlreadySelected) {
      // Deselect
      newSelectedItems = selectedItems.filter((item) => item.value !== val);
    } else {
      if (maxValues && selectedItems.length >= maxValues) return; // Respect cap
      const found = dropdownData.find((item) => item.value === val);
      if (!found) return;
      newSelectedItems = [...selectedItems, found];
    }

    setSelectedItems(newSelectedItems);
    setSearch("");          // Clear search after selection
    setIsSearchMode(false);
    setDropdownData([]);

    // Build return payloads
    const returnValues = newSelectedItems.map((i) => i.value);
    const returnOriginal = returnOriginalData
      ? newSelectedItems.map((i) => originalData.find((o) => formatData(o).value === i.value) ?? {})
      : undefined;

    onChange(returnValues, newSelectedItems, returnOriginal);
    combobox.closeDropdown();
  };

  const handleValueRemove = (val: string) => {
    const newSelectedItems = selectedItems.filter((item) => item.value !== val);
    setSelectedItems(newSelectedItems);
    const returnValues = newSelectedItems.map((i) => i.value);
    onChange(returnValues, newSelectedItems);
  };

  const handleClearAll = useCallback(() => {
    setSelectedItems([]);
    setSearch("");
    setIsSearchMode(false);
    setDropdownData([]);
    setOriginalData([]);
    combobox.closeDropdown();
    onChange([], [], returnOriginalData ? [] : undefined);
  }, [combobox, onChange, returnOriginalData]);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (!val.trim()) {
      setIsSearchMode(false);
      setDropdownData([]);
      combobox.closeDropdown();
    } else {
      setIsSearchMode(true);
      if (val.trim().toLowerCase() !== lastSearchTerm.trim().toLowerCase()) {
        // New search term - open dropdown if we have results
      }
    }
  };

  // ─── Derived ───────────────────────────────────────────────────────────────
  const selectedValues = selectedItems.map((i) => i.value);
  const isMaxReached = maxValues !== undefined && selectedItems.length >= maxValues;
  const showClear =
    withClearButton &&
    selectedItems.length > 0 &&
    !disabled &&
    !readOnly;

  const placeholderText = loading
    ? "Searching..."
    : search.length > 0 && search.length < minSearchLength && isSearchMode
    ? `Type ${minSearchLength - search.length} more character${minSearchLength - search.length > 1 ? "s" : ""}...`
    : isMaxReached
    ? `Max ${maxValues} selected`
    : placeholder;

  // ─── Pills (selected tags) ─────────────────────────────────────────────────
  const pills = selectedItems.map((item) => (
    <Pill
      key={item.value}
      withRemoveButton={!disabled && !readOnly}
      onRemove={() => handleValueRemove(item.value)}
      styles={{
        root: { fontSize: "12px", backgroundColor: "#2563EB", color: "#ffffff" },
        remove: { color: "#ffffff" },
      }}
    >
      {item.label}
    </Pill>
  ));

  // ─── Dropdown options ──────────────────────────────────────────────────────
  const options = dropdownData.map((item) => {
    const isSelected = selectedValues.includes(item.value);
    return (
      <Combobox.Option value={item.value} key={item.value} active={isSelected}>
        <Group gap="sm">
          {isSelected ? <CheckIcon size={12} color="#2563EB" /> : <span style={{ width: 12 }} />}
          <span style={{ fontSize: "13px", fontFamily: "Inter" }}>{item.label}</span>
        </Group>
      </Combobox.Option>
    );
  });

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <Combobox
      store={combobox}
      zIndex={dropdownZIndex ?? 5}
      onOptionSubmit={handleValueSelect}
    >
      <Combobox.DropdownTarget>
        <PillsInput
          label={label}
          required={required}
          withAsterisk={withAsterisk || required}
          disabled={disabled}
          error={error}
          className={className}
          size={size as any}
          onClick={() => !disabled && !readOnly && combobox.openDropdown()}
          rightSection={
            showClear ? (
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                radius="sm"
                aria-label="Clear all"
                title="Clear all"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleClearAll();
                }}
              >
                <IconX size={16} stroke={1.5} />
              </ActionIcon>
            ) : null
          }
          rightSectionPointerEvents="auto"
          styles={{
            input: {
              fontSize: "13px",
              minHeight: "36px",
              fontFamily: "Inter",
              cursor: disabled ? "not-allowed" : "text",
              ...styles?.input,
            },
            label: {
              fontSize: "13px",
              fontWeight: 500,
              color: "#424242",
              marginBottom: "4px",
              fontFamily: "Inter",
              ...styles?.label,
            },
          }}
        >
          <Pill.Group>
            {pills}
            {!readOnly && (
              <Combobox.EventsTarget>
                <PillsInput.Field
                  value={search}
                  placeholder={selectedItems.length === 0 ? placeholderText : ""}
                  disabled={disabled || isMaxReached}
                  onChange={(e) => {
                    combobox.updateSelectedOptionIndex();
                    handleSearchChange(e.currentTarget.value);
                  }}
                  onFocus={() => {
                    if (dropdownData.length > 0) combobox.openDropdown();
                  }}
                  onBlur={() => {
                    combobox.closeDropdown();
                    setSearch("");
                    setIsSearchMode(false);
                  }}
                  onKeyDown={(e) => {
                    // Backspace on empty input removes last pill
                    if (e.key === "Backspace" && search === "" && selectedItems.length > 0) {
                      handleValueRemove(selectedItems[selectedItems.length - 1].value);
                    }
                    if (e.key === "Escape") {
                      combobox.closeDropdown();
                    }
                  }}
                />
              </Combobox.EventsTarget>
            )}
            {loading && <Loader size="xs" style={{ margin: "auto 4px" }} />}
          </Pill.Group>
        </PillsInput>
      </Combobox.DropdownTarget>

      <Combobox.Dropdown>
        <Combobox.Options>
          <ScrollArea.Autosize mah={220} type="scroll">
            {loading ? (
              <Combobox.Empty>
                <Group gap="xs" justify="center">
                  <Loader size="xs" />
                  <Text size="xs">Searching...</Text>
                </Group>
              </Combobox.Empty>
            ) : isSearchMode && search.length < minSearchLength ? (
              <Combobox.Empty>
                <Text size="xs" c="dimmed">
                  Type at least {minSearchLength} characters to search
                </Text>
              </Combobox.Empty>
            ) : options.length === 0 && isSearchMode ? (
              <Combobox.Empty>
                <Text size="xs" c="dimmed">No results found</Text>
              </Combobox.Empty>
            ) : options.length === 0 ? (
              <Combobox.Empty>
                <Text size="xs" c="dimmed">
                  {label ? `Search your ${label}` : "Start typing to search"}
                </Text>
              </Combobox.Empty>
            ) : (
              options
            )}
          </ScrollArea.Autosize>
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}