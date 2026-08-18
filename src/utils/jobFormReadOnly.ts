import "./jobFormReadOnly.css";

export const JOB_ACCOUNTS_TAB_PANEL_CLASS = "job-accounts-tab-panel";

/** Tabs props that lock form panels, keep field colors, and show a not-allowed cursor. */
export function getJobFormReadOnlyTabProps(isReadOnly: boolean): {
  classNames?: { panel: string };
} {
  if (!isReadOnly) return {};
  return {
    classNames: { panel: "job-form-readonly-panel" },
  };
}
