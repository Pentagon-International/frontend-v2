import { useLocation } from "react-router-dom";
import SupplierInvoiceRCMCreate from "./SupplierInvoiceRCMCreate";

/**
 * Supplier Invoice RCM Reverse page: same form as Supplier Invoice RCM Create.
 * Used when creating a reverse from a POSTED RCM invoice (from RCM list),
 * or for view/edit from Supplier Invoice RCM Reversal list.
 * Back: from reversal/create → RCM list;
 *       from reversal/view or reversal/edit → RCM reversal list.
 */
export default function SupplierInvoiceRCMReversal() {
  const location = useLocation();
  const pathname = location.pathname;
  const isReversalCreate = pathname.includes("/reversal/create");
  const effectiveBackPath = isReversalCreate
    ? "/supplier-invoice-rcm"
    : "/supplier-invoice-rcm/reversal";

  return (
    <SupplierInvoiceRCMCreate
      titleOverride="Supplier Invoice RCM Reverse"
      backPath={effectiveBackPath}
      isReversal
    />
  );
}
