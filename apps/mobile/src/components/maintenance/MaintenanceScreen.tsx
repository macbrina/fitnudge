import { useTranslation } from "@/lib/i18n";
import { fontFamily } from "@/lib/fonts";
import { toRN } from "@/lib/units";
import { useStyles, useTheme } from "@/themes";
import { useState } from "react";
import { Image, ImageSourcePropType, Linking, Text, TouchableOpacity, View } from "react-native";
import Button from "@/components/ui/Button";

const DEFAULT_IMAGE = require("@assetsimages/images/maintenance-image.png") as ImageSourcePropType;

interface MaintenanceScreenProps {
  title: string;
  message: string;
  imageUrl?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  onRetry?: () => void;
  isRetrying?: boolean;
}

export function MaintenanceScreen({
  title,
  message,
  imageUrl,
  ctaLabel,
  ctaUrl,
  onRetry,
  isRetrying = false
}: MaintenanceScreenProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const [imageError, setImageError] = useState(false);

  const useDefaultImage = !imageUrl || imageError;
  const showCta = !!(ctaLabel && ctaUrl);

  const handleCta = () => {
    if (ctaUrl) Linking.openURL(ctaUrl);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.canvas }]}>
      <View style={styles.content}>
        {useDefaultImage ? (
          <Image
            source={DEFAULT_IMAGE}
            style={styles.image}
            resizeMode="contain"
            accessibilityLabel="Maintenance"
          />
        ) : (
          <Image
            source={{ uri: imageUrl }}
            style={styles.image}
            resizeMode="contain"
            onError={() => setImageError(true)}
            accessibilityLabel="Maintenance"
          />
        )}
        <Text style={[styles.title, { color: colors.text.primary }]}>{title}</Text>
        <Text style={[styles.message, { color: colors.text.secondary }]}>{message}</Text>
        {showCta && (
          <TouchableOpacity
            style={[styles.cta, { backgroundColor: brandColors.primary }]}
            onPress={handleCta}
            activeOpacity={0.8}
          >
            <Text style={styles.ctaLabel}>{ctaLabel}</Text>
          </TouchableOpacity>
        )}
        {onRetry && (
          <Button
            variant="outline"
            size="md"
            borderRadius="lg"
            title={t("common.check_again")}
            onPress={onRetry}
            loading={isRetrying}
            disabled={isRetrying}
            style={styles.retryButton}
          />
        )}
      </View>
    </View>
  );
}

const makeStyles = (tokens: any, _colors: any, _brand: any) => ({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: toRN(tokens.spacing[6])
  },
  content: {
    maxWidth: 340,
    alignItems: "center"
  },
  image: {
    width: 100,
    height: 100,
    marginBottom: toRN(tokens.spacing[6])
  },
  title: {
    fontSize: toRN(tokens.typography.fontSize["2xl"]),
    fontFamily: fontFamily.bold,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[3])
  },
  message: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.regular,
    textAlign: "center" as const,
    lineHeight: toRN(tokens.typography.fontSize.base) * 1.5,
    marginBottom: toRN(tokens.spacing[6])
  },
  cta: {
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[6]),
    borderRadius: 12
  },
  ctaLabel: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: "#fff"
  },
  retryButton: {
    marginTop: toRN(tokens.spacing[4])
  }
});
