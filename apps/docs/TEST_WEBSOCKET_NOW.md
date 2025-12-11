# Test WebSocket Connection NOW

## Quick Test (30 seconds)

1. **Open React Native Debugger** (shake device → "Debug" or press `d` in Metro)

2. **Open Console**

3. **Paste and run this code:**

```javascript
// Test raw WebSocket connection (NO EMOJIS VERSION)
const wsUrl =
  "ws://127.0.0.1:54321/realtime/v1/websocket?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0&vsn=1.0.0";

console.log("[WS TEST] Connecting to:", wsUrl);

const ws = new WebSocket(wsUrl);

ws.onopen = () => {
  console.log("[WS TEST] SUCCESS - WEBSOCKET OPENED!");
  console.log("[WS TEST] State:", ws.readyState);
  ws.send(
    JSON.stringify({
      topic: "realtime:public",
      event: "phx_join",
      payload: {},
      ref: "1",
    })
  );
};

ws.onmessage = (e) => {
  console.log("[WS TEST] Message received:", e.data);
};

ws.onerror = (e) => {
  console.error("[WS TEST] ERROR:", e);
  console.error("[WS TEST] Error type:", typeof e);
  console.error("[WS TEST] Error message:", e.message);
};

ws.onclose = (e) => {
  console.log("[WS TEST] WebSocket Closed");
  console.log("[WS TEST] Close code:", e.code);
  console.log("[WS TEST] Close reason:", e.reason);
};

setTimeout(() => {
  console.log("[WS TEST] After 3 seconds, WebSocket state:", ws.readyState);
  console.log(
    "[WS TEST] State meanings: 0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED"
  );
}, 3000);
```

## What to Look For

### ✅ SUCCESS (WebSocket Works)

```
✅ WEBSOCKET OPENED!
   State: 1
📩 Message: {"event":"phx_reply",...}
After 3s, WebSocket state: 1
```

This means: **WebSocket works! The issue is with Supabase client configuration.**

### ❌ FAILURE (WebSocket Broken)

```
❌ WebSocket Error: ...
🔌 WebSocket Closed
   Code: 1006
After 3s, WebSocket state: 3
```

This means: **WebSocket doesn't work in your React Native environment.**

Common causes:

- Metro bundler not configured correctly
- React Native version incompatibility
- Network/firewall blocking WebSocket
- iOS/Android emulator issue with 127.0.0.1

## If WebSocket is Broken

### Try 1: Use 10.0.2.2 (Android Only)

```javascript
const wsUrl =
  "ws://10.0.2.2:54321/realtime/v1/websocket?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0&vsn=1.0.0";
// ... same code as above
```

### Try 2: Test on Real Device (iOS/Android)

Metro should be accessible via LAN. Get your computer's IP:

```bash
# macOS
ipconfig getifaddr en0

# Result example: 192.168.1.100
```

Then test with:

```javascript
const wsUrl = "ws://192.168.1.100:54321/realtime/v1/websocket?apikey=...";
```

But you'll need to update Supabase to listen on 0.0.0.0 (not just 127.0.0.1)

### Try 3: Disable Realtime

If WebSocket fundamentally doesn't work:

```bash
# apps/mobile/.env
EXPO_PUBLIC_ENABLE_REALTIME=false
```

**The app works fine without Realtime!**

---

## After Testing

**Report back what you see!**

If WebSocket works (state: 1) → We need to fix Supabase client config  
If WebSocket fails (state: 3) → We need to disable Realtime for local dev
