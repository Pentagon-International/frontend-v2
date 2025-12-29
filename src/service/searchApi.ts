import { getAPICall } from "./getApiCall";
import { API_HEADER } from "../store/storeKeys";
import { URL } from "../api/serverUrls";

// Common search API interface
interface SearchAPIOptions {
  endpoint: string;
  query: string;
  abortSignal?: AbortSignal;
}

// Enhanced search API that handles common search patterns
export const commonSearchAPI = async ({
  endpoint,
  query,
  abortSignal: _abortSignal,
}: SearchAPIOptions) => {
  console.log("Common Search API - Query:", query, "Endpoint:", endpoint);

  try {
    // Check if endpoint already has query parameters
    const separator = endpoint.includes("?") ? "&" : "?";
    const response = await getAPICall(
      `${endpoint}${separator}search=${encodeURIComponent(query)}`,
      API_HEADER
    );

    console.log("Common Search API - Response:", response);

    // Handle different response formats
    if (Array.isArray(response)) {
      return response;
    } else if (response && typeof response === "object") {
      // Check for 'data' property (common format)
      if ("data" in response && Array.isArray(response.data)) {
        return response.data;
      }
      // Check for 'users' property (coordinator endpoint format)
      if ("users" in response && Array.isArray(response.users)) {
        return response.users;
      }
      // Check for 'results' property (pagination format)
      if ("results" in response && Array.isArray(response.results)) {
        return response.results;
      }
    }
    return [];
  } catch (error) {
    console.error("Common Search API Error:", error);
    throw error;
  }
};

// Specific search functions for common entities
export const searchCustomers = async (
  query: string,
  abortSignal?: AbortSignal
) => {
  return commonSearchAPI({
    endpoint: URL.customer,
    query,
    abortSignal,
  });
};

export const searchPorts = async (query: string, abortSignal?: AbortSignal) => {
  return commonSearchAPI({
    endpoint: URL.portMaster,
    query,
    abortSignal,
  });
};

// Legacy search API for backward compatibility (call-entry specific)
export const searchAPI = async (query: string, signal: AbortSignal) => {
  console.log("Legacy Query:", query);

  return commonSearchAPI({
    endpoint: URL.callEntry,
    query,
    abortSignal: signal,
  });
};
