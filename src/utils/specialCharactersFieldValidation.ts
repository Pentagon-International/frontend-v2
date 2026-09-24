/** Shared message when MAWB (or similar) contains disallowed symbols. */
export const SPECIAL_CHARACTERS_NOT_ALLOWED_MESSAGE =
  "Special characters are not allowed";

/** Letters and digits only (optional empty) — e.g. MAWB. */
export function hasNonAlphanumericCharacters(value: unknown): boolean {
  const s = String(value ?? "").trim();
  if (!s) return false;
  return /[^A-Za-z0-9]/.test(s);
}

export function specialCharactersErrorIfNonAlphanumeric(
  value: unknown,
): string | null {
  return hasNonAlphanumericCharacters(value)
    ? SPECIAL_CHARACTERS_NOT_ALLOWED_MESSAGE
    : null;
}

/**
 * True when the value has characters other than digits and `.`
 * (callers should strip thousand-separator commas first).
 */
export function hasInvalidNumericInputCharacters(value: unknown): boolean {
  const s = String(value ?? "").trim();
  if (!s) return false;
  return /[^0-9.]/.test(s);
}

export function specialCharactersErrorIfNonNumeric(
  value: unknown,
): string | null {
  return hasInvalidNumericInputCharacters(value)
    ? SPECIAL_CHARACTERS_NOT_ALLOWED_MESSAGE
    : null;
}
