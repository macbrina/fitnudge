/**
 * Referral join route: /join?ref={code}
 * Handles fitnudge:///join?ref=CODE and https://fitnudge.app/join?ref=CODE
 * Redirects to signup with referral code pre-filled.
 * If user hasn't seen onboarding, redirects to onboarding first (with redirectTo).
 */
import { Redirect, useLocalSearchParams } from "expo-router";
import { MOBILE_ROUTES } from "@/lib/routes";
import { storageUtil, STORAGE_KEYS } from "@/utils/storageUtil";
import { useEffect, useState } from "react";
import { LoadingContainer } from "@/components/common/LoadingContainer";

export default function JoinRedirect() {
  const params = useLocalSearchParams<{ ref?: string }>();
  const ref = Array.isArray(params.ref) ? params.ref[0] : params.ref;
  const [href, setHref] = useState<string | null>(null);

  useEffect(() => {
    const resolve = async () => {
      const signupUrl = ref
        ? `${MOBILE_ROUTES.AUTH.SIGNUP}?referral=${encodeURIComponent(ref)}`
        : MOBILE_ROUTES.AUTH.SIGNUP;
      const hasSeenOnboarding = await storageUtil.getItem<boolean>(
        STORAGE_KEYS.HAS_SEEN_ONBOARDING
      );
      if (!hasSeenOnboarding) {
        setHref(`${MOBILE_ROUTES.ONBOARDING.MAIN}?redirectTo=${encodeURIComponent(signupUrl)}`);
      } else {
        setHref(signupUrl);
      }
    };
    resolve();
  }, [ref]);

  if (href === null) {
    return <LoadingContainer />;
  }
  return <Redirect href={href} />;
}
