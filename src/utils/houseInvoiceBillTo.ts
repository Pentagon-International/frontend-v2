import {
  hasBillingCustomerParty,
  hasForwarderParty,
} from "./customerSelection";

/** Party used to prefill invoice Bill To / address from a house. */
export type HouseInvoiceBillToParty =
  | "billing_customer"
  | "notify"
  | "consignee"
  | "forwarder"
  | "shipper";

function hasNonEmptyText(value: unknown): boolean {
  return String(value ?? "").trim() !== "";
}

function hasNotifyCustomerParty(house: Record<string, unknown>): boolean {
  return (
    hasNonEmptyText(house.notify1_customer_name) ||
    hasNonEmptyText(house.notify_customer1_name) ||
    hasNonEmptyText(house.notify_customer_name) ||
    hasNonEmptyText(house.notify_customer)
  );
}

/**
 * Import house invoice Bill To precedence:
 * Billing customer → Notify Customer → Consignee
 */
export function resolveImportHouseInvoiceBillTo(
  house: Record<string, unknown> | null | undefined,
): HouseInvoiceBillToParty {
  const h = house ?? {};
  if (
    hasBillingCustomerParty({
      billingCustomerId: h.billing_customer_id as string | number | null,
      billingCustomerName: h.billing_customer_name as string | null,
    })
  ) {
    return "billing_customer";
  }
  if (hasNotifyCustomerParty(h)) return "notify";
  return "consignee";
}

/**
 * Export house invoice Bill To precedence:
 * Billing customer → Forwarder → Shipper
 */
export function resolveExportHouseInvoiceBillTo(
  house: Record<string, unknown> | null | undefined,
): HouseInvoiceBillToParty {
  const h = house ?? {};
  if (
    hasBillingCustomerParty({
      billingCustomerId: h.billing_customer_id as string | number | null,
      billingCustomerName: h.billing_customer_name as string | null,
    })
  ) {
    return "billing_customer";
  }
  if (
    hasForwarderParty({
      forwarderId: h.forwarder_id,
      forwarderCode: h.forwarder_code,
      forwarderName: h.forwarder_name,
    })
  ) {
    return "forwarder";
  }
  return "shipper";
}
