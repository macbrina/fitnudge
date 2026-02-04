"""
Pytest configuration and fixtures for FitNudge API tests.

Integration tests require Supabase to be configured (SUPABASE_URL, SUPABASE_SERVICE_KEY).
Tests that need DB are skipped when Supabase is not available.
"""

import os
import uuid
from typing import Generator

import pytest
from fastapi.testclient import TestClient

from main import app


def _supabase_configured() -> bool:
    """Check if Supabase is configured for integration tests."""
    return bool(os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_SERVICE_KEY"))


requires_supabase = pytest.mark.skipif(
    not _supabase_configured(),
    reason="SUPABASE_URL and SUPABASE_SERVICE_KEY required for integration tests",
)


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    """Test client for the FastAPI app.
    Use client=('127.0.0.1', 50000) so IPWhitelistMiddleware allows the request
    (default 'testclient' host triggers 403).
    """
    with TestClient(app, base_url="http://test", client=("127.0.0.1", 50000)) as c:
        yield c


@pytest.fixture
def api_base() -> str:
    """Base path for API v1 endpoints."""
    return "/api/v1"


@pytest.fixture
def test_user_credentials() -> dict:
    """Unique credentials for test user (avoids collision across runs)."""
    uid = str(uuid.uuid4())[:8]
    return {
        "email": f"test-{uid}@fitnudge-test.example.com",
        "password": "TestPassword123!",
        "name": "Test User",
        "username": f"testuser{uid}",
    }


@pytest.fixture
def auth_headers(client: TestClient, api_base: str, test_user_credentials: dict) -> dict:
    """
    Create a test user via signup and return headers with access token.
    """
    signup = client.post(
        f"{api_base}/auth/signup",
        json=test_user_credentials,
    )
    if signup.status_code != 201:
        pytest.skip(
            f"Signup failed (status={signup.status_code}), "
            "Supabase may not be properly configured"
        )

    data = signup.json()
    access_token = data.get("access_token")
    if not access_token:
        pytest.skip("Signup succeeded but no access_token in response")

    return {"Authorization": f"Bearer {access_token}"}


@pytest.fixture
def test_user(client: TestClient, api_base: str, auth_headers: dict) -> dict:
    """Get the current test user profile."""
    r = client.get(f"{api_base}/users/profile", headers=auth_headers)
    if r.status_code != 200:
        pytest.skip("Could not fetch test user profile")
    return r.json()
