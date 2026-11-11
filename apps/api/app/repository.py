from typing import TypeVar

from sqlalchemy.ext.asyncio import AsyncSession

from app.db import Base

ModelT = TypeVar("ModelT", bound=Base)


async def save(session: AsyncSession, instance: ModelT) -> ModelT:
    session.add(instance)
    await session.commit()
    await session.refresh(instance)
    return instance
