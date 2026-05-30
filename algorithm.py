"""
algorithm.py — Priority Score Engine

Single source of truth for all priority calculations in the Intelligent Task
Scheduling and Decision Support application. This module is shared by:
  - The daily notification scheduler (scheduler.py)
  - The notifications REST API (routes.py)
  - Any other backend component that needs consistent priority scoring

The formulas here mirror the JavaScript implementation in static/script.js so
that scores displayed in notification emails match scores shown in the UI.
"""

from math import ceil
from datetime import datetime


# ---------------------------------------------------------------------------
# Constants (must match script.js)
# ---------------------------------------------------------------------------
W_U = 0.3       # Weight for urgency
W_I = 0.4       # Weight for importance
W_S = 0.3       # Weight for severity
ALPHA = 2       # Deadline-proximity multiplier coefficient
MAX_RAW = 30    # Maximum possible raw score (used for normalization)


def calculate_priority_score(urgency, importance, severity, deadline_str):
    """
    Calculate the priority score for a task.

    Args:
        urgency (int):       Urgency rating, 1–10.
        importance (int):    Importance rating, 1–10.
        severity (int):      Severity rating, 1–10.
        deadline_str (str):  Deadline as "YYYY-MM-DD", "YYYY-MM-DDTHH:MM",
                             "YYYY-MM-DDTHH:MM:SS", or with a trailing "Z".

    Returns:
        dict with keys:
            "score"          (float)  – raw weighted priority score (≥ 0)
            "days_remaining" (int)    – ceiling of days until deadline
            "total_hours"    (float)  – fractional hours until deadline
            "normalized"     (float)  – score scaled to [1.0, 10.0]

    On any ValueError from date parsing, returns the safe fallback:
        {"score": 0, "days_remaining": 0, "total_hours": 0.0, "normalized": 1.0}
    """
    try:
        # Normalise the string so datetime.fromisoformat() can handle it.
        # Strip a trailing "Z" (UTC marker) and pad to at least HH:MM if needed.
        ds = deadline_str.strip()
        if ds.endswith("Z"):
            ds = ds[:-1]

        if "T" in ds:
            deadline = datetime.fromisoformat(ds)
        else:
            # Date-only: treat as midnight on that day
            deadline = datetime.fromisoformat(ds + "T00:00:00")

    except (ValueError, AttributeError):
        return {"score": 0, "days_remaining": 0, "total_hours": 0.0, "normalized": 1.0}

    now = datetime.now()
    diff_seconds = (deadline - now).total_seconds()
    total_hours = diff_seconds / 3600.0
    days_remaining = total_hours / 24.0

    # Clamp to avoid a negative multiplier for past deadlines
    clamped_days = max(0.0, days_remaining)

    # Weighted base score
    base_score = (W_U * urgency) + (W_I * importance) + (W_S * severity)

    # Deadline-proximity multiplier — increases as deadline approaches
    multiplier = 1 + ALPHA / (clamped_days + 1)

    score = base_score * multiplier

    # Normalize raw score to [1.0, 10.0]
    normalized = 1 + (score / MAX_RAW) * 9
    normalized = min(10.0, max(1.0, normalized))

    return {
        "score": round(score, 2),
        "days_remaining": ceil(days_remaining),
        "total_hours": total_hours,
        "normalized": round(normalized, 1),
    }


def get_eisenhower_quadrant(urgency, importance):
    """
    Classify a task into one of the four Eisenhower quadrants.

    Thresholds mirror the inline classification logic in renderSchedule()
    in static/script.js:
        urgency   >= 6  →  "urgent"
        importance >= 6  →  "important"

    Args:
        urgency (int):    Urgency rating, 1–10.
        importance (int): Importance rating, 1–10.

    Returns:
        str: One of "Q1_DO_FIRST", "Q2_SCHEDULE", "Q3_DELEGATE",
             or "Q4_ELIMINATE".
    """
    urgent = urgency >= 6
    important = importance >= 6

    if urgent and important:
        return "Q1_DO_FIRST"
    elif not urgent and important:
        return "Q2_SCHEDULE"
    elif urgent and not important:
        return "Q3_DELEGATE"
    else:
        return "Q4_ELIMINATE"
