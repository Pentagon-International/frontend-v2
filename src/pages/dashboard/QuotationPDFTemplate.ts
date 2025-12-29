import { jsPDF } from "jspdf";
import primeLogo from "../../assets/images/prime.png";
import pentagonFreightInd from "../../assets/images/pentagon-freight-ind.png";
import pentagonPrimeAmericas from "../../assets/images/PentagonPrimeUSA.png";
import pentagonPrimeChina from "../../assets/images/PentagonPrimeChina.png";
import cargoConsolidators from "../../assets/images/CCIPL.png";
// Helper function for date formatting (YYYY-MM-DD)
const formatDate = (dateString: any) => {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Helper function to get logo based on country and company
const getLogoByCountry = (country: any): string | null => {
  try {
    // Get company and country from localStorage (store)
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

    // Get country from parameter if provided (overrides localStorage)
    if (country) {
      countryName = (country.country_name || "").toUpperCase();
      countryCode = (country.country_code || "").toUpperCase();
    }

    // Check for cargoConsolidators company with India country - show CARGO CONSOLIDATORS logo
    // Handle different formats: "cargoConsolidators", "Cargo Consolidators", "CARGO CONSOLIDATORS", etc.
    const normalizedCompanyName = companyName.replace(/\s+/g, "").toUpperCase();
    if (
      normalizedCompanyName === "CARGOCONSOLIDATORSINDIA" &&
      countryCode === "IN"
    ) {
      return cargoConsolidators;
    }

    // Check for India (by name or code)
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
    // Default to primeLogo for other countries
    return primeLogo;
  } catch (error) {
    console.error("Error getting logo by country:", error);
    // Fallback to default logo
    return primeLogo;
  }
};

// Helper function to check if company is Pentagon (excluding cargoConsolidators)
const isPentagonCompany = (): boolean => {
  try {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user?.company) {
        const companyName = (user.company.company_name || "").toUpperCase();
        const normalizedCompanyName = companyName
          .replace(/\s+/g, "")
          .toUpperCase();
        // Return true if it's Pentagon company but NOT cargoConsolidators
        return normalizedCompanyName !== "CARGOCONSOLIDATORSINDIA";
      }
    }
    // Default to true if no company info (assume Pentagon)
    return true;
  } catch (error) {
    console.error("Error checking company:", error);
    return true;
  }
};

// Helper function to get branch info
const getBranchInfo = (branchName: string, country?: any) => {
  const branchNameUpper = branchName?.toUpperCase() || "";

  // Get company and country from localStorage (store)
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

  // Get country code from parameter if provided (overrides localStorage)
  if (country) {
    countryCode = (country.country_code || "").toUpperCase();
  }

  // Check for cargoConsolidators company with India country - show CARGO CONSOLIDATORS address
  // Handle different formats: "cargoConsolidators", "Cargo Consolidators", "CARGO CONSOLIDATORS", etc.
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
    };
  } 
  else if (
    normalizedCompanyName === "CARGOCONSOLIDATORSINDIA" &&
    countryCode === "IN" &&
    branchNameUpper.includes("CHENNAI")
  ) {
    return {
      name: "Cargo Consolidators India Pvt Ltd",
      address:
        "Door No: 205/325, 3rd Floor, Poonamallee High Road, Aminjikarai, Chennai-600 029. Tel: 044 42078064 / 044 42623690 / 044 43201012",
    };
  }
  else if (
    normalizedCompanyName === "CARGOCONSOLIDATORSINDIA" &&
    countryCode === "IN" &&
    branchNameUpper.includes("BANGALORE")
  ) {
    return {
      name: "Cargo Consolidators India Pvt Ltd",
      address:
        "624/1&2, 4th Floor, Door 14, 5th Main Road, Bhuvanagiri, B. Channasandra Main Road, OMBR Layout, Bangalore 560043",
    };
  }
  else if (
    normalizedCompanyName === "CARGOCONSOLIDATORSINDIA" &&
    countryCode === "IN"
  ) {
    // For other branches of CARGOCONSOLIDATORSINDIA - show name only, empty address
    return {
      name: "Cargo Consolidators India Pvt Ltd",
      address: "",
    };
  }
  else if (branchNameUpper.includes("CHENNAI")) {
    return {
      name: "PENTAGON INTERNATIONAL FREIGHT SOLUTIONS PVT LTD (CHENNAI)",
      address: "No. 15, Dr. Gopala Menon Road, Kodambakkam, Chennai – 600 024.",
    };
  } else if (branchNameUpper.includes("MUMBAI")) {
    return {
      name: "PENTAGON INTERNATIONAL FREIGHT SOLUTIONS PVT LTD (MUMBAI)",
      address:
        "Unit no – 204, Satellite Silver, Marol Naka, Andheri Kurla Road, Andheri (east), Mumbai – 400059",
    };
  } else if (branchNameUpper.includes("DUBAI")) {
    return {
      name: "PENTAGON PRIME INTERNATIONAL FREIGHT LLC",
      address:
        "Office no 506, Business Venue Building, Umm Hurair Street, Oud Mehta, P.O. Box 117146, Dubai, UAE",
    };
  } else if (branchNameUpper.includes("BANGALORE")) {
    return {
      name: "PENTAGON INTERNATIONAL FREIGHT SOLUTIONS PVT LTD (BANGALORE)",
      address:
        "No.3A, Srinidhi Envoy, 1st Floor, 4th C Cross, 2nd Main Road, Kasturi Nagar, Banaswadi Post, Near Cafe Coffee day, Bangalore - 560043",
    };
  } else if (branchNameUpper.includes("VIETNAM")) {
    return {
      name: "PENTAGON PRIME VIET NAM CO.,LTD",
      address:
        "Floor 4, No 203 Nam Ky Khoi Nghia street, Xuan Hoa Ward, Ho Chi Minh city",
    };
  } else if (branchNameUpper.includes("AHMEDABAD")) {
    return {
      name: "PENTAGON INTERNATIONAL FREIGHT SOLUTIONS PVT LTD (AHMEDABAD)",
      address:
        "C-408, Titanium Business Park Beside Makarba Under Bridge Off Corporate Road, Makarba,Ahmedabad – 380058",
    };
  } else if (branchNameUpper.includes("NEW YORK")) {
    return {
      name: "PENTAGON PRIME AMERICAS INC",
      address: "8400 NW 33rd STREET, SUITE 310, MIAMI FL 33178",
    };
  } else if (branchNameUpper.includes("KENYA")) {
    return {
      name: "Pentagon Prime Kenya Co Limited",
      address:
        "Office No. S9-08, MTC Building(Amabalal House), 9th Floor, South Tower, Nkrumah Road, P.O.Box 2050-80100, Mombasa, Kenya",
    };
  } else if (branchNameUpper.includes("CHINA")) {
    return {
      name: "PENTAGON PRIME CHINA CO.,LTD",
      address:
        "PENTAGON PRIME CHINA CO., LTD Add:3009, Huaan Building, Baoan South Road, Luohu District, Shenzhen",
    };
  }

  // Default to Chennai if branch not found
  return {
    name: "",
    address: "",
  };
};

const getExchangeRates = (data: any) => {
  const currencyObj: Record<string, any> = {};

  data?.quotation?.forEach((q: any) => {
    const quoteCurrency = q.quote_currency?.toUpperCase();

    q.charges?.forEach((charge: any) => {
      const curr = charge.currency?.toUpperCase();
      const roe = charge.roe;

      if (!curr || curr === quoteCurrency) return;

      if (currencyObj[curr] === undefined) {
        currencyObj[curr] = roe;
      }
    });
  });

  // return null if no data
  if (Object.keys(currencyObj).length === 0) return null;

  // Convert to "Currency - roe" string
  return Object.entries(currencyObj)
    .map(([currency, roe]) => `${currency} - ${roe}`)
    .join(", ");
};

export const generateNewQuotationPDF = (
  rowData: any,
  defaultBranch: any,
  country?: any,
  userCurrency?: any
): string => {
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    let yPos = 10;
    // Get branch info
    const branchName = defaultBranch?.branch_name || "CHENNAI";
    const branchInfo = getBranchInfo(branchName, country);

    // Get logo based on country and company
    const logoImage = getLogoByCountry(country);

    // Approval URL - get from environment variable
    const baseApprovalUrl = window.location.origin;
    const quotationId =
      rowData?.id || rowData?.quotation_id || rowData?.enquiry_id;
    const approvalUrl = `${baseApprovalUrl}/quotation/approvalrequest/${quotationId}`;

    // Set document properties
    doc.setProperties({
      title: `Quotation - ${rowData.enquiry_id}`,
      subject: "Freight Quotation",
      author: branchInfo.name,
    });

    // Set all lines to normal weight
    doc.setLineWidth(0.3);
    doc.setDrawColor(0, 0, 0);

    // ===== HEADER SECTION =====
    const midLine = pageWidth / 2;
    const leftHalfWidth = midLine - margin - 3;
    const rightHalfWidth = pageWidth / 2 - margin - 3;
    const rightHalfStart = midLine + 3;

    // PRE-CALCULATE HEIGHTS FOR DYNAMIC HEADER
    const headerStartY = yPos;

    // ===== RIGHT SIDE: Company section height calculation =====
    // Logo dimensions - maintain aspect ratio with defined size
    const logoMaxWidth = rightHalfWidth * 0.8; // Use 60% of right half width

    const logoMaxHeight = 12; // Fixed max height

    // Default logo dimensions (will maintain aspect ratio)
    // Most logos are roughly 2:1 to 3:1 width:height ratio
    // We'll use a reasonable default and let jsPDF handle the actual aspect ratio
    let logoWidth = logoMaxWidth;
    let logoHeight = logoMaxHeight;

    // Adjust to maintain reasonable aspect ratio (prefer wider logos)
    // If calculated height exceeds max, constrain by height
    const defaultAspectRatio = 2.5; // width:height ratio
    const calculatedHeight = logoWidth / defaultAspectRatio;
    if (calculatedHeight > logoMaxHeight) {
      logoHeight = logoMaxHeight;
      logoWidth = logoHeight * defaultAspectRatio + 20;
    } else {
      logoHeight = calculatedHeight;
    }

    // Company name width (full width of right half)
    const companyNameWidth = rightHalfWidth - 3;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    const companyNameLinesCalc = doc.splitTextToSize(
      branchInfo.name,
      companyNameWidth
    );

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    const companyAddressLinesCalc = doc.splitTextToSize(
      branchInfo.address,
      rightHalfWidth - 3
    );

    // Right side total height: top margin + logo height + gap + name height + gap + address height + bottom margin
    const rightSideContentHeight =
      5 + // top margin
      logoHeight + // logo height
      3 + // gap between logo and name
      companyNameLinesCalc.length * 4 + // company name lines
      3 + // gap between name and address
      companyAddressLinesCalc.length * 4 + // address lines
      3; // bottom margin

    // ===== LEFT SIDE: Customer section height calculation =====
    // Row 1 fixed height (QUOTATION + Reference) = 15
    // Row 2: CUSTOMER label + name + address

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");

    const addressText = Array.isArray(rowData.customer_address)
      ? rowData.customer_address[0]
      : rowData.customer_address;

    // IMPORTANT: Customer address should wrap within LEFT HALF only
    const customerAddressLinesCalc = doc.splitTextToSize(
      addressText || "",
      leftHalfWidth - 6 // Use left half width for proper wrapping
    );

    // Left side total height: row 1 (15) + label (4) + name (4) + address lines + bottom margin
    const leftSideContentHeight =
      18 + // row 1 height (fixed)
      4 + // CUSTOMER label
      4 + // customer name
      customerAddressLinesCalc.length * 4 + // address lines (wrapped)
      3; // bottom margin

    // Set header height to the maximum of both sides
    const headerSectionHeight = Math.max(
      rightSideContentHeight,
      leftSideContentHeight,
      35 // minimum height
    );

    // Draw outer border for header with dynamic height
    doc.rect(margin, headerStartY, pageWidth - 2 * margin, headerSectionHeight);

    // Draw vertical center line FULL HEIGHT
    doc.line(
      midLine,
      headerStartY,
      midLine,
      headerStartY + headerSectionHeight
    );

    // Draw horizontal divider between row 1 and row 2 - ONLY first half
    doc.line(margin, headerStartY + 15, midLine, headerStartY + 15);

    // Row 1: QUOTATION title + reference (left) | Company name & address (right)
    let leftYPos = headerStartY + 5;
    let rightYPos = headerStartY + 5;

    // Left half - QUOTATION title and approval link on same row
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("QUOTATION", margin + 32, leftYPos);

    // Approval link on same row - positioned after QUOTATION text with proper gap
    doc.setTextColor(0, 0, 255);
    doc.setFontSize(8);
    doc.textWithLink("Click here to approve", margin + 60, leftYPos + 8, {
      url: approvalUrl,
    });
    doc.setTextColor(0, 0, 0);
    leftYPos += 5;

    // Reference - LEFT ALIGNED
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Reference: ${rowData.enquiry_id}`, margin + 3, leftYPos + 3);
    leftYPos += 4;

    // Right half - Logo first, then company name, then address (all centered horizontally)
    try {
      // Logo (centered horizontally)
      if (logoImage) {
        const logoX = rightHalfStart + (rightHalfWidth - logoWidth) / 2; // Center logo

        const logoY = rightYPos;

        doc.addImage(logoImage, "PNG", logoX, logoY, logoWidth, logoHeight);
        rightYPos += logoHeight + 3; // Move down after logo with gap
      }
    } catch (error) {
      console.error("Error adding logo image:", error);
      // Continue without logo if image fails to load
    }

    // Company name (centered horizontally, below logo)
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    companyNameLinesCalc.forEach((line: string) => {
      const companyNameX =
        rightHalfStart + (rightHalfWidth - doc.getTextWidth(line)) / 2;
      doc.text(line, companyNameX, rightYPos + 3);
      rightYPos += 4;
    });

    rightYPos += 3; // Gap between name and address

    // Company address (centered horizontally, below name)
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    companyAddressLinesCalc.forEach((line: string) => {
      const addressX =
        rightHalfStart + (rightHalfWidth - doc.getTextWidth(line)) / 2;
      doc.text(line, addressX, rightYPos + 3);
      rightYPos += 4;
    });

    // Row 2: Customer name & address (LEFT HALF only - no overflow to right)
    leftYPos = headerStartY + 18;

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("CUSTOMER:", margin + 3, leftYPos);
    leftYPos += 4;

    doc.setFont("helvetica", "normal");
    doc.text(rowData.customer_name || "N/A", margin + 3, leftYPos);
    leftYPos += 4;

    // Render wrapped customer address line by line
    if (rowData.customer_address && customerAddressLinesCalc.length > 0) {
      customerAddressLinesCalc.forEach((line: string) => {
        doc.text(line, margin + 3, leftYPos);
        leftYPos += 4;
      });
    }

    yPos = headerStartY + headerSectionHeight + 3;

    // ===== QUOTATION SERVICES SECTION =====
    if (
      rowData.quotation &&
      Array.isArray(rowData.quotation) &&
      rowData.quotation.length > 0
    ) {
      rowData.quotation.forEach((quotation: any, serviceIndex: number) => {
        // Check if we need a new page
        if (yPos > pageHeight - 50) {
          doc.addPage();
          yPos = 10;
        } else {
          yPos += 4;
        }

        // Service Header - Show Quotation ID instead of Service 1
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(
          `Quotation ID: ${quotation.quotation_id || "N/A"}`,
          margin,
          yPos
        );
        yPos += 4;

        // === SERVICE DETAILS SECTION ===
        const serviceSectionStartY = yPos;
        const leftColX = margin;
        const rightColX = midLine;
        const itemHeight = 6;
        const leftColWidth = midLine - leftColX - 2;
        const rightColWidth = pageWidth - rightColX - margin;

        // Left column items with boxes
        const leftItemsRaw = [
          { label: "Service Type", value: quotation.service_type },
          { label: "Trade", value: quotation.trade },
          {
            label: "Origin",
            value: quotation.origin
              ? `${quotation.origin} (${quotation.origin_code || ""})`
              : null,
          },
          {
            label: "Destination",
            value: quotation.destination
              ? `${quotation.destination} (${quotation.destination_code || ""})`
              : null,
          },
          {
            label: "Shipment Terms",
            value: quotation.shipment_terms
              ? `${quotation.shipment_terms} (${quotation.shipment_terms_code || ""})`
              : null,
          },
          { label: "ICD", value: quotation.icd },
        ];

        const leftItems = leftItemsRaw.filter(
          (item) => item.value && String(item.value).trim() !== ""
        );

        // Right column items (removed profit)
        const rightItemsRaw = [
          { label: "Carrier", value: quotation.carrier },
          {
            label: "Hazardous Cargo",
            value: quotation.hazardous_cargo ? "Yes" : "No",
          },
          {
            label: "Cargo Nature",
            value: quotation.stackable ? "Stackable" : "Non-Stackable",
          },
          { label: "Quoted Date", value: formatDate(quotation.created_at) },
          { label: "Valid Upto", value: formatDate(quotation.valid_upto) },
          {
            label: "Quote Currency",
            value: quotation.quote_currency,
          },
        ];

        const rightItems = rightItemsRaw.filter((item) => {
          if (item.label === "Hazardous Cargo") return true;
          return (
            item.value &&
            String(item.value).trim() !== "" &&
            String(item.value) !== "N/A"
          );
        });

        // Calculate dynamic height based on actual items
        // First, calculate heights for each column considering multi-line values
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");

        let leftColumnHeight = 0;
        leftItems.forEach(() => {
          leftColumnHeight += itemHeight;
        });

        let rightColumnHeight = 0;
        rightItems.forEach((item) => {
          if (item.label.toLowerCase() === "carrier") {
            const valueText = doc.splitTextToSize(
              String(item.value),
              rightColWidth - 45
            );
            const limitedLines = valueText.slice(0, 3);
            rightColumnHeight += Math.max(
              itemHeight,
              limitedLines.length * 4 + 2
            );
          } else {
            rightColumnHeight += itemHeight;
          }
        });

        // Use the maximum height of both columns
        const serviceSectionHeight = Math.max(
          leftColumnHeight,
          rightColumnHeight
        );

        // Draw overall border for service section with dynamic height
        doc.rect(
          leftColX,
          serviceSectionStartY,
          pageWidth - 2 * margin,
          serviceSectionHeight
        );

        // Draw vertical center line
        doc.line(
          midLine,
          serviceSectionStartY,
          midLine,
          serviceSectionStartY + serviceSectionHeight
        );

        // Draw left column with horizontal lines
        let currentY = serviceSectionStartY;
        leftItems.forEach((item, index) => {
          // Draw horizontal line between items
          if (index > 0) {
            doc.line(leftColX, currentY, midLine - 2, currentY);
          }

          // Draw label and value
          doc.setFont("helvetica", "bold");
          doc.text(item.label + ":", leftColX + 2, currentY + 4);
          doc.setFont("helvetica", "normal");

          const valueText = doc.splitTextToSize(
            String(item.value),
            leftColWidth - 45
          );
          doc.text(valueText, leftColX + 40, currentY + 4);

          currentY += itemHeight;
        });

        // Draw right column with horizontal lines
        currentY = serviceSectionStartY;
        rightItems.forEach((item, index) => {
          // Draw horizontal line between items
          if (index > 0) {
            doc.line(midLine, currentY, pageWidth - margin, currentY);
          }

          doc.setFont("helvetica", "bold");
          doc.text(item.label + ":", rightColX + 2, currentY + 4);
          doc.setFont("helvetica", "normal");

          let rowHeight = itemHeight;

          if (item.label.toLowerCase() === "carrier") {
            const valueText = doc.splitTextToSize(
              String(item.value),
              rightColWidth - 45
            );
            const limitedLines = valueText.slice(0, 3);

            limitedLines.forEach((line: any, i: any) => {
              doc.text(line, rightColX + 40, currentY + 4 + i * 4);
            });
            rowHeight = limitedLines.length * 4 + 2;
          } else {
            doc.text(String(item.value), rightColX + 40, currentY + 4);
          }

          currentY += rowHeight;
        });

        yPos = serviceSectionStartY + serviceSectionHeight + 5;

        // === CARGO DETAILS (GOODS) SECTION ===
        // Check if table fits on current page
        const goodsTableHeight = 35; // Estimated
        if (yPos + goodsTableHeight > pageHeight - 20) {
          doc.addPage();
          yPos = 10;
        }

        // GOODS header with black background - CENTER ALIGNED
        doc.setFillColor(0, 0, 0);
        doc.rect(margin, yPos, pageWidth - 2 * margin, 5, "F");

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text("CARGO DETAILS", pageWidth / 2, yPos + 3.5, {
          align: "center",
        });
        doc.setTextColor(0, 0, 0);
        yPos += 5;

        // Cargo details table - conditional based on service type
        if (quotation.cargo_details && quotation.cargo_details.length > 0) {
          const serviceType = quotation.service_type?.toUpperCase() || "";
          let cargoHeaders: string[] = [];

          // Determine headers based on service type
          if (serviceType === "FCL") {
            cargoHeaders = [
              "Container Type",
              "No. of Containers",
              "Gross Weight (KG)",
            ];
          } else if (serviceType === "LCL") {
            cargoHeaders = [
              "No. of Packages",
              "Gross Weight (KG)",
              "Volume (CBM)",
              "Chargeable Volume (CBM)",
            ];
          } else if (serviceType === "AIR") {
            cargoHeaders = [
              "No. of Packages",
              "Gross Weight (KG)",
              "Volume Weight (KG)",
              "Chargeable Weight (KG)",
            ];
          }

          // Dynamically calculate column count based on actual headers
          const colCount = cargoHeaders.length;
          const colWidth = (pageWidth - 2 * margin) / colCount;

          // Table header
          doc.setFillColor(220, 220, 220);
          doc.rect(margin, yPos, pageWidth - 2 * margin, 6, "F");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7);

          cargoHeaders.forEach((header, index) => {
            doc.text(header, margin + 2 + index * colWidth, yPos + 4);
          });
          yPos += 6;

          // Table rows
          doc.setFont("helvetica", "normal");
          doc.setDrawColor(200, 200, 200);

          let totalValue1 = 0;
          let totalGrossWeight = 0;
          let totalValue2 = 0;
          let totalValue3 = 0;

          quotation.cargo_details.forEach((cargo: any) => {
            let values: string[] = [];

            if (serviceType === "FCL") {
              totalValue1 += Number(cargo.no_of_containers || 0);
              totalGrossWeight += Number(cargo.gross_weight || 0);

              values = [
                String(cargo.container_type || "N/A"),
                String(cargo.no_of_containers || "0"),
                String(cargo.gross_weight || "0"),
              ];
            } else if (serviceType === "LCL") {
              totalValue1 += Number(cargo.no_of_packages || 0);
              totalGrossWeight += Number(cargo.gross_weight || 0);
              totalValue2 += Number(cargo.volume || 0);
              totalValue3 += Number(cargo.chargeable_volume || 0);

              values = [
                String(cargo.no_of_packages || "0"),
                String(cargo.gross_weight || "0"),
                String(cargo.volume || "0"),
                String(cargo.chargeable_volume || "0"),
              ];
            } else if (serviceType === "AIR") {
              totalValue1 += Number(cargo.no_of_packages || 0);
              totalGrossWeight += Number(cargo.gross_weight || 0);
              totalValue2 += Number(cargo.volume_weight || 0);
              totalValue3 += Number(cargo.chargeable_weight || 0);

              values = [
                String(cargo.no_of_packages || "0"),
                String(cargo.gross_weight || "0"),
                String(cargo.volume_weight || "0"),
                String(cargo.chargeable_weight || "0"),
              ];
            }

            // Draw row border
            doc.rect(margin, yPos, pageWidth - 2 * margin, 5);

            values.forEach((value, index) => {
              doc.text(value, margin + 2 + index * colWidth, yPos + 3.5);
            });
            yPos += 5;
          });

          // Total row with conditional labels - only show for FCL
          if (serviceType === "FCL") {
            doc.setFont("helvetica", "bold");
            doc.setFillColor(230, 230, 230);
            doc.rect(margin, yPos, pageWidth - 2 * margin, 5, "F");

            // Initialize total values array with empty strings matching column count
            let totalValues: string[] = new Array(colCount).fill("");

            // Column 0: Container Type (empty)
            // Column 1: No. of Containers (Total)
            // Column 2: Gross Weight (Total)
            totalValues[1] = `Total Containers: ${totalValue1}`;
            totalValues[2] = `Total Gross Weight: ${totalGrossWeight}`;

            totalValues.forEach((value, index) => {
              if (value) {
                doc.text(value, margin + 2 + index * colWidth, yPos + 3.5);
              }
            });
            yPos += 5;
          }

          // Dimension details if available
          if (
            quotation.dimension_details &&
            quotation.dimension_details.length > 0
          ) {
            yPos += 3;

            // Get dimension unit from first item
            const dimensionUnit =
              quotation.dimension_details[0]?.dimension_unit || "CM";

            // Dimension header with unit
            doc.setFillColor(220, 220, 220);
            doc.rect(margin, yPos, pageWidth - 2 * margin, 6, "F");
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.text(`Dimension (${dimensionUnit})`, margin + 2, yPos + 4);
            yPos += 6;

            // Sub-columns
            const dimHeaders = ["Pieces", "Length", "Width", "Height"];
            const dimColWidth = (pageWidth - 2 * margin) / 4;

            doc.setFillColor(240, 240, 240);
            doc.rect(margin, yPos, pageWidth - 2 * margin, 5, "F");
            doc.setFontSize(7);

            dimHeaders.forEach((header, index) => {
              doc.text(header, margin + 2 + index * dimColWidth, yPos + 3.5);
            });
            yPos += 5;

            doc.setFont("helvetica", "normal");
            quotation.dimension_details.forEach((dim: any) => {
              const dimValues = [
                String(dim.pieces || "0"),
                String(dim.length || "0"),
                String(dim.width || "0"),
                String(dim.height || "0"),
              ];

              doc.rect(margin, yPos, pageWidth - 2 * margin, 5);

              dimValues.forEach((value, index) => {
                doc.text(value, margin + 2 + index * dimColWidth, yPos + 3.5);
              });
              yPos += 5;
            });
          }
        }
        yPos += 5;

        // === CHARGES (SALE) SECTION ===
        // Check if table fits on current page
        const saleTableHeight = 40; // Estimated
        if (yPos + saleTableHeight > pageHeight - 20) {
          doc.addPage();
          yPos = 10;
        }

        // SALE header with black background - CENTER ALIGNED
        doc.setFillColor(0, 0, 0);
        doc.rect(margin, yPos, pageWidth - 2 * margin, 5, "F");

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text("CHARGES", pageWidth / 2, yPos + 3.5, { align: "center" });
        doc.setTextColor(0, 0, 0);
        yPos += 5;

        if (quotation.charges && quotation.charges.length > 0) {
          // Filter charges with valid sell_per_unit
          const validCharges = quotation.charges.filter((charge: any) => {
            const sellPerUnit = charge?.sell_per_unit;
            if (
              sellPerUnit === null ||
              sellPerUnit === undefined ||
              sellPerUnit === ""
            )
              return false;
            const sellPerUnitNum = Number(sellPerUnit);
            return !isNaN(sellPerUnitNum) && sellPerUnitNum !== 0;
          });

          if (validCharges.length > 0) {
            // Get quote currency from quotation object (common for all charges)
            const quoteCurrency = quotation.quote_currency || "N/A";

            // Check if all min amounts are 0
            const allMinAmountsZero = validCharges.every((charge: any) => {
              const minSell = charge?.min_sell;
              return (
                minSell === null ||
                minSell === undefined ||
                minSell === "" ||
                Number(minSell) === 0
              );
            });

            // Conditionally include Min. Amount column based on whether all are zero
            // Column header shows "Total Amount In {quote_currency}"
            const chargeHeaders = allMinAmountsZero
              ? [
                  "Description",
                  "Currency",
                  "Amount/Unit",
                  `Total Amount In ${quoteCurrency}`,
                ]
              : [
                  "Description",
                  "Currency",
                  "Amount/Unit",
                  "Min. Amount",
                  `Total Amount In ${quoteCurrency}`,
                ];

            const chargeColWidths = allMinAmountsZero
              ? [70, 25, 38, 38] // 4 columns - redistribute widths
              : [65, 25, 35, 25, 30]; // 5 columns - original widths

            // Table header
            doc.setFillColor(220, 220, 220);
            doc.rect(margin, yPos, pageWidth - 2 * margin, 6, "F");
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);

            let headerX = margin + 2;
            chargeHeaders.forEach((header, index) => {
              doc.text(header, headerX, yPos + 4);
              headerX += chargeColWidths[index];
            });
            yPos += 6;

            // Table rows
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);

            // Find ROE based on quoteCurrency
            let roeForQuote = null;

            for (const charge of validCharges) {
              if (
                charge.currency &&
                charge.currency.toUpperCase() === quoteCurrency.toUpperCase()
              ) {
                roeForQuote = Number(charge.roe);
                break;
              }
            }

            // If not found, default = 1
            if (!roeForQuote) roeForQuote = 1;

            let totalAmount = 0;

            validCharges.forEach((charge: any) => {
              const description = String(charge.charge_name || "N/A");
              const currency = String(charge.currency || "N/A");
              const unit = `${String(charge.sell_per_unit || "N/A")} Per ${String(charge.unit || "N/A")}`;
              const amount = Number(charge.total_sell || 0); // Amount column shows total_sell
              const minAmount = String(charge.min_sell || "N/A");
              totalAmount += amount; // Calculate total from Amount column
              let finalAmount = amount;

              // Convert only if currencies differ
              if (userCurrency !== quoteCurrency) {
                finalAmount = amount / roeForQuote;
              }

              // Handle text wrapping for description
              const descLines = doc.splitTextToSize(
                description,
                chargeColWidths[0] - 4
              );
              const rowHeight = Math.max(5, descLines.length * 4);

              // Draw row border
              doc.setDrawColor(200, 200, 200);
              doc.rect(margin, yPos, pageWidth - 2 * margin, rowHeight);

              // Draw cells: Description, Currency, Unit, (Min. Amount if not all zero), Total Amount
              doc.text(descLines, margin + 2, yPos + 3.5);
              doc.text(currency, margin + 2 + chargeColWidths[0], yPos + 3.5);
              doc.text(
                unit,
                margin + 2 + chargeColWidths[0] + chargeColWidths[1],
                yPos + 3.5
              );

              // Calculate X position for Total Amount column (last column)
              const totalAmountColIndex = allMinAmountsZero ? 3 : 4;
              let totalAmountX = margin + 2;
              for (let i = 0; i < totalAmountColIndex; i++) {
                totalAmountX += chargeColWidths[i];
              }

              // Only render Min. Amount if not all are zero
              if (!allMinAmountsZero) {
                doc.text(
                  minAmount,
                  margin +
                    2 +
                    chargeColWidths[0] +
                    chargeColWidths[1] +
                    chargeColWidths[2],
                  yPos + 3.5
                );
              }

              // Render Total Amount in the last column (without currency - currency is in header)
              doc.text(finalAmount.toFixed(2), totalAmountX, yPos + 3.5);

              yPos += rowHeight;
            });

            // Total Amount row (without currency in the amount)
            doc.setFont("helvetica", "bold");
            doc.setFillColor(230, 230, 230);
            doc.rect(margin, yPos, pageWidth - 2 * margin, 6, "F");

            // Calculate X position for Total Amount column (last column) - same as data rows
            const totalAmountColIndex = allMinAmountsZero ? 3 : 4;
            let totalAmountX = margin + 2;
            for (let i = 0; i < totalAmountColIndex; i++) {
              totalAmountX += chargeColWidths[i];
            }
            let finalTotal = totalAmount;

            // Apply ROE only if currencies differ
            if (userCurrency !== quoteCurrency) {
              finalTotal = totalAmount / roeForQuote;
            }

            doc.text("Total Amount:", margin + 2, yPos + 4);
            doc.text(finalTotal.toFixed(2), totalAmountX, yPos + 4);
            yPos += 6;
          }
        }

        yPos += 5;

        // Service separator
        if (serviceIndex < rowData.quotation.length - 1) {
          doc.setDrawColor(100, 100, 100);
          doc.line(margin, yPos, pageWidth - margin, yPos);
          yPos += 8;
        }
      });
    }
    // ===== INSURANCE SECTION =====
    // INSURANCE header with black background - CENTER ALIGNED
    // doc.setFillColor(0, 0, 0);
    // doc.rect(margin, yPos, pageWidth - 2 * margin, 5, "F");

    // doc.setTextColor(255, 255, 255);
    // doc.setFontSize(9);
    // doc.setFont("helvetica", "bold");
    // doc.text("INSURANCE", pageWidth / 2, yPos + 3.5, { align: "center" });
    // doc.setTextColor(0, 0, 0);
    // yPos += 10;

    // doc.setFontSize(8);
    // doc.setFont("helvetica", "normal");
    // const insuranceText =
    //   "Maritime/Aviation insurance is not included. We advise you to subscribe. Please revert to us for assistance.";
    // const insuranceLines = doc.splitTextToSize(
    //   insuranceText,
    //   pageWidth - 2 * margin - 2
    // );
    // doc.text(insuranceLines, margin + 2, yPos);
    // yPos += insuranceLines.length * 4;

    // ===== INSTRUCTIONS SECTION =====
    if (yPos > pageHeight - 70) {
      doc.addPage();
      yPos = 10;
    }

    // yPos += 1;

    // Check if it's Pentagon company (excluding cargoConsolidators)
    const isPentagon = isPentagonCompany();

    // INSTRUCTIONS header with black background - CENTER ALIGNED
    doc.setFillColor(0, 0, 0);
    doc.rect(margin, yPos, pageWidth - 2 * margin, 5, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    // Change header to "Terms & Conditions" for Pentagon companies (excluding cargoConsolidators)
    const headerText = isPentagon ? "TERMS & CONDITIONS" : "NOTES";
    doc.text(headerText, pageWidth / 2, yPos + 3.5, { align: "center" });
    doc.setTextColor(0, 0, 0);
    yPos += 10;

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");

    // Extract notes from quotation data - use first quotation that has notes
    let notesFromData: string[] = [];
    if (
      rowData.quotation &&
      Array.isArray(rowData.quotation) &&
      rowData.quotation.length > 0
    ) {
      const quotationWithNotes = rowData.quotation.find(
        (q: any) => q.notes && Array.isArray(q.notes) && q.notes.length > 0
      );
      if (quotationWithNotes && quotationWithNotes.notes) {
        notesFromData = quotationWithNotes.notes;
      }
    }

    // Use notes from API if available, otherwise use default hardcoded values
    const defaultInstructions = [
      "Rates are valid until further notice.",
      "Subject to Locals at Both ends.",
      "Subject to Space availability.",
      "Rates are subject to change with/without prior notice of carriers and availability of space.",
      "Surcharge are subject to change and are applicable at the time of shipment.",
    ];

    const exchangeRates = getExchangeRates(rowData);
    const instructions =
      notesFromData.length > 0
        ? notesFromData.map(
            (note, index) => `${index + (exchangeRates ? 2 : 1)}. ${note}`
          )
        : defaultInstructions.map(
            (note, index) => `${index + (exchangeRates ? 2 : 1)}. ${note}`
          );

    if (exchangeRates) {
      instructions.unshift(`1. Exchange rates -> ${exchangeRates}`);
    }

    instructions.forEach((instruction) => {
      const lines = doc.splitTextToSize(
        instruction,
        pageWidth - 2 * margin - 2
      );
      doc.text(lines, margin + 2, yPos);
      yPos += lines.length * 4;
    });

    yPos += 3;

    // ===== CONDITIONS SECTION =====
    // Hide Terms & Conditions section for Pentagon companies (excluding cargoConsolidators)
    if (!isPentagon) {
      // CONDITIONS header with black background - CENTER ALIGNED
      doc.setFillColor(0, 0, 0);
      doc.rect(margin, yPos, pageWidth - 2 * margin, 5, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("TERMS & CONDITIONS", pageWidth / 2, yPos + 3.5, {
        align: "center",
      });
      doc.setTextColor(0, 0, 0);
      yPos += 10;

      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");

      // Extract conditions from quotation data - use first quotation that has conditions
      let conditionsFromData: string[] = [];
      if (
        rowData.quotation &&
        Array.isArray(rowData.quotation) &&
        rowData.quotation.length > 0
      ) {
        const quotationWithConditions = rowData.quotation.find(
          (q: any) =>
            q.conditions &&
            Array.isArray(q.conditions) &&
            q.conditions.length > 0
        );
        if (quotationWithConditions && quotationWithConditions.conditions) {
          conditionsFromData = quotationWithConditions.conditions;
        }
      }

      // Use conditions from API if available, otherwise use default hardcoded values
      const defaultConditions = [
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

      const conditions =
        conditionsFromData.length > 0
          ? conditionsFromData.map((condition) => {
              // Add "- " prefix if not already present
              return condition.trim().startsWith("-")
                ? condition.trim()
                : `- ${condition.trim()}`;
            })
          : defaultConditions;

      // Full width for conditions text
      const conditionsStartY = yPos;
      const fullWidth = pageWidth - 2 * margin - 4;
      let firstPageConditionsEndY = yPos; // Track end of conditions on first page
      let hasPageBreak = false;

      // Draw all conditions in full width, one by one with page break handling
      conditions.forEach((condition) => {
        if (condition === "") {
          yPos += 3;
          if (!hasPageBreak) firstPageConditionsEndY = yPos;
          return;
        }

        const lines = doc.splitTextToSize(condition, fullWidth);
        const requiredHeight = lines.length * 3.5;

        // Check if we need a new page
        if (yPos + requiredHeight > pageHeight - 10) {
          if (!hasPageBreak) {
            firstPageConditionsEndY = yPos; // Mark where first page ends
            hasPageBreak = true;
          }
          doc.addPage();
          yPos = 10; // No "Continued" header, just continue content
        }

        doc.text(lines, margin + 2, yPos);
        yPos += requiredHeight;

        // Update first page end position if still on first page
        if (!hasPageBreak) {
          firstPageConditionsEndY = yPos;
        }
      });

      // Calculate attention box position based on FIRST PAGE conditions only
      const firstPageConditionsHeight =
        firstPageConditionsEndY - conditionsStartY;

      // ===== ATTENTION BOX (Right-aligned overlay, vertically centered on first page) =====
      const boxWidth = 50;
      const boxHeight = 20;
      const boxX = pageWidth - margin - boxWidth - 2; // Right-aligned

      // Calculate vertical center, but ensure it doesn't go beyond first page
      let boxY = conditionsStartY + (firstPageConditionsHeight - boxHeight) / 2;

      // If box would extend beyond available space on first page, adjust position
      const maxBoxY = Math.min(
        pageHeight - 15,
        firstPageConditionsEndY - boxHeight - 5
      );
      if (boxY + boxHeight > maxBoxY) {
        boxY = Math.max(conditionsStartY + 5, maxBoxY - boxHeight);
      }

      // Save current page to draw attention box on correct page
      const currentPage = doc.getCurrentPageInfo().pageNumber;
      const attentionBoxPage = hasPageBreak ? currentPage - 1 : currentPage; // Draw on first page of conditions

      // Switch to the correct page to draw the attention box
      if (hasPageBreak) {
        doc.setPage(attentionBoxPage);
      }

      // Draw box with shadow effect
      // Shadow
      doc.setFillColor(220, 220, 220);
      doc.rect(boxX + 1, boxY + 1, boxWidth, boxHeight, "F");
      // Main box
      doc.setFillColor(255, 255, 255);
      doc.setLineWidth(0.3); // Normal border
      doc.setDrawColor(0, 0, 0);
      doc.rect(boxX, boxY, boxWidth, boxHeight, "FD");

      // Attention text (red color, center-aligned)
      doc.setTextColor(255, 0, 0);
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");

      const attentionText = [
        "Attention new safety standards",
        "regarding the transport of drums",
        "in air of 5L and above,",
        "please ensure that you comply",
        "with the shipping conditions. *",
      ];

      let attentionY = boxY + 3.5;
      attentionText.forEach((line) => {
        const textWidth = doc.getTextWidth(line);
        const textX = boxX + (boxWidth - textWidth) / 2; // Center text horizontally
        doc.text(line, textX, attentionY);
        attentionY += 3;
      });

      doc.setTextColor(0, 0, 0);

      // Switch back to current page if we changed pages
      if (hasPageBreak) {
        doc.setPage(currentPage);
      }

      yPos += 5;
    } // End of TERMS & CONDITIONS section (only for non-Pentagon companies)

    // ===== APPROVAL FOOTER =====
    yPos += 10;
    if (yPos > pageHeight - 25) {
      doc.addPage();
      yPos = 10;
    }

    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 5;

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("For Approval:", margin + 2, yPos);
    yPos += 5;

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 255);
    doc.textWithLink(
      "Click here to approve or reject this quotation",
      margin + 2,
      yPos,
      {
        url: approvalUrl,
      }
    );
    doc.setTextColor(0, 0, 0);

    // NO FOOTER WITH REF (Issue #1 - removed)

    // Create blob for preview
    const createdPdfBlob = doc.output("blob");
    const blobUrl = window.URL.createObjectURL(createdPdfBlob);
    return blobUrl;
  } catch (error) {
    console.error("Error generating PDF:", error);
    throw error;
  }
};
