import { useRef, useEffect, useMemo, useState } from "react";
import { Select, SelectProps } from "@mantine/core";

type DropdownProps = Omit<
  SelectProps,
  "onKeyDown" | "onFocus" | "onBlur" | "onSearchChange" | "searchValue"
> & {
  searchable?: boolean;
  dropdownZIndex?: number;
  styles?: Record<string, any>; // SAME API as SearchableSelect
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
  dropdownZIndex = 5,
  styles,
  ...props
}: DropdownProps) {
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [selectedItem, setSelectedItem] = useState<NormalizedItem | null>(null);
  const [search, setSearch] = useState("");
  const [isSearchMode, setIsSearchMode] = useState(false);
  const searchRef = useRef<string>("");

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

  const filteredData = useMemo<NormalizedItem[]>(() => {
    if (!searchable || !search.trim() || !isSearchMode) {
      return normalizedData;
    }

    const searchLower = search.toLowerCase().trim();
    return normalizedData.filter((item) => {
      const labelMatch = item.label.toLowerCase().includes(searchLower);
      const valueMatch = item.value.toLowerCase().includes(searchLower);
      return labelMatch || valueMatch;
    });
  }, [normalizedData, search, searchable, isSearchMode]);

  const displayData = searchable ? filteredData : normalizedData;

  useEffect(() => {
    if (value && normalizedData.length > 0) {
      const foundItem = normalizedData.find((item) => item.value === value);
      if (foundItem) {
        setSelectedItem(foundItem);
        const currentIndex = normalizedData.findIndex(
          (item) => item.value === value
        );
        setActiveIndex(currentIndex >= 0 ? currentIndex + 1 : 0);

        if (!isSearchMode) {
          setSearch(foundItem.label);
          searchRef.current = foundItem.label;
        }
      } else {
        setSelectedItem(null);
        setActiveIndex(0);
      }
    } else {
      setSelectedItem(null);
      setActiveIndex(-1);
      if (!isSearchMode) {
        setSearch("");
        searchRef.current = "";
      }
    }
  }, [value, normalizedData, isSearchMode]);

  useEffect(() => {
    if (searchable && isSearchMode && filteredData.length > 0) {
      setActiveIndex(0);
    }
  }, [filteredData, searchable, isSearchMode]);

  const handleSearchChange = (val: string) => {
    searchRef.current = val;
    setSearch(val);

    if (!val.trim()) {
      setSelectedItem(null);
      setIsSearchMode(false);
      setActiveIndex(-1);
      onChange?.(null, null);
    } else {
      if (selectedItem && val !== selectedItem.label) {
        setIsSearchMode(true);
        setSelectedItem(null);
      } else if (!selectedItem) {
        setIsSearchMode(true);
      }
      setActiveIndex(0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const list = displayData;

    if (e.key === "ArrowDown" && list.length > 0) {
      e.preventDefault();
      setActiveIndex((prev) => {
        const next = prev < 0 ? 0 : Math.min(prev + 1, list.length - 1);
        return next;
      });
    } else if (e.key === "ArrowUp" && list.length > 0) {
      e.preventDefault();
      setActiveIndex((prev) => {
        const next = prev <= 0 ? 0 : prev - 1;
        return next;
      });
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIndex(list.length - 1);
    }
  };

  const handleChange = (val: string | null) => {
    if (val) {
      const foundItem = displayData.find((item) => item.value === val);
      if (foundItem) {
        setSelectedItem(foundItem);
        setSearch(foundItem.label);
        setIsSearchMode(false);
        searchRef.current = foundItem.label;
        onChange?.(val, foundItem);
      } else {
        onChange?.(val, null);
      }
    } else {
      setSelectedItem(null);
      setSearch("");
      setIsSearchMode(false);
      searchRef.current = "";
      onChange?.(null, null);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    const input = e.target as HTMLInputElement;
    if (input && input.value) input.select();

    if (selectedItem) {
      const idx = normalizedData.findIndex(
        (item) => item.value === selectedItem.value
      );
      setActiveIndex(idx >= 0 ? idx + 1 : 0);
    } else {
      setActiveIndex(-1);
    }
  };

  const handleBlur = () => {
    if (!selectedItem && displayData.length > 0) {
      const idx = activeIndex > 0 ? activeIndex - 1 : 0;
      const pick = displayData[idx] ?? displayData[0];
      handleChange(pick.value);
      setSearch(pick.label);
      setIsSearchMode(false);
      return;
    }
    if (selectedItem && search !== selectedItem.label) {
      setSearch(selectedItem.label);
      setIsSearchMode(false);
    }
  };

  return (
    <Select
      {...props}
      comboboxProps={{ zIndex: dropdownZIndex }}
      styles={{
        input: {
          fontSize: "13px",
          height: "36px",
          fontFamily: "Inter",
          ...styles?.input,
        },
        label: {
          fontSize: "13px",
          fontWeight: 500,
          color: "#424242",
          marginBottom: "4px",
          fontFamily: "Inter",
          fontStyle: "medium",
          ...styles?.label,
        },
        ...styles,
      }}
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
