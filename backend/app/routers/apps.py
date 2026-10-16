import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
import logging
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import erp
from ..apps import APPS, INDUSTRIES, INDUSTRY_BY_KEY, PALETTES
from ..config import get_settings
from ..db import get_db
from ..deps import admin_only, get_current_user
from ..models import Organization, User
from ..services.audit import log

router = APIRouter(tags=["apps"])


def _app_modules():
    out = {}
    for m in erp.SPEC["modules"]:
        out.setdefault(m["app"], []).append({"key": m["key"], "label": m["label"]})
    return out


DEFAULT_CAPABILITIES = ["projects", "forms", "finance", "documents"]


def available_apps() -> list[dict]:
    """Capabilities a customer can switch on. Demonstration-only capabilities (the case-study website builder) never appear in production."""
    prod = get_settings().app_mode == "production"
    return [a for a in APPS if not (prod and a.get("demo_only"))]


@router.get("/platform")
def platform():
    """Public catalogue: capabilities and optional starter templates."""
    apps = available_apps()
    keys = {a["key"] for a in apps}
    names = {a["key"]: a["name"] for a in apps}
    return {"apps": apps, "default_capabilities": DEFAULT_CAPABILITIES,
            "templates": [{**i, "apps": [x for x in i["apps"] if x in keys], "app_names": [names[x] for x in i["apps"] if x in keys]} for i in INDUSTRIES],
            # kept for older clients
            "industries": [{**i, "app_names": [names[x] for x in i["apps"] if x in keys]} for i in INDUSTRIES], "palettes": PALETTES}


@router.get("/apps")
def my_apps(user: User = Depends(get_current_user)):
    installed = set(user.organization.installed_apps or [])
    mods = _app_modules()
    return {"industry": user.organization.industry, "installed": sorted(installed),
            "apps": [{**a, "installed": a["key"] in installed, "modules": mods.get(a["key"], [])} for a in available_apps()]}


def _set(db: Session, admin: User, key: str, on: bool):
    if key not in {a["key"] for a in available_apps()}:
        raise HTTPException(404, "Unknown capability.")
    org = db.get(Organization, admin.organization_id)
    apps = set(org.installed_apps or [])
    apps.add(key) if on else apps.discard(key)
    org.installed_apps = sorted(apps)
    name = next(a["name"] for a in APPS if a["key"] == key)
    log(db, org.id, admin.id, "app_installed" if on else "app_removed", "organization", org.id,
        f"{admin.full_name} {'installed' if on else 'removed'} {name}" + ("" if on else " (data kept)"))
    db.commit()
    return {"installed": org.installed_apps}


@router.post("/apps/{key}/install")
def install(key: str, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    return _set(db, admin, key, True)


@router.post("/apps/{key}/uninstall")
def uninstall(key: str, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    return _set(db, admin, key, False)


def setup_new_org(db: Session, org: Organization, capabilities: list[str] | None = None, template: str | None = None):
    """A new workspace starts empty. It switches on the capabilities the person chose, a starter template they chose,
    or a small neutral default. No industry is assumed and no records are created."""
    allowed = {a["key"] for a in available_apps()}
    if template:
        ind = INDUSTRY_BY_KEY.get(template)
        if not ind:
            raise HTTPException(422, {"message": "Choose one of the listed templates.", "field": "template"})
        org.industry = template
        chosen = set(ind["apps"])
    elif capabilities:
        unknown = [c for c in capabilities if c not in allowed]
        if unknown:
            raise HTTPException(422, {"message": f"Unknown capability: {unknown[0]}.", "field": "capabilities"})
        org.industry = "general"
        chosen = set(capabilities)
    else:
        org.industry = "general"
        chosen = set(DEFAULT_CAPABILITIES)
    org.installed_apps = sorted(chosen & allowed)


class DemoIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    organization: str = Field(min_length=2, max_length=160)
    industry: str = Field(max_length=40)
    size: str = Field(max_length=20)
    contact: str = Field(min_length=5, max_length=160)
    message: str = Field(default="", max_length=2000)
    website: str = ""


@router.post("/platform/demo-request", status_code=201)
def demo_request(body: DemoIn, request: Request):
    """Sales enquiries from kept.africa. In production these go to the sales inbox (SMTP or CRM webhook)."""
    from ..hardening import client_ip, rate_limit
    rate_limit(f"demo:{client_ip(request)}", 5, 3600)
    if not body.website:
        logging.getLogger("kept.sales").info("Demo request from %s (%s, %s, %s)", body.organization, body.industry, body.size, body.contact)
    return {"ok": True}
