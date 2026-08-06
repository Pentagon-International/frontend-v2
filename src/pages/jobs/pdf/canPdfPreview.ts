import { generateCargoArrivalNoticePDF } from "./CargoArrivalNoticePDFTemplate";
import { resolveCanSacWiseTotals } from "./canGstBreakup";
import {
  isIndianUserFromProfile,
  type UserCountryProfile,
} from "../../../utils/userNumberFormat";

export type PreviewCargoArrivalNoticeOptions = {
  showCharges?: boolean;
};

export async function previewCargoArrivalNoticePDF(
  jobData: unknown,
  hawbData: { shipment_id?: string | null } & Record<string, unknown>,
  defaultBranch: unknown,
  country?: UserCountryProfile,
  options?: PreviewCargoArrivalNoticeOptions,
): Promise<string> {
  const showCharges = options?.showCharges !== false;
  const sacWiseTotals =
    showCharges && isIndianUserFromProfile(country)
      ? await resolveCanSacWiseTotals(country, hawbData?.shipment_id)
      : [];
  return generateCargoArrivalNoticePDF(
    jobData,
    hawbData,
    defaultBranch,
    country,
    sacWiseTotals,
    { showCharges },
  );
}
