import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useTranslation } from "@/lib/i18n";
import { toRN } from "@/lib/units";
import { useStyles } from "@/themes/makeStyles";
import { useTheme } from "@/themes";
import { router, useLocalSearchParams } from "expo-router";
import { BackButton } from "@/components/ui/BackButton";
import { Card } from "@/components/ui/Card";
import { fontFamily } from "@/lib/fonts";
import { Ionicons } from "@expo/vector-icons";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { GoalType } from "@/services/api/goals";
import { UpgradePrompt, UpgradePromptType } from "@/components/subscription";
import { useActiveGoals } from "@/hooks/api/useGoals";
import SubscriptionScreen from "@/screens/onboarding/SubscriptionScreen";

// Extended type to include challenge types for this selection screen
type SelectableType =
  | GoalType
  | "mixed"
  | "time_challenge"
  | "target_challenge";

interface GoalTypeOption {
  id: SelectableType;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  isPremium: boolean;
  badge?: string;
  isChallenge?: boolean; // True for challenge types
}

export default function GoalTypeSelectionScreen() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const {
    hasFeature,
    isLoading: isLoadingSubscription,
    canCreateGoal,
    getPlan,
  } = useSubscriptionStore();
  const params = useLocalSearchParams<{ category?: string }>();

  const [selectedType, setSelectedType] = useState<SelectableType | null>(null);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [upgradePromptType, setUpgradePromptType] =
    useState<UpgradePromptType>("generic");
  const [showSubscriptionScreen, setShowSubscriptionScreen] = useState(false);

  // Check if user has premium access (challenge_create feature)
  const hasPremiumAccess = hasFeature("challenge_create");

  // Check goal limits
  const { data: activeGoalsResponse } = useActiveGoals();
  const activeGoalCount = activeGoalsResponse?.data?.length || 0;
  const canCreate = canCreateGoal(activeGoalCount);
  const plan = getPlan();

  // Show upgrade prompt if user cannot create more goals
  useEffect(() => {
    if (!canCreate && plan === "free") {
      setUpgradePromptType("goal_limit");
      setShowUpgradePrompt(true);
    }
  }, [canCreate, plan]);

  // Handle upgrade button press
  const handleUpgrade = useCallback(() => {
    setShowUpgradePrompt(false);
    setShowSubscriptionScreen(true);
  }, []);

  // Handle upgrade prompt close - go back if they can't create
  const handleUpgradePromptClose = useCallback(() => {
    setShowUpgradePrompt(false);
    if (!canCreate) {
      router.back();
    }
  }, [canCreate]);

  const goalTypeOptions: GoalTypeOption[] = [
    {
      id: "mixed",
      title: t("goals.types.mixed.title") || "Mixed (Recommended)",
      description:
        t("goals.types.mixed.description") ||
        "Get a variety of habits and challenges to choose from",
      icon: "color-palette-outline",
      isPremium: false,
      badge: t("goals.types.recommended") || "Recommended",
    },
    {
      id: "habit",
      title: t("goals.types.habit.title") || "Ongoing Habit",
      description:
        t("goals.types.habit.description") ||
        "Build a daily practice that becomes part of your routine. No end date.",
      icon: "refresh-outline",
      isPremium: false,
    },
    {
      id: "time_challenge",
      title: t("goals.types.time_challenge.title") || "Time Challenge",
      description:
        t("goals.types.time_challenge.description") ||
        "Commit to 30, 60, or 90 days of focused effort. Shareable with friends.",
      icon: "calendar-outline",
      isPremium: true,
      isChallenge: true,
    },
    {
      id: "target_challenge",
      title: t("goals.types.target_challenge.title") || "Target Challenge",
      description:
        t("goals.types.target_challenge.description") ||
        "Achieve a specific number (50 workouts, 100 meals, etc.). Race with friends.",
      icon: "flag-outline",
      isPremium: true,
      isChallenge: true,
    },
  ];

  const handleBack = () => {
    router.back();
  };

  const handleSelectType = (type: SelectableType) => {
    const option = goalTypeOptions.find((o) => o.id === type);

    // Check premium access for challenges - show subscription modal (hybrid approach)
    if (option?.isPremium && !hasPremiumAccess) {
      setShowSubscriptionScreen(true);
      return;
    }

    setSelectedType(type);
  };

  const handleContinue = () => {
    if (!selectedType) return;

    const option = goalTypeOptions.find((o) => o.id === selectedType);

    // Navigate to create goal/challenge screen based on type
    if (option?.isChallenge) {
      // Route to challenge creation
      router.push({
        pathname: "/create-goal",
        params: {
          createType: "challenge",
          challengeType:
            selectedType === "time_challenge" ? "streak" : "checkin_count",
          category: params.category,
        },
      });
    } else {
      // Route to goal creation
      router.push({
        pathname: "/create-goal",
        params: {
          goalType: selectedType,
          category: params.category,
        },
      });
    }
  };

  return (
    <View style={styles.container}>
      <BackButton
        onPress={handleBack}
        title={t("goals.types.title") || "Choose Goal Type"}
        titleCentered={true}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subtitle}>
          {t("goals.types.subtitle") ||
            "What kind of goal do you want to create?"}
        </Text>

        <View style={styles.optionsContainer}>
          {goalTypeOptions.map((option) => {
            const isSelected = selectedType === option.id;
            const isLocked = option.isPremium && !hasPremiumAccess;

            return (
              <TouchableOpacity
                key={option.id}
                activeOpacity={0.7}
                onPress={() => handleSelectType(option.id)}
              >
                <Card
                  shadow={isSelected ? "lg" : "sm"}
                  style={[
                    styles.optionCard,
                    isSelected && styles.optionCardSelected,
                  ]}
                >
                  <View style={styles.optionHeader}>
                    <View
                      style={[
                        styles.iconContainer,
                        isSelected && styles.iconContainerSelected,
                      ]}
                    >
                      <Ionicons
                        name={option.icon}
                        size={24}
                        color={isSelected ? "#fff" : brandColors.primary}
                      />
                    </View>

                    <View style={styles.optionTitleContainer}>
                      <View style={styles.titleRow}>
                        <Text
                          style={[
                            styles.optionTitle,
                            isSelected && styles.optionTitleSelected,
                          ]}
                        >
                          {option.title}
                        </Text>
                        {option.badge && (
                          <View style={styles.badge}>
                            <Text style={styles.badgeText}>{option.badge}</Text>
                          </View>
                        )}
                      </View>

                      {isLocked && (
                        <View style={styles.proBadge}>
                          <Text style={styles.proBadgeText}>PRO</Text>
                        </View>
                      )}
                    </View>

                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={24}
                        color={brandColors.primary}
                      />
                    )}
                  </View>

                  <Text style={styles.optionDescription}>
                    {option.description}
                  </Text>

                  {option.isPremium && !isLocked && (
                    <View style={styles.shareableTag}>
                      <Ionicons
                        name="people-outline"
                        size={14}
                        color={brandColors.primary}
                      />
                      <Text style={styles.shareableText}>
                        {t("goals.types.shareable") || "Shareable with friends"}
                      </Text>
                    </View>
                  )}
                </Card>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Info text */}
        <View style={styles.infoContainer}>
          <Ionicons
            name="information-circle-outline"
            size={20}
            color={colors.text.tertiary}
          />
          <Text style={styles.infoText}>
            {t("goals.types.info") ||
              "Habits are free for everyone. Challenges require a premium plan and can be shared with friends."}
          </Text>
        </View>
      </ScrollView>

      {/* Continue Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.continueButton,
            !selectedType && styles.continueButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={!selectedType}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.continueButtonText,
              !selectedType && styles.continueButtonTextDisabled,
            ]}
          >
            {t("common.continue") || "Continue"}
          </Text>
          <Ionicons
            name="arrow-forward"
            size={20}
            color={selectedType ? "#fff" : colors.text.tertiary}
          />
        </TouchableOpacity>
      </View>

      {/* Upgrade Prompt */}
      <UpgradePrompt
        visible={showUpgradePrompt}
        onClose={handleUpgradePromptClose}
        onUpgrade={handleUpgrade}
        type={upgradePromptType}
        featureName={
          upgradePromptType === "feature_locked" ? "Challenges" : undefined
        }
      />

      {/* Subscription Screen */}
      <SubscriptionScreen
        visible={showSubscriptionScreen}
        onClose={() => setShowSubscriptionScreen(false)}
      />
    </View>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[24]),
  },
  subtitle: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    marginBottom: toRN(tokens.spacing[4]),
    textAlign: "center" as const,
  },
  optionsContainer: {
    gap: toRN(tokens.spacing[3]),
  },
  optionCard: {
    padding: toRN(tokens.spacing[4]),
    borderWidth: 2,
    borderColor: "transparent",
  },
  optionCardSelected: {
    borderColor: brand.primary,
  },
  optionCardLocked: {
    opacity: 0.7,
  },
  optionHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[2]),
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: `${brand.primary}15`,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginRight: toRN(tokens.spacing[3]),
  },
  iconContainerSelected: {
    backgroundColor: brand.primary,
  },
  optionTitleContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2]),
  },
  optionTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
  },
  optionTitleSelected: {
    color: brand.primary,
  },
  badge: {
    backgroundColor: `${brand.primary}20`,
    paddingHorizontal: toRN(tokens.spacing[2]),
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: brand.primary,
  },
  premiumBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
    marginTop: 2,
  },
  premiumText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary,
  },
  proBadge: {
    backgroundColor: brand.gradient?.start || "#8B5CF6",
    paddingHorizontal: toRN(tokens.spacing[2]),
    paddingVertical: toRN(2),
    borderRadius: toRN(tokens.borderRadius.sm),
    marginLeft: toRN(tokens.spacing[2]),
  },
  proBadgeText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.bold,
    color: "#FFFFFF",
    textTransform: "uppercase" as const,
  },
  optionDescription: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5,
  },
  optionDescriptionLocked: {
    color: colors.text.tertiary,
  },
  shareableTag: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    marginTop: toRN(tokens.spacing[2]),
    paddingTop: toRN(tokens.spacing[2]),
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  shareableText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: brand.primary,
  },
  infoContainer: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: toRN(tokens.spacing[2]),
    marginTop: toRN(tokens.spacing[4]),
    padding: toRN(tokens.spacing[3]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.lg),
  },
  infoText: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5,
  },
  footer: {
    padding: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[8]),
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    backgroundColor: colors.bg.canvas,
  },
  continueButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[2]),
    backgroundColor: brand.primary,
    paddingVertical: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius.xl),
  },
  continueButtonDisabled: {
    backgroundColor: colors.bg.muted,
  },
  continueButtonText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: "#fff",
  },
  continueButtonTextDisabled: {
    color: colors.text.tertiary,
  },
});
