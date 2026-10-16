"""Security tests: authentication, authorisation, injection, uploads, headers, abuse controls, payments."""
import base64
import json
from datetime import datetime, timedelta, timezone


from app.config import get_settings
from .conftest import login, add_user, make_project, register

PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 64


def test_security_headers_present(client):
    r = client.get("/api/health")
    for h in ("X-Content-Type-Options", "X-Frame-Options", "Content-Security-Policy", "Referrer-Policy", "Strict-Transport-Security"):
        assert h in r.headers, h
    assert r.headers["X-Frame-Options"] == "DENY"


def test_weak_and_personal_passwords_rejected(client):
    for pw in ("short1", "onlyletterslong", "password123", "adaadmin2026x"):
        r = client.post("/api/auth/register", json={"organization_name": "X Org", "full_name": "Ada Admin", "email": "adaadmin@t.example", "password": pw})
        assert r.status_code == 422, pw


def test_account_locks_after_five_failures_and_logs_it(client):
    h = register(client)
    for _ in range(5):
        assert client.post("/api/auth/login", json={"email": "admin@test.example", "password": "Wrong-Guess-111"}).status_code == 401
    r = client.post("/api/auth/login", json={"email": "admin@test.example", "password": "Coastal-Breeze-2026"})
    assert r.status_code == 423  # locked even with the right password
    from app.db import SessionLocal
    from app.models import User
    with SessionLocal() as db:  # unlock to read the audit log
        u = db.query(User).filter_by(email="admin@test.example").one()
        u.locked_until = None
        db.commit()
    events = client.get("/api/audit", headers=h).json()["items"]
    assert any(e["action"] == "account_locked" for e in events)


def test_unknown_email_and_wrong_password_look_identical(client):
    register(client)
    a = client.post("/api/auth/login", json={"email": "nobody@test.example", "password": "Wrong-Guess-111"})
    b = client.post("/api/auth/login", json={"email": "admin@test.example", "password": "Wrong-Guess-111"})
    assert a.status_code == b.status_code == 401 and a.json() == b.json()


def test_forged_unknown_and_expired_sessions_rejected(client):
    from app.db import SessionLocal
    from app.models import AuthSession
    h = register(client)
    token = h["Authorization"].split()[1]
    for bad in ("nonsense", token[:-2] + "xx", "eyJhbGciOiJub25lIn0.eyJzdWIiOiJ4In0."):
        assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {bad}"}).status_code == 401
    assert client.get("/api/auth/me", headers=h).status_code == 200
    with SessionLocal() as db:  # absolute expiry reached
        for srow in db.query(AuthSession).all():
            srow.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        db.commit()
    assert client.get("/api/auth/me", headers=h).status_code == 401


def test_session_tokens_are_stored_only_as_hashes(client):
    from app.db import SessionLocal
    from app.models import AuthSession
    token = register(client)["Authorization"].split()[1]
    with SessionLocal() as db:
        stored = [s.token_hash for s in db.query(AuthSession).all()]
    assert token not in stored and len(stored[0]) == 64


def test_password_change_signs_out_other_sessions(client):
    h = register(client)
    other = login(client, "admin@test.example")
    r = client.post("/api/auth/password", headers=h, json={"current_password": "Coastal-Breeze-2026", "new_password": "Mangrove-Tide-4421"})
    assert r.status_code == 200
    assert client.get("/api/auth/me", headers=other).status_code == 401
    assert client.get("/api/auth/me", headers=h).status_code == 200  # the session that changed it stays signed in


def test_role_change_takes_effect_immediately(client):
    admin = register(client)
    uid, manager = add_user(client, admin, "m@test.example", "manager")
    client.patch(f"/api/users/{uid}", headers=admin, json={"role": "viewer"})
    assert client.get("/api/auth/me", headers=manager).status_code == 401  # old manager token is dead


def test_privilege_escalation_blocked(client):
    admin = register(client)
    uid, member = add_user(client, admin, "m@test.example", "member")
    assert client.patch(f"/api/users/{uid}", headers=member, json={"role": "admin"}).status_code == 403
    assert client.post("/api/users", headers=member, json={"full_name": "Evil", "email": "e@test.example", "role": "admin", "temporary_password": "Strong-Pass-998"}).status_code == 403


def test_mass_assignment_ignored(client):
    a = register(client, "Org A", "a@test.example")
    b = register(client, "Org B", "b@test.example")
    b_org = client.get("/api/auth/me", headers=b).json()["organization"]["id"]
    v = client.post("/api/m/vendors", headers=a, json={"name": "Vendor X", "organization_id": b_org, "created_by_id": None, "id": "00000000-0000-0000-0000-000000000000"}).json()
    assert v["organization_id"] != b_org and v["id"] != "00000000-0000-0000-0000-000000000000"
    d = client.post("/api/m/donations", headers=a, json={"donor_name": "X", "amount": 10, "method": "cash", "provider_ref": "forged"}).json()
    assert d.get("provider_ref") is None


def test_sql_injection_payloads_are_inert(client):
    h = register(client)
    make_project(client, h)
    for payload in ("' OR 1=1 --", "'; DROP TABLE users; --", "%' UNION SELECT password_hash FROM users --"):
        r = client.get("/api/m/vendors", headers=h, params={"q": payload})
        assert r.status_code == 200 and r.json()["total"] == 0
        assert client.get("/api/projects", headers=h, params={"q": payload}).json()["total"] == 0
    assert client.get("/api/auth/me", headers=h).status_code == 200  # users table still there


def test_stored_script_is_kept_as_text_and_links_are_not_accepted(client):
    h = register(client)
    v = client.post("/api/m/vendors", headers=h, json={"name": "<script>alert(1)</script>"}).json()
    assert v["name"] == "<script>alert(1)</script>"  # stored verbatim, rendered as text by React (no innerHTML anywhere)
    r = client.post("/api/m/documents", headers=h, json={"title": "Policy", "file": {"name": "x.pdf", "url": "javascript:alert(1)"}})
    assert r.status_code == 422
    r = client.post("/api/m/documents", headers=h, json={"title": "Policy", "file": {"name": "x.pdf", "url": "https://evil.example/x.pdf"}})
    assert r.status_code == 422


def test_upload_content_must_match_extension(client):
    h = register(client)
    bad = client.post("/api/uploads", headers=h, files={"file": ("photo.jpg", b"MZ\x90\x00 executable", "image/jpeg")})
    assert bad.status_code == 422
    html = client.post("/api/uploads", headers=h, files={"file": ("notes.txt", b"<script>steal()</script>", "text/plain")})
    assert html.status_code == 422
    ok = client.post("/api/uploads", headers=h, files={"file": ("photo.png", PNG, "image/png")})
    assert ok.status_code == 201
    served = client.get(ok.json()["url"])
    assert served.status_code == 200 and served.headers["X-Content-Type-Options"] == "nosniff"
    assert client.get("/files/../app/config.py").status_code == 404
    assert client.get("/files/..%2F..%2Fetc%2Fpasswd").status_code == 404


def test_public_forms_are_rate_limited_and_honeypot_drops_bots(client):
    h = register(client)
    client.post("/api/m/site_settings", headers=h, json={"slug": "org", "tagline": "Hi", "intro": "About"})
    bot = client.post("/api/public/org/volunteer", json={"name": "Bot", "phone": "0700000000", "website": "spam.example"})
    assert bot.status_code == 201 and client.get("/api/m/volunteers", headers=h).json()["total"] == 0
    codes = [client.post("/api/public/org/inquiry", json={"name": "Spam", "contact": "s@x.example", "message": "Buy now buy now"}).status_code for _ in range(12)]
    assert codes.count(429) >= 2


def test_donation_flow_sandbox(client):
    h = register(client)
    p = make_project(client, h)
    client.post("/api/m/site_settings", headers=h, json={"slug": "org", "tagline": "Hi", "intro": "About", "donation_goal": 10000})
    assert client.post("/api/public/org/donations", json={"name": "Donor", "contact": "0712345678", "amount": 10}).status_code == 422  # below minimum
    d = client.post("/api/public/org/donations", json={"name": "Asha Donor", "contact": "0712345678", "amount": 2500, "project_id": p["id"]}).json()
    assert d["status"] == "pending" and d["mode"] == "sandbox"
    assert client.get(f"/api/public/org/donations/{d['id']}", params={"ref": "DN-WRONG"}).status_code == 404  # no enumeration
    done = client.post(f"/api/public/org/donations/{d['id']}/simulate", json={"ref": d["reference"], "outcome": "success"}).json()
    assert done["status"] == "confirmed"
    income = client.get("/api/m/income", headers=h).json()["items"]
    assert income and income[0]["amount"] == 2500 and income[0]["source"] == "Donation: Asha Donor"
    site = client.get("/api/public/org").json()
    assert site["donations"]["raised"] == 2500 and site["donations"]["donors"] == 1
    # settled donations cannot be flipped again
    again = client.post(f"/api/public/org/donations/{d['id']}/simulate", json={"ref": d["reference"], "outcome": "cancel"}).json()
    assert again["status"] == "confirmed"


def test_mpesa_callback_needs_secret_token(client):
    assert client.post("/api/payments/mpesa/callback/guess", json={}).status_code == 404


def test_forms_validation_and_public_access(client):
    h = register(client)
    _, viewer = add_user(client, h, "v@test.example", "viewer")
    form = client.post("/api/forms", headers=h, json={"title": "Exit survey", "is_public": True, "fields": [
        {"id": "rating", "label": "Rating", "type": "rating", "required": True},
        {"id": "ward", "label": "Ward", "type": "select", "options": ["A", "B"]}]}).json()
    assert client.post(f"/api/public/forms/{form['id']}", json={"rating": 9}).status_code == 422
    assert client.post(f"/api/public/forms/{form['id']}", json={"rating": 4, "ward": "Z"}).status_code == 422
    assert client.post(f"/api/public/forms/{form['id']}", json={"rating": 4, "ward": "A"}).status_code == 201
    assert client.post(f"/api/forms/{form['id']}/submissions", headers=viewer, json={"rating": 3}).status_code == 403
    assert client.get(f"/api/forms/{form['id']}/submissions", headers=h).json()["total"] == 1
    client.put(f"/api/forms/{form['id']}", headers=h, json={**{k: form[k] for k in ("title", "fields")}, "is_public": False})
    assert client.get(f"/api/public/forms/{form['id']}").status_code == 404
    other = register(client, "Other", "o@test.example")
    assert client.get(f"/api/forms/{form['id']}/submissions", headers=other).status_code == 404
