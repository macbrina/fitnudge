/**
 * Referral join route: /join?ref={code}
 * Handles fitnudge:///join?ref=CODE and https://fitnudge.app/join?ref=CODE
 * Redirects to signup with referral code pre-filled.
 */
import { Redirect, useLocalSearchParams } from "expo-router";
import { MOBILE_ROUTES } from "@/lib/routes";

export default function JoinRedirect() {
  const params = useLocalSearchParams<{ ref?: string }>();
  const ref = Array.isArray(params.ref) ? params.ref[0] : params.ref;
  const href = ref
    ? `${MOBILE_ROUTES.AUTH.SIGNUP}?referral=${encodeURIComponent(ref)}`
    : MOBILE_ROUTES.AUTH.SIGNUP;
  return <Redirect href={href} />;
}
