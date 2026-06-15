"""URL safety checks — keep user-supplied URLs from reaching internal targets.

Used both at the API boundary (reject obviously-bad input early) and at the
scrape sink (block requests that would resolve to private/loopback/link-local
addresses — i.e. SSRF)."""

import ipaddress
import socket
from urllib.parse import urlsplit


def has_web_scheme(url: str) -> bool:
    """True only for http(s) URLs with a hostname. Rejects file:, javascript:,
    data:, ftp:, schemeless input, etc. — cheap, no DNS lookup."""
    try:
        parts = urlsplit(url.strip())
    except (ValueError, AttributeError):
        return False
    return parts.scheme in ("http", "https") and bool(parts.hostname)


def _ip_is_public(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return False
    # Block loopback, private, link-local (incl. 169.254.169.254 metadata),
    # reserved, multicast, and unspecified ranges.
    return not (
        addr.is_private
        or addr.is_loopback
        or addr.is_link_local
        or addr.is_reserved
        or addr.is_multicast
        or addr.is_unspecified
    )


def is_safe_public_url(url: str) -> bool:
    """True only if `url` is http(s) and every address its host resolves to is a
    public/global IP. Used to guard the scraper against SSRF. Conservative:
    anything we cannot verify (bad scheme, DNS failure, internal IP) is unsafe."""
    if not has_web_scheme(url):
        return False
    host = urlsplit(url.strip()).hostname
    if not host:
        return False
    try:
        infos = socket.getaddrinfo(host, None)
    except (socket.gaierror, UnicodeError, ValueError):
        return False
    if not infos:
        return False
    # Every resolved address must be public — a host that resolves to even one
    # internal IP is rejected.
    return all(_ip_is_public(info[4][0]) for info in infos)
