import { BaseApiService, ApiResponse } from "./base";
import { ROUTES } from "@/lib/routes";

export type RegisterFcmTokenRequest = {
  device_id: string;
  platform: "android";
  fcm_token: string;
  timezone?: string;
};

export class NextUpPushService extends BaseApiService {
  registerFcmToken(body: RegisterFcmTokenRequest): Promise<ApiResponse<{ success: boolean }>> {
    return this.post(ROUTES.NEXT_UP_PUSH.FCM_TOKEN, body);
  }

  debugRefresh(): Promise<ApiResponse<{ success: boolean }>> {
    return this.post(ROUTES.NEXT_UP_PUSH.DEBUG_REFRESH, {});
  }
}

export const nextUpPushService = new NextUpPushService();
