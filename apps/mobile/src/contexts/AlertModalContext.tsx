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
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from "react-native";
import { useTheme } from "@/themes";
import { useStyles } from "@/themes/makeStyles";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { Ionicons } from "@expo/vector-icons";

type AlertVariant = "success" | "warning" | "error" | "info";

export interface AlertOptions {
  title: string;
  message?: string;
  variant?: AlertVariant;
  confirmLabel?: string;
  cancelLabel?: string;
  showCancel?: boolean;
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
    options: Omit<AlertOptions, "showCancel"> & { duration?: number }
  ) => void;
  dismiss: () => void;
}

const AlertModalContext = createContext<AlertModalContextValue | undefined>(
  undefined
);

const DEFAULT_OPTIONS: AlertOptions = {
  title: "",
  message: "",
  variant: "info",
  confirmLabel: "OK",
  cancelLabel: "Cancel",
  showCancel: false,
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
    flex: 1,
    backgroundColor: colors.bg.overlay,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: toRN(tokens.spacing[6]),
  },
  card: {
    width: "100%",
    maxWidth: 340,
    borderRadius: toRN(tokens.borderRadius["2xl"]),
    backgroundColor: colors.bg.canvas,
    padding: toRN(tokens.spacing[6]),
    shadowColor: colors.shadow.default,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 12,
  },
  illustrationContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: toRN(tokens.spacing[4]),
  },
  title: {
    fontSize: toRN(tokens.typography.fontSize["2xl"]),
    fontWeight: tokens.typography.fontWeight.bold,
    fontFamily: fontFamily.groteskBold,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[2]),
    color: colors.text.primary,
  },
  message: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.4,
    textAlign: "center" as const,
    color: colors.text.secondary,
    fontFamily: fontFamily.groteskRegular,
    marginBottom: toRN(tokens.spacing[6]),
  },
  buttonRow: {
    flexDirection: "row" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[4]),
  },
  button: {
    flex: 1,
    borderRadius: toRN(tokens.borderRadius.full),
    paddingVertical: toRN(tokens.spacing[3]),
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  cancelButton: {
    backgroundColor: colors.bg.muted,
  },
  buttonText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.groteskSemiBold,
  },
});

export const AlertModalProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { tokens, colors, brandColors } = useTheme();
  const styles = useStyles(makeStyles);
  const [queue, setQueue] = useState<AlertRequest[]>([]);
  const [currentAlert, setCurrentAlert] = useState<AlertRequest | null>(null);
  const [visible, setVisible] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
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
    if (visible) {
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
    } else if (currentAlert) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 20,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setCurrentAlert(null);
      });
    }
  }, [visible, opacity, translateY, currentAlert]);

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
    [enqueueAlert]
  );

  const showConfirm = useCallback(
    (options: AlertOptions) =>
      enqueueAlert({
        ...options,
        showCancel: true,
        dismissible: false,
      }),
    [enqueueAlert]
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
    [enqueueAlert]
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
    [currentAlert]
  );

  const handleBackdropPress = useCallback(() => {
    if (currentAlert?.dismissible) {
      handleResolve(false);
    }
  }, [currentAlert, handleResolve]);

  const value = useMemo<AlertModalContextValue>(
    () => ({
      showAlert,
      showConfirm,
      showToast,
      dismiss,
    }),
    [showAlert, showConfirm, showToast, dismiss]
  );

  const variant = currentAlert?.variant ?? "info";
  const variantStyle = variantConfig[variant];
  const confirmColor = variantStyle.confirmColor({
    colors,
    brandColors,
  });
  const confirmTextColor = variantStyle.confirmTextColor
    ? variantStyle.confirmTextColor({ colors, brandColors })
    : "#ffffff";
  const iconColor =
    currentAlert?.iconColor ??
    variantStyle.accentColor({ colors, brandColors });

  return (
    <AlertModalContext.Provider value={value}>
      {children}
      <Modal
        transparent
        statusBarTranslucent
        visible={Boolean(currentAlert)}
        animationType="none"
        onRequestClose={handleBackdropPress}
      >
        <Animated.View
          style={[
            styles.overlay,
            {
              opacity,
            },
          ]}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={StyleSheet.absoluteFill}
            onPress={handleBackdropPress}
          />
          <Animated.View
            style={[
              styles.card,
              {
                transform: [{ translateY }],
              },
            ]}
          >
            <View style={styles.illustrationContainer}>
              <View
                style={{
                  width: toRN(tokens.spacing[16]),
                  height: toRN(tokens.spacing[16]),
                  borderRadius: toRN(tokens.spacing[8]),
                  backgroundColor: variantStyle.illustrationColor,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: toRN(tokens.spacing[4]),
                }}
              >
                <Ionicons
                  name={currentAlert?.iconName ?? variantStyle.icon}
                  size={toRN(tokens.typography.fontSize["4xl"])}
                  color={iconColor}
                />
              </View>
            </View>

            <Text
              style={[
                styles.title,
                {
                  color: variantStyle.textColor({
                    colors,
                    brandColors,
                  }),
                },
              ]}
            >
              {currentAlert?.title}
            </Text>

            {!!currentAlert?.message && (
              <Text style={styles.message}>{currentAlert.message}</Text>
            )}

            <View style={styles.buttonRow}>
              {currentAlert?.showCancel && (
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={() => handleResolve(false)}
                >
                  <Text
                    style={[styles.buttonText, { color: colors.text.primary }]}
                  >
                    {currentAlert.cancelLabel}
                  </Text>
                </TouchableOpacity>
              )}
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
                  {currentAlert?.confirmLabel}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
    </AlertModalContext.Provider>
  );
};

export const useAlertModal = (): AlertModalContextValue => {
  const context = useContext(AlertModalContext);
  if (!context) {
    throw new Error("useAlertModal must be used within an AlertModalProvider");
  }
  return context;
};
