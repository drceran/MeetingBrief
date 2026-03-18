from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

try:
    from ..auth import CurrentOrDevUser
    from ..db import get_db
    from ..models import ActionItem, Meeting, MeetingSummary, MeetingTranscript
except ImportError:
    from auth import CurrentOrDevUser
    from db import get_db
    from models import ActionItem, Meeting, MeetingSummary, MeetingTranscript


router = APIRouter()


def _normalize_due_at(value: datetime | None) -> datetime | None:
    if value is None:
        return None

    if value.tzinfo is None:
        return value

    return value.astimezone(timezone.utc).replace(tzinfo=None)


class MeetingTranscriptUpsert(BaseModel):
    transcript_text: str
    provider: str | None = None


class MeetingTranscriptResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    meeting_id: str
    transcript_text: str
    provider: str | None
    created_at: datetime | None
    updated_at: datetime | None


class MeetingSummaryUpsert(BaseModel):
    summary_text: str
    provider: str | None = None


class MeetingSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    meeting_id: str
    summary_text: str
    provider: str | None
    created_at: datetime | None
    updated_at: datetime | None


class ActionItemCreate(BaseModel):
    description: str
    owner_name: str | None = None
    due_at: datetime | None = None
    completed: bool = False


class ActionItemUpdate(BaseModel):
    description: str | None = None
    owner_name: str | None = None
    due_at: datetime | None = None
    completed: bool | None = None


class ActionItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    meeting_id: str
    description: str
    owner_name: str | None
    due_at: datetime | None
    completed: bool
    created_at: datetime | None
    updated_at: datetime | None


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


async def _get_meeting_action_item(
    meeting_id: str,
    action_item_id: int,
    db: AsyncSession,
) -> ActionItem:
    result = await db.execute(
        select(ActionItem).where(
            ActionItem.id == action_item_id,
            ActionItem.meeting_id == meeting_id,
        )
    )
    action_item = result.scalar_one_or_none()
    if not action_item:
        raise HTTPException(status_code=404, detail="Action item not found")
    return action_item


@router.get("/{meeting_id}/transcript", response_model=MeetingTranscriptResponse)
async def get_meeting_transcript(
    meeting_id: str,
    user: CurrentOrDevUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await _get_owned_meeting(meeting_id, user["sub"], db)
    result = await db.execute(
        select(MeetingTranscript).where(MeetingTranscript.meeting_id == meeting_id)
    )
    transcript = result.scalar_one_or_none()
    if not transcript:
        raise HTTPException(status_code=404, detail="Meeting transcript not found")
    return transcript


@router.put("/{meeting_id}/transcript", response_model=MeetingTranscriptResponse)
async def upsert_meeting_transcript(
    meeting_id: str,
    payload: MeetingTranscriptUpsert,
    user: CurrentOrDevUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await _get_owned_meeting(meeting_id, user["sub"], db)
    result = await db.execute(
        select(MeetingTranscript).where(MeetingTranscript.meeting_id == meeting_id)
    )
    transcript = result.scalar_one_or_none()

    if transcript is None:
        transcript = MeetingTranscript(
            meeting_id=meeting_id,
            transcript_text=payload.transcript_text,
            provider=payload.provider,
        )
        db.add(transcript)
    else:
        transcript.transcript_text = payload.transcript_text
        transcript.provider = payload.provider

    await db.commit()
    await db.refresh(transcript)
    return transcript


@router.get("/{meeting_id}/summary", response_model=MeetingSummaryResponse)
async def get_meeting_summary(
    meeting_id: str,
    user: CurrentOrDevUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await _get_owned_meeting(meeting_id, user["sub"], db)
    result = await db.execute(
        select(MeetingSummary).where(MeetingSummary.meeting_id == meeting_id)
    )
    summary = result.scalar_one_or_none()
    if not summary:
        raise HTTPException(status_code=404, detail="Meeting summary not found")
    return summary


@router.put("/{meeting_id}/summary", response_model=MeetingSummaryResponse)
async def upsert_meeting_summary(
    meeting_id: str,
    payload: MeetingSummaryUpsert,
    user: CurrentOrDevUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await _get_owned_meeting(meeting_id, user["sub"], db)
    result = await db.execute(
        select(MeetingSummary).where(MeetingSummary.meeting_id == meeting_id)
    )
    summary = result.scalar_one_or_none()

    if summary is None:
        summary = MeetingSummary(
            meeting_id=meeting_id,
            summary_text=payload.summary_text,
            provider=payload.provider,
        )
        db.add(summary)
    else:
        summary.summary_text = payload.summary_text
        summary.provider = payload.provider

    await db.commit()
    await db.refresh(summary)
    return summary


@router.get("/{meeting_id}/action-items", response_model=list[ActionItemResponse])
async def list_action_items(
    meeting_id: str,
    user: CurrentOrDevUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await _get_owned_meeting(meeting_id, user["sub"], db)
    result = await db.execute(
        select(ActionItem)
        .where(ActionItem.meeting_id == meeting_id)
        .order_by(ActionItem.created_at.asc(), ActionItem.id.asc())
    )
    return list(result.scalars().all())


@router.post(
    "/{meeting_id}/action-items",
    response_model=ActionItemResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_action_item(
    meeting_id: str,
    payload: ActionItemCreate,
    user: CurrentOrDevUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await _get_owned_meeting(meeting_id, user["sub"], db)
    action_item = ActionItem(
        meeting_id=meeting_id,
        description=payload.description,
        owner_name=payload.owner_name,
        due_at=_normalize_due_at(payload.due_at),
        completed=payload.completed,
    )
    db.add(action_item)
    await db.commit()
    await db.refresh(action_item)
    return action_item


@router.patch("/{meeting_id}/action-items/{action_item_id}", response_model=ActionItemResponse)
async def update_action_item(
    meeting_id: str,
    action_item_id: int,
    payload: ActionItemUpdate,
    user: CurrentOrDevUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await _get_owned_meeting(meeting_id, user["sub"], db)
    action_item = await _get_meeting_action_item(meeting_id, action_item_id, db)

    update_data = payload.model_dump(exclude_unset=True)
    for field_name, value in update_data.items():
        if field_name == "due_at":
            value = _normalize_due_at(value)
        setattr(action_item, field_name, value)

    await db.commit()
    await db.refresh(action_item)
    return action_item


@router.delete("/{meeting_id}/action-items/{action_item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_action_item(
    meeting_id: str,
    action_item_id: int,
    user: CurrentOrDevUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await _get_owned_meeting(meeting_id, user["sub"], db)
    action_item = await _get_meeting_action_item(meeting_id, action_item_id, db)

    await db.delete(action_item)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)