/** Maersk Ocean booking required-field helpers (mirrors backend serializers). */

export const MAERSK_RECEIPT_DELIVERY_OPTIONS = ["CY", "SD", "CFS"] as const;

export type MaerskReceiptDelivery = (typeof MAERSK_RECEIPT_DELIVERY_OPTIONS)[number];

export function isMaerskCarrier(
  carrierCode?: string | null,
  carrierName?: string | null,
): boolean {
  const name = (carrierName || "").trim().toLowerCase();
  const code = (carrierCode || "").trim().toLowerCase();
  return name.includes("maersk") || code.includes("maeu") || code === "maersk";
}

function isBlank(value: unknown): boolean {
  return value == null || (typeof value === "string" && !value.trim());
}

function hasPositiveWeight(value: unknown): boolean {
  if (value == null || value === "") return false;
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

function hasValidEmail(value: unknown): boolean {
  if (isBlank(value)) return false;
  return String(value).includes("@");
}

export type MaerskBookingFormSlice = {
  /** FCL / LCL (shipment service). Used to gate FCL equipment validation. */
  service?: string | null;
  service_type?: string | null;
  origin_code?: string | null;
  destination_code?: string | null;
  etd?: unknown;
  eta?: unknown;
  receipt_type_at_origin?: string | null;
  delivery_type_at_destination?: string | null;
  reference?: string | null;
  commodity_description?: string | null;
  gross_weight?: unknown;
  shipper_name?: string | null;
  shipper_email?: string | null;
  consignee_name?: string | null;
  consignee_email?: string | null;
  cargo_details?: Array<{
    container_type_code?: string | null;
    no_of_containers?: number | null;
    gross_weight?: unknown;
  }> | null;
};

/** Returns field -> message; empty object when valid. */
export function getMaerskBookingRequiredErrors(
  values: MaerskBookingFormSlice,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const stype = (values.service_type || "").trim().toLowerCase();

  if (stype !== "import" && stype !== "export") {
    errors.service_type = "Required for Maersk booking (import or export).";
  }
  if (isBlank(values.origin_code)) {
    errors.origin_code = "Required for Maersk booking.";
  }
  if (isBlank(values.destination_code)) {
    errors.destination_code = "Required for Maersk booking.";
  }
  if (isBlank(values.etd) && isBlank(values.eta)) {
    errors.etd = "ETD or ETA is required for Maersk booking.";
  }

  const receipt = (values.receipt_type_at_origin || "").trim().toUpperCase();
  const delivery = (values.delivery_type_at_destination || "")
    .trim()
    .toUpperCase();
  if (!MAERSK_RECEIPT_DELIVERY_OPTIONS.includes(receipt as MaerskReceiptDelivery)) {
    errors.receipt_type_at_origin =
      "Required for Maersk booking (CY, SD, or CFS).";
  }
  if (
    !MAERSK_RECEIPT_DELIVERY_OPTIONS.includes(delivery as MaerskReceiptDelivery)
  ) {
    errors.delivery_type_at_destination =
      "Required for Maersk booking (CY, SD, or CFS).";
  }

  if (isBlank(values.reference)) {
    errors.reference =
      "Required for Maersk booking (service contract / quotation reference).";
  }
  if (isBlank(values.commodity_description)) {
    errors.commodity_description = "Required for Maersk booking.";
  }

  const headerWeightOk = hasPositiveWeight(values.gross_weight);
  const lineWeightOk = (values.cargo_details || []).some((row) =>
    hasPositiveWeight(row?.gross_weight),
  );
  if (!headerWeightOk && !lineWeightOk) {
    errors.gross_weight =
      "Required for Maersk booking (must be > 0 on header or cargo line).";
  }

  // FCL equipment check only for FCL service bookings (import + export).
  // Validates only container type + no_of_containers > 0.
  if ((values.service || "").trim().toUpperCase() === "FCL") {
    const hasFclEquipment = (values.cargo_details || []).some((row) => {
      const units = Number(row?.no_of_containers || 0);
      const ctype = row?.container_type_code;
      return units > 0 && !isBlank(ctype);
    });
    if (!hasFclEquipment) {
      errors.cargo_details =
        "At least one FCL line with container type and no_of_containers > 0 is required for Maersk booking.";
    }
  }

  if (stype === "export") {
    if (isBlank(values.shipper_name)) {
      errors.shipper_name = "Required for Maersk export booking.";
    }
    if (!hasValidEmail(values.shipper_email)) {
      errors.shipper_email = "Valid email required for Maersk export booking.";
    }
  } else if (stype === "import") {
    if (isBlank(values.consignee_name)) {
      errors.consignee_name = "Required for Maersk import booking.";
    }
    if (!hasValidEmail(values.consignee_email)) {
      errors.consignee_email =
        "Valid email required for Maersk import booking.";
    }
  }

  return errors;
}
