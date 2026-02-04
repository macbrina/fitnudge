"""Tests for onboarding endpoints."""

import pytest

from tests.conftest import requires_supabase


@requires_supabase
def test_complete_onboarding(client, api_base, auth_headers):
    """POST /onboarding/complete returns 200."""
    r = client.post(
        f"{api_base}/onboarding/complete",
        headers=auth_headers,
        json={
            "name": "Test User",
            "motivation_style": "supportive",
            "morning_motivation_enabled": True,
            "morning_motivation_time": "08:00",
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data.get("success") is True
    assert "user_id" in data
    assert data.get("onboarding_completed") is True


@requires_supabase
def test_complete_onboarding_invalid_style(client, api_base, auth_headers):
    """POST /onboarding/complete with invalid motivation_style returns 400."""
    r = client.post(
        f"{api_base}/onboarding/complete",
        headers=auth_headers,
        json={
            "name": "Test",
            "motivation_style": "invalid",
        },
    )
    assert r.status_code == 400
