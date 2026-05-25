import { URL } from "../../../../api/serverUrls";
import { getAPICall } from "../../../../service/getApiCall";
import { API_HEADER } from "../../../../store/storeKeys";

export type BranchMasterListItem = {
  branch_code: string;
  branch_name: string;
};

type BranchMasterListResponse = {
  success?: boolean;
  data?: BranchMasterListItem[];
  total?: number;
  index?: number;
  limit?: number;
};

export async function fetchBranchMasterList(params?: {
  index?: number;
  limit?: number;
  search?: string;
}): Promise<BranchMasterListItem[]> {
  const index = params?.index ?? 0;
  const limit = params?.limit ?? 25;
  const query = new URLSearchParams({
    index: String(index),
    limit: String(limit),
  });
  if (params?.search?.trim()) {
    query.append("search", params.search.trim());
  }

  const url = `${URL.branchMaster}?${query.toString()}`;
  const response = (await getAPICall(url, API_HEADER)) as
    | BranchMasterListResponse
    | BranchMasterListItem[];

  if (Array.isArray(response)) return response;
  if (response?.data && Array.isArray(response.data)) return response.data;
  return [];
}

export function branchMasterToSelectOption(item: BranchMasterListItem): {
  value: string;
  label: string;
} {
  const code = String(item.branch_code ?? "").trim();
  const name = String(item.branch_name ?? "").trim();
  return {
    value: code,
    label: name && code ? `${name} - ${code}` : code || name,
  };
}
