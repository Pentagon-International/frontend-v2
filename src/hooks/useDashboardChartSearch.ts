import { useEffect, useState } from "react";
import { useListFilterStore } from "../store/listFilterStore";

const STORE_KEY = "dashboard:chart-search";

/**
 * Persisted "dashboard chart search" value.
 * - Shared across dashboard + inner chart pages
 * - Preserved until explicitly cleared
 */
export function useDashboardChartSearch() {
  const committed = useListFilterStore(
    (s) => s.registry[STORE_KEY]?.search ?? ""
  );
  const setSearch = useListFilterStore((s) => s.setSearch);

  const [input, setInput] = useState(committed);

  useEffect(() => {
    setInput(committed);
  }, [committed]);

  const commit = (next: string) => {
    const v = String(next || "").trim();
    setSearch(STORE_KEY, v);
    setInput(v);
  };

  const clear = () => {
    setSearch(STORE_KEY, "");
    setInput("");
  };

  return { input, setInput, committed, commit, clear };
}

