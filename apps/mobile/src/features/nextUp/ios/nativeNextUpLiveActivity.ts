import { NativeEventEmitter, NativeModules, Platform } from "react-native";

export type NextUpLiveActivityPayload = {
  dayKey: string;
  nextTaskId: string;
  title: string;
  taskTitle: string;
  emoji?: string | null;
  completedCount: number;
  totalCount: number;
};

type ActivityPushTokenEvent = {
  activityId: string;
  token: string;
};

type PushToStartTokenEvent = {
  token: string;
};

type NativeNextUpLiveActivityModule = {
  isSupported(): Promise<boolean>;
  getPushToStartToken(): Promise<string | null>;
  startLocal(payload: NextUpLiveActivityPayload): Promise<string | null>;
  updateLocal(payload: NextUpLiveActivityPayload): Promise<void>;
  endLocal(): Promise<void>;
};

const mod: NativeNextUpLiveActivityModule | undefined =
  Platform.OS === "ios" ? (NativeModules.NextUpLiveActivity as any) : undefined;

const emitter = mod ? new NativeEventEmitter(NativeModules.NextUpLiveActivity) : null;

export const nextUpLiveActivity = {
  isSupported: () => mod?.isSupported?.() ?? Promise.resolve(false),
  getPushToStartToken: () => mod?.getPushToStartToken?.() ?? Promise.resolve(null),
  startLocal: (payload: NextUpLiveActivityPayload) =>
    mod?.startLocal?.(payload) ?? Promise.resolve(null),
  updateLocal: (payload: NextUpLiveActivityPayload) =>
    mod?.updateLocal?.(payload) ?? Promise.resolve(),
  endLocal: () => mod?.endLocal?.() ?? Promise.resolve(),
  addPushToStartTokenListener: (listener: (e: PushToStartTokenEvent) => void) =>
    emitter?.addListener("pushToStartToken", listener) ?? ({ remove() {} } as any),
  addActivityPushTokenListener: (listener: (e: ActivityPushTokenEvent) => void) =>
    emitter?.addListener("activityPushToken", listener) ?? ({ remove() {} } as any)
};
