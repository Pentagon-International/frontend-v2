import { QueryClient } from "@tanstack/react-query";

// Global query client reference
let globalQueryClient: QueryClient | null = null;

export const setGlobalQueryClient = (client: QueryClient) => {
  globalQueryClient = client;
};

export const getGlobalQueryClient = (): QueryClient | null => {
  return globalQueryClient;
};

export const invalidateBranchRelatedQueries = () => {
  if (!globalQueryClient) {
    console.warn("Query client not available for invalidation");
    return;
  }

  // Invalidate all queries related to branch-dependent data
  const queryKeysToInvalidate = [
    // Call Entry related queries
    ["callEntries"],
    ["filteredCallEntries"],

    // Enquiry related queries
    ["enquiries"],
    ["filteredEnquiries"],

    // Quotation related queries
    ["quotations"],
    ["filteredQuotations"],

    // Customer data queries (since they might be branch-specific)
    ["customers"],
    ["filteredCustomers"],

    // Any other branch-dependent queries
    ["customerData"],
  ];

  queryKeysToInvalidate.forEach((queryKey) => {
    globalQueryClient!.invalidateQueries({ queryKey });
  });

  console.log("Branch-related queries invalidated");
};
