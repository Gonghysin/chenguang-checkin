import json
import logging
from datetime import datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import APIRouter, UploadFile, File, Form, Request, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import CheckinAttachment, CheckinItem, DailyCheckin
from app.services.oss import get_oss_client
from app.services.activity import build_activity_response, get_or_create_activity_settings
from app.services.rankings import build_ranking_rows, public_ranking_payload
from app.schemas import ActivitySettingsOut, DailyCheckinOut, PublicRankingOut, PublicUserStatsOut, SubmissionResult

router = APIRouter(tags=["submissions"])
logger = logging.getLogger(__name__)

CHINA_TZ = ZoneInfo("Asia/Shanghai")
MORNING_START = time(6, 30, 0)
MORNING_END = time(7, 40, 0)

ITEM_LABELS = {
    "listening": "听力",
    "reading": "阅读",
    "writing": "英语作文",
    "vocabulary": "背单词",
    "running": "跑步",
}


@router.get("/api/activity", response_model=ActivitySettingsOut)
async def get_activity(db: AsyncSession = Depends(get_db)):
    settings = await get_or_create_activity_settings(db)
    await db.commit()
    return build_activity_response(settings)


@router.get("/api/submissions/today", response_model=DailyCheckinOut | None)
async def get_today_submission(
    student_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    if not student_id.strip():
        raise HTTPException(status_code=400, detail="学号不能为空")

    result = await db.execute(
        select(DailyCheckin)
        .where(DailyCheckin.student_id == student_id.strip())
        .where(DailyCheckin.checkin_date == datetime.now(CHINA_TZ).date())
        .options(selectinload(DailyCheckin.items).selectinload(CheckinItem.attachments))
    )
    checkin = result.scalar_one_or_none()
    if not checkin:
        return None

    checkin.items.sort(key=lambda item: list(ITEM_LABELS).index(item.item_type))
    return DailyCheckinOut.model_validate(checkin)


@router.get("/api/rankings", response_model=list[PublicRankingOut])
async def get_public_rankings(db: AsyncSession = Depends(get_db)):
    activity = await get_or_create_activity_settings(db)
    end_date = activity.start_date + timedelta(days=activity.duration_days - 1)
    result = await db.execute(
        select(DailyCheckin)
        .where(DailyCheckin.checkin_date >= activity.start_date)
        .where(DailyCheckin.checkin_date <= end_date)
        .options(selectinload(DailyCheckin.items))
    )
    rows = build_ranking_rows(result.scalars().all())
    rows.sort(
        key=lambda row: (
            -row["total_points"],
            -row["base_points"],
            -row["total_volume"],
            -row["consecutive_days"],
            row["name"],
        )
    )
    return [PublicRankingOut(**public_ranking_payload(row)) for row in rows]


@router.get("/api/submissions/me", response_model=PublicUserStatsOut | None)
async def get_my_stats(
    student_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    if not student_id.strip():
        raise HTTPException(status_code=400, detail="学号不能为空")

    activity = await get_or_create_activity_settings(db)
    end_date = activity.start_date + timedelta(days=activity.duration_days - 1)
    result = await db.execute(
        select(DailyCheckin)
        .where(DailyCheckin.student_id == student_id.strip())
        .where(DailyCheckin.checkin_date >= activity.start_date)
        .where(DailyCheckin.checkin_date <= end_date)
        .options(selectinload(DailyCheckin.items).selectinload(CheckinItem.attachments))
    )
    checkins = result.scalars().all()
    if not checkins:
        return None

    rows = build_ranking_rows(checkins)
    summary = public_ranking_payload(rows[0])
    latest = max(checkins, key=lambda checkin: checkin.checkin_date)
    latest.items.sort(key=lambda item: list(ITEM_LABELS).index(item.item_type))
    return PublicUserStatsOut(**summary, latest_checkin=DailyCheckinOut.model_validate(latest))


@router.get("/api/submissions/attachments/{attachment_id}/download")
async def download_my_attachment(
    attachment_id: str,
    student_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    if not student_id.strip():
        raise HTTPException(status_code=400, detail="学号不能为空")

    result = await db.execute(
        select(CheckinAttachment)
        .join(CheckinItem, CheckinAttachment.item_id == CheckinItem.id)
        .join(DailyCheckin, CheckinItem.checkin_id == DailyCheckin.id)
        .where(CheckinAttachment.id == attachment_id)
        .where(DailyCheckin.student_id == student_id.strip())
        .where(DailyCheckin.checkin_date == datetime.now(CHINA_TZ).date())
    )
    attachment = result.scalar_one_or_none()
    if not attachment:
        raise HTTPException(status_code=404, detail="附件不存在")

    return {"download_url": get_oss_client().get_presigned_url(attachment.oss_key, expire=3600)}


@router.post("/api/submissions", response_model=SubmissionResult, status_code=status.HTTP_201_CREATED)
async def create_submission(
    request: Request,
    name: str = Form(...),
    student_id: str = Form(...),
    items_payload: str = Form(...),
    attachment_item_types: list[str] | None = Form(None),
    attachments: list[UploadFile] | None = File(None),
    db: AsyncSession = Depends(get_db),
):
    if not name.strip() or not student_id.strip():
        raise HTTPException(status_code=400, detail="姓名和学号不能为空")

    item_inputs = _parse_items_payload(items_payload)
    logger.info(
        "checkin_submit_start student_id=%s item_types=%s attachment_count=%s",
        student_id.strip(),
        ",".join(item_inputs.keys()),
        len(attachments or []),
    )

    now = datetime.now(CHINA_TZ)
    checkin_date = now.date()

    result = await db.execute(
        select(DailyCheckin)
        .where(DailyCheckin.student_id == student_id.strip())
        .where(DailyCheckin.checkin_date == checkin_date)
        .options(selectinload(DailyCheckin.items).selectinload(CheckinItem.attachments))
    )
    checkin = result.scalar_one_or_none()

    if not checkin:
        checkin = DailyCheckin(
            name=name.strip(),
            student_id=student_id.strip(),
            checkin_date=checkin_date,
            first_submitted_at=now,
            ip_address=request.client.host if request.client else None,
        )
        db.add(checkin)
        await db.flush()
    else:
        checkin.name = name.strip()
        checkin.ip_address = request.client.host if request.client else checkin.ip_address

    existing_items_result = await db.execute(
        select(CheckinItem).where(CheckinItem.checkin_id == checkin.id)
    )
    item_by_type = {
        item.item_type: item for item in existing_items_result.scalars().all()
    }
    existing_item_types = set(item_by_type)
    _validate_attachments(
        item_inputs,
        attachment_item_types or [],
        attachments or [],
        required_item_types=set(item_inputs) - existing_item_types,
    )
    for item_type, raw_values in item_inputs.items():
        item = item_by_type.get(item_type)
        if not item:
            item = CheckinItem(checkin_id=checkin.id, item_type=item_type)
            db.add(item)
            await db.flush()
            item_by_type[item_type] = item

        values = _evaluate_item(item_type, raw_values)
        for field_name, value in values.items():
            setattr(item, field_name, value)

    await db.flush()
    await _store_attachments(db, item_by_type, attachment_item_types or [], attachments or [])
    await db.flush()

    all_items = list(item_by_type.values())
    base_points = sum(item.points for item in all_items)
    total_volume = round(sum(item.volume_score for item in all_items), 4)
    has_valid_item = base_points > 0
    if has_valid_item and checkin.first_valid_at is None:
        checkin.first_valid_at = now
        checkin.earned_morning_bonus = MORNING_START <= now.time() <= MORNING_END

    checkin.base_points = min(base_points, 5)
    checkin.total_volume = total_volume
    bonus_points = 1 if checkin.earned_morning_bonus and checkin.base_points > 0 else 0
    checkin.total_points = min(checkin.base_points + bonus_points, 6)
    checkin.updated_at = now

    await db.commit()
    saved = await _load_checkin(db, checkin.id)
    logger.info(
        "checkin_submit_success checkin_id=%s student_id=%s base_points=%s total_points=%s",
        saved.id,
        saved.student_id,
        saved.base_points,
        saved.total_points,
    )
    return {
        "checkin": DailyCheckinOut.model_validate(saved),
        "message": "打卡已保存",
    }


def _parse_items_payload(items_payload: str) -> dict[str, dict[str, Any]]:
    try:
        parsed = json.loads(items_payload)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="打卡项目数据格式错误")

    if not isinstance(parsed, dict) or not parsed:
        raise HTTPException(status_code=400, detail="请至少选择一个打卡项目")

    item_inputs: dict[str, dict[str, Any]] = {}
    for item_type, raw_values in parsed.items():
        if item_type not in ITEM_LABELS:
            raise HTTPException(status_code=400, detail="包含未知打卡项目")
        if not isinstance(raw_values, dict):
            raise HTTPException(status_code=400, detail=f"{ITEM_LABELS[item_type]}数据格式错误")
        item_inputs[item_type] = raw_values

    return item_inputs


def _validate_attachments(
    item_inputs: dict[str, dict[str, Any]],
    attachment_item_types: list[str],
    attachments: list[UploadFile],
    required_item_types: set[str] | None = None,
) -> None:
    if len(attachment_item_types) != len(attachments):
        raise HTTPException(status_code=400, detail="附件和项目类型数量不匹配")

    attached_types = set()
    for item_type, attachment in zip(attachment_item_types, attachments):
        if item_type not in ITEM_LABELS:
            raise HTTPException(status_code=400, detail="附件包含未知项目类型")
        if not attachment.filename:
            raise HTTPException(status_code=400, detail="附件文件名不能为空")
        attached_types.add(item_type)

    required_types = required_item_types if required_item_types is not None else set(item_inputs)
    missing = [ITEM_LABELS[item_type] for item_type in required_types if item_type not in attached_types]
    if missing:
        raise HTTPException(status_code=400, detail=f"请为{', '.join(missing)}上传对应截图")


def _int_value(values: dict[str, Any], key: str) -> int:
    try:
        value = int(values.get(key, 0))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="项目完成量必须是数字")
    if value < 0:
        raise HTTPException(status_code=400, detail="项目完成量不能为负数")
    return value


def _float_value(values: dict[str, Any], key: str) -> float:
    try:
        value = float(values.get(key, 0))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="项目完成量必须是数字")
    if value < 0:
        raise HTTPException(status_code=400, detail="项目完成量不能为负数")
    return value


def _evaluate_item(item_type: str, values: dict[str, Any]) -> dict[str, Any]:
    data: dict[str, Any] = {
        "listening_questions": None,
        "reading_articles": None,
        "reading_questions": None,
        "writing_words": None,
        "vocabulary_words": None,
        "running_distance_km": None,
        "running_pace_min_per_km": None,
    }

    if item_type == "listening":
        questions = _int_value(values, "listening_questions")
        is_valid = questions >= 10
        data.update(
            listening_questions=questions,
            volume_score=questions / 10 if questions else 0,
        )
    elif item_type == "reading":
        articles = _int_value(values, "reading_articles")
        questions = _int_value(values, "reading_questions")
        is_valid = articles >= 2 and questions >= 10
        data.update(
            reading_articles=articles,
            reading_questions=questions,
            volume_score=min(articles / 2 if articles else 0, questions / 10 if questions else 0),
        )
    elif item_type == "writing":
        words = _int_value(values, "writing_words")
        is_valid = words >= 100
        data.update(writing_words=words, volume_score=words / 100 if words else 0)
    elif item_type == "vocabulary":
        words = _int_value(values, "vocabulary_words")
        is_valid = words >= 20
        data.update(vocabulary_words=words, volume_score=words / 20 if words else 0)
    else:
        distance = _float_value(values, "running_distance_km")
        pace = _float_value(values, "running_pace_min_per_km")
        is_valid = distance >= 2 and 0 < pace <= 10
        data.update(
            running_distance_km=distance,
            running_pace_min_per_km=pace,
            volume_score=distance / 2 if is_valid else 0,
        )

    data["is_valid"] = is_valid
    data["points"] = 1 if is_valid else 0
    return data


async def _store_attachments(
    db: AsyncSession,
    item_by_type: dict[str, CheckinItem],
    attachment_item_types: list[str],
    attachments: list[UploadFile],
) -> None:
    for item_type, attachment in zip(attachment_item_types, attachments):
        item = item_by_type[item_type]
        logger.info(
            "attachment_upload_start item_type=%s filename=%s content_type=%s",
            item_type,
            attachment.filename,
            attachment.content_type,
        )
        file_bytes = await attachment.read()
        if not file_bytes:
            raise HTTPException(status_code=400, detail=f"{attachment.filename} 是空文件")

        try:
            upload_result = get_oss_client().upload_file(file_bytes, attachment.filename or "attachment")
        except Exception:
            logger.exception(
                "attachment_upload_failed item_type=%s filename=%s size=%s",
                item_type,
                attachment.filename,
                len(file_bytes),
            )
            raise
        logger.info(
            "attachment_upload_success item_type=%s filename=%s size=%s",
            item_type,
            attachment.filename,
            len(file_bytes),
        )
        db.add(
            CheckinAttachment(
                item_id=item.id,
                item_type=item_type,
                file_name=attachment.filename or "attachment",
                file_url=upload_result["file_url"],
                file_size=len(file_bytes),
                file_type=attachment.content_type or "application/octet-stream",
                oss_key=upload_result["oss_key"],
            )
        )


async def _load_checkin(db: AsyncSession, checkin_id: str) -> DailyCheckin:
    result = await db.execute(
        select(DailyCheckin)
        .where(DailyCheckin.id == checkin_id)
        .options(selectinload(DailyCheckin.items).selectinload(CheckinItem.attachments))
    )
    checkin = result.scalar_one()
    checkin.items.sort(key=lambda item: list(ITEM_LABELS).index(item.item_type))
    return checkin
