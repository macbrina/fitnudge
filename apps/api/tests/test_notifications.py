"""Tests for notifications endpoints."""

import pytest

from tests.conftest import requires_supabase


@requires_supabase
def test_get_notification_preferences(client, api_base, auth_headers):
    """GET /notifications/preferences returns schema."""
    r = client.get(f"{api_base}/notifications/preferences", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert "enabled" in data or "push_notifications" in data


@requires_supabase
def test_get_notification_history(client, api_base, auth_headers):
    """GET /notifications/history returns list."""
    r = client.get(f"{api_base}/notifications/history", headers=auth_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)
