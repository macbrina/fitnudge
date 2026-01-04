import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Card } from "@/components/ui/Card";
import { useStyles } from "@/themes";
import { useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/lib/i18n";
import { ExerciseCard } from "./ExerciseCard";

interface WorkoutPlanCardProps {
  plan: any; // Full structured_data from actionable_plans
}

export function WorkoutPlanCard({ plan }: WorkoutPlanCardProps) {
  const styles = useStyles(makeWorkoutPlanCardStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  const structure = plan.structure || {};
  const routine = structure.routine || {};
  const schedule = structure.schedule || {};
  const progression = structure.progression || {};
  const exercises = routine.exercises || [];

  return (
    <Card shadow="lg" style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons name="barbell" size={28} color={brandColors.primary} />
        </View>
        <Text style={styles.cardTitle}>{t("goals.plan.workout_title")}</Text>
      </View>

      {/* Exercise Routine */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t("goals.plan.exercise_routine")}</Text>
          {routine.duration_minutes && (
            <View style={styles.durationBadge}>
              <Ionicons name="time-outline" size={14} color={colors.text.secondary} />
              <Text style={styles.durationText}>
                {routine.duration_minutes} {t("common.minutes")}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.exerciseList}>
          {exercises
            .slice(0, isExpanded ? exercises.length : 4)
            .map((exercise: any, index: number) => (
              <ExerciseCard key={index} exercise={exercise} index={index} />
            ))}
        </View>

        {exercises.length > 4 && (
          <TouchableOpacity style={styles.expandButton} onPress={() => setIsExpanded(!isExpanded)}>
            <Text style={styles.expandText}>
              {isExpanded
                ? t("common.show_less")
                : t("common.show_more", { count: exercises.length - 4 })}
            </Text>
            <Ionicons
              name={isExpanded ? "chevron-up" : "chevron-down"}
              size={16}
              color={brandColors.primary}
            />
          </TouchableOpacity>
        )}

        {routine.warm_up && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t("goals.plan.warm_up")}:</Text>
            <Text style={styles.infoValue}>{routine.warm_up}</Text>
          </View>
        )}
        {routine.cool_down && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t("goals.plan.cool_down")}:</Text>
            <Text style={styles.infoValue}>{routine.cool_down}</Text>
          </View>
        )}
      </View>

      {/* Schedule */}
      {schedule.days_per_week && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("goals.plan.schedule")}</Text>
          <View style={styles.scheduleInfo}>
            <Ionicons name="calendar-outline" size={20} color={colors.text.secondary} />
            <Text style={styles.scheduleText}>
              {schedule.days_per_week} {t("goals.plan.days_per_week")}
            </Text>
          </View>
        </View>
      )}

      {/* Progression */}
      {progression.increment && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("goals.plan.progression")}</Text>
          <Text style={styles.progressionText}>{progression.increment}</Text>
        </View>
      )}
    </Card>
  );
}

const makeWorkoutPlanCardStyles = (tokens: any, colors: any, brand: any) => ({
  card: {
    marginBottom: toRN(tokens.spacing[4])
  },
  header: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[3]),
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default
  },
  iconContainer: {
    width: toRN(tokens.spacing[10]),
    height: toRN(tokens.spacing[10]),
    borderRadius: toRN(tokens.borderRadius.full),
    backgroundColor: brand.primary + "1A", // 10% opacity
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginRight: toRN(tokens.spacing[3])
  },
  cardTitle: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.groteskBold,
    color: colors.text.primary
  },
  section: {
    marginBottom: toRN(tokens.spacing[4])
  },
  sectionHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[3])
  },
  sectionTitle: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary
  },
  durationBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1]),
    paddingVertical: toRN(tokens.spacing[0.5]),
    paddingHorizontal: toRN(tokens.spacing[2]),
    borderRadius: toRN(tokens.borderRadius.full),
    backgroundColor: colors.bg.muted
  },
  durationText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary
  },
  exerciseList: {
    gap: toRN(tokens.spacing[0])
  },
  expandButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[1]),
    paddingVertical: toRN(tokens.spacing[2]),
    marginTop: toRN(tokens.spacing[2])
  },
  expandText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: brand.primary
  },
  infoRow: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: toRN(tokens.spacing[2]),
    marginTop: toRN(tokens.spacing[2])
  },
  infoLabel: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.text.secondary
  },
  infoValue: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.primary
  },
  scheduleInfo: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2]),
    paddingVertical: toRN(tokens.spacing[2])
  },
  scheduleText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.primary
  },
  progressionText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.secondary,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5
  }
});
