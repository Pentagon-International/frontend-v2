import dayjs from "dayjs";
import type { PeriodGranularity } from "../collectionTargetVsPerformance/components/PeriodPillGroup";
import type { PendingActivityCategory } from "./financePendingActivitiesTypes";

export type TopListPagination = {
  index: number;
  limit: number;
};

export type PendingActivitiesTopLists = {
  invoices_to_raise: TopListPagination;
  costs_to_book: TopListPagination;
  vouchers_pending: TopListPagination;
};

export type PendingActivitiesRequest = {
  company: string;
  date_from: string;
  date_to: string;
  top_lists: PendingActivitiesTopLists;
  invoices_to_raise?: boolean;
  costs_to_book?: boolean;
  vouchers_pending?: boolean;
  credit_notes_pending?: boolean;
  branch_code?: string;
  search?: string;
};

export const DEFAULT_TOP_LISTS: PendingActivitiesTopLists = {
  invoices_to_raise: { index: 0, limit: 5 },
  costs_to_book: { index: 0, limit: 10 },
  vouchers_pending: { index: 0, limit: 3 },
};

const KPI_FILTER_FIELD: Record<PendingActivityCategory, keyof PendingActivitiesRequest> = {
  invoices: "invoices_to_raise",
  costs: "costs_to_book",
  vouchers: "vouchers_pending",
  credit_notes: "credit_notes_pending",
};

export type PendingActivitiesDateRange = {
  date_from: string;
  date_to: string;
};

/** India financial year starts 1 April (FY label e.g. FY26 = Apr 2025 – Mar 2026). */
function indiaFyStart(today = dayjs()) {
  return today.month() >= 3
    ? today.month(3).date(1).startOf("day")
    : today.subtract(1, "year").month(3).date(1).startOf("day");
}

function capDateToToday(end: dayjs.Dayjs, today = dayjs()) {
  return end.isAfter(today, "day") ? today : end;
}

/**
 * Maps period pills to API `date_from` / `date_to` (YYYY-MM-DD).
 * - Month: current calendar month (1st → today)
 * - Quarter: current calendar quarter of the year (Q1 Jan–Mar, …)
 * - H1/H2: calendar half-year — H1 Jan–Jun, H2 Jul–Dec
 * - FY: India financial year (1 Apr → today within the active FY)
 */
export function periodToDateRange(period: PeriodGranularity): PendingActivitiesDateRange {
  const today = dayjs();

  switch (period) {
    case "quarter": {
      const start = today.startOf("quarter");
      const end = capDateToToday(today.endOf("quarter"));
      return {
        date_from: start.format("YYYY-MM-DD"),
        date_to: end.format("YYYY-MM-DD"),
      };
    }
    case "h1h2": {
      const inCalendarH1 = today.month() < 6;
      const start = inCalendarH1
        ? today.startOf("year")
        : today.month(6).date(1).startOf("day");
      const end = capDateToToday(
        inCalendarH1 ? today.month(5).endOf("month") : today.endOf("year"),
      );
      return {
        date_from: start.format("YYYY-MM-DD"),
        date_to: end.format("YYYY-MM-DD"),
      };
    }
    case "fy": {
      const start = indiaFyStart(today);
      const end = capDateToToday(start.add(1, "year").subtract(1, "day"));
      return {
        date_from: start.format("YYYY-MM-DD"),
        date_to: end.format("YYYY-MM-DD"),
      };
    }
    case "month":
    default: {
      const start = today.startOf("month");
      const end = capDateToToday(today.endOf("month"));
      return {
        date_from: start.format("YYYY-MM-DD"),
        date_to: end.format("YYYY-MM-DD"),
      };
    }
  }
}

export function parseApiDate(value: string): Date | null {
  const parsed = dayjs(value, "YYYY-MM-DD", true);
  return parsed.isValid() ? parsed.toDate() : null;
}

/** Clamp range: from ≤ to, to ≤ today. */
export function normalizeDateRange(
  from: Date | null,
  to: Date | null,
): PendingActivitiesDateRange | null {
  if (!from || !to) return null;
  const today = dayjs().startOf("day");
  let fromD = dayjs(from).startOf("day");
  let toD = dayjs(to).startOf("day");
  if (toD.isAfter(today)) toD = today;
  if (fromD.isAfter(toD)) fromD = toD;
  return {
    date_from: fromD.format("YYYY-MM-DD"),
    date_to: toD.format("YYYY-MM-DD"),
  };
}

export function formatPendingActivitiesPeriodLabel(range: PendingActivitiesDateRange): string {
  const from = dayjs(range.date_from);
  const to = dayjs(range.date_to);
  if (!from.isValid() || !to.isValid()) return "Period";
  if (range.date_from === range.date_to) {
    return to.format("D MMM YYYY");
  }
  if (from.year() === to.year()) {
    return `${from.format("D MMM")} – ${to.format("D MMM YYYY")}`;
  }
  return `${from.format("D MMM YYYY")} – ${to.format("D MMM YYYY")}`;
}

export function buildPendingActivitiesRequest(options: {
  company: string;
  dateRange: PendingActivitiesDateRange;
  topLists: PendingActivitiesTopLists;
  selectedKpiFilters?: Iterable<PendingActivityCategory>;
  branchCode?: string | null;
  search?: string;
}): PendingActivitiesRequest {
  const payload: PendingActivitiesRequest = {
    company: options.company,
    date_from: options.dateRange.date_from,
    date_to: options.dateRange.date_to,
    top_lists: options.topLists,
  };

  for (const category of options.selectedKpiFilters ?? []) {
    payload[KPI_FILTER_FIELD[category]] = true;
  }

  if (options.branchCode) {
    payload.branch_code = options.branchCode;
  }
  if (options.search?.trim()) {
    payload.search = options.search.trim();
  }

  return payload;
}
