import { useLocation } from "react-router-dom";
import SupplierInvoiceCreate from "./SupplierInvoiceCreate";

/**
 * Supplier Invoice Reverse page: same form as Supplier Invoice Create.
 * Header Dr_Cr = "Cr", charges section Dr_Cr = "Dr".
 * Used when creating a reverse from a POSTED supplier invoice (from supplier list),
 * or for view/edit from Supplier Invoice Reversal list.
 * Back: from reversal/create (navigated from supplier list) → supplier list;
 *       from reversal/view or reversal/edit (navigated from reversal list) → reversal list.
 */
export default function SupplierInvoiceReversal() {
  const location = useLocation();
  const pathname = location.pathname;
  const isReversalCreate = pathname.includes("/reversal/create");
  const isRcmReversalCreate = pathname.includes("/supplier-invoice-rcm/reversal/create");
  const effectiveBackPath = isReversalCreate
    ? isRcmReversalCreate
      ? "/supplier-invoice-rcm"
      : "/supplier-invoice"
    : "/supplier-invoice/reversal";

  return (
    <SupplierInvoiceCreate
      titleOverride="Supplier Invoice Reverse"
      backPath={effectiveBackPath}
      isReversal
    />
  );
}
