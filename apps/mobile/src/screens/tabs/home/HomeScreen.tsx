import { toRN } from "@/lib/units";
import { useAuthStore } from "@/stores/authStore";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { useExitOfferStore } from "@/stores/exitOfferStore";
import { useAICoachStore } from "@/stores/aiCoachStore";
import { useRevenueCat } from "@/contexts/RevenueCatContext";
import { useStyles, useTheme } from "@/themes";
import { STORAGE_KEYS, storageUtil } from "@/utils/storageUtil";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, View, Text } from "react-native";
import Animated, { LinearTransition } from "react-native-reanimated";
import { MOBILE_ROUTES } from "@/lib/routes";
import { HeroSection } from "./components/HeroSection";
import { MotivationCard } from "./components/MotivationCard";
import { AchievementsSection } from "./components/AchievementsSection";
import { PartnersCard } from "./components/PartnersCard";
import { GoalCard, GoalCardSkeleton } from "./components/GoalCard";
import { GoalsEmptyState } from "./components/GoalsEmptyState";
import { useHomeScreenData } from "./hooks/useHomeScreenData";
import { useTranslation } from "@/lib/i18n";
import { fontFamily } from "@/lib/fonts";
import { AdBanner } from "@/components/ads";

export default function HomeScreen() {
  const styles = useStyles(makeHomeScreenStyles);
  const { colors } = useTheme();
  const { user } = useAuthStore();
  const router = useRouter();
  const { t } = useTranslation();

  // Subscription modals
  const { openModal: openSubscriptionModal } = useSubscriptionStore();

  // For exit offer proactive check
  const { checkAndShowProactiveOffer, markAsSubscribed } = useExitOfferStore();

  // RevenueCat for checking subscription history
  const { subscriptionStatus, isReady: isRevenueCatReady } = useRevenueCat();

  const { todayGoals, hasActiveGoals, currentStreak, isLoading, refetch } = useHomeScreenData();

  // AI Coach modal - for goal-specific conversations
  const { openModal: openAICoach } = useAICoachStore();

  const [refreshing, setRefreshing] = useState(false);

  // Check if user has seen subscription modal
  // Only show for free users who haven't seen it yet
  useEffect(() => {
    const checkSubscriptionStatus = async () => {
      // Wait for RevenueCat to be ready before checking
      if (!isRevenueCatReady) return;

      try {
        // Don't show subscription modal if user is on a paid plan
        if (subscriptionStatus.isActive || subscriptionStatus.tier !== "free") {
          return;
        }

        const hasSeenSubscription = await storageUtil.getItem(STORAGE_KEYS.HAS_SEEN_SUBSCRIPTION);

        if (!hasSeenSubscription) {
          // Mark as seen immediately so we don't show again
          await storageUtil.setItem(STORAGE_KEYS.HAS_SEEN_SUBSCRIPTION, true);
          openSubscriptionModal();
        }
      } catch (error) {
        console.error("Error checking subscription status:", error);
      }
    };

    checkSubscriptionStatus();
  }, [isRevenueCatReady, subscriptionStatus.isActive, subscriptionStatus.tier]);

  // Proactive exit offer check - shows every 7 days for users who have NEVER subscribed
  useEffect(() => {
    const checkProactiveOffer = async () => {
      if (!isRevenueCatReady) return;

      const hasEverSubscribed = subscriptionStatus.isActive || subscriptionStatus.tier !== "free";

      if (subscriptionStatus.isActive) {
        await markAsSubscribed();
        return;
      }

      await checkAndShowProactiveOffer(hasEverSubscribed);
    };

    checkProactiveOffer();
  }, [isRevenueCatReady, subscriptionStatus, checkAndShowProactiveOffer, markAsSubscribed]);

  // Navigate to goal detail screen
  const handleGoalPress = useCallback(
    (goalId: string) => {
      router.push(`${MOBILE_ROUTES.GOALS.DETAILS}?id=${goalId}`);
    },
    [router]
  );

  // Open AI Coach for a specific goal
  const handleTalkToBuddy = useCallback(
    (goalId: string) => {
      openAICoach(goalId);
    },
    [openAICoach]
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

  const hasGoals = todayGoals.length > 0;

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

        <View style={styles.content}>
          {/* Today's Goals Section */}
          <View style={styles.goalsSection}>
            <Text style={styles.sectionTitle}>{t("home.todays_goals")}</Text>

            {isLoading ? (
              // Show skeleton while loading
              <View style={styles.goalsListContainer}>
                <GoalCardSkeleton />
                <GoalCardSkeleton />
              </View>
            ) : hasGoals ? (
              // Vertical list of collapsible goal cards
              <Animated.View
                style={styles.goalsListContainer}
                layout={LinearTransition.duration(400)}
              >
                {todayGoals.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    compact
                    onPress={() => handleGoalPress(goal.id)}
                    onTalkToBuddy={handleTalkToBuddy}
                  />
                ))}
              </Animated.View>
            ) : (
              <GoalsEmptyState hasActiveGoals={hasActiveGoals} />
            )}
          </View>

          <MotivationCard currentStreak={currentStreak} />

          <PartnersCard isLoading={isLoading} />

          {/* Ad Banner - Only shows for free users */}
          <AdBanner unitId="HOME_BANNER" />

          <AchievementsSection />
        </View>
      </ScrollView>
    </View>
  );
}

const makeHomeScreenStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {},
  content: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[6])
  },

  // Goals section
  goalsSection: {
    marginBottom: toRN(tokens.spacing[4])
  },
  goalsListContainer: {
    gap: toRN(tokens.spacing[2])
  },
  sectionTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontWeight: tokens.typography.fontWeight.semibold,
    fontFamily: fontFamily.groteskSemiBold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[3])
  }
});
