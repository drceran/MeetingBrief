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

import base64
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import os
from typing import Annotated, Any, Dict

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

# HTTPBearer extracts the token from "Authorization: Bearer <token>"
_bearer = HTTPBearer(auto_error=False)
_PASSWORD_HASH_ITERATIONS = 200_000


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


def _get_app_jwt_secret() -> str:
    return os.getenv("APP_JWT_SECRET", "meetingbrief-dev-secret")


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    derived_key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        _PASSWORD_HASH_ITERATIONS,
    )
    salt_b64 = base64.b64encode(salt).decode("ascii")
    hash_b64 = base64.b64encode(derived_key).decode("ascii")
    return f"pbkdf2_sha256${_PASSWORD_HASH_ITERATIONS}${salt_b64}${hash_b64}"


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        return False

    try:
        algorithm, iterations, salt_b64, hash_b64 = password_hash.split("$", 3)
    except ValueError:
        return False

    if algorithm != "pbkdf2_sha256":
        return False

    derived_key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        base64.b64decode(salt_b64.encode("ascii")),
        int(iterations),
    )
    expected_hash = base64.b64decode(hash_b64.encode("ascii"))
    return hmac.compare_digest(derived_key, expected_hash)


def create_access_token(*, sub: str, email: str, name: str | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload: Dict[str, Any] = {
        "sub": sub,
        "email": email,
        "name": name,
        "role": "user",
        "auth_provider": "meetingbrief-local",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=7)).timestamp()),
    }
    return jwt.encode(payload, _get_app_jwt_secret(), algorithm="HS256")


def _decode_app_token(token: str) -> Dict[str, Any] | None:
    try:
        payload: Dict[str, Any] = jwt.decode(
            token,
            _get_app_jwt_secret(),
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
    except jwt.InvalidTokenError:
        return None

    if payload.get("auth_provider") != "meetingbrief-local" or "sub" not in payload:
        return None

    return payload


def _decode_supabase_token(token: str) -> Dict[str, Any] | None:
    try:
        jwt_secret = _get_jwt_secret()
    except RuntimeError:
        return None

    try:
        payload: Dict[str, Any] = jwt.decode(
            token,
            jwt_secret,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
    except jwt.InvalidTokenError:
        return None

    if "sub" not in payload:
        return None

    return payload


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
    if credentials is None:
        if _is_auth_disabled():
            return _get_local_user()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    app_payload = _decode_app_token(token)
    if app_payload is not None:
        return app_payload

    supabase_payload = _decode_supabase_token(token)
    if supabase_payload is not None:
        return supabase_payload

    if _is_auth_disabled():
        return _get_local_user()

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid token",
        headers={"WWW-Authenticate": "Bearer"},
    )


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
