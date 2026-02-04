"""Tests for goals endpoints."""

import pytest

from tests.conftest import requires_supabase

GOAL_RESPONSE_KEYS = [
    "id", "user_id", "title", "frequency_type", "frequency_count",
    "target_days", "reminder_times", "status", "current_streak",
    "longest_streak", "total_completions", "created_at",
]


@requires_supabase
def test_get_goals_returns_schema(client, api_base, auth_headers):
    """GET /goals returns GoalResponse list with expected shape."""
    r = client.get(f"{api_base}/goals/", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    for g in data:
        for key in GOAL_RESPONSE_KEYS:
            assert key in g, f"Missing key: {key}"
        assert g["status"] in ("active", "paused", "archived", "completed")


@requires_supabase
def test_create_goal_returns_schema(client, api_base, auth_headers):
    """POST /goals creates goal and returns GoalResponse."""
    r = client.post(
        f"{api_base}/goals/",
        headers=auth_headers,
        json={
            "title": "Test Goal",
            "frequency_type": "daily",
            "frequency_count": 7,
        },
    )
    assert r.status_code == 201
    data = r.json()
    for key in GOAL_RESPONSE_KEYS:
        assert key in data, f"Missing key: {key}"
    assert data["title"] == "Test Goal"
    assert data["frequency_type"] == "daily"


@requires_supabase
def test_get_goal_by_id(client, api_base, auth_headers):
    """GET /goals/{id} returns single goal with schema."""
    create_r = client.post(
        f"{api_base}/goals/",
        headers=auth_headers,
        json={"title": "Get Test", "frequency_type": "daily", "frequency_count": 7},
    )
    assert create_r.status_code == 201
    goal_id = create_r.json()["id"]

    r = client.get(f"{api_base}/goals/{goal_id}", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    for key in GOAL_RESPONSE_KEYS:
        assert key in data, f"Missing key: {key}"
    assert data["id"] == goal_id


@requires_supabase
def test_get_goal_404(client, api_base, auth_headers):
    """GET /goals/{id} with non-existent id returns 404."""
    r = client.get(
        f"{api_base}/goals/00000000-0000-0000-0000-000000000000",
        headers=auth_headers,
    )
    assert r.status_code == 404


@requires_supabase
def test_update_goal(client, api_base, auth_headers):
    """PUT /goals/{id} updates and returns schema."""
    create_r = client.post(
        f"{api_base}/goals/",
        headers=auth_headers,
        json={"title": "Update Test", "frequency_type": "daily", "frequency_count": 7},
    )
    goal_id = create_r.json()["id"]

    r = client.put(
        f"{api_base}/goals/{goal_id}",
        headers=auth_headers,
        json={"title": "Updated Title"},
    )
    assert r.status_code == 200
    assert r.json()["title"] == "Updated Title"


@requires_supabase
def test_delete_goal(client, api_base, auth_headers):
    """DELETE /goals/{id} returns 200."""
    create_r = client.post(
        f"{api_base}/goals/",
        headers=auth_headers,
        json={"title": "Delete Test", "frequency_type": "daily", "frequency_count": 7},
    )
    goal_id = create_r.json()["id"]

    r = client.delete(f"{api_base}/goals/{goal_id}", headers=auth_headers)
    assert r.status_code == 200


@requires_supabase
def test_create_goal_validation_error(client, api_base, auth_headers):
    """POST /goals with invalid payload returns 400 (API validates and rejects)."""
    r = client.post(
        f"{api_base}/goals/",
        headers=auth_headers,
        json={"title": "", "frequency_type": "invalid"},
    )
    assert r.status_code == 400
