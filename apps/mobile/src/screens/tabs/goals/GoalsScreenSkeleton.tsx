/**
 * Skeleton for GoalsScreen - matches the loaded layout:
 * Header (title + add button), SegmentedControl tabs, and full GoalCards.
 */
import React from "react";
import { View } from "react-native";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { useStyles } from "@/themes";
import { toRN } from "@/lib/units";
import { tokens } from "@/themes/tokens";

export function GoalsScreenSkeleton() {
  const styles = useStyles(makeStyles);

  return (
    <View style={styles.container}>
      {/* Header - matches GoalsScreen header */}
      <View style={styles.header}>
        <SkeletonBox
          width={120}
          height={toRN(tokens.typography.fontSize["2xl"])}
          borderRadius={toRN(tokens.borderRadius.base)}
        />
        <SkeletonBox
          width={toRN(tokens.spacing[10])}
          height={toRN(tokens.spacing[10])}
          borderRadius={toRN(tokens.borderRadius.full)}
        />
      </View>

      {/* Tabs - matches SegmentedControl layout (pill shape) */}
      <View style={styles.tabsContainer}>
        <SkeletonBox
          width="100%"
          height={toRN(tokens.spacing[10])}
          borderRadius={toRN(tokens.borderRadius["2xl"])}
        />
      </View>

      {/* Goal cards - match full GoalCard layout (title, frequency, stats row, talk button) */}
      <View style={styles.cardsContainer}>
        {[1, 2, 3].map((i) => (
          <GoalCardSkeleton key={i} style={styles.cardSpacing} />
        ))}
      </View>
    </View>
  );
}

/** Skeleton for full GoalCard layout (title + frequency, stats row, talk button) */
function GoalCardSkeleton({ style }: { style?: object }) {
  const styles = useStyles(makeStyles);

  return (
    <SkeletonBox
      width="100%"
      height={180}
      borderRadius={toRN(tokens.borderRadius.xl)}
      inner
      innerPadding={toRN(tokens.spacing[4])}
      style={style}
    >
      {/* Header row: title + frequency on left, status icon on right */}
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleSection}>
          <SkeletonBox
            width="75%"
            height={toRN(tokens.typography.fontSize.lg)}
            borderRadius={toRN(tokens.borderRadius.base)}
            style={{ marginBottom: toRN(tokens.spacing[1]) }}
          />
          <SkeletonBox
            width={80}
            height={toRN(tokens.typography.fontSize.sm)}
            borderRadius={toRN(tokens.borderRadius.base)}
          />
        </View>
        <SkeletonBox width={24} height={24} borderRadius={12} />
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        {[1, 2, 3].map((j) => (
          <View key={j} style={styles.statItem}>
            <SkeletonBox
              width={24}
              height={24}
              borderRadius={12}
              style={{ marginBottom: toRN(tokens.spacing[1]) }}
            />
            <SkeletonBox
              width={28}
              height={toRN(tokens.typography.fontSize.lg)}
              borderRadius={toRN(tokens.borderRadius.base)}
              style={{ marginBottom: toRN(tokens.spacing[1]) }}
            />
            <SkeletonBox
              width={36}
              height={toRN(tokens.typography.fontSize.xs)}
              borderRadius={toRN(tokens.borderRadius.base)}
            />
          </View>
        ))}
      </View>

      {/* Talk to buddy button */}
      <SkeletonBox
        width="100%"
        height={40}
        borderRadius={toRN(tokens.borderRadius.md)}
        style={{ marginTop: toRN(tokens.spacing[3]) }}
      />
    </SkeletonBox>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas
  },
  header: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingTop: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[2]),
    marginBottom: toRN(tokens.spacing[4]),
    borderBottomWidth: 2,
    borderBottomColor: colors.border.subtle
  },
  tabsContainer: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[3])
  },
  cardsContainer: {
    flex: 1,
    paddingHorizontal: toRN(tokens.spacing[4])
  },
  cardSpacing: {
    marginBottom: toRN(tokens.spacing[3])
  },
  cardHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[3]),
    gap: toRN(tokens.spacing[3]),
    padding: toRN(tokens.spacing[2])
  },
  cardTitleSection: {
    flex: 1
  },
  statsRow: {
    flexDirection: "row" as const,
    justifyContent: "space-around" as const,
    paddingTop: toRN(tokens.spacing[3]),
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle
  },
  statItem: {
    alignItems: "center" as const
  }
});
