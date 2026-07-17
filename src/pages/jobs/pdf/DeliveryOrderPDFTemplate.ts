import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import pentagonFreightInd from "../../../assets/images/pentagon-freight-ind.png";
import pentagonPrimeAmericas from "../../../assets/images/PentagonPrimeUSA.png";
import pentagonPrimeChina from "../../../assets/images/PentagonPrimeChina.png";
import cargoConsolidators from "../../../assets/images/CCIPL.png";
import primeLogo from "../../../assets/images/prime.png";
import {
  getCctBranchInfoFromLogin,
  getCctLogo,
  isCctCompany,
} from "../../../utils/pdfCompanyBranding";

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
}

const getUserCountry = () => {
  try {
    const userStr = localStorage.getItem("user");
    if (!userStr) return null;
    const user = JSON.parse(userStr);
    return user?.country ?? null;
  } catch {
    return null;
  }
};

const KENYA_DO_BRANCH_INFO = {
  name: "PENTAGON PRIME KENYA CO LIMITED",
  address:
    "OFFICE NO. S9-08, MTC BUILDING (AMBALAL HOUSE), 9TH FLOOR, SOUTH TOWER, NKRUMAH ROAD, P.O.BOX 2050-80100,MOMBASA,KENYA.",
  tel: "",
  email: "",
  pan: "",
  gstn: "",
  isKenya: true,
} as const;

/** Inner box content typography (keys + values) */
const DO_INNER_FONT_SIZE = 9;
const DO_INNER_TEXT_LINE_HEIGHT = 5;
const DO_INNER_ROW_HEIGHT = 8;

const isKenyaCountry = (country: any): boolean => {
  let countryName = "";
  let countryCode = "";

  if (country) {
    countryName = (country.country_name || "").toUpperCase();
    countryCode = (country.country_code || "").toUpperCase();
  } else {
    const resolved = getUserCountry();
    if (resolved) {
      countryName = (resolved.country_name || "").toUpperCase();
      countryCode = (resolved.country_code || "").toUpperCase();
    }
  }

  return countryName.includes("KENYA") || countryCode === "KE";
};

// Helper function to draw header section
const drawHeaderSection = (
  doc: jsPDF,
  pageWidth: number,
  margin: number,
  boxPadding: number,
  branchInfo: any,
  logoImage: string | null
): number => {
  const yPos = 5;
  const headerStartY = yPos;
  const headerHeight = 25;
  const logoWidth = 50;
  const logoHeight = 20;
  const logoX = margin + 5;
  let companyInfoX = margin + 5;
  let companyY = headerStartY + boxPadding + 3;

  // Logo before company name (left side)
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
      companyInfoX = logoX + logoWidth + 5;
      companyY = logoY + 5;
    } catch (error) {
      console.warn("Could not load logo image, continuing without logo:", error);
    }
  }

  // Company name and address (to the right of logo)
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
    branchInfo.gstn ? `GSTN: ${branchInfo.gstn}` : ""
  ]
    .filter(Boolean)
    .join("    ");

  if (infoLine) {
    doc.text(infoLine, companyInfoX, companyY);
    companyY += 3.5;
  }

  return Math.max(headerStartY + headerHeight + 5, companyY + 3);
};

// Helper function to draw footer section
const drawFooterSection = (
  doc: jsPDF,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  boxPadding: number,
) => {
  const currentPage = doc.getCurrentPageInfo().pageNumber;
  const totalPages = doc.getNumberOfPages();
  const footerY = pageHeight - 10;
  
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");

  doc.text(
    `Page ${currentPage} of ${totalPages}`,
    pageWidth - margin - boxPadding,
    footerY,
    { align: "right" }
  );
};

// Helper function to get branch info
const getBranchInfo = (country?: any) => {
  if (isCctCompany()) {
    return { ...getCctBranchInfoFromLogin(), isKenya: false };
  }

  if (isKenyaCountry(country)) {
    return { ...KENYA_DO_BRANCH_INFO };
  }

  try {
    const userStr = localStorage.getItem("user");
    if (!userStr) {
      return {
        name: "",
        address: "",
        tel: "",
        email: "",
        pan: "",
        gstn: "",
        logo_url: "",
        isKenya: false,
      };
    }

    const user = JSON.parse(userStr);
    const branches = Array.isArray(user?.branches) ? user.branches : [];

    const defaultBranch = branches.find(
      (branch: any) => branch?.is_default === true
    );

    if (!defaultBranch) {
      return {
        name: "",
        address: "",
        tel: "",
        email: "",
        pan: "",
        gstn: "",
        logo_url: "",
        isKenya: false,
      };
    }

    return {
      name: defaultBranch?.reporting_name || "",
      address: defaultBranch?.reporting_address || "",
      tel: defaultBranch?.tel || "",
      email: defaultBranch?.email || "",
      pan: defaultBranch?.pan || "",
      gstn: defaultBranch?.gstn || "",
      logo_url: defaultBranch?.logo_url || "",
      isKenya: false,
    };
  } catch (error) {
    console.error("Error reading branch details from localStorage", error);
    return {
      name: "",
      address: "",
      tel: "",
      email: "",
      pan: "",
      gstn: "",
      isKenya: false,
    };
  }
};

// Helper function to create page layout
const createPageLayout = (
  doc: jsPDF,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  boxPadding: number,
  branchInfo: any,
  logoImage: string | null,
  leftColumnX: number,
  doNumber: string,
  todayDate: string,
  jobInfo: any,
  headingText: string = "DELIVERY ORDER"
): { yPos: number; boxStartY: number; boxX: number; boxWidth: number } => {
  // Draw header section
  const headerEndY = drawHeaderSection(doc, pageWidth, margin, boxPadding, branchInfo, logoImage);
  
  // Document Title
  let yPos = headerEndY;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(headingText, pageWidth / 2, yPos, { align: "center" });
  yPos += 5;

  // Draw page border
  const footerHeight = 15;
  const fixedBoxStartY = yPos; // After title
  const fixedBoxEndY = pageHeight - footerHeight; // Before footer
  const fixedBoxWidth = pageWidth - 2 * margin;
  const boxX = margin;
  
  doc.rect(boxX, fixedBoxStartY, fixedBoxWidth, fixedBoxEndY - fixedBoxStartY);

  // Draw footer section
  drawFooterSection(doc, pageWidth, pageHeight, margin, boxPadding);

  // Return structure matching createNewPage
  return {
    yPos: yPos + boxPadding, // Content start Y (inside border)
    boxStartY: fixedBoxStartY,
    boxX: boxX,
    boxWidth: fixedBoxWidth,
  };
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


export const generateDeliveryOrderPDF = (
  jobData: any,
  housingData: any,
): string => {
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const boxPadding = 5;
    const footerHeight = 15;
    const bottomBorderPadding = 5; // Padding inside border at bottom

    // Get branch info and country-specific logo (Kenya uses prime.png from assets)
    const country = getUserCountry();
    const branchInfo = getBranchInfo(country);
    const logoImage = getLogoByCountry(country);

    // Extract data from jobData (consol_details) and housingData (housing_details)
    // jobData contains: igm_no, igm_date, vessel_name, voyage_number, mbl_number, mbl_date, eta, etc.
    // housingData contains: do_no, hbl_number, consignee_name, marks_no, commodity_description, etc.
    
    const jobInfo = jobData || {};
    const carrierDetails = jobData?.carrierDetails || {};
    const mawbDetails = jobData?.mawbDetails || {};

    // Delivery Order Details - from housing_details
    const doNumber = housingData?.do_no || housingData?.do_number || housingData?.shipment_id || "";
    const todayDate = formatDateForDisplay(new Date().toISOString());

    // Parties - from housing_details
    const attentionTo = housingData?.attention_to || "";
    const pleaseDeliverTo = housingData?.please_deliver_to || housingData?.consignee_name || "";
    const consigneeName = housingData?.consignee_name || "";
    const notifyParty = housingData?.notify_customer1_name || housingData?.notify1_customer_name || "";
    const chaName = housingData?.cha_name || "";

    // Shipment Details - vessel and voyage from consol_details (jobData)
    // Check ocean_routings array first, then fallback to main level
    const oceanRouting = jobData?.ocean_routings?.[0];
    const vesselName = oceanRouting?.vessel || jobData?.vessel_name || carrierDetails?.vessel_name || "";
    const voyageNumber = oceanRouting?.voyage_number || jobData?.voyage_number || carrierDetails?.voyage_number || "";
    const vesselVoyage = vesselName && voyageNumber
      ? `${vesselName} / ${voyageNumber}`
      : vesselName || voyageNumber || "";

    // O.Bill of Lading - from consol_details (jobData)
    const obillNumber = jobData?.mbl_number || carrierDetails?.mbl_number || "";
    const obillDate = jobData?.mbl_date || carrierDetails?.mbl_date
      ? formatDateForDisplay(jobData.mbl_date || carrierDetails.mbl_date)
      : "";
    const obillInfo = obillNumber && obillDate
      ? `${obillNumber} / ${obillDate}`
      : obillNumber || obillDate || "";

    // H.Bill of Lading - house no with HBL date (same pattern as O.Bill)
    const hbillNumber = housingData?.hbl_number || "";
    const hbillDateRaw =
      housingData?.house_date ||
      housingData?.hbl_date ||
      housingData?.created_at ||
      "";
    const hbillDate = hbillDateRaw
      ? formatDateForDisplay(hbillDateRaw)
      : "";
    const hbillInfo = hbillNumber && hbillDate
      ? `${hbillNumber} / ${hbillDate}`
      : hbillNumber || hbillDate || "";

    // Load Port HBL - same "number / date" format as H.Bill of Lading
    const loadPortHBL = hbillInfo;
    
    // ETA - from consol_details (jobData)
    const eta = jobData?.eta || jobInfo?.eta || mawbDetails?.eta
      ? formatDateForDisplay(jobData.eta || jobInfo.eta || mawbDetails.eta)
      : "";
    
    const tsaNo = housingData?.tsa_no || "";
    
    // IGM NO./Date - from consol_details (jobData) / mawbDetails
    const igmNo =
      jobData?.igm_no || jobInfo?.igm_no || mawbDetails?.igm_no || "";
    const igmDateRaw =
      jobData?.igm_date || jobInfo?.igm_date || mawbDetails?.igm_date || "";
    const igmDate = igmDateRaw ? formatDateForDisplay(igmDateRaw) : "";
    const igmInfo = igmNo && igmDate
      ? `${igmNo} / ${igmDate}`
      : igmNo || igmDate || "";
    
    const itemLineNo =
      housingData?.item_line_no ||
      housingData?.item_no ||
      "";
    const subItemLineNo =
      housingData?.sub_item_line_no ||
      housingData?.sub_item_no ||
      "";

    // Container details (used for CFS / unloading date / LCL-FCL)
    const containerDetails =
      jobData?.containerDetails ||
      jobData?.container_details ||
      [];

    const findContainerForCargo = (cargo: any) => {
      const containerNo = String(
        cargo?.container_no || cargo?.container_number || "",
      ).trim();
      const containerId = String(cargo?.container_id ?? "").trim();
      if (!containerDetails?.length) return undefined;
      return containerDetails.find((c: any) => {
        const cNo = String(c?.container_no ?? "").trim();
        const cId = String(c?.id ?? "").trim();
        return (
          (containerNo && cNo === containerNo) ||
          (containerId && cId === containerId)
        );
      });
    };

    // Unstuff Place = CFS Name of the house's container(s)
    const cargoDetailsForCfs = housingData?.cargo_details || [];
    const matchedCfsContainer =
      (Array.isArray(cargoDetailsForCfs)
        ? cargoDetailsForCfs
            .map((cargo: any) => findContainerForCargo(cargo))
            .find((c: any) => String(c?.cfs_name || "").trim())
        : undefined) ||
      containerDetails.find((c: any) => String(c?.cfs_name || "").trim());
    const unstuffPlace =
      housingData?.unstuff_place ||
      matchedCfsContainer?.cfs_name ||
      "";

    // Service for LCL/FCL - from consol_details (jobData)
    const service = jobData?.service || mawbDetails?.service || jobInfo?.service || "";

    // Marks & Description
    const marksNo = housingData?.marks_no || "";
    const commodityDescription = housingData?.commodity_description || "";

    const headingText = housingData?.do_heading || "DELIVERY ORDER";

    // Set document properties
    doc.setProperties({
      title: `Delivery Order - ${doNumber || ""}`,
      subject: "Delivery Order",
      author: branchInfo.name,
    });

    // Set line width
    doc.setLineWidth(0.3);
    doc.setDrawColor(0, 0, 0);

    // Calculate column positions (needed for footer and content)
    const leftColumnX = margin + boxPadding;
    const rightColumnX = pageWidth - margin - boxPadding - 50;

    // Create page layout (header, title, border, footer) - returns layout info
    const pageLayout = createPageLayout(
      doc,
      pageWidth,
      pageHeight,
      margin,
      boxPadding,
      branchInfo,
      logoImage,
      leftColumnX,
      doNumber,
      todayDate,
      jobInfo,
      headingText
    );
    
    // Content starts inside the box
    let boxContentY = pageLayout.yPos;
    let boxStartY = pageLayout.boxStartY;
    let boxX = pageLayout.boxX;
    let boxWidth = pageLayout.boxWidth;

    // ===== TOP SECTION OF BOX: Attention to (left) and DO No/Date (right) =====
    // leftColumnX and rightColumnX already defined above

    // Attention to
    doc.setFontSize(DO_INNER_FONT_SIZE);
    doc.setFont("helvetica", "bold");
    doc.text("Attention to:", leftColumnX, boxContentY);
    doc.setFont("helvetica", "normal");
    const attentionToLines = doc.splitTextToSize(
      attentionTo || "",
      rightColumnX - leftColumnX - 5,
    );
    if (attentionToLines.length > 0) {
      doc.text(attentionToLines, leftColumnX + 20, boxContentY);
    }
    boxContentY += Math.max(attentionToLines.length * DO_INNER_TEXT_LINE_HEIGHT, 12);

    // DO No and Date (right side)
    doc.setFont("helvetica", "bold");
    doc.text("DO No:", rightColumnX, boxContentY - 10);
    doc.setFont("helvetica", "normal");
    doc.text(doNumber || "", rightColumnX + 20, boxContentY - 10);
    
    doc.setFont("helvetica", "bold");
    doc.text("Date:", rightColumnX, boxContentY - 5);
    doc.setFont("helvetica", "normal");
    doc.text(todayDate, rightColumnX + 20, boxContentY - 5);

    boxContentY += 5;

    // ===== KEY-VALUE PAIRS SECTION =====
    const labelWidth = 45;
    const valueStartX = leftColumnX + labelWidth;
    const lineHeight = DO_INNER_ROW_HEIGHT;
    let currentY = boxContentY;

    doc.setFontSize(DO_INNER_FONT_SIZE);
    doc.setFont("helvetica", "normal");

    // Please deliver to
    doc.setFont("helvetica", "bold");
    doc.text("Please deliver to:", leftColumnX, currentY);
    doc.setFont("helvetica", "normal");
    const deliverToLines = doc.splitTextToSize(
      pleaseDeliverTo || "",
      pageWidth - valueStartX - margin - boxPadding
    );
    doc.text(deliverToLines, valueStartX, currentY);
    currentY += Math.max(deliverToLines.length * DO_INNER_TEXT_LINE_HEIGHT, lineHeight);

    // Consignee
    doc.setFont("helvetica", "bold");
    doc.text("Consignee:", leftColumnX, currentY);
    doc.setFont("helvetica", "normal");
    const consigneeLines = doc.splitTextToSize(
      consigneeName || "",
      pageWidth - valueStartX - margin - boxPadding
    );
    doc.text(consigneeLines, valueStartX, currentY);
    currentY += Math.max(consigneeLines.length * DO_INNER_TEXT_LINE_HEIGHT, lineHeight);

    // Notify party
    doc.setFont("helvetica", "bold");
    doc.text("Notify party:", leftColumnX, currentY);
    doc.setFont("helvetica", "normal");
    const notifyLines = doc.splitTextToSize(
      notifyParty || "",
      pageWidth - valueStartX - margin - boxPadding
    );
    doc.text(notifyLines, valueStartX, currentY);
    currentY += Math.max(notifyLines.length * DO_INNER_TEXT_LINE_HEIGHT, lineHeight);

    // CHA
    doc.setFont("helvetica", "bold");
    doc.text("CHA:", leftColumnX, currentY);
    doc.setFont("helvetica", "normal");
    const chaLines = doc.splitTextToSize(
      chaName || "",
      pageWidth - valueStartX - margin - boxPadding
    );
    doc.text(chaLines, valueStartX, currentY);
    currentY += Math.max(chaLines.length * DO_INNER_TEXT_LINE_HEIGHT, lineHeight);

    // Vessel/Voyage
    doc.setFont("helvetica", "bold");
    doc.text("Vessel/Voyage:", leftColumnX, currentY);
    doc.setFont("helvetica", "normal");
    const vesselLines = doc.splitTextToSize(
      vesselVoyage || "",
      pageWidth - valueStartX - margin - boxPadding
    );
    doc.text(vesselLines, valueStartX, currentY);
    currentY += Math.max(vesselLines.length * DO_INNER_TEXT_LINE_HEIGHT, lineHeight);

    // O.Bill of Lading
    doc.setFont("helvetica", "bold");
    doc.text("O.Bill of Lading:", leftColumnX, currentY);
    doc.setFont("helvetica", "normal");
    const obillLines = doc.splitTextToSize(
      obillInfo || "",
      pageWidth - valueStartX - margin - boxPadding
    );
    doc.text(obillLines, valueStartX, currentY);
    currentY += Math.max(obillLines.length * DO_INNER_TEXT_LINE_HEIGHT, lineHeight);

    // H.Bill of Lading
    doc.setFont("helvetica", "bold");
    doc.text("H.Bill of Lading:", leftColumnX, currentY);
    doc.setFont("helvetica", "normal");
    const hbillLines = doc.splitTextToSize(
      hbillInfo || "",
      pageWidth - valueStartX - margin - boxPadding
    );
    doc.text(hbillLines, valueStartX, currentY);
    currentY += Math.max(hbillLines.length * DO_INNER_TEXT_LINE_HEIGHT, lineHeight);

    // Load Port HBL
    doc.setFont("helvetica", "bold");
    doc.text("Load Port HBL:", leftColumnX, currentY);
    doc.setFont("helvetica", "normal");
    doc.text(loadPortHBL || "", valueStartX, currentY);
    currentY += lineHeight;

    // ETA
    doc.setFont("helvetica", "bold");
    doc.text("ETA:", leftColumnX, currentY);
    doc.setFont("helvetica", "normal");
    doc.text(eta || "", valueStartX, currentY);
    currentY += lineHeight;

    // IGM NO./Date
    doc.setFont("helvetica", "bold");
    doc.text("IGM NO./Date:", leftColumnX, currentY);
    doc.setFont("helvetica", "normal");
    const igmLines = doc.splitTextToSize(
      igmInfo || "",
      pageWidth - valueStartX - margin - boxPadding
    );
    doc.text(igmLines, valueStartX, currentY);
    currentY += Math.max(igmLines.length * DO_INNER_TEXT_LINE_HEIGHT, lineHeight);

    // Unstuff Place
    doc.setFont("helvetica", "bold");
    doc.text("Unstuff Place:", leftColumnX, currentY);
    doc.setFont("helvetica", "normal");
    const unstuffPlaceLines = doc.splitTextToSize(
      unstuffPlace || "",
      pageWidth - valueStartX - margin - boxPadding
    );
    doc.text(unstuffPlaceLines, valueStartX, currentY);
    currentY += Math.max(unstuffPlaceLines.length * DO_INNER_TEXT_LINE_HEIGHT, lineHeight);

    // Item / Line No.
    doc.setFont("helvetica", "bold");
    doc.text("Item / Line No.:", leftColumnX, currentY);
    doc.setFont("helvetica", "normal");
    doc.text(itemLineNo || "", valueStartX, currentY);
    currentY += lineHeight;

    // TSA No.
    doc.setFont("helvetica", "bold");
    doc.text("TSA No.:", leftColumnX, currentY);
    doc.setFont("helvetica", "normal");
    doc.text(tsaNo || "", valueStartX, currentY);
    currentY += lineHeight;

    // Sub Item / Line No.
    doc.setFont("helvetica", "bold");
    doc.text("Sub Item / Line No.:", leftColumnX, currentY);
    doc.setFont("helvetica", "normal");
    doc.text(subItemLineNo || "", valueStartX, currentY);
    currentY += lineHeight;

    // ===== CONTAINER INFORMATION TABLE =====
    const cargoDetails = housingData?.cargo_details || [];
    
    // Check if we need a new page before the table
    const estimatedTableHeight = cargoDetails.length > 0 ? Math.min(cargoDetails.length * DO_INNER_ROW_HEIGHT + 15, 100) : 0;
    const fixedBoxEndY = pageHeight - footerHeight; // Before footer
    if (cargoDetails.length > 0 && needsNewPage(currentY, estimatedTableHeight, fixedBoxEndY, bottomBorderPadding)) {
      // Create new page with layout
      doc.addPage();
      const newPageInfo = createPageLayout(doc, pageWidth, pageHeight, margin, boxPadding, branchInfo, logoImage, leftColumnX, doNumber, todayDate, jobInfo, headingText);
      currentY = newPageInfo.yPos;
      boxStartY = newPageInfo.boxStartY;
      boxX = newPageInfo.boxX;
      boxWidth = newPageInfo.boxWidth;
    }
    
    if (cargoDetails.length > 0) {
      const tableBody = cargoDetails.map((cargo: any) => {
        const containerNo = cargo.container_no || cargo.container_number || "";
        const matched = findContainerForCargo(cargo);

        // LCL / FCL logic
        let lclFcl = service || "";
        if (!lclFcl && matched) {
          const type =
            matched?.container_type_details?.container_type_name ||
            matched?.container_type ||
            "";
          lclFcl =
            String(type).includes("20") || String(type).includes("40")
              ? "FCL"
              : "LCL";
        }

        const unloadingDateRaw =
          matched?.unloading_date ||
          matched?.uploading_date ||
          cargo?.unloading_date ||
          cargo?.uploading_date ||
          "";
        const unstuffDt = unloadingDateRaw
          ? formatDateForDisplay(unloadingDateRaw)
          : "";

        return [
          containerNo,
          lclFcl,
          unstuffDt,
          cargo.no_of_packages ?? "",
          cargo.gross_weight ?? "",
          cargo.volume ?? "",
        ];
      });

      // Store the starting page number
      const tableStartPage = doc.getCurrentPageInfo().pageNumber;
      
      // Calculate where content should start on continuation pages (matches createPageLayout return value)
      // header (10) + headerHeight (25) + spacing (5) + title (8) + boxPadding (5) = 53
      const continuationContentStartY = 10 + 25 + 5 + 8;
      
      autoTable(doc, {
        startY: currentY, // First page uses currentY (after "Attention to" section)
      
        head: [[
          "Container No.",
          "LCL/FCL",
          "Unstuff Dt",
          "No of Pkg",
          "Weight in Kgs",
          "Volume",
        ]],
      
        body: tableBody,
      
        theme: "grid",
      
        styles: {
          fontSize: DO_INNER_FONT_SIZE,
          cellPadding: 2,
          fillColor: [255, 255, 255],
          textColor: 0,
          lineWidth:0.3,
          lineColor: [0,0,0],
        },
      
        headStyles: {
          fontStyle: "bold",
          lineWidth:0.3,
          lineColor: [0,0,0],
        },
    
      
        columnStyles: {
          0: { cellWidth: 45 },
          1: { cellWidth: 25 },
          2: { cellWidth: 35 },
          3: { cellWidth: 25 },
          4: { cellWidth: 25 },
          5: { cellWidth: 25 },
        },
      
        margin: { 
          top: continuationContentStartY, // Space for headers on continuation pages
          left: leftColumnX, 
          right: margin+5,
          bottom: footerHeight + bottomBorderPadding // Space for footer + bottom border padding
        },
        
        // Use didDrawPage to add page layout (header, border, footer) to continuation pages
        didDrawPage: (_data: any) => {
          const pageNum = doc.getCurrentPageInfo().pageNumber;
          // If this is a continuation page, draw the page layout
          if (pageNum > tableStartPage) {
            createPageLayout(
              doc,
              pageWidth,
              pageHeight,
              margin,
              boxPadding,
              branchInfo,
              logoImage,
              leftColumnX,
              doNumber,
              todayDate,
              jobInfo,
              headingText
            );
          }
        },
      });
      
      // After table is drawn, get final position
      const finalTableY = (doc as any).lastAutoTable.finalY + 5;
      const tableEndPage = doc.getCurrentPageInfo().pageNumber;
      
      // Set back to the last page
      doc.setPage(tableEndPage);
      
      currentY = finalTableY;
    }

    // ===== MARKS & DESCRIPTION SECTION =====
    currentY += 5; // Gap after table

    // Check if we need a new page before Marks & Description
    const marksDescHeight = 20; // Estimated height
    if (needsNewPage(currentY, marksDescHeight, fixedBoxEndY, bottomBorderPadding)) {
      // Create new page with layout
      doc.addPage();
      const newPageInfo = createPageLayout(doc, pageWidth, pageHeight, margin, boxPadding, branchInfo, logoImage, leftColumnX, doNumber, todayDate, jobInfo, headingText);
      currentY = newPageInfo.yPos;
      boxStartY = newPageInfo.boxStartY;
      boxX = newPageInfo.boxX;
      boxWidth = newPageInfo.boxWidth;
    }

    doc.setFontSize(DO_INNER_FONT_SIZE);
    doc.setFont("helvetica", "bold");
    doc.text("Marks & Nos:", leftColumnX, currentY);
    doc.setFont("helvetica", "normal");
    const marksLines = doc.splitTextToSize(
      marksNo || "",
      pageWidth - leftColumnX - margin - boxPadding
    );
    
    // Check if marks will fit on current page
    const marksHeight = marksLines.length * DO_INNER_TEXT_LINE_HEIGHT;
    if (needsNewPage(currentY, marksHeight + lineHeight, fixedBoxEndY, bottomBorderPadding)) {
      // Create new page with layout
      doc.addPage();
      const newPageInfo = createPageLayout(doc, pageWidth, pageHeight, margin, boxPadding, branchInfo, logoImage, leftColumnX, doNumber, todayDate, jobInfo, headingText);
      currentY = newPageInfo.yPos;
      boxStartY = newPageInfo.boxStartY;
      boxX = newPageInfo.boxX;
      boxWidth = newPageInfo.boxWidth;
      
      // Redraw label on new page
      doc.setFont("helvetica", "bold");
      doc.text("Marks & Nos:", leftColumnX, currentY);
      doc.setFont("helvetica", "normal");
    }
    
    doc.text(marksLines, valueStartX - 20, currentY);
    currentY += Math.max(marksLines.length * DO_INNER_TEXT_LINE_HEIGHT, lineHeight);

    // Check if we need a new page before Description
    const descLines = doc.splitTextToSize(
      commodityDescription || "",
      pageWidth - leftColumnX - margin - boxPadding
    );
    const descHeight = descLines.length * DO_INNER_TEXT_LINE_HEIGHT;
    
    if (needsNewPage(currentY, descHeight + lineHeight, fixedBoxEndY, bottomBorderPadding)) {
      // Create new page with layout
      doc.addPage();
      const newPageInfo = createPageLayout(doc, pageWidth, pageHeight, margin, boxPadding, branchInfo, logoImage, leftColumnX, doNumber, todayDate, jobInfo, headingText);
      currentY = newPageInfo.yPos;
      boxStartY = newPageInfo.boxStartY;
      boxX = newPageInfo.boxX;
      boxWidth = newPageInfo.boxWidth;
    }
    
    doc.setFont("helvetica", "bold");
    doc.text("Description:", leftColumnX, currentY);
    doc.setFont("helvetica", "normal");
    
    // Handle description text that might span multiple pages
    descLines.forEach((line: string) => {
      if (needsNewPage(currentY, DO_INNER_TEXT_LINE_HEIGHT, fixedBoxEndY, bottomBorderPadding)) {
        // Create new page with layout
        doc.addPage();
        const newPageInfo = createPageLayout(doc, pageWidth, pageHeight, margin, boxPadding, branchInfo, logoImage, leftColumnX, doNumber, todayDate, jobInfo, headingText);
        currentY = newPageInfo.yPos;
        boxStartY = newPageInfo.boxStartY;
        boxX = newPageInfo.boxX;
        boxWidth = newPageInfo.boxWidth;
      }
      doc.text(line, valueStartX - 20, currentY);
      currentY += DO_INNER_TEXT_LINE_HEIGHT;
    });
    
    if (descLines.length === 0) {
      currentY += lineHeight;
    }

    // ===== NOTES SECTION =====
    currentY += 4; // Gap before notes

    // Check if we need a new page before notes
    const estimatedNotesHeight = 30;
    if (needsNewPage(currentY, estimatedNotesHeight, fixedBoxEndY, bottomBorderPadding)) {
      // Create new page with layout
      doc.addPage();
      const newPageInfo = createPageLayout(doc, pageWidth, pageHeight, margin, boxPadding, branchInfo, logoImage, leftColumnX, doNumber, todayDate, jobInfo, headingText);
      currentY = newPageInfo.yPos;
      boxStartY = newPageInfo.boxStartY;
      boxX = newPageInfo.boxX;
      boxWidth = newPageInfo.boxWidth;
    }

    doc.setFontSize(DO_INNER_FONT_SIZE);
    doc.setFont("helvetica", "normal");

    const deliverToName = (pleaseDeliverTo || "").trim();
    const notes = branchInfo.isKenya
      ? [
          "Dear Sir,",
          `With reference to the above shipment, we request you to issue the Delivery Order to "${deliverToName}" against collection of your necessary charges.`,
          "The Original Master B/L is already surrendered at the Port of Loading. Enclosed please find the copy of HBL duly endorsed by us for your reference.",
          `For ${branchInfo.name || ""}`,
        ]
      : [
          "Dear Sir,",
          "Please note this Delivery Order is valid for 30 days from the vessel arrival date. Thereafter reissue due to loss of original DO or exceeding the validity of aforesaid 30 days will incur additional charges of INR 1000 for every additional 10 days.",
          `For ${branchInfo.name || ""}`,
        ];
    notes.forEach((note) => {
      if (note) {
        const noteLines = doc.splitTextToSize(
          note,
          pageWidth - leftColumnX - margin - boxPadding
        );
        noteLines.forEach((line: string) => {
          // Check if we need a new page for each line
          if (needsNewPage(currentY, DO_INNER_TEXT_LINE_HEIGHT, fixedBoxEndY, bottomBorderPadding)) {
            // Create new page with layout
            doc.addPage();
            const newPageInfo = createPageLayout(doc, pageWidth, pageHeight, margin, boxPadding, branchInfo, logoImage, leftColumnX, doNumber, todayDate, jobInfo, headingText);
            currentY = newPageInfo.yPos;
            boxStartY = newPageInfo.boxStartY;
            boxX = newPageInfo.boxX;
            boxWidth = newPageInfo.boxWidth;
          }
          doc.text(line, leftColumnX, currentY);
          currentY += DO_INNER_TEXT_LINE_HEIGHT;
        });
        currentY += 2;
      }
    });
    const disclaimerY = currentY + 5;
    doc.setFontSize(DO_INNER_FONT_SIZE);
    doc.setFont("helvetica", "bold");
    doc.text(
      "THIS IS A COMPUTER GENERATED DOCUMENT AND DOES NOT REQUIRE A SIGNATURE",
      pageWidth / 2,
      disclaimerY,
      { align: "center" }
    );
    doc.setFont("helvetica", "normal");
    doc.text(
      "This Delivery order is subjected to the terms and conditions of the relative B/L",
      pageWidth / 2,
      disclaimerY + DO_INNER_TEXT_LINE_HEIGHT + 2,
      { align: "center" }
    );

    // Generate blob URL
    const pdfBlob = doc.output("blob");
    const blobUrl = URL.createObjectURL(pdfBlob);

    return blobUrl;
  } catch (error) {
    console.error("Error generating Delivery Order PDF:", error);
    throw error;
  }
};
