from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import get_settings, today
from .db import SessionLocal
from . import erp  # noqa: F401  (registers ERP module tables)
from .routers import activities, auth, flags, org, projects
from .routers import erp as erp_router
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
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


for r in (auth.router, org.router, projects.router, activities.router, flags.router, erp_router.router, erp_router.public):
    app.include_router(r, prefix="/api")

Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
app.mount("/files", StaticFiles(directory=settings.upload_dir), name="files")


@app.get("/api/health", tags=["meta"])
def health():
    return {"status": "ok", "today": today().isoformat()}
