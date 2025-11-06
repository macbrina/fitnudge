# FitNudge Notification System

This directory contains the complete notification system for FitNudge, including permission management, scheduling, and user preferences.

## Architecture

### Core Services

- **`notificationService.ts`** - Main service for permission management, FCM registration, and notification handling
- **`notificationScheduler.ts`** - Handles scheduling of local notifications for goals and reminders
- **`notificationTypes.ts`** - TypeScript interfaces and enums for type safety

### Components

- **`NotificationPermissionModal.tsx`** - Soft permission prompt with engaging UI
- **`NotificationToast.tsx`** - In-app toast for foreground notifications

### Hooks

- **`useNotificationPermissions.ts`** - Hook for managing permission state
- **`useGoalNotifications.ts`** - Hook for scheduling goal-related notifications

### API Integration

- **`notifications.ts`** - API service for backend communication

## Usage

### 1. Request Permission During Onboarding

```tsx
import { useNotificationPermissions } from "@/hooks/notifications/useNotificationPermissions";
import { NotificationPermissionModal } from "@/components/notifications/NotificationPermissionModal";

const OnboardingScreen = () => {
  const { showSoftPrompt, requestPermissionDirectly, hideSoftPrompt } =
    useNotificationPermissions();

  const handleAccept = async () => {
    await requestPermissionDirectly();
    hideSoftPrompt();
    // Continue with onboarding
  };

  return (
    <NotificationPermissionModal
      visible={showSoftPrompt}
      onAccept={handleAccept}
      onDecline={hideSoftPrompt}
      onMaybeLater={hideSoftPrompt}
    />
  );
};
```

### 2. Schedule Goal Notifications

```tsx
import { useGoalNotifications } from "@/hooks/notifications/useGoalNotifications";

const GoalCreationScreen = () => {
  const { scheduleGoalNotifications, isNotificationsEnabled } =
    useGoalNotifications();

  const handleCreateGoal = async (goalData) => {
    // Create goal in backend
    const goal = await createGoal(goalData);

    // Schedule notifications if enabled
    if (isNotificationsEnabled) {
      await scheduleGoalNotifications({
        id: goal.id,
        title: goal.title,
        reminderTimes: ["09:00", "18:00"],
        timezone: "America/New_York",
      });
    }
  };
};
```

### 3. Show In-App Notifications

```tsx
import { useNotification } from "@/contexts/NotificationContext";

const SomeScreen = () => {
  const { showToast } = useNotification();

  const handleSomeAction = () => {
    showToast("Achievement Unlocked! 🎉", "You completed your first workout!", {
      type: "achievement",
      goalId: "123",
    });
  };
};
```

### 4. Notification Settings

```tsx
import { NotificationSettingsScreen } from "@/screens/settings/NotificationSettingsScreen";

// Use in your settings navigation
<Stack.Screen
  name="NotificationSettings"
  component={NotificationSettingsScreen}
/>;
```

## Configuration

### App.json Setup

The notification system is configured in `app.json` with:

- **expo-notifications** plugin
- **Android permissions**: POST_NOTIFICATIONS, RECEIVE_BOOT_COMPLETED, VIBRATE
- **iOS background modes**: remote-notification
- **Custom notification sounds** and **icon**

### Environment Variables

- `EXPO_PUBLIC_FCM_PROJECT_ID` - Firebase project ID for FCM
- `EXPO_PUBLIC_API_URL` - Backend API URL for device registration

## Notification Categories

1. **AI_MOTIVATION** - Personalized AI motivation calls
2. **REMINDER** - Daily check-in and workout reminders
3. **SOCIAL** - Likes, comments, and social interactions
4. **ACHIEVEMENT** - Goal completions and milestones
5. **REENGAGEMENT** - Motivational messages for inactive users

## Features

### ✅ Implemented

- [x] Permission management with soft prompts
- [x] FCM token registration and management
- [x] Local notification scheduling
- [x] Notification categories and channels
- [x] User preferences and settings
- [x] In-app toast notifications
- [x] Deep linking support
- [x] Translation support
- [x] TypeScript interfaces

### 🚧 TODO

- [ ] Backend API endpoints implementation
- [ ] PostHog analytics integration
- [ ] Deep linking navigation implementation
- [ ] Custom notification sounds
- [ ] Quiet hours functionality
- [ ] Notification history
- [ ] A/B testing for permission prompts

## Testing

### Manual Testing

1. **Permission Flow**: Test soft prompt → OS prompt → granted/denied states
2. **Scheduling**: Create goals and verify notifications are scheduled
3. **Foreground**: Test in-app toast notifications
4. **Background**: Test notification delivery when app is closed
5. **Settings**: Test preference changes and persistence

### Test Scenarios

- Fresh install permission flow
- Permission denied recovery
- Notification scheduling and delivery
- Deep link navigation
- Settings persistence
- Token refresh handling

## Troubleshooting

### Common Issues

1. **Notifications not showing**: Check permission status and FCM token
2. **Scheduling fails**: Verify notification limits (iOS: 64 max)
3. **Token registration fails**: Check network and API endpoint
4. **Deep links not working**: Implement navigation handlers

### Debug Commands

```bash
# Check notification permissions
npx expo install expo-notifications
npx expo run:ios --device

# Test FCM token
console.log(await Notifications.getExpoPushTokenAsync());
```
