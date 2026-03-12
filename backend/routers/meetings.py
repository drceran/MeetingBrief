import os
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

try:
    from ..auth import CurrentUser
    from ..db import get_db
    from ..models import Meeting
except ImportError:
    from auth import CurrentUser
    from db import get_db
    from models import Meeting

router = APIRouter()


class MeetingCreate(BaseModel):
    audio_url: str
    duration_seconds: int = Field(gt=0)
    title: str | None = None


class UploadWebhookPayload(BaseModel):
    meeting_id: str
    audio_url: str | None = None
    duration_seconds: int | None = Field(default=None, ge=0)
    status: str = "uploaded"


class MeetingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    status: str
    audio_url: str | None
    duration_seconds: int
    title: str | None
    created_at: datetime | None


@router.post("/", response_model=MeetingResponse)
async def create_meeting(
    payload: MeetingCreate,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    meeting = Meeting(
        user_id=user["sub"],
        audio_url=payload.audio_url,
        duration_seconds=payload.duration_seconds,
        status="uploaded",
        title=payload.title,
    )
    db.add(meeting)
    await db.commit()
    await db.refresh(meeting)
    return meeting


@router.post("/upload/webhook")
async def upload_webhook(
    payload: UploadWebhookPayload,
    db: Annotated[AsyncSession, Depends(get_db)],
    x_webhook_secret: str | None = Header(default=None),
):
    configured_secret = os.getenv("UPLOAD_WEBHOOK_SECRET")
    if configured_secret and x_webhook_secret != configured_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook secret",
        )

    if payload.status not in {"uploaded", "processed"}:
        raise HTTPException(status_code=400, detail="Invalid meeting status")

    result = await db.execute(select(Meeting).where(Meeting.id == payload.meeting_id))
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    if payload.audio_url is not None:
        meeting.audio_url = payload.audio_url
    if payload.duration_seconds is not None:
        meeting.duration_seconds = payload.duration_seconds
    meeting.status = payload.status

    await db.commit()
    await db.refresh(meeting)
    return {"id": meeting.id, "status": meeting.status}


@router.get("/{meeting_id}", response_model=MeetingResponse)
async def get_meeting(
    meeting_id: str,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = result.scalar_one_or_none()
    if not meeting or meeting.user_id != user["sub"]:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return meeting
