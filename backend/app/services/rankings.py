from datetime import date, timedelta
from typing import Any

from app.models import DailyCheckin


def build_ranking_rows(checkins: list[DailyCheckin]) -> list[dict[str, Any]]:
    grouped: dict[str, dict[str, Any]] = {}
    valid_dates_by_student: dict[str, set[date]] = {}

    for checkin in checkins:
        row = grouped.setdefault(
            checkin.student_id,
            {
                "name": checkin.name,
                "student_id": checkin.student_id,
                "total_points": 0,
                "base_points": 0,
                "morning_bonus_count": 0,
                "total_volume": 0.0,
                "valid_days": 0,
                "consecutive_days": 0,
                "listening_count": 0,
                "reading_count": 0,
                "writing_count": 0,
                "vocabulary_count": 0,
                "speaking_count": 0,
                "running_count": 0,
                "last_updated_at": None,
            },
        )
        row["name"] = checkin.name
        row["total_points"] += checkin.total_points
        row["base_points"] += checkin.base_points
        row["morning_bonus_count"] += 1 if checkin.earned_morning_bonus and checkin.base_points > 0 else 0
        row["total_volume"] += checkin.total_volume
        if checkin.base_points > 0:
            row["valid_days"] += 1
            valid_dates_by_student.setdefault(checkin.student_id, set()).add(checkin.checkin_date)
        if row["last_updated_at"] is None or checkin.updated_at > row["last_updated_at"]:
            row["last_updated_at"] = checkin.updated_at
        for item in checkin.items:
            if item.is_valid:
                row[f"{item.item_type}_count"] += 1

    for student_id, valid_dates in valid_dates_by_student.items():
        grouped[student_id]["consecutive_days"] = count_latest_streak(valid_dates)

    for row in grouped.values():
        row["total_volume"] = round(row["total_volume"], 4)
    return list(grouped.values())


def count_latest_streak(valid_dates: set[date]) -> int:
    if not valid_dates:
        return 0
    cursor = max(valid_dates)
    streak = 0
    while cursor in valid_dates:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def public_ranking_payload(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "name": row["name"],
        "total_points": row["total_points"],
        "base_points": row["base_points"],
        "morning_bonus_count": row["morning_bonus_count"],
        "total_volume": row["total_volume"],
        "valid_days": row["valid_days"],
        "consecutive_days": row["consecutive_days"],
        "listening_count": row["listening_count"],
        "reading_count": row["reading_count"],
        "writing_count": row["writing_count"],
        "vocabulary_count": row["vocabulary_count"],
        "speaking_count": row["speaking_count"],
        "running_count": row["running_count"],
    }
