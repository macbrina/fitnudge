import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useTranslation } from "@/lib/i18n";
import { fontFamily } from "@/lib/fonts";
import { toRN } from "@/lib/units";
import { useStyles } from "@/themes/makeStyles";
import { lineHeight } from "@/themes/tokens";
import { useTheme } from "@/themes";
import PersonalizationLayout from "./PersonalizationLayout";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { ReminderTimesPicker } from "@/components/ui/ReminderTimesPicker";
import { useSubscriptionStore } from "@/stores/subscriptionStore";

interface GoalDetailsScreenProps {
  goalType: string;
  goalTitle: string;
  onContinue: (details: GoalDetails) => void;
  onBack?: () => void;
  currentStep: number;
  totalSteps: number;
}

export interface GoalDetails {
  frequency: number;
  isDaily: boolean;
  days: string[];
  reminderTimes: string[]; // Array of HH:MM format strings
}

const FREQUENCY_OPTIONS = [1, 2, 3, 4, 5, 6, 7];
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export default function GoalDetailsScreen({
  goalType,
  goalTitle,
  onContinue,
  onBack,
  currentStep,
  totalSteps
}: GoalDetailsScreenProps) {
  // Get initial values from store (persisted)
  const storedFrequency = useOnboardingStore((state) => state.goal_frequency);
  const storedIsDaily = useOnboardingStore((state) => state.goal_is_daily);
  const storedDays = useOnboardingStore((state) => state.goal_days);
  const storedReminderTime = useOnboardingStore((state) => state.goal_reminder_time);

  const [isDaily, setIsDaily] = useState<boolean>(storedIsDaily);
  const [frequency, setFrequency] = useState<number>(storedFrequency);
  const [selectedDays, setSelectedDays] = useState<string[]>(storedDays);
  const [reminderTimes, setReminderTimes] = useState<string[]>(
    storedReminderTime ? [storedReminderTime] : ["18:00"]
  );
  const [showDaysError, setShowDaysError] = useState<boolean>(false);

  // Get max reminder times from subscription features (during onboarding, user is free tier)
  const { getFeatureValue } = useSubscriptionStore();
  const maxReminderTimes = getFeatureValue("multiple_reminder_times") || 1;

  // Validation: for weekly goals, days must match frequency
  const isDaysValid = isDaily || selectedDays.length === frequency;

  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { brandColors } = useTheme();

  // Toggle day selection - limit to frequency count
  const toggleDay = (day: string) => {
    setShowDaysError(false); // Clear error on interaction
    setSelectedDays((prev) => {
      // If already selected, remove it
      if (prev.includes(day)) {
        return prev.filter((d) => d !== day);
      }
      // If at max selection, don't add more
      if (prev.length >= frequency) {
        return prev;
      }
      // Add the new day
      return [...prev, day];
    });
  };

  // When frequency changes, trim selected days if needed
  const handleFrequencyChange = (newFrequency: number) => {
    setShowDaysError(false); // Clear error on interaction
    setFrequency(newFrequency);
    // If more days selected than new frequency, trim to match
    if (selectedDays.length > newFrequency) {
      setSelectedDays(selectedDays.slice(0, newFrequency));
    }
  };

  const handleContinue = () => {
    // Validate days selection for weekly goals
    if (!isDaily && selectedDays.length !== frequency) {
      setShowDaysError(true);
      return;
    }

    onContinue({
      frequency: isDaily ? 7 : frequency,
      isDaily,
      days: selectedDays,
      reminderTimes: reminderTimes.length > 0 ? reminderTimes : ["18:00"]
    });
  };

  // Can continue: (daily OR days match frequency) AND has reminder time
  const hasReminderTime = reminderTimes.length > 0;
  const canContinue = isDaysValid && hasReminderTime;

  return (
    <PersonalizationLayout
      currentStep={currentStep}
      totalSteps={totalSteps}
      onContinue={handleContinue}
      onBack={onBack}
      canContinue={canContinue}
      buttonText={t("common.continue")}
    >
      <View style={styles.content}>
        {/* Goal Title with Subtitle */}
        <Text style={styles.subtitle}>{t("onboarding.goal_details.subtitle")}</Text>
        <Text style={styles.goalTitle}>{goalTitle}</Text>

        {/* Schedule Section Card */}
        <View style={styles.sectionCard}>
          {/* Frequency Type Toggle */}
          <Text style={styles.label}>{t("onboarding.goal_details.how_often")}</Text>
          <View style={styles.frequencyTypeContainer}>
            <TouchableOpacity
              style={[
                styles.frequencyTypeOption,
                isDaily && [
                  styles.frequencyTypeOptionSelected,
                  { borderColor: brandColors.primary }
                ]
              ]}
              onPress={() => setIsDaily(true)}
            >
              <Text style={[styles.frequencyTypeText, isDaily && { color: brandColors.primary }]}>
                {t("onboarding.custom_goal.daily")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.frequencyTypeOption,
                !isDaily && [
                  styles.frequencyTypeOptionSelected,
                  { borderColor: brandColors.primary }
                ]
              ]}
              onPress={() => setIsDaily(false)}
            >
              <Text style={[styles.frequencyTypeText, !isDaily && { color: brandColors.primary }]}>
                {t("onboarding.custom_goal.times_per_week")}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Frequency Picker (only shown if not daily) */}
          {!isDaily && (
            <>
              <View style={styles.frequencyContainer}>
                {FREQUENCY_OPTIONS.map((freq) => {
                  const isSelected = frequency === freq;
                  return (
                    <TouchableOpacity
                      key={freq}
                      onPress={() => handleFrequencyChange(freq)}
                      style={[
                        styles.frequencyOption,
                        isSelected && [
                          styles.frequencyOptionSelected,
                          { borderColor: brandColors.primary }
                        ]
                      ]}
                    >
                      <Text
                        style={[styles.frequencyText, isSelected && { color: brandColors.primary }]}
                      >
                        {freq}x
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Days Selection - limited to frequency count */}
              <View style={styles.daysSection}>
                <Text style={styles.label}>{t("onboarding.goal_details.which_days")}</Text>
                <Text style={[styles.daysHelper, showDaysError && styles.daysHelperError]}>
                  {t("onboarding.goal_details.select_exact_days", {
                    count: frequency,
                    selected: selectedDays.length
                  }) || `Select exactly ${frequency} days (${selectedDays.length}/${frequency})`}
                </Text>
                <View style={styles.daysContainer}>
                  {DAYS.map((day) => {
                    const isSelected = selectedDays.includes(day);
                    const isDisabled = !isSelected && selectedDays.length >= frequency;
                    return (
                      <TouchableOpacity
                        key={day}
                        onPress={() => toggleDay(day)}
                        disabled={isDisabled}
                        style={[
                          styles.dayOption,
                          isSelected && { backgroundColor: brandColors.primary },
                          isDisabled && styles.dayOptionDisabled
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            isSelected && styles.dayTextSelected,
                            isDisabled && styles.dayTextDisabled
                          ]}
                        >
                          {t(`common.days_of_week.short.${day}`)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {showDaysError && (
                  <Text style={styles.errorText}>
                    {t("onboarding.goal_details.days_required_error", { count: frequency }) ||
                      `Please select exactly ${frequency} days`}
                  </Text>
                )}
              </View>
            </>
          )}
        </View>

        {/* Reminder Section Card */}
        <View style={styles.sectionCard}>
          <ReminderTimesPicker
            value={reminderTimes}
            onChange={setReminderTimes}
            maxTimes={maxReminderTimes}
            label={t("onboarding.goal_details.checkin_time")}
            description={maxReminderTimes === 1 ? t("goals.reminder_times_free_limit") : undefined}
          />
        </View>
      </View>
    </PersonalizationLayout>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => {
  return {
    content: {
      flex: 1,
      paddingTop: toRN(tokens.spacing[4])
    },
    subtitle: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      fontWeight: tokens.typography.fontWeight.medium,
      color: colors.text.tertiary,
      marginBottom: toRN(tokens.spacing[2]),
      fontFamily: fontFamily.groteskMedium,
      textTransform: "uppercase" as const,
      letterSpacing: 0.5
    },
    goalTitle: {
      fontSize: toRN(tokens.typography.fontSize.xl),
      fontWeight: tokens.typography.fontWeight.bold,
      color: colors.text.primary,
      marginBottom: toRN(tokens.spacing[4]),
      fontFamily: fontFamily.groteskBold,
      lineHeight: lineHeight(tokens.typography.fontSize.xl, tokens.typography.lineHeight.tight)
    },
    sectionCard: {
      backgroundColor: colors.bg.card,
      borderRadius: toRN(tokens.borderRadius.xl),
      padding: toRN(tokens.spacing[4]),
      marginBottom: toRN(tokens.spacing[4])
    },
    label: {
      fontSize: toRN(tokens.typography.fontSize.base),
      fontWeight: tokens.typography.fontWeight.medium,
      color: colors.text.primary,
      marginBottom: toRN(tokens.spacing[3]),
      fontFamily: fontFamily.groteskMedium
    },
    frequencyTypeContainer: {
      flexDirection: "row" as const,
      gap: toRN(tokens.spacing[3]),
      marginBottom: toRN(tokens.spacing[4])
    },
    frequencyTypeOption: {
      flex: 1,
      backgroundColor: colors.bg.card,
      borderRadius: toRN(tokens.borderRadius.lg),
      paddingVertical: toRN(tokens.spacing[3]),
      alignItems: "center" as const,
      borderWidth: 2,
      borderColor: colors.border.subtle
    },
    frequencyTypeOptionSelected: {
      backgroundColor: brand.primary + "10"
    },
    frequencyTypeText: {
      fontSize: toRN(tokens.typography.fontSize.base),
      fontWeight: tokens.typography.fontWeight.medium,
      color: colors.text.secondary,
      fontFamily: fontFamily.groteskMedium
    },
    frequencyContainer: {
      flexDirection: "row" as const,
      gap: toRN(tokens.spacing[2]),
      marginBottom: toRN(tokens.spacing[4]),
      marginTop: toRN(tokens.spacing[4])
    },
    frequencyOption: {
      width: 44,
      height: 44,
      borderRadius: toRN(tokens.borderRadius.lg),
      backgroundColor: colors.bg.card,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      borderWidth: 2,
      borderColor: colors.border.subtle
    },
    frequencyOptionSelected: {
      backgroundColor: brand.primary + "10"
    },
    frequencyText: {
      fontSize: toRN(tokens.typography.fontSize.base),
      fontWeight: tokens.typography.fontWeight.semibold,
      color: colors.text.primary,
      fontFamily: fontFamily.groteskSemiBold
    },
    optional: {
      color: colors.text.tertiary,
      fontWeight: tokens.typography.fontWeight.normal
    },
    daysSection: {
      marginBottom: 0,
      marginTop: toRN(tokens.spacing[4])
    },
    daysHelper: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      color: colors.text.tertiary,
      fontFamily: fontFamily.bold,
      marginBottom: toRN(tokens.spacing[3])
    },
    daysHelperError: {
      color: colors.feedback?.error || "#ef4444"
    },
    errorText: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      color: colors.feedback?.error || "#ef4444",
      fontFamily: fontFamily.groteskRegular,
      marginTop: toRN(tokens.spacing[2])
    },
    daysContainer: {
      flexDirection: "row" as const,
      gap: toRN(tokens.spacing[2])
    },
    dayOption: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.bg.card,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      borderWidth: 2,
      borderColor: colors.border.subtle
    },
    dayOptionDisabled: {
      opacity: 0.3
    },
    dayText: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      fontWeight: tokens.typography.fontWeight.medium,
      color: colors.text.secondary,
      fontFamily: fontFamily.groteskMedium
    },
    dayTextSelected: {
      color: "#fff"
    },
    dayTextDisabled: {
      color: colors.text.tertiary
    }
  };
};
