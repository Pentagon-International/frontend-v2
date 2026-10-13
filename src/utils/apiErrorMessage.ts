type ApiStatusResponse = {
  status?: boolean | string;
  message?: string;
  override?: boolean;
};

export function isApiFailureResponse(response: unknown): boolean {
  if (!response || typeof response !== "object") return false;
  const status = (response as ApiStatusResponse).status;
  return status === false || status === "false";
}

/**
 * `{ status, message, data }` may be the body itself or nested under `.data`.
 */
export function unwrapApiStatusBody(response: unknown): unknown {
  if (!response || typeof response !== "object") return response;
  const obj = response as Record<string, unknown>;
  const inner = obj.data;
  if (
    inner &&
    typeof inner === "object" &&
    !Array.isArray(inner) &&
    ("status" in inner || "message" in inner)
  ) {
    return inner;
  }
  return response;
}

function hasOverrideTrue(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const override = (value as { override?: unknown }).override;
  return override === true || override === "true";
}

/** True when API body includes `override: true` (credit-limit override flow). */
export function isApiOverrideResponse(response: unknown): boolean {
  if (!response || typeof response !== "object") return false;
  const record = response as Record<string, unknown>;
  if (hasOverrideTrue(record)) return true;

  const body = unwrapApiStatusBody(response);
  if (hasOverrideTrue(body)) return true;

  // Some APIs nest override under `data` even when status/message stay on the root.
  if (hasOverrideTrue(record.data)) return true;
  if (
    body &&
    typeof body === "object" &&
    hasOverrideTrue((body as Record<string, unknown>).data)
  ) {
    return true;
  }

  return false;
}

/** Credit-limit block message that should open the override Yes/No modal. */
export function isCreditLimitOverrideMessage(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  return (
    /exceeds the approved credit limit/i.test(text) ||
    (/outstanding balance/i.test(text) && /credit limit/i.test(text))
  );
}

/** Read `message` from `{ status, message, data }` style API payloads. */
export function getApiResponseMessage(
  response: unknown,
  fallback: string
): string {
  if (response && typeof response === "object") {
    const message = (response as ApiStatusResponse).message;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  }
  return fallback;
}

/** API `message` when `status` is false; otherwise null. */
export function getApiFailureMessage(
  response: unknown,
  fallback: string,
): string | null {
  const body = unwrapApiStatusBody(response);
  if (!isApiFailureResponse(body)) return null;
  return getApiResponseMessage(body, fallback);
}

const GENERIC_API_MESSAGES = new Set([
  "Failed to update job",
  "Failed to save house details",
  "Bad Request! Please check your input.",
  "An error occurred! Please try again later.",
  "Internal server error! Something went wrong on the server.",
]);

function labelApiField(field: string): string {
  const known: Record<string, string> = {
    planned_pickup_date: "Planned pickup date",
    planned_delivery_date: "Planned delivery date",
    actual_pickup_date: "Actual pickup date",
    actual_delivery_date: "Actual delivery date",
  };
  if (known[field]) return known[field];
  return field
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/** Turn DRF `ErrorDetail` dumps and field maps into toast text. */
export function humanizeApiErrorDetails(details: unknown): string {
  if (details == null) return "";
  if (typeof details === "string") {
    const text = details.trim();
    if (!text || text === "[]" || text === "{}") return "";
    const messages = [...text.matchAll(/string='([^']*)'/g)].map((match) =>
      match[1].trim(),
    );
    const fields = [...text.matchAll(/'([A-Za-z0-9_]+)':\s*\[/g)].map(
      (match) => match[1],
    );
    if (messages.length > 0) {
      if (fields.length === messages.length) {
        return fields
          .map((field, index) => `${labelApiField(field)}: ${messages[index]}`)
          .join(" ");
      }
      return messages.join(" ");
    }
    return text;
  }
  if (Array.isArray(details)) {
    return details
      .map((item) => humanizeApiErrorDetails(item))
      .filter(Boolean)
      .join(" ");
  }
  if (typeof details === "object") {
    return Object.entries(details as Record<string, unknown>)
      .map(([key, value]) => {
        const text = humanizeApiErrorDetails(value);
        return text ? `${labelApiField(key)}: ${text}` : "";
      })
      .filter(Boolean)
      .join(" ");
  }
  return "";
}

/**
 * Toast text for a failed job/house save.
 * Uses field validation when the API message is only "Failed to update job".
 */
export function formatApiFailureForToast(
  error: unknown,
  fallback: string,
): string {
  const message = getServerErrorMessage(error, fallback);
  const details =
    error && typeof error === "object"
      ? humanizeApiErrorDetails(
          (error as { details?: unknown }).details,
        )
      : "";
  const generic = !message || message === fallback || GENERIC_API_MESSAGES.has(message);
  if (details && generic) return details;
  if (details && !message.includes(details)) return `${message}. ${details}`;
  return message || fallback;
}

/** Resolve error text from thrown API errors or wrapped response bodies. */
export function getServerErrorMessage(
  error: unknown,
  fallback: string
): string {
  if (!error) return fallback;

  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;

    // Prefer API body message (e.g. axios error.response.data.message)
    const responseData =
      record.response && typeof record.response === "object"
        ? (record.response as Record<string, unknown>).data
        : record.data;

    if (responseData && typeof responseData === "object") {
      const message = getApiResponseMessage(responseData, "");
      if (message) return message;
    }

    if (typeof record.message === "string" && record.message.trim()) {
      const msg = record.message.trim();
      // Skip generic Axios transport messages when a better fallback exists
      if (!/^Request failed with status code \d+$/i.test(msg)) {
        return msg;
      }
    }
  }

  if (error instanceof Error && error.message.trim()) {
    const msg = error.message.trim();
    if (!/^Request failed with status code \d+$/i.test(msg)) {
      return msg;
    }
  }

  return fallback;
}
