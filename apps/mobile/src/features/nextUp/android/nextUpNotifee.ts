import notifee, { AndroidImportance, EventType, type Event } from "@notifee/react-native";

export const NEXT_UP_NOTIFICATION_ID = "next-up-ongoing";
export const NEXT_UP_CHANNEL_ID = "next-up";

export async function ensureNextUpChannel(): Promise<void> {
  try {
    await notifee.createChannel({
      id: NEXT_UP_CHANNEL_ID,
      name: "Next up",
      importance: AndroidImportance.LOW
    });
  } catch {
    // Non-fatal.
  }
}

export type NextUpNotificationContent = {
  title: string;
  taskTitle: string;
  completedCount: number;
  totalCount: number;
  emoji?: string | null;
};

export async function showOrUpdateNextUpNotification(
  content: NextUpNotificationContent
): Promise<void> {
  await ensureNextUpChannel();

  const progress =
    content.totalCount > 0 ? ` (${content.completedCount}/${content.totalCount})` : "";
  const body = `${content.taskTitle}${progress}`;

  try {
    await notifee.displayNotification({
      id: NEXT_UP_NOTIFICATION_ID,
      title: content.title,
      body,
      android: {
        channelId: NEXT_UP_CHANNEL_ID,
        ongoing: true,
        autoCancel: false,
        // Best effort: use default launcher icon if no dedicated small icon exists.
        smallIcon: "ic_launcher",
        pressAction: { id: "default" }
      }
    });
  } catch {
    // Non-fatal: permission missing, or OS rejected.
  }
}

export async function endNextUpNotification(): Promise<void> {
  try {
    await notifee.cancelNotification(NEXT_UP_NOTIFICATION_ID);
  } catch {
    // Non-fatal.
  }
}

// Kept minimal; app routing is handled when the app is opened.
export async function onNotifeeBackgroundEvent(event: Event): Promise<void> {
  if (event.type === EventType.PRESS) {
    // no-op
  }
}
