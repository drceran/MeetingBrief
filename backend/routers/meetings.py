import os
from pathlib import Path
from datetime import datetime
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Request, UploadFile, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

try:
    from ..auth import CurrentOrDevUser, CurrentUser
    from ..db import get_db
    from ..models import Meeting
except ImportError:
    from auth import CurrentOrDevUser, CurrentUser
    from db import get_db
    from models import Meeting

router = APIRouter()
_DEFAULT_MEDIA_DIR = Path(__file__).resolve().parents[1] / "media"


class MeetingStartPayload(BaseModel):
    title: str | None = None


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


async def _get_owned_meeting(
    meeting_id: str,
    user_id: str,
    db: AsyncSession,
) -> Meeting:
    result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = result.scalar_one_or_none()
    if not meeting or meeting.user_id != user_id:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return meeting


def _get_media_dir() -> Path:
    media_dir = Path(os.getenv("MEDIA_DIR", str(_DEFAULT_MEDIA_DIR)))
    media_dir.mkdir(parents=True, exist_ok=True)
    return media_dir


def _get_file_extension(audio: UploadFile) -> str:
    filename_suffix = Path(audio.filename or "recording").suffix.lower()
    if filename_suffix:
        return filename_suffix

    content_type_map = {
        "audio/mp4": ".m4a",
        "audio/m4a": ".m4a",
        "audio/x-m4a": ".m4a",
        "audio/aac": ".aac",
        "audio/mpeg": ".mp3",
        "audio/webm": ".webm",
        "audio/wav": ".wav",
        "audio/x-wav": ".wav",
    }
    return content_type_map.get(audio.content_type or "", ".bin")


def _build_media_url(request: Request, file_name: str) -> str:
    configured_base_url = os.getenv("MEDIA_BASE_URL", "").rstrip("/")
    if configured_base_url:
        return f"{configured_base_url}/{file_name}"

    base_url = str(request.base_url).rstrip("/")
    return f"{base_url}/media/{file_name}"


async def _persist_upload(audio: UploadFile) -> str:
    content_type = (audio.content_type or "").lower()
    if not content_type.startswith("audio/") and content_type != "application/octet-stream":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only audio uploads are supported",
        )

    file_name = f"{uuid4()}{_get_file_extension(audio)}"
    destination = _get_media_dir() / file_name

    with destination.open("wb") as target:
        while True:
            chunk = await audio.read(1024 * 1024)
            if not chunk:
                break
            target.write(chunk)

    await audio.close()
    return file_name


@router.post("/start", response_model=MeetingResponse)
async def start_meeting(
    payload: MeetingStartPayload,
    user: CurrentOrDevUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    meeting = Meeting(
        user_id=user["sub"],
        audio_url=None,
        duration_seconds=0,
        status="started",
        title=payload.title,
    )
    db.add(meeting)
    await db.commit()
    await db.refresh(meeting)
    return meeting


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


@router.post("/upload", response_model=MeetingResponse)
async def upload_meeting_audio(
    request: Request,
    user: CurrentOrDevUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    audio: UploadFile = File(...),
    duration_seconds: int = Form(..., gt=0),
    title: str | None = Form(default=None),
):
    file_name = await _persist_upload(audio)
    meeting = Meeting(
        user_id=user["sub"],
        audio_url=_build_media_url(request, file_name),
        duration_seconds=duration_seconds,
        status="uploaded",
        title=title,
    )
    db.add(meeting)
    await db.commit()
    await db.refresh(meeting)
    return meeting


@router.post("/{meeting_id}/upload-audio", response_model=MeetingResponse)
async def upload_meeting_audio_for_existing_meeting(
    meeting_id: str,
    request: Request,
    user: CurrentOrDevUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    audio: UploadFile = File(...),
    title: str | None = Form(default=None),
    duration_seconds: int | None = Form(default=None, ge=0),
):
    meeting = await _get_owned_meeting(meeting_id, user["sub"], db)
    file_name = await _persist_upload(audio)

    meeting.audio_url = _build_media_url(request, file_name)
    if duration_seconds is not None:
        meeting.duration_seconds = duration_seconds
    if title is not None:
        meeting.title = title
    meeting.status = "uploaded"

    await db.commit()
    await db.refresh(meeting)
    return meeting


@router.post("/{meeting_id}/finalize", response_model=MeetingResponse)
async def finalize_meeting(
    meeting_id: str,
    user: CurrentOrDevUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    meeting = await _get_owned_meeting(meeting_id, user["sub"], db)
    if not meeting.audio_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Meeting audio must be uploaded before finalizing",
        )

    meeting.status = "finalized"
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

    if payload.status not in {"started", "uploaded", "finalized", "processed"}:
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
    user: CurrentOrDevUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await _get_owned_meeting(meeting_id, user["sub"], db)
