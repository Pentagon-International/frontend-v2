export type JobCreateDropdownRow = Record<string, unknown> & {
  type?: string;
  job_id?: string;
  shipment_id?: string;
  service_id?: number;
};

/** Dropdown value + label for `filter/job-create` search results. */
export function formatJobCreateDropdownOption(
  item: JobCreateDropdownRow,
): { value: string; label: string } {
  const type = String(item.type ?? "")
    .trim()
    .toLowerCase();
  const jobId = String(item.job_id ?? "").trim();
  const shipmentId = String(item.shipment_id ?? "").trim();

  if (type === "job_id") {
    const value = jobId || shipmentId;
    return { value, label: value };
  }

  if (type === "shipment_id") {
    const value = shipmentId || jobId;
    const label =
      shipmentId && jobId ? `${shipmentId} (${jobId})` : value;
    return { value, label };
  }

  const value = shipmentId || jobId;
  return { value, label: value };
}

export function jobCreateDropdownDisplayFormat(item: Record<string, unknown>) {
  return formatJobCreateDropdownOption(item as JobCreateDropdownRow);
}

export function findJobCreateDropdownRow(
  rows: JobCreateDropdownRow[],
  query: string,
): JobCreateDropdownRow | undefined {
  const q = String(query ?? "").trim();
  if (!q) return undefined;

  return rows.find((row) => {
    const { value } = formatJobCreateDropdownOption(row);
    if (value === q) return true;
    const jobId = String(row.job_id ?? "").trim();
    const shipmentId = String(row.shipment_id ?? "").trim();
    return jobId === q || shipmentId === q;
  });
}

export function mapJobCreateDropdownOptions(
  rows: JobCreateDropdownRow[],
): Array<{ value: string; label: string }> {
  const seen = new Set<string>();
  const options: Array<{ value: string; label: string }> = [];

  for (const row of rows) {
    const option = formatJobCreateDropdownOption(row);
    if (!option.value || seen.has(option.value)) continue;
    seen.add(option.value);
    options.push(option);
  }

  return options;
}
