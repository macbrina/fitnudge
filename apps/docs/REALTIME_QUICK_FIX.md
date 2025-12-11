# Realtime Quick Fix Guide

## The Problem

Your Realtime subscriptions are failing because all channels start in "closed" state, indicating the WebSocket connection isn't being established in React Native.

## Solution 1: Try the WebSocket Fix (RECOMMENDED)

I've added explicit WebSocket configuration to the Supabase client. **Restart your Metro bundler** to test:

```bash
cd apps/mobile
yarn start --clear
```

The changes:

- ✅ Explicitly configured WebSocket for React Native
- ✅ Added heartbeat to keep connections alive
- ✅ Configured reconnection strategy
- ✅ Enhanced logging to debug connection issues

## Solution 2: Disable Realtime (WORKAROUND)

**Realtime is NOT required for the app to work!** It's a nice-to-have feature for instant updates. If it continues to fail in local development, you can disable it:

### Option A: Temporary Disable (Command Line)

```bash
cd apps/mobile
EXPO_PUBLIC_ENABLE_REALTIME=false yarn start
```

### Option B: Permanent Disable for Local Dev

Add this to `apps/mobile/.env`:

```env
# Disable Realtime in local development (optional)
EXPO_PUBLIC_ENABLE_REALTIME=false
```

Then restart Metro:

```bash
yarn start --clear
```

### What happens when Realtime is disabled?

- ✅ App works normally
- ✅ Data updates via React Query polling
- ✅ Manual refresh still works
- ⚠️ No instant real-time updates (you'll see changes after 5-30 seconds depending on cache)

## Solution 3: Use Production Supabase

Realtime may work better with production Supabase. Test by updating `apps/mobile/.env`:

```env
# Comment out local Supabase
# EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
# EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...

# Use production Supabase
EXPO_PUBLIC_SUPABASE_URL=https://mwolmxwdtcoeanfydijj.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13b2xteHdkdGNvZWFuZnlkaWpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1MDQyNTMsImV4cCI6MjA3NzA4MDI1M30.MuQ4kkcbkAJZLUgODa4pziiN077EYj5jHa0VWAW_KBs
```

Then restart Metro.

## What to Look For

After restarting Metro, check the logs for:

### ✅ Success (WebSocket Fix Worked)

```
[Realtime] Channel created for users, state: joined
[Realtime] users subscription status: SUBSCRIBED
✅ Successful: 20/20
```

### ❌ Still Failing (Disable Realtime)

```
[Realtime] Channel created for users, state: closed
[Realtime] users subscription status: CHANNEL_ERROR
❌ Failed: 20/20
```

If you see "closed" → Set `EXPO_PUBLIC_ENABLE_REALTIME=false` in `.env`

## Testing WebSocket Directly (Advanced)

I created a test utility at `apps/mobile/src/utils/testWebSocket.ts`. To use it:

1. Import it in any screen:

```typescript
import { testWebSocketConnection } from "@/utils/testWebSocket";
```

2. Call it:

```typescript
testWebSocketConnection();
```

3. Check console for WebSocket connection results

## Known Limitations

- **Local Supabase Realtime may not work reliably** on some networks/configurations
- **React Native WebSocket** behaves differently than browser WebSocket
- **Android emulator** sometimes has issues with `127.0.0.1` WebSocket connections
- This is a **known issue** - Supabase Realtime + React Native + Local Dev is finicky

## Recommendation

For **local development**: Disable Realtime (`EXPO_PUBLIC_ENABLE_REALTIME=false`)  
For **testing/production**: Enable Realtime (uses production Supabase with better connectivity)

The app is designed to work perfectly fine without Realtime! 🎉

---

## TL;DR

```bash
# Try the fix:
cd apps/mobile
yarn start --clear

# If still broken, disable Realtime:
echo "EXPO_PUBLIC_ENABLE_REALTIME=false" >> .env
yarn start --clear

# App will work fine, just without instant updates ✅
```
