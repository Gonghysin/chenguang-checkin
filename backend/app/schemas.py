from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ActivitySettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    start_date: date
    duration_days: int
    checkin_start_time: str
    checkin_end_time: str
    is_active: bool
    current_day: int
    progress_percent: float


class ActivitySettingsUpdate(BaseModel):
    name: str
    start_date: date
    duration_days: int
    checkin_start_time: str
    checkin_end_time: str
    is_active: bool = True


class CheckinAttachmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    item_type: str
    file_name: str
    file_size: int
    file_type: str
    uploaded_at: datetime


class CheckinItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    item_type: str
    is_valid: bool
    points: int
    volume_score: float
    listening_questions: Optional[int] = None
    reading_articles: Optional[int] = None
    reading_questions: Optional[int] = None
    writing_words: Optional[int] = None
    vocabulary_words: Optional[int] = None
    running_distance_km: Optional[float] = None
    running_pace_min_per_km: Optional[float] = None
    attachments: list[CheckinAttachmentOut] = Field(default_factory=list)


class DailyCheckinOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    student_id: str
    checkin_date: date
    first_submitted_at: datetime
    first_valid_at: Optional[datetime] = None
    earned_morning_bonus: bool
    base_points: int
    total_points: int
    total_volume: float
    ip_address: Optional[str] = None
    updated_at: datetime
    items: list[CheckinItemOut] = Field(default_factory=list)


class SubmissionResult(BaseModel):
    checkin: DailyCheckinOut
    message: str


class PublicCheckinAttachmentOut(BaseModel):
    id: str
    item_type: str
    display_name: str
    file_size: int
    file_type: str
    uploaded_at: datetime


class PublicCheckinItemOut(BaseModel):
    item_type: str
    is_valid: bool
    points: int
    volume_score: float
    listening_questions: Optional[int] = None
    reading_articles: Optional[int] = None
    reading_questions: Optional[int] = None
    writing_words: Optional[int] = None
    vocabulary_words: Optional[int] = None
    running_distance_km: Optional[float] = None
    running_pace_min_per_km: Optional[float] = None
    attachments: list[PublicCheckinAttachmentOut] = Field(default_factory=list)


class PublicDailyCheckinOut(BaseModel):
    checkin_date: date
    first_submitted_at: datetime
    first_valid_at: Optional[datetime] = None
    earned_morning_bonus: bool
    base_points: int
    total_points: int
    total_volume: float
    updated_at: datetime
    items: list[PublicCheckinItemOut] = Field(default_factory=list)


class PublicSubmissionResult(BaseModel):
    checkin: PublicDailyCheckinOut
    message: str


class AdminLogin(BaseModel):
    username: str
    password: str


class AdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    username: str
    created_at: datetime


class AdminSessionOut(AdminOut):
    csrf_token: str


class RankingOut(BaseModel):
    rank: int
    name: str
    student_id: str
    total_points: int
    base_points: int
    morning_bonus_count: int
    total_volume: float
    valid_days: int
    consecutive_days: int
    listening_count: int
    reading_count: int
    writing_count: int
    vocabulary_count: int
    running_count: int
    last_updated_at: Optional[datetime] = None


class PublicRankingOut(BaseModel):
    name: str
    total_points: int
    base_points: int
    morning_bonus_count: int
    total_volume: float
    valid_days: int
    consecutive_days: int
    listening_count: int
    reading_count: int
    writing_count: int
    vocabulary_count: int
    running_count: int


class PublicUserStatsOut(PublicRankingOut):
    latest_checkin: Optional[PublicDailyCheckinOut] = None


class AdminParticipantSummary(BaseModel):
    total_students: int
    valid_checkin_records: int
    students: list[RankingOut]


class AdminParticipantDetail(BaseModel):
    summary: RankingOut
    checkins: list[DailyCheckinOut]
