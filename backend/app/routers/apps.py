import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
import logging
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import erp
from ..apps import APP_KEYS, APPS, INDUSTRIES, INDUSTRY_BY_KEY, PALETTES
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


@router.get("/platform")
def platform():
    """Public catalogue for the Kept home page: apps, industries, palettes."""
    names = {a["key"]: a["name"] for a in APPS}
    return {"apps": APPS, "palettes": PALETTES,
            "industries": [{**i, "app_names": [names[a] for a in i["apps"]]} for i in INDUSTRIES]}


@router.get("/platform/showcase")
def showcase(db: Session = Depends(get_db)):
    st = erp.TABLES["site_settings"]
    rows = db.execute(select(st, Organization.name, Organization.industry).join(Organization, Organization.id == st.c.organization_id)).all()
    order = {"timiza": 1, "tumaini": 2, "hatua": 3, "mwangaza": 4, "pwani": 5}
    out = [{"slug": r.slug, "organization": r.name, "industry": INDUSTRY_BY_KEY.get(r.industry, {}).get("name", r.industry), "kind": "Business" if r.industry in ("retail", "hospitality", "agency") else "Organization",
            "tagline": r.tagline, "primary": r.brand_primary, "accent": r.brand_accent, "deep": r.brand_deep} for r in rows]
    return sorted(out, key=lambda x: order.get(x["slug"], 99))


@router.get("/apps")
def my_apps(user: User = Depends(get_current_user)):
    installed = set(user.organization.installed_apps or [])
    mods = _app_modules()
    return {"industry": user.organization.industry, "installed": sorted(installed),
            "apps": [{**a, "installed": a["key"] in installed, "modules": mods.get(a["key"], [])} for a in APPS]}


def _set(db: Session, admin: User, key: str, on: bool):
    if key not in APP_KEYS:
        raise HTTPException(404, "Unknown app.")
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


def setup_new_org(db: Session, org: Organization, user: User, industry: str, slug: str | None, palette: str):
    ind = INDUSTRY_BY_KEY.get(industry)
    if not ind:
        raise HTTPException(422, "Choose an industry.")
    org.industry = industry
    org.installed_apps = sorted(set(ind["apps"]))
    if slug:
        st = erp.TABLES["site_settings"]
        if db.execute(select(st.c.id).where(st.c.slug == slug)).first():
            raise HTTPException(409, {"message": "That web address is taken. Try another.", "field": "site_slug"})
        pal = PALETTES.get(palette, PALETTES["royal"])
        db.execute(st.insert().values(id=uuid.uuid4(), organization_id=org.id, created_by_id=user.id, created_at=erp.now(), updated_at=erp.now(),
                                      slug=slug, tagline=f"Welcome to {org.name}", intro=f"{org.name} on Kept.", show_impact=True,
                                      brand_primary=pal["primary"], brand_accent=pal["accent"]))



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
