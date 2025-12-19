-- =====================================================
-- FIX RLS INFINITE RECURSION
-- =====================================================
-- Problem: The complex RLS policies have:
-- 1. Self-referential EXISTS (challenge_participants queries itself)
-- 2. Circular EXISTS (challenges ↔ challenge_participants)
--
-- PostgreSQL evaluates ALL policies, so even with simple policies,
-- the complex ones still cause infinite recursion.
--
-- Solution: DROP the problematic complex policies and replace with
-- simpler ones that don't have self-referential or circular EXISTS.
-- =====================================================

-- =====================================================
-- 1. CHALLENGES - Remove complex, add simple policies
-- =====================================================
-- Drop the complex policy with EXISTS on challenge_participants
DROP POLICY IF EXISTS "challenges_select" ON challenges;
DROP POLICY IF EXISTS "challenges_public_select" ON challenges;
DROP POLICY IF EXISTS "challenges_own_select" ON challenges;
DROP POLICY IF EXISTS "challenges_participant_select" ON challenges;

-- Simple policy: Users can see their own challenges
CREATE POLICY "challenges_own_select"
ON challenges FOR SELECT TO authenticated
USING (created_by = auth.uid());

-- Simple policy: Users can see public active challenges
CREATE POLICY "challenges_public_select"
ON challenges FOR SELECT TO authenticated
USING (is_public = true AND is_active = true);

-- For seeing challenges you participate in, we need a SECURITY DEFINER function
-- to bypass RLS when checking participation. Create the function first.

CREATE OR REPLACE FUNCTION public.user_participates_in_challenge(p_challenge_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM challenge_participants
        WHERE challenge_id = p_challenge_id
        AND user_id = p_user_id
    );
$$;

-- Policy using the SECURITY DEFINER function (no RLS recursion)
CREATE POLICY "challenges_participant_select"
ON challenges FOR SELECT TO authenticated
USING (public.user_participates_in_challenge(id, auth.uid()));

-- =====================================================
-- 2. CHALLENGE_PARTICIPANTS - Remove complex, add simple policies
-- =====================================================
-- Drop the complex policy with self-referential EXISTS
DROP POLICY IF EXISTS "challenge_participants_select" ON challenge_participants;
DROP POLICY IF EXISTS "challenge_participants_own_select" ON challenge_participants;
DROP POLICY IF EXISTS "challenge_participants_same_challenge_select" ON challenge_participants;
DROP POLICY IF EXISTS "challenge_participants_public_select" ON challenge_participants;

-- Simple policy: Users can see their own participation
CREATE POLICY "challenge_participants_own_select"
ON challenge_participants FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Policy: Users can see other participants in challenges they're part of
-- Uses SECURITY DEFINER function to avoid recursion
CREATE POLICY "challenge_participants_same_challenge_select"
ON challenge_participants FOR SELECT TO authenticated
USING (public.user_participates_in_challenge(challenge_id, auth.uid()));

-- Function to check if challenge is public (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_challenge_public(p_challenge_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM challenges
        WHERE id = p_challenge_id
        AND is_public = true
    );
$$;

-- Policy: Users can see participants in public challenges
CREATE POLICY "challenge_participants_public_select"
ON challenge_participants FOR SELECT TO authenticated
USING (public.is_challenge_public(challenge_id));

-- =====================================================
-- 3. CHALLENGE_CHECK_INS - Remove complex, add simple policies
-- =====================================================
DROP POLICY IF EXISTS "challenge_check_ins_select" ON challenge_check_ins;
DROP POLICY IF EXISTS "challenge_check_ins_own_select" ON challenge_check_ins;
DROP POLICY IF EXISTS "challenge_check_ins_same_challenge_select" ON challenge_check_ins;
DROP POLICY IF EXISTS "challenge_check_ins_public_select" ON challenge_check_ins;

-- Simple policy: Users can see their own check-ins
CREATE POLICY "challenge_check_ins_own_select"
ON challenge_check_ins FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Policy: Users can see check-ins in challenges they participate in
CREATE POLICY "challenge_check_ins_same_challenge_select"
ON challenge_check_ins FOR SELECT TO authenticated
USING (public.user_participates_in_challenge(challenge_id, auth.uid()));

-- Policy: Users can see check-ins in public challenges
CREATE POLICY "challenge_check_ins_public_select"
ON challenge_check_ins FOR SELECT TO authenticated
USING (public.is_challenge_public(challenge_id));

-- =====================================================
-- 4. CHALLENGE_LEADERBOARD - Remove complex, add simple policies
-- =====================================================
DROP POLICY IF EXISTS "challenge_leaderboard_select" ON challenge_leaderboard;
DROP POLICY IF EXISTS "challenge_leaderboard_participant_select" ON challenge_leaderboard;
DROP POLICY IF EXISTS "challenge_leaderboard_own_select" ON challenge_leaderboard;
DROP POLICY IF EXISTS "challenge_leaderboard_public_select" ON challenge_leaderboard;

-- Simple policy: Users can see their own leaderboard entries
CREATE POLICY "challenge_leaderboard_own_select"
ON challenge_leaderboard FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Policy: Users can see leaderboard in challenges they participate in
CREATE POLICY "challenge_leaderboard_participant_select"
ON challenge_leaderboard FOR SELECT TO authenticated
USING (public.user_participates_in_challenge(challenge_id, auth.uid()));

-- Policy: Users can see leaderboard in public challenges
CREATE POLICY "challenge_leaderboard_public_select"
ON challenge_leaderboard FOR SELECT TO authenticated
USING (public.is_challenge_public(challenge_id));

-- =====================================================
-- 5. GOALS - Ensure simple policy exists
-- =====================================================
DROP POLICY IF EXISTS "goals_own_select" ON goals;

CREATE POLICY "goals_own_select"
ON goals FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- =====================================================
-- 6. GOAL_SHARES - Simple policy for recipient
-- =====================================================
DROP POLICY IF EXISTS "goal_shares_recipient_select" ON goal_shares;

CREATE POLICY "goal_shares_recipient_select"
ON goal_shares FOR SELECT TO authenticated
USING (shared_with_user_id = auth.uid());

-- =====================================================
-- DOCUMENTATION
-- =====================================================
-- 
-- The key insight is that SECURITY DEFINER functions bypass RLS
-- when executing. So instead of:
--   EXISTS (SELECT 1 FROM challenge_participants WHERE ...)
-- which triggers RLS recursion, we use:
--   public.user_participates_in_challenge(challenge_id, auth.uid())
-- which runs with elevated privileges and doesn't trigger RLS.
--
-- This allows us to check participation without causing infinite loops.
-- =====================================================

COMMENT ON FUNCTION public.user_participates_in_challenge IS 
'SECURITY DEFINER function to check if user participates in a challenge without triggering RLS recursion';

COMMENT ON FUNCTION public.is_challenge_public IS 
'SECURITY DEFINER function to check if challenge is public without triggering RLS recursion';
