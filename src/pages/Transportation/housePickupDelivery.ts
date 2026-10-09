import dayjs from "dayjs";

/** House pickup and delivery. Same fields as the booking step, stored on the house. */
export type HousePickupDeliveryFormValues = {
  pickup_location: string;
  pickup_from_code: string;
  pickup_from_name: string;
  pickup_address_id: string;
  pickup_address_text: string;
  planned_pickup_date: Date | null;
  actual_pickup_date: Date | null;
  transporter_code: string;
  transporter_name: string;
  transporter_email: string;
  delivery_location: string;
  delivery_from_code: string;
  delivery_from_name: string;
  delivery_address_id: string;
  delivery_address_text: string;
  planned_delivery_date: Date | null;
  actual_delivery_date: Date | null;
};

export function emptyHousePickupDelivery(): HousePickupDeliveryFormValues {
  return {
    pickup_location: "",
    pickup_from_code: "",
    pickup_from_name: "",
    pickup_address_id: "",
    pickup_address_text: "",
    planned_pickup_date: null,
    actual_pickup_date: null,
    transporter_code: "",
    transporter_name: "",
    transporter_email: "",
    delivery_location: "",
    delivery_from_code: "",
    delivery_from_name: "",
    delivery_address_id: "",
    delivery_address_text: "",
    planned_delivery_date: null,
    actual_delivery_date: null,
  };
}

function asRecord(source: unknown): Record<string, unknown> {
  return source != null && typeof source === "object"
    ? (source as Record<string, unknown>)
    : {};
}

function readText(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function toFormDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = dayjs(value as string | number);
  return parsed.isValid() ? parsed.toDate() : null;
}

function portLabel(name: string, code: string): string {
  if (!name) return "";
  if (!code || name.includes(`(${code})`)) return name;
  return `${name} (${code})`;
}

export function readHousePickupDelivery(
  source: unknown,
): HousePickupDeliveryFormValues {
  const row = asRecord(source);
  const pickupFromCode = readText(row, "pickup_from_code");
  const pickupFromName = readText(row, "pickup_from_name", "pickup_from");
  const deliveryFromCode = readText(row, "delivery_from_code");
  const deliveryFromName = readText(row, "delivery_from_name", "delivery_from");
  const pickupAddressId = row.pickup_address_id;
  const deliveryAddressId = row.delivery_address_id;

  return {
    pickup_location: readText(row, "pickup_location"),
    pickup_from_code: pickupFromCode,
    pickup_from_name: portLabel(pickupFromName, pickupFromCode),
    pickup_address_id:
      pickupAddressId != null && String(pickupAddressId).trim() !== ""
        ? String(pickupAddressId)
        : "",
    pickup_address_text: readText(row, "pickup_address_text", "pickup_address"),
    planned_pickup_date: toFormDate(row.planned_pickup_date),
    actual_pickup_date: toFormDate(row.actual_pickup_date),
    transporter_code: readText(row, "transporter_code"),
    transporter_name: readText(row, "transporter_name"),
    transporter_email: readText(row, "transporter_email"),
    delivery_location: readText(row, "delivery_location"),
    delivery_from_code: deliveryFromCode,
    delivery_from_name: portLabel(deliveryFromName, deliveryFromCode),
    delivery_address_id:
      deliveryAddressId != null && String(deliveryAddressId).trim() !== ""
        ? String(deliveryAddressId)
        : "",
    delivery_address_text: readText(
      row,
      "delivery_address_text",
      "delivery_address",
    ),
    planned_delivery_date: toFormDate(row.planned_delivery_date),
    actual_delivery_date: toFormDate(row.actual_delivery_date),
  };
}

function toApiText(value: string | null | undefined): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function toApiId(value: string | number | null | undefined): number | null {
  if (value == null || value === "" || value === 0 || value === "0") return null;
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function toApiDate(value: Date | null | undefined): string | null {
  if (!value || !dayjs(value).isValid()) return null;
  return dayjs(value).format("YYYY-MM-DD");
}

const PICKUP_DELIVERY_STATE_KEYS = [
  "pickup_location",
  "pickup_from_code",
  "pickup_from_name",
  "pickup_address_id",
  "pickup_address_text",
  "planned_pickup_date",
  "actual_pickup_date",
  "transporter_code",
  "transporter_name",
  "transporter_email",
  "delivery_location",
  "delivery_from_code",
  "delivery_from_name",
  "delivery_address_id",
  "delivery_address_text",
  "planned_delivery_date",
  "actual_delivery_date",
] as const;

/** True when this house object already carries pickup/delivery, including blanks. */
export function houseHasPickupDeliveryFields(source: unknown): boolean {
  if (source == null || typeof source !== "object") return false;
  const row = source as Record<string, unknown>;
  return PICKUP_DELIVERY_STATE_KEYS.some((key) => key in row);
}

export function housePickupDeliveryPayload(
  values: Partial<HousePickupDeliveryFormValues> | null | undefined,
): Record<string, string | number | null> {
  const row = values ?? {};
  return {
    pickup_location: toApiText(row.pickup_location),
    pickup_from_code: toApiText(row.pickup_from_code),
    pickup_address_id: toApiId(row.pickup_address_id),
    planned_pickup_date: toApiDate(row.planned_pickup_date),
    actual_pickup_date: toApiDate(row.actual_pickup_date),
    transporter_code: toApiText(row.transporter_code),
    transporter_email: toApiText(row.transporter_email),
    delivery_location: toApiText(row.delivery_location),
    delivery_from_code: toApiText(row.delivery_from_code),
    delivery_address_id: toApiId(row.delivery_address_id),
    planned_delivery_date: toApiDate(row.planned_delivery_date),
    actual_delivery_date: toApiDate(row.actual_delivery_date),
  };
}
