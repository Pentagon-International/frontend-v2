/**
 * Maps enquiry sales_person into booking Routed / Routed By defaults
 * for the quotation-gained → booking create flow.
 *
 * - Named salesperson → Routed "Self", Routed By = that name
 * - "Agent" (any casing) → Routed "Agent", Routed By empty (user selects)
 * - Missing/blank → Routed "Self", Routed By empty (stepper may default)
 */
export function mapEnquirySalesPersonToBookingRouted(salesPerson: unknown): {
  routed: "Self" | "Agent";
  routed_by: string;
} {
  const name = String(salesPerson ?? "").trim();
  if (!name) {
    return { routed: "Self", routed_by: "" };
  }
  if (name.toLowerCase() === "agent") {
    return { routed: "Agent", routed_by: "" };
  }
  return { routed: "Self", routed_by: name };
}
