import { useEffect, useMemo, useState } from "react";
import {
  ActionIcon,
  Autocomplete,
  Group,
  type AutocompleteProps,
  Loader,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconSearch, IconX } from "@tabler/icons-react";
import { getAPICall } from "../service/getApiCall";
import { API_HEADER } from "../store/storeKeys";

type Props = {
  value: string;
  onChange: (next: string) => void;
  onCommit: (selected: string) => void;
  onClear?: () => void;
  placeholder?: string;
  size?: AutocompleteProps["size"];
  styles?: AutocompleteProps["styles"];
};

/**
 * Dashboard "customer/salesperson" search box used across chart pages.
 * Uses `combined-data/?search=` suggestions (same as DashboardMaster).
 */
export function DashboardChartSearch({
  value,
  onChange,
  onCommit,
  onClear,
  placeholder = "Search customer or salesperson",
  size = "xs",
  styles,
}: Props) {
  const [dropdownOptions, setDropdownOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [debounced] = useDebouncedValue(value, 400);

  const data = useMemo(() => dropdownOptions, [dropdownOptions]);

  useEffect(() => {
    const q = debounced.trim();
    if (q.length < 2) {
      setDropdownOptions([]);
      return;
    }
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const response = await getAPICall(
          `combined-data/?search=${encodeURIComponent(q)}`,
          API_HEADER
        );
        if (cancelled) return;
        const arr =
          response && typeof response === "object" && "data" in response
            ? Array.isArray((response as { data?: unknown }).data)
              ? ((response as { data?: unknown[] }).data as unknown[])
              : []
            : [];
        const options = arr
          .map((item) => {
            const r = item as Record<string, unknown>;
            return (r.user_name || r.customer_name || "") as string;
          })
          .map((s) => String(s || "").trim())
          .filter(Boolean);
        setDropdownOptions(options);
      } catch {
        if (!cancelled) setDropdownOptions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  return (
    <Autocomplete
      value={value}
      onChange={onChange}
      data={data}
      placeholder={placeholder}
      size={size}
      leftSection={<IconSearch size={14} />}
      rightSectionWidth={value.trim() ? 68 : 32}
      rightSection={
        <Group gap={4} wrap="nowrap">
          {value.trim() ? (
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              aria-label="Clear search"
              onClick={() => {
                onChange("");
                onCommit("");
                onClear?.();
              }}
            >
              <IconX size={14} />
            </ActionIcon>
          ) : null}
          {loading ? <Loader size={14} /> : null}
        </Group>
      }
      onOptionSubmit={(v) => {
        const selected = String(v || "").trim();
        onChange(selected);
        if (selected) onCommit(selected);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          const selected = value.trim();
          if (selected) onCommit(selected);
        }
        if (e.key === "Escape") {
          onChange("");
          onCommit("");
          onClear?.();
        }
      }}
      styles={styles}
      maxDropdownHeight={240}
    />
  );
}

