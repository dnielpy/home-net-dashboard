import os
from dataclasses import dataclass
from typing import Any

import httpx

REQUEST_TIMEOUT_SECONDS = 10


class NanoConfigError(Exception):
    pass


class NanoUnavailableError(Exception):
    pass


@dataclass
class NanoTraffic:
    rx_bytes: int
    tx_bytes: int
    uptime: int


def parse_traffic(status: dict[str, Any]) -> NanoTraffic:
    try:
        stats = status["wireless"]["sta"][0]["stats"]
        return NanoTraffic(
            rx_bytes=int(stats["rx_bytes"]),
            tx_bytes=int(stats["tx_bytes"]),
            uptime=int(status["host"]["uptime"]),
        )
    except (KeyError, IndexError, TypeError, ValueError) as err:
        raise NanoUnavailableError(f"Unexpected status from the Nano: {err!r}") from err


class NanoClient:
    def __init__(self, host: str, username: str, password: str, transport: httpx.AsyncBaseTransport | None = None):
        self._username = username
        self._password = password
        self._csrf: str | None = None
        self._http = httpx.AsyncClient(
            base_url=f"https://{host}",
            verify=False,
            timeout=REQUEST_TIMEOUT_SECONDS,
            transport=transport,
        )

    async def _login(self) -> None:
        self._http.cookies.clear()
        response = await self._http.post("/api/auth", json={"username": self._username, "password": self._password})
        if response.status_code in (401, 403):
            raise NanoConfigError("The Nano rejected the username or password")
        response.raise_for_status()
        self._csrf = response.headers.get("X-CSRF-ID")

    async def _get_status(self) -> httpx.Response:
        headers = {"X-CSRF-ID": self._csrf} if self._csrf else {}
        return await self._http.get("/status.cgi", headers=headers)

    async def status(self) -> dict[str, Any]:
        try:
            if self._csrf is None:
                await self._login()
            response = await self._get_status()
            if response.status_code in (401, 403):
                await self._login()
                response = await self._get_status()
            response.raise_for_status()
            return response.json()
        except (httpx.HTTPError, ValueError) as err:
            raise NanoUnavailableError(f"Could not read the Nano status: {err}") from err

    async def read_traffic(self) -> NanoTraffic:
        return parse_traffic(await self.status())

    async def close(self) -> None:
        await self._http.aclose()


_client: NanoClient | None = None


def get_client() -> NanoClient:
    global _client

    if _client is None:
        username = os.environ.get("NANO_USERNAME")
        password = os.environ.get("NANO_PASSWORD")
        if not username or not password:
            raise NanoConfigError("NANO_USERNAME and NANO_PASSWORD environment variables must be set")
        _client = NanoClient(os.environ.get("NANO_IP", "10.40.43.99"), username, password)

    return _client


async def read_traffic() -> NanoTraffic:
    return await get_client().read_traffic()


async def close_client() -> None:
    global _client

    if _client is not None:
        await _client.close()
        _client = None
