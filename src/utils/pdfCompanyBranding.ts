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
