import { useMemo } from "react";
import {
  documentMatchesModalSearch,
  type SelectableModalDocument,
} from "../utils/selectDocumentModalSearch";

/**
 * Pre-filter visible Select Document modal rows (avoids per-render match work).
 */
export function useSelectDocumentModalList<T extends SelectableModalDocument>(
  invoiceList: T[],
  search: string,
  includeInvCrn: boolean,
) {
  const searchOpts = useMemo(() => ({ includeInvCrn }), [includeInvCrn]);

  const visibleRows = useMemo(() => {
    const rows: { inv: T; idx: number }[] = [];
    for (let idx = 0; idx < invoiceList.length; idx += 1) {
      const inv = invoiceList[idx];
      if (documentMatchesModalSearch(inv, search, searchOpts)) {
        rows.push({ inv, idx });
      }
    }
    return rows;
  }, [invoiceList, search, searchOpts]);

  const noSearchMatches =
    invoiceList.length > 0 && Boolean(search.trim()) && visibleRows.length === 0;

  return {
    visibleRows,
    noSearchMatches,
    searchOpts,
  };
}
