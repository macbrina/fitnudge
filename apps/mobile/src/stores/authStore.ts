import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TokenManager } from "@/services/api/base";

interface User {
  id: string;
  email: string;
  name: string;
  username: string;
  plan: string;
  timezone: string; // IANA timezone string (e.g., 'America/New_York')
  email_verified: boolean;
  auth_provider: string;
  created_at: string;
}

export type LogoutReason = "not_found" | "disabled" | "suspended" | null;

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  logoutReason: LogoutReason;
}

interface AuthActions {
  login: (
    user: User,
    accessToken: string,
    refreshToken: string
  ) => Promise<void>;
  logout: (reason?: LogoutReason) => Promise<void>;
  updateUser: (user: Partial<User>) => void;
  setLoading: (loading: boolean) => void;
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
      logoutReason: null,

      // Actions
      login: async (user, accessToken, refreshToken) => {
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
          isLoading: false,
        });

        // Store tokens securely using TokenManager
        await TokenManager.setTokens(accessToken, refreshToken);
      },

      logout: async (reason?: LogoutReason) => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
          logoutReason: reason || null,
        });

        // Clear stored tokens and remember me preferences
        await TokenManager.clearTokens();
        await TokenManager.clearRememberMe();
      },

      updateUser: (userData) => {
        const currentUser = get().user;
        if (currentUser) {
          set({
            user: { ...currentUser, ...userData },
          });
        }
      },

      setLoading: (loading) => {
        set({ isLoading: loading });
      },

      clearLogoutReason: () => {
        set({ logoutReason: null });
      },
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        logoutReason: state.logoutReason,
      }),
    }
  )
);
