import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { useStyles } from "@/themes/makeStyles";
import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, Image, Text, View } from "react-native";

interface LoadingContainerProps {
  visible?: boolean;
  showText?: boolean;
  text?: string;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const makeLoadingContainerStyles = (tokens: any, colors: any, brandColors: any) => {
  return {
    container: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: screenWidth,
      height: screenHeight,
      backgroundColor: colors.bg.canvas,
      zIndex: 9999,
      justifyContent: "center",
      alignItems: "center"
    },
    image: {
      width: 150,
      height: 150
    },
    text: {
      fontSize: 28,
      fontWeight: "bold" as const
    },
    textContainer: {
      marginTop: 20
    },
    textStyle: {
      fontSize: 28,
      fontWeight: "bold" as const,
      color: colors.text.primary,
      textAlign: "center" as const,
      fontFamily: fontFamily.groteskBold
    }
  };
};

export const LoadingContainer: React.FC<LoadingContainerProps> = ({
  visible = true,
  showText = true,
  text = "FitNudge"
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const textFadeAnim = useRef(new Animated.Value(0)).current;
  const textScaleAnim = useRef(new Animated.Value(0.9)).current;
  const { t } = useTranslation();

  const styles = useStyles(makeLoadingContainerStyles);

  useEffect(() => {
    if (visible) {
      // Fade in animation
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true
      }).start();

      // Scale animation
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.1,
          duration: 600,
          useNativeDriver: true
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true
        })
      ]).start();

      // Text animations (delayed start)
      Animated.sequence([
        Animated.delay(500),
        Animated.parallel([
          Animated.timing(textFadeAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true
          }),
          Animated.timing(textScaleAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true
          })
        ])
      ]).start();

      // Continuous pulse animation for both favicon and text
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true
          })
        ])
      );
      pulseAnimation.start();

      return () => {
        pulseAnimation.stop();
      };
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true
      }).start();
    }
  }, [visible, fadeAnim, scaleAnim, pulseAnim]);

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }, { scale: pulseAnim }]
        }}
      >
        <Image
          source={require("@assetsimages/favicon.png")}
          style={styles.image}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Animated FitNudge Text */}
      {showText && (
        <Animated.View
          style={{
            opacity: textFadeAnim,
            transform: [{ scale: textScaleAnim }, { scale: pulseAnim }]
            // marginTop: toRN(tokens.spacing[4]),
          }}
        >
          <Text style={styles.textStyle}>{text === "FitNudge" ? t("common.app_name") : text}</Text>
        </Animated.View>
      )}
    </View>
  );
};

export default LoadingContainer;
