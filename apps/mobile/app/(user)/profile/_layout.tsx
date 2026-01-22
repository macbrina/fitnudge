import { Stack } from "expo-router";
import { useTheme } from "@/themes";

export default function ProfileLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg.canvas }
      }}
    />
  );
}
