import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  ScrollView,
  Modal,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Button from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
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
  const insets = useSafeAreaInsets();

  const shareAsChallenge = useShareGoalAsChallenge();

  // Animation
  const slideAnim = useRef(new Animated.Value(600)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Calculate minimum dates
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const tomorrow = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return d;
  }, [today]);

  const dayAfterTomorrow = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 2);
    return d;
  }, [today]);

  // Form state
  const [joinDeadline, setJoinDeadline] = useState<Date>(tomorrow);
  const [startDate, setStartDate] = useState<Date>(dayAfterTomorrow);
  const [isPublic, setIsPublic] = useState(false);
  const [archiveOption, setArchiveOption] = useState<ArchiveOption>("archive");

  // Validation errors
  const [errors, setErrors] = useState<{
    joinDeadline?: string;
    startDate?: string;
  }>({});

  // Reset dates when modal opens
  useEffect(() => {
    if (visible) {
      setJoinDeadline(tomorrow);
      setStartDate(dayAfterTomorrow);
      setErrors({});
    }
  }, [visible, tomorrow, dayAfterTomorrow]);

  // Animation effect
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 20,
          stiffness: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      slideAnim.setValue(600);
      fadeAnim.setValue(0);
    }
  }, [visible, slideAnim, fadeAnim]);

  // Validate dates
  const validateDates = (): boolean => {
    const newErrors: { joinDeadline?: string; startDate?: string } = {};

    // Join deadline must be at least today
    if (joinDeadline < today) {
      newErrors.joinDeadline = "Join deadline cannot be in the past";
    }

    // Start date must be at least tomorrow
    if (startDate <= today) {
      newErrors.startDate = "Start date must be in the future";
    }

    // Start date must be at least 1 day after join deadline
    const oneDayAfterJoin = new Date(joinDeadline);
    oneDayAfterJoin.setDate(oneDayAfterJoin.getDate() + 1);

    if (startDate < oneDayAfterJoin) {
      newErrors.startDate =
        "Start date must be at least 1 day after join deadline";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle join deadline change
  const handleJoinDeadlineChange = (date: Date) => {
    setJoinDeadline(date);

    // Auto-adjust start date if needed
    const minStartDate = new Date(date);
    minStartDate.setDate(minStartDate.getDate() + 1);

    if (startDate < minStartDate) {
      setStartDate(minStartDate);
    }

    // Clear errors
    setErrors((prev) => ({ ...prev, joinDeadline: undefined }));
  };

  // Handle start date change
  const handleStartDateChange = (date: Date) => {
    setStartDate(date);
    setErrors((prev) => ({ ...prev, startDate: undefined }));
  };

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 600,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  // Format date as YYYY-MM-DD for backend
  const formatDateForAPI = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const handleCreateChallenge = async () => {
    if (!validateDates()) {
      return;
    }

    try {
      const response = await shareAsChallenge.mutateAsync({
        goalId: goal.id,
        data: {
          title: goal.title,
          description: goal.description,
          start_date: formatDateForAPI(startDate),
          join_deadline: formatDateForAPI(joinDeadline),
          is_public: isPublic,
          archive_original_goal: archiveOption === "archive",
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
        handleClose();
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

  // Calculate minimum start date based on join deadline
  const minStartDate = useMemo(() => {
    const d = new Date(joinDeadline);
    d.setDate(d.getDate() + 1);
    return d;
  }, [joinDeadline]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.overlay}
      >
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <TouchableOpacity
            style={styles.backdropTouchable}
            activeOpacity={1}
            onPress={handleClose}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.container,
            {
              paddingBottom: insets.bottom + toRN(tokens.spacing[4]),
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Drag Handle */}
          <View style={styles.dragHandleContainer}>
            <View style={styles.dragHandle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              {t("goals.share_as_challenge_title") || "Share as Challenge"}
            </Text>
          </View>

          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            bounces={false}
            keyboardShouldPersistTaps="handled"
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

            {/* Date Pickers Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Challenge Schedule</Text>

              <DatePicker
                value={joinDeadline}
                onChange={handleJoinDeadlineChange}
                label="Join Deadline"
                description="Last day friends can join the challenge. Must be before the start date."
                minimumDate={today}
                error={errors.joinDeadline}
              />

              <DatePicker
                value={startDate}
                onChange={handleStartDateChange}
                label="Start Date"
                description="When the challenge begins. Everyone starts from Day 1 together."
                minimumDate={minStartDate}
                error={errors.startDate}
              />
            </View>

            {/* Visibility Toggle */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Visibility</Text>

              <View style={styles.toggleRow}>
                <View style={styles.toggleInfo}>
                  <View style={styles.toggleIconContainer}>
                    <Ionicons
                      name={isPublic ? "globe-outline" : "lock-closed-outline"}
                      size={20}
                      color={colors.text.secondary}
                    />
                  </View>
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
                  thumbColor={
                    isPublic ? brandColors.primary : colors.bg.surface
                  }
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
                    {t("goals.archive_goal_option") ||
                      "Archive goal (recommended)"}
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
                      archiveOption === "keep_active" &&
                        styles.optionLabelSelected,
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
          </ScrollView>

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
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  overlay: {
    flex: 1,
    justifyContent: "flex-end" as const,
  },
  backdrop: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  backdropTouchable: {
    flex: 1,
  },
  container: {
    backgroundColor: colors.bg.card,
    borderTopLeftRadius: toRN(tokens.borderRadius["2xl"]),
    borderTopRightRadius: toRN(tokens.borderRadius["2xl"]),
    maxHeight: "90%",
  },
  dragHandleContainer: {
    alignItems: "center" as const,
    paddingTop: toRN(tokens.spacing[3]),
    paddingBottom: toRN(tokens.spacing[2]),
  },
  dragHandle: {
    width: 36,
    height: 4,
    backgroundColor: colors.border.default,
    borderRadius: 2,
  },
  header: {
    paddingHorizontal: toRN(tokens.spacing[5]),
    paddingBottom: toRN(tokens.spacing[3]),
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default + "30",
  },
  title: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
    textAlign: "center" as const,
  },
  scrollView: {
    flexGrow: 0,
    maxHeight: 500,
  },
  goalInfo: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2]),
    marginHorizontal: toRN(tokens.spacing[5]),
    marginTop: toRN(tokens.spacing[4]),
    padding: toRN(tokens.spacing[3]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.lg),
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
    marginHorizontal: toRN(tokens.spacing[5]),
    marginTop: toRN(tokens.spacing[3]),
    padding: toRN(tokens.spacing[3]),
    backgroundColor: `${brand.primary}10`,
    borderRadius: toRN(tokens.borderRadius.lg),
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
    marginTop: toRN(tokens.spacing[5]),
    paddingHorizontal: toRN(tokens.spacing[5]),
  },
  sectionTitle: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.semiBold,
    color: colors.text.tertiary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: toRN(tokens.spacing[3]),
  },
  toggleRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    padding: toRN(tokens.spacing[3]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.lg),
  },
  toggleInfo: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[3]),
    flex: 1,
  },
  toggleIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bg.surface,
    alignItems: "center" as const,
    justifyContent: "center" as const,
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
    borderRadius: toRN(tokens.borderRadius.lg),
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
    paddingHorizontal: toRN(tokens.spacing[5]),
    paddingTop: toRN(tokens.spacing[4]),
    borderTopWidth: 1,
    borderTopColor: colors.border.default + "30",
  },
});
