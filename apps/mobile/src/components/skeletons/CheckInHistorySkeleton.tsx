import React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { BackButton } from "@/components/ui/BackButton";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { toRN } from "@/lib/units";
import { useStyles, useTheme } from "@/themes";

export function CheckInHistorySkeleton() {
  const styles = useStyles(makeStyles);
  const router = useRouter();

  return (
    <View style={styles.container}>
      <BackButton title="" onPress={() => router.back()} />

      <View style={styles.content}>
        {/* Check-in list items */}
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <View key={i} style={styles.checkInItem}>
            {/* Status Icon */}
            <SkeletonBox width={40} height={40} borderRadius={20} />

            {/* Content */}
            <View style={styles.itemContent}>
              <View style={styles.itemHeader}>
                <SkeletonBox width={100} height={16} borderRadius={6} />
                <SkeletonBox width={50} height={20} borderRadius={10} />
              </View>
              <SkeletonBox width={80} height={12} borderRadius={4} style={{ marginTop: 6 }} />

              {/* Mood/Skip indicators */}
              <View style={styles.indicatorRow}>
                <SkeletonBox width={60} height={14} borderRadius={6} />
                <SkeletonBox width={40} height={14} borderRadius={6} style={{ marginLeft: 8 }} />
              </View>
            </View>

            {/* Chevron */}
            <SkeletonBox width={20} height={20} borderRadius={4} />
          </View>
        ))}
      </View>
    </View>
  );
}

const makeStyles = (tokens: any, colors: any, brandColors: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas
  },
  content: {
    flex: 1,
    paddingHorizontal: toRN(tokens.spacing[4])
  },
  checkInItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[4]),
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle
  },
  itemContent: {
    flex: 1,
    marginLeft: toRN(tokens.spacing[3])
  },
  itemHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const
  },
  indicatorRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginTop: toRN(tokens.spacing[2])
  }
});

export default CheckInHistorySkeleton;
