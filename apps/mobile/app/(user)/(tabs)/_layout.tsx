import { Tabs } from "expo-router";
import { Home, Target, BarChart3, Bell, User } from "lucide-react-native";
import { View, Text, Pressable, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStyles, useTheme } from "@/themes";
import { useUnreadNotificationCount } from "@/hooks/api/useNotificationHistory";
import { TabBarInsetsContext, TAB_BAR_BASE_HEIGHT } from "@/hooks/useTabBarInsets";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useMemo } from "react";

// Badge component for notification count
function NotificationBadge({ count }: { count: number }) {
  const styles = useStyles(makeStyles);

  if (count === 0) return null;

  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count > 99 ? "99+" : count}</Text>
    </View>
  );
}

// Custom floating tab bar with blur effect
function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors, isDark } = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { unreadCount } = useUnreadNotificationCount();

  const icons: Record<string, typeof Home> = {
    index: Home,
    goals: Target,
    progress: BarChart3,
    notifications: Bell,
    profile: User
  };

  // Theme-specific dynamic styles
  const dynamicStyles = {
    tabBarInner: {
      borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.06)",
      backgroundColor: isDark
        ? Platform.OS === "ios"
          ? "rgba(30, 30, 30, 0.8)"
          : "rgba(30, 30, 30, 0.95)"
        : Platform.OS === "ios"
          ? "rgba(255, 255, 255, 0.85)"
          : "rgba(255, 255, 255, 0.98)"
    },
    iconContainerActive: {
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.08)"
    }
  };

  return (
    <View style={[styles.tabBarContainer, { bottom: Math.max(insets.bottom, 16) }]}>
      <BlurView
        intensity={isDark ? 60 : 80}
        tint={isDark ? "dark" : "light"}
        style={styles.blurContainer}
      >
        <View style={[styles.tabBarInner, dynamicStyles.tabBarInner]}>
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const isFocused = state.index === index;

            const onPress = () => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };

            const onLongPress = () => {
              navigation.emit({
                type: "tabLongPress",
                target: route.key
              });
            };

            const IconComponent = icons[route.name];
            const iconColor = isFocused ? colors.text.primary : colors.text.tertiary;

            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                onPress={onPress}
                onLongPress={onLongPress}
                style={styles.tabItem}
              >
                <View
                  style={[styles.iconContainer, isFocused && dynamicStyles.iconContainerActive]}
                >
                  {IconComponent && (
                    <IconComponent
                      size={22}
                      color={iconColor}
                      strokeWidth={isFocused ? 2.5 : 1.5}
                    />
                  )}
                  {route.name === "notifications" && <NotificationBadge count={unreadCount} />}
                </View>
              </Pressable>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

// ==========================================
// STYLES - Static styles (theme colors applied inline)
// ==========================================
const makeStyles = (tokens: any, colors: any, brand: any) => ({
  // Badge
  badge: {
    position: "absolute" as const,
    top: -4,
    right: -1,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.feedback.error,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    paddingHorizontal: 4
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700" as const,
    color: "#FFFFFF"
  },

  // Tab bar container - floating at bottom with margins
  tabBarContainer: {
    position: "absolute" as const,
    left: 24,
    right: 24
  },

  // Blur container with prominent shadow for visibility
  blurContainer: {
    width: "100%" as const,
    borderRadius: 32,
    overflow: "hidden" as const,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 24
      },
      android: {
        elevation: 16
      }
    })
  },

  // Inner tab bar (background/border applied dynamically)
  tabBarInner: {
    flexDirection: "row" as const,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 32,
    borderWidth: 1
  },

  // Tab item - each icon gets equal space
  tabItem: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingVertical: 2
  },

  // Icon container for badge positioning
  iconContainer: {
    position: "relative" as const,
    padding: 10,
    borderRadius: 14
  }
});

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  // Calculate total bottom padding needed (tab bar height + safe area)
  const tabBarInsets = useMemo(
    () => ({
      bottom: TAB_BAR_BASE_HEIGHT + Math.max(insets.bottom, 16)
    }),
    [insets.bottom]
  );

  return (
    <TabBarInsetsContext.Provider value={tabBarInsets}>
      <Tabs
        tabBar={(props) => <FloatingTabBar {...props} />}
        screenOptions={{
          headerShown: false
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="goals" />
        <Tabs.Screen name="progress" />
        <Tabs.Screen name="notifications" />
        <Tabs.Screen name="profile" />
      </Tabs>
    </TabBarInsetsContext.Provider>
  );
}
