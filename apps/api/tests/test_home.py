"""Tests for home dashboard endpoint."""

import pytest

from tests.conftest import requires_supabase


@requires_supabase
def test_home_dashboard_returns_schema(client, api_base, auth_headers):
    """GET /home/dashboard returns HomeDashboardResponse shape."""
    r = client.get(f"{api_base}/home/dashboard", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert "today_pending_checkins" in data
    assert "current_streak" in data
    assert "longest_streak" in data
    assert isinstance(data["today_pending_checkins"], list)
    assert isinstance(data["current_streak"], int)
    assert isinstance(data["longest_streak"], int)
