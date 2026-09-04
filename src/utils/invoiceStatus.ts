export type InvoiceStatusFlags = {
  statusUpper: string;
  isPosted: boolean;
  isUnposted: boolean;
};

export function parseInvoiceStatus(status?: string | null): InvoiceStatusFlags {
  const statusUpper = (status ?? "").toUpperCase();
  return {
    statusUpper,
    isPosted: statusUpper === "POSTED" || status === "posted",
    isUnposted: statusUpper === "UNPOSTED" || status === "unpost",
  };
}

/** Mantine Badge color for invoice / reverse-invoice status (shared across job accounts). */
export function getInvoiceStatusBadgeColor(status?: string | null): string {
  const { isUnposted, isPosted, statusUpper } = parseInvoiceStatus(status);
  if (isUnposted) return "yellow";
  if (isPosted) return "green";
  if (statusUpper.includes("REVERS")) return "orange";
  if (statusUpper === "ACTIVE") return "blue";
  if (statusUpper === "APPROVED") return "green";
  if (statusUpper === "REJECTED") return "red";
  return "#105476";
}
