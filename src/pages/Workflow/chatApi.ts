import axios, { AxiosError } from "axios";

export type ChatMode = "operations" | "analytics";

/** Query param on chatbot app routes (`?type=operations|analytics`). */
export const CHAT_URL_TYPE_PARAM = "type";

/** Active chat session on chatbot app routes (`?session_id=84`). */
export const CHAT_URL_SESSION_PARAM = "session_id";

export const chatModeFromUrlParam = (value: string | null): ChatMode =>
  value === "analytics" ? "analytics" : "operations";

export const resolveChatModeFromUrl = (
  value: string | null,
  isStaffAdmin: boolean,
): ChatMode => {
  const mode = chatModeFromUrlParam(value);
  if (mode === "analytics" && !isStaffAdmin) return "operations";
  return mode;
};

export const chatApi = axios.create({
  baseURL: `${import.meta.env.VITE_CHATBOT_API_BASE_URL}`,
});

chatApi.interceptors.request.use((config) => {
  config.headers.Authorization = `Bearer ${localStorage.getItem("accessToken") || ""}`;
  config.headers["Content-Type"] = "application/json";
  return config;
});

export const handleChatApiError = (err: unknown): string => {
  const axiosErr = err as AxiosError<{ detail?: string; message?: string }>;
  const status = axiosErr.response?.status;

  if (status === 401) {
    window.location.href = "/login";
    return "Session expired. Redirecting to login…";
  }
  if (status === 503) return "Analytics temporarily unavailable";
  if (status === 400) {
    const detail = axiosErr.response?.data?.detail ?? axiosErr.response?.data?.message;
    if (typeof detail === "string" && detail.trim()) return detail;
    return "Invalid request";
  }
  return "Sorry, something went wrong. Please try again.";
};

/** API session_id: numeric when id is digits (operations + analytics contract). */
export const sessionIdForApi = (
  mode: ChatMode,
  sessionId: string,
): string | number => {
  const n = Number(sessionId);
  if (!Number.isNaN(n) && /^\d+$/.test(sessionId)) return n;
  return sessionId;
};

export const chatTypeParam = (mode: ChatMode) => ({ type: mode });
