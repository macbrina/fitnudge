import type { NextUpLiveActivityPayload } from "./src/NextUpLiveActivity.types";
import NativeModule, { emitter } from "./src/NextUpLiveActivityModule";

export type PushToStartTokenEvent = { token: string };
export type ActivityPushTokenEvent = { activityId: string; token: string };

type Subscription = { remove(): void };
const emitterWithListeners = emitter as {
  addListener(event: string, listener: (e: unknown) => void): Subscription;
};

export function areActivitiesEnabled(): boolean {
  return NativeModule.areActivitiesEnabled();
}

export function startActivity(payload: NextUpLiveActivityPayload): boolean {
  return NativeModule.startActivity(
    payload.dayKey,
    payload.nextTaskId,
    payload.title,
    payload.taskTitle,
    payload.emoji ?? null,
    payload.completedCount,
    payload.totalCount,
    payload.bannerTitle ?? null,
    payload.bannerBody ?? null
  );
}

export function updateActivity(payload: NextUpLiveActivityPayload): void {
  NativeModule.updateActivity(
    payload.dayKey,
    payload.nextTaskId,
    payload.title,
    payload.taskTitle,
    payload.emoji ?? null,
    payload.completedCount,
    payload.totalCount,
    payload.bannerTitle ?? null,
    payload.bannerBody ?? null
  );
}

export function endActivity(): void {
  NativeModule.endActivity();
}

export function getPushToStartToken(): Promise<string | null> {
  return NativeModule.getPushToStartToken();
}

export function addPushToStartTokenListener(listener: (e: PushToStartTokenEvent) => void) {
  return emitterWithListeners.addListener("pushToStartToken", listener as (e: unknown) => void);
}

export function addActivityPushTokenListener(listener: (e: ActivityPushTokenEvent) => void) {
  return emitterWithListeners.addListener("activityPushToken", listener as (e: unknown) => void);
}

export type { NextUpLiveActivityPayload } from "./src/NextUpLiveActivity.types";
