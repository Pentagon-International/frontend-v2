import { jsPDF } from "jspdf";
import pentagonFreightInd from "../../../assets/images/pentagon-freight-ind.png";
import pentagonPrimeAmericas from "../../../assets/images/PentagonPrimeUSA.png";
import pentagonPrimeChina from "../../../assets/images/PentagonPrimeChina.png";
import cargoConsolidators from "../../../assets/images/CCIPL.png";
import primeLogo from "../../../assets/images/prime.png";

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
    return primeLogo;
  } catch (error) {
    console.error("Error getting logo by country:", error);
    return primeLogo;
  }
};

// Helper function to get branch info
const getBranchInfo = (branchName: string, country?: any) => {
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

// Helper function to add header to an existing page (for continuation pages)
const addHeaderToExistingPage = (
  doc: jsPDF,
  pageWidth: number,
  margin: number,
  boxPadding: number,
  branchInfo: any,
  logoImage: string | null
): number => {
  let yPos = 5;
  const headerStartY = yPos;
  const headerHeight = 25;
  let logoEndX = 0;

  // Logo (left side)
  if (logoImage) {
    try {
      const logoWidth = 50;
      const logoHeight = 12;
      const logoX = margin + 5;
      const logoY = headerStartY + (headerHeight - logoHeight) / 2;
      doc.addImage(logoImage, "PNG", logoX, logoY, logoWidth, logoHeight, undefined, "FAST");
      logoEndX = logoWidth + logoX;
    } catch (error) {
      console.warn("Could not load logo from URL, continuing without logo:", error);
    }
  }

  // Company Name and Address (right side)
  const companyInfoX = logoEndX + 5;
  let companyY = headerStartY + boxPadding + 3;

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  const companyNameLines = doc.splitTextToSize(
    branchInfo.name || "",
    (pageWidth - 2 * margin) / 2
  );
  doc.text(companyNameLines, companyInfoX, companyY, { align: "left" });
  companyY += companyNameLines.length * 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  const companyAddressLines = doc.splitTextToSize(
    branchInfo.address || "",
    (pageWidth - 2 * margin) / 2 - 15
  );
  doc.text(companyAddressLines, companyInfoX, companyY, { align: "left" });
  companyY += companyAddressLines.length * 3.5;

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

  yPos = headerStartY + headerHeight + 5;

  // Document Title
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(
    "CARGO ARRIVAL NOTICE / PROFORMA INVOICE",
    pageWidth / 2,
    yPos,
    { align: "center" }
  );
  yPos += 8;

  // ===== FIXED PAGE BORDER BOX (Same on all pages) =====
  const pageHeight = doc.internal.pageSize.getHeight();
  const footerHeight = 15;
  const fixedBoxStartY = yPos; // After title
  const fixedBoxEndY = pageHeight - footerHeight; // Before footer
  const fixedBoxWidth = pageWidth - 2 * margin;

  // Draw the fixed border box
  drawPageBorder(doc, margin, fixedBoxStartY, fixedBoxEndY, fixedBoxWidth);

  // Return the Y position after title inside the border (where content should start)
  return yPos + boxPadding;
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

  let yPos = 5;
  const boxX = margin;

  // Header section (same as first page)
  const headerStartY = yPos;
  const headerHeight = 25;
  let logoEndX = 0;

  // Logo (left side)
  if (logoImage) {
    try {
      const logoWidth = 50;
      const logoHeight = 12;
      const logoX = margin + 5;
      const logoY = headerStartY + (headerHeight - logoHeight) / 2;
      doc.addImage(logoImage, "PNG", logoX, logoY, logoWidth, logoHeight, undefined, "FAST");
      logoEndX = logoWidth + logoX;
    } catch (error) {
      console.error("Error adding logo:", error);
    }
  }

  // Company Name and Address (right side)
  const companyInfoX = logoEndX + 5;
  let companyY = headerStartY + boxPadding + 3;

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  const companyNameLines = doc.splitTextToSize(
    branchInfo.name || "",
    (pageWidth - 2 * margin) / 2
  );
  doc.text(companyNameLines, companyInfoX, companyY, { align: "left" });
  companyY += companyNameLines.length * 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  const companyAddressLines = doc.splitTextToSize(
    branchInfo.address || "",
    (pageWidth - 2 * margin) / 2 - 15
  );
  doc.text(companyAddressLines, companyInfoX, companyY, { align: "left" });
  companyY += companyAddressLines.length * 3.5;

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

  yPos = headerStartY + headerHeight + 5;

  // Document Title
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(
    "CARGO ARRIVAL NOTICE / PROFORMA INVOICE",
    pageWidth / 2,
    yPos,
    { align: "center" }
  );
  yPos += 8;

  // ===== FIXED PAGE BORDER BOX (Same on all pages) =====
  const pageHeight = doc.internal.pageSize.getHeight();
  const footerHeight = 15;
  const fixedBoxStartY = yPos; // After title
  const fixedBoxEndY = pageHeight - footerHeight; // Before footer
  const fixedBoxWidth = pageWidth - 2 * margin;
  const boxXPos = margin;

  // Draw the fixed border box
  drawPageBorder(doc, boxXPos, fixedBoxStartY, fixedBoxEndY, fixedBoxWidth);

  // Content starts after title inside the border
  const boxContentY = yPos + boxPadding;

  return {
    yPos: boxContentY,
    boxStartY: fixedBoxStartY,
    boxX: boxXPos,
    boxWidth: fixedBoxWidth,
  };
};

export const generateCargoArrivalNoticePDF = (
  jobData: any,
  hawbData: any,
  defaultBranch: any,
  country?: any
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

    // ===== HEADER SECTION =====
    const headerStartY = yPos;
    const headerHeight = 25;
    let logoEndX = 0;

    // Logo (left side)
    if (logoImage) {
      try {
        const logoWidth = 50;
        const logoHeight = 12;
        const logoX = margin + 5;
        const logoY = headerStartY + (headerHeight - logoHeight) / 2;
        doc.addImage(logoImage, "PNG", logoX, logoY, logoWidth, logoHeight, undefined, "FAST");
        logoEndX = logoWidth + logoX;
      } catch (error) {
        console.warn("Could not load logo from URL, continuing without logo:", error);
      }
    }

    // Company Name and Address (right side)
    const companyInfoX = logoEndX + 5;
    let companyY = headerStartY + boxPadding + 3;

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    const companyNameLines = doc.splitTextToSize(
      branchInfo.name || "",
      (pageWidth - 2 * margin) / 2
    );
    doc.text(companyNameLines, companyInfoX, companyY, { align: "left" });
    companyY += companyNameLines.length * 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    const companyAddressLines = doc.splitTextToSize(
      branchInfo.address || "",
      (pageWidth - 2 * margin) / 2 - 15
    );
    doc.text(companyAddressLines, companyInfoX, companyY, { align: "left" });
    companyY += companyAddressLines.length * 3.5;

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

    yPos = headerStartY + headerHeight + 5;

    // ===== DOCUMENT TITLE SECTION =====
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(
      "CARGO ARRIVAL NOTICE / PROFORMA INVOICE",
      pageWidth / 2,
      yPos,
      { align: "center" }
    );
    yPos += 8;

    // ===== FIXED PAGE BORDER BOX (Same on all pages) =====
    // Calculate fixed box dimensions - same on every page
    const fixedBoxStartY = yPos; // After title
    const fixedBoxEndY = pageHeight - footerHeight; // Before footer
    let boxX = margin;
    let boxWidth = pageWidth - 2 * margin;
    
    // Draw the fixed border box on first page
    drawPageBorder(doc, boxX, fixedBoxStartY, fixedBoxEndY, boxWidth);
    
    // Content starts inside the box
    let boxStartY = fixedBoxStartY;
    yPos = fixedBoxStartY;

    // ===== COMBINED TWO COLUMN LAYOUT (Like Quotation PDF) =====
    const midLine = pageWidth / 2;
    const leftHalfWidth = midLine - margin - 2;
    const rightHalfWidth = pageWidth / 2 - margin - 2;
    const rightHalfStart = midLine + 2;
    const sectionStartY = yPos; // Start inside the fixed border

    // Calculate heights for left column sections
    doc.setFontSize(7);
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
    
    // Increased line spacing for better readability
    const lineSpacing = 4.5;
    
    let leftColumnHeight = 4; // Top padding
    // Consignee section (first)
    if (hasConsignee) {
      leftColumnHeight += 4; // Title
      if (consigneeName) leftColumnHeight += Math.max(1, consigneeNameLines.length) * lineSpacing;
      if (consigneeEmail) leftColumnHeight += Math.max(1, consigneeEmailLines.length) * lineSpacing;
      if (consigneeAddress) leftColumnHeight += Math.max(1, consigneeAddressLines.length) * lineSpacing;
      leftColumnHeight += 2; // Section spacing
    }
    // Notify Party section (second)
    if (hasNotify) {
      leftColumnHeight += 4; // Title
      if (notifyName) leftColumnHeight += Math.max(1, notifyNameLines.length) * lineSpacing;
      if (notifyEmail) leftColumnHeight += Math.max(1, notifyEmailLines.length) * lineSpacing;
      if (notifyAddress) leftColumnHeight += Math.max(1, notifyAddressLines.length) * lineSpacing;
      leftColumnHeight += 2; // Section spacing
    }
    // Shipper section
    leftColumnHeight += 4; // Title
    if (shipperName) leftColumnHeight += Math.max(1, shipperNameLines.length) * lineSpacing;
    if (shipperAddress) leftColumnHeight += Math.max(1, shipperAddressLines.length) * lineSpacing;
    leftColumnHeight += 2; // Bottom padding

    // Calculate heights for right column sections
    const jobRefNoLines = doc.splitTextToSize(jobRefNo || "", rightHalfWidth - 2 * boxPadding - 30);
    const invoiceRefLines = doc.splitTextToSize(invoiceRef || "", rightHalfWidth - 2 * boxPadding - 30);
    const dateLines = doc.splitTextToSize(formatDateForDisplay(createdAt) || "", rightHalfWidth - 2 * boxPadding - 15);
    const fromLines = doc.splitTextToSize(createdBy || "", rightHalfWidth - 2 * boxPadding - 15);
    const igmInfoLines = doc.splitTextToSize(igmInfo || "", rightHalfWidth - 2 * boxPadding - 20);
    
    const hawbInfo = hawbNumber && hawbCreatedAt ? `${hawbNumber}/${hawbCreatedAt}` : (hawbNumber || hawbCreatedAt || "");
    const mawbInfo = mawbNumber && mawbCreatedAt ? `${mawbNumber}/${mawbCreatedAt}` : (mawbNumber || mawbCreatedAt || "");
    const hawbInfoLines = doc.splitTextToSize(hawbInfo, rightHalfWidth - 2 * boxPadding - 25);
    const mawbInfoLines = doc.splitTextToSize(mawbInfo, rightHalfWidth - 2 * boxPadding - 25);
    const bookingNoLines = doc.splitTextToSize(bookingNo || "", rightHalfWidth - 2 * boxPadding - 25);
    const carrierNameLines = doc.splitTextToSize(carrierName || "", rightHalfWidth - 2 * boxPadding - 20);
    const originNameLines = doc.splitTextToSize(originName || "", rightHalfWidth - 2 * boxPadding - 15);
    const destinationNameLines = doc.splitTextToSize(destinationName || "", rightHalfWidth - 2 * boxPadding - 25);
    const etaLines = doc.splitTextToSize(eta || "", rightHalfWidth - 2 * boxPadding - 25);
    const cargoLocationLines = doc.splitTextToSize(cargoLocation || "", rightHalfWidth - 2 * boxPadding - 30);
    
    let rightColumnHeight = 4; // Top padding
    // Invoice/Job Details section
    rightColumnHeight += 4; // Title
    rightColumnHeight += Math.max(1, jobRefNoLines.length) * lineSpacing;
    rightColumnHeight += Math.max(1, dateLines.length) * lineSpacing;
    rightColumnHeight += Math.max(1, invoiceRefLines.length) * lineSpacing;
    rightColumnHeight += Math.max(1, fromLines.length) * lineSpacing;
    rightColumnHeight += Math.max(1, igmInfoLines.length) * lineSpacing;
    rightColumnHeight += 2; // Section spacing
    // Shipment Details section
    rightColumnHeight += 4; // Title
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
    const chargesTableRowsHeight = charges.length > 0 ? charges.length * chargesRowSpacing : chargesRowSpacing;
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
      doc.setFontSize(8);
      doc.text("To:", margin + boxPadding, leftYPos);
      leftYPos += 4;
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
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
      doc.setFontSize(8);
      doc.text("Notify:", margin + boxPadding, leftYPos);
      leftYPos += 4;
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
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
    doc.setFontSize(8);
    doc.text("Shipper:", margin + boxPadding, leftYPos);
    leftYPos += 4;
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
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
    doc.setFontSize(8);
    // doc.text("Invoice/Job Details:", rightHalfStart + boxPadding, rightYPos);
    rightYPos += 4;
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    
    // Fixed key column width for alignment
    const keyColumnWidth = 35;
    const valueStartX = rightHalfStart + boxPadding + keyColumnWidth;
    
    // Job Ref No: MAWB number-(hyphen) HAWB number
    doc.text("Job Ref No:", rightHalfStart + boxPadding, rightYPos);
    doc.text(jobRefNoLines, valueStartX, rightYPos);
    rightYPos += Math.max(1, jobRefNoLines.length) * 4.5;

    // Date: created_at
    doc.text("Date:", rightHalfStart + boxPadding, rightYPos);
    doc.text(dateLines, valueStartX, rightYPos);
    rightYPos += Math.max(1, dateLines.length) * 4.5;

    // Invoice Ref: MAWB + HAWB (concatenation)
    doc.text("Invoice Ref:", rightHalfStart + boxPadding, rightYPos);
    doc.text(invoiceRefLines, valueStartX, rightYPos);
    rightYPos += Math.max(1, invoiceRefLines.length) * 4.5;

    // From: created_by
    doc.text("From:", rightHalfStart + boxPadding, rightYPos);
    doc.text(fromLines, valueStartX, rightYPos);
    rightYPos += Math.max(1, fromLines.length) * 4.5;

    // IGM No: IGM No / IGM Date
    doc.text("IGM No:", rightHalfStart + boxPadding, rightYPos);
    doc.text(igmInfoLines, valueStartX, rightYPos);
    rightYPos += Math.max(1, igmInfoLines.length) * 4.5;
    
    // Draw horizontal line after Invoice/Job Details
    rightYPos += 1;
    doc.line(midLine, rightYPos, pageWidth - margin, rightYPos);
    rightYPos += 5;
    
    // Shipment Details section
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("Shipment Details:", rightHalfStart + boxPadding, rightYPos);
    rightYPos += 4;
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);

    // Fixed key column width for alignment (same as Invoice/Job Details)
    const shipmentKeyColumnWidth = 35;
    const shipmentValueStartX = rightHalfStart + boxPadding + shipmentKeyColumnWidth;

    // HAWB/HBL: HAWB/HBL No/created at (date)
    const houseBillLabel = isOceanImport ? "HBL:" : "HAWB:";
    doc.text(houseBillLabel, rightHalfStart + boxPadding, rightYPos);
    doc.text(hawbInfoLines, shipmentValueStartX, rightYPos);
    rightYPos += Math.max(1, hawbInfoLines.length) * 4.5;

    // MAWB/MBL: MAWB/MBL No/ created at (date)
    const masterBillLabel = isOceanImport ? "MBL:" : "MAWB:";
    doc.text(masterBillLabel, rightHalfStart + boxPadding, rightYPos);
    doc.text(mawbInfoLines, shipmentValueStartX, rightYPos);
    rightYPos += Math.max(1, mawbInfoLines.length) * 4.5;

    // Booking No:
    doc.text("Booking No:", rightHalfStart + boxPadding, rightYPos);
    doc.text(bookingNoLines, shipmentValueStartX, rightYPos);
    rightYPos += Math.max(1, bookingNoLines.length) * 4.5;

    // Carrier: carrier_name
    doc.text("Carrier:", rightHalfStart + boxPadding, rightYPos);
    doc.text(carrierNameLines, shipmentValueStartX, rightYPos);
    rightYPos += Math.max(1, carrierNameLines.length) * 4.5;

    // POL: origin_name
    doc.text("POL:", rightHalfStart + boxPadding, rightYPos);
    doc.text(originNameLines, shipmentValueStartX, rightYPos);
    rightYPos += Math.max(1, originNameLines.length) * 4.5;

    // POD: destination_name
    doc.text("POD:", rightHalfStart + boxPadding, rightYPos);
    doc.text(destinationNameLines, shipmentValueStartX, rightYPos);
    rightYPos += Math.max(1, destinationNameLines.length) * 4.5;

    // Final Dest: destination_name
    doc.text("Final Dest:", rightHalfStart + boxPadding, rightYPos);
    doc.text(destinationNameLines, shipmentValueStartX, rightYPos);
    rightYPos += Math.max(1, destinationNameLines.length) * 4.5;

    // Arrival date: eta
    doc.text("Arrival date:", rightHalfStart + boxPadding, rightYPos);
    doc.text(etaLines, shipmentValueStartX, rightYPos);
    rightYPos += Math.max(1, etaLines.length) * 4.5;

    // FDC ETA: eta
    doc.text("FDC ETA:", rightHalfStart + boxPadding, rightYPos);
    doc.text(etaLines, shipmentValueStartX, rightYPos);
    rightYPos += Math.max(1, etaLines.length) * 4.5;

    // Cargo Location:
    // doc.text("Cargo Location:", rightHalfStart + boxPadding, rightYPos);
    // doc.text(cargoLocationLines, shipmentValueStartX, rightYPos);
    rightYPos += Math.max(1, cargoLocationLines.length) * 4.5;

    // Draw horizontal line separating two-column section from cargo section
    yPos = sectionStartY + Math.max(leftColumnHeight, rightColumnHeight, 50);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 4;

    // ===== CARGO DETAILS SECTION (integrated with main box) =====
    // Check if we need a new page before cargo section
    const estimatedCargoHeight = cargoDetails.length > 0 ? Math.min(cargoDetails.length * cargoRowSpacing + 15, 100) : 20;
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
    
    // Table header
    doc.setFontSize(7);
    const cargoHeaders = ["Commodity", "No of Pcs", "Char. Weight (Kgs)", "Gr.Wt (Kgs)"];
    const cargoColWidths = [80, 30, 40, 40];
    let xPos = margin + boxPadding;

    doc.setFont("helvetica", "bold");
    cargoHeaders.forEach((header, index) => {
      doc.text(header, xPos, sectionY);
      xPos += cargoColWidths[index];
    });

    sectionY += 2;
    doc.line(margin, sectionY, pageWidth - margin, sectionY);
    sectionY += 4;

    // Table rows with actual data
    doc.setFont("helvetica", "normal");
    const commodityDescription = hawbData?.commodity_description || "";
    
    if (cargoDetails.length > 0) {
      cargoDetails.forEach((cargo: any) => {
        // Check if we need a new page for each row
        if (needsNewPage(sectionY, cargoRowSpacing + 2, fixedBoxEndY, bottomBorderPadding)) {
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
          
          // Redraw table header on new page
          xPos = margin + boxPadding;
          doc.setFont("helvetica", "bold");
          cargoHeaders.forEach((header, index) => {
            doc.text(header, xPos, sectionY);
            xPos += cargoColWidths[index];
          });
          sectionY += 2;
          doc.line(margin, sectionY, pageWidth - margin, sectionY);
          sectionY += 4;
          doc.setFont("helvetica", "normal");
        }
        
        xPos = margin + boxPadding;
        // Use commodity_description from hawb level (same for all rows)
        const commodity = commodityDescription;
        const noOfPcs = cargo.no_of_packages !== null && cargo.no_of_packages !== undefined ? String(cargo.no_of_packages) : "";
        const charWeight = cargo.chargeable_weight !== null && cargo.chargeable_weight !== undefined ? String(cargo.chargeable_weight) : "";
        const grossWeight = cargo.gross_weight !== null && cargo.gross_weight !== undefined ? String(cargo.gross_weight) : "";
        
        const rowData = [commodity, noOfPcs, charWeight, grossWeight];
        rowData.forEach((cell, index) => {
          const cellText = doc.splitTextToSize(cell || "", cargoColWidths[index] - 2);
          doc.text(cellText, xPos, sectionY);
          xPos += cargoColWidths[index];
        });
        sectionY += cargoRowSpacing;
      });
    } else {
      // Show placeholder if no cargo details
      xPos = margin + boxPadding;
      const placeholderRow = [commodityDescription || "{commodity_description}", "{no_of_packages}", "{chargeable_weight}", "{gross_weight}"];
      placeholderRow.forEach((cell, index) => {
        doc.text(cell, xPos, sectionY);
        xPos += cargoColWidths[index];
      });
      sectionY += cargoRowSpacing;
    }

    sectionY += 1;
    // doc.line(margin + boxPadding, sectionY - 1, pageWidth - margin - boxPadding, sectionY - 1);

    // Draw horizontal line separating cargo section from charges section
    sectionY += 1;
    doc.line(margin, sectionY, pageWidth - margin, sectionY);
    sectionY += 4;

    // ===== CHARGES SECTION (integrated with main box) =====
    // Check if we need a new page before charges section
    const estimatedChargesHeight = charges.length > 0 ? Math.min(charges.length * chargesRowSpacing + 15, 100) : 20;
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

    // Charges table header
    doc.setFontSize(7);
    const chargesHeaders = ["Charges", "Currency", "Units", "Per unit", "ROE", "Amt"];
    const chargesColWidths = [60, 25, 20, 25, 20, 30];
    xPos = margin + boxPadding;

    doc.setFont("helvetica", "bold");
    chargesHeaders.forEach((header, index) => {
      doc.text(header, xPos, sectionY);
      xPos += chargesColWidths[index];
    });

    sectionY += 2;
    doc.line(margin, sectionY, pageWidth - margin, sectionY);
    sectionY += 4;

    // Charges table rows with actual data
    doc.setFont("helvetica", "normal");
    
    if (charges.length > 0) {
      charges.forEach((charge: any) => {
        // Check if we need a new page for each row
        if (needsNewPage(sectionY, chargesRowSpacing + 2, fixedBoxEndY, bottomBorderPadding)) {
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
          
          // Redraw table header on new page
          xPos = margin + boxPadding;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7);
          chargesHeaders.forEach((header, index) => {
            doc.text(header, xPos, sectionY);
            xPos += chargesColWidths[index];
          });
          sectionY += 2;
          doc.line(margin, sectionY, pageWidth - margin, sectionY);
          sectionY += 4;
          doc.setFont("helvetica", "normal");
        }
        
        xPos = margin + boxPadding;
        const chargeName = charge.charge_name || "";
        // Extract currency from currency_details if available, otherwise use currency field
        const currency = charge.currency_details?.currency_code || charge.currency || "";
        const units = charge.no_of_unit !== null && charge.no_of_unit !== undefined ? String(charge.no_of_unit) : "";
        const perUnit = charge.amount_per_unit !== null && charge.amount_per_unit !== undefined ? String(charge.amount_per_unit) : "";
        const roe = charge.roe !== null && charge.roe !== undefined ? String(charge.roe) : "";
        const amount = charge.amount !== null && charge.amount !== undefined ? String(charge.amount) : "";
        
        const chargeRowData = [chargeName, currency, units, perUnit, roe, amount];
        chargeRowData.forEach((cell, index) => {
          const cellText = doc.splitTextToSize(cell || "", chargesColWidths[index] - 2);
          doc.text(cellText, xPos, sectionY);
          xPos += chargesColWidths[index];
        });
        sectionY += chargesRowSpacing;
      });
    } else {
      // Show placeholder if no charges
      xPos = margin + boxPadding;
      const placeholderCharge = ["{charge_name}", "{currency}", "{no_of_unit}", "{amount_per_unit}", "{roe}", "{amount}"];
      placeholderCharge.forEach((cell, index) => {
        doc.text(cell, xPos, sectionY);
        xPos += chargesColWidths[index];
      });
      sectionY += chargesRowSpacing;
    }
    doc.line(margin, sectionY - 2, pageWidth - margin, sectionY - 2);

    sectionY += 10;

    // Update yPos for next section after the combined box
    yPos = sectionY;

    // ===== NOTES SECTION (separate from boxes) =====
    // Check if we need a new page before notes
    const notesLineSpacing = 4;
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
    doc.setFontSize(8);
    doc.text("Note:", margin + boxPadding, yPos);
    yPos += 10;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    
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
    
    // Always start certificate on a new page
    doc.addPage();
    yPos = 10;

    // Certificate header (similar to main header but simpler)
    const certHeaderStartY = yPos;
    const certHeaderHeight = 25;
    const certHeaderCenterX = pageWidth / 2;

    // Logo      
    if (logoImage) {
    
      try {
        const logoWidth = 50;
        const logoHeight = 12;
        const logoX = certHeaderCenterX - 70;
        const logoY = certHeaderStartY + (certHeaderHeight - logoHeight) / 2;
        doc.addImage(logoImage, "PNG", logoX, logoY, logoWidth, logoHeight);
      } catch (error) {
        console.error("Error adding logo:", error);
      }
    }

    // Company Name and Address (right side)
    const certCompanyInfoX = certHeaderCenterX - 15;
    let certCompanyY = certHeaderStartY + 3;

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    const certCompanyNameLines = doc.splitTextToSize(branchInfo.name, (pageWidth - 2 * margin) / 2);
    doc.text(certCompanyNameLines, certCompanyInfoX, certCompanyY, { align: "left" });
    certCompanyY += certCompanyNameLines.length * 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    const certCompanyAddressLines = doc.splitTextToSize(branchInfo.address, (pageWidth - 2 * margin) / 2 - 15);
    doc.text(certCompanyAddressLines, certCompanyInfoX, certCompanyY, { align: "left" });
    certCompanyY += certCompanyAddressLines.length * 3.5;

    if (branchInfo.tel) {
      doc.text(`Tel ${branchInfo.tel}`, certCompanyInfoX, certCompanyY);
      certCompanyY += 3.5;
    }

    if (branchInfo.email) {
      doc.text(`Email :- ${branchInfo.email}`, certCompanyInfoX, certCompanyY);
      certCompanyY += 3.5;
    }

    const certInfoLine = [
      branchInfo.pan ? `PAN NO: ${branchInfo.pan}` : "",
      branchInfo.gstn ? `GSTN: ${branchInfo.gstn}` : ""
    ]
      .filter(Boolean)
      .join("    ");

    if (certInfoLine) {
      doc.text(certInfoLine, certCompanyInfoX, certCompanyY);
      certCompanyY += 3.5;
    }


    yPos = certHeaderStartY + certHeaderHeight + 10;

    // "TO WHOM SO EVER IT MAY CONCERN"
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("TO WHOM SO EVER IT MAY CONCERN", pageWidth / 2, yPos, { align: "center" });
    yPos += 8;

    // "FREIGHT CERTIFICATE" title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("FREIGHT CERTIFICATE", pageWidth / 2, yPos, { align: "center" });
    yPos += 15;

    // Certificate body text
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    
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
      const currency = freightCharge.currency_details?.currency_code || freightCharge.currency || "";
      const amount = freightCharge.amount !== null && freightCharge.amount !== undefined ? String(freightCharge.amount) : "";
      frtValue = currency && amount ? `${currency} ${amount}` : "";
    }
    
    // Get EXW value
    let exwValue = "";
    if (exWorksCharge) {
      const currency = exWorksCharge.currency_details?.currency_code || exWorksCharge.currency || "";
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
    doc.setFontSize(9);
    
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

