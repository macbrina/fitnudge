import { Platform } from "react-native";
import Constants from "expo-constants";
import {
  GoogleSignin,
  statusCodes,
  isErrorWithCode,
} from "@react-native-google-signin/google-signin";

type GoogleSignInResult = {
  idToken: string;
  serverAuthCode?: string | null;
};

let isConfigured = false;

type ExpoGoogleConfig = {
  iosClientId?: string;
  androidClientId?: string;
  webClientId?: string;
  iosUrlScheme?: string;
};

const getExpoGoogleConfig = (): ExpoGoogleConfig => {
  const extra = Constants.expoConfig?.extra as
    | { [key: string]: any }
    | undefined;
  return (extra?.googleSignIn ?? {}) as ExpoGoogleConfig;
};

export const hasGoogleSignInConfiguration = (): boolean => {
  const googleConfig = getExpoGoogleConfig();
  return (
    !!googleConfig.iosClientId ||
    !!googleConfig.androidClientId ||
    !!googleConfig.webClientId
  );
};

const configureGoogleSignin = () => {
  if (isConfigured) return;

  const googleConfig = getExpoGoogleConfig();

  GoogleSignin.configure({
    iosClientId: googleConfig.iosClientId,
    webClientId: googleConfig.webClientId,
    forceCodeForRefreshToken: false,
  });

  isConfigured = true;
};

export const isGoogleCancelledError = (error: unknown): boolean => {
  if (!isErrorWithCode(error)) return false;
  return (
    error.code === statusCodes.SIGN_IN_CANCELLED ||
    error.code === statusCodes.IN_PROGRESS
  );
};

export const getFriendlyGoogleError = (error: unknown): string => {
  if (!isErrorWithCode(error)) {
    return "Google Sign-In failed. Please try again.";
  }

  switch (error.code) {
    case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
      return "Google Play Services are not available or need to be updated.";
    case statusCodes.IN_PROGRESS:
      return "Google Sign-In is already in progress.";
    case statusCodes.SIGN_IN_CANCELLED:
      return "Google Sign-In was cancelled.";
    default:
      return error.message || "Google Sign-In failed. Please try again.";
  }
};

export const performNativeGoogleSignIn =
  async (): Promise<GoogleSignInResult> => {
    configureGoogleSignin();

    if (Platform.OS === "android") {
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });
    }

    const userInfo = await GoogleSignin.signIn();
    const { idToken, serverAuthCode } = userInfo as {
      idToken?: string | null;
      serverAuthCode?: string | null;
    };

    if (!idToken) {
      throw new Error("Google Sign-In did not return an ID token.");
    }

    return {
      idToken,
      serverAuthCode,
    };
  };
