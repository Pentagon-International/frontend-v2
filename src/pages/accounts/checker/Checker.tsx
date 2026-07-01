import { Navigate } from "react-router-dom";
import { useCanAccessCheckerPage } from "../../../hooks/useCanPostDocuments";
import UnpostedDocumentsList from "../invoices/UnpostedDocumentsList";

export default function Checker() {
  const canAccessCheckerPage = useCanAccessCheckerPage();

  if (!canAccessCheckerPage) {
    return <Navigate to="/" replace />;
  }

  return <UnpostedDocumentsList variant="checker" />;
}
