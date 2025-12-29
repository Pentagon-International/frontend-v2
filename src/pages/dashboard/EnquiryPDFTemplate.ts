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
    };
  } else if (
    normalizedCompanyName === "CARGOCONSOLIDATORSINDIA" &&
    countryCode === "IN" &&
    branchNameUpper.includes("BANGALORE")
  ) {
    return {
      name: "Cargo Consolidators India Pvt Ltd",
      address:
        "624/1&2, 4th Floor, Door 14, 5th Main Road, Bhuvanagiri, B. Channasandra Main Road, OMBR Layout, Bangalore 560043",
    };
  } else if (
    normalizedCompanyName === "CARGOCONSOLIDATORSINDIA" &&
    countryCode === "IN"
  ) {
    return {
      name: "Cargo Consolidators India Pvt Ltd",
      address: "",
    };
  } else if (branchNameUpper.includes("CHENNAI")) {
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

  return {
    name: "",
    address: "",
  };
};

export const generateEnquiryPDF = (
  rowData: any,
  defaultBranch: any,
  country?: any
): string => {
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    let yPos = 10;

    const branchName = defaultBranch?.branch_name || "CHENNAI";
    const branchInfo = getBranchInfo(branchName, country);
    const logoImage = getLogoByCountry(country);

    // Set document properties
    doc.setProperties({
      title: `Enquiry - ${rowData.enquiry_id}`,
      subject: "Freight Enquiry",
      author: branchInfo.name,
    });

    doc.setLineWidth(0.3);
    doc.setDrawColor(0, 0, 0);

    // ===== HEADER SECTION =====
    const midLine = pageWidth / 2;
    const leftHalfWidth = midLine - margin - 3;
    const rightHalfWidth = pageWidth / 2 - margin - 3;
    const rightHalfStart = midLine + 3;
    const headerStartY = yPos;

    // ===== PRE-CALCULATE HEIGHTS FOR DYNAMIC HEADER =====
    const logoMaxWidth = rightHalfWidth * 0.8;
    const logoMaxHeight = 12;

    let logoWidth = logoMaxWidth;
    let logoHeight = logoMaxHeight;

    const defaultAspectRatio = 2.5;
    const calculatedHeight = logoWidth / defaultAspectRatio;
    if (calculatedHeight > logoMaxHeight) {
      logoHeight = logoMaxHeight;
      logoWidth = logoHeight * defaultAspectRatio + 20;
    } else {
      logoHeight = calculatedHeight;
    }

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

    const rightSideContentHeight =
      5 +
      logoHeight +
      3 +
      companyNameLinesCalc.length * 4 +
      3 +
      companyAddressLinesCalc.length * 4 +
      3;

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");

    const addressText = Array.isArray(rowData.customer_address)
      ? rowData.customer_address.filter((addr: any) => addr && String(addr).trim() !== "").join(", ")
      : rowData.customer_address;

    const customerAddressLinesCalc = doc.splitTextToSize(
      addressText || "N/A",
      leftHalfWidth - 6
    );

    const leftSideContentHeight =
      18 +
      4 +
      4 +
      customerAddressLinesCalc.length * 4 +
      3;

    const headerSectionHeight = Math.max(
      rightSideContentHeight,
      leftSideContentHeight,
      35
    );

    // Draw outer border for header
    doc.rect(margin, headerStartY, pageWidth - 2 * margin, headerSectionHeight);

    // Draw vertical center line
    doc.line(
      midLine,
      headerStartY,
      midLine,
      headerStartY + headerSectionHeight
    );

    // Draw horizontal divider
    doc.line(margin, headerStartY + 15, midLine, headerStartY + 15);

    // Row 1: ENQUIRY title
    let leftYPos = headerStartY + 5;
    let rightYPos = headerStartY + 5;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("ENQUIRY", margin + 38, leftYPos);
    leftYPos += 5;

    // Reference
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Reference: ${rowData.enquiry_id}`, margin + 3, leftYPos + 3);
    leftYPos += 4;

    // Right half - Logo, company name, address
    try {
      if (logoImage) {
        const logoX = rightHalfStart + (rightHalfWidth - logoWidth) / 2;
        const logoY = rightYPos;
        doc.addImage(logoImage, "PNG", logoX, logoY, logoWidth, logoHeight);
        rightYPos += logoHeight + 3;
      }
    } catch (error) {
      console.error("Error adding logo image:", error);
    }

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    companyNameLinesCalc.forEach((line: string) => {
      const companyNameX =
        rightHalfStart + (rightHalfWidth - doc.getTextWidth(line)) / 2;
      doc.text(line, companyNameX, rightYPos + 3);
      rightYPos += 4;
    });

    rightYPos += 3;

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    companyAddressLinesCalc.forEach((line: string) => {
      const addressX =
        rightHalfStart + (rightHalfWidth - doc.getTextWidth(line)) / 2;
      doc.text(line, addressX, rightYPos + 3);
      rightYPos += 4;
    });

    // Row 2: Customer info
    leftYPos = headerStartY + 18;

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("CUSTOMER:", margin + 3, leftYPos);
    leftYPos += 4;

    doc.setFont("helvetica", "normal");
    doc.text(rowData.customer_name || "N/A", margin + 3, leftYPos);
    leftYPos += 4;

    if (rowData.customer_address && customerAddressLinesCalc.length > 0) {
      customerAddressLinesCalc.forEach((line: string) => {
        doc.text(line, margin + 3, leftYPos);
        leftYPos += 4;
      });
    }

    yPos = headerStartY + headerSectionHeight + 6;

    // ===== ENQUIRY DETAILS SECTION =====
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("ENQUIRY DETAILS", margin, yPos, );
    yPos += 6;

    // Details box
    const detailsStartY = yPos;
    const leftColX = margin;
    const rightColX = midLine;
    const itemHeight = 6;

    const details = [
      { label: "Enquiry ID", value: rowData.enquiry_id || "N/A", column: "left" },
      { label: "Sales Person", value: rowData.sales_person || "N/A", column: "left" },
      {
        label: "Enquiry Date",
        value: formatDate(rowData.enquiry_received_date),
        column: "left",
      },
      {
        label: "Status",
        value: rowData.status || "ACTIVE",
        column: "left",
      },
      {
        label: "Sales Coordinator",
        value: rowData.sales_coordinator || "N/A",
        column: "right",
      },
      {
        label: "Customer Services",
        value: rowData.customer_services || "N/A",
        column: "right",
      },
      { label: "Reference No", value: rowData.reference_no || "N/A", column: "right" },
    ];

    const leftItems = details.filter((d) => d.column === "left");
    const rightItems = details.filter((d) => d.column === "right");

    const detailsHeight = Math.max(
      leftItems.length * itemHeight,
      rightItems.length * itemHeight
    );

    // Draw border
    doc.rect(leftColX, detailsStartY, pageWidth - 2 * margin, detailsHeight);

    // Draw vertical center line
    doc.line(midLine, detailsStartY, midLine, detailsStartY + detailsHeight);

    // Draw left column
    let currentY = detailsStartY;
    doc.setFontSize(8);
    leftItems.forEach((item, index) => {
      if (index > 0) {
        doc.line(leftColX, currentY, midLine - 2, currentY);
      }
      doc.setFont("helvetica", "bold");
      doc.text(item.label + ":", leftColX + 2, currentY + 4);
      doc.setFont("helvetica", "normal");
      doc.text(String(item.value || "N/A"), leftColX + 40, currentY + 4);
      currentY += itemHeight;
    });

    // Draw right column
    currentY = detailsStartY;
    rightItems.forEach((item, index) => {
      if (index > 0) {
        doc.line(midLine, currentY, pageWidth - margin, currentY);
      }
      doc.setFont("helvetica", "bold");
      doc.text(item.label + ":", rightColX + 2, currentY + 4);
      doc.setFont("helvetica", "normal");
      doc.text(String(item.value || "N/A"), rightColX + 40, currentY + 4);
      currentY += itemHeight;
    });

    yPos = detailsStartY + detailsHeight + 8;

    // ===== SERVICES SECTION =====
    if (rowData.services && Array.isArray(rowData.services) && rowData.services.length > 0) {
      rowData.services.forEach((service: any, serviceIndex: number) => {
        // Check if we need a new page
        if (yPos > pageHeight - 60) {
          doc.addPage();
          yPos = 10;
        }

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(`Service ${serviceIndex + 1}`, margin, yPos);
        yPos += 6;

        const serviceSectionStartY = yPos;

        const serviceDetailsRaw = [
          { label: "Service Type", value: service.service, column: "left" },
          { label: "Trade", value: service.trade, column: "left" },
          {
            label: "Origin",
            value: service.origin_name
              ? `${service.origin_name} (${service.origin_code_read || service.origin_code || ""})`
              : null,
            column: "left",
          },
          {
            label: "Destination",
            value: service.destination_name
              ? `${service.destination_name} (${service.destination_code_read || service.destination_code || ""})`
              : null,
            column: "left",
          },
          {
            label: "Shipment Terms",
            value: service.shipment_terms_name
              ? `${service.shipment_terms_name} (${service.shipment_terms_code_read || service.shipment_terms_code || ""})`
              : null,
            column: "right",
          },
          {
            label: "Pickup",
            value: service.pickup ? "Yes" : "No",
            column: "right",
          },
        ];

        // Conditionally add Pickup Location if pickup is true and location exists
        if (service.pickup && service.pickup_location && String(service.pickup_location).trim() !== "") {
          serviceDetailsRaw.push({
            label: "Pickup Location",
            value: service.pickup_location,
            column: "right",
          });
        }

        serviceDetailsRaw.push({
          label: "Delivery",
          value: service.delivery ? "Yes" : "No",
          column: "right",
        });

        // Conditionally add Delivery Location if delivery is true and location exists
        if (service.delivery && service.delivery_location && String(service.delivery_location).trim() !== "") {
          serviceDetailsRaw.push({
            label: "Delivery Location",
            value: service.delivery_location,
            column: "right",
          });
        }

        serviceDetailsRaw.push(
          {
            label: "Hazardous Cargo",
            value: service.hazardous_cargo ? "Yes" : "No",
            column: "right",
          },
          {
            label: "Stackable",
            value: service.stackable ? "Yes" : "No",
            column: "right",
          }
        );

        const serviceLeftItems = serviceDetailsRaw.filter(
          (item) => item.column === "left" && item.value && String(item.value).trim() !== ""
        );
        const serviceRightItems = serviceDetailsRaw.filter(
          (item) => item.column === "right" && item.value !== null && item.value !== undefined
        );

        const serviceSectionHeight = Math.max(
          serviceLeftItems.length * itemHeight,
          serviceRightItems.length * itemHeight
        );

        // Draw border
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

        // Draw left column
        currentY = serviceSectionStartY;
        doc.setFontSize(8);
        serviceLeftItems.forEach((item, index) => {
          if (index > 0) {
            doc.line(leftColX, currentY, midLine - 2, currentY);
          }
          doc.setFont("helvetica", "bold");
          doc.text(item.label + ":", leftColX + 2, currentY + 4);
          doc.setFont("helvetica", "normal");
          doc.text(String(item.value || "N/A"), leftColX + 40, currentY + 4);
          currentY += itemHeight;
        });

        // Draw right column
        currentY = serviceSectionStartY;
        serviceRightItems.forEach((item, index) => {
          if (index > 0) {
            doc.line(midLine, currentY, pageWidth - margin, currentY);
          }
          doc.setFont("helvetica", "bold");
          doc.text(item.label + ":", rightColX + 2, currentY + 4);
          doc.setFont("helvetica", "normal");
          doc.text(String(item.value || "N/A"), rightColX + 40, currentY + 4);
          currentY += itemHeight;
        });

        yPos = serviceSectionStartY + serviceSectionHeight + 5;

        // Service Remark if available
        if (service.service_remark && String(service.service_remark).trim() !== "") {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.text("Remark:", margin + 2, yPos);
          doc.setFont("helvetica", "normal");
          const remarkLines = doc.splitTextToSize(
            String(service.service_remark),
            pageWidth - 2 * margin - 20
          );
          doc.text(remarkLines, margin + 20, yPos);
          yPos += remarkLines.length * 4 + 3;
        }

        // ===== CARGO DETAILS SECTION =====
        if (service.no_of_packages || service.gross_weight || service.volume || service.volume_weight || service.chargeable_weight || service.chargeable_volume) {
          // Check if table fits on current page
          if (yPos + 30 > pageHeight - 20) {
            doc.addPage();
            yPos = 10;
          }

          // CARGO DETAILS header
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

          const serviceType = service.service?.toUpperCase() || "";
          let cargoHeaders: string[] = [];

          if (serviceType === "FCL") {
            cargoHeaders = ["No. of Containers", "Gross Weight (KG)"];
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
          } else {
            // Default for unknown service types
            cargoHeaders = ["No. of Packages", "Gross Weight (KG)", "Volume (CBM)"];
          }

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

          // Table row
          doc.setFont("helvetica", "normal");
          doc.setDrawColor(200, 200, 200);

          let values: string[] = [];
          if (serviceType === "FCL") {
            values = [
              String(service.no_of_packages || service.no_of_containers || "0"),
              String(service.gross_weight || "0"),
            ];
          } else if (serviceType === "LCL") {
            values = [
              String(service.no_of_packages || "0"),
              String(service.gross_weight || "0"),
              String(service.volume || "0"),
              String(service.chargeable_volume || "0"),
            ];
          } else if (serviceType === "AIR") {
            values = [
              String(service.no_of_packages || "0"),
              String(service.gross_weight || "0"),
              String(service.volume_weight || "0"),
              String(service.chargeable_weight || "0"),
            ];
          } else {
            values = [
              String(service.no_of_packages || "0"),
              String(service.gross_weight || "0"),
              String(service.volume || "0"),
            ];
          }

          doc.rect(margin, yPos, pageWidth - 2 * margin, 5);

          values.forEach((value, index) => {
            doc.text(value, margin + 2 + index * colWidth, yPos + 3.5);
          });
          yPos += 5;
        }

        yPos += 8;

        // Service separator
        if (serviceIndex < rowData.services.length - 1) {
          doc.setDrawColor(100, 100, 100);
          doc.line(margin, yPos, pageWidth - margin, yPos);
          yPos += 8;
        }
      });
    }

    // ===== FOOTER =====
    yPos += 10;
    if (yPos > pageHeight - 15) {
      doc.addPage();
      yPos = 10;
    }

    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 5;

    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.text(
      // "This is an enquiry document. No quotation has been provided yet.",
      "",
      margin + 2,
      yPos
    );

    // Create blob for preview
    const createdPdfBlob = doc.output("blob");
    const blobUrl = window.URL.createObjectURL(createdPdfBlob);
    return blobUrl;
  } catch (error) {
    console.error("Error generating Enquiry PDF:", error);
    throw error;
  }
};
