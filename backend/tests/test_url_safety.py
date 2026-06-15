"""URL-safety unit tests (SSRF guard). Pure/offline: IP-literal and bad-scheme
cases need no DNS, and the public/private host cases monkeypatch getaddrinfo so
the suite still makes no network calls."""

import socket

import pytest

from app.url_safety import has_web_scheme, is_safe_public_url


@pytest.mark.parametrize(
    "url,expected",
    [
        ("https://example.com", True),
        ("http://example.com/path?q=1", True),
        ("HTTP://Example.com", True),  # scheme is case-insensitive
        ("file:///etc/passwd", False),
        ("javascript:alert(1)", False),
        ("data:text/html,<script>", False),
        ("ftp://example.com", False),
        ("example.com", False),  # no scheme
        ("", False),
        ("http://", False),  # scheme but no host
    ],
)
def test_has_web_scheme(url, expected):
    assert has_web_scheme(url) is expected


@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1",
        "http://localhost",  # resolves to loopback, offline
        "http://169.254.169.254/latest/meta-data/",  # cloud metadata
        "http://10.0.0.5",
        "http://192.168.1.1",
        "http://172.16.0.1",
        "http://[::1]",  # IPv6 loopback
        "file:///etc/passwd",  # bad scheme is also unsafe
        "notaurl",
    ],
)
def test_is_safe_public_url_blocks_internal_and_bad(url):
    assert is_safe_public_url(url) is False


def test_is_safe_public_url_allows_public_host(monkeypatch):
    # Resolve to a public IP -> safe.
    monkeypatch.setattr(
        socket, "getaddrinfo",
        lambda *a, **k: [(socket.AF_INET, None, None, "", ("93.184.216.34", 0))],
    )
    assert is_safe_public_url("https://example.com") is True


def test_is_safe_public_url_blocks_host_resolving_to_internal(monkeypatch):
    # A public-looking name that resolves to an internal IP (DNS-rebind style)
    # must still be rejected.
    monkeypatch.setattr(
        socket, "getaddrinfo",
        lambda *a, **k: [(socket.AF_INET, None, None, "", ("10.1.2.3", 0))],
    )
    assert is_safe_public_url("https://sneaky.example.com") is False


def test_is_safe_public_url_rejects_when_any_address_internal(monkeypatch):
    # If a host resolves to a mix, one internal address is enough to reject.
    monkeypatch.setattr(
        socket, "getaddrinfo",
        lambda *a, **k: [
            (socket.AF_INET, None, None, "", ("93.184.216.34", 0)),
            (socket.AF_INET, None, None, "", ("127.0.0.1", 0)),
        ],
    )
    assert is_safe_public_url("https://mixed.example.com") is False


def test_is_safe_public_url_unresolvable_is_unsafe(monkeypatch):
    def _boom(*a, **k):
        raise socket.gaierror("no such host")

    monkeypatch.setattr(socket, "getaddrinfo", _boom)
    assert is_safe_public_url("https://does-not-exist.invalid") is False
