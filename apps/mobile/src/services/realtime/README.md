# 🔄 Realtime Service

## Overview

The Realtime Service provides instant data synchronization across the app using Supabase Realtime. It automatically invalidates React Query cache when database tables change, ensuring the UI is always up-to-date.

## Features

- ✅ **18 Realtime-enabled tables** (security, core, notifications, meals, gamification, social)
- ✅ **Auto cache invalidation** - React Query cache updates automatically
- ✅ **Force logout on ban/suspend** - Critical security feature
- ✅ **Exponential backoff reconnection** - Handles network failures gracefully
- ✅ **Memory leak prevention** - Proper cleanup on component unmount
- ✅ **User-filtered subscriptions** - Only receives relevant updates

## Architecture

```
┌─────────────────────────────────────────────────┐
│                    App Startup                   │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│              RealtimeProvider                    │
│  - Initializes realtimeService with QueryClient │
│  - Starts subscriptions on user login           │
│  - Stops subscriptions on user logout           │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│            Supabase Realtime                     │
│  - Listens to 18 tables for INSERT/UPDATE/DELETE│
│  - Filters by user_id where applicable          │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│         handleTableChange()                      │
│  - Checks for user status changes (ban/suspend) │
│  - Forces logout if necessary                   │
│  - Invalidates React Query cache                │
└─────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│            React Query Cache                     │
│  - Auto-refetches affected queries              │
│  - UI updates instantly                         │
└─────────────────────────────────────────────────┘
```

## Setup

### Required Configuration

**1. Metro Config** (`apps/mobile/metro.config.js`):

Due to a known compatibility issue between Expo and Supabase ([#1726](https://github.com/supabase/supabase-js/issues/1726)), you must disable package exports:

```javascript
config.resolver.unstable_enablePackageExports = false;
```

**2. URL Polyfill** (`apps/mobile/src/app/_layout.tsx`):

Supabase requires Node.js polyfills for React Native. Add this as the **first import**:

```typescript
import "react-native-url-polyfill/auto";
```

**3. Dependencies**:

```bash
npx expo install @supabase/supabase-js react-native-url-polyfill
```

## Usage

### In the App

The Realtime service is automatically initialized in `apps/mobile/src/app/_layout.tsx`:

```typescript
<QueryClientProvider client={queryClient}>
  <RealtimeProvider>
    {/* Your app */}
  </RealtimeProvider>
</QueryClientProvider>
```

### Accessing Connection Status

```typescript
import { useRealtime } from "@/contexts/RealtimeContext";

function MyComponent() {
  const { isConnected, channelCount, reconnectAttempts } = useRealtime();

  return (
    <View>
      <Text>Realtime: {isConnected ? "✅" : "❌"}</Text>
      <Text>Channels: {channelCount}</Text>
    </View>
  );
}
```

## Query Key Mappings

The service automatically maps table changes to React Query keys:

| Table | Query Keys Invalidated |
|-------|------------------------|
| `users` | `["user"]`, `["auth"]` |
| `check_ins` | `["check-ins"]`, `["progress"]`, `["streak"]`, `["habit-chain"]`, `["weekly-progress"]` |
| `goals` | `["goals"]`, `["active-goals"]`, `["check-ins"]`, `["actionable-plans"]` |
| `actionable_plans` | `["actionable-plans"]`, `["goals"]` |
| `daily_motivations` | `["daily-motivation"]` |
| `motivations` | `["motivations"]`, `["notification-history"]` |
| `meal_logs` | `["meal-logs"]`, `["daily-nutrition"]` |
| `user_achievements` | `["user-achievements"]`, `["profile"]` |
| `posts` | `["posts"]`, `["feed"]` |
| `comments` | `["comments"]`, `["posts"]` |
| `likes` | `["likes"]`, `["posts"]` |
| `follows` | `["follows"]`, `["profile"]` |

## Critical Security Feature

### Force Logout on Ban/Suspend

When an admin bans or suspends a user from the dashboard:

1. `users` table is updated: `status: 'active'` → `'disabled'` or `'suspended'`
2. Realtime fires `UPDATE` event to the user's device
3. `handleUserStatusChange()` detects the status change
4. `handleAutoLogout()` is called, forcing immediate logout
5. User is redirected to login screen across all devices

**Result**: Banned users are logged out **instantly** (< 1 second), not on next API call.

## Reconnection Strategy

The service uses exponential backoff for reconnection:

```typescript
// Attempt 1: 1 second
// Attempt 2: 2 seconds
// Attempt 3: 4 seconds
// Attempt 4: 8 seconds
// ...
// Max delay: 30 seconds
// Max attempts: 10
```

## Performance Considerations

### User-Filtered Subscriptions

Most subscriptions are filtered by `user_id` to reduce unnecessary events:

```typescript
.on('postgres_changes', {
  event: '*',
  schema: 'public',
  table: 'check_ins',
  filter: `user_id=eq.${userId}` // Only user's check-ins
}, handleChange)
```

### Memory Management

All subscriptions are properly cleaned up:

- On logout: `realtimeService.stop()` unsubscribes all channels
- On unmount: `useEffect` cleanup in `RealtimeProvider`
- Prevents memory leaks from dangling subscriptions

## Cost Estimate (Supabase)

For **1000 active users** with **18 subscriptions each**:

- Concurrent connections: ~18,000
- Messages per day: ~200,000 (assuming ~10 events/user/day)
- Messages per month: ~6,000,000

**Supabase Pricing**:
- Free tier: 2M messages/month ❌ (will exceed)
- Pro tier: $25/month + $0.00002/message
- **Estimated cost**: $25 + ($0.00002 × 6M) = **$145/month**

**For MVP** (5 core tables instead of 18): ~$40/month (within free tier)

## Debugging

Enable verbose logging in `realtimeService.ts`:

```typescript
// Change console.log to logger.debug for production
console.log(`[Realtime] ${table} ${payload.eventType}:`, payload);
```

View connection status:

```typescript
import { realtimeService } from "@/services/realtime";

console.log(realtimeService.getConnectionStatus());
// { isConnected: true, channelCount: 18, reconnectAttempts: 0 }
```

## Testing

### Test Force Logout

1. Login to mobile app
2. Update user status in Supabase dashboard: `UPDATE users SET status = 'disabled' WHERE id = '...'`
3. Mobile app should logout **instantly** (< 1 second)

### Test Cache Invalidation

1. Open `GoalsScreen` (shows list of goals)
2. Update a goal in Supabase dashboard: `UPDATE goals SET title = 'New Title' WHERE id = '...'`
3. Mobile app should update **instantly** without manual refresh

## Future Enhancements

- [ ] Add Realtime connection status indicator in UI
- [ ] Implement selective subscription (only subscribe to tables user is viewing)
- [ ] Add offline queue for events missed during network outage
- [ ] Implement optimistic updates with Realtime confirmation
- [ ] Add analytics for Realtime performance (latency, reconnects)

## Related Files

- `apps/mobile/src/services/realtime/realtimeService.ts` - Core service
- `apps/mobile/src/contexts/RealtimeContext.tsx` - React context
- `apps/mobile/src/app/_layout.tsx` - Provider integration
- `apps/api/supabase/migrations/20251203000000_enable_realtime_for_core_tables.sql` - Database migration
- `apps/docs/DataModels.md` - Realtime tables documentation

