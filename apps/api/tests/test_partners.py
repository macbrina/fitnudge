"""Tests for partners endpoints."""

import pytest

from tests.conftest import requires_supabase


@requires_supabase
def test_get_partners(client, api_base, auth_headers):
    """GET /partners returns list."""
    r = client.get(f"{api_base}/partners", headers=auth_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


@requires_supabase
def test_get_partner_limits(client, api_base, auth_headers):
    """GET /partners/limits returns schema."""
    r = client.get(f"{api_base}/partners/limits", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert "current" in data or "limit" in data or "max" in data
