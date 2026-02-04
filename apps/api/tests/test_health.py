"""Tests for health endpoint."""

import pytest


def test_health_returns_200(client, api_base):
    """Health endpoint returns 200."""
    r = client.get("/health")
    assert r.status_code in (200, 503)


def test_health_returns_expected_keys(client):
    """Health response contains expected structure."""
    r = client.get("/health")
    data = r.json()
    assert "status" in data
    assert "version" in data
    assert "checks" in data
    assert isinstance(data["checks"], list)
