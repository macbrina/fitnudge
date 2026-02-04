"""Tests for auth endpoints."""

import pytest

from tests.conftest import requires_supabase


@requires_supabase
def test_signup_success(client, api_base, test_user_credentials):
    """Signup creates user and returns tokens."""
    r = client.post(f"{api_base}/auth/signup", json=test_user_credentials)
    assert r.status_code == 201
    data = r.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert "user" in data
    assert data["user"]["email"] == test_user_credentials["email"]
    assert data["user"]["username"] == test_user_credentials["username"]


@requires_supabase
def test_signup_duplicate_email(client, api_base, test_user_credentials):
    """Signup with existing email returns 400."""
    client.post(f"{api_base}/auth/signup", json=test_user_credentials)
    r = client.post(f"{api_base}/auth/signup", json=test_user_credentials)
    assert r.status_code == 400


def test_signup_validation_error(client, api_base):
    """Signup with invalid payload returns 422."""
    r = client.post(
        f"{api_base}/auth/signup",
        json={
            "email": "invalid-email",
            "password": "short",
            "name": "Test",
            "username": "test",
        },
    )
    assert r.status_code == 422


@requires_supabase
def test_login_success(client, api_base, test_user_credentials, auth_headers):
    """Login returns tokens for valid credentials."""
    r = client.post(
        f"{api_base}/auth/login",
        json={
            "email": test_user_credentials["email"],
            "password": test_user_credentials["password"],
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert "access_token" in data
    assert "refresh_token" in data


@requires_supabase
def test_login_invalid_credentials(client, api_base, test_user_credentials):
    """Login with wrong password returns 401."""
    client.post(f"{api_base}/auth/signup", json=test_user_credentials)
    r = client.post(
        f"{api_base}/auth/login",
        json={
            "email": test_user_credentials["email"],
            "password": "WrongPassword123!",
        },
    )
    assert r.status_code == 401


@requires_supabase
def test_refresh_token(client, api_base, test_user_credentials):
    """Refresh endpoint returns new tokens."""
    signup_r = client.post(f"{api_base}/auth/signup", json=test_user_credentials)
    assert signup_r.status_code == 201
    refresh_token = signup_r.json().get("refresh_token")
    if not refresh_token:
        pytest.skip("No refresh token in login response")

    r = client.post(
        f"{api_base}/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert r.status_code == 200
    data = r.json()
    assert "access_token" in data
    assert "refresh_token" in data


@requires_supabase
def test_refresh_invalid_token(client, api_base):
    """Refresh with invalid token returns 401."""
    r = client.post(
        f"{api_base}/auth/refresh",
        json={"refresh_token": "invalid-token"},
    )
    assert r.status_code == 401


def test_forgot_password_accepts_valid_email(client, api_base):
    """Forgot password accepts valid email format."""
    r = client.post(
        f"{api_base}/auth/forgot-password",
        json={"email": "nonexistent@example.com"},
    )
    assert r.status_code == 200


def test_forgot_password_invalid_email(client, api_base):
    """Forgot password with invalid email returns 422."""
    r = client.post(
        f"{api_base}/auth/forgot-password",
        json={"email": "invalid"},
    )
    assert r.status_code == 422


@requires_supabase
def test_logout(client, api_base, auth_headers):
    """Logout returns 200."""
    r = client.post(f"{api_base}/auth/logout", headers=auth_headers)
    assert r.status_code == 200
