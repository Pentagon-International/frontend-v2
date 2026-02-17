import PaymentCreate from "../payment/PaymentCreate";

import { useLocation } from "react-router-dom";

/**
 * Payment Reversal page: same form and fields as Payment Create.
 * Used for create (from Payment Master) or view/edit (from Payment Reversal list).
 * Back: from reversal/create (from payment list) → payment list; else → reversal list.
 */
export default function PaymentReversal() {
  const location = useLocation();
  const pathname = location.pathname;
  const isReversalCreate = pathname.includes("/reversal/create");
  const effectiveBackPath = isReversalCreate
    ? "/payment"
    : "/payment/reversal";

  return (
    <PaymentCreate
      titleOverride="Payment Reversal"
      backPath={effectiveBackPath}
      isReversal
    />
  );
}
