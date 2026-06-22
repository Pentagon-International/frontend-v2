export type EffectiveServiceType = "AIR" | "FCL" | "LCL" | "INLAND";

export type OtherServiceOption = {
  value: string;
  label?: string;
  transport_mode?: string;
  full_groupage?: string;
};

export function resolveEffectiveServiceFromTransport(
  transportMode: string,
  fullGroupage: string,
): EffectiveServiceType {
  if (transportMode === "SEA" && fullGroupage === "FULL") return "FCL";
  if (transportMode === "SEA" && fullGroupage === "GROUPAGE") return "LCL";
  if (transportMode === "NA") return "INLAND";
  return "AIR";
}

export function findOtherService(
  otherServicesData: OtherServiceOption[],
  serviceCode: string,
): OtherServiceOption | undefined {
  return otherServicesData.find((item) => item.value === serviceCode);
}

export function resolveEffectiveServiceType(
  service: string,
  serviceCode: string | undefined | null,
  otherServicesData: OtherServiceOption[],
): string {
  if (service === "OTHERS" && serviceCode) {
    const selected = findOtherService(otherServicesData, serviceCode);
    if (selected) {
      return resolveEffectiveServiceFromTransport(
        selected.transport_mode || "",
        selected.full_groupage || "",
      );
    }
  }
  return service;
}

export function isOtherServiceInland(
  serviceCode: string | undefined | null,
  otherServicesData: OtherServiceOption[],
): boolean {
  if (!serviceCode) return false;
  const selected = findOtherService(otherServicesData, serviceCode);
  return (selected?.transport_mode || "") === "NA";
}

export function usesAirCargoStructure(effectiveServiceType: string): boolean {
  return effectiveServiceType === "AIR" || effectiveServiceType === "INLAND";
}

export function getBookingCreatePath(
  serviceType: string,
  trade: string | null | undefined,
  options?: {
    serviceCode?: string;
    otherServicesData?: OtherServiceOption[];
  },
): string | null {
  const { serviceCode, otherServicesData = [] } = options || {};

  if (
    serviceType === "OTHERS" &&
    serviceCode &&
    isOtherServiceInland(serviceCode, otherServicesData)
  ) {
    if (trade === "Export") return "/inland/export-booking/create";
    if (trade === "Import") return "/inland/import-booking/create";
    return null;
  }

  if (serviceType === "AIR") {
    if (trade === "Export") return "/air/export-booking/create";
    if (trade === "Import") return "/air/import-booking/create";
    return null;
  }

  if (serviceType === "FCL" || serviceType === "LCL") {
    if (trade === "Export") return "/SeaExport/export-booking/create";
    if (trade === "Import") return "/SeaExport/import-booking/create";
    return null;
  }

  return null;
}
