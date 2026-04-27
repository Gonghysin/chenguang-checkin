from fastapi import Request, HTTPException, status
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

from app.config import settings

SERIALIZER = URLSafeTimedSerializer(settings.admin_session_secret)
COOKIE_NAME = "admin_session"
MAX_AGE = 86400  # 24 hours


def create_session_cookie(username: str) -> str:
    return SERIALIZER.dumps({"username": username})


def verify_session_cookie(cookie_value: str) -> str:
    try:
        data = SERIALIZER.loads(cookie_value, max_age=MAX_AGE)
        return data.get("username")
    except (BadSignature, SignatureExpired):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session")


def get_current_admin_username(request: Request) -> str:
    cookie = request.cookies.get(COOKIE_NAME)
    if not cookie:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return verify_session_cookie(cookie)
