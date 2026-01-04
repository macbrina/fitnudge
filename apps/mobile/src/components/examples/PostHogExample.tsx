import React, { useEffect } from "react";
import { View, Text, Button, Alert } from "react-native";
import { usePostHog } from "@/hooks/usePostHog";

export const PostHogExample: React.FC = () => {
  const { capture, setUserProperties, getFeatureFlag, isFeatureEnabled } = usePostHog();

  useEffect(() => {
    // Track component mount
    capture("posthog_example_mounted");
  }, [capture]);

  const handleTrackEvent = () => {
    capture("button_clicked", {
      button_name: "track_event",
      timestamp: new Date().toISOString()
    });
    Alert.alert("Event Tracked", "Check your PostHog dashboard!");
  };

  const handleSetUserProperties = () => {
    setUserProperties({
      last_activity: new Date().toISOString(),
      example_used: true
    });
    Alert.alert("Properties Set", "User properties updated!");
  };

  const handleCheckFeatureFlag = () => {
    const flagValue = getFeatureFlag("example_feature");
    const isEnabled = isFeatureEnabled("example_feature");

    Alert.alert(
      "Feature Flag Check",
      `Flag value: ${JSON.stringify(flagValue)}\nIs enabled: ${isEnabled}`
    );
  };

  return (
    <View style={{ padding: 20, gap: 10 }}>
      <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 10 }}>
        PostHog Integration Example
      </Text>

      <Button title="Track Event" onPress={handleTrackEvent} />

      <Button title="Set User Properties" onPress={handleSetUserProperties} />

      <Button title="Check Feature Flag" onPress={handleCheckFeatureFlag} />
    </View>
  );
};

export default PostHogExample;
