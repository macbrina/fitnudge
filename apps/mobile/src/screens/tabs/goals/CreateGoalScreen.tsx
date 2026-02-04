import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Keyboard
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Lock } from "lucide-react-native";

import { UpgradePrompt } from "@/components/subscription";
import { BackButton } from "@/components/ui/BackButton";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ReminderTimesPicker } from "@/components/ui/ReminderTimesPicker";
import { ReminderOptionsPicker } from "@/components/ui/ReminderOptionsPicker";
import { TextInput } from "@/components/ui/TextInput";
import { useActiveGoals, useCreateGoal, useGoal, useUpdateGoal } from "@/hooks/api/useGoals";
import { FrequencyType } from "@/services/api/goals";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { toRN } from "@/lib/units";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { useAlertModal } from "@/contexts/AlertModalContext";
import { useTheme } from "@/themes";
import { useStyles } from "@/themes/makeStyles";
import { ApiError } from "@/services/api/base";
import { usePricingStore } from "@/stores/pricingStore";
import { usePostHog } from "@/hooks/usePostHog";

const FREQUENCY_OPTIONS = [1, 2, 3, 4, 5, 6, 7];
const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

// Goal template keys (mapped to translation keys)
const GOAL_TEMPLATE_KEYS = [
  "read_daily",
  "meditate",
  "journal",
  "run_or_walk",
  "sleep_on_time",
  "eat_healthy",
  "work_out_regularly",
  "drink_more_water",
  "no_phone_in_bed"
];

export default function CreateGoalScreen() {
  const params = useLocalSearchParams<{ goalId?: string; mode?: string }>();
  const isEditMode = params.mode === "edit" && params.goalId;

  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { showToast } = useAlertModal();
  const { capture } = usePostHog();

  // Form state
  const [title, setTitle] = useState("");
  const [isDaily, setIsDaily] = useState(false);
  const [frequency, setFrequency] = useState(3);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [reminderTimes, setReminderTimes] = useState<string[]>(["18:00"]);
  const [reminderWindowBeforeMinutes, setReminderWindowBeforeMinutes] = useState(30);
  const [checkinPromptDelayMinutes, setCheckinPromptDelayMinutes] = useState(30);
  const [whyStatement, setWhyStatement] = useState("");
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [showDaysError, setShowDaysError] = useState(false);

  // Track if frequency is locked (after first check-in)
  const [isFrequencyLocked, setIsFrequencyLocked] = useState(false);

  // Validation: for weekly goals, days must match frequency
  const isDaysValid = isDaily || selectedDays.length === frequency;

  // Check goal limits and feature access
  const {
    canCreateGoal,
    openModal: openSubscriptionModal,
    getFeatureValue,
    getActiveGoalLimit
  } = useSubscriptionStore();
  const maxReminderTimes = getFeatureValue("multiple_reminder_times") || 1;
  const { data: activeGoalsResponse } = useActiveGoals();
  const activeGoalCount = activeGoalsResponse?.data?.length || 0;
  const canCreate = canCreateGoal(activeGoalCount);
  const goalLimit = getActiveGoalLimit();
  const paidLimit = usePricingStore().getGoalLimit("premium");

  // Show soft cap warning when approaching 10 goal limit (for premium users)
  const isApproachingLimit = goalLimit !== null && goalLimit >= 10 && activeGoalCount >= 8;
  const goalsRemaining = goalLimit !== null ? goalLimit - activeGoalCount : 0;

  // Load existing goal if editing
  const { data: existingGoalData } = useGoal(isEditMode ? params.goalId || "" : "");

  // Initialize form with existing data
  React.useEffect(() => {
    if (existingGoalData?.data && isEditMode) {
      const goal = existingGoalData.data;
      setTitle(goal.title);
      setIsDaily(goal.frequency_type === "daily");
      setFrequency(goal.frequency_count || 3);
      setSelectedDays(goal.target_days || []);
      setWhyStatement(goal.why_statement || "");
      if (goal.reminder_times?.length) {
        setReminderTimes(goal.reminder_times);
      }
      setReminderWindowBeforeMinutes(goal.reminder_window_before_minutes ?? 30);
      setCheckinPromptDelayMinutes(goal.checkin_prompt_delay_minutes ?? 30);
      // Lock frequency editing if goal has check-ins (prevents streak manipulation)
      setIsFrequencyLocked(goal.total_completions > 0);
    }
  }, [existingGoalData, isEditMode]);

  // Mutations
  const createMutation = useCreateGoal();
  const updateMutation = useUpdateGoal();

  // Toggle day selection - limit to frequency count for weekly goals
  const toggleDay = (dayIndex: number) => {
    setShowDaysError(false);
    setSelectedDays((prev) => {
      if (prev.includes(dayIndex)) {
        return prev.filter((d) => d !== dayIndex);
      }
      // Don't add if already at frequency limit
      if (prev.length >= frequency) {
        return prev;
      }
      return [...prev, dayIndex];
    });
  };

  // Handle frequency change - trim selected days if needed
  const handleFrequencyChange = (newFrequency: number) => {
    setShowDaysError(false);
    setFrequency(newFrequency);
    // If more days selected than new frequency, trim to match
    if (selectedDays.length > newFrequency) {
      setSelectedDays(selectedDays.slice(0, newFrequency));
    }
  };

  // Select template
  const selectTemplate = (templateKey: string) => {
    const templateText = t(`goals.goal_templates.${templateKey}`);
    setTitle(templateText);
  };

  // Validation
  const isTitleValid = title.trim().length >= 3;
  const hasReminderTime = reminderTimes.length > 0;
  const isValid = isTitleValid && isDaysValid && hasReminderTime;

  // Submit handler
  const handleSubmit = useCallback(async () => {
    // Dismiss keyboard if open
    Keyboard.dismiss();

    // Validate days selection for weekly goals
    if (!isDaily && selectedDays.length !== frequency) {
      setShowDaysError(true);
      return;
    }

    if (!isTitleValid) return;

    // Check limits for new goals
    if (!isEditMode && !canCreate) {
      setShowUpgradePrompt(true);
      return;
    }

    const frequencyType: FrequencyType = isDaily ? "daily" : "weekly";
    // For daily goals, set target_days to all days [0-6] for consistent handling
    const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
    const goalData = {
      title: title.trim(),
      frequency_type: frequencyType,
      frequency_count: isDaily ? 7 : frequency,
      target_days: isDaily ? ALL_DAYS : selectedDays,
      reminder_times: reminderTimes.length > 0 ? reminderTimes : ["18:00"],
      reminder_window_before_minutes: reminderWindowBeforeMinutes,
      checkin_prompt_delay_minutes: checkinPromptDelayMinutes,
      why_statement: whyStatement.trim() || undefined
    };

    try {
      if (isEditMode && params.goalId) {
        await updateMutation.mutateAsync({
          goalId: params.goalId,
          updates: goalData
        });
      } else {
        await createMutation.mutateAsync(goalData);
        capture("goal_created", {
          frequency_type: goalData.frequency_type,
          has_why: !!goalData.why_statement
        });
      }
      router.back();
    } catch (error) {
      const defaultMessage = isEditMode ? t("goals.update.error") : t("goals.create.error");
      const errorMessage = error instanceof ApiError ? error.message : defaultMessage;
      showToast({
        title: errorMessage,
        variant: "error"
      });
    }
  }, [
    isTitleValid,
    isEditMode,
    canCreate,
    title,
    isDaily,
    frequency,
    selectedDays,
    reminderTimes,
    reminderWindowBeforeMinutes,
    checkinPromptDelayMinutes,
    whyStatement,
    createMutation,
    updateMutation,
    params.goalId,
    showToast,
    t
  ]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <BackButton
        title={isEditMode ? t("goals.edit_goal") : t("goals.create_goal")}
        onPress={() => router.back()}
      />

      {/* Soft cap warning when approaching 10 goal limit */}
      {isApproachingLimit && !isEditMode && goalsRemaining > 0 && (
        <View style={styles.softCapWarning}>
          <Text style={styles.softCapText}>
            ⚠️ {t("goals.approaching_limit", { remaining: goalsRemaining, limit: goalLimit })}
          </Text>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Goal Templates */}
        {!isEditMode && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>{t("goals.quick_select")}</Text>
            <View style={styles.templatesGrid}>
              {GOAL_TEMPLATE_KEYS.map((templateKey, index) => {
                const templateText = t(`goals.goal_templates.${templateKey}`);
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.templateItem,
                      title === templateText && { borderColor: brandColors.primary }
                    ]}
                    onPress={() => selectTemplate(templateKey)}
                  >
                    <Text style={styles.templateTitle} numberOfLines={2}>
                      {templateText}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>
        )}

        {/* Goal Title */}
        <Card style={styles.section}>
          <TextInput
            label={t("goals.goal_title")}
            placeholder={t("goals.title_placeholder")}
            value={title}
            onChangeText={setTitle}
            multiline
            numberOfLines={3}
            autoCapitalize="sentences"
            containerStyle={styles.inputContainer}
            inputStyle={styles.titleInput}
          />
        </Card>

        {/* Frequency */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t("goals.how_often")}</Text>
            {isFrequencyLocked && (
              <View style={styles.lockedBadge}>
                <Lock size={12} color={colors.text.tertiary} />
                <Text style={styles.lockedText}>{t("goals.frequency_locked")}</Text>
              </View>
            )}
          </View>

          {/* Locked notice */}
          {isFrequencyLocked && (
            <View style={styles.lockedNotice}>
              <Text style={styles.lockedNoticeText}>{t("goals.frequency_locked_hint")}</Text>
            </View>
          )}

          {/* Info notice for new goals - explain restriction upfront */}
          {!isEditMode && !isFrequencyLocked && (
            <View style={styles.infoNotice}>
              <Text style={styles.infoNoticeText}>{t("goals.schedule_info")}</Text>
            </View>
          )}

          {/* Daily vs Weekly Toggle */}
          <View
            style={[styles.frequencyTypeContainer, isFrequencyLocked && styles.disabledContainer]}
          >
            <TouchableOpacity
              style={[
                styles.frequencyTypeOption,
                isDaily && {
                  borderColor: isFrequencyLocked ? colors.text.tertiary : brandColors.primary,
                  backgroundColor:
                    (isFrequencyLocked ? colors.text.tertiary : brandColors.primary) + "10"
                }
              ]}
              onPress={() => !isFrequencyLocked && setIsDaily(true)}
              disabled={isFrequencyLocked}
            >
              <Text
                style={[
                  styles.frequencyTypeText,
                  isDaily && {
                    color: isFrequencyLocked ? colors.text.tertiary : brandColors.primary
                  }
                ]}
              >
                {t("goals.daily")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.frequencyTypeOption,
                !isDaily && {
                  borderColor: isFrequencyLocked ? colors.text.tertiary : brandColors.primary,
                  backgroundColor:
                    (isFrequencyLocked ? colors.text.tertiary : brandColors.primary) + "10"
                }
              ]}
              onPress={() => !isFrequencyLocked && setIsDaily(false)}
              disabled={isFrequencyLocked}
            >
              <Text
                style={[
                  styles.frequencyTypeText,
                  !isDaily && {
                    color: isFrequencyLocked ? colors.text.tertiary : brandColors.primary
                  }
                ]}
              >
                {t("goals.weekly")}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Frequency Picker (for weekly) */}
          {!isDaily && (
            <View
              style={[styles.frequencyContainer, isFrequencyLocked && styles.disabledContainer]}
            >
              {FREQUENCY_OPTIONS.map((freq) => {
                const isSelected = frequency === freq;
                return (
                  <TouchableOpacity
                    key={freq}
                    onPress={() => !isFrequencyLocked && handleFrequencyChange(freq)}
                    disabled={isFrequencyLocked}
                    style={[
                      styles.frequencyOption,
                      isSelected && {
                        borderColor: isFrequencyLocked ? colors.text.tertiary : brandColors.primary,
                        backgroundColor:
                          (isFrequencyLocked ? colors.text.tertiary : brandColors.primary) + "10"
                      }
                    ]}
                  >
                    <Text
                      style={[
                        styles.frequencyText,
                        isSelected && {
                          color: isFrequencyLocked ? colors.text.tertiary : brandColors.primary
                        }
                      ]}
                    >
                      {freq}x
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Days Selection - only shown for weekly goals */}
          {!isDaily && (
            <View style={styles.daysSection}>
              <Text style={styles.subsectionTitle}>{t("goals.which_days")}</Text>
              <Text style={[styles.daysHelper, showDaysError && styles.daysHelperError]}>
                {t("goals.select_days_count", { count: frequency, selected: selectedDays.length })}
              </Text>
              <View style={[styles.daysContainer, isFrequencyLocked && styles.disabledContainer]}>
                {DAYS.map((day, index) => {
                  const isSelected = selectedDays.includes(index);
                  const isDisabled =
                    isFrequencyLocked || (!isSelected && selectedDays.length >= frequency);
                  return (
                    <TouchableOpacity
                      key={day}
                      onPress={() => !isDisabled && toggleDay(index)}
                      disabled={isDisabled}
                      style={[
                        styles.dayOption,
                        isSelected && {
                          backgroundColor: isFrequencyLocked
                            ? colors.text.tertiary
                            : brandColors.primary
                        },
                        isDisabled && !isSelected && styles.dayOptionDisabled
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          isSelected && styles.dayTextSelected,
                          isDisabled && !isSelected && styles.dayTextDisabled
                        ]}
                      >
                        {t(`common.days_of_week.short.${day}`)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </Card>

        {/* Reminder Times - Using ReminderTimesPicker component */}
        <Card style={styles.section}>
          <ReminderTimesPicker
            value={reminderTimes}
            onChange={setReminderTimes}
            maxTimes={maxReminderTimes}
            label={t("goals.reminder_times")}
            description={
              maxReminderTimes === 1
                ? t("goals.reminder_times_free_limit")
                : `${t("goals.reminder_times_premium", { max: maxReminderTimes })}\n\n${t("goals.reminder_times_multiple_hint")}`
            }
          />
          <ReminderOptionsPicker
            reminderBeforeMinutes={reminderWindowBeforeMinutes}
            checkinDelayMinutes={checkinPromptDelayMinutes}
            onReminderBeforeChange={setReminderWindowBeforeMinutes}
            onCheckinDelayChange={setCheckinPromptDelayMinutes}
          />
        </Card>

        {/* Why Statement */}
        <Card style={styles.section}>
          <TextInput
            label={`${t("goals.why_matters")} (${t("common.optional")})`}
            placeholder={t("goals.why_placeholder")}
            value={whyStatement}
            onChangeText={setWhyStatement}
            multiline
            numberOfLines={3}
            containerStyle={styles.inputContainer}
          />
        </Card>

        {/* Submit Button */}
        <Button
          title={isEditMode ? t("goals.update_goal") : t("goals.create_goal")}
          onPress={handleSubmit}
          variant="primary"
          size="md"
          fullWidth
          disabled={!isValid}
          loading={createMutation.isPending || updateMutation.isPending}
        />
      </ScrollView>

      {/* Upgrade Prompt */}
      <UpgradePrompt
        visible={showUpgradePrompt}
        currentLimit={goalLimit}
        paidLimit={paidLimit}
        onClose={() => setShowUpgradePrompt(false)}
        onUpgrade={() => {
          setShowUpgradePrompt(false);
          openSubscriptionModal();
        }}
        type="goal_limit"
      />
    </KeyboardAvoidingView>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas
  },
  header: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingVertical: toRN(tokens.spacing[3])
  },
  headerTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontWeight: tokens.typography.fontWeight.semibold,
    fontFamily: fontFamily.groteskSemiBold,
    color: colors.text.primary
  },
  softCapWarning: {
    backgroundColor: colors.feedback.warning + "20",
    paddingVertical: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[4]),
    borderBottomWidth: 1,
    borderBottomColor: colors.feedback.warning + "40"
  },
  softCapText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskMedium,
    color: colors.feedback.warning,
    textAlign: "center" as const
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[8]),
    gap: toRN(tokens.spacing[4])
  },
  section: {
    padding: toRN(tokens.spacing[4])
  },
  sectionHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    marginBottom: toRN(tokens.spacing[3])
  },
  sectionTitle: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontWeight: tokens.typography.fontWeight.semibold,
    fontFamily: fontFamily.groteskSemiBold,
    color: colors.text.primary
  },
  lockedBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1]),
    backgroundColor: colors.bg.muted,
    paddingHorizontal: toRN(tokens.spacing[2]),
    paddingVertical: toRN(tokens.spacing[1]),
    borderRadius: toRN(tokens.borderRadius.full)
  },
  lockedText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.groteskMedium,
    color: colors.text.tertiary
  },
  lockedNotice: {
    backgroundColor: colors.bg.muted,
    paddingHorizontal: toRN(tokens.spacing[3]),
    paddingVertical: toRN(tokens.spacing[2]),
    borderRadius: toRN(tokens.borderRadius.md),
    marginBottom: toRN(tokens.spacing[3])
  },
  lockedNoticeText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.secondary
  },
  infoNotice: {
    backgroundColor: colors.bg.muted,
    paddingHorizontal: toRN(tokens.spacing[3]),
    paddingVertical: toRN(tokens.spacing[2]),
    borderRadius: toRN(tokens.borderRadius.md),
    marginBottom: toRN(tokens.spacing[3]),
    borderLeftWidth: 3,
    borderLeftColor: brand.primary
  },
  infoNoticeText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.secondary,
    lineHeight: toRN(tokens.typography.fontSize.xs) * 1.4
  },
  disabledContainer: {
    opacity: 0.6
  },
  subsectionTitle: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontWeight: tokens.typography.fontWeight.medium,
    fontFamily: fontFamily.groteskMedium,
    color: colors.text.primary,
    marginTop: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[2])
  },
  optional: {
    fontWeight: tokens.typography.fontWeight.normal,
    color: colors.text.tertiary
  },
  templatesGrid: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: toRN(tokens.spacing[2]),
    justifyContent: "flex-start" as const,
    marginTop: toRN(tokens.spacing[2])
  },
  templateItem: {
    width: "31%" as any,
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.md),
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[2]),
    borderWidth: 1,
    borderColor: "transparent"
  },
  templateTitle: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    color: colors.text.secondary,
    fontFamily: fontFamily.groteskMedium,
    textAlign: "center" as const
  },
  input: {
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.lg),
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[4]),
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.groteskMedium,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.subtle
  },
  textArea: {
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.lg),
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[4]),
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.groteskRegular,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    minHeight: 80
  },
  inputContainer: {
    marginBottom: 0
  },
  titleInput: {
    minHeight: toRN(100)
  },
  frequencyTypeContainer: {
    flexDirection: "row" as const,
    gap: toRN(tokens.spacing[3])
  },
  frequencyTypeOption: {
    flex: 1,
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.lg),
    paddingVertical: toRN(tokens.spacing[3]),
    alignItems: "center" as const,
    borderWidth: 1,
    borderColor: colors.border.subtle
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
    marginTop: toRN(tokens.spacing[3])
  },
  frequencyOption: {
    width: 44,
    height: 44,
    borderRadius: toRN(tokens.borderRadius.lg),
    backgroundColor: colors.bg.muted,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderWidth: 1,
    borderColor: colors.border.subtle
  },
  frequencyText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontWeight: tokens.typography.fontWeight.semibold,
    color: colors.text.primary,
    fontFamily: fontFamily.groteskSemiBold
  },
  daysContainer: {
    flexDirection: "row" as const,
    gap: toRN(tokens.spacing[2])
  },
  dayOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bg.muted,
    alignItems: "center" as const,
    justifyContent: "center" as const
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
    color: colors.text.muted
  },
  dayOptionDisabled: {
    opacity: 0.5
  },
  daysSection: {
    marginTop: toRN(tokens.spacing[4])
  },
  daysHelper: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskMedium,
    color: colors.text.tertiary,
    marginBottom: toRN(tokens.spacing[3])
  },
  daysHelperError: {
    color: colors.feedback.error
  }
});
