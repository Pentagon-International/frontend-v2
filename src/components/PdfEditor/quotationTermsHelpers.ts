/** Mirrors default instruction lines rendered in QuotationPDFTemplate (not imported from PDF file). */
export const DEFAULT_QUOTATION_INSTRUCTIONS = [
  "Rates are valid until further notice.",
  "Subject to Locals at Both ends.",
  "Subject to Space availability.",
  "Rates are subject to change with/without prior notice of carriers and availability of space.",
  "Surcharge are subject to change and are applicable at the time of shipment.",
];

/** Mirrors default condition lines rendered in QuotationPDFTemplate (not imported from PDF file). */
export const DEFAULT_QUOTATION_CONDITIONS = [
  "- As stated in article 5.5 of our Terms of sales, the costs generated following refusal of the goods by the recipient, such as by the failure of the latter for any reason whatsoever, in particular the costs of storage and demurrage of containers, will remain the responsibility of the Principal. The Principal expressly and unequivocally agrees to be liable for these costs.",
  "- Under reserve of capacity on flights",
  "- Under reserve of goods sufficiently packed for air transport",
  "- Under reserve of final packing list",
  "- Ratio weight volume = 1/6 (1000 KGS = 6 m³)",
  "- Under reserve of tarif modification without prior notice from airlines",
  "- Exchange rate is provisional, subject to fluctuations",
  "",
  "- For general cargo only",
  "- Under reserve of goods no dangerous",
  "- Under reserve no perishable",
  "- Under reserve no LITHIUM batteries",
  "- Insurance not included",
  "* TVA : TVA sur prestation",
];

export function getQuotationExchangeRates(data: Record<string, unknown>): string | null {
  const currencyObj: Record<string, unknown> = {};
  const quotations = Array.isArray(data?.quotation) ? data.quotation : [];

  quotations.forEach((q: Record<string, unknown>) => {
    const quoteCurrency = String(q.quote_currency ?? "").toUpperCase();
    const charges = Array.isArray(q.charges) ? q.charges : [];
    charges.forEach((charge: Record<string, unknown>) => {
      const curr = String(charge.currency ?? "").toUpperCase();
      const roe = charge.roe;
      if (!curr || curr === quoteCurrency) return;
      if (currencyObj[curr] === undefined) {
        currencyObj[curr] = roe;
      }
    });
  });

  if (Object.keys(currencyObj).length === 0) return null;

  return Object.entries(currencyObj)
    .map(([currency, roe]) => `${currency} - ${roe}`)
    .join(", ");
}

export function isPentagonCompanyForTerms(): boolean {
  try {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user?.company) {
        const companyName = String(user.company.company_name || "").toUpperCase();
        const normalized = companyName.replace(/\s+/g, "").toUpperCase();
        if (normalized.includes("CCT") || normalized.includes("CARGOCONSOLIDATORS")) {
          return false;
        }
        return normalized !== "CARGOCONSOLIDATORSINDIA";
      }
    }
    return true;
  } catch {
    return true;
  }
}

export function getEffectiveNotes(quotation: Record<string, unknown>): string[] {
  const notes = Array.isArray(quotation.notes) ? quotation.notes : [];
  if (notes.length > 0) {
    return notes.map((n) => String(n ?? "").trim()).filter(Boolean);
  }
  return [...DEFAULT_QUOTATION_INSTRUCTIONS];
}

export function getEffectiveConditions(quotation: Record<string, unknown>): string[] {
  const conditions = Array.isArray(quotation.conditions) ? quotation.conditions : [];
  if (conditions.length > 0) {
    return conditions.map((c) => {
      const text = String(c ?? "").trim();
      if (!text) return "";
      return text.startsWith("-") ? text : `- ${text}`;
    });
  }
  return [...DEFAULT_QUOTATION_CONDITIONS];
}

/** Build numbered note lines exactly as drawn in the PDF instructions section. */
export function buildNumberedNoteDisplayLines(
  rowData: Record<string, unknown>,
  quotation: Record<string, unknown>,
): string[] {
  const notes = getEffectiveNotes(quotation);
  const exchangeRates = getQuotationExchangeRates(rowData);
  const startIndex = exchangeRates ? 2 : 1;

  return notes.map((note, index) => `${index + startIndex}. ${note}`);
}

export function stripNumberedPrefix(value: string): string {
  return value.replace(/^\d+\.\s*/, "").trim();
}

export function normalizeConditionText(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("-") || trimmed.startsWith("*")
    ? trimmed
    : `- ${trimmed}`;
}

/** ROE used when converting charge totals (mirrors QuotationPDFTemplate charge table). */
export function getRoeForQuoteCurrency(
  charges: Record<string, unknown>[],
  quoteCurrency: string,
): number {
  for (const charge of charges) {
    if (
      String(charge.currency ?? "").toUpperCase() === quoteCurrency.toUpperCase()
    ) {
      return Number(charge.roe || 1);
    }
  }
  return 1;
}

/** Display value for the charge Total Amount column in the PDF. */
export function getChargeTotalDisplayAmount(
  charge: Record<string, unknown>,
  quoteCurrency: string,
  userCurrency: string,
  roeForQuote: number,
): string {
  const amount = Number(charge.total_sell || 0);
  let finalAmount = amount;
  if (userCurrency !== quoteCurrency) {
    finalAmount = amount / roeForQuote;
  }
  return finalAmount.toFixed(2);
}

/** Convert edited Total Amount display back to stored total_sell. */
export function parseChargeTotalDisplayInput(
  rawInput: string,
  quoteCurrency: string,
  userCurrency: string,
  roeForQuote: number,
): number {
  const parsed = Number(String(rawInput).replace(/,/g, "").trim());
  if (Number.isNaN(parsed)) return 0;
  if (userCurrency !== quoteCurrency) {
    return parsed * roeForQuote;
  }
  return parsed;
}
