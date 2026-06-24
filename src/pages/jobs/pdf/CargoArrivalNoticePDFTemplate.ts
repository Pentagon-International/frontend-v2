import { jsPDF } from "jspdf";
import pentagonFreightInd from "../../../assets/images/pentagon-freight-ind.png";
import pentagonPrimeAmericas from "../../../assets/images/PentagonPrimeUSA.png";
import pentagonPrimeChina from "../../../assets/images/PentagonPrimeChina.png";
import cargoConsolidators from "../../../assets/images/CCIPL.png";
import primeLogo from "../../../assets/images/prime.png";
import {
  CCT_BRANCH_INFO,
  getCctLogo,
  isCctCompany,
} from "../../../utils/pdfCompanyBranding";
import type { CanSacWiseTotal } from "./canGstBreakup";
import { isIndianUserFromProfile } from "../../../utils/userNumberFormat";

// Helper function for date formatting (DD-MMM-YY)
const formatDate = (dateString: any) => {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
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
    const month = monthNames[date.getMonth()];
    const year = String(date.getFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
  } catch {
    return "";
  }
};

// Helper function to format date for display (DD-MMM-YY)
const formatDateForDisplay = (dateString: any) => {
  return formatDate(dateString);
};

const isNumericId = (value: unknown): boolean => {
  if (value == null || value === "") return false;
  return /^\d+$/.test(String(value).trim());
};

// Prefer currency code from details; ocean API may store numeric ID in charge.currency
const getChargeCurrencyCode = (charge: Record<string, unknown>): string => {
  const currencyDetails = charge.currency_details as
    | { currency_code?: string; code?: string }
    | undefined;

  const codeFromDetails =
    currencyDetails?.currency_code ||
    currencyDetails?.code ||
    charge.currency_code;
  if (codeFromDetails) return String(codeFromDetails).trim();

  const currency = charge.currency;
  if (currency == null || currency === "") return "";
  if (isNumericId(currency)) return "";

  return String(currency).trim();
};

const hasChargeAmount = (charge: Record<string, unknown>): boolean => {
  const sellLocalAmount = charge.sell_local_amount;
  if (sellLocalAmount != null && sellLocalAmount !== "") return true;
  const amount = charge.amount;
  return amount != null && amount !== "";
};

const getChargeDisplayAmount = (charge: Record<string, unknown>): string => {
  const sellLocalAmount = charge.sell_local_amount;
  if (sellLocalAmount != null && sellLocalAmount !== "") {
    return String(sellLocalAmount);
  }
  const amount = charge.amount;
  return amount != null && amount !== undefined ? String(amount) : "";
};

const normalizePpCcForCan = (value: unknown): string => {
  const raw = String(value ?? "").trim().toUpperCase();
  if (raw === "PP" || raw === "PREPAID") return "Prepaid";
  if (raw === "CC" || raw === "COLLECT") return "Collect";
  return String(value ?? "").trim();
};

const isCollectCanCharge = (charge: Record<string, unknown>): boolean =>
  normalizePpCcForCan(charge.pp_cc) === "Collect";

const formatCanTaxChargeName = (row: CanSacWiseTotal): string => {
  const taxName = String(row.charge_name ?? "").trim();
  const rate = row.rate;
  const rateType = row.rate_type ?? "";
  const rateLabel = rate != null ? `${rate}${rateType}` : "";

  if (taxName && rateLabel) return `${taxName} ${rateLabel}`;
  return taxName;
};

const normalizeCanChargeNameForTaxMatch = (name: unknown): string =>
  String(name ?? "").trim().toLowerCase();

/** Union of base charge names referenced in calculate-gst-breakup sac_wise_totals. */
const buildCanTaxableChargeNamesSet = (
  totals: CanSacWiseTotal[],
): Set<string> => {
  const names = new Set<string>();
  for (const row of totals) {
    for (const chargeName of row.charge_names ?? []) {
      const normalized = normalizeCanChargeNameForTaxMatch(chargeName);
      if (normalized) names.add(normalized);
    }
  }
  return names;
};

const isCanBaseChargeTaxable = (
  charge: Record<string, unknown>,
  taxableChargeNames: Set<string>,
): boolean => {
  if (charge.is_can_tax_row === true) return false;
  const name = normalizeCanChargeNameForTaxMatch(charge.charge_name);
  return Boolean(name && taxableChargeNames.has(name));
};

const drawCanTaxTickMark = (
  doc: jsPDF,
  x: number,
  colWidth: number,
  y: number,
) => {
  doc.setFont("zapfdingbats", "normal");
  doc.text("4", x + colWidth / 2, y, { align: "center" });
  doc.setFont("helvetica", "normal");
};

const buildCanChargesColumnWidths = (
  tableWidth: number,
  includeTaxColumn: boolean,
): number[] => {
  if (!includeTaxColumn) {
    const w0 = Math.round(tableWidth * 0.38);
    const w1 = Math.round(tableWidth * 0.14);
    const w2 = Math.round(tableWidth * 0.12);
    const w3 = Math.round(tableWidth * 0.14);
    const w4 = Math.round(tableWidth * 0.1);
    const w5 = tableWidth - (w0 + w1 + w2 + w3 + w4);
    return [w0, w1, w2, w3, w4, w5];
  }

  const w0 = Math.round(tableWidth * 0.34);
  const w1 = Math.round(tableWidth * 0.13);
  const w2 = Math.round(tableWidth * 0.11);
  const w3 = Math.round(tableWidth * 0.13);
  const w4 = Math.round(tableWidth * 0.09);
  const w5 = Math.round(tableWidth * 0.12);
  const w6 = tableWidth - (w0 + w1 + w2 + w3 + w4 + w5);
  return [w0, w1, w2, w3, w4, w5, w6];
};

const CAN_CHARGES_HEADERS_BASE = [
  "Charges",
  "Currency",
  "Units",
  "Per unit",
  "ROE",
  "Amt",
] as const;

const getCanChargesHeaders = (includeTaxColumn: boolean): string[] =>
  includeTaxColumn
    ? [...CAN_CHARGES_HEADERS_BASE, "Tax"]
    : [...CAN_CHARGES_HEADERS_BASE];

const sacWiseTotalsToCanCharges = (
  totals: CanSacWiseTotal[],
): Record<string, unknown>[] =>
  totals
    .filter((row) => {
      const name = String(row.charge_name ?? "")
        .trim()
        .toUpperCase();
      const rate = Number(row.rate ?? 0);
      if (
        (name === "IGST" || name === "CGST" || name === "SGST") &&
        rate <= 0
      ) {
        return false;
      }
      return row.total_amount != null;
    })
    .map((row) => ({
      charge_name: formatCanTaxChargeName(row),
      currency_code: row.currency_code ?? "INR",
      currency: row.currency_code ?? "INR",
      sell_local_amount: row.total_amount,
      is_can_tax_row: true,
      no_of_unit: "",
      amount_per_unit: "",
      roe: "",
    }));

const isDisplayableCanCharge = (charge: Record<string, unknown>): boolean => {
  const chargeName = String(charge.charge_name ?? "").trim();
  const currency = getChargeCurrencyCode(charge);
  return Boolean(chargeName && currency && hasChargeAmount(charge));
};

const drawCenteredTableHeader = (
  doc: jsPDF,
  text: string,
  x: number,
  colWidth: number,
  y: number
) => {
  doc.text(text, x + colWidth / 2, y, { align: "center" });
};

const drawCenteredTableCell = (
  doc: jsPDF,
  text: string,
  x: number,
  colWidth: number,
  y: number,
  cellPadX: number
) => {
  const lines = doc.splitTextToSize(text || "", colWidth - 2 * cellPadX);
  doc.text(lines.length > 0 ? lines : [""], x + colWidth / 2, y, {
    align: "center",
  });
};

// Body text — same as freight certificate paragraph ("This is to inform you...")
const CAN_BODY_FONT_SIZE = 9;
const CAN_SECTION_TITLE_FONT_SIZE = 9;
const CAN_TABLE_HEADER_H = 7;
const CAN_TABLE_ROW_H = 6;
const CAN_TABLE_CELL_Y_OFFSET = 4;
const CAN_TABLE_HEADER_TEXT_Y_OFFSET = 4.8;
const CAN_LINE_SPACING = 5.5;
const CAN_COMMODITY_LINE_HEIGHT = 4.5;
const CAN_NOTES_LINE_SPACING = 5;
const CAN_SECTION_TITLE_TO_CONTENT_GAP = 4;

type CanKeyValueColumnLayout = {
  keyStartX: number;
  valueStartX: number;
  valueMaxWidth: number;
};

const getCanKeyValueColumnLayout = (
  doc: jsPDF,
  pageWidth: number,
  margin: number,
  boxPadding: number,
  rightHalfStart: number,
  keyLabels: string[]
): CanKeyValueColumnLayout => {
  const keyStartX = rightHalfStart + boxPadding;
  const rightColumnEndX = pageWidth - margin - boxPadding;
  const maxKeyWidth = keyLabels.reduce(
    (max, label) => Math.max(max, doc.getTextWidth(label)),
    0
  );
  const valueStartX = keyStartX + maxKeyWidth + 1.5;
  const valueMaxWidth = Math.max(8, rightColumnEndX - valueStartX);

  return { keyStartX, valueStartX, valueMaxWidth };
};

const drawCanKeyValueRow = (
  doc: jsPDF,
  key: string,
  valueLines: string | string[],
  layout: CanKeyValueColumnLayout,
  y: number
): number => {
  const lines = Array.isArray(valueLines)
    ? valueLines
    : doc.splitTextToSize(valueLines || "", layout.valueMaxWidth);

  doc.text(key, layout.keyStartX, y);
  doc.text(lines.length > 0 ? lines : [""], layout.valueStartX, y, {
    maxWidth: layout.valueMaxWidth,
  });

  return Math.max(1, lines.length) * CAN_LINE_SPACING;
};

// Helper function to get logo based on country and company
const getLogoByCountry = (country: any): string | null => {
  try {
    let companyName = "";
    let countryName = "";
    let countryCode = "";

    const userStr = localStorage.getItem("user");
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user?.company) {
        companyName = (user.company.company_name || "").toUpperCase();
      }
      if (user?.country) {
        countryName = (user.country.country_name || "").toUpperCase();
        countryCode = (user.country.country_code || "").toUpperCase();
      }
    }

    if (country) {
      countryName = (country.country_name || "").toUpperCase();
      countryCode = (country.country_code || "").toUpperCase();
    }

    if (isCctCompany()) {
      return getCctLogo();
    }

    const normalizedCompanyName = companyName.replace(/\s+/g, "").toUpperCase();
    if (
      normalizedCompanyName === "CARGOCONSOLIDATORSINDIA" &&
      countryCode === "IN"
    ) {
      return cargoConsolidators;
    }

    if (
      countryName.includes("INDIA") ||
      countryCode === "IN" ||
      countryName === "INDIA"
    ) {
      return pentagonFreightInd;
    }
    if (
      countryName.includes("USA") ||
      countryCode === "US" ||
      countryName === "USA"
    ) {
      return pentagonPrimeAmericas;
    }
    if (
      countryName.includes("CHINA") ||
      countryCode === "CN" ||
      countryName === "CHINA"
    ) {
      return pentagonPrimeChina;
    }
    if (
      countryName.includes("KENYA") ||
      countryCode === "KE"
    ) {
      return primeLogo;
    }
    return primeLogo;
  } catch (error) {
    console.error("Error getting logo by country:", error);
    return primeLogo;
  }
};

const KENYA_CAN_BRANCH_INFO = {
  name: "PENTAGON PRIME KENYA CO LIMITED",
  address:
    "OFFICE NO. S9-08, MTC BUILDING (AMBALAL HOUSE), 9TH FLOOR, SOUTH TOWER, NKRUMAH ROAD, P.O.BOX 2050-80100,MOMBASA,KENYA.",
  tel: "",
  email: "",
  pan: "",
  gstn: "",
  isKenya: true,
} as const;

const isKenyaCountry = (country?: any): boolean => {
  let countryName = "";
  let countryCode = "";

  if (country) {
    countryName = (country.country_name || "").toUpperCase();
    countryCode = (country.country_code || "").toUpperCase();
  } else {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      const user = JSON.parse(userStr);
      countryName = (user?.country?.country_name || "").toUpperCase();
      countryCode = (user?.country?.country_code || "").toUpperCase();
    }
  }

  return countryName.includes("KENYA") || countryCode === "KE";
};

// Helper function to get branch info
const getBranchInfo = (branchName: string, country?: any) => {
  if (isCctCompany()) {
    return { ...CCT_BRANCH_INFO };
  }

  if (isKenyaCountry(country)) {
    return { ...KENYA_CAN_BRANCH_INFO };
  }

  const branchNameUpper = branchName?.toUpperCase() || "";

  let companyName = "";
  let countryCode = "";

  const userStr = localStorage.getItem("user");
  if (userStr) {
    const user = JSON.parse(userStr);
    if (user?.company) {
      companyName = (user.company.company_name || "").toUpperCase();
    }
    if (user?.country) {
      countryCode = (user.country.country_code || "").toUpperCase();
    }
  }

  if (country) {
    countryCode = (country.country_code || "").toUpperCase();
  }

  const normalizedCompanyName = companyName.replace(/\s+/g, "").toUpperCase();
  if (
    normalizedCompanyName === "CARGOCONSOLIDATORSINDIA" &&
    countryCode === "IN" &&
    branchNameUpper.includes("MUMBAI")
  ) {
    return {
      name: "Cargo Consolidators India Pvt Ltd",
      address:
        "Unit no – 101, Satellite Silver, Marol Naka, Andheri Kurla Road, Andheri (east), Mumbai – 400059",
      tel: "",
      email: "",
      pan: "",
      gstn: "",
    };
  } else if (
    normalizedCompanyName === "CARGOCONSOLIDATORSINDIA" &&
    countryCode === "IN" &&
    branchNameUpper.includes("CHENNAI")
  ) {
    return {
      name: "Cargo Consolidators India Pvt Ltd",
      address:
        "Door No: 205/325, 3rd Floor, Poonamallee High Road, Aminjikarai, Chennai-600 029. Tel: 044 42078064 / 044 42623690 / 044 43201012",
      tel: "044 42078064 / 044 42623690 / 044 43201012",
      email: "",
      pan: "",
      gstn: "",
    };
  } else if (branchNameUpper.includes("CHENNAI")) {
    return {
      name: "PENTAGON INTERNATIONAL FREIGHT SOLUTIONS PVT LTD (CHENNAI)",
      address: "No. 15, Dr. Gopala Menon Road, Kodambakkam, Chennai - 600 024.",
      tel: "+ 91 4443012828",
      email: "customerservice.maa@pentagonindia.net",
      pan: "AAGCP4765J",
      gstn: "33AAGCP4765J1Z5",
    };
  } else if (branchNameUpper.includes("MUMBAI")) {
    return {
      name: "PENTAGON INTERNATIONAL FREIGHT SOLUTIONS PVT LTD (MUMBAI)",
      address:
        "Unit no – 204, Satellite Silver, Marol Naka, Andheri Kurla Road, Andheri (east), Mumbai – 400059",
      tel: "",
      email: "",
      pan: "",
      gstn: "",
    };
  }

  // Default
  return {
    name: "PENTAGON INTERNATIONAL FREIGHT SOLUTIONS PVT LTD (CHENNAI)",
    address: "No. 15, Dr. Gopala Menon Road, Kodambakkam, Chennai - 600 024.",
    tel: "+ 91 4443012828",
    email: "customerservice.maa@pentagonindia.net",
    pan: "AAGCP4765J",
    gstn: "33AAGCP4765J1Z5",
  };
};

// Helper function to draw a box/rectangle
const drawBox = (
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  lineWidth: number = 0.3
) => {
  doc.setLineWidth(lineWidth);
  doc.setDrawColor(0, 0, 0);
  doc.rect(x, y, width, height);
};

// Helper function to check if we need a new page (using fixed box boundaries)
const needsNewPage = (
  currentY: number,
  requiredSpace: number,
  fixedBoxEndY: number,
  bottomBorderPadding: number
): boolean => {
  return currentY + requiredSpace > fixedBoxEndY - bottomBorderPadding;
};

// Helper function to add page border
const drawPageBorder = (
  doc: jsPDF,
  boxX: number,
  boxStartY: number,
  boxEndY: number,
  boxWidth: number
) => {
  doc.rect(boxX, boxStartY, boxWidth, boxEndY - boxStartY);
};

// Helper function to add footer to a page
const addFooter = (
  doc: jsPDF,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  boxPadding: number,
  leftColumnX: number,
  referenceText: string,
  currentPage: number,
  totalPages: number
) => {
  const footerY = pageHeight - 10;
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");

  doc.text(referenceText, leftColumnX, footerY);

  doc.text(
    `Page ${currentPage} of ${totalPages}`,
    pageWidth - margin - boxPadding,
    footerY,
    { align: "right" }
  );
};

// Helper function to draw logo + company header (aligned like Delivery Order PDF)
const drawCanHeaderSection = (
  doc: jsPDF,
  pageWidth: number,
  margin: number,
  boxPadding: number,
  branchInfo: any,
  logoImage: string | null
): number => {
  const headerStartY = 5;
  const headerHeight = 25;
  const logoWidth = 50;
  const logoHeight = 20;
  const logoX = margin + 5;
  const logoTextGap = 2;
  let companyInfoX = margin + 5;
  let companyY = headerStartY + boxPadding + 3;

  if (logoImage) {
    try {
      const logoY = headerStartY + (headerHeight - logoHeight) / 2;
      doc.addImage(
        logoImage,
        "PNG",
        logoX,
        logoY,
        logoWidth,
        logoHeight,
        undefined,
        "FAST"
      );
      companyInfoX = logoX + logoWidth + logoTextGap;
      companyY = logoY + 5;
    } catch (error) {
      console.warn("Could not load logo image, continuing without logo:", error);
    }
  }

  const isKenya = Boolean(branchInfo.isKenya);
  const companyNameFontSize = isKenya ? 11 : 9;
  const companyAddressFontSize = isKenya ? 9 : 7;
  const companyNameLineHeight = isKenya ? 4.8 : 4;
  const companyAddressLineHeight = isKenya ? 4.2 : 3.5;
  const companyTextWidth = pageWidth - companyInfoX - margin - 5;

  doc.setFontSize(companyNameFontSize);
  doc.setFont("helvetica", "bold");
  const companyNameLines = doc.splitTextToSize(
    branchInfo.name || "",
    companyTextWidth
  );
  doc.text(companyNameLines, companyInfoX, companyY, { align: "left" });
  companyY += companyNameLines.length * companyNameLineHeight;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(companyAddressFontSize);
  const companyAddressLines = doc.splitTextToSize(
    branchInfo.address || "",
    companyTextWidth
  );
  doc.text(companyAddressLines, companyInfoX, companyY, { align: "left" });
  companyY += companyAddressLines.length * companyAddressLineHeight;

  if (branchInfo.tel) {
    doc.text(`Telephone: ${branchInfo.tel}`, companyInfoX, companyY);
    companyY += 3.5;
  }

  if (branchInfo.email) {
    doc.text(`Email: ${branchInfo.email}`, companyInfoX, companyY);
    companyY += 3.5;
  }

  const infoLine = [
    branchInfo.pan ? `PAN NO: ${branchInfo.pan}` : "",
    branchInfo.gstn ? `GSTN: ${branchInfo.gstn}` : "",
  ]
    .filter(Boolean)
    .join("    ");

  if (infoLine) {
    doc.text(infoLine, companyInfoX, companyY);
    companyY += 3.5;
  }

  return Math.max(headerStartY + headerHeight + 5, companyY + 3);
};

const CAN_DOCUMENT_TITLE = "CARGO ARRIVAL NOTICE / PROFORMA INVOICE";

type CanPageLayout = {
  headerEndY: number;
  boxStartY: number;
  boxX: number;
  boxWidth: number;
  fixedBoxEndY: number;
  contentY: number;
};

// Shared page setup: logo + company header, optional title, optional border
const setupCanPageLayout = (
  doc: jsPDF,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  boxPadding: number,
  footerHeight: number,
  branchInfo: any,
  logoImage: string | null,
  options?: { includeTitle?: boolean; includeBorder?: boolean; contentAtBoxTop?: boolean }
): CanPageLayout => {
  const includeTitle = options?.includeTitle !== false;
  const includeBorder = options?.includeBorder !== false;
  const contentAtBoxTop = options?.contentAtBoxTop === true;

  const headerEndY = drawCanHeaderSection(
    doc,
    pageWidth,
    margin,
    boxPadding,
    branchInfo, 
    logoImage
  );

  let yPos = headerEndY;

  if (includeTitle) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(CAN_DOCUMENT_TITLE, pageWidth / 2, yPos, { align: "center" });
    yPos += 8;
  }

  const boxX = margin;
  const boxWidth = pageWidth - 2 * margin;
  const boxStartY = includeTitle ? yPos : headerEndY;
  const fixedBoxEndY = pageHeight - footerHeight;

  if (includeBorder) {
    drawPageBorder(doc, boxX, boxStartY, fixedBoxEndY, boxWidth);
  }

  const contentY = includeBorder
    ? contentAtBoxTop
      ? boxStartY
      : boxStartY + boxPadding
    : headerEndY + 5;

  return {
    headerEndY,
    boxStartY,
    boxX,
    boxWidth,
    fixedBoxEndY,
    contentY,
  };
};

// Helper function to add header to an existing page (for continuation pages)
const addHeaderToExistingPage = (
  doc: jsPDF,
  pageWidth: number,
  margin: number,
  boxPadding: number,
  branchInfo: any,
  logoImage: string | null
): number => {
  const pageHeight = doc.internal.pageSize.getHeight();
  const layout = setupCanPageLayout(
    doc,
    pageWidth,
    pageHeight,
    margin,
    boxPadding,
    15,
    branchInfo,
    logoImage
  );
  return layout.contentY;
};

// Helper function to create a new page with header and border setup
const createNewPage = (
  doc: jsPDF,
  pageWidth: number,
  margin: number,
  boxPadding: number,
  branchInfo: any,
  logoImage: string | null
): { yPos: number; boxStartY: number; boxX: number; boxWidth: number } => {
  doc.addPage();

  const pageHeight = doc.internal.pageSize.getHeight();
  const layout = setupCanPageLayout(
    doc,
    pageWidth,
    pageHeight,
    margin,
    boxPadding,
    15,
    branchInfo,
    logoImage
  );

  return {
    yPos: layout.contentY,
    boxStartY: layout.boxStartY,
    boxX: layout.boxX,
    boxWidth: layout.boxWidth,
  };
};

export const generateCargoArrivalNoticePDF = (
  jobData: any,
  hawbData: any,
  defaultBranch: any,
  country?: any,
  sacWiseTotals: CanSacWiseTotal[] = [],
): string => {
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const boxPadding = 3;
    const footerHeight = 15;
    const bottomBorderPadding = 5; // Padding inside border at bottom
    let yPos = 5;
    let currentPage = 1;
    let totalPages = 1;
    let sectionY = 0; // Declare sectionY for use in multiple sections

    // Get branch info
    const branchName = defaultBranch?.branch_name || "CHENNAI";
    const branchInfo = getBranchInfo(branchName, country);
    const logoImage = getLogoByCountry(country);
    const isIndiaCan = isIndianUserFromProfile(country);
    const indiaSacWiseTotals = isIndiaCan ? sacWiseTotals : [];
    const includeCanTaxColumn = isIndiaCan;

    // Extract data from jobData and hawbData (supports both Air and Ocean)
    // Support both mawbDetails (Air) and mblDetails (Ocean)
    const mawbDetails = jobData?.mawbDetails || jobData?.mblDetails || {};
    const carrierDetails = jobData?.carrierDetails || {};
    const jobInfo = jobData || {};
    
    // Check if this is an Air Import job or Ocean Import job
    const isAirImport = (jobInfo?.service === "AIR" || jobData?.service === "AIR") && 
                        (jobInfo?.service_type === "Import" || jobData?.service_type === "Import");
    const isOceanImport = (jobInfo?.service === "FCL" || jobInfo?.service === "LCL" || jobData?.service === "FCL" || jobData?.service === "LCL") && 
                          (jobInfo?.service_type === "Import" || jobData?.service_type === "Import");
    
    // Consignee details - only use consignee data (no fallback)
    const consigneeName = hawbData?.consignee_name || "";
    const consigneeAddress = hawbData?.consignee_address || "";
    const consigneeEmail = hawbData?.consignee_email || "test@gmail.com";
    
    // Notify Party details - only use notify customer data (no fallback)
    const notifyName = hawbData?.notify_customer1_name || "";
    const notifyAddress = hawbData?.notify_customer1_address || "";
    const notifyEmail = hawbData?.notify_customer1_email || "test@gmail.com";
    
    // Shipper details
    const shipperName = hawbData?.shipper_name || "";
    const shipperAddress = hawbData?.shipper_address || "";
    
    // Invoice/Job Details - Support both Air (MAWB/HAWB) and Ocean (MBL/HBL)
    const mawbNumber = carrierDetails?.mawb_number || carrierDetails?.mbl_number || "";
    const hawbNumber = hawbData?.hawb_number || hawbData?.hbl_number || hawbData?.hawb_no || "";
    const jobRefNo = mawbNumber && hawbNumber ? `${mawbNumber}-${hawbNumber}` : (mawbNumber || hawbNumber || "");
    const invoiceRef = (mawbNumber || "") + (hawbNumber || "");
    const createdAt = jobInfo?.created_at || hawbData?.created_at || "";
    const createdBy = jobInfo?.created_by || "";
    const igmNo = jobInfo?.igm_no || "";
    const igmDate = jobInfo?.igm_date ? formatDateForDisplay(jobInfo.igm_date) : "";
    const igmInfo = igmNo && igmDate ? `${igmNo} / ${igmDate}` : (igmNo || igmDate || "");
    
    // Shipment Details
    const carrierName = carrierDetails?.carrier_name || "";
    const originName = mawbDetails?.origin_name || "";
    const destinationName = mawbDetails?.destination_name || "";
    const eta = mawbDetails?.eta ? formatDateForDisplay(mawbDetails.eta) : "";
    const hawbCreatedAt = hawbData?.created_at ? formatDateForDisplay(hawbData.created_at) : "";
    const mawbCreatedAt = carrierDetails?.mawb_date ? formatDateForDisplay(carrierDetails.mawb_date) : 
                          carrierDetails?.mbl_date ? formatDateForDisplay(carrierDetails.mbl_date) : "";
    const bookingNo = jobInfo?.booking_no || "";
    const cargoLocation = jobInfo?.cargo_location || "";

    // Set document properties
    doc.setProperties({
      title: `Cargo Arrival Notice - ${hawbNumber || ""}`,
      subject: "Cargo Arrival Notice / Proforma Invoice",
      author: branchInfo.name,
    });

    // Set line width
    doc.setLineWidth(0.3);
    doc.setDrawColor(0, 0, 0);

    // ===== HEADER + TITLE + BORDER (same layout as continuation pages) =====
    const firstPageLayout = setupCanPageLayout(
      doc,
      pageWidth,
      pageHeight,
      margin,
      boxPadding,
      footerHeight,
      branchInfo,
      logoImage,
      { contentAtBoxTop: true }
    );
    const fixedBoxEndY = firstPageLayout.fixedBoxEndY;
    let boxX = firstPageLayout.boxX;
    let boxWidth = firstPageLayout.boxWidth;
    let boxStartY = firstPageLayout.boxStartY;
    yPos = firstPageLayout.contentY;

    // ===== COMBINED TWO COLUMN LAYOUT (Like Quotation PDF) =====
    const midLine = pageWidth / 2;
    const leftHalfWidth = midLine - margin - 2;
    const rightHalfWidth = pageWidth / 2 - margin - 2;
    const rightHalfStart = midLine + 2;
    const sectionStartY = yPos; // Start inside the fixed border

    // Calculate heights for left column sections
    doc.setFontSize(CAN_BODY_FONT_SIZE);
    doc.setFont("helvetica", "normal");
    
    const notifyNameLines = doc.splitTextToSize(notifyName || "", leftHalfWidth - 2 * boxPadding);
    const notifyAddressLines = doc.splitTextToSize(notifyAddress || "", leftHalfWidth - 2 * boxPadding);
    const notifyEmailLines = doc.splitTextToSize(notifyEmail || "", leftHalfWidth - 2 * boxPadding);
    
    const consigneeNameLines = doc.splitTextToSize(consigneeName || "", leftHalfWidth - 2 * boxPadding);
    const consigneeAddressLines = doc.splitTextToSize(consigneeAddress || "", leftHalfWidth - 2 * boxPadding);
    const consigneeEmailLines = doc.splitTextToSize(consigneeEmail || "", leftHalfWidth - 2 * boxPadding);
    
    const shipperNameLines = doc.splitTextToSize(shipperName || "", leftHalfWidth - 2 * boxPadding);
    const shipperAddressLines = doc.splitTextToSize(shipperAddress || "", leftHalfWidth - 2 * boxPadding);
    
    // Check if sections have data
    const hasConsignee = consigneeName || consigneeAddress || consigneeEmail;
    const hasNotify = notifyName || notifyAddress || notifyEmail;
    
    const lineSpacing = CAN_LINE_SPACING;
    
    let leftColumnHeight = boxPadding + 3; // Matches drawing: leftYPos = sectionStartY + boxPadding + 3
    // Consignee section (first)
    if (hasConsignee) {
      leftColumnHeight += 4; // Title
      if (consigneeName) leftColumnHeight += Math.max(1, consigneeNameLines.length) * lineSpacing;
      if (consigneeEmail) leftColumnHeight += Math.max(1, consigneeEmailLines.length) * lineSpacing;
      if (consigneeAddress) leftColumnHeight += Math.max(1, consigneeAddressLines.length) * lineSpacing;
      leftColumnHeight += 8; // Separator: +3 spacing + line + +5 after (matches drawing)
    }
    // Notify Party section — always drawn in rendering (if-block commented out)
    leftColumnHeight += 4; // Title
    if (notifyName) leftColumnHeight += Math.max(1, notifyNameLines.length) * lineSpacing;
    if (notifyEmail) leftColumnHeight += Math.max(1, notifyEmailLines.length) * lineSpacing;
    if (notifyAddress) leftColumnHeight += Math.max(1, notifyAddressLines.length) * lineSpacing;
    leftColumnHeight += 8; // Separator: +3 spacing + line + +5 after (matches drawing)
    // Shipper section
    leftColumnHeight += 4; // Title
    if (shipperName) leftColumnHeight += Math.max(1, shipperNameLines.length) * lineSpacing;
    if (shipperAddress) leftColumnHeight += Math.max(1, shipperAddressLines.length) * lineSpacing;
    leftColumnHeight += 4; // Bottom padding

    const houseBillLabel = isOceanImport ? "HBL:" : "HAWB:";
    const masterBillLabel = isOceanImport ? "MBL:" : "MAWB:";
    const rightColumnKeyLabels = [
      "Job Ref No:",
      "Date:",
      "Invoice Ref:",
      "From:",
      "IGM No:",
      houseBillLabel,
      masterBillLabel,
      "Booking No:",
      "Carrier:",
      "POL:",
      "POD:",
      "Final Dest:",
      "Arrival date:",
      "FDC ETA:",
    ];
    const rightColumnLayout = getCanKeyValueColumnLayout(
      doc,
      pageWidth,
      margin,
      boxPadding,
      rightHalfStart,
      rightColumnKeyLabels
    );
    const { valueMaxWidth: rightValueMaxWidth } = rightColumnLayout;

    const hawbInfo = hawbNumber && hawbCreatedAt ? `${hawbNumber}/${hawbCreatedAt}` : (hawbNumber || hawbCreatedAt || "");
    const mawbInfo = mawbNumber && mawbCreatedAt ? `${mawbNumber}/${mawbCreatedAt}` : (mawbNumber || mawbCreatedAt || "");

    // Calculate heights for right column sections (wrap within right margin)
    const jobRefNoLines = doc.splitTextToSize(jobRefNo || "", rightValueMaxWidth);
    const invoiceRefLines = doc.splitTextToSize(invoiceRef || "", rightValueMaxWidth);
    const dateLines = doc.splitTextToSize(formatDateForDisplay(createdAt) || "", rightValueMaxWidth);
    const fromLines = doc.splitTextToSize(createdBy || "", rightValueMaxWidth);
    const igmInfoLines = doc.splitTextToSize(igmInfo || "", rightValueMaxWidth);
    const hawbInfoLines = doc.splitTextToSize(hawbInfo, rightValueMaxWidth);
    const mawbInfoLines = doc.splitTextToSize(mawbInfo, rightValueMaxWidth);
    const bookingNoLines = doc.splitTextToSize(bookingNo || "", rightValueMaxWidth);
    const carrierNameLines = doc.splitTextToSize(carrierName || "", rightValueMaxWidth);
    const originNameLines = doc.splitTextToSize(originName || "", rightValueMaxWidth);
    const destinationNameLines = doc.splitTextToSize(destinationName || "", rightValueMaxWidth);
    const etaLines = doc.splitTextToSize(eta || "", rightValueMaxWidth);
    const cargoLocationLines = doc.splitTextToSize(cargoLocation || "", rightValueMaxWidth);
    
    let rightColumnHeight = 4; // Top padding (matches drawing: sectionStartY + boxPadding ≈ +3)
    // Invoice/Job Details section
    rightColumnHeight += 4; // Title space
    rightColumnHeight += Math.max(1, jobRefNoLines.length) * lineSpacing;
    rightColumnHeight += Math.max(1, dateLines.length) * lineSpacing;
    rightColumnHeight += Math.max(1, invoiceRefLines.length) * lineSpacing;
    rightColumnHeight += Math.max(1, fromLines.length) * lineSpacing;
    rightColumnHeight += Math.max(1, igmInfoLines.length) * lineSpacing;
    rightColumnHeight += 6; // Separator: +1 spacing + line + +5 after (matches drawing)
    // Shipment Details section
    rightColumnHeight += 4 + CAN_SECTION_TITLE_TO_CONTENT_GAP; // Title + gap before key-values
    rightColumnHeight += Math.max(1, hawbInfoLines.length) * lineSpacing;
    rightColumnHeight += Math.max(1, mawbInfoLines.length) * lineSpacing;
    rightColumnHeight += Math.max(1, bookingNoLines.length) * lineSpacing;
    rightColumnHeight += Math.max(1, carrierNameLines.length) * lineSpacing;
    rightColumnHeight += Math.max(1, originNameLines.length) * lineSpacing;
    rightColumnHeight += Math.max(1, destinationNameLines.length) * lineSpacing;
    rightColumnHeight += Math.max(1, destinationNameLines.length) * lineSpacing; // Final Dest
    rightColumnHeight += Math.max(1, etaLines.length) * lineSpacing;
    rightColumnHeight += Math.max(1, etaLines.length) * lineSpacing; // FDC ETA
    rightColumnHeight += Math.max(1, cargoLocationLines.length) * lineSpacing;
    rightColumnHeight += 2; // Bottom padding

    // Extract cargo details, charges, and notes for height calculation
    // Support both Air (mawb_charges) and Ocean (mbl_charges)
    const cargoDetails = hawbData?.cargo_details || [];

    const cargoRowSpacing = 4.5; // Match charges table row spacing
    const charges = hawbData?.charges || hawbData?.mawb_charges || hawbData?.mbl_charges || [];
    const baseDisplayableCharges = (Array.isArray(charges) ? charges : []).filter(
      (charge: Record<string, unknown>) =>
        isDisplayableCanCharge(charge) && isCollectCanCharge(charge),
    );
    const taxCharges = sacWiseTotalsToCanCharges(indiaSacWiseTotals).filter(
      (charge) => isDisplayableCanCharge(charge),
    );
    const displayableCharges = [...baseDisplayableCharges, ...taxCharges];
    const taxableChargeNames = buildCanTaxableChargeNamesSet(indiaSacWiseTotals);

    const notes = jobInfo?.notes || [];
    const rowHeight = 5;
    
    // Calculate cargo table height
    const cargoTableHeaderHeight = 6;
    const cargoTableRowsHeight = cargoDetails.length > 0 ? cargoDetails.length * rowHeight : rowHeight;
    const cargoTableHeight = cargoTableHeaderHeight + cargoTableRowsHeight + 2;
    
    // Calculate charges table height
    // Reduced row spacing for charges (4.5 units per row)
    const chargesRowSpacing = 4.5;
    const chargesTableHeaderHeight = 8; // Header + line + spacing
    const chargesTableRowsHeight = displayableCharges.length > 0 ? displayableCharges.length * chargesRowSpacing : chargesRowSpacing;
    const chargesTableHeight = chargesTableHeaderHeight + chargesTableRowsHeight + 2;
    
    // Draw vertical center line (only for two-column section, not cargo/charges)
    const twoColumnSectionHeight = Math.max(leftColumnHeight, rightColumnHeight, 50);
    doc.line(
      midLine,
      sectionStartY,
      midLine,
      sectionStartY + twoColumnSectionHeight
    );

    // ===== LEFT COLUMN CONTENT =====
    let leftYPos = sectionStartY + boxPadding + 3;
    
    // Consignee section (first) - only show if consignee data is available
    if (hasConsignee) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(CAN_SECTION_TITLE_FONT_SIZE);
      doc.text("To:", margin + boxPadding, leftYPos);
      leftYPos += 4;
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(CAN_BODY_FONT_SIZE);
      if (consigneeName) {
        doc.text(consigneeNameLines, margin + boxPadding, leftYPos);
        leftYPos += consigneeNameLines.length * 4.5;
      }
      if (consigneeEmail) {
        doc.text(consigneeEmailLines, margin + boxPadding, leftYPos);
        leftYPos += consigneeEmailLines.length * 4.5;
      }
      if (consigneeAddress) {
        doc.text(consigneeAddressLines, margin + boxPadding, leftYPos);
        leftYPos += consigneeAddressLines.length * 4.5;
      }
      
      // Draw horizontal line after Consignee (only if Notify section follows)
      // if (hasNotify) {
        leftYPos += 3;
        doc.line(margin, leftYPos, midLine, leftYPos);
        leftYPos += 5;
      // }
    }
    
    // Notify Party section (second) - only show if notify data is available
    // if (hasNotify) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(CAN_SECTION_TITLE_FONT_SIZE);
      doc.text("Notify:", margin + boxPadding, leftYPos);
      leftYPos += 4;
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(CAN_BODY_FONT_SIZE);
      if (notifyName) {
        doc.text(notifyNameLines, margin + boxPadding, leftYPos);
        leftYPos += notifyNameLines.length * 4.5;
      }
      if (notifyEmail) {
        doc.text(notifyEmailLines, margin + boxPadding, leftYPos);
        leftYPos += notifyEmailLines.length * 4.5;
      }
      if (notifyAddress) {
        doc.text(notifyAddressLines, margin + boxPadding, leftYPos);
        leftYPos += notifyAddressLines.length * 4.5;
      }
      
      // Draw horizontal line after Notify Party (before Shipper)
      leftYPos += 3;
      doc.line(margin, leftYPos, midLine, leftYPos);
      leftYPos += 5;
    // }
    
    // Shipper section
    doc.setFont("helvetica", "bold");
    doc.setFontSize(CAN_SECTION_TITLE_FONT_SIZE);
    doc.text("Shipper:", margin + boxPadding, leftYPos);
    leftYPos += 4;
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(CAN_BODY_FONT_SIZE);
    if (shipperName) {
      doc.text(shipperNameLines, margin + boxPadding, leftYPos);
      leftYPos += shipperNameLines.length * 4.5;
    }
    if (shipperAddress) {
      doc.text(shipperAddressLines, margin + boxPadding, leftYPos);
      leftYPos += shipperAddressLines.length * 4.5;
    }

    // ===== RIGHT COLUMN CONTENT =====
    let rightYPos = sectionStartY + boxPadding;
    
    // Invoice/Job Details section
    doc.setFont("helvetica", "bold");
    doc.setFontSize(CAN_SECTION_TITLE_FONT_SIZE);
    // doc.text("Invoice/Job Details:", rightHalfStart + boxPadding, rightYPos);
    rightYPos += 4;
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(CAN_BODY_FONT_SIZE);

    rightYPos += drawCanKeyValueRow(
      doc,
      "Job Ref No:",
      jobRefNoLines,
      rightColumnLayout,
      rightYPos
    );
    rightYPos += drawCanKeyValueRow(doc, "Date:", dateLines, rightColumnLayout, rightYPos);
    rightYPos += drawCanKeyValueRow(
      doc,
      "Invoice Ref:",
      invoiceRefLines,
      rightColumnLayout,
      rightYPos
    );
    rightYPos += drawCanKeyValueRow(doc, "From:", fromLines, rightColumnLayout, rightYPos);
    rightYPos += drawCanKeyValueRow(doc, "IGM No:", igmInfoLines, rightColumnLayout, rightYPos);
    
    // Draw horizontal line after Invoice/Job Details
    rightYPos += 1;
    doc.line(midLine, rightYPos, pageWidth - margin, rightYPos);
    rightYPos += 5;
    
    // Shipment Details section
    doc.setFont("helvetica", "bold");
    doc.setFontSize(CAN_SECTION_TITLE_FONT_SIZE);
    doc.text("Shipment Details:", rightHalfStart + boxPadding, rightYPos);
    rightYPos += 4 + CAN_SECTION_TITLE_TO_CONTENT_GAP;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(CAN_BODY_FONT_SIZE);

    rightYPos += drawCanKeyValueRow(
      doc,
      houseBillLabel,
      hawbInfoLines,
      rightColumnLayout,
      rightYPos
    );
    rightYPos += drawCanKeyValueRow(
      doc,
      masterBillLabel,
      mawbInfoLines,
      rightColumnLayout,
      rightYPos
    );
    rightYPos += drawCanKeyValueRow(
      doc,
      "Booking No:",
      bookingNoLines,
      rightColumnLayout,
      rightYPos
    );
    rightYPos += drawCanKeyValueRow(
      doc,
      "Carrier:",
      carrierNameLines,
      rightColumnLayout,
      rightYPos
    );
    rightYPos += drawCanKeyValueRow(doc, "POL:", originNameLines, rightColumnLayout, rightYPos);
    rightYPos += drawCanKeyValueRow(
      doc,
      "POD:",
      destinationNameLines,
      rightColumnLayout,
      rightYPos
    );
    rightYPos += drawCanKeyValueRow(
      doc,
      "Final Dest:",
      destinationNameLines,
      rightColumnLayout,
      rightYPos
    );
    rightYPos += drawCanKeyValueRow(
      doc,
      "Arrival date:",
      etaLines,
      rightColumnLayout,
      rightYPos
    );
    rightYPos += drawCanKeyValueRow(doc, "FDC ETA:", etaLines, rightColumnLayout, rightYPos);

    // Cargo Location:
    // doc.text("Cargo Location:", rightHalfStart + boxPadding, rightYPos);
    // doc.text(cargoLocationLines, shipmentValueStartX, rightYPos);
    rightYPos += Math.max(1, cargoLocationLines.length) * 4.5;

    // Draw horizontal line separating two-column section from cargo section
    yPos = sectionStartY + Math.max(leftColumnHeight, rightColumnHeight, 50);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 4;

    // ===== CARGO DETAILS SECTION (integrated with main box) =====
    // Only check for enough space to draw the section header (title + col header); rows handle their own page breaks
    const estimatedCargoHeight = 20;
    if (needsNewPage(yPos, estimatedCargoHeight, fixedBoxEndY, bottomBorderPadding)) {
      // Add footer for current page
      const referenceText = `Reference: ${jobRefNo || ""} on ${formatDateForDisplay(createdAt) || ""} by ${createdBy || ""}`;
      addFooter(doc, pageWidth, pageHeight, margin, boxPadding, margin + boxPadding, referenceText, currentPage, totalPages);
      
      // Create new page
      currentPage++;
      totalPages++;
      const newPageInfo = createNewPage(doc, pageWidth, margin, boxPadding, branchInfo, logoImage);
      yPos = newPageInfo.yPos;
      boxStartY = newPageInfo.boxStartY;
      boxX = newPageInfo.boxX;
      boxWidth = newPageInfo.boxWidth;
    }
    
    sectionY = yPos;
    
    // Cargo table setup
    doc.setFontSize(CAN_BODY_FONT_SIZE);
    const cargoHeaders = [
      "Commodity",
      "No of Pcs",
      "Char. Weight (Kgs)",
      "Gr.Wt (Kgs)",
    ];
    const cargoTableX = margin + boxPadding;
    const cargoTableW = pageWidth - 2 * margin - 2 * boxPadding;
    const cargoColWidths = [
      Math.round(cargoTableW * 0.46),
      Math.round(cargoTableW * 0.16),
      Math.round(cargoTableW * 0.19),
      cargoTableW -
        (Math.round(cargoTableW * 0.46) +
          Math.round(cargoTableW * 0.16) +
          Math.round(cargoTableW * 0.19)),
    ];
    const cargoHeaderH = CAN_TABLE_HEADER_H;
    const cargoRowH = CAN_TABLE_ROW_H;
    const cellPadX = 1.6;

    // Section title strip (absolute position — rect starts at sectionY)
    doc.setFillColor(215, 215, 215);
    doc.setDrawColor(170, 170, 170);
    doc.rect(cargoTableX, sectionY, cargoTableW, cargoHeaderH, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(CAN_BODY_FONT_SIZE);
    doc.setTextColor(30, 30, 30);
    doc.text("CARGO DETAILS", cargoTableX + cellPadX, sectionY + CAN_TABLE_HEADER_TEXT_Y_OFFSET);
    doc.setTextColor(0, 0, 0);
    sectionY += cargoHeaderH;

    // Column header background + border (absolute position)
    doc.setFillColor(235, 235, 235);
    doc.setDrawColor(170, 170, 170);
    doc.rect(cargoTableX, sectionY, cargoTableW, cargoHeaderH, "FD");

    let xPos = cargoTableX;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(40, 40, 40);
    cargoHeaders.forEach((header, index) => {
      const w = cargoColWidths[index];
      drawCenteredTableHeader(doc, header, xPos, w, sectionY + CAN_TABLE_HEADER_TEXT_Y_OFFSET);
      if (index < cargoHeaders.length - 1) {
        doc.line(xPos + w, sectionY, xPos + w, sectionY + cargoHeaderH);
      }
      xPos += w;
    });
    doc.setTextColor(0, 0, 0);

    sectionY += cargoHeaderH;

    // Table rows with actual data
    doc.setFont("helvetica", "normal");
    const commodityDescription = hawbData?.commodity_description || "";
    
    if (cargoDetails.length > 0) {
      // Compute totals across all cargo rows
      const totalNoOfPcs = cargoDetails.reduce((sum: number, c: any) => {
        const v = parseFloat(c.no_of_packages);
        return sum + (isNaN(v) ? 0 : v);
      }, 0);
      const totalCharWeight = cargoDetails.reduce((sum: number, c: any) => {
        const v = parseFloat(c.chargeable_weight);
        return sum + (isNaN(v) ? 0 : v);
      }, 0);
      const totalGrossWeight = cargoDetails.reduce((sum: number, c: any) => {
        const v = parseFloat(c.gross_weight);
        return sum + (isNaN(v) ? 0 : v);
      }, 0);

      const commodity = commodityDescription;
      const noOfPcs = totalNoOfPcs > 0 ? String(totalNoOfPcs) : "";
      const charWeight = totalCharWeight > 0 ? String(totalCharWeight) : "";
      const grossWeight = totalGrossWeight > 0 ? String(totalGrossWeight) : "";

      // Split commodity into wrapped lines constrained to the column width
      const allCommodityLines: string[] = doc.splitTextToSize(commodity || "", cargoColWidths[0] - 2 * cellPadX);
      const safeCommodityLines: string[] = allCommodityLines.length > 0 ? allCommodityLines : [""];
      let lineIdx = 0;
      let isFirstSegment = true;

      // Render commodity text page-segment by page-segment so long text never overflows the page
      while (lineIdx < safeCommodityLines.length) {
        // How many commodity lines fit in remaining space on this page?
        // Row height for N lines = N * lineHeight + padding
        const pageSpaceAvailable = fixedBoxEndY - bottomBorderPadding - sectionY;
        let maxLinesHere = Math.max(
          1,
          Math.floor(
            (pageSpaceAvailable - 1.5) / CAN_COMMODITY_LINE_HEIGHT
          )
        );
        let linesThisRow = Math.min(maxLinesHere, safeCommodityLines.length - lineIdx);
        let segmentLines = safeCommodityLines.slice(lineIdx, lineIdx + linesThisRow);
        let segmentRowH = Math.max(
          cargoRowH,
          Math.ceil(linesThisRow * CAN_COMMODITY_LINE_HEIGHT + 1.5)
        );

        // If this segment does not fit, break to a new page
        if (needsNewPage(sectionY, segmentRowH + 2, fixedBoxEndY, bottomBorderPadding)) {
          const referenceText = `Reference: ${jobRefNo || ""} on ${formatDateForDisplay(createdAt) || ""} by ${createdBy || ""}`;
          addFooter(doc, pageWidth, pageHeight, margin, boxPadding, margin + boxPadding, referenceText, currentPage, totalPages);
          currentPage++;
          totalPages++;
          const newPageInfo = createNewPage(doc, pageWidth, margin, boxPadding, branchInfo, logoImage);
          sectionY = newPageInfo.yPos;
          boxStartY = newPageInfo.boxStartY;
          boxX = newPageInfo.boxX;
          boxWidth = newPageInfo.boxWidth;

          // Redraw column header on new page
          doc.setFontSize(CAN_BODY_FONT_SIZE);
          doc.setFillColor(235, 235, 235);
          doc.setDrawColor(170, 170, 170);
          doc.rect(cargoTableX, sectionY, cargoTableW, cargoHeaderH, "FD");
          xPos = cargoTableX;
          doc.setFont("helvetica", "bold");
          doc.setTextColor(40, 40, 40);
          cargoHeaders.forEach((header, index) => {
            const w = cargoColWidths[index];
            drawCenteredTableHeader(doc, header, xPos, w, sectionY + CAN_TABLE_HEADER_TEXT_Y_OFFSET);
            if (index < cargoHeaders.length - 1) {
              doc.line(xPos + w, sectionY, xPos + w, sectionY + cargoHeaderH);
            }
            xPos += w;
          });
          doc.setTextColor(0, 0, 0);
          sectionY += cargoHeaderH;
          doc.setFont("helvetica", "normal");

          // Recalculate for the new (full) page
          const newPageSpace = fixedBoxEndY - bottomBorderPadding - sectionY;
          maxLinesHere = Math.max(
            1,
            Math.floor((newPageSpace - 1.5) / CAN_COMMODITY_LINE_HEIGHT)
          );
          linesThisRow = Math.min(maxLinesHere, safeCommodityLines.length - lineIdx);
          segmentLines = safeCommodityLines.slice(lineIdx, lineIdx + linesThisRow);
          segmentRowH = Math.max(
            cargoRowH,
            Math.ceil(linesThisRow * CAN_COMMODITY_LINE_HEIGHT + 1.5)
          );
        }

        // Draw this segment's row background
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(190, 190, 190);
        doc.rect(cargoTableX, sectionY, cargoTableW, segmentRowH, "FD");

        // Commodity text — center-aligned within column
        doc.text(segmentLines, cargoTableX + cargoColWidths[0] / 2, sectionY + CAN_TABLE_CELL_Y_OFFSET, {
          align: "center",
        });

        // Column separator after commodity column
        doc.line(cargoTableX + cargoColWidths[0], sectionY, cargoTableX + cargoColWidths[0], sectionY + segmentRowH);

        // Numeric values (No of Pcs, Char. Weight, Gr.Wt) — only on the first segment row, vertically centred
        if (isFirstSegment) {
          const numericY = sectionY + segmentRowH / 2 + 1;
          let numX = cargoTableX + cargoColWidths[0];
          [
            { val: noOfPcs,    w: cargoColWidths[1] },
            { val: charWeight, w: cargoColWidths[2] },
            { val: grossWeight, w: cargoColWidths[3] },
          ].forEach(({ val, w }, i, arr) => {
            drawCenteredTableCell(doc, val, numX, w, numericY, cellPadX);
            if (i < arr.length - 1) {
              doc.line(numX + w, sectionY, numX + w, sectionY + segmentRowH);
            }
            numX += w;
          });
        } else {
          // Continuation segments: draw column separators for numeric columns but no values
          let numX = cargoTableX + cargoColWidths[0];
          [cargoColWidths[1], cargoColWidths[2]].forEach((w) => {
            doc.line(numX + w, sectionY, numX + w, sectionY + segmentRowH);
            numX += w;
          });
        }

        sectionY += segmentRowH;
        lineIdx += linesThisRow;
        isFirstSegment = false;
      }
    } else {
      // Show placeholder if no cargo details (absolute position)
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(220, 220, 220);
      doc.rect(cargoTableX, sectionY, cargoTableW, cargoRowH, "FD");
      xPos = cargoTableX;
      const placeholderRow = [
        commodityDescription || "",
        "",
        "",
        "",
      ];
      placeholderRow.forEach((cell, index) => {
        const w = cargoColWidths[index];
        drawCenteredTableCell(doc, String(cell), xPos, w, sectionY + CAN_TABLE_CELL_Y_OFFSET, cellPadX);
        if (index < placeholderRow.length - 1) {
          doc.line(
            xPos + w,
            sectionY,
            xPos + w,
            sectionY + cargoRowH,
          );
        }
        xPos += w;
      });
      sectionY += cargoRowH;
    }

    sectionY += 1;
    // doc.line(margin + boxPadding, sectionY - 1, pageWidth - margin - boxPadding, sectionY - 1);

    const hasCharges = displayableCharges.length > 0;

    if (hasCharges) {
    // Draw horizontal line separating cargo section from charges section
    sectionY += 1;
    doc.line(margin, sectionY, pageWidth - margin, sectionY);
    sectionY += 4;

    // ===== CHARGES SECTION (integrated with main box) =====
    // Only check for enough space to draw the section header (title + col header); rows handle their own page breaks
    const estimatedChargesHeight = 20;
    if (needsNewPage(sectionY, estimatedChargesHeight, fixedBoxEndY, bottomBorderPadding)) {
      // Add footer for current page
      const referenceText = `Reference: ${jobRefNo || ""} on ${formatDateForDisplay(createdAt) || ""} by ${createdBy || ""}`;
      addFooter(doc, pageWidth, pageHeight, margin, boxPadding, margin + boxPadding, referenceText, currentPage, totalPages);
      
      // Create new page
      currentPage++;
      totalPages++;
      const newPageInfo = createNewPage(doc, pageWidth, margin, boxPadding, branchInfo, logoImage);
      sectionY = newPageInfo.yPos;
      boxStartY = newPageInfo.boxStartY;
      boxX = newPageInfo.boxX;
      boxWidth = newPageInfo.boxWidth;
    }

    // Charges table setup
    doc.setFontSize(CAN_BODY_FONT_SIZE);
    const chargesHeaders = getCanChargesHeaders(includeCanTaxColumn);
    const chargesTableX = margin + boxPadding;
    const chargesTableW = pageWidth - 2 * margin - 2 * boxPadding;
    const chargesColWidths = buildCanChargesColumnWidths(
      chargesTableW,
      includeCanTaxColumn,
    );
    const chargesHeaderH = CAN_TABLE_HEADER_H;
    const chargesRowH = CAN_TABLE_ROW_H;

    // Section title strip (absolute position — rect starts at sectionY)
    doc.setFillColor(215, 215, 215);
    doc.setDrawColor(170, 170, 170);
    doc.rect(chargesTableX, sectionY, chargesTableW, chargesHeaderH, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(CAN_BODY_FONT_SIZE);
    doc.setTextColor(30, 30, 30);
    doc.text("CHARGES", chargesTableX + cellPadX, sectionY + CAN_TABLE_HEADER_TEXT_Y_OFFSET);
    doc.setTextColor(0, 0, 0);
    sectionY += chargesHeaderH;

    // Column header background + border (absolute position)
    doc.setFillColor(235, 235, 235);
    doc.setDrawColor(170, 170, 170);
    doc.rect(chargesTableX, sectionY, chargesTableW, chargesHeaderH, "FD");

    xPos = chargesTableX;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(40, 40, 40);
    chargesHeaders.forEach((header, index) => {
      const w = chargesColWidths[index];
      drawCenteredTableHeader(doc, header, xPos, w, sectionY + CAN_TABLE_HEADER_TEXT_Y_OFFSET);
      if (index < chargesHeaders.length - 1) {
        doc.line(
          xPos + w,
          sectionY,
          xPos + w,
          sectionY + chargesHeaderH,
        );
      }
      xPos += w;
    });
    doc.setTextColor(0, 0, 0);

    sectionY += chargesHeaderH;

    // Charges table rows with actual data
    doc.setFont("helvetica", "normal");

    displayableCharges.forEach((charge: any, rowIdx: number) => {
        // Pre-calculate row data and dynamic height before the page-break check
        const chargeName = charge.charge_name || "";
        const currency = getChargeCurrencyCode(charge);
        const units = charge.no_of_unit !== null && charge.no_of_unit !== undefined ? String(charge.no_of_unit) : "";
        const perUnit = charge.amount_per_unit !== null && charge.amount_per_unit !== undefined ? String(charge.amount_per_unit) : "";
        const roe = charge.roe !== null && charge.roe !== undefined ? String(charge.roe) : "";
        const amount = getChargeDisplayAmount(charge as Record<string, unknown>);
        const chargeNameCellText = doc.splitTextToSize(chargeName || "", chargesColWidths[0] - 2 * cellPadX);
        const numChargeNameLines = Math.max(1, chargeNameCellText.length);
        // Row expands to fit all wrapped charge name lines (3 mm per line + 2 mm padding)
        const dynamicChargesRowH = Math.max(
          chargesRowH,
          numChargeNameLines * CAN_COMMODITY_LINE_HEIGHT + 2
        );

        // Check if we need a new page for each row
        if (needsNewPage(sectionY, dynamicChargesRowH + 2, fixedBoxEndY, bottomBorderPadding)) {
          // Add footer for current page
          const referenceText = `Reference: ${jobRefNo || ""} on ${formatDateForDisplay(createdAt) || ""} by ${createdBy || ""}`;
          addFooter(doc, pageWidth, pageHeight, margin, boxPadding, margin + boxPadding, referenceText, currentPage, totalPages);
          
          // Create new page
          currentPage++;
          totalPages++;
          const newPageInfo = createNewPage(doc, pageWidth, margin, boxPadding, branchInfo, logoImage);
          sectionY = newPageInfo.yPos;
          boxStartY = newPageInfo.boxStartY;
          boxX = newPageInfo.boxX;
          boxWidth = newPageInfo.boxWidth;
          
          // Redraw table header on new page (absolute position)
          doc.setFontSize(CAN_BODY_FONT_SIZE);
          doc.setFillColor(235, 235, 235);
          doc.setDrawColor(170, 170, 170);
          doc.rect(chargesTableX, sectionY, chargesTableW, chargesHeaderH, "FD");
          xPos = chargesTableX;
          doc.setFont("helvetica", "bold");
          doc.setTextColor(40, 40, 40);
          chargesHeaders.forEach((header, index) => {
            const w = chargesColWidths[index];
            drawCenteredTableHeader(doc, header, xPos, w, sectionY + CAN_TABLE_HEADER_TEXT_Y_OFFSET);
            if (index < chargesHeaders.length - 1) {
              doc.line(
                xPos + w,
                sectionY,
                xPos + w,
                sectionY + chargesHeaderH,
              );
            }
            xPos += w;
          });
          doc.setTextColor(0, 0, 0);
          sectionY += chargesHeaderH;
          doc.setFont("helvetica", "normal");
        }
        
        // Zebra row fill — dynamic height so all charge name lines are visible
        const fill = rowIdx % 2 === 0 ? 255 : 244;
        doc.setFillColor(fill, fill, fill);
        doc.setDrawColor(190, 190, 190);
        doc.rect(chargesTableX, sectionY, chargesTableW, dynamicChargesRowH, "FD");

        xPos = chargesTableX;
        const showTaxTick =
          includeCanTaxColumn &&
          isCanBaseChargeTaxable(
            charge as Record<string, unknown>,
            taxableChargeNames,
          );
        const chargeRowData = includeCanTaxColumn
          ? [chargeName, currency, units, perUnit, roe, amount, ""]
          : [chargeName, currency, units, perUnit, roe, amount];
        chargeRowData.forEach((cell, index) => {
          const w = chargesColWidths[index];
          const cellY = sectionY + CAN_TABLE_CELL_Y_OFFSET;
          if (index === chargeRowData.length - 1 && showTaxTick) {
            drawCanTaxTickMark(doc, xPos, w, cellY);
          } else {
            drawCenteredTableCell(
              doc,
              String(cell ?? ""),
              xPos,
              w,
              cellY,
              cellPadX,
            );
          }

          // Column separators span the full dynamic row height
          if (index < chargeRowData.length - 1) {
            doc.line(
              xPos + w,
              sectionY,
              xPos + w,
              sectionY + dynamicChargesRowH,
            );
          }
          xPos += w;
        });
        sectionY += dynamicChargesRowH;
      });
    doc.line(margin, sectionY, pageWidth - margin, sectionY);

    sectionY += 10;
    } else {
      // Keep the same gap before Notes when the charges table is omitted
      sectionY += 1;
      doc.line(margin, sectionY, pageWidth - margin, sectionY);
      sectionY += 10;
    }

    // Update yPos for next section after the combined box
    yPos = sectionY;

    // ===== NOTES SECTION (separate from boxes) =====
    // Check if we need a new page before notes
    const notesLineSpacing = CAN_NOTES_LINE_SPACING;
    const notesWidth = pageWidth - 2 * margin - 2 * boxPadding;
    const estimatedNotesHeight = 30;
    
    if (needsNewPage(yPos, estimatedNotesHeight, fixedBoxEndY, bottomBorderPadding)) {
      // Add footer for current page
      const referenceText = `Reference: ${jobRefNo || ""} on ${formatDateForDisplay(createdAt) || ""} by ${createdBy || ""}`;
      addFooter(doc, pageWidth, pageHeight, margin, boxPadding, margin + boxPadding, referenceText, currentPage, totalPages);
      
      // Create new page
      currentPage++;
      totalPages++;
      const newPageInfo = createNewPage(doc, pageWidth, margin, boxPadding, branchInfo, logoImage);
      yPos = newPageInfo.yPos;
      boxStartY = newPageInfo.boxStartY;
      boxX = newPageInfo.boxX;
      boxWidth = newPageInfo.boxWidth;
    }
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(CAN_SECTION_TITLE_FONT_SIZE);
    doc.text("Note:", margin + boxPadding, yPos);
    yPos += 10;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(CAN_BODY_FONT_SIZE);
    
    if (notes.length > 0) {
      notes.forEach((note: string) => {
        if (note) {
          // Split each note to handle overflow
          const noteLines = doc.splitTextToSize(note, notesWidth);
          noteLines.forEach((line: string) => {
            // Check if we need a new page for each line
            if (needsNewPage(yPos, notesLineSpacing, fixedBoxEndY, bottomBorderPadding)) {
              // Add footer for current page
              const referenceText = `Reference: ${jobRefNo || ""} on ${formatDateForDisplay(createdAt) || ""} by ${createdBy || ""}`;
              addFooter(doc, pageWidth, pageHeight, margin, boxPadding, margin + boxPadding, referenceText, currentPage, totalPages);
              
              // Create new page
              currentPage++;
              totalPages++;
              const newPageInfo = createNewPage(doc, pageWidth, margin, boxPadding, branchInfo, logoImage);
              yPos = newPageInfo.yPos;
              boxStartY = newPageInfo.boxStartY;
              boxX = newPageInfo.boxX;
              boxWidth = newPageInfo.boxWidth;
            }
            doc.text(line, margin + boxPadding, yPos);
            yPos += notesLineSpacing;
          });
        }
      });
    }

    // ===== FREIGHT CERTIFICATE SECTION (Only for Air Import) =====
    // Note: Ocean Import doesn't have freight certificate
    
    // Always start certificate on a new page (same logo + company header as other pages)
    doc.addPage();
    currentPage++;
    totalPages++;
    const certPageLayout = setupCanPageLayout(
      doc,
      pageWidth,
      pageHeight,
      margin,
      boxPadding,
      footerHeight,
      branchInfo,
      logoImage,
      { includeTitle: false, includeBorder: false }
    );
    yPos = certPageLayout.contentY;

    // "TO WHOM SO EVER IT MAY CONCERN"
    doc.setFont("helvetica", "normal");
    doc.setFontSize(CAN_BODY_FONT_SIZE);
    doc.text("TO WHOM SO EVER IT MAY CONCERN", pageWidth / 2, yPos, { align: "center" });
    yPos += 8;

    // "FREIGHT CERTIFICATE" title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("FREIGHT CERTIFICATE", pageWidth / 2, yPos, { align: "center" });
    yPos += 15;

    // Certificate body text
    doc.setFont("helvetica", "normal");
    doc.setFontSize(CAN_BODY_FONT_SIZE);
    
    // Get HAWB/HBL number (for air import only - supports both Air and Ocean terminology)
    const hawbForCert = hawbData?.hawb_no || hawbData?.hawb_number || hawbData?.hbl_number || "";
    
    // Get today's date
    const today = new Date();
    const todayFormatted = formatDate(today.toISOString());
    
    // Find Freight charges and Ex Works charges (case-insensitive)
    const freightCharge = charges.find((charge: any) => {
      const chargeName = (charge.charge_name || "").toLowerCase();
      return chargeName.includes("freight") && chargeName.includes("charge");
    });
    const exWorksCharge = charges.find((charge: any) => {
      const chargeName = (charge.charge_name || "").toLowerCase();
      return chargeName.includes("ex") && chargeName.includes("works");
    });
    
    // Get FRT value
    let frtValue = "";
    if (freightCharge) {
      const currency = getChargeCurrencyCode(freightCharge as Record<string, unknown>);
      const amount = freightCharge.amount !== null && freightCharge.amount !== undefined ? String(freightCharge.amount) : "";
      frtValue = currency && amount ? `${currency} ${amount}` : "";
    }
    
    // Get EXW value
    let exwValue = "";
    if (exWorksCharge) {
      const currency = getChargeCurrencyCode(exWorksCharge as Record<string, unknown>);
      const amount = exWorksCharge.amount !== null && exWorksCharge.amount !== undefined ? String(exWorksCharge.amount) : "";
      exwValue = currency && amount ? `${currency} ${amount}` : "";
    }

    // Certificate text
    const certText1 = "This is to inform you that freight & Exworks Amount for";
    doc.text(certText1, margin, yPos);
    yPos += 6;

    const certText2 = `Shippment moved under ${isAirImport ? "HAWB" : "HBL"} ${hawbForCert} is`;
    doc.text(certText2, margin, yPos);
    yPos += 6;

    const certText3 = `Dtd : ${todayFormatted} is`;
    doc.text(certText3, margin, yPos+2);
    yPos += 12;

    // if (frtValue) {
      doc.text(`FRT: ${frtValue}`, margin, yPos);
      yPos += 10;
    // }

    // if (exwValue) {
      doc.text(`EXW: ${exwValue}`, margin, yPos);
      yPos += 10;
    // }

    // Company name and "Operation Team" on the right side
    yPos += 10;
    const rightSideX = pageWidth - margin - 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(CAN_BODY_FONT_SIZE);
    
    // Get company name without the branch suffix in parentheses for cleaner display
    const companyNameForCert = branchInfo.name.replace(/\s*\([^)]*\)\s*$/, "").trim();
    const companyNameLinesSignArea = doc.splitTextToSize(companyNameForCert, 60);
    doc.text(companyNameLinesSignArea, rightSideX, yPos, { align: "right" });
    yPos += companyNameLinesSignArea.length * 4 + 3;
    
    doc.text("Operation Team", rightSideX, yPos, { align: "right" });
  

    // Update total pages count
    totalPages = doc.getNumberOfPages();
    currentPage = doc.getCurrentPageInfo().pageNumber;

    // ===== FINAL PASS: Ensure all pages have footers =====
    // Borders are already drawn when pages are created (first page, createNewPage, addHeaderToExistingPage)
    // Only ensure footers are on all pages
    const referenceText = `Reference: ${jobRefNo || ""} on ${formatDateForDisplay(createdAt) || ""} by ${createdBy || ""}`;
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      doc.setPage(pageNum);
      // Ensure footer is on all pages
      addFooter(doc, pageWidth, pageHeight, margin, boxPadding, margin + boxPadding, referenceText, pageNum, totalPages);
    }
    
    // Set back to last page
    doc.setPage(currentPage);

    // Generate blob URL
    const pdfBlob = doc.output("blob");
    const blobUrl = URL.createObjectURL(pdfBlob);

    return blobUrl;
  } catch (error) {
    console.error("Error generating Cargo Arrival Notice PDF:", error);
    throw error;
  }
};

