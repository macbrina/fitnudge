import React from "react";
import { ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { BackButton } from "@/components/ui/BackButton";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { useTranslation } from "@/lib/i18n";
import { toRN } from "@/lib/units";
import { useStyles } from "@/themes";
import { tokens } from "@/themes/tokens";

export function WeeklyRecapsSkeleton() {
  const styles = useStyles(makeStyles);
  const { t } = useTranslation();
  const router = useRouter();
  const cardPadding = toRN(tokens.spacing[4]);

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    >
      {[1, 2, 3].map((i) => (
        <SkeletonBox
          key={i}
          width="100%"
          height={300}
          borderRadius={toRN(tokens.borderRadius.xl)}
          inner
          innerPadding={cardPadding}
          style={styles.recapCard}
        >
          {/* recapHeader: weekBadge + headerRight (changeBadge, chevron) */}
          <View style={styles.recapHeader}>
            <SkeletonBox width={140} height={28} borderRadius={14} />
            <View style={styles.headerRight}>
              <SkeletonBox width={48} height={24} borderRadius={12} />
              <SkeletonBox width={20} height={20} borderRadius={10} />
            </View>
          </View>

          {/* statsGrid: 3 stat items (check-ins, completion, streak) */}
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <SkeletonBox width={40} height={28} borderRadius={6} />
              <SkeletonBox width={60} height={12} borderRadius={4} style={{ marginTop: 8 }} />
            </View>
            <View style={styles.statItem}>
              <SkeletonBox width={40} height={28} borderRadius={6} />
              <SkeletonBox width={70} height={12} borderRadius={4} style={{ marginTop: 8 }} />
            </View>
            <View style={styles.statItem}>
              <SkeletonBox width={40} height={28} borderRadius={6} />
              <SkeletonBox width={50} height={12} borderRadius={4} style={{ marginTop: 8 }} />
            </View>
          </View>

          {/* goalBreakdownPreview: 2 goal items (dot, title, rate) */}
          <View style={styles.goalBreakdownPreview}>
            <View style={styles.goalPreviewItem}>
              <SkeletonBox width={8} height={8} borderRadius={4} />
              <SkeletonBox width="60%" height={14} borderRadius={4} />
              <SkeletonBox width={36} height={14} borderRadius={4} />
            </View>
            <View style={styles.goalPreviewItem}>
              <SkeletonBox width={8} height={8} borderRadius={4} />
              <SkeletonBox width="50%" height={14} borderRadius={4} />
              <SkeletonBox width={36} height={14} borderRadius={4} />
            </View>
          </View>

          {/* summaryPreviewContainer: AI summary text */}
          <View style={styles.summaryPreviewContainer}>
            <SkeletonBox width="100%" height={14} borderRadius={4} />
            <SkeletonBox width="95%" height={14} borderRadius={4} style={{ marginTop: 6 }} />
            <SkeletonBox width="80%" height={14} borderRadius={4} style={{ marginTop: 6 }} />
          </View>
        </SkeletonBox>
      ))}
    </ScrollView>
  );
}

const makeStyles = (tokens: any, colors: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas
  },
  scrollView: {
    flex: 1
  },
  listContent: {
    padding: toRN(tokens.spacing[4]),
    flexGrow: 1
  },
  recapCard: {
    marginBottom: toRN(tokens.spacing[3])
  },
  recapHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[3]),
    padding: toRN(tokens.spacing[2])
  },
  headerRight: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2])
  },
  statsGrid: {
    flexDirection: "row" as const,
    justifyContent: "space-around" as const,
    paddingVertical: toRN(tokens.spacing[3]),
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border.subtle
  },
  statItem: {
    alignItems: "center" as const
  },
  goalBreakdownPreview: {
    marginTop: toRN(tokens.spacing[3]),
    gap: toRN(tokens.spacing[1.5]),
    padding: toRN(tokens.spacing[2])
  },
  goalPreviewItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2])
  },
  summaryPreviewContainer: {
    padding: toRN(tokens.spacing[2])
  }
});

export default WeeklyRecapsSkeleton;
