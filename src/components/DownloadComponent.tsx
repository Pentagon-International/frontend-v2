import { Button, Loader } from "@mantine/core";
import { IconFileSpreadsheet, IconDownload } from "@tabler/icons-react";
import { useState } from "react";
import dayjs from "dayjs";
import * as XLSX from "xlsx";
import ToastNotification from "./ToastNotification";

interface ColumnConfig {
  key: string;
  header: string;
  transform?: (value: any, item: any) => string;
}

interface DownloadComponentProps {
  data?: any[];
  columns: ColumnConfig[];
  fileName: string;
  fileExtension: "csv" | "xlsx";
  buttonText?: string;
  buttonProps?: any;
  onDownloadStart?: () => void;
  onDownloadComplete?: () => void;
  onDownloadError?: (error: any) => void;
  fetchData?: () => Promise<any[]>;
  expandQuotations?: boolean; // New prop to handle quotation expansion
}

export const DownloadComponent = ({
  data,
  columns,
  fileName,
  fileExtension,
  buttonText = "Download",
  buttonProps = {},
  onDownloadStart,
  onDownloadComplete,
  onDownloadError,
  fetchData,
  expandQuotations = false,
}: DownloadComponentProps) => {
  const [loading, setLoading] = useState(false);

  const processData = (dataToProcess: any[]) => {
    try {
      let expandedData: any[] = [];

      if (expandQuotations) {
        // Expand quotations - each quotation becomes a separate row
        dataToProcess.forEach((item: any) => {
          if (
            item.quotation &&
            Array.isArray(item.quotation) &&
            item.quotation.length > 0
          ) {
            // For each quotation, create a row with quotation details
            item.quotation.forEach((quotation: any) => {
              const expandedItem = {
                ...item,
                // Override with quotation-specific data

                sales_person: item.sales_person,
                service_type: quotation.service_type,
                carrier: quotation.carrier,
                icd: quotation.icd,
                remark: quotation.remark,
                profit: quotation.profit,
                valid_upto: quotation.valid_upto,
                quote_type: quotation.quote_type,
                quote_currency: quotation.quote_currency,
                // Calculate totals from charges
                total_cost:
                  quotation.charges?.reduce(
                    (sum: number, charge: any) =>
                      sum + (charge.total_cost || 0),
                    0
                  ) || 0,
                total_sell:
                  quotation.charges?.reduce(
                    (sum: number, charge: any) =>
                      sum + (charge.total_sell || 0),
                    0
                  ) || 0,
                // Container details based on service type
                container_detail:
                  quotation.service_type === "FCL" ? "20ft/40ft" : "W/m",
                no_of_containers:
                  quotation.service_type === "FCL"
                    ? quotation.charges?.length || 0
                    : quotation.charges?.reduce(
                        (sum: number, charge: any) =>
                          sum + (charge.no_of_units || 0),
                        0
                      ) || 0,
                // Origin and destination from lists
                origin_name:
                  item.origin_list && item.origin_list.length > 0
                    ? item.origin_list.join(", ")
                    : "N/A",
                destination_name:
                  item.destination_list && item.destination_list.length > 0
                    ? item.destination_list.join(", ")
                    : "N/A",
                // Enquiry received date (you may need to map this from your data)
                enquiry_received_date: item.enquiry_received_date || "N/A",
                // Terms of shipment (you may need to map this from your data)
                shipment_terms_code_read:
                  item.shipment_terms_code_read || "N/A",
              };
              expandedData.push(expandedItem);
            });
          } else {
            // If no quotations, create a single row with basic data
            const basicItem = {
              ...item,
              service_type: "N/A",
              carrier: "N/A",
              icd: "N/A",
              remark:
                item.remark_list && item.remark_list.length > 0
                  ? item.remark_list.join(", ")
                  : "N/A",
              profit: 0,
              valid_upto: "N/A",
              quote_type:
                item.quote_type_list && item.quote_type_list.length > 0
                  ? item.quote_type_list.join(", ")
                  : "N/A",
              quote_currency: "N/A",
              total_cost: 0,
              total_sell: 0,
              container_detail: "N/A",
              no_of_containers: 0,
              origin_name:
                item.origin_list && item.origin_list.length > 0
                  ? item.origin_list.join(", ")
                  : "N/A",
              destination_name:
                item.destination_list && item.destination_list.length > 0
                  ? item.destination_list.join(", ")
                  : "N/A",
              enquiry_received_date: item.enquiry_received_date || "N/A",
              shipment_terms_code_read: item.shipment_terms_code_read || "N/A",
            };
            expandedData.push(basicItem);
          }
        });
      } else {
        // Use data as-is without expansion
        expandedData = dataToProcess;
      }

      // Transform data based on column configurations
      const processedData = expandedData.map((item: any) => {
        const processedItem: any = {};

        columns.forEach((column) => {
          if (column.transform) {
            processedItem[column.header] = column.transform(
              getNestedValue(item, column.key),
              item
            );
          } else {
            processedItem[column.header] =
              getNestedValue(item, column.key) || "N/A";
          }
        });

        return processedItem;
      });

      return processedData;
    } catch (error) {
      console.error("Error processing data:", error);
      throw error;
    }
  };

  const getNestedValue = (obj: any, path: string) => {
    return path.split(".").reduce((current, key) => {
      if (current && typeof current === "object") {
        return current[key];
      }
      return undefined;
    }, obj);
  };

  const downloadCSV = (processedData: any[]) => {
    try {
      const headers = columns.map((col) => col.header);

      const csvContent = [
        headers.join(","),
        ...processedData.map((row: any) =>
          headers
            .map((header) => {
              const value = row[header];
              // Escape commas and quotes in CSV
              if (
                typeof value === "string" &&
                (value.includes(",") || value.includes('"'))
              ) {
                return `"${value.replace(/"/g, '""')}"`;
              }
              return value;
            })
            .join(",")
        ),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = window.URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `${fileName}_${dayjs().format("YYYY-MM-DD_HH-mm")}.csv`
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error creating CSV:", error);
      throw error;
    }
  };

  const downloadXLSX = async (processedData: any[]) => {
    try {
      // Create a new workbook
      const workbook = XLSX.utils.book_new();

      // Convert processed data to worksheet
      const worksheet = XLSX.utils.json_to_sheet(processedData);

      // Add the worksheet to the workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

      // Generate Excel file buffer
      const excelBuffer = XLSX.write(workbook, {
        bookType: "xlsx",
        type: "array",
      });

      // Create blob and download
      const blob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const link = document.createElement("a");
      const url = window.URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `${fileName}_${dayjs().format("YYYY-MM-DD_HH-mm")}.xlsx`
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error creating XLSX:", error);
      throw error;
    }
  };

  const handleDownload = async () => {
    setLoading(true);
    onDownloadStart?.();

    try {
      let downloadData = data;

      // If fetchData function is provided, use it to get data without filters
      if (fetchData) {
        downloadData = await fetchData();
      }

      if (!downloadData || downloadData.length === 0) {
        ToastNotification({
          type: "warning",
          message: "No data available to download",
        });
        return;
      }

      const processedData = processData(downloadData);

      if (fileExtension === "csv") {
        downloadCSV(processedData);
      } else if (fileExtension === "xlsx") {
        await downloadXLSX(processedData);
      }

      ToastNotification({
        type: "success",
        message: `${fileExtension.toUpperCase()} file downloaded successfully`,
      });

      onDownloadComplete?.();
    } catch (error) {
      console.error("Error downloading file:", error);
      ToastNotification({
        type: "error",
        message: `Error downloading ${fileExtension.toUpperCase()} file`,
      });
      onDownloadError?.(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      leftSection={
        loading ? (
          <Loader size={14} />
        ) : fileExtension === "xlsx" ? (
          <IconFileSpreadsheet size={16} />
        ) : (
          <IconDownload size={16} />
        )
      }
      size="xs"
      color="#105476"
      onClick={handleDownload}
      loading={loading}
      disabled={loading}
      {...buttonProps}
    >
      {buttonText}
    </Button>
  );
};

export default DownloadComponent;
