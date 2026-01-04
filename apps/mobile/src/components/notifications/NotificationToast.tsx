import React, { useEffect } from "react";
import { View, Text, TouchableOpacity, Animated, Dimensions } from "react-native";
import { useStyles } from "@/themes/makeStyles";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { tokens, lineHeight } from "@/themes/tokens";
import { useTheme } from "@/themes";
import { NotificationData } from "@/services/notifications/notificationTypes";

interface NotificationToastProps {
  visible: boolean;
  title: string;
  body: string;
  data?: NotificationData;
  onPress?: () => void;
  onDismiss?: () => void;
  duration?: number;
}

const { width } = Dimensions.get("window");

export const NotificationToast: React.FC<NotificationToastProps> = ({
  visible,
  title,
  body,
  data,
  onPress,
  onDismiss,
  duration = 4000
}) => {
  const styles = useStyles(makeNotificationToastStyles);
  const { colors } = useTheme();
  const translateY = React.useRef(new Animated.Value(-100)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Show animation
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true
        })
      ]).start();

      // Auto dismiss
      const timer = setTimeout(() => {
        hideToast();
      }, duration);

      return () => clearTimeout(timer);
    } else {
      hideToast();
    }
  }, [visible]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true
      })
    ]).start(() => {
      onDismiss?.();
    });
  };

  const handlePress = () => {
    hideToast();
    onPress?.();
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY }],
          opacity
        }
      ]}
    >
      <TouchableOpacity style={styles.toast} onPress={handlePress} activeOpacity={0.8}>
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.body} numberOfLines={2}>
            {body}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.dismissButton}
          onPress={hideToast}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.dismissText}>×</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
};

const makeNotificationToastStyles = (tokens: any, colors: any, brand: any) => {
  return {
    container: {
      position: "absolute" as const,
      top: toRN(tokens.spacing[16]), // Below status bar
      left: toRN(tokens.spacing[4]),
      right: toRN(tokens.spacing[4]),
      zIndex: 1000
    },
    toast: {
      backgroundColor: colors.bg.card,
      borderRadius: toRN(tokens.borderRadius.lg),
      padding: toRN(tokens.spacing[4]),
      flexDirection: "row" as const,
      alignItems: "flex-start" as const,
      shadowColor: colors.text.primary,
      shadowOffset: {
        width: 0,
        height: 4
      },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 8,
      borderWidth: 1,
      borderColor: colors.border.primary
    },
    content: {
      flex: 1,
      marginRight: toRN(tokens.spacing[2])
    },
    title: {
      fontSize: toRN(tokens.typography.fontSize.base),
      fontWeight: tokens.typography.fontWeight.semibold,
      color: colors.text.primary,
      marginBottom: toRN(tokens.spacing[1]),
      fontFamily: fontFamily.groteskSemiBold
    },
    body: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      color: colors.text.secondary,
      lineHeight: lineHeight(tokens.typography.fontSize.sm, tokens.typography.lineHeight.relaxed),
      fontFamily: fontFamily.groteskRegular
    },
    dismissButton: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.bg.secondary,
      justifyContent: "center" as const,
      alignItems: "center" as const
    },
    dismissText: {
      fontSize: 16,
      color: colors.text.muted,
      fontWeight: "bold" as const,
      fontFamily: fontFamily.groteskBold
    }
  };
};
