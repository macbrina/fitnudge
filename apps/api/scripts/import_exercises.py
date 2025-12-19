#!/usr/bin/env python3
"""
Import Exercise Database from ExerciseDB JSON

This script imports the purchased ExerciseDB data into the Supabase database.
Run once after purchasing the exercise database to populate the exercises table.

Usage:
    cd apps/api
    poetry run python scripts/import_exercises.py
"""

import json
import sys
from pathlib import Path
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import get_supabase_client
from app.services.logger import logger


def import_exercises():
    """Import all exercises from JSON file into database"""

    # Paths
    json_path = Path(__file__).parent.parent / "data" / "exerciseData_complete.json"

    if not json_path.exists():
        print(f"❌ Error: JSON file not found at {json_path}")
        print(f"📁 Please ensure exerciseData_complete.json is in apps/api/data/")
        return False

    print("=" * 60)
    print("🏋️  EXERCISE DATABASE IMPORT")
    print("=" * 60)
    print(f"📂 Source: {json_path}")
    print(f"🗄️  Target: Supabase exercises table")
    print()

    # Load JSON
    print("📥 Loading exercise data...")
    with open(json_path, "r", encoding="utf-8") as f:
        exercises = json.load(f)

    total_exercises = len(exercises)
    print(f"✅ Loaded {total_exercises} exercises from JSON")
    print()

    # Connect to database
    print("🔌 Connecting to Supabase...")
    supabase = get_supabase_client()
    print("✅ Connected to database")
    print()

    # Check if table exists
    try:
        test_query = supabase.table("exercises").select("id").limit(1).execute()
        existing_count = len(test_query.data) if test_query.data else 0
        print(f"📊 Current exercises in database: {existing_count}")

        if existing_count > 0:
            response = input(
                f"\n⚠️  Database already has {existing_count} exercises. Clear and reimport? (y/N): "
            )
            if response.lower() != "y":
                print("❌ Import cancelled")
                return False

            print("🗑️  Deleting existing exercises...")
            # Delete all existing exercises
            supabase.table("exercises").delete().neq("id", "").execute()
            print("✅ Cleared existing exercises")
    except Exception as e:
        print(f"⚠️  Could not check existing exercises: {e}")
        print("📝 Proceeding with import...")

    print()
    print("🚀 Starting import...")
    print("─" * 60)

    # Import in batches (Supabase has limits)
    batch_size = 100
    imported_count = 0
    failed_count = 0

    for i in range(0, total_exercises, batch_size):
        batch = exercises[i : i + batch_size]
        records = []

        for exercise in batch:
            try:
                # Transform to database schema
                record = {
                    "id": exercise["id"],
                    "name": exercise["name"],
                    "body_part": exercise.get("bodyPart", ""),
                    "equipment": exercise.get("equipment", ""),
                    "target_muscle": exercise.get("target", ""),
                    "secondary_muscles": exercise.get("secondaryMuscles", []),
                    "instructions": exercise.get("instructions", []),
                    "description": exercise.get("description", ""),
                    "difficulty": exercise.get("difficulty", "beginner"),
                    "category": exercise.get("category", "strength"),
                    # MP4 Video URL (Cloudflare R2 CDN)
                    "mp4_url": f"https://media.fitnudge.app/exercises/360/{exercise['id']}.mp4",
                    "usage_count": 0,
                    "last_used_at": None,
                }
                records.append(record)
            except Exception as e:
                logger.error(f"Failed to transform exercise {exercise.get('id')}: {e}")
                failed_count += 1
                continue

        # Insert batch
        try:
            result = supabase.table("exercises").insert(records).execute()
            imported_count += len(records)

            # Progress bar
            progress = (imported_count / total_exercises) * 100
            batch_num = i // batch_size + 1
            total_batches = (total_exercises + batch_size - 1) // batch_size

            print(
                f"✅ Batch {batch_num}/{total_batches}: {imported_count}/{total_exercises} exercises ({progress:.1f}%)"
            )

        except Exception as e:
            logger.error(f"Failed to insert batch {i//batch_size + 1}: {e}")
            failed_count += len(records)
            print(f"❌ Batch {i//batch_size + 1} failed: {e}")
            continue

    # Summary
    print("─" * 60)
    print()
    print("🎉 IMPORT COMPLETE!")
    print("=" * 60)
    print(f"✅ Successfully imported: {imported_count} exercises")
    if failed_count > 0:
        print(f"❌ Failed: {failed_count} exercises")
    print(f"📊 Total in database: {imported_count}")
    print(f"🎬  MP4 videos available at 360px resolution")
    print()
    print("🔗 MP4 URL format (Cloudflare R2 CDN):")
    print(f"   https://media.fitnudge.app/exercises/360/0001.mp4")
    print()
    print("📝 Next steps:")
    print("   1. Test MP4 video access in browser")
    print("   2. Verify CDN URLs are working")
    print("=" * 60)

    return True


if __name__ == "__main__":
    try:
        success = import_exercises()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n❌ Import cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Import failed: {e}")
        logger.error(f"Exercise import failed: {e}")
        sys.exit(1)
