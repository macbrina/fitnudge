import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useTranslation } from "@/lib/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useStyles } from "@/themes";
import { useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/ui/BackButton";
import { Card } from "@/components/ui/Card";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { useGoal } from "@/hooks/api/useGoals";
import { useTodayCheckIns, useCheckIns } from "@/hooks/api/useCheckIns";
import { CheckInModal } from "@/screens/tabs/home/components/CheckInModal";
import { CheckIn } from "@/services/api/checkins";
import { Ionicons } from "@expo/vector-icons";
import { formatDate } from "@/utils/helper";
import { PlanSection } from "./components/PlanSection";
import { GoalProgressSection } from "./components/GoalProgressSection";

export default function GoalDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const goalId = params.id;
  const styles = useStyles(makeGoalDetailScreenStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const {
    data: goalResponse,
    isLoading: goalLoading,
    refetch: refetchGoal,
  } = useGoal(goalId || "");
  const {
    data: checkInsResponse,
    isLoading: checkInsLoading,
    refetch: refetchCheckIns,
  } = useCheckIns(goalId || undefined);
  const { data: todayCheckInsResponse, refetch: refetchTodayCheckIns } =
    useTodayCheckIns();

  const goal = goalResponse?.data;
  const checkIns = checkInsResponse?.data || [];

  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [selectedCheckIn, setSelectedCheckIn] = useState<CheckIn | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Find today's check-in for this goal
  const todayCheckIn = useMemo(() => {
    if (!todayCheckInsResponse?.data || !goalId) return null;
    const today = new Date().toISOString().split("T")[0];
    return (
      todayCheckInsResponse.data.find(
        (ci: CheckIn) => ci.goal_id === goalId && ci.date === today
      ) || null
    );
  }, [todayCheckInsResponse, goalId]);

  const handleCheckInPress = () => {
    if (todayCheckIn) {
      setSelectedCheckIn(todayCheckIn);
      setShowCheckInModal(true);
    } else {
      // If no check-in exists for today, we could create one
      // For now, just show message or create via API
      console.log("No check-in for today, need to create one first");
    }
  };

  const handleCheckInComplete = () => {
    refetchTodayCheckIns();
    setShowCheckInModal(false);
    setSelectedCheckIn(null);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchGoal(),
        refetchCheckIns(),
        refetchTodayCheckIns(),
      ]);
    } catch (error) {
      console.error("Error refreshing goal detail:", error);
    } finally {
      setRefreshing(false);
    }
  };

  if (goalLoading) {
    return (
      <View style={styles.container}>
        <BackButton onPress={() => router.back()} />
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
        >
          {/* Description Card Skeleton */}
          <Card shadow="sm" style={styles.descriptionCard}>
            <SkeletonBox
              width="60%"
              height={24}
              borderRadius={toRN(tokens.borderRadius.md)}
            />
            <SkeletonBox
              width="100%"
              height={60}
              borderRadius={toRN(tokens.borderRadius.md)}
              style={{ marginTop: toRN(tokens.spacing[2]) }}
            />
          </Card>

          {/* Meta Row Skeleton */}
          <View style={styles.metaRow}>
            <View style={styles.metaCard}>
              <SkeletonBox
                width="50%"
                height={12}
                borderRadius={toRN(tokens.borderRadius.sm)}
              />
              <SkeletonBox
                width="70%"
                height={20}
                borderRadius={toRN(tokens.borderRadius.sm)}
                style={{ marginTop: toRN(tokens.spacing[1]) }}
              />
            </View>
            <View style={styles.metaCard}>
              <SkeletonBox
                width="50%"
                height={12}
                borderRadius={toRN(tokens.borderRadius.sm)}
              />
              <SkeletonBox
                width="70%"
                height={20}
                borderRadius={toRN(tokens.borderRadius.sm)}
                style={{ marginTop: toRN(tokens.spacing[1]) }}
              />
            </View>
          </View>

          {/* Check-in Button Skeleton */}
          <SkeletonBox
            width="100%"
            height={toRN(tokens.spacing[12])}
            borderRadius={toRN(tokens.borderRadius.xl)}
            style={{ marginBottom: toRN(tokens.spacing[4]) }}
          />

          {/* Plan Section Skeleton */}
          <View style={styles.section}>
            <SkeletonBox
              width="40%"
              height={24}
              borderRadius={toRN(tokens.borderRadius.md)}
            />
            <Card
              shadow="md"
              style={{
                marginTop: toRN(tokens.spacing[4]),
                padding: toRN(tokens.spacing[6]),
              }}
            >
              <SkeletonBox
                width="60%"
                height={20}
                borderRadius={toRN(tokens.borderRadius.md)}
              />
              <SkeletonBox
                width="100%"
                height={100}
                borderRadius={toRN(tokens.borderRadius.md)}
                style={{ marginTop: toRN(tokens.spacing[4]) }}
              />
            </Card>
          </View>

          {/* Check-ins History Skeleton */}
          <View style={styles.section}>
            <SkeletonBox
              width="50%"
              height={24}
              borderRadius={toRN(tokens.borderRadius.md)}
            />
            {[1, 2, 3].map((i) => (
              <Card
                key={i}
                shadow="sm"
                style={{
                  padding: toRN(tokens.spacing[4]),
                  marginTop: toRN(tokens.spacing[3]),
                }}
              >
                <SkeletonBox
                  width="30%"
                  height={16}
                  borderRadius={toRN(tokens.borderRadius.sm)}
                />
                <SkeletonBox
                  width="80%"
                  height={14}
                  borderRadius={toRN(tokens.borderRadius.sm)}
                  style={{ marginTop: toRN(tokens.spacing[1]) }}
                />
              </Card>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  if (!goal) {
    return (
      <View style={styles.container}>
        <BackButton onPress={() => router.back()} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{t("common.error")}</Text>
        </View>
      </View>
    );
  }

  // Use is_checked_in (user has responded) not completed (user did the goal)
  const canCheckIn = todayCheckIn && !todayCheckIn.is_checked_in;

  return (
    <View style={styles.container}>
      <BackButton
        onPress={() => router.back()}
        title={goal.title}
        titleCentered
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
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
        {/* Goal Description */}
        <Card shadow="sm" style={styles.descriptionCard}>
          <Text style={styles.goalTitle}>{goal.title}</Text>
          {goal.description && (
            <Text style={styles.description}>{goal.description}</Text>
          )}
        </Card>

        {/* Goal Meta Info */}
        <View style={styles.metaRow}>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>{t("goals.category")}</Text>
            <Text style={styles.metaValue}>
              {t(`goals.category_${goal.category}`)}
            </Text>
          </View>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>{t("goals.plan.frequency")}</Text>
            <Text style={styles.metaValue}>
              {t(`goals.frequency.${goal.frequency}`)}
            </Text>
          </View>
        </View>

        {/* Scheduled Days - Show for weekly goals */}
        {goal.frequency === "weekly" &&
          goal.days_of_week &&
          goal.days_of_week.length > 0 && (
            <View style={styles.scheduledDaysCard}>
              <Text style={styles.metaLabel}>
                {t("goals.scheduled_days") || "Scheduled Days"}
              </Text>
              <View style={styles.daysRow}>
                {["S", "M", "T", "W", "T", "F", "S"].map((dayLabel, index) => {
                  const isActive = (goal.days_of_week || []).includes(index);
                  return (
                    <View
                      key={index}
                      style={[
                        styles.dayBadge,
                        isActive && styles.dayBadgeActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayBadgeText,
                          isActive && styles.dayBadgeTextActive,
                        ]}
                      >
                        {dayLabel}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

        {/* Check In Button */}
        {canCheckIn && (
          <TouchableOpacity
            style={styles.checkInButton}
            onPress={handleCheckInPress}
            activeOpacity={0.8}
          >
            <Ionicons
              name="checkmark-circle"
              size={toRN(tokens.typography.fontSize.xl)}
              color="#FFFFFF"
            />
            <Text style={styles.checkInButtonText}>
              {t("home.complete_checkin")}
            </Text>
          </TouchableOpacity>
        )}

        {/* No check-in scheduled for today */}
        {!todayCheckIn && goal.is_active && (
          <View style={styles.noCheckInCard}>
            <Ionicons
              name="calendar-outline"
              size={toRN(tokens.typography.fontSize.xl)}
              color={colors.text.tertiary}
            />
            <Text style={styles.noCheckInText}>
              {t("home.no_checkins_message")}
            </Text>
          </View>
        )}

        {todayCheckIn?.is_checked_in && (
          <Card shadow="sm" style={styles.completedCard}>
            <View style={styles.completedHeader}>
              <Ionicons
                name={
                  todayCheckIn.completed ? "checkmark-circle" : "close-circle"
                }
                size={toRN(tokens.typography.fontSize.xl)}
                color={
                  todayCheckIn.completed
                    ? colors.feedback.success
                    : colors.feedback.error
                }
              />
              <Text style={styles.completedText}>
                {todayCheckIn.completed
                  ? t("checkin.completed_today")
                  : t("checkin.marked_incomplete")}
              </Text>
            </View>
          </Card>
        )}

        {/* Goal Progress Section - Individual stats for this goal */}
        <GoalProgressSection
          goalId={goal.id}
          goalType={goal.goal_type}
          targetCheckins={goal.target_checkins}
          challengeStartDate={goal.challenge_start_date}
          challengeEndDate={goal.challenge_end_date}
          frequency={goal.frequency}
          daysOfWeek={goal.days_of_week}
        />

        {/* AI Actionable Plan Section */}
        <PlanSection goalId={goal.id} />

        {/* Check-Ins History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("checkin.checkin_history")}
          </Text>
          {checkInsLoading ? (
            <View>
              {[1, 2, 3].map((i) => (
                <SkeletonBox
                  key={i}
                  width="100%"
                  height={60}
                  style={{ marginBottom: toRN(tokens.spacing[3]) }}
                />
              ))}
            </View>
          ) : checkIns.length === 0 ? (
            <Card shadow="sm" style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                {t("checkin.no_checkins_yet")}
              </Text>
            </Card>
          ) : (
            <View style={styles.checkInsList}>
              {checkIns.slice(0, 10).map((checkIn: CheckIn) => (
                <Card key={checkIn.id} shadow="sm" style={styles.checkInCard}>
                  <View style={styles.checkInCardContent}>
                    <View style={styles.checkInCardLeft}>
                      <Text style={styles.checkInDate}>
                        {formatDate(checkIn.date, "short")}
                      </Text>
                      {checkIn.reflection && (
                        <Text
                          style={styles.checkInReflection}
                          numberOfLines={2}
                        >
                          {checkIn.reflection}
                        </Text>
                      )}
                    </View>
                    <View style={styles.checkInCardRight}>
                      {checkIn.completed ? (
                        <Ionicons
                          name="checkmark-circle"
                          size={24}
                          color={colors.feedback.success}
                        />
                      ) : (
                        <Ionicons
                          name="ellipse-outline"
                          size={24}
                          color={colors.text.tertiary}
                        />
                      )}
                      {checkIn.mood && (
                        <Text style={styles.checkInMood}>
                          {["😞", "😐", "😊", "😄", "🤩"][checkIn.mood - 1]}
                        </Text>
                      )}
                    </View>
                  </View>
                </Card>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Check-In Modal */}
      {selectedCheckIn && (
        <CheckInModal
          visible={showCheckInModal}
          checkIn={selectedCheckIn}
          onClose={() => {
            setShowCheckInModal(false);
            setSelectedCheckIn(null);
          }}
          onComplete={handleCheckInComplete}
        />
      )}
    </View>
  );
}

const makeGoalDetailScreenStyles = (
  tokens: any,
  colors: any,
  brandColors: any
) => ({
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
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: toRN(tokens.spacing[6]),
  },
  errorText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
  },
  descriptionCard: {
    marginBottom: toRN(tokens.spacing[4]),
    padding: toRN(tokens.spacing[4]),
    backgroundColor: colors.bg.card,
  },
  description: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.primary,
    lineHeight: toRN(tokens.typography.fontSize.base) * 1.6,
  },
  metaRow: {
    flexDirection: "row",
    gap: toRN(tokens.spacing[3]),
    marginBottom: toRN(tokens.spacing[4]),
  },
  metaCard: {
    flex: 1,
    backgroundColor: colors.bg.card,
    padding: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius.lg),
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  goalTitle: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[2]),
  },
  metaLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.groteskMedium,
    color: colors.text.tertiary,
    marginBottom: toRN(tokens.spacing[1]),
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  metaValue: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.groteskSemiBold,
    color: colors.text.primary,
  },
  scheduledDaysCard: {
    backgroundColor: colors.bg.card,
    padding: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius.lg),
    borderWidth: 1,
    borderColor: colors.border.default,
    marginBottom: toRN(tokens.spacing[4]),
  },
  daysRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    marginTop: toRN(tokens.spacing[2]),
  },
  dayBadge: {
    width: toRN(tokens.spacing[8]),
    height: toRN(tokens.spacing[8]),
    borderRadius: toRN(tokens.borderRadius.full),
    backgroundColor: colors.bg.muted,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  dayBadgeActive: {
    backgroundColor: brandColors.primary,
  },
  dayBadgeText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.groteskSemiBold,
    color: colors.text.tertiary,
  },
  dayBadgeTextActive: {
    color: "#FFFFFF",
  },
  checkInButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: brandColors.primary,
    paddingVertical: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius.xl),
    marginBottom: toRN(tokens.spacing[4]),
    gap: toRN(tokens.spacing[2]),
  },
  checkInButtonText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.bold,
    color: "#FFFFFF",
  },
  completedCard: {
    marginBottom: toRN(tokens.spacing[4]),
    padding: toRN(tokens.spacing[4]),
  },
  completedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: toRN(tokens.spacing[2]),
  },
  completedText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
  },
  noCheckInCard: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: colors.bg.muted,
    padding: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius.lg),
    marginBottom: toRN(tokens.spacing[4]),
    gap: toRN(tokens.spacing[3]),
  },
  noCheckInText: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
  },
  section: {
    marginTop: toRN(tokens.spacing[4]),
  },
  sectionTitle: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[4]),
  },
  emptyCard: {
    padding: toRN(tokens.spacing[6]),
    alignItems: "center",
  },
  emptyText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
  },
  checkInsList: {
    gap: toRN(tokens.spacing[3]),
  },
  checkInCard: {
    padding: toRN(tokens.spacing[4]),
  },
  checkInCardContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  checkInCardLeft: {
    flex: 1,
    marginRight: toRN(tokens.spacing[3]),
  },
  checkInDate: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[1]),
  },
  checkInReflection: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
  },
  checkInCardRight: {
    alignItems: "center",
    gap: toRN(tokens.spacing[1]),
  },
  checkInMood: {
    fontSize: toRN(tokens.typography.fontSize.lg),
  },
});
