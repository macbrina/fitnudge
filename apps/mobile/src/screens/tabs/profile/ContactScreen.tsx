import React from "react";
import { View, Text, Linking, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/lib/i18n";
import { useStyles, useTheme } from "@/themes";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { BackButton } from "@/components/ui/BackButton";
import { Card } from "@/components/ui/Card";
import { EXTERNAL_URLS } from "@/constants/general";
import { MOBILE_ROUTES } from "@/lib/routes";

export default function ContactScreen() {
  const router = useRouter();
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();

  const handleEmailPress = () => {
    Linking.openURL(EXTERNAL_URLS.CONTACT);
  };

  const handleChatPress = () => {
    router.push(MOBILE_ROUTES.PROFILE.LIVE_CHAT as any);
  };

  return (
    <View style={styles.container}>
      <BackButton title={t("profile.contact_us") || "Contact Us"} onPress={() => router.back()} />

      <View style={styles.content}>
        <Text style={styles.description}>
          {t("contact.description") || "Have questions or feedback? We'd love to hear from you!"}
        </Text>

        <Card style={styles.menuCard}>
          {/* Email Option */}
          <TouchableOpacity style={styles.menuItem} onPress={handleEmailPress} activeOpacity={0.7}>
            <View style={[styles.menuIcon, { backgroundColor: `${brandColors.primary}15` }]}>
              <Ionicons name="mail-outline" size={22} color={brandColors.primary} />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuLabel}>{t("contact.send_email") || "Send us an Email"}</Text>
              <Text style={styles.menuDescription}>
                {t("contact.send_email_desc") || "We typically respond within 24 hours"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Live Chat Option */}
          <TouchableOpacity style={styles.menuItem} onPress={handleChatPress} activeOpacity={0.7}>
            <View style={[styles.menuIcon, { backgroundColor: `${colors.feedback.success}15` }]}>
              <Ionicons name="chatbubbles-outline" size={22} color={colors.feedback.success} />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuLabel}>{t("contact.live_chat") || "Chat with Us"}</Text>
              <Text style={styles.menuDescription}>
                {t("contact.live_chat_desc") || "Get instant support from our team"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
          </TouchableOpacity>
        </Card>
      </View>
    </View>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas
  },
  content: {
    flex: 1,
    padding: toRN(tokens.spacing[4])
  },
  description: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[6]),
    lineHeight: toRN(tokens.typography.fontSize.base) * 1.5
  },
  menuCard: {
    padding: 0,
    overflow: "hidden" as const
  },
  menuItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[4])
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginRight: toRN(tokens.spacing[3])
  },
  menuContent: {
    flex: 1
  },
  menuLabel: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[0.5])
  },
  menuDescription: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginLeft: 60
  }
});
