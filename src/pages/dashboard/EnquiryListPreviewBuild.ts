export type PreviewColKind =
  | "sno"
  | "service"
  | "enquiryDate"
  | "status"
  | "route"
  | "text";

export type PreviewColDef = {
  id: string;
  header: string;
  key: string;
  kind: PreviewColKind;
  /** When `kind === "route"`, key for the destination value (e.g. `"destination"`). */
  routeDestKey?: string;
};

/** Detailed list column order (S.No is always first via `columns` init). Route = Origin + Destination immediately after Status. */
const desiredOrder = [
  "Customer Name",
  "Enquiry ID",
  "Sales Person",
  "Enquiry Date",
  "Service",
  "Status",
  "Origin",
  "Destination",
  "Shipment",
  "Location",
  "Cargo Details",
  "Reference No",
  "Total Cost",
  "Total Sell",
  "Profit",
  "Remark",
];

const PREVIEW_KEY_MAP: Record<string, string> = {
  "Enquiry ID": "enquiry_id",
  "Sales Person": "sales_person",
  "Enquiry Date": "enquiry_date",
  Trade: "trade",
  Shipment: "shipment",
  "Customer Name": "customer_name",
  Location: "location",
  Service: "service",
  Origin: "origin",
  Destination: "destination",
  "Cargo Details": "cargo_details",
  "Total Cost": "total_cost",
  "Total Sell": "total_sell",
  Profit: "profit",
  Status: "status",
  Remark: "service_remark",
  "Reference No": "reference_no",
};

/**
 * Replicates the column ordering used by the old Mantine preview table
 * (`tablePreviewData.columns` from API + desiredOrder).
 */
export function buildPreviewColumnDescriptors(
  tablePreviewData: { columns?: string[]; data?: unknown[]; total?: number } | null | undefined,
  previewColumnToKeyMap: Record<string, string>,
): { columns: PreviewColDef[]; rowCount: number } {
  if (!tablePreviewData) {
    return { columns: [], rowCount: 0 };
  }

  const availableColumns = (tablePreviewData.columns || []).filter(
    (col: string) => !["No of Containers", "sno", "S.No", "SNO", "S No"].includes(col),
  );
  if (!availableColumns.includes("Reference No")) {
    availableColumns.push("Reference No");
  }
  const orderedColumns: string[] = [
    ...desiredOrder.filter((col: string) => availableColumns.includes(col)),
    ...availableColumns.filter((col: string) => !desiredOrder.includes(col)),
  ];

  const columns: PreviewColDef[] = [
    { id: "sno", header: "S.No", key: "sno", kind: "sno" },
  ];

  for (let i = 0; i < orderedColumns.length; i++) {
    const col = orderedColumns[i];
    if (col === "Service") {
      columns.push({ id: "service_trade", header: "Service", key: "service", kind: "service" });
      continue;
    }
    if (col === "Enquiry Date") {
      columns.push({
        id: "enquiry_date",
        header: col,
        key: "enquiry_date",
        kind: "enquiryDate",
      });
      continue;
    }
    if (col === "Trade") {
      continue;
    }
    if (col === "Origin" && orderedColumns[i + 1] === "Destination") {
      const ok = previewColumnToKeyMap["Origin"] || PREVIEW_KEY_MAP["Origin"] || "origin";
      const dk = previewColumnToKeyMap["Destination"] || PREVIEW_KEY_MAP["Destination"] || "destination";
      columns.push({
        id: "route",
        header: "Route",
        key: ok,
        kind: "route",
        routeDestKey: dk,
      });
      i += 1;
      continue;
    }
    const key = previewColumnToKeyMap[col] || PREVIEW_KEY_MAP[col] || col;
    const kind: PreviewColKind =
      col === "Status" || key === "status" || key === "Status" ? "status" : "text";
    columns.push({ id: key, header: col, key, kind });
  }

  return { columns, rowCount: tablePreviewData.data?.length ?? 0 };
}
