#!/usr/bin/env python3
"""
Test script for catchup_missing_checkins function.

Usage:
    poetry run python test_catchup.py 2026-01-20 2026-01-22
    poetry run python test_catchup.py 2026-01-20  # defaults to yesterday
"""

import sys
from datetime import datetime, timedelta
from app.core.database import get_supabase_client

def test_catchup_missing_checkins(start_date: str, end_date: str | None = None):
    """Test the catchup_missing_checkins PostgreSQL function."""
    supabase = get_supabase_client()
    
    # If end_date not provided, default to yesterday
    if not end_date:
        yesterday = (datetime.utcnow() - timedelta(days=1)).date()
        end_date = yesterday.isoformat()
    
    print(f"Testing catchup_missing_checkins:")
    print(f"  Start date: {start_date}")
    print(f"  End date: {end_date}")
    print()
    
    try:
        # Call the PostgreSQL function
        result = supabase.rpc(
            "catchup_missing_checkins",
            {
                "p_start_date": start_date,
                "p_end_date": end_date,
            },
        ).execute()
        
        results = result.data if result.data else []
        
        if not results:
            print("No results returned (no check-ins created or all dates already had check-ins)")
            return
        
        print(f"Results ({len(results)} dates processed):")
        print("-" * 60)
        total_inserted = 0
        
        for row in results:
            date_str = row.get("out_date") or row.get("date", "N/A")
            inserted = row.get("inserted_count", 0)
            total_goals = row.get("total_goals", 0)
            total_inserted += inserted
            
            print(f"  {date_str}: {inserted}/{total_goals} check-ins created")
        
        print("-" * 60)
        print(f"Total check-ins created: {total_inserted}")
        print()
        print("✅ Success! Check-ins created (they will be marked as 'missed' by the hourly task)")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: poetry run python test_catchup.py <start_date> [end_date]")
        print("Example: poetry run python test_catchup.py 2026-01-20 2026-01-22")
        print("Example: poetry run python test_catchup.py 2026-01-20  # defaults to yesterday")
        sys.exit(1)
    
    start_date = sys.argv[1]
    end_date = sys.argv[2] if len(sys.argv) > 2 else None
    
    test_catchup_missing_checkins(start_date, end_date)
