from datetime import date, datetime
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ActivitySettings

DEFAULT_ACTIVITY_ID = "default"
DEFAULT_START_DATE = date(2026, 4, 27)
DEFAULT_DURATION_DAYS = 21


def today_local() -> date:
    return datetime.now(ZoneInfo("Asia/Shanghai")).date()


async def get_or_create_activity_settings(db: AsyncSession) -> ActivitySettings:
    result = await db.execute(
        select(ActivitySettings).where(ActivitySettings.id == DEFAULT_ACTIVITY_ID)
    )
    settings = result.scalar_one_or_none()
    if settings:
        return settings

    settings = ActivitySettings(
        id=DEFAULT_ACTIVITY_ID,
        name="晨光打卡",
        start_date=DEFAULT_START_DATE,
        duration_days=DEFAULT_DURATION_DAYS,
        is_active=True,
    )
    db.add(settings)
    await db.flush()
    await db.refresh(settings)
    return settings


def build_activity_response(settings: ActivitySettings) -> dict:
    current = today_local()
    day_offset = (current - settings.start_date).days + 1
    current_day = max(0, min(settings.duration_days, day_offset))
    progress_percent = 0.0
    if settings.duration_days > 0:
        progress_percent = round((current_day / settings.duration_days) * 100, 1)

    return {
        "id": settings.id,
        "name": settings.name,
        "start_date": settings.start_date,
        "duration_days": settings.duration_days,
        "is_active": settings.is_active,
        "current_day": current_day,
        "progress_percent": progress_percent,
    }
