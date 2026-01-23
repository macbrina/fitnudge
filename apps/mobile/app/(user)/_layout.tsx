import { useMemo, useCallback, useState, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { Stack, Redirect, useSegments } from "expo-router";
import { useAuthStore } from "@/stores/authStore";
import { MOBILE_ROUTES } from "@/lib/routes";
import { FloatingAICoachButton } from "@/components/FloatingAICoachButton";
import { FloatingOfferButton } from "@/components/subscription";
import { ExitIntentModal } from "@/components/subscription";
import AICoachModal from "@/screens/tabs/profile/AICoachScreen";
import SubscriptionScreen from "@/screens/onboarding/SubscriptionScreen";
import { useExitOfferStore } from "@/stores/exitOfferStore";
import { useAICoachStore } from "@/stores/aiCoachStore";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { useRevenueCat } from "@/contexts/RevenueCatContext";
import { usePricing } from "@/hooks/usePricing";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { storageUtil, STORAGE_KEYS } from "@/utils/storageUtil";

// Screens where FloatingAICoachButton and FloatingOfferButton should be displayed
const FLOATING_BUTTONS_ALLOWED_SEGMENTS = ["(tabs)"];

export default function UserLayout() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const segments = useSegments();

  // AI Coach modal state from store
  const { isModalVisible, openModal, closeModal, focusedGoalId } = useAICoachStore();

  // Subscription modal state from store
  const { isModalVisible: isSubscriptionModalVisible, closeModal: closeSubscriptionModal } =
    useSubscriptionStore();

  // Exit Offer state
  const {
    isActive: isExitOfferActive,
    expiryTime,
    showExitIntentModal,
    openExitIntentModal,
    closeExitIntentModal,
    markExitIntentDismissed,
    markAsSubscribed,
    clearExitOffer
  } = useExitOfferStore();

  console.log("isSubscriptionModalVisible", isSubscriptionModalVisible);

  const { subscriptionStatus, isReady: isRevenueCatReady, purchaseProExitOffer } = useRevenueCat();
  const { plans } = usePricing();
  const [isExitOfferPurchasing, setIsExitOfferPurchasing] = useState(false);

  // Initialize exit offer store on mount - restore expiryTime from storage
  useEffect(() => {
    const initializeExitOffer = async () => {
      try {
        const savedExpiryTimeStr = await storageUtil.getItem<string>(
          STORAGE_KEYS.EXIT_OFFER_EXPIRY_TIME
        );
        if (savedExpiryTimeStr) {
          const savedExpiryTime = new Date(savedExpiryTimeStr);
          const now = Date.now();

          // Check if expiryTime is still valid (not expired)
          if (savedExpiryTime.getTime() > now) {
            useExitOfferStore.getState().setExitOffer(savedExpiryTime);
            console.info("[UserLayout] Restored active exit offer from storage");
          } else {
            // Expired - clear it
            await storageUtil.removeItem(STORAGE_KEYS.EXIT_OFFER_EXPIRY_TIME);
            useExitOfferStore.getState().clearExitOffer();
            console.info("[UserLayout] Expired exit offer cleared on startup");
          }
        }
      } catch (error) {
        console.error("[UserLayout] Error initializing exit offer:", error);
      }
    };

    if (isAuthenticated) {
      initializeExitOffer();
    }
  }, [isAuthenticated]);

  // FloatingOfferButton shows when: exit offer is active AND user is free tier
  const isOfferButtonVisible = useMemo(() => {
    if (!isRevenueCatReady) return false;
    return isExitOfferActive && !subscriptionStatus.isActive && subscriptionStatus.tier === "free";
  }, [isRevenueCatReady, isExitOfferActive, subscriptionStatus]);

  // Check if floating buttons should be shown based on current route
  const shouldShowFloatingButtons = useMemo(() => {
    return FLOATING_BUTTONS_ALLOWED_SEGMENTS.some((segment) => segments.includes(segment as any));
  }, [segments]);

  // Calculate discount percentage for exit offer
  const exitOfferDiscountPercent = useMemo(() => {
    const proPlan = plans.find((p) => p.id === "premium");
    if (!proPlan) return 50;

    const originalPrice = proPlan.annual_price;
    const discountedPrice = proPlan.exit_offer_annual_price ?? originalPrice * 0.5;
    if (originalPrice <= 0) return 50;

    return Math.round(((originalPrice - discountedPrice) / originalPrice) * 100);
  }, [plans]);

  // Handle floating offer button tap
  const handleFloatingOfferTap = useCallback(async () => {
    // Re-check eligibility before showing
    if (subscriptionStatus.isActive || subscriptionStatus.tier !== "free") {
      await markAsSubscribed();
      return;
    }

    await openExitIntentModal();
  }, [openExitIntentModal, subscriptionStatus, markAsSubscribed]);

  // Handle exit offer modal close (user declined)
  const handleExitOfferClose = useCallback(async () => {
    closeExitIntentModal();
    await markExitIntentDismissed();
  }, [closeExitIntentModal, markExitIntentDismissed]);

  // Handle exit offer modal select plan (user accepted)
  const handleExitOfferSelectPlan = useCallback(
    async (planId: string, period: "monthly" | "annual") => {
      closeExitIntentModal();
      await markExitIntentDismissed();
      setIsExitOfferPurchasing(true);

      try {
        const success = await purchaseProExitOffer();

        if (success) {
          await markAsSubscribed();
          clearExitOffer();
        }
      } catch (error) {
        console.error("[UserLayout] Error in handleExitOfferSelectPlan:", error);
      } finally {
        setIsExitOfferPurchasing(false);
      }
    },
    [
      closeExitIntentModal,
      clearExitOffer,
      purchaseProExitOffer,
      markAsSubscribed,
      markExitIntentDismissed
    ]
  );

  if (!isLoading && !isAuthenticated) {
    return <Redirect href={MOBILE_ROUTES.AUTH.LOGIN} />;
  }

  return (
    <View style={styles.container}>
      <Stack>
        <Stack.Protected guard={isAuthenticated}>
          <Stack.Screen
            name="(tabs)"
            options={{
              headerShown: false
            }}
          />
          <Stack.Screen
            name="(onboarding)"
            options={{
              headerShown: false
            }}
          />
          <Stack.Screen
            name="(goals)"
            options={{
              headerShown: false
            }}
          />
          <Stack.Screen
            name="profile"
            options={{
              headerShown: false
            }}
          />
        </Stack.Protected>
      </Stack>

      {/* Floating AI Coach Button - only shows on allowed screens (tabs) */}
      {/* {!isModalVisible && shouldShowFloatingButtons && (
        <FloatingAICoachButton
          onPress={() => openModal()}
          hasOfferButtonBelow={isOfferButtonVisible}
        />
      )} */}

      {/* Floating Offer Button - shows when exit offer countdown is active (global) */}
      {shouldShowFloatingButtons &&
        !isSubscriptionModalVisible &&
        !showExitIntentModal &&
        !isExitOfferPurchasing &&
        !subscriptionStatus.isActive &&
        subscriptionStatus.tier === "free" &&
        isOfferButtonVisible && (
          <FloatingOfferButton
            onPress={handleFloatingOfferTap}
            discountPercent={exitOfferDiscountPercent}
          />
        )}

      {/* AI Coach Modal */}
      <AICoachModal visible={isModalVisible} onClose={closeModal} goalId={focusedGoalId} />

      {/* Subscription Modal - centralized */}
      <SubscriptionScreen visible={isSubscriptionModalVisible} onClose={closeSubscriptionModal} />

      {/* Exit Offer Modal - triggered by floating button (global) */}
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
          exit_offer_annual_price: p.exit_offer_annual_price
        }))}
        expiryTime={expiryTime}
      />

      {/* Loading Overlay for exit offer purchase */}
      <LoadingOverlay visible={isExitOfferPurchasing} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  }
});
