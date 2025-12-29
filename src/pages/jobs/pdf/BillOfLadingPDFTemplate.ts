import { jsPDF } from "jspdf";

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

// Helper function to get default branch info from user store
const getDefaultBranchInfo = () => {
  try {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user?.branches && Array.isArray(user.branches)) {
        const defaultBranch = user.branches.find(
          (branch: any) => branch.is_default === true
        );
        if (defaultBranch) {
          return {
            branch_title: defaultBranch.branch_title || "",
            address: defaultBranch.address || "",
            logo_url: defaultBranch.logo_url || null,
            tel: defaultBranch.tel || "",
            email: defaultBranch.email || "",
            pan: defaultBranch.pan || "",
            gstn: defaultBranch.gstn || "",
          };
        }
      }
    }
  } catch (error) {
    console.error("Error getting default branch info:", error);
  }
  return {
    branch_title: "",
    address: "",
    logo_url: null,
    tel: "",
    email: "",
    pan: "",
    gstn: "",
  };
};

// Helper function to get branch info

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

export const generateBillOfLadingPDF = (
  jobData: any,
  housingData: any,
  defaultBranch: any,
  country?: any
): string => {
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 5;
    const boxPadding = 5;
    let yPos = 10;

    // Get branch info from user store (default branch)
    const defaultBranchInfo = getDefaultBranchInfo();
    
    const branchInfo = {
      name: defaultBranchInfo.branch_title || defaultBranch?.branch_name || "CHENNAI",
      address: defaultBranchInfo.address || "",
      tel: defaultBranchInfo.tel || "",
      email: defaultBranchInfo.email || "",
      pan: defaultBranchInfo.pan || "", // Default PAN value
      gstn: defaultBranchInfo.gstn || "", // Default GSTN value
    };
    const logoUrl = defaultBranchInfo.logo_url;

    // Extract data from jobData and housingData
    const carrierDetails = jobData?.carrierDetails || {};
    const jobInfo = jobData || {};
    const mblDetails = jobData?.mblDetails || {};

    // Document Numbers
    const billOfLadingNo = carrierDetails?.mbl_number || housingData?.hbl_number || "";
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
    const notifySectionEndY = leftY;

    // Draw horizontal line (bottom border of Notify Address section - touches left and middle borders)
    doc.line(innerMargin, notifySectionEndY, midLineX, notifySectionEndY);
    leftY += 5;

    // Three Column Section: Place of acceptance, Date of acceptance, Port of Loading
    const threeColSectionTopBorder = leftY - 5; // Top border is the previous section's bottom border
    const threeColWidth = (leftBoxWidth - 2 * boxPadding - 4) / 3;
    const threeCol1X = innerMargin + boxPadding;
    const threeCol2X = innerMargin + boxPadding + threeColWidth;
    const threeCol3X = innerMargin + boxPadding + threeColWidth * 2;
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text("Place of acceptance:", threeCol1X, leftY);
    doc.text("Date of acceptance:", threeCol2X, leftY);
    doc.text("Port of Loading:", threeCol3X, leftY);
    leftY += 4;
    doc.setFont("helvetica", "normal");
    doc.text(houseOrigin || "", threeCol1X, leftY);
    doc.text(dateOfAcceptance || "", threeCol2X, leftY);
    doc.text(masterOrigin || "", threeCol3X, leftY);
    leftY += 8;
    const threeColSectionEndY = leftY;

    // Draw vertical borders for three-column section (touching top border)
    doc.line(threeCol2X - 2, threeColSectionTopBorder, threeCol2X - 2, threeColSectionEndY);
    doc.line(threeCol3X - 2, threeColSectionTopBorder, threeCol3X - 2, threeColSectionEndY);

    // Draw horizontal line (bottom border - touches left and middle borders)
    doc.line(innerMargin, threeColSectionEndY, midLineX, threeColSectionEndY);
    leftY += 5;

    // Two Column Section: Place of Discharge, Place of Delivery
    const twoCol1SectionTopBorder = leftY - 5; // Top border is the previous section's bottom border
    const twoColWidth = (leftBoxWidth - 2 * boxPadding - 2) / 2;
    const twoCol1X = innerMargin + boxPadding;
    const twoCol2X = innerMargin + boxPadding + twoColWidth;
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text("Place of Discharge:", twoCol1X, leftY);
    doc.text("Place of Delivery:", twoCol2X, leftY);
    leftY += 4;
    doc.setFont("helvetica", "normal");
    doc.text(masterDestination || "", twoCol1X, leftY);
    doc.text(houseDestination || "", twoCol2X, leftY);
    leftY += 8;
    const twoCol1SectionEndY = leftY;

    // Draw vertical border for two-column section (touching top border)
    doc.line(twoCol2X - 2, twoCol1SectionTopBorder, twoCol2X - 2, twoCol1SectionEndY);

    // Draw horizontal line (bottom border - touches left and middle borders)
    doc.line(innerMargin, twoCol1SectionEndY, midLineX, twoCol1SectionEndY);
    leftY += 5;

    // Two Column Section: Vessel Voy No, Date of Period of Delivery
    const twoCol2SectionTopBorder = leftY - 5; // Top border is the previous section's bottom border
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text("Vessel Voy No:", twoCol1X, leftY);
    doc.text("Date of Period of Delivery:", twoCol2X, leftY);
    leftY += 4;
    doc.setFont("helvetica", "normal");
    doc.text(vesselVoyNo || "", twoCol1X, leftY);
    doc.text(dateOfPeriodOfDelivery || "", twoCol2X, leftY);
    leftY += 4; // Reduced padding to move border closer
    const twoCol2SectionEndY = leftY + 3;

    // Draw vertical border for two-column section (touching top border)
    doc.line(twoCol2X - 2, twoCol2SectionTopBorder, twoCol2X - 2, twoCol2SectionEndY);

    // Draw horizontal line (bottom border - touches left and middle borders)
    // doc.line(innerMargin, twoCol2SectionEndY, midLineX, twoCol2SectionEndY);

    // ===== RIGHT BOX CONTENT =====
    
    // Bill of Lading Title
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Bill of Lading:", midLineX + boxPadding, rightY);
    rightY += 8;
    const billTitleSectionEndY = rightY;

    // Draw horizontal line (bottom border of Bill of Lading title - touches middle and right borders)
    doc.line(midLineX, billTitleSectionEndY, innerMargin + innerWidth, billTitleSectionEndY);
    rightY += 5;

    // Company Section (Branch title at center, logo, address)
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    // Split company name to fit within the box width
    const companyTitleLines = doc.splitTextToSize(branchInfo.name || "", rightBoxWidth - 2 * boxPadding);
    doc.text(companyTitleLines, midLineX + boxPadding, rightY);
    rightY += companyTitleLines.length * 3.5;

    // Logo from S3 URL - centered with padding on all sides
    if (logoUrl) {
      try {
        const logoPadding = 3; // Padding on all sides
        const logoWidth = 40;
        const logoHeight = 15;
        
        // Calculate available width for logo section
        const availableWidth = rightBoxWidth - 2 * boxPadding;
        
        // Center the logo horizontally within the available width
        const logoX = midLineX + boxPadding + (availableWidth - logoWidth) / 2;
        
        // Add top padding
        // rightY += logoPadding;
        
        // Draw the logo
        doc.addImage(logoUrl, "PNG", logoX, rightY, logoWidth, logoHeight, undefined, "FAST");
        
        // Add bottom padding
        rightY += logoHeight + logoPadding + 3;
      } catch (error) {
        console.warn("Could not load logo from URL, continuing without logo:", error);
      }
    }

    // Branch Address
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    const branchAddressLines = doc.splitTextToSize(branchInfo.address || "", rightBoxWidth - 2 * boxPadding);
    doc.text(branchAddressLines, midLineX + boxPadding, rightY);
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
    rightY += 5;

    // Condition Section
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7); // Increased from 6 to 7 for better readability
    const conditionParagraph1 = "Taken in charge in apparently good condition here in at the place of receipt for transport and delivery as mentioned above, unless otherwise stated. The MTO in accordance with the provisions contained in the MTD undertakes to perform or to procure the performance of the multimodal transport from the place at which the goods are taken in charge, to the place designated for delivery and assumes responsibility for such transport.";
    const conditionParagraph2 = "One of the MTD (s) must be surrendered, duly endorsed in exchange for the goods. In witness where of the original MTD all of this tenure and date have been signed in the number indicated below one of which being accomplished the other(s) to be void.";
    
    const conditionLines1 = doc.splitTextToSize(conditionParagraph1, rightBoxWidth - 2 * boxPadding);
    doc.text(conditionLines1, midLineX + boxPadding, rightY);
    rightY += 20; // Increased line height from 3 to 4.5 for better readability
    
    // Add spacing between paragraphs
    // rightY += 3;
    
    const conditionLines2 = doc.splitTextToSize(conditionParagraph2, rightBoxWidth - 2 * boxPadding);
    doc.text(conditionLines2, midLineX + boxPadding, rightY);
    rightY += conditionLines2.length * 3.5; // Increased line height from 3 to 4.5 for better readability
    const conditionSectionEndY = rightY;

    // Draw horizontal line (bottom border of Condition section - touches middle and right borders)
    doc.line(midLineX, conditionSectionEndY, innerMargin + innerWidth, conditionSectionEndY);
    rightY += 5;

    // Delivery Contact Section
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("To Obtain delivery Contact", midLineX + boxPadding, rightY);
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
    // rightY += 5;
    const deliveryContactSectionEndY = rightY;

    // Draw horizontal line (bottom border of Delivery Contact section - touches middle and right borders)
    doc.line(midLineX, deliveryContactSectionEndY, innerMargin + innerWidth, deliveryContactSectionEndY);
    rightY += 5;

    // Means of Transport Section - Divided into two halves with vertical border
    const meansOfTransportSectionTopBorder = rightY - 5; // Top border is the previous section's bottom border
    const meansOfTransportHalfWidth = (rightBoxWidth - 2 * boxPadding - 2) / 2;
    const meansOfTransportLeftX = midLineX + boxPadding;
    const meansOfTransportRightX = midLineX + boxPadding + meansOfTransportHalfWidth;
    const meansOfTransportMidX = midLineX + boxPadding + meansOfTransportHalfWidth;
    
    // Left half: Modes/ Means of Transport
    let leftHalfY = rightY;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text("Modes/ Means of Transport:", meansOfTransportLeftX, leftHalfY);
    leftHalfY += 4;
    doc.setFont("helvetica", "normal");
    doc.text(modesOfTransport || "", meansOfTransportLeftX, leftHalfY);
    leftHalfY += 4; // Reduced padding to move border closer
    
    // Right half: Route/ Place of Transhipments
    let rightHalfY = rightY;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text("Route/ Place of Transhipments (if any):", meansOfTransportRightX + 2, rightHalfY);
    rightHalfY += 4;
    doc.setFont("helvetica", "normal");
    const routeLines = doc.splitTextToSize(routePlaceOfTransshipment || "", meansOfTransportHalfWidth - 2);
    doc.text(routeLines, meansOfTransportRightX + 2, rightHalfY);
    rightHalfY += Math.max(routeLines.length * 3.5, 4); // Reduced padding to move border closer
    
    // Use the maximum Y position from both halves
    const meansOfTransportSectionEndY = Math.max(leftHalfY, rightHalfY);
    rightY = meansOfTransportSectionEndY;
    
    // Draw vertical border between the two halves (touching top border)
    doc.line(meansOfTransportMidX, meansOfTransportSectionTopBorder, meansOfTransportMidX, meansOfTransportSectionEndY);
    
    // Draw horizontal line (bottom border - touches middle and right borders)
    // doc.line(midLineX, meansOfTransportSectionEndY, innerMargin + innerWidth, meansOfTransportSectionEndY);
    // rightY += 5;

    // Calculate actual main box height (align both sections to end at the same horizontal line)
    // Ensure both "Vessel Voy No" (left) and "Modes/ Means of Transport" (right) end together
    const finalLeftY = leftY; // Vessel Voy No section end
    const finalRightY = rightY; // Modes/ Means of Transport section end
    const maxY = Math.max(finalLeftY, finalRightY) - 5; // Reduced by ~5 lines to move border upwards
    
    // Align both sides to end at the same height (this will be the border of the second box)
    leftY = maxY;
    rightY = maxY;
    
    const actualMainBoxHeight = maxY - mainBoxStartY + boxPadding;
    
    // The shared border between top box and bottom box (container details section)
    const bottomBoxStartY = mainBoxStartY + actualMainBoxHeight;
    
    // Calculate footer section height
    const footerSectionHeight = 35; // Approximate height for footer section (top row + bottom section)
    const footerStartY = pageHeight - innerMargin - footerSectionHeight;
    
    // Calculate container details section height (ends before footer section)
    const containerDetailsSectionHeight = footerStartY - bottomBoxStartY;
    
    // Calculate full box height (top box + container details section only, footer is separate)
    const fullBoxHeight = containerDetailsSectionHeight + actualMainBoxHeight;
    
    // Draw the full box border (top box + container details section as one continuous box)
    drawBox(doc, innerMargin, mainBoxStartY, mainBoxWidth, fullBoxHeight);
    doc.line(midLineX, mainBoxStartY, midLineX, mainBoxStartY + actualMainBoxHeight);
    
    // Draw the shared horizontal border between top box and container details section
    doc.line(innerMargin, bottomBoxStartY, innerMargin + mainBoxWidth, bottomBoxStartY);
    
    // ===== CONTAINER DETAILS SECTION =====
    let containerDetailsY = bottomBoxStartY + boxPadding;
    
    // Define column widths (5 columns)
    const containerCol1Width = mainBoxWidth * 0.25; // Container No. (S) - 25%
    const containerCol2Width = mainBoxWidth * 0.15; // Marks and Numbers - 15%
    const containerCol3Width = mainBoxWidth * 0.30; // Description - 30%
    const containerCol4Width = mainBoxWidth * 0.15; // Gross Weight - 15%
    const containerCol5Width = mainBoxWidth * 0.15; // Measurement - 15%
    
    // Calculate column X positions
    const containerCol1X = innerMargin;
    const containerCol2X = containerCol1X + containerCol1Width;
    const containerCol3X = containerCol2X + containerCol2Width;
    const containerCol4X = containerCol3X + containerCol3Width;
    const containerCol5X = containerCol4X + containerCol4Width;
    
    // Draw header row - start from the top border of container details section
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    const headerY = bottomBoxStartY + 3; // Reduced spacing (was boxPadding, now 3)
    
    // Header texts - Column 1
    doc.text("Container No. (S)", containerCol1X + boxPadding, headerY);
    
    // Header texts - Column 2 - Center aligned
    const marksHeaderText = "Marks and Numbers";
    const marksHeaderWidth = doc.getTextWidth(marksHeaderText);
    const marksHeaderCenterX = containerCol2X + (containerCol2Width / 2) - (marksHeaderWidth / 2);
    doc.text(marksHeaderText, marksHeaderCenterX, headerY);
    
    // Header texts - Column 3 (split into multiple lines)
    const descHeaderText = "Number of packages, kinds of packages, general description of goods. (said to contain)";
    const descHeaderLines = doc.splitTextToSize(descHeaderText, containerCol3Width - 2 * boxPadding);
    doc.text(descHeaderLines, containerCol3X + boxPadding, headerY);
    const descHeaderHeight = descHeaderLines.length * 3.5;
    
    // Header texts - Column 4
    doc.text("Gross Weight", containerCol4X + boxPadding, headerY);
    
    // Header texts - Column 5
    doc.text("Measurement", containerCol5X + boxPadding, headerY);
    
    // Calculate header height based on the tallest column - increased bottom padding
    const headerBottomY = headerY + Math.max(5, descHeaderHeight) ; // Added 3 units of bottom padding
    
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
      doc.setFontSize(7);
      const pageHeaderY = pageBoxStartY + 3;
      
      // Header texts
      doc.text("Container No. (S)", containerCol1X + boxPadding, pageHeaderY);
      
      const marksHeaderText = "Marks and Numbers";
      const marksHeaderWidth = doc.getTextWidth(marksHeaderText);
      const marksHeaderCenterX = containerCol2X + (containerCol2Width / 2) - (marksHeaderWidth / 2);
      doc.text(marksHeaderText, marksHeaderCenterX, pageHeaderY);
      
      const descHeaderText = "Number of packages, kinds of packages, general description of goods. (said to contain)";
      const descHeaderLines = doc.splitTextToSize(descHeaderText, containerCol3Width - 2 * boxPadding);
      doc.text(descHeaderLines, containerCol3X + boxPadding, pageHeaderY);
      const pageDescHeaderHeight = descHeaderLines.length * 3.5;
      
      doc.text("Gross Weight", containerCol4X + boxPadding, pageHeaderY);
      doc.text("Measurement", containerCol5X + boxPadding, pageHeaderY);
      
      const pageHeaderBottomY = pageHeaderY + Math.max(5, pageDescHeaderHeight);
      
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
    const footerColWidth = mainBoxWidth / 4;
    const footerCol1X = innerMargin;
    const footerCol2X = footerCol1X + footerColWidth;
    const footerCol3X = footerCol2X + footerColWidth;
    const footerCol4X = footerCol3X + footerColWidth;
    
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
    footerY = footerBottomSectionY + boxPadding;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    const companyText = `For ${branchInfo.name}`;
    doc.text(companyText, footerBottomRightX + boxPadding, footerY);
    
    footerY += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    const signatoryText = "AUTHORISED SIGNATORY";
    const signatoryTextWidth = doc.getTextWidth(signatoryText);
    const signatoryCenterX = footerBottomRightX + (footerBottomRightWidth / 2) - (signatoryTextWidth / 2);
    doc.text(signatoryText, signatoryCenterX, footerY);
    
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

    // Generate blob URL
    const pdfBlob = doc.output("blob");
    const blobUrl = URL.createObjectURL(pdfBlob);

    return blobUrl;
  } catch (error) {
    console.error("Error generating Bill Of Lading PDF:", error);
    throw error;
  }
};

