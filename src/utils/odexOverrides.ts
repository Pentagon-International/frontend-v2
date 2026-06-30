export type OdexOverrideHousingInput = {
  hbl_number?: string;
  cargo_details?: Array<{
    container_no?: string | number | null;
    container_id?: number | null;
  } | null>;
};

export type OdexOverrideMblContainer = {
  container_no?: string;
  container_type?: string;
};

export type OdexContainerOverrideFormValue = {
  soc_flag: string;
  iso_code: string;
};

export const ODEX_SOC_FLAG_OPTIONS = [
  { value: "Yes", label: "Yes" },
  { value: "No", label: "No" },
] as const;

export const ODEX_ISO_CODE_OPTIONS = [
  { value: "20DC - 2000", label: "20DC - 2000" },
  { value: "20GP - 2020", label: "20GP - 2020" },
  { value: "20GP - 2022", label: "20GP - 2022" },
  { value: "20RF - 2030", label: "20RF - 2030" },
  { value: "20FR - 2060", label: "20FR - 2060" },
  { value: "20FR - 2061", label: "20FR - 2061" },
  { value: "20FR - 2063", label: "20FR - 2063" },
  { value: "20TK - 2070", label: "20TK - 2070" },
  { value: "20TK - 2075", label: "20TK - 2075" },
  { value: "20TK - 2079", label: "20TK - 2079" },
  { value: "20GP - 2200", label: "20GP - 2200" },
  { value: "20GP - 2210", label: "20GP - 2210" },
  { value: "20RF - 2230", label: "20RF - 2230" },
  { value: "20RF - 2231", label: "20RF - 2231" },
  { value: "20RF - 2232", label: "20RF - 2232" },
  { value: "20OT - 2250", label: "20OT - 2250" },
  { value: "20OT - 2251", label: "20OT - 2251" },
  { value: "20GP - 2254", label: "20GP - 2254" },
  { value: "20FR - 2260", label: "20FR - 2260" },
  { value: "20FL - 2261", label: "20FL - 2261" },
  { value: "20TK - 2270", label: "20TK - 2270" },
  { value: "20GP - 2280", label: "20GP - 2280" },
  { value: "20HC - 2510", label: "20HC - 2510" },
  { value: "4HDC - 4000", label: "4HDC - 4000" },
  { value: "40DC - 4022", label: "40DC - 4022" },
  { value: "40GP - 4200", label: "40GP - 4200" },
  { value: "40GP - 4210", label: "40GP - 4210" },
  { value: "40GP - 4220", label: "40GP - 4220" },
  { value: "40RF - 4230", label: "40RF - 4230" },
  { value: "40OT - 4250", label: "40OT - 4250" },
  { value: "40OT - 4251", label: "40OT - 4251" },
  { value: "40GP - 4254", label: "40GP - 4254" },
  { value: "40FR - 4260", label: "40FR - 4260" },
  { value: "40FL - 4261", label: "40FL - 4261" },
  { value: "40FT - 4262", label: "40FT - 4262" },
  { value: "40FR - 4263", label: "40FR - 4263" },
  { value: "40TK - 4270", label: "40TK - 4270" },
  { value: "40TK - 4275", label: "40TK - 4275" },
  { value: "40TK - 4279", label: "40TK - 4279" },
  { value: "40HC - 4400", label: "40HC - 4400" },
  { value: "40HQ - 4410", label: "40HQ - 4410" },
  { value: "40RH - 4430", label: "40RH - 4430" },
  { value: "40RQ - 4431", label: "40RQ - 4431" },
  { value: "40OQ - 4451", label: "40OQ - 4451" },
  { value: "40FQ - 4461", label: "40FQ - 4461" },
  { value: "40FT - 4470", label: "40FT - 4470" },
  { value: "40HC - 4500", label: "40HC - 4500" },
  { value: "40HC - 4510", label: "40HC - 4510" },
  { value: "40RF - 4530", label: "40RF - 4530" },
  { value: "40RF - 4532", label: "40RF - 4532" },
  { value: "40FT - 4550", label: "40FT - 4550" },
  { value: "40RF - 4630", label: "40RF - 4630" },
  { value: "40OT - 9250", label: "40OT - 9250" },
  { value: "40FR - 9263", label: "40FR - 9263" },
  { value: "45HC - 9400", label: "45HC - 9400" },
  { value: "45HQ - 9410", label: "45HQ - 9410" },
] as const;

export function validateOdexOverrideForm(
  mobileNo: string,
  containerKeys: string[],
  form: Record<string, OdexContainerOverrideFormValue>,
): string | null {
  if (!mobileNo.trim()) {
    return "Requester mobile number is required.";
  }
  if (containerKeys.length === 0) {
    return "Add MBL container numbers before pushing to Odex.";
  }
  for (const key of containerKeys) {
    const values = form[key];
    if (!values?.soc_flag?.trim()) {
      return "Soc Flag is required for all containers.";
    }
    if (!values?.iso_code?.trim()) {
      return "Iso code is required for all containers.";
    }
  }
  return null;
}

export function odexOverrideContainerKey(containerNo: string): string {
  return String(containerNo ?? "").trim();
}

function buildContainerOverrideEntry(
  input: OdexContainerOverrideFormValue | undefined,
): Record<string, string> {
  const socFlag = input?.soc_flag?.trim();
  const isoCode = input?.iso_code?.trim();

  if (!socFlag && !isoCode) {
    return {};
  }

  const entry: Record<string, string> = {};
  if (socFlag) entry.soc_flag = socFlag;
  if (isoCode) entry.iso_code = isoCode;
  return entry;
}

export function getHouseCargoMaxIndex(
  cargos: OdexOverrideHousingInput["cargo_details"],
): number {
  if (!cargos?.length) return -1;
  return cargos.reduce((max, _, index) => Math.max(max, index), cargos.length - 1);
}

export function buildOdexOverridesPayload(
  mobileNo: string,
  housingDetails: OdexOverrideHousingInput[],
  form: Record<string, OdexContainerOverrideFormValue>,
): Record<string, unknown> {
  const hbl = housingDetails.map((house) => {
    const cargos = house.cargo_details ?? [];
    const maxIndex = getHouseCargoMaxIndex(cargos);
    const container_details: Array<Record<string, string>> = [];

    for (let cargoIndex = 0; cargoIndex <= maxIndex; cargoIndex++) {
      const cargo = cargos[cargoIndex];
      if (!cargo) {
        container_details.push({});
        continue;
      }

      const containerNo = String(cargo.container_no ?? "").trim();
      const input = containerNo
        ? form[odexOverrideContainerKey(containerNo)]
        : undefined;
      container_details.push(buildContainerOverrideEntry(input));
    }

    return { container_details };
  });

  return {
    mbl: { mobile_no: mobileNo.trim() },
    hbl,
  };
}
