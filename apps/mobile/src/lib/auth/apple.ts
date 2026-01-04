import * as AppleAuthentication from "expo-apple-authentication";

export const isAppleSigninAvailable = async (): Promise<boolean> => {
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch (error) {
    return false;
  }
};

export const isAppleCancelledError = (error: unknown): boolean => {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return false;
  }

  const code = String((error as any).code || "").toLowerCase();
  return code === "err_canceled" || code === "canceled";
};

export const performNativeAppleSignIn = async () => {
  return AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL
    ]
  });
};
