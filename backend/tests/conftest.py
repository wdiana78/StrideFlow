import os

os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL", "postgresql+psycopg://kept:kept@localhost:5432/kept_test")
os.environ["KEPT_TODAY"] = "2026-10-13"
os.environ["UPLOAD_DIR"] = "/tmp/kept-test-uploads"
os.environ["APP_MODE"] = "development"
os.environ["EMAIL_TRANSPORT"] = "log"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import erp, models  # noqa: E402,F401
from app.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture()
def client():
    from app.hardening import reset_rate_limits
    reset_rate_limits()
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with TestClient(app) as c:
        yield c


def bearer(client, r):
    """Tests act as API clients: take the session token from the cookie, send it as a Bearer header, and clear the
    client's cookie jar so no later request is silently authenticated by a leftover cookie."""
    token = r.cookies.get("sf_session")
    assert token, f"no session cookie in {r.status_code} {r.text[:200]}"
    client.cookies.clear()
    return {"Authorization": f"Bearer {token}"}


def register(client, org="Test Org", email="admin@test.example", template="community"):
    # Most tests exercise the community capabilities, so they adopt that starter template explicitly.
    body = {"organization_name": org, "full_name": "Ada Admin", "email": email, "password": "Coastal-Breeze-2026"}
    if template:
        body["template"] = template
    r = client.post("/api/auth/register", json=body)
    assert r.status_code == 201, r.text
    return bearer(client, r)


def login(client, email, password="Coastal-Breeze-2026"):
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return bearer(client, r)


def add_user(client, admin_h, email, role, name="Someone"):
    r = client.post("/api/users", headers=admin_h, json={
        "full_name": name, "email": email, "role": role, "temporary_password": "Coastal-Breeze-2026"})
    assert r.status_code == 201, r.text
    return r.json()["id"], login(client, email)


def community_template(client, h):
    return next(t for t in client.get("/api/templates", headers=h).json() if t["key"] == "community_programme")


def make_project(client, h, **over):
    t = community_template(client, h)
    body = {"name": "Pilot", "starts_on": "2026-08-01", "ends_on": "2026-12-31", "template_id": t["id"],
            "commitments": [{"title": "Train 100 people", "unit": "people", "measure": "sum", "target_value": 100,
                             "due_on": "2026-11-06"}]}
    body.update(over)
    r = client.post("/api/projects", headers=h, json=body)
    assert r.status_code == 201, r.text
    return r.json()
