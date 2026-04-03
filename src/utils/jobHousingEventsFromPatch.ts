/** Events row shape used in job housing forms (Import/Export House + Job Create lists). */
export type HousingEventFormRow = {
  id?: number;
  type: string;
  date: string;
};

/** Modal row shape used by Import/Export HouseCreate Events modal (Mantine form). */
export type EventModalRow = {
  id?: number;
  eventType: string | null;
  eventDate: Date | null;
};

/**
 * Axios wraps the API body in `response.data`. APIs often return
 * `{ status, message, data: <job> }` — extract the job object either way.
 */
export function extractJobDataFromPatchAxiosResponse(axiosRes: {
  data?: unknown;
}): unknown {
  const raw = axiosRes?.data;
  if (raw == null || typeof raw !== "object") return null;
  const top = raw as Record<string, unknown>;
  if (top.data != null && typeof top.data === "object") {
    const inner = top.data as Record<string, unknown>;
    if (Array.isArray(inner.housing_details)) return top.data;
  }
  if (Array.isArray(top.housing_details)) return raw;
  return null;
}

/**
 * Keeps `event_modal_rows` in sync with `events` so the Events modal shows rows
 * (the modal renders `event_modal_rows`, not `events` directly).
 */
export function eventsToEventModalRows(
  events: HousingEventFormRow[],
): EventModalRow[] {
  return [
    ...events.map((e) => ({
      id: e.id,
      eventType: e.type,
      eventDate: e.date ? new Date(String(e.date)) : null,
    })),
    { id: undefined, eventType: null, eventDate: null },
  ];
}

/**
 * Reads `housing_details[].events` for the given housing id from a successful
 * `PATCH job-create/:id/` job payload (full job object with `housing_details`).
 */
/**
 * Prefer non-empty `editData.events`; otherwise read from `job.housing_details`
 * by housing id, then by index (matches Air Import/Export HouseCreate and fixes
 * table → edit flows where the job payload has events but `editData` does not).
 */
export function resolveHousingEventsForHouseForm(
  job: unknown,
  editData: unknown,
  editIndex: number | undefined,
): HousingEventFormRow[] {
  const normalize = (raw: unknown): HousingEventFormRow[] => {
    if (!Array.isArray(raw)) return [];
    return raw.map((ev) => {
      const e = ev as { id?: number; type?: string; date?: string };
      return {
        id: e.id != null ? Number(e.id) : undefined,
        type: String(e.type ?? ""),
        date: String(e.date ?? ""),
      };
    });
  };

  const ed = editData as
    | { id?: number | string; events?: unknown[] }
    | undefined;
  const fromEdit = normalize(ed?.events);
  if (fromEdit.length > 0) return fromEdit;

  const jobObj = job as
    | {
        housing_details?: Array<{
          id?: number | string;
          events?: unknown[];
        }>;
      }
    | undefined
    | null;
  const list = jobObj?.housing_details;
  if (!Array.isArray(list)) return [];

  if (ed?.id !== undefined && ed?.id !== null && ed?.id !== "") {
    const rid = Number(ed.id);
    if (!Number.isNaN(rid)) {
      const row = list.find((h) => Number(h?.id) === rid);
      const fromId = normalize(row?.events);
      if (fromId.length > 0) return fromId;
    }
  }

  if (editIndex !== undefined && editIndex >= 0 && list[editIndex]) {
    return normalize(list[editIndex].events);
  }

  return [];
}

export function housingEventsFromJobPatchData(
  jobData: unknown,
  housingId: number,
): HousingEventFormRow[] | null {
  const job = jobData as {
    housing_details?: Array<{ id?: number; events?: unknown[] }>;
  };
  const list = job?.housing_details;
  if (!Array.isArray(list)) return null;
  const hid = Number(housingId);
  const row = list.find((h) => Number(h?.id) === hid);
  if (!row) return null;
  if (!Array.isArray(row.events)) return null;
  return row.events.map((ev) => {
    const e = ev as { id?: number; type?: string; date?: string };
    const id = e.id != null ? Number(e.id) : undefined;
    const type = String(e.type ?? "");
    const date = String(e.date ?? "").slice(0, 10);
    return id != null ? { id, type, date } : { type, date };
  });
}
