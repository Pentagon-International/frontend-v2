export const INLAND_IMPORT_JOB_SERVICE = "INLAND" as const;
export const INLAND_IMPORT_JOB_SERVICE_TYPE = "IMPORT" as const;

export type InlandImportJobServiceFields = {
  service: typeof INLAND_IMPORT_JOB_SERVICE;
  service_code: string;
  service_type: typeof INLAND_IMPORT_JOB_SERVICE_TYPE;
  service_name: string;
};

/** Normalize inland import job service fields from API/list/detail records. */
export function resolveInlandImportJobServiceFields(
  record?: Record<string, unknown> | null,
): InlandImportJobServiceFields {
  const raw = record ?? {};
  return {
    service: INLAND_IMPORT_JOB_SERVICE,
    service_code: String(raw.service_code ?? raw.service_id ?? "").trim(),
    service_type: INLAND_IMPORT_JOB_SERVICE_TYPE,
    service_name: String(raw.service_name ?? "").trim(),
  };
}

export function withInlandImportJobServiceFields<
  T extends Record<string, unknown>,
>(record: T): T & InlandImportJobServiceFields {
  return { ...record, ...resolveInlandImportJobServiceFields(record) };
}

/** Base-level service payload for job-create create/edit. */
export function buildInlandImportJobServicePayload(serviceCode: string): Pick<
  InlandImportJobServiceFields,
  "service" | "service_code" | "service_type"
> {
  return {
    service: INLAND_IMPORT_JOB_SERVICE,
    service_code: String(serviceCode ?? "").trim(),
    service_type: INLAND_IMPORT_JOB_SERVICE_TYPE,
  };
}
