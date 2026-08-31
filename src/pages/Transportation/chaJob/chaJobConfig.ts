export type ChaJobVariant =
  | "air-import"
  | "air-export"
  | "ocean-import"
  | "ocean-export";

export type ChaJobConfig = {
  variant: ChaJobVariant;
  basePath: string;
  listKey: string;
  pageTitle: string;
  /** Sidebar label under the CHA module */
  navLabel: string;
  /** Unique layout-store key (avoids collision with Air/Ocean job nav labels) */
  activeSubNavKey: string;
  /** CHA service master codes (81–86) scoped to this page */
  serviceCodes: string[];
  serviceType: "Import" | "Export";
  transportMode: "AIR" | "SEA";
  invoiceServiceType: string | string[];
};

export const CHA_SERVICE_CODES = ["81", "82", "83", "84", "85", "86"] as const;

export const CHA_AIR_IMPORT_CONFIG: ChaJobConfig = {
  variant: "air-import",
  basePath: "/cha/air-import-job",
  listKey: "CHA_AIR_IMPORT_JOB_MASTER",
  pageTitle: "CHA Air Import Job",
  navLabel: "Air Import Job",
  activeSubNavKey: "CHA Air Import Job",
  serviceCodes: ["83"],
  serviceType: "Import",
  transportMode: "AIR",
  invoiceServiceType: "AIR",
};

export const CHA_AIR_EXPORT_CONFIG: ChaJobConfig = {
  variant: "air-export",
  basePath: "/cha/air-export-job",
  listKey: "CHA_AIR_EXPORT_JOB_MASTER",
  pageTitle: "CHA Air Export Job",
  navLabel: "Air Export Job",
  activeSubNavKey: "CHA Air Export Job",
  serviceCodes: ["86"],
  serviceType: "Export",
  transportMode: "AIR",
  invoiceServiceType: "AIR",
};

export const CHA_OCEAN_IMPORT_CONFIG: ChaJobConfig = {
  variant: "ocean-import",
  basePath: "/cha/ocean-import-job",
  listKey: "CHA_OCEAN_IMPORT_JOB_MASTER",
  pageTitle: "CHA Ocean Import Job",
  navLabel: "Ocean Import Job",
  activeSubNavKey: "CHA Ocean Import Job",
  serviceCodes: ["81", "82"],
  serviceType: "Import",
  transportMode: "SEA",
  invoiceServiceType: ["FCL", "LCL"],
};

export const CHA_OCEAN_EXPORT_CONFIG: ChaJobConfig = {
  variant: "ocean-export",
  basePath: "/cha/ocean-export-job",
  listKey: "CHA_OCEAN_EXPORT_JOB_MASTER",
  pageTitle: "CHA Ocean Export Job",
  navLabel: "Ocean Export Job",
  activeSubNavKey: "CHA Ocean Export Job",
  serviceCodes: ["84", "85"],
  serviceType: "Export",
  transportMode: "SEA",
  invoiceServiceType: ["FCL", "LCL"],
};
