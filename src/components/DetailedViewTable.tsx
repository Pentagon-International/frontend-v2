import React, { useCallback, useMemo, useState } from "react";
import {
  Text,
  Button,
  Group,
  Box,
  Stack,
  Badge,
  Center,
  Loader,
  ActionIcon,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { IconArrowLeft, IconSend } from "@tabler/icons-react";
import useAuthStore from "../store/authStore";
import {
  formatUserInteger,
  getDefaultBranchCountryCode,
} from "../utils/userNumberFormat";
import { formatMoneyAmountForUi } from "../utils/nonDecimalMoneyAmount";
import {
  MantineReactTable,
  MRT_ColumnDef,
  useMantineReactTable,
} from "mantine-react-table";

/**
 * Pipeline report → drill-level-2 line-item grid only.
 * Each known column key has its own width; unknown keys use `default`.
 * Array-valued columns fall back to `arrayColumnFallback` when the field key has no entry.
 */
const MONEY_TOTAL_KEYS = new Set([
  "outstanding",
  "overdue",
  "local_outstanding",
  "total_cost",
  "total_sell",
  "profit",
  "expected_profit",
  "potential_profit",
  "credit_amount",
  "actual_budget",
  "sales_budget",
  "incentive_amount",
  "potential",
  "pipeline",
  "gained",
  "lost",
  "quote",
  "quoted",
  "quoted_created",
  "expected",
  "POTENTIAL",
  "PIPELINE",
  "GAINED",
  "LOST",
  "QUOTED",
  "EXPECTED",
]);

function formatMoneyTotalCell(value: unknown): string {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? formatMoneyAmountForUi(n) : String(value ?? "");
}

const PIPELINE_REPORT_DRILL2_COL_WIDTH: Record<string, number> = {
  default: 120,
  arrayColumnFallback: 170,
  sno: 40,
  quotation_id: 105,
  enquiry_id: 225,
  ENQUIRY_ID: 225,
  customer_code: 95,
  customer_name: 210,
  CUSTOMER_NAME: 210,
  service: 100,
  trade: 90,
  service_type: 105,
  origin_port_name: 175,
  destination_port_name: 175,
  carrier_name: 115,
  quote_currency: 85,
  valid_upto: 100,
  quote_type: 102,
  total_cost: 102,
  total_sell: 102,
  profit: 90,
  date: 150,
  call_date: 105,
  call_mode: 95,
  call_summary: 140,
  followup_date: 105,
  followup_action: 125,
  created_by: 110,
  expected_profit: 105,
  total_enquiries: 95,
  total_enquiry: 95,
  gain_percentage: 132,
  loss_percentage: 132,
  active_percentage: 132,
  quoted_percentage: 132,
  salesperson: 118,
  salesman_name: 118,
  salesman: 118,
  SALESPERSON: 118,
  USER_NAME: 118,
  region: 108,
  product: 100,
  volume: 85,
  reject_remark: 160,
  call_entry_id: 105,
  CALL_ENTRY_ID: 105,
  id: 70,
  potential: 94,
  pipeline: 94,
  gained: 94,
  lost: 94,
  quote: 94,
  quoted: 94,
  quoted_created: 94,
  quote_created: 94,
  expected: 94,
  active: 94,
  OVERDUE: 94,
  TODAY: 94,
  UPCOMING: 94,
  CLOSED: 94,
  POTENTIAL: 94,
  PIPELINE: 94,
  GAINED: 94,
  LOST: 94,
  QUOTED: 94,
  EXPECTED: 94,
  outstanding: 118,
  overdue: 118,
  local_outstanding: 118,
  overdue_days: 102,
  actual_budget: 105,
  sales_budget: 105,
  incentive_amount: 118,
  total_customers: 105,
  achieved: 105,
  send_email: 72,
};

interface DetailedViewTableProps {
  data: any[];
  title: string;
  onClose: () => void;
  loading?: boolean;
  moduleType?: string;
  totalRecords?: number;
  drillLevel?: number;
  onPaginationChange?: (pagination: {
    pageIndex: number;
    pageSize: number;
  }) => void;
  onColumnClick?: (
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
      | "quotation_id"
      | "call_entry_id"
      | "active"
      | "lost"
      | "quote"
      | "overdue"
      | "today"
      | "upcoming"
      | "closed"
      | "region"
      | "service"
      | "services"
      | "service_type"
      | "send_email",
    value: string,
    additionalData?: any
  ) => void;
  onBack?: () => void;
  showBackButton?: boolean;
  showCloseButton?: boolean; // controls visibility of Back to Dashboard button
  headerActions?: React.ReactNode; // Custom header actions (e.g., period dropdown)
  onCellEdit?: (
    rowIndex: number,
    columnKey: string,
    newValue: string | number,
    rowData: any,
    isEnterKey?: boolean
  ) => void; // Callback for cell editing
  initialSearch?: string; // Initial search value from parent
  onSearchChange?: (search: string) => void; // Callback when search changes
  selectedColumnType?: string | null; // Selected column type for dynamic header display
  hideExpected?: boolean; // When true, hides the 'expected' column
}

const DetailedViewTable: React.FC<DetailedViewTableProps> = ({
  data,
  title,
  onClose,
  loading = false,
  moduleType = "",
  totalRecords = 0,
  drillLevel,
  onPaginationChange,
  onColumnClick,
  onBack,
  showBackButton = false,
  showCloseButton = true,
  headerActions,
  onCellEdit,
  selectedColumnType,
  hideExpected = false,
}) => {
  const pipelineReportDrill2 =
    moduleType === "pipelineReport" && drillLevel === 2;
  const branches = useAuthStore((state) => state.user?.branches);
  const branchCountryCode = getDefaultBranchCountryCode(branches);
  const formatPipelineNumber = useCallback((value: unknown): string => {
    if (typeof value === "number") {
      return formatUserInteger(value, branchCountryCode);
    }
    if (typeof value === "string" && !Number.isNaN(parseFloat(value))) {
      return formatUserInteger(parseFloat(value), branchCountryCode);
    }
    return String(value ?? "");
  }, [branchCountryCode]);

  // State to track which cell is being edited (rowIndex, columnKey)
  const [editingCell, setEditingCell] = useState<{
    rowIndex: number;
    columnKey: string;
  } | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [originalCellValue, setOriginalCellValue] = useState<
    string | number | null
  >(null);
  // Generate columns dynamically using MantineReactTable format
  const columns = useMemo<MRT_ColumnDef<any>[]>(() => {
    if (!data || data.length === 0) return [];
    /** Pipeline drill-2 only: width from explicit map; otherwise standard detailed-view width. */
    const pr2ColWidth = (dataKey: string, standardWidth: number): number => {
      if (!pipelineReportDrill2) return standardWidth;
      const resolved = PIPELINE_REPORT_DRILL2_COL_WIDTH[dataKey];
      if (resolved !== undefined) return resolved;
      return PIPELINE_REPORT_DRILL2_COL_WIDTH.default ?? standardWidth;
    };
    const columnDefs: MRT_ColumnDef<any>[] = [];
    // Always add 'S.No' as the first column, from API data
    // Use accessorFn to handle both lowercase and uppercase SNO keys
    columnDefs.push({
      id: "sno",
      header: "S.No",
      size: pr2ColWidth("sno", 70),
      enableColumnOrdering: false,
      accessorFn: (row: any) => {
        // Check for SNO in various case formats
        return row?.sno ?? row?.SNO ?? row?.s_no ?? row?.S_No ?? null;
      },
      Cell: ({ row }) => {
        console.log("row :", row.original);
        // Prefer API-provided value (with casing variants)
        const apiSno =
          row?.original?.sno ??
          row?.original?.SNO ??
          row?.original?.s_no ??
          row?.original?.S_No;

        // For customerNotVisited, newCustomer, and lostCustomer modules, use only API value (no fallback)
        const useApiValueOnly =
          moduleType === "customerNotVisited" ||
          moduleType === "newCustomer" ||
          moduleType === "lostCustomer";

        // For total rows, display the value if it exists (e.g., "Total:"), otherwise keep empty
        const isTotalRow = row.original?._isTotalRow === true;
        const displayValue = isTotalRow
          ? apiSno !== undefined && apiSno !== null && apiSno !== ""
            ? apiSno
            : "" // keep total rows clean if no value provided
          : useApiValueOnly
            ? apiSno !== undefined && apiSno !== null && apiSno !== ""
              ? apiSno
              : ""
            : apiSno !== undefined && apiSno !== null && apiSno !== ""
              ? apiSno
              : row.index + 1;

        return (
          <Text size="sm" style={{ fontWeight: 500 }}>
            {displayValue}
          </Text>
        );
      },
    });
    const firstItem = data[0];
    const showPipelineQuotationRejectRemark =
      moduleType === "pipelineReport" &&
      drillLevel === 2 &&
      (selectedColumnType === "quoted_created" ||
        selectedColumnType === "quoted" ||
        selectedColumnType === "quote" ||
        selectedColumnType === "lost");
    // const columnDefs: MRT_ColumnDef<any>[] = [];

    // Get company name from first row for header display
    const companyName = firstItem.company_name || firstItem.company || "";

    // Function to determine if 'id' field should be clickable based on response type
    const isNavigationEnabledId = (rowData: any) => {
      // Check if this is a quotation-related response (gained, quoted_created)
      const hasQuotationFields =
        rowData.quotation_id ||
        rowData.enquiry_id ||
        rowData.service_type ||
        rowData.trade;

      // Check if this is a call entry-related response (expected)
      const hasCallEntryFields =
        rowData.call_date ||
        rowData.call_mode_name ||
        rowData.call_summary ||
        rowData.followup_date;

      // Only make 'id' clickable for gained, quoted_created, and expected responses
      return hasQuotationFields || hasCallEntryFields;
    };

    // Define fields to hide based on data structure
    const fieldsToHide = new Set([
      // Common fields to hide
      "origin_port_code",
      "destination_port_code",

      // Fields to hide for quotation-related responses (quoted_created)
      "quotation_service_id",
      "quotation_status",
      "multi_carrier",
      "icd",
      "remark",
      // Hide validity field for pipeline report quotation views
      // Quote date will be shown using the `date` field instead
      ...(moduleType === "pipelineReport" ? ["valid_upto"] : []),
      // Only hide location for quotation-related responses, not for outstanding module
      ...(moduleType !== "outstanding" ? ["location"] : []),

      // Fields to hide for call entry responses (expected)
      "latitude",
      "longitude",
      "branch_code",
      "company_code",
      "salesman",

      // Hide email-related fields (used for send email functionality only)
      "salesperson_email",
      "cc_mail",

      ...(showPipelineQuotationRejectRemark ? ["reject_remark"] : []),

      // Hide service_type for pipelineReport when service is combined (has service_original)
      // This happens at base level and drill level 1 for product tab
      ...(moduleType === "pipelineReport" &&
      data &&
      data.length > 0 &&
      data[0]?.service_original !== undefined
        ? ["service_type", "service_original"]
        : []),

      // Fields to hide for quoted_created and gained responses
      "carrier_name",

      // Fields to hide for call entry responses (expected)
      "created_by_name",

      // Hide customer_name at drill level 2 only for non-enquiry modules (except pipelineReport which needs both columns)
      ...(drillLevel === 2 &&
      moduleType !== "enquiry" &&
      moduleType !== "pipelineReport"
        ? ["customer_name"]
        : []),

      // Fields to hide for outstanding module
      // salesman_code is always hidden
      // credit_day and credit_amount are only shown at drill level 3 (customer-wise)
      ...(moduleType === "outstanding"
        ? [
            "salesman_code",
            ...(drillLevel !== 3 ? ["credit_day", "credit_amount"] : []),
          ]
        : []),

      // Hide customer_code from display for enquiry and callentry modules
      // (but keep it in data for navigation purposes)
      ...(moduleType === "enquiry" || moduleType === "callentry"
        ? ["customer_code", "CUSTOMER_CODE"]
        : []),

      // Pipeline drill level 2 (e.g. salesman financial / line items): hide customer code column from UI
      ...(moduleType === "pipelineReport" && drillLevel === 2
        ? ["customer_code", "CUSTOMER_CODE"]
        : []),

      // Hide email-related fields - salesperson_email and cc_mail
      "salesperson_email",
      "cc_mail",

      // Hide id field for pipelineReport at drill level 2 (product tab customer drill level)
      ...(moduleType === "pipelineReport" &&
      drillLevel === 2 &&
      data &&
      data.length > 0 &&
      data[0]?.id !== undefined
        ? ["id"]
        : []),

      // Hide expected column when requested (Product and Region/Sector tabs)
      ...(hideExpected ? ["expected"] : []),
    ]);

    // Helper function to capitalize headers properly (first letter of each word)
    const capitalizeHeader = (text: string): string => {
      return text
        .split(" ")
        .map(
          (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join(" ");
    };

    // Define field name mappings for better display
    const fieldNameMappings: Record<string, string> = {
      sno: "S.No",
      quotation_id: "Quotation Id",
      enquiry_id: "Enquiry Id",
      call_entry_id: "Call Entry Id",
      id: "Id",
      customer_code: "Customer Code",
      customer_name: "Customer Name",
      service: "Service",
      trade: "Trade",
      origin_port_name: "Origin Port",
      destination_port_name: "Destination Port",
      carrier_name: "Carrier",
      quote_currency: "Currency",
      valid_upto: "Valid Upto",
      quote_type: "Quote Type",
      total_cost: "Total Cost",
      total_sell: "Total Sell",
      profit: "Profit",
      call_date: "Call Date",
      call_mode: "Call Mode",
      call_summary: "Call Summary",
      followup_date: "Follow-Up Date",
      followup_action: "Follow-Up Action",
      created_by: "Created By",
      expected_profit: "Expected Profit",
      total_enquiries: "Total Enquiries",
      total_enquiry: "Total Enquiry",
      gain_percentage: "Gain Percentage",
      loss_percentage: "Loss Percentage",
      active_percentage: "Active Percentage",
      quoted_percentage: "Quoted Percentage",
      salesperson: "Salesperson",
      region: "Region",
      reject_remark: "Reject Remark",
      product: "Product",
      volume: "Volume",
      // For pipeline report, dynamically show header based on selectedColumnType
      // If navigating from Gained -> "Quote Approved Date"
      // If navigating from Lost -> "Quote Rejected Date"
      // If navigating from Quoted -> "Quote Date"
      // For other modules, keep existing "Booking Date" label
      date:
        moduleType === "pipelineReport"
          ? selectedColumnType === "gained"
            ? "Quote Approved Date"
            : selectedColumnType === "lost"
              ? "Quote Rejected Date"
              : selectedColumnType === "quoted_created" ||
                  selectedColumnType === "quoted" ||
                  selectedColumnType === "quote"
                ? "Quote Date"
                : "Quote Date"
          : "Booking Date",
      OVERDUE: "Overdue",
      TODAY: "Today",
      UPCOMING: "Upcoming",
      CLOSED: "Closed",
      // Pipeline Report fields
      potential: "Potential",
      pipeline: "Pipeline",
      gained: "Gained",
      lost: "Lost",
      quote: "Quoted",
      quoted: "Quoted",
      quoted_created: "Quoted",
      expected: "Expected",
      POTENTIAL: "Potential",
      PIPELINE: "Pipeline",
      GAINED: "Gained",
      LOST: "Lost",
      QUOTED: "Quoted",
      EXPECTED: "Expected",
    };

    // Generate columns dynamically using MantineReactTable format
    Object.keys(firstItem).forEach((key) => {
      // Skip sno/SNO - already added as the first column (S.No)
      if (key === "sno" || key === "SNO" || key === "s_no" || key === "S_No") {
        return;
      }
      console.log("key :", key);
      console.log("firstItem :", firstItem);
      // Skip hidden fields
      if (fieldsToHide.has(key)) {
        return;
      }
      const value = firstItem[key];

      // Handle different data types
      if (Array.isArray(value)) {
        // For array fields, create a column that displays all items
        console.log("key : array", key);
        console.log("value : array", value);
        columnDefs.push({
          accessorKey: key,
          header: capitalizeHeader(
            fieldNameMappings[key] || key.replace(/_/g, " ")
          ),
          Cell: ({ row }) => (
            <Stack gap="xs">
              {row.original[key]?.map((location: string, index: number) => (
                <Badge key={index} variant="light" size="sm">
                  {location}
                </Badge>
              ))}
            </Stack>
          ),
          size: pipelineReportDrill2
            ? (PIPELINE_REPORT_DRILL2_COL_WIDTH[key] ??
                PIPELINE_REPORT_DRILL2_COL_WIDTH.arrayColumnFallback)
            : 200,
        });
        console.log("columnDefs :", columnDefs);
      } else if (
        key === "outstanding" ||
        key === "overdue" ||
        key === "local_outstanding"
      ) {
        columnDefs.push({
          accessorKey: key,
          header: capitalizeHeader(
            fieldNameMappings[key] || key.replace(/_/g, " ")
          ),
          Cell: ({ row }) => {
            const cellValue = row.original[key];
            const displayValue = formatMoneyTotalCell(cellValue);
            return (
              <Badge
                color={
                  key === "outstanding" || key === "local_outstanding"
                    ? "#105476"
                    : "#e74d3c"
                }
                size="md"
                variant="filled"
              >
                {displayValue}
              </Badge>
            );
          },
          size: pr2ColWidth(key, 150),
        });
      } else if (
        key === "actual_budget" ||
        key === "sales_budget" ||
        key === "incentive_amount"
      ) {
        // Special styling for actual_budget, sales_budget, and incentive_amount columns - display as badges
        const getHeaderText = (): string => {
          if (key === "actual_budget") return "Actual";
          if (key === "sales_budget") return "Budget";
          if (key === "incentive_amount") return "Applicable Incentive";
          // key is a string from Object.keys(), so we can safely use it
          const mappedText = fieldNameMappings[key as string];
          return capitalizeHeader(
            mappedText || (key as string).replace(/_/g, " ")
          );
        };

        const getBadgeColor = () => {
          if (key === "actual_budget") return "#086ea1";
          if (key === "sales_budget") return "#105476";
          if (key === "incentive_amount") return "#27ae60";
          return "#105476";
        };

        columnDefs.push({
          accessorKey: key,
          header: getHeaderText(),
          Cell: ({ row }) => {
            const cellValue = row.original[key];
            const displayValue = formatMoneyTotalCell(cellValue);
            return (
              <Badge color={getBadgeColor()} size="md" variant="filled">
                {displayValue}
              </Badge>
            );
          },
          size: pr2ColWidth(key, 150),
        });
      } else if (key === "overdue_days") {
        // Special styling for overdue_days column - display as badge
        columnDefs.push({
          accessorKey: key,
          header: key.replace(/_/g, " ").toUpperCase(),
          Cell: ({ row }) => {
            const cellValue = row.original[key];
            const displayValue =
              typeof cellValue === "number"
                ? cellValue.toLocaleString()
                : cellValue;
            return (
              <Badge color="#e74d3c" size="md" variant="filled">
                {displayValue}
              </Badge>
            );
          },
          size: pr2ColWidth(key, 150),
        });
      } else if (key === "achieved") {
        const getAchievementColor = (percentage: any) => {
          percentage = parseFloat(percentage);
          if (percentage >= 90) return "#27ae60";
          if (percentage >= 70) return "#FFBF00";
          return "#e74c3c";
        };
        columnDefs.push({
          accessorKey: key,
          header: capitalizeHeader(
            fieldNameMappings[key] || key.replace(/_/g, " ")
          ),
          Cell: ({ row }) => {
            const cellValue = row.original[key];
            return (
              <Badge
                color={getAchievementColor(cellValue)}
                size="md"
                variant="filled"
              >
                {cellValue}
              </Badge>
            );
          },
          size: pr2ColWidth("achieved", 150),
        });
        columnDefs.push({
          accessorKey: key,
          header: capitalizeHeader(
            fieldNameMappings[key] || key.replace(/_/g, " ")
          ),
          Cell: ({ row }) => {
            return (
              <Badge color="#e74c3c" size="md" variant="filled">
                {row.original[key]}
              </Badge>
            );
          },
          size: pr2ColWidth(key, 150),
        });
      } else if (
        key === "potential" ||
        key === "pipeline" ||
        key === "gained" ||
        key === "quote" ||
        key === "quoted" ||
        key === "quote_created" ||
        key === "expected" ||
        key === "active" ||
        key === "lost" ||
        key === "OVERDUE" ||
        key === "TODAY" ||
        key === "UPCOMING" ||
        key === "CLOSED"
      ) {
        // Pipeline report financial columns with badges
        const getPipelineColor = (key: string) => {
          switch (key) {
            case "potential":
              return "#105476";
            case "pipeline":
              return "#086ea1";
            case "gained":
              return "#27ae60";
            case "quote":
            case "quoted":
            case "quote_created":
              return "#FFBF00";
            case "lost":
              return "#e74c3c";
            case "expected":
              return "#FF9800"; // Orange color
            case "active":
              return "#086ea1";
            case "OVERDUE":
              return "#e74c3c"; // Red for overdue
            case "TODAY":
              return "#3b82f6"; // Blue for today
            case "UPCOMING":
              return "#059669"; // Green for upcoming
            case "CLOSED":
              return "#16a34a"; // Dark green for closed
            default:
              return "#105476";
          }
        };

        // Check if financial column should be clickable
        // For enquiry module: enable at drill level 0, 1, and 2 (at level 2, will navigate to EnquiryMaster)
        // For callentry module: enable at drill level 0 and 1 (badge columns)
        // For pipelineReport module: enable at drill level 0, 1, and 2 (all levels)
        //   At all levels, only pipeline, potential, gained, lost, quoted columns are clickable (not expected)
        // For other modules: enable at drill level 1
        const isCustomerLevelClickableColumn =
          moduleType === "pipelineReport" &&
          (key === "potential" ||
            key === "pipeline" ||
            key === "gained" ||
            key === "lost" ||
            key === "quote" ||
            key === "quoted" ||
            key === "quote_created");

        const isFinancialColumnClickable =
          (key === "potential" ||
            key === "pipeline" ||
            key === "gained" ||
            key === "quote" ||
            key === "quoted" ||
            key === "quote_created" ||
            key === "expected" ||
            key === "active" ||
            key === "lost" ||
            key === "OVERDUE" ||
            key === "TODAY" ||
            key === "UPCOMING" ||
            key === "CLOSED") &&
          onColumnClick &&
          (moduleType === "enquiry"
            ? drillLevel === 0 || drillLevel === 1 || drillLevel === 2
            : moduleType === "callentry"
              ? drillLevel === 0 || drillLevel === 1
              : moduleType === "pipelineReport"
                ? (drillLevel === 0 || drillLevel === 1 || drillLevel === 2) &&
                  isCustomerLevelClickableColumn
                : drillLevel === 1);

        // Legacy logic for other modules (not used for pipelineReport anymore as it now follows the same logic as enquiry/callentry)
        // Only show pointer at customer level for clickable financial columns
        // Check if data has customer_code to determine if we're at customer level
        const hasCustomerCode =
          data && data.length > 0 && data[0]?.customer_code !== undefined;
        const pipelineReportCustomerLevelPointer =
          moduleType === "pipelineReport" &&
          isCustomerLevelClickableColumn &&
          isFinancialColumnClickable &&
          hasCustomerCode;

        // Special handling for expected column - make it editable for pipelineReport
        // For salesman card: editable at drill level 1 (customer level)
        // For region/product cards: editable at drill level 2 (customer level)
        const isExpectedEditable =
          key === "expected" &&
          moduleType === "pipelineReport" &&
          onCellEdit &&
          (drillLevel === 1 || drillLevel === 2);

        columnDefs.push({
          accessorKey: key,
          header: capitalizeHeader(
            fieldNameMappings[key] || key.replace(/_/g, " ")
          ),
          Cell: ({ row }) => {
            const cellValue = row.original[key];
            const displayValue = MONEY_TOTAL_KEYS.has(key)
              ? formatMoneyTotalCell(cellValue)
              : moduleType === "pipelineReport" &&
                  typeof cellValue === "number"
                ? formatPipelineNumber(cellValue)
                : typeof cellValue === "number"
                  ? cellValue.toLocaleString()
                  : cellValue;

            const rowIndex = row.index;
            const isEditing =
              editingCell?.rowIndex === rowIndex &&
              editingCell?.columnKey === key;

            // Handle expected column editing
            if (isExpectedEditable && isEditing) {
              return (
                <>
                  <TextInput
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => {
                      // On blur, revert to original value without calling API
                      if (onCellEdit && originalCellValue !== null) {
                        onCellEdit(
                          rowIndex,
                          key,
                          originalCellValue,
                          row.original,
                          false
                        );
                      }
                      setEditingCell(null);
                      setEditValue("");
                      setOriginalCellValue(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const numValue = parseFloat(
                          editValue.replace(/,/g, "")
                        );
                        if (!isNaN(numValue) && onCellEdit) {
                          onCellEdit(
                            rowIndex,
                            key,
                            numValue,
                            row.original,
                            true
                          );
                        }
                        setEditingCell(null);
                        setEditValue("");
                        setOriginalCellValue(null);
                      } else if (e.key === "Escape") {
                        if (onCellEdit && originalCellValue !== null) {
                          onCellEdit(
                            rowIndex,
                            key,
                            originalCellValue,
                            row.original,
                            false
                          );
                        }
                        setEditingCell(null);
                        setEditValue("");
                        setOriginalCellValue(null);
                      }
                    }}
                    size="xs"
                    style={{ width: "120px" }}
                    autoFocus
                  />
                </>
              );
            }

            // Check if this is a total row
            const isTotalRow = row.original._isTotalRow === true;

            // For enquiry, call entry, and pipelineReport modules, disable click and cursor if badge value is 0
            const isEnquiryModule = moduleType === "enquiry";
            const isCallEntryModule = moduleType === "callentry";
            const isPipelineReportModule = moduleType === "pipelineReport";
            const isEnquiryBadge =
              isEnquiryModule &&
              (key === "active" ||
                key === "gained" ||
                key === "lost" ||
                key === "quote" ||
                key === "quote_created" ||
                key === "quoted");
            const isCallEntryBadge =
              isCallEntryModule &&
              (key === "OVERDUE" ||
                key === "TODAY" ||
                key === "UPCOMING" ||
                key === "CLOSED");
            const isPipelineReportBadge =
              isPipelineReportModule &&
              (key === "potential" ||
                key === "pipeline" ||
                key === "gained" ||
                key === "lost" ||
                key === "quote" ||
                key === "quoted" ||
                key === "quote_created" ||
                key === "expected");
            const isBadgeValueZero =
              (isEnquiryBadge || isCallEntryBadge || isPipelineReportBadge) &&
              (cellValue === 0 || cellValue === "0" || !cellValue);
            const shouldDisableClick = isBadgeValueZero;

            // Determine cursor style: show pointer if clickable and not disabled
            // For enquiry, call entry, and pipelineReport modules: show pointer when value > 0 and badge is clickable
            // For other modules: use legacy pipelineReportCustomerLevelPointer logic
            const shouldShowCursorPointer =
              isFinancialColumnClickable &&
              !shouldDisableClick &&
              (isEnquiryModule || isCallEntryModule || isPipelineReportModule
                ? true // Enquiry, call entry, and pipelineReport module badges show pointer when clickable and value > 0
                : pipelineReportCustomerLevelPointer ||
                  moduleType !== "pipelineReport");

            if (isFinancialColumnClickable && !isTotalRow) {
              return (
                <Badge
                  color={getPipelineColor(key)}
                  size="md"
                  variant="filled"
                  style={{
                    cursor: shouldShowCursorPointer ? "pointer" : "default",
                    color: "white",
                    opacity: isBadgeValueZero ? 0.5 : 1, // Reduce opacity for 0 values
                  }}
                  onClick={() => {
                    // Disable click if value is 0 for enquiry, call entry, and pipelineReport module badges
                    if (shouldDisableClick) {
                      return;
                    }
                    // If expected column is editable, start editing instead of drilling
                    if (isExpectedEditable && !isEditing) {
                      setEditingCell({ rowIndex, columnKey: key });
                      setEditValue(String(cellValue || ""));
                      setOriginalCellValue(cellValue);
                      return;
                    }
                    const columnTypeMap: Record<string, string> = {
                      sno: "sno",
                      potential: "potential",
                      pipeline: "pipeline",
                      gained: "gained",
                      quote: "quote",
                      quoted: "quote",
                      quote_created: "quote",
                      lost: "lost",
                      expected: "expected",
                      active: "active",
                      OVERDUE: "overdue",
                      TODAY: "today",
                      UPCOMING: "upcoming",
                      CLOSED: "closed",
                    };
                    let typeValue = columnTypeMap[key] || key;
                    // Pipeline report: in-progress column drills as `quoted` on the API
                    if (
                      (key === "quote" || key === "quoted") &&
                      moduleType === "pipelineReport"
                    ) {
                      typeValue = "quote";
                    }
                    onColumnClick(typeValue as any, cellValue, row.original);
                  }}
                >
                  {displayValue}
                </Badge>
              );
            }

            // For total row, show plain text without color highlights
            if (
              isTotalRow &&
              (key === "potential" ||
                key === "pipeline" ||
                key === "gained" ||
                key === "lost" ||
                key === "quote" ||
                key === "quoted" ||
                key === "quote_created" ||
                key === "expected" ||
                (key as string) === "profit" ||
                (key as string) === "potential_profit" ||
                key === "OVERDUE" ||
                key === "TODAY" ||
                key === "UPCOMING" ||
                key === "CLOSED")
            ) {
              return (
                <Text
                  size="sm"
                  style={{
                    fontWeight: 400,
                  }}
                >
                  {displayValue}
                </Text>
              );
            }

            // For expected column that's not clickable but editable
            if (isExpectedEditable) {
              return (
                <Badge
                  color={getPipelineColor(key)}
                  size="md"
                  variant="filled"
                  style={{
                    cursor: hasCustomerCode ? "pointer" : "default",
                    color: "white",
                  }}
                  onClick={() => {
                    if (!isEditing) {
                      setEditingCell({ rowIndex, columnKey: key });
                      setEditValue(String(cellValue || ""));
                      setOriginalCellValue(cellValue);
                    }
                  }}
                >
                  {displayValue}
                </Badge>
              );
            }

            // Check if this is a non-clickable badge with 0 value (for opacity)
            const isNonClickableBadgeZero =
              (isEnquiryBadge || isCallEntryBadge || isPipelineReportBadge) &&
              (cellValue === 0 || cellValue === "0" || !cellValue);

            return (
              <Badge
                color={getPipelineColor(key)}
                size="md"
                variant="filled"
                style={{
                  opacity: isNonClickableBadgeZero ? 0.5 : 1, // Reduce opacity for 0 values
                }}
              >
                {displayValue}
              </Badge>
            );
          },
          size: pr2ColWidth(key, 150),
        });
      } else if (
        key === "gain_percentage" ||
        key === "loss_percentage" ||
        key === "active_percentage" ||
        key === "quoted_percentage"
      ) {
        // Handle percentage columns - display with special formatting
        columnDefs.push({
          accessorKey: key,
          header: (fieldNameMappings[key] || key.toUpperCase())
            .split(" ")
            .map(
              (word) =>
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            )
            .join(" "),
          Cell: ({ row }) => {
            const cellValue = row.original[key];
            // Cell value is already a string with '%' (e.g., "75%")
            return (
              <Text size="sm" style={{ fontWeight: 500 }}>
                {cellValue || "0%"}
              </Text>
            );
          },
          size: pr2ColWidth(key, 170),
        });
      } else if (key === "send_email") {
        // Handle send_email column - display as icon button
        columnDefs.push({
          accessorKey: key,
          header: "Send Email",
          Cell: ({ row }) => {
            return (
              <Tooltip label="Send Email" position="top" withArrow>
                <ActionIcon
                  variant="light"
                  color="#105476"
                  size="md"
                  onClick={() => {
                    if (onColumnClick) {
                      onColumnClick(
                        "send_email",
                        row.original[key],
                        row.original
                      );
                    }
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <IconSend size={16} />
                </ActionIcon>
              </Tooltip>
            );
          },
          size: pr2ColWidth("send_email", 100),
        });
      } else {
        // For regular string fields - check if it's a clickable column
        // Check if this is a clickable column (excluding 'id' which will be checked per row)
        // Service and service_type are only clickable at drill level 0 (base level)
        // Financial columns (potential, pipeline, gained, lost, quoted, expected) are only clickable at drill level 2 (customer level)
        // USER_NAME and SALESPERSON are clickable for newCustomer, lostCustomer, customerNotVisited at drill level 0
        const isClickableColumn =
          key === "company_name" ||
          key === "company" ||
          key === "location" ||
          key === "Location" ||
          (key === "salesperson" && moduleType !== "customerNotVisited") ||
          (key === "salesman_name" && moduleType !== "customerNotVisited") ||
          (key === "salesman" && moduleType !== "customerNotVisited") ||
          (key === "SALESPERSON" &&
            (moduleType !== "customerNotVisited" ||
              (moduleType === "customerNotVisited" && drillLevel === 0))) ||
          (key === "USER_NAME" &&
            (moduleType === "newCustomer" ||
              moduleType === "lostCustomer" ||
              moduleType === "customerNotVisited") &&
            drillLevel === 0) ||
          key === "region" ||
          ((key === "service" ||
            key === "services" ||
            key === "service_type") &&
            drillLevel === 0) ||
          ((key === "potential" ||
            key === "pipeline" ||
            key === "gained" ||
            key === "lost" ||
            key === "quoted" ||
            key === "quoted_created" ||
            key === "expected") &&
            drillLevel === 2) ||
          key === "quotation_id" ||
          key === "call_entry_id" ||
          key === "CALL_ENTRY_ID";

        let headerText =
          fieldNameMappings[key] ||
          key
            .replace(/_/g, " ")
            .split(" ")
            .map(
              (word) =>
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            )
            .join(" ");

        // Ensure first letter of each word is capitalized (apply to fieldNameMappings values too)
        headerText = headerText
          .split(" ")
          .map(
            (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
          )
          .join(" ");

        // Special header handling for salesperson column when company name is available
        if (
          (key === "salesperson" ||
            key === "salesman_name" ||
            key === "salesman") &&
          companyName
        ) {
          headerText = `${headerText}`;
        }

        console.log("headerText :", headerText);
        console.log("key :", key);
        let standardFallback = 150;
        if (key === "enquiry_id" || key === "ENQUIRY_ID") {
          standardFallback = 280;
        } else if (key === "customer_name" || key === "CUSTOMER_NAME") {
          standardFallback = 320;
        }
        const columnSize = pr2ColWidth(key, standardFallback);

        columnDefs.push({
          accessorKey: key,
          header: headerText,
          Cell: ({ row }) => {
            const cellValue = row.original[key];

            // Check if this is a total row
            const isTotalRow = row.original._isTotalRow === true;

            // Check if this specific cell should be clickable
            const shouldBeClickable =
              (isClickableColumn ||
                (key === "id" && isNavigationEnabledId(row.original))) &&
              !isTotalRow;

            if (shouldBeClickable && onColumnClick) {
              return (
                <Text
                  size="sm"
                  style={{
                    cursor: "pointer",
                    color: "#105476",
                    textDecoration: "underline",
                  }}
                  onClick={() => {
                    if (key === "company_name" || key === "company") {
                      onColumnClick("company", cellValue, row.original);
                    } else if (key === "location" || key === "Location") {
                      onColumnClick("location", cellValue, row.original);
                    } else if (
                      key === "salesperson" ||
                      key === "salesman_name" ||
                      key === "salesman" ||
                      key === "SALESPERSON" ||
                      key === "USER_NAME"
                    ) {
                      onColumnClick("salesperson", cellValue, row.original);
                    } else if (key === "region") {
                      onColumnClick("region", cellValue, row.original);
                    } else if (key === "service" || key === "services") {
                      onColumnClick(
                        key === "service" ? "service" : "services",
                        cellValue,
                        row.original
                      );
                    } else if (key === "service_type") {
                      onColumnClick("service_type", cellValue, row.original);
                    } else if (key === "potential") {
                      onColumnClick("potential", cellValue, row.original);
                    } else if (key === "pipeline") {
                      onColumnClick("pipeline", cellValue, row.original);
                    } else if (key === "gained") {
                      onColumnClick("gained", cellValue, row.original);
                    } else if (key === "lost") {
                      onColumnClick("lost", cellValue, row.original);
                    } else if (key === "quoted" || key === "quoted_created") {
                      onColumnClick("quote", cellValue, row.original);
                    } else if (key === "expected") {
                      onColumnClick("expected", cellValue, row.original);
                    } else if (key === "quotation_id") {
                      onColumnClick("quotation_id", cellValue, row.original);
                    } else if (
                      key === "call_entry_id" ||
                      key === "CALL_ENTRY_ID"
                    ) {
                      onColumnClick("call_entry_id", cellValue, row.original);
                    } else if (key === "id") {
                      // Use the same logic to determine navigation type
                      const hasQuotationFields =
                        row.original.quotation_id ||
                        row.original.enquiry_id ||
                        row.original.service_type ||
                        row.original.trade;

                      const hasCallEntryFields =
                        row.original.call_date ||
                        row.original.call_mode_name ||
                        row.original.call_summary ||
                        row.original.followup_date;

                      if (hasQuotationFields) {
                        onColumnClick("quotation_id", cellValue, row.original);
                      } else if (hasCallEntryFields) {
                        onColumnClick("call_entry_id", cellValue, row.original);
                      }
                    }
                  }}
                >
                  {cellValue}
                </Text>
              );
            }

            // For total row first column (sno/salesperson/customer_name/region/service), make it uppercase and bold
            if (
              isTotalRow &&
              (key === "sno" ||
                key === "salesperson" ||
                key === "salesman_name" ||
                key === "salesman" ||
                key === "customer_name" ||
                key === "region" ||
                key === "service")
            ) {
              return (
                <Text
                  size="sm"
                  style={{ fontWeight: 700, textTransform: "uppercase" }}
                >
                  {cellValue}
                </Text>
              );
            }

            // Wider origin/destination columns: one-line ellipsis + Mantine hover tooltip
            if (
              key === "origin_port_name" ||
              key === "destination_port_name"
            ) {
              const portLabel =
                cellValue == null || cellValue === ""
                  ? "—"
                  : String(cellValue);
              return (
                <Tooltip
                  label={portLabel}
                  disabled={!portLabel || portLabel === "—"}
                  withArrow
                  position="top"
                  maw={360}
                  zIndex={1000}
                >
                  <Text
                    size="sm"
                    lineClamp={1}
                    style={{ cursor: "default", maxWidth: "100%" }}
                  >
                    {portLabel}
                  </Text>
                </Tooltip>
              );
            }

            const order = columns.map((col) =>
              col.accessorKey ? String(col.accessorKey) : (col.id as string)
            );
            if (!order.includes("sno")) {
              order.unshift("sno");
            }
            return <Text size="sm">{cellValue}</Text>;
          },
          size: columnSize,
        });
      }
    });

    if (showPipelineQuotationRejectRemark) {
      columnDefs.push({
        id: "reject_remark",
        accessorKey: "reject_remark",
        header: "Reject Remark",
        size: pr2ColWidth("reject_remark", 150),
        Cell: ({ row }) => {
          const raw = row.original?.reject_remark;
          const str = raw == null || raw === "" ? "" : String(raw);
          const truncated =
            str.length > 20 ? `${str.slice(0, 20)}…` : str;
          return (
            <Tooltip
              label={str || "—"}
              disabled={!str}
              withArrow
              position="top"
              multiline
              maw={"fit-content"}
              zIndex={1000}
            >
              <Text size="sm" style={{ cursor: "default" }}>
                {truncated || "—"}
              </Text>
            </Tooltip>
          );
        },
      });
    }

    console.log("columnDefs :", columnDefs);
    return columnDefs;
  }, [
    data,
    onColumnClick,
    drillLevel,
    moduleType,
    onCellEdit,
    editingCell,
    editValue,
    originalCellValue,
    selectedColumnType,
    hideExpected,
    pipelineReportDrill2,
    formatPipelineNumber,
  ]);

  const columnOrder = useMemo(() => {
    const order = columns.map((col) =>
      col.accessorKey ? String(col.accessorKey) : (col.id as string)
    );

    // Ensure customer_code comes before customer_name
    const customerCodeIndex = order.indexOf("customer_code");
    const customerNameIndex = order.indexOf("customer_name");

    if (
      customerCodeIndex !== -1 &&
      customerNameIndex !== -1 &&
      customerCodeIndex > customerNameIndex
    ) {
      // Swap them so customer_code comes first
      [order[customerCodeIndex], order[customerNameIndex]] = [
        order[customerNameIndex],
        order[customerCodeIndex],
      ];
    }

    // Position send_email column next to S.No column
    const sendEmailIndex = order.indexOf("send_email");
    if (sendEmailIndex !== -1) {
      // Remove send_email from its current position
      order.splice(sendEmailIndex, 1);

      // Place it right after sno (S.No)
      const snoIdx = order.indexOf("sno");
      if (snoIdx !== -1) {
        order.splice(snoIdx + 1, 0, "send_email");
      } else {
        // Fallback: place at the beginning
        order.unshift("send_email");
      }
    }

    // Pipeline report quotation drill: place reject_remark immediately after quotation_id
    const rejectIdx = order.indexOf("reject_remark");
    const quoteIdIdx = order.indexOf("quotation_id");
    if (rejectIdx !== -1 && quoteIdIdx !== -1) {
      order.splice(rejectIdx, 1);
      const qAfter = order.indexOf("quotation_id");
      order.splice(qAfter + 1, 0, "reject_remark");
    }

    return order;
  }, [columns]);

  const table = useMantineReactTable({
    columns,
    data: data || [],
    enableColumnFilters: false,
    enablePagination: false, // Disable built-in pagination for all modules
    enableTopToolbar: false,
    enableColumnActions: false,
    enableSorting: false, // Match CallEntryMaster - no sorting
    enableBottomToolbar: false, // Disable built-in bottom toolbar
    enableColumnPinning: true, // Match CallEntryMaster
    enableStickyHeader: true,
    // Disable user-driven re-ordering to avoid surprises (optional but safe)
    enableColumnOrdering: false,
    layoutMode: "grid",
    mantineTableProps: {
      striped: false,
      highlightOnHover: true,
      withTableBorder: true,
      withColumnBorders: false,
      style: { width: "100%", border: "1px solid #dee2e6" },
    },
    mantinePaperProps: {
      shadow: "none",
      p: 0,
      radius: 0,
      style: { border: "none", boxShadow: "none" },
    },
    mantineTableBodyCellProps: {
      style: {
        padding: pipelineReportDrill2 ? "6px 10px" : "12px 16px",
        fontSize: pipelineReportDrill2 ? "13px" : "14px",
        backgroundColor: "#ffffff",
        borderBottom: "1px solid #dee2e6",
      },
    },
    mantineTableHeadCellProps: {
      style: {
        padding: pipelineReportDrill2 ? "4px 8px" : "12px 16px",
        fontSize: pipelineReportDrill2 ? "12px" : "13px",
        fontWeight: 400,
        backgroundColor: "#E2E8F0",
        color: "#000000",
        top: 0,
        zIndex: 3,
        borderBottom: "1px solid #dee2e6",
        ...(pipelineReportDrill2
          ? { minHeight: 30, lineHeight: 1.25 }
          : {}),
      },
    },
    mantineTableContainerProps: {
      style: {
        fontSize: "13px",
        width: "100%",
        minHeight:
          moduleType === "pipelineReport" && drillLevel === 2
            ? "500px"
            : "400px",
        maxHeight:
          moduleType === "pipelineReport" && drillLevel === 2
            ? "calc(70vh - 60px)"
            : moduleType === "pipelineReport"
              ? "calc(70vh - 120px)"
              : "70vh",
        overflowY:
          moduleType === "pipelineReport" ? ("scroll" as const) : "auto",
        overflowX: "auto",
        position: "relative",
        scrollbarGutter: moduleType === "pipelineReport" ? "stable" : undefined,
      },
    },
  });

  useMemo(() => {
    let desiredOrder = columns.map((c) => c.accessorKey || c.id || "");

    // Ensure customer_code comes before customer_name
    const customerCodeIndex = desiredOrder.indexOf("customer_code");
    const customerNameIndex = desiredOrder.indexOf("customer_name");

    if (
      customerCodeIndex !== -1 &&
      customerNameIndex !== -1 &&
      customerCodeIndex > customerNameIndex
    ) {
      // Move customer_code to before customer_name
      const customerCode = desiredOrder.splice(customerCodeIndex, 1)[0];
      desiredOrder.splice(customerNameIndex, 0, customerCode);
    }

    // Position send_email column next to S.No column
    const sendEmailIndex = desiredOrder.indexOf("send_email");
    if (sendEmailIndex !== -1) {
      // Remove send_email from its current position
      desiredOrder.splice(sendEmailIndex, 1);

      // Place it right after sno (S.No)
      const snoIdx = desiredOrder.indexOf("sno");
      if (snoIdx !== -1) {
        desiredOrder.splice(snoIdx + 1, 0, "send_email");
      } else {
        // Fallback: place at the beginning
        desiredOrder.unshift("send_email");
      }
    }

    const rejIdx = desiredOrder.indexOf("reject_remark");
    const qIdIdx = desiredOrder.indexOf("quotation_id");
    if (rejIdx !== -1 && qIdIdx !== -1) {
      desiredOrder.splice(rejIdx, 1);
      const qAfter = desiredOrder.indexOf("quotation_id");
      desiredOrder.splice(qAfter + 1, 0, "reject_remark");
    }

    table.setColumnOrder(desiredOrder);
  }, [columns, table]);

  if (loading) {
    return (
      <Box>
        <Group justify="space-between" align="center" mb="md" wrap="nowrap">
          <Text
            size="md"
            fw={500}
            c="#424242"
            style={{ fontFamily: "Geist, sans-serif" }}
          >
            {title}
          </Text>
          <Group gap="xs">
            {headerActions}
            {showBackButton && onBack && (
              <Button
                leftSection={<IconArrowLeft size={16} />}
                onClick={onBack}
                variant="outline"
                size="xs"
                color="#105476"
              >
                Back
              </Button>
            )}
            {showCloseButton && (
              <Button
                leftSection={<IconArrowLeft size={16} />}
                onClick={onClose}
                variant="outline"
                size="xs"
                color="#105476"
              >
                Back to Dashboard
              </Button>
            )}
          </Group>
        </Group>
        <Center py="xl">
          <Loader size="lg" color="#105476" />
        </Center>
      </Box>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Box>
        <Group justify="space-between" align="center" mb="md" wrap="nowrap">
          <Text
            size="md"
            fw={500}
            c="#424242"
            style={{ fontFamily: "Geist, sans-serif" }}
          >
            {title}
          </Text>
          <Group gap="xs">
            {headerActions}
            {showBackButton && onBack && (
              <Button
                leftSection={<IconArrowLeft size={16} />}
                onClick={onBack}
                variant="outline"
                size="xs"
                color="#105476"
              >
                Back
              </Button>
            )}
            {showCloseButton && (
              <Button
                leftSection={<IconArrowLeft size={16} />}
                onClick={onClose}
                variant="outline"
                size="xs"
                color="#105476"
              >
                Back to Dashboard
              </Button>
            )}
          </Group>
        </Group>
        <Center py="xl">
          <Text size="md" c="dimmed">
            No data available
          </Text>
        </Center>
      </Box>
    );
  }

  return (
    // <Card shadow="sm" padding="lg" radius="md" withBorder>
    <>
      <Group justify="space-between" align="center" mb="md" wrap="nowrap">
        <Text
          size="md"
          fw={500}
          c="#424242"
          style={{ fontFamily: "Geist, sans-serif" }}
        >
          {title}
        </Text>
        <Group gap="xs">
          {headerActions}
          {showBackButton && onBack && (
            <Button
              leftSection={<IconArrowLeft size={16} />}
              onClick={onBack}
              variant="outline"
              size="xs"
              color="#105476"
            >
              Back
            </Button>
          )}
          {showCloseButton && (
            <Button
              leftSection={<IconArrowLeft size={16} />}
              onClick={onClose}
              variant="outline"
              size="xs"
              color="#105476"
            >
              Back to Dashboard
            </Button>
          )}
        </Group>
      </Group>

      <Box
        style={{
          borderTopLeftRadius: "8px",
          borderTopRightRadius: "8px",
          overflow: "hidden",
        }}
      >
        <MantineReactTable key={columnOrder.join(",")} table={table} />
      </Box>

      {/* </Card> */}
    </>
  );
};

export default DetailedViewTable;
