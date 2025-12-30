import { Tabs } from "expo-router";
import { Home, Target, Users, Bell, User } from "lucide-react-native";
import { View, Text } from "react-native";
import { useTheme } from "@/themes";
import { useUnreadNotificationCount } from "@/hooks/api/useNotificationHistory";

// Badge component for notification count
function NotificationBadge({ count }: { count: number }) {
  const { brandColors, colors } = useTheme();

  if (count === 0) return null;

  return (
    <View
      style={{
        position: "absolute",
        top: -4,
        right: -8,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: colors.feedback.error,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 4,
      }}
    >
      <Text
        style={{
          fontSize: 10,
          fontWeight: "700",
          color: "#FFFFFF",
        }}
      >
        {count > 99 ? "99+" : count}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  const { colors, brandColors } = useTheme();

  // Get unread notification count from notification_history
  const { unreadCount } = useUnreadNotificationCount();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bg.card,
          borderTopColor: colors.border.subtle,
          // paddingBottom: 4,
          // paddingTop: 4,
          // height: 60,
        },
        tabBarActiveTintColor: brandColors.primary,
        tabBarInactiveTintColor: colors.text.tertiary,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "500",
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="goals"
        options={{
          title: "Goals",
          tabBarIcon: ({ color, size }) => <Target size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: "Social",
          tabBarIcon: ({ color, size }) => <Users size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Inbox",
          tabBarIcon: ({ color, size }) => (
            <View>
              <Bell size={size} color={color} />
              <NotificationBadge count={unreadCount} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
