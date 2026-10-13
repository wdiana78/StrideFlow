"""Security controls: rate limiting, password policy, upload sniffing, security headers, body size limits.

The rate limiter is in-process, which is right for a single Render instance. With several instances,
move the counters to Redis (same interface).
"""
import re
import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

# ---------- rate limiting ----------
_hits: dict[str, deque] = defaultdict(deque)
_lock = threading.Lock()


def rate_limit(key: str, limit: int, window_seconds: int) -> None:
    now = time.monotonic()
    with _lock:
        q = _hits[key]
        while q and q[0] <= now - window_seconds:
            q.popleft()
        if len(q) >= limit:
            retry = int(window_seconds - (now - q[0])) + 1
            raise HTTPException(429, f"Too many attempts. Try again in {retry} seconds.", headers={"Retry-After": str(retry)})
        q.append(now)


def reset_rate_limits() -> None:
    with _lock:
        _hits.clear()


def client_ip(request: Request) -> str:
    # Render and Vercel put the real client first in X-Forwarded-For.
    fwd = request.headers.get("x-forwarded-for", "")
    return fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "unknown")


# ---------- passwords ----------
COMMON = {"password", "password1", "password123", "12345678", "123456789", "1234567890", "qwerty123", "iloveyou", "admin123",
          "welcome1", "letmein123", "kenya2026", "nairobi123", "passw0rd", "changeme", "11111111", "00000000"}


def check_password(pw: str, email: str = "", name: str = "") -> None:
    problems = []
    if len(pw) < 10:
        problems.append("at least 10 characters")
    if not re.search(r"[A-Za-z]", pw) or not re.search(r"\d", pw):
        problems.append("letters and numbers")
    if problems:
        raise HTTPException(422, {"message": "Password needs " + " and ".join(problems) + ".", "field": "password"})
    low = pw.lower()
    local = (email or "").split("@")[0].lower()
    if low in COMMON or (len(local) >= 4 and local in low) or any(len(p) >= 4 and p.lower() in low for p in (name or "").split()):
        raise HTTPException(422, {"message": "That password is too easy to guess. Avoid common words and your name or email.", "field": "password"})


# ---------- uploads ----------
SIGNATURES = {
    ".jpg": [b"\xff\xd8\xff"], ".jpeg": [b"\xff\xd8\xff"], ".png": [b"\x89PNG\r\n\x1a\n"], ".webp": [b"RIFF"],
    ".pdf": [b"%PDF-"], ".docx": [b"PK\x03\x04"], ".xlsx": [b"PK\x03\x04"],
    ".doc": [b"\xd0\xcf\x11\xe0"], ".xls": [b"\xd0\xcf\x11\xe0"],
}
ALLOWED_UPLOADS = set(SIGNATURES) | {".csv", ".txt"}


def check_upload(ext: str, content: bytes) -> None:
    """Content must match its extension, so a renamed executable or HTML page cannot be stored as a 'photo'."""
    if ext not in ALLOWED_UPLOADS:
        raise HTTPException(422, "Upload a photo, PDF, Word, Excel, CSV or text file.")
    if ext in (".csv", ".txt"):
        try:
            text = content.decode("utf-8")
        except UnicodeDecodeError:
            raise HTTPException(422, "That file is not plain text.")
        if "\x00" in text or re.search(r"<\s*(script|html|iframe)", text, re.I):
            raise HTTPException(422, "That file contains content that is not allowed.")
        return
    if not any(content.startswith(sig) for sig in SIGNATURES[ext]):
        raise HTTPException(422, "The file's contents do not match its type. Re-save it and upload again.")
    if ext == ".webp" and content[8:12] != b"WEBP":
        raise HTTPException(422, "The file's contents do not match its type. Re-save it and upload again.")


# ---------- middleware ----------
API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"


class SecurityHeaders(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        h = response.headers
        h.setdefault("X-Content-Type-Options", "nosniff")
        h.setdefault("X-Frame-Options", "DENY")
        h.setdefault("Referrer-Policy", "no-referrer")
        h.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        h.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        h.setdefault("Cross-Origin-Opener-Policy", "same-origin")
        if not request.url.path.startswith("/docs") and not request.url.path.startswith("/openapi"):
            h.setdefault("Content-Security-Policy", API_CSP)
        if request.url.path.startswith("/api/"):
            h.setdefault("Cache-Control", "no-store")
        return response


class BodySizeLimit(BaseHTTPMiddleware):
    def __init__(self, app, max_bytes: int):
        super().__init__(app)
        self.max_bytes = max_bytes

    async def dispatch(self, request, call_next):
        length = request.headers.get("content-length")
        if length and length.isdigit() and int(length) > self.max_bytes:
            return JSONResponse(status_code=413, content={"detail": "That request is too large."})
        return await call_next(request)
