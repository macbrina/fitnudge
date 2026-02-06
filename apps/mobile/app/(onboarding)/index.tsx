import React from "react";
import { storageUtil, STORAGE_KEYS } from "@/utils/storageUtil";
import { router, useLocalSearchParams } from "expo-router";
import { MOBILE_ROUTES } from "@/lib/routes";
import OnboardingCarousel from "@/components/onboarding/OnboardingCarousel";

export default function OnboardingScreen() {
  const params = useLocalSearchParams<{ redirectTo?: string }>();
  const redirectTo = Array.isArray(params.redirectTo) ? params.redirectTo[0] : params.redirectTo;

  const handleComplete = async () => {
    try {
      await storageUtil.setItem(STORAGE_KEYS.HAS_SEEN_ONBOARDING, true);
      // Use redirectTo from deep link (e.g. signup with referral) if present
      router.replace((redirectTo as any) || MOBILE_ROUTES.AUTH.SIGNUP);
    } catch (error) {
      console.error("Error saving onboarding status:", error);
      router.replace((redirectTo as any) || MOBILE_ROUTES.AUTH.SIGNUP);
    }
  };

  const handleSkip = async () => {
    try {
      await storageUtil.setItem(STORAGE_KEYS.HAS_SEEN_ONBOARDING, true);
      router.replace(MOBILE_ROUTES.AUTH.LOGIN);
    } catch (error) {
      console.error("Error saving onboarding status:", error);
      router.replace(MOBILE_ROUTES.AUTH.LOGIN);
    }
  };

  return <OnboardingCarousel onComplete={handleComplete} onSkip={handleSkip} />;
}
