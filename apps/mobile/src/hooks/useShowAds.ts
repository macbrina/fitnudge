import { useSubscriptionStore } from "@/stores/subscriptionStore";

/**
 * Hook to determine if ads should be shown to the current user.
 *
 * Ads are shown only to FREE tier users.
 * Premium users never see ads.
 *
 * @example
 * ```tsx
 * function MyScreen() {
 *   const showAds = useShowAds();
 *
 *   return (
 *     <View>
 *       <Content />
 *       {showAds && <AdBanner unitId="HOME_BANNER" />}
 *     </View>
 *   );
 * }
 * ```
 */
export function useShowAds(): boolean {
  const getPlan = useSubscriptionStore((state) => state.getPlan);
  const plan = getPlan();

  // Show ads only to free users
  return plan === "free";
}

/**
 * Non-hook version for use outside React components.
 * Use this in callbacks or utility functions.
 *
 * @example
 * ```ts
 * const handleSomething = () => {
 *   if (shouldShowAds()) {
 *     // Track ad impression
 *   }
 * };
 * ```
 */
export function shouldShowAds(): boolean {
  const plan = useSubscriptionStore.getState().getPlan();
  return plan === "free";
}
