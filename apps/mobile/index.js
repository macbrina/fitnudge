// Entry file used by Metro for both app + background tasks.
// We register Android background handlers BEFORE importing expo-router's entry.

import { Platform } from "react-native";

if (Platform.OS === "android") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const messaging = require("@react-native-firebase/messaging").default;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const notifee = require("@notifee/react-native").default;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { handleNextUpFcmMessage } = require("./src/features/nextUp/android/nextUpFcmHandler");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { onNotifeeBackgroundEvent } = require("./src/features/nextUp/android/nextUpNotifee");

  // FCM data messages → update the ongoing NextUp notification, even when app is killed.
  messaging().setBackgroundMessageHandler(handleNextUpFcmMessage);

  // Optional: handle background press actions (kept as no-op safe default).
  notifee.onBackgroundEvent(onNotifeeBackgroundEvent);
}

import "expo-router/entry";
