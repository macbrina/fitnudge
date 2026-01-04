import React, { useEffect, useState, useRef } from "react";
import { View, Text, Animated, Dimensions, Easing } from "react-native";
import { useTranslation } from "@/lib/i18n";
import { fontFamily } from "@/lib/fonts";
import { toRN } from "@/lib/units";
import { useStyles } from "@/themes/makeStyles";
import { tokens } from "@/themes/tokens";
import { useTheme } from "@/themes";
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from "react-native-svg";
import { ReducedMotionConfig, ReduceMotion } from "react-native-reanimated";

const { width, height } = Dimensions.get("window");

interface AILoadingAnimationProps {
  onComplete?: () => void;
  apiCompleted?: boolean;
}

// Helper to add opacity to hex color
const addOpacity = (hex: string, opacity: number): string => {
  // Remove # if present
  const cleanHex = hex.replace("#", "");
  // Convert opacity to hex (0-255)
  const opacityHex = Math.round(opacity * 255)
    .toString(16)
    .padStart(2, "0");
  return `#${cleanHex}${opacityHex}`;
};

export default function AILoadingAnimation({
  onComplete,
  apiCompleted = false
}: AILoadingAnimationProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeAILoadingAnimationStyles);
  const { colors, brandColors } = useTheme();

  // Create gradient colors with opacity
  const orbGradientColors: string[] = [
    brandColors.primary,
    addOpacity(brandColors.primary, 0.8),
    addOpacity(brandColors.primary, 0.6)
  ];

  const progressGradientColors: string[] = [
    brandColors.primary,
    addOpacity(brandColors.primary, 0.87),
    brandColors.primary
  ];

  const loadingMessages = [
    t("onboarding.ai_loading.analyzing_profile"),
    t("onboarding.ai_loading.finding_goals"),
    t("onboarding.ai_loading.personalizing"),
    t("onboarding.ai_loading.considering_preferences"),
    t("onboarding.ai_loading.matching_goals"),
    t("onboarding.ai_loading.optimizing_recommendations"),
    t("onboarding.ai_loading.customizing_suggestions"),
    t("onboarding.ai_loading.refining_details"),
    t("onboarding.ai_loading.finalizing"),
    t("onboarding.ai_loading.crafting_perfect_plan"),
    t("onboarding.ai_loading.analyzing_patterns"),
    t("onboarding.ai_loading.generating_insights"),
    t("onboarding.ai_loading.tailoring_experience"),
    t("onboarding.ai_loading.connecting_dots"),
    t("onboarding.ai_loading.building_momentum"),
    t("onboarding.ai_loading.discovering_possibilities"),
    t("onboarding.ai_loading.creating_magic"),
    t("onboarding.ai_loading.polishing_details"),
    t("onboarding.ai_loading.bringing_it_together"),
    t("onboarding.ai_loading.almost_there")
  ];

  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

  // Main animations
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.9));
  const [morphAnim] = useState(new Animated.Value(0));
  const [shimmerAnim] = useState(new Animated.Value(0));
  const [messageFadeAnim] = useState(new Animated.Value(1));
  const [progressAnim] = useState(new Animated.Value(0));
  const [waveAnim] = useState(new Animated.Value(0));

  // Orb animations
  const [orbScale] = useState(new Animated.Value(1));
  const [orbRotation] = useState(new Animated.Value(0));
  const [orbGlow] = useState(new Animated.Value(0.5));

  // Floating elements - initialize with base positions
  const [floatingElements] = useState(() => {
    return Array.from({ length: 6 }, (_, index) => {
      const angle = (index * Math.PI * 2) / 6;
      const radius = 90;
      const baseX = Math.cos(angle) * radius;
      const baseY = Math.sin(angle) * radius;

      return {
        translateY: new Animated.Value(baseY),
        translateX: new Animated.Value(baseX),
        opacity: new Animated.Value(0.3),
        scale: new Animated.Value(0.6),
        rotation: new Animated.Value(0),
        baseX,
        baseY
      };
    });
  });

  const animationRefs = useRef<any[]>([]);

  useEffect(() => {
    startAnimations();
    startMessageRotation();

    return () => {
      animationRefs.current.forEach((anim) => anim?.stop?.());
    };
  }, []);

  useEffect(() => {
    if (apiCompleted) {
      completeProgress();
      const timer = setTimeout(() => {
        onComplete?.();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [apiCompleted, onComplete]);

  const startAnimations = () => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true
      })
    ]).start();

    // Morphing orb animation
    const morphLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(morphAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false
        }),
        Animated.timing(morphAnim, {
          toValue: 0,
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false
        })
      ])
    );
    animationRefs.current.push(morphLoop);
    morphLoop.start();

    // Shimmer effect
    const shimmerLoop = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true
      })
    );
    animationRefs.current.push(shimmerLoop);
    shimmerLoop.start();

    // Orb pulse - separate animations to avoid native driver conflict
    const orbPulseScale = Animated.loop(
      Animated.sequence([
        Animated.timing(orbScale, {
          toValue: 1.1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        }),
        Animated.timing(orbScale, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        })
      ])
    );
    animationRefs.current.push(orbPulseScale);
    orbPulseScale.start();

    const orbPulseGlow = Animated.loop(
      Animated.sequence([
        Animated.timing(orbGlow, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true // Opacity can use native driver
        }),
        Animated.timing(orbGlow, {
          toValue: 0.5,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true // Opacity can use native driver
        })
      ])
    );
    animationRefs.current.push(orbPulseGlow);
    orbPulseGlow.start();

    // Orb rotation
    const orbRotate = Animated.loop(
      Animated.timing(orbRotation, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true
      })
    );
    animationRefs.current.push(orbRotate);
    orbRotate.start();

    // Floating elements
    floatingElements.forEach((element, index) => {
      const delay = index * 200;
      const floatAnimation = Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.sequence([
              Animated.timing(element.translateY, {
                toValue: element.baseY - 30,
                duration: 2000 + index * 300,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true
              }),
              Animated.timing(element.translateY, {
                toValue: element.baseY,
                duration: 2000 + index * 300,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true
              })
            ]),
            Animated.sequence([
              Animated.timing(element.translateX, {
                toValue: element.baseX + 20,
                duration: 1800 + index * 250,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true
              }),
              Animated.timing(element.translateX, {
                toValue: element.baseX - 20,
                duration: 1800 + index * 250,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true
              })
            ]),
            Animated.sequence([
              Animated.timing(element.opacity, {
                toValue: 0.6,
                duration: 1500 + index * 200,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true
              }),
              Animated.timing(element.opacity, {
                toValue: 0.3,
                duration: 1500 + index * 200,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true
              })
            ]),
            Animated.loop(
              Animated.timing(element.rotation, {
                toValue: 1,
                duration: 3000 + index * 500,
                easing: Easing.linear,
                useNativeDriver: true
              })
            )
          ])
        ])
      );
      animationRefs.current.push(floatAnimation);
      floatAnimation.start();
    });

    // Wave animation
    const waveLoop = Animated.loop(
      Animated.timing(waveAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: false
      })
    );
    animationRefs.current.push(waveLoop);
    waveLoop.start();

    // Progress animation
    progressAnim.setValue(0);
    const progressAnimation = Animated.timing(progressAnim, {
      toValue: 0.7,
      duration: 25000,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false
    });
    animationRefs.current.push(progressAnimation);
    progressAnimation.start();
  };

  const startMessageRotation = () => {
    const messageInterval = setInterval(() => {
      Animated.sequence([
        Animated.timing(messageFadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true
        }),
        Animated.timing(messageFadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true
        })
      ]).start();

      setCurrentMessageIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 2200);

    return () => clearInterval(messageInterval);
  };

  const completeProgress = () => {
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false
    }).start();
  };

  // Interpolations - use contained width instead of screen width
  const shimmerTranslateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-200, 200] // Contained width for shimmer effect
  });

  const orbRotate = orbRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"]
  });

  const morphValue = morphAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 1, 0]
  });

  const borderRadius = morphValue.interpolate({
    inputRange: [0, 1],
    outputRange: [50, 30]
  });

  // Use a contained width instead of screen width
  const progressBarWidth = 280; // Fixed reasonable width
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, progressBarWidth]
  });

  const waveOffset = waveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.PI * 2]
  });

  const glowOpacity = orbGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7]
  });

  return (
    <>
      <ReducedMotionConfig mode={ReduceMotion.Never} />
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.animationContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }]
            }
          ]}
        >
          {/* Main morphing orb */}
          <View style={styles.orbContainer}>
            <Animated.View
              style={[
                styles.orbGlow,
                {
                  opacity: glowOpacity,
                  transform: [{ scale: orbScale }]
                }
              ]}
            />

            {/* Orb with border radius - separate to avoid native driver conflict */}
            <Animated.View
              style={[
                styles.orb,
                {
                  borderRadius
                }
              ]}
            >
              <Animated.View
                style={[
                  styles.orbGradient,
                  {
                    transform: [{ scale: orbScale }, { rotate: orbRotate }]
                  }
                ]}
              >
                <View style={styles.orbGradientInner}>
                  <Svg
                    width={toRN(tokens.spacing[20])}
                    height={toRN(tokens.spacing[20])}
                    style={{ position: "absolute" }}
                  >
                    <Defs>
                      <SvgLinearGradient id="orbGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        {orbGradientColors.map((color, index) => (
                          <Stop
                            key={index}
                            offset={`${(index / (orbGradientColors.length - 1)) * 100}%`}
                            stopColor={color}
                            stopOpacity="1"
                          />
                        ))}
                      </SvgLinearGradient>
                    </Defs>
                    <Rect
                      width={toRN(tokens.spacing[20])}
                      height={toRN(tokens.spacing[20])}
                      fill="url(#orbGradient)"
                    />
                  </Svg>
                  {/* Shimmer overlay */}
                  <Animated.View
                    style={[
                      styles.shimmer,
                      {
                        transform: [{ translateX: shimmerTranslateX }]
                      }
                    ]}
                  />
                </View>
              </Animated.View>
            </Animated.View>

            {/* Floating decorative elements */}
            {floatingElements.map((element, index) => {
              const rotate = element.rotation.interpolate({
                inputRange: [0, 1],
                outputRange: ["0deg", "360deg"]
              });

              return (
                <Animated.View
                  key={index}
                  style={[
                    styles.floatingElement,
                    {
                      transform: [
                        { translateX: element.translateX },
                        { translateY: element.translateY },
                        { rotate },
                        { scale: element.scale }
                      ],
                      opacity: element.opacity
                    }
                  ]}
                >
                  <View style={styles.floatingDot} />
                </Animated.View>
              );
            })}
          </View>

          {/* Loading message */}
          <Animated.View
            style={[
              styles.messageContainer,
              {
                opacity: messageFadeAnim
              }
            ]}
          >
            <Text style={styles.loadingMessage}>{loadingMessages[currentMessageIndex]}</Text>
            <View style={styles.dotsContainer}>
              {[0, 1, 2].map((i) => (
                <Animated.View
                  key={i}
                  style={[
                    styles.dot,
                    {
                      opacity: messageFadeAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.3, 1]
                      }),
                      transform: [
                        {
                          scale: messageFadeAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.8, 1]
                          })
                        }
                      ]
                    }
                  ]}
                />
              ))}
            </View>
          </Animated.View>

          {/* Modern progress bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBarBackground}>
              {/* Wave effect in background */}
              <Animated.View
                style={[
                  styles.progressWave,
                  {
                    transform: [
                      {
                        translateX: waveOffset.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-280, 280] // Match progress bar width
                        })
                      }
                    ]
                  }
                ]}
              />

              {/* Progress fill with gradient */}
              <Animated.View
                style={[
                  styles.progressFillContainer,
                  {
                    width: progressWidth
                  }
                ]}
              >
                <View style={styles.progressGradient}>
                  <Svg
                    width={progressBarWidth}
                    height={toRN(tokens.spacing[1.5])}
                    style={{ position: "absolute" }}
                  >
                    <Defs>
                      <SvgLinearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        {progressGradientColors.map((color, index) => (
                          <Stop
                            key={index}
                            offset={`${(index / (progressGradientColors.length - 1)) * 100}%`}
                            stopColor={color}
                            stopOpacity="1"
                          />
                        ))}
                      </SvgLinearGradient>
                    </Defs>
                    <Rect
                      width={progressBarWidth}
                      height={toRN(tokens.spacing[1.5])}
                      fill="url(#progressGradient)"
                    />
                  </Svg>
                  {/* Shimmer on progress */}
                  <Animated.View
                    style={[
                      styles.progressShimmer,
                      {
                        transform: [{ translateX: shimmerTranslateX }]
                      }
                    ]}
                  />
                </View>
              </Animated.View>
            </View>
          </View>
        </Animated.View>
      </View>
    </>
  );
}

const makeAILoadingAnimationStyles = (tokens: any, colors: any, brand: any) => {
  return {
    container: {
      width: "100%",
      justifyContent: "center" as const,
      alignItems: "center" as const,
      position: "relative" as const,
      minHeight: 400 // Minimum height for proper layout
    },
    animationContainer: {
      alignItems: "center" as const,
      justifyContent: "center" as const,
      paddingHorizontal: toRN(tokens.spacing[6])
    },
    orbContainer: {
      width: toRN(tokens.spacing[24]),
      height: toRN(tokens.spacing[24]),
      justifyContent: "center" as const,
      alignItems: "center" as const,
      marginBottom: toRN(tokens.spacing[10]),
      position: "relative" as const
    },
    orbGlow: {
      position: "absolute" as const,
      width: toRN(tokens.spacing[28]),
      height: toRN(tokens.spacing[28]),
      borderRadius: toRN(tokens.spacing[14]),
      backgroundColor: brand.primary,
      opacity: 0.3
    },
    orb: {
      width: toRN(tokens.spacing[20]),
      height: toRN(tokens.spacing[20]),
      overflow: "hidden" as const,
      shadowColor: brand.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.6,
      shadowRadius: toRN(tokens.spacing[4]),
      elevation: 8
    },
    orbGradient: {
      width: "100%",
      height: "100%",
      justifyContent: "center" as const,
      alignItems: "center" as const,
      overflow: "hidden" as const
    },
    orbGradientInner: {
      width: "100%",
      height: "100%",
      justifyContent: "center" as const,
      alignItems: "center" as const
    },
    shimmer: {
      position: "absolute" as const,
      width: "100%",
      height: "100%",
      backgroundColor: "rgba(255, 255, 255, 0.3)",
      transform: [{ skewX: "-20deg" }]
    },
    floatingElement: {
      position: "absolute" as const,
      width: toRN(tokens.spacing[2]),
      height: toRN(tokens.spacing[2])
    },
    floatingDot: {
      width: "100%",
      height: "100%",
      borderRadius: toRN(tokens.spacing[1]),
      backgroundColor: brand.primary,
      opacity: 0.4
    },
    messageContainer: {
      alignItems: "center" as const,
      marginBottom: toRN(tokens.spacing[8]),
      minHeight: toRN(tokens.spacing[16]),
      justifyContent: "center" as const
    },
    loadingMessage: {
      fontSize: toRN(tokens.typography.fontSize.xl),
      fontWeight: tokens.typography.fontWeight.semibold,
      color: colors.text.primary,
      textAlign: "center" as const,
      fontFamily: fontFamily.groteskSemiBold,
      marginBottom: toRN(tokens.spacing[3]),
      letterSpacing: -0.3
    },
    dotsContainer: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: toRN(tokens.spacing[2])
    },
    dot: {
      width: toRN(tokens.spacing[1.5]),
      height: toRN(tokens.spacing[1.5]),
      borderRadius: toRN(tokens.spacing[0.75]),
      backgroundColor: brand.primary
    },
    progressContainer: {
      width: "100%",
      maxWidth: width * 0.75,
      alignItems: "center" as const,
      paddingHorizontal: toRN(tokens.spacing[4])
    },
    progressBarBackground: {
      width: "100%",
      height: toRN(tokens.spacing[1.5]),
      backgroundColor: colors.bg.muted,
      borderRadius: toRN(tokens.borderRadius.full),
      overflow: "hidden" as const,
      position: "relative" as const
    },
    progressWave: {
      position: "absolute" as const,
      width: "200%", // Relative to progress bar width
      height: "100%",
      backgroundColor: colors.bg.muted,
      opacity: 0.3
    },
    progressFillContainer: {
      height: "100%",
      borderRadius: toRN(tokens.borderRadius.full),
      overflow: "hidden" as const,
      position: "relative" as const
    },
    progressGradient: {
      width: "100%",
      height: "100%",
      position: "relative" as const
    },
    progressShimmer: {
      position: "absolute" as const,
      width: "50%",
      height: "100%",
      backgroundColor: "rgba(255, 255, 255, 0.4)",
      transform: [{ skewX: "-20deg" }]
    }
  };
};
