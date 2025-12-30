import React from "react";
import { View } from "react-native";
import { useTranslation } from "@/lib/i18n";
import { toRN } from "@/lib/units";
import { useStyles } from "@/themes/makeStyles";
import { tokens } from "@/themes/tokens";
import { router, useLocalSearchParams } from "expo-router";
import { BackButton } from "@/components/ui/BackButton";
import { ChallengeForm } from "./components/ChallengeForm";

export default function CreateChallengeScreen() {
  const params = useLocalSearchParams<{
    category?: string;
    // Pre-filled data from AI suggestion
    title?: string;
    description?: string;
    frequency?: string;
    target_days?: string;
    days_of_week?: string;
    reminder_times?: string;
    duration_days?: string;
    target_checkins?: string;
  }>();

  const { t } = useTranslation();
  const styles = useStyles(makeCreateChallengeScreenStyles);

  const handleBack = () => {
    router.back();
  };

  // Parse pre-filled data from params
  const initialData = params.title
    ? {
        title: params.title,
        description: params.description,
        category: params.category,
        frequency: params.frequency as "daily" | "weekly" | undefined,
        target_days: params.target_days
          ? parseInt(params.target_days)
          : undefined,
        days_of_week: params.days_of_week
          ? JSON.parse(params.days_of_week)
          : undefined,
        reminder_times: params.reminder_times
          ? JSON.parse(params.reminder_times)
          : undefined,
        duration_days: params.duration_days
          ? parseInt(params.duration_days)
          : undefined,
        target_checkins: params.target_checkins
          ? parseInt(params.target_checkins)
          : undefined,
      }
    : undefined;

  return (
    <View style={styles.container}>
      {/* Header */}
      <BackButton
        onPress={handleBack}
        title={t("challenges.create_title") || "Create Challenge"}
        titleCentered={true}
      />

      {/* Content */}
      <View style={styles.content}>
        <ChallengeForm initialData={initialData} />
      </View>
    </View>
  );
}

const makeCreateChallengeScreenStyles = (
  tokens: any,
  colors: any,
  brand: any,
) => {
  return {
    container: {
      flex: 1,
      backgroundColor: colors.bg.canvas,
    },
    content: {
      flex: 1,
    },
  };
};
