import {
  ExitIntentModal,
  FloatingOfferButton,
  UpgradeBanner,
} from "@/components/subscription";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { useRevenueCat } from "@/contexts/RevenueCatContext";
import { useTodayCheckIns } from "@/hooks/api/useCheckIns";
import { usePricing } from "@/hooks/usePricing";
import { toRN } from "@/lib/units";
import SubscriptionScreen from "@/screens/onboarding/SubscriptionScreen";
import { CheckIn } from "@/services/api/checkins";
import { useAuthStore } from "@/stores/authStore";
import { useExitOfferStore } from "@/stores/exitOfferStore";
import { useStyles, useTheme } from "@/themes";
import { STORAGE_KEYS, storageUtil } from "@/utils/storageUtil";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { ActiveItemsSummary } from "./components/ActiveItemsSummary";
import { CheckInModal } from "./components/CheckInModal";
import { HeroSection } from "./components/HeroSection";
import { MotivationCard } from "./components/MotivationCard";
import { QuickActionsSection } from "./components/QuickActionsSection";
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
  const { openCheckinGoalId } = useLocalSearchParams<{
    openCheckinGoalId?: string;
  }>();
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [hasSeenExitIntentModal, setHasSeenExitIntentModal] = useState(false);
  const [isExitOfferPurchasing, setIsExitOfferPurchasing] = useState(false);
  const [autoShowCheckIn, setAutoShowCheckIn] = useState<CheckIn | null>(null);
  const [deepLinkCheckIn, setDeepLinkCheckIn] = useState<CheckIn | null>(null);
  const [deepLinkGoalId, setDeepLinkGoalId] = useState<string | null>(null);
  const [isLoadingDeepLink, setIsLoadingDeepLink] = useState(false);
  const hasAutoShownRef = useRef(false);
  const hasHandledDeepLinkRef = useRef<string | null>(null);

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
    if (!proPlan) return 50; // Default 50%

    const originalPrice = proPlan.annual_price;
    const discountedPrice =
      proPlan.exit_offer_annual_price ?? originalPrice * 0.5;
    if (originalPrice <= 0) return 50;

    return Math.round(
      ((originalPrice - discountedPrice) / originalPrice) * 100
    );
  }, [plans]);

  // RevenueCat for checking subscription history
  const { subscriptionStatus, isReady: isRevenueCatReady } = useRevenueCat();

  const {
    activeItems,
    todayPendingCheckIns,
    dashboardStats,
    activeGoals,
    todayCheckIns,
    userStats,
    isLoading,
    hasError,
    refetch,
  } = useHomeScreenData();
  const { refetch: refetchTodayCheckIns } = useTodayCheckIns();
  const [refreshing, setRefreshing] = useState(false);

  // ⚠️ TESTING ONLY - Uncomment to reset exit offer state
  // When testing, uncomment this block, save, and reload the app
  // useEffect(() => {
  //   const resetForTest = async () => {
  //     console.info("[HomeScreen] 🧪 TESTING: Resetting exit offer state...");
  //     const { resetForTesting } = useExitOfferStore.getState();
  //     await resetForTesting();
  //     console.info("[HomeScreen] 🧪 TESTING: Reset complete!");
  //   };
  //   resetForTest();
  // }, []);

  // Handle deep link to open check-in modal from push notification
  // Show loading state immediately for better UX
  useEffect(() => {
    if (
      openCheckinGoalId &&
      hasHandledDeepLinkRef.current !== openCheckinGoalId
    ) {
      // Immediately show loading modal
      setDeepLinkGoalId(openCheckinGoalId);
      setIsLoadingDeepLink(true);
      hasHandledDeepLinkRef.current = openCheckinGoalId;

      // Clear URL param
      router.setParams({ openCheckinGoalId: undefined });

      // Force refetch to get the latest check-ins
      refetchTodayCheckIns();
    }
  }, [openCheckinGoalId, refetchTodayCheckIns, router]);

  // After data loads, find and set the actual check-in
  useEffect(() => {
    if (deepLinkGoalId && todayCheckIns && !isLoading) {
      const checkIn = todayCheckIns.find(
        (c: any) =>
          c.goal_id === deepLinkGoalId || c.goal?.id === deepLinkGoalId
      );

      if (checkIn) {
        setDeepLinkCheckIn(checkIn as CheckIn);
        setIsLoadingDeepLink(false);
      } else {
        // Check-in not found - might still be loading, retry after a short delay
        const retryTimer = setTimeout(() => {
          refetchTodayCheckIns();
        }, 1000);
        return () => clearTimeout(retryTimer);
      }
    }
  }, [deepLinkGoalId, todayCheckIns, isLoading, refetchTodayCheckIns]);

  // Check if user has seen subscription modal
  useEffect(() => {
    const checkSubscriptionStatus = async () => {
      try {
        const hasSeenSubscription = await storageUtil.getItem(
          STORAGE_KEYS.HAS_SEEN_SUBSCRIPTION
        );

        const hasSeenExitIntent = await storageUtil.getItem(
          STORAGE_KEYS.HAS_DISMISSED_EXIT_INTENT
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
  // This catches when user dismisses ExitIntentModal during the same session
  useEffect(() => {
    // Re-check when either modal closes
    if (!showSubscriptionModal || !showExitIntentModal) {
      const recheckExitIntent = async () => {
        const hasSeenExitIntent = await storageUtil.getItem(
          STORAGE_KEYS.HAS_DISMISSED_EXIT_INTENT
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
      // Wait for RevenueCat to be ready
      if (!isRevenueCatReady) return;

      // Check if user has EVER had an active subscription
      // This includes past subscriptions (even if cancelled)
      const hasEverSubscribed =
        subscriptionStatus.isActive || subscriptionStatus.tier !== "free";

      // If user has active subscription, mark them as subscribed
      if (subscriptionStatus.isActive) {
        await markAsSubscribed();
        return;
      }

      // Check and show proactive offer if eligible
      await checkAndShowProactiveOffer(hasEverSubscribed);
    };

    checkProactiveOffer();
  }, [
    isRevenueCatReady,
    subscriptionStatus,
    checkAndShowProactiveOffer,
    markAsSubscribed,
  ]);

  // Auto-show check-in modal logic
  useEffect(() => {
    const checkAutoShowCheckIn = async () => {
      // Don't auto-show if already shown or if data is loading
      if (hasAutoShownRef.current || isLoading || !todayCheckIns) {
        return;
      }

      try {
        // Check if auto-show is enabled (default: true)
        const autoShowEnabled = await storageUtil.getItem<boolean>(
          STORAGE_KEYS.AUTO_SHOW_CHECKIN_ENABLED
        );
        if (autoShowEnabled === false) {
          return; // User disabled auto-show
        }

        // Get time limit (default: 10 AM / 10:00)
        const timeLimitHour =
          (await storageUtil.getItem<number>(
            STORAGE_KEYS.AUTO_SHOW_CHECKIN_TIME_LIMIT
          )) || 10;

        // Check if we're before the time limit
        const currentHour = new Date().getHours();
        if (currentHour >= timeLimitHour) {
          return; // Too late in the day
        }

        // Check if we already showed today
        const today = new Date().toISOString().split("T")[0];
        const lastShownDate = await storageUtil.getItem<string>(
          STORAGE_KEYS.LAST_CHECKIN_AUTO_SHOWN_DATE
        );
        if (lastShownDate === today) {
          return; // Already shown today
        }

        // Find pending check-ins
        const pendingCheckIns = todayCheckIns.filter(
          (checkIn) => !checkIn.completed
        );

        // Auto-show only if exactly 1 pending check-in
        if (pendingCheckIns.length === 1) {
          hasAutoShownRef.current = true;
          setAutoShowCheckIn(pendingCheckIns[0] as CheckIn);
          // Mark as shown today
          await storageUtil.setItem(
            STORAGE_KEYS.LAST_CHECKIN_AUTO_SHOWN_DATE,
            today
          );
        }
      } catch (error) {
        console.error("Error checking auto-show check-in:", error);
      }
    };

    // Only run when data is ready
    if (!isLoading && todayCheckIns) {
      checkAutoShowCheckIn();
    }
  }, [isLoading, todayCheckIns]);

  const handleCheckInComplete = () => {
    refetchTodayCheckIns();
    setAutoShowCheckIn(null);
    setDeepLinkCheckIn(null);
    setDeepLinkGoalId(null);
    setIsLoadingDeepLink(false);
    hasAutoShownRef.current = false;
  };

  const handleCheckInClose = () => {
    setAutoShowCheckIn(null);
    setDeepLinkCheckIn(null);
    setDeepLinkGoalId(null);
    setIsLoadingDeepLink(false);
    hasAutoShownRef.current = false;
  };

  const handleCloseSubscriptionModal = async () => {
    try {
      await storageUtil.setItem(STORAGE_KEYS.HAS_SEEN_SUBSCRIPTION, true);
      setShowSubscriptionModal(false);
    } catch (error) {
      setShowSubscriptionModal(false);
    }
  };

  const currentStreak = userStats?.current_streak || 0;

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
      // Close the modal first
      closeExitIntentModal();

      // Mark as dismissed and update local state directly
      await markExitIntentDismissed();
      setHasSeenExitIntentModal(true);

      // Show loading overlay while processing purchase
      setIsExitOfferPurchasing(true);

      try {
        // Directly initiate purchase with introductory offer
        const success = await purchaseProExitOffer();

        if (success) {
          // Mark user as subscribed so they don't see the offer again
          await markAsSubscribed();
          // Clear the exit offer since purchase succeeded
          clearExitOffer();
        }
      } catch (error) {
        console.error(
          "[HomeScreen] Error in handleExitOfferSelectPlan:",
          error
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
    ]
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
            todayCheckIns={todayCheckIns}
            isLoading={isLoading}
          />

          <QuickStatsGrid
            dashboardStats={dashboardStats}
            userStats={userStats}
            isLoading={isLoading}
          />

          <MotivationCard currentStreak={currentStreak} />

          <ActiveItemsSummary items={activeItems} isLoading={isLoading} />

          <PartnersCard isLoading={isLoading} />

          <AchievementsSection />

          {/* <QuickActionsSection
            hasActiveGoals={(activeGoals?.length || 0) > 0}
            isLoading={isLoading}
          /> */}
        </View>
      </ScrollView>

      {/* Subscription Modal */}
      <SubscriptionScreen
        visible={showSubscriptionModal}
        onClose={handleCloseSubscriptionModal}
      />

      {/* Auto-show Check-In Modal */}
      {/* Always render - modal handles its own visibility with animation */}
      <CheckInModal
        visible={!!autoShowCheckIn}
        checkIn={autoShowCheckIn}
        onClose={handleCheckInClose}
        onComplete={handleCheckInComplete}
      />

      {/* Deep Link Check-In Modal (from push notifications) */}
      {/* Shows loading skeleton while fetching, then actual content when ready */}
      {/* Always render - modal handles its own visibility with animation */}
      <CheckInModal
        visible={!!deepLinkGoalId && !autoShowCheckIn}
        checkIn={deepLinkCheckIn}
        onClose={handleCheckInClose}
        onComplete={handleCheckInComplete}
        isLoading={isLoadingDeepLink || !deepLinkCheckIn}
      />

      {/* Floating Offer Button - shows when exit offer countdown is active
          Hide when: loading, subscription modal open, or exit offer modal open */}
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
  content: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[6]),
  },
});
