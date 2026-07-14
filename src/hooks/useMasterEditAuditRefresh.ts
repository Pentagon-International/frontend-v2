import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  appendEditPageAuditPatch,
  fetchMasterRecordById,
  mergeEditPageAuditSources,
  unwrapApiRecord,
} from "../utils/editPageAuditInfo";

export type MasterEditAuditRefreshOptions = {
  detailBaseUrl?: string;
  recordId?: number | string | null;
  enabled?: boolean;
};

export function useMasterEditAuditRefresh(
  listRecord: Record<string, unknown> | null | undefined,
  options?: MasterEditAuditRefreshOptions,
) {
  const location = useLocation();
  const [auditPatch, setAuditPatch] = useState<Record<string, unknown> | null>(
    null,
  );
  const [detailRecord, setDetailRecord] = useState<Record<string, unknown> | null>(
    null,
  );

  const enabled = options?.enabled ?? true;
  const detailBaseUrl = options?.detailBaseUrl;
  const recordId =
    options?.recordId ??
    (listRecord?.id != null ? Number(listRecord.id) : null);
  const hasRecordId =
    recordId != null && recordId !== "" && !Number.isNaN(Number(recordId));

  useEffect(() => {
    setAuditPatch(null);
  }, [location.key]);

  useEffect(() => {
    setDetailRecord(null);
    if (!enabled || !detailBaseUrl || !hasRecordId) return;

    let cancelled = false;
    void fetchMasterRecordById(detailBaseUrl, Number(recordId))
      .then((record) => {
        if (!cancelled && record) {
          setDetailRecord(record);
        }
      })
      .catch(() => {
        // Audit-only fetch; page still uses list navigation state.
      });

    return () => {
      cancelled = true;
    };
  }, [location.key, detailBaseUrl, recordId, hasRecordId, enabled]);

  const auditSource = useMemo(
    () => mergeEditPageAuditSources(listRecord, detailRecord, auditPatch),
    [listRecord, detailRecord, auditPatch],
  );

  const applyAuditFromResponse = useCallback((response: unknown) => {
    const record = unwrapApiRecord(response);
    if (!record) return;
    setAuditPatch((prev) => appendEditPageAuditPatch(prev, record));
  }, []);

  const refreshAuditFromDetail = useCallback(
    async (saveRecordId?: number | string | null) => {
      const targetId = saveRecordId ?? recordId;
      if (!detailBaseUrl || targetId == null || Number.isNaN(Number(targetId))) {
        return;
      }
      try {
        const refreshed = await fetchMasterRecordById(
          detailBaseUrl,
          Number(targetId),
        );
        if (refreshed) {
          applyAuditFromResponse(refreshed);
        }
      } catch {
        // PUT response or detail fetch may omit audit fields.
      }
    },
    [detailBaseUrl, recordId, applyAuditFromResponse],
  );

  return { auditSource, applyAuditFromResponse, refreshAuditFromDetail };
}
