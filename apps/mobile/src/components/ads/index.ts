/**
 * Ad Components
 *
 * Reusable ad components for showing AdMob ads to free users.
 * Premium users never see ads.
 *
 * @example
 * ```tsx
 * import { AdBanner, NativeAdCard } from "@/components/ads";
 *
 * // Banner ad for simple placements
 * <AdBanner unitId="HOME_BANNER" />
 *
 * // Native ad for feed integration (blog, etc.)
 * <NativeAdCard />
 * ```
 */

export { AdBanner } from "./AdBanner";
export { NativeAdCard } from "./NativeAdCard";
