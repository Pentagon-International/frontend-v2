const ALLOC_DOC_OPEN_PREFIX = "alloc-doc-open:";
export const ALLOC_DOC_OPEN_QUERY = "allocOpen";

const consumedOpenPayloads = new Map<string, unknown>();

export function stashOpenedDocumentState(state: unknown): string {
  const key = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(
    `${ALLOC_DOC_OPEN_PREFIX}${key}`,
    JSON.stringify(state ?? {}),
  );
  return key;
}

export function takeOpenedDocumentState(key: string): unknown | null {
  const cached = consumedOpenPayloads.get(key);
  if (cached) return cached;

  const storageKey = `${ALLOC_DOC_OPEN_PREFIX}${key}`;
  const raw = localStorage.getItem(storageKey);
  localStorage.removeItem(storageKey);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    consumedOpenPayloads.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}
