import cctLogo from "../assets/images/cct.png";

export const CCT_PULSE_ID = "P2CCT";

export const CCT_BRANCH_INFO = {
  name: "CARGO CONTAINER TERMINAL INDIA PRIVATE LIMITED",
  address:
    "UNIT NO - 101 & 102, SATELLITE SILVER CO OP PREMISES SOCIETY LTD, ANDHERI KURLA ROAD, MAROL NAKA, ANDHERI EAST, MUMBAI, MAHARASHTRA - 400059, INDIA",
  tel: "",
  email: "",
  pan: "",
  gstn: "",
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

const formatCctReportingAddress = (address: string): string =>
  address.replace(/\s*,\s*(?=PAN\s*No\s*:)/i, "\n");

/** Prefer login branch reporting_name / reporting_address for P2CCT PDFs. */
export const getCctBranchInfoFromLogin = (): typeof CCT_BRANCH_INFO => {
  try {
    const userStr = localStorage.getItem("user");
    if (!userStr) return { ...CCT_BRANCH_INFO };

    const user = JSON.parse(userStr);
    if (String(user?.pulse_id ?? "").trim().toUpperCase() !== CCT_PULSE_ID) {
      return { ...CCT_BRANCH_INFO };
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

    return {
      ...CCT_BRANCH_INFO,
      name: reportingName || CCT_BRANCH_INFO.name,
      address: reportingAddress
        ? formatCctReportingAddress(reportingAddress)
        : CCT_BRANCH_INFO.address,
      tel: defaultBranch?.tel || CCT_BRANCH_INFO.tel,
      email: defaultBranch?.email || CCT_BRANCH_INFO.email,
      pan: defaultBranch?.pan || CCT_BRANCH_INFO.pan,
      gstn: defaultBranch?.gstn || CCT_BRANCH_INFO.gstn,
    };
  } catch {
    return { ...CCT_BRANCH_INFO };
  }
};
