/** Split backend enrichment / failure text into readable lines. */
export function splitAutomationErrorText(value?: string | null): string[] {
  const raw = String(value ?? "").trim();
  if (!raw) return [];
  return raw
    .split(/\s*;\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Deduped, ordered error lines from one or more sources. */
export function collectAutomationPreviewErrors(
  sources: Array<string | null | undefined>,
): string[] {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const source of sources) {
    for (const line of splitAutomationErrorText(source)) {
      const key = line.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(line);
    }
  }
  return lines;
}

/** Flatten header/charge field errors into preview messages. */
export function fieldErrorsToPreviewMessages(errors: {
  header: Partial<Record<string, string>>;
  charges?: Array<Partial<Record<string, string>>>;
}): string[] {
  const lines: string[] = [];
  for (const message of Object.values(errors.header)) {
    const text = String(message ?? "").trim();
    if (text) lines.push(text);
  }
  (errors.charges ?? []).forEach((row, index) => {
    for (const message of Object.values(row || {})) {
      const text = String(message ?? "").trim();
      if (text) lines.push(`Charge line ${index + 1}: ${text}`);
    }
  });
  return lines;
}
