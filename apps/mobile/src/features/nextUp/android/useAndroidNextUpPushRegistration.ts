import { useEffect, useRef } from "react";
import { Platform } from "react-native";

import messaging from "@react-native-firebase/messaging";

import { useUserTimezone } from "@/hooks/useUserTimezone";
import { getCachedDeviceInfo, getDeviceInfo } from "@/utils/deviceInfo";
import { nextUpPushService } from "@/services/api/nextUpPush";

/**
 * Mode B (Android):
 * - registers FCM token to backend
 * - enables server-driven ongoing NextUp notifications via background data messages
 */
export function useAndroidNextUpPushRegistration(enabled: boolean) {
  const tz = useUserTimezone();
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (Platform.OS !== "android") return;

    let cancelled = false;

    const run = async () => {
      // Ensure FCM is ready.
      await messaging()
        .registerDeviceForRemoteMessages()
        .catch(() => {});

      const deviceInfo = getCachedDeviceInfo() ?? (await getDeviceInfo());
      const device_id = deviceInfo.device_id;

      const upload = async (token: string | null | undefined) => {
        if (!token || cancelled) return;
        await nextUpPushService
          .registerFcmToken({
            device_id,
            platform: "android",
            fcm_token: token,
            timezone: tz
          })
          .catch(() => {});
      };

      // Initial token
      await upload(
        await messaging()
          .getToken()
          .catch(() => null)
      );

      // Refresh token updates
      unsubRef.current = messaging().onTokenRefresh((t) => {
        upload(t);
      });
    };

    run().catch(() => {});

    return () => {
      cancelled = true;
      try {
        unsubRef.current?.();
      } catch {}
      unsubRef.current = null;
    };
  }, [enabled, tz]);
}
