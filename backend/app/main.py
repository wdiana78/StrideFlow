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
from .routers import apps as apps_router
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
    title="StrideFlow API",
    description="Operations management platform API.",
    version="1.0.0",
    lifespan=lifespan,
)
app.add_middleware(SecurityHeaders)
app.add_middleware(BodySizeLimit, max_bytes=12 * 1024 * 1024)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=True,  # session cookies; state-changing cookie requests also need the X-CSRF-Token header
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-CSRF-Token"],
    max_age=600,
)


# Display labels for form fields (not credentials; Bandit B105 flags the word "Password" in a string literal).
LABELS = {"organization_name": "Organization name", "full_name": "Your name", "email": "Email", "currency": "Currency", "name": "Name", "title": "Title"}


def _human(field: str, e: dict) -> str:
    """Turn framework validation messages into sentences a person can act on."""
    label = LABELS.get(field.split(".")[-1], field.split(".")[-1].replace("_", " ").capitalize() or "This field")
    t, ctx = e.get("type", ""), e.get("ctx") or {}
    if t == "missing":
        return f"{label} is required."
    if t == "string_too_short":
        return f"{label} is required." if ctx.get("min_length") == 1 else f"{label} needs at least {ctx.get('min_length')} characters."
    if t == "string_too_long":
        return f"{label} can be at most {ctx.get('max_length')} characters."
    if t == "value_error" and "email" in e.get("msg", "").lower():
        return "Enter a valid email address, like name@company.com."
    if t in ("greater_than_equal", "greater_than"):
        return f"{label} must be at least {ctx.get('ge', ctx.get('gt'))}."
    if t in ("less_than_equal", "less_than"):
        return f"{label} must be at most {ctx.get('le', ctx.get('lt'))}."
    if t.endswith("_parsing") or t.endswith("_type"):
        return f"{label} is not in the right format."
    return e["msg"].removeprefix("Value error, ")


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    errors = []
    for e in exc.errors():
        field = ".".join(str(p) for p in e["loc"] if p not in ("body", "query", "path"))
        errors.append({"field": field, "message": _human(field, e)})
    first = errors[0] if errors else {"field": "", "message": "Check the form and try again."}
    # detail carries the first problem in the same shape as other field errors ({message, field}), so forms can place it.
    return JSONResponse(status_code=422, content={"detail": {"message": first["message"], "field": first["field"]}, "errors": errors})


for r in (auth.router, auth.invites, org.router, projects.router, activities.router, flags.router, erp_router.router, erp_router.public,
          forms_router.router, forms_router.public, apps_router.router):
    app.include_router(r, prefix="/api")

Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
STORED = re.compile(r"^[0-9a-f]{32}\.(jpg|jpeg|png|webp|pdf|doc|docx|xls|xlsx|csv|txt)$")
INLINE = {"jpg", "jpeg", "png", "webp", "pdf"}


@app.get("/files/{name}", include_in_schema=False)
def stored_file(name: str, request: Request):
    """Public website images are served to anyone; everything else only to signed-in members of the owning workspace.
    Any other request gets the same 404, so file names cannot be probed."""
    from fastapi import HTTPException

    from .deps import current_session
    from .models import StoredFile
    from .services.files import path_for

    missing = JSONResponse(status_code=404, content={"detail": "Not found."})
    if not STORED.match(name):
        return missing
    with SessionLocal() as db:
        row = db.get(StoredFile, name)
        if row is None:
            return missing
        if not row.public:
            try:
                sess = current_session(request, db)
            except HTTPException:
                return missing
            if sess.user.organization_id != row.organization_id or not sess.user.is_active:
                return missing
    path = path_for(name)
    if not path.is_file():
        return missing
    ext = name.rsplit(".", 1)[1]
    return FileResponse(path, headers={"Content-Disposition": "inline" if ext in INLINE else "attachment", "Cache-Control": "public, max-age=86400" if row.public else "private, no-store",
                                       "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox"})


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    logging.getLogger("kept").exception("Unhandled error on %s", request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Something went wrong on our side. Try again."})


@app.get("/api/health", tags=["meta"])
def health():
    """503 when the database is unreachable, so hosts and operators see the real state."""
    from sqlalchemy import text
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
    except Exception:  # noqa: BLE001 - any failure means unhealthy
        logging.getLogger("strideflow").exception("health check: database unreachable")
        return JSONResponse(status_code=503, content={"status": "unavailable", "database": "unreachable"})
    s = get_settings()
    return {"status": "ok", "database": "ok", "mode": s.app_mode, "today": today().isoformat()}
