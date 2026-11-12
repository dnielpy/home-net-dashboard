import asyncio
import hashlib
import os
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

import httpx

REQUEST_TIMEOUT_SECONDS = 10
# The router answers this when the token is missing or expired
SESSION_EXPIRED_ERROR = 10007


class WavlinkConfigError(Exception):
    pass


class WavlinkUnavailableError(Exception):
    pass


@dataclass
class RouterDevice:
    mac: str
    name: str
    ip: str | None
    online: bool
    blocked: bool
    # KB/s as the router reports them (1 KB = 1024 bytes); limits of 0 mean unlimited
    down_kbs: int
    up_kbs: int
    connected_since: datetime | None
    limit_down_kbs: int
    limit_up_kbs: int


def _flag(flags: str, index: int) -> bool:
    return len(flags) > index and flags[index] == "T"


def parse_devices(
    main: dict[str, Any], host_if: dict[str, Any], leases: dict[str, Any], now: datetime
) -> list[RouterDevice]:
    """Joins the router's device list with its speed limits and the DHCP names, like its own terminal page does."""
    try:
        limits = {t["mac"].upper(): t for t in host_if.get("terminals") or []}
        lease_names = {d["mac"].upper(): d["name"] for d in leases.get("dhcp_list") or []}
        devices = []
        for t in main.get("terminals") or []:
            mac = t["mac"].upper()
            flags = t.get("flag", "")
            online = _flag(flags, 1)
            name = t.get("name") or lease_names.get(mac, "")
            limit = limits.get(mac, {})
            devices.append(
                RouterDevice(
                    mac=mac,
                    name="" if name == "*" else name,
                    ip=t.get("ip") or None,
                    online=online,
                    blocked=_flag(flags, 2),
                    down_kbs=int(t.get("speed") or 0) if online else 0,
                    up_kbs=int(t.get("up_speed") or 0) if online else 0,
                    # ontime instead of the router's own timestamp, so a wrong router clock doesn't matter
                    connected_since=now - timedelta(seconds=int(t.get("ontime") or 0)) if online else None,
                    limit_down_kbs=int(limit.get("ls") or 0),
                    limit_up_kbs=int(limit.get("ls_up") or 0),
                )
            )
        return devices
    except (KeyError, TypeError, ValueError, AttributeError) as err:
        raise WavlinkUnavailableError(f"Unexpected device list from the router: {err!r}") from err


class WavlinkClient:
    def __init__(self, base_url: str, password: str, transport: httpx.AsyncBaseTransport | None = None):
        self._password = password
        self._token: str | None = None
        # The router's CGI is not made for parallel sessions, so calls go one at a time
        self._lock = asyncio.Lock()
        self._http = httpx.AsyncClient(
            base_url=base_url,
            timeout=REQUEST_TIMEOUT_SECONDS,
            # Without a Referer the router's CGI crashes and the web server answers 502
            headers={"Referer": f"{base_url.rstrip('/')}/html/terminal.html"},
            transport=transport,
        )

    async def _post(self, params: dict[str, str]) -> dict[str, Any]:
        response = await self._http.post("/cgi-bin/wapi.cgi", params=params)
        response.raise_for_status()
        return response.json()

    async def _login(self) -> None:
        self._token = None
        self._http.cookies.clear()
        usrid = hashlib.md5(("admin" + self._password).encode()).hexdigest()
        data = await self._post({"fname": "system", "opt": "login", "function": "set", "usrid": usrid})
        if data.get("error") != 0 or not data.get("token"):
            raise WavlinkConfigError(f"The router rejected the password (error {data.get('error')})")
        self._token = data["token"]
        # Besides the token in the URL, the router checks these cookies like its own web page sends them
        self._http.cookies.set("token", self._token)
        self._http.cookies.set("lstatus", "true")

    async def _call_once(self, params: dict[str, str]) -> dict[str, Any]:
        assert self._token is not None
        return await self._post({"token": self._token, **params})

    async def call(self, fname: str, opt: str, function: str, **extra: str | int) -> dict[str, Any]:
        params = {"fname": fname, "opt": opt, "function": function, **{k: str(v) for k, v in extra.items()}}
        async with self._lock:
            try:
                if self._token is None:
                    await self._login()
                data = await self._call_once(params)
                if data.get("error") == SESSION_EXPIRED_ERROR:
                    await self._login()
                    data = await self._call_once(params)
            except (httpx.HTTPError, ValueError) as err:
                raise WavlinkUnavailableError(f"Could not reach the router: {err}") from err
        if data.get("error") != 0:
            raise WavlinkUnavailableError(f"The router answered {fname}/{opt} with error {data.get('error')}")
        return data

    async def list_devices(self) -> list[RouterDevice]:
        main = await self.call("system", "main", "get")
        host_if = await self.call("net", "host_if", "get", **{"if": "FFFFFFFT", "flage": 0})
        leases = await self.call("net", "dhcp_leases", "get")
        return parse_devices(main, host_if, leases, datetime.now().astimezone())

    async def set_blocked(self, mac: str, blocked: bool) -> None:
        await self.call("net", "host_black", "set", mac=mac, index=1 if blocked else 0)

    async def set_limit(self, mac: str, down_kbs: int, up_kbs: int) -> None:
        await self.call("net", "host_ls", "set", mac=mac, down_speed=down_kbs, up_speed=up_kbs)

    async def set_name(self, mac: str, name: str) -> None:
        await self.call("net", "host_nick", "set", mac=mac, nick=name)

    async def close(self) -> None:
        await self._http.aclose()


_client: WavlinkClient | None = None


def get_client() -> WavlinkClient:
    global _client

    if _client is None:
        password = os.environ.get("ROUTER_PASSWORD")
        if not password:
            raise WavlinkConfigError("ROUTER_PASSWORD environment variable must be set")
        _client = WavlinkClient(os.environ.get("ROUTER_ADMIN_URL", "http://192.168.20.1"), password)

    return _client


async def close_client() -> None:
    global _client

    if _client is not None:
        await _client.close()
        _client = None
