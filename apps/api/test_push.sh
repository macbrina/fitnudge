#!/bin/bash
# Quick test script for push notifications
# Usage: ./test_push.sh YOUR_ACCESS_TOKEN

TOKEN=$1

if [ -z "$TOKEN" ]; then
    echo "❌ Usage: ./test_push.sh YOUR_ACCESS_TOKEN"
    echo ""
    echo "Get your token from:"
    echo "  1. Mobile app login response"
    echo "  2. Or login via: curl -X POST http://localhost:8000/api/v1/auth/login -H 'Content-Type: application/json' -d '{\"email\":\"your@email.com\",\"password\":\"yourpass\"}'"
    exit 1
fi

echo "🧪 Testing Push Notification..."
echo ""

# Test simple push
echo "1️⃣  Testing simple push..."
RESPONSE=$(curl -s -X POST http://localhost:8000/api/v1/test/test-push \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "🧪 Test from Backend", "body": "If you see this, backend push works! 🎉", "notification_type": "achievement"}')

echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

# Check if delivered
if echo "$RESPONSE" | grep -q '"delivered": true'; then
    echo "✅ Push notification sent! Check your phone 📱"
else
    echo "❌ Push notification failed. Check the response above."
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test AI motivation
echo "2️⃣  Testing AI motivation push..."
RESPONSE2=$(curl -s -X POST http://localhost:8000/api/v1/test/test-ai-motivation \
  -H "Authorization: Bearer $TOKEN")

echo "$RESPONSE2" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE2"
echo ""

if echo "$RESPONSE2" | grep -q '"delivered": true'; then
    echo "✅ AI motivation sent! Check your phone 📱"
else
    echo "⚠️  AI motivation failed or no active goals found"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✨ Test complete! Check your phone for notifications."

