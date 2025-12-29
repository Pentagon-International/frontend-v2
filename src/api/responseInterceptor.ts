import { apiCallProtected } from "./axios";
import useAuthStore from "../store/authStore";
import { ToastNotification } from "../components";
import { AxiosError, InternalAxiosRequestConfig } from "axios";

// Variable to track if a token refresh is in progress
let isRefreshing = false;
// Queue to store failed requests while token is being refreshed
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (error?: any) => void;
}> = [];

/**
 * Process queued requests after token refresh completes
 */
const processQueue = (error: any = null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

const responseInterceptor = () =>
  apiCallProtected.interceptors.response.use(
    (response) => {
      if (response.status === 200 || response.status === 201) {
        return response.data;
      } else if (response.status === 204) {
        return { status: "success" };
      } else {
        return response;
      }
    },
    async (error: AxiosError) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & {
        _retry?: boolean;
      };

      const requestUrl = originalRequest?.url || "";
      const responseData = error.response?.data as any;
      if (requestUrl.includes("/login") || requestUrl.includes("/signup")) {
        return Promise.reject({
          message:
            responseData?.detail ||
            (error.response?.status === 401
              ? "Invalid credentials! Please check your username or password."
              : "An error occurred! Please try again."),
        });
      }

      // Handle 401 Unauthorized errors (access token expired)
      if (
        error.response?.status === 401 &&
        originalRequest &&
        !originalRequest._retry
      ) {
        // Check if this is the refresh token endpoint itself failing
        if (originalRequest.url?.includes("token/refresh")) {
          // Refresh token API returned 401 - refresh token is expired, logout user
          console.error("Refresh token expired. Logging out...");
          ToastNotification({
            type: "error",
            message: "Session expired. Please login again.",
          });
          useAuthStore.getState().resetAuth();
          return Promise.reject({
            message: "Session expired. Please login again.",
          });
        }

        // This is a regular API call with expired access token
        // Mark this request as retried to prevent infinite loops
        originalRequest._retry = true;

        if (isRefreshing) {
          // If token refresh is already in progress, queue this request
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then((token) => {
              // Update the authorization header with the new token
              if (originalRequest.headers && token) {
                originalRequest.headers.Authorization = `Bearer ${token}`;
              }
              // Retry the original request
              return apiCallProtected(originalRequest);
            })
            .catch((err) => {
              return Promise.reject(err);
            });
        }

        // Start token refresh process
        isRefreshing = true;

        try {
          // Attempt to refresh the access token
          const newAccessToken = await useAuthStore
            .getState()
            .refreshAccessToken();

          // Update the authorization header with the new token
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          }

          // Process all queued requests with the new token
          processQueue(null, newAccessToken);

          // Retry the original request with the new token
          return apiCallProtected(originalRequest);
        } catch (refreshError: any) {
          // Check if refresh token itself expired (401 from refresh endpoint)
          const isRefreshTokenExpired =
            refreshError?.isRefreshTokenExpired ||
            refreshError?.message?.includes("Refresh token expired") ||
            refreshError?.message?.includes("No refresh token available");

          if (isRefreshTokenExpired) {
            // Refresh token is expired - logout user
            processQueue(refreshError, null);

            ToastNotification({
              type: "error",
              message: "Session expired. Please login again.",
            });

            useAuthStore.getState().resetAuth();

            return Promise.reject({
              message: "Session expired. Please login again.",
            });
          } else {
            // Other errors (network, server error, etc.) - don't logout
            // Just reject the request with error
            processQueue(refreshError, null);

            return Promise.reject({
              message:
                refreshError?.message ||
                "Failed to refresh token. Please try again.",
            });
          }
        } finally {
          isRefreshing = false;
        }
      }

      // Handle other error responses
      if (error.response) {
        const status = error.response.status;
        const data = error.response.data as any;

        console.log("API Error:", data);

        switch (status) {
          case 400:
            return Promise.reject({
              message:
                data?.error_message || "Bad Request! Please check your input.",
            });

          case 403:
            // Forbidden - different from 401, user doesn't have permission
            const { accessToken, resetAuth } = useAuthStore?.getState();

            if (accessToken) {
              ToastNotification({
                type: "error",
                message:
                  "Your session got expired! Please Login again to continue.",
              });
              resetAuth();
            }
            return Promise.reject({
              message:
                "Access forbidden! You do not have permission to access this resource.",
            });

          case 404:
            return Promise.reject({
              message:
                "Resource not found! The requested resource could not be found.",
            });

          case 500:
            return Promise.reject({
              message:
                "Internal server error! Something went wrong on the server.",
            });

          case 503:
            return Promise.reject({
              message: "Service Unavailable! Please try again later.",
            });

          default:
            return Promise.reject({
              message:
                data?.error_message ||
                "An error occurred! Please try again later.",
            });
        }
      } else if (error.request) {
        return Promise.reject({
          message:
            "No response received from server! Please check your network connection.",
        });
      } else {
        return Promise.reject({
          message: error.message || "An unexpected error occurred!",
        });
      }
    }
  );

export default responseInterceptor;
