from datetime import timedelta

from fastapi import APIRouter, Response, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, asc, func
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Admin, CheckinAttachment, CheckinItem, DailyCheckin
from app.schemas import (
    AdminParticipantDetail,
    AdminParticipantSummary,
    ActivitySettingsOut,
    ActivitySettingsUpdate,
    AdminLogin,
    AdminOut,
    DailyCheckinOut,
    RankingOut,
)
from app.services.activity import build_activity_response, get_or_create_activity_settings
from app.services.auth import verify_password
from app.services.rankings import build_ranking_rows
from app.services.session import create_session_cookie, get_current_admin_username, COOKIE_NAME
from app.services.oss import get_oss_client

router = APIRouter(prefix="/api/admin", tags=["admin"])

ITEM_ORDER = ["listening", "reading", "writing", "vocabulary", "running"]


@router.post("/login")
async def admin_login(
    payload: AdminLogin,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Admin).where(Admin.username == payload.username))
    admin = result.scalar_one_or_none()

    if not admin:
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    if not await verify_password(payload.password, admin.password_hash):
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    cookie = create_session_cookie(admin.username)
    response.set_cookie(
        key=COOKIE_NAME,
        value=cookie,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=86400,
    )
    return {"success": True}


@router.post("/logout")
async def admin_logout(response: Response):
    response.delete_cookie(key=COOKIE_NAME)
    return {"success": True}


@router.get("/me", response_model=AdminOut)
async def admin_me(
    username: str = Depends(get_current_admin_username),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Admin).where(Admin.username == username))
    admin = result.scalar_one_or_none()
    if not admin:
        raise HTTPException(status_code=401, detail="管理员不存在")
    return admin


@router.get("/submissions", response_model=dict)
async def list_submissions(
    name: str = Query(None),
    student_id: str = Query(None),
    start_date: str = Query(None),
    end_date: str = Query(None),
    sort_by: str = Query("checkin_date"),
    sort_order: str = Query("desc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    _: str = Depends(get_current_admin_username),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(DailyCheckin).options(
        selectinload(DailyCheckin.items).selectinload(CheckinItem.attachments)
    )
    count_stmt = select(func.count()).select_from(DailyCheckin)

    if name:
        stmt = stmt.where(DailyCheckin.name.ilike(f"%{name}%"))
        count_stmt = count_stmt.where(DailyCheckin.name.ilike(f"%{name}%"))

    if student_id:
        stmt = stmt.where(DailyCheckin.student_id.ilike(f"%{student_id}%"))
        count_stmt = count_stmt.where(DailyCheckin.student_id.ilike(f"%{student_id}%"))

    if start_date:
        stmt = stmt.where(DailyCheckin.checkin_date >= start_date)
        count_stmt = count_stmt.where(DailyCheckin.checkin_date >= start_date)

    if end_date:
        stmt = stmt.where(DailyCheckin.checkin_date <= end_date)
        count_stmt = count_stmt.where(DailyCheckin.checkin_date <= end_date)

    if sort_by in {"name", "student_id", "checkin_date", "base_points", "total_points", "updated_at"}:
        order_col = getattr(DailyCheckin, sort_by)
        if sort_order == "asc":
            stmt = stmt.order_by(asc(order_col))
        else:
            stmt = stmt.order_by(desc(order_col))
    else:
        stmt = stmt.order_by(desc(DailyCheckin.checkin_date), desc(DailyCheckin.updated_at))

    total_result = await db.execute(count_stmt)
    total = total_result.scalar()

    offset = (page - 1) * page_size
    stmt = stmt.offset(offset).limit(page_size)

    result = await db.execute(stmt)
    items = result.scalars().all()
    for checkin in items:
        checkin.items.sort(key=lambda item: ITEM_ORDER.index(item.item_type))

    return {
        "items": [DailyCheckinOut.model_validate(checkin) for checkin in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/rankings", response_model=list[RankingOut])
async def list_rankings(
    _: str = Depends(get_current_admin_username),
    db: AsyncSession = Depends(get_db),
):
    activity = await get_or_create_activity_settings(db)
    end_date = activity.start_date + timedelta(days=activity.duration_days - 1)
    result = await db.execute(
        select(DailyCheckin)
        .where(DailyCheckin.checkin_date >= activity.start_date)
        .where(DailyCheckin.checkin_date <= end_date)
        .options(selectinload(DailyCheckin.items))
    )
    checkins = result.scalars().all()

    rows = build_ranking_rows(checkins)
    rows.sort(
        key=lambda row: (
            -row["total_points"],
            -row["base_points"],
            -row["total_volume"],
            -row["morning_bonus_count"],
            row["student_id"],
        )
    )

    ranked_rows = []
    for index, row in enumerate(rows):
        ranked_row = {**row, "rank": index + 1, "total_volume": round(row["total_volume"], 4)}
        ranked_rows.append(RankingOut(**ranked_row))
    return ranked_rows


@router.get("/participants", response_model=AdminParticipantSummary)
async def list_participants(
    _: str = Depends(get_current_admin_username),
    db: AsyncSession = Depends(get_db),
):
    activity = await get_or_create_activity_settings(db)
    end_date = activity.start_date + timedelta(days=activity.duration_days - 1)
    result = await db.execute(
        select(DailyCheckin)
        .where(DailyCheckin.checkin_date >= activity.start_date)
        .where(DailyCheckin.checkin_date <= end_date)
        .options(selectinload(DailyCheckin.items))
    )
    checkins = result.scalars().all()
    rows = build_ranking_rows(checkins)
    rows.sort(key=lambda row: (-row["total_points"], -row["valid_days"], row["student_id"]))
    ranked = [
        RankingOut(rank=index + 1, **{**row, "total_volume": round(row["total_volume"], 4)})
        for index, row in enumerate(rows)
    ]
    return {
        "total_students": len(rows),
        "valid_checkin_records": sum(1 for checkin in checkins if checkin.base_points > 0),
        "students": ranked,
    }


@router.get("/participants/{student_id}", response_model=AdminParticipantDetail)
async def get_participant_detail(
    student_id: str,
    _: str = Depends(get_current_admin_username),
    db: AsyncSession = Depends(get_db),
):
    activity = await get_or_create_activity_settings(db)
    end_date = activity.start_date + timedelta(days=activity.duration_days - 1)
    result = await db.execute(
        select(DailyCheckin)
        .where(DailyCheckin.student_id == student_id)
        .where(DailyCheckin.checkin_date >= activity.start_date)
        .where(DailyCheckin.checkin_date <= end_date)
        .options(selectinload(DailyCheckin.items).selectinload(CheckinItem.attachments))
        .order_by(desc(DailyCheckin.checkin_date))
    )
    checkins = result.scalars().all()
    if not checkins:
        raise HTTPException(status_code=404, detail="同学不存在")

    for checkin in checkins:
        checkin.items.sort(key=lambda item: ITEM_ORDER.index(item.item_type))

    row = build_ranking_rows(checkins)[0]
    summary = RankingOut(rank=1, **{**row, "total_volume": round(row["total_volume"], 4)})
    return {
        "summary": summary,
        "checkins": [DailyCheckinOut.model_validate(checkin) for checkin in checkins],
    }


@router.get("/checkins/{checkin_id}", response_model=DailyCheckinOut)
async def get_checkin_detail(
    checkin_id: str,
    _: str = Depends(get_current_admin_username),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DailyCheckin)
        .where(DailyCheckin.id == checkin_id)
        .options(selectinload(DailyCheckin.items).selectinload(CheckinItem.attachments))
    )
    checkin = result.scalar_one_or_none()
    if not checkin:
        raise HTTPException(status_code=404, detail="打卡记录不存在")
    checkin.items.sort(key=lambda item: ITEM_ORDER.index(item.item_type))
    return DailyCheckinOut.model_validate(checkin)


@router.get("/activity", response_model=ActivitySettingsOut)
async def get_admin_activity(
    _: str = Depends(get_current_admin_username),
    db: AsyncSession = Depends(get_db),
):
    activity = await get_or_create_activity_settings(db)
    await db.commit()
    return build_activity_response(activity)


@router.put("/activity", response_model=ActivitySettingsOut)
async def update_admin_activity(
    payload: ActivitySettingsUpdate,
    _: str = Depends(get_current_admin_username),
    db: AsyncSession = Depends(get_db),
):
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="活动名称不能为空")
    if payload.duration_days <= 0:
        raise HTTPException(status_code=400, detail="持续天数必须大于 0")

    activity = await get_or_create_activity_settings(db)
    activity.name = payload.name.strip()
    activity.start_date = payload.start_date
    activity.duration_days = payload.duration_days
    activity.is_active = payload.is_active
    await db.commit()
    await db.refresh(activity)
    return build_activity_response(activity)


@router.get("/attachments/{attachment_id}/download")
async def download_attachment(
    attachment_id: str,
    _: str = Depends(get_current_admin_username),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(CheckinAttachment).where(CheckinAttachment.id == attachment_id))
    attachment = result.scalar_one_or_none()

    if not attachment:
        raise HTTPException(status_code=404, detail="附件不存在")

    presigned_url = get_oss_client().get_presigned_url(attachment.oss_key, expire=3600)
    return {"download_url": presigned_url}


@router.delete("/submissions/{submission_id}")
async def delete_submission(
    submission_id: str,
    _: str = Depends(get_current_admin_username),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DailyCheckin)
        .where(DailyCheckin.id == submission_id)
        .options(selectinload(DailyCheckin.items).selectinload(CheckinItem.attachments))
    )
    submission = result.scalar_one_or_none()

    if not submission:
        raise HTTPException(status_code=404, detail="记录不存在")

    for item in submission.items:
        for attachment in item.attachments:
            get_oss_client().delete_file(attachment.oss_key)

    await db.delete(submission)
    await db.commit()

    return {"success": True}
