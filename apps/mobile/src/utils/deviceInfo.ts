/**
 * Device Info Utility
 * Collects device information for session tracking and security
 */

import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Application from "expo-application";
import Constants from "expo-constants";

export interface DeviceInfo {
  device_name: string;
  device_id: string;
  device_type: "ios" | "android" | "web";
}

/**
 * Get device information for auth requests
 * This helps track sessions and enables "logged in devices" features
 */
export async function getDeviceInfo(): Promise<DeviceInfo> {
  const deviceType = Platform.OS === "ios" ? "ios" : "android";

  // Get device name (e.g., "iPhone 14 Pro", "Samsung Galaxy S23")
  let deviceName = "Unknown Device";
  try {
    if (Device.modelName) {
      deviceName = Device.modelName;
    } else if (Device.deviceName) {
      deviceName = Device.deviceName;
    } else {
      // Fallback to brand + model
      const brand = Device.brand || "";
      const model = Device.modelId || "";
      if (brand || model) {
        deviceName = `${brand} ${model}`.trim() || "Unknown Device";
      }
    }
  } catch (error) {
    console.warn("[DeviceInfo] Error getting device name:", error);
  }

  // Get unique device identifier
  // Priority: installationId > androidId/identifierForVendor > random fallback
  let deviceId = "";
  try {
    // expo-application provides stable identifiers
    if (Platform.OS === "ios") {
      deviceId = (await Application.getIosIdForVendorAsync()) || "";
    } else {
      deviceId = Application.getAndroidId() || "";
    }

    // Fallback to Constants.installationId if available
    if (!deviceId && Constants.installationId) {
      deviceId = Constants.installationId;
    }

    // Final fallback - use a combination of device info
    if (!deviceId) {
      deviceId = `${Device.brand}-${Device.modelId}-${Platform.OS}`;
    }
  } catch (error) {
    console.warn("[DeviceInfo] Error getting device ID:", error);
    deviceId = `fallback-${Date.now()}`;
  }

  return {
    device_name: deviceName,
    device_id: deviceId,
    device_type: deviceType,
  };
}

/**
 * Get cached device info (synchronous, uses last known values)
 * Useful when you need device info immediately without async
 */
let cachedDeviceInfo: DeviceInfo | null = null;

export function getCachedDeviceInfo(): DeviceInfo | null {
  return cachedDeviceInfo;
}

/**
 * Initialize and cache device info
 * Call this once at app startup
 */
export async function initDeviceInfo(): Promise<DeviceInfo> {
  cachedDeviceInfo = await getDeviceInfo();
  return cachedDeviceInfo;
}
