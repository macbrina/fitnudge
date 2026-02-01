import { fontFamily } from "@/lib/fonts";
import { toRN } from "@/lib/units";
import type { Broadcast } from "@/services/api/notifications";
import { useStyles, useTheme } from "@/themes";
import { X } from "lucide-react-native";
import { useMemo, useState } from "react";
import {
  Image,
  ImageSourcePropType,
  Linking,
  Modal as RNModal,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import RenderHtml from "react-native-render-html";
import type { StylesConfig } from "react-native-render-html";
import Button from "@/components/ui/Button";

const DEFAULT_IMAGE = require("@assetsimages/images/announcement-image.png") as ImageSourcePropType;

interface BroadcastModalProps {
  visible: boolean;
  broadcast: Broadcast | null;
  onClose: () => void;
  onCtaPress?: (url: string, isDeeplink: boolean) => void;
}

function wrapBodyAsHtml(body: string): string {
  const raw = body?.trim() || "";
  if (!raw) return "<p></p>";
  const looksLikeHtml = /<[a-z][^>]*>/i.test(raw);
  if (looksLikeHtml) return raw;
  const escaped = raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return `<p>${escaped}</p>`;
}

export function BroadcastModal({ visible, broadcast, onClose, onCtaPress }: BroadcastModalProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const [imageError, setImageError] = useState(false);

  const htmlSource = useMemo(() => {
    if (!broadcast?.body) return { html: "<p></p>" };
    return { html: wrapBodyAsHtml(broadcast.body) };
  }, [broadcast?.body]);

  const tagsStyles: StylesConfig["tagsStyles"] = useMemo(
    () => ({
      p: {
        color: colors.text.secondary,
        fontSize: toRN(16),
        fontFamily: fontFamily.regular,
        lineHeight: 24,
        marginTop: 0,
        marginBottom: toRN(12)
      },
      strong: {
        fontFamily: fontFamily.bold,
        color: colors.text.primary
      },
      b: {
        fontFamily: fontFamily.bold,
        color: colors.text.primary
      },
      em: {
        fontFamily: fontFamily.regular,
        fontStyle: "italic",
        color: colors.text.secondary
      },
      i: {
        fontFamily: fontFamily.regular,
        fontStyle: "italic",
        color: colors.text.secondary
      },
      a: {
        color: brandColors.primary,
        textDecorationLine: "underline"
      },
      h2: {
        fontFamily: fontFamily.bold,
        fontSize: toRN(18),
        color: colors.text.primary,
        marginTop: toRN(16),
        marginBottom: toRN(8)
      },
      h3: {
        fontFamily: fontFamily.semiBold,
        fontSize: toRN(17),
        color: colors.text.primary,
        marginTop: toRN(12),
        marginBottom: toRN(6)
      },
      ul: {
        marginTop: toRN(4),
        marginBottom: toRN(12),
        paddingLeft: toRN(24)
      },
      ol: {
        marginTop: toRN(4),
        marginBottom: toRN(12),
        paddingLeft: toRN(24)
      },
      li: {
        color: colors.text.secondary,
        fontSize: toRN(16),
        fontFamily: fontFamily.regular,
        lineHeight: 24,
        marginBottom: toRN(8)
      },
      img: {
        maxWidth: "100%",
        width: "100%",
        height: toRN(160)
      }
    }),
    [colors.text.primary, colors.text.secondary, brandColors.primary]
  );

  const systemFonts = useMemo(() => [fontFamily.regular, fontFamily.medium, fontFamily.bold], []);

  const renderersProps = useMemo(
    () => ({
      img: {
        enableExperimentalPercentWidth: true,
        containerProps: {
          style: {
            borderRadius: toRN(12),
            overflow: "hidden",
            marginTop: toRN(12),
            marginBottom: toRN(12)
          }
        }
      }
    }),
    []
  );

  const baseStyle = useMemo(() => ({ color: colors.text.secondary }), [colors.text.secondary]);

  const useDefaultImage = broadcast ? !broadcast.image_url || imageError : false;
  const hasCtaUrl = !!(broadcast?.cta_url || broadcast?.deeplink);
  const ctaLabel = hasCtaUrl ? broadcast?.cta_label || "Learn more" : "Okay";

  const handleCta = () => {
    if (!broadcast) return;
    if (hasCtaUrl) {
      const url = broadcast.deeplink || broadcast.cta_url!;
      onClose();
      if (onCtaPress) {
        onCtaPress(url, !!broadcast.deeplink);
      } else {
        Linking.openURL(url);
      }
    } else {
      onClose();
    }
  };

  const contentWidth = width - insets.left - insets.right - toRN(40);

  if (!broadcast) return null;

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: colors.bg.surface }]}>
        <TouchableOpacity
          style={[styles.closeButton, { top: insets.top + toRN(8) }]}
          onPress={onClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <X size={24} color={colors.text.primary} />
        </TouchableOpacity>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + toRN(48),
              paddingBottom: toRN(24),
              paddingLeft: insets.left + toRN(20),
              paddingRight: insets.right + toRN(20)
            }
          ]}
          showsVerticalScrollIndicator={false}
        >
          {useDefaultImage ? (
            <Image
              source={DEFAULT_IMAGE}
              style={styles.image}
              resizeMode="contain"
              accessibilityLabel="Broadcast"
            />
          ) : (
            <Image
              source={{ uri: broadcast.image_url! }}
              style={styles.image}
              resizeMode="contain"
              onError={() => setImageError(true)}
              accessibilityLabel="Broadcast"
            />
          )}
          <Text style={[styles.title, { color: colors.text.primary }]}>{broadcast.title}</Text>
          <RenderHtml
            contentWidth={contentWidth}
            source={htmlSource}
            tagsStyles={tagsStyles}
            systemFonts={systemFonts}
            renderersProps={renderersProps}
            baseStyle={baseStyle}
          />
        </ScrollView>

        <View
          style={[
            styles.ctaWrap,
            {
              paddingBottom: insets.bottom + toRN(16),
              paddingLeft: insets.left + toRN(20),
              paddingRight: insets.right + toRN(20),
              borderTopColor: colors.border.subtle
            }
          ]}
        >
          <Button
            variant="primary"
            size="lg"
            borderRadius="xl"
            fullWidth
            title={ctaLabel}
            onPress={handleCta}
          />
        </View>
      </View>
    </RNModal>
  );
}

const makeStyles = (tokens: any, colors: any, _brand: any) => ({
  overlay: {
    flex: 1,
    backgroundColor: colors.bg.surface
  },
  closeButton: {
    position: "absolute" as const,
    right: toRN(tokens.spacing[4]),
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg.muted
  },
  scroll: {
    flex: 1
  },
  scrollContent: {
    paddingBottom: toRN(tokens.spacing[6])
  },
  image: {
    width: "100%",
    height: 160,
    marginBottom: toRN(tokens.spacing[5])
  },
  title: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.bold,
    marginBottom: toRN(tokens.spacing[3])
  },
  ctaWrap: {
    paddingTop: toRN(tokens.spacing[4]),
    borderTopWidth: 1
  }
});
