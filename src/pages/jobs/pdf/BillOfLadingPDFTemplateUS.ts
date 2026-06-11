import { jsPDF } from "jspdf";
import pentagonPrimeAmericas from "../../../assets/images/PentagonPrimeUSA.png";

const US_COMPANY_FALLBACK = "PENTAGON PRIME AMERICAS INC";
const US_FMC_NO = "034982N";
const TOP_ROW1_HEIGHT = 24;
const TOP_ROW2_HEIGHT = 18;
const RIGHT_SUB_SECTION_HEIGHT = 12;
const RIGHT_SUB_TITLE_OFFSET = 4;
const RIGHT_SUB_BODY_OFFSET = 9;
const TOP_ROW3_HEIGHT = RIGHT_SUB_SECTION_HEIGHT * 3;
const TABLE_SEPARATION_GAP = 4;
const BANNER_GAP = 1;

// Document font sizes (+2pt from original layout)
const FONT_HEADER = 11;
const FONT_SECTION_TITLE = 9;
const FONT_SECTION_BODY = 9;
const FONT_BANNER = 10;
const FONT_TABLE_HEAD = 8.5;
const FONT_TABLE_BODY = 9;
const FONT_LEGAL_BODY = 7;
const FONT_FMC = 9;
const US_LEGAL_TEXT =
  "Received by the Carrier from the shipper in apparent good order and condition (unless otherwise noted herein) the total number or quantity of containers or other packages or units indicated. Stated by the shipper to comprise the Goods specified above, for carriage subject to all terms hereof (INCLUDING THE TERMS ON THE REVERSE HEREOF AND THE TERMS OF THE CARRIER'S APPLICABLE TARIFF) from the Place of Receipt or the Port of Loading whichever is applicable, to the port of discharge or the Place of Delivery, whichever is applicable, one original Bill of Lading must be surrendered duly endorsed in exchange for the Goods. In accepting this Bill of Lading the Merchant expressly accepts and agrees to all its terms, conditions, and exceptions, whether printed, stamped or written, or Otherwise incorporated, notwithstanding the nonsigning of the bill of Lading by the Merchant.";

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
  fontSize = FONT_SECTION_BODY,
): string[] => {
  doc.setFontSize(fontSize);
  return parts
    .filter((p) => p && p.trim())
    .flatMap((part) => doc.splitTextToSize(part, maxWidth));
};

const CARGO_BODY_LINE_HEIGHT = 3.8;
const CARGO_HEADER_TOP_PAD = 3;
const CARGO_HEADER_BOTTOM_PAD = 2;
const CARGO_DATA_GAP = 4;
const PAGE_MARGIN_LEFT = 10;
const PAGE_MARGIN_RIGHT = 10;
const PAGE_MARGIN_TOP = 10;
const CONTINUATION_TOP_Y = PAGE_MARGIN_TOP;
const TERMS_TO_CARRIER_GAP = 5;
const CARRIER_TO_SIGNED_GAP = 4;
const SIGNED_BY_BOTTOM_PAD = 4;
const SIGNED_BY_LINE_WIDTH = 50;
/** Printers often clip the last 15–20mm — keep footer above this line */
const PRINT_SAFE_BOTTOM_MARGIN = 22;

const getFontLineHeight = (doc: jsPDF, fontSize: number): number => {
  doc.setFontSize(fontSize);
  return (fontSize * doc.getLineHeightFactor()) / doc.internal.scaleFactor;
};

type CargoColumnDef = {
  x: number;
  width: number;
  lines: string[];
};

type CargoHeaderLayout = {
  headerBottomY: number;
  dataTopY: number;
};

const getCargoHeaderLineHeight = (doc: jsPDF): number => {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(FONT_TABLE_HEAD);
  return (
    (FONT_TABLE_HEAD * doc.getLineHeightFactor()) / doc.internal.scaleFactor
  );
};

const layoutCargoHeader = (
  doc: jsPDF,
  tableTopY: number,
  headers: { text: string; width: number }[],
  boxPadding: number,
): CargoHeaderLayout => {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(FONT_TABLE_HEAD);
  const lineHeight = getCargoHeaderLineHeight(doc);
  const headerTextY = tableTopY + CARGO_HEADER_TOP_PAD;
  let maxBottom = headerTextY + lineHeight;

  headers.forEach((header) => {
    const wrapped = doc.splitTextToSize(
      header.text,
      header.width - 2 * boxPadding,
    );
    const blockBottom = headerTextY + wrapped.length * lineHeight;
    maxBottom = Math.max(maxBottom, blockBottom);
  });

  const headerBottomY = maxBottom + CARGO_HEADER_BOTTOM_PAD;
  return {
    headerBottomY,
    dataTopY: headerBottomY + CARGO_DATA_GAP,
  };
};

const drawCargoColumnHeaders = (
  doc: jsPDF,
  tableTopY: number,
  headers: { text: string; x: number; width: number }[],
  boxPadding: number,
): CargoHeaderLayout => {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(FONT_TABLE_HEAD);
  const headerTextY = tableTopY + CARGO_HEADER_TOP_PAD;

  headers.forEach((header) => {
    const wrapped = doc.splitTextToSize(
      header.text,
      header.width - 2 * boxPadding,
    );
    doc.text(wrapped, header.x + boxPadding, headerTextY);
  });

  return layoutCargoHeader(doc, tableTopY, headers, boxPadding);
};

const countLinesThatFit = (
  lineCount: number,
  startIndex: number,
  dataTopY: number,
  dataBottomY: number,
): number => {
  const available = dataBottomY - dataTopY;
  if (available <= 0 || startIndex >= lineCount) return 0;
  const maxLines = Math.floor(available / CARGO_BODY_LINE_HEIGHT);
  return Math.min(maxLines, lineCount - startIndex);
};

const remainingContentHeight = (
  columns: CargoColumnDef[],
  indices: number[],
): number => {
  const heights = columns.map((col, i) => {
    const remaining = col.lines.length - indices[i];
    if (remaining <= 0) return 0;
    return remaining * CARGO_BODY_LINE_HEIGHT;
  });
  return Math.max(0, ...heights);
};

const simulateCargoPageBreaks = (
  columns: CargoColumnDef[],
  firstPageDataTopY: number,
  firstPageDataBottomY: number,
  continuationDataTopY: number,
  continuationDataBottomY: number,
  lastPageDataBottomY: number,
): number[][] => {
  const indices = columns.map(() => 0);
  const segments: number[][] = [];
  let pageIndex = 0;

  while (indices.some((idx, i) => idx < columns[i].lines.length)) {
    const isFirstPage = pageIndex === 0;
    const dataTopY = isFirstPage ? firstPageDataTopY : continuationDataTopY;
    const startIndices = [...indices];

    const maxRemaining = remainingContentHeight(columns, indices);
    const fitsOnLastPage = maxRemaining <= lastPageDataBottomY - dataTopY;
    const dataBottomY = fitsOnLastPage
      ? lastPageDataBottomY
      : isFirstPage
        ? firstPageDataBottomY
        : continuationDataBottomY;

    const linesFit = columns.map((col, i) =>
      countLinesThatFit(col.lines.length, indices[i], dataTopY, dataBottomY),
    );
    const batchLines = Math.max(0, ...linesFit);

    if (batchLines === 0) {
      columns.forEach((col, i) => {
        if (indices[i] < col.lines.length) indices[i] += 1;
      });
      segments.push(startIndices);
      pageIndex += 1;
      continue;
    }

    columns.forEach((_, i) => {
      indices[i] = Math.min(indices[i] + batchLines, columns[i].lines.length);
    });

    segments.push(startIndices);
    pageIndex += 1;
  }

  return segments;
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
  const titleLineHeight = 4;
  const bodyLineHeight = 3.7;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(FONT_SECTION_TITLE);
  const titleLines = doc.splitTextToSize(title, contentWidth);
  doc.text(titleLines, x + padding, y + padding + 3);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(FONT_SECTION_BODY);
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

export const generateUsBillOfLadingPDF = (
  jobData: any,
  housingData: any,
  defaultBranch: any,
): string => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const boxPadding = 3;
  const innerMargin = PAGE_MARGIN_LEFT;
  const innerWidth = pageWidth - PAGE_MARGIN_LEFT - PAGE_MARGIN_RIGHT;
  const contentRightX = innerMargin + innerWidth;

  const activeBranch = defaultBranch || getActiveBranchFromStore();
  const companyName = (
    activeBranch?.reporting_name ||
    activeBranch?.branch_title ||
    activeBranch?.branch_name ||
    US_COMPANY_FALLBACK
  ).toUpperCase();
  const branchInfo = {
    name: companyName,
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

  const notifyName =
    housingData?.notify_customer1_name ||
    housingData?.notify1_customer_name ||
    "";
  const notifyAddress =
    housingData?.notify_customer1_address ||
    housingData?.notify1_customer_address ||
    "";
  const notifyEmail =
    housingData?.notify_customer1_email ||
    housingData?.notify1_customer_email ||
    "";

  const hasNotifyCustomer =
    String(notifyName).trim() !== "" || String(notifyAddress).trim() !== "";

  const notifyParts = hasNotifyCustomer
    ? [
        notifyName,
        notifyAddress,
        notifyEmail ? `EMAIL: ${notifyEmail}` : "",
      ].filter((part) => part && part.trim())
    : ["SAME AS CONSIGNEE"];

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
    carrierDetails?.etd || mblDetails?.etd || jobData?.etd,
  );
  const dateOfIssue = formatUsDate(new Date().toISOString());
  const placeOfIssue = activeBranch?.branch_name || "United States";

  const numberOfOriginalBl =
    housingData?.number_of_originals ??
    housingData?.no_of_originals ??
    "ZERO";

  const normalizeFreightTerm = (value: unknown): string => {
    const raw = String(value ?? "").trim().toUpperCase();
    if (!raw) return "";
    if (raw.includes("PREPAID")) return "PREPAID";
    if (raw.includes("COLLECT")) return "COLLECT";
    return raw;
  };

  const housingDetailsArray = Array.isArray(jobData?.housing_details)
    ? jobData.housing_details
    : [];
  const housingId = housingData?.id;
  const housingHbl = housingData?.hbl_number;
  const matchingHousing =
    housingDetailsArray.find((house: { id?: unknown }) => {
      if (!housingId) return false;
      return house.id === housingId || Number(house.id) === Number(housingId);
    }) ??
    housingDetailsArray.find(
      (house: { hbl_number?: unknown }) =>
        housingHbl &&
        String(house.hbl_number ?? "") === String(housingHbl),
    ) ??
    (housingDetailsArray.length === 1 ? housingDetailsArray[0] : null);

  const freightValue = String(
    housingData?.freight || matchingHousing?.freight || "",
  ).trim();
  const paymentTerms = freightValue
    ? `FREIGHT ${normalizeFreightTerm(freightValue)}`
    : "";

  const cargoDetailsFromHousing = housingData?.cargo_details || [];

  let summary = housingData?.summary || {};
  if (!summary || Object.keys(summary).length === 0) {
    summary = matchingHousing?.summary || {};
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

  const logoY = PAGE_MARGIN_TOP;

  if (logoImage) {
    try {
      doc.addImage(
        logoImage,
        "PNG",
        innerMargin + boxPadding,
        logoY,
        38,
        14,
        undefined,
        "FAST",
      );
    } catch (error) {
      console.warn("Could not add logo to US B/L PDF:", error);
    }
  }

  const topTableStartY = logoY + 18;
  const topMetaY = topTableStartY - 8;

  // FMC No. and B/L No. just above the top table border; logo unchanged
  const headerCenterWidth = innerWidth * 0.36;
  const headerCenterX = innerMargin + (innerWidth - headerCenterWidth) / 2;
  const centerTextX = headerCenterX + headerCenterWidth / 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(FONT_HEADER);
  doc.text(companyName, centerTextX, topMetaY, {
    align: "center",
  });
  doc.setFontSize(FONT_FMC);
  doc.text(`FMC: ${US_FMC_NO}`, centerTextX, topMetaY + 5, {
    align: "center",
  });

  const blLabel = "B/L No.";
  const blValue = billOfLadingNo || "";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(FONT_HEADER);
  const blLabelWidth = doc.getTextWidth(`${blLabel} `);
  doc.setFont("helvetica", "normal");
  const blValueWidth = doc.getTextWidth(blValue);
  const blStartX = contentRightX - boxPadding - blLabelWidth - blValueWidth;
  doc.setFont("helvetica", "bold");
  doc.text(`${blLabel} `, blStartX, topMetaY);
  doc.setFont("helvetica", "normal");
  doc.text(blValue, blStartX + blLabelWidth, topMetaY);

  // ===== TABLE 1: TOP INFORMATION GRID =====
  const topTableHeight = TOP_ROW1_HEIGHT + TOP_ROW2_HEIGHT + TOP_ROW3_HEIGHT;
  const colWidth = innerWidth / 2;
  const leftX = innerMargin;
  const rightX = innerMargin + colWidth;
  const sectionPad = boxPadding;
  const textWidth = colWidth - 2 * sectionPad;

  const shipperLines = buildTextLines(doc, shipperParts, textWidth);
  const exportRefLines = buildTextLines(doc, [exportReference], textWidth);
  const consigneeLines = buildTextLines(doc, consigneeParts, textWidth);
  const deliveryAgentLines = buildTextLines(doc, deliveryAgentParts, textWidth);
  const notifyLines = buildTextLines(doc, notifyParts, textWidth);

  const row1Y = topTableStartY;
  const row2Y = topTableStartY + TOP_ROW1_HEIGHT;
  const row3Y = topTableStartY + TOP_ROW1_HEIGHT + TOP_ROW2_HEIGHT;

  drawFixedLabeledSection(
    doc,
    leftX,
    row1Y,
    colWidth,
    TOP_ROW1_HEIGHT,
    "Shipper",
    shipperLines,
    sectionPad,
  );
  drawFixedLabeledSection(
    doc,
    rightX,
    row1Y,
    colWidth,
    TOP_ROW1_HEIGHT,
    "Export Reference",
    exportRefLines,
    sectionPad,
  );

  drawFixedLabeledSection(
    doc,
    leftX,
    row2Y,
    colWidth,
    TOP_ROW2_HEIGHT,
    "Consignee(if 'to Order' so indicate)",
    consigneeLines,
    sectionPad,
  );
  drawFixedLabeledSection(
    doc,
    rightX,
    row2Y,
    colWidth,
    TOP_ROW2_HEIGHT,
    "Delivery Agent",
    deliveryAgentLines,
    sectionPad,
  );

  drawFixedLabeledSection(
    doc,
    leftX,
    row3Y,
    colWidth,
    TOP_ROW3_HEIGHT,
    "Notify Party(No claim shall attach for failure to notify)",
    notifyLines,
    sectionPad,
  );

  const rightSubWidth = colWidth / 2;
  const vesselTopY = row3Y;
  const portsRow1Y = row3Y + RIGHT_SUB_SECTION_HEIGHT;
  const portsRow2Y = row3Y + RIGHT_SUB_SECTION_HEIGHT * 2;

  const drawRightSubSection = (
    sectionY: number,
    leftTitle: string,
    leftValue: string,
    rightTitle?: string,
    rightValue?: string,
  ) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(FONT_SECTION_TITLE);
    doc.text(leftTitle, rightX + sectionPad, sectionY + RIGHT_SUB_TITLE_OFFSET);
    if (rightTitle) {
      doc.text(
        rightTitle,
        rightX + rightSubWidth + sectionPad,
        sectionY + RIGHT_SUB_TITLE_OFFSET,
      );
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(FONT_SECTION_BODY);
    doc.text(leftValue || "", rightX + sectionPad, sectionY + RIGHT_SUB_BODY_OFFSET);
    if (rightTitle) {
      doc.text(
        rightValue || "",
        rightX + rightSubWidth + sectionPad,
        sectionY + RIGHT_SUB_BODY_OFFSET,
      );
    }
  };

  drawRightSubSection(vesselTopY, "Vessel and Voyage", vesselVoyNo);
  drawRightSubSection(
    portsRow1Y,
    "Place of Receipt",
    placeOfReceipt,
    "Port of Loading",
    portOfLoading,
  );
  drawRightSubSection(
    portsRow2Y,
    "Port of Discharge",
    portOfDischarge,
    "Place of Delivery",
    placeOfDelivery,
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

  let yPos = topTableStartY + topTableHeight + BANNER_GAP;

  // Separation title between tables (left-aligned, minimal vertical spacing)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(FONT_BANNER);
  doc.text(
    "PARTICULAR FURNISHED BY MERCHANTS",
    innerMargin + boxPadding,
    yPos + 3,
  );
  yPos += 5 + BANNER_GAP;

  // ===== TABLE 2: CARGO DETAILS — ends at Freight and charges =====
  const footerRow1Height = 10;
  const footerRow2Height = 10;
  const legalPadding = 3;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(FONT_LEGAL_BODY);
  const legalLines = doc.splitTextToSize(
    US_LEGAL_TEXT,
    innerWidth - 2 * boxPadding,
  );
  const legalLineHeight = getFontLineHeight(doc, FONT_LEGAL_BODY);
  const carrierLineHeight = getFontLineHeight(doc, FONT_TABLE_BODY);
  const signedLineHeight = getFontLineHeight(doc, FONT_TABLE_BODY);
  const footerRow3TopInset = legalPadding + 2;
  const legalBlockHeight = legalLines.length * legalLineHeight + 1;
  const footerRow3Height =
    footerRow3TopInset +
    legalBlockHeight +
    TERMS_TO_CARRIER_GAP +
    carrierLineHeight +
    CARRIER_TO_SIGNED_GAP +
    signedLineHeight +
    SIGNED_BY_BOTTOM_PAD;
  const footerTableHeight =
    footerRow1Height + footerRow2Height + footerRow3Height;
  const footerBoxBottomY = pageHeight - PRINT_SAFE_BOTTOM_MARGIN;
  const footerTableStartY = footerBoxBottomY - footerTableHeight;
  const wordsRowHeight = 10;
  const tempRowHeight = 8;
  const middleTableEndY = footerTableStartY - TABLE_SEPARATION_GAP;
  const tempRowY = middleTableEndY - tempRowHeight;
  const wordsRowY = tempRowY - wordsRowHeight;
  const cargoTableStartY = yPos;

  const col1W = innerWidth * 0.14;
  const col2W = innerWidth * 0.18;
  const col3W = innerWidth * 0.38;
  const col4W = innerWidth * 0.15;

  const col1X = innerMargin;
  const col2X = col1X + col1W;
  const col3X = col2X + col2W;
  const col4X = col3X + col3W;
  const col5X = col4X + col4W;
  const col5W = contentRightX - col5X;

  const cargoHeaders = [
    { text: "Mark & Numbers", x: col1X, width: col1W },
    {
      text: "No. of Packages or Shipping Units",
      x: col2X,
      width: col2W,
    },
    {
      text: "Description of Goods & Packages",
      x: col3X,
      width: col3W,
    },
    { text: "Gross Weight", x: col4X, width: col4W },
    { text: "Measurement", x: col5X, width: col5W },
  ];

  const continuationTableTopY = CONTINUATION_TOP_Y;
  const firstPageHeaderLayout = layoutCargoHeader(
    doc,
    cargoTableStartY,
    cargoHeaders,
    boxPadding,
  );
  const continuationHeaderLayout = layoutCargoHeader(
    doc,
    continuationTableTopY,
    cargoHeaders,
    boxPadding,
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(FONT_TABLE_BODY);

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
    FONT_TABLE_BODY,
  );
  const grossWeightLines = grossWeightText
    ? doc.splitTextToSize(grossWeightText, col4W - 2 * boxPadding)
    : ["-"];
  const volumeLines = volumeText
    ? doc.splitTextToSize(volumeText, col5W - 2 * boxPadding)
    : ["-"];

  const cargoColumns: CargoColumnDef[] = [
    { x: col1X, width: col1W, lines: marksLines },
    { x: col2X, width: col2W, lines: packagesLines },
    { x: col3X, width: col3W, lines: descriptionLines },
    { x: col4X, width: col4W, lines: grossWeightLines },
    { x: col5X, width: col5W, lines: volumeLines },
  ];

  const firstPageDataTopY = firstPageHeaderLayout.dataTopY;
  const continuationDataTopY = continuationHeaderLayout.dataTopY;
  const fullPageDataBottomY = pageHeight - PAGE_MARGIN_TOP - 5;

  const pageBreaks = simulateCargoPageBreaks(
    cargoColumns,
    firstPageDataTopY,
    fullPageDataBottomY,
    continuationDataTopY,
    fullPageDataBottomY,
    wordsRowY,
  );

  const drawCargoTableBorders = (
    tableTopY: number,
    tableBottomY: number,
    headerBottomY: number,
    dataBottomY: number,
    includeFooterRows: boolean,
  ) => {
    drawBox(doc, innerMargin, tableTopY, innerWidth, tableBottomY - tableTopY);
    doc.line(innerMargin, headerBottomY, innerMargin + innerWidth, headerBottomY);
    const columnBottomY = includeFooterRows ? wordsRowY : dataBottomY;
    doc.line(col2X, tableTopY, col2X, columnBottomY);
    doc.line(col3X, tableTopY, col3X, columnBottomY);
    doc.line(col4X, tableTopY, col4X, columnBottomY);
    doc.line(col5X, tableTopY, col5X, columnBottomY);
    if (includeFooterRows) {
      doc.line(innerMargin, wordsRowY, innerMargin + innerWidth, wordsRowY);
      doc.line(innerMargin, tempRowY, innerMargin + innerWidth, tempRowY);
    }
  };

  const drawCargoPageSegment = (
    segmentIndex: number,
    startIndices: number[],
    isLastSegment: boolean,
  ) => {
    if (segmentIndex > 0) {
      doc.addPage();
    }

    const isFirstSegment = segmentIndex === 0;
    const tableTopY = isFirstSegment ? cargoTableStartY : continuationTableTopY;
    const { headerBottomY, dataTopY } = drawCargoColumnHeaders(
      doc,
      tableTopY,
      cargoHeaders,
      boxPadding,
    );
    const dataBottomY = isLastSegment
      ? wordsRowY
      : fullPageDataBottomY;
    const tableBottomY = isLastSegment ? middleTableEndY : dataBottomY + 2;

    drawCargoTableBorders(
      tableTopY,
      tableBottomY,
      headerBottomY,
      dataBottomY,
      isLastSegment,
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(FONT_TABLE_BODY);

    const endIndices = cargoColumns.map((col, i) => {
      const linesOnPage = countLinesThatFit(
        col.lines.length,
        startIndices[i],
        dataTopY,
        dataBottomY,
      );
      return startIndices[i] + linesOnPage;
    });

    cargoColumns.forEach((col, colIndex) => {
      let lineY = dataTopY;
      for (let i = startIndices[colIndex]; i < endIndices[colIndex]; i += 1) {
        doc.text(col.lines[i], col.x + boxPadding, lineY);
        lineY += CARGO_BODY_LINE_HEIGHT;
      }
    });

    if (isLastSegment) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(FONT_TABLE_HEAD);
      doc.text(
        "Total Number of Containers of Packages(in words)",
        col1X + boxPadding,
        wordsRowY + 5,
      );
      doc.setFont("helvetica", "normal");
      doc.setFontSize(FONT_TABLE_BODY);
      doc.text(packagesInWords, col1X + boxPadding, wordsRowY + 9, {
        maxWidth: innerWidth - 2 * boxPadding,
      });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(FONT_TABLE_HEAD);
      doc.text(
        "Freight and Charges",
        col1X + boxPadding,
        tempRowY + 4,
      );
    }
  };

  const cargoSegments =
    pageBreaks.length > 0 ? pageBreaks : [cargoColumns.map(() => 0)];
  cargoSegments.forEach((startIndices, segmentIndex) => {
    drawCargoPageSegment(
      segmentIndex,
      startIndices,
      segmentIndex === cargoSegments.length - 1,
    );
  });

  // ===== TABLE 3: FOOTER (separate table below middle table) =====
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
    doc.setFontSize(FONT_TABLE_HEAD);
    doc.text(title, x + boxPadding, y + 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(FONT_TABLE_BODY);
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

  doc.line(innerMargin, fRow3Y, innerMargin + innerWidth, fRow3Y);

  const legalY = fRow3Y + footerRow3TopInset;
  const signedByY =
    footerBoxBottomY - SIGNED_BY_BOTTOM_PAD - signedLineHeight;
  const carrierY = signedByY - CARRIER_TO_SIGNED_GAP - carrierLineHeight;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(FONT_LEGAL_BODY);
  doc.text(legalLines, innerMargin + boxPadding, legalY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(FONT_TABLE_BODY);
  doc.text(`Carrier: ${companyName}`, innerMargin + boxPadding, carrierY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(FONT_TABLE_BODY);
  const signedByLabel = "Signed By:";
  doc.text(signedByLabel, innerMargin + boxPadding, signedByY);
  const signedByLineStartX =
    innerMargin + boxPadding + doc.getTextWidth(signedByLabel) + 2;
  const signedByLineEndX = signedByLineStartX + SIGNED_BY_LINE_WIDTH;
  doc.setLineWidth(0.3);
  doc.line(
    signedByLineStartX,
    signedByY + 0.5,
    signedByLineEndX,
    signedByY + 0.5,
  );
  doc.line(
    innerMargin,
    footerBoxBottomY,
    innerMargin + innerWidth,
    footerBoxBottomY,
  );

  const pdfBlob = doc.output("blob");
  return URL.createObjectURL(pdfBlob);
};
