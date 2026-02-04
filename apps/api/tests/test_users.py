"""Tests for users endpoints."""

import pytest

from tests.conftest import requires_supabase

USER_PROFILE_KEYS = [
    "id", "email", "name", "username", "plan", "timezone", "email_verified",
    "auth_provider", "profile_picture_url", "bio", "status",
]


@requires_supabase
def test_get_profile_returns_schema(client, api_base, auth_headers):
    """GET /users/profile returns UserProfileResponse shape."""
    r = client.get(f"{api_base}/users/profile", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    for key in USER_PROFILE_KEYS:
        assert key in data, f"Missing key: {key}"
    assert data["status"] in ("active", "disabled", "suspended")


@requires_supabase
def test_get_profile_unauthorized(client, api_base):
    """GET /users/profile without auth returns 401."""
    r = client.get(f"{api_base}/users/profile")
    assert r.status_code == 401


@requires_supabase
def test_update_profile(client, api_base, auth_headers):
    """PUT /users/profile updates and returns schema."""
    r = client.put(
        f"{api_base}/users/profile",
        headers=auth_headers,
        json={"name": "Updated Name", "bio": "Test bio"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["name"] == "Updated Name"
    assert data["bio"] == "Test bio"
