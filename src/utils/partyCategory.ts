/** Party category for Customer / Vendor / Agent master & verification flows. */
export type PartyCategory = "customer" | "vendor" | "agent";

export const PARTY_CATEGORY_LABEL: Record<PartyCategory, string> = {
  customer: "Customer",
  vendor: "Vendor",
  agent: "Agent",
};

/** GET customertype-master/?category=… */
export function customerTypeByCategoryUrl(
  customerTypeBaseUrl: string,
  category: PartyCategory,
): string {
  const base = customerTypeBaseUrl.endsWith("/")
    ? customerTypeBaseUrl
    : `${customerTypeBaseUrl}/`;
  return `${base}?category=${category}`;
}

/** Append customer-category (+ optional index/limit) to a filter endpoint. */
export function withCustomerCategoryParam(
  filterBaseUrl: string,
  category: PartyCategory,
  index?: number,
  limit?: number,
): string {
  const params = new URLSearchParams();
  params.set("customer-category", category);
  if (typeof index === "number") params.set("index", String(index));
  if (typeof limit === "number") params.set("limit", String(limit));
  const join = filterBaseUrl.includes("?") ? "&" : "?";
  return `${filterBaseUrl}${join}${params.toString()}`;
}
