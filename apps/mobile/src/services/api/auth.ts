import { BaseApiService, ApiResponse } from "./base";
import { ROUTES } from "@/lib/routes";
import { getDeviceInfo, getCachedDeviceInfo, DeviceInfo } from "@/utils/deviceInfo";
import { getLocales } from "expo-localization";

// Auth Types
export interface LoginRequest {
  email: string;
  password: string;
  remember_me?: boolean;
  device_info?: DeviceInfo;
}

// Auth response user type (may have fewer fields than User)
export interface AuthUserResponse {
  id: string;
  email: string;
  auth_provider: "email" | "google" | "apple";
  email_verified: boolean;
  username: string;
  name: string;
  timezone: string;
  country?: string;
  plan: "free" | "premium";
  status?: "active" | "disabled" | "suspended";
  created_at: string;
  last_login_at?: string;
  linked_providers?: string[];
  has_password?: boolean;
  motivation_style?: "supportive" | "tough_love" | "calm";
  onboarding_completed_at?: string | null;
  referral_code?: string;
  // These fields may be present but not always returned
  language?: string;
  profile_picture_url?: string;
  bio?: string;
  role?: "user" | "admin";
  morning_motivation_enabled?: boolean;
  updated_at?: string;
}

export interface LoginResponse {
  user: import("./user").User; // Transformed User type
  access_token: string;
  refresh_token: string;
}

/**
 * Transform auth API response user to frontend User type
 * Handles missing fields gracefully by providing defaults
 */
function transformAuthUserResponse(authUser: AuthUserResponse): import("./user").User {
  return {
    id: authUser.id,
    email: authUser.email,
    auth_provider: authUser.auth_provider,
    email_verified: authUser.email_verified,
    username: authUser.username,
    name: authUser.name,
    profile_picture_url: authUser.profile_picture_url,
    bio: authUser.bio,
    timezone: authUser.timezone,
    language: authUser.language || "en", // Default to "en" if missing
    country: authUser.country,
    status: authUser.status || "active", // Default to "active" if missing
    role: authUser.role,
    motivation_style: authUser.motivation_style,
    morning_motivation_enabled: authUser.morning_motivation_enabled,
    plan: authUser.plan,
    referral_code: authUser.referral_code,
    onboarding_completed_at: authUser.onboarding_completed_at,
    created_at: authUser.created_at,
    updated_at: authUser.updated_at || authUser.created_at, // Fallback to created_at if missing
    last_login_at: authUser.last_login_at,
    linked_providers: authUser.linked_providers,
    has_password: authUser.has_password
  };
}

export interface SignupRequest {
  username: string;
  email: string;
  password: string;
  timezone?: string; // Optional IANA timezone string (e.g., 'America/New_York'), defaults to device timezone if not provided
  country?: string; // Optional ISO 3166-1 alpha-2 code (e.g., 'US', 'NG'), defaults to device locale region
  referral_code?: string; // Optional referral code of the user who referred them
  device_info?: DeviceInfo;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface RefreshTokenResponse {
  access_token: string;
  refresh_token: string;
}

export interface GoogleLoginPayload {
  id_token: string;
}

export interface AppleLoginPayload {
  identityToken: string;
  authorizationCode: string;
  email?: string;
  fullName?: {
    givenName?: string;
    familyName?: string;
  };
}

export interface LinkAccountResponse {
  message: string;
  user: AuthUserResponse;
}

// Auth Service
export class AuthService extends BaseApiService {
  async login(credentials: LoginRequest): Promise<ApiResponse<LoginResponse>> {
    // Get device info for session tracking
    const deviceInfo = getCachedDeviceInfo() || (await getDeviceInfo());

    const response = await this.post<{
      user: AuthUserResponse;
      access_token: string;
      refresh_token: string;
    }>(ROUTES.AUTH.LOGIN, {
      ...credentials,
      device_info: deviceInfo
    });

    // Transform the response to match LoginResponse with transformed user
    if (response.data) {
      const { TokenManager } = await import("./base");
      await TokenManager.setTokens(response.data.access_token, response.data.refresh_token);

      return {
        ...response,
        data: {
          user: transformAuthUserResponse(response.data.user),
          access_token: response.data.access_token,
          refresh_token: response.data.refresh_token
        }
      };
    }

    return response as ApiResponse<LoginResponse>;
  }

  async signup(userData: SignupRequest): Promise<ApiResponse<LoginResponse>> {
    // Use device timezone if not provided
    const timezone = userData.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Use device locale region for country if not provided
    // getLocales() returns array of locale objects with regionCode (ISO 3166-1 alpha-2)
    const locales = getLocales();
    const country = userData.country || locales[0]?.regionCode || undefined;

    // Get device info for session tracking
    const deviceInfo = getCachedDeviceInfo() || (await getDeviceInfo());

    const response = await this.post<{
      user: AuthUserResponse;
      access_token: string;
      refresh_token: string;
    }>(ROUTES.AUTH.SIGNUP, {
      ...userData,
      // Backend requires 'name'; use username as display name if not collected separately
      name: userData.username,
      timezone: timezone,
      country: country,
      // Include referral code if provided
      referral_code: userData.referral_code || undefined,
      // Include device info for session tracking
      device_info: deviceInfo
    });

    // Transform the response to match LoginResponse with transformed user
    if (response.data) {
      const { TokenManager } = await import("./base");
      await TokenManager.setTokens(response.data.access_token, response.data.refresh_token);

      return {
        ...response,
        data: {
          user: transformAuthUserResponse(response.data.user),
          access_token: response.data.access_token,
          refresh_token: response.data.refresh_token
        }
      };
    }

    return response as ApiResponse<LoginResponse>;
  }

  async logout(): Promise<ApiResponse> {
    const response = await this.post(ROUTES.AUTH.LOGOUT);
    const { TokenManager } = await import("./base");
    await TokenManager.clearTokens();
    return response;
  }

  async refreshToken(): Promise<ApiResponse<RefreshTokenResponse>> {
    const { TokenManager } = await import("./base");

    // Use global token cache for fast access
    // If cache is not initialized, fallback to storage
    const refreshToken =
      global.refreshToken !== undefined
        ? global.refreshToken
        : await TokenManager.getRefreshToken();

    if (!refreshToken) {
      return {
        status: 401,
        error: "No refresh token available"
      };
    }

    const response = await this.post<RefreshTokenResponse>(ROUTES.AUTH.REFRESH, {
      refresh_token: refreshToken
    });

    if (response.data) {
      // Use the new refresh_token from the response (token rotation)
      // or fall back to the current one if not provided
      const newRefreshToken =
        response.data.refresh_token || (await TokenManager.getRefreshToken()) || "";

      // Update tokens in TokenManager
      await TokenManager.setTokens(response.data.access_token, newRefreshToken);

      // Update tokens in authStore if available
      try {
        const { useAuthStore } = await import("@/stores/authStore");
        const authStore = useAuthStore.getState();
        if (authStore.user) {
          useAuthStore.setState({
            accessToken: response.data.access_token,
            refreshToken: newRefreshToken
          });
        }
      } catch (error) {
        // AuthStore might not be available in some contexts, ignore
        console.warn("[Auth] Could not update authStore during token refresh:", error);
      }
    }

    return response;
  }

  async forgotPassword(email: string): Promise<ApiResponse> {
    return this.post(ROUTES.AUTH.FORGOT_PASSWORD, { email });
  }

  async resetPassword(token: string, newPassword: string): Promise<ApiResponse> {
    return this.post(ROUTES.AUTH.RESET_PASSWORD, {
      token,
      new_password: newPassword
    });
  }

  async validateResetToken(token: string): Promise<ApiResponse<{ valid: boolean }>> {
    return this.post(ROUTES.AUTH.VALIDATE_RESET_TOKEN, { token });
  }

  async loginWithGoogle(
    idToken: string,
    referralCode?: string
  ): Promise<ApiResponse<LoginResponse>> {
    // Get device info for session tracking
    const deviceInfo = getCachedDeviceInfo() || (await getDeviceInfo());

    // Send device timezone/country so new users get accurate locale (same as email signup)
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const locales = getLocales();
    const country = locales[0]?.regionCode || undefined;

    const response = await this.post<{
      user: AuthUserResponse;
      access_token: string;
      refresh_token: string;
    }>(ROUTES.AUTH.OAUTH.GOOGLE, {
      id_token: idToken,
      device_info: deviceInfo,
      referral_code: referralCode || undefined,
      timezone,
      country
    });

    // Transform the response to match LoginResponse with transformed user
    if (response.data) {
      const { TokenManager } = await import("./base");
      await TokenManager.setTokens(response.data.access_token, response.data.refresh_token);

      return {
        ...response,
        data: {
          user: transformAuthUserResponse(response.data.user),
          access_token: response.data.access_token,
          refresh_token: response.data.refresh_token
        }
      };
    }

    return response as ApiResponse<LoginResponse>;
  }

  async loginWithApple(
    payload: AppleLoginPayload,
    referralCode?: string
  ): Promise<ApiResponse<LoginResponse>> {
    // Get device info for session tracking
    const deviceInfo = getCachedDeviceInfo() || (await getDeviceInfo());

    // Send device timezone/country so new users get accurate locale (same as email signup)
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const locales = getLocales();
    const country = locales[0]?.regionCode || undefined;

    const response = await this.post<{
      user: AuthUserResponse;
      access_token: string;
      refresh_token: string;
    }>(ROUTES.AUTH.OAUTH.APPLE, {
      identity_token: payload.identityToken,
      authorization_code: payload.authorizationCode,
      email: payload.email,
      full_name: payload.fullName,
      device_info: deviceInfo,
      referral_code: referralCode || undefined,
      timezone,
      country
    });

    // Transform the response to match LoginResponse with transformed user
    if (response.data) {
      const { TokenManager } = await import("./base");
      await TokenManager.setTokens(response.data.access_token, response.data.refresh_token);

      return {
        ...response,
        data: {
          user: transformAuthUserResponse(response.data.user),
          access_token: response.data.access_token,
          refresh_token: response.data.refresh_token
        }
      };
    }

    return response as ApiResponse<LoginResponse>;
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse> {
    return this.post(ROUTES.USERS.CHANGE_PASSWORD, {
      current_password: currentPassword,
      new_password: newPassword
    });
  }

  async verifyEmail(code: string, email?: string): Promise<ApiResponse> {
    const payload = email ? { email, code } : { code };
    return this.post(ROUTES.AUTH.VERIFY_EMAIL, payload);
  }

  async resendVerification(email?: string): Promise<ApiResponse> {
    const payload = email ? { email } : {};
    return this.post(ROUTES.AUTH.RESEND_VERIFICATION, payload);
  }

  async isAuthenticated(): Promise<boolean> {
    const { TokenManager } = await import("./base");
    const accessToken = await TokenManager.getAccessToken();
    return !!accessToken;
  }

  async setRememberMePreference(email: string, remember: boolean): Promise<void> {
    const { TokenManager } = await import("./base");
    if (remember) {
      await TokenManager.setRememberMeEmail(email);
      await TokenManager.setRememberMeEnabled(true);
    } else {
      await TokenManager.clearRememberMe();
    }
  }

  async getRememberMePreference(): Promise<{
    email: string;
    enabled: boolean;
  } | null> {
    const { TokenManager } = await import("./base");
    const email = await TokenManager.getRememberMeEmail();
    const enabled = await TokenManager.getRememberMeEnabled();

    if (email && enabled) {
      return { email, enabled: true };
    }
    return null;
  }

  // ============================================================================
  // Account Linking Methods
  // ============================================================================

  async linkWithGoogle(idToken: string): Promise<ApiResponse<LinkAccountResponse>> {
    return this.post<LinkAccountResponse>(ROUTES.AUTH.LINK.GOOGLE, {
      id_token: idToken
    });
  }

  async linkWithApple(params: {
    identityToken: string;
    authorizationCode?: string;
  }): Promise<ApiResponse<LinkAccountResponse>> {
    return this.post<LinkAccountResponse>(ROUTES.AUTH.LINK.APPLE, {
      identity_token: params.identityToken,
      authorization_code: params.authorizationCode
    });
  }

  async unlinkProvider(provider: "google" | "apple"): Promise<ApiResponse<LinkAccountResponse>> {
    return this.delete<LinkAccountResponse>(ROUTES.AUTH.UNLINK(provider));
  }

  // ============================================================================
  // Password Management Methods
  // ============================================================================

  /**
   * Set a password for OAuth users who don't have one yet.
   * This is different from change-password which requires the current password.
   */
  async setPassword(newPassword: string): Promise<ApiResponse<LinkAccountResponse>> {
    return this.post<LinkAccountResponse>(ROUTES.AUTH.SET_PASSWORD, {
      new_password: newPassword
    });
  }
}

// Export singleton instance
export const authService = new AuthService();
