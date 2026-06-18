/** Automation app navigation routes (base + /automation + segment). API URLs stay in each page. */

export const AUTOMATION_ROUTE_PREFIX = "/automation";
export const IMPORT_JOB_SEGMENT = "import-job";
export const VENDOR_INVOICE_SEGMENT = "vendor-invoice";

export const IMPORT_JOB_PATH = `${AUTOMATION_ROUTE_PREFIX}/${IMPORT_JOB_SEGMENT}`;
export const VENDOR_INVOICE_PATH = `${AUTOMATION_ROUTE_PREFIX}/${VENDOR_INVOICE_SEGMENT}`;

export const ODEX_JOBS_SEGMENT = "odex-jobs";
export const ODEX_JOBS_PATH = `${AUTOMATION_ROUTE_PREFIX}/${ODEX_JOBS_SEGMENT}`;

export const odexJobDetailPath = (jobId: string | number) =>
  `${ODEX_JOBS_PATH}/${jobId}`;

/** @deprecated Use IMPORT_JOB_PATH */
export const JOB_CREATION_SEGMENT = IMPORT_JOB_SEGMENT;
export const JOB_CREATION_PATH = IMPORT_JOB_PATH;
/** @deprecated Use VENDOR_INVOICE_PATH */
export const INVOICE_MANAGER_SEGMENT = VENDOR_INVOICE_SEGMENT;
export const INVOICE_MANAGER_PATH = VENDOR_INVOICE_PATH;
/** @deprecated Use IMPORT_JOB_PATH */
export const HBL_DOCUMENT_MANAGER_SEGMENT = IMPORT_JOB_SEGMENT;
export const HBL_DOCUMENT_MANAGER_PATH = IMPORT_JOB_PATH;

export const WORKFLOW_ROUTE_PREFIX = "/workflow";

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

export const isAutomationPath = (pathname: string): boolean =>
  pathname.startsWith(IMPORT_JOB_PATH) ||
  pathname.startsWith(VENDOR_INVOICE_PATH) ||
  pathname.startsWith(ODEX_JOBS_PATH);
