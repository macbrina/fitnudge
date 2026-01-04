import React from "react";
import { TouchableOpacity, Text, ActivityIndicator } from "react-native";
import { useStyles, useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { useAlertModal } from "@/contexts/AlertModalContext";
import { useSendQuickNudge } from "@/hooks/api/useNudges";
import { Ionicons } from "@expo/vector-icons";

interface NudgeButtonProps {
  recipientId: string;
  recipientName: string;
  goalId?: string;
  challengeId?: string;
  partnershipId?: string;
  onSuccess?: () => void;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  style?: any;
}

export function NudgeButton({
  recipientId,
  recipientName,
  goalId,
  challengeId,
  partnershipId,
  onSuccess,
  size = "md",
  showLabel = true,
  style
}: NudgeButtonProps) {
  const styles = useStyles(makeStyles);
  const { brandColors } = useTheme();
  const { t } = useTranslation();
  const { showAlert, showConfirm } = useAlertModal();

  const sendNudgeMutation = useSendQuickNudge();

  const iconSize = size === "sm" ? 16 : size === "md" ? 20 : 24;
  const buttonSize = size === "sm" ? 32 : size === "md" ? 40 : 48;

  const handlePress = async () => {
    const confirmed = await showConfirm({
      title: t("social.send_nudge_title"),
      message: t("social.send_nudge_message", { name: recipientName }),
      variant: "info",
      confirmLabel: t("social.send_nudge"),
      cancelLabel: t("common.cancel")
    });

    if (!confirmed) return;

    try {
      await sendNudgeMutation.mutateAsync({
        recipientId,
        type: "nudge",
        goalId,
        challengeId,
        partnershipId
      });

      showAlert({
        title: t("social.nudge_sent_title"),
        message: t("social.nudge_sent_message", { name: recipientName }),
        variant: "success",
        confirmLabel: t("common.ok")
      });

      onSuccess?.();
    } catch (error: any) {
      const errorMessage = error?.response?.data?.detail || t("social.nudge_error");
      showAlert({
        title: t("common.error"),
        message: errorMessage,
        variant: "error",
        confirmLabel: t("common.ok")
      });
    }
  };

  const isSending = sendNudgeMutation.isPending;

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={isSending}
      style={[
        styles.button,
        {
          width: showLabel ? undefined : buttonSize,
          height: buttonSize,
          paddingHorizontal: showLabel ? toRN(tokens.spacing[3]) : 0
        },
        style
      ]}
    >
      {isSending ? (
        <ActivityIndicator size="small" color={brandColors.primary} />
      ) : (
        <>
          <Ionicons name="hand-left-outline" size={iconSize} color={brandColors.primary} />
          {showLabel && <Text style={styles.label}>{t("social.nudge")}</Text>}
        </>
      )}
    </TouchableOpacity>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  button: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[1]),
    backgroundColor: `${brand.primary}15`,
    borderRadius: toRN(tokens.borderRadius.full)
  },
  label: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: brand.primary
  }
});

export default NudgeButton;
