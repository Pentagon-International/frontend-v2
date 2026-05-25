/** Workflow app navigation routes only (base + /workflow + segment). API URLs stay in each page. */

export const HBL_DOCUMENT_MANAGER_SEGMENT = "hbl-document-manager";
export const INVOICE_MANAGER_SEGMENT = "invoice-manager";

export const WORKFLOW_ROUTE_PREFIX = "/workflow";
export const HBL_DOCUMENT_MANAGER_PATH = `${WORKFLOW_ROUTE_PREFIX}/${HBL_DOCUMENT_MANAGER_SEGMENT}`;
export const INVOICE_MANAGER_PATH = `${WORKFLOW_ROUTE_PREFIX}/${INVOICE_MANAGER_SEGMENT}`;

/** App routes only — chatbot API base URLs are unchanged */
export const CHATBOT_SEGMENT = "chatbot";
export const CHATBOT_GOOGLE_SEGMENT = "chatbot-google";
export const CHATBOT_BROWSER_SEGMENT = "chatbot-browser";

export const CHATBOT_PATH = `${WORKFLOW_ROUTE_PREFIX}/${CHATBOT_SEGMENT}`;
export const CHATBOT_GOOGLE_PATH = `${WORKFLOW_ROUTE_PREFIX}/${CHATBOT_GOOGLE_SEGMENT}`;
export const CHATBOT_BROWSER_PATH = `${WORKFLOW_ROUTE_PREFIX}/${CHATBOT_BROWSER_SEGMENT}`;

export const isWorkflowChatbotPath = (pathname: string): boolean =>
  pathname === CHATBOT_PATH ||
  pathname.startsWith(`${CHATBOT_PATH}/`) ||
  pathname.startsWith(`${WORKFLOW_ROUTE_PREFIX}/chatbot-`);
