-- =====================================================
-- Referrals table - event log for referral conversions
-- Replaces users.referral_bonus_granted_at for clean per-referral tracking
-- =====================================================

CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'subscribed', 'processing', 'rewarded', 'failed')),
  bonus_days_referrer INTEGER DEFAULT 7,
  bonus_days_referred INTEGER DEFAULT 7,
  rewarded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_referrals_referred_user ON referrals(referred_user_id);
CREATE INDEX idx_referrals_referrer ON referrals(referrer_user_id);
CREATE INDEX idx_referrals_status ON referrals(status);

-- Backfill: create referral rows for existing referred users
INSERT INTO referrals (referrer_user_id, referred_user_id, status, bonus_days_referrer, bonus_days_referred, rewarded_at, created_at)
SELECT
  referred_by_user_id,
  id,
  CASE WHEN referral_bonus_granted_at IS NOT NULL THEN 'rewarded' ELSE 'pending' END,
  7,
  7,
  referral_bonus_granted_at,
  created_at
FROM users
WHERE referred_by_user_id IS NOT NULL
ON CONFLICT (referred_user_id) DO NOTHING;

-- RLS: referrers can see their own referrals
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY referrals_select_own ON referrals
  FOR SELECT TO authenticated
  USING (referrer_user_id = get_user_id_from_auth());

-- Drop deprecated column
ALTER TABLE users DROP COLUMN IF EXISTS referral_bonus_granted_at;

-- Add 'processing' to referrals status (for claim-before-grant workflow)
ALTER TABLE referrals DROP CONSTRAINT IF EXISTS referrals_status_check;
ALTER TABLE referrals ADD CONSTRAINT referrals_status_check
  CHECK (status IN ('pending', 'subscribed', 'processing', 'rewarded', 'failed'));

-- Trigger for updated_at (update_updated_at_column from 001_initial_schema)
DROP TRIGGER IF EXISTS update_referrals_updated_at ON referrals;
CREATE TRIGGER update_referrals_updated_at
  BEFORE UPDATE ON referrals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RPC for atomic referral claim: sets status=processing (not rewarded until grant succeeds)
-- Allows reclaim if status=processing AND updated_at older than 15 min (stuck recovery)
CREATE OR REPLACE FUNCTION claim_referral_for_reward(
  p_referred_user_id UUID,
  p_bonus_days_referrer INT,
  p_bonus_days_referred INT
)
RETURNS TABLE(id UUID, referred_user_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE referrals
  SET status = 'processing',
      bonus_days_referrer = p_bonus_days_referrer,
      bonus_days_referred = p_bonus_days_referred,
      updated_at = NOW()
  WHERE referrals.referred_user_id = p_referred_user_id
    AND (
      referrals.status IN ('pending', 'subscribed', 'failed')
      OR (referrals.status = 'processing' AND referrals.updated_at < NOW() - INTERVAL '15 minutes')
    )
  RETURNING referrals.id, referrals.referred_user_id;
END;
$$;

-- Realtime: ReferralScreen uses realtime to update when a referral status changes (pending -> rewarded)
ALTER PUBLICATION supabase_realtime ADD TABLE referrals;
