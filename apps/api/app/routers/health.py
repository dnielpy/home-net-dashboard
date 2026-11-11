from fastapi import APIRouter, HTTPException

from app import db

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/health/db")
async def health_db() -> dict[str, str]:
    try:
        await db.check_connection()
    except Exception as err:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {err}")

    return {"status": "ok"}
