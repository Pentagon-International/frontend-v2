import { useEffect, useMemo, useRef } from "react";
import { URL } from "../api/serverUrls";
import type { JobDocumentsNavigationState } from "../utils/jobDocuments";
import { useJobDocuments } from "./useJobDocuments";

function houseDocumentSourceKey(
  source: Record<string, unknown> | null | undefined,
): string {
  if (!source) return "new";
  const id = source.id ?? source.shipment_id ?? "";
  const ids = Array.isArray(source.document_ids)
    ? source.document_ids.join(",")
    : "";
  const displayLen = Array.isArray(source.document_display_list)
    ? source.document_display_list.length
    : 0;
  return `${String(id)}|${ids}|${displayLen}`;
}

/** House-level documents only (never job master documents). */
export function useHousePageDocuments(
  source: Record<string, unknown> | null | undefined,
) {
  const houseDocuments = useJobDocuments({
    uploadEndpoint: URL.jobCreateUploadDocument,
  });
  const lastKeyRef = useRef<string | null>(null);
  const sourceKey = useMemo(
    () => houseDocumentSourceKey(source),
    [source],
  );

  useEffect(() => {
    if (lastKeyRef.current === sourceKey) return;
    lastKeyRef.current = sourceKey;

    houseDocuments.initFromJobData(source ?? {});
    houseDocuments.restoreFromNavigationState(
      source as Partial<JobDocumentsNavigationState> | null | undefined,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-init only when source identity changes
  }, [sourceKey]);

  return houseDocuments;
}
