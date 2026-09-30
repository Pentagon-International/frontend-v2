import { Navigate } from "react-router-dom";
import useAuthStore from "../../../store/authStore";
import PaymentRequestApproval from "./PaymentRequestApproval";

function PaymentRequestOverrideApproval() {
  const user = useAuthStore((s) => s.user);
  const canAccess =
    Boolean(user?.is_staff) ||
    Boolean(user?.screen_permissions?.credit_override_approval);

  if (!canAccess) {
    return <Navigate to="/" replace />;
  }

  return <PaymentRequestApproval mode="override" />;
}

export default PaymentRequestOverrideApproval;
