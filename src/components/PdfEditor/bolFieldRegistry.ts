import { type EditableFieldDef } from "./quotationFieldRegistry";
import { PDF_DEFAULT_LINE_HEIGHT_MM } from "./utils/fieldRectConstraints";
import { setByPath } from "./utils/setByPath";
import { resolvePackageTypeFromHousing, formatPackageTypeNameForBol } from "../../utils/packageTypeOptions";

type BolPreviewRowData = Record<string, unknown>;

/** US BOL column widths as fraction of A4 page width (210mm, 10mm side margins). */
const COL = {
  /** Top grid left/right half columns */
  half: 95 / 210,
  /** Vessel/ports right sub-columns */
  quarter: 47.5 / 210,
  /** Cargo: Marks & Numbers */
  marks: (190 * 0.23) / 210,
  /** Cargo: No. of Packages */
  packages: (190 * 0.15) / 210,
  /** Cargo: Description */
  description: (190 * 0.38) / 210,
  /** Cargo: Gross Weight / Measurement */
  cargoNarrow: (190 * 0.12) / 210,
  /** Footer 3-column cells */
  footer: (190 / 3) / 210,
  /** Packages-in-words row */
  fullInner: 190 / 210,
} as const;

function getHousing(data: BolPreviewRowData): Record<string, unknown> {
  const housing = data.housingData;
  return housing && typeof housing === "object"
    ? (housing as Record<string, unknown>)
    : {};
}

function getJob(data: BolPreviewRowData): Record<string, unknown> {
  const job = data.jobData;
  return job && typeof job === "object"
    ? (job as Record<string, unknown>)
    : {};
}

function getCarrierDetails(data: BolPreviewRowData): Record<string, unknown> {
  const carrier = getJob(data).carrierDetails;
  return carrier && typeof carrier === "object"
    ? (carrier as Record<string, unknown>)
    : {};
}

function getMblDetails(data: BolPreviewRowData): Record<string, unknown> {
  const mbl = getJob(data).mblDetails;
  return mbl && typeof mbl === "object"
    ? (mbl as Record<string, unknown>)
    : {};
}

function getSummary(data: BolPreviewRowData): Record<string, unknown> {
  const summary = getHousing(data).summary;
  return summary && typeof summary === "object"
    ? (summary as Record<string, unknown>)
    : {};
}

function formatUsDate(dateString: unknown): string {
  if (!dateString) return "";
  try {
    const date = new Date(dateString as string);
    if (isNaN(date.getTime())) return "";
    const day = String(date.getDate()).padStart(2, "0");
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return `${day}-${monthNames[date.getMonth()]}-${date.getFullYear()}`;
  } catch {
    return "";
  }
}

function formatDecimal(value: unknown, decimals = 4): string {
  const num = parseFloat(String(value ?? ""));
  if (isNaN(num)) return "";
  return num.toFixed(decimals);
}

function numberToWords(n: number): string {
  const ones = [
    "",
    "ONE",
    "TWO",
    "THREE",
    "FOUR",
    "FIVE",
    "SIX",
    "SEVEN",
    "EIGHT",
    "NINE",
    "TEN",
    "ELEVEN",
    "TWELVE",
    "THIRTEEN",
    "FOURTEEN",
    "FIFTEEN",
    "SIXTEEN",
    "SEVENTEEN",
    "EIGHTEEN",
    "NINETEEN",
  ];
  const tens = [
    "",
    "",
    "TWENTY",
    "THIRTY",
    "FORTY",
    "FIFTY",
    "SIXTY",
    "SEVENTY",
    "EIGHTY",
    "NINETY",
  ];
  if (n <= 0) return "ZERO";
  if (n < 20) return ones[n];
  if (n < 100) {
    const remainder = n % 10;
    return tens[Math.floor(n / 10)] + (remainder ? ` ${ones[remainder]}` : "");
  }
  return String(n);
}

function normalizeFreightTerm(value: unknown): string {
  const raw = String(value ?? "")
    .trim()
    .toUpperCase();
  if (!raw) return "";
  if (raw.includes("PREPAID")) return "PREPAID";
  if (raw.includes("COLLECT")) return "COLLECT";
  return raw;
}

function stripPrefix(raw: string, prefix: RegExp): string {
  return raw.replace(prefix, "").trim();
}

function firstMatchLine(value: string): string {
  return (
    String(value || "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find(Boolean) || String(value || "").trim()
  );
}

function sumCargoField(
  data: BolPreviewRowData,
  fieldName: string,
): number {
  const cargo = getHousing(data).cargo_details;
  if (!Array.isArray(cargo)) return 0;
  return cargo.reduce((sum, row) => {
    const val = parseFloat(
      String((row as Record<string, unknown>)[fieldName] ?? ""),
    );
    return sum + (isNaN(val) ? 0 : val);
  }, 0);
}

function getCargoAt(
  data: BolPreviewRowData,
  index: number,
): Record<string, unknown> {
  const cargo = getHousing(data).cargo_details;
  if (!Array.isArray(cargo)) return {};
  const row = cargo[index];
  return row && typeof row === "object"
    ? (row as Record<string, unknown>)
    : {};
}

const US_FWD_NAME_DEFAULT = "PENTAGON PRIME AMERICAS INC";
const US_FWD_ADDRESS_DEFAULT =
  "8400 NW 33rd STREET, SUITE 310, MIAMI FL 33178";

function getPackageType(data: BolPreviewRowData): string {
  const summary = getSummary(data);
  const housing = getHousing(data);
  const marksType = resolveContainerTypeName(data, 0);
  const fromHousing = resolvePackageTypeFromHousing(housing, "");
  if (fromHousing) return fromHousing;
  return String(
    marksType ||
      (Array.isArray(summary.container_type)
        ? summary.container_type[0]
        : summary.package_type) ||
      "PACKAGE(S)",
  );
}

function buildPackagesInWords(count: number, packageType: string): string {
  return `SAY ${numberToWords(count)} ${packageType || "PACKAGE(S)"} ONLY.`;
}

function wordsToNumber(words: string): number | null {
  const normalized = words.trim().toUpperCase().replace(/\s+/g, " ");
  if (!normalized) return null;
  if (/^\d+$/.test(normalized)) return Number(normalized);

  const ones: Record<string, number> = {
    ZERO: 0,
    ONE: 1,
    TWO: 2,
    THREE: 3,
    FOUR: 4,
    FIVE: 5,
    SIX: 6,
    SEVEN: 7,
    EIGHT: 8,
    NINE: 9,
    TEN: 10,
    ELEVEN: 11,
    TWELVE: 12,
    THIRTEEN: 13,
    FOURTEEN: 14,
    FIFTEEN: 15,
    SIXTEEN: 16,
    SEVENTEEN: 17,
    EIGHTEEN: 18,
    NINETEEN: 19,
  };
  const tens: Record<string, number> = {
    TWENTY: 20,
    THIRTY: 30,
    FORTY: 40,
    FIFTY: 50,
    SIXTY: 60,
    SEVENTY: 70,
    EIGHTY: 80,
    NINETY: 90,
  };
  if (ones[normalized] != null) return ones[normalized];
  if (tens[normalized] != null) return tens[normalized];
  const parts = normalized.split(" ");
  if (parts.length === 2 && tens[parts[0]] != null && ones[parts[1]] != null) {
    return tens[parts[0]] + ones[parts[1]];
  }
  return null;
}

function resolveContainerTypeName(
  data: BolPreviewRowData,
  index: number,
): string {
  const cargo = getCargoAt(data, index);
  if (cargo.container_type_name) return String(cargo.container_type_name);

  const containerNo = String(cargo.container_no || "");
  if (!containerNo) return "";

  const job = getJob(data);
  const containers = (job.containerDetails ||
    job.container_details ||
    []) as Array<Record<string, unknown>>;
  if (!Array.isArray(containers)) return "";

  const match = containers.find(
    (c) => String(c.container_no ?? "") === containerNo,
  );
  if (!match) return "";

  const fromDetails = match.container_type_details as
    | { container_type_name?: string }
    | undefined;
  return String(
    match.container_type_name || fromDetails?.container_type_name || "",
  );
}

function getPackagesTotal(data: BolPreviewRowData): string | number {
  const summary = getSummary(data);
  const housing = getHousing(data);
  const candidates = [
    summary.total_no_of_packages,
    housing.total_packages,
    (housing.cargo_summary as Record<string, unknown> | undefined)
      ?.total_packages,
  ];
  for (const value of candidates) {
    if (value !== "" && value != null) return value as string | number;
  }
  const summed = sumCargoField(data, "no_of_packages");
  return summed > 0 ? summed : "";
}

function isGenericPackageType(type: string): boolean {
  const normalized = type.trim().toUpperCase();
  return (
    !normalized ||
    normalized === "PACKAGE(S)" ||
    normalized === "PACKAGES" ||
    normalized === "PACKAGE"
  );
}

/** Keep package_type / summary.container_type / primary marks type aligned. */
function applySharedPackageType(
  data: BolPreviewRowData,
  type: string,
  options?: { syncMarksContainerType?: boolean },
): Record<string, unknown> {
  const trimmed = type.trim();
  if (!trimmed) return data;

  let next = setByPath(data, "housingData.package_type", trimmed);
  const existing = getSummary(next).container_type;
  const arr = Array.isArray(existing) ? [...existing] : [];
  arr[0] = trimmed;
  next = setByPath(next, "housingData.summary.container_type", arr);

  if (
    options?.syncMarksContainerType !== false &&
    !isGenericPackageType(trimmed)
  ) {
    const cargo = getHousing(next).cargo_details;
    if (Array.isArray(cargo) && cargo.length > 0) {
      next = setByPath(
        next,
        "housingData.cargo_details[0].container_type_name",
        trimmed,
      );
    }
  }

  return next;
}

function syncPackagesFromCount(
  data: BolPreviewRowData,
  count: number,
  packageType?: string,
): Record<string, unknown> {
  const type = packageType?.trim() || getPackageType(data);
  let next = setByPath(
    data,
    "housingData.summary.total_no_of_packages",
    count,
  );
  next = setByPath(next, "housingData.total_packages", count);
  if (packageType?.trim()) {
    next = applySharedPackageType(next, packageType.trim());
  }
  next = setByPath(
    next,
    "housingData.packages_in_words",
    buildPackagesInWords(Math.floor(count), type),
  );
  return next;
}

function syncPackagesFromWords(
  data: BolPreviewRowData,
  raw: string,
): Record<string, unknown> {
  const text = raw.trim();
  let next = setByPath(data, "housingData.packages_in_words", text);

  const digitMatch = text.match(/SAY\s+(\d+)/i);
  let count: number | null = digitMatch ? Number(digitMatch[1]) : null;
  let packageType: string | undefined;

  if (count == null) {
    const wordsMatch = text.match(
      /SAY\s+([A-Z][A-Z ]*?)\s+(PACKAGE(?:\(S\))?|PACKAGES|[A-Z0-9/_-]+)\s*ONLY\.?/i,
    );
    if (wordsMatch) {
      count = wordsToNumber(wordsMatch[1]);
      packageType = wordsMatch[2];
    }
  }

  if (count != null && Number.isFinite(count)) {
    next = setByPath(next, "housingData.summary.total_no_of_packages", count);
    next = setByPath(next, "housingData.total_packages", count);
    if (packageType?.trim()) {
      next = applySharedPackageType(next, packageType.trim());
    }
  }

  return next;
}

function syncFromMarksContainerType(
  data: BolPreviewRowData,
  index: number,
  raw: string,
): Record<string, unknown> {
  const value = raw.trim();
  let next = setByPath(
    data,
    `housingData.cargo_details[${index}].container_type_name`,
    value,
  );

  // Marks container type drives shared package type (and packages-in-words).
  if (value) {
    next = applySharedPackageType(next, value, {
      syncMarksContainerType: false,
    });
    const total = getPackagesTotal(next);
    const count = parseInt(String(total), 10);
    if (!isNaN(count) && count >= 0) {
      next = setByPath(
        next,
        "housingData.packages_in_words",
        buildPackagesInWords(count, value),
      );
    }
  }

  return next;
}

function getNotifyName(housing: Record<string, unknown>): string {
  return String(
    housing.notify_customer1_name || housing.notify1_customer_name || "",
  );
}

function getNotifyAddress(housing: Record<string, unknown>): string {
  return String(
    housing.notify_customer1_address || housing.notify1_customer_address || "",
  );
}

function getNotifyEmail(housing: Record<string, unknown>): string {
  return String(
    housing.notify_customer1_email || housing.notify1_customer_email || "",
  );
}

function getNotifyPan(housing: Record<string, unknown>): string {
  return String(
    housing.notify_customer1_pan || housing.notify1_customer_pan || "",
  );
}

function getVesselVoyDisplay(data: BolPreviewRowData): string {
  const carrier = getCarrierDetails(data);
  const vessel = String(carrier.vessel_name || "");
  const voyage = String(carrier.voyage_number || "");
  if (vessel && voyage) return `${vessel}/${voyage}`;
  return vessel || voyage;
}

function parseVesselVoyInput(
  raw: string,
  data: BolPreviewRowData,
): { vessel_name: string; voyage_number: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { vessel_name: "", voyage_number: "" };
  const slashIdx = trimmed.indexOf("/");
  if (slashIdx >= 0) {
    return {
      vessel_name: trimmed.slice(0, slashIdx).trim(),
      voyage_number: trimmed.slice(slashIdx + 1).trim(),
    };
  }
  const carrier = getCarrierDetails(data);
  if (!carrier.vessel_name && carrier.voyage_number) {
    return { vessel_name: "", voyage_number: trimmed };
  }
  return {
    vessel_name: trimmed,
    voyage_number: String(carrier.voyage_number || ""),
  };
}

function field(
  partial: EditableFieldDef & { columnWidthRatio: number },
): EditableFieldDef {
  return {
    ...partial,
    layoutZone: "content",
    pdfLineHeightMm: partial.pdfLineHeightMm ?? PDF_DEFAULT_LINE_HEIGHT_MM,
    getMatchValue:
      partial.getMatchValue ||
      (partial.multiline || partial.type === "textarea"
        ? (data, ctx) => firstMatchLine(partial.getDisplayValue(data, ctx))
        : undefined),
  };
}

/**
 * US Bill of Lading editable fields.
 * Excludes: B/L No, Export Reference, Header, Carrier, Signed By.
 */
function buildUsBolFieldRegistry(
  rowData: BolPreviewRowData,
): EditableFieldDef[] {
  const fields: EditableFieldDef[] = [
    // —— Shipper (left half) ——
    field({
      id: "bol_shipper_name",
      path: "housingData.shipper_name",
      editable: true,
      multiline: true,
      type: "textarea",
      columnWidthRatio: COL.half,
      getDisplayValue: (data) => String(getHousing(data).shipper_name || ""),
    }),
    field({
      id: "bol_shipper_address",
      path: "housingData.shipper_address",
      editable: true,
      multiline: true,
      type: "textarea",
      columnWidthRatio: COL.half,
      getDisplayValue: (data) => String(getHousing(data).shipper_address || ""),
    }),
    field({
      id: "bol_shipper_tel",
      path: "housingData.shipper_tel",
      editable: true,
      columnWidthRatio: COL.half,
      getDisplayValue: (data) => {
        const tel = getHousing(data).shipper_tel;
        return tel ? `TEL: ${tel}` : "";
      },
      parseInput: (raw) => stripPrefix(raw, /^TEL:\s*/i),
    }),
    field({
      id: "bol_shipper_fax",
      path: "housingData.shipper_fax",
      editable: true,
      columnWidthRatio: COL.half,
      getDisplayValue: (data) => {
        const fax = getHousing(data).shipper_fax;
        return fax ? `FAX: ${fax}` : "";
      },
      parseInput: (raw) => stripPrefix(raw, /^FAX:\s*/i),
    }),
    field({
      id: "bol_shipper_email",
      path: "housingData.shipper_email",
      editable: true,
      columnWidthRatio: COL.half,
      getDisplayValue: (data) => {
        const email = getHousing(data).shipper_email;
        return email ? `EMAIL: ${email}` : "";
      },
      parseInput: (raw) => stripPrefix(raw, /^EMAIL:\s*/i),
    }),

    // —— Forwarding Agent (right half) ——
    // matchOccurrence: 2 skips header company name (same text) so header stays non-editable.
    field({
      id: "bol_forwarding_agent_name",
      path: "housingData.forwarding_agent_name",
      editable: true,
      multiline: true,
      type: "textarea",
      columnWidthRatio: COL.half,
      matchOccurrence: 2,
      getDisplayValue: (data) =>
        String(
          getHousing(data).forwarding_agent_name || US_FWD_NAME_DEFAULT,
        ),
    }),
    field({
      id: "bol_forwarding_agent_address",
      path: "housingData.forwarding_agent_address",
      editable: true,
      multiline: true,
      type: "textarea",
      columnWidthRatio: COL.half,
      getDisplayValue: (data) =>
        String(
          getHousing(data).forwarding_agent_address || US_FWD_ADDRESS_DEFAULT,
        ),
    }),

    // —— Consignee (left half) ——
    field({
      id: "bol_consignee_name",
      path: "housingData.consignee_name",
      editable: true,
      multiline: true,
      type: "textarea",
      columnWidthRatio: COL.half,
      getDisplayValue: (data) => String(getHousing(data).consignee_name || ""),
    }),
    field({
      id: "bol_consignee_address",
      path: "housingData.consignee_address",
      editable: true,
      multiline: true,
      type: "textarea",
      columnWidthRatio: COL.half,
      getDisplayValue: (data) =>
        String(getHousing(data).consignee_address || ""),
    }),
    field({
      id: "bol_consignee_email",
      path: "housingData.consignee_email",
      editable: true,
      columnWidthRatio: COL.half,
      getDisplayValue: (data) => {
        const email = getHousing(data).consignee_email;
        return email ? `EMAIL: ${email}` : "";
      },
      parseInput: (raw) => stripPrefix(raw, /^EMAIL:\s*/i),
    }),
    field({
      id: "bol_consignee_pan",
      path: "housingData.consignee_pan",
      editable: true,
      columnWidthRatio: COL.half,
      getDisplayValue: (data) => {
        const h = getHousing(data);
        const id = h.consignee_pan || h.consignee_pan_no;
        return id ? `ID: ${id}` : "";
      },
      parseInput: (raw) => stripPrefix(raw, /^ID:\s*/i),
    }),

    // —— Delivery Agent (right half) ——
    field({
      id: "bol_delivery_agent_name",
      path: "housingData.agent_name",
      editable: true,
      multiline: true,
      type: "textarea",
      columnWidthRatio: COL.half,
      getDisplayValue: (data) => String(getHousing(data).agent_name || ""),
    }),
    field({
      id: "bol_delivery_agent_address",
      path: "housingData.agent_address",
      editable: true,
      multiline: true,
      type: "textarea",
      columnWidthRatio: COL.half,
      getDisplayValue: (data) => String(getHousing(data).agent_address || ""),
    }),
    field({
      id: "bol_delivery_agent_tax",
      path: "housingData.agent_gst_no",
      editable: true,
      columnWidthRatio: COL.half,
      getDisplayValue: (data) => {
        const tax = getHousing(data).agent_gst_no;
        return tax ? `Tax ID: ${tax}` : "";
      },
      parseInput: (raw) => stripPrefix(raw, /^Tax ID:\s*/i),
    }),
    field({
      id: "bol_delivery_agent_tel",
      path: "housingData.agent_phone",
      editable: true,
      columnWidthRatio: COL.half,
      getDisplayValue: (data) => {
        const tel = getHousing(data).agent_phone;
        return tel ? `TEL: ${tel}` : "";
      },
      parseInput: (raw) => stripPrefix(raw, /^TEL:\s*/i),
    }),
    field({
      id: "bol_delivery_agent_email",
      path: "housingData.agent_email",
      editable: true,
      columnWidthRatio: COL.half,
      getDisplayValue: (data) => {
        const email = getHousing(data).agent_email;
        return email ? `EMAIL: ${email}` : "";
      },
      parseInput: (raw) => stripPrefix(raw, /^EMAIL:\s*/i),
    }),

    // —— Notify Party (left half) ——
    field({
      id: "bol_notify_name",
      path: "housingData.notify_customer1_name",
      editable: true,
      multiline: true,
      type: "textarea",
      columnWidthRatio: COL.half,
      getDisplayValue: (data) => {
        const h = getHousing(data);
        const name = getNotifyName(h);
        const address = getNotifyAddress(h);
        if (!name.trim() && !address.trim()) return "SAME AS CONSIGNEE";
        return name;
      },
      parseInput: (raw) => {
        const value = raw.trim();
        if (/^SAME AS CONSIGNEE$/i.test(value)) {
          return {
            notify_customer1_name: "",
            notify1_customer_name: "",
          };
        }
        return {
          notify_customer1_name: value,
          notify1_customer_name: value,
        };
      },
    }),
    field({
      id: "bol_notify_address",
      path: "housingData.notify_customer1_address",
      editable: true,
      multiline: true,
      type: "textarea",
      columnWidthRatio: COL.half,
      getDisplayValue: (data) => getNotifyAddress(getHousing(data)),
      parseInput: (raw) => ({
        notify_customer1_address: raw,
        notify1_customer_address: raw,
      }),
    }),
    field({
      id: "bol_notify_email",
      path: "housingData.notify_customer1_email",
      editable: true,
      columnWidthRatio: COL.half,
      getDisplayValue: (data) => {
        const email = getNotifyEmail(getHousing(data));
        return email ? `EMAIL: ${email}` : "";
      },
      parseInput: (raw) => {
        const value = stripPrefix(raw, /^EMAIL:\s*/i);
        return {
          notify_customer1_email: value,
          notify1_customer_email: value,
        };
      },
    }),
    field({
      id: "bol_notify_pan",
      path: "housingData.notify_customer1_pan",
      editable: true,
      columnWidthRatio: COL.half,
      getDisplayValue: (data) => {
        const pan = getNotifyPan(getHousing(data));
        return pan ? `ID: ${pan}` : "";
      },
      parseInput: (raw) => {
        const value = stripPrefix(raw, /^ID:\s*/i);
        return {
          notify_customer1_pan: value,
          notify1_customer_pan: value,
        };
      },
    }),

    // —— Vessel / ports (right quarter cells) ——
    field({
      id: "bol_vessel_voy",
      path: "jobData.carrierDetails.vessel_name",
      editable: true,
      columnWidthRatio: COL.half,
      getDisplayValue: (data) => getVesselVoyDisplay(data),
      parseInput: (raw, data) => parseVesselVoyInput(raw, data),
    }),
    field({
      id: "bol_place_of_receipt",
      path: "housingData.place_of_acceptance",
      editable: true,
      columnWidthRatio: COL.quarter,
      getDisplayValue: (data) => {
        const h = getHousing(data);
        return String(h.place_of_acceptance || h.origin_name || "");
      },
    }),
    field({
      id: "bol_port_of_loading",
      path: "jobData.mblDetails.origin_name",
      editable: true,
      columnWidthRatio: COL.quarter,
      getDisplayValue: (data) => {
        const m = getMblDetails(data);
        const j = getJob(data);
        return String(m.origin_name || j.origin_name || "");
      },
    }),
    field({
      id: "bol_port_of_discharge",
      path: "jobData.mblDetails.destination_name",
      editable: true,
      columnWidthRatio: COL.quarter,
      getDisplayValue: (data) => {
        const m = getMblDetails(data);
        const j = getJob(data);
        return String(m.destination_name || j.destination_name || "");
      },
    }),
    field({
      id: "bol_place_of_delivery",
      path: "housingData.place_of_delivery",
      editable: true,
      columnWidthRatio: COL.quarter,
      getDisplayValue: (data) => {
        const h = getHousing(data);
        return String(h.place_of_delivery || h.destination_name || "");
      },
    }),

    // —— Cargo table ——
    field({
      id: "bol_marks_no",
      path: "housingData.marks_no",
      editable: true,
      multiline: true,
      type: "textarea",
      columnWidthRatio: COL.marks,
      getDisplayValue: (data) => String(getHousing(data).marks_no || ""),
    }),
    // Per-container Marks & Numbers lines (mirrors BillOfLadingPDFTemplateUS marks column)
    ...(() => {
      const housing = getHousing(rowData);
      const cargoDetails = Array.isArray(housing.cargo_details)
        ? housing.cargo_details
        : [];
      const marksFields: EditableFieldDef[] = [];
      cargoDetails.forEach((_, index) => {
        marksFields.push(
          field({
            id: `bol_marks_container_no_${index}`,
            path: `housingData.cargo_details[${index}].container_no`,
            editable: true,
            columnWidthRatio: COL.marks,
            getDisplayValue: (data) =>
              String(getCargoAt(data, index).container_no || ""),
          }),
          field({
            id: `bol_marks_container_type_${index}`,
            path: `housingData.cargo_details[${index}].container_type_name`,
            editable: true,
            columnWidthRatio: COL.marks,
            getDisplayValue: (data) => resolveContainerTypeName(data, index),
            applyEdit: (data, raw) =>
              syncFromMarksContainerType(data, index, raw),
          }),
          field({
            id: `bol_marks_seal_${index}`,
            path: `housingData.cargo_details[${index}].actual_seal_no`,
            editable: true,
            columnWidthRatio: COL.marks,
            getDisplayValue: (data) => {
              const seal = getCargoAt(data, index).actual_seal_no;
              return seal ? `Seal No: ${seal}` : "";
            },
            parseInput: (raw) => stripPrefix(raw, /^Seal No:\s*/i),
          }),
          field({
            id: `bol_marks_gross_wt_${index}`,
            path: `housingData.cargo_details[${index}].gross_weight`,
            editable: true,
            columnWidthRatio: COL.marks,
            getDisplayValue: (data) => {
              const gw = getCargoAt(data, index).gross_weight;
              return gw !== undefined && gw !== null && gw !== ""
                ? `Gross Wt: ${gw} KGS`
                : "";
            },
            parseInput: (raw) =>
              stripPrefix(raw, /^Gross Wt:\s*/i).replace(/\s*KGS\s*$/i, "").trim(),
          }),
          field({
            id: `bol_marks_volume_${index}`,
            path: `housingData.cargo_details[${index}].volume`,
            editable: true,
            columnWidthRatio: COL.marks,
            getDisplayValue: (data) => {
              const vol = getCargoAt(data, index).volume;
              return vol !== undefined && vol !== null && vol !== ""
                ? `Volume: ${vol} CBM`
                : "";
            },
            parseInput: (raw) =>
              stripPrefix(raw, /^Volume:\s*/i).replace(/\s*CBM\s*$/i, "").trim(),
          }),
          field({
            id: `bol_marks_pkgs_${index}`,
            path: `housingData.cargo_details[${index}].no_of_packages`,
            editable: true,
            columnWidthRatio: COL.marks,
            getDisplayValue: (data) => {
              const pkgs = getCargoAt(data, index).no_of_packages;
              if (pkgs === undefined || pkgs === null || pkgs === "") return "";
              const cargoPackageType =
                formatPackageTypeNameForBol(
                  getCargoAt(data, index).package_type as string | undefined,
                ) || getPackageType(data);
              return `Pkgs: ${pkgs} ${cargoPackageType}`;
            },
            parseInput: (raw) => {
              const cleaned = stripPrefix(raw, /^Pkgs:\s*/i)
                .replace(/^\s*(\d+(?:\.\d+)?)\b.*$/, "$1")
                .trim();
              const num = parseFloat(cleaned);
              return Number.isFinite(num) ? num : cleaned.trim();
            },
          }),
        );
      });
      return marksFields;
    })(),
    field({
      id: "bol_packages",
      path: "housingData.summary.total_no_of_packages",
      editable: true,
      columnWidthRatio: COL.packages,
      getDisplayValue: (data) => {
        const total = getPackagesTotal(data);
        if (total === "" || total == null) return "";
        const packageType = getPackageType(data);
        return `${total}${packageType ? ` ${packageType}` : ""}`;
      },
      applyEdit: (data, raw) => {
        const match = raw.trim().match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
        if (!match) {
          const fallback = Number(raw.trim());
          if (!Number.isFinite(fallback)) return data;
          return syncPackagesFromCount(data, fallback);
        }
        const count = Number(match[1]);
        const typeFromInput = match[2]?.trim();
        return syncPackagesFromCount(
          data,
          count,
          typeFromInput || undefined,
        );
      },
    }),
    field({
      id: "bol_commodity_description",
      path: "housingData.commodity_description",
      editable: true,
      multiline: true,
      type: "textarea",
      columnWidthRatio: COL.description,
      getDisplayValue: (data) =>
        String(getHousing(data).commodity_description || ""),
    }),
    field({
      id: "bol_hs_code",
      path: "housingData.hs_code",
      editable: true,
      columnWidthRatio: COL.description,
      getDisplayValue: (data) => {
        const h = getHousing(data);
        const hs = h.hs_code || h.item_no;
        return hs ? `NCM: ${hs}` : "";
      },
      parseInput: (raw) => stripPrefix(raw, /^NCM:\s*/i),
    }),
    field({
      id: "bol_gross_weight",
      path: "housingData.summary.total_gross_weight",
      editable: true,
      columnWidthRatio: COL.cargoNarrow,
      getDisplayValue: (data) => {
        const summary = getSummary(data);
        const housing = getHousing(data);
        const total =
          summary.total_gross_weight ||
          housing.total_gross_weight_kgs ||
          (housing.cargo_summary as Record<string, unknown> | undefined)
            ?.gross_weight_kgs ||
          "";
        if (total === "" || total == null) return "";
        return `${formatDecimal(total)} KGS`;
      },
      parseInput: (raw) => {
        const num = parseFloat(stripPrefix(raw, /\s*KGS\s*$/i));
        return Number.isFinite(num) ? num : raw.trim();
      },
    }),
    field({
      id: "bol_measurement",
      path: "housingData.summary.total_volume",
      editable: true,
      columnWidthRatio: COL.cargoNarrow,
      getDisplayValue: (data) => {
        const summary = getSummary(data);
        const housing = getHousing(data);
        const total =
          summary.total_volume ||
          housing.total_volume_cbm ||
          (housing.cargo_summary as Record<string, unknown> | undefined)
            ?.volume_cbm ||
          "";
        if (total === "" || total == null) return "";
        return `${formatDecimal(total)} CBM`;
      },
      parseInput: (raw) => {
        const num = parseFloat(stripPrefix(raw, /\s*CBM\s*$/i));
        return Number.isFinite(num) ? num : raw.trim();
      },
    }),

    // —— Packages in words (synced with bol_packages) ——
    field({
      id: "bol_packages_in_words",
      path: "housingData.packages_in_words",
      editable: true,
      multiline: true,
      type: "textarea",
      columnWidthRatio: COL.fullInner,
      getDisplayValue: (data) => {
        const housing = getHousing(data);
        if (housing.packages_in_words) {
          return String(housing.packages_in_words);
        }
        const total = getPackagesTotal(data);
        if (total === "" || total == null) return "";
        const packageType = getPackageType(data);
        const count = parseInt(String(total), 10);
        if (!isNaN(count)) {
          return buildPackagesInWords(count, packageType);
        }
        return `SAY ${total}${packageType ? ` ${packageType}` : ""} ONLY.`;
      },
      applyEdit: (data, raw) => syncPackagesFromWords(data, raw),
    }),

    // —— Footer cells (not Carrier / Signed By) ——
    field({
      id: "bol_shipped_on_board",
      path: "jobData.carrierDetails.etd",
      editable: true,
      columnWidthRatio: COL.footer,
      getDisplayValue: (data) => {
        const carrier = getCarrierDetails(data);
        const mbl = getMblDetails(data);
        const job = getJob(data);
        return formatUsDate(carrier.etd || mbl.etd || job.etd);
      },
    }),
    field({
      id: "bol_number_of_originals",
      path: "housingData.number_of_originals",
      editable: true,
      columnWidthRatio: COL.footer,
      getDisplayValue: (data) => {
        const h = getHousing(data);
        return String(
          h.number_of_originals ?? h.no_of_originals ?? "3 / THREE",
        );
      },
    }),
    field({
      id: "bol_freight_terms",
      path: "housingData.pp_cc",
      editable: true,
      columnWidthRatio: COL.footer,
      getDisplayValue: (data) => {
        const freight = normalizeFreightTerm(getHousing(data).pp_cc);
        return freight ? `FREIGHT ${freight}` : "";
      },
      parseInput: (raw) => {
        const normalized = normalizeFreightTerm(
          raw.replace(/^FREIGHT\s+/i, ""),
        );
        return normalized || raw.trim();
      },
    }),
    field({
      id: "bol_date_of_issue",
      path: "housingData.date_of_issue",
      editable: true,
      columnWidthRatio: COL.footer,
      getDisplayValue: (data) => {
        const h = getHousing(data);
        if (h.date_of_issue) return formatUsDate(h.date_of_issue);
        return formatUsDate(new Date().toISOString());
      },
    }),
    field({
      id: "bol_place_of_issue",
      path: "housingData.place_of_issue",
      editable: true,
      columnWidthRatio: COL.footer,
      getDisplayValue: (data) => {
        const h = getHousing(data);
        if (h.place_of_issue) return String(h.place_of_issue);
        const branch = data.defaultBranch as
          | { branch_name?: string }
          | null
          | undefined;
        return String(branch?.branch_name || "United States");
      },
    }),
  ];

  return fields.filter((f) => {
    if (!f.editable) return false;
    const display = f.getDisplayValue(rowData, {});
    return Boolean(display && String(display).trim());
  });
}

/** India / non-US MTD column widths as fraction of A4 (210mm, ~10mm side margins). */
const INDIA_COL = {
  half: 95 / 210,
  third: (95 / 3) / 210,
  vessel: (190 * 0.25) / 210,
  marks: (190 * 0.14) / 210,
  description: (190 * 0.44) / 210,
  cargoNarrow: (190 * 0.12) / 210,
  container: (190 * 0.18) / 210,
  footerThird: (190 * (0.18 + 0.14 + 0.44) / 3) / 210,
  footerRight: (190 * (0.12 + 0.12)) / 210,
} as const;

function formatIndiaBolDate(dateString: unknown): string {
  if (!dateString) return "";
  try {
    const date = new Date(dateString as string);
    if (isNaN(date.getTime())) return "";
    const day = String(date.getDate()).padStart(2, "0");
    const monthNames = [
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY",
      "JUN",
      "JUL",
      "AUG",
      "SEP",
      "OCT",
      "NOV",
      "DEC",
    ];
    const year = String(date.getFullYear()).slice(-2);
    return `${day}-${monthNames[date.getMonth()]}-${year}`;
  } catch {
    return "";
  }
}

function getIndiaVesselVoyDisplay(data: BolPreviewRowData): string {
  const carrier = getCarrierDetails(data);
  const vessel = String(carrier.vessel_name || "");
  const voyage = String(carrier.voyage_number || "");
  if (vessel && voyage) return `${vessel} / ${voyage}`;
  return vessel || voyage;
}

function getIndiaDeliveryAgent(data: BolPreviewRowData): {
  name: string;
  address: string;
  email: string;
} {
  const mbl = getMblDetails(data);
  const isDirect = Boolean(mbl.is_direct);
  return {
    name: String(
      isDirect ? mbl.consignee_name || "" : mbl.agent_name || "",
    ),
    address: String(
      isDirect ? mbl.consignee_address || "" : mbl.agent_address || "",
    ),
    email: String(
      isDirect ? mbl.consignee_email || "" : mbl.agent_email || "",
    ),
  };
}

function isUsBolRowData(rowData: BolPreviewRowData): boolean {
  const codes: string[] = [];
  const names: string[] = [];
  const add = (code?: unknown, name?: unknown) => {
    if (code) codes.push(String(code).trim().toUpperCase());
    if (name) names.push(String(name).trim().toUpperCase());
  };
  const country = rowData.country as
    | { country_code?: string; country_name?: string }
    | null
    | undefined;
  const branch = rowData.defaultBranch as
    | { country?: { country_code?: string; country_name?: string } }
    | null
    | undefined;
  add(country?.country_code, country?.country_name);
  add(branch?.country?.country_code, branch?.country?.country_name);
  return (
    codes.includes("US") ||
    names.some((n) => n.includes("USA") || n.includes("UNITED STATES"))
  );
}

/**
 * India / non-US Multimodal Transport Document editable fields.
 * Matches BillOfLadingPDFTemplate India layout text.
 */
function buildIndiaBolFieldRegistry(
  rowData: BolPreviewRowData,
): EditableFieldDef[] {
  const fields: EditableFieldDef[] = [
    field({
      id: "bol_shipper_name",
      path: "housingData.shipper_name",
      editable: true,
      multiline: true,
      type: "textarea",
      columnWidthRatio: INDIA_COL.half,
      getDisplayValue: (data) => String(getHousing(data).shipper_name || ""),
    }),
    field({
      id: "bol_shipper_address",
      path: "housingData.shipper_address",
      editable: true,
      multiline: true,
      type: "textarea",
      columnWidthRatio: INDIA_COL.half,
      getDisplayValue: (data) => String(getHousing(data).shipper_address || ""),
    }),
    field({
      id: "bol_consignee_name",
      path: "housingData.consignee_name",
      editable: true,
      multiline: true,
      type: "textarea",
      columnWidthRatio: INDIA_COL.half,
      getDisplayValue: (data) => String(getHousing(data).consignee_name || ""),
    }),
    field({
      id: "bol_consignee_address",
      path: "housingData.consignee_address",
      editable: true,
      multiline: true,
      type: "textarea",
      columnWidthRatio: INDIA_COL.half,
      getDisplayValue: (data) =>
        String(getHousing(data).consignee_address || ""),
    }),
    field({
      id: "bol_notify_name",
      path: "housingData.notify_customer1_name",
      editable: true,
      multiline: true,
      type: "textarea",
      columnWidthRatio: INDIA_COL.half,
      getDisplayValue: (data) => getNotifyName(getHousing(data)),
      parseInput: (raw) => ({
        notify_customer1_name: raw,
        notify1_customer_name: raw,
      }),
    }),
    field({
      id: "bol_notify_address",
      path: "housingData.notify_customer1_address",
      editable: true,
      multiline: true,
      type: "textarea",
      columnWidthRatio: INDIA_COL.half,
      getDisplayValue: (data) => getNotifyAddress(getHousing(data)),
      parseInput: (raw) => ({
        notify_customer1_address: raw,
        notify1_customer_address: raw,
      }),
    }),
    field({
      id: "bol_place_of_acceptance",
      path: "housingData.origin_name",
      editable: true,
      columnWidthRatio: INDIA_COL.third,
      getDisplayValue: (data) => String(getHousing(data).origin_name || ""),
    }),
    field({
      id: "bol_date_of_acceptance",
      path: "jobData.carrierDetails.mbl_date",
      editable: true,
      columnWidthRatio: INDIA_COL.third,
      getDisplayValue: (data) =>
        formatIndiaBolDate(getCarrierDetails(data).mbl_date),
    }),
    field({
      id: "bol_port_of_loading",
      path: "jobData.mblDetails.origin_name",
      editable: true,
      columnWidthRatio: INDIA_COL.third,
      getDisplayValue: (data) => {
        const m = getMblDetails(data);
        const j = getJob(data);
        return String(m.origin_name || j.origin_name || "");
      },
    }),
    field({
      id: "bol_port_of_discharge",
      path: "jobData.mblDetails.destination_name",
      editable: true,
      columnWidthRatio: INDIA_COL.half,
      getDisplayValue: (data) => {
        const m = getMblDetails(data);
        const j = getJob(data);
        return String(m.destination_name || j.destination_name || "");
      },
    }),
    field({
      id: "bol_place_of_delivery",
      path: "housingData.destination_name",
      editable: true,
      columnWidthRatio: INDIA_COL.half,
      getDisplayValue: (data) =>
        String(getHousing(data).destination_name || ""),
    }),
    field({
      id: "bol_delivery_agent_name",
      path: "jobData.mblDetails.agent_name",
      editable: true,
      multiline: true,
      type: "textarea",
      columnWidthRatio: INDIA_COL.half,
      getDisplayValue: (data) => getIndiaDeliveryAgent(data).name,
    }),
    field({
      id: "bol_delivery_agent_address",
      path: "jobData.mblDetails.agent_address",
      editable: true,
      multiline: true,
      type: "textarea",
      columnWidthRatio: INDIA_COL.half,
      getDisplayValue: (data) => getIndiaDeliveryAgent(data).address,
    }),
    field({
      id: "bol_delivery_agent_email",
      path: "jobData.mblDetails.agent_email",
      editable: true,
      columnWidthRatio: INDIA_COL.half,
      getDisplayValue: (data) => {
        const email = getIndiaDeliveryAgent(data).email;
        return email ? `Email: ${email}` : "";
      },
      parseInput: (raw) => stripPrefix(raw, /^Email:\s*/i),
    }),
    field({
      id: "bol_vessel_voy",
      path: "jobData.carrierDetails.vessel_name",
      editable: true,
      columnWidthRatio: INDIA_COL.vessel,
      getDisplayValue: (data) => getIndiaVesselVoyDisplay(data),
      parseInput: (raw, data) => parseVesselVoyInput(raw, data),
    }),
    field({
      id: "bol_marks_no",
      path: "housingData.marks_no",
      editable: true,
      multiline: true,
      type: "textarea",
      columnWidthRatio: INDIA_COL.marks,
      getDisplayValue: (data) => String(getHousing(data).marks_no || ""),
    }),
    ...(() => {
      const housing = getHousing(rowData);
      const cargoDetails = Array.isArray(housing.cargo_details)
        ? housing.cargo_details
        : [];
      const marksFields: EditableFieldDef[] = [];
      cargoDetails.forEach((_, index) => {
        marksFields.push(
          field({
            id: `bol_marks_container_no_${index}`,
            path: `housingData.cargo_details.${index}.container_no`,
            editable: true,
            columnWidthRatio: INDIA_COL.container,
            getDisplayValue: (data) =>
              String(getCargoAt(data, index).container_no || ""),
          }),
          field({
            id: `bol_marks_container_type_${index}`,
            path: `housingData.cargo_details.${index}.container_type_name`,
            editable: true,
            columnWidthRatio: INDIA_COL.container,
            getDisplayValue: (data) => resolveContainerTypeName(data, index),
          }),
          field({
            id: `bol_marks_seal_${index}`,
            path: `housingData.cargo_details.${index}.actual_seal_no`,
            editable: true,
            columnWidthRatio: INDIA_COL.container,
            getDisplayValue: (data) => {
              const seal = getCargoAt(data, index).actual_seal_no;
              return seal ? `Seal No: ${seal}` : "";
            },
            parseInput: (raw) => stripPrefix(raw, /^Seal No:\s*/i),
          }),
          field({
            id: `bol_marks_gross_wt_${index}`,
            path: `housingData.cargo_details.${index}.gross_weight`,
            editable: true,
            columnWidthRatio: INDIA_COL.container,
            getDisplayValue: (data) => {
              const wt = getCargoAt(data, index).gross_weight;
              return wt ? `Gross Wt: ${wt} KGS` : "";
            },
            parseInput: (raw) =>
              stripPrefix(raw, /^Gross Wt:\s*/i)
                .replace(/\s*KGS\s*$/i, "")
                .trim(),
          }),
          field({
            id: `bol_marks_volume_${index}`,
            path: `housingData.cargo_details.${index}.volume`,
            editable: true,
            columnWidthRatio: INDIA_COL.container,
            getDisplayValue: (data) => {
              const vol = getCargoAt(data, index).volume;
              return vol !== undefined && vol !== null && vol !== ""
                ? `Volume: ${vol} CBM`
                : "";
            },
            parseInput: (raw) =>
              stripPrefix(raw, /^Volume:\s*/i)
                .replace(/\s*CBM\s*$/i, "")
                .trim(),
          }),
          field({
            id: `bol_marks_pkgs_${index}`,
            path: `housingData.cargo_details.${index}.no_of_packages`,
            editable: true,
            columnWidthRatio: INDIA_COL.container,
            getDisplayValue: (data) => {
              const pkgs = getCargoAt(data, index).no_of_packages;
              if (!pkgs) return "";
              const cargoPackageType =
                formatPackageTypeNameForBol(
                  getCargoAt(data, index).package_type as string | undefined,
                ) || getPackageType(data);
              return `Pkgs: ${pkgs} ${cargoPackageType}`;
            },
            parseInput: (raw) => {
              const cleaned = stripPrefix(raw, /^Pkgs:\s*/i)
                .replace(/^\s*(\d+(?:\.\d+)?)\b.*$/, "$1")
                .trim();
              const num = parseFloat(cleaned);
              return Number.isFinite(num) ? num : cleaned.trim();
            },
          }),
        );
      });
      return marksFields;
    })(),
    field({
      id: "bol_packages",
      path: "housingData.summary.total_no_of_packages",
      editable: true,
      columnWidthRatio: INDIA_COL.description,
      getDisplayValue: (data) => {
        const total = getSummary(data).total_no_of_packages;
        if (total === "" || total == null) return "";
        const packageType = getPackageType(data);
        return `${total} ${packageType}`;
      },
      parseInput: (raw) => {
        const cleaned = raw
          .replace(/^\s*(\d+(?:\.\d+)?)\b.*$/, "$1")
          .trim();
        const num = parseFloat(cleaned);
        return Number.isFinite(num) ? num : cleaned;
      },
    }),
    field({
      id: "bol_commodity_description",
      path: "housingData.commodity_description",
      editable: true,
      multiline: true,
      type: "textarea",
      columnWidthRatio: INDIA_COL.description,
      getDisplayValue: (data) =>
        String(getHousing(data).commodity_description || ""),
    }),
    field({
      id: "bol_gross_weight",
      path: "housingData.summary.total_gross_weight",
      editable: true,
      columnWidthRatio: INDIA_COL.cargoNarrow,
      getDisplayValue: (data) => {
        const total = getSummary(data).total_gross_weight;
        if (total === "" || total == null) return "";
        return `${total} KGS`;
      },
      parseInput: (raw) => {
        const num = parseFloat(stripPrefix(raw, /\s*KGS\s*$/i));
        return Number.isFinite(num) ? num : raw.trim();
      },
    }),
    field({
      id: "bol_measurement",
      path: "housingData.summary.total_volume",
      editable: true,
      columnWidthRatio: INDIA_COL.cargoNarrow,
      getDisplayValue: (data) => {
        const total = getSummary(data).total_volume;
        if (total === "" || total == null) return "";
        return `${total} CBM`;
      },
      parseInput: (raw) => {
        const num = parseFloat(stripPrefix(raw, /\s*CBM\s*$/i));
        return Number.isFinite(num) ? num : raw.trim();
      },
    }),
    field({
      id: "bol_freight_payable_at",
      path: "housingData.freight_payable_at",
      editable: true,
      columnWidthRatio: INDIA_COL.footerThird,
      getDisplayValue: (data) =>
        String(getHousing(data).freight_payable_at || "DESTINATION"),
    }),
    field({
      id: "bol_number_of_originals",
      path: "housingData.number_of_originals",
      editable: true,
      columnWidthRatio: INDIA_COL.footerThird,
      getDisplayValue: (data) => {
        const h = getHousing(data);
        return String(
          h.number_of_originals ?? h.no_of_originals ?? "0/ZERO",
        );
      },
    }),
    field({
      id: "bol_place_and_date_of_issue",
      path: "housingData.place_and_date_of_issue",
      editable: true,
      columnWidthRatio: INDIA_COL.footerRight,
      getDisplayValue: (data) => {
        const h = getHousing(data);
        if (h.place_and_date_of_issue) {
          return String(h.place_and_date_of_issue);
        }
        if (h.place_of_issue && h.date_of_issue) {
          return `${h.place_of_issue} / ${formatIndiaBolDate(h.date_of_issue)}`;
        }
        const m = getMblDetails(data);
        const j = getJob(data);
        const origin = String(m.origin_name || j.origin_name || "");
        const date =
          formatIndiaBolDate(getCarrierDetails(data).mbl_date) ||
          formatIndiaBolDate(new Date().toISOString());
        return origin ? `${origin} / ${date}` : date;
      },
    }),
  ];

  return fields.filter((f) => {
    if (!f.editable) return false;
    const display = f.getDisplayValue(rowData, {});
    return Boolean(display && String(display).trim());
  });
}

/**
 * Bill of Lading editable fields — US template vs India/MTD layout.
 */
export function buildBolFieldRegistry(
  rowData: BolPreviewRowData,
): EditableFieldDef[] {
  if (isUsBolRowData(rowData)) {
    return buildUsBolFieldRegistry(rowData);
  }
  return buildIndiaBolFieldRegistry(rowData);
}
