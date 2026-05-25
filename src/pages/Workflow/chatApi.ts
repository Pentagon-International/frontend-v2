import axios, { AxiosError } from "axios";

export type ChatMode = "operations" | "analytics";

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

/** API session_id: numeric for operations when possible, string for analytics */
export const sessionIdForApi = (
  mode: ChatMode,
  sessionId: string,
): string | number => {
  if (mode === "operations") {
    const n = Number(sessionId);
    if (!Number.isNaN(n) && /^\d+$/.test(sessionId)) return n;
  }
  return sessionId;
};

export const chatTypeParam = (mode: ChatMode) => ({ type: mode });
