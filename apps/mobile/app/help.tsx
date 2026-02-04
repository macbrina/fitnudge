/**
 * Help center redirect route: /help
 * Handles fitnudge:///help and https://fitnudge.app/help (e.g. from Tawk help widget links).
 * Uses routeWithAuthCheck so unauthenticated users go to signup with redirectTo,
 * then land on help-center after login.
 */
import { useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { MOBILE_ROUTES } from "@/lib/routes";
import { routeWithAuthCheck } from "@/utils/deepLinkHandler";

export default function HelpRedirect() {
  const params = useLocalSearchParams();
  const queryString =
    params && Object.keys(params).length > 0
      ? `?${new URLSearchParams(
          Object.fromEntries(
            Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? (v[0] ?? "") : (v ?? "")])
          ) as Record<string, string>
        ).toString()}`
      : "";
  const destination = `${MOBILE_ROUTES.PROFILE.HELP_CENTER}${queryString}`;

  useEffect(() => {
    routeWithAuthCheck(destination, { redirectTo: destination });
  }, [destination]);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator />
    </View>
  );
}
