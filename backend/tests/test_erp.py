from .conftest import add_user, make_project, register


def mk(client, h, key, body, code=201):
    r = client.post(f"/api/m/{key}", headers=h, json=body)
    assert r.status_code == code, r.text
    return r.json()


def setup_finance(client):
    admin = register(client)
    mid, manager = add_user(client, admin, "mgr@test.example", "manager", "Mo Manager")
    _, member = add_user(client, admin, "mem@test.example", "member", "Meg Member")
    p = make_project(client, admin)
    grant = mk(client, admin, "grants", {"title": "Health grant", "amount": 100000, "project_id": p["id"]})
    line = mk(client, admin, "budget_lines", {"name": "Transport", "grant_id": grant["id"], "amount": 10000, "category": "transport"})
    return admin, manager, member, p, grant, line


def test_spec_and_validation(client):
    admin = register(client)
    assert any(m["key"] == "expenses" for m in client.get("/api/modules", headers=admin).json()["modules"])
    r = client.post("/api/m/grants", headers=admin, json={"title": "No amount"})
    assert r.status_code == 422 and r.json()["errors"][0]["field"] == "amount"
    r = client.post("/api/m/vendors", headers=admin, json={"name": "X Ltd", "email": "not-an-email"})
    assert r.status_code == 422 and "email" in r.json()["detail"].lower()
    r = client.post("/api/m/leave_requests", headers=admin, json={"kind": "annual", "starts_on": "2026-11-10", "ends_on": "2026-11-01"})
    assert r.status_code == 422 and "on or after" in r.json()["detail"]


def test_expense_workflow_blocks_self_approval_and_needs_receipt(client):
    admin, manager, member, p, grant, line = setup_finance(client)
    exp = mk(client, member, "expenses", {"description": "Matatu", "budget_line_id": line["id"], "amount": 4000, "spent_on": "2026-10-01"})
    assert exp["status"] == "submitted" and exp["created_by_label"] == "Meg Member"
    assert any(a["id"] == exp["id"] for a in client.get("/api/approvals", headers=manager).json())
    r = client.post(f"/api/m/expenses/{exp['id']}/transition", headers=manager, json={"to": "approved"})
    assert r.status_code == 422 and "Receipt" in r.json()["detail"]
    client.patch(f"/api/m/expenses/{exp['id']}", headers=manager, json={"receipt": {"name": "r.jpg", "url": "/files/r.jpg"}})
    assert client.post(f"/api/m/expenses/{exp['id']}/transition", headers=manager, json={"to": "approved"}).status_code == 200
    own = mk(client, manager, "expenses", {"description": "Mine", "budget_line_id": line["id"], "amount": 100, "spent_on": "2026-10-01", "receipt": {"name": "a.jpg", "url": "/files/a.jpg"}})
    assert client.post(f"/api/m/expenses/{own['id']}/transition", headers=manager, json={"to": "approved"}).status_code == 403
    assert client.post(f"/api/m/expenses/{own['id']}/transition", headers=member, json={"to": "approved"}).status_code == 403
    assert client.post(f"/api/m/expenses/{own['id']}/transition", headers=admin, json={"to": "rejected"}).status_code == 422  # needs a note
    assert client.post(f"/api/m/expenses/{own['id']}/transition", headers=admin, json={"to": "paid"}).status_code == 409  # not approved yet


def test_budget_computed_and_overspend_flag(client):
    admin, manager, member, p, grant, line = setup_finance(client)
    for amount in (6000, 5000):
        e = mk(client, member, "expenses", {"description": "Fuel", "budget_line_id": line["id"], "amount": amount, "spent_on": "2026-10-01", "receipt": {"name": "x.jpg", "url": "/files/x.jpg"}})
        client.post(f"/api/m/expenses/{e['id']}/transition", headers=manager, json={"to": "approved"})
    got = client.get(f"/api/m/budget_lines/{line['id']}", headers=admin).json()
    assert got["spent"] == 11000 and got["remaining"] == -1000
    flags = client.get("/api/flags", headers=admin, params={"rule": "over_budget"}).json()["items"]
    assert flags and flags[0]["severity"] == "high"
    summary = client.get("/api/finance/summary", headers=admin).json()
    assert summary[0]["spent"] == 11000


def test_stock_and_low_stock_rule(client):
    admin = register(client)
    item = mk(client, admin, "items", {"name": "Flyers", "unit": "copies", "reorder_level": 100})
    mk(client, admin, "stock_moves", {"item_id": item["id"], "direction": "in", "quantity": 500, "moved_on": "2026-10-01"})
    mk(client, admin, "stock_moves", {"item_id": item["id"], "direction": "out", "quantity": 450, "moved_on": "2026-10-02"})
    assert client.get(f"/api/m/items/{item['id']}", headers=admin).json()["stock"] == 50
    assert any(f["rule"] == "low_stock" for f in client.get("/api/flags", headers=admin).json()["items"])


def test_permissions_and_isolation(client):
    admin, manager, member, p, grant, line = setup_finance(client)
    assert client.post("/api/m/grants", headers=member, json={"title": "X grant", "amount": 1}).status_code == 403
    other = register(client, "Other Org", "o@test.example")
    assert client.get(f"/api/m/grants/{grant['id']}", headers=other).status_code == 404
    assert client.get("/api/m/grants", headers=other).json()["total"] == 0
    r = client.post("/api/m/budget_lines", headers=other, json={"name": "Steal", "grant_id": grant["id"], "amount": 5})
    assert r.status_code == 422  # cannot reference another organization's grant
    mk(client, member, "expenses", {"description": "Fuel", "budget_line_id": line["id"], "amount": 10, "spent_on": "2026-10-01"})
    assert client.delete(f"/api/m/budget_lines/{line['id']}", headers=admin).status_code == 409  # expenses still use it


def test_public_portfolio_and_signups(client):
    admin = register(client)
    p = make_project(client, admin)
    mk(client, admin, "site_settings", {"slug": "testorg", "tagline": "We help", "intro": "About us", "show_impact": True})
    mk(client, admin, "site_programmes", {"title": "Training", "summary": "Skills", "project_id": p["id"], "published": True})
    mk(client, admin, "site_settings", {"slug": "again", "tagline": "x", "intro": "y"}, code=409)  # only one per organization
    site = client.get("/api/public/testorg").json()  # no sign-in
    assert site["tagline"] == "We help" and site["programmes"][0]["results"][0]["target"] == 100
    assert site["impact"] is not None
    r = client.post("/api/public/testorg/volunteer", json={"name": "Asha", "phone": "0712345678", "interest": "health"})
    assert r.status_code == 201
    vols = client.get("/api/m/volunteers", headers=admin).json()["items"]
    assert vols[0]["status"] == "applicant" and vols[0]["source"] == "website"
    assert client.post("/api/public/testorg/inquiry", json={"name": "Bo", "contact": "bo@x.example", "kind": "partner", "message": "Short"}).status_code == 422
    assert client.get("/api/public/missing").status_code == 404


def test_dashboard_and_calendar(client):
    admin, manager, member, p, grant, line = setup_finance(client)
    mk(client, admin, "events", {"title": "Outreach", "date": "2026-10-20", "kind": "outreach"})
    d = client.get("/api/dashboard", headers=admin).json()
    assert d["finance"]["budget"] == 10000 and len(d["upcoming_events"]) == 1
    cal = client.get("/api/calendar", headers=admin, params={"start": "2026-10-01", "end": "2026-10-31"}).json()
    assert any(i["kind"] == "event" for i in cal)
