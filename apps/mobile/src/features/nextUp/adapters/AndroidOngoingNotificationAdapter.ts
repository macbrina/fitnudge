import * as Notifications from "expo-notifications";
import type { NextUpLiveSurfaceAdapter, LiveSurfaceContent } from "./NextUpLiveSurfaceAdapter";
import {
  clearAndroidNotificationId,
  loadNextUpPersistedState,
  persistAndroidNotificationId
} from "../storage";

const NEXT_UP_NOTIFICATION_ID = "next-up-ongoing";

/**
 * Best-effort "ongoing" notification using expo-notifications:
 * - sticky: true => user cannot swipe it away (only app can dismiss)
 * - autoDismiss: false => tapping doesn't clear it
 *
 * Note: Requires notification permission (Android 13+).
 */
export class AndroidOngoingNotificationAdapter implements NextUpLiveSurfaceAdapter {
  private channelReady = false;

  private async ensureChannel(): Promise<void> {
    if (this.channelReady) return;
    try {
      await Notifications.setNotificationChannelAsync("next-up", {
        name: "Next up",
        importance: Notifications.AndroidImportance.LOW,
        sound: null,
        vibrationPattern: [],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC
      });
      this.channelReady = true;
    } catch (e) {
      // Non-fatal: if channel setup fails, presenting may still work via default channel.
      console.warn("[NextUp] Failed to set Android notification channel:", e);
    }
  }

  async startOrUpdate(content: LiveSurfaceContent): Promise<void> {
    await this.ensureChannel();

    try {
      // Dismiss/cancel first to avoid stacking. We use a stable ID so this works
      // even if AsyncStorage was cleared.
      await Notifications.dismissNotificationAsync(NEXT_UP_NOTIFICATION_ID);
      await Notifications.cancelScheduledNotificationAsync(NEXT_UP_NOTIFICATION_ID);
      await clearAndroidNotificationId();

      const id = await Notifications.scheduleNotificationAsync({
        identifier: NEXT_UP_NOTIFICATION_ID,
        content: {
          title: content.title,
          body: content.body,
          sticky: true,
          autoDismiss: false,
          // Keep it visually calm; this is persistent state, not an alert.
          priority: Notifications.AndroidNotificationPriority.LOW,
          sound: "notification_sound.wav"
        },
        // Channel-aware immediate trigger (Android).
        trigger: { channelId: "next-up" }
      });

      await persistAndroidNotificationId(id);
    } catch (e) {
      // If permissions are missing or expo-notifications isn't ready, don't crash.
      console.warn("[NextUp] Failed to present Android Next up notification:", e);
    }
  }

  async end(): Promise<void> {
    try {
      const existing = await loadNextUpPersistedState();
      const id = existing.androidNotificationId ?? NEXT_UP_NOTIFICATION_ID;
      await Notifications.dismissNotificationAsync(id);
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch (e) {
      console.warn("[NextUp] Failed to dismiss Android Next up notification:", e);
    } finally {
      await clearAndroidNotificationId();
    }
  }
}
