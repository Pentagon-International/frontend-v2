import { create } from "zustand";

type FilterState = Record<string, any>;

type DisplayValues = Record<string, string | null>;

type ListFilterState = {
  filters: FilterState;
  search: string;
  shouldRestore?: boolean;
  /** Labels for SearchableSelect fields (e.g. origin_code -> "Chennai (INMAA)") so UI shows label after restore */
  displayValues?: DisplayValues;
};

type ListFilterStore = {
  registry: Record<string, ListFilterState>;

  setFilters: (key: string, filters: FilterState) => void;
  setSearch: (key: string, search: string) => void;
  setDisplayValues: (key: string, displayValues: DisplayValues) => void;

  clearFilters: (key: string) => void;
  clearSearch: (key: string) => void;
  clearAll: (key: string) => void;
  clearAllExcept: (key: string) => void;

  // ✅ NEW (added, no rename)
  setShouldRestore: (key: string, value: boolean) => void;

  getState: (key: string) => ListFilterState | null;
};

export const useListFilterStore = create<ListFilterStore>((set, get) => ({
  registry: {},

  setFilters: (key, filters) => {
    set((state) => ({
      registry: {
        ...state.registry,
        [key]: {
          ...state.registry[key],
          filters,
        },
      },
    }));
  },

  setDisplayValues: (key, displayValues) => {
    set((state) => ({
      registry: {
        ...state.registry,
        [key]: {
          ...state.registry[key],
          displayValues,
        },
      },
    }));
  },

  setSearch: (key, search) => {
    set((state) => ({
      registry: {
        ...state.registry,
        [key]: {
          ...state.registry[key],
          search,
        },
      },
    }));
  },

  clearFilters: (key) => {
    set((state) => ({
      registry: {
        ...state.registry,
        [key]: {
          filters: {},
          search: state.registry[key]?.search || "",
          shouldRestore: false,
          displayValues: state.registry[key]?.displayValues,
        },
      },
    }));
  },

  clearSearch: (key) => {
    set((state) => ({
      registry: {
        ...state.registry,
        [key]: {
          filters: state.registry[key]?.filters || {},
          search: "",
          shouldRestore: false,
          displayValues: state.registry[key]?.displayValues,
        },
      },
    }));
  },

  clearAll: (key) => {
    set((state) => {
      const newRegistry = { ...state.registry };
      delete newRegistry[key];
      return { registry: newRegistry };
    });
  },

  clearAllExcept: (key) => {
    set((state) => {
      const newRegistry: Record<string, ListFilterState> = {};
      if (state.registry[key]) {
        newRegistry[key] = state.registry[key];
      }
      return { registry: newRegistry };
    });
  },

  // ✅ NEW METHOD (does not affect existing code)
  setShouldRestore: (key, value) => {
    set((state) => ({
      registry: {
        ...state.registry,
        [key]: {
          ...state.registry[key],
          shouldRestore: value,
        },
      },
    }));
  },

  getState: (key) => {
    return get().registry[key] || null;
  },
}));
