type ApiStatusResponse = {
  status?: boolean | string;
  message?: string;
};

export function isApiFailureResponse(response: unknown): boolean {
  if (!response || typeof response !== "object") return false;
  const status = (response as ApiStatusResponse).status;
  return status === false || status === "false";
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

/** Resolve error text from thrown API errors or wrapped response bodies. */
export function getServerErrorMessage(
  error: unknown,
  fallback: string
): string {
  if (!error) return fallback;

  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;

    if (typeof record.message === "string" && record.message.trim()) {
      return record.message.trim();
    }

    const responseData =
      record.response && typeof record.response === "object"
        ? (record.response as Record<string, unknown>).data
        : record.data;

    if (responseData && typeof responseData === "object") {
      const message = getApiResponseMessage(responseData, "");
      if (message) return message;
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return fallback;
}
