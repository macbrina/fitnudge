import React, { useState, useMemo } from "react";
import { View, Text, TouchableOpacity, Switch, ScrollView } from "react-native";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { useAlertModal } from "@/contexts/AlertModalContext";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { toRN } from "@/lib/units";
import { useStyles, useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { Ionicons } from "@expo/vector-icons";
import { useShareGoalAsChallenge } from "@/hooks/api/useChallenges";
import { Goal } from "@/services/api/goals";

interface ShareAsChallengeModalProps {
  visible: boolean;
  goal: Goal;
  onClose: () => void;
  onSuccess?: (challengeId: string) => void;
}

type ArchiveOption = "archive" | "keep_active";

export function ShareAsChallengeModal({
  visible,
  goal,
  onClose,
  onSuccess,
}: ShareAsChallengeModalProps) {
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const { showAlert, showToast } = useAlertModal();

  const shareAsChallenge = useShareGoalAsChallenge();

  // Form state
  const [isPublic, setIsPublic] = useState(false);
  const [archiveOption, setArchiveOption] = useState<ArchiveOption>("archive");

  // Calculate start date (tomorrow)
  const startDate = useMemo(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  }, []);

  // Calculate join deadline (day before start)
  const joinDeadline = useMemo(() => {
    const deadline = new Date(startDate);
    deadline.setDate(deadline.getDate() - 1);
    deadline.setHours(23, 59, 59, 999);
    return deadline;
  }, [startDate]);

  // Format date for display
  const formatDate = (date: Date) => {
    return date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const handleCreateChallenge = async () => {
    try {
      const response = await shareAsChallenge.mutateAsync({
        goalId: goal.id,
        data: {
          title: goal.title,
          description: goal.description,
          start_date: startDate.toISOString(),
          join_deadline: joinDeadline.toISOString(),
          is_public: isPublic,
        },
      });

      if (response.data) {
        showToast({
          title: t("goals.share_as_challenge_success") || "Challenge Created!",
          message:
            archiveOption === "archive"
              ? t("goals.share_as_challenge_archived") ||
                "Your goal has been archived."
              : undefined,
          variant: "success",
          duration: 3000,
        });

        onSuccess?.(response.data.challenge_id);
        onClose();
      }
    } catch (error: any) {
      await showAlert({
        title: t("common.error"),
        message: error?.message || t("goals.share_as_challenge_error"),
        variant: "error",
        confirmLabel: t("common.ok"),
      });
    }
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={t("goals.share_as_challenge_title") || "Share as Challenge"}
    >
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Goal Info */}
        <View style={styles.goalInfo}>
          <Ionicons
            name="trophy-outline"
            size={20}
            color={colors.text.secondary}
          />
          <Text style={styles.goalTitle} numberOfLines={2}>
            {goal.title}
          </Text>
        </View>

        {/* Warning Message */}
        <View style={styles.warningContainer}>
          <Ionicons
            name="information-circle-outline"
            size={20}
            color={brandColors.primary}
          />
          <Text style={styles.warningText}>
            {t("goals.share_as_challenge_warning") ||
              "Your challenge will start fresh for everyone (Day 1). Your current progress won't transfer to the challenge."}
          </Text>
        </View>

        {/* Challenge Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Challenge Details</Text>

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Ionicons
                name="calendar-outline"
                size={18}
                color={colors.text.secondary}
              />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Starts</Text>
              <Text style={styles.detailValue}>{formatDate(startDate)}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Ionicons
                name="time-outline"
                size={18}
                color={colors.text.secondary}
              />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Join Deadline</Text>
              <Text style={styles.detailValue}>{formatDate(joinDeadline)}</Text>
            </View>
          </View>
        </View>

        {/* Visibility Toggle */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Visibility</Text>

          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Ionicons
                name={isPublic ? "globe-outline" : "lock-closed-outline"}
                size={20}
                color={colors.text.secondary}
              />
              <View style={styles.toggleText}>
                <Text style={styles.toggleLabel}>
                  {isPublic ? "Public Challenge" : "Private Challenge"}
                </Text>
                <Text style={styles.toggleDescription}>
                  {isPublic
                    ? "Anyone can discover and join this challenge"
                    : "Only people you invite can join"}
                </Text>
              </View>
            </View>
            <Switch
              value={isPublic}
              onValueChange={setIsPublic}
              trackColor={{
                false: colors.bg.muted,
                true: brandColors.primary + "40",
              }}
              thumbColor={isPublic ? brandColors.primary : colors.bg.surface}
            />
          </View>
        </View>

        {/* Archive Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>After Creating Challenge</Text>

          <TouchableOpacity
            style={[
              styles.optionCard,
              archiveOption === "archive" && styles.optionCardSelected,
            ]}
            onPress={() => setArchiveOption("archive")}
          >
            <View style={styles.optionRadio}>
              {archiveOption === "archive" ? (
                <View style={styles.radioSelected}>
                  <View style={styles.radioInner} />
                </View>
              ) : (
                <View style={styles.radioUnselected} />
              )}
            </View>
            <View style={styles.optionContent}>
              <Text
                style={[
                  styles.optionLabel,
                  archiveOption === "archive" && styles.optionLabelSelected,
                ]}
              >
                {t("goals.archive_goal_option") || "Archive goal (recommended)"}
              </Text>
              <Text style={styles.optionDescription}>
                {t("goals.archive_goal_option_description") ||
                  "Only track progress in the challenge"}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.optionCard,
              archiveOption === "keep_active" && styles.optionCardSelected,
            ]}
            onPress={() => setArchiveOption("keep_active")}
          >
            <View style={styles.optionRadio}>
              {archiveOption === "keep_active" ? (
                <View style={styles.radioSelected}>
                  <View style={styles.radioInner} />
                </View>
              ) : (
                <View style={styles.radioUnselected} />
              )}
            </View>
            <View style={styles.optionContent}>
              <Text
                style={[
                  styles.optionLabel,
                  archiveOption === "keep_active" && styles.optionLabelSelected,
                ]}
              >
                {t("goals.keep_goal_active_option") || "Keep goal active"}
              </Text>
              <Text style={styles.optionDescription}>
                {t("goals.keep_goal_active_option_description") ||
                  "Track both separately (counts as 2 toward your active limit)"}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Create Button */}
        <View style={styles.buttonContainer}>
          <Button
            title={
              shareAsChallenge.isPending
                ? t("common.creating") || "Creating..."
                : t("goals.create_challenge_button") || "Create Challenge"
            }
            onPress={handleCreateChallenge}
            disabled={shareAsChallenge.isPending}
            loading={shareAsChallenge.isPending}
          />
        </View>
      </ScrollView>
    </Modal>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[4]),
    maxHeight: 500,
  },
  goalInfo: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2]),
    padding: toRN(tokens.spacing[3]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.md),
    marginBottom: toRN(tokens.spacing[3]),
  },
  goalTitle: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.primary,
  },
  warningContainer: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: toRN(tokens.spacing[2]),
    padding: toRN(tokens.spacing[3]),
    backgroundColor: `${brand.primary}10`,
    borderRadius: toRN(tokens.borderRadius.md),
    marginBottom: toRN(tokens.spacing[4]),
    borderWidth: 1,
    borderColor: `${brand.primary}30`,
  },
  warningText: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5,
  },
  section: {
    marginBottom: toRN(tokens.spacing[4]),
  },
  sectionTitle: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.semiBold,
    color: colors.text.tertiary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: toRN(tokens.spacing[2]),
  },
  detailRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[2]),
    gap: toRN(tokens.spacing[3]),
  },
  detailIcon: {
    width: toRN(36),
    height: toRN(36),
    borderRadius: toRN(18),
    backgroundColor: colors.bg.muted,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
  },
  detailValue: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.medium,
    color: colors.text.primary,
  },
  toggleRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    padding: toRN(tokens.spacing[3]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.md),
  },
  toggleInfo: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[3]),
    flex: 1,
  },
  toggleText: {
    flex: 1,
  },
  toggleLabel: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.medium,
    color: colors.text.primary,
  },
  toggleDescription: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  optionCard: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    padding: toRN(tokens.spacing[3]),
    backgroundColor: colors.bg.surface,
    borderRadius: toRN(tokens.borderRadius.md),
    borderWidth: 1,
    borderColor: colors.border.default,
    marginBottom: toRN(tokens.spacing[2]),
  },
  optionCardSelected: {
    backgroundColor: `${brand.primary}10`,
    borderColor: brand.primary,
  },
  optionRadio: {
    marginRight: toRN(tokens.spacing[3]),
    marginTop: 2,
  },
  radioUnselected: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border.default,
  },
  radioSelected: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: brand.primary,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: brand.primary,
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.medium,
    color: colors.text.primary,
  },
  optionLabelSelected: {
    color: brand.primary,
  },
  optionDescription: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  buttonContainer: {
    marginTop: toRN(tokens.spacing[2]),
  },
});
