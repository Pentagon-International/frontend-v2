import { generateCargoArrivalNoticePDF } from "./CargoArrivalNoticePDFTemplate";
import { resolveCanSacWiseTotals } from "./canGstBreakup";
import type { UserCountryProfile } from "../../../utils/userNumberFormat";

export async function previewCargoArrivalNoticePDF(
  jobData: unknown,
  hawbData: { shipment_id?: string | null } & Record<string, unknown>,
  defaultBranch: unknown,
  country?: UserCountryProfile,
): Promise<string> {
  const sacWiseTotals = await resolveCanSacWiseTotals(
    country,
    hawbData?.shipment_id,
  );
  return generateCargoArrivalNoticePDF(
    jobData,
    hawbData,
    defaultBranch,
    country,
    sacWiseTotals,
  );
}
