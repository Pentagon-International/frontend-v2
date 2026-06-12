export const INLAND_EXPORT_JOB_SERVICE = "INLAND" as const;
export const INLAND_EXPORT_JOB_SERVICE_TYPE = "EXPORT" as const;

export type InlandExportJobServiceFields = {
  service: typeof INLAND_EXPORT_JOB_SERVICE;
  service_code: string;
  service_type: typeof INLAND_EXPORT_JOB_SERVICE_TYPE;
  service_name: string;
};

/** Normalize inland export job service fields from API/list/detail records. */
export function resolveInlandExportJobServiceFields(
  record?: Record<string, unknown> | null,
): InlandExportJobServiceFields {
  const raw = record ?? {};
  return {
    service: INLAND_EXPORT_JOB_SERVICE,
    service_code: String(raw.service_code ?? raw.service_id ?? "").trim(),
    service_type: INLAND_EXPORT_JOB_SERVICE_TYPE,
    service_name: String(raw.service_name ?? "").trim(),
  };
}

export function withInlandExportJobServiceFields<
  T extends Record<string, unknown>,
>(record: T): T & InlandExportJobServiceFields {
  return { ...record, ...resolveInlandExportJobServiceFields(record) };
}

/** Base-level service payload for job-create create/edit. */
export function buildInlandExportJobServicePayload(serviceCode: string): Pick<
  InlandExportJobServiceFields,
  "service" | "service_code" | "service_type"
> {
  return {
    service: INLAND_EXPORT_JOB_SERVICE,
    service_code: String(serviceCode ?? "").trim(),
    service_type: INLAND_EXPORT_JOB_SERVICE_TYPE,
  };
}
