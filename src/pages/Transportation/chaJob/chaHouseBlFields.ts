import dayjs from "dayjs";

type ChaHouseBlEditData = {
  bl_no?: string | null;
  bl_date?: string | Date | null;
};

export type ChaHouseBlFormValues = {
  bl_no: string;
  bl_date: Date | null;
};

export function readChaHouseBlInitial(
  editData?: ChaHouseBlEditData | null,
): ChaHouseBlFormValues {
  const blDateRaw = editData?.bl_date;
  return {
    bl_no: String(editData?.bl_no ?? "").trim(),
    bl_date:
      blDateRaw != null && dayjs(blDateRaw).isValid()
        ? dayjs(blDateRaw).toDate()
        : null,
  };
}

export function formatChaHouseBlPayload(values: ChaHouseBlFormValues) {
  return {
    bl_no: values.bl_no?.trim() || null,
    bl_date:
      values.bl_date != null && dayjs(values.bl_date).isValid()
        ? dayjs(values.bl_date).format("YYYY-MM-DD")
        : null,
  };
}

/** Include BL fields in housing_details when present (CHA jobs). */
export function pickChaHouseBlPayloadFields(
  housing:
    | { bl_no?: string | null; bl_date?: string | Date | null }
    | null
    | undefined,
): { bl_no: string | null; bl_date: string | null } | Record<string, never> {
  if (!housing) return {};
  const blNo = String(housing.bl_no ?? "").trim();
  const blDateRaw = housing.bl_date;
  const blDate =
    blDateRaw != null && dayjs(blDateRaw).isValid()
      ? dayjs(blDateRaw).format("YYYY-MM-DD")
      : null;
  if (!blNo && !blDate) return {};
  return { bl_no: blNo || null, bl_date: blDate };
}
