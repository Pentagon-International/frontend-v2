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
  const { isUnposted, isPosted } = parseInvoiceStatus(status);
  if (isUnposted) return "yellow";
  if (isPosted) return "green";
  return "#105476";
}
