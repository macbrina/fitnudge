import { Platform } from "react-native";

import type { NextUpLiveSurfaceAdapter, LiveSurfaceContent } from "./NextUpLiveSurfaceAdapter";

// Only show banner once per task; skip if we already showed for this (dayKey, nextTaskId).
let lastBannerKey: string | null = null;

// Lazy load the native module so non-iOS builds don't pull in the module.
function getNativeModule(): typeof import("local:next-up-live-activity") | null {
  if (Platform.OS !== "ios") return null;
  try {
    return require("local:next-up-live-activity");
  } catch {
    return null;
  }
}

/**
 * Returns banner fields for AlertConfiguration only when task changes (throttled).
 */
function getBannerFields(content: LiveSurfaceContent): {
  bannerTitle: string;
  bannerBody: string;
} | null {
  const dayKey = content.dayKey ?? "";
  const nextTaskId = content.nextTaskId ?? "";
  const key = `${dayKey}:${nextTaskId}`;
  if (lastBannerKey === key) return null;
  lastBannerKey = key;

  const title = content.title ?? "Today's focus";
  const taskTitle = content.taskTitle ?? content.body ?? "";
  const body = taskTitle ? taskTitle : "Your next task is ready";
  return { bannerTitle: title, bannerBody: body };
}

/**
 * iOS Live Activity adapter (Mode A: in-app).
 * Uses the next-up-live-activity Expo module to start/update/end the Live Activity.
 */
export class IosLiveActivityAdapter implements NextUpLiveSurfaceAdapter {
  async startOrUpdate(content: LiveSurfaceContent): Promise<void> {
    const mod = getNativeModule();
    if (!mod?.areActivitiesEnabled()) return;

    const dayKey = content.dayKey ?? "";
    const nextTaskId = content.nextTaskId ?? "";
    const title = content.title ?? "Today's focus";
    const taskTitle = content.taskTitle ?? content.body ?? "";
    const emoji = content.emoji ?? null;
    const completedCount = content.completedCount ?? 0;
    const totalCount = content.totalCount ?? 1;

    const banner = getBannerFields(content);

    mod.startActivity({
      dayKey,
      nextTaskId,
      title,
      taskTitle,
      emoji,
      completedCount,
      totalCount,
      bannerTitle: banner?.bannerTitle ?? null,
      bannerBody: banner?.bannerBody ?? null
    });
  }

  async end(): Promise<void> {
    lastBannerKey = null;
    const mod = getNativeModule();
    if (mod) mod.endActivity();
  }
}
