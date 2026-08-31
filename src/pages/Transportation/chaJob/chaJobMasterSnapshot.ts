/** CHA service fields to preserve across house-create navigation. */
export type ChaServiceFormFields = {
  service?: string;
  service_code?: string;
  service_id?: string;
};

export function pickChaServiceFormFields(
  values: ChaServiceFormFields,
): ChaServiceFormFields {
  return {
    service: values.service || "",
    service_code: values.service_code || "",
    service_id: values.service_id || "",
  };
}

export function readChaServiceFormFields(
  source: ChaServiceFormFields | null | undefined,
): ChaServiceFormFields {
  if (!source) {
    return { service: "", service_code: "", service_id: "" };
  }
  return {
    service: source.service || "",
    service_code: source.service_code || "",
    service_id:
      source.service_id != null ? String(source.service_id) : "",
  };
}
