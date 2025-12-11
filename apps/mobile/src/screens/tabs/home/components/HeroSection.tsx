import { useTranslation } from "@/lib/i18n";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useStyles, useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { useMemo } from "react";
import { Text, View } from "react-native";
import { SkeletonBox } from "@/components/ui/SkeletonBox";

interface HeroSectionProps {
  userName?: string;
}

export function HeroSection({ userName }: HeroSectionProps) {
  const styles = useStyles(makeHeroSectionStyles);
  const { colors } = useTheme();
  const { t } = useTranslation();

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return t("home.greeting_morning");
    if (hour < 18) return t("home.greeting_afternoon");
    return t("home.greeting_evening");
  }, [t]);

  const displayName = userName || t("common.user");

  return (
    <View style={styles.container}>
      <View style={styles.greetingContainer}>
        <Text style={styles.greeting}>
          {greeting}, {displayName}! 👋
        </Text>
        <Text style={styles.subtitle}>{t("home.subtitle")}</Text>
      </View>
    </View>
  );
}

const makeHeroSectionStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    backgroundColor: colors.bg.canvas,
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingTop: toRN(tokens.spacing[6]),
    paddingBottom: toRN(tokens.spacing[4]),
  },
  greetingContainer: {
    marginBottom: toRN(tokens.spacing[2]),
  },
  greeting: {
    fontSize: toRN(tokens.typography.fontSize["3xl"]),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[2]),
  },
  subtitle: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
  },
});
