import asyncio

import httpx
import pytest

from app.nano import NanoClient, NanoConfigError, NanoUnavailableError, parse_traffic

STATUS = {
    "host": {"uptime": 27784, "fwversion": "v8.7.11"},
    "wireless": {"sta": [{"signal": -77, "stats": {"rx_bytes": 2899577750, "tx_bytes": 529774555}}]},
}


def _client(handler) -> NanoClient:
    return NanoClient("nano.test", "user", "secret", transport=httpx.MockTransport(handler))


def test_parse_traffic() -> None:
    traffic = parse_traffic(STATUS)

    assert (traffic.rx_bytes, traffic.tx_bytes, traffic.uptime) == (2899577750, 529774555, 27784)


def test_parse_traffic_without_station() -> None:
    with pytest.raises(NanoUnavailableError):
        parse_traffic({"host": {"uptime": 1}, "wireless": {"sta": []}})


def test_logs_in_and_sends_csrf_and_cookie() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        if request.url.path == "/api/auth":
            return httpx.Response(200, headers={"X-CSRF-ID": "abc", "Set-Cookie": "AIROS_X=1; Path=/"}, json={})
        return httpx.Response(200, json=STATUS)

    traffic = asyncio.run(_client(handler).read_traffic())

    assert traffic.rx_bytes == 2899577750
    status_request = seen[-1]
    assert status_request.url.path == "/status.cgi"
    assert status_request.headers["X-CSRF-ID"] == "abc"
    assert "AIROS_X=1" in status_request.headers["Cookie"]


def test_logs_in_again_when_session_expires() -> None:
    calls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request.url.path)
        if request.url.path == "/api/auth":
            return httpx.Response(200, headers={"X-CSRF-ID": f"t{len(calls)}"}, json={})
        if calls.count("/status.cgi") == 2:
            return httpx.Response(401)
        return httpx.Response(200, json=STATUS)

    client = _client(handler)

    async def read_twice() -> None:
        await client.read_traffic()
        await client.read_traffic()

    asyncio.run(read_twice())

    assert calls == ["/api/auth", "/status.cgi", "/status.cgi", "/api/auth", "/status.cgi"]


def test_wrong_password() -> None:
    with pytest.raises(NanoConfigError):
        asyncio.run(_client(lambda request: httpx.Response(403)).read_traffic())


def test_unreachable() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("timed out")

    with pytest.raises(NanoUnavailableError):
        asyncio.run(_client(handler).read_traffic())
