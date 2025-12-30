import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Modal,
} from "react-native";
import { useTheme } from "@/themes";
import { useStyles } from "@/themes/makeStyles";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { Ionicons } from "@expo/vector-icons";

type AlertVariant = "success" | "warning" | "error" | "info";
type AlertSize = "sm" | "md" | "lg";

// Size configuration for different modal widths
const SIZE_CONFIG: Record<AlertSize, number> = {
  sm: 260,
  md: 300,
  lg: 340,
};

export interface AlertOptions {
  title: string;
  message?: string;
  variant?: AlertVariant;
  /** Size of the modal - sm (260px), md (300px), lg (340px). Default: md */
  size?: AlertSize;
  /** Text alignment for message - useful for lists/bullet points. Default: center */
  messageAlign?: "left" | "center" | "right";
  /** Custom content to render instead of message string */
  content?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  showCancel?: boolean;
  showCloseIcon?: boolean;
  dismissible?: boolean;
  autoCloseMs?: number;
  iconName?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
}

interface AlertRequest extends AlertOptions {
  id: string;
  resolve: (result: boolean) => void;
}

interface AlertModalContextValue {
  showAlert: (options: AlertOptions) => Promise<boolean>;
  showConfirm: (options: AlertOptions) => Promise<boolean>;
  showToast: (
    options: Omit<AlertOptions, "showCancel"> & { duration?: number },
  ) => void;
  dismiss: () => void;
  // Internal state for AlertOverlay
  currentAlert: AlertRequest | null;
  handleResolve: (result: boolean) => void;
}

const AlertModalContext = createContext<AlertModalContextValue | undefined>(
  undefined,
);

const DEFAULT_OPTIONS: AlertOptions = {
  title: "",
  message: "",
  variant: "info",
  size: "md",
  messageAlign: "center",
  confirmLabel: "OK",
  cancelLabel: "Cancel",
  showCancel: false,
  showCloseIcon: false,
  dismissible: true,
};

const variantConfig: Record<
  AlertVariant,
  {
    icon: keyof typeof Ionicons.glyphMap;
    illustrationColor: string;
    accentColor: (theme: {
      colors: ReturnType<typeof useTheme>["colors"];
      brandColors: ReturnType<typeof useTheme>["brandColors"];
    }) => string;
    textColor: (theme: {
      colors: ReturnType<typeof useTheme>["colors"];
      brandColors: ReturnType<typeof useTheme>["brandColors"];
    }) => string;
    confirmColor: (theme: {
      colors: ReturnType<typeof useTheme>["colors"];
      brandColors: ReturnType<typeof useTheme>["brandColors"];
    }) => string;
    confirmTextColor?: (theme: {
      colors: ReturnType<typeof useTheme>["colors"];
      brandColors: ReturnType<typeof useTheme>["brandColors"];
    }) => string;
  }
> = {
  success: {
    icon: "checkmark-circle",
    illustrationColor: "#DCFCE7",
    accentColor: ({ brandColors }) => brandColors.primary,
    textColor: ({ colors }) => colors.text.primary,
    confirmColor: ({ brandColors }) => brandColors.primary,
    confirmTextColor: () => "#ffffff",
  },
  warning: {
    icon: "warning",
    illustrationColor: "#FEF3C7",
    accentColor: ({ colors }) => colors.bg.warning,
    textColor: ({ colors }) => colors.text.primary,
    confirmColor: ({ colors }) => colors.bg.warning,
    confirmTextColor: ({ colors }) => colors.text.primary,
  },
  error: {
    icon: "close-circle",
    illustrationColor: "#FEE2E2",
    accentColor: ({ colors }) => colors.feedback.error,
    textColor: ({ colors }) => colors.text.primary,
    confirmColor: ({ colors }) => colors.feedback.error,
    confirmTextColor: () => "#ffffff",
  },
  info: {
    icon: "information-circle",
    illustrationColor: "#E0F2FE",
    accentColor: ({ brandColors }) => brandColors.primary,
    textColor: ({ colors }) => colors.text.primary,
    confirmColor: ({ brandColors }) => brandColors.primary,
    confirmTextColor: () => "#ffffff",
  },
};

const makeStyles = (tokens: any, colors: any, brandColors: any) => ({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.4)", // Slightly lighter overlay
    justifyContent: "center" as const,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[6]),
    zIndex: 9999,
  },
  // Base card style - maxWidth is applied dynamically based on size prop
  card: {
    width: "100%",
    maxWidth: SIZE_CONFIG.md, // Default, overridden dynamically
    borderRadius: toRN(tokens.borderRadius["2xl"]),
    backgroundColor: colors.bg.canvas,
    paddingTop: toRN(tokens.spacing[6]),
    paddingBottom: toRN(tokens.spacing[5]),
    paddingHorizontal: toRN(tokens.spacing[6]),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 16,
    position: "relative" as const,
    overflow: "visible" as const,
  },
  closeIconButton: {
    position: "absolute" as const,
    top: toRN(tokens.spacing[2]),
    right: toRN(tokens.spacing[2]),
    width: toRN(tokens.spacing[7]),
    height: toRN(tokens.spacing[7]),
    borderRadius: toRN(tokens.borderRadius.full),
    backgroundColor: colors.bg.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    zIndex: 10,
  },
  illustrationContainer: {
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginBottom: toRN(tokens.spacing[3]),
  },
  title: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontWeight: tokens.typography.fontWeight.semibold,
    fontFamily: fontFamily.groteskSemiBold,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[1]),
    color: colors.text.primary,
  },
  message: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5,
    textAlign: "center" as const, // Default, overridden dynamically
    color: colors.text.secondary,
    fontFamily: fontFamily.regular,
    marginBottom: toRN(tokens.spacing[5]),
  },
  messageLeft: {
    textAlign: "left" as const,
  },
  messageRight: {
    textAlign: "right" as const,
  },
  contentContainer: {
    marginBottom: toRN(tokens.spacing[5]),
  },
  buttonRow: {
    flexDirection: "column" as const,
    gap: toRN(tokens.spacing[2]),
    width: "100%",
  },
  button: {
    width: "100%",
    borderRadius: toRN(tokens.borderRadius.lg),
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[4]),
    minHeight: 44,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  cancelButton: {
    backgroundColor: colors.bg.secondary,
  },
  buttonText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
  },
});

interface AlertOverlayProps {
  /**
   * Controls whether the AlertOverlay is active and should show alerts.
   * When false, the overlay is completely hidden regardless of alert state.
   * Defaults to true for backward compatibility.
   */
  visible?: boolean;
}

/**
 * AlertOverlay Component (OPTIONAL)
 *
 * NOTE: In most cases you DON'T need this component!
 * The AlertModalProvider automatically renders alerts at the root level.
 * Just call showAlert() or showConfirm() and it works.
 *
 * Only use AlertOverlay if you need alerts to appear INSIDE a specific Modal
 * (where the global alert might be hidden behind the modal's overlay).
 *
 * Usage (only for special cases):
 * ```tsx
 * <Modal visible={visible}>
 *   <View style={styles.container}>
 *     {content}
 *     <AlertOverlay visible={visible} />
 *   </View>
 * </Modal>
 * ```
 */
export const AlertOverlay: React.FC<AlertOverlayProps> = ({
  visible = true,
}) => {
  const context = useContext(AlertModalContext);
  const { tokens, colors, brandColors } = useTheme();
  const styles = useStyles(makeStyles);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  const currentAlert = context?.currentAlert;
  const handleResolve = context?.handleResolve;

  useEffect(() => {
    if (currentAlert && visible) {
      // Animate in
      opacity.setValue(0);
      translateY.setValue(20);
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          damping: 12,
          mass: 0.6,
          stiffness: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [currentAlert, visible, opacity, translateY]);

  // Don't render if not visible or no alert
  if (!visible || !context || !currentAlert || !handleResolve) {
    return null;
  }

  const variant = currentAlert.variant ?? "info";
  const variantStyle = variantConfig[variant];
  const confirmColor = variantStyle.confirmColor({ colors, brandColors });
  const confirmTextColor = variantStyle.confirmTextColor
    ? variantStyle.confirmTextColor({ colors, brandColors })
    : "#ffffff";
  const iconColor =
    currentAlert.iconColor ?? variantStyle.accentColor({ colors, brandColors });

  const handleBackdropPress = () => {
    if (currentAlert.dismissible) {
      handleResolve(false);
    }
  };

  return (
    <Animated.View style={[styles.overlay, { opacity }]}>
      <TouchableOpacity
        activeOpacity={1}
        style={StyleSheet.absoluteFill}
        onPress={handleBackdropPress}
      />
      <Animated.View
        style={[
          styles.card,
          {
            maxWidth: SIZE_CONFIG[currentAlert.size ?? "md"],
            transform: [{ translateY }],
          },
        ]}
      >
        {currentAlert.showCloseIcon && (
          <TouchableOpacity
            style={styles.closeIconButton}
            onPress={() => handleResolve(false)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={18} color={colors.text.primary} />
          </TouchableOpacity>
        )}
        <View style={styles.illustrationContainer}>
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: variantStyle.illustrationColor,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons
              name={currentAlert.iconName ?? variantStyle.icon}
              size={26}
              color={iconColor}
            />
          </View>
        </View>

        <Text
          style={[
            styles.title,
            {
              color: variantStyle.textColor({ colors, brandColors }),
            },
          ]}
        >
          {currentAlert.title}
        </Text>

        {/* Custom content takes precedence over message string */}
        {currentAlert.content ? (
          <View style={styles.contentContainer}>{currentAlert.content}</View>
        ) : (
          !!currentAlert.message && (
            <Text
              style={[
                styles.message,
                currentAlert.messageAlign === "left" && styles.messageLeft,
                currentAlert.messageAlign === "right" && styles.messageRight,
              ]}
            >
              {currentAlert.message}
            </Text>
          )
        )}

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[
              styles.button,
              {
                backgroundColor: confirmColor,
              },
            ]}
            onPress={() => handleResolve(true)}
          >
            <Text
              style={[
                styles.buttonText,
                {
                  color: confirmTextColor,
                },
              ]}
            >
              {currentAlert.confirmLabel}
            </Text>
          </TouchableOpacity>
          {currentAlert.showCancel && (
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={() => handleResolve(false)}
            >
              <Text style={[styles.buttonText, { color: colors.text.primary }]}>
                {currentAlert.cancelLabel}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    </Animated.View>
  );
};

export const AlertModalProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [queue, setQueue] = useState<AlertRequest[]>([]);
  const [currentAlert, setCurrentAlert] = useState<AlertRequest | null>(null);
  const [visible, setVisible] = useState(false);
  const autoCloseTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!currentAlert && queue.length > 0) {
      const [next, ...rest] = queue;
      setCurrentAlert(next);
      setQueue(rest);
      setVisible(true);
    }
  }, [queue, currentAlert]);

  useEffect(() => {
    if (!visible && currentAlert) {
      // Small delay before clearing to allow animation
      const timer = setTimeout(() => {
        setCurrentAlert(null);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [visible, currentAlert]);

  useEffect(() => {
    if (currentAlert?.autoCloseMs) {
      autoCloseTimer.current = setTimeout(() => {
        handleResolve(true);
      }, currentAlert.autoCloseMs);
      return () => {
        if (autoCloseTimer.current) {
          clearTimeout(autoCloseTimer.current);
        }
      };
    }
    return undefined;
  }, [currentAlert]);

  const enqueueAlert = useCallback((options: AlertOptions) => {
    return new Promise<boolean>((resolve) => {
      const id = Math.random().toString(36).slice(2);
      setQueue((prev) => [
        ...prev,
        { ...DEFAULT_OPTIONS, ...options, id, resolve },
      ]);
    });
  }, []);

  const showAlert = useCallback(
    (options: AlertOptions) => enqueueAlert({ ...options, showCancel: false }),
    [enqueueAlert],
  );

  const showConfirm = useCallback(
    (options: AlertOptions) =>
      enqueueAlert({
        ...options,
        showCancel: true,
        showCloseIcon: true,
        dismissible: false,
      }),
    [enqueueAlert],
  );

  const showToast = useCallback(
    (options: Omit<AlertOptions, "showCancel"> & { duration?: number }) => {
      enqueueAlert({
        ...options,
        showCancel: false,
        dismissible: true,
        autoCloseMs: options.autoCloseMs ?? options.duration ?? 2400,
      });
    },
    [enqueueAlert],
  );

  const dismiss = useCallback(() => {
    setVisible(false);
  }, []);

  const handleResolve = useCallback(
    (result: boolean) => {
      if (!currentAlert) return;
      if (autoCloseTimer.current) {
        clearTimeout(autoCloseTimer.current);
        autoCloseTimer.current = null;
      }
      currentAlert.resolve(result);
      setVisible(false);
    },
    [currentAlert],
  );

  const value = useMemo<AlertModalContextValue>(
    () => ({
      showAlert,
      showConfirm,
      showToast,
      dismiss,
      // Expose for AlertOverlay
      currentAlert: visible ? currentAlert : null,
      handleResolve,
    }),
    [
      showAlert,
      showConfirm,
      showToast,
      dismiss,
      currentAlert,
      visible,
      handleResolve,
    ],
  );

  return (
    <AlertModalContext.Provider value={value}>
      {children}
      {/* Global Alert Modal - automatically shows alerts without needing AlertOverlay */}
      <AlertModal
        alert={visible ? currentAlert : null}
        onResolve={handleResolve}
      />
    </AlertModalContext.Provider>
  );
};

/**
 * Internal Alert Modal Component
 * Renders the alert UI inside a React Native Modal at the root level.
 */
const AlertModal: React.FC<{
  alert: AlertRequest | null;
  onResolve: (result: boolean) => void;
}> = ({ alert, onResolve }) => {
  const { tokens, colors, brandColors } = useTheme();
  const styles = useStyles(makeStyles);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (alert) {
      // Animate in
      opacity.setValue(0);
      translateY.setValue(20);
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          damping: 12,
          mass: 0.6,
          stiffness: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [alert, opacity, translateY]);

  if (!alert) {
    return null;
  }

  const variant = alert.variant ?? "info";
  const variantStyle = variantConfig[variant];
  const confirmColor = variantStyle.confirmColor({ colors, brandColors });
  const confirmTextColor = variantStyle.confirmTextColor
    ? variantStyle.confirmTextColor({ colors, brandColors })
    : "#ffffff";
  const iconColor =
    alert.iconColor ?? variantStyle.accentColor({ colors, brandColors });

  const handleBackdropPress = () => {
    if (alert.dismissible) {
      onResolve(false);
    }
  };

  return (
    <Modal
      visible={!!alert}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => {
        if (alert.dismissible) {
          onResolve(false);
        }
      }}
    >
      <Animated.View style={[styles.overlay, { opacity }]}>
        <TouchableOpacity
          activeOpacity={1}
          style={StyleSheet.absoluteFill}
          onPress={handleBackdropPress}
        />
        <Animated.View
          style={[
            styles.card,
            {
              maxWidth: SIZE_CONFIG[alert.size ?? "md"],
              transform: [{ translateY }],
            },
          ]}
        >
          {alert.showCloseIcon && (
            <TouchableOpacity
              style={styles.closeIconButton}
              onPress={() => onResolve(false)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={18} color={colors.text.primary} />
            </TouchableOpacity>
          )}
          <View style={styles.illustrationContainer}>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: variantStyle.illustrationColor,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons
                name={alert.iconName ?? variantStyle.icon}
                size={26}
                color={iconColor}
              />
            </View>
          </View>

          <Text
            style={[
              styles.title,
              {
                color: variantStyle.textColor({ colors, brandColors }),
              },
            ]}
          >
            {alert.title}
          </Text>

          {/* Custom content takes precedence over message string */}
          {alert.content ? (
            <View style={styles.contentContainer}>{alert.content}</View>
          ) : (
            !!alert.message && (
              <Text
                style={[
                  styles.message,
                  alert.messageAlign === "left" && styles.messageLeft,
                  alert.messageAlign === "right" && styles.messageRight,
                ]}
              >
                {alert.message}
              </Text>
            )
          )}

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[
                styles.button,
                {
                  backgroundColor: confirmColor,
                },
              ]}
              onPress={() => onResolve(true)}
            >
              <Text
                style={[
                  styles.buttonText,
                  {
                    color: confirmTextColor,
                  },
                ]}
              >
                {alert.confirmLabel}
              </Text>
            </TouchableOpacity>
            {alert.showCancel && (
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => onResolve(false)}
              >
                <Text
                  style={[styles.buttonText, { color: colors.text.primary }]}
                >
                  {alert.cancelLabel}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

export const useAlertModal = (): Omit<
  AlertModalContextValue,
  "currentAlert" | "handleResolve"
> => {
  const context = useContext(AlertModalContext);
  if (!context) {
    throw new Error("useAlertModal must be used within an AlertModalProvider");
  }
  // Only expose public API, not internal state
  const { showAlert, showConfirm, showToast, dismiss } = context;
  return { showAlert, showConfirm, showToast, dismiss };
};
