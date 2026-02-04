"""Tests for check-ins endpoints."""

import pytest

from tests.conftest import requires_supabase

CHECKIN_RESPONSE_KEYS = [
    "id", "goal_id", "user_id", "check_in_date", "status",
    "mood", "skip_reason", "note", "ai_response", "created_at",
]


@requires_supabase
def _ensure_goal(client, api_base, auth_headers):
    """Create a goal for check-in tests."""
    r = client.post(
        f"{api_base}/goals/",
        headers=auth_headers,
        json={
            "title": "Check-in Test Goal",
            "frequency_type": "daily",
            "frequency_count": 7,
        },
    )
    assert r.status_code == 201
    return r.json()["id"]


@requires_supabase
def test_create_checkin_returns_schema(client, api_base, auth_headers):
    """POST /check-ins creates check-in and returns CheckInResponse."""
    goal_id = _ensure_goal(client, api_base, auth_headers)
    r = client.post(
        f"{api_base}/check-ins",
        headers=auth_headers,
        json={
            "goal_id": goal_id,
            "completed": True,
            "mood": "good",
        },
    )
    assert r.status_code == 201
    data = r.json()
    for key in CHECKIN_RESPONSE_KEYS:
        assert key in data, f"Missing key: {key}"
    assert data["goal_id"] == goal_id
    assert data["status"] in ("completed", "skipped", "rest_day")


@requires_supabase
def test_create_checkin_already_checked_in(client, api_base, auth_headers):
    """POST /check-ins twice for same day returns 400."""
    goal_id = _ensure_goal(client, api_base, auth_headers)
    client.post(
        f"{api_base}/check-ins",
        headers=auth_headers,
        json={"goal_id": goal_id, "completed": True},
    )
    r = client.post(
        f"{api_base}/check-ins",
        headers=auth_headers,
        json={"goal_id": goal_id, "completed": False},
    )
    assert r.status_code == 400


@requires_supabase
def test_get_checkins_returns_list(client, api_base, auth_headers):
    """GET /check-ins returns list with schema."""
    r = client.get(f"{api_base}/check-ins", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    for c in data:
        for key in CHECKIN_RESPONSE_KEYS:
            assert key in c, f"Missing key: {key}"


@requires_supabase
def test_get_today_checkins(client, api_base, auth_headers):
    """GET /check-ins/today returns list."""
    r = client.get(f"{api_base}/check-ins/today", headers=auth_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


@requires_supabase
def test_get_checkin_404(client, api_base, auth_headers):
    """GET /check-ins/{id} with non-existent id returns 404."""
    r = client.get(
        f"{api_base}/check-ins/00000000-0000-0000-0000-000000000000",
        headers=auth_headers,
    )
    assert r.status_code == 404
