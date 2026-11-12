import asyncio
import contextlib
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI

from app import db, jobs, nano, wavlink
from app.routers import connection, devices, health, live, stats

load_dotenv()

logging.basicConfig(level=logging.WARNING, format="%(levelname)s:     %(name)s - %(message)s")
logging.getLogger("app").setLevel(logging.INFO)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    tasks = []
    if (interval := jobs.get_interval_seconds()) > 0:
        tasks.append(asyncio.create_task(jobs.run_check_job(interval)))
    if (speed_test_interval := jobs.get_speed_test_interval_seconds()) > 0:
        tasks.append(asyncio.create_task(jobs.run_speed_test_job(speed_test_interval)))
    if (device_interval := jobs.get_device_interval_seconds()) > 0:
        tasks.append(asyncio.create_task(jobs.run_device_job(device_interval)))

    yield

    for task in tasks:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task
    await nano.close_client()
    await wavlink.close_client()
    await db.dispose_engine()


app = FastAPI(title="Home Net Dashboard API", version="0.1.0", lifespan=lifespan)

app.include_router(health.router)
app.include_router(connection.router)
app.include_router(stats.router)
app.include_router(live.router)
app.include_router(devices.router)
