import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  ActivityIndicator,
  Switch
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import CheckmarkCircle from "@/components/ui/CheckmarkCircle";
import { useRouter } from "expo-router";
import { useTranslation } from "@/lib/i18n";
import { useStyles, useTheme } from "@/themes";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { Card } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import BackButton from "@/components/ui/BackButton";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { TimePicker } from "@/components/ui/TimePicker";
import { useAlertModal } from "@/contexts/AlertModalContext";
import { useAuthStore } from "@/stores/authStore";
import { useUpdateProfile } from "@/hooks/api/useUser";
import { MOTIVATION_STYLES } from "@/constants/personalization";

export default function PersonalizationScreen() {
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { showAlert } = useAlertModal();

  const { user, updateUser } = useAuthStore();
  const updateProfileMutation = useUpdateProfile();

  const [showMotivationModal, setShowMotivationModal] = useState(false);
  const [savingValue, setSavingValue] = useState<string | null>(null);

  const isLoading = !user;
  const isSaving = updateProfileMutation.isPending;

  const updateMotivationStyle = async (value: "supportive" | "tough_love" | "calm") => {
    if (!user) return;

    setSavingValue(value);

    try {
      await updateProfileMutation.mutateAsync({ motivation_style: value });
      // Update local state
      updateUser({ motivation_style: value });
      setShowMotivationModal(false);
    } catch (error) {
      showAlert({
        title: t("common.error"),
        message: t("errors.update_failed"),
        variant: "error"
      });
    } finally {
      setSavingValue(null);
    }
  };

  const updateMorningMotivationEnabled = async (value: boolean) => {
    if (!user) return;

    try {
      await updateProfileMutation.mutateAsync({ morning_motivation_enabled: value });
      updateUser({ morning_motivation_enabled: value });
    } catch (error) {
      showAlert({
        title: t("common.error"),
        message: t("errors.update_failed"),
        variant: "error"
      });
    }
  };

  const updateMorningMotivationTime = async (time: string) => {
    if (!user) return;

    try {
      await updateProfileMutation.mutateAsync({ morning_motivation_time: time });
      updateUser({ morning_motivation_time: time });
    } catch (error) {
      showAlert({
        title: t("common.error"),
        message: t("errors.update_failed"),
        variant: "error"
      });
    }
  };

  const getMotivationLabel = useCallback(() => {
    const style = MOTIVATION_STYLES.find((s) => s.value === user?.motivation_style);
    if (style) {
      return `${style.emoji} ${t(style.labelKey)}`;
    }
    return t("personalization.not_set") || "Not set";
  }, [user?.motivation_style, t]);

  const renderMotivationModal = () => (
    <Modal
      visible={showMotivationModal}
      transparent
      animationType="fade"
      onRequestClose={() => !isSaving && setShowMotivationModal(false)}
    >
      <Pressable
        style={styles.modalOverlay}
        onPress={() => !isSaving && setShowMotivationModal(false)}
      >
        <Pressable style={styles.modalContainer} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>
            {t("onboarding.motivation_style.title") || "Choose Your AI Buddy Style"}
          </Text>
          <Text style={styles.modalSubtitle}>
            {t("onboarding.motivation_style.subtitle") || "How should your AI buddy motivate you?"}
          </Text>

          <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false}>
            {MOTIVATION_STYLES.map((style) => {
              const isSelected = user?.motivation_style === style.value;
              const isSavingThis = isSaving && savingValue === style.value;

              return (
                <TouchableOpacity
                  key={style.value}
                  style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                  onPress={() => !isSaving && updateMotivationStyle(style.value)}
                  activeOpacity={0.7}
                  disabled={isSaving}
                >
                  <Text style={styles.optionEmoji}>{style.emoji}</Text>
                  <View style={styles.optionTextContainer}>
                    <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                      {t(style.labelKey)}
                    </Text>
                    <Text style={styles.optionDescription}>{t(style.descriptionKey)}</Text>
                  </View>
                  {isSavingThis ? (
                    <ActivityIndicator size="small" color={brandColors.primary} />
                  ) : isSelected ? (
                    <CheckmarkCircle size={24} />
                  ) : (
                    <View style={styles.optionCircle} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Button
            title={t("common.cancel")}
            variant="ghost"
            size="sm"
            onPress={() => setShowMotivationModal(false)}
            fullWidth
            style={styles.modalCloseButton}
            disabled={isSaving}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <BackButton
          title={t("personalization.title") || "Personalization"}
          onPress={() => router.back()}
        />
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.section}>
            <SkeletonBox width={120} height={16} borderRadius={8} style={{ marginBottom: 12 }} />
            <SkeletonBox width="100%" height={80} borderRadius={16} />
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <BackButton
        title={t("personalization.title") || "Personalization"}
        onPress={() => router.back()}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* AI Buddy Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("personalization.ai_buddy_section") || "AI Buddy"}
          </Text>
          <Card style={styles.menuCard}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setShowMotivationModal(true)}
              activeOpacity={0.7}
            >
              <View style={styles.menuItemLeft}>
                <Text style={styles.menuItemLabel}>
                  {t("personalization.motivation_style") || "Motivation Style"}
                </Text>
              </View>
              <View style={styles.menuItemRight}>
                <Text style={styles.menuItemValue} numberOfLines={1}>
                  {getMotivationLabel()}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
              </View>
            </TouchableOpacity>
          </Card>
        </View>

        {/* Morning Motivation Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("personalization.morning_motivation_section") || "Daily Motivation"}
          </Text>
          <Card style={styles.menuCard}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleLeft}>
                <View style={[styles.toggleIcon, { backgroundColor: `${brandColors.primary}15` }]}>
                  <Ionicons name="sunny-outline" size={20} color={brandColors.primary} />
                </View>
                <View style={styles.toggleContent}>
                  <Text style={styles.toggleLabel}>
                    {t("personalization.morning_motivation_enabled") || "Morning Motivation"}
                  </Text>
                  <Text style={styles.toggleDescription}>
                    {t("personalization.morning_motivation_desc") ||
                      "Receive a daily motivation message from your AI buddy"}
                  </Text>
                </View>
              </View>
              <Switch
                value={user?.morning_motivation_enabled ?? true}
                onValueChange={updateMorningMotivationEnabled}
                trackColor={{
                  false: colors.border.subtle,
                  true: brandColors.primary
                }}
              />
            </View>

            {user?.morning_motivation_enabled !== false && (
              <>
                <View style={styles.divider} />
                <View style={styles.timePickerContainer}>
                  <TimePicker
                    value={user?.morning_motivation_time || "08:00"}
                    onChange={updateMorningMotivationTime}
                    label={t("personalization.morning_motivation_time") || "Motivation Time"}
                  />
                </View>
              </>
            )}
          </Card>
        </View>

        {/* Info Card */}
        <View style={styles.section}>
          <Card style={styles.infoCard}>
            <View style={styles.infoContent}>
              <Ionicons name="information-circle-outline" size={24} color={brandColors.primary} />
              <Text style={styles.infoText}>
                {t("personalization.info_text") ||
                  "Your motivation style affects how your AI buddy talks to you during check-ins and when sending motivational messages."}
              </Text>
            </View>
          </Card>
        </View>
      </ScrollView>

      {renderMotivationModal()}
    </View>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    paddingBottom: toRN(tokens.spacing[8])
  },
  // Sections
  section: {
    marginTop: toRN(tokens.spacing[4]),
    paddingHorizontal: toRN(tokens.spacing[4])
  },
  sectionTitle: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.text.tertiary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: toRN(tokens.spacing[2]),
    marginLeft: toRN(tokens.spacing[1])
  },
  menuCard: {
    padding: 0,
    overflow: "hidden" as const
  },
  // Menu Item
  menuItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingVertical: toRN(tokens.spacing[4])
  },
  menuItemLeft: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    flex: 1
  },
  menuItemLabel: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.medium,
    color: colors.text.primary,
    flex: 1
  },
  menuItemRight: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2]),
    maxWidth: "50%" as const
  },
  menuItemValue: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary
  },
  // Toggle Row (for switches)
  toggleRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingVertical: toRN(tokens.spacing[3])
  },
  toggleLeft: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    flex: 1
  },
  toggleIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginRight: toRN(tokens.spacing[3])
  },
  toggleContent: {
    flex: 1,
    paddingRight: toRN(tokens.spacing[2])
  },
  toggleLabel: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.medium,
    color: colors.text.primary
  },
  toggleDescription: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    marginTop: toRN(tokens.spacing[0.5])
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginLeft: toRN(tokens.spacing[4]) + 36 + toRN(tokens.spacing[3])
  },
  timePickerContainer: {
    paddingTop: toRN(tokens.spacing[3]),
    paddingBottom: toRN(tokens.spacing[1])
  },
  // Info Card
  infoCard: {
    backgroundColor: `${brand.primary}10`
  },
  infoContent: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: toRN(tokens.spacing[3])
  },
  infoText: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center" as const,
    alignItems: "center" as const,
    padding: toRN(tokens.spacing[4])
  },
  modalContainer: {
    backgroundColor: colors.bg.card,
    borderRadius: toRN(tokens.borderRadius.xl),
    padding: toRN(tokens.spacing[4]),
    width: "100%" as const,
    maxWidth: 380,
    maxHeight: "80%" as const,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8
  },
  modalTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[1])
  },
  modalSubtitle: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[4])
  },
  optionsList: {
    maxHeight: 350
  },
  optionCard: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    borderRadius: toRN(tokens.borderRadius.lg),
    marginBottom: toRN(tokens.spacing[2]),
    backgroundColor: colors.bg.canvas,
    borderWidth: 2,
    borderColor: colors.border.subtle
  },
  optionCardSelected: {
    backgroundColor: `${brand.primary}10`,
    borderColor: brand.primary
  },
  optionEmoji: {
    fontSize: 32,
    marginRight: toRN(tokens.spacing[3])
  },
  optionTextContainer: {
    flex: 1
  },
  optionLabel: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[0.5])
  },
  optionLabelSelected: {
    color: brand.primary
  },
  optionDescription: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary
  },
  optionCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border.default
  },
  modalCloseButton: {
    marginTop: toRN(tokens.spacing[3])
  }
});
