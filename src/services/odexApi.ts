import { apiCallProtected } from "../api/axios";
import type {
  CreateOdexJobPayload,
  OdexFieldMapping,
  OdexJobDetail,
  OdexJobListFilters,
  OdexLogLine,
  OdexScreenshot,
  OdexStep,
  OdexTimelineEvent,
} from "../types/odex";
import {
  parseOdexListResponse,
  unwrapOdexEventsArray,
  unwrapOdexResponse,
} from "../utils/odexApiParse";
import { mapOdexScreenshot } from "../utils/odexScreenshot";
import { mapOdexLogLine } from "../utils/odexLog";
import { mapOdexTimelineEvent } from "../utils/odexTimeline";

const BASE = "job-create/odex";

export const odexApi = {
  async listJobs(filters: OdexJobListFilters) {
    const params: Record<string, string | number> = {
      index: filters.index,
      limit: filters.limit,
    };
    if (filters.status) params.status = filters.status;
    if (filters.odex_type) params.odex_type = filters.odex_type;
    if (filters.job_ref) params.job_ref = filters.job_ref;
    if (filters.consol_job_id != null && filters.consol_job_id !== "") {
      params.consol_job_id = filters.consol_job_id;
    }
    if (filters.date_from) params.date_from = filters.date_from;
    if (filters.date_to) params.date_to = filters.date_to;
    if (filters.search) params.search = filters.search;

    const res = await apiCallProtected.get(`${BASE}/jobs/`, { params });
    return parseOdexListResponse(res);
  },

  async getJob(jobId: string | number): Promise<OdexJobDetail> {
    const res = await apiCallProtected.get(`${BASE}/jobs/${jobId}/`);
    return unwrapOdexResponse<OdexJobDetail>(res);
  },

  async getFieldMappings(jobId: string | number): Promise<OdexFieldMapping[]> {
    const res = await apiCallProtected.get(
      `${BASE}/jobs/${jobId}/field-mappings/`,
    );
    const data = unwrapOdexResponse<unknown>(res);
    return Array.isArray(data) ? (data as OdexFieldMapping[]) : [];
  },

  async getScreenshots(jobId: string | number): Promise<OdexScreenshot[]> {
    const res = await apiCallProtected.get(
      `${BASE}/jobs/${jobId}/screenshots/`,
    );
    const data = unwrapOdexResponse<unknown>(res);
    if (!Array.isArray(data)) return [];
    return data.map((item) =>
      mapOdexScreenshot(item as Record<string, unknown>),
    );
  },

  async getSteps(jobId: string | number): Promise<OdexStep[]> {
    const res = await apiCallProtected.get(`${BASE}/jobs/${jobId}/steps/`);
    const data = unwrapOdexResponse<unknown>(res);
    return Array.isArray(data) ? (data as OdexStep[]) : [];
  },

  async getLogs(jobId: string | number): Promise<OdexLogLine[]> {
    const res = await apiCallProtected.get(`${BASE}/jobs/${jobId}/logs/`);
    const data = unwrapOdexResponse<unknown>(res);
    if (!Array.isArray(data)) return [];
    return data.map((item) =>
      mapOdexLogLine(item as Record<string, unknown>),
    );
  },

  async getTimeline(jobId: string | number): Promise<OdexTimelineEvent[]> {
    const res = await apiCallProtected.get(`${BASE}/jobs/${jobId}/timeline/`);
    const items = unwrapOdexEventsArray(res);
    return items.map((item) =>
      mapOdexTimelineEvent(item as Record<string, unknown>),
    );
  },

  async getResult(jobId: string | number): Promise<Record<string, unknown>> {
    const res = await apiCallProtected.get(`${BASE}/jobs/${jobId}/result/`);
    return unwrapOdexResponse<Record<string, unknown>>(res);
  },

  async createJob(body: CreateOdexJobPayload) {
    const res = await apiCallProtected.post(`${BASE}/jobs/create/`, body);
    return unwrapOdexResponse<{
      job_id?: string | number;
      id?: string | number;
      status?: string;
    }>(res);
  },

  async cancelJob(jobId: string | number) {
    const res = await apiCallProtected.patch(`${BASE}/jobs/${jobId}/cancel/`);
    return unwrapOdexResponse<OdexJobDetail>(res);
  },

  async submitCaptcha(jobId: string | number, captcha: string) {
    const res = await apiCallProtected.post(`${BASE}/jobs/${jobId}/captcha/`, {
      captcha,
    });
    return unwrapOdexResponse<unknown>(res);
  },
};
