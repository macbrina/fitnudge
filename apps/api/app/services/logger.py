import logging
import sys
from typing import Optional

try:
    # Optional PostHog integration for error logs
    from app.core.analytics import (
        capture_exception as posthog_capture_exception,
        track_event as posthog_track_event,
        initialize_posthog,
    )
except Exception:
    posthog_capture_exception = None
    posthog_track_event = None
    initialize_posthog = None


def _configure_logger() -> logging.Logger:
    logger = logging.getLogger("fitnudge.api")
    if not logger.handlers:
        logger.setLevel(logging.INFO)
        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter(
            fmt="%(asctime)s %(levelname)s [%(name)s] %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        logger.propagate = False

        # Attach PostHog error handler if available
        if initialize_posthog is not None:
            try:
                initialize_posthog()
                logger.addHandler(_PostHogErrorHandler())
            except Exception:
                # If analytics init fails, continue with stdout logging only
                pass
    return logger


logger = _configure_logger()


class _PostHogErrorHandler(logging.Handler):
    """Sends ERROR/CRITICAL logs to PostHog for observability."""

    def __init__(self, level: int = logging.ERROR) -> None:
        super().__init__(level=level)

    def emit(self, record: logging.LogRecord) -> None:
        try:
            if posthog_capture_exception is None and posthog_track_event is None:
                return

            properties = {
                "logger_name": record.name,
                "level": record.levelname,
                "message": record.getMessage(),
                "module": record.module,
                "funcName": record.funcName,
                "lineno": record.lineno,
            }

            # If an actual exception is attached, capture it; otherwise send as event
            if record.exc_info and posthog_capture_exception is not None:
                exc_type, exc_value, _ = record.exc_info
                exc: Optional[Exception] = (
                    exc_value
                    if isinstance(exc_value, Exception)
                    else Exception(record.getMessage())
                )
                posthog_capture_exception(exc, properties=properties)
            elif posthog_track_event is not None:
                posthog_track_event("server_log_error", properties=properties)
        except Exception:
            # Never raise from a logging handler
            pass
