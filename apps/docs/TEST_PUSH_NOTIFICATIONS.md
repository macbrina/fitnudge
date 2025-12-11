# Test Push Notifications

## Quick Test (2 minutes)

### Option 1: Using Test Script (Recommended)

1. **Get your access token** from mobile app:
   - Login to app
   - Check Metro logs for token
   - Or use Postman to login and copy token

2. **Run test script**:

   ```bash
   cd apps/api
   poetry run python tests/manual/test_push_notifications.py
   ```

3. **Check your phone** - Should see 3 notifications:
   - 🧪 Test from Backend
   - 🤖 AI-generated motivation
   - ⏰ Check-in reminder

### Option 2: Using curl

```bash
# Replace YOUR_TOKEN with your access token
TOKEN="YOUR_TOKEN"

# Test simple push
curl -X POST http://localhost:8000/api/v1/test/test-push \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "🧪 Test", "body": "Backend push works!"}'

# Test AI motivation
curl -X POST http://localhost:8000/api/v1/test/test-ai-motivation \
  -H "Authorization: Bearer $TOKEN"

# Test check-in reminder
curl -X POST http://localhost:8000/api/v1/test/test-checkin-reminder \
  -H "Authorization: Bearer $TOKEN"
```

### Option 3: Using Swagger UI

1. **Go to**: http://localhost:8000/docs
2. **Authorize** with your token
3. **Navigate to**: Testing → POST `/test/test-push`
4. **Click**: "Try it out"
5. **Execute** and check your phone!

---

## Endpoints Created

### 1. POST `/test/test-push`

Send a simple test push notification.

**Request**:

```json
{
  "title": "🧪 Test Notification",
  "body": "This is a test!",
  "notification_type": "test"
}
```

**Response**:

```json
{
  "success": true,
  "notification_id": "uuid",
  "delivered": true,
  "tokens_attempted": 1,
  "message": "✅ Push notification sent successfully to 1 device(s)!"
}
```

### 2. POST `/test/test-ai-motivation`

Send AI-generated motivation using the new `push_motivation_generator`.

**Response**:

```json
{
  "success": true,
  "delivered": true,
  "message": "✅ AI motivation sent: \"💪 Crush Your Workout!\" - \"Your 5-day streak is calling!\""
}
```

### 3. POST `/test/test-checkin-reminder`

Send a check-in reminder push notification.

**Response**:

```json
{
  "success": true,
  "delivered": true,
  "message": "✅ Check-in reminder sent for: 7-Day Beginner Walk"
}
```

---

## What This Tests

✅ Backend can generate push notifications  
✅ Expo Push Service is configured correctly  
✅ User's device tokens are valid  
✅ Notifications appear on device  
✅ AI generation works for short push content

---

## Expected Results

### ✅ Success (Backend Push Works)

```
Phone shows notification:
  Title: "🧪 Test from Backend"
  Body: "If you see this, backend push works! 🎉"
```

**Action**: Move all notifications to backend (check-in + AI motivation)

### ❌ Failure (Backend Push Doesn't Work)

```
No notification on phone
OR
Response: "No active device tokens found"
```

**Action**: Keep local scheduling on mobile app for now

---

## Troubleshooting

### "No active device tokens"

- Mobile app hasn't registered with backend
- Check: `device_tokens` table in database
- Fix: Open mobile app, it should auto-register

### "Delivered but no notification"

- Check notification permission on device
- Check device isn't in Do Not Disturb mode
- Try force-closing and reopening app

### "Request failed: 401"

- Access token expired or invalid
- Login again to get fresh token

---

## Next Steps

### If Backend Push Works ✅

1. **Remove local scheduling** from mobile app:

   ```typescript
   // Remove from useGoalNotifications:
   // - scheduleCheckInReminders()
   // - scheduleMotivationCalls()
   ```

2. **Create backend scheduled check-ins**:
   - Add task: `send_scheduled_checkin_reminders`
   - Similar to AI motivations but for check-ins
   - Runs every minute, sends at reminder times

3. **Benefits**:
   - Centralized control
   - Trackable in database
   - AI-generated content
   - Timezone-aware from backend

### If Backend Push Fails ❌

Keep current local scheduling until push is fixed.

---

## Files Created

- ✅ `apps/api/app/api/v1/endpoints/test_notifications.py`
- ✅ `apps/api/tests/manual/test_push_notifications.py`
- ✅ `apps/docs/TEST_PUSH_NOTIFICATIONS.md`

**Run the test and report back what you see!** 🚀
