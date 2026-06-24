import { Navigate, useParams } from "react-router-dom";
import { odexJobDetailPath } from "../pages/Workflow/jobcreation/workflowUrls";

export default function OdexLegacyJobRedirect() {
  const { jobId } = useParams<{ jobId: string }>();
  if (!jobId) {
    return <Navigate to="/automation/odex-jobs" replace />;
  }
  return <Navigate to={odexJobDetailPath(jobId)} replace />;
}
