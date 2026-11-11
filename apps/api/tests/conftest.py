from collections.abc import AsyncIterator

import pytest

from app.db import get_session
from app.main import app


@pytest.fixture
def fake_session():
    """Replace the database session; the tests then patch the query functions that would use it."""

    async def fake_get_session() -> AsyncIterator[None]:
        yield None

    app.dependency_overrides[get_session] = fake_get_session
    yield
    app.dependency_overrides.clear()
