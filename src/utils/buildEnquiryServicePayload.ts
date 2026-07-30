import { roundToDecimals } from "./numberInputUtils";
import {
  isOtherServiceInland,
  resolveEffectiveServiceType,
  usesAirCargoStructure,
  type OtherServiceOption,
} from "./otherServiceType";

type CargoDetail = {
  id?: number | string | null;
  hazardous_cargo?: string | boolean | null;
  stackable?: string | boolean | null;
  un_no?: string | null;
  class?: string | null;
  class_name?: string | null;
  pkg_group?: string | null;
  no_of_packages?: number | string | null;
  gross_weight?: number | string | null;
  volume_weight?: number | string | null;
  chargable_weight?: number | string | null;
  volume?: number | string | null;
  chargable_volume?: number | string | null;
  container_type_code?: string | null;
  container_type?: string | null;
  no_of_containers?: number | string | null;
};

type DimensionRow = {
  id?: number | string | null;
  pieces?: number | string | null;
  length?: number | string | null;
  width?: number | string | null;
  height?: number | string | null;
  value?: number | string | null;
  vol_weight?: number | string | null;
};

export type EnquiryServiceDetailInput = {
  id?: number | string | null;
  service?: string;
  trade?: string | null;
  service_code?: string | null;
  service_name?: string | null;
  origin_code?: string | null;
  origin_code_read?: string | null;
  destination_code?: string | null;
  destination_code_read?: string | null;
  pickup?: string | boolean | null;
  delivery?: string | boolean | null;
  pickup_location?: string | null;
  delivery_location?: string | null;
  hazardous_cargo?: string | boolean | null;
  shipment_terms_code?: string | null;
  shipment_terms_code_read?: string | null;
  icd?: string | null;
  service_remark?: string | null;
  commodity?: string | null;
  dimension_unit?: string | null;
  diemensions?: DimensionRow[] | null;
  cargo_details?: CargoDetail[] | null;
  fcl_details?: CargoDetail[] | null;
};

function isTruthyFlag(value: string | boolean | null | undefined): boolean {
  return value === true || value === "true" || value === "Yes";
}

/**
 * Builds one enquiry `services[]` entry matching EnquiryCreate.getEnquiryPayload.
 */
export function buildEnquiryServicePayload(
  serviceDetail: EnquiryServiceDetailInput,
  otherServicesData: OtherServiceOption[] = [],
  options?: { includeId?: boolean },
): Record<string, unknown> {
  const cargoList = Array.isArray(serviceDetail.cargo_details)
    ? serviceDetail.cargo_details
    : [];
  const cargo = cargoList[0];
  const hazardous =
    isTruthyFlag(cargo?.hazardous_cargo) ||
    isTruthyFlag(serviceDetail.hazardous_cargo);

  const servicePayload: Record<string, unknown> = {
    service: serviceDetail.service,
    origin_code:
      serviceDetail.origin_code || serviceDetail.origin_code_read || "",
    destination_code:
      serviceDetail.destination_code ||
      serviceDetail.destination_code_read ||
      "",
    pickup: isTruthyFlag(serviceDetail.pickup),
    delivery: isTruthyFlag(serviceDetail.delivery),
    pickup_location: serviceDetail.pickup_location || "",
    delivery_location: serviceDetail.delivery_location || "",
    hazardous_cargo: hazardous,
    stackable: cargo?.stackable === "Yes" || cargo?.stackable === true,
    shipment_terms_code:
      serviceDetail.shipment_terms_code ||
      serviceDetail.shipment_terms_code_read ||
      "",
    icd: serviceDetail.icd || "",
    service_remark: serviceDetail.service_remark || "",
    commodity: serviceDetail.commodity || "",
  };

  servicePayload.un_no = hazardous ? cargo?.un_no || null : null;
  servicePayload.class_name = hazardous
    ? cargo?.class || cargo?.class_name || null
    : null;
  servicePayload.pkg_group = hazardous ? cargo?.pkg_group || null : null;

  if (serviceDetail.service === "OTHERS") {
    servicePayload.service_name = serviceDetail.service_name || "";
    servicePayload.service_code = serviceDetail.service_code || "";
    servicePayload.trade = isOtherServiceInland(
      serviceDetail.service_code,
      otherServicesData,
    )
      ? serviceDetail.trade || null
      : null;
  } else {
    servicePayload.trade = serviceDetail.trade || null;
  }

  if (options?.includeId && serviceDetail.id) {
    servicePayload.id = serviceDetail.id;
  }

  const effectiveServiceType = resolveEffectiveServiceType(
    serviceDetail.service || "",
    serviceDetail.service_code,
    otherServicesData,
  );

  if (effectiveServiceType === "FCL") {
    const fclData =
      (Array.isArray(serviceDetail.fcl_details) && serviceDetail.fcl_details.length
        ? serviceDetail.fcl_details
        : cargoList) || [];
    servicePayload.fcl_details = fclData.map((row) => {
      const fclDetail: Record<string, unknown> = {
        container_type: row.container_type || row.container_type_code,
        no_of_containers: Math.trunc(Number(row.no_of_containers) || 0),
        gross_weight: roundToDecimals(row.gross_weight, 3) ?? 0,
      };
      if (row.id) fclDetail.id = row.id;
      return fclDetail;
    });
  } else if (usesAirCargoStructure(effectiveServiceType)) {
    servicePayload.no_of_packages = Math.trunc(
      Number(cargo?.no_of_packages) || 0,
    );
    servicePayload.gross_weight = roundToDecimals(cargo?.gross_weight, 3) ?? 0;
    servicePayload.volume_weight =
      roundToDecimals(cargo?.volume_weight, 3) ?? 0;
    servicePayload.chargeable_weight =
      roundToDecimals(cargo?.chargable_weight, 3) ?? 0;
    const dimUnit = serviceDetail.dimension_unit || "";
    const dimRows = Array.isArray(serviceDetail.diemensions)
      ? serviceDetail.diemensions
      : [];
    if (dimUnit && dimRows.length > 0) {
      servicePayload.dimension_details = dimRows.map((r) => {
        const dimensionItem: Record<string, unknown> = {
          pieces: Math.trunc(Number(r?.pieces) || 0),
          length: roundToDecimals(r?.length, 2) ?? 0,
          width: roundToDecimals(r?.width, 2) ?? 0,
          height: roundToDecimals(r?.height, 2) ?? 0,
          value: roundToDecimals(Number(r?.value) || 0, 2) ?? 0,
          volume_weight: roundToDecimals(r?.vol_weight, 3) ?? 0,
          dimension_unit: dimUnit,
        };
        if (r?.id) dimensionItem.id = r.id;
        return dimensionItem;
      });
    }
  } else if (effectiveServiceType === "LCL") {
    servicePayload.no_of_packages = Math.trunc(
      Number(cargo?.no_of_packages) || 0,
    );
    servicePayload.gross_weight = roundToDecimals(cargo?.gross_weight, 3) ?? 0;
    servicePayload.volume = roundToDecimals(cargo?.volume, 3) ?? 0;
    servicePayload.chargeable_volume =
      roundToDecimals(cargo?.chargable_volume, 3) ?? 0;
    const dimUnit = serviceDetail.dimension_unit || "";
    const dimRows = Array.isArray(serviceDetail.diemensions)
      ? serviceDetail.diemensions
      : [];
    if (dimUnit && dimRows.length > 0) {
      servicePayload.dimension_details = dimRows.map((r) => {
        const dimensionItem: Record<string, unknown> = {
          pieces: Math.trunc(Number(r?.pieces) || 0),
          length: roundToDecimals(r?.length, 2) ?? 0,
          width: roundToDecimals(r?.width, 2) ?? 0,
          height: roundToDecimals(r?.height, 2) ?? 0,
          value: roundToDecimals(Number(r?.value) || 0, 2) ?? 0,
          volume_weight: roundToDecimals(r?.vol_weight, 3) ?? 0,
          dimension_unit: dimUnit,
        };
        if (r?.id) dimensionItem.id = r.id;
        return dimensionItem;
      });
    }
  }

  return servicePayload;
}
