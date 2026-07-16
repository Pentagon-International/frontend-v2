import { jsPDF } from "jspdf";
import pentagonFreightInd from "../../../assets/images/pentagon-freight-ind.png";
import pentagonPrimeAmericas from "../../../assets/images/PentagonPrimeUSA.png";
import pentagonPrimeChina from "../../../assets/images/PentagonPrimeChina.png";
import cargoConsolidators from "../../../assets/images/CCIPL.png";
import primeLogo from "../../../assets/images/prime.png";
import { generateUsBillOfLadingPDF } from "./BillOfLadingPDFTemplateUS";

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

// Active (default) branch from user store — matches ProfileDrawer / ExportJobCreate
const getActiveBranchFromStore = () => {
  try {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user?.branches && Array.isArray(user.branches)) {
        return (
          user.branches.find((branch: { is_default?: boolean }) => branch.is_default === true) ||
          user.branches[0] ||
          null
        );
      }
    }
  } catch (error) {
    console.error("Error getting active branch info:", error);
  }
  return null;
};

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
    if (countryName.includes("KENYA") || countryCode === "KE") {
      return primeLogo;
    }
    return primeLogo;
  } catch (error) {
    console.error("Error getting logo by country:", error);
    return primeLogo;
  }
};

const isUsBranchForBillOfLading = (
  country?: { country_code?: string; country_name?: string } | null,
  defaultBranch?: {
    country?: { country_code?: string; country_name?: string };
  } | null,
): boolean => {
  const codes: string[] = [];
  const names: string[] = [];
  const add = (code?: string, name?: string) => {
    if (code) codes.push(String(code).trim().toUpperCase());
    if (name) names.push(String(name).trim().toUpperCase());
  };
  add(country?.country_code, country?.country_name);
  add(defaultBranch?.country?.country_code, defaultBranch?.country?.country_name);
  try {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      const user = JSON.parse(userStr);
      add(user?.country?.country_code, user?.country?.country_name);
      const def = user?.branches?.find(
        (b: { is_default?: boolean }) => b.is_default === true,
      );
      add(def?.country?.country_code, def?.country?.country_name);
    }
  } catch {
    // ignore parse errors
  }
  return (
    codes.includes("US") ||
    names.some(
      (n) => n.includes("USA") || n.includes("UNITED STATES"),
    )
  );
};

const isIndiaBranchForBillOfLading = (
  country?: { country_code?: string; country_name?: string } | null,
  defaultBranch?: {
    country?: { country_code?: string; country_name?: string };
  } | null,
): boolean => {
  const codes: string[] = [];
  const names: string[] = [];
  const add = (code?: string, name?: string) => {
    if (code) codes.push(String(code).trim().toUpperCase());
    if (name) names.push(String(name).trim().toUpperCase());
  };
  add(country?.country_code, country?.country_name);
  add(defaultBranch?.country?.country_code, defaultBranch?.country?.country_name);
  try {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      const user = JSON.parse(userStr);
      add(user?.country?.country_code, user?.country?.country_name);
      const def = user?.branches?.find(
        (b: { is_default?: boolean }) => b.is_default === true,
      );
      add(def?.country?.country_code, def?.country?.country_name);
    }
  } catch {
    // ignore parse errors
  }
  return (
    codes.includes("IN") ||
    names.some((n) => n.includes("INDIA"))
  );
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

/** Draw label + value within a fixed column width; returns bottom Y of cell content. */
const drawTransportCell = (
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  label: string,
  value: string,
  compact = false,
  contentTopPad = 0,
): number => {
  const pad = compact ? 1 : 1.5;
  const lineHeight = compact ? 2.4 : 2.8;
  const topPad = compact ? 1.8 : 2.5;
  const contentY = y + topPad + contentTopPad;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  const labelLines = doc.splitTextToSize(label, width - pad * 2);
  doc.text(labelLines, x + pad, contentY);
  let bottomY = contentY + labelLines.length * lineHeight;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  const valueLines = doc.splitTextToSize(value || "", width - pad * 2);
  if (valueLines.length > 0 && valueLines[0] !== "") {
    doc.text(valueLines, x + pad, bottomY + (compact ? 0.3 : 0.5));
    bottomY += (compact ? 0.3 : 0.5) + valueLines.length * lineHeight;
  }
  return bottomY + (compact ? 0.5 : 1);
};

type IndiaTransportColumn = { widthPct: number; label: string; value: string };

/** Draw a transport row with wrapped text per column. */
const drawTransportRow = (
  doc: jsPDF,
  startY: number,
  rowX: number,
  rowWidth: number,
  columns: IndiaTransportColumn[],
  minRowHeight = 9,
): number => {
  const colBoundaries: number[] = [rowX];
  columns.forEach((col) => {
    colBoundaries.push(colBoundaries[colBoundaries.length - 1] + rowWidth * col.widthPct);
  });

  let maxBottom = startY + minRowHeight;
  columns.forEach((col, i) => {
    const colX = colBoundaries[i];
    const colW = colBoundaries[i + 1] - colX;
    const bottom = drawTransportCell(doc, colX, startY, colW, col.label, col.value);
    maxBottom = Math.max(maxBottom, bottom);
  });

  const endY = minRowHeight > 0 ? Math.max(maxBottom, startY + minRowHeight) : maxBottom;
  doc.line(rowX, endY, rowX + rowWidth, endY);
  for (let i = 1; i < colBoundaries.length - 1; i++) {
    doc.line(colBoundaries[i], startY, colBoundaries[i], endY);
  }
  return endY;
};

/** Draw a transport row with a fixed height (used for aligned India rows). */
const drawTransportRowFixed = (
  doc: jsPDF,
  startY: number,
  rowX: number,
  rowWidth: number,
  columns: IndiaTransportColumn[],
  rowHeight: number,
  drawBottom = true,
  compact = false,
  columnTopPads?: number[],
): number => {
  const endY = startY + rowHeight;
  const colBoundaries: number[] = [rowX];
  columns.forEach((col) => {
    colBoundaries.push(colBoundaries[colBoundaries.length - 1] + rowWidth * col.widthPct);
  });

  columns.forEach((col, i) => {
    const colX = colBoundaries[i];
    const colW = colBoundaries[i + 1] - colX;
    const contentTopPad = columnTopPads?.[i] ?? 0;
    drawTransportCell(doc, colX, startY, colW, col.label, col.value, compact, contentTopPad);
  });

  if (drawBottom) {
    doc.line(rowX, endY, rowX + rowWidth, endY);
  }
  for (let i = 1; i < colBoundaries.length - 1; i++) {
    doc.line(colBoundaries[i], startY, colBoundaries[i], endY);
  }
  return endY;
};

/** Draw consignor / consignee / notify in a fixed-height India left column cell. */
const drawIndiaPartySection = (
  doc: jsPDF,
  startY: number,
  sectionHeight: number,
  innerMargin: number,
  midLineX: number,
  leftBoxWidth: number,
  boxPadding: number,
  title: string,
  name: string,
  address: string,
): number => {
  const textX = innerMargin + boxPadding;
  const textWidth = leftBoxWidth - 2 * boxPadding;
  const titleTopPad = 4;
  let y = startY + titleTopPad;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(title, textX, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  const nameAddressLineHeight = 3;
  const nameLines = doc.splitTextToSize(name || "", textWidth);
  doc.text(nameLines, textX, y);
  y += nameLines.length * nameAddressLineHeight + 0.5;
  const addressLines = doc.splitTextToSize(address || "", textWidth);
  doc.text(addressLines, textX, y);
  const endY = startY + sectionHeight;
  doc.line(innerMargin, endY, midLineX, endY);
  return endY;
};

/** Draw India delivery contact in a fixed-height right column cell. */
const drawIndiaDeliveryContactSection = (
  doc: jsPDF,
  startY: number,
  sectionHeight: number,
  midLineX: number,
  boxPadding: number,
  rightBoxWidth: number,
  company: string,
  address: string,
  tel: string,
  email: string,
): void => {
  const textX = midLineX + boxPadding;
  const textWidth = rightBoxWidth - 2 * boxPadding;
  let y = startY + 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("To Obtain Delivery Contact", textX, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  if (company) {
    doc.text(company, textX, y);
    y += 4;
  }
  const addressLines = doc.splitTextToSize(address || "", textWidth);
  if (addressLines.length > 0 && addressLines[0] !== "") {
    doc.text(addressLines, textX, y);
    y += addressLines.length * 3.5 + 1;
  }
  if (tel) {
    doc.text(`Tel: ${tel}`, textX, y);
    y += 4;
  }
  if (email) {
    doc.text(`Email: ${email}`, textX, y);
  }
  doc.line(midLineX, startY, midLineX, startY + sectionHeight);
};

export const generateBillOfLadingPDF = (
  jobData: any,
  housingData: any,
  defaultBranch: any,
  country?: any
): string => {
  try {
    if (isUsBranchForBillOfLading(country, defaultBranch)) {
      return generateUsBillOfLadingPDF(
        jobData,
        housingData,
        defaultBranch,
      );
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 5;
    const boxPadding = 5;
    const initialYPos = 10;

    const copyLabels = [
      "1st ORIGINAL",
      "2nd ORIGINAL",
      "3rd ORIGINAL",
      "NON NEGOTIABLE COPY",
      "NON NEGOTIABLE COPY",
      "NON NEGOTIABLE COPY",
    ];

    const activeBranch = defaultBranch || getActiveBranchFromStore();
    const isIndiaBranch = isIndiaBranchForBillOfLading(country, defaultBranch);
    const transportLabelGap = isIndiaBranch ? 3 : 4;
    const transportDataHeight = isIndiaBranch ? 5 : 8;
    const transportSectionGap = isIndiaBranch ? 3 : 5;
    const indiaContainerCol1Pct = 0.18;
    const indiaContainerCol2Pct = 0.14;
    const indiaContainerCol3Pct = 0.44;
    const indiaContainerCol4Pct = 0.12;
    const indiaContainerCol5Pct = 0.12;
    const indiaMainContentLeftPct =
      indiaContainerCol1Pct + indiaContainerCol2Pct + indiaContainerCol3Pct;
    const indiaMainContentRightPct =
      indiaContainerCol4Pct + indiaContainerCol5Pct;
    const indiaThirdRowPct = indiaMainContentLeftPct / 3;
    const indiaVesselModesPct = indiaMainContentLeftPct - 0.5;

    const branchInfo = {
      name:
        activeBranch?.reporting_name ||
        activeBranch?.branch_title ||
        activeBranch?.branch_name ||
        "",
      address:
        activeBranch?.reporting_address || activeBranch?.address || "",
      tel: activeBranch?.tel || "",
      email: activeBranch?.email || "",
      pan: activeBranch?.pan || "",
      gstn: activeBranch?.gstn || "",
    };
    const logoImage = getLogoByCountry(activeBranch?.country || country);

    // Extract data from jobData and housingData
    const carrierDetails = jobData?.carrierDetails || {};
    const jobInfo = jobData || {};
    const mblDetails = jobData?.mblDetails || {};

    // Document Numbers — Bill of Lading uses house (HBL) number
    const billOfLadingNo = housingData?.hbl_number || "";
    const shipmentReferenceNo = housingData?.shipment_id || housingData?.hbl_number || "";

    // Consignor (Shipper) Details
    const consignorName = housingData?.shipper_name || "";
    const consignorAddress = housingData?.shipper_address || "";
    const consignorTel = housingData?.shipper_email || ""; // Using email field for tel if needed

    // Consignee Details
    const consigneeName = housingData?.consignee_name || "";
    const consigneeAddress = housingData?.consignee_address || "";

    // Notify Address Details
    const notifyName = housingData?.notify_customer1_name || "";
    const notifyAddress = housingData?.notify_customer1_address || "";

    // To Obtain Delivery Contact
    const deliveryContactCompany =  housingData?.consignee_name || "";
    const deliveryContactAddress =  housingData?.consignee_address || "";
    const deliveryContactTel = housingData?.consignee_email || "";
    const deliveryContactEmail = housingData?.consignee_email || "";

    // Shipment Route and Mode
    const houseOrigin = housingData?.origin_name || "";
    const masterOrigin = mblDetails?.origin_name || jobInfo?.origin_name || "";
    const masterDestination = mblDetails?.destination_name || jobInfo?.destination_name || "";
    const houseDestination = housingData?.destination_name || "";
    const dateOfAcceptance = carrierDetails?.mbl_date
      ? formatDateForDisplay(carrierDetails.mbl_date)
      : "";
    const dateOfPeriodOfDelivery = ""; // Blank as per reference
    const vesselVoyNo = carrierDetails?.vessel_name && carrierDetails?.voyage_number
      ? `${carrierDetails.vessel_name} / ${carrierDetails.voyage_number}`
      : carrierDetails?.vessel_name || carrierDetails?.voyage_number || "";
    const modesOfTransport = "SEA";
    const routePlaceOfTransshipment = "";

    // Goods Description (these are calculated values, not used in PDF but kept for reference)
    const marksAndNumbers = housingData?.marks_no || "NM";
    const commodityDescription = housingData?.commodity_description || "";
    const numberOfPackages = housingData?.cargo_details?.reduce((sum: number, cargo: any) => sum + (parseFloat(cargo.no_of_packages) || 0), 0) || 0;
    const calculatedTotalGrossWeight = housingData?.cargo_details?.reduce((sum: number, cargo: any) => sum + (parseFloat(cargo.gross_weight) || 0), 0) || 0;
    const totalMeasurement = housingData?.cargo_details?.reduce((sum: number, cargo: any) => sum + (parseFloat(cargo.volume) || 0), 0) || 0;
    const hsnCode = ""; // Not available in data structure
    const invoiceNo = ""; // Not available in data structure
    const sbNo = ""; // Not available in data structure

    // Container Details - Enrich cargo_details with container_details data
    const cargoDetailsFromHousing = housingData?.cargo_details || [];
    const containerDetailsFromJob = jobData?.container_details || [];
    
    // Match cargo_details with container_details to get actual_seal_no and container_type_name
    const containerDetails = cargoDetailsFromHousing.map((cargo: any) => {
      // Find matching container_detail by container_no
      const matchingContainer = containerDetailsFromJob.find(
        (container: any) => container.container_no === cargo.container_no
      );
      
      return {
        ...cargo,
        actual_seal_no: cargo.actual_seal_no || matchingContainer?.actual_seal_no || "",
        container_type_name: cargo.container_type_name || matchingContainer?.container_type_details?.container_type_name || "",
      };
    });

    // Financial and Other Particulars
    const freightAmount = "";
    const freightPayableAt = "DESTINATION";
    const numberOfOriginalMTD = "0/ZERO";
    const placeAndDateOfIssue = `${masterOrigin} / ${dateOfAcceptance || formatDateForDisplay(new Date().toISOString())}`;

    // Set document properties
    doc.setProperties({
      title: `Bill Of Lading - ${billOfLadingNo || ""}`,
      subject: "Bill Of Lading",
      author: branchInfo.name,
    });

    // Set line width
    doc.setLineWidth(0.3);
    doc.setDrawColor(0, 0, 0);

    for (let copyIndex = 0; copyIndex < copyLabels.length; copyIndex++) {
      if (copyIndex > 0) doc.addPage();
      const copyLabel = copyLabels[copyIndex];
      let yPos = initialYPos;

    // ===== PAGE BORDER =====
    const pagePadding = 5;
    const innerMargin = margin + pagePadding;
    const innerWidth = pageWidth - 2 * innerMargin;

    // ===== DOCUMENT TITLE SECTION =====
    // yPos = margin + 5;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("MULTIMODAL TRANSPORT DOCUMENT", pageWidth / 2, yPos, { align: "center" });
    yPos += 5;

    // ===== MAIN BOX - DIVIDED INTO TWO HALVES =====
    const mainBoxStartY = yPos;
    const mainBoxWidth = innerWidth;
    // We'll calculate the actual height after content is placed
    const midLineX = pageWidth / 2;
    const leftBoxWidth = (mainBoxWidth) / 2;
    const rightBoxWidth = (mainBoxWidth) / 2;
    
    // Draw page border (only around the main box and below, not above title)
    // We'll draw the full border after calculating the bottom box height

    let leftY = mainBoxStartY + boxPadding;
    let rightY = mainBoxStartY + boxPadding;

    // ===== LEFT BOX CONTENT =====
    let notifySectionEndY = mainBoxStartY + boxPadding;
    let twoCol1SectionEndY = notifySectionEndY;
    let twoCol2SectionTopBorder = notifySectionEndY;
    let twoCol2SectionEndY = notifySectionEndY;
    let twoCol1X = innerMargin + boxPadding;
    let twoCol2X = midLineX;
    let indiaTransportTopBorder = notifySectionEndY;

    if (!isIndiaBranch) {
    // Consignor Section
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("CONSIGNOR", innerMargin + boxPadding, leftY);
    leftY += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    const consignorNameLines = doc.splitTextToSize(consignorName || "", leftBoxWidth - 2 * boxPadding);
    doc.text(consignorNameLines, innerMargin + boxPadding, leftY);
    leftY += consignorNameLines.length * 3.5;
    const consignorAddressLines = doc.splitTextToSize(consignorAddress || "", leftBoxWidth - 2 * boxPadding);
    doc.text(consignorAddressLines, innerMargin + boxPadding, leftY);
    leftY += consignorAddressLines.length * 3.5 + 5;
    const consignorSectionEndY = leftY;

    // Draw horizontal line (bottom border of Consignor section - touches left and middle borders)
    doc.line(innerMargin, consignorSectionEndY, midLineX, consignorSectionEndY);
    leftY += 5;

    // Consignee Section
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("CONSIGNEE", innerMargin + boxPadding, leftY);
    leftY += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    const consigneeNameLines = doc.splitTextToSize(consigneeName || "", leftBoxWidth - 2 * boxPadding);
    doc.text(consigneeNameLines, innerMargin + boxPadding, leftY);
    leftY += consigneeNameLines.length * 3.5;
    const consigneeAddressLines = doc.splitTextToSize(consigneeAddress || "", leftBoxWidth - 2 * boxPadding);
    doc.text(consigneeAddressLines, innerMargin + boxPadding, leftY);
    leftY += consigneeAddressLines.length * 3.5 + 5;
    const consigneeSectionEndY = leftY;

    // Draw horizontal line (bottom border of Consignee section - touches left and middle borders)
    doc.line(innerMargin, consigneeSectionEndY, midLineX, consigneeSectionEndY);
    leftY += 5;

    // Notify Address Section
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("NOTIFY ADDRESS", innerMargin + boxPadding, leftY);
    leftY += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    const notifyNameLines = doc.splitTextToSize(notifyName || "", leftBoxWidth - 2 * boxPadding);
    doc.text(notifyNameLines, innerMargin + boxPadding, leftY);
    leftY += notifyNameLines.length * 3.5;
    const notifyAddressLines = doc.splitTextToSize(notifyAddress || "", leftBoxWidth - 2 * boxPadding);
    doc.text(notifyAddressLines, innerMargin + boxPadding, leftY);
    leftY += notifyAddressLines.length * 3.5 + 5;
    notifySectionEndY = leftY;

    // Draw horizontal line (bottom border of Notify Address section - touches left and middle borders)
    doc.line(innerMargin, notifySectionEndY, midLineX, notifySectionEndY);
    leftY += 5;

    // Transport rows on left half (non-India legacy layout)
    twoCol1SectionEndY = notifySectionEndY;
    twoCol2SectionTopBorder = leftY;
    twoCol2SectionEndY = notifySectionEndY;

      // Three Column Section: Place of acceptance, Date of acceptance, Port of Loading
      const threeColSectionTopBorder = leftY - transportSectionGap;
      const threeColWidth = (leftBoxWidth - 2 * boxPadding - 4) / 3;
      const threeCol1X = innerMargin + boxPadding;
      const threeCol2X = innerMargin + boxPadding + threeColWidth;
      const threeCol3X = innerMargin + boxPadding + threeColWidth * 2;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text("Place of acceptance:", threeCol1X, leftY);
      doc.text("Date of acceptance:", threeCol2X, leftY);
      doc.text("Port of Loading:", threeCol3X, leftY);
      leftY += transportLabelGap;
      doc.setFont("helvetica", "normal");
      doc.text(houseOrigin || "", threeCol1X, leftY);
      doc.text(dateOfAcceptance || "", threeCol2X, leftY);
      doc.text(masterOrigin || "", threeCol3X, leftY);
      leftY += transportDataHeight;
      const threeColSectionEndY = leftY;

      doc.line(threeCol2X - 2, threeColSectionTopBorder, threeCol2X - 2, threeColSectionEndY);
      doc.line(threeCol3X - 2, threeColSectionTopBorder, threeCol3X - 2, threeColSectionEndY);
      doc.line(innerMargin, threeColSectionEndY, midLineX, threeColSectionEndY);
      leftY += transportSectionGap;

      // Two Column Section: Place of Discharge, Place of Delivery
      const twoCol1SectionTopBorder = leftY - transportSectionGap;
      const twoColWidth = (leftBoxWidth - 2 * boxPadding - 2) / 2;
      twoCol1X = innerMargin + boxPadding;
      twoCol2X = innerMargin + boxPadding + twoColWidth;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text("Place of Discharge:", twoCol1X, leftY);
      doc.text("Place of Delivery:", twoCol2X, leftY);
      leftY += transportLabelGap;
      doc.setFont("helvetica", "normal");
      doc.text(masterDestination || "", twoCol1X, leftY);
      doc.text(houseDestination || "", twoCol2X, leftY);
      leftY += transportDataHeight;
      twoCol1SectionEndY = leftY;

      doc.line(twoCol2X - 2, twoCol1SectionTopBorder, twoCol2X - 2, twoCol1SectionEndY);
      doc.line(innerMargin, twoCol1SectionEndY, midLineX, twoCol1SectionEndY);
      leftY += transportSectionGap;

      // Two Column Section: Vessel Voy No, Date of Period of Delivery
      twoCol2SectionTopBorder = leftY - transportSectionGap;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text("Vessel Voy No:", twoCol1X, leftY);
      doc.text("Date of Period of Delivery:", twoCol2X, leftY);
      leftY += transportLabelGap;
      doc.setFont("helvetica", "normal");
      doc.text(vesselVoyNo || "", twoCol1X, leftY);
      doc.text(dateOfPeriodOfDelivery || "", twoCol2X, leftY);
      leftY += transportDataHeight;
      twoCol2SectionEndY = leftY;
    } // end non-India left box

    // Vessel section borders drawn after column alignment (single bottom line at container table)

    // ===== RIGHT BOX CONTENT =====
    
    // Bill of Lading Title (house / HBL number)
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(
      `Bill of Lading: ${billOfLadingNo || ""}`,
      midLineX + boxPadding,
      rightY,
    );
    rightY += isIndiaBranch ? 6 : 8;
    if (isIndiaBranch) {
      doc.setFont("helvetica", "bold");
      doc.text(
        "MTO NO : MTO/DGS/3208/SEP/2026",
        midLineX + boxPadding,
        rightY,
      );
      rightY += 4;
    }
    const billTitleSectionEndY = rightY;

    // Draw horizontal line (bottom border of Bill of Lading title - touches middle and right borders)
    doc.line(midLineX, billTitleSectionEndY, innerMargin + innerWidth, billTitleSectionEndY);
    rightY += 5;

    // Company Section (Branch title at center, logo, address)
    const companySectionCenterX = midLineX + rightBoxWidth / 2;
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    const companyTitleLines = doc.splitTextToSize(
      branchInfo.name || "",
      rightBoxWidth - 2 * boxPadding,
    );
    doc.text(companyTitleLines, companySectionCenterX, rightY, {
      align: "center",
    });
    rightY += companyTitleLines.length * 3.5;

    if (logoImage) {
      try {
        const logoPadding = 3;
        const logoWidth = 40;
        const logoHeight = 15;
        const availableWidth = rightBoxWidth - 2 * boxPadding;
        const logoX = midLineX + boxPadding + (availableWidth - logoWidth) / 2;

        doc.addImage(
          logoImage,
          "PNG",
          logoX,
          rightY,
          logoWidth,
          logoHeight,
          undefined,
          "FAST",
        );

        rightY += logoHeight + logoPadding + 3;
      } catch (error) {
        console.warn("Could not add logo to PDF, continuing without logo:", error);
      }
    }

    // Branch Address
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    const branchAddressLines = doc.splitTextToSize(
      branchInfo.address || "",
      rightBoxWidth - 2 * boxPadding,
    );
    doc.text(branchAddressLines, companySectionCenterX, rightY, {
      align: "center",
    });
    rightY += branchAddressLines.length * 3.5;
    
    // PAN and GSTN (if available)
    if (branchInfo.pan || branchInfo.gstn) {
      const panGstnText = [];
      if (branchInfo.pan) {
        panGstnText.push(`PAN: ${branchInfo.pan}`);
      }
      if (branchInfo.gstn) {
        panGstnText.push(`GSTN: ${branchInfo.gstn}`);
      }
      if (panGstnText.length > 0) {
        doc.setFontSize(6);
        doc.text(panGstnText.join(" | "), midLineX + boxPadding, rightY);
        rightY += 3.5;
      }
    }
    
    const companySectionEndY = rightY;

    // Draw horizontal line (bottom border of Company section - touches middle and right borders)
    doc.line(midLineX, companySectionEndY, innerMargin + innerWidth, companySectionEndY);
    rightY += isIndiaBranch ? 2 : 5;
    if (isIndiaBranch) {
      rightY += 1.5;
    }

    // Condition Section
    doc.setFont("helvetica", "normal");
    doc.setFontSize(isIndiaBranch ? 6 : 7);
    const conditionParagraph1 = "Taken in charge in apparently good condition here in at the place of receipt for transport and delivery as mentioned above, unless otherwise stated. The MTO in accordance with the provisions contained in the MTD undertakes to perform or to procure the performance of the multimodal transport from the place at which the goods are taken in charge, to the place designated for delivery and assumes responsibility for such transport.";
    const conditionParagraph2 = "One of the MTD (s) must be surrendered, duly endorsed in exchange for the goods. In witness where of the original MTD all of this tenure and date have been signed in the number indicated below one of which being accomplished the other(s) to be void.";
    
    const conditionLineHeight = isIndiaBranch ? 2.5 : 3.5;
    const conditionHorizontalPad = isIndiaBranch ? 2 : boxPadding;
    const conditionTextWidth = rightBoxWidth - 2 * conditionHorizontalPad;
    const conditionLines1 = doc.splitTextToSize(conditionParagraph1, conditionTextWidth);
    doc.text(conditionLines1, midLineX + conditionHorizontalPad, rightY);
    rightY += isIndiaBranch
      ? conditionLines1.length * conditionLineHeight + 0.5
      : 20;

    const conditionLines2 = doc.splitTextToSize(conditionParagraph2, conditionTextWidth);
    doc.text(conditionLines2, midLineX + conditionHorizontalPad, rightY);
    rightY += isIndiaBranch
      ? conditionLines2.length * conditionLineHeight
      : conditionLines2.length * 3.5;
    const conditionSectionEndY = rightY;

    // Draw horizontal line (bottom border of Condition section - touches middle and right borders)
    doc.line(midLineX, conditionSectionEndY, innerMargin + innerWidth, conditionSectionEndY);
    if (!isIndiaBranch) {
      rightY += 5;
    }

    let deliveryContactSectionEndY = conditionSectionEndY;

    if (!isIndiaBranch) {
      // Delivery Contact Section
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text("To Obtain Delivery Contact", midLineX + boxPadding, rightY);
      rightY += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(`${deliveryContactCompany || ""}`, midLineX + boxPadding, rightY);
      rightY += 4;
      const deliveryAddressLines = doc.splitTextToSize(`${deliveryContactAddress || ""}`, rightBoxWidth - 2 * boxPadding);
      doc.text(deliveryAddressLines, midLineX + boxPadding, rightY);
      rightY += deliveryAddressLines.length * 3.5;
      if (deliveryContactTel) {
        doc.text(`Tel: ${deliveryContactTel}`, midLineX + boxPadding, rightY);
        rightY += 4;
      }
      if (deliveryContactEmail) {
        doc.text(`Email: ${deliveryContactEmail}`, midLineX + boxPadding, rightY);
        rightY += 4;
      }
      deliveryContactSectionEndY = rightY;

      // Draw horizontal line (bottom border of Delivery Contact section - touches middle and right borders)
      doc.line(midLineX, deliveryContactSectionEndY, innerMargin + innerWidth, deliveryContactSectionEndY);
      rightY += transportSectionGap;
    }

    // India: left party sections, transport rows, delivery contact, and vessel row
    let mainTopSectionEndY = deliveryContactSectionEndY;
    if (isIndiaBranch) {
      const indiaTransportRow1Height = 9;
      const indiaDischargeRowHeight = 9;
      const indiaVesselRowHeight = 9;
      const indiaTransportHeightSaved = 7;
      const indiaTransportContentTopPad = 1.5;
      const parallelZoneStartY = mainBoxStartY;
      const partyZoneEndY = conditionSectionEndY;
      const indiaBasePartySectionHeight = (partyZoneEndY - parallelZoneStartY) / 3;
      const indiaNotifySectionHeight =
        indiaBasePartySectionHeight + indiaTransportHeightSaved;

      let partyY = parallelZoneStartY;
      partyY = drawIndiaPartySection(
        doc,
        partyY,
        indiaBasePartySectionHeight,
        innerMargin,
        midLineX,
        leftBoxWidth,
        boxPadding,
        "CONSIGNOR",
        consignorName,
        consignorAddress,
      );
      partyY = drawIndiaPartySection(
        doc,
        partyY,
        indiaBasePartySectionHeight,
        innerMargin,
        midLineX,
        leftBoxWidth,
        boxPadding,
        "CONSIGNEE",
        consigneeName,
        consigneeAddress,
      );
      const notifyEndY = drawIndiaPartySection(
        doc,
        partyY,
        indiaNotifySectionHeight,
        innerMargin,
        midLineX,
        leftBoxWidth,
        boxPadding,
        "NOTIFY ADDRESS",
        notifyName,
        notifyAddress,
      );

      notifySectionEndY = notifyEndY;
      let transportLeftY = notifyEndY;

      transportLeftY = drawTransportRowFixed(
        doc,
        transportLeftY,
        innerMargin,
        leftBoxWidth,
        [
          { widthPct: 1 / 3, label: "Place of acceptance:", value: houseOrigin || "" },
          { widthPct: 1 / 3, label: "Date of acceptance:", value: dateOfAcceptance || "" },
          { widthPct: 1 / 3, label: "Port of Loading:", value: masterOrigin || "" },
        ],
        indiaTransportRow1Height,
        true,
        true,
        [
          indiaTransportContentTopPad,
          indiaTransportContentTopPad,
          indiaTransportContentTopPad,
        ],
      );

      const deliveryContactStartY = partyZoneEndY;
      transportLeftY = drawTransportRowFixed(
        doc,
        transportLeftY,
        innerMargin,
        leftBoxWidth,
        [
          { widthPct: 0.5, label: "Place of Discharge:", value: masterDestination || "" },
          { widthPct: 0.5, label: "Place of Delivery:", value: houseDestination || "" },
        ],
        indiaDischargeRowHeight,
        false,
        true,
        [indiaTransportContentTopPad, indiaTransportContentTopPad],
      );

      const sharedTransportBottomY = transportLeftY;
      const deliveryContactHeight = sharedTransportBottomY - deliveryContactStartY;

      drawIndiaDeliveryContactSection(
        doc,
        deliveryContactStartY,
        deliveryContactHeight,
        midLineX,
        boxPadding,
        rightBoxWidth,
        deliveryContactCompany || "",
        deliveryContactAddress || "",
        deliveryContactTel || "",
        deliveryContactEmail || "",
      );

      doc.line(innerMargin, sharedTransportBottomY, innerMargin + innerWidth, sharedTransportBottomY);

      deliveryContactSectionEndY = sharedTransportBottomY;
      twoCol1SectionEndY = sharedTransportBottomY;
      indiaTransportTopBorder = sharedTransportBottomY;
      leftY = sharedTransportBottomY;

      mainTopSectionEndY = drawTransportRowFixed(
        doc,
        sharedTransportBottomY,
        innerMargin,
        innerWidth,
        [
          { widthPct: 0.25, label: "Vessel Voy No:", value: vesselVoyNo || "" },
          {
            widthPct: 0.25,
            label: "Date of Period of Delivery:",
            value: dateOfPeriodOfDelivery || "",
          },
          {
            widthPct: indiaVesselModesPct,
            label: "Modes/ Means of Transport:",
            value: modesOfTransport || "",
          },
          {
            widthPct: indiaMainContentRightPct,
            label: "Route/ Place of Transshipment (if any):",
            value: routePlaceOfTransshipment || "",
          },
        ],
        indiaVesselRowHeight,
        true,
        true,
        [
          indiaTransportContentTopPad,
          indiaTransportContentTopPad,
          indiaTransportContentTopPad,
          indiaTransportContentTopPad,
        ],
      );
    }

    // Means of Transport Section - Divided into two halves with vertical border (non-India only)
    const meansOfTransportSectionTopBorder = rightY - transportSectionGap;
    let meansOfTransportMidX = midLineX;
    if (!isIndiaBranch) {
      const meansOfTransportHalfWidth = (rightBoxWidth - 2 * boxPadding - 2) / 2;
      const meansOfTransportLeftX = midLineX + boxPadding;
      const meansOfTransportRightX = midLineX + boxPadding + meansOfTransportHalfWidth;
      meansOfTransportMidX = midLineX + boxPadding + meansOfTransportHalfWidth;
      
      // Left half: Modes/ Means of Transport
      let leftHalfY = rightY;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text("Modes/ Means of Transport:", meansOfTransportLeftX, leftHalfY);
      leftHalfY += transportLabelGap;
      doc.setFont("helvetica", "normal");
      doc.text(modesOfTransport || "", meansOfTransportLeftX, leftHalfY);
      leftHalfY += transportDataHeight;

      // Right half: Route/ Place of Transhipments
      let rightHalfY = rightY;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text("Route/ Place of Transhipments (if any):", meansOfTransportRightX + 2, rightHalfY);
      rightHalfY += transportLabelGap;
      doc.setFont("helvetica", "normal");
      const routeLines = doc.splitTextToSize(routePlaceOfTransshipment || "", meansOfTransportHalfWidth - 2);
      doc.text(routeLines, meansOfTransportRightX + 2, rightHalfY);
      rightHalfY += Math.max(routeLines.length * 3.5, transportDataHeight);

      rightY = Math.max(leftHalfY, rightHalfY);
    }

    // Calculate actual main box height (align left vessel and right sections to same bottom)
    if (!isIndiaBranch) {
      const finalLeftY = twoCol2SectionEndY;
      const finalRightY = rightY;
      mainTopSectionEndY = Math.max(finalLeftY, finalRightY);
    }

    leftY = mainTopSectionEndY;
    rightY = mainTopSectionEndY;

    const actualMainBoxHeight = isIndiaBranch
      ? mainTopSectionEndY - mainBoxStartY
      : mainTopSectionEndY - mainBoxStartY + boxPadding;

    // Container table starts immediately below vessel row (no extra padding row)
    const bottomBoxStartY = isIndiaBranch
      ? mainTopSectionEndY
      : mainBoxStartY + actualMainBoxHeight;
    
    // Calculate footer section height
    const footerSectionHeight = 35; // Approximate height for footer section (top row + bottom section)
    const footerStartY = pageHeight - innerMargin - footerSectionHeight;
    
    // Calculate container details section height (ends before footer section)
    const containerDetailsSectionHeight = footerStartY - bottomBoxStartY;
    
    // Calculate full box height (top box + container details section only, footer is separate)
    const fullBoxHeight = containerDetailsSectionHeight + actualMainBoxHeight;
    
    // Draw the full box border (top box + container details section as one continuous box)
    drawBox(doc, innerMargin, mainBoxStartY, mainBoxWidth, fullBoxHeight);
    // Center divider and section splits — single bottom at Gross Weight / container table
    if (isIndiaBranch) {
      doc.line(midLineX, mainBoxStartY, midLineX, indiaTransportTopBorder);
    } else {
      doc.line(midLineX, mainBoxStartY, midLineX, bottomBoxStartY);
      doc.line(
        twoCol2X - 2,
        twoCol2SectionTopBorder,
        twoCol2X - 2,
        bottomBoxStartY,
      );
      doc.line(
        meansOfTransportMidX,
        meansOfTransportSectionTopBorder,
        meansOfTransportMidX,
        bottomBoxStartY,
      );
    }

    // Draw the shared horizontal border between top box and container details section
    doc.line(innerMargin, bottomBoxStartY, innerMargin + mainBoxWidth, bottomBoxStartY);
    
    // ===== CONTAINER DETAILS SECTION =====
    let containerDetailsY = bottomBoxStartY + boxPadding;
    
    // Define column widths (5 columns)
    const containerCol1Width = mainBoxWidth * (isIndiaBranch ? indiaContainerCol1Pct : 0.25);
    const containerCol2Width = mainBoxWidth * (isIndiaBranch ? indiaContainerCol2Pct : 0.15);
    const containerCol3Width = mainBoxWidth * (isIndiaBranch ? indiaContainerCol3Pct : 0.3);
    const containerCol4Width = mainBoxWidth * (isIndiaBranch ? indiaContainerCol4Pct : 0.15);
    const containerCol5Width = mainBoxWidth * (isIndiaBranch ? indiaContainerCol5Pct : 0.15);
    
    // Calculate column X positions
    const containerCol1X = innerMargin;
    const containerCol2X = containerCol1X + containerCol1Width;
    const containerCol3X = containerCol2X + containerCol2Width;
    const containerCol4X = containerCol3X + containerCol3Width;
    const containerCol5X = containerCol4X + containerCol4Width;
    
    // Draw header row - start from the top border of container details section
    doc.setFont("helvetica", "bold");
    const containerHeaderFontSize = isIndiaBranch ? 6 : 7;
    const containerHeaderLineHeight = isIndiaBranch ? 2.6 : 3.5;
    const containerHeaderMinPad = isIndiaBranch ? 2 : 5;
    const containerHeaderTopPad = isIndiaBranch ? 4 : 3;
    doc.setFontSize(containerHeaderFontSize);
    const headerY = bottomBoxStartY + containerHeaderTopPad;
    
    // Header texts - Column 1
    doc.text("Container No. (S)", containerCol1X + boxPadding, headerY);
    
    // Header texts - Column 2
    const marksHeaderText = "Marks and Numbers";
    if (isIndiaBranch) {
      const marksHeaderLines = doc.splitTextToSize(
        marksHeaderText,
        containerCol2Width - 2 * boxPadding,
      );
      doc.text(marksHeaderLines, containerCol2X + boxPadding, headerY);
    } else {
      const marksHeaderWidth = doc.getTextWidth(marksHeaderText);
      const marksHeaderCenterX =
        containerCol2X + containerCol2Width / 2 - marksHeaderWidth / 2;
      doc.text(marksHeaderText, marksHeaderCenterX, headerY);
    }
    
    // Header texts - Column 3 (description — fixed two-line title for India)
    const descHeaderLine1 = "Number of packages, kinds of packages, general";
    const descHeaderLine2 = "description of goods. (said to contain)";
    let descHeaderHeight: number;
    if (isIndiaBranch) {
      const descHeaderCenterX = containerCol3X + containerCol3Width / 2;
      doc.text(descHeaderLine1, descHeaderCenterX, headerY, { align: "center" });
      doc.text(descHeaderLine2, descHeaderCenterX, headerY + containerHeaderLineHeight, {
        align: "center",
      });
      descHeaderHeight = 2 * containerHeaderLineHeight;
    } else {
      const descHeaderText =
        "Number of packages, kinds of packages, general description of goods. (said to contain)";
      const descHeaderLines = doc.splitTextToSize(
        descHeaderText,
        containerCol3Width - 2 * boxPadding,
      );
      doc.text(descHeaderLines, containerCol3X + boxPadding, headerY);
      descHeaderHeight = descHeaderLines.length * containerHeaderLineHeight;
    }
    const marksHeaderHeight = isIndiaBranch
      ? doc.splitTextToSize(marksHeaderText, containerCol2Width - 2 * boxPadding).length *
        containerHeaderLineHeight
      : 0;
    
    // Header texts - Column 4
    doc.text("Gross Weight", containerCol4X + boxPadding, headerY);
    
    // Header texts - Column 5
    doc.text("Measurement", containerCol5X + boxPadding, headerY);
    
    // Calculate header height based on the tallest column
    const headerBottomY =
      headerY +
      Math.max(containerHeaderMinPad, descHeaderHeight, marksHeaderHeight);
    
    // Draw header row bottom border
    doc.line(innerMargin, headerBottomY, innerMargin + mainBoxWidth, headerBottomY);
    
    // Draw vertical column lines for headers - touching the top border
    doc.line(containerCol2X, bottomBoxStartY, containerCol2X, headerBottomY);
    doc.line(containerCol3X, bottomBoxStartY, containerCol3X, headerBottomY);
    doc.line(containerCol4X, bottomBoxStartY, containerCol4X, headerBottomY);
    doc.line(containerCol5X, bottomBoxStartY, containerCol5X, headerBottomY);
    
    // Data rows
    let currentRowY = headerBottomY + 3;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    
    // Track the maximum Y position for all rows to draw vertical borders to footer
    let maxRowY = currentRowY;
    
    // Get summary from the specific housingData being processed (each house has its own summary)
    // First try to get from housingData, if not available, try to find matching housing_detail in jobData
    let summary = housingData?.summary || {};
    if (!summary || Object.keys(summary).length === 0) {
      // Fallback: Find matching housing_detail in jobData by ID
      const housingDetailsArray = jobData?.housing_details || [];
      const housingId = housingData?.id;
      if (housingId) {
        const matchingHousing = housingDetailsArray.find(
          (house: any) => house.id === housingId || house.id === Number(housingId)
        );
        summary = matchingHousing?.summary || {};
      }
    }
    const totalNoOfPackages = summary?.total_no_of_packages || "";
    const totalGrossWeight = summary?.total_gross_weight || "";
    const totalVolume = summary?.total_volume || "";
    
    // Prepare summary text values (single values for columns 2-5)
    const packagesText = totalNoOfPackages ? `${totalNoOfPackages} PACKAGE(S)` : "";
    const grossWeightText = totalGrossWeight ? `${totalGrossWeight} KGS` : "";
    const volumeText = totalVolume ? `${totalVolume} CBM` : "";
    const marksNo = housingData?.marks_no || "";
    const commodityDesc = housingData?.commodity_description || "";
    
    // Prepare text lines for single value columns (2-5)
    const marksLines = marksNo ? doc.splitTextToSize(marksNo, containerCol2Width - 2 * boxPadding) : [];
    const commodityLines = commodityDesc ? doc.splitTextToSize(commodityDesc, containerCol3Width - 2 * boxPadding) : [];
    
    // Pre-calculate heights for Column 3 (Description) content
    const containerTypes = summary?.container_type || [];
    let col3ContentHeight = 0;
    if (packagesText) col3ContentHeight += 3.5;
    if (Array.isArray(containerTypes) && containerTypes.length > 0) {
      col3ContentHeight += containerTypes.length * 3.5;
    }
    if (commodityLines.length > 0) {
      col3ContentHeight += commodityLines.length * 3.5;
    }
    
    // Pre-calculate heights for each container entry in Column 1
    interface ContainerEntry {
      cargo: any;
      lines: string[];
      height: number;
    }
    const containerEntries: ContainerEntry[] = [];
    containerDetails.forEach((cargo: any) => {
      const lines: string[] = [];
      if (cargo?.container_no) lines.push(cargo.container_no);
      if (cargo?.container_type_name) lines.push(cargo.container_type_name);
      if (cargo?.actual_seal_no) lines.push(`Seal No: ${cargo.actual_seal_no}`);
      if (cargo?.gross_weight) lines.push(`Gross Wt: ${cargo.gross_weight} KGS`);
      if (cargo?.volume !== undefined && cargo?.volume !== null && cargo?.volume !== "") {
        lines.push(`Volume: ${cargo.volume} CBM`);
      }
      if (cargo?.no_of_packages) lines.push(`Pkgs: ${cargo.no_of_packages} PACKAGE(S)`);
      const height = lines.length * 3.5 + 2; // 2 units spacing between entries
      containerEntries.push({ cargo, lines, height });
    });
    
    // Calculate total height needed for Column 1
    const totalCol1Height = containerEntries.reduce((sum, entry) => sum + entry.height, 0);
    
    // Calculate available space on first page (before footer)
    const availableHeightFirstPage = footerStartY - currentRowY - 5; // 5 units buffer
    
    // Determine how much content fits on first page
    let firstPageCol1Height = 0;
    let firstPageContainerCount = 0;
    const firstPageCommodityLines: string[] = [];
    
    // Calculate how many containers fit on first page
    for (let i = 0; i < containerEntries.length; i++) {
      const entry = containerEntries[i];
      if (firstPageCol1Height + entry.height <= availableHeightFirstPage) {
        firstPageCol1Height += entry.height;
        firstPageContainerCount++;
      } else {
        break;
      }
    }
    
    // Calculate how much of commodity_description fits on first page
    // We need to fit: packagesText + containerTypes + commodityLines
    // Use the maximum height between Column 1 and Column 3 to determine what fits
    let col3Y = 0;
    if (packagesText) {
      col3Y += 3.5;
    }
    if (Array.isArray(containerTypes) && containerTypes.length > 0) {
      col3Y += containerTypes.length * 3.5;
    }
    // Calculate how many commodity lines fit
    const maxCol3Height = Math.max(firstPageCol1Height, availableHeightFirstPage);
    let commodityLinesUsed = 0;
    for (let i = 0; i < commodityLines.length; i++) {
      if (col3Y + 3.5 <= maxCol3Height) {
        firstPageCommodityLines.push(commodityLines[i]);
        col3Y += 3.5;
        commodityLinesUsed++;
      } else {
        break;
      }
    }
    
    // Function to draw headers and borders for subsequent pages
    const drawSubsequentPageHeaders = (pageStartY: number) => {
      const pageBoxStartY = pageStartY;
      const pageBoxHeight = pageHeight - pageBoxStartY - innerMargin - 5;
      const pageBoxWidth = innerWidth;
      
      // Draw border (4 sides with spacing)
      drawBox(doc, innerMargin, pageBoxStartY, pageBoxWidth, pageBoxHeight);
      
      // Draw headers
      doc.setFont("helvetica", "bold");
      doc.setFontSize(isIndiaBranch ? 6 : 7);
      const pageHeaderY = pageBoxStartY + (isIndiaBranch ? 4 : 3);
      const pageHeaderLineHeight = isIndiaBranch ? 2.6 : 3.5;
      const pageHeaderMinPad = isIndiaBranch ? 2 : 5;
      
      // Header texts
      doc.text("Container No. (S)", containerCol1X + boxPadding, pageHeaderY);
      
      const marksHeaderText = "Marks and Numbers";
      if (isIndiaBranch) {
        const marksHeaderLines = doc.splitTextToSize(
          marksHeaderText,
          containerCol2Width - 2 * boxPadding,
        );
        doc.text(marksHeaderLines, containerCol2X + boxPadding, pageHeaderY);
      } else {
        const marksHeaderWidth = doc.getTextWidth(marksHeaderText);
        const marksHeaderCenterX =
          containerCol2X + containerCol2Width / 2 - marksHeaderWidth / 2;
        doc.text(marksHeaderText, marksHeaderCenterX, pageHeaderY);
      }
      
      const descHeaderLine1 = "Number of packages, kinds of packages, general";
      const descHeaderLine2 = "description of goods. (said to contain)";
      let pageDescHeaderHeight: number;
      if (isIndiaBranch) {
        const descHeaderCenterX = containerCol3X + containerCol3Width / 2;
        doc.text(descHeaderLine1, descHeaderCenterX, pageHeaderY, { align: "center" });
        doc.text(descHeaderLine2, descHeaderCenterX, pageHeaderY + pageHeaderLineHeight, {
          align: "center",
        });
        pageDescHeaderHeight = 2 * pageHeaderLineHeight;
      } else {
        const descHeaderText =
          "Number of packages, kinds of packages, general description of goods. (said to contain)";
        const descHeaderLines = doc.splitTextToSize(
          descHeaderText,
          containerCol3Width - 2 * boxPadding,
        );
        doc.text(descHeaderLines, containerCol3X + boxPadding, pageHeaderY);
        pageDescHeaderHeight = descHeaderLines.length * pageHeaderLineHeight;
      }
      const pageMarksHeaderHeight = isIndiaBranch
        ? doc.splitTextToSize(marksHeaderText, containerCol2Width - 2 * boxPadding).length *
          pageHeaderLineHeight
        : 0;
      
      doc.text("Gross Weight", containerCol4X + boxPadding, pageHeaderY);
      doc.text("Measurement", containerCol5X + boxPadding, pageHeaderY);
      
      const pageHeaderBottomY =
        pageHeaderY + Math.max(pageHeaderMinPad, pageDescHeaderHeight, pageMarksHeaderHeight);
      
      // Draw header row bottom border
      doc.line(innerMargin, pageHeaderBottomY, innerMargin + pageBoxWidth, pageHeaderBottomY);
      
      // Draw vertical column lines for headers
      doc.line(containerCol2X, pageBoxStartY, containerCol2X, pageHeaderBottomY);
      doc.line(containerCol3X, pageBoxStartY, containerCol3X, pageHeaderBottomY);
      doc.line(containerCol4X, pageBoxStartY, containerCol4X, pageHeaderBottomY);
      doc.line(containerCol5X, pageBoxStartY, containerCol5X, pageHeaderBottomY);
      
      return pageHeaderBottomY + 3;
    };
    
    // Declare variables for tracking what was drawn on first page (accessible after if/else)
    let containersDrawnOnFirstPage = 0;
    let commodityLinesDrawn = 0;
    
    // Draw first page content
    if (containerDetails && containerDetails.length > 0) {
      // Draw single values for columns 2, 4, 5 once (only on first page)
      const singleValueStartY = currentRowY;
      
      // Column 2: Marks and Numbers (single value, drawn once on first page only)
      if (marksLines.length > 0) {
        doc.text(marksLines, containerCol2X + boxPadding, singleValueStartY);
      }
      
      // Column 3: Description (partial on first page) - total_no_of_packages, container_type values, and commodity_description
      let col3Y = singleValueStartY;
      let col3MaxY = col3Y;

      if (packagesText) {
        // Check if this fits before drawing
        if (col3Y + 3.5 <= footerStartY - 5) {
          doc.text(packagesText, containerCol3X + boxPadding, col3Y);
          col3Y += 3.5;
          col3MaxY = col3Y;
        }
      }
      // Display container_type values from summary (each on a new line)
      if (Array.isArray(containerTypes) && containerTypes.length > 0) {
        containerTypes.forEach((containerType: string) => {
          if (containerType && col3Y + 3.5 <= footerStartY - 5) {
            doc.text(containerType, containerCol3X + boxPadding, col3Y);
            col3Y += 3.5;
            col3MaxY = col3Y;
          }
        });
      }
      // Display commodity_description (partial on first page)
      commodityLinesDrawn = 0;
      for (let i = 0; i < commodityLines.length; i++) {
        if (col3Y + 3.5 <= footerStartY - 5) {
          doc.text(commodityLines[i], containerCol3X + boxPadding, col3Y);
          col3Y += 3.5;
          col3MaxY = col3Y;
          commodityLinesDrawn++;
        } else {
          break;
        }
      }

      // Red copy label at end of Column 3 data area (just above footer border)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(255, 0, 0);
      doc.text(copyLabel, containerCol3X + boxPadding, footerStartY - 6);
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      
      // Column 4: Gross Weight (single value, drawn once on first page only)
      if (grossWeightText) {
        doc.text(grossWeightText, containerCol4X + boxPadding, singleValueStartY);
      }
      
      // Column 5: Measurement (single value, drawn once on first page only)
      if (volumeText) {
        doc.text(volumeText, containerCol5X + boxPadding, singleValueStartY);
      }
      
      // Draw Column 1 containers that fit on first page - check during drawing
      let col1Y = currentRowY;
      containersDrawnOnFirstPage = 0;
      
      for (let i = 0; i < containerEntries.length; i++) {
        const entry = containerEntries[i];
        // Check if this entry will fit on first page (with buffer for footer)
        const entryEndY = col1Y + entry.height;
        if (entryEndY > footerStartY - 5) {
          // This entry doesn't fit, stop drawing on first page
          break;
        }
        
        // Draw the entry
        entry.lines.forEach((line: string) => {
          doc.text(line, containerCol1X + boxPadding, col1Y);
          col1Y += 3.5;
        });
        col1Y += 2; // Spacing between entries
        containersDrawnOnFirstPage++;
      }
      
      // Update col3MaxY to consider Column 1 height as well
      col3MaxY = Math.max(col3MaxY, col1Y);
      
      // Draw vertical column lines from header bottom to footer section start (first page)
      const containerDetailsEndY = footerStartY;
      doc.line(containerCol2X, headerBottomY, containerCol2X, containerDetailsEndY);
      doc.line(containerCol3X, headerBottomY, containerCol3X, containerDetailsEndY);
      doc.line(containerCol4X, headerBottomY, containerCol4X, containerDetailsEndY);
      doc.line(containerCol5X, headerBottomY, containerCol5X, containerDetailsEndY);
    } else {
      // Empty row if no container details - draw vertical lines to footer section start
      const containerDetailsEndY = footerStartY;

      // Red copy label at end of Column 3 data area even when no container details exist
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(255, 0, 0);
      doc.text(copyLabel, containerCol3X + boxPadding, footerStartY - 6);
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6);

      doc.line(containerCol2X, headerBottomY, containerCol2X, containerDetailsEndY);
      doc.line(containerCol3X, headerBottomY, containerCol3X, containerDetailsEndY);
      doc.line(containerCol4X, headerBottomY, containerCol4X, containerDetailsEndY);
      doc.line(containerCol5X, headerBottomY, containerCol5X, containerDetailsEndY);
    }
    
    // Draw bottom border of container details section (top border of footer section) - FIRST PAGE ONLY
    doc.line(innerMargin, footerStartY, innerMargin + mainBoxWidth, footerStartY);
    
    // ===== FOOTER SECTION - FIRST PAGE ONLY =====
    let footerY = footerStartY + boxPadding;
    
    // Top row with 4 columns: Freight Amount, Freight Payable at, Number of Original MTD, Place and Date of issue
    const footerTopRowHeight = 10;
    const footerCol1X = innerMargin;
    const footerCol2X = isIndiaBranch
      ? innerMargin + mainBoxWidth * indiaThirdRowPct
      : footerCol1X + mainBoxWidth / 4;
    const footerCol3X = isIndiaBranch
      ? innerMargin + mainBoxWidth * indiaThirdRowPct * 2
      : footerCol2X + mainBoxWidth / 4;
    const footerCol4X = isIndiaBranch
      ? innerMargin + mainBoxWidth * indiaMainContentLeftPct
      : footerCol3X + mainBoxWidth / 4;
    
    // Draw vertical lines for footer top row
    doc.line(footerCol2X, footerStartY, footerCol2X, footerStartY + footerTopRowHeight);
    doc.line(footerCol3X, footerStartY, footerCol3X, footerStartY + footerTopRowHeight);
    doc.line(footerCol4X, footerStartY, footerCol4X, footerStartY + footerTopRowHeight);
    
    // Footer top row headers and values
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text("Freight Amount", footerCol1X + boxPadding, footerY);
    doc.text("Freight Payable at", footerCol2X + boxPadding, footerY);
    doc.text("Number of Original MTD (s)", footerCol3X + boxPadding, footerY);
    doc.text("Place and Date of issue", footerCol4X + boxPadding, footerY);
    
    footerY += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.text(freightAmount || "FREIGHT TO COLLECT", footerCol1X + boxPadding, footerY);
    doc.text(freightPayableAt || "DESTINATION", footerCol2X + boxPadding, footerY);
    doc.text(numberOfOriginalMTD || "3 / THREE", footerCol3X + boxPadding, footerY);
    doc.text(placeAndDateOfIssue || "", footerCol4X + boxPadding, footerY);
    
    // Draw bottom border of footer top row
    const footerTopRowEndY = footerStartY + footerTopRowHeight;
    doc.line(innerMargin, footerTopRowEndY, innerMargin + mainBoxWidth, footerTopRowEndY);
    
    // Bottom section: Left side "Other Particulars", Right side "For Company" and "AUTHORISED SIGNATORY"
    const footerBottomSectionY = footerTopRowEndY;
    const footerBottomLeftWidth = mainBoxWidth * 0.6; // 60% for left side
    const footerBottomRightWidth = mainBoxWidth * 0.4; // 40% for right side
    const footerBottomRightX = innerMargin + footerBottomLeftWidth;
    
    // Draw vertical line separating left and right sections
    doc.line(footerBottomRightX, footerBottomSectionY, footerBottomRightX, footerStartY + footerSectionHeight);
    
    // Left side: Other Particulars
    footerY = footerBottomSectionY + boxPadding;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text("Other Particulars (if any)", innerMargin + boxPadding, footerY);
    
    // Note text at bottom of left section
    const noteText = "Weight and measurement of container not to be included (TERMS CONTINUED ON BACK HEREOF)";
    const noteY = footerStartY + footerSectionHeight - 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.text(noteText, innerMargin + boxPadding, noteY);
    
    // Right side: Company name and Authorised Signatory
    const signatoryTextWidth = footerBottomRightWidth - 2 * boxPadding;
    let signatoryY = footerBottomSectionY + boxPadding;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    const companyText = `For ${branchInfo.name}`;
    const companyLines = doc.splitTextToSize(companyText, signatoryTextWidth);
    doc.text(companyLines, footerBottomRightX + boxPadding, signatoryY);
    signatoryY += companyLines.length * 3.5 + 4;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    const signatoryText = "AUTHORISED SIGNATORY";
    const signatoryLabelWidth = doc.getTextWidth(signatoryText);
    const signatoryCenterX =
      footerBottomRightX + footerBottomRightWidth / 2 - signatoryLabelWidth / 2;
    doc.text(signatoryText, signatoryCenterX, signatoryY);
    
    // Draw bottom border of footer section
    const footerBottomY = footerStartY + footerSectionHeight;
    doc.line(innerMargin, footerBottomY, innerMargin + mainBoxWidth, footerBottomY);
    
    // Draw left and right borders for footer section
    doc.line(innerMargin, footerStartY, innerMargin, footerBottomY);
    doc.line(innerMargin + mainBoxWidth, footerStartY, innerMargin + mainBoxWidth, footerBottomY);
    
    // ===== REMAINING CONTENT ON SUBSEQUENT PAGES (NO FOOTER) =====
    if (containerDetails && containerDetails.length > 0) {
      const remainingContainers = containerEntries.slice(containersDrawnOnFirstPage);
      const remainingCommodityLines = commodityLines.slice(commodityLinesDrawn);
      
      if (remainingContainers.length > 0 || remainingCommodityLines.length > 0) {
        // Create new page for remaining content (footer is only on first page)
        doc.addPage();
        let pageStartY = innerMargin + 5;
        let currentPageY = drawSubsequentPageHeaders(pageStartY);
        const pageBottomY = pageHeight - innerMargin - 5;
        
      // Set font to normal (same as first page) before drawing container data
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      
      // Track the box boundaries for each page to draw vertical lines correctly
      let currentPageBoxStartY = pageStartY;
      let currentPageBoxBottomY = pageHeight - innerMargin - 5;
      
      // Draw remaining containers
      for (let i = containersDrawnOnFirstPage; i < containerEntries.length; i++) {
        const entry = containerEntries[i];
        
        // Check if we need a new page
        if (currentPageY + entry.height > pageBottomY) {
          // Draw vertical lines to bottom of current page box before moving to next page
          doc.line(containerCol2X, currentPageBoxStartY, containerCol2X, currentPageBoxBottomY);
          doc.line(containerCol3X, currentPageBoxStartY, containerCol3X, currentPageBoxBottomY);
          doc.line(containerCol4X, currentPageBoxStartY, containerCol4X, currentPageBoxBottomY);
          doc.line(containerCol5X, currentPageBoxStartY, containerCol5X, currentPageBoxBottomY);
          
          doc.addPage();
          pageStartY = innerMargin + 5;
          currentPageY = drawSubsequentPageHeaders(pageStartY);
          currentPageBoxStartY = pageStartY;
          currentPageBoxBottomY = pageHeight - innerMargin - 5;
          
          // Reset font to normal after drawing headers
          doc.setFont("helvetica", "normal");
          doc.setFontSize(6);
        }
        
        // Draw container entry
        entry.lines.forEach((line: string) => {
          doc.text(line, containerCol1X + boxPadding, currentPageY);
          currentPageY += 3.5;
        });
        currentPageY += 2; // Spacing between entries
      }
      
      // Draw remaining commodity description
      if (remainingCommodityLines.length > 0) {
        // Check if we need a new page for commodity description
        const commodityHeight = remainingCommodityLines.length * 3.5;
        if (currentPageY + commodityHeight > pageBottomY) {
          // Draw vertical lines to bottom of current page box before moving to next page
          doc.line(containerCol2X, currentPageBoxStartY, containerCol2X, currentPageBoxBottomY);
          doc.line(containerCol3X, currentPageBoxStartY, containerCol3X, currentPageBoxBottomY);
          doc.line(containerCol4X, currentPageBoxStartY, containerCol4X, currentPageBoxBottomY);
          doc.line(containerCol5X, currentPageBoxStartY, containerCol5X, currentPageBoxBottomY);
          
          doc.addPage();
          pageStartY = innerMargin + 5;
          currentPageY = drawSubsequentPageHeaders(pageStartY);
          currentPageBoxStartY = pageStartY;
          currentPageBoxBottomY = pageHeight - innerMargin - 5;
          
          // Reset font to normal after drawing headers
          doc.setFont("helvetica", "normal");
          doc.setFontSize(6);
        }
        
        // Draw remaining commodity lines in Column 3
        remainingCommodityLines.forEach((line: string) => {
          doc.text(line, containerCol3X + boxPadding, currentPageY);
          currentPageY += 3.5;
        });
      }
      
      // Draw vertical lines to bottom of last page box (touching the box border)
      doc.line(containerCol2X, currentPageBoxStartY, containerCol2X, currentPageBoxBottomY);
      doc.line(containerCol3X, currentPageBoxStartY, containerCol3X, currentPageBoxBottomY);
      doc.line(containerCol4X, currentPageBoxStartY, containerCol4X, currentPageBoxBottomY);
      doc.line(containerCol5X, currentPageBoxStartY, containerCol5X, currentPageBoxBottomY);
      }
    }
    } // end 6-copy loop

    // Generate blob URL
    const pdfBlob = doc.output("blob");
    const blobUrl = URL.createObjectURL(pdfBlob);

    return blobUrl;
  } catch (error) {
    console.error("Error generating Bill Of Lading PDF:", error);
    throw error;
  }
};

export { isUsBranchForBillOfLading };

/** Blank US BOL template PDF download (Export Job — US branch). */
export const downloadUsBillOfLadingTemplate = (): void => {
  const blobUrl = generateUsBillOfLadingPDF({}, {}, null, {
    templateOnly: true,
  });
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = "Bill-of-Lading-Template-US.pdf";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(blobUrl);
};

