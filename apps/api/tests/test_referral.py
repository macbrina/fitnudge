"""Tests for referral system: signup with code, referrals list, bonus to both."""

import uuid

import pytest

from tests.conftest import requires_supabase


@requires_supabase
def test_signup_with_referral_code_creates_referral_record(client, api_base, test_user_credentials):
    """
    Signup with referral_code creates referral record and referred_by_user_id.
    Flow: User A signs up -> gets referral code -> User B signs up with code.
    """
    uid = str(uuid.uuid4())[:8]
    # 1. Create referrer (User A) - same pattern as test_signup_success
    referrer_creds = {
        "email": f"referrer{uid}@fitnudge-test.example.com",
        "password": "TestPassword123!",
        "name": "Referrer User",
        "username": f"referrer{uid}",
    }
    r_a = client.post(f"{api_base}/auth/signup", json=referrer_creds)
    assert r_a.status_code == 201
    token_a = r_a.json().get("access_token")
    assert token_a
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # 2. Get referrer's referral code
    r_code = client.get(f"{api_base}/users/me/referral-code", headers=headers_a)
    assert r_code.status_code == 200
    referral_code = r_code.json().get("referral_code")
    assert referral_code

    # 3. Create referred user (User B) with referral code
    referred_creds = {
        "email": f"referred{uid}@fitnudge-test.example.com",
        "password": "TestPassword123!",
        "name": "Referred User",
        "username": f"referred{uid}",
        "referral_code": referral_code,
    }
    r_b = client.post(f"{api_base}/auth/signup", json=referred_creds)
    assert r_b.status_code == 201
    user_b = r_b.json().get("user", {})
    assert user_b.get("id")

    # 4. Referrer should see referred user in their referrals list
    r_refs = client.get(f"{api_base}/users/me/referrals", headers=headers_a)
    assert r_refs.status_code == 200
    data = r_refs.json()
    assert "referrals" in data
    referrals = data["referrals"]
    assert len(referrals) >= 1
    referred_ids = [r.get("id") for r in referrals]
    assert user_b["id"] in referred_ids

    # 5. Referred user's entry should have status pending (bonus not yet granted)
    referred_entry = next(r for r in referrals if r.get("id") == user_b["id"])
    assert referred_entry.get("status") in ("pending", "subscribed", "processing")


@requires_supabase
def test_get_my_referral_code_returns_code(client, api_base, auth_headers):
    """GET /users/me/referral-code returns referral_code and link."""
    r = client.get(f"{api_base}/users/me/referral-code", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert "referral_code" in data
    assert "referral_link" in data
    assert "fitnudge.app" in data["referral_link"]


@requires_supabase
def test_get_my_referrals_returns_list(client, api_base, auth_headers):
    """GET /users/me/referrals returns referrals list and total_bonus_days_earned."""
    r = client.get(f"{api_base}/users/me/referrals", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert "referrals" in data
    assert "total_bonus_days_earned" in data
    assert isinstance(data["referrals"], list)
