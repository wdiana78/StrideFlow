import os

os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL", "postgresql+psycopg://kept:kept@localhost:5432/kept_test")
os.environ["KEPT_TODAY"] = "2026-10-13"
os.environ["UPLOAD_DIR"] = "/tmp/kept-test-uploads"

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


def register(client, org="Test Org", email="admin@test.example"):
    r = client.post("/api/auth/register", json={
        "organization_name": org, "full_name": "Ada Admin", "email": email, "password": "Coastal-Breeze-2026"})
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def add_user(client, admin_h, email, role, name="Someone"):
    r = client.post("/api/users", headers=admin_h, json={
        "full_name": name, "email": email, "role": role, "temporary_password": "Coastal-Breeze-2026"})
    assert r.status_code == 201, r.text
    tok = client.post("/api/auth/login", json={"email": email, "password": "Coastal-Breeze-2026"}).json()["access_token"]
    return r.json()["id"], {"Authorization": f"Bearer {tok}"}


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
