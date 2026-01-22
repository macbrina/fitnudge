import React, { useState, useEffect, useMemo } from "react";
import {
  Modal as RNModal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Linking
} from "react-native";
import { useTranslation } from "@/lib/i18n";
import { fontFamily } from "@/lib/fonts";
import { toRN } from "@/lib/units";
import { useStyles } from "@/themes/makeStyles";
import { useTheme } from "@/themes";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tokens } from "@/themes/tokens";
import { useExternalUrls } from "@/hooks/api/useAppConfig";

interface FaqItem {
  questionKey: string;
  answerKey: string;
}

interface FaqPurchaseModalProps {
  visible: boolean;
  onClose: () => void;
}

// FAQ items organized by category
const FAQ_ITEMS: FaqItem[] = [
  // Trial Questions
  { questionKey: "faq_purchase.trial.how_works_q", answerKey: "faq_purchase.trial.how_works_a" },
  { questionKey: "faq_purchase.trial.charged_q", answerKey: "faq_purchase.trial.charged_a" },
  { questionKey: "faq_purchase.trial.cancel_q", answerKey: "faq_purchase.trial.cancel_a" },
  // Billing Questions
  {
    questionKey: "faq_purchase.billing.when_charged_q",
    answerKey: "faq_purchase.billing.when_charged_a"
  },
  { questionKey: "faq_purchase.billing.cancel_q", answerKey: "faq_purchase.billing.cancel_a" },
  { questionKey: "faq_purchase.billing.refund_q", answerKey: "faq_purchase.billing.refund_a" },
  {
    questionKey: "faq_purchase.billing.change_plan_q",
    answerKey: "faq_purchase.billing.change_plan_a"
  },
  // Features Questions
  {
    questionKey: "faq_purchase.features.included_q",
    answerKey: "faq_purchase.features.included_a"
  },
  {
    questionKey: "faq_purchase.features.lose_data_q",
    answerKey: "faq_purchase.features.lose_data_a"
  },
  // Technical Questions
  {
    questionKey: "faq_purchase.technical.restore_q",
    answerKey: "faq_purchase.technical.restore_a"
  },
  {
    questionKey: "faq_purchase.technical.not_working_q",
    answerKey: "faq_purchase.technical.not_working_a"
  },
  {
    questionKey: "faq_purchase.technical.multi_device_q",
    answerKey: "faq_purchase.technical.multi_device_a"
  }
];

export function FaqPurchaseModal({ visible, onClose }: FaqPurchaseModalProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const insets = useSafeAreaInsets();
  const externalUrls = useExternalUrls();
  const screenHeight = Dimensions.get("window").height;

  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  // Animation values
  const translateY = useMemo(() => new Animated.Value(screenHeight), []);
  const [internalVisible, setInternalVisible] = useState(visible);

  // Handle modal visibility animation
  useEffect(() => {
    if (visible) {
      setInternalVisible(true);
      setExpandedIndex(null); // Reset expanded state when opening
      Animated.spring(translateY, {
        toValue: 0,
        damping: 20,
        mass: 1,
        stiffness: 120,
        useNativeDriver: true
      }).start();
    } else if (internalVisible) {
      Animated.timing(translateY, {
        toValue: screenHeight,
        duration: 300,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true
      }).start(() => {
        setInternalVisible(false);
      });
    }
  }, [visible, translateY, screenHeight, internalVisible]);

  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  if (!internalVisible && !visible) {
    return null;
  }

  return (
    <RNModal
      visible={internalVisible}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <Animated.View
          style={[
            styles.modalContainer,
            {
              transform: [{ translateY }]
            }
          ]}
        >
          <View
            style={[
              styles.contentContainer,
              {
                paddingTop: insets.top + toRN(tokens.spacing[4]),
                paddingBottom: insets.bottom + toRN(tokens.spacing[4])
              }
            ]}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>
                {t("faq_purchase.title") || "Frequently Asked Questions"}
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
                accessibilityLabel={t("common.close")}
                accessibilityRole="button"
              >
                <Ionicons
                  name="close"
                  size={toRN(tokens.typography.fontSize["2xl"])}
                  color={colors.text.primary}
                />
              </TouchableOpacity>
            </View>

            {/* FAQ Content */}
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {FAQ_ITEMS.map((item, index) => {
                const isExpanded = expandedIndex === index;
                return (
                  <View key={index} style={styles.faqItem}>
                    <TouchableOpacity
                      style={styles.questionRow}
                      onPress={() => toggleExpand(index)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.questionText}>{t(item.questionKey)}</Text>
                      <View
                        style={[styles.iconContainer, isExpanded && styles.iconContainerExpanded]}
                      >
                        <Ionicons
                          name={isExpanded ? "chevron-up" : "chevron-down"}
                          size={18}
                          color={isExpanded ? brandColors.primary : colors.text.tertiary}
                        />
                      </View>
                    </TouchableOpacity>
                    {isExpanded && (
                      <View style={styles.answerContainer}>
                        <Text style={styles.answerText}>{t(item.answerKey)}</Text>
                      </View>
                    )}
                  </View>
                );
              })}

              {/* Contact Support Link */}
              <View style={styles.supportSection}>
                <Text style={styles.supportText}>{t("faq_purchase.still_have_questions")}</Text>
                <TouchableOpacity
                  style={styles.supportLink}
                  onPress={() => Linking.openURL(externalUrls.contact)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="mail-outline" size={16} color={brandColors.primary} />
                  <Text style={styles.supportLinkText}>{t("faq_purchase.contact_support")}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </RNModal>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  keyboardView: {
    flex: 1
  },
  modalContainer: {
    flex: 1,
    width: "100%",
    height: "100%",
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg.canvas
  },
  contentContainer: {
    flex: 1,
    width: "100%"
  },
  header: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[2]),
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle
  },
  headerTitle: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
    flex: 1
  },
  closeButton: {
    width: toRN(tokens.spacing[10]),
    height: toRN(tokens.spacing[10]),
    borderRadius: toRN(tokens.borderRadius.full),
    backgroundColor: colors.bg.muted,
    justifyContent: "center" as const,
    alignItems: "center" as const
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[8])
  },
  faqItem: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle
  },
  questionRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingVertical: toRN(tokens.spacing[4]),
    gap: toRN(tokens.spacing[3])
  },
  questionText: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    lineHeight: toRN(tokens.typography.fontSize.base * 1.4)
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.bg.muted,
    alignItems: "center" as const,
    justifyContent: "center" as const
  },
  iconContainerExpanded: {
    backgroundColor: brand.primary + "15"
  },
  answerContainer: {
    paddingBottom: toRN(tokens.spacing[4]),
    paddingRight: toRN(tokens.spacing[8])
  },
  answerText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    lineHeight: toRN(tokens.typography.fontSize.sm * 1.6)
  },
  supportSection: {
    marginTop: toRN(tokens.spacing[6]),
    paddingTop: toRN(tokens.spacing[4]),
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2])
  },
  supportText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary
  },
  supportLink: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1.5]),
    paddingVertical: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[3])
  },
  supportLinkText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: brand.primary
  }
});

export default FaqPurchaseModal;
