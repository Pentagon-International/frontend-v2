import { useRef, useEffect, useMemo, useState } from "react";
import { Select, SelectProps } from "@mantine/core";

type DropdownProps = Omit<
  SelectProps,
  "onKeyDown" | "onFocus" | "onBlur" | "onSearchChange" | "searchValue"
> & {
  searchable?: boolean; // Add searchable prop
};

interface NormalizedItem {
  value: string;
  label: string;
}

export default function Dropdown({
  data = [],
  value,
  onChange,
  searchable = false,
  ...props
}: DropdownProps) {
  // Track active index for keyboard navigation (similar to SearchableSelect)
  // SearchableSelect tracks activeIndex as one ahead of what's visually highlighted
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  // Track selected item to know if something is currently selected
  const [selectedItem, setSelectedItem] = useState<NormalizedItem | null>(null);
  // Track search text for filtering
  const [search, setSearch] = useState("");
  // Track if user is actively searching
  const [isSearchMode, setIsSearchMode] = useState(false);
  const searchRef = useRef<string>("");

  // Normalize data to ensure consistent format
  const normalizedData = useMemo<NormalizedItem[]>(() => {
    if (!Array.isArray(data)) return [];
    return data.map((item) => {
      if (typeof item === "string") {
        return { value: item, label: item };
      }
      if (typeof item === "object" && item !== null && "value" in item) {
        return {
          value: String(item.value),
          label: String(item.label || item.value),
        };
      }
      return { value: String(item), label: String(item) };
    });
  }, [data]);

  // Filter data based on search text (manual filtering instead of Mantine's searchable)
  const filteredData = useMemo<NormalizedItem[]>(() => {
    if (!searchable || !search.trim() || !isSearchMode) {
      // No search active - return all normalized data
      return normalizedData;
    }

    // Filter based on search text (case-insensitive)
    const searchLower = search.toLowerCase().trim();
    return normalizedData.filter((item) => {
      const labelMatch = item.label.toLowerCase().includes(searchLower);
      const valueMatch = item.value.toLowerCase().includes(searchLower);
      return labelMatch || valueMatch;
    });
  }, [normalizedData, search, searchable, isSearchMode]);

  // Data to display in dropdown (filtered or all)
  const displayData = searchable ? filteredData : normalizedData;

  // Initialize selected item and active index when component mounts or value changes
  // Similar to SearchableSelect behavior
  useEffect(() => {
    if (value && normalizedData.length > 0) {
      const foundItem = normalizedData.find((item) => item.value === value);
      if (foundItem) {
        setSelectedItem(foundItem);
        const currentIndex = normalizedData.findIndex(
          (item) => item.value === value
        );
        // Track as one ahead (like SearchableSelect)
        setActiveIndex(currentIndex >= 0 ? currentIndex + 1 : 0);
        // Set search to selected item's label when value is set externally
        if (!isSearchMode) {
          setSearch(foundItem.label);
          searchRef.current = foundItem.label;
        }
      } else {
        setSelectedItem(null);
        setActiveIndex(0);
      }
    } else {
      // Nothing selected - start at -1 (like SearchableSelect)
      setSelectedItem(null);
      setActiveIndex(-1);
      if (!isSearchMode) {
        setSearch("");
        searchRef.current = "";
      }
    }
  }, [value, normalizedData, isSearchMode]);

  // Reset active index when filtered data changes
  useEffect(() => {
    if (searchable && isSearchMode && filteredData.length > 0) {
      // Reset active index to first item on fresh filtered data
      setActiveIndex(0);
    }
  }, [filteredData, searchable, isSearchMode]);

  const handleSearchChange = (val: string) => {
    searchRef.current = val;
    setSearch(val);

    if (!val.trim()) {
      // User cleared the search
      setSelectedItem(null);
      setIsSearchMode(false);
      setActiveIndex(-1);
      if (onChange) {
        (onChange as (value: string | null, option?: unknown) => void)(
          null,
          null
        );
      }
    } else {
      // User is typing - check if they're modifying a selected item or searching fresh
      if (selectedItem && val !== selectedItem.label) {
        // User is modifying the selected item's text - enter search mode
        setIsSearchMode(true);
        setSelectedItem(null);
      } else if (!selectedItem) {
        // User is typing fresh search
        setIsSearchMode(true);
      }
      // Reset active index when searching new term
      setActiveIndex(0);
      // If val === selectedItem.label, don't enter search mode (user just focused on selected item)
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const list = displayData;

    if (e.key === "ArrowDown" && list.length > 0) {
      // Similar to SearchableSelect: track activeIndex as one ahead of visual highlight
      e.preventDefault();
      setActiveIndex((prev) => {
        const next = prev < 0 ? 0 : Math.min(prev + 1, list.length - 1);
        return next;
      });
    } else if (e.key === "ArrowUp" && list.length > 0) {
      // Similar to SearchableSelect
      e.preventDefault();
      setActiveIndex((prev) => {
        const next = prev <= 0 ? 0 : prev - 1;
        return next;
      });
    } else if (e.key === "Home" && list.length > 0) {
      e.preventDefault();
      setActiveIndex(list.length > 0 ? 0 : -1);
    } else if (e.key === "End" && list.length > 0) {
      e.preventDefault();
      setActiveIndex(list.length > 0 ? list.length - 1 : -1);
    } else if (e.key === "Tab") {
      // Check if a value is already selected
      const hasValue = value && value !== "";

      // If value is already selected, allow normal Tab behavior (don't prevent default)
      if (hasValue || selectedItem) {
        // Value is selected - allow normal Tab navigation
        // Don't prevent default, let browser handle Tab normally
        return;
      }

      // No value selected - prevent default and auto-select first/active option
      e.preventDefault();

      if (Array.isArray(list) && list.length > 0) {
        // Use SearchableSelect's logic: if nothing selected and activeIndex >= 0, select active option
        if (!selectedItem && activeIndex >= 0) {
          // SearchableSelect uses: idx = activeIndex > 0 ? activeIndex - 1 : 0
          // This is because activeIndex is tracked one ahead of what's visually highlighted
          const idx = activeIndex > 0 ? activeIndex - 1 : 0;
          const active = list[idx];
          if (active) {
            // Select the active option
            setSelectedItem(active);
            setSearch(active.label);
            searchRef.current = active.label;
            setIsSearchMode(false);

            if (onChange) {
              // Mantine's onChange accepts optional second parameter (option)
              (onChange as (value: string | null, option?: unknown) => void)(
                active.value,
                active
              );
            }

            // Close the dropdown and move to next field
            requestAnimationFrame(() => {
              const input = e.target as HTMLInputElement;
              if (input) {
                // Close dropdown first
                input.blur();

                // Then find and focus the next focusable element
                setTimeout(() => {
                  const allFocusable = Array.from(
                    document.querySelectorAll(
                      'input:not([disabled]):not([type="hidden"]), ' +
                        "select:not([disabled]), " +
                        "textarea:not([disabled]), " +
                        "button:not([disabled]), " +
                        '[tabindex]:not([tabindex="-1"]):not([disabled])'
                    )
                  ).filter((el) => {
                    const rect = el.getBoundingClientRect();
                    return rect.width > 0 && rect.height > 0;
                  }) as HTMLElement[];

                  const currentIdx = allFocusable.indexOf(input);
                  if (currentIdx >= 0 && currentIdx < allFocusable.length - 1) {
                    const nextElement = allFocusable[currentIdx + 1];
                    if (nextElement) {
                      nextElement.focus();
                    }
                  }
                }, 50);
              }
            });
            return; // Exit early since we handled the selection
          }
        } else if (!selectedItem) {
          // No active option selected, select first item from list (overall or filtered)
          const firstOption = list[0];
          if (firstOption) {
            setSelectedItem(firstOption);
            setSearch(firstOption.label);
            searchRef.current = firstOption.label;
            setIsSearchMode(false);

            if (onChange) {
              // Mantine's onChange accepts optional second parameter (option)
              (onChange as (value: string | null, option?: unknown) => void)(
                firstOption.value,
                firstOption
              );
            }

            // Close the dropdown and move to next field
            requestAnimationFrame(() => {
              const input = e.target as HTMLInputElement;
              if (input) {
                input.blur();
                setTimeout(() => {
                  const allFocusable = Array.from(
                    document.querySelectorAll(
                      'input:not([disabled]):not([type="hidden"]), ' +
                        "select:not([disabled]), " +
                        "textarea:not([disabled]), " +
                        "button:not([disabled]), " +
                        '[tabindex]:not([tabindex="-1"]):not([disabled])'
                    )
                  ).filter((el) => {
                    const rect = el.getBoundingClientRect();
                    return rect.width > 0 && rect.height > 0;
                  }) as HTMLElement[];

                  const currentIdx = allFocusable.indexOf(input);
                  if (currentIdx >= 0 && currentIdx < allFocusable.length - 1) {
                    const nextElement = allFocusable[currentIdx + 1];
                    if (nextElement) {
                      nextElement.focus();
                    }
                  }
                }, 50);
              }
            });
            return; // Exit early
          }
        }
      }
      // If no option to select, don't prevent Tab - allow normal navigation
    }
  };

  const handleChange = (val: string | null) => {
    if (val) {
      // Find the selected item and set its label as search text
      const foundItem = displayData.find((item) => item.value === val);
      if (foundItem) {
        setSelectedItem(foundItem);
        setSearch(foundItem.label);
        setIsSearchMode(false); // Exit search mode
        searchRef.current = foundItem.label;

        if (onChange) {
          // Mantine's onChange accepts optional second parameter (option)
          (onChange as (value: string | null, option?: unknown) => void)(
            val,
            foundItem
          );
        }
      } else {
        if (onChange) {
          (onChange as (value: string | null, option?: unknown) => void)(
            val,
            null
          ); // Pass just value if no item found
        }
      }
    } else {
      setSelectedItem(null);
      setSearch("");
      setIsSearchMode(false);
      searchRef.current = "";
      if (onChange) {
        (onChange as (value: string | null, option?: unknown) => void)(
          null,
          null
        ); // Pass null
      }
    }
  };

  const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    // Auto-select all text when input is focused
    const input = event.target as HTMLInputElement;
    if (input && input.value) {
      input.select();
    }

    // When focused, ensure the selected item is visible in dropdown
    if (selectedItem) {
      // Always ensure the selected item is in the data array
      const hasSelectedItem = displayData.some(
        (item) => item.value === selectedItem.value
      );
      if (!hasSelectedItem && !searchable) {
        // For non-searchable, ensure selected item is visible
        // This is handled by normalizedData already
      }
    }

    // Reset active index when focus happens
    if (selectedItem) {
      const idx = normalizedData.findIndex(
        (o) => o.value === selectedItem.value
      );
      setActiveIndex(idx >= 0 ? idx + 1 : 0);
    } else {
      setActiveIndex(-1);
    }
  };

  const handleBlur = () => {
    // On blur, if nothing selected, auto-select the active option
    // Use the same logic as SearchableSelect
    if (!selectedItem && displayData.length > 0) {
      // Use SearchableSelect's logic: idx = activeIndex > 0 ? activeIndex - 1 : 0
      const idx = activeIndex > 0 ? activeIndex - 1 : 0;
      const pick = displayData[idx] ?? displayData[0];
      if (pick) {
        handleChange(pick.value); // This will set selectedItem, search, etc.
        setSearch(pick.label); // Immediately update the input with label
        setIsSearchMode(false);
        return;
      }
    }
    // Previous logic - ensure search text shows selected label:
    if (selectedItem && search !== selectedItem.label) {
      setSearch(selectedItem.label);
      setIsSearchMode(false);
    }
  };

  return (
    <Select
      {...props}
      data={displayData}
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      onBlur={handleBlur}
      searchable={searchable}
      searchValue={search}
      onSearchChange={handleSearchChange}
    />
  );
}
