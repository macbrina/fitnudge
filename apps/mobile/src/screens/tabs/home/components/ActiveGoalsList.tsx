import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
} from "react-native";
import { useStyles } from "@/themes";
import { useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { Card } from "@/components/ui/Card";
import { GoalCard } from "./GoalCard";
import { EmptyState } from "./EmptyState";
import { useRouter } from "expo-router";
import { MOBILE_ROUTES } from "@/lib/routes";
import { SkeletonBox, SkeletonCard } from "@/components/ui/SkeletonBox";

interface ActiveGoalsListProps {
  goals: any[];
  isLoading: boolean;
}

export function ActiveGoalsList({ goals, isLoading }: ActiveGoalsListProps) {
  const styles = useStyles(makeActiveGoalsListStyles);
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();

  // Calculate card width: screen width minus HomeScreen content padding (spacing[4]) and scrollContent padding (spacing[1])
  const cardWidth =
    screenWidth - (toRN(tokens.spacing[4]) + toRN(tokens.spacing[1])) * 2;

  if (isLoading) {
    const cardWidth =
      screenWidth - (toRN(tokens.spacing[4]) + toRN(tokens.spacing[1])) * 2;

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <SkeletonBox
            width="40%"
            height={toRN(tokens.typography.fontSize.xl)}
            borderRadius={toRN(tokens.borderRadius.base)}
          />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          pagingEnabled
          contentContainerStyle={styles.scrollContent}
        >
          {[1, 2, 3].map((i) => (
            <SkeletonCard
              key={i}
              width={cardWidth}
              height={120}
              padding={toRN(tokens.spacing[4])}
              style={styles.fullWidthCard}
            />
          ))}
        </ScrollView>
      </View>
    );
  }

  if (!goals || goals.length === 0) {
    return (
      <View style={styles.container}>
        <Card shadow="md" style={styles.emptyCard}>
          <Text style={styles.emptyCardTitle}>
            {t("home.active_goals_title")}
          </Text>
          <EmptyState
            icon="🎯"
            title={t("home.no_goals_title")}
            message={t("home.no_goals_message")}
          />
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => router.push(MOBILE_ROUTES.GOALS.CREATE)}
          >
            <Text style={styles.createButtonText}>
              {t("home.create_first_goal")}
            </Text>
          </TouchableOpacity>
        </Card>
      </View>
    );
  }

  const handleGoalPress = (goalId: string) => {
    router.push(`${MOBILE_ROUTES.GOALS.DETAILS}?id=${goalId}`);
  };

  const handleViewAll = () => {
    router.push(MOBILE_ROUTES.GOALS.LIST);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>{t("home.active_goals_title")}</Text>
        {goals.length > 5 && (
          <TouchableOpacity onPress={handleViewAll}>
            <Text style={styles.viewAllText}>{t("home.view_all")}</Text>
          </TouchableOpacity>
        )}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        pagingEnabled
        contentContainerStyle={styles.scrollContent}
      >
        {goals.slice(0, 5).map((goal) => (
          <GoalCard
            key={goal.id}
            goal={goal}
            onPress={() => handleGoalPress(goal.id)}
            style={[styles.fullWidthCard, { width: cardWidth }]}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const makeActiveGoalsListStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    marginBottom: toRN(tokens.spacing[6]),
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[1]),
  },
  sectionTitle: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
  },
  viewAllText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: brand.primary,
  },
  scrollContent: {
    paddingHorizontal: toRN(tokens.spacing[1]),
  },
  fullWidthCard: {
    marginRight: toRN(tokens.spacing[3]),
  },
  emptyCard: {
    marginBottom: 0,
  },
  emptyCardTitle: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[4]),
  },
  createButton: {
    backgroundColor: brand.primary,
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[6]),
    borderRadius: toRN(tokens.borderRadius.full),
    alignSelf: "center",
    marginTop: toRN(tokens.spacing[4]),
  },
  createButtonText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.onPrimary,
  },
});
