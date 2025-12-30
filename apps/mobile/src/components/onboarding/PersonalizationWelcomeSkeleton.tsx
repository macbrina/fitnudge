import React from "react";
import { View, ScrollView } from "react-native";
import { toRN } from "@/lib/units";
import { useStyles } from "@/themes/makeStyles";
import { tokens } from "@/themes/tokens";
import { useTheme } from "@/themes";
import { SkeletonBox, SkeletonAvatar } from "@/components/ui/SkeletonBox";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function PersonalizationWelcomeSkeleton() {
  const styles = useStyles(makePersonalizationWelcomeSkeletonStyles);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      {/* Header with Skeleton Progress */}
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <View style={styles.progressContainer}>
          <SkeletonBox
            width={80}
            height={14}
            borderRadius={4}
            style={styles.progressTextSkeleton}
          />
          <View style={styles.progressBar}>
            <SkeletonBox
              width="12.5%"
              height={6}
              borderRadius={3}
              style={styles.progressFillSkeleton}
            />
          </View>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Icon Skeleton */}
        <View style={styles.iconContainer}>
          <View style={styles.iconWrapper}>
            <SkeletonAvatar size={80} />
          </View>
        </View>

        {/* Title Section Skeleton */}
        <View style={styles.titleSection}>
          <SkeletonBox
            width="70%"
            height={36}
            borderRadius={8}
            style={styles.titleSkeleton}
          />
          <SkeletonBox
            width="90%"
            height={20}
            borderRadius={8}
            style={styles.subtitleSkeleton}
          />
        </View>

        {/* Benefits Cards Skeleton */}
        <View style={styles.benefitsContainer}>
          {[1, 2, 3].map((index) => (
            <View key={index} style={styles.benefitCard}>
              <View style={styles.benefitIconContainer}>
                <SkeletonAvatar size={24} />
              </View>
              <SkeletonBox
                width="75%"
                height={20}
                borderRadius={8}
                style={styles.benefitTextSkeleton}
              />
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Footer with Skeleton Button */}
      <View style={styles.footer}>
        <SkeletonBox
          width="100%"
          height={48}
          borderRadius={12}
          style={styles.buttonSkeleton}
        />
      </View>
    </View>
  );
}

const makePersonalizationWelcomeSkeletonStyles = (
  tokens: any,
  colors: any,
  brand: any,
) => {
  return {
    container: {
      flex: 1,
      backgroundColor: colors.bg.canvas,
    },
    header: {
      paddingHorizontal: toRN(tokens.spacing[6]),
      paddingBottom: toRN(tokens.spacing[5]),
    },
    progressContainer: {
      alignItems: "center" as const,
      width: "100%",
    },
    progressTextSkeleton: {
      marginBottom: toRN(tokens.spacing[3]),
    },
    progressBar: {
      width: "100%",
      height: 6,
      backgroundColor: colors.bg.muted,
      borderRadius: 3,
      overflow: "hidden" as const,
      justifyContent: "flex-start" as const,
      alignItems: "flex-start" as const,
    },
    progressFillSkeleton: {
      height: "100%",
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      flexGrow: 1,
      paddingHorizontal: toRN(tokens.spacing[6]),
      alignItems: "center" as const,
      justifyContent: "flex-start" as const,
      paddingTop: toRN(tokens.spacing[8]),
      paddingBottom: toRN(tokens.spacing[6]),
    },
    iconContainer: {
      marginBottom: toRN(tokens.spacing[10]),
      alignItems: "center" as const,
    },
    iconWrapper: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: colors.bg.surface,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      shadowColor: colors.shadow.default,
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 4,
    },
    titleSection: {
      alignItems: "center" as const,
      marginBottom: toRN(tokens.spacing[10]),
      paddingHorizontal: toRN(tokens.spacing[4]),
      width: "100%",
    },
    titleSkeleton: {
      marginBottom: toRN(tokens.spacing[4]),
    },
    subtitleSkeleton: {
      paddingHorizontal: toRN(tokens.spacing[2]),
    },
    benefitsContainer: {
      width: "100%",
      gap: toRN(tokens.spacing[4]),
    },
    benefitCard: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: colors.bg.surface,
      paddingHorizontal: toRN(tokens.spacing[5]),
      paddingVertical: toRN(tokens.spacing[4]),
      borderRadius: toRN(tokens.borderRadius.lg),
      shadowColor: colors.shadow.default,
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    benefitIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.bg.muted,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginRight: toRN(tokens.spacing[4]),
    },
    benefitTextSkeleton: {
      flex: 1,
    },
    footer: {
      paddingHorizontal: toRN(tokens.spacing[6]),
    },
    buttonSkeleton: {
      width: "100%",
    },
  };
};
