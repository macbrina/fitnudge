import { fontFamily } from "@/lib/fonts";
import { toRN } from "@/lib/units";
import { useStyles } from "@/themes/makeStyles";
import { lineHeight } from "@/themes/tokens";
import React from "react";
import { useTranslation } from "react-i18next";
import { Dimensions, Modal, Text, TouchableOpacity, View } from "react-native";

interface NotificationPermissionModalProps {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onMaybeLater: () => void;
}

const { width } = Dimensions.get("window");

export const NotificationPermissionModal: React.FC<NotificationPermissionModalProps> = ({
  visible,
  onAccept,
  onDecline,
  onMaybeLater
}) => {
  const { t } = useTranslation();
  const styles = useStyles(makeNotificationPermissionModalStyles);

  const benefits = [
    {
      icon: "🤖",
      title: t("notifications.benefits.ai_motivation.title"),
      description: t("notifications.benefits.ai_motivation.description")
    },
    {
      icon: "⏰",
      title: t("notifications.benefits.reminders.title"),
      description: t("notifications.benefits.reminders.description")
    },
    {
      icon: "🏆",
      title: t("notifications.benefits.achievements.title"),
      description: t("notifications.benefits.achievements.description")
    },
    {
      icon: "👥",
      title: t("notifications.benefits.community.title"),
      description: t("notifications.benefits.community.description")
    }
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Text style={styles.icon}>🔔</Text>
            </View>
            <Text style={styles.title}>{t("notifications.permission.title")}</Text>
            <Text style={styles.subtitle}>{t("notifications.permission.subtitle")}</Text>
          </View>

          {/* Benefits List */}
          <View style={styles.benefitsContainer}>
            {benefits.map((benefit, index) => (
              <View key={index} style={styles.benefitItem}>
                <Text style={styles.benefitIcon}>{benefit.icon}</Text>
                <View style={styles.benefitText}>
                  <Text style={styles.benefitTitle}>{benefit.title}</Text>
                  <Text style={styles.benefitDescription}>{benefit.description}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity style={styles.primaryButton} onPress={onAccept} activeOpacity={0.8}>
              <Text style={styles.primaryButtonText}>
                {t("notifications.permission.enable_button")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={onMaybeLater}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryButtonText}>
                {t("notifications.permission.maybe_later_button")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.tertiaryButton} onPress={onDecline} activeOpacity={0.8}>
              <Text style={styles.tertiaryButtonText}>
                {t("notifications.permission.not_now_button")}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Privacy Note */}
          <Text style={styles.privacyNote}>{t("notifications.permission.privacy_note")}</Text>
        </View>
      </View>
    </Modal>
  );
};

const makeNotificationPermissionModalStyles = (tokens: any, colors: any, brand: any) => {
  return {
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "center" as const,
      alignItems: "center" as const,
      paddingHorizontal: toRN(tokens.spacing[5])
    },
    container: {
      backgroundColor: colors.bg.card,
      borderRadius: toRN(tokens.borderRadius.xl),
      padding: toRN(tokens.spacing[6]),
      width: width - 40,
      maxWidth: 400,
      maxHeight: "90%"
    },
    header: {
      alignItems: "center" as const,
      marginBottom: toRN(tokens.spacing[6])
    },
    iconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: brand.primary + "20",
      justifyContent: "center" as const,
      alignItems: "center" as const,
      marginBottom: toRN(tokens.spacing[4])
    },
    icon: {
      fontSize: 40
    },
    title: {
      fontSize: toRN(tokens.typography.fontSize["2xl"]),
      fontWeight: tokens.typography.fontWeight.bold,
      color: colors.text.primary,
      textAlign: "center" as const,
      marginBottom: toRN(tokens.spacing[2]),
      fontFamily: fontFamily.groteskBold
    },
    subtitle: {
      fontSize: toRN(tokens.typography.fontSize.base),
      color: colors.text.secondary,
      textAlign: "center" as const,
      lineHeight: lineHeight(tokens.typography.fontSize.base, tokens.typography.lineHeight.relaxed),
      fontFamily: fontFamily.groteskRegular
    },
    benefitsContainer: {
      marginBottom: toRN(tokens.spacing[8])
    },
    benefitItem: {
      flexDirection: "row" as const,
      alignItems: "flex-start" as const,
      marginBottom: toRN(tokens.spacing[4])
    },
    benefitIcon: {
      fontSize: 24,
      marginRight: toRN(tokens.spacing[3]),
      marginTop: 2
    },
    benefitText: {
      flex: 1
    },
    benefitTitle: {
      fontSize: toRN(tokens.typography.fontSize.base),
      fontWeight: tokens.typography.fontWeight.semibold,
      color: colors.text.primary,
      marginBottom: toRN(tokens.spacing[1]),
      fontFamily: fontFamily.groteskSemiBold
    },
    benefitDescription: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      color: colors.text.secondary,
      lineHeight: lineHeight(tokens.typography.fontSize.sm, tokens.typography.lineHeight.relaxed),
      fontFamily: fontFamily.groteskRegular
    },
    actionsContainer: {
      gap: toRN(tokens.spacing[3])
    },
    primaryButton: {
      backgroundColor: brand.primary,
      paddingVertical: toRN(tokens.spacing[4]),
      paddingHorizontal: toRN(tokens.spacing[6]),
      borderRadius: toRN(tokens.borderRadius.lg),
      alignItems: "center" as const
    },
    primaryButtonText: {
      color: brand.primaryForeground,
      fontSize: toRN(tokens.typography.fontSize.base),
      fontWeight: tokens.typography.fontWeight.semibold,
      fontFamily: fontFamily.groteskSemiBold
    },
    secondaryButton: {
      backgroundColor: colors.bg.secondary,
      paddingVertical: toRN(tokens.spacing[4]),
      paddingHorizontal: toRN(tokens.spacing[6]),
      borderRadius: toRN(tokens.borderRadius.lg),
      alignItems: "center" as const
    },
    secondaryButtonText: {
      color: colors.text.secondary,
      fontSize: toRN(tokens.typography.fontSize.base),
      fontWeight: tokens.typography.fontWeight.medium,
      fontFamily: fontFamily.groteskMedium
    },
    tertiaryButton: {
      paddingVertical: toRN(tokens.spacing[3]),
      paddingHorizontal: toRN(tokens.spacing[6]),
      alignItems: "center" as const
    },
    tertiaryButtonText: {
      color: colors.text.muted,
      fontSize: toRN(tokens.typography.fontSize.sm),
      fontFamily: fontFamily.groteskRegular
    },
    privacyNote: {
      fontSize: toRN(tokens.typography.fontSize.xs),
      color: colors.text.muted,
      textAlign: "center" as const,
      marginTop: toRN(tokens.spacing[4]),
      lineHeight: lineHeight(tokens.typography.fontSize.xs, tokens.typography.lineHeight.tight),
      fontFamily: fontFamily.groteskRegular
    }
  };
};
