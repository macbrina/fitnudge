import {
  ExitIntentModal,
  FloatingOfferButton,
  UpgradeBanner,
} from "@/components/subscription";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { useRevenueCat } from "@/contexts/RevenueCatContext";
import { usePricing } from "@/hooks/usePricing";
import { toRN } from "@/lib/units";
import SubscriptionScreen from "@/screens/onboarding/SubscriptionScreen";
import { useAuthStore } from "@/stores/authStore";
import { useExitOfferStore } from "@/stores/exitOfferStore";
import { useStyles, useTheme } from "@/themes";
import { STORAGE_KEYS, storageUtil } from "@/utils/storageUtil";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { MOBILE_ROUTES } from "@/lib/routes";
import { ActiveItemsSummary } from "./components/ActiveItemsSummary";
import { HeroSection } from "./components/HeroSection";
import { MotivationCard } from "./components/MotivationCard";
import { QuickStatsGrid } from "./components/QuickStatsGrid";
import { AchievementsSection } from "./components/AchievementsSection";
import { TodaysActionsCard } from "./components/TodaysActionsCard";
import { PartnersCard } from "./components/PartnersCard";
import { useHomeScreenData } from "./hooks/useHomeScreenData";

export default function HomeScreen() {
  const styles = useStyles(makeHomeScreenStyles);
  const { colors } = useTheme();
  const { user } = useAuthStore();
  const router = useRouter();

  // Subscription modals
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [hasSeenExitIntentModal, setHasSeenExitIntentModal] = useState(false);
  const [isExitOfferPurchasing, setIsExitOfferPurchasing] = useState(false);

  // For exit offer modal
  const { plans } = usePricing();
  const {
    expiryTime,
    clearExitOffer,
    checkAndShowProactiveOffer,
    markAsSubscribed,
    showExitIntentModal,
    openExitIntentModal,
    closeExitIntentModal,
    markExitIntentDismissed,
  } = useExitOfferStore();

  // Calculate discount percentage for exit offer (Pro plan)
  const exitOfferDiscountPercent = useMemo(() => {
    const proPlan = plans.find((p) => p.id === "pro");
    if (!proPlan) return 50;

    const originalPrice = proPlan.annual_price;
    const discountedPrice =
      proPlan.exit_offer_annual_price ?? originalPrice * 0.5;
    if (originalPrice <= 0) return 50;

    return Math.round(
      ((originalPrice - discountedPrice) / originalPrice) * 100,
    );
  }, [plans]);

  // RevenueCat for checking subscription history
  const { subscriptionStatus, isReady: isRevenueCatReady } = useRevenueCat();

  const {
    activeItems,
    todayPendingCheckIns,
    dashboardStats,
    isLoading,
    refetch,
  } = useHomeScreenData();

  const [refreshing, setRefreshing] = useState(false);

  // Check if user has seen subscription modal
  useEffect(() => {
    const checkSubscriptionStatus = async () => {
      try {
        const hasSeenSubscription = await storageUtil.getItem(
          STORAGE_KEYS.HAS_SEEN_SUBSCRIPTION,
        );

        const hasSeenExitIntent = await storageUtil.getItem(
          STORAGE_KEYS.HAS_DISMISSED_EXIT_INTENT,
        );

        if (hasSeenExitIntent) {
          setHasSeenExitIntentModal(true);
        }

        if (!hasSeenSubscription) {
          setShowSubscriptionModal(true);
        }
      } catch (error) {
        console.error("Error checking subscription status:", error);
      }
    };

    checkSubscriptionStatus();
  }, []);

  // Re-check exit intent status when subscription modal or exit intent modal closes
  useEffect(() => {
    if (!showSubscriptionModal || !showExitIntentModal) {
      const recheckExitIntent = async () => {
        const hasSeenExitIntent = await storageUtil.getItem(
          STORAGE_KEYS.HAS_DISMISSED_EXIT_INTENT,
        );
        if (hasSeenExitIntent) {
          setHasSeenExitIntentModal(true);
        }
      };
      recheckExitIntent();
    }
  }, [showSubscriptionModal, showExitIntentModal]);

  // Proactive exit offer check - shows every 7 days for users who have NEVER subscribed
  useEffect(() => {
    const checkProactiveOffer = async () => {
      if (!isRevenueCatReady) return;

      const hasEverSubscribed =
        subscriptionStatus.isActive || subscriptionStatus.tier !== "free";

      if (subscriptionStatus.isActive) {
        await markAsSubscribed();
        return;
      }

      await checkAndShowProactiveOffer(hasEverSubscribed);
    };

    checkProactiveOffer();
  }, [
    isRevenueCatReady,
    subscriptionStatus,
    checkAndShowProactiveOffer,
    markAsSubscribed,
  ]);

  // Navigate to detail screen for check-ins (all actions go to detail screens)
  const handleTodaysCheckInPress = useCallback(
    (_checkIn: unknown, isChallenge: boolean, entityId: string) => {
      if (isChallenge) {
        router.push(MOBILE_ROUTES.CHALLENGES.DETAILS(entityId));
      } else {
        router.push(`${MOBILE_ROUTES.GOALS.DETAILS}?id=${entityId}`);
      }
    },
    [router],
  );

  // Navigate to detail screen for meal/hydration tracking (they have access to plan targets)
  const handleTodaysMealLogPress = useCallback(
    (entityId: string, isChallenge: boolean) => {
      if (isChallenge) {
        router.push(MOBILE_ROUTES.CHALLENGES.DETAILS(entityId));
      } else {
        router.push(`${MOBILE_ROUTES.GOALS.DETAILS}?id=${entityId}`);
      }
    },
    [router],
  );

  const handleTodaysHydrationPress = useCallback(
    (entityId: string, isChallenge: boolean) => {
      if (isChallenge) {
        router.push(MOBILE_ROUTES.CHALLENGES.DETAILS(entityId));
      } else {
        router.push(`${MOBILE_ROUTES.GOALS.DETAILS}?id=${entityId}`);
      }
    },
    [router],
  );

  const handleCloseSubscriptionModal = async () => {
    try {
      await storageUtil.setItem(STORAGE_KEYS.HAS_SEEN_SUBSCRIPTION, true);
      setShowSubscriptionModal(false);
    } catch (error) {
      setShowSubscriptionModal(false);
    }
  };

  const currentStreak = dashboardStats?.current_streak || 0;

  // Handle upgrade banner tap
  const handleUpgradeTap = useCallback(() => {
    setShowSubscriptionModal(true);
  }, []);

  // Handle floating offer button tap - opens exit offer modal directly
  const handleFloatingOfferTap = useCallback(() => {
    openExitIntentModal();
  }, [openExitIntentModal]);

  // Handle exit offer modal close (user declined)
  const handleExitOfferClose = useCallback(async () => {
    closeExitIntentModal();
    try {
      await markExitIntentDismissed();
      setHasSeenExitIntentModal(true);
    } catch (error) {
      console.error("Error marking exit intent dismissed:", error);
    }
  }, [closeExitIntentModal, markExitIntentDismissed]);

  // Handle exit offer modal select plan (user accepted)
  const { purchaseProExitOffer } = useRevenueCat();

  const handleExitOfferSelectPlan = useCallback(
    async (planId: string, period: "monthly" | "annual") => {
      closeExitIntentModal();
      await markExitIntentDismissed();
      setHasSeenExitIntentModal(true);
      setIsExitOfferPurchasing(true);

      try {
        const success = await purchaseProExitOffer();

        if (success) {
          await markAsSubscribed();
          clearExitOffer();
        }
      } catch (error) {
        console.error(
          "[HomeScreen] Error in handleExitOfferSelectPlan:",
          error,
        );
      } finally {
        setIsExitOfferPurchasing(false);
      }
    },
    [
      closeExitIntentModal,
      clearExitOffer,
      purchaseProExitOffer,
      markAsSubscribed,
      markExitIntentDismissed,
    ],
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } catch (error) {
      console.error("Error refreshing home screen:", error);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.text.tertiary}
            colors={[colors.text.tertiary]}
          />
        }
      >
        <HeroSection userName={user?.name} />

        {/* Upgrade Banner for free users - hide while loading */}
        {!isLoading && <UpgradeBanner onUpgrade={handleUpgradeTap} />}

        <View style={styles.content}>
          <TodaysActionsCard
            pendingCheckIns={todayPendingCheckIns}
            isLoading={isLoading}
            onCheckInPress={handleTodaysCheckInPress}
            onMealLogPress={handleTodaysMealLogPress}
            onHydrationPress={handleTodaysHydrationPress}
          />

          <QuickStatsGrid
            dashboardStats={dashboardStats}
            isLoading={isLoading}
          />

          <MotivationCard currentStreak={currentStreak} />

          <ActiveItemsSummary items={activeItems} isLoading={isLoading} />

          <PartnersCard isLoading={isLoading} />

          <AchievementsSection
            onViewAll={() => router.push(MOBILE_ROUTES.ACHIEVEMENTS.LIST)}
          />
        </View>
      </ScrollView>

      {/* Subscription Modal */}
      <SubscriptionScreen
        visible={showSubscriptionModal}
        onClose={handleCloseSubscriptionModal}
      />

      {/* Floating Offer Button - shows when exit offer countdown is active */}
      {!isLoading &&
        !showSubscriptionModal &&
        !showExitIntentModal &&
        hasSeenExitIntentModal &&
        !isExitOfferPurchasing && (
          <FloatingOfferButton
            onPress={handleFloatingOfferTap}
            discountPercent={exitOfferDiscountPercent}
          />
        )}

      {/* Exit Offer Modal - triggered by floating button */}
      <ExitIntentModal
        visible={showExitIntentModal}
        onContinueFree={handleExitOfferClose}
        onSelectPlan={handleExitOfferSelectPlan}
        plans={plans.map((p) => ({
          id: p.id,
          name: p.name,
          monthly_price: p.monthly_price,
          annual_price: p.annual_price,
          features: p.features || [],
          trial_days: p.trial_days ?? undefined,
          exit_offer_enabled: p.exit_offer_enabled,
          exit_offer_monthly_price: p.exit_offer_monthly_price,
          exit_offer_annual_price: p.exit_offer_annual_price,
        }))}
        expiryTime={expiryTime}
      />

      {/* Loading Overlay for exit offer purchase */}
      <LoadingOverlay visible={isExitOfferPurchasing} />
    </View>
  );
}

const makeHomeScreenStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {},
  content: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[6]),
  },
});
