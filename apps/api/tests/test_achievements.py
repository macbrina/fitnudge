"""Tests for achievements endpoints."""

import pytest

from tests.conftest import requires_supabase


@requires_supabase
def test_get_my_achievements(client, api_base, auth_headers):
    """GET /achievements/me returns list."""
    r = client.get(f"{api_base}/achievements/me", headers=auth_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_get_achievement_types(client, api_base):
    """GET /achievements/types returns list (may require auth)."""
    r = client.get(f"{api_base}/achievements/types")
    assert r.status_code in (200, 401)
