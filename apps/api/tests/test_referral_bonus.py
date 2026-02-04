"""
Unit test for referral bonus: verifies process_referral_bonus grants to BOTH
referrer and referred user when RevenueCat grants succeed.
"""

import uuid
from unittest.mock import AsyncMock, patch

import pytest

from tests.conftest import requires_supabase


@requires_supabase
@pytest.mark.asyncio
async def test_process_referral_bonus_grants_to_both_when_mocked(
    client, api_base, test_user_credentials
):
    """
    When grant_promotional_access succeeds for both, referral is marked rewarded.
    Mocks RevenueCat API; uses real Supabase for referral record.
    """
    uid = str(uuid.uuid4())[:8]

    # 1. Create referrer (User A)
    referrer_creds = {
        "email": f"ref-bonus-a-{uid}@fitnudge-test.example.com",
        "password": test_user_credentials["password"],
        "name": "Referrer",
        "username": f"refbonusa{uid}",
    }
    r_a = client.post(f"{api_base}/auth/signup", json=referrer_creds)
    assert r_a.status_code == 201
    user_a_id = r_a.json()["user"]["id"]

    # 2. Get referral code and create referred user (User B)
    token_a = r_a.json()["access_token"]
    r_code = client.get(
        f"{api_base}/users/me/referral-code",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert r_code.status_code == 200
    referral_code = r_code.json()["referral_code"]

    referred_creds = {
        "email": f"ref-bonus-b-{uid}@fitnudge-test.example.com",
        "password": test_user_credentials["password"],
        "name": "Referred",
        "username": f"refbonusb{uid}",
        "referral_code": referral_code,
    }
    r_b = client.post(f"{api_base}/auth/signup", json=referred_creds)
    assert r_b.status_code == 201
    user_b_id = r_b.json()["user"]["id"]

    # 3. Mock grant_promotional_access to succeed for both
    with patch(
        "app.services.referral_service.grant_promotional_access",
        new_callable=AsyncMock,
        return_value=True,
    ) as mock_grant:
        from app.services.referral_service import process_referral_bonus

        result = await process_referral_bonus(user_b_id, user_a_id)

        # Both grants should have been attempted
        assert mock_grant.call_count == 2
        calls = mock_grant.call_args_list
        user_ids_called = [c[0][0] for c in calls]
        assert user_a_id in user_ids_called
        assert user_b_id in user_ids_called
        assert result is True

    # 4. Verify referral record is rewarded (via API)
    r_refs = client.get(
        f"{api_base}/users/me/referrals",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert r_refs.status_code == 200
    referrals = r_refs.json()["referrals"]
    referred_entry = next((r for r in referrals if r["id"] == user_b_id), None)
    assert referred_entry is not None
    assert referred_entry.get("status") == "rewarded"
    assert referred_entry.get("referral_bonus_granted_at") is not None
