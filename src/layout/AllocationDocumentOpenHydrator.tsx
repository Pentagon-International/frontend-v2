import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ALLOC_DOC_OPEN_QUERY,
  takeOpenedDocumentState,
} from "../utils/openAllocationDocumentTab";

/** Restores document state when a Get-result document is opened in a new tab. */
export default function AllocationDocumentOpenHydrator() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const key = params.get(ALLOC_DOC_OPEN_QUERY);
    if (!key) return;

    const state = takeOpenedDocumentState(key);
    params.delete(ALLOC_DOC_OPEN_QUERY);
    const search = params.toString();
    if (state == null) return;

    navigate(
      {
        pathname: location.pathname,
        search: search ? `?${search}` : "",
      },
      { replace: true, state },
    );
  }, [location.pathname, location.search, navigate]);

  return null;
}
