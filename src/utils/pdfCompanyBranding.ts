import type { jsPDF } from "jspdf";
import cctLogo from "../assets/images/cct.png";

export const CCT_PULSE_ID = "P2CCT";

export type CctHeaderTitle = {
  label: string;
  value: string;
};

export const CCT_BRANCH_INFO = {
  name: "CARGO CONTAINER TERMINAL INDIA PRIVATE LIMITED",
  address:
    "UNIT NO - 101 & 102, SATELLITE SILVER CO OP PREMISES SOCIETY LTD, ANDHERI KURLA ROAD, MAROL NAKA, ANDHERI EAST, MUMBAI, MAHARASHTRA - 400059, INDIA",
  tel: "",
  email: "",
  pan: "",
  gstn: "",
  headerTitles: [] as CctHeaderTitle[],
};

export const getUserPulseId = (): string => {
  try {
    const userStr = localStorage.getItem("user");
    if (!userStr) return "";
    const user = JSON.parse(userStr);
    return String(user?.pulse_id ?? "").trim().toUpperCase();
  } catch {
    return "";
  }
};

export const isCctCompany = (): boolean =>
  getUserPulseId() === CCT_PULSE_ID;

export const getCctLogo = (): string => cctLogo;

const CCT_HEADER_LABELS: { label: string; pattern: string; keys: string[] }[] = [
  {
    label: "Tel",
    pattern: "Telephone|Phone\\s*No\\.?|Tel\\s*No\\.?|Phone|Tel",
    keys: ["tel", "telephone", "phone"],
  },
  {
    label: "Email",
    pattern: "E-?\\s*mail(?:\\s*Id)?|Email",
    keys: ["email"],
  },
  { label: "PAN", pattern: "PAN\\s*No\\.?|PAN", keys: ["pan", "pan_no"] },
  {
    label: "GST",
    pattern: "GSTIN|GSTN|GST\\s*No\\.?|GST",
    keys: ["gstn", "gst_no", "gstin", "gst"],
  },
  { label: "MSME", pattern: "MSME\\s*No\\.?|MSME", keys: ["msme_no", "msme"] },
  { label: "TAN", pattern: "TAN\\s*No\\.?|TAN", keys: ["tan_no", "tan"] },
  { label: "CIN", pattern: "CIN\\s*No\\.?|CIN", keys: ["cin_no", "cin"] },
];

/** Document titles and address labels (PAN, GST, Tel, Email, and the rest). Body text stays black. */
export const PDF_HEADING_COLOR: [number, number, number] = [0x1a, 0x2e, 0x4a];
const DO_CAN_TITLE_COLOR = PDF_HEADING_COLOR;

const CCT_HEADER_LABEL_PATTERN = CCT_HEADER_LABELS.map((item) => item.pattern).join(
  "|",
);

const canonicalCctHeaderLabel = (raw: string): string => {
  const label = raw.trim();
  const match = CCT_HEADER_LABELS.find((item) =>
    new RegExp(`^(?:${item.pattern})$`, "i").test(label),
  );
  return match?.label ?? label;
};

const readBranchText = (
  branch: Record<string, unknown> | null | undefined,
  keys: string[],
): string => {
  if (!branch) return "";
  for (const key of keys) {
    const value = branch[key];
    if (typeof value === "boolean" || value == null) continue;
    const text = String(value).trim();
    if (text && text.toLowerCase() !== "null") return text;
  }
  return "";
};

/** Split a reporting address into the street address and labeled titles under it. */
export const splitCctAddressAndTitles = (
  raw: string,
): { address: string; titles: CctHeaderTitle[] } => {
  const source = String(raw ?? "");
  const matcher = new RegExp(
    `(?:^|[^A-Za-z0-9])(${CCT_HEADER_LABEL_PATTERN})\\s*[:：.]?\\s*`,
    "gi",
  );
  const matches = [...source.matchAll(matcher)];
  if (matches.length === 0) {
    return { address: source.trim(), titles: [] };
  }

  const firstIndex = matches[0].index ?? 0;
  const address = source
    .slice(0, firstIndex)
    .replace(/[\s,;|·•]+$/g, "")
    .trim();

  const titles: CctHeaderTitle[] = [];
  matches.forEach((match, index) => {
    const valueStart = (match.index ?? 0) + match[0].length;
    const valueEnd =
      index + 1 < matches.length
        ? (matches[index + 1].index ?? source.length)
        : source.length;
    const value = source
      .slice(valueStart, valueEnd)
      .replace(/[\s,;|·•]+$/g, "")
      .trim();
    if (!value) return;
    titles.push({
      label: canonicalCctHeaderLabel(match[1] || ""),
      value,
    });
  });

  return { address, titles };
};

const buildCctHeaderTitles = (
  branch: Record<string, unknown> | null | undefined,
  reportingAddress: string,
): { address: string; titles: CctHeaderTitle[] } => {
  const parsed = splitCctAddressAndTitles(reportingAddress);
  const values = new Map<string, string>();

  CCT_HEADER_LABELS.forEach((item) => {
    const fromBranch = readBranchText(branch, item.keys);
    if (fromBranch) values.set(item.label, fromBranch);
  });
  parsed.titles.forEach((item) => {
    if (item.value) values.set(item.label, item.value);
  });

  const titles = CCT_HEADER_LABELS.map((item) => ({
    label: item.label,
    value: values.get(item.label) || "",
  })).filter((item) => item.value);

  return {
    address: parsed.address,
    titles,
  };
};

const titleValue = (titles: CctHeaderTitle[], label: string): string =>
  titles.find((item) => item.label === label)?.value || "";

const layoutCctHeaderTitleRows = (
  doc: jsPDF,
  titles: CctHeaderTitle[],
  maxWidth: number,
  fontSize: number,
): CctHeaderTitle[][] => {
  const rows: CctHeaderTitle[][] = [];
  let row: CctHeaderTitle[] = [];
  let rowWidth = 0;
  const separator = " · ";

  doc.setFontSize(fontSize);
  titles.forEach((item) => {
    doc.setFont("helvetica", "bold");
    const labelWidth = doc.getTextWidth(`${item.label}: `);
    doc.setFont("helvetica", "normal");
    const valueWidth = doc.getTextWidth(item.value);
    const separatorWidth = row.length > 0 ? doc.getTextWidth(separator) : 0;
    const itemWidth = separatorWidth + labelWidth + valueWidth;

    if (row.length > 0 && rowWidth + itemWidth > maxWidth) {
      rows.push(row);
      row = [item];
      rowWidth = labelWidth + valueWidth;
      return;
    }

    row.push(item);
    rowWidth += itemWidth;
  });

  if (row.length > 0) rows.push(row);
  return rows;
};

const drawHeaderTitleLabel = (
  doc: jsPDF,
  label: string,
  x: number,
  y: number,
): number => {
  const labelText = `${label}: `;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DO_CAN_TITLE_COLOR);
  doc.text(labelText, x, y);
  const labelWidth = doc.getTextWidth(labelText);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  return labelWidth;
};

/** Bold colored title, regular black value. Used under the DO and CAN company address. */
export const drawDoCanHeaderContacts = (
  doc: jsPDF,
  branchInfo: {
    tel?: string;
    email?: string;
    pan?: string;
    gstn?: string;
    headerTitles?: CctHeaderTitle[];
  },
  x: number,
  y: number,
  maxWidth: number,
  fontSize: number,
  lineHeight: number,
): number => {
  const titles = branchInfo.headerTitles ?? [];
  doc.setFontSize(fontSize);

  if (titles.length > 0) {
    const rows = layoutCctHeaderTitleRows(doc, titles, maxWidth, fontSize);
    const separator = " · ";
    rows.forEach((row) => {
      let cursorX = x;
      row.forEach((item, index) => {
        if (index > 0) {
          doc.setFont("helvetica", "normal");
          doc.setTextColor(0, 0, 0);
          doc.text(separator, cursorX, y);
          cursorX += doc.getTextWidth(separator);
        }
        cursorX += drawHeaderTitleLabel(doc, item.label, cursorX, y);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);
        doc.text(item.value, cursorX, y);
        cursorX += doc.getTextWidth(item.value);
      });
      y += lineHeight;
    });
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    return y;
  }

  const drawLabeled = (label: string, value: string, startX: number) => {
    const labelWidth = drawHeaderTitleLabel(doc, label, startX, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(value, startX + labelWidth, y);
    return labelWidth + doc.getTextWidth(value);
  };

  if (branchInfo.tel) {
    drawLabeled("Tel", branchInfo.tel, x);
    y += lineHeight;
  }

  if (branchInfo.email) {
    drawLabeled("Email", branchInfo.email, x);
    y += lineHeight;
  }

  const taxItems = [
    branchInfo.pan ? { label: "PAN NO", value: branchInfo.pan } : null,
    branchInfo.gstn ? { label: "GSTN", value: branchInfo.gstn } : null,
  ].filter(Boolean) as CctHeaderTitle[];

  if (taxItems.length > 0) {
    let cursorX = x;
    taxItems.forEach((item, index) => {
      if (index > 0) cursorX += 6;
      cursorX += drawLabeled(item.label, item.value, cursorX);
    });
    y += lineHeight;
  }

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  return y;
};

/** Prefer login branch reporting_name / reporting_address for P2CCT PDFs. */
export const getCctBranchInfoFromLogin = (): typeof CCT_BRANCH_INFO => {
  try {
    const userStr = localStorage.getItem("user");
    if (!userStr) return { ...CCT_BRANCH_INFO, headerTitles: [] };

    const user = JSON.parse(userStr);
    if (String(user?.pulse_id ?? "").trim().toUpperCase() !== CCT_PULSE_ID) {
      return { ...CCT_BRANCH_INFO, headerTitles: [] };
    }

    const branches = Array.isArray(user?.branches) ? user.branches : [];
    const defaultBranch =
      branches.find(
        (branch: { is_default?: boolean }) => branch?.is_default === true,
      ) || branches[0];

    const reportingName = String(defaultBranch?.reporting_name ?? "").trim();
    const reportingAddress = String(
      defaultBranch?.reporting_address ?? "",
    ).trim();
    const parsed = buildCctHeaderTitles(defaultBranch, reportingAddress);

    return {
      ...CCT_BRANCH_INFO,
      name: reportingName || CCT_BRANCH_INFO.name,
      address: parsed.address || CCT_BRANCH_INFO.address,
      tel: readBranchText(defaultBranch, ["tel", "telephone", "phone"]) ||
        titleValue(parsed.titles, "Tel") ||
        CCT_BRANCH_INFO.tel,
      email:
        readBranchText(defaultBranch, ["email"]) ||
        titleValue(parsed.titles, "Email") ||
        CCT_BRANCH_INFO.email,
      pan:
        readBranchText(defaultBranch, ["pan", "pan_no"]) ||
        titleValue(parsed.titles, "PAN") ||
        CCT_BRANCH_INFO.pan,
      gstn:
        readBranchText(defaultBranch, ["gstn", "gst_no", "gstin", "gst"]) ||
        titleValue(parsed.titles, "GST") ||
        CCT_BRANCH_INFO.gstn,
      headerTitles: parsed.titles,
    };
  } catch {
    return { ...CCT_BRANCH_INFO, headerTitles: [] };
  }
};
