import { jsPDF } from "jspdf";
import pentagonPrimeAmericas from "../../../assets/images/PentagonPrimeUSA.png";

const US_COMPANY_FALLBACK = "PENTAGON PRIME AMERICAS INC";
const US_FORWARDING_AGENT_NAME = "PENTAGON PRIME AMERICAS INC";
const US_FORWARDING_AGENT_ADDRESS =
  "8400 NW 33rd STREET, SUITE 310, MIAMI FL 33178";
const US_FMC_NO = "034982N";
const TOP_ROW1_HEIGHT = 20;
const ROW1_EXPORT_REF_HEIGHT = 10;
const TOP_ROW2_HEIGHT = 16;
const RIGHT_SUB_SECTION_HEIGHT = 12;
const RIGHT_SUB_TITLE_OFFSET = 4;
const RIGHT_SUB_BODY_OFFSET = 9;
const TOP_ROW3_HEIGHT = RIGHT_SUB_SECTION_HEIGHT * 3;
const TABLE_SEPARATION_GAP = 2;
const TOP_TO_MIDDLE_GAP = 1.5;
const LOGO_HEIGHT = 20;
const LOGO_WIDTH = 52;
const LOGO_TO_TABLE_GAP = 2;
/** Space between logo band and top table for the B/L No. line */
const BL_NO_BAND_HEIGHT = 5;
/** Baseline offset above the top table border */
const BL_NO_ABOVE_TABLE_GAP = 1.8;
/** Extra inset from the right edge so B/L No. is not cramped */
const BL_NO_RIGHT_INSET = 2;
/** Gap between "B/L No:" label and its value */
const BL_NO_LABEL_VALUE_GAP = 5;
/** Extra mm reserved for the value so the label sits further left */
const BL_NO_VALUE_EXTRA_WIDTH = 8;
/** Reserve B/L No. value width so label/value stay aligned (e.g. PUS26FE0009). */
const BL_NO_WIDTH_SAMPLE = "PUS26FE0009";

// Document font sizes (+2pt from original layout)
const FONT_HEADER = 11;
const FONT_SECTION_TITLE = 9;
const FONT_SECTION_BODY = 9;
const FONT_TABLE_HEAD = 8.5;
const FONT_TABLE_BODY = 9;
const FONT_CARGO_DESCRIPTION = 8;
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
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
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
    "",
    "ONE",
    "TWO",
    "THREE",
    "FOUR",
    "FIVE",
    "SIX",
    "SEVEN",
    "EIGHT",
    "NINE",
    "TEN",
    "ELEVEN",
    "TWELVE",
    "THIRTEEN",
    "FOURTEEN",
    "FIFTEEN",
    "SIXTEEN",
    "SEVENTEEN",
    "EIGHTEEN",
    "NINETEEN",
  ];
  const tens = [
    "",
    "",
    "TWENTY",
    "THIRTY",
    "FORTY",
    "FIFTY",
    "SIXTY",
    "SEVENTY",
    "EIGHTY",
    "NINETY",
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
const CARGO_DESCRIPTION_LINE_HEIGHT = 3.4;
const SECTION_TITLE_LINE_HEIGHT = 4;
const SECTION_BODY_LINE_HEIGHT = 3.2;
const SECTION_TITLE_TOP_INSET = 3;
const SECTION_BODY_BOTTOM_PAD = 1;
const EXPORT_REF_TITLE_TOP_GAP = 2;
const FORWARDING_AGENT_TITLE_TOP_GAP = 2;
const CARGO_HEADER_TOP_PAD = 3;
const CARGO_HEADER_BOTTOM_PAD = 0;
const CARGO_DATA_GAP = 1;
const FREIGHT_WORDS_TITLE_TOP_PAD = 3.5;
const FREIGHT_WORDS_VALUE_GAP = 1;
const FREIGHT_TITLE_TOP_PAD = 3.5;
/** Fixed middle-table footer band heights (mm; matches other 10mm footer rows). */
const FREIGHT_WORDS_ROW_HEIGHT = 10;
/** ~3.2× the "Total Number … (in words)" row for blank writing space */
const FREIGHT_CHARGES_ROW_HEIGHT = 22;
const CARGO_BODY_BOTTOM_GAP = 1;
const PAGE_MARGIN_LEFT = 10;
const PAGE_MARGIN_RIGHT = 10;
const PAGE_MARGIN_TOP = 6;
const CONTINUATION_TOP_Y = PAGE_MARGIN_TOP;
const TERMS_TO_CARRIER_GAP = 5;
const CARRIER_TO_SIGNED_GAP = 4;
const SIGNED_BY_BOTTOM_PAD = 4;
const SIGNED_BY_LINE_WIDTH = 50;
/** Printers often clip the last few mm — keep footer above this line */
const PRINT_SAFE_BOTTOM_MARGIN = 14;

const getFontLineHeight = (doc: jsPDF, fontSize: number): number => {
  doc.setFontSize(fontSize);
  return (fontSize * doc.getLineHeightFactor()) / doc.internal.scaleFactor;
};

type CargoColumnDef = {
  x: number;
  width: number;
  lines: string[];
  lineHeight?: number;
  fontSize?: number;
};

const getColumnLineHeight = (col: CargoColumnDef): number =>
  col.lineHeight ?? CARGO_BODY_LINE_HEIGHT;

type CargoHeaderLayout = {
  headerBottomY: number;
  dataTopY: number;
};

type FreightFooterLayout = {
  wordsRowHeight: number;
  tempRowHeight: number;
  wordsRowY: number;
  tempRowY: number;
  wordsTitleOffsetY: number;
  wordsValueOffsetY: number;
  freightTitleOffsetY: number;
};

const measureFreightFooterLayout = (
  doc: jsPDF,
  middleTableEndY: number,
  _innerWidth: number,
  _boxPadding: number,
  _packagesInWords: string,
): FreightFooterLayout => {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(FONT_TABLE_HEAD);
  const wordsTitleLineHeight = getFontLineHeight(doc, FONT_TABLE_HEAD);

  const wordsTitleOffsetY = FREIGHT_WORDS_TITLE_TOP_PAD;
  const wordsValueOffsetY =
    wordsTitleOffsetY + wordsTitleLineHeight + FREIGHT_WORDS_VALUE_GAP;
  // Fixed band heights so blank template still shows clear writing space
  const wordsRowHeight = FREIGHT_WORDS_ROW_HEIGHT;
  const freightTitleOffsetY = FREIGHT_TITLE_TOP_PAD;
  const tempRowHeight = FREIGHT_CHARGES_ROW_HEIGHT;

  const tempRowY = middleTableEndY - tempRowHeight;
  const wordsRowY = tempRowY - wordsRowHeight;

  return {
    wordsRowHeight,
    tempRowHeight,
    wordsRowY,
    tempRowY,
    wordsTitleOffsetY,
    wordsValueOffsetY,
    freightTitleOffsetY,
  };
};

const getCargoContentBottomY = (
  columns: CargoColumnDef[],
  startIndices: number[],
  endIndices: number[],
  dataTopY: number,
  getColumnFontHeight: (col: CargoColumnDef) => number,
): number =>
  columns.reduce((maxBottom, col, colIndex) => {
    const lineCount = endIndices[colIndex] - startIndices[colIndex];
    if (lineCount <= 0) return maxBottom;
    const lineHeight = getColumnLineHeight(col);
    const fontHeight = getColumnFontHeight(col);
    const bottom = dataTopY + (lineCount - 1) * lineHeight + fontHeight;
    return Math.max(maxBottom, bottom);
  }, dataTopY);

const getCargoHeaderLineHeight = (doc: jsPDF): number => {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(FONT_TABLE_HEAD);
  return (
    (FONT_TABLE_HEAD * doc.getLineHeightFactor()) / doc.internal.scaleFactor
  );
};

const getCargoHeaderTextBottom = (
  headerTextY: number,
  lineCount: number,
  lineHeight: number,
  fontHeight: number,
): number => {
  if (lineCount <= 0) return headerTextY;
  return headerTextY + (lineCount - 1) * lineHeight + fontHeight;
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
  const fontHeight = getFontLineHeight(doc, FONT_TABLE_HEAD);
  const headerTextY = tableTopY + CARGO_HEADER_TOP_PAD;
  let maxBottom = headerTextY;

  headers.forEach((header) => {
    const wrapped = doc.splitTextToSize(
      header.text,
      header.width - 2 * boxPadding,
    );
    const blockBottom = getCargoHeaderTextBottom(
      headerTextY,
      wrapped.length,
      lineHeight,
      fontHeight,
    );
    maxBottom = Math.max(maxBottom, blockBottom);
  });

  const headerBottomY = maxBottom + CARGO_HEADER_BOTTOM_PAD;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(FONT_TABLE_BODY);
  const bodyFontHeight = getFontLineHeight(doc, FONT_TABLE_BODY);
  return {
    headerBottomY,
    dataTopY: headerBottomY + CARGO_DATA_GAP + bodyFontHeight,
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
    const textMaxWidth = header.width - 2 * boxPadding;
    const wrapped = doc.splitTextToSize(header.text, textMaxWidth);
    doc.text(wrapped, header.x + header.width / 2, headerTextY, {
      align: "center",
      maxWidth: textMaxWidth,
    });
  });

  return layoutCargoHeader(doc, tableTopY, headers, boxPadding);
};

const countLinesThatFit = (
  lineCount: number,
  startIndex: number,
  dataTopY: number,
  dataBottomY: number,
  lineHeight = CARGO_BODY_LINE_HEIGHT,
  bodyFontHeight = lineHeight,
): number => {
  const available = dataBottomY - dataTopY;
  if (available <= 0 || startIndex >= lineCount) return 0;
  if (available < bodyFontHeight) {
    return lineCount - startIndex > 0 ? 1 : 0;
  }
  const maxLines = Math.floor((available - bodyFontHeight) / lineHeight) + 1;
  return Math.min(maxLines, lineCount - startIndex);
};

const remainingContentHeight = (
  columns: CargoColumnDef[],
  indices: number[],
): number => {
  const heights = columns.map((col, i) => {
    const remaining = col.lines.length - indices[i];
    if (remaining <= 0) return 0;
    return remaining * getColumnLineHeight(col);
  });
  return Math.max(0, ...heights);
};

const simulateCargoPageBreaks = (
  columns: CargoColumnDef[],
  firstPageDataTopY: number,
  firstPageIntermediateDataBottomY: number,
  continuationDataTopY: number,
  continuationIntermediateDataBottomY: number,
  firstPageFinalDataBottomY: number,
  continuationFinalDataBottomY: number,
  getColumnFontHeight: (col: CargoColumnDef) => number,
): number[][] => {
  const indices = columns.map(() => 0);
  const segments: number[][] = [];
  let pageIndex = 0;

  const initialRemainingHeight = remainingContentHeight(columns, indices);
  const singlePageCargoLayout =
    initialRemainingHeight <= firstPageFinalDataBottomY - firstPageDataTopY;

  while (indices.some((idx, i) => idx < columns[i].lines.length)) {
    const isFirstPage = pageIndex === 0;
    const dataTopY = isFirstPage ? firstPageDataTopY : continuationDataTopY;
    const startIndices = [...indices];
    const finalPageDataBottomY = isFirstPage
      ? firstPageFinalDataBottomY
      : continuationFinalDataBottomY;

    const maxRemaining = remainingContentHeight(columns, indices);
    const fitsOnFinalPage = maxRemaining <= finalPageDataBottomY - dataTopY;
    const dataBottomY = singlePageCargoLayout
      ? firstPageFinalDataBottomY
      : fitsOnFinalPage
        ? finalPageDataBottomY
        : isFirstPage
          ? firstPageIntermediateDataBottomY
          : continuationIntermediateDataBottomY;

    const linesFit = columns.map((col, i) =>
      countLinesThatFit(
        col.lines.length,
        indices[i],
        dataTopY,
        dataBottomY,
        getColumnLineHeight(col),
        getColumnFontHeight(col),
      ),
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

const measureLabeledSectionHeight = (
  doc: jsPDF,
  width: number,
  title: string,
  contentLines: string[],
  padding = 3,
  titleTopInset = padding + SECTION_TITLE_TOP_INSET,
): number => {
  const contentWidth = width - 2 * padding;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(FONT_SECTION_TITLE);
  const titleLines = doc.splitTextToSize(title, contentWidth);
  const titleHeight = titleLines.length * SECTION_TITLE_LINE_HEIGHT;
  const bodyHeight =
    contentLines.length > 0
      ? contentLines.length * SECTION_BODY_LINE_HEIGHT
      : SECTION_BODY_LINE_HEIGHT;
  return titleTopInset + titleHeight + bodyHeight + SECTION_BODY_BOTTOM_PAD;
};

const drawLabeledSection = (
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  title: string,
  contentLines: string[],
  padding = 3,
  titleTopInset = padding + SECTION_TITLE_TOP_INSET,
) => {
  const contentWidth = width - 2 * padding;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(FONT_SECTION_TITLE);
  const titleLines = doc.splitTextToSize(title, contentWidth);
  doc.text(titleLines, x + padding, y + titleTopInset);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(FONT_SECTION_BODY);
  const titleHeight = titleLines.length * SECTION_TITLE_LINE_HEIGHT;
  const bodyStartY = y + titleTopInset + titleHeight;
  if (contentLines.length > 0) {
    doc.text(contentLines, x + padding, bodyStartY);
  }
};

export const generateUsBillOfLadingPDF = (
  jobData: any,
  housingData: any,
  defaultBranch: any,
  options?: {
    templateOnly?: boolean;
    draft?: boolean;
    blType?: string;
    houseIndex?: number;
  },
): string => {
  const templateOnly = options?.templateOnly === true;
  const isDraftBol = options?.draft === true;
  const blTypeRaw = String(
    options?.blType ?? housingData?.bl_type ?? "",
  ).trim();
  // Normalize legacy values from earlier dropdown labels.
  const blType =
    blTypeRaw === "Original"
      ? "ORIGINAL"
      : blTypeRaw === "Surrender" || blTypeRaw === "SURRENDER"
        ? "SURRENDERED"
        : blTypeRaw;
  const isSeawayOrSurrendered =
    blType === "SEAWAY BILL" || blType === "SURRENDERED";
  // Draft / SEAWAY BILL / SURRENDERED: single page. ORIGINAL: one copy (may continue if cargo overflows).
  const isSinglePageBol = isDraftBol || isSeawayOrSurrendered;
  // DRAFT beside company header. SEAWAY/SURRENDERED use red label in Description column.
  const titleSuffix = isDraftBol ? "DRAFT" : "";
  const cargoTypeLabel = isDraftBol
    ? ""
    : isSeawayOrSurrendered
      ? blType
      : "";
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const boxPadding = 1.5;
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
    address: activeBranch?.reporting_address || activeBranch?.address || "",
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
    housingData?.consignee_pan || housingData?.consignee_pan_no
      ? `ID: ${housingData.consignee_pan || housingData.consignee_pan_no}`
      : "",
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
  const notifyPan =
    housingData?.notify_customer1_pan ||
    housingData?.notify1_customer_pan ||
    "";

  const hasNotifyCustomer =
    String(notifyName).trim() !== "" || String(notifyAddress).trim() !== "";

  const notifyParts = hasNotifyCustomer
    ? [
        notifyName,
        notifyAddress,
        notifyEmail ? `EMAIL: ${notifyEmail}` : "",
        notifyPan ? `ID: ${notifyPan}` : "",
      ].filter((part) => part && part.trim())
    : templateOnly
      ? []
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

  const placeOfReceipt = housingData?.place_of_acceptance || houseOrigin || "";
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
  const dateOfIssue = templateOnly
    ? ""
    : formatUsDate(
        housingData?.date_of_issue || new Date().toISOString(),
      );
  const placeOfIssue = templateOnly
    ? ""
    : housingData?.place_of_issue ||
      activeBranch?.branch_name ||
      "United States";

  const numberOfOriginalBl = templateOnly
    ? ""
    : (housingData?.number_of_originals ??
      housingData?.no_of_originals ??
      "3 / THREE");

  const normalizeFreightTerm = (value: unknown): string => {
    const raw = String(value ?? "")
      .trim()
      .toUpperCase();
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
        housingHbl && String(house.hbl_number ?? "") === String(housingHbl),
    ) ??
    (housingDetailsArray.length === 1 ? housingDetailsArray[0] : null);

  const freightValue = String(
    housingData?.pp_cc || matchingHousing?.pp_cc || "",
  ).trim();
  const paymentTerms = freightValue
    ? `FREIGHT ${normalizeFreightTerm(freightValue)}`
    : "";

  const cargoDetailsFromHousing = housingData?.cargo_details || [];
  const containerDetailsFromJob = jobData?.container_details || [];
  // Match cargo_details with container_details for seal / container type (Marks column)
  const enrichedCargoDetails = cargoDetailsFromHousing.map((cargo: any) => {
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
    summary = matchingHousing?.summary || {};
  }

  const cargoSummary = housingData?.cargo_summary || {};
  const totalNoOfPackages =
    summary?.total_no_of_packages ||
    housingData?.total_packages ||
    cargoSummary?.total_packages ||
    sumCargoField(cargoDetailsFromHousing, "no_of_packages") ||
    "";

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
    (templateOnly ? "" : "PACKAGE(S)");
  const packagesText = totalNoOfPackages
    ? `${totalNoOfPackages}${packageType ? ` ${packageType}` : ""}`
    : "";
  const grossWeightText = totalGrossWeight
    ? `${formatDecimal(totalGrossWeight)} KGS`
    : "";
  const volumeText = totalVolume ? `${formatDecimal(totalVolume)} CBM` : "";

  const marksNo = housingData?.marks_no || "";
  const commodityDesc = housingData?.commodity_description || "";
  const hsCode = housingData?.hs_code || housingData?.item_no || "";
  const descriptionParts = [
    commodityDesc,
    hsCode ? `NCM: ${hsCode}` : "",
  ].filter(Boolean);

  const packagesCount = parseInt(String(totalNoOfPackages), 10);
  const packagesInWords = templateOnly
    ? ""
    : housingData?.packages_in_words
      ? String(housingData.packages_in_words)
      : !isNaN(packagesCount)
        ? `SAY ${numberToWords(packagesCount)} ${packageType || "PACKAGE(S)"} ONLY.`
        : packagesText
          ? `SAY ${packagesText} ONLY.`
          : "";

  doc.setProperties({
    title: templateOnly
      ? "Bill Of Lading - Template"
      : `Bill Of Lading - ${billOfLadingNo}`,
    subject: "Bill Of Lading",
    author: branchInfo.name,
  });

  const logoY = PAGE_MARGIN_TOP;
  const logoWidth = LOGO_WIDTH;

  if (logoImage) {
    try {
      doc.addImage(
        logoImage,
        "PNG",
        innerMargin + boxPadding,
        logoY,
        logoWidth,
        LOGO_HEIGHT,
        undefined,
        "FAST",
      );
    } catch (error) {
      console.warn("Could not add logo to US B/L PDF:", error);
    }
  }

  const topTableStartY =
    logoY + LOGO_HEIGHT + LOGO_TO_TABLE_GAP + BL_NO_BAND_HEIGHT;
  // Company name + FMC stay vertically centered with the logo band
  const headerRowLineHeight = getFontLineHeight(doc, FONT_HEADER);
  const headerRowY = logoY + (LOGO_HEIGHT + headerRowLineHeight) / 2;

  const headerCenterWidth = innerWidth * 0.36;
  const headerCenterX = innerMargin + (innerWidth - headerCenterWidth) / 2;
  const centerTextX = headerCenterX + headerCenterWidth / 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(FONT_HEADER);
  const fmcLabel = `FMC: ${US_FMC_NO}`;
  const companyNameWidth = doc.getTextWidth(companyName);
  const titleSuffixGap = 3;
  const titleSuffixWidth = titleSuffix
    ? doc.getTextWidth(titleSuffix) + titleSuffixGap
    : 0;
  doc.setFontSize(FONT_FMC);
  const fmcGap = "   ";
  const fmcLabelWidth = doc.getTextWidth(`${fmcGap}${fmcLabel}`);
  const headerTextStartX =
    centerTextX -
    (companyNameWidth + titleSuffixWidth + fmcLabelWidth) / 2;
  doc.setFontSize(FONT_HEADER);
  doc.setTextColor(0, 0, 0);
  doc.text(companyName, headerTextStartX, headerRowY);
  if (titleSuffix) {
    doc.text(
      titleSuffix,
      headerTextStartX + companyNameWidth + titleSuffixGap,
      headerRowY,
    );
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(FONT_FMC);
  doc.text(
    `${fmcGap}${fmcLabel}`,
    headerTextStartX + companyNameWidth + titleSuffixWidth,
    headerRowY,
  );

  // B/L No. on its own line, just above the top table (not on the logo/company row)
  const blLabel = "B/L No:";
  const blValue = billOfLadingNo || "";
  const blRowY = topTableStartY - BL_NO_ABOVE_TABLE_GAP;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(FONT_HEADER);
  const blLabelWidth = doc.getTextWidth(blLabel);
  doc.setFont("helvetica", "normal");
  const blValueWidth =
    Math.max(
      doc.getTextWidth(blValue),
      doc.getTextWidth(BL_NO_WIDTH_SAMPLE),
    ) + BL_NO_VALUE_EXTRA_WIDTH;
  // Label sits left of a reserved value slot so the number has clear space
  const blValueX =
    contentRightX - boxPadding - BL_NO_RIGHT_INSET - blValueWidth;
  const blLabelX = blValueX - BL_NO_LABEL_VALUE_GAP - blLabelWidth;
  doc.setFont("helvetica", "bold");
  doc.text(blLabel, blLabelX, blRowY);
  doc.setFont("helvetica", "normal");
  doc.text(blValue, blValueX, blRowY);

  // ===== TABLE 1: TOP INFORMATION GRID =====
  const colWidth = innerWidth / 2;
  const rightSubWidth = colWidth / 2;
  const leftX = innerMargin;
  const rightX = innerMargin + colWidth;
  const sectionPad = 1.5;
  const exportRefTitleTopInset = sectionPad + EXPORT_REF_TITLE_TOP_GAP;
  const forwardingAgentTitleTopInset =
    sectionPad + FORWARDING_AGENT_TITLE_TOP_GAP;
  const textWidth = colWidth - 2 * sectionPad;

  const shipperLines = buildTextLines(doc, shipperParts, textWidth);
  const exportRefLines = buildTextLines(doc, [exportReference], textWidth);
  const forwardingAgentLines = buildTextLines(
    doc,
    templateOnly
      ? []
      : [
          housingData?.forwarding_agent_name || US_FORWARDING_AGENT_NAME,
          housingData?.forwarding_agent_address || US_FORWARDING_AGENT_ADDRESS,
        ],
    textWidth,
  );
  const consigneeLines = buildTextLines(doc, consigneeParts, textWidth);
  const deliveryAgentLines = buildTextLines(doc, deliveryAgentParts, textWidth);
  const notifyLines = buildTextLines(doc, notifyParts, textWidth);

  const consigneeTitle = "Consignee(if 'to Order' so indicate)";
  const deliveryAgentTitle = "Delivery Agent";
  const notifyTitle =
    "Notify Party(No claim shall attach for failure to notify)";
  const shipperTitle = "Shipper";
  const exportRefTitle = "Export Reference";
  const forwardingAgentTitle = "Forwarding Agent (Name and address)";

  const exportRefHeight = Math.max(
    ROW1_EXPORT_REF_HEIGHT,
    measureLabeledSectionHeight(
      doc,
      colWidth,
      exportRefTitle,
      exportRefLines,
      sectionPad,
      exportRefTitleTopInset,
    ),
  );
  const forwardingAgentHeight = Math.max(
    TOP_ROW1_HEIGHT - ROW1_EXPORT_REF_HEIGHT,
    measureLabeledSectionHeight(
      doc,
      colWidth,
      forwardingAgentTitle,
      forwardingAgentLines,
      sectionPad,
      forwardingAgentTitleTopInset,
    ),
  );
  const row1Height = Math.max(
    TOP_ROW1_HEIGHT,
    measureLabeledSectionHeight(
      doc,
      colWidth,
      shipperTitle,
      shipperLines,
      sectionPad,
    ),
    exportRefHeight + forwardingAgentHeight,
  );

  const row2Height = Math.max(
    TOP_ROW2_HEIGHT,
    measureLabeledSectionHeight(
      doc,
      colWidth,
      consigneeTitle,
      consigneeLines,
      sectionPad,
    ),
    measureLabeledSectionHeight(
      doc,
      colWidth,
      deliveryAgentTitle,
      deliveryAgentLines,
      sectionPad,
    ),
  );
  const row3Height = Math.max(
    TOP_ROW3_HEIGHT,
    measureLabeledSectionHeight(
      doc,
      colWidth,
      notifyTitle,
      notifyLines,
      sectionPad,
    ),
    RIGHT_SUB_SECTION_HEIGHT * 3,
  );
  const topTableHeight = row1Height + row2Height + row3Height;

  const row1Y = topTableStartY;
  const row2Y = topTableStartY + row1Height;
  const row3Y = row2Y + row2Height;

  drawLabeledSection(
    doc,
    leftX,
    row1Y,
    colWidth,
    shipperTitle,
    shipperLines,
    sectionPad,
  );
  drawLabeledSection(
    doc,
    rightX,
    row1Y,
    colWidth,
    exportRefTitle,
    exportRefLines,
    sectionPad,
    exportRefTitleTopInset,
  );
  drawLabeledSection(
    doc,
    rightX,
    row1Y + exportRefHeight,
    colWidth,
    forwardingAgentTitle,
    forwardingAgentLines,
    sectionPad,
    forwardingAgentTitleTopInset,
  );

  drawLabeledSection(
    doc,
    leftX,
    row2Y,
    colWidth,
    consigneeTitle,
    consigneeLines,
    sectionPad,
  );
  drawLabeledSection(
    doc,
    rightX,
    row2Y,
    colWidth,
    deliveryAgentTitle,
    deliveryAgentLines,
    sectionPad,
  );

  drawLabeledSection(
    doc,
    leftX,
    row3Y,
    colWidth,
    notifyTitle,
    notifyLines,
    sectionPad,
  );

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
    doc.text(
      leftValue || "",
      rightX + sectionPad,
      sectionY + RIGHT_SUB_BODY_OFFSET,
    );
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
  doc.line(
    rightX,
    row1Y + exportRefHeight,
    rightX + colWidth,
    row1Y + exportRefHeight,
  );
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
  const middleTableEndY = footerTableStartY - TABLE_SEPARATION_GAP;
  const cargoTableStartY = topTableStartY + topTableHeight + TOP_TO_MIDDLE_GAP;

  const col1W = innerWidth * 0.23;
  const col2W = innerWidth * 0.15;
  const col3W = innerWidth * 0.38;
  const col4W = innerWidth * 0.12;
  const col5W = innerWidth * 0.12;

  const col1X = innerMargin;
  const col2X = col1X + col1W;
  const col3X = col2X + col2W;
  const col4X = col3X + col3W;
  const col5X = col4X + col4W;

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

  const marksContentWidth = col1W - 2 * boxPadding;
  const marksRawLines: string[] = [];
  if (marksNo) marksRawLines.push(String(marksNo));
  enrichedCargoDetails.forEach((cargo: any, index: number) => {
    const entryLines: string[] = [];
    if (cargo?.container_no) entryLines.push(String(cargo.container_no));
    if (cargo?.container_type_name)
      entryLines.push(String(cargo.container_type_name));
    if (cargo?.actual_seal_no)
      entryLines.push(`Seal No: ${cargo.actual_seal_no}`);
    if (cargo?.gross_weight)
      entryLines.push(`Gross Wt: ${cargo.gross_weight} KGS`);
    if (
      cargo?.volume !== undefined &&
      cargo?.volume !== null &&
      cargo?.volume !== ""
    ) {
      entryLines.push(`Volume: ${cargo.volume} CBM`);
    }
    if (cargo?.no_of_packages)
      entryLines.push(`Pkgs: ${cargo.no_of_packages} PACKAGE(S)`);
    marksRawLines.push(...entryLines);
    if (entryLines.length > 0 && index < enrichedCargoDetails.length - 1) {
      marksRawLines.push("");
    }
  });
  const marksLines = marksRawLines.flatMap((line) =>
    line === "" ? [""] : doc.splitTextToSize(line, marksContentWidth),
  );
  const packagesLines = packagesText
    ? doc.splitTextToSize(packagesText, col2W - 2 * boxPadding)
    : [];
  const descriptionContentWidth = col3W - 2 * boxPadding;
  const descriptionLines = buildTextLines(
    doc,
    descriptionParts,
    descriptionContentWidth,
    FONT_CARGO_DESCRIPTION,
  );
  const grossWeightLines = grossWeightText
    ? doc.splitTextToSize(grossWeightText, col4W - 2 * boxPadding)
    : [];
  const volumeLines = volumeText
    ? doc.splitTextToSize(volumeText, col5W - 2 * boxPadding)
    : [];

  const cargoColumns: CargoColumnDef[] = [
    { x: col1X, width: col1W, lines: marksLines },
    { x: col2X, width: col2W, lines: packagesLines },
    {
      x: col3X,
      width: col3W,
      lines: descriptionLines,
      fontSize: FONT_CARGO_DESCRIPTION,
      lineHeight: CARGO_DESCRIPTION_LINE_HEIGHT,
    },
    { x: col4X, width: col4W, lines: grossWeightLines },
    { x: col5X, width: col5W, lines: volumeLines },
  ];

  const firstPageDataTopY = firstPageHeaderLayout.dataTopY;
  const continuationDataTopY = continuationHeaderLayout.dataTopY;
  const fullPageDataBottomY = pageHeight - PAGE_MARGIN_TOP - 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(FONT_TABLE_BODY);
  const cargoBodyFontHeight = getFontLineHeight(doc, FONT_TABLE_BODY);
  doc.setFontSize(FONT_CARGO_DESCRIPTION);
  const cargoDescriptionFontHeight = getFontLineHeight(
    doc,
    FONT_CARGO_DESCRIPTION,
  );
  const getColumnFontHeight = (col: CargoColumnDef) =>
    col.fontSize === FONT_CARGO_DESCRIPTION
      ? cargoDescriptionFontHeight
      : cargoBodyFontHeight;

  const freightFooterLayout = measureFreightFooterLayout(
    doc,
    middleTableEndY,
    innerWidth,
    boxPadding,
    packagesInWords,
  );
  const {
    wordsRowY,
    tempRowY,
    wordsRowHeight,
    tempRowHeight,
    wordsTitleOffsetY,
    wordsValueOffsetY,
    freightTitleOffsetY,
  } = freightFooterLayout;

  const resolveFinalCargoFooterLayout = (headerBottomY: number) => {
    const footerTableStartYLocal =
      pageHeight - PRINT_SAFE_BOTTOM_MARGIN - footerTableHeight;
    const middleTableEndYLocal = footerTableStartYLocal - TABLE_SEPARATION_GAP;
    const layout = measureFreightFooterLayout(
      doc,
      middleTableEndYLocal,
      innerWidth,
      boxPadding,
      packagesInWords,
    );
    return {
      middleTableEndY: middleTableEndYLocal,
      ...layout,
    };
  };

  const continuationFinalPageDataBottomY = resolveFinalCargoFooterLayout(
    continuationHeaderLayout.headerBottomY,
  ).wordsRowY;

  const pageBreaks = simulateCargoPageBreaks(
    cargoColumns,
    firstPageDataTopY,
    fullPageDataBottomY,
    continuationDataTopY,
    fullPageDataBottomY,
    wordsRowY,
    continuationFinalPageDataBottomY,
    getColumnFontHeight,
  );

  const drawCargoTableBorders = (
    tableTopY: number,
    tableBottomY: number,
    headerBottomY: number,
    dataBottomY: number,
    includeFooterRows: boolean,
    segmentWordsRowY: number,
    segmentTempRowY: number,
  ) => {
    drawBox(doc, innerMargin, tableTopY, innerWidth, tableBottomY - tableTopY);
    doc.line(
      innerMargin,
      headerBottomY,
      innerMargin + innerWidth,
      headerBottomY,
    );
    const columnBottomY = includeFooterRows ? segmentWordsRowY : dataBottomY;
    doc.line(col2X, tableTopY, col2X, columnBottomY);
    doc.line(col3X, tableTopY, col3X, columnBottomY);
    doc.line(col4X, tableTopY, col4X, columnBottomY);
    doc.line(col5X, tableTopY, col5X, columnBottomY);
    if (includeFooterRows) {
      doc.line(
        innerMargin,
        segmentWordsRowY,
        innerMargin + innerWidth,
        segmentWordsRowY,
      );
      doc.line(
        innerMargin,
        segmentTempRowY,
        innerMargin + innerWidth,
        segmentTempRowY,
      );
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
    const finalLayout = isLastSegment
      ? resolveFinalCargoFooterLayout(headerBottomY)
      : null;
    let segmentWordsRowY = finalLayout?.wordsRowY ?? wordsRowY;
    let segmentTempRowY = finalLayout?.tempRowY ?? tempRowY;
    const segmentMiddleTableEndY =
      finalLayout?.middleTableEndY ?? middleTableEndY;
    const segmentWordsRowHeight = finalLayout?.wordsRowHeight ?? wordsRowHeight;
    const segmentWordsTitleOffsetY =
      finalLayout?.wordsTitleOffsetY ?? wordsTitleOffsetY;
    const segmentWordsValueOffsetY =
      finalLayout?.wordsValueOffsetY ?? wordsValueOffsetY;
    const segmentFreightTitleOffsetY =
      finalLayout?.freightTitleOffsetY ?? freightTitleOffsetY;

    const plannedDataBottomY = isLastSegment
      ? segmentWordsRowY
      : fullPageDataBottomY;

    const endIndices = cargoColumns.map((col, i) => {
      const linesOnPage = countLinesThatFit(
        col.lines.length,
        startIndices[i],
        dataTopY,
        plannedDataBottomY,
        getColumnLineHeight(col),
        getColumnFontHeight(col),
      );
      return startIndices[i] + linesOnPage;
    });

    let cargoBodyBottomY = plannedDataBottomY;
    if (isLastSegment) {
      // Keep words + Freight rows compact at the bottom of the middle table so
      // Marks & Numbers keeps maximum height (do not collapse upward into freight).
      const segmentTempRowHeight = finalLayout?.tempRowHeight ?? tempRowHeight;
      segmentTempRowY = segmentMiddleTableEndY - segmentTempRowHeight;
      segmentWordsRowY = segmentTempRowY - segmentWordsRowHeight;
      cargoBodyBottomY = segmentWordsRowY;
    }

    const tableBottomY = isLastSegment
      ? segmentMiddleTableEndY
      : plannedDataBottomY;

    drawCargoTableBorders(
      tableTopY,
      tableBottomY,
      headerBottomY,
      cargoBodyBottomY,
      isLastSegment,
      segmentWordsRowY,
      segmentTempRowY,
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(FONT_TABLE_BODY);

    cargoColumns.forEach((col, colIndex) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(col.fontSize ?? FONT_TABLE_BODY);
      const lineHeight = getColumnLineHeight(col);
      const textMaxWidth = col.width - 2 * boxPadding;
      let lineY = dataTopY;
      for (let i = startIndices[colIndex]; i < endIndices[colIndex]; i += 1) {
        doc.text(col.lines[i], col.x + boxPadding, lineY, {
          maxWidth: textMaxWidth,
        });
        lineY += lineHeight;
      }
    });

    // SEAWAY BILL / SURRENDERED — red, center-aligned in Description of Goods column
    if (isLastSegment && cargoTypeLabel) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(255, 0, 0);
      doc.text(
        cargoTypeLabel,
        col3X + col3W / 2,
        cargoBodyBottomY - 4,
        { align: "center" },
      );
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(FONT_TABLE_BODY);
    }

    if (isLastSegment) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(FONT_TABLE_HEAD);
      doc.text(
        "Total Number of Containers of Packages(in words)",
        col1X + boxPadding,
        segmentWordsRowY + segmentWordsTitleOffsetY,
      );
      doc.setFont("helvetica", "normal");
      doc.setFontSize(FONT_TABLE_BODY);
      if (packagesInWords) {
        doc.text(
          packagesInWords,
          col1X + boxPadding,
          segmentWordsRowY + segmentWordsValueOffsetY,
          {
            maxWidth: innerWidth - 2 * boxPadding,
          },
        );
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(FONT_TABLE_HEAD);
      doc.text(
        "Freight and Charges",
        col1X + boxPadding,
        segmentTempRowY + segmentFreightTitleOffsetY,
      );
    }
  };

  const cargoSegments =
    pageBreaks.length > 0 ? pageBreaks : [cargoColumns.map(() => 0)];
  // Draft / SEAWAY / SURRENDER stay on one page (same as India BOL variants).
  const segmentsToDraw = isSinglePageBol
    ? [cargoSegments[0]]
    : cargoSegments;
  segmentsToDraw.forEach((startIndices, segmentIndex) => {
    drawCargoPageSegment(
      segmentIndex,
      startIndices,
      segmentIndex === segmentsToDraw.length - 1,
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
  const signedByY = footerBoxBottomY - SIGNED_BY_BOTTOM_PAD - signedLineHeight;
  const carrierY = signedByY - CARRIER_TO_SIGNED_GAP - carrierLineHeight;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(FONT_LEGAL_BODY);
  doc.text(legalLines, innerMargin + boxPadding, legalY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(FONT_TABLE_BODY);
  doc.text(
    templateOnly ? "Carrier:" : `Carrier: ${companyName}`,
    innerMargin + boxPadding,
    carrierY,
  );

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
