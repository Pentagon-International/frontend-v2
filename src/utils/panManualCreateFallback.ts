import {
  buildAddressLine,
  type AttestrGstinRecord,
} from "../service/attestrGstin.service";

export const INDIA_PAN_MANUAL_CREATE_QUERY = "manual";

export type PanManualAddressRow = {
  customer_location: string;
  address_type: "Primary" | "Secondary";
  address: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  phone_no: string;
  mobile_no: string;
  email: string;
  trn_no: string;
  validity_date: string | null;
  pan_no: string;
  iec_code: string;
  gst_id: string;
  tan_no: string;
  arn_no: string;
  uin_no: string;
  gst_registration_status: string;
  composite_regular: string;
  sez: boolean;
  sez_valid_date: string | null;
  msme: boolean;
  msme_no: string;
  pan_aadhaar_link: boolean;
  Itr_filed: string;
  tds_threshold_flag: boolean;
  latitude: number;
  longitude: number;
};

export type PanManualCreateFallbackState = {
  allowIndiaManualCreate: true;
  fromPanFallback: true;
  customerFormData: {
    customer_name: string;
    customer_type_code: string[];
    account_codes: string[];
    term_code: string;
    own_office: string;
    credit_amount: string;
    credit_day: string;
    assigned_to: string;
    network_id: string;
    network_name: string;
    addresses_data: PanManualAddressRow[];
  };
  addressFormData: {
    addresses_data: PanManualAddressRow[];
  };
};

function emptyManualAddress(
  overrides: Partial<PanManualAddressRow> = {},
): PanManualAddressRow {
  return {
    customer_location: "",
    address_type: "Primary",
    address: "",
    city: "",
    state: "",
    country: "India",
    pincode: "",
    phone_no: "",
    mobile_no: "",
    email: "",
    trn_no: "",
    validity_date: null,
    pan_no: "",
    iec_code: "",
    gst_id: "",
    tan_no: "",
    arn_no: "",
    uin_no: "",
    gst_registration_status: "",
    composite_regular: "",
    sez: false,
    sez_valid_date: null,
    msme: false,
    msme_no: "",
    pan_aadhaar_link: false,
    Itr_filed: "",
    tds_threshold_flag: false,
    latitude: 0,
    longitude: 0,
    ...overrides,
  };
}

function mapRecordToManualAddress(
  record: AttestrGstinRecord,
  pan: string,
  index: number,
): PanManualAddressRow {
  const addr = record.primaryAddress ?? {};
  const gstin = String(record.gstin ?? "").trim();
  return emptyManualAddress({
    customer_location: addr.district || addr.locality || addr.state || "",
    address_type: index === 0 ? "Primary" : "Secondary",
    address: buildAddressLine(addr),
    city: addr.district || addr.city || "",
    state: addr.state || "",
    pincode: addr.zip || "",
    pan_no: record.pan || pan,
    gst_id: gstin,
    gst_registration_status: gstin ? "Registered" : "",
  });
}

export function buildPanManualCreateFallbackState(options: {
  pan: string;
  records?: AttestrGstinRecord[];
}): PanManualCreateFallbackState {
  const pan = options.pan.trim().toUpperCase();
  const records = options.records ?? [];
  const primary = records[0];
  const addresses =
    records.length > 0
      ? records.map((record, index) =>
          mapRecordToManualAddress(record, pan, index),
        )
      : [emptyManualAddress({ pan_no: pan })];

  const customerFormData = {
    customer_name: primary?.legalName || primary?.tradeName || "",
    customer_type_code: [] as string[],
    account_codes: [] as string[],
    term_code: "",
    own_office: "",
    credit_amount: "",
    credit_day: "",
    assigned_to: "",
    network_id: "",
    network_name: "",
    addresses_data: addresses,
  };

  return {
    allowIndiaManualCreate: true,
    fromPanFallback: true,
    customerFormData,
    addressFormData: { addresses_data: addresses },
  };
}

export function indiaManualCreatePath(path: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${INDIA_PAN_MANUAL_CREATE_QUERY}=1`;
}

export function isIndiaManualCreateAllowed(
  state: unknown,
  search = "",
): boolean {
  if (
    state &&
    typeof state === "object" &&
    Boolean(
      (state as { allowIndiaManualCreate?: unknown }).allowIndiaManualCreate,
    )
  ) {
    return true;
  }
  return new URLSearchParams(search).get(INDIA_PAN_MANUAL_CREATE_QUERY) === "1";
}

export function isFromPanFallback(state: unknown): boolean {
  return Boolean(
    state &&
      typeof state === "object" &&
      (state as { fromPanFallback?: unknown }).fromPanFallback,
  );
}

export function panManualCreateFallbackMessage(
  entityLabel: "customer" | "vendor" | "agent" = "customer",
): string {
  return `Unable to fetch ${entityLabel} details via PAN. Please proceed with manual creation.`;
}
