import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TokenManager } from "@/services/api/base";
import { authService } from "@/services/api/auth";
import { notificationService } from "@/services/notifications/notificationService";
import { clearQueryCache } from "@/lib/queryClient";

interface User {
  id: string;
  email: string;
  auth_provider: "email" | "google" | "apple";
  email_verified: boolean;

  // Profile
  username: string;
  name: string;
  profile_picture_url?: string;
  bio?: string;
  timezone: string;
  language: string;
  country?: string;

  // Status
  status: "active" | "disabled" | "suspended";

  // V2 Preferences
  motivation_style?: "supportive" | "tough_love" | "calm";
  morning_motivation_enabled?: boolean;
  morning_motivation_time?: string; // HH:MM format

  // Subscription
  plan: "free" | "premium";

  // Referral
  referral_code?: string;

  // Onboarding
  onboarding_completed_at?: string | null;

  // Metadata
  created_at: string;
  last_login_at?: string;

  // Computed
  linked_providers?: string[];
  has_password?: boolean;
}

export type LogoutReason = "not_found" | "disabled" | "suspended" | null;

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isLoggingOut: boolean;
  isVerifyingUser: boolean; // Prevents services from initializing during user verification
  logoutReason: LogoutReason;
}

interface AuthActions {
  login: (user: User, accessToken: string, refreshToken: string) => Promise<void>;
  logout: (reason?: LogoutReason) => Promise<boolean>;
  updateUser: (user: Partial<User>) => void;
  setLoading: (loading: boolean) => void;
  setVerifyingUser: (verifying: boolean) => void;
  clearLogoutReason: () => void;
}

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set, get) => ({
      // State
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      isLoggingOut: false,
      isVerifyingUser: true,
      logoutReason: null,

      // Actions
      login: async (user, accessToken, refreshToken) => {
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
          isLoading: false,
          isLoggingOut: false
        });

        // Store tokens securely using TokenManager
        await TokenManager.setTokens(accessToken, refreshToken);
      },

      logout: async (reason) => {
        if (get().isLoggingOut) {
          return false;
        }

        // IMMEDIATELY mark as not authenticated and logging out
        // This prevents race conditions where other code checks isAuthenticated
        set({
          isLoggingOut: true,
          isAuthenticated: false,
          user: null,
          accessToken: null,
          refreshToken: null
        });

        // Clear tokens from cache immediately
        await TokenManager.clearTokens();

        // Clear React Query cache to prevent data leakage between users
        clearQueryCache();

        // Clear all user-specific stores to prevent data leakage
        try {
          // Dynamic imports to avoid circular dependencies
          const [
            { useOnboardingStore },
            { useAICoachStore },
            { useSubscriptionStore },
            { storageUtil }
          ] = await Promise.all([
            import("@/stores/onboardingStore"),
            import("@/stores/aiCoachStore"),
            import("@/stores/subscriptionStore"),
            import("@/utils/storageUtil")
          ]);

          // Reset Zustand stores (in-memory + persisted)
          useOnboardingStore.getState().reset();
          useAICoachStore.getState().resetState();
          useSubscriptionStore.getState().reset();

          // Clear user-specific AsyncStorage data (personalization, exit offers, etc.)
          await storageUtil.clearUserSpecificData();
        } catch (storeError) {
          console.warn("[AuthStore] Failed to reset user stores during logout:", storeError);
        }

        let success = false;

        try {
          if (reason !== "not_found") {
            try {
              // Unregister device from backend (preserves local notifications & preferences)
              // Device will auto-register on next app startup when user logs back in
              await notificationService.clearOnLogout();
            } catch (notificationError) {
              console.warn(
                "[AuthStore] Failed to unregister device during logout:",
                notificationError
              );
            }

            const response = await authService.logout();
            if (response.status >= 200 && response.status < 400) {
              success = true;
            } else if (response.status === 401) {
              // Treat missing/expired session as logged out
              success = true;
            } else {
              console.warn(
                `[AuthStore] Logout request returned status ${response.status}: ${response.error}`
              );
            }
          }
        } catch (error) {
          // treat as success
          success = true;
        } finally {
          try {
            await TokenManager.clearRememberMe();
          } catch (tokenError) {
            console.warn("[AuthStore] Failed to clear remember me during logout:", tokenError);
          }

          // Ensure state is cleared (already done above, but confirm)
          set({
            isLoading: false,
            isLoggingOut: false,
            logoutReason: reason || null
          });
        }

        return success;
      },

      updateUser: (userData) => {
        const currentUser = get().user;
        if (currentUser) {
          set({
            user: { ...currentUser, ...userData }
          });
        }
      },

      setLoading: (loading) => {
        set({ isLoading: loading });
      },

      setVerifyingUser: (verifying) => {
        set({ isVerifyingUser: verifying });
      },

      clearLogoutReason: () => {
        set({ logoutReason: null });
      }
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        logoutReason: state.logoutReason
      })
    }
  )
);
