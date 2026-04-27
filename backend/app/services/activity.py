from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.engine import Connection
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ActivitySettings

DEFAULT_ACTIVITY_ID = "default"
DEFAULT_START_DATE = date(2026, 4, 27)
DEFAULT_DURATION_DAYS = 21
DEFAULT_CHECKIN_START_TIME = "06:00"
DEFAULT_CHECKIN_END_TIME = "04:00"
CHINA_TZ = ZoneInfo("Asia/Shanghai")


def today_local() -> date:
    return datetime.now(CHINA_TZ).date()


def parse_time_value(value: str) -> time:
    return datetime.strptime(value, "%H:%M").time()


def checkin_window_label(settings: ActivitySettings) -> str:
    return f"{settings.checkin_start_time} 至 {settings.checkin_end_time}"


def get_checkin_date_at(settings: ActivitySettings, moment: datetime) -> date:
    local_moment = moment.astimezone(CHINA_TZ)
    start = parse_time_value(settings.checkin_start_time)
    end = parse_time_value(settings.checkin_end_time)
    current = local_moment.time()

    if start <= end:
        return local_moment.date()

    if current <= end:
        return local_moment.date() - timedelta(days=1)
    return local_moment.date()


def is_within_checkin_window(settings: ActivitySettings, moment: datetime) -> bool:
    start = parse_time_value(settings.checkin_start_time)
    end = parse_time_value(settings.checkin_end_time)
    current = moment.astimezone(CHINA_TZ).time()

    if start <= end:
        return start <= current <= end
    return current >= start or current <= end


def ensure_activity_settings_columns(connection: Connection) -> None:
    if connection.dialect.name == "sqlite":
        rows = connection.exec_driver_sql("PRAGMA table_info(activity_settings)").fetchall()
        columns = {row[1] for row in rows}
        if "checkin_start_time" not in columns:
            connection.exec_driver_sql(
                "ALTER TABLE activity_settings "
                "ADD COLUMN checkin_start_time VARCHAR(5) NOT NULL DEFAULT '06:00'"
            )
        if "checkin_end_time" not in columns:
            connection.exec_driver_sql(
                "ALTER TABLE activity_settings "
                "ADD COLUMN checkin_end_time VARCHAR(5) NOT NULL DEFAULT '04:00'"
            )
        return

    if connection.dialect.name == "postgresql":
        connection.exec_driver_sql(
            "ALTER TABLE activity_settings "
            "ADD COLUMN IF NOT EXISTS checkin_start_time VARCHAR(5) NOT NULL DEFAULT '06:00'"
        )
        connection.exec_driver_sql(
            "ALTER TABLE activity_settings "
            "ADD COLUMN IF NOT EXISTS checkin_end_time VARCHAR(5) NOT NULL DEFAULT '04:00'"
        )


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
        checkin_start_time=DEFAULT_CHECKIN_START_TIME,
        checkin_end_time=DEFAULT_CHECKIN_END_TIME,
        is_active=True,
    )
    db.add(settings)
    await db.flush()
    await db.refresh(settings)
    return settings


def build_activity_response(settings: ActivitySettings) -> dict:
    current = get_checkin_date_at(settings, datetime.now(CHINA_TZ))
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
        "checkin_start_time": settings.checkin_start_time,
        "checkin_end_time": settings.checkin_end_time,
        "is_active": settings.is_active,
        "current_day": current_day,
        "progress_percent": progress_percent,
    }
