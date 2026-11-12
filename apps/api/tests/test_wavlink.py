import asyncio
import hashlib
from datetime import datetime, timedelta, timezone

import httpx
import pytest

from app.wavlink import WavlinkClient, WavlinkConfigError, WavlinkUnavailableError, parse_devices

NOW = datetime(2026, 11, 11, 20, 0, tzinfo=timezone.utc)

MAIN = {
    "error": 0,
    "terminals": [
        {"mac": "f4:06:16:68:ca:29", "ip": "192.168.20.189", "name": "iPhone", "speed": 200, "up_speed": 5,
         "ontime": 600, "flag": "FTFFTTTTTTTT"},
        {"mac": "9E:40:68:FE:7F:B1", "ip": "192.168.20.110", "name": "", "speed": 2, "up_speed": 1,
         "ontime": 60, "flag": "FTFFTTTTTFFF"},
        {"mac": "62:6E:C8:03:99:D1", "ip": "", "name": "", "speed": 0, "up_speed": 0, "ontime": 1,
         "flag": "FFTFTTFTTFFT"},
    ],
}
HOST_IF = {"error": 0, "terminals": [{"mac": "F4:06:16:68:CA:29", "ls": 200, "ls_up": 0}, {"mac": "62:6E:C8:03:99:D1", "ls": 7, "ls_up": 3}]}
LEASES = {"error": 0, "dhcp_list": [{"name": "MacBookAir", "mac": "9e:40:68:fe:7f:b1"}, {"name": "*", "mac": "62:6e:c8:03:99:d1"}]}


def test_parse_devices() -> None:
    phone, mac, blocked = parse_devices(MAIN, HOST_IF, LEASES, NOW)

    assert (phone.mac, phone.name, phone.online, phone.blocked) == ("F4:06:16:68:CA:29", "iPhone", True, False)
    assert (phone.down_kbs, phone.up_kbs, phone.limit_down_kbs, phone.limit_up_kbs) == (200, 5, 200, 0)
    assert phone.connected_since == NOW - timedelta(seconds=600)
    assert mac.name == "MacBookAir"
    assert (blocked.online, blocked.blocked, blocked.ip, blocked.name, blocked.connected_since) == (
        False, True, None, "", None,
    )
    assert (blocked.limit_down_kbs, blocked.limit_up_kbs) == (7, 3)


def test_parse_devices_unexpected_shape() -> None:
    with pytest.raises(WavlinkUnavailableError):
        parse_devices({"terminals": [{"ip": "1.2.3.4"}]}, {}, {}, NOW)


def _client(handler) -> WavlinkClient:
    return WavlinkClient("http://router.test", "secret", transport=httpx.MockTransport(handler))


def _answer(request: httpx.Request, token: str = "T1") -> httpx.Response:
    params = request.url.params
    if params["opt"] == "login":
        return httpx.Response(200, json={"error": 0, "token": token})
    return httpx.Response(200, json={"main": MAIN, "host_if": HOST_IF, "dhcp_leases": LEASES}.get(params["opt"], {"error": 0}))


def test_logs_in_and_sends_token_cookies_and_referer() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return _answer(request)

    devices = asyncio.run(_client(handler).list_devices())

    assert len(devices) == 3
    login = seen[0].url.params
    assert login["usrid"] == hashlib.md5(b"adminsecret").hexdigest()
    main = seen[1]
    assert (main.url.params["token"], main.url.params["opt"]) == ("T1", "main")
    assert "token=T1" in main.headers["Cookie"] and "lstatus=true" in main.headers["Cookie"]
    assert main.headers["Referer"] == "http://router.test/html/terminal.html"


def test_logs_in_again_when_session_expires() -> None:
    calls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        opt = request.url.params["opt"]
        calls.append(opt)
        if opt == "main" and calls.count("main") == 1:
            return httpx.Response(200, json={"error": 10007})
        return _answer(request, token=f"T{calls.count('login')}")

    asyncio.run(_client(handler).call("system", "main", "get"))

    assert calls == ["login", "main", "login", "main"]


def test_wrong_password() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"error": 10002})

    with pytest.raises(WavlinkConfigError):
        asyncio.run(_client(handler).call("system", "main", "get"))


def test_router_error_and_unreachable() -> None:
    def failing(request: httpx.Request) -> httpx.Response:
        if request.url.params["opt"] == "login":
            return _answer(request)
        return httpx.Response(502)

    def unreachable(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("timed out")

    for handler in (failing, unreachable):
        with pytest.raises(WavlinkUnavailableError):
            asyncio.run(_client(handler).call("system", "main", "get"))


@pytest.mark.parametrize(
    "action, expected",
    [
        (lambda c: c.set_blocked("AA:BB:CC:DD:EE:FF", True), {"opt": "host_black", "mac": "AA:BB:CC:DD:EE:FF", "index": "1"}),
        (lambda c: c.set_blocked("AA:BB:CC:DD:EE:FF", False), {"opt": "host_black", "index": "0"}),
        (lambda c: c.set_limit("AA:BB:CC:DD:EE:FF", 100, 20), {"opt": "host_ls", "down_speed": "100", "up_speed": "20"}),
        (lambda c: c.set_name("AA:BB:CC:DD:EE:FF", "Tele sala"), {"opt": "host_nick", "nick": "Tele sala"}),
    ],
)
def test_actions_send_router_parameters(action, expected: dict[str, str]) -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return _answer(request)

    asyncio.run(action(_client(handler)))

    params = seen[-1].url.params
    assert params["function"] == "set"
    assert {key: params[key] for key in expected} == expected
