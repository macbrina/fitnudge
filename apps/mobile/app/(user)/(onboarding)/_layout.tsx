import { Stack } from "expo-router";
import { useAppFonts } from "@/lib/fonts";
import { LoadingContainer } from "@/components/common/LoadingContainer";

export default function OnboardingLayout() {
  const fontsLoaded = useAppFonts();

  // Wait for fonts to load to prevent text shift/flash
  if (!fontsLoaded) {
    return <LoadingContainer />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
