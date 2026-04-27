// src/hooks/useAgentStatus.ts
import { useState, useEffect, useCallback } from "react";
import { apiCallProtected } from "../api/axios";

interface UseAgentStatusOptions {
  autoCheck?: boolean;
}

export function useAgentStatus(options: UseAgentStatusOptions = {}) {
  const { autoCheck = true } = options;
  const [status, setStatus] = useState<string | null>(null);

  // recheck MUST return the status string
  const recheck = useCallback(async (): Promise<string> => {
    try {
      const res = await apiCallProtected.get(
        "/job-create/odex/agent/status/"
      );
      const s = String(
        (res as any)?.data?.status ?? (res as any)?.status ?? "not_installed"
      ).trim().toLowerCase();
      setStatus(s);
      return s;                    // ← return it
    } catch {
      setStatus("not_installed");
      return "not_installed";      // ← return on error too
    }
  }, []);

  useEffect(() => {
    if (autoCheck) {
      recheck();
    }
  }, [autoCheck, recheck]);

  return { status, recheck };
}