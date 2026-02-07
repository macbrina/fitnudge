#!/usr/bin/env python3
"""
Run Celery worker with platform-appropriate settings.

On Windows, uses --pool=solo to avoid PermissionError/OSError from billiard's
multiprocessing (Windows doesn't support Unix-style fork). On macOS/Linux,
uses the default prefork pool for concurrency.

Usage:
    poetry run python scripts/run_celery_worker.py
    poetry run python scripts/run_celery_worker.py --beat   # with beat
"""
import sys
import subprocess


def main() -> int:
    is_windows = sys.platform == "win32"
    cmd = [
        sys.executable,
        "-m",
        "celery",
        "-A",
        "celery_worker",
        "worker",
        "--loglevel=info",
    ]
    if is_windows:
        cmd.extend(["--pool=solo"])
        print("Running Celery worker on Windows with --pool=solo (required for stability)")
    if "--beat" in sys.argv:
        cmd.append("--beat")
    return subprocess.call(cmd)


if __name__ == "__main__":
    sys.exit(main())
