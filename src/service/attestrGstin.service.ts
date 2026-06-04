const ATTESTR_GSTIN_SEARCH_URL =
  "https://api.attestr.com/api/v1/public/corpx/gstin/search";

export type AttestrGstinPrimaryAddress = {
  type?: string;
  building?: string;
  buildingName?: string;
  floor?: string;
  street?: string;
  locality?: string;
  district?: string;
  state?: string;
  zip?: string;
  latitude?: string;
  longitude?: string;
  nature?: string;
};

export type AttestrGstinRecord = {
  gstin: string;
  active?: boolean;
  pan: string;
  registered?: string;
  legalName: string;
  tradeName?: string;
  status?: string;
  type?: string;
  constitution?: string;
  primaryAddress: AttestrGstinPrimaryAddress;
};

export type AttestrGstinSearchResponse = {
  valid: boolean;
  message: string | null;
  records: AttestrGstinRecord[];
};

export async function searchGstinByPan(pan: string): Promise<AttestrGstinSearchResponse> {
  const response = await fetch(ATTESTR_GSTIN_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${import.meta.env.VITE_ATTESTR_GSTIN_BASIC_AUTH}`,
    },
    body: JSON.stringify({ pan: pan.trim().toUpperCase() }),
  });

  const body = (await response.json().catch(() => null)) as
    | AttestrGstinSearchResponse
    | { message?: string; error?: string }
    | null;

  if (!response.ok) {
    const message =
      (body && "message" in body && body.message) ||
      (body && "error" in body && body.error) ||
      `GSTIN search failed (${response.status})`;
    throw new Error(String(message));
  }

  if (!body || typeof body !== "object") {
    throw new Error("Invalid response from GSTIN search service.");
  }

  return {
    valid: Boolean((body as AttestrGstinSearchResponse).valid),
    message: (body as AttestrGstinSearchResponse).message ?? null,
    records: Array.isArray((body as AttestrGstinSearchResponse).records)
      ? (body as AttestrGstinSearchResponse).records
      : [],
  };
}

export function buildAddressLine(address?: AttestrGstinPrimaryAddress): string {
  if (!address) return "";
  return [
    address.building,
    address.buildingName,
    address.floor,
    address.street,
    address.locality,
    address.district,
  ]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(", ");
}
