from .conftest import add_user, make_project, register


def test_register_login_me(client):
    h = register(client)
    me = client.get("/api/auth/me", headers=h).json()
    assert me["role"] == "admin" and me["organization"]["name"] == "Test Org"
    assert client.post("/api/auth/login", json={"email": "admin@test.example", "password": "wrong-pass"}).status_code == 401
    dup = client.post("/api/auth/register", json={"organization_name": "X Org", "full_name": "Y Z",
                                                  "email": "ADMIN@test.example", "password": "Coastal-Breeze-2026"})
    assert dup.status_code == 409


def test_requires_token(client):
    assert client.get("/api/projects").status_code == 401
    assert client.get("/api/projects", headers={"Authorization": "Bearer nonsense"}).status_code == 401


def test_validation_messages_are_readable(client):
    h = register(client)
    r = client.post("/api/projects", headers=h, json={"name": "Bad", "starts_on": "2026-10-01", "ends_on": "2026-09-01"})
    assert r.status_code == 422
    assert r.json()["detail"]["message"] == "The end date must be after the start date."
    short = client.post("/api/auth/register", json={"organization_name": "X Org", "full_name": "Y Z",
                                                    "email": "x@test.example", "password": "short"})
    assert short.status_code == 422 and short.json()["detail"]["field"] == "password"


def test_roles_enforced_by_backend(client):
    admin = register(client)
    _, member = add_user(client, admin, "m@test.example", "member")
    _, viewer = add_user(client, admin, "v@test.example", "viewer")
    p = make_project(client, admin)
    assert client.post("/api/projects", headers=member, json={"name": "Nope", "starts_on": "2026-08-01", "ends_on": "2026-09-01"}).status_code == 403
    assert client.patch(f"/api/projects/{p['id']}", headers=viewer, json={"name": "Renamed"}).status_code == 403
    assert client.get(f"/api/projects/{p['id']}", headers=viewer).status_code == 200
    assert client.get("/api/audit", headers=member).status_code == 403


def test_members_only_work_on_their_own_activities(client):
    admin = register(client)
    mid, member = add_user(client, admin, "m@test.example", "member")
    p = make_project(client, admin)
    c = p["commitments"][0]["id"]
    mine = client.post("/api/activities", headers=admin, json={"commitment_id": c, "title": "Mine", "due_on": "2026-10-20", "owner_id": mid}).json()
    other = client.post("/api/activities", headers=admin, json={"commitment_id": c, "title": "Not mine", "due_on": "2026-10-20"}).json()
    assert client.patch(f"/api/activities/{mine['id']}", headers=member, json={"status": "in_progress"}).status_code == 200
    assert client.patch(f"/api/activities/{other['id']}", headers=member, json={"status": "in_progress"}).status_code == 403
    assert client.patch(f"/api/activities/{mine['id']}", headers=member, json={"due_on": "2026-11-01"}).status_code == 403


def test_organizations_are_isolated(client):
    a = register(client, "Org A", "a@test.example")
    b = register(client, "Org B", "b@test.example")
    p = make_project(client, a)
    assert client.get(f"/api/projects/{p['id']}", headers=b).status_code == 404
    assert client.get("/api/projects", headers=b).json()["total"] == 0
    act = client.post("/api/activities", headers=a, json={"commitment_id": p["commitments"][0]["id"], "title": "Secret", "due_on": "2026-10-20"}).json()
    assert client.get(f"/api/activities/{act['id']}", headers=b).status_code == 404
