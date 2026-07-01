import { URL } from "../../../api/serverUrls";
import { getAPICall } from "../../../service/getApiCall";
import { postAPICall } from "../../../service/postApiCall";
import { API_HEADER } from "../../../store/storeKeys";

export type DocumentTypeMasterRow = {
  id?: number;
  document_type_id?: number;
  code?: string;
  document_type_code?: string;
  name?: string;
  document_type_name?: string;
};

export type MakerCheckerListFilters = {
  maker_id: string;
  checker_id: string;
  document_type_ids: string[];
  branch_code: string;
};

export type MakerCheckerMappingRecord = {
  sno?: number;
  id?: number;
  maker_id?: number;
  maker_ids?: number[];
  maker_name?: string;
  makers?: Array<{
    id?: number;
    user_name?: string;
    maker_name?: string;
  }>;
  checker_id?: number;
  checker_name?: string;
  document_types?: Array<{
    id?: number;
    document_type_id?: number;
    document_type_code?: string;
    document_type_name?: string;
  }>;
  branch_code?: string;
  limit_amount?: string | number;
  status?: string;
};

/** User master `id` is the value sent as maker_ids / checker_id in API payloads. */
export function formatUserMasterSelectOption(item: Record<string, unknown>): {
  value: string;
  label: string;
} {
  return {
    value: String(item.id ?? ""),
    label: String(item.user_name ?? ""),
  };
}

export function documentTypeIdsFromRecord(
  record?: MakerCheckerMappingRecord | null,
): string[] {
  if (!record?.document_types?.length) return [];
  return record.document_types
    .map((dt) => String(dt.document_type_id ?? dt.id ?? ""))
    .filter(Boolean);
}

export function makerIdsFromRecord(
  record?: MakerCheckerMappingRecord | null,
): string[] {
  if (record?.maker_ids?.length) {
    return record.maker_ids.map((id) => String(id));
  }
  if (record?.maker_id != null) {
    return [String(record.maker_id)];
  }
  return [];
}

export function makerDisplayValuesFromRecord(
  record?: MakerCheckerMappingRecord | null,
): Record<string, string> {
  if (record?.makers?.length) {
    return Object.fromEntries(
      record.makers
        .filter((m) => m.id != null)
        .map((m) => [
          String(m.id),
          String(m.user_name ?? m.maker_name ?? m.id),
        ]),
    );
  }
  if (record?.maker_id != null) {
    return {
      [String(record.maker_id)]: String(record.maker_name ?? record.maker_id),
    };
  }
  return {};
}

export function documentTypeCodesLabel(
  record?: MakerCheckerMappingRecord | null,
): string {
  const codes =
    record?.document_types
      ?.map((dt) => dt.document_type_code)
      .filter((code): code is string => Boolean(code?.trim())) ?? [];
  return codes.length > 0 ? codes.join(", ") : "-";
}

type BranchMasterRow = {
  id?: number;
  branch_code?: string;
  branch_name?: string;
  status?: string;
};

export async function fetchBranchMasterOptions(): Promise<
  { value: string; label: string }[]
> {
  const response = (await getAPICall(
    `${URL.branchMaster}?index=0&limit=1000`,
    API_HEADER,
  )) as { data?: BranchMasterRow[] } | BranchMasterRow[];

  const rows = Array.isArray(response) ? response : (response?.data ?? []);

  return rows
    .map((branch) => {
      const code = String(branch.branch_code ?? "").trim();
      const name = String(branch.branch_name ?? "").trim();
      if (!code) return null;
      return {
        value: code,
        label: name ? `${code} - ${name}` : code,
      };
    })
    .filter((item): item is { value: string; label: string } => item != null);
}

export async function fetchDocumentTypeMasterIdOptions(): Promise<
  { value: string; label: string }[]
> {
  const response = await postAPICall(
    URL.documentTypeMasterFilter,
    { filters: {} },
    API_HEADER,
  );
  const data =
    (response as { data?: DocumentTypeMasterRow[] })?.data ??
    (Array.isArray(response) ? response : []);

  return data
    .map((item) => {
      const id = item.id ?? item.document_type_id;
      const code = item.code ?? item.document_type_code ?? "";
      const name = item.name ?? item.document_type_name ?? "";
      if (id == null) return null;
      const label = name ? `${code} - ${name}` : code || String(id);
      return { value: String(id), label };
    })
    .filter((item): item is { value: string; label: string } => item != null);
}

export function buildMakerCheckerFilterPayload(
  filters: MakerCheckerListFilters,
  search: string,
): { filters: Record<string, unknown> } {
  const cleaned: Record<string, unknown> = {};

  if (filters.maker_id.trim()) {
    cleaned.maker_id = Number(filters.maker_id);
  }
  if (filters.checker_id.trim()) {
    cleaned.checker_id = Number(filters.checker_id);
  }
  if (filters.document_type_ids.length > 0) {
    cleaned.document_type_ids = filters.document_type_ids.map((id) =>
      Number(id),
    );
  }
  if (filters.branch_code.trim()) {
    cleaned.branch_code = filters.branch_code.trim();
  }
  if (search.trim()) {
    cleaned.search = search.trim();
  }

  return { filters: cleaned };
}
