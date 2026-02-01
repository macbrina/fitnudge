import { useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";

import { useUserTimezone } from "@/hooks/useUserTimezone";
import { getCachedDeviceInfo, getDeviceInfo } from "@/utils/deviceInfo";
import { liveActivityService } from "@/services/api/liveActivity";

// Use Expo module so we receive native events (React Native NativeEventEmitter doesn't get Expo module events).
const getExpoModule = () => {
  if (Platform.OS !== "ios") return null;
  try {
    return require("local:next-up-live-activity");
  } catch {
    return null;
  }
};

/**
 * Mode B plumbing:
 * - registers push-to-start token (iOS 17.2+) to backend
 * - listens for activity push token updates and uploads them (for remote update/end)
 *
 * Best effort; safe to call globally for authenticated sessions.
 */
export function useLiveActivityRegistration(enabled: boolean) {
  const tz = useUserTimezone();
  const unsubRef = useRef<(() => void) | null>(null);
  const unsub2Ref = useRef<(() => void) | null>(null);
  const [appActiveToken, setAppActiveToken] = useState(0);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") setAppActiveToken((t) => t + 1);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (Platform.OS !== "ios") return;

    const mod = getExpoModule();
    let cancelled = false;

    const run = async () => {
      const deviceInfo = getCachedDeviceInfo() ?? (await getDeviceInfo());
      const device_id = deviceInfo?.device_id;
      if (!device_id || cancelled) return;

      const supported = mod?.areActivitiesEnabled?.() ?? false;

      if (!supported) {
        try {
          await liveActivityService.unregister({
            device_id,
            platform: "ios"
          });
        } catch (e) {
          console.warn("[LiveActivity] unregister failed:", e);
        }
        return;
      }

      if (!mod) return;

      const registerPushToStart = async (token: string) => {
        if (!token || cancelled) return;
        try {
          await liveActivityService.registerPushToStartToken({
            device_id,
            platform: "ios",
            push_to_start_token: token,
            timezone: tz
          });
        } catch (e) {
          console.warn("[LiveActivity] registerPushToStartToken failed:", e);
        }
      };

      const registerActivityToken = async (activityId: string, token: string) => {
        if (!activityId || !token || cancelled) return;
        try {
          await liveActivityService.registerActivityPushToken({
            device_id,
            platform: "ios",
            activity_id: activityId,
            activity_push_token: token,
            timezone: tz
          });
        } catch (e) {
          console.warn("[LiveActivity] registerActivityPushToken failed:", e);
        }
      };

      // Subscribe to token events (must use Expo module emitter so native sendEvent is received).
      unsubRef.current =
        mod.addPushToStartTokenListener?.((e: { token?: string }) => {
          if (e?.token) registerPushToStart(e.token);
        })?.remove ?? (() => {});

      unsub2Ref.current =
        mod.addActivityPushTokenListener?.((e: { activityId?: string; token?: string }) => {
          if (e?.activityId && e?.token) registerActivityToken(e.activityId, e.token);
        })?.remove ?? (() => {});

      // One-shot: get push-to-start token if already available.
      const token = await mod.getPushToStartToken?.().catch(() => null);
      if (token && !cancelled) await registerPushToStart(token);
    };

    run();

    return () => {
      cancelled = true;
      try {
        unsubRef.current?.();
      } catch {}
      try {
        unsub2Ref.current?.();
      } catch {}
      unsubRef.current = null;
      unsub2Ref.current = null;
    };
  }, [enabled, tz, appActiveToken]);
}
