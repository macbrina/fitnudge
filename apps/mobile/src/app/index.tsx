import { Redirect } from "expo-router";
import { useAuthStore } from "@/stores/authStore";
import { useEffect, useState } from "react";
import { storageUtil, STORAGE_KEYS } from "@/utils/storageUtil";
import { MOBILE_ROUTES } from "@/lib/routes";
import { useAppFonts } from "@/lib/fonts";
import { LoadingContainer } from "@/components/common/LoadingContainer";

export default function Index() {
  const { isAuthenticated } = useAuthStore();
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(
    null
  );
  const fontsLoaded = useAppFonts();

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const seen = await storageUtil.getItem<boolean>(
          STORAGE_KEYS.HAS_SEEN_ONBOARDING
        );
        setHasSeenOnboarding(seen === true);
      } catch {
        setHasSeenOnboarding(false);
      }
    };
    checkOnboarding();
  }, []);

  // Show loading while checking onboarding status
  if (hasSeenOnboarding === null || !fontsLoaded) {
    return <LoadingContainer />;
  }

  if (isAuthenticated) {
    return <Redirect href={MOBILE_ROUTES.MAIN.HOME} />;
  }

  if (!hasSeenOnboarding) {
    return <Redirect href={MOBILE_ROUTES.ONBOARDING} />;
  }

  return <Redirect href={MOBILE_ROUTES.AUTH.MAIN} />;
}
