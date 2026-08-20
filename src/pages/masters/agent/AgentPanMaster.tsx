import { Navigate } from "react-router-dom";

/**
 * Agent create is approval-flow for all regions (India + overseas).
 * Keep this route as a redirect for old bookmarks / deep links.
 */
export default function AgentPanMaster() {
  return <Navigate to="/master/create-agent" replace />;
}
