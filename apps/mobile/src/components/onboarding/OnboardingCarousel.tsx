import { useStyles } from "@/themes";
import { makeOnboardingCarouselStyles } from "@/themes/stylesheets/onboarding.style";
import React, { useRef, useState, useMemo } from "react";
import { Dimensions, Text, TouchableOpacity, View } from "react-native";
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from "react-native-svg";
import { FlatList } from "react-native-gesture-handler";
import { ReducedMotionConfig, ReduceMotion, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "@/lib/i18n";
import { AICoachIllustration } from "./illustrations/AICoachIllustration";
import { CommunityIllustration } from "./illustrations/CommunityIllustration";
import { ProgressIllustration } from "./illustrations/ProgressIllustration";

const { width: screenWidth } = Dimensions.get("window");

interface OnboardingCarouselProps {
  onComplete: () => void;
  onSkip: () => void;
}

const getOnboardingData = (t: any) => [
  {
    title: t("onboarding.ai_motivation.title"),
    description: t("onboarding.ai_motivation.description"),
    illustration: <AICoachIllustration width={320} height={320} />,
    gradientColors: ["#10b981", "#10b981"] as [string, string] // Green background
  },
  {
    title: t("onboarding.track_progress.title"),
    description: t("onboarding.track_progress.description"),
    illustration: <ProgressIllustration width={320} height={320} />,
    gradientColors: ["#10b981", "#10b981"] as [string, string] // Green background
  },
  {
    title: t("onboarding.join_community.title"),
    description: t("onboarding.join_community.description"),
    illustration: <CommunityIllustration width={320} height={320} />,
    gradientColors: ["#10b981", "#10b981"] as [string, string] // Green background
  }
];

export const OnboardingCarousel: React.FC<OnboardingCarouselProps> = ({ onComplete, onSkip }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const { t } = useTranslation();
  const { tokens, colors, brandColors } = useStyles((tokens, colors, brandColors) => ({
    tokens,
    colors,
    brandColors
  }));

  const onboardingData = getOnboardingData(t);

  const styles = useMemo(
    () =>
      makeOnboardingCarouselStyles(tokens, colors, brandColors, {
        currentIndex
      }),
    [tokens, colors, brandColors, currentIndex]
  );
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);

  const translateX = useSharedValue(0);

  const handleScroll = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / screenWidth);
    setCurrentIndex(index);
    translateX.value = contentOffsetX;
  };

  const renderScreen = ({ item, index }: { item: (typeof onboardingData)[0]; index: number }) => (
    <View style={styles.screenContainer}>
      <View style={styles.content}>
        {/* App Name */}
        <Text style={styles.appName}>{t("common.app_name")}</Text>

        <View style={styles.illustrationContainer}>{item.illustration}</View>

        {/* Progress Dots - positioned after image, before text */}
        <View style={styles.progressContainer}>
          {onboardingData.map((_, dotIndex) => (
            <View key={dotIndex} style={[styles.dot, dotIndex === index && styles.activeDot]} />
          ))}
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.description}>{item.description}</Text>
        </View>
      </View>
    </View>
  );

  const gradientColors =
    currentIndex === 0
      ? ["#5d9862", "#4a7c59"] // Green gradient
      : currentIndex === 1
        ? ["#e6e5fd", "#d4d3f0"] // Purple gradient
        : ["#f7ffe4", "#e8f5d4"]; // Light green/yellow gradient

  return (
    <>
      <ReducedMotionConfig mode={ReduceMotion.Never} />
      <View style={styles.container}>
        {/* Gradient Background using SVG */}
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
          <Svg
            width={screenWidth}
            height={Dimensions.get("window").height}
            style={{ position: "absolute" }}
          >
            <Defs>
              <SvgLinearGradient id="backgroundGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor={gradientColors[0]} stopOpacity="1" />
                <Stop offset="100%" stopColor={gradientColors[1]} stopOpacity="1" />
              </SvgLinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#backgroundGradient)" />
          </Svg>
        </View>

        {/* Carousel */}
        <FlatList
          ref={flatListRef}
          data={onboardingData}
          renderItem={renderScreen}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          style={styles.carousel}
        />

        {/* Fixed Bottom Section */}
        <View style={[styles.fixedBottom, { paddingBottom: insets.bottom + 20 }]}>
          <TouchableOpacity style={styles.signUpButton} onPress={onComplete}>
            <Text style={styles.signUpButtonText}>{t("onboarding.sign_up")}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.loginButton} onPress={onSkip}>
            <Text style={styles.loginText}>{t("onboarding.log_in")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
};

export default OnboardingCarousel;
