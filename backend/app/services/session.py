import secrets

from fastapi import Request, HTTPException, status
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

from app.config import settings

SERIALIZER = URLSafeTimedSerializer(settings.admin_session_secret)
COOKIE_NAME = "admin_session"
CSRF_COOKIE_NAME = "admin_csrf"
CSRF_HEADER_NAME = "x-csrf-token"
MAX_AGE = 86400  # 24 hours


def create_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def create_session_cookie(username: str, csrf_token: str) -> str:
    return SERIALIZER.dumps({"username": username, "csrf_token": csrf_token})


def verify_session_cookie(cookie_value: str) -> dict:
    try:
        data = SERIALIZER.loads(cookie_value, max_age=MAX_AGE)
        username = data.get("username")
        csrf_token = data.get("csrf_token")
        if not username or not csrf_token:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")
        return data
    except (BadSignature, SignatureExpired):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session")


def get_current_admin_username(request: Request) -> str:
    cookie = request.cookies.get(COOKIE_NAME)
    if not cookie:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return verify_session_cookie(cookie)["username"]


def require_admin_csrf(request: Request) -> str:
    cookie = request.cookies.get(COOKIE_NAME)
    if not cookie:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    session_data = verify_session_cookie(cookie)
    session_csrf = session_data["csrf_token"]
    csrf_cookie = request.cookies.get(CSRF_COOKIE_NAME)
    csrf_header = request.headers.get(CSRF_HEADER_NAME)
    if (
        not csrf_cookie
        or not csrf_header
        or not secrets.compare_digest(session_csrf, csrf_cookie)
        or not secrets.compare_digest(session_csrf, csrf_header)
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CSRF token invalid")
    return session_data["username"]
