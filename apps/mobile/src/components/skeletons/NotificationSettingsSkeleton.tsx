import React from "react";
import { ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { BackButton } from "@/components/ui/BackButton";
import { Card } from "@/components/ui/Card";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { useTranslation } from "@/lib/i18n";
import { toRN } from "@/lib/units";
import { useStyles, useTheme } from "@/themes";

export function NotificationSettingsSkeleton() {
  const styles = useStyles(makeStyles);
  const { t } = useTranslation();
  const router = useRouter();

  const renderToggleRow = (key: number, hasSubText: boolean = true) => (
    <View key={key} style={styles.settingRow}>
      <SkeletonBox width={40} height={40} borderRadius={12} />
      <View style={styles.settingContent}>
        <SkeletonBox width={120} height={16} borderRadius={6} />
        {hasSubText && (
          <SkeletonBox width={180} height={12} borderRadius={4} style={{ marginTop: 4 }} />
        )}
      </View>
      <SkeletonBox width={50} height={30} borderRadius={15} />
    </View>
  );

  return (
    <View style={styles.container}>
      <BackButton
        title={t("notifications.settings.title") || "Notification Settings"}
        onPress={() => router.back()}
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Master Toggle Card */}
        <Card style={styles.card}>
          <View style={styles.masterRow}>
            <View style={{ flex: 1 }}>
              <SkeletonBox width={140} height={18} borderRadius={6} />
              <SkeletonBox width={200} height={12} borderRadius={4} style={{ marginTop: 6 }} />
            </View>
            <SkeletonBox width={50} height={30} borderRadius={15} />
          </View>
        </Card>

        {/* Delivery Section */}
        <SkeletonBox width={80} height={14} borderRadius={4} style={styles.sectionTitle} />
        <Card style={styles.card}>
          {renderToggleRow(1)}
          <View style={styles.divider} />
          {renderToggleRow(2)}
        </Card>

        {/* Categories Section */}
        <SkeletonBox width={90} height={14} borderRadius={4} style={styles.sectionTitle} />
        <Card style={styles.card}>
          {[1, 2, 3, 4, 5, 6].map((i, index) => (
            <React.Fragment key={i}>
              {renderToggleRow(i)}
              {index < 5 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </Card>

        {/* Quiet Hours Section */}
        <SkeletonBox width={100} height={14} borderRadius={4} style={styles.sectionTitle} />
        <Card style={styles.card}>
          {renderToggleRow(1, false)}
          <View style={styles.divider} />
          <View style={styles.timeRow}>
            <SkeletonBox width={80} height={14} borderRadius={4} />
            <SkeletonBox width={70} height={36} borderRadius={8} />
          </View>
          <View style={styles.timeRow}>
            <SkeletonBox width={80} height={14} borderRadius={4} />
            <SkeletonBox width={70} height={36} borderRadius={8} />
          </View>
        </Card>
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
  masterRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const
  },
  sectionTitle: {
    marginBottom: toRN(tokens.spacing[3]),
    marginTop: toRN(tokens.spacing[2])
  },
  settingRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[2])
  },
  settingContent: {
    flex: 1,
    marginLeft: toRN(tokens.spacing[3])
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginVertical: toRN(tokens.spacing[2])
  },
  timeRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingVertical: toRN(tokens.spacing[3])
  }
});

export default NotificationSettingsSkeleton;
