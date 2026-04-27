import logging
import time

from fastapi import FastAPI
from fastapi import Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import engine, Base
from app.logging_config import setup_logging
from app.routers import submissions, admin

setup_logging()
logger = logging.getLogger(__name__)

app = FastAPI(title="晨光打卡", version="1.0.0")

allowed_origins = {
    settings.frontend_url,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
}

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(allowed_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    started_at = time.perf_counter()
    client_host = request.client.host if request.client else "-"
    try:
        response = await call_next(request)
    except Exception:
        elapsed_ms = round((time.perf_counter() - started_at) * 1000, 2)
        logger.exception(
            "request_failed method=%s path=%s client=%s elapsed_ms=%s",
            request.method,
            request.url.path,
            client_host,
            elapsed_ms,
        )
        raise

    elapsed_ms = round((time.perf_counter() - started_at) * 1000, 2)
    logger.info(
        "request method=%s path=%s status=%s client=%s elapsed_ms=%s",
        request.method,
        request.url.path,
        response.status_code,
        client_host,
        elapsed_ms,
    )
    return response


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception(
        "unhandled_exception method=%s path=%s error=%s",
        request.method,
        request.url.path,
        exc.__class__.__name__,
    )
    return JSONResponse(status_code=500, content={"detail": "服务器内部错误，请联系管理员查看日志"})


@app.on_event("startup")
async def on_startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("backend_started title=%s frontend_url=%s", app.title, settings.frontend_url)


app.include_router(submissions.router)
app.include_router(admin.router)
