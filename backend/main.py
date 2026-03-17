import os
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles


def _load_local_env() -> None:
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if not os.path.exists(env_path):
        return

    with open(env_path, "r", encoding="utf-8") as env_file:
        for raw_line in env_file:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue

            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


_load_local_env()


def _get_media_dir() -> str:
    media_dir = os.getenv(
        "MEDIA_DIR",
        os.path.join(os.path.dirname(__file__), "media"),
    )
    os.makedirs(media_dir, exist_ok=True)
    return media_dir


def _get_cors_origins() -> list[str]:
    raw_origins = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    )
    return [origin.strip() for origin in raw_origins.split(",") if origin.strip()]

try:
    from . import db
except ImportError:
    import db

from contextlib import asynccontextmanager


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: optionally create tables (useful for local/dev)
    create_tables = os.getenv("CREATE_TABLES", "true").lower() in ("1", "true", "yes")
    if create_tables:
        try:
            from . import create_tables as _create
        except ImportError:
            import create_tables as _create

        try:
            await _create.create()
        except Exception:
            # If table creation fails, continue — real deployments should use migrations
            pass

    yield

    # Shutdown: dispose DB engine
    try:
        await db.engine.dispose()
    except Exception:
        pass


app = FastAPI(title="Meeting Notes AI Backend", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/media", StaticFiles(directory=_get_media_dir()), name="media")


@app.get("/")
async def root():
    return {"message": "Meeting Notes AI Backend"}


# Register routers.
try:
    from .routers.auth import router as auth_router
    from .routers.meeting_artifacts import router as meeting_artifacts_router
    from .routers.meetings import router as meetings_router
except ImportError:
    from routers.auth import router as auth_router
    from routers.meeting_artifacts import router as meeting_artifacts_router
    from routers.meetings import router as meetings_router

app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(meetings_router, prefix="/meetings", tags=["meetings"])
app.include_router(meeting_artifacts_router, prefix="/meetings", tags=["meeting-artifacts"])


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)