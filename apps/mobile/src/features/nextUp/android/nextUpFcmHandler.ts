import type { FirebaseMessagingTypes } from "@react-native-firebase/messaging";

import { endNextUpNotification, showOrUpdateNextUpNotification } from "./nextUpNotifee";

type NextUpFcmAction = "start" | "update" | "end";

type NextUpFcmData = {
  type?: string;
  action?: NextUpFcmAction;
  dayKey?: string;
  nextTaskId?: string;
  taskTitle?: string;
  emoji?: string;
  completedCount?: string;
  totalCount?: string;
};

function parseIntSafe(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function isValidDayKey(v: string): boolean {
  // YYYY-MM-DD
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export async function handleNextUpFcmMessage(
  message: FirebaseMessagingTypes.RemoteMessage
): Promise<void> {
  const data = (message.data ?? {}) as NextUpFcmData;
  if (data.type !== "nextup") return;

  const action = data.action;
  if (action !== "start" && action !== "update" && action !== "end") return;

  if (action === "end") {
    await endNextUpNotification();
    return;
  }

  if (!data.dayKey || !isValidDayKey(data.dayKey)) return;
  if (!data.nextTaskId) return;
  if (!data.taskTitle) return;

  const completedCount = parseIntSafe(data.completedCount);
  const totalCount = parseIntSafe(data.totalCount);
  if (completedCount == null || totalCount == null) return;

  // Safe behavior: if server says everything is done, end/don’t show.
  if (totalCount <= 0 || completedCount >= totalCount) {
    await endNextUpNotification();
    return;
  }

  await showOrUpdateNextUpNotification({
    title: "Next up",
    taskTitle: data.taskTitle,
    emoji: data.emoji ?? null,
    completedCount,
    totalCount
  });
}
