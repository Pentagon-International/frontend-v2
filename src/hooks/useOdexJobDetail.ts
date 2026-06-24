import { useCallback, useEffect, useRef, useState } from "react";
import { odexApi } from "../services/odexApi";
import type {
  OdexFieldMapping,
  OdexJobDetail,
  OdexLogLine,
  OdexScreenshot,
  OdexStep,
  OdexTimelineEvent,
  OdexWsMessage,
} from "../types/odex";
import { normalizeOdexStatus } from "../utils/odexApiParse";
import { mapOdexLogLine } from "../utils/odexLog";
import {
  dedupeOdexTimelineEvents,
  extractOdexWsTimelinePayload,
  isDuplicateOdexTimelineEvent,
  mapOdexTimelineEvent,
} from "../utils/odexTimeline";
import {
  buildOdexJobWebSocketUrl,
  isOdexActiveStatus,
  isOdexTerminalStatus,
} from "../utils/odexWebSocket";

type OdexJobDetailState = {
  job: OdexJobDetail | null;
  fieldMappings: OdexFieldMapping[];
  screenshots: OdexScreenshot[];
  steps: OdexStep[];
  logs: OdexLogLine[];
  timeline: OdexTimelineEvent[];
  result: Record<string, unknown> | null;
  loading: boolean;
  error: string | null;
};

const initialState: OdexJobDetailState = {
  job: null,
  fieldMappings: [],
  screenshots: [],
  steps: [],
  logs: [],
  timeline: [],
  result: null,
  loading: true,
  error: null,
};

export function useOdexJobDetail(jobId: string | undefined) {
  const [state, setState] = useState<OdexJobDetailState>(initialState);
  const wsRef = useRef<WebSocket | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const applyJobPatch = useCallback((patch: Partial<OdexJobDetail>) => {
    setState((prev) => ({
      ...prev,
      job: prev.job ? { ...prev.job, ...patch } : (patch as OdexJobDetail),
    }));
  }, []);

  const loadAll = useCallback(async () => {
    if (!jobId) return;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const [job, fieldMappings, screenshots, steps, logs, timeline, result] =
        await Promise.all([
          odexApi.getJob(jobId),
          odexApi.getFieldMappings(jobId),
          odexApi.getScreenshots(jobId),
          odexApi.getSteps(jobId),
          odexApi.getLogs(jobId),
          odexApi.getTimeline(jobId),
          odexApi.getResult(jobId),
        ]);

      const normalizedJob: OdexJobDetail = {
        ...job,
        status: normalizeOdexStatus(job.status) as OdexJobDetail["status"],
        final_result:
          job.final_result ??
          (result && Object.keys(result).length > 0 ? result : null),
      };

      setState({
        job: normalizedJob,
        fieldMappings,
        screenshots,
        steps,
        logs,
        timeline: dedupeOdexTimelineEvents(timeline),
        result: result && Object.keys(result).length > 0 ? result : null,
        loading: false,
        error: null,
      });
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string; detail?: string } } })
          ?.response?.data?.message ??
        (err as { response?: { data?: { message?: string; detail?: string } } })
          ?.response?.data?.detail ??
        "Failed to load ODEX job";
      setState((prev) => ({ ...prev, loading: false, error: message }));
    }
  }, [jobId]);

  const handleWsMessage = useCallback(
    (raw: string) => {
      try {
        const data = JSON.parse(raw) as OdexWsMessage;
        if (data.status) {
          applyJobPatch({
            status: normalizeOdexStatus(data.status) as OdexJobDetail["status"],
          });
        }
        if (data.progress_percentage != null) {
          applyJobPatch({ progress_percentage: data.progress_percentage });
        }
        if (data.last_log) {
          applyJobPatch({ last_log: data.last_log });
        }
        if (data.log) {
          const mapped = mapOdexLogLine(
            data.log as Record<string, unknown>,
          );
          if (mapped.message) {
            setState((prev) => ({
              ...prev,
              logs: [...prev.logs, mapped],
            }));
          }
        } else if (
          (data as Record<string, unknown>).log_message != null ||
          (data as Record<string, unknown>).message != null
        ) {
          const mapped = mapOdexLogLine(data as Record<string, unknown>);
          if (mapped.message) {
            setState((prev) => ({
              ...prev,
              logs: [...prev.logs, mapped],
            }));
          }
        }
        const timelinePayload = extractOdexWsTimelinePayload(
          data as Record<string, unknown>,
        );
        if (timelinePayload) {
          const mapped = mapOdexTimelineEvent(timelinePayload);
          if (mapped.type.toLowerCase() !== "log") {
            setState((prev) => {
              if (isDuplicateOdexTimelineEvent(prev.timeline, mapped)) {
                return prev;
              }
              return {
                ...prev,
                timeline: [...prev.timeline, mapped],
              };
            });
          }
        }
      } catch {
        // ignore malformed WS payloads
      }
    },
    [applyJobPatch],
  );

  const connectWebSocket = useCallback(() => {
    if (!jobId) return;
    wsRef.current?.close();
    const ws = new WebSocket(buildOdexJobWebSocketUrl(jobId));
    wsRef.current = ws;
    ws.onmessage = (e) => handleWsMessage(e.data);
    ws.onerror = () => {
      ws.close();
    };
  }, [jobId, handleWsMessage]);

  const refreshJob = useCallback(async () => {
    if (!jobId) return;
    try {
      const job = await odexApi.getJob(jobId);
      setState((prev) => ({
        ...prev,
        job: {
          ...job,
          status: normalizeOdexStatus(job.status) as OdexJobDetail["status"],
        },
      }));
    } catch {
      // polling errors are non-fatal
    }
  }, [jobId]);

  useEffect(() => {
    if (!jobId) return;
    loadAll();
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [jobId, loadAll]);

  useEffect(() => {
    if (!jobId || !state.job) return;
    const status = state.job.status;
    if (!isOdexActiveStatus(status)) {
      wsRef.current?.close();
      wsRef.current = null;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    connectWebSocket();

    if (!pollRef.current) {
      pollRef.current = setInterval(() => {
        refreshJob();
      }, 5000);
    }

    return () => {
      wsRef.current?.close();
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [jobId, state.job?.status, connectWebSocket, refreshJob]);

  useEffect(() => {
    if (state.job && isOdexTerminalStatus(state.job.status)) {
      wsRef.current?.close();
      wsRef.current = null;
    }
  }, [state.job?.status]);

  const terminalReloadedRef = useRef(false);

  useEffect(() => {
    terminalReloadedRef.current = false;
  }, [jobId]);

  useEffect(() => {
    const status = state.job?.status;
    if (!status || !isOdexTerminalStatus(status) || terminalReloadedRef.current) {
      return;
    }
    terminalReloadedRef.current = true;
    loadAll();
  }, [state.job?.status, loadAll]);

  return {
    ...state,
    reload: loadAll,
    refreshJob,
  };
}
