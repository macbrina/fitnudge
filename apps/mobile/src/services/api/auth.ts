import { BaseApiService, ApiResponse } from "./base";
import { ROUTES } from "@/lib/routes";
import {
  getDeviceInfo,
  getCachedDeviceInfo,
  DeviceInfo,
} from "@/utils/deviceInfo";

// Auth Types
export interface LoginRequest {
  email: string;
  password: string;
  remember_me?: boolean;
  device_info?: DeviceInfo;
}

export interface LoginResponse {
  user: {
    id: string;
    email: string;
    name: string;
    username: string;
    plan: string;
    timezone: string;
    email_verified: boolean;
    auth_provider: string;
    created_at: string;
    linked_providers?: string[];
  };
  access_token: string;
  refresh_token: string;
}

export interface SignupRequest {
  username: string;
  email: string;
  password: string;
  timezone?: string; // Optional IANA timezone string (e.g., 'America/New_York'), defaults to device timezone if not provided
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

// Auth Service
export class AuthService extends BaseApiService {
  async login(credentials: LoginRequest): Promise<ApiResponse<LoginResponse>> {
    // Get device info for session tracking
    const deviceInfo = getCachedDeviceInfo() || (await getDeviceInfo());

    const response = await this.post<LoginResponse>(ROUTES.AUTH.LOGIN, {
      ...credentials,
      device_info: deviceInfo,
    });

    if (response.data) {
      const { TokenManager } = await import("./base");
      await TokenManager.setTokens(
        response.data.access_token,
        response.data.refresh_token
      );
    }

    return response;
  }

  async signup(userData: SignupRequest): Promise<ApiResponse<LoginResponse>> {
    // Use device timezone if not provided
    const timezone =
      userData.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Get device info for session tracking
    const deviceInfo = getCachedDeviceInfo() || (await getDeviceInfo());

    const response = await this.post<LoginResponse>(ROUTES.AUTH.SIGNUP, {
      ...userData,
      // Backend requires 'name'; use username as display name if not collected separately
      name: userData.username,
      timezone: timezone,
      // Include referral code if provided
      referral_code: userData.referral_code || undefined,
      // Include device info for session tracking
      device_info: deviceInfo,
    });

    if (response.data) {
      const { TokenManager } = await import("./base");
      await TokenManager.setTokens(
        response.data.access_token,
        response.data.refresh_token
      );
    }

    return response;
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
        error: "No refresh token available",
      };
    }

    const response = await this.post<RefreshTokenResponse>(
      ROUTES.AUTH.REFRESH,
      {
        refresh_token: refreshToken,
      }
    );

    if (response.data) {
      // Use the new refresh_token from the response (token rotation)
      // or fall back to the current one if not provided
      const newRefreshToken =
        response.data.refresh_token ||
        (await TokenManager.getRefreshToken()) ||
        "";

      // Update tokens in TokenManager
      await TokenManager.setTokens(response.data.access_token, newRefreshToken);

      // Update tokens in authStore if available
      try {
        const { useAuthStore } = await import("@/stores/authStore");
        const authStore = useAuthStore.getState();
        if (authStore.user) {
          useAuthStore.setState({
            accessToken: response.data.access_token,
            refreshToken: newRefreshToken,
          });
        }
      } catch (error) {
        // AuthStore might not be available in some contexts, ignore
        console.warn(
          "[Auth] Could not update authStore during token refresh:",
          error
        );
      }
    }

    return response;
  }

  async forgotPassword(email: string): Promise<ApiResponse> {
    return this.post(ROUTES.AUTH.FORGOT_PASSWORD, { email });
  }

  async resetPassword(
    token: string,
    newPassword: string
  ): Promise<ApiResponse> {
    return this.post(ROUTES.AUTH.RESET_PASSWORD, {
      token,
      new_password: newPassword,
    });
  }

  async validateResetToken(
    token: string
  ): Promise<ApiResponse<{ valid: boolean }>> {
    return this.post(ROUTES.AUTH.VALIDATE_RESET_TOKEN, { token });
  }

  async loginWithGoogle(
    idToken: string,
    referralCode?: string
  ): Promise<ApiResponse<LoginResponse>> {
    // Get device info for session tracking
    const deviceInfo = getCachedDeviceInfo() || (await getDeviceInfo());

    const response = await this.post<LoginResponse>(ROUTES.AUTH.OAUTH.GOOGLE, {
      id_token: idToken,
      device_info: deviceInfo,
      referral_code: referralCode || undefined,
    });

    if (response.data) {
      const { TokenManager } = await import("./base");
      await TokenManager.setTokens(
        response.data.access_token,
        response.data.refresh_token
      );
    }

    return response;
  }

  async loginWithApple(
    payload: AppleLoginPayload,
    referralCode?: string
  ): Promise<ApiResponse<LoginResponse>> {
    // Get device info for session tracking
    const deviceInfo = getCachedDeviceInfo() || (await getDeviceInfo());

    const response = await this.post<LoginResponse>(ROUTES.AUTH.OAUTH.APPLE, {
      identity_token: payload.identityToken,
      authorization_code: payload.authorizationCode,
      email: payload.email,
      full_name: payload.fullName,
      device_info: deviceInfo,
      referral_code: referralCode || undefined,
    });

    if (response.data) {
      const { TokenManager } = await import("./base");
      await TokenManager.setTokens(
        response.data.access_token,
        response.data.refresh_token
      );
    }

    return response;
  }

  async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<ApiResponse> {
    return this.post(ROUTES.USERS.CHANGE_PASSWORD, {
      current_password: currentPassword,
      new_password: newPassword,
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

  async setRememberMePreference(
    email: string,
    remember: boolean
  ): Promise<void> {
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
}

// Export singleton instance
export const authService = new AuthService();
