import { URL } from "../api/serverUrls";

/** Estimates supplier search: vendors and agents, excluding customers. */
export const ESTIMATE_SUPPLIER_ENDPOINT = `${URL.customerFilter}?exclude-category=customer`;

export function estimateSupplierPostBody(query: string) {
  const q = query.trim();
  return { filters: q ? { customer_name: q } : {} };
}

export function estimateSupplierDisplayFormat(item: Record<string, unknown>) {
  return {
    value: String(item.customer_code ?? ""),
    label: String(item.customer_name ?? ""),
  };
}
