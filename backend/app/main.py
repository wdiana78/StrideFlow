from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.responses import FileResponse

from .config import get_settings, today
from .db import SessionLocal
from . import erp  # noqa: F401  (registers ERP module tables)
from .routers import activities, auth, flags, org, projects
from .routers import erp as erp_router
from .routers import forms as forms_router
from .hardening import BodySizeLimit, SecurityHeaders
import logging
import re
from .templates_builtin import ensure_builtin_templates


@asynccontextmanager
async def lifespan(app: FastAPI):
    with SessionLocal() as db:
        ensure_builtin_templates(db)
    yield


settings = get_settings()
app = FastAPI(
    title="Kept API",
    description="Track promises to funders and clients, the work behind them, and the proof.",
    version="1.0.0",
    lifespan=lifespan,
)
app.add_middleware(SecurityHeaders)
app.add_middleware(BodySizeLimit, max_bytes=12 * 1024 * 1024)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=False,  # bearer tokens, not cookies: no ambient credentials, so no CSRF surface
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
    max_age=600,
)


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    errors = []
    for e in exc.errors():
        field = ".".join(str(p) for p in e["loc"] if p not in ("body", "query", "path"))
        msg = e["msg"].removeprefix("Value error, ")
        errors.append({"field": field, "message": msg})
    first = errors[0]["message"] if errors else "Check the form and try again."
    return JSONResponse(status_code=422, content={"detail": first, "errors": errors})


for r in (auth.router, org.router, projects.router, activities.router, flags.router, erp_router.router, erp_router.public,
          forms_router.router, forms_router.public):
    app.include_router(r, prefix="/api")

Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
STORED = re.compile(r"^[0-9a-f]{32}\.(jpg|jpeg|png|webp|pdf|doc|docx|xls|xlsx|csv|txt)$")
INLINE = {"jpg", "jpeg", "png", "webp", "pdf"}


@app.get("/files/{name}", include_in_schema=False)
def stored_file(name: str):
    # Only names this API generated (128-bit random) are served; no path traversal, and non-images download instead of rendering.
    if not STORED.match(name):
        return JSONResponse(status_code=404, content={"detail": "Not found."})
    path = Path(settings.upload_dir) / name
    if not path.is_file():
        return JSONResponse(status_code=404, content={"detail": "Not found."})
    ext = name.rsplit(".", 1)[1]
    return FileResponse(path, headers={"Content-Disposition": "inline" if ext in INLINE else "attachment",
                                       "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox"})


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    logging.getLogger("kept").exception("Unhandled error on %s", request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Something went wrong on our side. Try again."})


@app.get("/api/health", tags=["meta"])
def health():
    return {"status": "ok", "today": today().isoformat()}
