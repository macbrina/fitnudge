-- =====================================================
-- Insert Workout Music Tracks
-- =====================================================
-- Note: Update file_url and file_key placeholders after uploading to Cloudflare R2

INSERT INTO workout_music (title, artist, duration_seconds, file_url, file_key, genre, mood, sort_order) VALUES
    -- 1. Gym - The_Mountain (1:01 = 61 seconds)
    ('Gym', 'The_Mountain', 61, 
     'https://media.fitnudge.app/music/001.mp3', 
     'music/001.mp3', 
     'Beats', 'energetic', 1),
    
    -- 2. Sport Workout Gym Music - lkoliks (1:27 = 87 seconds)
    ('Sport Workout Gym Music', 'lkoliks', 87, 
     'https://media.fitnudge.app/music/002.mp3', 
     'music/002.mp3', 
     'Rock', 'intense', 2),
    
    -- 3. Sport Workout Gym Music - original_soundtrack (8:00 = 480 seconds)
    ('Sport Workout Gym Music', 'original_soundtrack', 480, 
     'https://media.fitnudge.app/music/003.mp3', 
     'music/003.mp3', 
     'Beats', 'energetic', 3),
    
    -- 4. Gym Workout Sport Music - Poradovskyi (1:54 = 114 seconds)
    ('Gym Workout Sport Music', 'Poradovskyi', 114, 
     'https://media.fitnudge.app/music/004.mp3', 
     'music/004.mp3', 
     'Beats', 'energetic', 4),
    
    -- 5. Sport Gym Workout Music - HitsLab (1:50 = 110 seconds)
    ('Sport Gym Workout Music', 'HitsLab', 110, 
     'https://media.fitnudge.app/music/005.mp3', 
     'music/005.mp3', 
     'Rock', 'intense', 5),
    
    -- 6. Gym Workout Sport Music - lNPLUSMUSIC (2:18 = 138 seconds)
    ('Gym Workout Sport Music', 'lNPLUSMUSIC', 138, 
     'https://media.fitnudge.app/music/006.mp3', 
     'music/006.mp3', 
     'Beats', 'energetic', 6),
    
    -- 7. Sport Gym Workout Music - lNPLUSMUSIC (1:39 = 99 seconds)
    ('Sport Gym Workout Music', 'lNPLUSMUSIC', 99, 
     'https://media.fitnudge.app/music/007.mp3', 
     'music/007.mp3', 
     'Upbeat', 'motivational', 7),
    
    -- 8. Workout Gym Sport Music - lkoliks (2:03 = 123 seconds)
    ('Workout Gym Sport Music', 'lkoliks', 123, 
     'https://media.fitnudge.app/music/008.mp3', 
     'music/008.mp3', 
     'Hard rock', 'intense', 8),
    
    -- 9. Gym Workout Sport Music - MFCC (0:49 = 49 seconds)
    ('Gym Workout Sport Music', 'MFCC', 49, 
     'https://media.fitnudge.app/music/009.mp3', 
     'music/009.mp3', 
     'Upbeat', 'motivational', 9),
    
    -- 10. Sport Gym Workout Music - lkoliks (2:07 = 127 seconds)
    ('Sport Gym Workout Music', 'lkoliks', 127, 
     'https://media.fitnudge.app/music/010.mp3', 
     'music/010.mp3', 
     'Rock', 'intense', 10),
    
    -- 11. Gym Workout Sport Music - HitsLab (1:35 = 95 seconds)
    ('Gym Workout Sport Music', 'HitsLab', 95, 
     'https://media.fitnudge.app/music/011.mp3', 
     'music/011.mp3', 
     'Rock', 'intense', 11),
    
    -- 12. Sport Workout Gym Music - BackgroundMusicForVideo (1:18 = 78 seconds)
    ('Sport Workout Gym Music', 'BackgroundMusicForVideo', 78, 
     'https://media.fitnudge.app/music/012.mp3', 
     'music/012.mp3', 
     'Rock', 'intense', 12),
    
    -- 13. Gym Workout Sport Music - BackgroundMusicForVideo (0:58 = 58 seconds)
    ('Gym Workout Sport Music', 'BackgroundMusicForVideo', 58, 
     'https://media.fitnudge.app/music/013.mp3', 
     'music/013.mp3', 
     'Action', 'intense', 13),
    
    -- 14. Sport Gym Workout Music - BackgroundMusicForVideo (1:49 = 109 seconds)
    ('Sport Gym Workout Music', 'BackgroundMusicForVideo', 109, 
     'https://media.fitnudge.app/music/014.mp3', 
     'music/014.mp3', 
     'Rock', 'intense', 14),
    
    -- 15. Sport Rock Gym Workout - Sound4Stock (1:34 = 94 seconds)
    ('Sport Rock Gym Workout', 'Sound4Stock', 94, 
     'https://media.fitnudge.app/music/015.mp3', 
     'music/015.mp3', 
     'Action', 'intense', 15),
    
    -- 16. Sport Gym Workout Music - MFCC (1:53 = 113 seconds)
    ('Sport Gym Workout Music', 'MFCC', 113, 
     'https://media.fitnudge.app/music/016.mp3', 
     'music/016.mp3', 
     'Rock', 'intense', 16),
    
    -- 17. Sports Gym Fitness Synthwave Phonk Music - Top-Flow (2:17 = 137 seconds)
    ('Sports Gym Fitness Synthwave Phonk Music', 'Top-Flow', 137, 
     'https://media.fitnudge.app/music/017.mp3', 
     'music/017.mp3', 
     'Synthwave', 'energetic', 17),
    
    -- 18. Gym - chill_background (2:42 = 162 seconds)
    ('Gym', 'chill_background', 162, 
     'https://media.fitnudge.app/music/018.mp3', 
     'music/018.mp3', 
     'Rock', 'chill', 18),
    
    -- 19. Gym - Sport Gym Workout Music - lNPLUSMUSIC (1:28 = 88 seconds)
    ('Gym - Sport Gym Workout Music', 'lNPLUSMUSIC', 88, 
     'https://media.fitnudge.app/music/019.mp3', 
     'music/019.mp3', 
     'Rock', 'intense', 19),
    
    -- 20. Sport Gym Workout Music - original_soundtrack (1:09 = 69 seconds)
    ('Sport Gym Workout Music', 'original_soundtrack', 69, 
     'https://media.fitnudge.app/music/020.mp3', 
     'music/020.mp3', 
     'Rock', 'intense', 20);

-- Summary: 20 tracks inserted
-- Total duration: ~35 minutes
-- Moods: energetic (5), intense (12), motivational (2), chill (1)

