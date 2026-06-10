import { jsPDF } from "jspdf";
import pentagonPrimeAmericas from "../../../assets/images/PentagonPrimeUSA.png";

const US_LICENSE_NO = "";
const US_FMC_NO = "FMC 034982N";
const US_DBA_NAME = "Pentagon Prime Americas Inc";
const TOP_TABLE_ROW_HEIGHT = 30;
const TABLE_SEPARATION_GAP = 4;
const RIGHT_ROW3_VESSEL_HEIGHT = 10;
const RIGHT_ROW3_PORT_HEIGHT = 10;

const formatUsDate = (dateString: unknown): string => {
  if (!dateString) return "";
  try {
    const date = new Date(dateString as string);
    if (isNaN(date.getTime())) return "";
    const day = String(date.getDate()).padStart(2, "0");
    const monthNames = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    const month = monthNames[date.getMonth()];
    const year = String(date.getFullYear());
    return `${day}-${month}-${year}`;
  } catch {
    return "";
  }
};

const getActiveBranchFromStore = () => {
  try {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user?.branches && Array.isArray(user.branches)) {
        return (
          user.branches.find(
            (branch: { is_default?: boolean }) => branch.is_default === true,
          ) ||
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

const drawBox = (
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  lineWidth = 0.3,
) => {
  doc.setLineWidth(lineWidth);
  doc.setDrawColor(0, 0, 0);
  doc.rect(x, y, width, height);
};

const numberToWords = (n: number): string => {
  const ones = [
    "", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE",
    "TEN", "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN", "SIXTEEN",
    "SEVENTEEN", "EIGHTEEN", "NINETEEN",
  ];
  const tens = [
    "", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY",
  ];
  if (n <= 0) return "ZERO";
  if (n < 20) return ones[n];
  if (n < 100) {
    const remainder = n % 10;
    return tens[Math.floor(n / 10)] + (remainder ? ` ${ones[remainder]}` : "");
  }
  return String(n);
};

const formatDecimal = (value: unknown, decimals = 4): string => {
  const num = parseFloat(String(value ?? ""));
  if (isNaN(num)) return "";
  return num.toFixed(decimals);
};

const sumCargoField = (
  cargoDetails: Array<Record<string, unknown>>,
  field: string,
): number => {
  return cargoDetails.reduce((sum, cargo) => {
    const val = parseFloat(String(cargo[field] ?? ""));
    return sum + (isNaN(val) ? 0 : val);
  }, 0);
};

const buildTextLines = (
  doc: jsPDF,
  parts: string[],
  maxWidth: number,
  fontSize = 7,
): string[] => {
  doc.setFontSize(fontSize);
  return parts
    .filter((p) => p && p.trim())
    .flatMap((part) => doc.splitTextToSize(part, maxWidth));
};

const drawFixedLabeledSection = (
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  title: string,
  contentLines: string[],
  padding = 3,
) => {
  const contentWidth = width - 2 * padding;
  const titleLineHeight = 3.5;
  const bodyLineHeight = 3.2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  const titleLines = doc.splitTextToSize(title, contentWidth);
  doc.text(titleLines, x + padding, y + padding + 3);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  const titleHeight = titleLines.length * titleLineHeight;
  const bodyStartY = y + padding + 3 + titleHeight;
  const maxBodyLines = Math.max(
    1,
    Math.floor((y + height - padding - bodyStartY) / bodyLineHeight),
  );
  const visibleLines = contentLines.slice(0, maxBodyLines);
  if (visibleLines.length > 0) {
    doc.text(visibleLines, x + padding, bodyStartY);
  }
};

const drawBoldLabelValue = (
  doc: jsPDF,
  label: string,
  value: string,
  centerX: number,
  y: number,
  fontSize = 7,
) => {
  doc.setFontSize(fontSize);
  doc.setFont("helvetica", "bold");
  const labelWidth = doc.getTextWidth(label);
  doc.setFont("helvetica", "normal");
  const valueWidth = doc.getTextWidth(` ${value}`);
  const startX = centerX - (labelWidth + valueWidth) / 2;
  doc.setFont("helvetica", "bold");
  doc.text(label, startX, y);
  doc.setFont("helvetica", "normal");
  doc.text(` ${value}`, startX + labelWidth, y);
};

export const generateUsBillOfLadingPDF = (
  jobData: any,
  housingData: any,
  defaultBranch: any,
): string => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 5;
  const boxPadding = 3;
  const innerMargin = margin;
  const innerWidth = pageWidth - 2 * innerMargin;

  const activeBranch = defaultBranch || getActiveBranchFromStore();
  const branchInfo = {
    name:
      activeBranch?.reporting_name ||
      activeBranch?.branch_title ||
      activeBranch?.branch_name ||
      US_DBA_NAME,
    address:
      activeBranch?.reporting_address || activeBranch?.address || "",
  };
  const logoImage = pentagonPrimeAmericas;

  const carrierDetails = jobData?.carrierDetails || {};
  const mblDetails = jobData?.mblDetails || {};

  const billOfLadingNo = housingData?.hbl_number || "";
  const exportReference =
    housingData?.shipment_reference_no ||
    housingData?.shipment_id ||
    housingData?.ref_no ||
    "";

  const shipperParts = [
    housingData?.shipper_name || "",
    housingData?.shipper_address || "",
    housingData?.shipper_tel ? `TEL: ${housingData.shipper_tel}` : "",
    housingData?.shipper_fax ? `FAX: ${housingData.shipper_fax}` : "",
    housingData?.shipper_email ? `EMAIL: ${housingData.shipper_email}` : "",
  ];

  const consigneeParts = [
    housingData?.consignee_name || "",
    housingData?.consignee_address || "",
    housingData?.consignee_email ? `EMAIL: ${housingData.consignee_email}` : "",
    housingData?.consignee_pan ? `ID: ${housingData.consignee_pan}` : "",
  ];

  const notifyName = housingData?.notify_customer1_name || "";
  const notifyAddress = housingData?.notify_customer1_address || "";
  const consigneeName = housingData?.consignee_name || "";
  const isSameAsConsignee =
    !notifyName ||
    (notifyName.toUpperCase() === consigneeName.toUpperCase() &&
      (!notifyAddress ||
        notifyAddress.toUpperCase() ===
          (housingData?.consignee_address || "").toUpperCase()));

  const notifyParts = isSameAsConsignee
    ? ["SAME AS CONSIGNEE"]
    : [notifyName, notifyAddress].filter(Boolean);

  const deliveryAgentParts = [
    housingData?.agent_name || "",
    housingData?.agent_address || "",
    housingData?.agent_gst_no ? `Tax ID: ${housingData.agent_gst_no}` : "",
    housingData?.agent_phone ? `TEL: ${housingData.agent_phone}` : "",
    housingData?.agent_email ? `EMAIL: ${housingData.agent_email}` : "",
  ];

  const houseOrigin = housingData?.origin_name || "";
  const masterOrigin = mblDetails?.origin_name || jobData?.origin_name || "";
  const masterDestination =
    mblDetails?.destination_name || jobData?.destination_name || "";
  const houseDestination = housingData?.destination_name || "";

  const placeOfReceipt =
    housingData?.place_of_acceptance || houseOrigin || "";
  const portOfLoading = masterOrigin || "";
  const portOfDischarge = masterDestination || "";
  const placeOfDelivery =
    housingData?.place_of_delivery || houseDestination || "";

  const vesselVoyNo =
    carrierDetails?.vessel_name && carrierDetails?.voyage_number
      ? `${carrierDetails.vessel_name}/${carrierDetails.voyage_number}`
      : carrierDetails?.vessel_name || carrierDetails?.voyage_number || "";

  const shippedOnBoardDate = formatUsDate(
    housingData?.on_board_date || carrierDetails?.mbl_date,
  );
  const dateOfIssue = formatUsDate(
    housingData?.date_of_issue || carrierDetails?.mbl_date,
  );
  const placeOfIssue = housingData?.place_of_issue || masterOrigin || "";

  const numberOfOriginalBl =
    housingData?.number_of_originals ??
    housingData?.no_of_originals ??
    "ZERO";

  const freightCharge = (housingData?.charges || []).find((charge: any) => {
    const name = (charge?.charge_name || "").toUpperCase();
    return name.includes("FREIGHT");
  });
  const paymentTerms =
    housingData?.freight_terms ||
    (freightCharge?.pp_cc === "PP"
      ? "FREIGHT PREPAID"
      : freightCharge?.pp_cc === "CC"
        ? "FREIGHT COLLECT"
        : "") ||
    "FREIGHT PREPAID";

  const cargoDetailsFromHousing = housingData?.cargo_details || [];
  const containerDetailsFromJob = jobData?.container_details || [];
  const containerDetails = cargoDetailsFromHousing.map((cargo: any) => {
    const matchingContainer = containerDetailsFromJob.find(
      (container: any) => container.container_no === cargo.container_no,
    );
    return {
      ...cargo,
      actual_seal_no:
        cargo.actual_seal_no || matchingContainer?.actual_seal_no || "",
      container_type_name:
        cargo.container_type_name ||
        matchingContainer?.container_type_details?.container_type_name ||
        "",
    };
  });

  let summary = housingData?.summary || {};
  if (!summary || Object.keys(summary).length === 0) {
    const housingDetailsArray = jobData?.housing_details || [];
    const housingId = housingData?.id;
    if (housingId) {
      const matchingHousing = housingDetailsArray.find(
        (house: any) =>
          house.id === housingId || house.id === Number(housingId),
      );
      summary = matchingHousing?.summary || {};
    }
  }

  const cargoSummary = housingData?.cargo_summary || {};
  const totalNoOfPackages =
    summary?.total_no_of_packages ||
    housingData?.total_packages ||
    cargoSummary?.total_packages ||
    (sumCargoField(cargoDetailsFromHousing, "no_of_packages") || "");

  const totalGrossWeight =
    summary?.total_gross_weight ||
    housingData?.total_gross_weight_kgs ||
    cargoSummary?.gross_weight_kgs ||
    sumCargoField(cargoDetailsFromHousing, "gross_weight") ||
    "";

  const totalVolume =
    summary?.total_volume ||
    housingData?.total_volume_cbm ||
    cargoSummary?.volume_cbm ||
    sumCargoField(cargoDetailsFromHousing, "volume") ||
    "";

  const packageType =
    housingData?.package_type ||
    (Array.isArray(summary?.container_type) && summary.container_type[0]) ||
    "PACKAGE(S)";
  const packagesText = totalNoOfPackages
    ? `${totalNoOfPackages} ${packageType}`
    : "";
  const grossWeightText = totalGrossWeight
    ? `${formatDecimal(totalGrossWeight)} KGS`
    : "";
  const volumeText = totalVolume
    ? `${formatDecimal(totalVolume)} CBM`
    : "";

  const marksNo = housingData?.marks_no || "";
  const commodityDesc = housingData?.commodity_description || "";
  const hsCode = housingData?.hs_code || housingData?.item_no || "";
  const descriptionParts = [
    commodityDesc,
    hsCode ? `NCM: ${hsCode}` : "",
  ].filter(Boolean);

  const shipmentTerms =
    housingData?.shipment_terms_code ||
    housingData?.shipment_terms_name ||
    "";
  const containerInfoLines = containerDetails
    .map((cargo: any) => {
      const parts = [
        cargo?.container_no,
        cargo?.actual_seal_no,
        cargo?.container_type_name,
      ].filter(Boolean);
      return parts.join("/");
    })
    .filter(Boolean);

  const packagesCount = parseInt(String(totalNoOfPackages), 10);
  const packagesInWords = !isNaN(packagesCount)
    ? `SAY ${numberToWords(packagesCount)} ${packageType} ONLY.`
    : packagesText
      ? `SAY ${packagesText} ONLY.`
      : "";

  doc.setProperties({
    title: `Bill Of Lading - ${billOfLadingNo}`,
    subject: "Bill Of Lading",
    author: branchInfo.name,
  });

  const logoY = margin + 2;

  if (logoImage) {
    try {
      doc.addImage(
        logoImage,
        "PNG",
        innerMargin + 2,
        logoY,
        42,
        16,
        undefined,
        "FAST",
      );
    } catch (error) {
      console.warn("Could not add logo to US B/L PDF:", error);
    }
  }

  const topTableStartY = logoY + 18;
  const topMetaY = topTableStartY - 4;

  // FMC No. and B/L No. just above the top table border; logo unchanged
  const headerCenterWidth = innerWidth * 0.36;
  const headerCenterX = innerMargin + (innerWidth - headerCenterWidth) / 2;
  const centerTextX = headerCenterX + headerCenterWidth / 2;

  doc.setFontSize(7);
  if (US_LICENSE_NO) {
    doc.setFont("helvetica", "bold");
    doc.text(`License No. ${US_LICENSE_NO}`, centerTextX, topMetaY - 4, {
      align: "center",
    });
    drawBoldLabelValue(
      doc,
      "FMC No.",
      US_FMC_NO,
      centerTextX,
      topMetaY,
    );
  } else {
    drawBoldLabelValue(doc, "FMC No.", US_FMC_NO, centerTextX, topMetaY);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(
    `B/L No. ${billOfLadingNo}`,
    innerMargin + innerWidth - 2,
    topMetaY,
    { align: "right" },
  );

  // ===== TABLE 1: TOP INFORMATION GRID =====
  const topTableHeight = TOP_TABLE_ROW_HEIGHT * 3;
  const colWidth = innerWidth / 2;
  const leftX = innerMargin;
  const rightX = innerMargin + colWidth;
  const sectionPad = boxPadding;
  const textWidth = colWidth - 2 * sectionPad;

  doc.setFontSize(7);
  const shipperLines = buildTextLines(doc, shipperParts, textWidth);
  const exportRefLines = buildTextLines(doc, [exportReference], textWidth);
  const consigneeLines = buildTextLines(doc, consigneeParts, textWidth);
  const deliveryAgentLines = buildTextLines(doc, deliveryAgentParts, textWidth);
  const notifyLines = buildTextLines(doc, notifyParts, textWidth);

  const row1Y = topTableStartY;
  const row2Y = topTableStartY + TOP_TABLE_ROW_HEIGHT;
  const row3Y = topTableStartY + TOP_TABLE_ROW_HEIGHT * 2;

  drawFixedLabeledSection(
    doc,
    leftX,
    row1Y,
    colWidth,
    TOP_TABLE_ROW_HEIGHT,
    "Shipper",
    shipperLines,
    sectionPad,
  );
  drawFixedLabeledSection(
    doc,
    rightX,
    row1Y,
    colWidth,
    TOP_TABLE_ROW_HEIGHT,
    "Export Reference",
    exportRefLines,
    sectionPad,
  );

  drawFixedLabeledSection(
    doc,
    leftX,
    row2Y,
    colWidth,
    TOP_TABLE_ROW_HEIGHT,
    "Consignee(if 'to Order' so indicate)",
    consigneeLines,
    sectionPad,
  );
  drawFixedLabeledSection(
    doc,
    rightX,
    row2Y,
    colWidth,
    TOP_TABLE_ROW_HEIGHT,
    "Delivery Agent",
    deliveryAgentLines,
    sectionPad,
  );

  drawFixedLabeledSection(
    doc,
    leftX,
    row3Y,
    colWidth,
    TOP_TABLE_ROW_HEIGHT,
    "Notify Party(No claim shall attach for failure to notify)",
    notifyLines,
    sectionPad,
  );

  const rightSubWidth = colWidth / 2;
  const vesselTopY = row3Y;
  const portsRow1Y = row3Y + RIGHT_ROW3_VESSEL_HEIGHT;
  const portsRow2Y = row3Y + RIGHT_ROW3_VESSEL_HEIGHT + RIGHT_ROW3_PORT_HEIGHT;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("Vessel and Voyage", rightX + sectionPad, vesselTopY + 4.5);
  doc.setFont("helvetica", "normal");
  doc.text(vesselVoyNo || "", rightX + sectionPad, vesselTopY + 8.5);

  doc.setFont("helvetica", "bold");
  doc.text("Place of Receipt", rightX + sectionPad, portsRow1Y + 3);
  doc.text(
    "Port of Loading",
    rightX + rightSubWidth + sectionPad,
    portsRow1Y + 3,
  );
  doc.setFont("helvetica", "normal");
  doc.text(placeOfReceipt || "", rightX + sectionPad, portsRow1Y + 7.5);
  doc.text(
    portOfLoading || "",
    rightX + rightSubWidth + sectionPad,
    portsRow1Y + 7.5,
  );

  doc.setFont("helvetica", "bold");
  doc.text("Port of Discharge", rightX + sectionPad, portsRow2Y + 3);
  doc.text(
    "Place of Delivery",
    rightX + rightSubWidth + sectionPad,
    portsRow2Y + 3,
  );
  doc.setFont("helvetica", "normal");
  doc.text(portOfDischarge || "", rightX + sectionPad, portsRow2Y + 7.5);
  doc.text(
    placeOfDelivery || "",
    rightX + rightSubWidth + sectionPad,
    portsRow2Y + 7.5,
  );

  drawBox(doc, innerMargin, topTableStartY, innerWidth, topTableHeight);
  doc.line(rightX, topTableStartY, rightX, topTableStartY + topTableHeight);
  doc.line(innerMargin, row2Y, innerMargin + innerWidth, row2Y);
  // Full-width line aligns Notify Party (left) with top of Vessel and Voyage (right)
  doc.line(innerMargin, row3Y, innerMargin + innerWidth, row3Y);
  doc.line(rightX, portsRow1Y, innerMargin + innerWidth, portsRow1Y);
  doc.line(rightX, portsRow2Y, innerMargin + innerWidth, portsRow2Y);
  doc.line(
    rightX + rightSubWidth,
    portsRow1Y,
    rightX + rightSubWidth,
    topTableStartY + topTableHeight,
  );

  let yPos = topTableStartY + topTableHeight + TABLE_SEPARATION_GAP;

  // Separation title between tables (left-aligned, no border)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(
    "PARTICULAR FURNISHED BY MERCHANTS",
    innerMargin + boxPadding,
    yPos + 4,
  );
  yPos += 8 + TABLE_SEPARATION_GAP;

  // ===== TABLE 2: CARGO DETAILS — ends at Temperature Control Instructions =====
  const footerTableHeight = 52;
  const footerTableStartY = pageHeight - innerMargin - footerTableHeight;
  const wordsRowHeight = 8;
  const tempRowHeight = 10;
  const middleTableEndY = footerTableStartY - TABLE_SEPARATION_GAP;
  const tempRowY = middleTableEndY - tempRowHeight;
  const wordsRowY = tempRowY - wordsRowHeight;
  const cargoTableStartY = yPos;
  const middleTableHeight = middleTableEndY - cargoTableStartY;

  const col1W = innerWidth * 0.14;
  const col2W = innerWidth * 0.18;
  const col3W = innerWidth * 0.38;
  const col4W = innerWidth * 0.15;
  const col5W = innerWidth * 0.15;

  const col1X = innerMargin;
  const col2X = col1X + col1W;
  const col3X = col2X + col2W;
  const col4X = col3X + col3W;
  const col5X = col4X + col4W;

  const headerRowHeight = 10;
  const headerY = cargoTableStartY + 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.text("Mark & Numbers", col1X + boxPadding, headerY);
  doc.text(
    "No. of Packages or Shipping Units",
    col2X + boxPadding,
    headerY,
    { maxWidth: col2W - 2 * boxPadding },
  );
  doc.text("Description of Goods & Packages", col3X + boxPadding, headerY);
  doc.text("Gross Weight", col4X + boxPadding, headerY);
  doc.text("Measurement", col5X + boxPadding, headerY);

  const headerBottomY = cargoTableStartY + headerRowHeight;
  const containerBoxHeight = 14;
  const containerBoxY = wordsRowY - containerBoxHeight;

  drawBox(doc, innerMargin, cargoTableStartY, innerWidth, middleTableHeight);
  doc.line(innerMargin, headerBottomY, innerMargin + innerWidth, headerBottomY);
  doc.line(col2X, cargoTableStartY, col2X, wordsRowY);
  doc.line(col3X, cargoTableStartY, col3X, wordsRowY);
  doc.line(col4X, cargoTableStartY, col4X, wordsRowY);
  doc.line(col5X, cargoTableStartY, col5X, wordsRowY);
  doc.line(col4X, containerBoxY, innerMargin + innerWidth, containerBoxY);
  doc.line(innerMargin, wordsRowY, innerMargin + innerWidth, wordsRowY);
  doc.line(innerMargin, tempRowY, innerMargin + innerWidth, tempRowY);

  const dataStartY = headerBottomY + 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);

  const marksLines = marksNo
    ? doc.splitTextToSize(marksNo, col1W - 2 * boxPadding)
    : [];
  const packagesLines = packagesText
    ? doc.splitTextToSize(packagesText, col2W - 2 * boxPadding)
    : [];
  const descriptionLines = buildTextLines(
    doc,
    descriptionParts,
    col3W - 2 * boxPadding,
  );

  if (marksLines.length) doc.text(marksLines, col1X + boxPadding, dataStartY);
  if (packagesLines.length)
    doc.text(packagesLines, col2X + boxPadding, dataStartY);
  if (descriptionLines.length)
    doc.text(descriptionLines, col3X + boxPadding, dataStartY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text(grossWeightText || "-", col4X + boxPadding, dataStartY);
  doc.text(volumeText || "-", col5X + boxPadding, dataStartY);
  doc.setFont("helvetica", "normal");

  doc.setFontSize(6.5);
  if (shipmentTerms) {
    doc.text(shipmentTerms, col4X + boxPadding, containerBoxY + 4);
  }
  containerInfoLines.forEach((line, idx) => {
    doc.text(line, col4X + boxPadding, containerBoxY + 8 + idx * 3.5);
  });

  // Packages in words row (inside table 2)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.text(
    "Total Number of Containers of Packages(in words)",
    col1X + boxPadding,
    wordsRowY + 3,
  );
  doc.setFont("helvetica", "normal");
  doc.text(packagesInWords, col1X + boxPadding, wordsRowY + 6.5, {
    maxWidth: innerWidth - 2 * boxPadding,
  });

  // Temperature control row — last row of table 2
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.text(
    "Temperature Control Instructions",
    col1X + boxPadding,
    tempRowY + 4,
  );

  // ===== TABLE 3: FOOTER (separate table below middle table) =====
  const footerRow1Height = 12;
  const footerRow2Height = 12;
  const footerRow3Height =
    footerTableHeight - footerRow1Height - footerRow2Height;
  const footerColW = innerWidth / 3;

  drawBox(doc, innerMargin, footerTableStartY, innerWidth, footerTableHeight);

  const drawFooterCell = (
    x: number,
    y: number,
    w: number,
    title: string,
    value: string,
  ) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.text(title, x + boxPadding, y + 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(value || "", x + boxPadding, y + 8.5, {
      maxWidth: w - 2 * boxPadding,
    });
  };

  const fRow1Y = footerTableStartY;
  drawFooterCell(
    innerMargin,
    fRow1Y,
    footerColW,
    "Shipped on Board Date",
    shippedOnBoardDate,
  );
  drawFooterCell(
    innerMargin + footerColW,
    fRow1Y,
    footerColW,
    "Number of Original B/L",
    String(numberOfOriginalBl),
  );
  drawFooterCell(
    innerMargin + footerColW * 2,
    fRow1Y,
    footerColW,
    "Payment Terms",
    paymentTerms,
  );

  const fRow2Y = footerTableStartY + footerRow1Height;
  drawFooterCell(
    innerMargin,
    fRow2Y,
    footerColW,
    "Date of Issue of B/L",
    dateOfIssue,
  );
  drawFooterCell(
    innerMargin + footerColW,
    fRow2Y,
    footerColW,
    "Place of Issue of B/L",
    placeOfIssue,
  );
  drawFooterCell(
    innerMargin + footerColW * 2,
    fRow2Y,
    footerColW,
    "Total Amount",
    "",
  );

  doc.line(innerMargin, fRow2Y, innerMargin + innerWidth, fRow2Y);
  doc.line(
    innerMargin + footerColW,
    footerTableStartY,
    innerMargin + footerColW,
    footerTableStartY + footerRow1Height + footerRow2Height,
  );
  doc.line(
    innerMargin + footerColW * 2,
    footerTableStartY,
    innerMargin + footerColW * 2,
    footerTableStartY + footerRow1Height + footerRow2Height,
  );

  const fRow3Y = footerTableStartY + footerRow1Height + footerRow2Height;
  const signColW = innerWidth * 0.58;
  const legalColW = innerWidth - signColW;

  doc.line(innerMargin, fRow3Y, innerMargin + innerWidth, fRow3Y);
  doc.line(
    innerMargin + signColW,
    fRow3Y,
    innerMargin + signColW,
    footerTableStartY + footerTableHeight,
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.text(
    "Signed by the Carrier / on behalf of the Carrier",
    innerMargin + boxPadding,
    fRow3Y + 5,
  );

  const legalX = innerMargin + signColW;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  const companyLines = doc.splitTextToSize(
    branchInfo.name.toUpperCase(),
    legalColW - 2 * boxPadding,
  );
  doc.text(companyLines, legalX + legalColW / 2, fRow3Y + 5, {
    align: "center",
  });

  doc.setFontSize(7);
  doc.text(
    "Combined Transport Bill Of Lading",
    legalX + legalColW / 2,
    fRow3Y + 5 + companyLines.length * 3.5 + 2,
    { align: "center" },
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(4.5);
  const legalText =
    "In accepting this Bill of Lading, the Merchant expressly accepts and agrees to all its terms, conditions and exceptions, whether printed, stamped or otherwise incorporated. One original Bill of Lading must be surrendered duly endorsed in exchange for the goods or delivery order.";
  const legalLines = doc.splitTextToSize(
    legalText,
    legalColW - 2 * boxPadding,
  );
  doc.text(
    legalLines,
    legalX + boxPadding,
    fRow3Y + footerRow3Height - legalLines.length * 2.2 - 2,
  );

  const pdfBlob = doc.output("blob");
  return URL.createObjectURL(pdfBlob);
};
