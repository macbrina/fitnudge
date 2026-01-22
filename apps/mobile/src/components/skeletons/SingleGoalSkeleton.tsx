import React from "react";
import { ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { BackButton } from "@/components/ui/BackButton";
import { Card } from "@/components/ui/Card";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { useTranslation } from "@/lib/i18n";
import { toRN } from "@/lib/units";
import { useStyles, useTheme } from "@/themes";

export function SingleGoalSkeleton() {
  const styles = useStyles(makeStyles);
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <View style={styles.container}>
      <BackButton title="" onPress={() => router.back()} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Goal Info Card */}
        <Card style={styles.card}>
          {/* Title & Description */}
          <SkeletonBox width="80%" height={22} borderRadius={8} />
          <SkeletonBox width="60%" height={14} borderRadius={6} style={{ marginTop: 8 }} />

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <SkeletonBox width={24} height={24} borderRadius={12} />
              <SkeletonBox width={32} height={20} borderRadius={6} style={{ marginTop: 6 }} />
              <SkeletonBox width={48} height={12} borderRadius={4} style={{ marginTop: 4 }} />
            </View>
            <View style={styles.statItem}>
              <SkeletonBox width={24} height={24} borderRadius={12} />
              <SkeletonBox width={40} height={20} borderRadius={6} style={{ marginTop: 6 }} />
              <SkeletonBox width={36} height={12} borderRadius={4} style={{ marginTop: 4 }} />
            </View>
            <View style={styles.statItem}>
              <SkeletonBox width={24} height={24} borderRadius={12} />
              <SkeletonBox width={28} height={20} borderRadius={6} style={{ marginTop: 6 }} />
              <SkeletonBox width={56} height={12} borderRadius={4} style={{ marginTop: 4 }} />
            </View>
          </View>
        </Card>

        {/* Schedule Card */}
        <Card style={styles.card}>
          <View style={styles.scheduleRow}>
            <View style={styles.scheduleItem}>
              <SkeletonBox width={32} height={32} borderRadius={8} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <SkeletonBox width={80} height={12} borderRadius={4} />
                <SkeletonBox width={120} height={16} borderRadius={6} style={{ marginTop: 6 }} />
              </View>
            </View>
            <View style={styles.scheduleItem}>
              <SkeletonBox width={32} height={32} borderRadius={8} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <SkeletonBox width={70} height={12} borderRadius={4} />
                <SkeletonBox width={60} height={16} borderRadius={6} style={{ marginTop: 6 }} />
              </View>
            </View>
          </View>
        </Card>

        {/* Check-in Button */}
        <SkeletonBox width="100%" height={48} borderRadius={12} style={{ marginBottom: 16 }} />

        {/* Recent Check-ins Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <SkeletonBox width={120} height={18} borderRadius={6} />
            <SkeletonBox width={60} height={14} borderRadius={4} />
          </View>
          {/* Check-in items */}
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.checkInItem}>
              <SkeletonBox width={20} height={20} borderRadius={10} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <SkeletonBox width="50%" height={14} borderRadius={4} />
                <SkeletonBox width="30%" height={12} borderRadius={4} style={{ marginTop: 4 }} />
              </View>
            </View>
          ))}
        </View>

        {/* Insights Section */}
        <View style={styles.section}>
          <SkeletonBox width={80} height={18} borderRadius={6} style={{ marginBottom: 12 }} />
          <Card style={styles.insightCard}>
            <View style={styles.insightRow}>
              <SkeletonBox width={24} height={24} borderRadius={12} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <SkeletonBox width="90%" height={14} borderRadius={4} />
                <SkeletonBox width="70%" height={12} borderRadius={4} style={{ marginTop: 6 }} />
              </View>
            </View>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (tokens: any, colors: any, brandColors: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    padding: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[8])
  },
  card: {
    padding: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[4])
  },
  statsRow: {
    flexDirection: "row" as const,
    justifyContent: "space-around" as const,
    marginTop: toRN(tokens.spacing[4]),
    paddingTop: toRN(tokens.spacing[4]),
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle
  },
  statItem: {
    alignItems: "center" as const
  },
  scheduleRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const
  },
  scheduleItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    flex: 1
  },
  section: {
    marginBottom: toRN(tokens.spacing[4])
  },
  sectionHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[3])
  },
  checkInItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[3]),
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle
  },
  insightCard: {
    padding: toRN(tokens.spacing[4])
  },
  insightRow: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const
  }
});

export default SingleGoalSkeleton;
