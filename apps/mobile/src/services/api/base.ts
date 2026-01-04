import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import { STORAGE_KEYS, storageUtil } from "../../utils/storageUtil";
import { useSystemStatusStore } from "@/stores/systemStatusStore";

// Build User-Agent string once at startup
const buildUserAgent = (): string => {
  const appName = Constants.expoConfig?.name || "FitNudge";
  const appVersion = Constants.expoConfig?.version || "1.0.0";
  const platform = Platform.OS;
  const osVersion = Platform.Version;
  const deviceModel = Device.modelName || "Unknown";

  return `${appName}/${appVersion} (${platform}; ${osVersion}; ${deviceModel})`;
};

const USER_AGENT = buildUserAgent();

// Global flag to prevent API calls during logout
let isLoggingOut = false;

export function setLoggingOut(value: boolean) {
  isLoggingOut = value;
}

// Global flag and promise to prevent multiple simultaneous refresh attempts
let isRefreshing = false;
let refreshPromise: Promise<any> | null = null;

// Types
export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
  status: number;
}

const extractMessageValue = (value: unknown, depth = 0): string | undefined => {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  if (value && typeof value === "object" && !Array.isArray(value) && depth < 3) {
    const record = value as Record<string, unknown>;
    for (const key of ["message", "error", "detail", "next_steps"] as const) {
      const candidate = extractMessageValue(record[key], depth + 1);
      if (candidate) {
        return candidate;
      }
    }
  }

  return undefined;
};

export class ApiError<T = any> extends Error {
  status: number;
  data?: T;

  constructor(status: number, detail: T, fallbackMessage?: string) {
    const message = extractMessageValue(detail) || fallbackMessage || "Request failed";
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = detail;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

// Configuration
export const resolveBaseUrl = (): string => {
  // Prefer Expo config extra first, then env var
  const configured = process.env.EXPO_PUBLIC_API_URL;

  if (configured) {
    try {
      const url = new URL(configured);

      return url.toString().replace(/\/$/, "");
    } catch {
      // Invalid URL, fall through to defaults
    }
  }

  // Try to get IP dynamically from Metro connection in development
  const isDevice = Device.isDevice ?? false;

  if (isDevice && __DEV__) {
    // Try to extract IP from Expo Constants (Metro connection info)
    // hostUri format: "192.168.1.100:8081" or "localhost:8081"
    const hostUri = Constants.expoConfig?.hostUri;

    if (hostUri) {
      // Extract IP address (remove port if present)
      const ipMatch = hostUri.match(/^([^:]+)/);
      if (ipMatch) {
        const ip = ipMatch[1];
        // Only use if it's not localhost (real device should have network IP)
        if (ip !== "localhost" && ip !== "127.0.0.1") {
          const dynamicUrl = `http://${ip}:8000/api/v1`;
          if (__DEV__) {
            console.log(`[API] Using dynamic IP from Metro connection: ${dynamicUrl}`);
          }
          return dynamicUrl;
        }
      }
    }
  }

  // Defaults based on platform
  // For real devices, use your computer's local IP (fallback)
  // For simulators/emulators, use appropriate localhost variants
  if (isDevice) {
    // Real device - use network IP (fallback if dynamic detection fails)
    return Platform.select({
      ios: "http://172.20.10.2:8000/api/v1",
      android: "http://172.20.10.2:8000/api/v1",
      default: "http://172.20.10.2:8000/api/v1"
    })!;
  }

  // Simulator/emulator - use localhost variants
  return Platform.select({
    ios: "http://localhost:8000/api/v1",
    android: "http://10.0.2.2:8000/api/v1",
    default: "http://localhost:8000/api/v1"
  })!;
};

const API_CONFIG = {
  baseURL: resolveBaseUrl(),
  timeout: 60000, // 60 seconds - increased for AI generation endpoints
  retryAttempts: 3
};

export const resolveApiRootUrl = (): string => {
  const base = API_CONFIG.baseURL;
  if (base.endsWith("/api/v1")) {
    return base.replace(/\/api\/v1$/, "");
  }
  return base;
};

const PUBLIC_ENDPOINTS = new Set<string>([
  "/auth/login",
  "/auth/signup",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/reset-password/validate",
  "/auth/verify-email",
  "/auth/resend-verification",
  "/auth/logout",
  "/auth/refresh",
  "/health"
]);

const PUBLIC_ENDPOINT_PREFIXES = ["/auth/oauth/", "/app-version/"];

const isPublicEndpoint = (endpoint: string): boolean => {
  if (PUBLIC_ENDPOINTS.has(endpoint)) {
    return true;
  }

  return PUBLIC_ENDPOINT_PREFIXES.some((prefix) => endpoint.startsWith(prefix));
};

// Global token cache for fast access
declare global {
  var accessToken: string | null | undefined;
  var refreshToken: string | null | undefined;
}

// Token management
class TokenManager {
  private static ACCESS_TOKEN_KEY = "access_token";
  private static REFRESH_TOKEN_KEY = "refresh_token";
  private static REMEMBER_ME_EMAIL_KEY = STORAGE_KEYS.REMEMBER_ME_EMAIL;
  private static REMEMBER_ME_ENABLED_KEY = STORAGE_KEYS.REMEMBER_ME_ENABLED;

  /**
   * Initialize token cache from storage
   * Call this once on app startup
   */
  static async initializeCache(): Promise<void> {
    try {
      const [cachedAccessToken, cachedRefreshToken] = await Promise.all([
        storageUtil.getItem<string>(this.ACCESS_TOKEN_KEY),
        storageUtil.getItem<string>(this.REFRESH_TOKEN_KEY)
      ]);

      global.accessToken = cachedAccessToken || null;
      global.refreshToken = cachedRefreshToken || null;
    } catch (error) {
      console.warn("[TokenManager] Failed to initialize cache:", error);
      global.accessToken = null;
      global.refreshToken = null;
    }
  }

  static async getAccessToken(): Promise<string | null> {
    // First check in-memory cache
    if (global.accessToken !== undefined) {
      return global.accessToken;
    }

    // Fallback to storage if cache not initialized
    const token = await storageUtil.getItem<string>(this.ACCESS_TOKEN_KEY);
    global.accessToken = token || null;
    return token;
  }

  static async getRefreshToken(): Promise<string | null> {
    // First check in-memory cache
    if (global.refreshToken !== undefined) {
      return global.refreshToken;
    }

    // Fallback to storage if cache not initialized
    const token = await storageUtil.getItem<string>(this.REFRESH_TOKEN_KEY);
    global.refreshToken = token || null;
    return token;
  }

  static async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    // Update cache immediately
    global.accessToken = accessToken;
    global.refreshToken = refreshToken;

    // Persist to storage
    await Promise.all([
      storageUtil.setItem(this.ACCESS_TOKEN_KEY, accessToken),
      storageUtil.setItem(this.REFRESH_TOKEN_KEY, refreshToken)
    ]);
  }

  static async clearTokens(): Promise<void> {
    // Clear cache immediately
    global.accessToken = null;
    global.refreshToken = null;

    // Clear from storage
    await Promise.all([
      storageUtil.removeItem(this.ACCESS_TOKEN_KEY),
      storageUtil.removeItem(this.REFRESH_TOKEN_KEY)
    ]);
  }

  // Generic secure storage methods (for future use)
  static async setSecureItem(key: string, value: string): Promise<void> {
    await storageUtil.setSecureItem(key, value);
  }

  static async getSecureItem(key: string): Promise<string | null> {
    return storageUtil.getSecureItem(key);
  }

  static async removeItem(key: string): Promise<void> {
    await storageUtil.removeItem(key);
  }

  // Remember me specific methods using constants
  static async setRememberMeEmail(email: string): Promise<void> {
    await storageUtil.setSecureItem(this.REMEMBER_ME_EMAIL_KEY, email);
  }

  static async getRememberMeEmail(): Promise<string | null> {
    return storageUtil.getSecureItem(this.REMEMBER_ME_EMAIL_KEY);
  }

  static async setRememberMeEnabled(enabled: boolean): Promise<void> {
    await storageUtil.setSecureItem(this.REMEMBER_ME_ENABLED_KEY, enabled.toString());
  }

  static async getRememberMeEnabled(): Promise<boolean> {
    const value = await storageUtil.getSecureItem(this.REMEMBER_ME_ENABLED_KEY);
    return value === "true";
  }

  static async clearRememberMe(): Promise<void> {
    await Promise.all([
      storageUtil.removeItem(this.REMEMBER_ME_EMAIL_KEY),
      storageUtil.removeItem(this.REMEMBER_ME_ENABLED_KEY)
    ]);
  }
}

// Base API Service Class
export abstract class BaseApiService {
  protected baseURL: string;
  protected timeout: number;

  constructor() {
    this.baseURL = API_CONFIG.baseURL!;
    this.timeout = API_CONFIG.timeout;
  }

  // Generic HTTP methods
  protected async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    // Skip all API requests if logout is in progress
    if (isLoggingOut && !isPublicEndpoint(endpoint)) {
      throw new ApiError(401, null, "Logout in progress");
    }

    const url = `${this.baseURL}${endpoint}`;

    // Use global token cache for fast, reliable access
    // If cache is not initialized, fallback to storage
    const token =
      global.accessToken !== undefined ? global.accessToken : await TokenManager.getAccessToken();

    // console.log("accessToken", token);

    if (!token && !isPublicEndpoint(endpoint)) {
      // Silently skip unauthenticated requests (hooks should have enabled: isAuthenticated)
      throw new ApiError(401, null, "Not authenticated");
    }

    const defaultHeaders: HeadersInit = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": USER_AGENT
    };

    if (token) {
      defaultHeaders.Authorization = `Bearer ${token}`;
    }

    // Ensure headers are properly merged - convert to plain object
    const headersObj: Record<string, string> = {
      ...defaultHeaders
    };

    // Merge any additional headers from options
    if (options.headers) {
      if (options.headers instanceof Headers) {
        options.headers.forEach((value, key) => {
          headersObj[key] = value;
        });
      } else if (Array.isArray(options.headers)) {
        options.headers.forEach(([key, value]) => {
          headersObj[key] = value;
        });
      } else {
        Object.assign(headersObj, options.headers);
      }
    }

    const config: RequestInit = {
      ...options,
      headers: headersObj
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        ...config,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get("content-type") || "";
      let data: any = null;
      try {
        if (contentType.includes("application/json")) {
          data = await response.json();
        } else {
          const text = await response.text();
          data = text ? { message: text } : null;
        }
      } catch (parseErr) {
        // Fallback to plain text if JSON parse fails
        try {
          const text = await response.text();
          data = text ? { message: text } : null;
        } catch {}
      }

      // Only set data if request was successful (2xx status codes)
      if (!response.ok) {
        const errorPayload = data;

        // If 401 Unauthorized, try to refresh the token and retry the request once
        // Skip auto-refresh for the refresh endpoint itself to avoid infinite loops
        if (
          response.status === 401 &&
          token &&
          !endpoint.includes("/auth/refresh") &&
          !endpoint.includes("/auth/login") &&
          !endpoint.includes("/auth/signup")
        ) {
          // If already refreshing, wait for that refresh to complete
          if (isRefreshing && refreshPromise) {
            console.log(`[API] Token refresh already in progress, waiting...`);
            await refreshPromise;
            // After refresh completes, retry with new token
            const newToken = global.accessToken;
            if (newToken) {
              headersObj.Authorization = `Bearer ${newToken}`;
              const retryResponse = await fetch(url, {
                ...config,
                headers: headersObj
              });
              const retryData = await retryResponse.json();
              if (retryResponse.ok) {
                return {
                  status: retryResponse.status,
                  data: retryData as T,
                  error: undefined
                };
              }
            }
            // If still failing after refresh, fall through to error handling
          } else {
            console.log(`[API] Token expired, attempting to refresh...`);

            // Mark as refreshing
            isRefreshing = true;

            // Import authService dynamically to avoid circular dependency
            const { authService } = await import("./auth");
            refreshPromise = authService.refreshToken();
            const refreshResponse = await refreshPromise;

            // Reset refresh flag
            isRefreshing = false;
            refreshPromise = null;

            if (refreshResponse.data && refreshResponse.data.access_token) {
              console.log(`[API] Token refreshed successfully, retrying original request...`);

              // Update headers with new token from global cache
              // TokenManager.setTokens() already updated global.accessToken
              const newToken = global.accessToken || refreshResponse.data.access_token;
              headersObj.Authorization = `Bearer ${newToken}`;

              // Retry the request with the new token
              const retryResponse = await fetch(url, {
                ...config,
                headers: headersObj,
                signal: controller.signal
              });

              clearTimeout(timeoutId);

              // Parse retry response
              const retryContentType = retryResponse.headers.get("content-type") || "";
              let retryData: any = null;
              try {
                if (retryContentType.includes("application/json")) {
                  retryData = await retryResponse.json();
                } else {
                  const text = await retryResponse.text();
                  retryData = text ? { message: text } : null;
                }
              } catch (parseErr) {
                try {
                  const text = await retryResponse.text();
                  retryData = text ? { message: text } : null;
                } catch {}
              }

              // Return retry response
              if (!retryResponse.ok) {
                throw new ApiError(
                  retryResponse.status,
                  retryData,
                  `Request failed with status ${retryResponse.status}`
                );
              }

              return {
                status: retryResponse.status,
                data: retryData as T,
                error: undefined
              };
            } else {
              // Reset refresh flag
              isRefreshing = false;
              refreshPromise = null;

              console.log(
                `[API] Token refresh failed, returning ${refreshResponse.status}`,
                refreshResponse
              );
              // Logout if refresh returns 404 (user not found) or 500 (Internal Server Error - user likely deleted)
              // Check error message to determine if it's a user-related issue
              const refreshError = refreshResponse.error || "";
              const errorLower = refreshError.toLowerCase();
              const isUserNotFound =
                refreshResponse.status === 404 ||
                (refreshResponse.status === 500 && errorLower.includes("internal server error")) ||
                errorLower.includes("user not found");

              // Logout on 404 or 500 (user deleted - foreign key constraint violation)
              // Backend now returns 404 when user not found, but may still return 500 in some edge cases
              if (
                isUserNotFound ||
                refreshResponse.status === 404 ||
                refreshResponse.status === 500
              ) {
                try {
                  const { handleAutoLogout } = await import("@/utils/authUtils");
                  await handleAutoLogout("not_found");
                } catch (error) {
                  console.error("[API] Failed to handle auto-logout:", error);
                }
              }
              // For other failures (network issues, etc.), just return the error without logging out
            }
          }
        }

        // Handle 403 Forbidden with status info (disabled, suspended)
        if (response.status === 403 && data) {
          const errorData = typeof data === "object" ? data : {};
          const userStatus = errorData.status || errorData.detail?.status;

          if (userStatus === "disabled" || userStatus === "suspended") {
            console.log(`[API] User status: ${userStatus}, triggering auto-logout`);
            try {
              const { handleAutoLogout } = await import("@/utils/authUtils");
              await handleAutoLogout(userStatus as "disabled" | "suspended");
            } catch (error) {
              console.error("[API] Failed to handle auto-logout:", error);
            }
          }
        }

        // Only trigger auto-logout if user was authenticated
        // Don't trigger on login/signup failures (user isn't logged in yet)
        const wasAuthenticated = !!token && !isPublicEndpoint(endpoint);

        if (
          (response.status === 401 && data && wasAuthenticated) ||
          (response.status === 401 && endpoint.includes("/auth/refresh"))
        ) {
          console.log(`[API] Session expired, triggering auto-logout`);
          try {
            const { handleAutoLogout } = await import("@/utils/authUtils");
            await handleAutoLogout("expired_session");
          } catch (error) {
            console.error("[API] Failed to handle auto-logout:", error);
          }
        }

        // Special case: If refresh endpoint returns 404, user was deleted
        // Even though refresh is a "public" endpoint, 404 means user doesn't exist
        if (response.status === 404 && endpoint.includes("/auth/refresh")) {
          console.log(`[API] User not found during refresh, triggering auto-logout`);
          try {
            const { handleAutoLogout } = await import("@/utils/authUtils");
            await handleAutoLogout("not_found");
          } catch (error) {
            console.error("[API] Failed to handle auto-logout:", error);
          }
        } else if (
          response.status === 404 &&
          wasAuthenticated &&
          endpoint.includes("/users/profile")
        ) {
          // Only trigger user deletion logout for user profile endpoints
          // Don't trigger for resource 404s (goals, plans, etc.)
          console.log(`[API] User profile not found, triggering auto-logout`);
          try {
            const { handleAutoLogout } = await import("@/utils/authUtils");
            await handleAutoLogout("not_found");
          } catch (error) {
            console.error("[API] Failed to handle auto-logout:", error);
          }
        }

        // Handle gateway/server errors (502, 503, 504) - backend is offline
        if (response.status === 502 || response.status === 503 || response.status === 504) {
          // Check if it's a Cloudflare error page (HTML response)
          const isCloudflareError =
            contentType.includes("text/html") &&
            typeof data?.message === "string" &&
            (data.message.includes("cloudflare") ||
              data.message.includes("Bad gateway") ||
              data.message.includes("502") ||
              data.message.includes("503") ||
              data.message.includes("504"));

          const errorReason = isCloudflareError
            ? "Server is currently unavailable"
            : (data && (data.detail || data.message || data.error)) ||
              "Service temporarily unavailable";

          useSystemStatusStore.getState().setBackendStatus("offline", errorReason);
        }
        throw new ApiError(
          response.status,
          errorPayload,
          `Request failed with status ${response.status}`
        );
      }

      // Success: return data only if status is 2xx
      return {
        status: response.status,
        data: data as T,
        error: undefined // Explicitly undefined on success
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      if (__DEV__) {
        console.warn(`[API] Request to ${url} failed. Is the backend running?`, error);
      }
      console.log("error", error);
      // Detect network failures and mark as offline
      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();
        const isNetworkError =
          errorMsg.includes("network request failed") ||
          errorMsg.includes("network error") ||
          errorMsg.includes("failed to fetch") ||
          errorMsg.includes("unable to resolve host") ||
          errorMsg.includes("no internet") ||
          errorMsg.includes("connection refused") ||
          errorMsg.includes("econnrefused");

        if (isNetworkError) {
          useSystemStatusStore.getState().setBackendStatus("offline", "Network error");
        }
      }
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new ApiError(408, null, "Request timeout");
        }
        throw new ApiError(0, null, error.message);
      }
      const status =
        typeof (error as Record<string, unknown>)?.status === "number"
          ? ((error as Record<string, unknown>).status as number)
          : 0;
      const detail = (error as Record<string, unknown>)?.error ?? "Unknown error occurred";
      throw new ApiError(status, detail, "Unknown error occurred");
    }
  }

  protected async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: "GET" });
  }

  protected async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined
    });
  }

  protected async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined
    });
  }

  protected async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: "DELETE" });
  }

  protected async patch<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined
    });
  }

  // Utility methods
  async isAuthenticated(): Promise<boolean> {
    const token = await TokenManager.getAccessToken();
    return !!token;
  }

  async getAuthHeaders(): Promise<HeadersInit> {
    const token = await TokenManager.getAccessToken();
    return {
      Authorization: token ? `Bearer ${token}` : ""
    };
  }
}

// Export token manager for use in other services
export { TokenManager };
