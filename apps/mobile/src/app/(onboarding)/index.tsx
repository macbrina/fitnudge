import React from "react";
import { storageUtil, STORAGE_KEYS } from "@/utils/storageUtil";
import { router } from "expo-router";
import { MOBILE_ROUTES } from "@/lib/routes";
import OnboardingCarousel from "@/components/onboarding/OnboardingCarousel";

export default function OnboardingScreen() {
  const handleComplete = async () => {
    try {
      await storageUtil.setItem(STORAGE_KEYS.HAS_SEEN_ONBOARDING, true);
      router.replace(MOBILE_ROUTES.AUTH.MAIN);
    } catch (error) {
      console.error("Error saving onboarding status:", error);
      router.replace(MOBILE_ROUTES.AUTH.MAIN);
    }
  };

  const handleSkip = async () => {
    try {
      await storageUtil.setItem(STORAGE_KEYS.HAS_SEEN_ONBOARDING, true);
      router.replace(MOBILE_ROUTES.AUTH.MAIN);
    } catch (error) {
      console.error("Error saving onboarding status:", error);
      router.replace(MOBILE_ROUTES.AUTH.MAIN);
    }
  };

  return <OnboardingCarousel onComplete={handleComplete} onSkip={handleSkip} />;
}
