import type { NavigateFunction } from "react-router-dom";
import { apiCallProtected } from "../api/axios";
import { URL } from "../api/serverUrls";
import { ToastNotification } from "../components";
import {
  CHA_AIR_EXPORT_CONFIG,
  CHA_AIR_IMPORT_CONFIG,
  CHA_OCEAN_EXPORT_CONFIG,
  CHA_OCEAN_IMPORT_CONFIG,
  type ChaJobConfig,
} from "../pages/Transportation/chaJob/chaJobConfig";
import { buildChaServiceJobPayload } from "../pages/Transportation/chaJob/chaJobPayload";
import {
  fetchChaServices,
  resolveChaServicePayload,
  type ChaServiceMasterItem,
} from "../pages/Transportation/chaJob/chaJobService";
import {
  buildJobCreatePayloadFromBooking,
  extractJobDetailsIdFromResponse,
  fetchJobRecordByDetailsId,
  resolveBookingRecordForJobCreate,
  type BookingCreateJobMode,
} from "./bookingCreateJob";

export type BookingCreateChaJobMode = Extract<
  BookingCreateJobMode,
  "air-import" | "air-export" | "ocean-import" | "ocean-export"
>;

const CHA_CONFIG_BY_BOOKING_MODE: Record<
  BookingCreateChaJobMode,
  ChaJobConfig
> = {
  "air-import": CHA_AIR_IMPORT_CONFIG,
  "air-export": CHA_AIR_EXPORT_CONFIG,
  "ocean-import": CHA_OCEAN_IMPORT_CONFIG,
  "ocean-export": CHA_OCEAN_EXPORT_CONFIG,
};

function resolveChaServiceForBooking(
  booking: Record<string, unknown>,
  chaConfig: ChaJobConfig,
  chaServices: ChaServiceMasterItem[],
): ChaServiceMasterItem | null {
  if (!chaServices.length) return null;

  if (chaConfig.transportMode === "AIR") {
    return chaServices[0] ?? null;
  }

  const bookingService = String(booking.service ?? "")
    .trim()
    .toUpperCase();
  const matched = chaServices.find((item) => {
    const payload = resolveChaServicePayload(item, chaConfig.serviceType);
    return payload.service.toUpperCase() === bookingService;
  });
  return matched ?? chaServices[0] ?? null;
}

function stripBookingLinksFromAgentPayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const { booking_ids: _bookingIds, ...rest } = payload;
  const housing = Array.isArray(rest.housing_details)
    ? rest.housing_details.map((house) => {
        const row = { ...(house as Record<string, unknown>) };
        delete row.booking_id;
        return row;
      })
    : rest.housing_details;

  return {
    ...rest,
    ...(housing != null ? { housing_details: housing } : {}),
  };
}

export async function buildChaJobCreatePayloadFromBooking(
  booking: Record<string, unknown>,
  mode: BookingCreateChaJobMode,
): Promise<Record<string, unknown> | null> {
  const chaConfig = CHA_CONFIG_BY_BOOKING_MODE[mode];
  const agentPayload = stripBookingLinksFromAgentPayload(
    buildJobCreatePayloadFromBooking(booking, mode),
  );

  const chaServices = await fetchChaServices(chaConfig.serviceCodes);
  const chaService = resolveChaServiceForBooking(booking, chaConfig, chaServices);
  if (!chaService?.id) {
    return null;
  }

  return buildChaServiceJobPayload({
    agentPayload,
    serviceId: chaService.id,
    transportMode: chaConfig.transportMode === "AIR" ? "AIR" : "SEA",
  });
}

export type CreateChaJobFromBookingOptions = {
  navigate: NavigateFunction;
  mode: BookingCreateChaJobMode;
  onStart?: () => void;
  onEnd?: () => void;
  invalidateList?: () => void;
};

export async function createChaJobFromBooking(
  booking: Record<string, unknown>,
  options: CreateChaJobFromBookingOptions,
): Promise<boolean> {
  const { navigate, mode, onStart, onEnd, invalidateList } = options;
  const chaConfig = CHA_CONFIG_BY_BOOKING_MODE[mode];
  const jobEditPath = `${chaConfig.basePath}/edit`;

  onStart?.();
  try {
    const bookingForPayload = await resolveBookingRecordForJobCreate(booking);
    const payload = await buildChaJobCreatePayloadFromBooking(
      bookingForPayload,
      mode,
    );

    if (!payload) {
      ToastNotification({
        type: "error",
        message: "Could not resolve CHA service for this booking.",
      });
      return false;
    }

    const response = (await apiCallProtected.post(
      URL.jobCreate,
      payload,
    )) as unknown;
    const jobDetailsId = extractJobDetailsIdFromResponse(response);

    if (!jobDetailsId) {
      ToastNotification({
        type: "error",
        message: "CHA job was created but no job id was returned from the server.",
      });
      return false;
    }

    ToastNotification({
      type: "success",
      message: `${chaConfig.pageTitle} created successfully`,
    });

    invalidateList?.();

    let job: Record<string, unknown> | null = null;
    try {
      job = await fetchJobRecordByDetailsId(jobDetailsId);
    } catch (fetchErr) {
      console.error("Error fetching CHA job after create:", fetchErr);
    }

    if (job) {
      navigate(jobEditPath, {
        state: { job },
      });
    } else {
      navigate(jobEditPath, {
        state: { jobId: jobDetailsId },
      });
    }
    return true;
  } catch (err: unknown) {
    const axiosErr = err as {
      response?: {
        data?: { message?: string; detail?: string; error?: string };
      };
      message?: string;
    };
    const errMsg =
      axiosErr?.response?.data?.message ||
      axiosErr?.response?.data?.detail ||
      axiosErr?.response?.data?.error ||
      (err instanceof Error ? err.message : "Failed to create CHA job");
    ToastNotification({ type: "error", message: String(errMsg) });
    return false;
  } finally {
    onEnd?.();
  }
}
