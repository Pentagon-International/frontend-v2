import { create } from "zustand";

type FilterState = Record<string, any>;

type ListFilterState = {
  filters: FilterState;
  search: string;
  shouldRestore?: boolean; // ✅ NEW (optional, backward safe)
};

type ListFilterStore = {
  registry: Record<string, ListFilterState>;

  setFilters: (key: string, filters: FilterState) => void;
  setSearch: (key: string, search: string) => void;

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
          filters,
          search: state.registry[key]?.search || "",
          shouldRestore: state.registry[key]?.shouldRestore ?? false,
        },
      },
    }));
  },

  setSearch: (key, search) => {
    set((state) => ({
      registry: {
        ...state.registry,
        [key]: {
          filters: state.registry[key]?.filters || {},
          search,
          shouldRestore: state.registry[key]?.shouldRestore ?? false,
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
          filters: state.registry[key]?.filters || {},
          search: state.registry[key]?.search || "",
          shouldRestore: value,
        },
      },
    }));
  },

  getState: (key) => {
    return get().registry[key] || null;
  },
}));
