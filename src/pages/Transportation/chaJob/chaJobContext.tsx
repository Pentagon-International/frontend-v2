import { createContext, useContext, type ReactNode } from "react";
import type { ChaJobConfig } from "./chaJobConfig";

const ChaJobContext = createContext<ChaJobConfig | null>(null);

export function ChaJobProvider({
  config,
  children,
}: {
  config: ChaJobConfig;
  children: ReactNode;
}) {
  return (
    <ChaJobContext.Provider value={config}>{children}</ChaJobContext.Provider>
  );
}

export function useChaJobConfig(): ChaJobConfig | null {
  return useContext(ChaJobContext);
}

export function useJobModulePaths(defaults: {
  basePath: string;
  invoiceServiceType: string | string[];
  listKey: string;
}) {
  const cha = useChaJobConfig();
  return {
    isChaMode: Boolean(cha),
    basePath: cha?.basePath ?? defaults.basePath,
    invoiceServiceType: cha?.invoiceServiceType ?? defaults.invoiceServiceType,
    listKey: cha?.listKey ?? defaults.listKey,
    chaConfig: cha,
  };
}
