import {
  findOtherService,
  getBookingCreatePath,
  isChaServiceCode,
  isOtherServiceInland,
  resolveEffectiveServiceFromTransport,
  type OtherServiceOption,
} from "./otherServiceType";

export type QuotationCreateNavEnquiry = {
  enquiry_id?: string;
  customer_name?: string;
  customer_address?: string;
  customer_address_id?: number;
  sales_person?: string;
  enquiry_received_date?: string;
  customer_code?: string;
  customer_email?: string | null;
};

export type QuotationCreateNavInput = {
  enquiryData: QuotationCreateNavEnquiry;
  quotationData: Record<string, unknown>;
  serviceDetails: Record<string, unknown>;
  quotation_primary_id?: number;
  otherServicesData?: OtherServiceOption[];
};

export type QuotationCreateNavResult =
  | {
      flow: "booking" | "cha-job" | "service-job";
      path: string;
      state: Record<string, unknown>;
    }
  | { error: string };

const CHA_JOB_CREATE_PATH_BY_CODE: Record<string, string> = {
  "81": "/cha/ocean-import-job/create",
  "82": "/cha/ocean-import-job/create",
  "83": "/cha/air-import-job/create",
  "84": "/cha/ocean-export-job/create",
  "85": "/cha/ocean-export-job/create",
  "86": "/cha/air-export-job/create",
};

function str(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function normalizeFreight(value: unknown): string {
  const raw = str(value).toUpperCase();
  if (raw === "PP" || raw === "PREPAID") return "Prepaid";
  if (raw === "CC" || raw === "COLLECT") return "Collect";
  return str(value);
}

function resolveOceanServiceLabel(
  serviceCode: string,
  quotationData: Record<string, unknown>,
  otherServicesData: OtherServiceOption[],
): "FCL" | "LCL" {
  const selected = findOtherService(otherServicesData, serviceCode);
  if (selected?.transport_mode === "SEA") {
    const effective = resolveEffectiveServiceFromTransport(
      selected.transport_mode || "",
      selected.full_groupage || "",
    );
    if (effective === "FCL" || effective === "LCL") return effective;
  }

  const name = `${str(quotationData.service_name)} ${str(selected?.label)}`.toUpperCase();
  if (name.includes("FCL") || name.includes("FULL")) return "FCL";
  if (name.includes("LCL") || name.includes("GROUPAGE")) return "LCL";

  // Conventional CHA ocean codes: 81/84 LCL, 82/85 FCL
  if (serviceCode === "82" || serviceCode === "85") return "FCL";
  return "LCL";
}

function isAirChaCode(serviceCode: string): boolean {
  return serviceCode === "83" || serviceCode === "86";
}

function buildCustomerPartyFields(
  enquiryData: QuotationCreateNavEnquiry,
  trade: string,
): Record<string, string> {
  const customerCode = str(enquiryData.customer_code);
  const customerName = str(enquiryData.customer_name);
  const customerEmail = str(enquiryData.customer_email);
  const customerAddress = str(enquiryData.customer_address);
  const customerAddressId =
    enquiryData.customer_address_id != null
      ? String(enquiryData.customer_address_id)
      : "";

  const billing = {
    billing_customer_id: customerCode,
    billing_customer_name: customerName,
    billing_customer_email: customerEmail,
    billing_customer_address_id: customerAddressId,
    billing_customer_address: customerAddress,
  };

  if (trade === "Export") {
    return {
      shipper_id: customerCode,
      shipper_name: customerName,
      shipper_email: customerEmail,
      shipper_address_id: customerAddressId,
      shipper_address: customerAddress,
      ...billing,
    };
  }

  return {
    consignee_id: customerCode,
    consignee_name: customerName,
    consignee_email: customerEmail,
    consignee_address_id: customerAddressId,
    consignee_address: customerAddress,
    ...billing,
  };
}

function mapQuotationChargesToEstimates(
  charges: unknown,
  freight: string,
): Record<string, unknown>[] {
  if (!Array.isArray(charges) || charges.length === 0) return [];

  return charges.map((raw) => {
    const charge = (raw ?? {}) as Record<string, unknown>;
    const currency = str(charge.currency ?? charge.currency_country_code);
    return {
      supplier_code: "",
      supplier_name: "",
      charge_id:
        charge.charge_id != null && !Number.isNaN(Number(charge.charge_id))
          ? Number(charge.charge_id)
          : null,
      charge_name: str(charge.charge_name ?? charge.charge_code),
      pp_cc: normalizeFreight(freight) || "Collect",
      unit_id: "",
      unit_code: str(charge.unit),
      no_of_unit:
        charge.no_of_units != null
          ? Number(charge.no_of_units)
          : charge.no_of_unit != null
            ? Number(charge.no_of_unit)
            : null,
      currency_id: currency,
      currency_code: currency,
      roe: charge.roe != null ? Number(charge.roe) : 1,
      cost_per_unit:
        charge.cost_per_unit != null ? Number(charge.cost_per_unit) : null,
      total_cost: charge.total_cost != null ? Number(charge.total_cost) : null,
    };
  });
}

function mapQuotationChargesToServiceJobCharges(
  charges: unknown,
  freight: string,
): Record<string, unknown>[] {
  if (!Array.isArray(charges) || charges.length === 0) return [];

  return charges.map((raw) => {
    const charge = (raw ?? {}) as Record<string, unknown>;
    const currency = str(charge.currency ?? charge.currency_country_code);
    const noOfUnits =
      charge.no_of_units != null
        ? Number(charge.no_of_units)
        : charge.no_of_unit != null
          ? Number(charge.no_of_unit)
          : null;
    const sellPerUnit =
      charge.sell_per_unit != null ? Number(charge.sell_per_unit) : null;
    const totalSell =
      charge.total_sell != null ? Number(charge.total_sell) : null;

    return {
      charge_id:
        charge.charge_id != null && !Number.isNaN(Number(charge.charge_id))
          ? Number(charge.charge_id)
          : null,
      charge_name: str(charge.charge_name ?? charge.charge_code),
      pp_cc: normalizeFreight(freight) || "Collect",
      unit_code: str(charge.unit),
      no_of_unit: noOfUnits,
      currency_code: currency,
      currency_id: currency,
      roe: charge.roe != null ? Number(charge.roe) : 1,
      amount_per_unit: sellPerUnit,
      amount: totalSell,
      sell_local_amount: totalSell,
      unit_cost:
        charge.cost_per_unit != null ? Number(charge.cost_per_unit) : null,
      total_cost: charge.total_cost != null ? Number(charge.total_cost) : null,
      cost_local_amount:
        charge.total_cost != null ? Number(charge.total_cost) : null,
    };
  });
}

function mapCargoDetails(quotationData: Record<string, unknown>) {
  const cargo = Array.isArray(quotationData.cargo_details)
    ? quotationData.cargo_details
    : [];
  return cargo.map((row) => {
    const item = (row ?? {}) as Record<string, unknown>;
    return {
      no_of_packages: item.no_of_packages ?? null,
      gross_weight: item.gross_weight ?? null,
      volume: item.volume ?? item.volume_weight ?? null,
      chargeable_weight: item.chargeable_weight ?? null,
      chargeable_volume: item.chargeable_volume ?? null,
      container_type: item.container_type ?? item.container_type_code ?? "",
      no_of_containers: item.no_of_containers ?? null,
      haz: quotationData.hazardous_cargo === true ? "Yes" : "No",
    };
  });
}

function buildSharedLocationFields(
  quotationData: Record<string, unknown>,
  serviceDetails: Record<string, unknown>,
) {
  return {
    origin_code: str(
      serviceDetails.origin_code ??
        serviceDetails.origin_code_read ??
        quotationData.origin_code,
    ),
    origin_name: str(
      serviceDetails.origin_name ??
        serviceDetails.origin ??
        quotationData.origin,
    ),
    destination_code: str(
      serviceDetails.destination_code ??
        serviceDetails.destination_code_read ??
        quotationData.destination_code,
    ),
    destination_name: str(
      serviceDetails.destination_name ??
        serviceDetails.destination ??
        quotationData.destination,
    ),
    pp_cc: normalizeFreight(quotationData.freight) || "Collect",
    freight: normalizeFreight(quotationData.freight) || "Collect",
    note: str(quotationData.remark),
  };
}

function buildChaJobState(
  input: QuotationCreateNavInput,
  serviceCode: string,
): Record<string, unknown> {
  const { enquiryData, quotationData, serviceDetails, otherServicesData = [] } =
    input;
  const trade = str(quotationData.trade);
  const locationFields = buildSharedLocationFields(
    quotationData,
    serviceDetails,
  );
  const partyFields = buildCustomerPartyFields(enquiryData, trade);
  const isAir = isAirChaCode(serviceCode);
  const serviceLabel = isAir
    ? "AIR"
    : resolveOceanServiceLabel(serviceCode, quotationData, otherServicesData);

  const details = {
    service: serviceLabel,
    service_code: serviceCode,
    service_id: "",
    ...locationFields,
    ...partyFields,
  };

  const estimates = mapQuotationChargesToEstimates(
    quotationData.charges,
    locationFields.pp_cc,
  );

  const carrierDetails = {
    carrier_code: str(quotationData.carrier_code),
    carrier_name: str(quotationData.carrier),
  };

  if (isAir) {
    return {
      mawbDetails: details,
      carrierDetails,
      ...(estimates.length > 0 ? { estimates } : {}),
      returnTo: "/quotation",
    };
  }

  return {
    mblDetails: details,
    carrierDetails,
    ...(estimates.length > 0 ? { estimates } : {}),
    returnTo: "/quotation",
  };
}

function buildServiceJobPrefill(
  input: QuotationCreateNavInput,
  serviceCode: string,
): Record<string, unknown> {
  const { enquiryData, quotationData, serviceDetails } = input;
  const trade = str(quotationData.trade);
  const locationFields = buildSharedLocationFields(
    quotationData,
    serviceDetails,
  );
  const partyFields = buildCustomerPartyFields(enquiryData, trade);
  const charges = mapQuotationChargesToServiceJobCharges(
    quotationData.charges,
    locationFields.pp_cc,
  );
  const cargoDetails = mapCargoDetails(quotationData);

  return {
    service_code: serviceCode,
    service_id: "",
    origin_code: locationFields.origin_code,
    origin_name: locationFields.origin_name,
    destination_code: locationFields.destination_code,
    destination_name: locationFields.destination_name,
    pp_cc: locationFields.pp_cc,
    freight: locationFields.freight,
    commodity_description: str(quotationData.commodity),
    ...partyFields,
    housing_details: [
      {
        ...partyFields,
        origin_code: locationFields.origin_code,
        origin_name: locationFields.origin_name,
        destination_code: locationFields.destination_code,
        destination_name: locationFields.destination_name,
        pp_cc: locationFields.pp_cc,
        freight: locationFields.freight,
        commodity_description: str(quotationData.commodity),
        charges,
        cargo_details: cargoDetails,
      },
    ],
  };
}

/**
 * Resolve Create Booking navigation for gained quotations:
 * - AIR / FCL / LCL / INLAND (and inland OTHERS) → booking create
 * - CHA OTHERS (service codes 81–86) → CHA job create
 * - Other OTHERS services → service-job create
 */
export function resolveQuotationCreateNavigation(
  serviceType: string,
  trade: string | null | undefined,
  input: QuotationCreateNavInput,
): QuotationCreateNavResult {
  const otherServicesData = input.otherServicesData || [];
  const serviceCode = str(
    input.quotationData.service_code ?? input.serviceDetails.service_code,
  );

  const bookingPath = getBookingCreatePath(serviceType, trade, {
    serviceCode,
    otherServicesData,
  });

  if (bookingPath) {
    return {
      flow: "booking",
      path: bookingPath,
      state: {
        bookingData: {
          enquiryData: input.enquiryData,
          quotationData: input.quotationData,
          serviceDetails: input.serviceDetails,
          quotation_primary_id: input.quotation_primary_id,
        },
      },
    };
  }

  if (serviceType === "OTHERS" && serviceCode) {
    if (
      isOtherServiceInland(serviceCode, otherServicesData) &&
      trade !== "Export" &&
      trade !== "Import"
    ) {
      return { error: "Invalid trade type" };
    }

    if (isChaServiceCode(serviceCode)) {
      const path = CHA_JOB_CREATE_PATH_BY_CODE[serviceCode];
      if (!path) {
        return { error: "Unsupported CHA service code for job creation." };
      }
      return {
        flow: "cha-job",
        path,
        state: buildChaJobState(input, serviceCode),
      };
    }

    return {
      flow: "service-job",
      path: "/service-job/create",
      state: {
        quotationPrefill: buildServiceJobPrefill(input, serviceCode),
        returnTo: "/quotation",
      },
    };
  }

  if (
    serviceType === "OTHERS" &&
    serviceCode &&
    trade !== "Export" &&
    trade !== "Import"
  ) {
    return { error: "Invalid trade type" };
  }

  return {
    error:
      "Create booking/job is only supported for AIR, FCL, LCL, INLAND, CHA and Other services",
  };
}
