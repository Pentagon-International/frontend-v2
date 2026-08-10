import { parseHouseCargoWeightInput } from "../../../utils/houseCargoChargeableWeight";

type BookingCargoRow = {
  no_of_packages?: number;
  no_of_containers?: number;
  gross_weight?: string | number | null;
  volume?: string | number | null;
  chargeable_volume?: string | number | null;
  container_type_code?: string;
};

export type OceanExportBookingBolFormValues = {
  service: string;
  origin_code: string;
  origin_name: string;
  destination_code: string;
  destination_name: string;
  etd: Date | null;
  eta: Date | null;
  vessel_name: string;
  voyage_no: string;
  carrier_code: string;
  carrier_name: string;
  freight: string;
  shipper_name: string;
  shipper_address: string;
  shipper_email: string;
  consignee_name: string;
  consignee_address: string;
  consignee_email: string;
  notify1_customer_name: string;
  notify1_customer_address: string;
  notify1_customer_email: string;
  commodity_description: string;
  marks_no: string;
  cargo_details: BookingCargoRow[];
  destination_agent_email: string;
  forwarder_email: string;
};

export type OceanExportBookingBolDisplaySupplement = {
  destinationAgentName?: string | null;
  destinationAgentAddress?: string | null;
};

const sumNumericCargoField = (
  cargoDetails: BookingCargoRow[],
  field: keyof BookingCargoRow,
): number =>
  cargoDetails.reduce((sum, cargo) => {
    const val = parseHouseCargoWeightInput(cargo[field] as string | number | null);
    return sum + (val ?? 0);
  }, 0);

const normalizeFreightValue = (value: unknown): string => {
  const raw = String(value ?? "").trim().toUpperCase();
  if (!raw) return "";
  if (raw === "PP" || raw.includes("PREPAID")) return "Prepaid";
  if (raw === "CC" || raw.includes("COLLECT")) return "Collect";
  return raw;
};

/**
 * Maps ocean export booking form values to the job/housing shape expected by
 * generateBillOfLadingPDF (aligned with export job housing_details fields).
 */
export const mapOceanExportBookingToBillOfLadingData = (
  formValues: OceanExportBookingBolFormValues,
  bookingRecord?: Record<string, unknown> | null,
  supplement?: OceanExportBookingBolDisplaySupplement,
) => {
  const service = String(formValues.service || "").toUpperCase();
  const isFcl = service === "FCL";

  const mappedCargoDetails = (formValues.cargo_details || []).map((cargo) => ({
    no_of_packages: isFcl ? cargo.no_of_containers : cargo.no_of_packages,
    gross_weight: cargo.gross_weight,
    volume: isFcl ? cargo.chargeable_volume ?? cargo.volume : cargo.volume,
  }));

  const totalPackages = isFcl
    ? mappedCargoDetails.reduce(
        (sum, c) => sum + (Number(c.no_of_packages) || 0),
        0,
      )
    : sumNumericCargoField(formValues.cargo_details, "no_of_packages");

  const totalGrossWeight = sumNumericCargoField(
    formValues.cargo_details,
    "gross_weight",
  );
  const totalVolume = isFcl
    ? sumNumericCargoField(formValues.cargo_details, "chargeable_volume") ||
      sumNumericCargoField(formValues.cargo_details, "volume")
    : sumNumericCargoField(formValues.cargo_details, "volume");

  const containerTypes = (formValues.cargo_details || [])
    .map((c) => c.container_type_code)
    .filter(Boolean);

  const shipmentCode = String(
    bookingRecord?.shipment_code ?? bookingRecord?.shipment_id ?? "",
  );
  const hblNumber = String(
    bookingRecord?.hbl_number ?? bookingRecord?.shipment_code ?? "",
  );

  const destinationAgentName =
    supplement?.destinationAgentName ??
    String(bookingRecord?.destination_agent_name ?? "");
  const destinationAgentAddress =
    supplement?.destinationAgentAddress ??
    String(bookingRecord?.destination_agent_address ?? "");

  const jobData = {
    origin_name: formValues.origin_name,
    destination_name: formValues.destination_name,
    origin_code: formValues.origin_code,
    destination_code: formValues.destination_code,
    etd: formValues.etd,
    eta: formValues.eta,
    mblDetails: {
      origin_name: formValues.origin_name,
      destination_name: formValues.destination_name,
      origin_code: formValues.origin_code,
      destination_code: formValues.destination_code,
      etd: formValues.etd,
      eta: formValues.eta,
    },
    carrierDetails: {
      vessel_name: formValues.vessel_name,
      voyage_number: formValues.voyage_no,
      carrier_code: formValues.carrier_code,
      carrier_name: formValues.carrier_name,
      etd: formValues.etd,
    },
  };

  const housingData = {
    hbl_number: hblNumber,
    shipment_reference_no: shipmentCode || String(bookingRecord?.id ?? ""),
    shipment_id: shipmentCode,
    shipper_name: formValues.shipper_name,
    shipper_address: formValues.shipper_address,
    shipper_email: formValues.shipper_email,
    consignee_name: formValues.consignee_name,
    consignee_address: formValues.consignee_address,
    consignee_email: formValues.consignee_email,
    notify_customer1_name: formValues.notify1_customer_name,
    notify_customer1_address: formValues.notify1_customer_address,
    notify_customer1_email: formValues.notify1_customer_email,
    agent_name: destinationAgentName,
    agent_address: destinationAgentAddress,
    agent_email:
      formValues.destination_agent_email || formValues.forwarder_email || "",
    origin_name: formValues.origin_name,
    destination_name: formValues.destination_name,
    place_of_acceptance: formValues.origin_name,
    place_of_delivery: formValues.destination_name,
    pp_cc: normalizeFreightValue(formValues.freight),
    freight: normalizeFreightValue(formValues.freight),
    commodity_description: formValues.commodity_description,
    marks_no: formValues.marks_no,
    cargo_details: mappedCargoDetails,
    package_type:
      isFcl && containerTypes.length > 0
        ? containerTypes[0]
        : "PACKAGE(S)",
    summary: {
      total_no_of_packages: totalPackages || "",
      total_gross_weight: totalGrossWeight || "",
      total_volume: totalVolume || "",
      ...(isFcl && containerTypes.length > 0
        ? { container_type: containerTypes }
        : {}),
    },
  };

  return { jobData, housingData };
};
