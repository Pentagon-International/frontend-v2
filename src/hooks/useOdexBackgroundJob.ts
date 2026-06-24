import { useCallback, useEffect, useState } from "react";
import { odexApi } from "../services/odexApi";
import type { OdexJobListItem } from "../types/odex";
import { normalizeOdexStatus } from "../utils/odexApiParse";
import { isOdexActiveStatus } from "../utils/odexWebSocket";

function pickActiveOdexJob(results: unknown[]): OdexJobListItem | null {
  for (const item of results) {
    const job = item as OdexJobListItem;
    if (isOdexActiveStatus(normalizeOdexStatus(job.status))) {
      return job;
    }
  }
  return null;
}

export function useOdexConsolBackgroundJob(
  consolJobId: number | null | undefined,
) {
  const [odexJobId, setOdexJobId] = useState<number | string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const startBackgroundJob = useCallback((jobId: number | string) => {
    setOdexJobId(jobId);
    setStatus("queued");
  }, []);

  useEffect(() => {
    if (consolJobId == null) {
      setOdexJobId(null);
      setStatus(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const { results } = await odexApi.listJobs({
          index: 0,
          limit: 10,
          consol_job_id: consolJobId,
        });
        if (cancelled) return;
        const active = pickActiveOdexJob(results);
        if (active?.id != null) {
          setOdexJobId(active.id);
          setStatus(normalizeOdexStatus(active.status));
        }
      } catch {
        // non-fatal: background discovery only
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [consolJobId]);

  useEffect(() => {
    if (odexJobId == null) {
      setStatus(null);
      return;
    }

    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      try {
        const job = await odexApi.getJob(odexJobId);
        if (cancelled) return;
        const normalized = normalizeOdexStatus(job.status);
        setStatus(normalized);
        if (!isOdexActiveStatus(normalized)) {
          if (interval) clearInterval(interval);
          interval = null;
          setOdexJobId(null);
        }
      } catch {
        // polling errors are non-fatal
      }
    };

    poll();
    interval = setInterval(poll, 5000);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [odexJobId]);

  const isActive = odexJobId != null && isOdexActiveStatus(status);

  return {
    odexJobId: isActive ? odexJobId : null,
    status,
    isActive,
    startBackgroundJob,
  };
}
