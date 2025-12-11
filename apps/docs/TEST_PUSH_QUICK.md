# Quick Push Notification Test

Since Swagger UI is showing a blank screen, use this quick test:

## Option 1: Use Test Script (Easiest)

```bash
cd apps/api
./test_push.sh YOUR_ACCESS_TOKEN
```

**Get your token:**

1. Login to mobile app
2. Check Metro logs for token
3. Or login via API:
   ```bash
   curl -X POST http://localhost:8000/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"your@email.com","password":"yourpass"}'
   ```

## Option 2: Direct curl Commands

### Test Simple Push

```bash
TOKEN="YOUR_ACCESS_TOKEN"

curl -X POST http://localhost:8000/api/v1/test/test-push \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "🧪 Test from Backend",
    "body": "If you see this, backend push works! 🎉"
  }'
```

### Test AI Motivation

```bash
curl -X POST http://localhost:8000/api/v1/test/test-ai-motivation \
  -H "Authorization: Bearer $TOKEN"
```

### Test Check-In Reminder

```bash
curl -X POST http://localhost:8000/api/v1/test/test-checkin-reminder \
  -H "Authorization: Bearer $TOKEN"
```

## Expected Response

**Success:**

```json
{
  "success": true,
  "notification_id": "uuid-here",
  "delivered": true,
  "tokens_attempted": 1,
  "message": "✅ Push notification sent successfully to 1 device(s)!"
}
```

**No Tokens:**

```json
{
  "success": false,
  "delivered": false,
  "tokens_attempted": 0,
  "message": "❌ No active device tokens found..."
}
```

## What to Check

1. **If `delivered: true`** → ✅ Backend push works! Check your phone
2. **If `delivered: false`** → Check device token registration
3. **If 401 error** → Token expired, login again
4. **If 500 error** → Check API server logs

## Fix Swagger UI (Optional)

If you want to fix the blank Swagger screen:

1. **Check browser console** (F12) for JavaScript errors
2. **Try different browser** (Chrome, Firefox, Safari)
3. **Check if server is running**: `curl http://localhost:8000/health`
4. **Try ReDoc instead**: http://localhost:8000/redoc

But for testing, **curl is faster anyway!** 🚀
