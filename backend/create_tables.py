import asyncio
from .db import engine
from .models import Base


async def create() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # keep engine available for app lifetime; do not dispose here if app continues to use it


if __name__ == "__main__":
    asyncio.run(create())
