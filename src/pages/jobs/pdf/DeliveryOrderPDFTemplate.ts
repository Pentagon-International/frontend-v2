import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
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
}

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
  let logoEndX = margin + 5;
  
  // Logo (left side)
  if (logoImage) {
    try {
      const logoWidth = 50;
      const logoHeight = 12;
      const logoX = margin + 5;
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
    (pageWidth - 2 * margin) / 1.5
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

  return headerStartY + headerHeight + 5;
};

// Helper function to draw footer section
const drawFooterSection = (
  doc: jsPDF,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  boxPadding: number,
  leftColumnX: number,
  doNumber: string,
  todayDate: string,
  jobInfo: any
) => {
  const currentPage = doc.getCurrentPageInfo().pageNumber;
  const totalPages = doc.getNumberOfPages();
  const footerY = pageHeight - 10;
  
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");

  const referenceText = `Ref: ${doNumber || ""} on ${todayDate} by ${jobInfo?.created_by || ""}`;
  doc.text(referenceText, leftColumnX, footerY);

  doc.text(
    `Page ${currentPage} of ${totalPages}`,
    pageWidth - margin - boxPadding,
    footerY,
    { align: "right" }
  );
};

// Helper function to get branch info
const getBranchInfo = () => {
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
        logo_url: ""
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
        logo_url:""
      };
    }

    return {
      name: defaultBranch?.branch_title || "",
      address: defaultBranch?.address || "",
      tel: defaultBranch?.tel || "",
      email: defaultBranch?.email || "",
      pan: defaultBranch?.pan || "",
      gstn: defaultBranch?.gstn || "",
      logo_url: defaultBranch?.logo_url || "",
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
  drawFooterSection(doc, pageWidth, pageHeight, margin, boxPadding, leftColumnX, doNumber, todayDate, jobInfo);

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

    // Get branch info (same approach as CargoArrivalNoticePDFTemplate.ts)
    const branchInfo = getBranchInfo();
    const logoImage = branchInfo?.logo_url;

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
    const pleaseDeliverTo = housingData?.please_deliver_to || housingData?.consignee_name || "";
    const consigneeName = housingData?.consignee_name || "";
    const importerCode = housingData?.importer_code || "";
    const importerType = housingData?.importer_type || "";
    const notifyParty = housingData?.notify_customer1_name || "";
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

    // H.Bill of Lading - from housing_details
    const hbillNumber = housingData?.hbl_number || "";
    const hbillDate = housingData?.created_at
      ? formatDateForDisplay(housingData.created_at)
      : "";
    const hbillInfo = hbillNumber && hbillDate
      ? `${hbillNumber} / ${hbillDate}`
      : hbillNumber || hbillDate || "";

    const loadPortHBL = hbillNumber || "";
    
    // ETA - from consol_details (jobData)
    const eta = jobData?.eta || jobInfo?.eta || mawbDetails?.eta
      ? formatDateForDisplay(jobData.eta || jobInfo.eta || mawbDetails.eta)
      : "";
    
    const tsaNo = housingData?.tsa_no || "";
    
    // IGM NO./Date - from consol_details (jobData) - this is the key fix
    const igmNo = jobData?.igm_no || jobInfo?.igm_no || "";
    const igmDate = jobData?.igm_date || jobInfo?.igm_date
      ? formatDateForDisplay(jobData.igm_date || jobInfo.igm_date)
      : "";
    const igmInfo = igmNo && igmDate
      ? `${igmNo} / ${igmDate}`
      : igmNo || igmDate || "";
    
    const itemLineNo = housingData?.item_line_no || "";
    const subItemLineNo = housingData?.sub_item_line_no || "";
    const unstuffPlace = housingData?.unstuff_place || "";

    // Service for LCL/FCL - from consol_details (jobData)
    const service = jobData?.service || mawbDetails?.service || jobInfo?.service || "";

    // Marks & Description
    const marksNo = housingData?.marks_no || "";
    const commodityDescription = housingData?.commodity_description || "";

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
      "DELIVERY ORDER"
    );
    
    // Content starts inside the box
    let boxContentY = pageLayout.yPos;
    let boxStartY = pageLayout.boxStartY;
    let boxX = pageLayout.boxX;
    let boxWidth = pageLayout.boxWidth;

    // ===== TOP SECTION OF BOX: Attention to (left) and DO No/Date (right) =====
    // leftColumnX and rightColumnX already defined above

    // Attention to (left side - always shown, empty with spacing)
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("Attention to:", leftColumnX, boxContentY);
    // Leave empty space for attention to (3 lines)
    boxContentY += 10;

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
    const lineHeight = 6;
    let currentY = boxContentY;

    doc.setFontSize(7);
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
    currentY += Math.max(deliverToLines.length * 4, lineHeight);

    // Consignee
    doc.setFont("helvetica", "bold");
    doc.text("Consignee:", leftColumnX, currentY);
    doc.setFont("helvetica", "normal");
    const consigneeLines = doc.splitTextToSize(
      consigneeName || "",
      pageWidth - valueStartX - margin - boxPadding
    );
    doc.text(consigneeLines, valueStartX, currentY);
    currentY += Math.max(consigneeLines.length * 4, lineHeight);

    // Importer Code/Type
    const importerInfo = [importerCode, importerType].filter(Boolean).join(" / ");
    doc.setFont("helvetica", "bold");
    doc.text("Importer Code/Type:", leftColumnX, currentY);
    doc.setFont("helvetica", "normal");
    doc.text(importerInfo || "", valueStartX, currentY);
    currentY += lineHeight;

    // Notify party
    doc.setFont("helvetica", "bold");
    doc.text("Notify party:", leftColumnX, currentY);
    doc.setFont("helvetica", "normal");
    const notifyLines = doc.splitTextToSize(
      notifyParty || "",
      pageWidth - valueStartX - margin - boxPadding
    );
    doc.text(notifyLines, valueStartX, currentY);
    currentY += Math.max(notifyLines.length * 4, lineHeight);

    // CHA
    doc.setFont("helvetica", "bold");
    doc.text("CHA:", leftColumnX, currentY);
    doc.setFont("helvetica", "normal");
    const chaLines = doc.splitTextToSize(
      chaName || "",
      pageWidth - valueStartX - margin - boxPadding
    );
    doc.text(chaLines, valueStartX, currentY);
    currentY += Math.max(chaLines.length * 4, lineHeight);

    // Vessel/Voyage
    doc.setFont("helvetica", "bold");
    doc.text("Vessel/Voyage:", leftColumnX, currentY);
    doc.setFont("helvetica", "normal");
    const vesselLines = doc.splitTextToSize(
      vesselVoyage || "",
      pageWidth - valueStartX - margin - boxPadding
    );
    doc.text(vesselLines, valueStartX, currentY);
    currentY += Math.max(vesselLines.length * 4, lineHeight);

    // O.Bill of Lading
    doc.setFont("helvetica", "bold");
    doc.text("O.Bill of Lading:", leftColumnX, currentY);
    doc.setFont("helvetica", "normal");
    const obillLines = doc.splitTextToSize(
      obillInfo || "",
      pageWidth - valueStartX - margin - boxPadding
    );
    doc.text(obillLines, valueStartX, currentY);
    currentY += Math.max(obillLines.length * 4, lineHeight);

    // H.Bill of Lading
    doc.setFont("helvetica", "bold");
    doc.text("H.Bill of Lading:", leftColumnX, currentY);
    doc.setFont("helvetica", "normal");
    const hbillLines = doc.splitTextToSize(
      hbillInfo || "",
      pageWidth - valueStartX - margin - boxPadding
    );
    doc.text(hbillLines, valueStartX, currentY);
    currentY += Math.max(hbillLines.length * 4, lineHeight);

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
    currentY += Math.max(igmLines.length * 4, lineHeight);

    // Unstuff Place
    doc.setFont("helvetica", "bold");
    doc.text("Unstuff Place:", leftColumnX, currentY);
    doc.setFont("helvetica", "normal");
    doc.text(unstuffPlace || "", valueStartX, currentY);
    currentY += lineHeight;

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
    const containerDetails = jobData?.containerDetails || [];
    
    // Check if we need a new page before the table
    const estimatedTableHeight = cargoDetails.length > 0 ? Math.min(cargoDetails.length * 6 + 15, 100) : 0;
    const fixedBoxEndY = pageHeight - footerHeight; // Before footer
    if (cargoDetails.length > 0 && needsNewPage(currentY, estimatedTableHeight, fixedBoxEndY, bottomBorderPadding)) {
      // Create new page with layout
      doc.addPage();
      const newPageInfo = createPageLayout(doc, pageWidth, pageHeight, margin, boxPadding, branchInfo, logoImage, leftColumnX, doNumber, todayDate, jobInfo, "DELIVERY ORDER");
      currentY = newPageInfo.yPos;
      boxStartY = newPageInfo.boxStartY;
      boxX = newPageInfo.boxX;
      boxWidth = newPageInfo.boxWidth;
    }
    
    if (cargoDetails.length > 0) {
      const tableBody = cargoDetails.map((cargo: any) => {
        const containerNo = cargo.container_no || cargo.container_number || "";

        // LCL / FCL logic
        let lclFcl = service || "";
        if (!lclFcl && containerDetails?.length) {
          const matched = containerDetails.find(
            (c: any) => c.container_no === containerNo
          );
          const type =
            matched?.container_type_details?.container_type_name || "";
          lclFcl =
            type.includes("20") || type.includes("40") ? "FCL" : "LCL";
        }

        return [
          containerNo,
          lclFcl,
          "", // Unstuff Date
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
          fontSize: 7,
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
              "DELIVERY ORDER"
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
      const newPageInfo = createPageLayout(doc, pageWidth, pageHeight, margin, boxPadding, branchInfo, logoImage, leftColumnX, doNumber, todayDate, jobInfo, "DELIVERY ORDER");
      currentY = newPageInfo.yPos;
      boxStartY = newPageInfo.boxStartY;
      boxX = newPageInfo.boxX;
      boxWidth = newPageInfo.boxWidth;
    }

    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("Marks & Nos:", leftColumnX, currentY);
    doc.setFont("helvetica", "normal");
    const marksLines = doc.splitTextToSize(
      marksNo || "",
      pageWidth - leftColumnX - margin - boxPadding
    );
    
    // Check if marks will fit on current page
    const marksHeight = marksLines.length * 4;
    if (needsNewPage(currentY, marksHeight + lineHeight, fixedBoxEndY, bottomBorderPadding)) {
      // Create new page with layout
      doc.addPage();
      const newPageInfo = createPageLayout(doc, pageWidth, pageHeight, margin, boxPadding, branchInfo, logoImage, leftColumnX, doNumber, todayDate, jobInfo, "DELIVERY ORDER");
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
    currentY += Math.max(marksLines.length * 4, lineHeight);

    // Check if we need a new page before Description
    const descLines = doc.splitTextToSize(
      commodityDescription || "",
      pageWidth - leftColumnX - margin - boxPadding
    );
    const descHeight = descLines.length * 4;
    
    if (needsNewPage(currentY, descHeight + lineHeight, fixedBoxEndY, bottomBorderPadding)) {
      // Create new page with layout
      doc.addPage();
      const newPageInfo = createPageLayout(doc, pageWidth, pageHeight, margin, boxPadding, branchInfo, logoImage, leftColumnX, doNumber, todayDate, jobInfo, "DELIVERY ORDER");
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
      if (needsNewPage(currentY, 4, fixedBoxEndY, bottomBorderPadding)) {
        // Create new page with layout
        doc.addPage();
        const newPageInfo = createPageLayout(doc, pageWidth, pageHeight, margin, boxPadding, branchInfo, logoImage, leftColumnX, doNumber, todayDate, jobInfo, "DELIVERY ORDER");
        currentY = newPageInfo.yPos;
        boxStartY = newPageInfo.boxStartY;
        boxX = newPageInfo.boxX;
        boxWidth = newPageInfo.boxWidth;
      }
      doc.text(line, valueStartX - 20, currentY);
      currentY += 4;
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
      const newPageInfo = createPageLayout(doc, pageWidth, pageHeight, margin, boxPadding, branchInfo, logoImage, leftColumnX, doNumber, todayDate, jobInfo, "DELIVERY ORDER");
      currentY = newPageInfo.yPos;
      boxStartY = newPageInfo.boxStartY;
      boxX = newPageInfo.boxX;
      boxWidth = newPageInfo.boxWidth;
    }

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");

    const note1 = "Dear Sir,";
    const note2 = "Please note this Delivery Order is valid for 30 days from the vessel arrival date. Thereafter reissue due to loss of original DO or exceeding the validity of aforesaid 30 days will incur additional charges of INR 1000 for every additional 10 days.";
    const note3 = `For ${branchInfo.name || ""}`;

    const notes = [note1, note2, note3];
    notes.forEach((note) => {
      if (note) {
        const noteLines = doc.splitTextToSize(
          note,
          pageWidth - leftColumnX - margin - boxPadding
        );
        noteLines.forEach((line: string) => {
          // Check if we need a new page for each line
          if (needsNewPage(currentY, 4, fixedBoxEndY, bottomBorderPadding)) {
            // Create new page with layout
            doc.addPage();
            const newPageInfo = createPageLayout(doc, pageWidth, pageHeight, margin, boxPadding, branchInfo, logoImage, leftColumnX, doNumber, todayDate, jobInfo, "DELIVERY ORDER");
            currentY = newPageInfo.yPos;
            boxStartY = newPageInfo.boxStartY;
            boxX = newPageInfo.boxX;
            boxWidth = newPageInfo.boxWidth;
          }
          doc.text(line, leftColumnX, currentY);
          currentY += 4;
        });
        currentY += 2;
      }
    });
    doc.setFont("helvetica", "bold");
    doc.text("THIS IS A COMPUTER GENERATED DOCUMENT AND DOES NOT REQUIRE A SIGNATURE", pageWidth / 2, currentY + 5 , { align: "center"} )
    doc.setFont("helvetica", "normal");

    // Generate blob URL
    const pdfBlob = doc.output("blob");
    const blobUrl = URL.createObjectURL(pdfBlob);

    return blobUrl;
  } catch (error) {
    console.error("Error generating Delivery Order PDF:", error);
    throw error;
  }
};
