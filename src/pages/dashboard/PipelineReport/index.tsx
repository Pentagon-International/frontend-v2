import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Text,
  Box,
  Group,
  Button,
  Tabs,
  SegmentedControl,
} from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import {
  getPipelineReportData,
  getPotentialCustomersData,
  getPotentialCustomersDataForProduct,
  getPotentialCustomersDataForRegional,
  getPipelineReportRegionalData,
  getPipelineReportProductData,
  updateExpectedProfit,
  PipelineReportFilters,
  PipelineReportItem,
  PipelineReportCustomerItem,
  PipelineReportRegionalItem,
  PipelineReportProductItem,
  PipelineReportProductSalespersonItem,
  PotentialCustomerItem,
} from "../../../service/dashboard.service";
import useAuthStore from "../../../store/authStore";
import { DetailedViewTable } from "../../../components";

interface PipelineReportProps {
  onBack?: () => void;
  initialState?: {
    drillLevel?: 0 | 1 | 2;
    selectedSalesperson?: string | null;
    selectedCustomer?: string | null;
    selectedColumnType?: string | null;
  };
  globalSearch?: string;
  fromDate?: Date | null;
  toDate?: Date | null;
}

const PipelineReport: React.FC<PipelineReportProps> = ({
  onBack,
  initialState,
  globalSearch,
  fromDate,
  toDate,
}) => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const isInitialMount = useRef(true);
  const isInitialMountForSearch = useRef(true);
  const isInitialMountForCalculation = useRef(true);
  const [drillLevel, setDrillLevel] = useState<0 | 1 | 2>(
    initialState?.drillLevel ?? 0
  );
  const [selectedSalesperson, setSelectedSalesperson] = useState<string | null>(
    initialState?.selectedSalesperson ?? null
  );
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(
    initialState?.selectedCustomer ?? null
  );
  const [selectedColumnType, setSelectedColumnType] = useState<string | null>(
    initialState?.selectedColumnType ?? null
  );
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  type PipelineSalespersonRow = {
    salesperson: string;
    potential: number;
    pipeline: number;
    gained: number;
    quote: number;
    expected: number;
    lost: number;
  };

  type PipelineCustomerRow = {
    customer_code: string;
    customer_name: string;
    potential: number;
    pipeline: number;
    gained: number;
    lost: number;
    quote: number;
    expected: number;
  };

  type PipelineSectorRow = {
    region: string;
    potential: number;
    pipeline: number;
    gained: number;
    lost: number;
    quote: number;
    expected: number;
    total: number;
  };

  type PipelineProductRow = {
    service: string; // Combined: "FCL Import", "FCL Export", etc.
    service_type: string;
    service_original?: string; // Original service value for click handling
    potential: number;
    pipeline: number;
    gained: number;
    lost: number;
    quote: number;
    expected: number;
  };

  type PipelineProductSalespersonRow = {
    salesperson: string;
    service: string; // Combined: "FCL Import", "FCL Export", etc.
    service_type: string;
    service_original?: string; // Original service value for click handling
    potential: number;
    pipeline: number;
    gained: number;
    lost: number;
    quote: number;
    expected: number;
  };

  type PipelineSectorSalespersonRow = {
    salesperson: string;
    potential: number;
    pipeline: number;
    gained: number;
    lost: number;
    quote: number;
    expected: number;
  };

  const [drilldownData, setDrilldownData] = useState<PipelineCustomerRow[]>([]);
  const [sectorDrilldownData, setSectorDrilldownData] = useState<
    PipelineCustomerRow[]
  >([]);
  const [sectorSalespersonData, setSectorSalespersonData] = useState<
    PipelineSalespersonRow[]
  >([]);
  const [productDrilldownData, setProductDrilldownData] = useState<
    PipelineCustomerRow[]
  >([]);
  const [productSalespersonData, setProductSalespersonData] = useState<
    PipelineProductSalespersonRow[]
  >([]);
  const [potentialCustomersData, setPotentialCustomersData] = useState<
    PotentialCustomerItem[]
  >([]);
  const [pipelineData, setPipelineData] = useState<PipelineSalespersonRow[]>(
    []
  );
  const [pipelineSummary, setPipelineSummary] = useState<{
    total_expected: number;
    total_potential: number;
    total_pipeline: number;
    total_quoted: number;
    total_gained: number;
    total_lost: number;
  } | null>(null);
  const [drilldownSummary, setDrilldownSummary] = useState<{
    total_expected: number;
    total_potential: number;
    total_pipeline: number;
    total_quoted: number;
    total_gained: number;
    total_lost: number;
  } | null>(null);
  const [sectorData, setSectorData] = useState<PipelineReportRegionalItem[]>(
    []
  );
  const [sectorSummary, setSectorSummary] = useState<{
    total_expected: number;
    total_potential: number;
    total_pipeline: number;
    total_quoted: number;
    total_gained: number;
    total_lost: number;
  } | null>(null);
  const [sectorSalespersonSummary, setSectorSalespersonSummary] = useState<{
    total_expected: number;
    total_potential: number;
    total_pipeline: number;
    total_quoted: number;
    total_gained: number;
    total_lost: number;
  } | null>(null);
  const [sectorDrilldownSummary, setSectorDrilldownSummary] = useState<{
    total_expected: number;
    total_potential: number;
    total_pipeline: number;
    total_quoted: number;
    total_gained: number;
    total_lost: number;
  } | null>(null);
  const [productData, setProductData] = useState<PipelineProductRow[]>([]);
  const [productSummary, setProductSummary] = useState<{
    total_expected: number;
    total_potential: number;
    total_pipeline: number;
    total_quoted: number;
    total_gained: number;
    total_lost: number;
  } | null>(null);
  const [productSalespersonSummary, setProductSalespersonSummary] = useState<{
    total_expected: number;
    total_potential: number;
    total_pipeline: number;
    total_quoted: number;
    total_gained: number;
    total_lost: number;
  } | null>(null);
  const [productDrilldownSummary, setProductDrilldownSummary] = useState<{
    total_expected: number;
    total_potential: number;
    total_pipeline: number;
    total_quoted: number;
    total_gained: number;
    total_lost: number;
  } | null>(null);
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [sectorLoading, setSectorLoading] = useState(false);
  const [sectorDrilldownLoading, setSectorDrilldownLoading] = useState(false);
  const [sectorSalespersonLoading, setSectorSalespersonLoading] =
    useState(false);
  const [productLoading, setProductLoading] = useState(false);
  const [productDrilldownLoading, setProductDrilldownLoading] = useState(false);
  const [productSalespersonLoading, setProductSalespersonLoading] =
    useState(false);
  const [cellEditLoading, setCellEditLoading] = useState(false);
  const [period, setPeriod] = useState<string>("current-month");
  const [calculation, setCalculation] = useState<"volume" | "no_of_shipments">(
    "volume"
  );
  const [sectorDrillLevel, setSectorDrillLevel] = useState<0 | 1 | 2>(0);
  const [productDrillLevel, setProductDrillLevel] = useState<0 | 1 | 2>(0);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [selectedServiceType, setSelectedServiceType] = useState<string | null>(
    null
  );
  const [activeTab, setActiveTab] = useState<string>("salesperson");

  // Helper function to convert service_type to title case (e.g., "IMPORT" -> "Import")
  const toTitleCase = (str: string): string => {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  };

  // Helper function to build date filter object
  const buildDateFilters = () => {
    const dateFilters: { date_from?: string; date_to?: string } = {};
    if (fromDate && toDate) {
      dateFilters.date_from = dayjs(fromDate).format("DD-MM-YYYY");
      dateFilters.date_to = dayjs(toDate).format("DD-MM-YYYY");
    }
    return dateFilters;
  };

  // Helper function to replace null/undefined values with '-' for display
  const transformNullValues = <T extends Record<string, any>>(
    data: T[]
  ): T[] => {
    return data.map((item) => {
      const transformed: any = {};
      Object.keys(item).forEach((key) => {
        const value = item[key];
        // For string fields, replace null/undefined/empty with '-'
        // For numeric fields, keep as is (0 is a valid value)
        if (value === null || value === undefined || value === "") {
          // Check if the key suggests it's a numeric field
          const numericKeys = [
            "potential",
            "pipeline",
            "gained",
            "lost",
            "quote",
            "expected",
            "total",
            "profit",
            "count",
            "id",
          ];
          const isNumericField = numericKeys.some((numKey) =>
            key.toLowerCase().includes(numKey)
          );
          transformed[key] = isNumericField ? 0 : "-";
        } else {
          transformed[key] = value;
        }
      });
      return transformed as T;
    });
  };

  // Load initial data or restore state
  useEffect(() => {
    if (initialState && initialState.drillLevel !== undefined) {
      // Restore state when coming back from navigation
      restorePipelineState(initialState);
    } else {
      // Load initial data on first mount
      loadPipelineData();
      loadSectorData();
      loadProductData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialState]);

  useEffect(() => {
    // Skip on initial mount
    if (isInitialMountForSearch.current) {
      isInitialMountForSearch.current = false;
      return;
    }

    const run = async () => {
      // Reload data based on current drill level
      if (drillLevel === 0) {
        loadPipelineData();
        loadSectorData();
        loadProductData();
        return;
      }

      if (drillLevel === 1 && selectedSalesperson) {
        loadPipelineData(selectedSalesperson);
        return;
      }

      if (drillLevel === 2 && selectedSalesperson && selectedColumnType) {
        const companyName = user?.company?.company_name || "";
        if (!companyName) return;

        const normalizedColumnType =
          selectedColumnType === "quote"
            ? "quoted_created"
            : selectedColumnType;

        const filters: PipelineReportFilters = {
          company: companyName,
          salesperson: selectedSalesperson,
          type: normalizedColumnType,
          // period, // Commented out - can be used in future case
          ...buildDateFilters(),
          ...(user?.pulse_id === "P2CCI" && { calculation }),
          ...(globalSearch &&
            globalSearch.trim() && { search: globalSearch.trim() }),
        };

        if (selectedCustomer) filters.customer_code = selectedCustomer;
        if (selectedSector) filters.region = selectedSector;
        if (selectedService) filters.service = selectedService;
        if (selectedServiceType)
          filters.service_type = toTitleCase(selectedServiceType);

        setDrilldownLoading(true);

        try {
          let response;
          if (selectedSector) {
            response = await getPotentialCustomersDataForRegional(filters);
          } else if (selectedService) {
            response = await getPotentialCustomersDataForProduct(filters);
          } else {
            response = await getPotentialCustomersData(filters);
          }

          setPotentialCustomersData(response.data);
        } catch (error) {
          console.error("Error reloading data with search:", error);
          setPotentialCustomersData([]);
        } finally {
          setDrilldownLoading(false);
        }
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalSearch, fromDate, toDate]);

  // Restore pipeline state based on drill level
  const restorePipelineState = async (state: {
    drillLevel?: 0 | 1 | 2;
    selectedSalesperson?: string | null;
    selectedCustomer?: string | null;
    selectedColumnType?: string | null;
  }) => {
    try {
      if (state.drillLevel === 0) {
        loadPipelineData();
      } else if (state.drillLevel === 1 && state.selectedSalesperson) {
        setDrillLevel(1);
        setSelectedSalesperson(state.selectedSalesperson);
        loadPipelineData(state.selectedSalesperson);
      } else if (
        state.drillLevel === 2 &&
        state.selectedSalesperson &&
        state.selectedColumnType &&
        state.selectedCustomer
      ) {
        // Restore level 2 - need to load both level 1 and level 2 data
        setDrillLevel(1);
        setSelectedSalesperson(state.selectedSalesperson);
        await loadPipelineData(state.selectedSalesperson);

        // Then load level 2 data
        setDrillLevel(2);
        setSelectedCustomer(state.selectedCustomer);
        setSelectedColumnType(state.selectedColumnType);
        setDrilldownLoading(true);

        try {
          const companyName = user?.company?.company_name || "";
          const filters: PipelineReportFilters = {
            company: companyName,
            salesperson: state.selectedSalesperson || "",
            type: state.selectedColumnType || "",
            // period, // Commented out - can be used in future case
            ...buildDateFilters(),
            ...(user?.pulse_id === "P2CCI" && { calculation }),
            ...(globalSearch &&
              globalSearch.trim() && { search: globalSearch.trim() }),
          };

          const response = await getPotentialCustomersData(filters);
          setPotentialCustomersData(transformNullValues(response.data || []));
        } catch (error) {
          console.error("Error loading financial column data:", error);
          setPotentialCustomersData([]);
        } finally {
          setDrilldownLoading(false);
        }
      }
    } catch (error) {
      console.error("Error restoring pipeline state:", error);
    }
  };

  const loadPipelineData = async (
    salesperson?: string,
    periodValue?: string
  ) => {
    try {
      if (salesperson) {
        setDrilldownLoading(true);
      } else {
        setInitialLoading(true);
      }

      const companyName = user?.company?.company_name || "";
      if (!companyName) return;

      const filters: PipelineReportFilters = {
        company: companyName,
        // period: periodValue || period, // Commented out - can be used in future case
        ...buildDateFilters(),
        ...(salesperson && { salesperson }),
        ...(globalSearch &&
          globalSearch.trim() && { search: globalSearch.trim() }),
        ...(user?.pulse_id === "P2CCI" && { calculation }),
      };

      const response = await getPipelineReportData(filters);

      if (salesperson) {
        // Drilldown data - map customer data with proper order and badge colors
        const customerData = (
          response.data as PipelineReportCustomerItem[]
        ).map((item) => ({
          customer_code: item.customer_code || "-",
          customer_name: item.customer_name || "-",
          potential: item.potential_profit || 0,
          pipeline: item.pipeline_profit || 0,
          gained: item.gained || 0,
          lost: item.lost || 0,
          quote: item.quoted_created || 0,
          expected: item.expected_profit || 0,
        }));
        setDrilldownData(customerData);
        // Store summary if available (only if no "type" in filters - not financial column drilldown)
        if (response.summary && !filters.type) {
          setDrilldownSummary(response.summary);
        } else {
          setDrilldownSummary(null);
        }
      } else {
        // Initial data - map salesperson data with badge colors
        const salespersonData = (response.data as PipelineReportItem[]).map(
          (item) => ({
            salesperson: item.salesperson || "-",
            potential: item.potential_profit || 0,
            pipeline: item.pipeline_profit || 0,
            gained: item.gained_profit || 0,
            lost: item.lost_profit || 0,
            quote: item.quoted_profit || 0,
            expected: item.expected_profit || 0,
          })
        );
        setPipelineData(salespersonData);
        // Store summary if available
        if (response.summary) {
          setPipelineSummary(response.summary);
        } else {
          setPipelineSummary(null);
        }
      }
    } catch (error) {
      console.error("Error loading pipeline data:", error);
    } finally {
      if (salesperson) {
        setDrilldownLoading(false);
      } else {
        setInitialLoading(false);
      }
    }
  };

  const loadSectorData = async (
    periodValue?: string,
    region?: string,
    type?: string
  ) => {
    try {
      if (region) {
        setSectorSalespersonLoading(true);
      } else {
        setSectorLoading(true);
      }
      const companyName = user?.company?.company_name || "";
      if (!companyName) return;

      const response = await getPipelineReportRegionalData({
        company: companyName,
        // period: periodValue || period, // Commented out - can be used in future case
        ...buildDateFilters(),
        ...(region && { region }),
        ...(type && { type }),
        ...(globalSearch &&
          globalSearch.trim() && { search: globalSearch.trim() }),
        ...(user?.pulse_id === "P2CCI" && { calculation }),
      });

      if (region) {
        // Drilldown data - check if it's salesperson data or customer data
        const data = response.data || [];
        if (data.length > 0) {
          // Check if it's salesperson data (has salesperson field)
          const firstItem = data[0];
          if ("salesperson" in firstItem) {
            const salespersonData = (
              data as unknown as PipelineReportItem[]
            ).map((item) => ({
              salesperson: item.salesperson || "-",
              potential: item.potential_profit || 0,
              pipeline: item.pipeline_profit || 0,
              gained: item.gained_profit || 0,
              lost: item.lost_profit || 0,
              quote: item.quoted_profit || 0,
              expected: item.expected_profit || 0,
            }));
            setSectorSalespersonData(salespersonData);
            // Store summary if available
            if (response.summary) {
              setSectorSalespersonSummary(response.summary);
            } else {
              setSectorSalespersonSummary(null);
            }
          } else if ("customer_code" in firstItem) {
            // Customer data - map field names correctly based on API response
            const customerData = (data as any[]).map((item) => ({
              customer_code: item.customer_code || "-",
              customer_name: item.customer_name || "-",
              potential: item.potential_profit || item.potential || 0,
              pipeline: item.pipeline_profit || item.pipeline || 0,
              gained: item.gained_profit || item.gained || 0,
              lost: item.lost_profit || item.lost || 0,
              quote:
                item.quoted_profit || item.quoted_created || item.quote || 0,
              expected: item.expected_profit || item.expected || 0,
            }));
            setSectorDrilldownData(customerData);
            // Store summary if available
            if (response.summary) {
              setSectorDrilldownSummary(response.summary);
            } else {
              setSectorDrilldownSummary(null);
            }
          }
        } else {
          setSectorSalespersonData([]);
          setSectorDrilldownData([]);
          setSectorSalespersonSummary(null);
          setSectorDrilldownSummary(null);
        }
      } else {
        const data = response.data || [];
        if (data.length > 0 && "region" in data[0]) {
          setSectorData(data as PipelineReportRegionalItem[]);
          // Store summary if available
          if (response.summary) {
            setSectorSummary(response.summary);
          } else {
            setSectorSummary(null);
          }
        } else {
          setSectorData([]);
          setSectorSummary(null);
        }
      }
    } catch (error) {
      console.error("Error loading sector pipeline data:", error);
      if (region) {
        setSectorSalespersonData([]);
        setSectorDrilldownData([]);
        setSectorSalespersonSummary(null);
        setSectorDrilldownSummary(null);
      } else {
        setSectorData([]);
        setSectorSummary(null);
      }
    } finally {
      if (region) {
        setSectorSalespersonLoading(false);
      } else {
        setSectorLoading(false);
      }
    }
  };

  const loadSectorCustomerData = async (
    salesperson: string,
    periodValue?: string,
    type?: string
  ) => {
    try {
      setSectorDrilldownLoading(true);
      const companyName = user?.company?.company_name || "";
      if (!companyName || !selectedSector) return;

      const response = await getPipelineReportRegionalData({
        company: companyName,
        // period: periodValue || period, // Commented out - can be used in future case
        ...buildDateFilters(),
        region: selectedSector,
        salesperson: salesperson,
        ...(type && { type }),
        ...(globalSearch &&
          globalSearch.trim() && { search: globalSearch.trim() }),
        ...(user?.pulse_id === "P2CCI" && { calculation }),
      });

      const data = response.data || [];

      if (data.length > 0) {
        // Check if response is customer data or salesperson data
        if ("customer_code" in data[0]) {
          // Customer data - map field names correctly based on API response
          const customerData = (data as any[]).map((item) => ({
            customer_code: item.customer_code || "-",
            customer_name: item.customer_name || "-",
            potential: item.potential_profit || item.potential || 0,
            pipeline: item.pipeline_profit || item.pipeline || 0,
            gained: item.gained_profit || item.gained || 0,
            lost: item.lost_profit || item.lost || 0,
            quote: item.quoted_profit || item.quoted_created || item.quote || 0,
            expected: item.expected_profit || item.expected || 0,
          }));
          setSectorDrilldownData(customerData);
          // Store summary if available
          if (response.summary) {
            setSectorDrilldownSummary(response.summary);
          } else {
            setSectorDrilldownSummary(null);
          }
        } else if ("salesperson" in data[0]) {
          // API returned salesperson data instead of customer data
          // This means we need to drill down further or the type filter affected the response
          console.warn(
            "API returned salesperson data instead of customer data - may need different approach"
          );
          // Still try to display it
          const salespersonData = (data as any[]).map((item) => ({
            salesperson: item.salesperson || "-",
            potential: item.potential_profit || item.potential || 0,
            pipeline: item.pipeline_profit || item.pipeline || 0,
            gained: item.gained_profit || item.gained || 0,
            lost: item.lost_profit || item.lost || 0,
            quote: item.quoted_profit || item.quoted_created || item.quote || 0,
            expected: item.expected_profit || item.expected || 0,
          }));
          // Set to salesperson data temporarily - this shouldn't happen in normal flow
          setSectorSalespersonData(salespersonData);
          setSectorDrilldownData([]);
          setSectorDrilldownSummary(null);
        } else {
          console.warn("Unknown data structure returned from API");
          setSectorDrilldownData([]);
          setSectorDrilldownSummary(null);
        }
      } else {
        console.warn("No customer data found - empty response");
        setSectorDrilldownData([]);
        setSectorDrilldownSummary(null);
      }
    } catch (error) {
      console.error("Error loading sector customer data:", error);
      setSectorDrilldownData([]);
    } finally {
      setSectorDrilldownLoading(false);
    }
  };

  const loadProductData = async (
    periodValue?: string,
    service?: string,
    serviceType?: string,
    type?: string
  ) => {
    try {
      if (service || serviceType) {
        setProductSalespersonLoading(true);
      } else {
        setProductLoading(true);
      }
      const companyName = user?.company?.company_name || "";
      if (!companyName) return;

      const response = await getPipelineReportProductData({
        company: companyName,
        // period: periodValue || period, // Commented out - can be used in future case
        ...buildDateFilters(),
        ...(service && { service }),
        ...(serviceType && { service_type: toTitleCase(serviceType) }),
        ...(type && { type }),
        ...(globalSearch &&
          globalSearch.trim() && { search: globalSearch.trim() }),
        ...(user?.pulse_id === "P2CCI" && { calculation }),
      });

      const data = response.data || [];
      if (data.length > 0) {
        // Check if it's salesperson data (has salesperson field)
        const firstItem = data[0];
        if ("salesperson" in firstItem) {
          const salespersonData = (
            data as PipelineReportProductSalespersonItem[]
          ).map((item) => ({
            salesperson: item.salesperson || "-",
            service: `${item.service || "-"} ${item.service_type || "-"}`, // Combined: "FCL Import", "FCL Export", etc.
            service_type: item.service_type || "-", // Keep for reference but will be hidden
            service_original: item.service || "-", // Store original service for click handling
            potential: item.potential_profit || 0,
            pipeline: item.pipeline_profit || 0,
            gained: item.gained_profit || 0,
            lost: item.lost_profit || 0,
            quote: item.quoted_profit || 0,
            expected: item.expected_profit || 0,
          }));
          setProductSalespersonData(salespersonData);
          setProductData([]); // Clear base data when showing salesperson data
          // Store summary if available
          if (response.summary) {
            setProductSalespersonSummary(response.summary);
          } else {
            setProductSalespersonSummary(null);
          }
        } else if ("customer_code" in firstItem) {
          // Customer data - check if it's product customer data (has service field) or sector customer data
          const firstCustomerItem = data[0] as any;
          if ("service" in firstCustomerItem) {
            // Product customer data - use gained_profit, lost_profit, quoted_profit
            const customerData = (data as any[]).map((item) => ({
              customer_code: item.customer_code || "-",
              customer_name: item.customer_name || "-",
              potential: item.potential_profit || 0,
              pipeline: item.pipeline_profit || 0,
              gained: item.gained_profit || 0,
              lost: item.lost_profit || 0,
              quote: item.quoted_profit || 0,
              expected: item.expected_profit || 0,
            }));
            setProductDrilldownData(customerData);
          } else {
            // Customer data - use robust field name fallbacks
            const customerData = (data as any[]).map((item) => ({
              customer_code: item.customer_code || "-",
              customer_name: item.customer_name || "-",
              potential: item.potential_profit || item.potential || 0,
              pipeline: item.pipeline_profit || item.pipeline || 0,
              gained: item.gained_profit || item.gained || 0,
              lost: item.lost_profit || item.lost || 0,
              quote:
                item.quoted_profit || item.quoted_created || item.quote || 0,
              expected: item.expected_profit || item.expected || 0,
            }));
            setProductDrilldownData(customerData);
          }
          setProductSalespersonData([]); // Clear salesperson data when showing customer data
          // Store summary if available
          if (response.summary) {
            setProductDrilldownSummary(response.summary);
          } else {
            setProductDrilldownSummary(null);
          }
        } else if ("service" in firstItem) {
          // Base product data - combine service and service_type
          const productTableData = (data as PipelineReportProductItem[]).map(
            (item) => ({
              service: `${item.service || "-"} ${item.service_type || "-"}`, // Combined: "FCL Import", "FCL Export", etc.
              service_type: item.service_type || "-", // Keep for reference but will be hidden
              service_original: item.service || "-", // Store original service for click handling
              potential: item.potential_profit || 0,
              pipeline: item.pipeline_profit || 0,
              gained: item.gained_profit || 0,
              lost: item.lost_profit || 0,
              quote: item.quoted_profit || 0,
              expected: item.expected_profit || 0,
            })
          );
          setProductData(productTableData);
          setProductSalespersonData([]); // Clear salesperson data when showing base data
          // Store summary if available
          if (response.summary) {
            setProductSummary(response.summary);
          } else {
            setProductSummary(null);
          }
        }
      } else {
        if (service || serviceType) {
          setProductSalespersonData([]);
          setProductSalespersonSummary(null);
        } else {
          setProductData([]);
          setProductSummary(null);
        }
      }
    } catch (error) {
      console.error("Error loading product pipeline data:", error);
      if (service || serviceType) {
        setProductSalespersonData([]);
        setProductSalespersonSummary(null);
      } else {
        setProductData([]);
        setProductSummary(null);
      }
    } finally {
      if (service || serviceType) {
        setProductSalespersonLoading(false);
      } else {
        setProductLoading(false);
      }
    }
  };

  const loadProductCustomerData = async (
    salesperson: string,
    periodValue?: string,
    type?: string
  ) => {
    try {
      setProductDrilldownLoading(true);
      const companyName = user?.company?.company_name || "";
      if (!companyName || !selectedService || !selectedServiceType) return;

      const response = await getPipelineReportProductData({
        company: companyName,
        // period: periodValue || period, // Commented out - can be used in future case
        ...buildDateFilters(),
        service: selectedService,
        service_type: selectedServiceType
          ? toTitleCase(selectedServiceType)
          : undefined,
        salesperson: salesperson,
        ...(type && { type }),
        ...(globalSearch &&
          globalSearch.trim() && { search: globalSearch.trim() }),
        ...(user?.pulse_id === "P2CCI" && { calculation }),
      });

      const data = response.data || [];
      if (data.length > 0 && "customer_code" in data[0]) {
        // Product customer data - use gained_profit, lost_profit, quoted_profit from API response
        const customerData = (data as any[]).map((item) => ({
          customer_code: item.customer_code || "-",
          customer_name: item.customer_name || "-",
          potential: item.potential_profit || 0,
          pipeline: item.pipeline_profit || 0,
          gained: item.gained_profit || 0,
          lost: item.lost_profit || 0,
          quote: item.quoted_profit || 0,
          expected: item.expected_profit || 0,
        }));
        setProductDrilldownData(customerData);
        // Store summary if available (only if no "type" in filters - not financial column drilldown)
        if (response.summary) {
          setProductDrilldownSummary(response.summary);
        } else {
          setProductDrilldownSummary(null);
        }
      } else {
        setProductDrilldownData([]);
        setProductDrilldownSummary(null);
      }
    } catch (error) {
      console.error("Error loading product customer data:", error);
      setProductDrilldownData([]);
      setProductDrilldownSummary(null);
    } finally {
      setProductDrilldownLoading(false);
    }
  };

  // Handle column click for drilldown
  const handleColumnClick = async (
    columnType:
      | "company"
      | "location"
      | "salesperson"
      | "customer"
      | "potential"
      | "pipeline"
      | "gained"
      | "quoted_created"
      | "expected"
      | "active"
      | "lost"
      | "quote"
      | "quotation_id"
      | "call_entry_id"
      | "region"
      | "service"
      | "services"
      | "service_type"
      | "overdue"
      | "today"
      | "upcoming"
      | "closed",
    value: string,
    additionalData?:
      | PipelineCustomerRow
      | PipelineSectorRow
      | PipelineProductRow
  ) => {
    if (columnType === "salesperson" && drillLevel === 0) {
      setSelectedSalesperson(value);
      setDrillLevel(1);
      loadPipelineData(value);
    } else if (
      (columnType === "potential" ||
        columnType === "pipeline" ||
        columnType === "gained" ||
        columnType === "quoted_created" ||
        columnType === "quote" ||
        columnType === "lost" ||
        columnType === "expected") &&
      drillLevel === 0
    ) {
      // Disable drilling for 'expected' column at drill level 0
      if (columnType === "expected") {
        return;
      }
      // Handle financial column click at drill level 0 - drill down to customer list for that salesperson
      // Check if additionalData is a salesperson row
      if (additionalData && "salesperson" in additionalData) {
        const salespersonData = additionalData as PipelineSalespersonRow;
        setSelectedSalesperson(salespersonData.salesperson);
        // Normalize "quote" to "quoted_created" for API
        const normalizedColumnType =
          columnType === "quote" ? "quoted_created" : columnType;
        setSelectedColumnType(normalizedColumnType);
        setDrillLevel(2); // Skip level 1, go directly to filtered customer view
        setDrilldownLoading(true);

        try {
          const companyName = user?.company?.company_name || "";
          const filters: PipelineReportFilters = {
            company: companyName,
            salesperson: salespersonData.salesperson,
            type: normalizedColumnType,
            // period, // Commented out - can be used in future case
            ...buildDateFilters(),
            ...(user?.pulse_id === "P2CCI" && { calculation }),
            ...(globalSearch &&
              globalSearch.trim() && { search: globalSearch.trim() }),
          };

          const response = await getPotentialCustomersData(filters);
          setPotentialCustomersData(transformNullValues(response.data || []));
        } catch (error) {
          console.error("Error loading financial column data:", error);
          setPotentialCustomersData([]);
        } finally {
          setDrilldownLoading(false);
        }
      }
    } else if (
      (columnType === "potential" ||
        columnType === "pipeline" ||
        columnType === "gained" ||
        columnType === "quoted_created" ||
        columnType === "quote" ||
        columnType === "lost" ||
        columnType === "expected") &&
      drillLevel === 1
    ) {
      // Disable last drill level for 'expected' column as requested
      if (columnType === "expected") {
        return;
      }
      // Handle financial column click - drill down to detailed data
      // Check if additionalData is a customer row
      if (
        additionalData &&
        "customer_code" in additionalData &&
        "customer_name" in additionalData
      ) {
        const customerData = additionalData as PipelineCustomerRow;
        setSelectedCustomer(customerData.customer_name || "Customer");
        // Normalize "quote" to "quoted_created" for API
        const normalizedColumnType =
          columnType === "quote" ? "quoted_created" : columnType;
        setSelectedColumnType(normalizedColumnType);
        setDrillLevel(2);
        setDrilldownLoading(true);

        try {
          const companyName = user?.company?.company_name || "";
          const filters: PipelineReportFilters = {
            company: companyName,
            salesperson: selectedSalesperson || "",
            type: normalizedColumnType,
            // period, // Commented out - can be used in future case
            ...buildDateFilters(),
            ...(user?.pulse_id === "P2CCI" && { calculation }),
            ...(globalSearch &&
              globalSearch.trim() && { search: globalSearch.trim() }),
          };
          if (customerData.customer_code) {
            filters.customer_code = customerData.customer_code;
          }

          const response = await getPotentialCustomersData(filters);
          setPotentialCustomersData(transformNullValues(response.data || []));
        } catch (error) {
          console.error("Error loading financial column data:", error);
          setPotentialCustomersData([]);
        } finally {
          setDrilldownLoading(false);
        }
      }
    } else if (columnType === "quotation_id") {
      // Handle quotation ID click - navigate to quotation edit page
      navigate(`/quotation-create/${value}`, {
        state: {
          returnTo: "dashboard-pipeline",
          pipelineReportState: {
            drillLevel,
            selectedSalesperson,
            selectedCustomer,
            selectedColumnType,
          },
        },
      });
    } else if (columnType === "call_entry_id") {
      // Handle call entry ID click - navigate to call entry edit page
      navigate(`/call-entry-create/${value}`, {
        state: {
          returnTo: "dashboard-pipeline",
          pipelineReportState: {
            drillLevel,
            selectedSalesperson,
            selectedCustomer,
            selectedColumnType,
          },
        },
      });
    } else if (
      columnType === "region" &&
      drillLevel === 0 &&
      sectorDrillLevel === 0 &&
      productDrillLevel === 0
    ) {
      // Handle sector click - drill down to salesperson data for that sector
      setSelectedSector(value);
      setSectorDrillLevel(1);
      await loadSectorData(period, value);
    } else if (
      (columnType === "service" ||
        columnType === "services" ||
        columnType === "service_type") &&
      drillLevel === 0 &&
      sectorDrillLevel === 0 &&
      productDrillLevel === 0
    ) {
      // Handle product click - drill down to salesperson data for that service/service_type
      const rowData = additionalData as PipelineProductRow;
      if (rowData) {
        // Extract service and service_type from combined value or use stored values
        let service: string;
        let serviceType: string;

        if (columnType === "service" || columnType === "services") {
          // Value is the combined "FCL Import" format
          // Use service_original and service_type if available, otherwise extract from combined value
          if (rowData.service_original && rowData.service_type) {
            service = rowData.service_original;
            serviceType = rowData.service_type;
          } else {
            // Extract service and service_type from combined value
            // Format: "FCL Import" -> service: "FCL", serviceType: "Import"
            const parts = value.split(" ");
            if (parts.length >= 2) {
              serviceType = parts.pop() || "";
              service = parts.join(" ");
            } else {
              // Fallback: use value as service
              service = value;
              serviceType = rowData.service_type || "";
            }
          }
        } else {
          // service_type column clicked (shouldn't happen at base level, but handle it)
          service =
            rowData.service_original ||
            (rowData.service.includes(" ")
              ? rowData.service.split(" ")[0]
              : rowData.service);
          serviceType = value;
        }

        setSelectedService(service);
        setSelectedServiceType(serviceType);
        setProductDrillLevel(1);
        await loadProductData(period, service, toTitleCase(serviceType));
      }
    }
  };

  // Handle sector column click for drilldown
  const handleSectorColumnClick = async (
    columnType:
      | "company"
      | "location"
      | "salesperson"
      | "customer"
      | "potential"
      | "pipeline"
      | "gained"
      | "quoted_created"
      | "expected"
      | "active"
      | "lost"
      | "quote"
      | "quotation_id"
      | "call_entry_id"
      | "region"
      | "service"
      | "services"
      | "service_type"
      | "overdue"
      | "today"
      | "upcoming"
      | "closed",
    value: string,
    additionalData?:
      | PipelineCustomerRow
      | PipelineSectorRow
      | PipelineSalespersonRow
  ) => {
    // Handle region column click at sector drill level 0 - drill down to salesperson list
    if (
      columnType === "region" &&
      sectorDrillLevel === 0 &&
      additionalData &&
      "region" in additionalData
    ) {
      // Handle sector click - drill down to salesperson data for that sector
      setSelectedSector(value);
      setSectorDrillLevel(1);
      await loadSectorData(period, value);
    }
    // Handle financial column click at sector drill level 0 - drill down directly to detailed transaction view
    else if (
      (columnType === "potential" ||
        columnType === "pipeline" ||
        columnType === "gained" ||
        columnType === "quoted_created" ||
        columnType === "quote" ||
        columnType === "lost" ||
        columnType === "expected") &&
      sectorDrillLevel === 0 &&
      additionalData &&
      "region" in additionalData
    ) {
      // Disable drilling for 'expected' column at drill level 0
      if (columnType === "expected") {
        return;
      }
      // Get region from additionalData
      const sectorData = additionalData as PipelineSectorRow;
      setSelectedSector(sectorData.region);
      setSelectedCustomer(`Sector: ${sectorData.region}`); // Set for title display
      // Normalize "quote" to "quoted_created" for API
      const normalizedColumnType =
        columnType === "quote" ? "quoted_created" : columnType;
      setSelectedColumnType(normalizedColumnType);
      setDrillLevel(2); // Go to detailed transaction view
      setDrilldownLoading(true);

      try {
        const companyName = user?.company?.company_name || "";
        const filters: PipelineReportFilters = {
          company: companyName,
          region: sectorData.region,
          type: normalizedColumnType,
          // period, // Commented out - can be used in future case
          ...buildDateFilters(),
          ...(user?.pulse_id === "P2CCI" && { calculation }),
          ...(globalSearch &&
            globalSearch.trim() && { search: globalSearch.trim() }),
        };

        const response = await getPotentialCustomersDataForRegional(filters);
        setPotentialCustomersData(transformNullValues(response.data || []));
      } catch (error) {
        console.error("Error loading sector financial detail data:", error);
        setPotentialCustomersData([]);
      } finally {
        setDrilldownLoading(false);
      }
    } else if (
      // Handle financial column click at sector drill level 1 (salesperson level) - drill down to detailed transaction view with type filter
      (columnType === "potential" ||
        columnType === "pipeline" ||
        columnType === "gained" ||
        columnType === "quoted_created" ||
        columnType === "quote" ||
        columnType === "lost" ||
        columnType === "expected") &&
      sectorDrillLevel === 1 &&
      additionalData &&
      "salesperson" in additionalData
    ) {
      // Disable drilling for 'expected' column
      if (columnType === "expected") {
        return;
      }
      // Get salesperson info from additionalData
      const salespersonData = additionalData as PipelineSectorSalespersonRow;
      const salespersonName = salespersonData.salesperson;

      setSelectedSalesperson(salespersonName);
      setSelectedCustomer(`Sector: ${selectedSector} - ${salespersonName}`); // Set for title display
      // Normalize "quote" to "quoted_created" for API
      const normalizedColumnType =
        columnType === "quote" ? "quoted_created" : columnType;
      setSelectedColumnType(normalizedColumnType);
      setDrillLevel(2); // Go to detailed transaction view (main drill level)
      setDrilldownLoading(true);

      try {
        const companyName = user?.company?.company_name || "";
        const filters: PipelineReportFilters = {
          company: companyName,
          region: selectedSector || "",
          salesperson: salespersonName,
          type: normalizedColumnType,
          // period, // Commented out - can be used in future case
          ...buildDateFilters(),
          ...(user?.pulse_id === "P2CCI" && { calculation }),
          ...(globalSearch &&
            globalSearch.trim() && { search: globalSearch.trim() }),
        };

        const response = await getPotentialCustomersDataForRegional(filters);
        setPotentialCustomersData(transformNullValues(response.data || []));
      } catch (error) {
        console.error(
          "Error loading sector salesperson financial detail data:",
          error
        );
        setPotentialCustomersData([]);
      } finally {
        setDrilldownLoading(false);
      }
    } else if (columnType === "salesperson" && sectorDrillLevel === 1) {
      // Handle salesperson click in sector drilldown (level 1)
      setSelectedSalesperson(value);
      setSelectedColumnType(null); // Clear type filter when drilling to customer list
      setSectorDrillLevel(2);
      await loadSectorCustomerData(value);
    } else if (
      // Handle financial column click when in sector customer drilldown (level 2)
      (columnType === "potential" ||
        columnType === "pipeline" ||
        columnType === "gained" ||
        columnType === "quoted_created" ||
        columnType === "quote" ||
        columnType === "lost" ||
        columnType === "expected") &&
      sectorDrillLevel === 2 &&
      additionalData &&
      "customer_code" in additionalData
    ) {
      // Disable last drill level for 'expected' column as requested
      if (columnType === "expected") {
        return;
      }
      // Handle financial column click at sector drill level 2 (customer level) - same as level 0 and 1
      // Get customer info from additionalData
      const customerData = additionalData as PipelineCustomerRow;
      const customerCode = customerData.customer_code;
      const customerName = customerData.customer_name;

      setSelectedCustomer(customerName || "Customer");
      // Normalize "quote" to "quoted_created" for API
      const normalizedColumnType =
        columnType === "quote" ? "quoted_created" : columnType;
      setSelectedColumnType(normalizedColumnType);
      setDrillLevel(2); // Go to financial detail level
      setDrilldownLoading(true);

      try {
        const companyName = user?.company?.company_name || "";
        const filters: PipelineReportFilters = {
          company: companyName,
          region: selectedSector || "",
          salesperson: selectedSalesperson || "",
          customer_code: customerCode,
          type: normalizedColumnType,
          // period, // Commented out - can be used in future case
          ...buildDateFilters(),
          ...(user?.pulse_id === "P2CCI" && { calculation }),
          ...(globalSearch &&
            globalSearch.trim() && { search: globalSearch.trim() }),
        };

        const response = await getPotentialCustomersDataForRegional(filters);
        setPotentialCustomersData(transformNullValues(response.data || []));
      } catch (error) {
        console.error(
          "Error loading sector customer financial column data:",
          error
        );
        setPotentialCustomersData([]);
      } finally {
        setDrilldownLoading(false);
      }
    } else if (columnType === "quotation_id") {
      // Handle quotation ID click - navigate to quotation edit page
      navigate(`/quotation-create/${value}`, {
        state: {
          returnTo: "dashboard-pipeline",
          pipelineReportState: {
            drillLevel,
            selectedSalesperson,
            selectedCustomer,
            selectedColumnType,
          },
        },
      });
    } else if (columnType === "call_entry_id") {
      // Handle call entry ID click - navigate to call entry edit page
      navigate(`/call-entry-create/${value}`, {
        state: {
          returnTo: "dashboard-pipeline",
          pipelineReportState: {
            drillLevel,
            selectedSalesperson,
            selectedCustomer,
            selectedColumnType,
          },
        },
      });
    }
  };

  // Reset to base level (tabs view) - used by "Back to Dashboard" button
  const handleResetToBase = () => {
    // Determine which tab should be active based on current drill levels
    // Preserve the active tab instead of resetting to salesperson
    let targetTab = activeTab;

    // If we're at a drill level, determine which tab we came from
    if (productDrillLevel > 0) {
      // We're in product tab drilldown
      targetTab = "product";
    } else if (sectorDrillLevel > 0) {
      // We're in region/sector tab drilldown
      targetTab = "region";
    } else if (drillLevel === 2 && selectedColumnType) {
      // Financial column drilldown - determine which tab based on selections
      if (selectedSector) {
        // Came from region tab
        targetTab = "region";
      } else if (selectedService) {
        // Came from product tab
        targetTab = "product";
      } else {
        // Came from salesperson tab
        targetTab = "salesperson";
      }
    } else if (
      drillLevel > 0 &&
      productDrillLevel === 0 &&
      sectorDrillLevel === 0
    ) {
      // Salesperson tab drilldown
      targetTab = "salesperson";
    }
    // Otherwise, keep the current activeTab

    // Reset all drill levels
    setDrillLevel(0);
    setSectorDrillLevel(0);
    setProductDrillLevel(0);

    // Clear all selections
    setSelectedSalesperson(null);
    setSelectedCustomer(null);
    setSelectedColumnType(null);
    setSelectedSector(null);
    setSelectedService(null);
    setSelectedServiceType(null);

    // Clear all data
    setDrilldownData([]);
    setSectorDrilldownData([]);
    setSectorSalespersonData([]);
    setProductDrilldownData([]);
    setProductSalespersonData([]);
    setPotentialCustomersData([]);

    // Clear all summaries
    setPipelineSummary(null);
    setDrilldownSummary(null);
    setSectorSummary(null);
    setSectorSalespersonSummary(null);
    setSectorDrilldownSummary(null);
    setProductSummary(null);
    setProductSalespersonSummary(null);
    setProductDrilldownSummary(null);

    // Set active tab to the determined tab (preserves current tab or sets based on drill level)
    setActiveTab(targetTab);

    // Reload initial data
    loadPipelineData();
    loadSectorData();
    loadProductData();
  };

  // Effect to refetch data when calculation changes
  useEffect(() => {
    // Skip on initial mount
    if (isInitialMountForCalculation.current) {
      isInitialMountForCalculation.current = false;
      return;
    }

    // Reload data based on current drill level when calculation changes
    if (drillLevel === 0 && sectorDrillLevel === 0 && productDrillLevel === 0) {
      loadPipelineData(undefined, period);
      loadSectorData(period);
      loadProductData(period);
    } else if (productDrillLevel > 0) {
      if (productDrillLevel === 1 && selectedService && selectedServiceType) {
        loadProductData(
          period,
          selectedService,
          toTitleCase(selectedServiceType),
          selectedColumnType || undefined
        );
      } else if (
        productDrillLevel === 2 &&
        selectedService &&
        selectedServiceType &&
        selectedSalesperson
      ) {
        loadProductCustomerData(
          selectedSalesperson,
          period,
          selectedColumnType || undefined
        );
      }
    } else if (sectorDrillLevel > 0) {
      if (sectorDrillLevel === 1 && selectedSector) {
        loadSectorData(period, selectedSector, selectedColumnType || undefined);
      } else if (sectorDrillLevel === 2 && selectedSector) {
        if (selectedSalesperson) {
          loadSectorCustomerData(
            selectedSalesperson,
            period,
            selectedColumnType || undefined
          );
        } else {
          loadSectorData(
            period,
            selectedSector,
            selectedColumnType || undefined
          );
        }
      }
    } else if (drillLevel === 1 && selectedSalesperson) {
      loadPipelineData(selectedSalesperson, period);
    } else if (drillLevel === 2 && selectedColumnType) {
      // Reload detailed view
      const companyName = user?.company?.company_name || "";
      if (!companyName) return;

      const normalizedColumnType =
        selectedColumnType === "quote" ? "quoted_created" : selectedColumnType;

      const filters: PipelineReportFilters = {
        company: companyName,
        salesperson: selectedSalesperson || "",
        type: normalizedColumnType,
        // period, // Commented out - can be used in future case
        ...buildDateFilters(),
        ...(user?.pulse_id === "P2CCI" && { calculation }),
        ...(globalSearch &&
          globalSearch.trim() && { search: globalSearch.trim() }),
      };

      if (
        selectedCustomer &&
        typeof selectedCustomer === "string" &&
        !selectedCustomer.startsWith("Sector:") &&
        !selectedCustomer.includes(" - ")
      ) {
        // Extract customer_code if available
        const customerRow = drilldownData.find(
          (row) => row.customer_name === selectedCustomer
        );
        if (customerRow?.customer_code) {
          filters.customer_code = customerRow.customer_code;
        }
      }
      if (selectedSector) filters.region = selectedSector;
      if (selectedService) filters.service = selectedService;
      if (selectedServiceType)
        filters.service_type = toTitleCase(selectedServiceType);

      setDrilldownLoading(true);
      (async () => {
        try {
          let response;
          if (selectedSector) {
            response = await getPotentialCustomersDataForRegional(filters);
          } else if (selectedService) {
            response = await getPotentialCustomersDataForProduct(filters);
          } else {
            response = await getPotentialCustomersData(filters);
          }
          setPotentialCustomersData(transformNullValues(response.data || []));
        } catch (error) {
          console.error("Error reloading data with calculation change:", error);
          setPotentialCustomersData([]);
        } finally {
          setDrilldownLoading(false);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calculation]);

  // Effect to refetch data when company/branch changes and reset to base level
  useEffect(() => {
    // Skip on initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (user?.company?.company_name) {
      console.log(
        "🔄 Company/Branch changed, resetting to base level and refetching pipeline data..."
      );
      // Reset to base level
      handleResetToBase();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.company?.company_name]);

  // Handle back navigation - go to previous view
  const handleBack = () => {
    if (drillLevel === 2) {
      // Check if we came from sector or product drilldown
      if (sectorDrillLevel === 2) {
        // Restore sector drill level 2 (customer level)
        setDrillLevel(0); // Reset main drill level
        setSelectedCustomer(null);
        setSelectedColumnType(null);
        setPotentialCustomersData([]);
        // sectorDrillLevel remains 2, so it will show sector customer data
      } else if (productDrillLevel === 2) {
        // Restore product drill level 2 (customer level)
        setDrillLevel(0); // Reset main drill level
        setSelectedCustomer(null);
        setSelectedColumnType(null);
        setPotentialCustomersData([]);
        // productDrillLevel remains 2, so it will show product customer data
      } else if (selectedColumnType && !selectedCustomer) {
        // Came from drill level 0 badge click (skipped level 1)
        // Go back to drill level 0
        setDrillLevel(0);
        setSelectedSalesperson(null);
        setSelectedColumnType(null);
        setPotentialCustomersData([]);
        // Reload initial data
        loadPipelineData();
      } else {
        // Came from salesperson drilldown (level 1 -> 2)
        setDrillLevel(1);
        setSelectedCustomer(null);
        setSelectedColumnType(null);
        setPotentialCustomersData([]);
      }
    } else if (drillLevel === 1) {
      setDrillLevel(0);
      setSelectedSalesperson(null);
      setDrilldownData([]);
      // Reload initial data
      loadPipelineData();
    }
  };

  // Handle sector back navigation
  const handleSectorBack = () => {
    // Coming back from detailed transaction view (drillLevel === 2)
    if (drillLevel === 2 && selectedColumnType && selectedSector) {
      // Check if we came from sector level 1 (salesperson badge click)
      if (
        selectedSalesperson &&
        selectedCustomer &&
        typeof selectedCustomer === "string" &&
        selectedCustomer.includes(" - ")
      ) {
        // Coming back from detailed view accessed from sector level 1 (salesperson badge click)
        setDrillLevel(0);
        setSelectedSalesperson(null);
        setSelectedCustomer(null);
        setSelectedColumnType(null);
        setPotentialCustomersData([]);
        // Keep sectorDrillLevel at 1 and reload salesperson data without type filter
        if (selectedSector) {
          loadSectorData(period, selectedSector);
        }
      }
      // Check if we came from sector level 0 (region badge click)
      else if (
        !selectedSalesperson &&
        selectedCustomer &&
        typeof selectedCustomer === "string" &&
        selectedCustomer.startsWith("Sector:")
      ) {
        // Coming back from detailed view accessed from sector level 0 (region badge click)
        setDrillLevel(0);
        setSectorDrillLevel(0);
        setSelectedSector(null);
        setSelectedCustomer(null);
        setSelectedColumnType(null);
        setPotentialCustomersData([]);
        // Reload initial sector data
        loadSectorData();
      }
      // Check if we came from sector level 2 (customer badge click)
      else if (
        selectedSalesperson &&
        selectedCustomer &&
        !selectedCustomer.includes(" - ") &&
        !selectedCustomer.startsWith("Sector:")
      ) {
        // Coming back from detailed view accessed from sector level 2 (customer badge click)
        setDrillLevel(0);
        setSelectedCustomer(null);
        setSelectedColumnType(null);
        setPotentialCustomersData([]);
        // Keep sectorDrillLevel at 2 and reload customer data without type filter
        if (selectedSector && selectedSalesperson) {
          loadSectorCustomerData(selectedSalesperson);
        }
      }
    }
    // Coming back from sector level 2 (customer summary list) to level 1 (salesperson list)
    else if (sectorDrillLevel === 2) {
      if (selectedSalesperson) {
        // We came from level 1 (salesperson list) -> go back to level 1
        setSectorDrillLevel(1);
        setSelectedSalesperson(null);
        setSectorDrilldownData([]);
        setSectorDrilldownSummary(null);
        // Reload sector salesperson data without type filter
        if (selectedSector) {
          loadSectorData(period, selectedSector);
        }
      } else {
        // We came directly from level 0 (region list) -> go back to level 0
        setSectorDrillLevel(0);
        setSelectedSector(null);
        setSelectedColumnType(null);
        setSectorDrilldownData([]);
        setSectorDrilldownSummary(null);
        // Reload initial sector data
        loadSectorData();
      }
    }
    // Coming back from sector level 1 (salesperson list) to level 0 (region list)
    else if (sectorDrillLevel === 1) {
      setSectorDrillLevel(0);
      setSelectedSector(null);
      setSelectedColumnType(null); // Clear column type filter when going back to level 0
      setSectorSalespersonData([]);
      setSectorSalespersonSummary(null);
      setSectorDrilldownData([]);
      setSectorDrilldownSummary(null);
      // Reload initial sector data
      loadSectorData();
    }
  };

  // Handle product column click for drilldown
  const handleProductColumnClick = async (
    columnType:
      | "company"
      | "location"
      | "salesperson"
      | "customer"
      | "potential"
      | "pipeline"
      | "gained"
      | "quoted_created"
      | "expected"
      | "active"
      | "lost"
      | "quote"
      | "quotation_id"
      | "call_entry_id"
      | "region"
      | "service"
      | "services"
      | "service_type"
      | "overdue"
      | "today"
      | "upcoming"
      | "closed",
    value: string,
    additionalData?:
      | PipelineCustomerRow
      | PipelineProductRow
      | PipelineProductSalespersonRow
  ) => {
    // Handle service/product name column click at product drill level 0 - drill down to salesperson list
    if (
      (columnType === "service" ||
        columnType === "services" ||
        columnType === "service_type") &&
      productDrillLevel === 0 &&
      additionalData &&
      "service" in additionalData
    ) {
      // Handle product click - drill down to salesperson data for that service/service_type
      const rowData = additionalData as PipelineProductRow;
      if (rowData) {
        // Extract service and service_type from combined value or use stored values
        let service: string;
        let serviceType: string;

        if (columnType === "service" || columnType === "services") {
          // Value is the combined "FCL Import" format
          // Use service_original and service_type if available, otherwise extract from combined value
          if (rowData.service_original && rowData.service_type) {
            service = rowData.service_original;
            serviceType = rowData.service_type;
          } else {
            // Extract service and service_type from combined value
            // Format: "FCL Import" -> service: "FCL", serviceType: "Import"
            const parts = value.split(" ");
            if (parts.length >= 2) {
              serviceType = parts.pop() || "";
              service = parts.join(" ");
            } else {
              // Fallback: use value as service
              service = value;
              serviceType = rowData.service_type || "";
            }
          }
        } else {
          // service_type column clicked (shouldn't happen at base level, but handle it)
          service =
            rowData.service_original ||
            (rowData.service.includes(" ")
              ? rowData.service.split(" ")[0]
              : rowData.service);
          serviceType = value;
        }

        setSelectedService(service);
        setSelectedServiceType(serviceType);
        setProductDrillLevel(1);
        await loadProductData(period, service, toTitleCase(serviceType));
      }
    }
    // Handle financial column click at product drill level 0 - drill down to salesperson list with type filter
    else if (
      (columnType === "potential" ||
        columnType === "pipeline" ||
        columnType === "gained" ||
        columnType === "quoted_created" ||
        columnType === "quote" ||
        columnType === "lost" ||
        columnType === "expected") &&
      productDrillLevel === 0 &&
      additionalData &&
      "service" in additionalData
    ) {
      // Disable drilling for 'expected' column at drill level 0
      if (columnType === "expected") {
        return;
      }
      // Get product info from additionalData
      const productData = additionalData as PipelineProductRow;
      // Extract service and service_type
      const service =
        productData.service_original || productData.service.split(" ")[0];
      const serviceType = productData.service_type;

      setSelectedService(service);
      setSelectedServiceType(serviceType);
      // Normalize "quote" to "quoted_created" for API
      const normalizedColumnType =
        columnType === "quote" ? "quoted_created" : columnType;
      setSelectedColumnType(normalizedColumnType);
      setProductDrillLevel(1); // Navigate to salesperson list (level 1)
      setProductSalespersonLoading(true);

      try {
        // Load salesperson data with type filter
        await loadProductData(
          period,
          service,
          toTitleCase(serviceType),
          normalizedColumnType
        );
      } catch (error) {
        console.error(
          "Error loading product salesperson data with type filter:",
          error
        );
      } finally {
        setProductSalespersonLoading(false);
      }
    } else if (
      // Handle financial column click at product drill level 1 - drill down to customer list for that salesperson + product with type filter
      (columnType === "potential" ||
        columnType === "pipeline" ||
        columnType === "gained" ||
        columnType === "quoted_created" ||
        columnType === "quote" ||
        columnType === "lost" ||
        columnType === "expected") &&
      productDrillLevel === 1 &&
      additionalData &&
      "salesperson" in additionalData
    ) {
      // Disable drilling for 'expected' column
      if (columnType === "expected") {
        return;
      }
      // Get salesperson info from additionalData
      const salespersonData = additionalData as PipelineProductSalespersonRow;
      const salespersonName = salespersonData.salesperson;

      setSelectedSalesperson(salespersonName);
      // Normalize "quote" to "quoted_created" for API
      const normalizedColumnType =
        columnType === "quote" ? "quoted_created" : columnType;
      setSelectedColumnType(normalizedColumnType); // Keep type filter for customer list
      setProductDrillLevel(2); // Navigate to customer list (level 2)
      await loadProductCustomerData(
        salespersonName,
        period,
        normalizedColumnType
      );
    } else if (columnType === "salesperson" && productDrillLevel === 1) {
      // Handle salesperson click in product drilldown (level 1)
      setSelectedSalesperson(value);
      setSelectedColumnType(null); // Clear type filter when drilling to customer list
      setProductDrillLevel(2);
      await loadProductCustomerData(value);
    } else if (
      // Handle financial column click when in product customer drilldown (level 2)
      (columnType === "potential" ||
        columnType === "pipeline" ||
        columnType === "gained" ||
        columnType === "quoted_created" ||
        columnType === "quote" ||
        columnType === "lost" ||
        columnType === "expected") &&
      productDrillLevel === 2 &&
      additionalData &&
      "customer_code" in additionalData
    ) {
      // Disable last drill level for 'expected' column as requested
      if (columnType === "expected") {
        return;
      }
      // Handle financial column click at product drill level 2 (customer level) - same as level 0 and 1
      // Get customer info from additionalData
      const customerData = additionalData as PipelineCustomerRow;
      const customerCode = customerData.customer_code;
      const customerName = customerData.customer_name;

      setSelectedCustomer(customerName || "Customer");
      // Normalize "quote" to "quoted_created" for API
      const normalizedColumnType =
        columnType === "quote" ? "quoted_created" : columnType;
      setSelectedColumnType(normalizedColumnType);
      setDrillLevel(2); // Go to financial detail level
      setDrilldownLoading(true);

      try {
        const companyName = user?.company?.company_name || "";
        const filters: PipelineReportFilters = {
          company: companyName,
          service: selectedService || "",
          service_type: selectedServiceType
            ? toTitleCase(selectedServiceType)
            : "",
          salesperson: selectedSalesperson || "",
          customer_code: customerCode,
          type: normalizedColumnType,
          // period, // Commented out - can be used in future case
          ...buildDateFilters(),
          ...(user?.pulse_id === "P2CCI" && { calculation }),
          ...(globalSearch &&
            globalSearch.trim() && { search: globalSearch.trim() }),
        };

        const response = await getPotentialCustomersDataForProduct(filters);
        setPotentialCustomersData(transformNullValues(response.data || []));
      } catch (error) {
        console.error(
          "Error loading product customer financial column data:",
          error
        );
        setPotentialCustomersData([]);
      } finally {
        setDrilldownLoading(false);
      }
    } else if (columnType === "quotation_id") {
      // Handle quotation ID click - navigate to quotation edit page
      navigate(`/quotation-create/${value}`, {
        state: {
          returnTo: "dashboard-pipeline",
          pipelineReportState: {
            drillLevel,
            selectedSalesperson,
            selectedCustomer,
            selectedColumnType,
          },
        },
      });
    } else if (columnType === "call_entry_id") {
      // Handle call entry ID click - navigate to call entry edit page
      navigate(`/call-entry-create/${value}`, {
        state: {
          returnTo: "dashboard-pipeline",
          pipelineReportState: {
            drillLevel,
            selectedSalesperson,
            selectedCustomer,
            selectedColumnType,
          },
        },
      });
    }
  };

  // Handle product back navigation
  const handleProductBack = () => {
    // Coming back from detailed transaction view (drillLevel === 2)
    if (
      drillLevel === 2 &&
      selectedColumnType &&
      selectedService &&
      selectedServiceType
    ) {
      // Check if we came from product level 2 (customer badge click)
      if (selectedSalesperson && selectedCustomer) {
        // Coming back from detailed view accessed from product level 2 (customer badge click)
        setDrillLevel(0);
        setSelectedCustomer(null);
        setSelectedColumnType(null);
        setPotentialCustomersData([]);
        // Keep productDrillLevel at 2 and reload customer data without type filter
        if (selectedService && selectedServiceType && selectedSalesperson) {
          loadProductCustomerData(selectedSalesperson);
        }
      }
      // Check if we came from product level 1 (salesperson badge click)
      else if (selectedSalesperson && !selectedCustomer) {
        // Coming back from detailed view accessed from product level 1 (salesperson badge click)
        setDrillLevel(0);
        setSelectedSalesperson(null);
        setSelectedColumnType(null);
        setPotentialCustomersData([]);
        // Keep productDrillLevel at 1 and reload salesperson data without type filter
        if (selectedService && selectedServiceType) {
          loadProductData(
            period,
            selectedService,
            toTitleCase(selectedServiceType)
          );
        }
      }
      // Check if we came from product level 0 (product badge click)
      else if (!selectedSalesperson && !selectedCustomer) {
        // Coming back from detailed view accessed from product level 0 (product badge click)
        setDrillLevel(0);
        setProductDrillLevel(0);
        setSelectedService(null);
        setSelectedServiceType(null);
        setSelectedColumnType(null);
        setPotentialCustomersData([]);
        // Reload initial product data
        loadProductData();
      }
    }
    // Coming back from product level 2 (customer summary list) to level 1 (salesperson list)
    else if (productDrillLevel === 2) {
      setProductDrillLevel(1);
      setSelectedSalesperson(null);
      setProductDrilldownData([]);
      setProductDrilldownSummary(null);
      // Reload product salesperson data without type filter
      if (selectedService && selectedServiceType) {
        loadProductData(
          period,
          selectedService,
          toTitleCase(selectedServiceType)
        );
      }
    }
    // Coming back from product level 1 (salesperson list) to level 0 (product list)
    else if (productDrillLevel === 1) {
      setProductDrillLevel(0);
      setSelectedService(null);
      setSelectedServiceType(null);
      setSelectedColumnType(null); // Clear column type filter when going back to level 0
      setProductSalespersonData([]);
      setProductSalespersonSummary(null);
      setProductDrilldownData([]);
      setProductDrilldownSummary(null);
      // Reload initial product data
      loadProductData();
    }
  };

  const getTitle = () => {
    const columnTypeMap: Record<string, string> = {
      potential: "Potential",
      pipeline: "Pipeline",
      gained: "Gained",
      quoted_created: "Quoted",
      lost: "Lost",
      expected: "Expected",
    };

    if (productDrillLevel > 0) {
      if (productDrillLevel === 1) {
        const typeFilter = selectedColumnType
          ? ` - ${columnTypeMap[selectedColumnType] || selectedColumnType}`
          : "";
        return `Pipeline Report - Product: ${selectedService} - ${selectedServiceType}${typeFilter}`;
      } else if (productDrillLevel === 2) {
        const typeFilter = selectedColumnType
          ? ` - ${columnTypeMap[selectedColumnType] || selectedColumnType}`
          : "";
        return `Pipeline Report - Product: ${selectedService} - ${selectedServiceType} - ${selectedSalesperson}${typeFilter}`;
      }
    }
    if (sectorDrillLevel > 0) {
      if (sectorDrillLevel === 1) {
        const typeFilter = selectedColumnType
          ? ` - ${columnTypeMap[selectedColumnType] || selectedColumnType}`
          : "";
        return `Pipeline Report - Sector: ${selectedSector}${typeFilter}`;
      } else if (sectorDrillLevel === 2) {
        // Check if we have a salesperson selected
        if (selectedSalesperson) {
          const typeFilter = selectedColumnType
            ? ` - ${columnTypeMap[selectedColumnType] || selectedColumnType}`
            : "";
          return `Pipeline Report - Sector: ${selectedSector} - ${selectedSalesperson}${typeFilter}`;
        } else {
          // Came directly from level 0 - showing customers for region with type filter
          const typeFilter = selectedColumnType
            ? ` - ${columnTypeMap[selectedColumnType] || selectedColumnType}`
            : "";
          return `Pipeline Report - Sector: ${selectedSector}${typeFilter}`;
        }
      }
    }
    if (drillLevel === 0) return "Pipeline Report";
    if (drillLevel === 1) return `Pipeline Report - ${selectedSalesperson}`;
    if (drillLevel === 2) {
      const columnTitle = columnTypeMap[selectedColumnType || ""]
        ? `${columnTypeMap[selectedColumnType || ""]} Customers`
        : "Customer Details";
      return `${columnTitle} - ${selectedCustomer ? selectedCustomer : ""} ${selectedSalesperson ? selectedSalesperson : ""}`;
    }
    return "Pipeline Report";
  };

  const handlePeriodChange = async (value: string | null) => {
    if (!value) return;
    // Update state first for UI
    setPeriod(value);
    // Reload based on current drill level using the value directly (not state)
    if (drillLevel === 0 && sectorDrillLevel === 0 && productDrillLevel === 0) {
      await loadPipelineData(undefined, value);
      await loadSectorData(value);
      await loadProductData(value);
    } else if (productDrillLevel > 0) {
      // Handle period change for product drill levels
      if (productDrillLevel === 1 && selectedService && selectedServiceType) {
        await loadProductData(
          value,
          selectedService,
          toTitleCase(selectedServiceType),
          selectedColumnType || undefined
        );
      } else if (
        productDrillLevel === 2 &&
        selectedService &&
        selectedServiceType &&
        selectedSalesperson
      ) {
        await loadProductCustomerData(
          selectedSalesperson,
          value,
          selectedColumnType || undefined
        );
      }
    } else if (sectorDrillLevel > 0) {
      // Handle period change for sector drill levels
      if (sectorDrillLevel === 1 && selectedSector) {
        await loadSectorData(
          value,
          selectedSector,
          selectedColumnType || undefined
        );
      } else if (sectorDrillLevel === 2 && selectedSector) {
        if (selectedSalesperson) {
          // Level 2 with salesperson - came from level 1
          await loadSectorCustomerData(
            selectedSalesperson,
            value,
            selectedColumnType || undefined
          );
        } else {
          // Level 2 without salesperson - came directly from level 0 with type filter
          await loadSectorData(
            value,
            selectedSector,
            selectedColumnType || undefined
          );
        }
      }
    } else if (drillLevel === 1 && selectedSalesperson) {
      await loadPipelineData(selectedSalesperson, value);
    } else if (drillLevel === 2 && selectedColumnType) {
      try {
        setDrilldownLoading(true);
        const companyName = user?.company?.company_name || "";
        const filters: PipelineReportFilters = {
          company: companyName,
          salesperson: selectedSalesperson || "",
          type: selectedColumnType || undefined,
          ...(user?.pulse_id === "P2CCI" && { calculation }),
          ...(globalSearch &&
            globalSearch.trim() && { search: globalSearch.trim() }),
          period: value,
        };
        // Include region for sector drilldown
        if (selectedSector) {
          filters.region = selectedSector;
        }
        // Include service and service_type for product drilldown
        if (selectedService) {
          filters.service = selectedService;
        }
        if (selectedServiceType) {
          filters.service_type = toTitleCase(selectedServiceType);
        }
        // Use the correct endpoint based on context
        let response;
        if (selectedSector) {
          // Sector drilldown - use regional endpoint
          response = await getPotentialCustomersDataForRegional(filters);
        } else if (selectedService) {
          // Product drilldown - use product endpoint
          response = await getPotentialCustomersDataForProduct(filters);
        } else {
          // Salesperson drilldown - use default endpoint
          response = await getPotentialCustomersData(filters);
        }
        setPotentialCustomersData(transformNullValues(response.data || []));
      } catch (error) {
        console.error("Error reloading detailed data:", error);
        setPotentialCustomersData([]);
      } finally {
        setDrilldownLoading(false);
      }
    }
  };

  // Handle cell editing for expected column (salesman card - drill level 1)
  const handleCellEdit = async (
    rowIndex: number,
    columnKey: string,
    newValue: string | number,
    rowData: PipelineCustomerRow | PipelineSalespersonRow,
    isEnterKey: boolean = false
  ) => {
    if (columnKey !== "expected") return;

    // If Enter key was not pressed (blur event), revert to original value
    if (!isEnterKey) {
      // The DetailedViewTable already handles reverting on blur
      return;
    }

    // Only allow editing at drill level 1 (customer level) where we have customer_code
    if (drillLevel !== 1) {
      console.error("Expected editing is only allowed at drill level 1");
      return;
    }

    // Enter key was pressed - proceed with API call
    const customerCode = (rowData as PipelineCustomerRow).customer_code;

    if (!customerCode) {
      console.error("Customer code not found");
      return;
    }

    // Store original value before making changes
    const originalValue = drilldownData[rowIndex]?.expected;

    setCellEditLoading(true);
    try {
      // Call API to update expected profit
      await updateExpectedProfit({
        customer_code: customerCode,
        expected_profit: Number(newValue),
      });

      // After successful API call, refetch pipeline data at current drill level
      if (selectedSalesperson) {
        await loadPipelineData(selectedSalesperson, period);
      }
    } catch (error) {
      console.error("Error updating expected profit:", error);
      // On error, revert to original value
      if (originalValue !== null && originalValue !== undefined) {
        const updatedData = [...drilldownData];
        updatedData[rowIndex] = {
          ...updatedData[rowIndex],
          expected: originalValue,
        };
        setDrilldownData(updatedData);
      }
    } finally {
      setCellEditLoading(false);
    }
  };

  // Handle cell editing for expected column (sector/region card - drill level 2)
  const handleSectorCellEdit = async (
    rowIndex: number,
    columnKey: string,
    newValue: string | number,
    rowData: PipelineCustomerRow | PipelineSalespersonRow,
    isEnterKey: boolean = false
  ) => {
    if (columnKey !== "expected") return;

    // If Enter key was not pressed (blur event), revert to original value
    if (!isEnterKey) {
      // The DetailedViewTable already handles reverting on blur
      return;
    }

    // Only allow editing at drill level 2 (customer level) where we have customer_code
    if (sectorDrillLevel !== 2) {
      console.error("Expected editing is only allowed at sector drill level 2");
      return;
    }

    // Enter key was pressed - proceed with API call
    const customerCode = (rowData as PipelineCustomerRow).customer_code;

    if (!customerCode) {
      console.error("Customer code not found");
      return;
    }

    // Store original value before making changes
    const originalValue = sectorDrilldownData[rowIndex]?.expected;

    setSectorDrilldownLoading(true);
    try {
      // Call API to update expected profit
      await updateExpectedProfit({
        customer_code: customerCode,
        expected_profit: Number(newValue),
      });

      // After successful API call, refetch sector customer data at current drill level
      if (selectedSalesperson && selectedSector) {
        await loadSectorCustomerData(
          selectedSalesperson,
          period,
          selectedColumnType || undefined
        );
      }
    } catch (error) {
      console.error("Error updating expected profit:", error);
      // On error, revert to original value
      if (originalValue !== null && originalValue !== undefined) {
        const updatedData = [...sectorDrilldownData];
        updatedData[rowIndex] = {
          ...updatedData[rowIndex],
          expected: originalValue,
        };
        setSectorDrilldownData(updatedData);
      }
    } finally {
      setSectorDrilldownLoading(false);
    }
  };

  // Handle cell editing for expected column (product card - drill level 2)
  const handleProductCellEdit = async (
    rowIndex: number,
    columnKey: string,
    newValue: string | number,
    rowData: PipelineCustomerRow | PipelineSalespersonRow,
    isEnterKey: boolean = false
  ) => {
    if (columnKey !== "expected") return;

    // If Enter key was not pressed (blur event), revert to original value
    if (!isEnterKey) {
      // The DetailedViewTable already handles reverting on blur
      return;
    }

    // Only allow editing at drill level 2 (customer level) where we have customer_code
    if (productDrillLevel !== 2) {
      console.error(
        "Expected editing is only allowed at product drill level 2"
      );
      return;
    }

    // Enter key was pressed - proceed with API call
    const customerCode = (rowData as PipelineCustomerRow).customer_code;

    if (!customerCode) {
      console.error("Customer code not found");
      return;
    }

    // Store original value before making changes
    const originalValue = productDrilldownData[rowIndex]?.expected;

    setProductDrilldownLoading(true);
    try {
      // Call API to update expected profit
      await updateExpectedProfit({
        customer_code: customerCode,
        expected_profit: Number(newValue),
      });

      // After successful API call, refetch product customer data at current drill level
      if (selectedSalesperson && selectedService && selectedServiceType) {
        await loadProductCustomerData(
          selectedSalesperson,
          period,
          selectedColumnType || undefined
        );
      }
    } catch (error) {
      console.error("Error updating expected profit:", error);
      // On error, revert to original value
      if (originalValue !== null && originalValue !== undefined) {
        const updatedData = [...productDrilldownData];
        updatedData[rowIndex] = {
          ...updatedData[rowIndex],
          expected: originalValue,
        };
        setProductDrilldownData(updatedData);
      }
    } finally {
      setProductDrilldownLoading(false);
    }
  };

  // Map sector data to table format - exclude total at base level
  const sectorTableData = sectorData.map((item) => {
    const baseData = {
      region: item.region || "-",
      potential: item.potential_profit || 0,
      pipeline: item.pipeline_profit || 0,
      gained: item.gained_profit || 0,
      lost: item.lost_profit || 0,
      quote: item.quoted_profit || 0,
      expected: item.expected_profit || 0,
    };
    // Only include total if not at base level (sectorDrillLevel > 0)
    if (sectorDrillLevel > 0) {
      return { ...baseData, total: item.total_profit || 0 };
    }
    return baseData;
  });

  // Helper function to add total row from summary
  const addTotalRowFromSummary = (
    data: any[],
    summary: {
      total_expected: number;
      total_potential: number;
      total_pipeline: number;
      total_quoted: number;
      total_gained: number;
      total_lost: number;
    },
    firstColumnKey: string = "salesperson"
  ): any[] => {
    if (!summary || data.length === 0) {
      return data;
    }

    // Create total row based on data structure
    const firstRow = data[0];
    const totalRow: any = {
      [firstColumnKey]: "TOTAL", // Already uppercase, will be styled as bold in DetailedViewTable
      potential: summary.total_potential || 0,
      pipeline: summary.total_pipeline || 0,
      gained: summary.total_gained || 0,
      lost: summary.total_lost || 0,
      quote: summary.total_quoted || 0,
      expected: summary.total_expected || 0,
      _isTotalRow: true, // Flag to identify total row
    };

    // Preserve other fields from first row (like customer_code, customer_name, etc.)
    Object.keys(firstRow).forEach((key) => {
      if (
        ![
          firstColumnKey,
          "potential",
          "pipeline",
          "gained",
          "lost",
          "quote",
          "expected",
          "quoted",
        ].includes(key)
      ) {
        totalRow[key] = "";
      }
    });

    return [...data, totalRow];
  };

  // Determine which sector data to show and add totals
  const displaySectorData = useMemo(() => {
    // When there's a type filter, show totals at drill level 2 but not at other levels
    if (selectedColumnType) {
      const data =
        sectorDrillLevel === 0
          ? sectorTableData
          : sectorDrillLevel === 1
            ? sectorSalespersonData
            : sectorDrilldownData;

      // Show total row at drill level 2 even with type filter
      if (sectorDrillLevel === 2 && sectorDrilldownSummary) {
        return addTotalRowFromSummary(
          sectorDrilldownData,
          sectorDrilldownSummary,
          "customer_name"
        );
      }

      return data;
    }

    // Show total at all drill levels if summary is available
    if (sectorDrillLevel === 0 && sectorSummary) {
      return addTotalRowFromSummary(sectorTableData, sectorSummary, "region");
    } else if (sectorDrillLevel === 1 && sectorSalespersonSummary) {
      return addTotalRowFromSummary(
        sectorSalespersonData,
        sectorSalespersonSummary,
        "salesperson"
      );
    } else if (sectorDrillLevel === 2 && sectorDrilldownSummary) {
      return addTotalRowFromSummary(
        sectorDrilldownData,
        sectorDrilldownSummary,
        "customer_name"
      );
    }

    return sectorDrillLevel === 0
      ? sectorTableData
      : sectorDrillLevel === 1
        ? sectorSalespersonData
        : sectorDrilldownData;
  }, [
    sectorTableData,
    sectorSalespersonData,
    sectorDrilldownData,
    sectorSummary,
    sectorSalespersonSummary,
    sectorDrilldownSummary,
    sectorDrillLevel,
    selectedColumnType,
  ]);

  // Add total row for salesperson tab using summary
  const salespersonDataWithTotals = useMemo(() => {
    // Don't show total if there's a "type" in filters (financial column drilldown)
    if (selectedColumnType) {
      return drillLevel === 0 ? pipelineData : drilldownData;
    }

    // Show total at all drill levels if summary is available
    if (drillLevel === 0 && pipelineSummary) {
      return addTotalRowFromSummary(
        pipelineData,
        pipelineSummary,
        "salesperson"
      );
    } else if (drillLevel === 1 && drilldownSummary) {
      return addTotalRowFromSummary(
        drilldownData,
        drilldownSummary,
        "customer_name"
      );
    }

    return drillLevel === 0 ? pipelineData : drilldownData;
  }, [
    pipelineData,
    drilldownData,
    pipelineSummary,
    drilldownSummary,
    drillLevel,
    selectedColumnType,
  ]);

  // Filter data based on drill level
  // Use salespersonDataWithTotals for salesperson tab at all drill levels (except when type is selected)
  const currentData =
    drillLevel === 0
      ? salespersonDataWithTotals
      : drillLevel === 1
        ? salespersonDataWithTotals
        : potentialCustomersData;

  // Determine which product data to show and add totals
  const displayProductData = useMemo(() => {
    // When there's a type filter, show totals at drill level 2 but not at other levels
    if (selectedColumnType) {
      const data =
        productDrillLevel === 0
          ? productData
          : productDrillLevel === 1
            ? productSalespersonData
            : productDrilldownData;

      // Show total row at drill level 2 even with type filter
      if (productDrillLevel === 2 && productDrilldownSummary) {
        return addTotalRowFromSummary(
          productDrilldownData,
          productDrilldownSummary,
          "customer_name"
        );
      }

      return data;
    }

    // Show total at all drill levels if summary is available
    if (productDrillLevel === 0 && productSummary) {
      return addTotalRowFromSummary(productData, productSummary, "service");
    } else if (productDrillLevel === 1 && productSalespersonSummary) {
      return addTotalRowFromSummary(
        productSalespersonData,
        productSalespersonSummary,
        "salesperson"
      );
    } else if (productDrillLevel === 2 && productDrilldownSummary) {
      return addTotalRowFromSummary(
        productDrilldownData,
        productDrilldownSummary,
        "customer_name"
      );
    }

    return productDrillLevel === 0
      ? productData
      : productDrillLevel === 1
        ? productSalespersonData
        : productDrilldownData;
  }, [
    productData,
    productSalespersonData,
    productDrilldownData,
    productSummary,
    productSalespersonSummary,
    productDrilldownSummary,
    productDrillLevel,
    selectedColumnType,
  ]);

  // Show financial column detail view when drillLevel === 2 (from clicking financial columns)
  // This takes precedence over sector/product drill level views
  if (drillLevel === 2 && selectedCustomer && selectedColumnType) {
    // Determine which back handler to use based on context
    let backHandler = handleBack;
    if (selectedSector) {
      backHandler = handleSectorBack;
    } else if (selectedService) {
      backHandler = handleProductBack;
    }

    return (
      <DetailedViewTable
        data={potentialCustomersData}
        title={getTitle()}
        drillLevel={2}
        moduleType="pipelineReport"
        onClose={handleResetToBase}
        loading={drilldownLoading}
        onColumnClick={handleColumnClick}
        onBack={backHandler}
        showBackButton={true}
        showCloseButton={true}
        headerActions={
          <Group gap="sm" align="center">
            {/* <SegmentedControl
              value={calculation}
              onChange={(value) => {
                setCalculation(value as "volume" | "no_of_shipments");
              }}
              data={[
                { label: "Volume", value: "volume" },
                { label: "No. of Shipments ppp", value: "no_of_shipments" },
              ]}
              size="xs"
              color="#105476"
              styles={{
                root: {
                  backgroundColor: "#f0f0f0",
                },
                indicator: {
                  backgroundColor: "#105476",
                },
                label: {
                  color: "#105476",
                  fontWeight: 500,
                  fontSize: "12px",
                  padding: "4px 8px",
                },
              }}
            /> */}
            {/* Commented out - can be used in future case */}
            {/* <Select
              placeholder="Select period"
              data={[
                { value: "current-month", label: "Current month" },
                { value: "monthly", label: "Last Month" },
                { value: "quarterly", label: "Last 3 Months" },
                { value: "half-yearly", label: "Last 6 Months" },
              ]}
              value={period}
              onChange={handlePeriodChange}
              size="xs"
              style={{ width: "150px" }}
            /> */}
          </Group>
        }
        onCellEdit={undefined}
      />
    );
  }

  // Show product drill level view (similar to salesperson drill level)
  if (productDrillLevel > 0) {
    return (
      <DetailedViewTable
        data={displayProductData}
        title={getTitle()}
        drillLevel={productDrillLevel}
        moduleType="pipelineReport"
        onClose={handleResetToBase}
        loading={
          productLoading ||
          productSalespersonLoading ||
          productDrilldownLoading ||
          cellEditLoading
        }
        onColumnClick={handleProductColumnClick}
        onBack={productDrillLevel > 0 ? handleProductBack : undefined}
        showBackButton={productDrillLevel > 0}
        showCloseButton={productDrillLevel > 0}
        headerActions={
          <Group gap="sm" align="center">
            {/* <SegmentedControl
              value={calculation}
              onChange={(value) => {
                setCalculation(value as "volume" | "no_of_shipments");
              }}
              data={[
                { label: "Volume", value: "volume" },
                { label: "No. of Shipments", value: "no_of_shipments" },
              ]}
              size="xs"
              color="#105476"
              styles={{
                root: {
                  backgroundColor: "#f0f0f0",
                },
                indicator: {
                  backgroundColor: "#105476",
                },
                label: {
                  color: "#105476",
                  fontWeight: 500,
                  fontSize: "12px",
                  padding: "4px 8px",
                },
              }}
            /> */}
            {/* Commented out - can be used in future case */}
            {/* <Select
              placeholder="Select period"
              data={[
                { value: "current-month", label: "Current month" },
                { value: "monthly", label: "Last Month" },
                { value: "quarterly", label: "Last 3 Months" },
                { value: "half-yearly", label: "Last 6 Months" },
              ]}
              value={period}
              onChange={handlePeriodChange}
              size="xs"
              style={{ width: "150px" }}
            /> */}
          </Group>
        }
        onCellEdit={handleProductCellEdit}
      />
    );
  }

  // Show sector drill level view (similar to salesperson drill level)
  if (sectorDrillLevel > 0) {
    return (
      <DetailedViewTable
        data={displaySectorData}
        title={getTitle()}
        drillLevel={sectorDrillLevel}
        moduleType="pipelineReport"
        onClose={handleResetToBase}
        loading={
          sectorLoading ||
          sectorSalespersonLoading ||
          sectorDrilldownLoading ||
          cellEditLoading
        }
        onColumnClick={handleSectorColumnClick}
        onBack={sectorDrillLevel > 0 ? handleSectorBack : undefined}
        showBackButton={sectorDrillLevel > 0}
        showCloseButton={sectorDrillLevel > 0}
        headerActions={
          <Group gap="sm" align="center">
            {/* <SegmentedControl
              value={calculation}
              onChange={(value) => {
                setCalculation(value as "volume" | "no_of_shipments");
              }}
              data={[
                { label: "Volume", value: "volume" },
                { label: "No. of Shipments", value: "no_of_shipments" },
              ]}
              size="xs"
              color="#105476"
              styles={{
                root: {
                  backgroundColor: "#f0f0f0",
                },
                indicator: {
                  backgroundColor: "#105476",
                },
                label: {
                  color: "#105476",
                  fontWeight: 500,
                  fontSize: "12px",
                  padding: "4px 8px",
                },
              }}
            /> */}
            {/* Commented out - can be used in future case */}
            {/* <Select
              placeholder="Select period"
              data={[
                { value: "current-month", label: "Current month" },
                { value: "monthly", label: "Last Month" },
                { value: "quarterly", label: "Last 3 Months" },
                { value: "half-yearly", label: "Last 6 Months" },
              ]}
              value={period}
              onChange={handlePeriodChange}
              size="xs"
              style={{ width: "150px" }}
            /> */}
          </Group>
        }
        onCellEdit={handleSectorCellEdit}
      />
    );
  }

  // Handle tab change - load data if not already loaded
  const handleTabChange = (value: string | null) => {
    if (!value) return;
    setActiveTab(value);

    // Load data for the selected tab if not already loaded
    if (value === "product" && productData.length === 0 && !productLoading) {
      loadProductData();
    } else if (
      value === "region" &&
      sectorData.length === 0 &&
      !sectorLoading
    ) {
      loadSectorData();
    }
  };

  // Show both sections in tabs panel only at drill level 0
  if (drillLevel === 0) {
    return (
      <Box>
        <Group justify="space-between" align="center" >
          <Text size="lg" fw={600} c="#105476">
            {/* Pipeline Report */}
          </Text>
          <Group gap="md" align="center">
            {user?.pulse_id === "P2CCI" && (
              <SegmentedControl
                value={calculation}
                onChange={(value) => {
                  setCalculation(value as "volume" | "no_of_shipments");
                }}
                data={[
                  { label: "Volume", value: "volume" },
                  { label: "No. of Shipments", value: "no_of_shipments" },
                ]}
                size="xs"
                color="#105476"
                styles={{
                  root: {
                    backgroundColor: "#f0f0f0",
                  },
                  indicator: {
                    backgroundColor: "#105476",
                  },
                  label: {
                    color: "#105476",
                    fontWeight: 500,
                    fontSize: "12px",
                    padding: "4px 8px",
                    "&[data-active]": {
                      color: "white",
                    },
                  },
                }}
              />
            )}
            {/* Commented out - can be used in future case */}
            {/* <Select
              placeholder="Select period"
              data={[
                { value: "current-month", label: "Current month" },
                { value: "monthly", label: "Last Month" },
                { value: "quarterly", label: "Last 3 Months" },
                { value: "half-yearly", label: "Last 6 Months" },
              ]}
              value={period}
              onChange={handlePeriodChange}
              size="xs"
              style={{ width: "150px" }}
            /> */}
          </Group>
        </Group>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tabs.List>
            <Tabs.Tab
              value="salesperson"
              style={{
                backgroundColor:
                  activeTab === "salesperson" ? "#105476" : "transparent",
                color: activeTab === "salesperson" ? "white" : "#105476",
                fontWeight: activeTab === "salesperson" ? 600 : 400,
              }}
            >
              Salesperson
            </Tabs.Tab>
            <Tabs.Tab
              value="product"
              style={{
                backgroundColor:
                  activeTab === "product" ? "#105476" : "transparent",
                color: activeTab === "product" ? "white" : "#105476",
                fontWeight: activeTab === "product" ? 600 : 400,
              }}
            >
              Product
            </Tabs.Tab>
            <Tabs.Tab
              value="region"
              style={{
                backgroundColor:
                  activeTab === "region" ? "#105476" : "transparent",
                color: activeTab === "region" ? "white" : "#105476",
                fontWeight: activeTab === "region" ? 600 : 400,
              }}
            >
              Region/Sector
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="salesperson" pt="md">
            <Box
              style={{
                height: "65vh",
                overflow: "hidden",
                overflowX: "hidden",
                position: "relative",
                paddingBottom: "60px", // Add padding to ensure total row is visible with scroll
              }}
            >
              <DetailedViewTable
                data={salespersonDataWithTotals}
                title=""
                drillLevel={drillLevel}
                moduleType="pipelineReport"
                onClose={() => {}}
                loading={initialLoading || cellEditLoading}
                onColumnClick={handleColumnClick}
                onBack={undefined}
                showBackButton={false}
                showCloseButton={false}
                headerActions={undefined}
                onCellEdit={handleCellEdit}
              />
            </Box>
          </Tabs.Panel>

          <Tabs.Panel value="product" pt="md">
            {onBack && (
              <Group justify="flex-end" mb="md">
                <Button
                  leftSection={<IconArrowLeft size={16} />}
                  onClick={handleResetToBase}
                  variant="outline"
                  size="xs"
                  color="#105476"
                >
                  Back to Dashboard
                </Button>
              </Group>
            )}
            <Box
              style={{
                height: onBack ? "60vh" : "65vh",
                overflow: "hidden",
                overflowX: "hidden",
                position: "relative",
                paddingBottom: "60px", // Add padding to ensure total row is visible with scroll
              }}
            >
              <DetailedViewTable
                data={displayProductData}
                title=""
                drillLevel={productDrillLevel}
                moduleType="pipelineReport"
                onClose={() => {
                  if (onBack) {
                    onBack();
                  }
                }}
                loading={
                  productLoading ||
                  productSalespersonLoading ||
                  productDrilldownLoading
                }
                onColumnClick={handleProductColumnClick}
                onBack={undefined}
                showBackButton={false}
                showCloseButton={false}
                headerActions={undefined}
                onCellEdit={undefined}
              />
            </Box>
          </Tabs.Panel>

          <Tabs.Panel value="region" pt="md">
            {onBack && (
              <Group justify="flex-end" mb="md">
                <Button
                  leftSection={<IconArrowLeft size={16} />}
                  onClick={handleResetToBase}
                  variant="outline"
                  size="xs"
                  color="#105476"
                >
                  Back to Dashboard
                </Button>
              </Group>
            )}
            <Box
              style={{
                height: onBack ? "60vh" : "65vh",
                overflow: "hidden",
                overflowX: "hidden",
                position: "relative",
                paddingBottom: "60px", // Add padding to ensure total row is visible with scroll
              }}
            >
              <DetailedViewTable
                data={displaySectorData}
                title=""
                drillLevel={sectorDrillLevel}
                moduleType="pipelineReport"
                onClose={() => {
                  if (onBack) {
                    onBack();
                  }
                }}
                loading={
                  sectorLoading ||
                  sectorSalespersonLoading ||
                  sectorDrilldownLoading
                }
                onColumnClick={handleSectorColumnClick}
                onBack={undefined}
                showBackButton={false}
                showCloseButton={false}
                headerActions={undefined}
                onCellEdit={handleSectorCellEdit}
              />
            </Box>
          </Tabs.Panel>
        </Tabs>
      </Box>
    );
  }

  // For drill levels 1 and 2, show the existing detailed view
  return (
    <DetailedViewTable
      data={currentData}
      title={getTitle()}
      drillLevel={drillLevel}
      moduleType="pipelineReport"
      onClose={handleResetToBase}
      loading={initialLoading || drilldownLoading || cellEditLoading}
      onColumnClick={handleColumnClick}
      onBack={drillLevel > 0 ? handleBack : undefined}
      showBackButton={drillLevel > 0}
      showCloseButton={drillLevel > 0}
      headerActions={
        <Group gap="sm" align="center">
          {/* <SegmentedControl
            value={calculation}
            onChange={(value) => {
              setCalculation(value as "volume" | "no_of_shipments");
            }}
            data={[
              { label: "Volume", value: "volume" },
              { label: "No. of Shipments", value: "no_of_shipments" },
            ]}
            size="xs"
            color="#105476"
            styles={{
              root: {
                backgroundColor: "#f0f0f0",
              },
              indicator: {
                backgroundColor: "#105476",
              },
              label: {
                color: "#105476",
                fontWeight: 500,
                fontSize: "12px",
                padding: "4px 8px",
              },
            }}
          /> */}
          {/* Commented out - can be used in future case */}
          {/* <Select
            placeholder="Select period"
            data={[
              { value: "current-month", label: "Current month" },
              { value: "monthly", label: "Last Month" },
              { value: "quarterly", label: "Last 3 Months" },
              { value: "half-yearly", label: "Last 6 Months" },
            ]}
            value={period}
            onChange={handlePeriodChange}
            size="xs"
            style={{ width: "150px" }}
          /> */}
        </Group>
      }
      onCellEdit={handleCellEdit}
    />
  );
};

export default PipelineReport;
