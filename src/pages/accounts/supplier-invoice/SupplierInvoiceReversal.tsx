import SupplierInvoiceCreate from "./SupplierInvoiceCreate";

/**
 * Supplier Invoice Reverse page: same form as Supplier Invoice Create.
 * Header Dr_Cr = "Cr", charges section Dr_Cr = "Dr".
 * Used when creating a reverse from a POSTED supplier invoice (from list action).
 * Back navigates to Supplier Invoice list.
 */
export default function SupplierInvoiceReversal() {
  return (
    <SupplierInvoiceCreate
      titleOverride="Supplier Invoice Reverse"
      backPath="/supplier-invoice"
      isReversal
    />
  );
}
