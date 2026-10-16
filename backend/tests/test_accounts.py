"""Phase 3 accounts: registration repairs, cookie sessions with CSRF, password reset, invitations, neutral workspaces, guards."""
import re
from datetime import datetime, timedelta, timezone

from app.services import email

from .conftest import bearer, login, register

PW = "Coastal-Breeze-2026"


def signup(client, **over):
    body = {"organization_name": "Acme Logistics", "full_name": "Jane Wanjiku", "email": "jane@acme.example", "password": PW, **over}
    return client.post("/api/auth/register", json=body)


# ---------- registration ----------
def test_new_workspace_is_neutral_and_empty(client):
    from app import erp
    from app.db import SessionLocal
    from sqlalchemy import func, select
    r = signup(client)
    assert r.status_code == 201
    org = r.json()["user"]["organization"]
    assert org["industry"] == "general" and org["kind"] == "customer"
    assert set(org["installed_apps"]) == {"projects", "forms", "finance", "documents"}
    with SessionLocal() as db:  # no business records anywhere
        for key, t in erp.TABLES.items():
            assert db.scalar(select(func.count()).select_from(t)) == 0, key


def test_capabilities_are_chosen_by_the_customer(client):
    r = signup(client, capabilities=["inventory", "deliveries"])
    assert set(r.json()["user"]["organization"]["installed_apps"]) == {"inventory", "deliveries"}
    bad = signup(client, email="b@acme.example", capabilities=["teleportation"])
    assert bad.status_code == 422 and bad.json()["detail"]["field"] == "capabilities"


def test_any_organization_name_length_works(client):
    assert signup(client, organization_name="Ab").status_code == 201
    long_name = "Mombasa Road Electronics and Appliances Limited, Industrial Area Branch Office"
    assert signup(client, email="l@acme.example", organization_name=long_name).status_code == 201


def test_mistakes_do_not_lock_people_out(client):
    for _ in range(6):
        assert signup(client, password="short").status_code == 422
    assert signup(client).status_code == 201


def test_validation_errors_are_human_and_name_the_field(client):
    r = signup(client, organization_name="")
    d = r.json()["detail"]
    assert r.status_code == 422 and d["field"] == "organization_name" and "pattern" not in d["message"] and "Organization name" in d["message"]
    e = signup(client, email="not-an-email").json()["detail"]
    assert e["field"] == "email" and "valid email" in e["message"]
    dup1, dup2 = signup(client), signup(client)
    assert dup2.status_code == 409 and dup2.json()["detail"]["field"] == "email"


# ---------- sessions and CSRF ----------
def test_browser_session_cookie_is_httponly_and_needs_csrf_for_changes(client):
    r = signup(client)
    cookies = r.headers.get_list("set-cookie")
    sess = next(c for c in cookies if c.startswith("sf_session="))
    assert "HttpOnly" in sess and "samesite=lax" in sess.lower()
    assert "HttpOnly" not in next(c for c in cookies if c.startswith("sf_csrf="))
    assert client.get("/api/auth/me").status_code == 200  # cookie works for reads
    no_csrf = client.post("/api/projects", json={"name": "P", "starts_on": "2026-10-01", "ends_on": "2026-12-01"})
    assert no_csrf.status_code == 403
    ok = client.post("/api/auth/logout", headers={"X-CSRF-Token": client.cookies.get("sf_csrf")})
    assert ok.status_code == 204 and client.get("/api/auth/me").status_code == 401


def test_logout_revokes_only_that_session_and_everywhere_revokes_all(client):
    a = register(client)
    b = login(client, "admin@test.example")
    assert client.post("/api/auth/logout", headers=a).status_code == 204
    assert client.get("/api/auth/me", headers=a).status_code == 401 and client.get("/api/auth/me", headers=b).status_code == 200
    c = login(client, "admin@test.example")
    assert client.post("/api/auth/logout-everywhere", headers=c).status_code == 204
    assert client.get("/api/auth/me", headers=b).status_code == 401


def test_idle_sessions_expire(client):
    from app.db import SessionLocal
    from app.models import AuthSession
    h = register(client)
    with SessionLocal() as db:
        for s in db.query(AuthSession).all():
            s.last_seen_at = datetime.now(timezone.utc) - timedelta(hours=9)
        db.commit()
    assert client.get("/api/auth/me", headers=h).status_code == 401


# ---------- password reset ----------
def _link(kind):
    return re.search(rf"{kind}\?token=([\w-]+)", email.outbox[-1]["text"]).group(1)


def test_password_reset_end_to_end(client):
    h = register(client)
    email.outbox.clear()
    same = client.post("/api/auth/password-reset", json={"email": "nobody@test.example"})
    r = client.post("/api/auth/password-reset", json={"email": "admin@test.example"})
    assert r.status_code == same.status_code == 202 and r.json() == same.json()  # no account enumeration
    assert len(email.outbox) == 1 and email.outbox[0]["to"] == "admin@test.example"
    token = _link("reset-password")
    weak = client.post("/api/auth/password-reset/confirm", json={"token": token, "new_password": "short"})
    assert weak.status_code == 422
    ok = client.post("/api/auth/password-reset/confirm", json={"token": token, "new_password": "Mangrove-Tide-4421"})
    assert ok.status_code == 200
    assert client.get("/api/auth/me", headers=h).status_code == 401  # existing sessions signed out
    again = client.post("/api/auth/password-reset/confirm", json={"token": token, "new_password": "Another-Tide-5532"})
    assert again.status_code == 400  # single use
    assert login(client, "admin@test.example", "Mangrove-Tide-4421")


def test_reset_links_expire(client):
    from app.db import SessionLocal
    from app.models import PasswordResetToken
    register(client)
    client.post("/api/auth/password-reset", json={"email": "admin@test.example"})
    token = _link("reset-password")
    with SessionLocal() as db:
        for t in db.query(PasswordResetToken).all():
            t.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        db.commit()
    assert client.post("/api/auth/password-reset/confirm", json={"token": token, "new_password": "Mangrove-Tide-4421"}).status_code == 400


# ---------- invitations ----------
def test_invitation_flow(client):
    admin = register(client)
    _, member = (None, None)
    r = client.post("/api/invitations", headers=admin, json={"email": "Kim@Test.example", "role": "manager", "full_name": "Kim"})
    assert r.status_code == 201 and r.json()["state"] == "pending"
    token = _link("accept-invitation")
    info = client.get(f"/api/auth/invitations/{token}").json()
    assert info == {"organization": "Test Org", "email": "kim@test.example", "full_name": "Kim", "role": "manager"}
    acc = client.post(f"/api/auth/invitations/{token}/accept", json={"full_name": "Kim Otieno", "password": "Savanna-Dawn-8812"})
    assert acc.status_code == 201
    kim = bearer(client, acc)
    me = client.get("/api/auth/me", headers=kim).json()
    assert me["role"] == "manager" and me["organization"]["name"] == "Test Org"
    assert client.post(f"/api/auth/invitations/{token}/accept", json={"full_name": "Kim", "password": "Savanna-Dawn-8812"}).status_code == 404
    assert client.get("/api/invitations", headers=admin).json()[0]["state"] == "accepted"


def test_invitations_are_admin_only_revocable_and_expire(client):
    from app.db import SessionLocal
    from app.models import Invitation
    admin = register(client)
    from .conftest import add_user
    _, member = add_user(client, admin, "m@test.example", "member")
    assert client.post("/api/invitations", headers=member, json={"email": "x@test.example"}).status_code == 403
    inv = client.post("/api/invitations", headers=admin, json={"email": "x@test.example"}).json()
    t1 = _link("accept-invitation")
    assert client.delete(f"/api/invitations/{inv['id']}", headers=admin).status_code == 204
    assert client.get(f"/api/auth/invitations/{t1}").status_code == 404
    client.post("/api/invitations", headers=admin, json={"email": "y@test.example"})
    t2 = _link("accept-invitation")
    with SessionLocal() as db:
        for i in db.query(Invitation).all():
            i.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        db.commit()
    assert client.get(f"/api/auth/invitations/{t2}").status_code == 404
    other = register(client, "Other Org", "o@test.example")
    assert client.delete(f"/api/invitations/{inv['id']}", headers=other).status_code == 404


# ---------- platform guards ----------
def test_health_reports_database_state(client, monkeypatch):
    assert client.get("/api/health").json()["database"] == "ok"
    import app.main as m

    class Broken:
        def __enter__(self): raise RuntimeError("down")
        def __exit__(self, *a): return False
    monkeypatch.setattr(m, "SessionLocal", lambda: Broken())
    r = client.get("/api/health")
    assert r.status_code == 503 and r.json()["database"] == "unreachable"


def test_showcase_endpoint_removed_and_production_hides_demo_capabilities(client, monkeypatch):
    assert client.get("/api/platform/showcase").status_code in (404, 405)
    from app import config
    monkeypatch.setattr(config.get_settings(), "app_mode", "production")
    assert "website" not in {a["key"] for a in client.get("/api/platform").json()["apps"]}
    assert signup(client, capabilities=["website"]).status_code == 422


def test_production_refuses_demo_workspaces(client, monkeypatch):
    from app.db import SessionLocal
    from app.models import Organization
    h = register(client)
    with SessionLocal() as db:
        for o in db.query(Organization).all():
            o.kind = "demo_scenario"
        db.commit()
    from app import config
    monkeypatch.setattr(config.get_settings(), "app_mode", "production")
    assert client.get("/api/auth/me", headers=h).status_code == 401
    assert client.post("/api/auth/login", json={"email": "admin@test.example", "password": PW}).status_code == 401


def test_seed_refuses_production(monkeypatch):
    import pytest
    import seed
    from app import config
    monkeypatch.setattr(config.get_settings(), "app_mode", "production")
    with pytest.raises(SystemExit):
        seed._refuse_production()


def test_dashboard_knows_when_a_workspace_is_empty(client):
    r = signup(client)
    h = bearer(client, r)
    assert client.get("/api/dashboard", headers=h).json()["is_empty"] is True
    client.post("/api/m/documents", headers=h, json={"title": "Lease"})
    assert client.get("/api/dashboard", headers=h).json()["is_empty"] is False
