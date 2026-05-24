import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader, Select } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import {
  branchMasterToSelectOption,
  fetchBranchMasterList,
} from "../collectionBranchMasterApi";
import { COL_LINE } from "../theme";

const BRANCH_PAGE_LIMIT = 25;

const selectStyles = {
  input: {
    height: 32,
    minHeight: 32,
    borderColor: COL_LINE,
    fontSize: 12,
    fontWeight: 500,
    width: 200,
  },
} as const;

type CollectionBranchFilterSelectProps = {
  value: string | null;
  onChange: (value: string | null) => void;
};

export function CollectionBranchFilterSelect({
  value,
  onChange,
}: CollectionBranchFilterSelectProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 400);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);

  const loadBranches = useCallback(async (searchTerm: string) => {
    setLoading(true);
    try {
      const rows = await fetchBranchMasterList({
        index: 0,
        limit: BRANCH_PAGE_LIMIT,
        search: searchTerm.trim() || undefined,
      });
      setOptions(rows.map(branchMasterToSelectOption).filter((o) => o.value));
    } catch {
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBranches("");
  }, [loadBranches]);

  useEffect(() => {
    if (debouncedSearch.trim().length < 2) {
      if (!search.trim()) void loadBranches("");
      return;
    }
    void loadBranches(debouncedSearch);
  }, [debouncedSearch, loadBranches, search]);

  const selectData = useMemo(
    () => [{ value: "", label: "All branches" }, ...options],
    [options],
  );

  return (
    <Select
      size="xs"
      searchable
      clearable
      placeholder="All branches"
      data={selectData}
      value={value ?? ""}
      searchValue={search}
      onSearchChange={setSearch}
      onChange={(next) => onChange(next?.trim() ? next : null)}
      filter={({ options }) => options}
      rightSection={loading ? <Loader size={14} /> : undefined}
      nothingFoundMessage={loading ? "Loading…" : "No branches found"}
      comboboxProps={{ withinPortal: true }}
      styles={selectStyles}
    />
  );
}
