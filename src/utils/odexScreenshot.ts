import type { OdexScreenshot } from "../types/odex";

/** Resolve display URL from API shapes (`image_url`, `url`, `thumbnail_url`). */
export function getOdexScreenshotSrc(
  shot: Pick<
    OdexScreenshot,
    "image_url" | "url" | "thumbnail_url"
  > | null | undefined,
  preferThumbnail = false,
): string {
  if (!shot) return "";
  if (preferThumbnail) {
    return (
      shot.thumbnail_url?.trim() ||
      shot.image_url?.trim() ||
      shot.url?.trim() ||
      ""
    );
  }
  return (
    shot.image_url?.trim() ||
    shot.url?.trim() ||
    shot.thumbnail_url?.trim() ||
    ""
  );
}

export function mapOdexScreenshot(
  raw: Record<string, unknown>,
): OdexScreenshot {
  const imageUrl = String(raw.image_url ?? raw.url ?? "").trim();
  const thumbnail = String(raw.thumbnail_url ?? "").trim();
  const screenshotType = raw.screenshot_type
    ? String(raw.screenshot_type)
    : null;
  const stepName = raw.step_name
    ? String(raw.step_name)
    : screenshotType;

  return {
    id: Number(raw.id),
    image_url: imageUrl || null,
    url: imageUrl || thumbnail || "",
    thumbnail_url: thumbnail || imageUrl || null,
    screenshot_type: screenshotType,
    step_name: stepName,
    step_id: raw.step_id != null ? Number(raw.step_id) : null,
    created_at: raw.created_at ? String(raw.created_at) : null,
  };
}

export function formatOdexScreenshotLabel(shot: OdexScreenshot): string {
  const type = shot.screenshot_type?.replace(/_/g, " ") ?? "";
  if (type) {
    return type.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return shot.step_name ?? "Screenshot";
}
