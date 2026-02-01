import { BaseApiService, ApiResponse } from "./base";
import { ROUTES } from "@/lib/routes";

export type RegisterPushToStartTokenRequest = {
  device_id: string;
  platform: "ios";
  push_to_start_token: string;
  timezone?: string;
};

export type RegisterActivityPushTokenRequest = {
  device_id: string;
  platform: "ios";
  activity_id: string;
  activity_push_token: string;
  timezone?: string;
};

export type UnregisterRequest = {
  device_id: string;
  platform: "ios";
};

export class LiveActivityService extends BaseApiService {
  unregister(body: UnregisterRequest): Promise<ApiResponse<{ success: boolean }>> {
    return this.post(ROUTES.LIVE_ACTIVITY.UNREGISTER, body);
  }

  registerPushToStartToken(
    body: RegisterPushToStartTokenRequest
  ): Promise<ApiResponse<{ success: boolean }>> {
    return this.post(ROUTES.LIVE_ACTIVITY.PUSH_TO_START_TOKEN, body);
  }

  registerActivityPushToken(
    body: RegisterActivityPushTokenRequest
  ): Promise<ApiResponse<{ success: boolean }>> {
    return this.post(ROUTES.LIVE_ACTIVITY.ACTIVITY_PUSH_TOKEN, body);
  }

  debugRefresh(): Promise<ApiResponse<{ success: boolean; sent: number; devices: number }>> {
    return this.post(ROUTES.LIVE_ACTIVITY.DEBUG_REFRESH, {});
  }
}

export const liveActivityService = new LiveActivityService();
