import asyncio
import contextlib
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI

from app import db, jobs, nano
from app.routers import health

load_dotenv()

logging.basicConfig(level=logging.WARNING, format="%(levelname)s:     %(name)s - %(message)s")
logging.getLogger("app").setLevel(logging.INFO)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    interval = jobs.get_interval_seconds()
    task = asyncio.create_task(jobs.run_check_job(interval)) if interval > 0 else None

    yield

    if task is not None:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task
    await nano.close_client()
    await db.dispose_engine()


app = FastAPI(title="Home Net Dashboard API", version="0.1.0", lifespan=lifespan)

app.include_router(health.router)
