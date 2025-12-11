-- =====================================================
-- Update biggest_challenge options to match onboarding UI
-- =====================================================

ALTER TABLE user_fitness_profiles
    DROP CONSTRAINT IF EXISTS user_fitness_profiles_biggest_challenge_check;

ALTER TABLE user_fitness_profiles
    ADD CONSTRAINT user_fitness_profiles_biggest_challenge_check
    CHECK (
        biggest_challenge IN (
            'staying_consistent',
            'getting_started',
            'time_management',
            'lack_of_knowledge',
            'lack_of_motivation',
            'not_knowing_what_to_do',
            'consistency',
            'accountability',
            'injury_concerns'
        )
    );

