import {
  PDF_CONDITIONS_LINE_HEIGHT_MM,
  PDF_DEFAULT_LINE_HEIGHT_MM,
} from "./utils/fieldRectConstraints";
import { getByPath, setByPath } from "./utils/setByPath";
import {
  buildNumberedNoteDisplayLines,
  getChargeTotalDisplayAmount,
  getEffectiveConditions,
  getEffectiveNotes,
  getRoeForQuoteCurrency,
  isPentagonCompanyForTerms,
  normalizeConditionText,
  parseChargeTotalDisplayInput,
  stripNumberedPrefix,
} from "./quotationTermsHelpers";

export type PdfEditorContext = {
  userCurrency?: string;
};

export type EditableFieldDef = {
  id: string;
  path: string;
  editable: boolean;
  type?: "text" | "textarea" | "number";
  multiline?: boolean;
  fontWeight?: number;
  layoutZone?:
    | "left"
    | "right"
    | "full"
    | "content"
    | "service"
    | "charge_description"
    | "charge_min"
    | "charge_total"
    | "customer_details";
  /** PDF line spacing in mm (mirrors QuotationPDFTemplate). */
  pdfLineHeightMm?: number;
  getDisplayValue: (rowData: Record<string, unknown>, ctx: PdfEditorContext) => string;
  parseInput?: (rawInput: string, rowData: Record<string, unknown>) => unknown;
};

const formatDate = (dateString: unknown): string => {
  if (!dateString) return "N/A";
  const date = new Date(String(dateString));
  if (Number.isNaN(date.getTime())) return String(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

function getCustomerAddress(rowData: Record<string, unknown>): string {
  const address = rowData.customer_address;
  if (Array.isArray(address)) return String(address[0] ?? "");
  return String(address ?? "");
}

function setCustomerAddress(
  rowData: Record<string, unknown>,
  value: string,
): Record<string, unknown> {
  const address = rowData.customer_address;
  if (Array.isArray(address)) {
    const next = [...address];
    next[0] = value;
    return setByPath(rowData, "customer_address", next);
  }
  return setByPath(rowData, "customer_address", value);
}

function ensureNotesInitialized(
  rowData: Record<string, unknown>,
  serviceIndex: number,
): Record<string, unknown> {
  const path = `quotation[${serviceIndex}].notes`;
  const existing = getByPath(rowData, path);
  if (Array.isArray(existing) && existing.length > 0) return rowData;
  const quotation =
    (getByPath(rowData, `quotation[${serviceIndex}]`) as Record<string, unknown>) ??
    {};
  return setByPath(rowData, path, getEffectiveNotes(quotation));
}

function ensureConditionsInitialized(
  rowData: Record<string, unknown>,
  serviceIndex: number,
): Record<string, unknown> {
  const path = `quotation[${serviceIndex}].conditions`;
  const existing = getByPath(rowData, path);
  if (Array.isArray(existing) && existing.length > 0) return rowData;
  const quotation =
    (getByPath(rowData, `quotation[${serviceIndex}]`) as Record<string, unknown>) ??
    {};
  return setByPath(rowData, path, getEffectiveConditions(quotation));
}

function getChargeMinDisplayValue(charge: Record<string, unknown>): string | null {
  const minSell = charge.min_sell;
  if (
    minSell === null ||
    minSell === undefined ||
    minSell === "" ||
    Number(minSell) === 0
  ) {
    return null;
  }
  return String(minSell);
}

function parseChargeMinInput(raw: string): number {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.toUpperCase() === "N/A") return 0;
  const parsed = Number(trimmed.replace(/,/g, ""));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function chargesShowMinAmountColumn(charges: Record<string, unknown>[]): boolean {
  return !charges.every((charge) => getChargeMinDisplayValue(charge) === null);
}

function getQuotationAt(
  rowData: Record<string, unknown>,
  serviceIndex: number,
): Record<string, unknown> {
  const quotations = rowData.quotation;
  if (!Array.isArray(quotations)) return {};
  return (quotations[serviceIndex] as Record<string, unknown>) ?? {};
}

/** Build editable field registry from quotation rowData. */
export function buildQuotationFieldRegistry(
  rowData: Record<string, unknown>,
): EditableFieldDef[] {
  const fields: EditableFieldDef[] = [
    {
      id: "customer_name",
      path: "customer_name",
      editable: true,
      multiline: true,
      type: "textarea",
      layoutZone: "customer_details",
      pdfLineHeightMm: PDF_DEFAULT_LINE_HEIGHT_MM,
      getDisplayValue: (data) => String(data.customer_name || "N/A"),
    },
    {
      id: "customer_address",
      path: "customer_address",
      editable: true,
      multiline: true,
      type: "textarea",
      layoutZone: "customer_details",
      pdfLineHeightMm: PDF_DEFAULT_LINE_HEIGHT_MM,
      getDisplayValue: (data) => getCustomerAddress(data),
      parseInput: (raw, data) => {
        const updated = setCustomerAddress(data, raw);
        return getByPath(updated, "customer_address");
      },
    },
  ];

  const quotations = Array.isArray(rowData.quotation) ? rowData.quotation : [];
  const showConditionsSection = !isPentagonCompanyForTerms();

  quotations.forEach((quotation: Record<string, unknown>, serviceIndex: number) => {
    const base = `quotation[${serviceIndex}]`;

    const serviceFields: Array<
      Omit<EditableFieldDef, "getDisplayValue"> & {
        getDisplayValue: (q: Record<string, unknown>) => string;
        parseInput?: (raw: string, q: Record<string, unknown>) => unknown;
        skipIfEmpty?: boolean;
      }
    > = [
      {
        id: `${base}_service_type`,
        path: `${base}.service_type`,
        editable: true,
        layoutZone: "service",
        getDisplayValue: (q) => String(q.service_type ?? ""),
      },
      {
        id: `${base}_trade`,
        path: `${base}.trade`,
        editable: true,
        layoutZone: "service",
        getDisplayValue: (q) => String(q.trade ?? ""),
      },
      {
        id: `${base}_origin`,
        path: `${base}.origin`,
        editable: true,
        layoutZone: "service",
        getDisplayValue: (q) =>
          q.origin ? `${q.origin} (${String(q.origin_code || "")})` : "",
        parseInput: (raw) => {
          const match = raw.match(/^(.+?)\s*\(([^)]*)\)\s*$/);
          if (match) return { origin: match[1].trim(), origin_code: match[2].trim() };
          return raw.trim();
        },
      },
      {
        id: `${base}_destination`,
        path: `${base}.destination`,
        editable: true,
        layoutZone: "service",
        getDisplayValue: (q) =>
          q.destination
            ? `${q.destination} (${String(q.destination_code || "")})`
            : "",
        parseInput: (raw) => {
          const match = raw.match(/^(.+?)\s*\(([^)]*)\)\s*$/);
          if (match) {
            return { destination: match[1].trim(), destination_code: match[2].trim() };
          }
          return raw.trim();
        },
      },
      {
        id: `${base}_shipment_terms`,
        path: `${base}.shipment_terms`,
        editable: true,
        layoutZone: "service",
        getDisplayValue: (q) =>
          q.shipment_terms
            ? `${q.shipment_terms} (${String(q.shipment_terms_code || "")})`
            : "",
        parseInput: (raw) => {
          const match = raw.match(/^(.+?)\s*\(([^)]*)\)\s*$/);
          if (match) {
            return {
              shipment_terms: match[1].trim(),
              shipment_terms_code: match[2].trim(),
            };
          }
          return raw.trim();
        },
      },
      {
        id: `${base}_icd`,
        path: `${base}.icd`,
        editable: true,
        layoutZone: "service",
        skipIfEmpty: true,
        getDisplayValue: (q) => String(q.icd ?? ""),
      },
      {
        id: `${base}_carrier`,
        path: `${base}.carrier`,
        editable: true,
        multiline: true,
        type: "textarea",
        layoutZone: "service",
        skipIfEmpty: true,
        pdfLineHeightMm: PDF_DEFAULT_LINE_HEIGHT_MM,
        getDisplayValue: (q) => String(q.carrier ?? ""),
      },
      {
        id: `${base}_hazardous_cargo`,
        path: `${base}.hazardous_cargo`,
        editable: true,
        layoutZone: "service",
        getDisplayValue: (q) => (q.hazardous_cargo ? "Yes" : "No"),
        parseInput: (raw) => /yes/i.test(raw.trim()),
      },
      {
        id: `${base}_stackable`,
        path: `${base}.stackable`,
        editable: true,
        layoutZone: "service",
        getDisplayValue: (q) => (q.stackable ? "Stackable" : "Non-Stackable"),
        parseInput: (raw) => {
          const normalized = raw.trim().toLowerCase();
          return normalized === "stackable" || normalized === "yes";
        },
      },
      {
        id: `${base}_created_at`,
        path: `${base}.created_at`,
        editable: true,
        layoutZone: "service",
        skipIfEmpty: true,
        getDisplayValue: (q) => formatDate(q.created_at),
      },
      {
        id: `${base}_quote_currency`,
        path: `${base}.quote_currency`,
        editable: true,
        layoutZone: "service",
        getDisplayValue: (q) => String(q.quote_currency ?? ""),
      },
      {
        id: `${base}_valid_upto`,
        path: `${base}.valid_upto`,
        editable: true,
        layoutZone: "service",
        getDisplayValue: (q) => formatDate(q.valid_upto),
      },
    ];

    serviceFields.forEach((sf) => {
      const display = sf.getDisplayValue(quotation);
      if (!display || display.trim() === "" || display === "N/A") {
        if (sf.skipIfEmpty) return;
      }
      if (!display || display.trim() === "" || display === "N/A") return;

      fields.push({
        id: sf.id,
        path: sf.path,
        editable: sf.editable,
        type: sf.type,
        multiline: sf.multiline,
        layoutZone: sf.layoutZone,
        pdfLineHeightMm: sf.pdfLineHeightMm ?? PDF_DEFAULT_LINE_HEIGHT_MM,
        getDisplayValue: (data) => sf.getDisplayValue(getQuotationAt(data, serviceIndex)),
        parseInput: sf.parseInput
          ? (raw, data) => sf.parseInput!(raw, getQuotationAt(data, serviceIndex))
          : undefined,
      });
    });

    const cargoDetails = Array.isArray(quotation.cargo_details)
      ? quotation.cargo_details
      : [];
    cargoDetails.forEach((cargo: Record<string, unknown>, cargoIndex: number) => {
      const cargoBase = `${base}.cargo_details[${cargoIndex}]`;
      const serviceType = String(quotation.service_type ?? "").toUpperCase();

      const cargoFieldMap: Record<string, string[]> = {
        FCL: ["container_type", "no_of_containers", "gross_weight"],
        LCL: ["no_of_packages", "gross_weight", "volume", "chargeable_volume"],
        AIR: ["no_of_packages", "gross_weight", "volume_weight", "chargeable_weight"],
      };

      (cargoFieldMap[serviceType] ?? []).forEach((key) => {
        const value = String(cargo[key] ?? "");
        if (value === "" || value === "N/A") return;
        fields.push({
          id: `${cargoBase}_${key}`,
          path: `${cargoBase}.${key}`,
          editable: true,
          type: "number",
          layoutZone: "content",
          getDisplayValue: (data) => {
            const q = getQuotationAt(data, serviceIndex);
            const cargoList = Array.isArray(q.cargo_details) ? q.cargo_details : [];
            const cargo = cargoList[cargoIndex] as Record<string, unknown> | undefined;
            return String(cargo?.[key] ?? "");
          },
        });
      });
    });

    const charges = Array.isArray(quotation.charges) ? quotation.charges : [];
    const serviceType = String(quotation.service_type ?? "").toUpperCase();
    const isFclQuotation = serviceType === "FCL";
    const validRegistryCharges = charges.filter((c: Record<string, unknown>) => {
      const sellPerUnit = c.sell_per_unit;
      return (
        sellPerUnit !== null &&
        sellPerUnit !== undefined &&
        sellPerUnit !== "" &&
        Number(sellPerUnit) !== 0
      );
    });
    const showMinAmountColumn = chargesShowMinAmountColumn(validRegistryCharges);

    charges.forEach((charge: Record<string, unknown>, chargeIndex: number) => {
      const sellPerUnit = charge.sell_per_unit;
      if (
        sellPerUnit === null ||
        sellPerUnit === undefined ||
        sellPerUnit === "" ||
        Number(sellPerUnit) === 0
      ) {
        return;
      }

      const chargeBase = `${base}.charges[${chargeIndex}]`;

      const registerTotalSell = () => {
        fields.push({
          id: `${chargeBase}_total_sell`,
          path: `${chargeBase}.total_sell`,
          editable: true,
          type: "number",
          layoutZone: "charge_total",
          getDisplayValue: (data, ctx) => {
            const q = getQuotationAt(data, serviceIndex);
            const chargeList = Array.isArray(q.charges) ? q.charges : [];
            const c = chargeList[chargeIndex] as Record<string, unknown> | undefined;
            if (!c) return "";
            const quoteCurrency = String(q.quote_currency ?? "");
            const userCurrency = String(ctx.userCurrency ?? quoteCurrency);
            const roeForQuote = getRoeForQuoteCurrency(chargeList, quoteCurrency);
            return getChargeTotalDisplayAmount(c, quoteCurrency, userCurrency, roeForQuote);
          },
        });
      };

      const registerMinSell = () => {
        if (!showMinAmountColumn) return;
        const minDisplay = getChargeMinDisplayValue(charge);
        if (!minDisplay) return;

        fields.push({
          id: `${chargeBase}_min_sell`,
          path: `${chargeBase}.min_sell`,
          editable: true,
          type: "number",
          layoutZone: "charge_min",
          getDisplayValue: (data) => {
            const q = getQuotationAt(data, serviceIndex);
            const chargeList = Array.isArray(q.charges) ? q.charges : [];
            const c = chargeList[chargeIndex] as Record<string, unknown> | undefined;
            return getChargeMinDisplayValue(c ?? {}) ?? "";
          },
          parseInput: (raw) => parseChargeMinInput(raw),
        });
      };

      if (isFclQuotation) {
        registerTotalSell();
        registerMinSell();
        return;
      }

      fields.push({
        id: `${chargeBase}_charge_name`,
        path: `${chargeBase}.charge_name`,
        editable: true,
        multiline: true,
        type: "textarea",
        layoutZone: "charge_description",
        pdfLineHeightMm: PDF_DEFAULT_LINE_HEIGHT_MM,
        getDisplayValue: (data) => {
          const q = getQuotationAt(data, serviceIndex);
          const chargeList = Array.isArray(q.charges) ? q.charges : [];
          const c = chargeList[chargeIndex] as Record<string, unknown> | undefined;
          return String(c?.charge_name ?? "N/A");
        },
      });

      const currencyValue = String(charge.currency ?? "").trim();
      if (currencyValue) {
        fields.push({
          id: `${chargeBase}_currency`,
          path: `${chargeBase}.currency`,
          editable: true,
          layoutZone: "content",
          getDisplayValue: (data) => {
            const q = getQuotationAt(data, serviceIndex);
            const chargeList = Array.isArray(q.charges) ? q.charges : [];
            const c = chargeList[chargeIndex] as Record<string, unknown> | undefined;
            return String(c?.currency ?? "");
          },
        });
      }

      fields.push({
        id: `${chargeBase}_sell_per_unit`,
        path: `${chargeBase}.sell_per_unit`,
        editable: true,
        layoutZone: "content",
        getDisplayValue: (data) => {
          const q = getQuotationAt(data, serviceIndex);
          const chargeList = Array.isArray(q.charges) ? q.charges : [];
          const c = chargeList[chargeIndex] as Record<string, unknown> | undefined;
          return `${String(c?.sell_per_unit ?? "N/A")} Per ${String(c?.unit ?? "N/A")}`;
        },
        parseInput: (raw) => {
          const match = raw.match(/^(.+?)\s+Per\s+(.+)$/i);
          if (match) {
            return { sell_per_unit: match[1].trim(), unit: match[2].trim() };
          }
          return raw.trim();
        },
      });

      registerMinSell();
      registerTotalSell();
    });

    // Notes / Terms (includes PDF defaults when API notes are empty)
    const noteLines = buildNumberedNoteDisplayLines(rowData, quotation);
    noteLines.forEach((displayLine, noteIndex) => {
      if (!displayLine.trim()) return;
      fields.push({
        id: `${base}_notes_${noteIndex}`,
        path: `${base}.notes[${noteIndex}]`,
        editable: true,
        multiline: true,
        type: "textarea",
        layoutZone: "full",
        pdfLineHeightMm: PDF_DEFAULT_LINE_HEIGHT_MM,
        getDisplayValue: (data) =>
          buildNumberedNoteDisplayLines(data, getQuotationAt(data, serviceIndex))[
            noteIndex
          ] ?? "",
        parseInput: (raw) => stripNumberedPrefix(raw),
      });
    });

    // Terms & Conditions section (non-Pentagon companies)
    if (showConditionsSection) {
      const conditionLines = getEffectiveConditions(quotation);
      conditionLines.forEach((displayLine, conditionIndex) => {
        if (!displayLine.trim()) return;
        fields.push({
          id: `${base}_conditions_${conditionIndex}`,
          path: `${base}.conditions[${conditionIndex}]`,
          editable: true,
          multiline: true,
          type: "textarea",
          fontWeight: 400,
          layoutZone: "full",
          pdfLineHeightMm: PDF_CONDITIONS_LINE_HEIGHT_MM,
          getDisplayValue: (data) => {
            const lines = getEffectiveConditions(getQuotationAt(data, serviceIndex));
            const text = lines[conditionIndex] ?? "";
            return text.startsWith("-") ? text : `- ${text}`;
          },
          parseInput: (raw) => normalizeConditionText(stripNumberedPrefix(raw)),
        });
      });
    }
  });

  return fields.filter((f) => f.editable);
}

/** Apply a committed edit to rowData using field registry metadata. */
export function applyFieldEdit(
  rowData: Record<string, unknown>,
  field: EditableFieldDef,
  rawInput: string,
  ctx: PdfEditorContext = {},
): Record<string, unknown> {
  let workingData = rowData;

  const notesMatch = field.path.match(/^quotation\[(\d+)\]\.notes\[(\d+)\]$/);
  if (notesMatch) {
    const serviceIndex = Number(notesMatch[1]);
    const noteIndex = Number(notesMatch[2]);
    workingData = ensureNotesInitialized(workingData, serviceIndex);

    const lines = rawInput
      .split(/\r?\n/)
      .map((line) => stripNumberedPrefix(line))
      .filter((line) => line.trim() !== "");

    if (lines.length > 1) {
      const path = `quotation[${serviceIndex}].notes`;
      const existing = [
        ...((getByPath(workingData, path) as string[]) ?? []),
      ];
      existing.splice(noteIndex, 1, ...lines);
      return setByPath(workingData, path, existing);
    }

    if (lines.length === 1) {
      return setByPath(workingData, `quotation[${serviceIndex}].notes[${noteIndex}]`, lines[0]);
    }

    const path = `quotation[${serviceIndex}].notes`;
    const existing = [...((getByPath(workingData, path) as string[]) ?? [])];
    existing.splice(noteIndex, 1);
    return setByPath(workingData, path, existing);
  }

  const conditionsMatch = field.path.match(/^quotation\[(\d+)\]\.conditions\[(\d+)\]$/);
  if (conditionsMatch) {
    const serviceIndex = Number(conditionsMatch[1]);
    const conditionIndex = Number(conditionsMatch[2]);
    workingData = ensureConditionsInitialized(workingData, serviceIndex);

    const lines = rawInput
      .split(/\r?\n/)
      .map((line) => normalizeConditionText(stripNumberedPrefix(line)))
      .filter((line) => line.trim() !== "");

    if (lines.length > 1) {
      const path = `quotation[${serviceIndex}].conditions`;
      const existing = [
        ...((getByPath(workingData, path) as string[]) ?? []),
      ];
      existing.splice(conditionIndex, 1, ...lines);
      return setByPath(workingData, path, existing);
    }

    if (lines.length === 1) {
      return setByPath(
        workingData,
        `quotation[${serviceIndex}].conditions[${conditionIndex}]`,
        lines[0],
      );
    }

    const path = `quotation[${serviceIndex}].conditions`;
    const existing = [...((getByPath(workingData, path) as string[]) ?? [])];
    existing.splice(conditionIndex, 1);
    return setByPath(workingData, path, existing);
  }

  const totalSellMatch = field.path.match(
    /^quotation\[(\d+)\]\.charges\[(\d+)\]\.total_sell$/,
  );
  if (totalSellMatch) {
    const serviceIndex = Number(totalSellMatch[1]);
    const chargeIndex = Number(totalSellMatch[2]);
    const quotation = getQuotationAt(workingData, serviceIndex);
    const quoteCurrency = String(quotation.quote_currency ?? "");
    const userCurrency = String(ctx.userCurrency ?? quoteCurrency);
    const chargeList = Array.isArray(quotation.charges) ? quotation.charges : [];
    const roeForQuote = getRoeForQuoteCurrency(chargeList, quoteCurrency);
    const totalSell = parseChargeTotalDisplayInput(
      rawInput,
      quoteCurrency,
      userCurrency,
      roeForQuote,
    );
    return setByPath(workingData, field.path, totalSell);
  }

  if (field.parseInput) {
    const parsed = field.parseInput(rawInput, workingData);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      let next = workingData;
      const parentPath = field.path.replace(/\.[^.[\]]+$/, "");
      Object.entries(parsed as Record<string, unknown>).forEach(([key, value]) => {
        next = setByPath(next, `${parentPath}.${key}`, value);
      });
      return next;
    }
    return setByPath(workingData, field.path, parsed);
  }

  if (field.path === "customer_address") {
    return setCustomerAddress(workingData, rawInput);
  }

  return setByPath(workingData, field.path, rawInput);
}

export function getFieldDisplayValue(
  field: EditableFieldDef,
  rowData: Record<string, unknown>,
  ctx: PdfEditorContext,
): string {
  return field.getDisplayValue(rowData, ctx);
}
