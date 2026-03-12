from fastapi import APIRouter

try:
    from ..auth import CurrentUser
except ImportError:
    from auth import CurrentUser

router = APIRouter()


@router.get("/verify")
async def verify_auth(user: CurrentUser):
    return {
        "authenticated": True,
        "user": {
            "id": user.get("sub"),
            "email": user.get("email"),
            "role": user.get("role"),
        },
    }
