"""
Supabase JWT verification dependency.

Supabase signs JWTs with HS256 using the project's JWT secret, which
you can find at:
  Supabase Dashboard → Project Settings → API → JWT Settings → JWT Secret

Usage:
    from auth import get_current_user, CurrentUser

    @router.get("/protected")
    async def protected(user: CurrentUser):
        return {"user_id": user["sub"]}
"""

import os
from typing import Annotated, Any, Dict

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

# HTTPBearer extracts the token from "Authorization: Bearer <token>"
_bearer = HTTPBearer(auto_error=False)


def _is_auth_disabled() -> bool:
    return os.getenv("AUTH_DISABLED", "false").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def _get_dev_user() -> Dict[str, Any] | None:
    user_id = os.getenv("DEV_AUTH_USER_ID", "").strip()
    if not user_id:
        return None

    return {
        "sub": user_id,
        "email": os.getenv("DEV_AUTH_EMAIL", "dev@meetingbrief.local"),
        "role": "developer",
        "is_dev_auth": True,
    }


def _get_local_user() -> Dict[str, Any]:
    user_id = os.getenv("DEV_AUTH_USER_ID", "").strip() or "local-dev-user"
    return {
        "sub": user_id,
        "email": os.getenv("DEV_AUTH_EMAIL", "dev@meetingbrief.local"),
        "role": "developer",
        "is_dev_auth": True,
        "auth_disabled": _is_auth_disabled(),
    }


def _get_jwt_secret() -> str:
    secret = os.getenv("SUPABASE_JWT_SECRET", "")
    if not secret or secret == "your-supabase-jwt-secret":
        raise RuntimeError(
            "SUPABASE_JWT_SECRET is not configured. "
            "Add it to your .env (see .env.example)."
        )
    return secret


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> Dict[str, Any]:
    """
    FastAPI dependency that:
    1. Extracts the JWT from the Authorization: Bearer header.
    2. Verifies it against SUPABASE_JWT_SECRET (HS256).
    3. Returns the decoded payload dict.

    Raises 401 if the token is missing, expired, or invalid.
    """
    if _is_auth_disabled():
        return _get_local_user()

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    try:
        jwt_secret = _get_jwt_secret()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )

    try:
        payload: Dict[str, Any] = jwt.decode(
            token,
            jwt_secret,
            algorithms=["HS256"],
            # Supabase sets audience to "authenticated" for logged-in users
            options={"verify_aud": False},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # `sub` is the Supabase user UUID
    if "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is missing 'sub' claim",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return payload


def get_current_user_or_dev(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> Dict[str, Any]:
    if _is_auth_disabled():
        return _get_local_user()

    if credentials is None:
        dev_user = _get_dev_user()
        if dev_user is not None:
            return dev_user

    return get_current_user(credentials)


# Convenience type alias for use as an annotated dependency
CurrentUser = Annotated[Dict[str, Any], Depends(get_current_user)]
CurrentOrDevUser = Annotated[Dict[str, Any], Depends(get_current_user_or_dev)]
