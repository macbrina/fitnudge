"""Tests for app-config endpoint (public, no auth)."""


def test_app_config_public_returns_200(client, api_base):
    """GET /app-config/public returns 200 and config structure."""
    r = client.get(f"{api_base}/app-config/public")
    assert r.status_code == 200
    data = r.json()
    assert "config" in data
    assert "items" in data
    assert isinstance(data["config"], dict)
    assert isinstance(data["items"], list)
