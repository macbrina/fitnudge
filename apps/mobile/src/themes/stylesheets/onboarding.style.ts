import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { Dimensions } from "react-native";

const { width: screenWidth } = Dimensions.get("window");

export const makeOnboardingStyles = (
  tokens: any,
  colors: any,
  brandColors: any
) => {
  return {
    container: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: toRN(tokens.spacing[6]), // 1.5rem
      backgroundColor: colors.bg.canvas,
    },
    title: {
      fontSize: toRN(tokens.typography.fontSize["2xl"]),
      fontWeight: tokens.typography.fontWeight.bold,
      marginBottom: toRN(tokens.spacing[4]), // 1rem
      color: colors.text.primary,
      fontFamily: fontFamily.groteskBold, // Space Grotesk
    },
    description: {
      fontSize: toRN(tokens.typography.fontSize.base),
      textAlign: "center",
      color: colors.text.secondary,
      fontFamily: fontFamily.regular, // Space Grotesk
    },
  };
};

export const makeOnboardingCarouselStyles = (
  tokens: any,
  colors: any,
  brandColors: any,
  { currentIndex = 0 }: { currentIndex: number }
) => {
  return {
    container: {
      flex: 1,
    },
    screenContainer: {
      width: screenWidth,
      flex: 1,
    },
    gradientBackground: {
      flex: 1,
    },
    content: {
      flex: 1,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      paddingHorizontal: toRN(tokens.spacing[6]),
      paddingTop: toRN(tokens.spacing[8]),
      paddingBottom: toRN(tokens.spacing[6]),
    },
    appName: {
      fontSize: toRN(tokens.typography.fontSize["2xl"]),
      fontWeight: tokens.typography.fontWeight.bold,
      color: currentIndex === 0 ? "#ffffff" : "#151157",
      fontFamily: fontFamily.groteskBold,
      textAlign: "center" as const,
    },
    illustrationContainer: {
      marginBottom: toRN(tokens.spacing[4]),
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    textContainer: {
      alignItems: "center" as const,
      maxWidth: 320,
      marginBottom: toRN(tokens.spacing[4]),
    },
    title: {
      fontSize: toRN(tokens.typography.fontSize["4xl"]),
      fontWeight: tokens.typography.fontWeight.bold,
      marginBottom: toRN(tokens.spacing[4]),
      color: currentIndex === 0 ? "#ffffff" : "#151157",
      fontFamily: fontFamily.groteskBold,
      textAlign: "center" as const,
    },
    description: {
      fontSize: toRN(tokens.typography.fontSize.xl),
      textAlign: "center" as const,
      color: currentIndex === 0 ? "#ffffff" : "#151157",
      fontFamily: fontFamily.regular,
      opacity: 0.95,
    },
    carousel: {
      flex: 1,
    },
    progressContainer: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      paddingVertical: toRN(tokens.spacing[2]),
      backgroundColor: "transparent",
      marginBottom: toRN(tokens.spacing[4]),
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor:
        currentIndex === 0 ? "rgba(255, 255, 255, 0.4)" : "rgba(21,17,87, 0.4)",
      marginHorizontal: toRN(tokens.spacing[1]),
    },
    activeDot: {
      backgroundColor: currentIndex === 0 ? "#ffffff" : "#151157",
      width: 24,
      height: 4,
      borderRadius: 2,
    },
    fixedBottom: {
      paddingHorizontal: toRN(tokens.spacing[6]),
      paddingTop: toRN(tokens.spacing[4]),
      gap: toRN(tokens.spacing[4]),
      backgroundColor: "transparent",
    },
    signUpButton: {
      backgroundColor: currentIndex === 0 ? "#ffffff" : "#151157",
      borderRadius: toRN(tokens.borderRadius.full),
      paddingVertical: toRN(tokens.spacing[4]),
      paddingHorizontal: toRN(tokens.spacing[6]),
      minHeight: toRN(52),
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    signUpButtonText: {
      color: currentIndex === 0 ? "#1f2937" : "#ffffff",
      fontSize: toRN(tokens.typography.fontSize.lg),
      fontWeight: tokens.typography.fontWeight.bold,
      fontFamily: fontFamily.groteskBold,
      textAlign: "center" as const,
    },
    loginButton: {
      alignItems: "center" as const,
      paddingVertical: toRN(tokens.spacing[4]),
    },
    loginText: {
      fontSize: toRN(tokens.typography.fontSize.lg),
      color: currentIndex === 0 ? "#ffffff" : "#151157",
      fontFamily: fontFamily.groteskMedium,
      fontWeight: tokens.typography.fontWeight.medium,
    },
  };
};
