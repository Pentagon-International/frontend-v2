export type OdexJobStatus =
  | "queued"
  | "running"
  | "waiting_captcha"
  | "completed"
  | "failed"
  | "cancelled"
  | "pending";

export type OdexJobListItem = {
  id: string | number;
  job_ref: string;
  consol_job_id?: number | null;
  odex_type: string;
  status: OdexJobStatus;
  progress_percentage?: number | null;
  filled_fields_count?: number;
  screenshot_count?: number;
  thumbnail_url?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
  last_log?: string | null;
};

export type OdexJobDetail = OdexJobListItem & {
  error_message?: string | null;
  extracted_payload?: Record<string, unknown> | null;
  frontend_overrides?: Record<string, unknown> | null;
  final_result?: Record<string, unknown> | null;
  reference_number?: string | null;
  duration_seconds?: number | null;
};

export type OdexFieldMapping = {
  id?: number;
  payload_field: string;
  payload_value: unknown;
  portal_field?: string | null;
  selector?: string | null;
  confidence?: number | null;
};

export type OdexScreenshot = {
  id: number;
  /** API field from screenshots endpoint */
  image_url?: string | null;
  url?: string;
  thumbnail_url?: string | null;
  screenshot_type?: string | null;
  step_name?: string | null;
  step_id?: number | null;
  created_at?: string | null;
};

export type OdexStep = {
  id?: number;
  step_name: string;
  status: string;
  started_at?: string | null;
  completed_at?: string | null;
  error_message?: string | null;
};

export type OdexTimelineEvent = {
  id?: number;
  type: string;
  event_type?: string;
  step_name?: string | null;
  step_order?: number | null;
  status?: string | null;
  log_level?: string | null;
  message?: string | null;
  created_at: string;
};

export type OdexLogLine = {
  id?: number;
  level?: string | null;
  message: string;
  /** API fields from logs endpoint */
  log_level?: string | null;
  log_message?: string | null;
  step_id?: number | null;
  created_at?: string | null;
};

export type OdexJobListFilters = {
  index: number;
  limit: number;
  status?: string;
  odex_type?: string;
  job_ref?: string;
  consol_job_id?: string | number;
  date_from?: string;
  date_to?: string;
  search?: string;
};

export type CreateOdexJobPayload = {
  job_id: number;
  odex_type: string;
  invoicing_consignee?: string;
  overrides?: Record<string, unknown>;
};

export type OdexJobListResponse = {
  results: OdexJobListItem[];
  total: number;
};

export type OdexWsMessage = {
  status?: OdexJobStatus;
  progress_percentage?: number | null;
  last_log?: string | null;
  type?: string;
  step_name?: string | null;
  message?: string | null;
  created_at?: string;
  log?: OdexLogLine;
  timeline_event?: OdexTimelineEvent;
};
