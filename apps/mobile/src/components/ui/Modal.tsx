import React from "react";
import {
  View,
  Text,
  Modal as RNModal,
  TouchableOpacity,
  ScrollView,
  ViewStyle,
} from "react-native";
import { useTranslation } from "@/lib/i18n";
import { fontFamily } from "@/lib/fonts";
import { toRN } from "@/lib/units";
import { useStyles } from "@/themes/makeStyles";
import { useTheme } from "@/themes";
import Button from "./Button";

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  showCloseButton?: boolean;
  showFooter?: boolean;
  footerButtonTitle?: string;
  onFooterPress?: () => void;
  scrollable?: boolean;
  maxWidth?: number;
  maxHeight?: string | number;
  containerStyle?: ViewStyle;
  animationType?: "none" | "slide" | "fade";
}

export default function Modal({
  visible,
  onClose,
  title,
  children,
  footer,
  showCloseButton = true,
  showFooter = false,
  footerButtonTitle,
  onFooterPress,
  scrollable = true,
  maxWidth = 400,
  maxHeight = "80%",
  containerStyle,
  animationType = "fade",
}: ModalProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeModalStyles);
  const { colors } = useTheme();

  return (
    <RNModal
      visible={visible}
      transparent
      animationType={animationType}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContainer,
            { maxWidth, maxHeight },
            containerStyle,
          ]}
        >
          {/* Modal Header */}
          {(title || showCloseButton) && (
            <View style={styles.modalHeader}>
              {title && <Text style={styles.modalTitle}>{title}</Text>}
              {showCloseButton && (
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.modalCloseButton}
                >
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Modal Content */}
          {scrollable ? (
            <ScrollView
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          ) : (
            <View style={styles.modalContent}>{children}</View>
          )}

          {/* Modal Footer */}
          {showFooter && (
            <View style={styles.modalFooter}>
              {footer || (
                <Button
                  title={footerButtonTitle || t("common.done")}
                  onPress={onFooterPress || onClose}
                  variant="primary"
                  size="lg"
                  fullWidth
                />
              )}
            </View>
          )}
        </View>
      </View>
    </RNModal>
  );
}

const makeModalStyles = (tokens: any, colors: any, brand: any) => {
  return {
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "center" as const,
      alignItems: "center" as const,
      paddingHorizontal: toRN(tokens.spacing[5]),
    },
    modalContainer: {
      backgroundColor: colors.bg.card,
      borderRadius: toRN(tokens.borderRadius.xl),
      width: "100%",
      overflow: "hidden" as const,
      shadowColor: colors.shadow.default,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 8,
      flexDirection: "column" as const,
    },
    modalHeader: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      paddingHorizontal: toRN(tokens.spacing[6]),
      paddingTop: toRN(tokens.spacing[6]),
      paddingBottom: toRN(tokens.spacing[4]),
      borderBottomWidth: 1,
      borderBottomColor: colors.border.default,
    },
    modalTitle: {
      fontSize: toRN(tokens.typography.fontSize.xl),
      fontWeight: tokens.typography.fontWeight.bold,
      color: colors.text.primary,
      fontFamily: fontFamily.groteskBold,
      flex: 1,
    },
    modalCloseButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.bg.muted,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      marginLeft: toRN(tokens.spacing[4]),
    },
    modalCloseText: {
      fontSize: toRN(tokens.typography.fontSize.lg),
      color: colors.text.primary,
      fontFamily: fontFamily.groteskMedium,
    },
    modalScrollView: {
      flexShrink: 1,
      flexGrow: 0,
    },
    modalScrollContent: {
      padding: toRN(tokens.spacing[6]),
      flexGrow: 1,
      paddingBottom: toRN(tokens.spacing[4]),
    },
    modalContent: {
      padding: toRN(tokens.spacing[6]),
      flexGrow: 1,
    },
    modalFooter: {
      padding: toRN(tokens.spacing[6]),
      borderTopWidth: 1,
      borderTopColor: colors.border.default,
    },
  };
};
