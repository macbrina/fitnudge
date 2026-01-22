# ⚡ Supabase Realtime Implementation Guide

## 📋 Overview

This document outlines the complete Realtime implementation for FitNudge, enabling instant data synchronization across all user devices.

## ✅ Implementation Status

### 1. Database Migration ✅

**File**: `apps/api/supabase/migrations/20251203000000_enable_realtime_for_core_tables.sql`

**Status**: Complete and idempotent (can be run multiple times)

**Tables Enabled**: 14 total

#### Phase 1: Critical Security (1 table)

- ✅ `users` - Force logout on ban/suspend

#### Phase 2: Core Features (4 tables)

- ✅ `check_ins` - Celery auto-creation, multi-device sync
- ✅ `goals` - Goal CRUD, status changes
- ✅ `actionable_plans` - AI plan generation status
- ✅ `daily_motivations` - Motivation regeneration

#### Phase 3: Notifications (2 tables)

- ✅ `motivations` - Scheduled push notifications
- ✅ `notification_history` - Delivery tracking

#### Phase 4: Social & Gamification (3 tables)

- ✅ `achievements` - Badge unlocks
- ✅ `accountability_partners` - Partner requests
- ✅ `nudges` - Cheers and nudges

#### Phase 5: Content (2 tables)

- ✅ `blog_posts` - Blog content updates
- ✅ `weekly_recaps` - AI recap generation

---

### 2. Documentation ✅

**File**: `apps/docs/DataModels.md`

**Updates**:

- Added "Realtime Configuration" section
- Listed all 18 Realtime-enabled tables
- Documented implementation requirements
- Provided code examples

---

### 3. Mobile Implementation ✅

#### A. Realtime Service

**File**: `apps/mobile/src/services/realtime/realtimeService.ts`

**Features**:

- ✅ Subscribes to 18 Realtime-enabled tables
- ✅ Auto-invalidates React Query cache on changes
- ✅ Force logout on user status changes (disabled/suspended)
- ✅ Exponential backoff reconnection (max 10 attempts)
- ✅ User-filtered subscriptions (only relevant data)
- ✅ Memory leak prevention (proper cleanup)

**Query Key Mappings**:

```typescript
const TABLE_TO_QUERY_KEYS = {
  users: [["user"], ["auth"]],
  check_ins: [["check-ins"], ["progress"], ["streak"], ["habit-chain"]],
  goals: [["goals"], ["active-goals"], ["actionable-plans"]],
  actionable_plans: [["actionable-plans"], ["goals"]],
  daily_motivations: [["daily-motivation"]],
  // ... 13 more tables
};
```

#### B. React Context

**File**: `apps/mobile/src/contexts/RealtimeContext.tsx`

**Features**:

- ✅ Initializes service with QueryClient
- ✅ Auto-starts subscriptions on login
- ✅ Auto-stops subscriptions on logout
- ✅ Provides connection status to components

**Usage**:

```typescript
const { isConnected, channelCount, reconnectAttempts } = useRealtime();
```

#### C. App Integration

**File**: `apps/mobile/src/app/_layout.tsx`

**Changes**:

```diff
+ import { RealtimeProvider } from "@/contexts/RealtimeContext";

  <QueryClientProvider client={queryClient}>
+   <RealtimeProvider>
      <NotificationProvider>
        {/* App */}
      </NotificationProvider>
+   </RealtimeProvider>
  </QueryClientProvider>
```

---

## 🎯 Critical Security Feature: Force Logout

### Problem

Banned users could continue using the app until their next API call (could be hours/days).

### Solution

Realtime force logout:

1. Admin bans user in dashboard: `UPDATE users SET status = 'disabled'`
2. Realtime fires `UPDATE` event to user's device (< 1 second)
3. `handleUserStatusChange()` detects status change
4. `handleAutoLogout('disabled')` forces immediate logout
5. User redirected to login screen across all devices

### Code

```typescript
private async handleUserStatusChange(payload: RealtimePostgresChangesPayload<any>) {
  const oldStatus = payload.old?.status;
  const newStatus = payload.new?.status;

  if (oldStatus === "active" && (newStatus === "disabled" || newStatus === "suspended")) {
    console.log(`[Realtime] 🚨 User status changed to ${newStatus}, forcing logout`);
    await handleAutoLogout(newStatus as "disabled" | "suspended");
  }
}
```

---

## 🔄 How It Works

### Data Flow

```
┌─────────────────────────────────────┐
│  User Action (e.g., completes goal) │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  API Updates Database                │
│  INSERT INTO check_ins ...           │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  Supabase Realtime Fires Event      │
│  {event: 'INSERT', table: 'check_ins'}│
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  realtimeService.handleTableChange() │
│  - Checks for user status changes   │
│  - Invalidates React Query cache    │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  React Query Auto-Refetches         │
│  - useCheckIns() refetches          │
│  - useProgressData() refetches      │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  UI Updates Instantly               │
│  - Check-in appears in list         │
│  - Progress bar updates             │
│  - Streak counter increments        │
└─────────────────────────────────────┘
```

### Reconnection Strategy

```
Connection Lost
    ↓
Attempt 1 (1s delay)
    ↓ Failed
Attempt 2 (2s delay)
    ↓ Failed
Attempt 3 (4s delay)
    ↓ Failed
Attempt 4 (8s delay)
    ↓ Success ✅
Reset attempt counter
```

**Max Delay**: 30 seconds  
**Max Attempts**: 10  
**After Max**: Give up, user must manually refresh

---

## 💰 Cost Analysis

### Supabase Realtime Pricing

**Assumptions**:

- 1000 active users
- 18 subscriptions per user
- ~10 events per user per day

**Calculations**:

- Concurrent connections: 1000 × 18 = 18,000
- Events per day: 1000 × 10 = 10,000
- Messages per day: 10,000 × 18 = 180,000 (each event → all subscribed tables)
- Messages per month: 180,000 × 30 = 5,400,000

**Supabase Pricing**:

- Free tier: 2M messages/month ❌ (exceeds by 3.4M)
- Pro tier: $25/month + $0.00002 per message
- **Cost**: $25 + (5.4M × $0.00002) = **$133/month**

### MVP Cost Reduction

Enable only **5 critical tables**:

- `users`, `check_ins`, `goals`, `actionable_plans`, `daily_motivations`

**Calculations**:

- Subscriptions: 5 instead of 18
- Messages per month: 1,500,000
- **Cost**: Free tier ✅ (under 2M)

**Recommendation**: Start with 5 core tables, add more as needed.

---

## 🧪 Testing Guide

### 1. Test Realtime Subscriptions

```bash
# Login to mobile app
# Open developer console
# Look for logs:
[Realtime] Starting subscriptions for user abc-123
[Realtime] ✅ Subscribed to users
[Realtime] ✅ Subscribed to check_ins
[Realtime] ✅ Subscribed to goals
# ... (18 total)
[Realtime] Connected to 18 channels
```

### 2. Test Cache Invalidation

**Test check_ins**:

1. Open `HomeScreen` (shows progress hub)
2. In Supabase dashboard: `INSERT INTO check_ins ...`
3. Mobile app should update **instantly** without manual refresh

**Test goals**:

1. Open `GoalsScreen` (shows list of goals)
2. In Supabase dashboard: `UPDATE goals SET title = 'New Title' WHERE id = '...'`
3. Mobile app should update **instantly**

### 3. Test Force Logout

**Test disabled**:

1. Login to mobile app
2. In Supabase dashboard: `UPDATE users SET status = 'disabled' WHERE id = '...'`
3. Mobile app should logout **instantly** (< 1 second)
4. Alert shown: "Your account has been disabled. Please contact support."

**Test suspended**:

1. Same as above, but with `status = 'suspended'`
2. Alert shown: "Your account has been suspended. Please contact support."

### 4. Test Reconnection

**Test network outage**:

1. Login to mobile app
2. Enable airplane mode
3. Wait 5 seconds
4. Disable airplane mode
5. Check logs for reconnection attempts:

```
[Realtime] Reconnecting in 1000ms (attempt 1/10)
[Realtime] ✅ Subscribed to users
[Realtime] ✅ Subscribed to check_ins
# ... (18 total)
[Realtime] Connected to 18 channels
```

---

## 🚀 Deployment Steps

### 1. Run Migration

```bash
cd apps/api
supabase db push --local --yes   # Test locally first
supabase db push --yes           # Deploy to production
```

### 2. Verify Tables

```sql
SELECT tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;
```

**Expected**: 18 tables (users, check_ins, goals, ...)

### 3. Deploy Mobile App

```bash
cd apps/mobile
# No changes needed - already integrated in _layout.tsx
npm run build
eas update --auto  # OTA update for existing users
```

### 4. Monitor Costs

- Supabase Dashboard → Usage → Realtime
- Track messages per day
- Set up alerts if approaching 2M/month (free tier limit)

---

## 📊 Monitoring & Debugging

### Connection Status

**In code**:

```typescript
import { realtimeService } from "@/services/realtime";

console.log(realtimeService.getConnectionStatus());
// { isConnected: true, channelCount: 18, reconnectAttempts: 0 }
```

**In UI** (future enhancement):

```typescript
const { isConnected, channelCount } = useRealtime();

return (
  <View>
    <Text>Realtime: {isConnected ? "✅ Connected" : "❌ Disconnected"}</Text>
    <Text>Channels: {channelCount}/18</Text>
  </View>
);
```

### Logs

**Enable verbose logging**:

```typescript
// apps/mobile/src/services/realtime/realtimeService.ts
// Change console.log to logger.debug for production
console.log(`[Realtime] ${table} ${payload.eventType}:`, payload);
```

**Filter logs**:

```bash
# iOS Simulator
xcrun simctl spawn booted log stream --predicate 'processImagePath contains "FitNudge"' | grep Realtime

# Android Emulator
adb logcat | grep Realtime
```

---

## 🔮 Future Enhancements

### Selective Subscriptions

Only subscribe to tables user is currently viewing:

- On `GoalsScreen`: Subscribe to `goals`, `actionable_plans`
- On `HomeScreen`: Subscribe to `check_ins`, `daily_motivations`, `goals`
- Saves connections and reduces cost

### Offline Queue

Queue Realtime events missed during network outage:

- Store events in local queue
- Process on reconnect
- Show "Syncing..." indicator

### Optimistic Updates

Update UI immediately, confirm with Realtime:

```typescript
// Optimistic update
queryClient.setQueryData(["check-ins"], (old) => [...old, newCheckIn]);

// Wait for Realtime confirmation
// If not received in 5s, rollback
```

### Analytics

Track Realtime performance:

- Average latency (event → UI update)
- Reconnection frequency
- Failed subscription rate

---

## 🎓 Best Practices

### 1. Always Clean Up Subscriptions

```typescript
useEffect(() => {
  const channel = supabase.channel("my_channel");

  return () => {
    supabase.removeChannel(channel); // CRITICAL
  };
}, []);
```

### 2. Use User Filters

```typescript
// ✅ Good: Only user's data
.on('postgres_changes', {
  table: 'goals',
  filter: `user_id=eq.${userId}`
}, handleChange)

// ❌ Bad: All users' data (expensive!)
.on('postgres_changes', {
  table: 'goals'
}, handleChange)
```

### 3. Batch Cache Invalidations

```typescript
// ✅ Good: Invalidate related queries together
queryClient.invalidateQueries({ queryKey: ["goals"] });
queryClient.invalidateQueries({ queryKey: ["check-ins"] });
queryClient.invalidateQueries({ queryKey: ["actionable-plans"] });

// ❌ Bad: Separate API calls (slow)
await refetchGoals();
await refetchCheckIns();
await refetchPlans();
```

### 4. Handle Connection States

```typescript
channel.subscribe((status) => {
  if (status === "SUBSCRIBED") {
    console.log("✅ Connected");
  } else if (status === "CHANNEL_ERROR") {
    console.error("❌ Error");
    handleReconnect(); // CRITICAL
  } else if (status === "TIMED_OUT") {
    console.error("⏱️ Timeout");
    handleReconnect(); // CRITICAL
  }
});
```

---

## 📚 References

- [Supabase Realtime Docs](https://supabase.com/docs/guides/realtime)
- [React Query Invalidation](https://tanstack.com/query/latest/docs/react/guides/query-invalidation)
- [Exponential Backoff](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)

---

## ✅ Checklist

- [x] Database migration created and tested
- [x] Documentation updated (`DataModels.md`)
- [x] Realtime service implemented (`realtimeService.ts`)
- [x] React context created (`RealtimeContext.tsx`)
- [x] App integration complete (`_layout.tsx`)
- [x] Query key mappings defined (18 tables)
- [x] Force logout on ban/suspend implemented
- [x] Reconnection strategy with exponential backoff
- [x] Memory leak prevention (cleanup on unmount)
- [x] User-filtered subscriptions
- [ ] **TODO**: Test in production environment
- [ ] **TODO**: Monitor costs and optimize if needed
- [ ] **TODO**: Add connection status indicator in UI
- [ ] **TODO**: Implement selective subscriptions (cost optimization)

---

**Implementation Complete**: Ready for testing and deployment! 🚀
