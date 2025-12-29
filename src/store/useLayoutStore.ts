import { create } from "zustand";

interface LayoutState {
  title: string;
  setTitle: (title: string) => void;

  activeNav: string;
  setActiveNav: (nav: string) => void;

  activeSubNav: string;
  setActiveSubNav: (subNav: string) => void;

  activeTariffSubNav: string;
  setActiveTariffSubNav: (tariffSubNav: string) => void;

  activeCustomerServiceSubNav: string;
  setActiveCustomerServiceSubNav: (customerServiceSubNav: string) => void;

  isSidebarCollapsed: Boolean;
  setIsSidebarCollapsed: (sideBarCollapsed: boolean) => void;

  openCollapsibles: Record<string, boolean>;
  setOpenCollapsible: (key: string, open: boolean) => void;
  resetOpenCollapsibles: () => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  title: "", // default title
  setTitle: (title) => set({ title }),

  activeNav: "",
  setActiveNav: (nav) => set({ activeNav: nav }),

  activeSubNav: "",
  setActiveSubNav: (subNav) => set({ activeSubNav: subNav }),

  activeTariffSubNav: "",
  setActiveTariffSubNav: (tariffSubNav) =>
    set({ activeTariffSubNav: tariffSubNav }),

  activeCustomerServiceSubNav: "",
  setActiveCustomerServiceSubNav: (customerServiceSubNav) =>
    set({ activeCustomerServiceSubNav: customerServiceSubNav }),

  isSidebarCollapsed: false,
  setIsSidebarCollapsed: (sideBarCollapsed: Boolean) =>
    set({ isSidebarCollapsed: sideBarCollapsed }),

  openCollapsibles: {},
  setOpenCollapsible: (key, open) =>
    set((s) => ({ openCollapsibles: { ...s.openCollapsibles, [key]: open } })),
  resetOpenCollapsibles: () => set({ openCollapsibles: {} }),
}));
