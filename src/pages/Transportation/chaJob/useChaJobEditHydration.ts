import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ToastNotification } from "../../../components";
import { useChaJobConfig } from "./chaJobContext";
import { fetchJobCreateById } from "./chaJobService";

/** Load full job detail on CHA edit/view (list rows are often summary-only). */
export function useChaJobEditHydration(
  mode: "create" | "edit" | "view",
  jobData: { id?: number } | null | undefined,
  jobModuleBasePath: string,
  setIsFetching?: (loading: boolean) => void,
) {
  const chaConfig = useChaJobConfig();
  const isChaMode = Boolean(chaConfig);
  const navigate = useNavigate();
  const location = useLocation();
  const hydratedIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isChaMode || (mode !== "edit" && mode !== "view")) return;
    if (location.state?.fromHouseCreate || location.state?.chaJobHydrated) return;

    const jobId = jobData?.id != null ? Number(jobData.id) : null;
    if (!jobId || Number.isNaN(jobId)) return;
    if (hydratedIdRef.current === jobId) return;

    let cancelled = false;
    const hydrate = async () => {
      setIsFetching?.(true);
      try {
        const job = await fetchJobCreateById(jobId);
        if (!cancelled && job) {
          hydratedIdRef.current = jobId;
          navigate(`${jobModuleBasePath}/${mode}`, {
            state: { ...location.state, job, chaJobHydrated: true },
            replace: true,
          });
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to hydrate CHA job:", error);
          ToastNotification({
            type: "error",
            message: "Failed to load CHA job details.",
          });
        }
      } finally {
        if (!cancelled) setIsFetching?.(false);
      }
    };

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [
    isChaMode,
    mode,
    jobData?.id,
    jobModuleBasePath,
    location.state,
    navigate,
    setIsFetching,
  ]);
}
