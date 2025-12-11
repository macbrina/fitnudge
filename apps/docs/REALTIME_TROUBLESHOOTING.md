# Supabase Realtime Troubleshooting Guide

This guide helps diagnose and fix Realtime connection issues in local development.

## Quick Diagnosis

### 1. Check Supabase Status

```bash
cd apps/api
supabase status --output json | python3 -m json.tool
```

**Expected output:**

```json
{
  "ANON_KEY": "eyJhbGci...",
  "JWT_SECRET": "super-secret-jwt-token-with-at-least-32-characters-long",
  "API_URL": "http://127.0.0.1:54321"
}
```

### 2. Check Mobile App Environment Variables

Look for this output when the app starts:

```
═══════════════════════════════════════════════════════════
🔧 Supabase Client Configuration
═══════════════════════════════════════════════════════════
URL: http://127.0.0.1:54321
Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6...CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0

Environment Variable Sources:
  process.env.EXPO_PUBLIC_SUPABASE_URL: ✅ Set
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY: ✅ Set
  Constants.expoConfig.extra: ✅ Available

Environment:
  Local Dev (127.0.0.1): ✅
  Local Dev (localhost): ⚠️
  Production (supabase.co): ⚠️
═══════════════════════════════════════════════════════════
```

---

## Common Issues

### Issue 1: "constructor is not callable"

**Symptoms:**

```
[Realtime] Failed to subscribe to users: constructor is not callable
```

**Cause:** Supabase client not initialized (missing credentials)

**Fix:**

1. Check that `apps/mobile/.env` exists and has:

   ```env
   EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
   ```

2. Restart Metro bundler:

   ```bash
   cd apps/mobile
   yarn start --clear
   ```

3. Rebuild the app (if using EAS build or dev client):
   ```bash
   eas build --profile development --platform ios
   # or
   eas build --profile development --platform android
   ```

---

### Issue 2: JWT Secret Mismatch

**Symptoms:**

```
[error] Auth error: {:error, :signature_error}
WebSocket connection failed
```

**Cause:** Mobile app's anon key doesn't match Supabase's JWT secret

**Fix:**

1. Get the correct anon key from Supabase:

   ```bash
   cd apps/api
   supabase status --output json | grep ANON_KEY
   ```

2. Update `apps/mobile/.env`:

   ```env
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<paste-the-anon-key-here>
   ```

3. Restart Metro:
   ```bash
   cd apps/mobile
   yarn start --clear
   ```

---

### Issue 3: Expo Dashboard Variables Not Applied

**Symptoms:**

- Changed variables in Expo dashboard
- App still uses old values

**Cause:** Expo embeds environment variables at **build time**, not runtime

**Fix:**

For **local development** (using `apps/mobile/.env`):

```bash
cd apps/mobile
yarn start --clear
```

For **EAS builds** (using Expo dashboard):

```bash
# 1. Update variables in Expo dashboard
# 2. Rebuild the app
eas build --profile development --platform ios
```

**Note:** Local `.env` file takes precedence over Expo dashboard in development.

---

### Issue 4: Realtime Not Enabled on Tables

**Symptoms:**

```
❌ Failed: 18/20
   Tables: check_ins, goals, actionable_plans, ...
```

**Cause:** Tables not added to Realtime publication

**Fix:**

1. Check if migration ran:

   ```bash
   cd apps/api
   supabase db push
   ```

2. Manually verify:

   ```sql
   -- In Supabase Studio SQL Editor
   SELECT tablename
   FROM pg_publication_tables
   WHERE pubname = 'supabase_realtime';
   ```

3. If tables are missing, run migration:
   ```bash
   cd apps/api
   supabase migration up
   ```

---

### Issue 5: WebSocket Connection Blocked

**Symptoms:**

```
⏱️ Connection timeout - WebSocket may be blocked
🔌 Channel closed immediately - check Realtime service
```

**Cause:** Firewall, network proxy, or Realtime service not running

**Fix:**

1. Check Realtime is running:

   ```bash
   cd apps/api
   supabase status
   # Look for "Stopped services" - Realtime should NOT be there
   ```

2. Restart Supabase:

   ```bash
   cd apps/api
   supabase stop
   supabase start
   ```

3. Check network/firewall:
   - Disable VPN
   - Check corporate firewall settings
   - Try different network

---

### Issue 6: localhost vs 127.0.0.1

**Symptoms:**

- Works on iOS simulator
- Fails on Android emulator or physical device

**Cause:** Android doesn't always resolve `localhost` correctly

**Fix:**

Use **127.0.0.1** instead of **localhost** in `apps/mobile/.env`:

```env
# ✅ Good
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321

# ❌ Bad (may not work on Android)
EXPO_PUBLIC_SUPABASE_URL=http://localhost:54321
```

The app automatically converts `localhost` to `127.0.0.1` for compatibility.

---

## Advanced Diagnostics

### Enable Detailed Logging

The app automatically logs connection attempts in development. Look for:

```
[Supabase] Configuration: ...
[Realtime] Service initialized
[Realtime] Starting subscriptions for user ...
[Realtime] ✅ users
[Realtime] ✅ check_ins
...
📡 Realtime Subscription Summary
✅ Successful: 20/20
```

### Check WebSocket Connection

Test WebSocket manually:

```bash
# Install wscat
npm install -g wscat

# Test connection
wscat -c "ws://127.0.0.1:54321/realtime/v1/websocket?apikey=eyJhbGci..."
```

### Inspect Network Traffic

1. Open React Native Debugger
2. Go to Network tab
3. Filter for WebSocket connections
4. Look for `wss://` or `ws://` connections to `/realtime/v1`

---

## Known Limitations

### Local Development

- **Realtime may not work with all Supabase CLI versions**
  - Recommended: v2.54.11+ (you're on v2.54.11)
  - Update: `npm update -g supabase`

- **JWT_SECRET must match**
  - Default: `super-secret-jwt-token-with-at-least-32-characters-long`
  - This is hardcoded in the CLI's default anon key

### Production

- Always use production Supabase credentials
- Update `apps/mobile/.env` with production values
- Rebuild the app with EAS

---

## Checklist

- [ ] Supabase is running (`supabase status`)
- [ ] `apps/mobile/.env` has correct `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Metro bundler restarted (`yarn start --clear`)
- [ ] Using `127.0.0.1`, not `localhost`
- [ ] Realtime enabled in `apps/api/supabase/config.toml` (`[realtime] enabled = true`)
- [ ] Migration applied (`supabase db push`)
- [ ] No VPN or firewall blocking WebSocket connections
- [ ] App shows ✅ in diagnostic logs

---

## Still Not Working?

1. **Check the logs:**
   - Look for the diagnostic output when the app starts
   - Screenshot and share any error messages

2. **Verify versions:**

   ```bash
   supabase --version  # Should be 2.54.11+
   node --version      # Should be 18+
   ```

3. **Try production Supabase:**
   - Update `.env` to use production credentials
   - If it works, issue is with local setup
   - If it doesn't, issue is with the app

4. **Create a minimal test:**

   ```typescript
   import { supabase } from "@/lib/supabase";

   const testRealtime = async () => {
     const channel = supabase.channel("test");
     channel.subscribe((status) => {
       console.log("Status:", status);
     });
   };
   ```

---

## Related Files

- `apps/mobile/src/lib/supabase.ts` - Supabase client initialization
- `apps/mobile/src/services/realtime/realtimeService.ts` - Realtime service
- `apps/mobile/src/contexts/RealtimeContext.tsx` - React context
- `apps/api/supabase/config.toml` - Supabase configuration
- `apps/api/supabase/migrations/20251203000000_enable_realtime_for_core_tables.sql` - Migration
