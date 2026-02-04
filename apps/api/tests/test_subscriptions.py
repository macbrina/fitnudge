"""Tests for subscriptions endpoints."""

import pytest

from tests.conftest import requires_supabase


@requires_supabase
def test_get_my_subscription(client, api_base, auth_headers):
    """GET /subscriptions/me returns subscription or null."""
    r = client.get(f"{api_base}/subscriptions/me", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    if data is not None:
        assert "plan" in data or "id" in data


def test_get_subscription_plans(client, api_base):
    """GET /subscription-plans/plans returns plans (may require auth)."""
    r = client.get(f"{api_base}/subscription-plans/plans")
    assert r.status_code in (200, 401)
