import { storageUtil } from "@/utils/storageUtil";

const STORAGE_KEYS_NEXT_UP = {
  SHOWN_TASK_ID: "next_up_shown_task_id",
  SHOWN_DAY_KEY: "next_up_shown_day_key",
  ANDROID_NOTIFICATION_ID: "next_up_android_notification_id"
} as const;

export type NextUpPersistedState = {
  shownTaskId: string | null;
  shownDayKey: string | null;
  androidNotificationId: string | null;
};

export async function loadNextUpPersistedState(): Promise<NextUpPersistedState> {
  const [shownTaskId, shownDayKey, androidNotificationId] = await Promise.all([
    storageUtil.getItem<string>(STORAGE_KEYS_NEXT_UP.SHOWN_TASK_ID),
    storageUtil.getItem<string>(STORAGE_KEYS_NEXT_UP.SHOWN_DAY_KEY),
    storageUtil.getItem<string>(STORAGE_KEYS_NEXT_UP.ANDROID_NOTIFICATION_ID)
  ]);

  return {
    shownTaskId: shownTaskId ?? null,
    shownDayKey: shownDayKey ?? null,
    androidNotificationId: androidNotificationId ?? null
  };
}

export async function persistShownTask(opts: { dayKey: string; taskId: string }): Promise<void> {
  await Promise.all([
    storageUtil.setItem(STORAGE_KEYS_NEXT_UP.SHOWN_TASK_ID, opts.taskId),
    storageUtil.setItem(STORAGE_KEYS_NEXT_UP.SHOWN_DAY_KEY, opts.dayKey)
  ]);
}

export async function clearShownTask(): Promise<void> {
  await Promise.all([
    storageUtil.removeItem(STORAGE_KEYS_NEXT_UP.SHOWN_TASK_ID),
    storageUtil.removeItem(STORAGE_KEYS_NEXT_UP.SHOWN_DAY_KEY)
  ]);
}

export async function persistAndroidNotificationId(id: string): Promise<void> {
  await storageUtil.setItem(STORAGE_KEYS_NEXT_UP.ANDROID_NOTIFICATION_ID, id);
}

export async function clearAndroidNotificationId(): Promise<void> {
  await storageUtil.removeItem(STORAGE_KEYS_NEXT_UP.ANDROID_NOTIFICATION_ID);
}
