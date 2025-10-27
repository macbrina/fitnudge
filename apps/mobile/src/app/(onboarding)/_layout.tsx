import { Stack } from "expo-router";

export default function OnboardingLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: "Welcome",
          headerShown: false,
          gestureEnabled: false, // Prevent swipe back
        }}
      />
    </Stack>
  );
}
