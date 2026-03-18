from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import uuid4

try:
    from ..auth import CurrentUser, create_access_token, hash_password, verify_password
    from ..db import get_db
    from ..models import User
except ImportError:
    from auth import CurrentUser, create_access_token, hash_password, verify_password
    from db import get_db
    from models import User

router = APIRouter()


class AuthRequest(BaseModel):
    email: str
    password: str
    name: str | None = None


class AuthUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    name: str | None
    role: str = "user"


class AuthSessionResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: AuthUserResponse


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _serialize_user(user: User) -> AuthUserResponse:
    return AuthUserResponse(
        id=user.auth_user_id,
        email=user.email,
        name=user.name,
        role="user",
    )


async def _get_user_by_email(email: str, db: AsyncSession) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def _get_user_by_auth_id(auth_user_id: str, db: AsyncSession) -> User | None:
    result = await db.execute(select(User).where(User.auth_user_id == auth_user_id))
    return result.scalar_one_or_none()


async def _ensure_user_from_payload(user_payload: dict, db: AsyncSession) -> User:
    auth_user_id = str(user_payload.get("sub") or "").strip()
    if not auth_user_id:
        raise HTTPException(status_code=401, detail="Authenticated user is missing an id")

    user = await _get_user_by_auth_id(auth_user_id, db)
    if user is not None:
        return user

    user = User(
        auth_user_id=auth_user_id,
        email=(user_payload.get("email") or f"{auth_user_id}@meetingbrief.local").strip().lower(),
        name=user_payload.get("name"),
        password_hash=None,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/register", response_model=AuthSessionResponse, status_code=status.HTTP_201_CREATED)
async def register(
    payload: AuthRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    email = _normalize_email(payload.email)
    if not email or not payload.password.strip():
        raise HTTPException(status_code=400, detail="Email and password are required")

    existing_user = await _get_user_by_email(email, db)
    if existing_user is not None:
        raise HTTPException(status_code=409, detail="A user with this email already exists")

    user = User(
        auth_user_id=str(uuid4()),
        email=email,
        name=payload.name.strip() if payload.name and payload.name.strip() else None,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return AuthSessionResponse(
        access_token=create_access_token(sub=user.auth_user_id, email=user.email, name=user.name),
        user=_serialize_user(user),
    )


@router.post("/login", response_model=AuthSessionResponse)
async def login(
    payload: AuthRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    user = await _get_user_by_email(_normalize_email(payload.email), db)
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return AuthSessionResponse(
        access_token=create_access_token(sub=user.auth_user_id, email=user.email, name=user.name),
        user=_serialize_user(user),
    )


@router.get("/me", response_model=AuthUserResponse)
async def me(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return _serialize_user(await _ensure_user_from_payload(user, db))


@router.get("/verify")
async def verify_auth(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    stored_user = await _ensure_user_from_payload(user, db)
    return {
        "authenticated": True,
        "user": _serialize_user(stored_user).model_dump(),
    }
