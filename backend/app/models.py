import uuid

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class Admin(Base):
    __tablename__ = "admins"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String(50), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ActivitySettings(Base):
    __tablename__ = "activity_settings"

    id = Column(String(36), primary_key=True, default="default")
    name = Column(String(100), nullable=False, default="晨光打卡")
    start_date = Column(Date, nullable=False)
    duration_days = Column(Integer, nullable=False, default=21)
    checkin_start_time = Column(String(5), nullable=False, default="06:00")
    checkin_end_time = Column(String(5), nullable=False, default="04:00")
    morning_bonus_start_time = Column(String(5), nullable=False, default="06:30")
    morning_bonus_end_time = Column(String(5), nullable=False, default="07:40")
    is_active = Column(Boolean, nullable=False, default=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class DailyCheckin(Base):
    __tablename__ = "daily_checkins"
    __table_args__ = (
        UniqueConstraint("student_id", "checkin_date", name="uq_daily_checkins_student_date"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False)
    student_id = Column(String(50), nullable=False)
    checkin_date = Column(Date, nullable=False)
    first_submitted_at = Column(DateTime(timezone=True), nullable=False)
    first_valid_at = Column(DateTime(timezone=True), nullable=True)
    earned_morning_bonus = Column(Boolean, nullable=False, default=False)
    base_points = Column(Integer, nullable=False, default=0)
    total_points = Column(Integer, nullable=False, default=0)
    total_volume = Column(Float, nullable=False, default=0)
    ip_address = Column(String(45), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    items = relationship(
        "CheckinItem",
        back_populates="checkin",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class CheckinItem(Base):
    __tablename__ = "checkin_items"
    __table_args__ = (
        UniqueConstraint("checkin_id", "item_type", name="uq_checkin_items_checkin_type"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    checkin_id = Column(String(36), ForeignKey("daily_checkins.id"), nullable=False)
    item_type = Column(String(30), nullable=False)
    is_valid = Column(Boolean, nullable=False, default=False)
    points = Column(Integer, nullable=False, default=0)
    volume_score = Column(Float, nullable=False, default=0)
    listening_questions = Column(Integer, nullable=True)
    reading_articles = Column(Integer, nullable=True)
    reading_questions = Column(Integer, nullable=True)
    writing_words = Column(Integer, nullable=True)
    vocabulary_words = Column(Integer, nullable=True)
    speaking_minutes = Column(Float, nullable=True)
    speaking_dialogue_sentences = Column(Integer, nullable=True)
    running_distance_km = Column(Float, nullable=True)
    running_pace_min_per_km = Column(Float, nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    checkin = relationship("DailyCheckin", back_populates="items")
    attachments = relationship(
        "CheckinAttachment",
        back_populates="item",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class CheckinAttachment(Base):
    __tablename__ = "checkin_attachments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    item_id = Column(String(36), ForeignKey("checkin_items.id"), nullable=False)
    item_type = Column(String(30), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_url = Column(Text, nullable=False)
    file_size = Column(Integer, nullable=False)
    file_type = Column(String(100), nullable=False)
    oss_key = Column(String(500), nullable=False)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    item = relationship("CheckinItem", back_populates="attachments")
