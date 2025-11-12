from datetime import datetime, timezone
from typing import Callable


def get_utc_now() -> datetime:
    """Get current UTC datetime - use this instead of deprecated datetime.utcnow()"""
    return datetime.now(timezone.utc)
